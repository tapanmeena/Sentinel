import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Txt } from './Layout';

export function Skeleton({
  height = 16,
  width,
  radius,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width: width ?? '100%',
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
        style,
      ]}
    />
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.centered, { padding: theme.space['3xl'], gap: theme.space.md }]}>
      <View
        style={[
          styles.iconWell,
          { backgroundColor: theme.colors.surfaceHigh, borderRadius: theme.radius.xl },
        ]}
      >
        <Icon name={icon} size={28} color={theme.colors.textFaint} />
      </View>
      <Txt variant="heading" align="center">
        {title}
      </Txt>
      {message ? (
        <Txt variant="small" tone="muted" align="center">
          {message}
        </Txt>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.centered, { padding: theme.space['3xl'], gap: theme.space.md }]}>
      <View
        style={[
          styles.iconWell,
          { backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.xl },
        ]}
      >
        <Icon name="alertTriangle" size={26} color={theme.colors.danger} />
      </View>
      <Txt variant="heading" align="center">
        {title}
      </Txt>
      <Txt variant="small" tone="muted" align="center">
        {message}
      </Txt>
      {onRetry ? (
        <Button label="Try again" icon="refresh" onPress={onRetry} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWell: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
