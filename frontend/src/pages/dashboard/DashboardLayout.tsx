import { NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useTenantSettings } from '@/lib/queries';
import type { TenantRole, TenantSettings } from '@/lib/types';
import { ErrorState, PageSpinner } from '@/components/ui';
import { Logo } from '@/components/PublicLayout';

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
  `relative flex h-9 shrink-0 items-center whitespace-nowrap px-3 text-sm transition-colors md:rounded-none md:border-l-2 md:pl-4 ${
    isActive
      ? 'font-medium text-ink md:border-ink md:bg-surface'
      : 'text-ink-muted hover:text-ink md:border-transparent'
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
              <label htmlFor="tenant-switcher" className="eyebrow">
                Business
              </label>
              <select
                id="tenant-switcher"
                value={slug}
                onChange={(event) => navigate(`/dashboard/${event.target.value}`)}
                className="mt-1.5 h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-sm"
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
            <div key={group} className="contents md:mb-5 md:block">
              <p className="eyebrow hidden px-5 pb-1.5 md:block">
                {group === 'today' ? 'Day to day' : 'Set up'}
              </p>
              {links
                .filter((item) => item.group === group)
                .map((item) => (
                  <NavLink key={item.label} to={item.to} end={item.to === ''} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
            </div>
          ))}
          <a
            href={`/b/${slug}/display`}
            target="_blank"
            rel="noreferrer"
            className={linkClass({ isActive: false })}
          >
            TV board ↗
          </a>
          <a href={`/b/${slug}`} target="_blank" rel="noreferrer" className={linkClass({ isActive: false })}>
            Booking page ↗
          </a>
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
