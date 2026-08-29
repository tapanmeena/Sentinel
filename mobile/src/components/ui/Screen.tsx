import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Layout';

export function Screen({
  children,
  style,
  edges = ['top'],
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.colors.bg,
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AppBar({
  title,
  subtitle,
  leading,
  actions,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.appBar,
        {
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.md,
          paddingTop: theme.space.sm,
        },
      ]}
    >
      {leading}
      <View style={styles.appBarTitles}>
        <Txt variant="title" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" tone="muted" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {actions ? <View style={styles.appBarActions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appBarTitles: { flex: 1, gap: 1 },
  appBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
