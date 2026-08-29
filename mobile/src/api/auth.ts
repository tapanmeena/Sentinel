import { request } from './client';
import type { LoginResponse, MediaTokenResponse, MeResponse } from './types';

export function login(username: string, password: string, baseUrlOverride?: string) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    skipAuthHandler: true,
    baseUrlOverride,
  });
}

export function logout() {
  return request<{ success: boolean }>('/api/auth/logout', {
    method: 'POST',
    skipAuthHandler: true,
  });
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
      skipAuthHandler: true,
      timeoutMs: 10_000,
    });
  } catch (error) {
    const kind = (error as { kind?: string }).kind;
    if (kind === 'unauthorized') return;
    throw error;
  }
}
