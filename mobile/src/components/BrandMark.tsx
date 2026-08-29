import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './ui/Icon';
import { Txt } from './ui/Layout';

/** Gradient shield tile used on the auth screens and the settings header. */
export function BrandMark({ size = 64, showWordmark = false }: { size?: number; showWordmark?: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[theme.colors.brand, theme.isDark ? '#3D7BFF' : '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.tile,
          { width: size, height: size, borderRadius: size * 0.32 },
          theme.elevation.medium,
          { shadowColor: theme.colors.brand },
        ]}
      >
        <Icon name="shield" size={size * 0.5} color="#FFFFFF" strokeWidth={1.9} />
      </LinearGradient>

      {showWordmark ? (
        <View style={styles.wordmark}>
          <Txt variant="title" style={styles.wordmarkText}>
            SENTINEL
          </Txt>
          <Txt variant="overline" tone="faint" uppercase>
            Security Dashboard
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  wordmark: { alignItems: 'center', gap: 3 },
  wordmarkText: { letterSpacing: 3 },
});
