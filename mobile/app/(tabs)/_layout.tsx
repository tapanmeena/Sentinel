import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, type ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useRecordings } from '@/hooks/useRecordings';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';

function tabIcon(name: IconName) {
  const Rendered = ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon
      name={name}
      size={focused ? 23 : 22}
      color={String(color)}
      strokeWidth={focused ? 2.3 : 1.9}
    />
  );
  Rendered.displayName = `TabIcon(${name})`;
  return Rendered;
}

export default function TabsLayout() {
  const theme = useTheme();
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const token = useAuthStore((s) => s.token);
  const recordings = useRecordings();

  if (!serverUrl) return <Redirect href="/(auth)/server" />;
  if (!token) return <Redirect href="/(auth)/login" />;

  const recordingsCount = recordings.data?.length ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.textFaint,
        sceneStyle: { backgroundColor: theme.colors.bg },
        tabBarStyle: {
          backgroundColor: theme.colors.bgElevated,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth * 2,
          height: Platform.OS === 'android' ? 64 : undefined,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: theme.colors.brand,
          color: theme.colors.textOnBrand,
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="live"
        options={{ title: 'Live', tabBarIcon: tabIcon('video') }}
      />
      <Tabs.Screen
        name="recordings"
        options={{
          title: 'Clips',
          tabBarIcon: tabIcon('film'),
          tabBarBadge: recordingsCount > 0 ? recordingsCount : undefined,
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{ title: 'Devices', tabBarIcon: tabIcon('hardDrive') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('sliders') }}
      />
    </Tabs>
  );
}
