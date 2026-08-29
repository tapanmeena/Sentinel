import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Layout';

interface BaseRowProps {
  icon?: IconName;
  label: string;
  description?: string;
  tone?: 'default' | 'danger';
}

export function SwitchRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: BaseRowProps & {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { paddingVertical: theme.space.md }]}>
      <RowLead icon={icon} label={label} description={description} />
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: theme.colors.surfaceHigh, true: theme.colors.brand }}
        thumbColor={theme.colors.text}
      />
    </View>
  );
}

export function NavRow({
  icon,
  label,
  description,
  value,
  onPress,
  tone = 'default',
}: BaseRowProps & { value?: string; onPress: () => void }) {
  const theme = useTheme();
  const danger = tone === 'danger';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        { paddingVertical: theme.space.md, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <RowLead icon={icon} label={label} description={description} tone={tone} />
      <View style={styles.rowTrailing}>
        {value ? (
          <Txt variant="small" tone="muted" numberOfLines={1} style={styles.rowValue}>
            {value}
          </Txt>
        ) : null}
        <Icon
          name="chevronRight"
          size={17}
          color={danger ? theme.colors.danger : theme.colors.textFaint}
        />
      </View>
    </Pressable>
  );
}

export function InfoRow({ icon, label, value }: BaseRowProps & { value: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { paddingVertical: theme.space.md }]}>
      <RowLead icon={icon} label={label} />
      {typeof value === 'string' ? (
        <Txt variant="small" tone="muted" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Txt>
      ) : (
        value
      )}
    </View>
  );
}

function RowLead({ icon, label, description, tone = 'default' }: BaseRowProps) {
  const theme = useTheme();
  const danger = tone === 'danger';

  return (
    <View style={styles.rowLead}>
      {icon ? (
        <View
          style={[
            styles.rowIcon,
            {
              backgroundColor: danger ? theme.colors.dangerSoft : theme.colors.surfaceHigh,
              borderRadius: theme.radius.sm,
            },
          ]}
        >
          <Icon
            name={icon}
            size={16}
            color={danger ? theme.colors.danger : theme.colors.textMuted}
          />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Txt variant="body" tone={danger ? 'danger' : 'default'}>
          {label}
        </Txt>
        {description ? (
          <Txt variant="small" tone="faint">
            {description}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: MIN_TOUCH,
  },
  rowLead: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '52%' },
  rowValue: { flexShrink: 1 },
});
