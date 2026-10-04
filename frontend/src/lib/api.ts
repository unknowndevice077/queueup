import type { AuthTokens, Problem } from './types';

/** An error response from the API, carrying the RFC 7807 problem body when there is one. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem?: Problem;

  constructor(status: number, message: string, problem?: Problem) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }

  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.problem?.errors ?? []).map((e) => [e.field, e.message]));
  }
}

export interface TokenStore {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(tokens: Pick<AuthTokens, 'accessToken' | 'refreshToken'>): void;
  clear(): void;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface ApiClientConfig {
  baseUrl: string;
  tokens: TokenStore;
  fetchImpl?: typeof fetch;
  /** Called once when the refresh token is rejected, so the UI can sign the user out. */
  onSessionExpired?: () => void;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Fetch wrapper with automatic access-token refresh. On a 401 it refreshes once and retries the request once.
 * Concurrent 401s share a single in-flight refresh, and requests issued while a refresh is running wait for it,
 * so a rotating refresh token is never presented twice.
 */
export function createApiClient({ baseUrl, tokens, fetchImpl, onSessionExpired }: ApiClientConfig) {
  const doFetch: typeof fetch = (...args) => (fetchImpl ?? globalThis.fetch)(...args);
  let refreshInFlight: Promise<boolean> | null = null;

  function refreshTokens(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const refreshToken = tokens.getRefreshToken();
        if (!refreshToken) {
          return false;
        }
        try {
          const response = await doFetch(`${baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (!response.ok) {
            tokens.clear();
            onSessionExpired?.();
            return false;
          }
          const data = (await response.json()) as AuthTokens;
          tokens.setTokens(data);
          return true;
        } catch {
          return false;
        }
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function send(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const accessToken = options.auth === false ? null : tokens.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return doFetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  }

  async function raw(path: string, options: RequestOptions = {}): Promise<Response> {
    if (refreshInFlight && options.auth !== false) {
      await refreshInFlight;
    }
    let response = await send(path, options);
    if (response.status === 401 && options.auth !== false && tokens.getRefreshToken()) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        response = await send(path, options);
      }
    }
    if (!response.ok) {
      throw await toApiError(response);
    }
    return response;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await raw(path, options);
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return undefined as T;
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    request,
    raw,
    refreshTokens,
    get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
    del: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: Problem | undefined;
  try {
    problem = (await response.json()) as Problem;
  } catch {
    problem = undefined;
  }
  const message = problem?.detail || problem?.title || `Request failed (${response.status})`;
  return new ApiError(response.status, message, problem);
}

/** Access token in memory, refresh token in localStorage so a reload keeps the session. */
export function createBrowserTokenStore(storageKey = 'queueup.refreshToken'): TokenStore {
  let accessToken: string | null = null;
  const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
  return {
    getAccessToken: () => accessToken,
    getRefreshToken: () => storage?.getItem(storageKey) ?? null,
    setTokens: (tokens) => {
      accessToken = tokens.accessToken;
      storage?.setItem(storageKey, tokens.refreshToken);
    },
    clear: () => {
      accessToken = null;
      storage?.removeItem(storageKey);
    },
  };
}

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const tokenStore = createBrowserTokenStore();

let sessionExpiredListener: (() => void) | null = null;

export function onSessionExpired(listener: () => void) {
  sessionExpiredListener = listener;
}

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  tokens: tokenStore,
  onSessionExpired: () => sessionExpiredListener?.(),
});
