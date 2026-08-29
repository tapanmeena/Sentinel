import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { HIT_SLOP, MIN_TOUCH } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Layout';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'live';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const height = size === 'sm' ? 38 : size === 'lg' ? 54 : MIN_TOUCH + 4;
  const paddingHorizontal = size === 'sm' ? theme.space.md : theme.space.xl;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: theme.colors.brand, fg: theme.colors.textOnBrand, border: 'transparent' },
    secondary: { bg: theme.colors.surfaceHigh, fg: theme.colors.text, border: theme.colors.border },
    ghost: { bg: 'transparent', fg: theme.colors.textMuted, border: 'transparent' },
    danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger, border: theme.colors.dangerSoft },
    live: { bg: theme.colors.live, fg: '#FFFFFF', border: 'transparent' },
  };
  const tone = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          paddingHorizontal,
          borderRadius: theme.radius.md,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.82 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} color={tone.fg} /> : null}
          <Txt variant={size === 'sm' ? 'label' : 'bodyStrong'} style={{ color: tone.fg }}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: 'default' | 'brand' | 'live' | 'danger';
  variant?: 'plain' | 'filled' | 'outline';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 42,
  tone = 'default',
  variant = 'filled',
  disabled = false,
  style,
}: IconButtonProps) {
  const theme = useTheme();

  const fg =
    tone === 'brand'
      ? theme.colors.brand
      : tone === 'live'
        ? theme.colors.live
        : tone === 'danger'
          ? theme.colors.danger
          : theme.colors.textMuted;

  const bg =
    variant === 'plain'
      ? 'transparent'
      : tone === 'brand'
        ? theme.colors.brandSoft
        : tone === 'live'
          ? theme.colors.liveSoft
          : tone === 'danger'
            ? theme.colors.dangerSoft
            : theme.colors.surfaceHigh;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: theme.radius.md,
          backgroundColor: bg,
          borderWidth: variant === 'outline' ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.46)} color={fg} />
    </Pressable>
  );
}

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}

export function Chip({ label, selected = false, onPress, icon }: ChipProps) {
  const theme = useTheme();
  const fg = selected ? theme.colors.brand : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.space.lg,
          backgroundColor: selected ? theme.colors.brandSoft : theme.colors.surface,
          borderColor: selected ? theme.colors.brandBorder : theme.colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Txt variant="label" style={{ color: fg }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export type BadgeTone = 'neutral' | 'brand' | 'live' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({
  label,
  tone = 'neutral',
  dot = false,
  children,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const map: Record<BadgeTone, { fg: string; bg: string }> = {
    neutral: { fg: theme.colors.textMuted, bg: theme.colors.surfaceHigh },
    brand: { fg: theme.colors.brand, bg: theme.colors.brandSoft },
    live: { fg: theme.colors.live, bg: theme.colors.liveSoft },
    success: { fg: theme.colors.success, bg: theme.colors.successSoft },
    warning: { fg: theme.colors.warning, bg: theme.colors.warningSoft },
    danger: { fg: theme.colors.danger, bg: theme.colors.dangerSoft },
    info: { fg: theme.colors.info, bg: theme.colors.infoSoft },
  };
  const tint = map[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tint.bg,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.space.sm + 2,
        },
      ]}
    >
      {dot ? <View style={[styles.badgeDot, { backgroundColor: tint.fg }]} /> : null}
      {children}
      <Txt variant="overline" uppercase style={{ color: tint.fg }}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 22,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
