import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { probeServer } from '@/api/auth';
import { normalizeBaseUrl } from '@/api/client';
import { ApiError } from '@/api/errors';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/Button';
import { Txt } from '@/components/ui/Layout';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';

function reachabilityMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'tls':
        return 'The secure connection failed. Check the certificate on your server.';
      case 'timeout':
        return 'The server did not respond in time. Is it running and reachable?';
      case 'network':
        return 'Could not reach that address. Check the hostname and your connection.';
      case 'badResponse':
        return 'That address responded, but it does not look like a Sentinel server.';
      case 'notFound':
        return 'Reached the host, but the Sentinel API is missing. Update the server first.';
      default:
        return error.message;
    }
  }
  return 'Could not connect to that address.';
}

export default function ServerSetupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const suggested = useAuthStore((s) => s.suggestedServerUrl);
  const currentServer = useAuthStore((s) => s.serverUrl);
  const setServerUrl = useAuthStore((s) => s.setServerUrl);

  const [value, setValue] = useState(currentServer ?? suggested);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    const normalized = normalizeBaseUrl(value);
    if (!normalized) {
      setError('Enter a valid address, for example https://sentinel.example.com');
      return;
    }

    setChecking(true);
    setError(null);
    try {
      await probeServer(normalized);
      await setServerUrl(normalized);
      router.replace('/(auth)/login');
    } catch (err) {
      setError(reachabilityMessage(err));
    } finally {
      setChecking(false);
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

            <View style={{ gap: theme.space.sm }}>
              <Txt variant="display" align="center">
                Connect to your server
              </Txt>
              <Txt variant="small" tone="muted" align="center">
                Enter the address where your Sentinel dashboard is hosted. You can change this
                later in Settings.
              </Txt>
            </View>

            <TextField
              label="Server address"
              value={value}
              onChangeText={(next) => {
                setValue(next);
                if (error) setError(null);
              }}
              placeholder="https://sentinel.example.com"
              icon="server"
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error}
              hint="HTTPS is recommended. Plain http:// works on a trusted local network."
              editable={!checking}
              autoFocus={!value}
            />

            <Button
              label={checking ? 'Checking…' : 'Continue'}
              onPress={submit}
              loading={checking}
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
});
