import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { CameraStatus } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { MjpegStream } from './MjpegStream';
import { Icon } from './ui/Icon';
import { Txt } from './ui/Layout';
import { StatusDot, statusLabel } from './ui/Status';

/** Cap on simultaneous MJPEG sockets; each one costs the Pi real CPU. */
const MAX_CONCURRENT_STREAMS = 4;

export function CameraGrid({
  cameras,
  mediaToken,
  active,
  onExpand,
}: {
  cameras: CameraStatus[];
  mediaToken: string | null;
  active: boolean;
  onExpand: (cameraId: string) => void;
}) {
  const theme = useTheme();

  const streamable = useMemo(() => {
    const ids = new Set<string>();
    for (const camera of cameras) {
      if (ids.size >= MAX_CONCURRENT_STREAMS) break;
      if (camera.state === 'connected' || camera.state === 'reconnecting') {
        ids.add(camera.camera_id);
      }
    }
    return ids;
  }, [cameras]);

  return (
    <View style={[styles.grid, { gap: theme.space.md }]}>
      {cameras.map((camera) => {
        const streaming = active && streamable.has(camera.camera_id);
        return (
          <Pressable
            key={camera.camera_id}
            onPress={() => onExpand(camera.camera_id)}
            accessibilityRole="button"
            accessibilityLabel={`Expand ${camera.name}, ${statusLabel(camera.state)}`}
            style={({ pressed }) => [
              styles.tile,
              {
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.videoBackdrop,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {streaming ? (
              <MjpegStream
                cameraId={camera.camera_id}
                mediaToken={mediaToken}
                active
                fit="cover"
                hideOverlay
              />
            ) : (
              <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceSunken }]}>
                <Icon name="video" size={22} color={theme.colors.textFaint} />
                <Txt variant="overline" tone="faint" uppercase>
                  {camera.state === 'connected' ? 'Tap to view' : statusLabel(camera.state)}
                </Txt>
              </View>
            )}

            <LinearGradient
              colors={theme.colors.videoScrim as unknown as [string, string]}
              style={styles.scrim}
              pointerEvents="none"
            />

            <View style={styles.tileFooter} pointerEvents="none">
              <StatusDot state={camera.state} size={6} />
              <Txt variant="label" numberOfLines={1} style={styles.tileName}>
                {camera.name}
              </Txt>
              {camera.is_recording ? (
                <View style={[styles.recDot, { backgroundColor: theme.colors.live }]} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  tileFooter: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  tileName: { flex: 1, color: '#FFFFFF' },
  recDot: { width: 8, height: 8, borderRadius: 4 },
});
