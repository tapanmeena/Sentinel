import { StyleSheet, View } from 'react-native';

import type { CameraStatus } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './ui/Icon';
import { Txt } from './ui/Layout';

/** Covers the video area while a camera is not delivering frames. */
export function ConnectionOverlay({ camera }: { camera: CameraStatus }) {
  const theme = useTheme();

  if (camera.state === 'connected') return null;

  // `next_retry_in` refreshes with the 3s camera poll, so it is rendered as-is
  // rather than ticked down locally.
  const countdown = camera.next_retry_in;
  const isRetrying = camera.state === 'reconnecting' || camera.state === 'connecting';
  const tint =
    camera.state === 'disabled'
      ? theme.colors.textFaint
      : isRetrying
        ? theme.colors.warning
        : theme.colors.danger;

  const heading =
    camera.state === 'disabled'
      ? 'Camera disabled'
      : camera.state === 'reconnecting'
        ? 'Reconnecting'
        : camera.state === 'connecting'
          ? 'Connecting'
          : 'Camera offline';

  const detail =
    camera.state === 'reconnecting' && countdown != null
      ? `Retry ${camera.retry_count ? `#${camera.retry_count} ` : ''}in ${Math.ceil(countdown)}s`
      : camera.last_error
        ? camera.last_error
        : camera.state === 'disabled'
          ? 'Enable this camera in config.py'
          : 'Waiting for the camera to come back';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.scrim }]}>
      <View style={[styles.badge, { backgroundColor: `${tint}22`, borderRadius: theme.radius.xl }]}>
        <Icon
          name={camera.state === 'disabled' ? 'video' : 'wifiOff'}
          size={22}
          color={tint}
        />
      </View>
      <Txt variant="heading" align="center" style={{ color: tint }}>
        {heading}
      </Txt>
      <Txt variant="small" tone="muted" align="center" numberOfLines={3}>
        {detail}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  badge: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
