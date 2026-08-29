import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';
import { Icon, type IconName } from './ui/Icon';
import { Txt } from './ui/Layout';

function ActionTile({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
  tone = 'default',
  busy = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'live';
  busy?: boolean;
}) {
  const theme = useTheme();
  const accent = tone === 'live' ? theme.colors.live : theme.colors.brand;
  const fg = active ? accent : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: disabled || busy }}
      style={({ pressed }) => [
        styles.tile,
        {
          borderRadius: theme.radius.md,
          backgroundColor: active ? `${accent}1F` : theme.colors.surface,
          borderColor: active ? `${accent}55` : theme.colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Icon name={icon} size={19} color={fg} />
      )}
      <Txt variant="overline" uppercase style={{ color: fg }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export interface LiveControlsProps {
  isRecording: boolean;
  recordBusy: boolean;
  onToggleRecord: () => void;
  onSnapshot: () => void;
  snapshotBusy: boolean;
  motionEnabled: boolean;
  motionBusy: boolean;
  onToggleMotion: () => void;
  onShowInfo: () => void;
  disabled?: boolean;
}

export function LiveControls({
  isRecording,
  recordBusy,
  onToggleRecord,
  onSnapshot,
  snapshotBusy,
  motionEnabled,
  motionBusy,
  onToggleMotion,
  onShowInfo,
  disabled = false,
}: LiveControlsProps) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { gap: theme.space.md }]}>
      <Pressable
        onPress={onToggleRecord}
        disabled={disabled || recordBusy}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        accessibilityState={{ disabled: disabled || recordBusy, busy: recordBusy }}
        style={({ pressed }) => [
          styles.record,
          {
            borderRadius: theme.radius.lg,
            backgroundColor: isRecording ? theme.colors.live : theme.colors.liveSoft,
            borderColor: isRecording ? theme.colors.live : `${theme.colors.live}55`,
            opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
          },
        ]}
      >
        {recordBusy ? (
          <ActivityIndicator color={isRecording ? '#FFFFFF' : theme.colors.live} />
        ) : (
          <>
            <View
              style={[
                isRecording ? styles.recordSquare : styles.recordDot,
                { backgroundColor: isRecording ? '#FFFFFF' : theme.colors.live },
              ]}
            />
            <Txt
              variant="bodyStrong"
              style={{ color: isRecording ? '#FFFFFF' : theme.colors.live }}
            >
              {isRecording ? 'Stop' : 'Record'}
            </Txt>
          </>
        )}
      </Pressable>

      <View style={[styles.tiles, { gap: theme.space.sm }]}>
        <ActionTile
          icon="camera"
          label="Snap"
          onPress={onSnapshot}
          disabled={disabled}
          busy={snapshotBusy}
        />
        <ActionTile
          icon="activity"
          label="Motion"
          onPress={onToggleMotion}
          active={motionEnabled}
          disabled={disabled}
          busy={motionBusy}
        />
        <ActionTile icon="info" label="Info" onPress={onShowInfo} disabled={disabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'stretch' },
  record: {
    flex: 1.1,
    minHeight: MIN_TOUCH + 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  recordDot: { width: 13, height: 13, borderRadius: 7 },
  recordSquare: { width: 12, height: 12, borderRadius: 3 },
  tiles: { flex: 2, flexDirection: 'row' },
  tile: {
    flex: 1,
    minHeight: MIN_TOUCH + 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
