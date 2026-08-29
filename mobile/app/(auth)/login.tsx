import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { login } from '@/api/auth';
import { ApiError, describeError } from '@/api/errors';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Layout';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const serverUrl = useAuthStore((s) => s.serverUrl);
  const savedUsername = useAuthStore((s) => s.username);
  const signIn = useAuthStore((s) => s.signIn);

  const [username, setUsername] = useState(savedUsername ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const host = serverUrl ? serverUrl.replace(/^https?:\/\//, '') : 'No server';

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Enter your username and password');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await login(username.trim(), password);
      queryClient.clear();
      await signIn(result.token, result.username);
      setPassword('');
      router.replace('/(tabs)/live');
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'unauthorized') {
        setError('Invalid username or password');
      } else {
        setError(describeError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { padding: theme.space['2xl'] }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: theme.space['2xl'] }}>
            <BrandMark size={68} showWordmark />

            <View style={{ gap: theme.space.xs }}>
              <Txt variant="display" align="center">
                Sign in
              </Txt>
              <Pressable
                onPress={() => router.push('/(auth)/server')}
                accessibilityRole="button"
                accessibilityLabel={`Change server, currently ${host}`}
                style={styles.hostRow}
              >
                <Icon name="server" size={13} color={theme.colors.textFaint} />
                <Txt variant="small" tone="muted">
                  {host}
                </Txt>
                <Icon name="chevronRight" size={13} color={theme.colors.textFaint} />
              </Pressable>
            </View>

            <View style={{ gap: theme.space.lg }}>
              <TextField
                label="Username"
                value={username}
                onChangeText={(next) => {
                  setUsername(next);
                  if (error) setError(null);
                }}
                placeholder="admin"
                icon="user"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!submitting}
                textContentType="username"
              />

              <TextField
                label="Password"
                inputRef={passwordRef}
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                icon="lock"
                secure
                returnKeyType="go"
                onSubmitEditing={submit}
                error={error}
                editable={!submitting}
                textContentType="password"
              />
            </View>

            <Button
              label={submitting ? 'Signing in…' : 'Sign in'}
              onPress={submit}
              loading={submitting}
              fullWidth
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
});
