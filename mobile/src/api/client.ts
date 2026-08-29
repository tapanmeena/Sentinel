import { ApiError, classifyNetworkError } from './errors';

const DEFAULT_TIMEOUT_MS = 15_000;

interface ApiConfig {
  baseUrl: string | null;
  token: string | null;
}

// Module-level config rather than a store import, so the auth store can depend
// on the client without a cycle.
const config: ApiConfig = { baseUrl: null, token: null };
let onUnauthorized: (() => void) | null = null;

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
  /** Skip the global 401 handler, used by login and reachability probes. */
  skipAuthHandler?: boolean;
  /** Explicit base URL, used before the server address is committed to state. */
  baseUrlOverride?: string;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    params,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, {
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
