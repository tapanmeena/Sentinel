import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'label'
  | 'overline'
  | 'mono';

type Tone = 'default' | 'muted' | 'faint' | 'brand' | 'live' | 'success' | 'warning' | 'danger';

export interface TypographyProps {
  variant?: TextVariant;
  tone?: Tone;
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  uppercase?: boolean;
  align?: 'left' | 'center' | 'right';
  accessibilityLabel?: string;
}

export function Txt({
  variant = 'body',
  tone = 'default',
  children,
  style,
  numberOfLines,
  uppercase,
  align,
  accessibilityLabel,
}: TypographyProps) {
  const theme = useTheme();
  const toneColor: Record<Tone, string> = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    brand: theme.colors.brand,
    live: theme.colors.live,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  };

  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel}
      style={[
        theme.typography[variant] as TextStyle,
        { color: toneColor[tone] },
        uppercase && styles.uppercase,
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Raised cards sit on `surfaceHigh` for nesting inside another card. */
  raised?: boolean;
}

export function Card({ children, style, padded = true, raised = false }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: raised ? theme.colors.surfaceHigh : theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.space.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.sectionHeader, { marginBottom: theme.space.md }]}>
      <Txt variant="overline" tone="faint" uppercase>
        {title}
      </Txt>
      {action}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth * 2,
        backgroundColor: theme.colors.border,
        marginLeft: inset,
      }}
    />
  );
}

const styles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
