import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';

import { playbackUrl } from '@/api/recordings';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Layout';
import { useDownloadRecording } from '@/hooks/useDownloadRecording';
import { useMediaToken } from '@/hooks/useMediaToken';
import { useTheme } from '@/theme/ThemeProvider';
import { baseName, recordingTitle } from '@/utils/format';

export default function PlayerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ cameraId: string; filename: string }>();

  const cameraId = params.cameraId ?? '';
  const filename = baseName(params.filename ?? '');

  const { mediaToken } = useMediaToken();
  const { download, isDownloading, progress } = useDownloadRecording(mediaToken);
  const [chromeVisible, setChromeVisible] = useState(true);

  const source = mediaToken && cameraId && filename ? playbackUrl(cameraId, filename, mediaToken) : null;

  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 1;
    instance.play();
  });

  const { status, error } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const isLoading = !source || status === 'loading' || status === 'idle';
  const hasError = status === 'error';

  return (
    <View style={styles.root}>
      <Pressable style={styles.videoArea} onPress={() => setChromeVisible((v) => !v)}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture={false}
        />
      </Pressable>

      {isLoading && !hasError ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.colors.brand} />
        </View>
      ) : null}

      {hasError ? (
        <View style={styles.centerOverlay}>
          <Icon name="alertTriangle" size={30} color={theme.colors.danger} />
          <Txt variant="heading" align="center" style={styles.onDark}>
            Could not play this recording
          </Txt>
          <Txt variant="small" tone="muted" align="center">
            {error?.message ?? 'The file may be corrupt, or the server is unreachable.'}
          </Txt>
        </View>
      ) : null}

      {chromeVisible ? (
        <>
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <IconButton
              icon="arrowLeft"
              label="Back to recordings"
              onPress={() => router.back()}
              size={40}
              variant="plain"
              style={styles.chromeButton}
            />
            <View style={styles.titleWrap}>
              <Txt variant="bodyStrong" numberOfLines={1} style={styles.onDark}>
                {recordingTitle(filename)}
              </Txt>
              <Txt variant="small" tone="muted" numberOfLines={1}>
                {cameraId}
              </Txt>
            </View>
          </View>

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <IconButton
              icon="download"
              label={isDownloading ? `Saving ${Math.round(progress * 100)} percent` : 'Save to gallery'}
              onPress={() => download(cameraId, filename, 'save')}
              disabled={isDownloading || !mediaToken}
              size={44}
              style={styles.chromeButton}
            />
            <IconButton
              icon="share"
              label="Share recording"
              onPress={() => download(cameraId, filename, 'share')}
              disabled={isDownloading || !mediaToken}
              size={44}
              style={styles.chromeButton}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  videoArea: { flex: 1 },
  video: { flex: 1 },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  titleWrap: { flex: 1, gap: 1 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  chromeButton: { backgroundColor: 'rgba(255,255,255,0.12)' },
  onDark: { color: '#FFFFFF' },
});
