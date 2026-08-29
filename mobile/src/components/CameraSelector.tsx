import { Pressable, StyleSheet, View } from 'react-native';

import type { CameraStatus } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './ui/Icon';
import { Txt } from './ui/Layout';
import { Sheet } from './ui/Sheet';
import { StatusDot, statusLabel } from './ui/Status';

export function CameraSelectorButton({
  camera,
  cameraCount,
  onPress,
}: {
  camera: CameraStatus | null;
  cameraCount: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const disabled = cameraCount <= 1;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Camera: ${camera?.name ?? 'None'}. Tap to switch.`}
      style={({ pressed }) => [
        styles.trigger,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.pill,
          paddingLeft: theme.space.md,
          paddingRight: disabled ? theme.space.md : theme.space.sm,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {camera ? <StatusDot state={camera.state} size={7} /> : null}
      <Txt variant="bodyStrong" numberOfLines={1} style={styles.triggerLabel}>
        {camera?.name ?? 'No cameras'}
      </Txt>
      {disabled ? null : (
        <Icon name="chevronDown" size={16} color={theme.colors.textFaint} />
      )}
    </Pressable>
  );
}

export function CameraSelectorSheet({
  visible,
  onClose,
  cameras,
  activeId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  cameras: CameraStatus[];
  activeId: string | null;
  onSelect: (cameraId: string) => void;
}) {
  const theme = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title="Switch camera" scrollable>
      <View style={{ gap: theme.space.sm }}>
        {cameras.map((camera) => {
          const selected = camera.camera_id === activeId;
          return (
            <Pressable
              key={camera.camera_id}
              onPress={() => {
                onSelect(camera.camera_id);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${camera.name}, ${statusLabel(camera.state)}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: selected ? theme.colors.brandSoft : theme.colors.surface,
                  borderColor: selected ? theme.colors.brandBorder : theme.colors.border,
                  borderRadius: theme.radius.md,
                  padding: theme.space.md,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.rowIcon,
                  {
                    backgroundColor: selected ? theme.colors.brandSoft : theme.colors.surfaceHigh,
                    borderRadius: theme.radius.sm,
                  },
                ]}
              >
                <Icon
                  name="camera"
                  size={17}
                  color={selected ? theme.colors.brand : theme.colors.textMuted}
                />
              </View>

              <View style={styles.rowText}>
                <Txt variant="bodyStrong" numberOfLines={1}>
                  {camera.name}
                </Txt>
                <View style={styles.rowMeta}>
                  <StatusDot state={camera.state} size={6} />
                  <Txt variant="small" tone="muted">
                    {statusLabel(camera.state)} · {camera.camera_id}
                  </Txt>
                </View>
              </View>

              {selected ? <Icon name="check" size={18} color={theme.colors.brand} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
    maxWidth: 220,
  },
  triggerLabel: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
