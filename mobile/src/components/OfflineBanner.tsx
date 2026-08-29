import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './ui/Icon';
import { Txt } from './ui/Layout';

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          bottom: insets.bottom + 74,
          backgroundColor: theme.colors.warningSoft,
          borderColor: theme.colors.warning,
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <Icon name="wifiOff" size={14} color={theme.colors.warning} />
      <Txt variant="label" style={{ color: theme.colors.warning }}>
        No network connection
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
    zIndex: 900,
  },
});
