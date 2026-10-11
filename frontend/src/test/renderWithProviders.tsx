import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '@/auth/AuthContext';
import { ToastProvider } from '@/components/Toaster';
import { ConfirmProvider } from '@/components/Dialog';
import type { MembershipSummary, MeResponse } from '@/lib/types';

export function fakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const memberships: MembershipSummary[] = overrides.memberships ?? [];
  const profile: MeResponse = {
    user: { id: 'u1', email: 'ana@example.ph', fullName: 'Ana Reyes' },
    memberships,
  };
  return {
    status: 'authenticated',
    user: profile.user,
    memberships,
    login: async () => profile,
    register: async () => profile,
    logout: async () => undefined,
    reloadProfile: async () => undefined,
    roleIn: (slug) => memberships.find((m) => m.tenantSlug === slug)?.role ?? null,
    ...overrides,
  };
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', auth = fakeAuth() }: { route?: string; auth?: AuthContextValue } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ToastProvider>
          <ConfirmProvider>
            <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
