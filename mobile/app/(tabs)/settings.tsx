import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { logout } from '@/api/auth';
import { MOTION_BOUNDS } from '@/api/types';
import { CameraSelectorSheet } from '@/components/CameraSelector';
import { Button, Chip } from '@/components/ui/Button';
import { Divider, SectionHeader, Card, Txt } from '@/components/ui/Layout';
import { Screen } from '@/components/ui/Screen';
import { InfoRow, NavRow, SwitchRow } from '@/components/ui/SettingRows';
import { SettingSlider } from '@/components/ui/SettingSlider';
import { Skeleton } from '@/components/ui/States';
import { useCameras } from '@/hooks/useCameras';
import { useMotionControls, useMotionStatus } from '@/hooks/useMotion';
import { useStorageStats } from '@/hooks/useRecordings';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore, type ThemePreference } from '@/store/themeStore';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFileSize, sensitivityLabel } from '@/utils/format';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const serverUrl = useAuthStore((s) => s.serverUrl);
  const username = useAuthStore((s) => s.username);
  const signOut = useAuthStore((s) => s.signOut);

  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const cameras = useCameras({ poll: false });
  const storage = useStorageStats();

  const [motionCameraId, setMotionCameraId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const cameraList = cameras.data ?? [];
  const activeMotionCamera =
    cameraList.find((c) => c.camera_id === motionCameraId) ?? cameraList[0] ?? null;
  const activeMotionId = activeMotionCamera?.camera_id ?? null;

  const motion = useMotionStatus(activeMotionId, true);
  const { toggle, updateSettings } = useMotionControls(activeMotionId);

  const motionEnabled = motion.data?.enabled ?? false;
  const sensitivity = motion.data?.sensitivity ?? 30;
  const cooldown = motion.data?.cooldown ?? 10;
  const buffer = motion.data?.buffer_seconds ?? 5;

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in with One Auth again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout().catch(() => {});
          await signOut();
          queryClient.clear();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const refreshAll = () => {
    cameras.refetch();
    storage.refetch();
    motion.refetch();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.space.lg,
          paddingBottom: theme.space['4xl'],
          gap: theme.space['2xl'],
        }}
        refreshControl={
          <RefreshControl
            refreshing={cameras.isRefetching || storage.isRefetching}
            onRefresh={refreshAll}
            tintColor={theme.colors.brand}
            colors={[theme.colors.brand]}
          />
        }
      >
        <Txt variant="title" style={{ paddingTop: theme.space.xs }}>
          Settings
        </Txt>

        <View>
          <SectionHeader
            title="Motion detection"
            action={
              cameraList.length > 1 ? (
                <Chip
                  label={activeMotionCamera?.name ?? 'Camera'}
                  icon="camera"
                  selected
                  onPress={() => setPickerOpen(true)}
                />
              ) : undefined
            }
          />

          <Card>
            {motion.isLoading ? (
              <View style={{ gap: theme.space.lg }}>
                <Skeleton height={26} />
                <Skeleton height={40} />
                <Skeleton height={40} />
              </View>
            ) : !activeMotionId ? (
              <Txt variant="small" tone="muted">
                No cameras available.
              </Txt>
            ) : (
              <View style={{ gap: theme.space.lg }}>
                <SwitchRow
                  icon="activity"
                  label="Motion recording"
                  description={
                    motionEnabled
                      ? 'Recording automatically when movement is detected'
                      : 'Automatic recording is off'
                  }
                  value={motionEnabled}
                  onValueChange={(next) => toggle.mutate(next)}
                  disabled={toggle.isPending}
                />

                <Divider />

                <SettingSlider
                  label="Sensitivity"
                  description="Lower values need larger movement before triggering."
                  value={sensitivity}
                  min={MOTION_BOUNDS.sensitivity.min}
                  max={MOTION_BOUNDS.sensitivity.max}
                  formatValue={(v) => `${sensitivityLabel(v)} (${Math.round(v)})`}
                  onCommit={(v) => updateSettings.mutate({ sensitivity: Math.round(v) })}
                  disabled={!motionEnabled}
                />

                <SettingSlider
                  label="Cooldown"
                  description="Minimum gap between two motion recordings."
                  value={cooldown}
                  min={MOTION_BOUNDS.cooldown.min}
                  max={MOTION_BOUNDS.cooldown.max}
                  formatValue={(v) => `${Math.round(v)} seconds`}
                  onCommit={(v) => updateSettings.mutate({ cooldown: Math.round(v) })}
                  disabled={!motionEnabled}
                />

                <SettingSlider
                  label="Pre-record buffer"
                  description="Footage kept from just before the trigger."
                  value={buffer}
                  min={MOTION_BOUNDS.buffer_seconds.min}
                  max={MOTION_BOUNDS.buffer_seconds.max}
                  formatValue={(v) => `${Math.round(v)} seconds`}
                  onCommit={(v) => updateSettings.mutate({ buffer_seconds: Math.round(v) })}
                  disabled={!motionEnabled}
                />
              </View>
            )}
          </Card>
        </View>

        <View>
          <SectionHeader title="Storage" />
          <Card>
            {storage.isLoading ? (
              <Skeleton height={44} />
            ) : (
              <>
                <InfoRow
                  icon="film"
                  label="Recordings"
                  value={String(storage.data?.recordings_count ?? 0)}
                />
                <Divider inset={44} />
                <InfoRow
                  icon="database"
                  label="Space used"
                  value={formatFileSize(storage.data?.total_size_bytes ?? 0)}
                />
                {(storage.data?.per_camera ?? []).map((entry) => (
                  <View key={entry.camera_id}>
                    <Divider inset={44} />
                    <InfoRow
                      icon="camera"
                      label={entry.camera_name}
                      value={`${entry.count} · ${formatFileSize(entry.size)}`}
                    />
                  </View>
                ))}
              </>
            )}
          </Card>
        </View>

        <View>
          <SectionHeader title="Appearance" />
          <Card>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={preference === option.value}
                  onPress={() => setPreference(option.value)}
                  icon={
                    option.value === 'dark' ? 'moon' : option.value === 'light' ? 'sun' : 'smartphone'
                  }
                />
              ))}
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title="Account" />
          <Card>
            <InfoRow icon="user" label="Signed in as" value={username ?? 'Unknown'} />
            <Divider inset={44} />
            <NavRow
              icon="server"
              label="Server"
              value={serverUrl?.replace(/^https?:\/\//, '') ?? 'Not set'}
              onPress={() => router.push('/(auth)/server')}
            />
          </Card>

          <Button
            label="Sign out"
            icon="logOut"
            variant="danger"
            fullWidth
            onPress={confirmSignOut}
            style={{ marginTop: theme.space.md }}
          />
        </View>

        <View>
          <SectionHeader title="About" />
          <Card>
            <InfoRow
              icon="shield"
              label="Version"
              value={`${Constants.expoConfig?.version ?? '1.0.0'}`}
            />
            <Divider inset={44} />
            <InfoRow
              icon="hardDrive"
              label="Cameras"
              value={String(cameraList.length)}
            />
          </Card>
        </View>
      </ScrollView>

      <CameraSelectorSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        cameras={cameraList}
        activeId={activeMotionId}
        onSelect={setMotionCameraId}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  themeRow: { flexDirection: 'row', gap: 8 },
});
