import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  AuthKitClient,
  AuthKitClientError,
  KeyValueTokenStorage,
  type KeyValueStorageLike,
  type StoredAuthTokens,
  type TokenStorage,
} from '@tapanmeena/authkit-client';

import { ApiError, classifyNetworkError } from './errors';

const DEFAULT_TIMEOUT_MS = 15_000;
const AUTHKIT_TOKENS_STORAGE_KEY = 'sentinel.authkit.tokens';

function resolveAuthKitIssuerUrl(): string {
  const extra = Constants.expoConfig?.extra as { authkitUrl?: string } | undefined;
  const raw =
    process.env.EXPO_PUBLIC_AUTHKIT_URL?.trim() ||
    extra?.authkitUrl?.trim() ||
    'https://auth.tapanmeena.com';
  return raw.replace(/\/+$/, '');
}

export const AUTHKIT_ISSUER_URL = resolveAuthKitIssuerUrl();
export const AUTHKIT_CLIENT_ID = 'sentinel-mobile';

interface ApiConfig {
  baseUrl: string | null;
  token: string | null;
}

// Module-level config rather than a store import, so the auth store can depend
// on the client without a cycle.
const config: ApiConfig = { baseUrl: null, token: null };
let onUnauthorized: (() => void) | null = null;
let onTokenChange: ((accessToken: string | null) => void) | null = null;

const secureStoreAdapter: KeyValueStorageLike = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore missing-key errors during cleanup.
    }
  },
};

const baseTokenStorage = new KeyValueTokenStorage(secureStoreAdapter, AUTHKIT_TOKENS_STORAGE_KEY);

export const tokenStorage: TokenStorage = {
  getTokens: () => baseTokenStorage.getTokens(),
  setTokens: async (tokens: StoredAuthTokens) => {
    await baseTokenStorage.setTokens(tokens);
    config.token = tokens.accessToken;
    onTokenChange?.(tokens.accessToken);
  },
  clearTokens: async () => {
    await baseTokenStorage.clearTokens();
    config.token = null;
    onTokenChange?.(null);
  },
};

export const authClient = new AuthKitClient({
  baseUrl: AUTHKIT_ISSUER_URL,
  clientId: AUTHKIT_CLIENT_ID,
  storage: tokenStorage,
  deviceName: `Sentinel Mobile (${Platform.OS})`,
});

export function setTokenChangeListener(listener: ((accessToken: string | null) => void) | null) {
  onTokenChange = listener;
}

export function configureApi(next: Partial<ApiConfig>) {
  if ('baseUrl' in next) config.baseUrl = next.baseUrl ?? null;
  if ('token' in next) config.token = next.token ?? null;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function getBaseUrl(): string | null {
  return config.baseUrl;
}

/** Trim whitespace/trailing slashes and require an http(s) scheme. */
export function normalizeBaseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return null;
  }
}

export function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const base = config.baseUrl;
  if (!base) throw new ApiError('network', 'No server address configured');

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return `${base}${path.startsWith('/') ? path : `/${path}`}${query ? `?${query}` : ''}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Do not attach an Authorization header (used for server reachability probes). */
  skipAuth?: boolean;
  /** Skip the global 401 handler, used by login and reachability probes. */
  skipAuthHandler?: boolean;
  /** Explicit base URL, used before the server address is committed to state. */
  baseUrlOverride?: string;
}

async function resolveBearerToken(skipAuth: boolean, skipAuthHandler: boolean): Promise<string | null> {
  if (skipAuth) return null;

  try {
    const freshToken = await authClient.getValidAccessToken();
    return freshToken ?? config.token;
  } catch (error) {
    if (error instanceof AuthKitClientError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        if (!skipAuthHandler) onUnauthorized?.();
        throw new ApiError('unauthorized', error.message, 401);
      }
      throw new ApiError('server', error.message, error.statusCode);
    }
    throw classifyNetworkError(error);
  }
}

async function performFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    return await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw classifyNetworkError(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    params,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    skipAuth = false,
    skipAuthHandler = false,
    baseUrlOverride,
  } = options;

  const base = baseUrlOverride ?? config.baseUrl;
  if (!base) throw new ApiError('network', 'No server address configured');

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null && value !== '') search.set(key, value);
  }
  const query = search.toString();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}${query ? `?${query}` : ''}`;

  const accessToken = await resolveBearerToken(skipAuth, skipAuthHandler);

  const buildHeaders = (token: string | null): Record<string, string> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return headers;
  };

  let response = await performFetch(
    url,
    method,
    buildHeaders(accessToken),
    body,
    timeoutMs,
    signal,
  );

  // If Sentinel rejected an access token due to clock skew or just-expired TTL,
  // attempt one refresh rotation and replay the request once.
  if (response.status === 401 && accessToken && !skipAuth && !skipAuthHandler) {
    try {
      const refreshed = await authClient.refreshTokens();
      response = await performFetch(
        url,
        method,
        buildHeaders(refreshed.accessToken),
        body,
        timeoutMs,
        signal,
      );
    } catch {
      // Fall through to standard 401 handling below.
    }
  }

  if (response.status === 401) {
    if (!skipAuthHandler) onUnauthorized?.();
    throw new ApiError('unauthorized', await readErrorMessage(response), 401);
  }
  if (response.status === 404) {
    throw new ApiError('notFound', await readErrorMessage(response), 404);
  }
  if (response.status >= 500) {
    throw new ApiError('server', await readErrorMessage(response), response.status);
  }
  if (!response.ok) {
    throw new ApiError('unknown', await readErrorMessage(response), response.status);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    // A Sentinel API route always returns JSON; HTML here means we hit a login
    // page or an unrelated host.
    throw new ApiError('badResponse', 'Expected JSON but the server returned something else');
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('badResponse', 'Could not parse the server response');
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error ?? parsed.message ?? `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}
