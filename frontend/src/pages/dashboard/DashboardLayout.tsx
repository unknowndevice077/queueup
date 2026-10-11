import { NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useTenantSettings } from '@/lib/queries';
import type { TenantRole, TenantSettings } from '@/lib/types';
import { ErrorState, PageSpinner } from '@/components/ui';
import { Logo } from '@/components/PublicLayout';
import { External } from '@/components/icons';

export interface DashboardContext {
  slug: string;
  role: TenantRole;
  settings: TenantSettings;
}

export function useDashboard(): DashboardContext {
  return useOutletContext<DashboardContext>();
}

const NAV: { to: string; label: string; ownerOnly?: boolean; group: 'today' | 'setup' }[] = [
  { to: '', label: 'Overview', group: 'today' },
  { to: 'calendar', label: 'Calendar', group: 'today' },
  { to: 'queue', label: 'Walk-in queue', group: 'today' },
  { to: 'services', label: 'Services', ownerOnly: true, group: 'setup' },
  { to: 'staff', label: 'Staff & hours', ownerOnly: true, group: 'setup' },
  { to: 'blackouts', label: 'Time off', group: 'setup' },
  { to: 'settings', label: 'Settings', ownerOnly: true, group: 'setup' },
  { to: 'audit', label: 'Activity log', ownerOnly: true, group: 'setup' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm transition-colors duration-150 md:mx-2 md:px-3 ${
    isActive
      ? 'bg-ink font-medium text-paper md:bg-surface md:text-ink md:shadow-[inset_2px_0_0_#17160F]'
      : 'text-ink-muted hover:bg-ink/[0.05] hover:text-ink'
  }`;

export default function DashboardLayout() {
  const { slug = '' } = useParams();
  const { memberships, roleIn, logout, user } = useAuth();
  const navigate = useNavigate();
  const role = roleIn(slug) ?? 'STAFF';
  const { data: settings, isLoading, error, refetch } = useTenantSettings(slug);
  const links = NAV.filter((item) => !item.ownerOnly || role === 'OWNER');
  const current = memberships.find((m) => m.tenantSlug === slug);

  const signOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px,1fr]">
      <aside className="border-b border-line bg-paper md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-b-0 md:border-r">
        <div className="flex h-14 items-center justify-between px-4 md:px-5">
          <Logo />
          <button type="button" onClick={signOut} className="text-sm text-ink-muted hover:text-ink md:hidden">
            Sign out
          </button>
        </div>

        <div className="px-4 pb-3 md:px-5 md:pb-5">
          {memberships.length > 1 ? (
            <>
              <label htmlFor="tenant-switcher" className="sr-only">
                Business
              </label>
              <select
                id="tenant-switcher"
                value={slug}
                onChange={(event) => navigate(`/dashboard/${event.target.value}`)}
                className="h-9 w-full cursor-pointer rounded-md border border-line-strong bg-surface px-2 text-sm font-medium transition-colors hover:border-ink-faint"
              >
                {memberships.map((m) => (
                  <option key={m.tenantSlug} value={m.tenantSlug}>
                    {m.tenantName}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="truncate text-sm font-medium">{current?.tenantName}</p>
          )}
        </div>

        <nav
          aria-label="Dashboard"
          className="flex gap-0.5 overflow-x-auto px-2 pb-2 md:flex-col md:gap-0 md:px-0 md:pb-0"
        >
          {(['today', 'setup'] as const).map((group) => (
            <div
              key={group}
              role="group"
              aria-label={group === 'today' ? 'Day to day' : 'Set up'}
              className={`contents md:block md:space-y-0.5 ${group === 'setup' ? 'md:mt-3 md:border-t md:border-line md:pt-3' : ''}`}
            >
              {links
                .filter((item) => item.group === group)
                .map((item) => (
                  <NavLink key={item.label} to={item.to} end={item.to === ''} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
            </div>
          ))}
          <div className="contents md:mt-3 md:block md:space-y-0.5 md:border-t md:border-line md:pt-3">
            <a
              href={`/b/${slug}/display`}
              target="_blank"
              rel="noreferrer"
              className={linkClass({ isActive: false })}
            >
              TV board
              <External className="h-3.5 w-3.5 opacity-60" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <a
              href={`/b/${slug}`}
              target="_blank"
              rel="noreferrer"
              className={linkClass({ isActive: false })}
            >
              Booking page
              <External className="h-3.5 w-3.5 opacity-60" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </nav>

        <div className="mt-auto hidden border-t border-line px-5 py-4 md:block">
          <p className="truncate text-sm font-medium">{user?.fullName}</p>
          <p className="text-xs text-ink-muted">{role === 'OWNER' ? 'Owner' : 'Staff'}</p>
          <div className="mt-2 flex gap-3 text-[13px]">
            <NavLink
              to="/my/bookings"
              className="text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              My bookings
            </NavLink>
            <button type="button" onClick={signOut} className="text-ink-muted hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main id="main" className="min-w-0 bg-paper px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">
          {isLoading ? (
            <PageSpinner label="Loading business" />
          ) : error || !settings ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : (
            <Outlet context={{ slug, role, settings } satisfies DashboardContext} />
          )}
        </div>
      </main>
    </div>
  );
}
