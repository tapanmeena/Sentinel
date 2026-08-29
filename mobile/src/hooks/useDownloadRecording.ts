import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';

import { describeError } from '@/api/errors';
import { downloadUrl } from '@/api/recordings';
import { toast } from '@/components/ui/Toast';
import { baseName } from '@/utils/format';

export type DownloadAction = 'save' | 'share';

interface DownloadState {
  isDownloading: boolean;
  progress: number;
}

/**
 * Downloads a recording to the app cache, then either adds it to the device
 * gallery or hands it to the OS share sheet.
 */
export function useDownloadRecording(mediaToken: string | null) {
  const [state, setState] = useState<DownloadState>({ isDownloading: false, progress: 0 });

  const run = useCallback(
    async (cameraId: string, filename: string, action: DownloadAction) => {
      if (state.isDownloading) return;
      if (!mediaToken) {
        toast.error('Media access is still being prepared. Try again in a moment.');
        return;
      }

      const safeName = baseName(filename);
      const target = `${FileSystem.cacheDirectory ?? ''}${safeName}`;

      setState({ isDownloading: true, progress: 0 });
      try {
        const task = FileSystem.createDownloadResumable(
          downloadUrl(cameraId, safeName, mediaToken),
          target,
          {},
          ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            if (totalBytesExpectedToWrite > 0) {
              setState({
                isDownloading: true,
                progress: totalBytesWritten / totalBytesExpectedToWrite,
              });
            }
          },
        );

        const result = await task.downloadAsync();
        if (!result?.uri) throw new Error('Download did not complete');

        if (action === 'save') {
          const permission = await MediaLibrary.requestPermissionsAsync(true);
          if (!permission.granted) {
            // Fall back to sharing so the download is not wasted.
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
              await Sharing.shareAsync(result.uri, { mimeType: 'video/mp4' });
              return;
            }
            toast.warning('Gallery permission denied. Grant access in system settings to save.');
            return;
          }

          if (Platform.OS === 'android') {
            await MediaLibrary.createAssetAsync(result.uri);
          } else {
            await MediaLibrary.saveToLibraryAsync(result.uri);
          }
          toast.success(`Saved ${safeName} to your gallery`);
          return;
        }

        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
          toast.warning('Sharing is not available on this device');
          return;
        }
        await Sharing.shareAsync(result.uri, {
          mimeType: 'video/mp4',
          dialogTitle: safeName,
          UTI: 'public.mpeg-4',
        });
      } catch (error) {
        toast.error(describeError(error));
      } finally {
        setState({ isDownloading: false, progress: 0 });
      }
    },
    [mediaToken, state.isDownloading],
  );

  return {
    ...state,
    download: run,
  };
}
