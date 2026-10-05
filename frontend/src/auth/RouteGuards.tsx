import type { ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { TenantRole } from '@/lib/types';
import { PageSpinner } from '@/components/ui';

/** Renders children only for signed-in users; everyone else is sent to /login and brought back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return <PageSpinner label="Checking your session" />;
  }
  if (status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/**
 * Renders children only when the user holds one of the given roles in the business named by the :slug param.
 * The API enforces the same rules; this guard only keeps people out of screens they cannot use.
 */
export function RequireTenantRole({ roles, children }: { roles: TenantRole[]; children: ReactNode }) {
  const { slug } = useParams();
  const { status, roleIn } = useAuth();
  if (status === 'loading') {
    return <PageSpinner label="Checking your access" />;
  }
  const role = roleIn(slug);
  if (!role || !roles.includes(role)) {
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-24 sm:px-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.01em]">
          You don&apos;t have access to this page
        </h1>
        <p className="mt-2 text-ink-2">
          {role ? 'This section is for business owners only.' : 'You are not a member of this business.'}
        </p>
        <Link
          to={role ? `/dashboard/${slug}` : '/'}
          className="mt-6 inline-block font-medium text-ink underline underline-offset-4"
        >
          Go back
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
