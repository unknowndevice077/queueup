import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth, RequireTenantRole } from './RouteGuards';
import { fakeAuth, renderWithProviders } from '@/test/renderWithProviders';
import type { MembershipSummary } from '@/lib/types';

function LoginProbe() {
  const location = useLocation();
  return <p>login page {location.search}</p>;
}

const membership = (slug: string, role: 'OWNER' | 'STAFF'): MembershipSummary => ({
  membershipId: `m-${slug}`,
  tenantId: `t-${slug}`,
  tenantSlug: slug,
  tenantName: slug,
  timezone: 'Asia/Manila',
  role,
});

function routes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route
        path="/my/bookings"
        element={
          <RequireAuth>
            <p>my bookings</p>
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/:slug/settings"
        element={
          <RequireTenantRole roles={['OWNER']}>
            <p>settings form</p>
          </RequireTenantRole>
        }
      />
      <Route
        path="/dashboard/:slug"
        element={
          <RequireTenantRole roles={['OWNER', 'STAFF']}>
            <p>dashboard home</p>
          </RequireTenantRole>
        }
      />
    </Routes>
  );
}

describe('RequireAuth', () => {
  it('sends anonymous visitors to login and remembers where they were going', () => {
    renderWithProviders(routes(), {
      route: '/my/bookings',
      auth: fakeAuth({ status: 'anonymous', user: null }),
    });

    expect(screen.getByText(/login page/)).toHaveTextContent('?next=%2Fmy%2Fbookings');
  });

  it('renders the page for signed-in users', () => {
    renderWithProviders(routes(), { route: '/my/bookings' });

    expect(screen.getByText('my bookings')).toBeInTheDocument();
  });

  it('waits while the session is being restored', () => {
    renderWithProviders(routes(), { route: '/my/bookings', auth: fakeAuth({ status: 'loading' }) });

    expect(screen.getByRole('status')).toHaveTextContent(/Checking your session/);
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });
});

describe('RequireTenantRole', () => {
  it('lets an owner into owner-only pages', () => {
    renderWithProviders(routes(), {
      route: '/dashboard/kanto-cuts/settings',
      auth: fakeAuth({ memberships: [membership('kanto-cuts', 'OWNER')] }),
    });

    expect(screen.getByText('settings form')).toBeInTheDocument();
  });

  it('keeps staff out of owner-only pages but lets them into the dashboard', () => {
    const auth = fakeAuth({ memberships: [membership('kanto-cuts', 'STAFF')] });
    const { unmount } = renderWithProviders(routes(), { route: '/dashboard/kanto-cuts/settings', auth });

    expect(screen.getByRole('alert')).toHaveTextContent(/business owners only/);
    expect(screen.queryByText('settings form')).not.toBeInTheDocument();
    unmount();

    renderWithProviders(routes(), { route: '/dashboard/kanto-cuts', auth });
    expect(screen.getByText('dashboard home')).toBeInTheDocument();
  });

  it('blocks people who are not members of that business', () => {
    renderWithProviders(routes(), {
      route: '/dashboard/sanare-dental',
      auth: fakeAuth({ memberships: [membership('kanto-cuts', 'OWNER')] }),
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/not a member/);
  });
});
