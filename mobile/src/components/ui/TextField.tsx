import { useState, type RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Layout';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  icon?: IconName;
  secure?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  error?: string | null;
  hint?: string;
  editable?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  textContentType?: TextInputProps['textContentType'];
  inputRef?: RefObject<TextInput | null>;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secure = false,
  autoCapitalize = 'none',
  autoCorrect = false,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  error,
  hint,
  editable = true,
  autoFocus = false,
  maxLength,
  textContentType,
  inputRef,
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.brandBorder
      : theme.colors.border;

  return (
    <View style={{ gap: theme.space.sm }}>
      <Txt variant="label" tone="muted">
        {label}
      </Txt>

      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surfaceSunken,
            borderColor,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space.md,
          },
        ]}
      >
        {icon ? (
          <Icon name={icon} size={17} color={focused ? theme.colors.brand : theme.colors.textFaint} />
        ) : null}

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          secureTextEntry={secure && !revealed}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={editable}
          autoFocus={autoFocus}
          maxLength={maxLength}
          textContentType={textContentType}
          accessibilityLabel={label}
          style={[styles.input, { color: theme.colors.text }]}
        />

        {secure ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={12}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={17} color={theme.colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small" tone="faint">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: MIN_TOUCH + 6,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 12,
  },
});
