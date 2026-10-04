import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, type TokenStore } from './api';

function memoryStore(access: string | null, refresh: string | null): TokenStore & { access: string | null } {
  const store = {
    access,
    refresh,
    getAccessToken: () => store.access,
    getRefreshToken: () => store.refresh,
    setTokens: (tokens: { accessToken: string; refreshToken: string }) => {
      store.access = tokens.accessToken;
      store.refresh = tokens.refreshToken;
    },
    clear: () => {
      store.access = null;
      store.refresh = null;
    },
  };
  return store;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fake API: /api/me accepts only "fresh-access"; /api/auth/refresh rotates "refresh-1" into a new pair. */
function fakeServer({ refreshSucceeds = true, refreshDelayMs = 0 } = {}) {
  const calls: { url: string; auth: string | null }[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, auth: headers.Authorization ?? null });
    if (url.endsWith('/api/auth/refresh')) {
      await new Promise((resolve) => setTimeout(resolve, refreshDelayMs));
      return refreshSucceeds
        ? json(200, { accessToken: 'fresh-access', refreshToken: 'refresh-2', expiresIn: 900 })
        : json(401, {
            status: 401,
            title: 'Unauthorized',
            detail: 'Refresh token reuse detected',
            errors: [],
          });
    }
    if (headers.Authorization === 'Bearer fresh-access') {
      return json(200, { ok: true, url });
    }
    return json(401, {
      status: 401,
      title: 'Unauthorized',
      detail: 'Authentication is required',
      errors: [],
    });
  });
  return { fetchImpl, calls };
}

describe('api client token refresh', () => {
  it('refreshes once on 401 and retries the request with the new access token', async () => {
    const store = memoryStore('expired-access', 'refresh-1');
    const { fetchImpl, calls } = fakeServer();
    const client = createApiClient({ baseUrl: '', tokens: store, fetchImpl });

    const result = await client.get<{ ok: boolean }>('/api/me');

    expect(result.ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(['/api/me', '/api/auth/refresh', '/api/me']);
    expect(calls[2].auth).toBe('Bearer fresh-access');
    expect(store.getRefreshToken()).toBe('refresh-2');
  });

  it('shares a single refresh between concurrent 401s so a rotating token is never reused', async () => {
    const store = memoryStore('expired-access', 'refresh-1');
    const { fetchImpl, calls } = fakeServer({ refreshDelayMs: 20 });
    const client = createApiClient({ baseUrl: '', tokens: store, fetchImpl });

    const results = await Promise.all([client.get('/api/a'), client.get('/api/b'), client.get('/api/c')]);

    expect(results).toHaveLength(3);
    expect(calls.filter((c) => c.url.endsWith('/api/auth/refresh'))).toHaveLength(1);
  });

  it('queues requests issued while a refresh is in flight instead of sending stale tokens', async () => {
    const store = memoryStore('expired-access', 'refresh-1');
    const { fetchImpl, calls } = fakeServer({ refreshDelayMs: 30 });
    const client = createApiClient({ baseUrl: '', tokens: store, fetchImpl });

    const first = client.get('/api/first');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = client.get('/api/second');
    await Promise.all([first, second]);

    const secondCalls = calls.filter((c) => c.url === '/api/second');
    expect(secondCalls).toHaveLength(1);
    expect(secondCalls[0].auth).toBe('Bearer fresh-access');
  });

  it('signs the user out when the refresh token is rejected and surfaces the 401', async () => {
    const store = memoryStore('expired-access', 'refresh-1');
    const { fetchImpl, calls } = fakeServer({ refreshSucceeds: false });
    const onSessionExpired = vi.fn();
    const client = createApiClient({ baseUrl: '', tokens: store, fetchImpl, onSessionExpired });

    await expect(client.get('/api/me')).rejects.toMatchObject({ status: 401 });

    expect(onSessionExpired).toHaveBeenCalledOnce();
    expect(store.getRefreshToken()).toBeNull();
    expect(calls.filter((c) => c.url === '/api/me')).toHaveLength(1);
  });

  it('does not try to refresh for anonymous calls', async () => {
    const store = memoryStore(null, null);
    const { fetchImpl, calls } = fakeServer();
    const client = createApiClient({ baseUrl: '', tokens: store, fetchImpl });

    await expect(client.get('/api/me')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
  });

  it('exposes RFC 7807 field errors', async () => {
    const fetchImpl = vi.fn(async () =>
      json(400, {
        status: 400,
        title: 'Validation failed',
        detail: 'One or more fields are invalid',
        errors: [{ field: 'email', message: 'must be a well-formed email address' }],
      }),
    );
    const client = createApiClient({ baseUrl: '', tokens: memoryStore(null, null), fetchImpl });

    const error = await client.post('/api/auth/register', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors()).toEqual({ email: 'must be a well-formed email address' });
  });
});
