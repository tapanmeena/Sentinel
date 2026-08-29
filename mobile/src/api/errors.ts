export type ApiErrorKind =
  | 'unauthorized'
  | 'notFound'
  | 'network'
  | 'timeout'
  | 'tls'
  | 'server'
  | 'badResponse'
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** Map a thrown value to a message safe to show in the UI. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'unauthorized':
        return 'Your session expired. Sign in again.';
      case 'notFound':
        return 'That item no longer exists on the server.';
      case 'timeout':
        return 'The server took too long to respond.';
      case 'tls':
        return 'Could not establish a secure connection to the server.';
      case 'network':
        return 'Cannot reach the server. Check your connection and the server address.';
      case 'server':
        return 'The server hit an error. Check the Sentinel logs.';
      case 'badResponse':
        return 'The server returned an unexpected response.';
      default:
        return error.message || 'Something went wrong.';
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong.';
}

/** Classify a fetch rejection, which surfaces only as a generic TypeError. */
export function classifyNetworkError(error: unknown): ApiError {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes('abort')) {
    return new ApiError('timeout', 'Request timed out');
  }
  if (
    lower.includes('certificate') ||
    lower.includes('ssl') ||
    lower.includes('tls') ||
    lower.includes('trust anchor')
  ) {
    return new ApiError('tls', 'TLS handshake failed');
  }
  return new ApiError('network', 'Network request failed');
}
