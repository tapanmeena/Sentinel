import type { AuthSessionResponseDto, MessageResponseDto } from '@tapanmeena/authkit-shared';

import {
  AUTHKIT_CLIENT_ID,
  AUTHKIT_ISSUER_URL,
  authClient,
  getBaseUrl,
  request,
} from './client';
import type { MediaTokenResponse, MeResponse } from './types';

export { AUTHKIT_CLIENT_ID, AUTHKIT_ISSUER_URL, authClient };

export function loginWithPassword(
  email: string,
  password: string,
): Promise<AuthSessionResponseDto> {
  return authClient.login({
    email: email.trim().toLowerCase(),
    password,
  });
}

export function sendLoginOtp(email: string): Promise<MessageResponseDto> {
  return authClient.sendOtp(email.trim().toLowerCase(), 'login_otp');
}

export function loginWithOtp(email: string, code: string): Promise<AuthSessionResponseDto> {
  return authClient.loginWithOtp({
    email: email.trim().toLowerCase(),
    code: code.trim(),
  });
}

export async function logout(): Promise<void> {
  if (getBaseUrl()) {
    await request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
      skipAuthHandler: true,
    }).catch(() => {});
  }
  await authClient.logout().catch(() => {});
}

export function me(options?: { baseUrlOverride?: string; skipAuthHandler?: boolean }) {
  return request<MeResponse>('/api/auth/me', {
    skipAuthHandler: options?.skipAuthHandler ?? false,
    baseUrlOverride: options?.baseUrlOverride,
  });
}

export function fetchMediaToken() {
  return request<MediaTokenResponse>('/api/auth/media-token', { method: 'POST' });
}

/**
 * Probe a candidate server. A 401 still proves we reached Sentinel, so it
 * counts as reachable.
 */
export async function probeServer(baseUrl: string): Promise<void> {
  try {
    await request<MeResponse>('/api/auth/me', {
      baseUrlOverride: baseUrl,
      skipAuth: true,
      skipAuthHandler: true,
      timeoutMs: 10_000,
    });
  } catch (error) {
    const kind = (error as { kind?: string }).kind;
    if (kind === 'unauthorized') return;
    throw error;
  }
}
