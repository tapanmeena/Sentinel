import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';

import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Layout';

export interface SettingSliderProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Rendered next to the label, e.g. "Medium (30)" or "10 seconds". */
  formatValue: (value: number) => string;
  onCommit: (value: number) => void;
  disabled?: boolean;
  /** Debounce before committing, so dragging does not spam the server. */
  commitDelayMs?: number;
}

export function SettingSlider({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  formatValue,
  onCommit,
  disabled = false,
  commitDelayMs = 400,
}: SettingSliderProps) {
  const theme = useTheme();
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accept server updates only while the user is not dragging.
  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const schedule = (next: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next), commitDelayMs);
  };

  return (
    <View style={{ gap: theme.space.sm, opacity: disabled ? 0.5 : 1 }}>
      <View style={styles.header}>
        <Txt variant="bodyStrong">{label}</Txt>
        <Txt variant="label" tone="brand">
          {formatValue(local)}
        </Txt>
      </View>

      {description ? (
        <Txt variant="small" tone="muted">
          {description}
        </Txt>
      ) : null}

      <Slider
        value={local}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => {
          dragging.current = true;
          setLocal(next);
        }}
        onSlidingComplete={(next) => {
          dragging.current = false;
          setLocal(next);
          schedule(next);
        }}
        minimumTrackTintColor={theme.colors.brand}
        maximumTrackTintColor={theme.colors.surfaceHigh}
        thumbTintColor={theme.colors.brand}
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: local, text: formatValue(local) }}
        style={styles.slider}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slider: { width: '100%', height: 36 },
});
