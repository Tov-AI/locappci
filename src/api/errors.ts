import type { ApiErrorBody } from '@/api/contract';

/** Error thrown by any API client. `message` is always safe to show to users, in French. */
export class ApiError extends Error {
  readonly code: ApiErrorBody['code'] | 'network';

  constructor(code: ApiError['code'], message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }

  /** Network problems are worth retrying; a 404 is not. */
  get retryable() {
    return this.code === 'network' || this.code === 'server_error' || this.code === 'unavailable';
  }
}

export const networkError = () =>
  new ApiError('network', 'Connexion impossible. Vérifiez votre réseau et réessayez.');
