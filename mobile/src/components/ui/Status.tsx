import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { CameraConnectionState } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Layout';

export function statusLabel(state: CameraConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Online';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'disabled':
      return 'Disabled';
    default:
      return 'Offline';
  }
}

export function useStatusColor(state: CameraConnectionState): string {
  const theme = useTheme();
  switch (state) {
    case 'connected':
      return theme.colors.success;
    case 'connecting':
    case 'reconnecting':
      return theme.colors.warning;
    case 'disabled':
      return theme.colors.textFaint;
    default:
      return theme.colors.danger;
  }
}

/** Pulsing dot; animates only for transitional states to save power. */
export function StatusDot({ state, size = 8 }: { state: CameraConnectionState; size?: number }) {
  const color = useStatusColor(state);
  const [pulse] = useState(() => new Animated.Value(1));
  const animated = state === 'connecting' || state === 'reconnecting';

  useEffect(() => {
    if (!animated) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.25,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: pulse,
      }}
    />
  );
}

export function StatusPill({ state }: { state: CameraConnectionState }) {
  const theme = useTheme();
  const color = useStatusColor(state);

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: `${color}1F`,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.space.sm + 2,
        },
      ]}
    >
      <StatusDot state={state} size={6} />
      <Txt variant="overline" uppercase style={{ color }}>
        {statusLabel(state)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 22,
  },
});
