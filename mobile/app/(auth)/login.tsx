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
import { AuthKitClientError } from '@tapanmeena/authkit-client';
import { AUTH_ERROR_CODES, OTP_CODE_LENGTH, type AuthSessionResponseDto } from '@tapanmeena/authkit-shared';

import {
  authClient,
  loginWithOtp,
  loginWithPassword,
  me,
  sendLoginOtp,
} from '@/api/auth';
import { ApiError, describeError } from '@/api/errors';
import { BrandMark } from '@/components/BrandMark';
import { Button, Chip } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Layout';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeProvider';

type AuthMode = 'password' | 'otp';

function formatAuthKitError(error: unknown): string {
  if (error instanceof AuthKitClientError) {
    switch (error.code) {
      case AUTH_ERROR_CODES.INVALID_CREDENTIALS:
        return 'Invalid email or password.';
      case AUTH_ERROR_CODES.PASSWORD_NOT_SET:
        return 'No password is set for this account. Switch to Email code to sign in.';
      case AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED:
        return 'Your email address is not verified yet. Sign in with an Email code to verify.';
      case AUTH_ERROR_CODES.OTP_INVALID_OR_EXPIRED:
        return 'Invalid or expired 6-digit code. Request a new code and try again.';
      case AUTH_ERROR_CODES.OTP_COOLDOWN_ACTIVE:
        return 'Please wait a moment before requesting another verification code.';
      case AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED:
        return 'Too many incorrect attempts. Please request a new 6-digit code.';
      case AUTH_ERROR_CODES.RATE_LIMITED:
        return 'Too many attempts. Please wait a minute and try again.';
      default:
        return error.message || 'Could not complete sign-in with One Auth.';
    }
  }
  if (error instanceof ApiError && error.kind === 'unauthorized') {
    return 'This One Auth account is not authorized to access this Sentinel server.';
  }
  return describeError(error);
}

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const serverUrl = useAuthStore((s) => s.serverUrl);
  const savedEmail = useAuthStore((s) => s.username);
  const signIn = useAuthStore((s) => s.signIn);

  const [mode, setMode] = useState<AuthMode>('password');
  const [email, setEmail] = useState(savedEmail?.includes('@') ? savedEmail : '');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);

  const host = serverUrl ? serverUrl.replace(/^https?:\/\//, '') : 'No server';

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode || submitting) return;
    setMode(nextMode);
    setError(null);
    setStatusNotice(null);
  };

  const completeSignIn = async (result: AuthSessionResponseDto) => {
    if (result.verificationRequired || !result.user.emailVerified) {
      await authClient.logout().catch(() => {});
      setMode('otp');
      setOtpSent(false);
      setOtpCode('');
      setError('Verify your email with a 6-digit code to finish signing in.');
      return;
    }

    if (serverUrl) {
      try {
        await me({ skipAuthHandler: true });
      } catch (err) {
        if (err instanceof ApiError && err.kind === 'unauthorized') {
          await authClient.logout().catch(() => {});
          throw err;
        }
        // Allow sign-in to complete if Sentinel is temporarily unreachable;
        // normal retry/offline handling will take over on the dashboard.
      }
    }

    queryClient.clear();
    await signIn(result.tokens.accessToken, result.user.email);
    setPassword('');
    setOtpCode('');
    router.replace('/(tabs)/live');
  };

  const submitPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatusNotice(null);
    try {
      const result = await loginWithPassword(normalizedEmail, password);
      await completeSignIn(result);
    } catch (err) {
      setError(formatAuthKitError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const requestOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter a valid email address');
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatusNotice(null);
    try {
      await sendLoginOtp(normalizedEmail);
      setOtpSent(true);
      setOtpCode('');
      setStatusNotice(`Enter the 6-digit code sent to ${normalizedEmail}`);
      setTimeout(() => otpRef.current?.focus(), 80);
    } catch (err) {
      setError(formatAuthKitError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = otpCode.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError(`Enter the ${OTP_CODE_LENGTH}-digit code from your email`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await loginWithOtp(normalizedEmail, trimmedCode);
      await completeSignIn(result);
    } catch (err) {
      setError(formatAuthKitError(err));
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
                Sign in with One Auth
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

            <View style={styles.modeRow}>
              <Chip
                label="Password"
                icon="lock"
                selected={mode === 'password'}
                onPress={() => switchMode('password')}
              />
              <Chip
                label="Email code"
                icon="key"
                selected={mode === 'otp'}
                onPress={() => switchMode('otp')}
              />
            </View>

            {mode === 'password' ? (
              <>
                <View style={{ gap: theme.space.lg }}>
                  <TextField
                    label="Email"
                    value={email}
                    onChangeText={(next) => {
                      setEmail(next);
                      if (error) setError(null);
                    }}
                    placeholder="you@example.com"
                    icon="mail"
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    editable={!submitting}
                    textContentType="emailAddress"
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
                    onSubmitEditing={submitPassword}
                    error={error}
                    editable={!submitting}
                    textContentType="password"
                  />
                </View>

                <Button
                  label={submitting ? 'Signing in…' : 'Sign in'}
                  onPress={submitPassword}
                  loading={submitting}
                  fullWidth
                  size="lg"
                />
              </>
            ) : (
              <>
                <View style={{ gap: theme.space.lg }}>
                  <TextField
                    label="Email"
                    value={email}
                    onChangeText={(next) => {
                      setEmail(next);
                      if (otpSent) {
                        setOtpSent(false);
                        setOtpCode('');
                        setStatusNotice(null);
                      }
                      if (error) setError(null);
                    }}
                    placeholder="you@example.com"
                    icon="mail"
                    keyboardType="email-address"
                    returnKeyType={otpSent ? 'next' : 'go'}
                    onSubmitEditing={() => {
                      if (otpSent) otpRef.current?.focus();
                      else void requestOtp();
                    }}
                    error={otpSent ? undefined : error}
                    hint={otpSent ? undefined : 'We will email a 6-digit One Auth sign-in code.'}
                    editable={!submitting}
                    textContentType="emailAddress"
                  />

                  {otpSent ? (
                    <TextField
                      label="6-digit code"
                      inputRef={otpRef}
                      value={otpCode}
                      onChangeText={(next) => {
                        const digits = next.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH);
                        setOtpCode(digits);
                        if (error) setError(null);
                      }}
                      placeholder="123456"
                      icon="key"
                      keyboardType="number-pad"
                      returnKeyType="go"
                      onSubmitEditing={verifyOtp}
                      maxLength={OTP_CODE_LENGTH}
                      error={error}
                      hint={statusNotice ?? undefined}
                      editable={!submitting}
                      textContentType="oneTimeCode"
                    />
                  ) : null}
                </View>

                {otpSent ? (
                  <View style={{ gap: theme.space.sm }}>
                    <Button
                      label={submitting ? 'Verifying…' : 'Verify & sign in'}
                      onPress={verifyOtp}
                      loading={submitting}
                      fullWidth
                      size="lg"
                    />
                    <Button
                      label="Resend code"
                      variant="ghost"
                      onPress={requestOtp}
                      disabled={submitting}
                      fullWidth
                    />
                  </View>
                ) : (
                  <Button
                    label={submitting ? 'Sending code…' : 'Send 6-digit code'}
                    onPress={requestOtp}
                    loading={submitting}
                    fullWidth
                    size="lg"
                  />
                )}
              </>
            )}
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
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
});
