import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onSessionExpired, tokenStore } from '@/lib/api';
import type { AuthTokens, MeResponse, MembershipSummary, TenantRole, User } from '@/lib/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  memberships: MembershipSummary[];
  login(email: string, password: string): Promise<MeResponse>;
  register(input: { email: string; password: string; fullName: string; phone?: string }): Promise<MeResponse>;
  logout(): Promise<void>;
  reloadProfile(): Promise<void>;
  roleIn(slug: string | undefined): TenantRole | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);

  const signedOut = useCallback(() => {
    tokenStore.clear();
    setMe(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  const loadProfile = useCallback(async () => {
    const profile = await api.get<MeResponse>('/api/me');
    setMe(profile);
    setStatus('authenticated');
    return profile;
  }, []);

  useEffect(() => {
    onSessionExpired(signedOut);
    if (!tokenStore.getRefreshToken()) {
      setStatus('anonymous');
      return;
    }
    api
      .refreshTokens()
      .then(async (ok) => {
        if (ok) {
          await loadProfile();
        } else {
          signedOut();
        }
      })
      .catch(signedOut);
  }, [loadProfile, signedOut]);

  const acceptTokens = useCallback(
    async (tokens: AuthTokens) => {
      tokenStore.setTokens(tokens);
      return loadProfile();
    },
    [loadProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: me?.user ?? null,
      memberships: me?.memberships ?? [],
      login: async (email, password) => {
        const tokens = await api.post<AuthTokens>('/api/auth/login', { email, password }, { auth: false });
        return acceptTokens(tokens);
      },
      register: async (input) => {
        const tokens = await api.post<AuthTokens>('/api/auth/register', input, { auth: false });
        return acceptTokens(tokens);
      },
      logout: async () => {
        const refreshToken = tokenStore.getRefreshToken();
        if (refreshToken) {
          await api.post('/api/auth/logout', { refreshToken }, { auth: false }).catch(() => undefined);
        }
        signedOut();
      },
      reloadProfile: async () => {
        await loadProfile();
      },
      roleIn: (slug) => me?.memberships.find((m) => m.tenantSlug === slug)?.role ?? null,
    }),
    [status, me, acceptTokens, signedOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

export { AuthContext };
