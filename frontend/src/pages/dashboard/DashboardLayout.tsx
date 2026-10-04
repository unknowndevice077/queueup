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

const NAV: { to: string; label: string; ownerOnly?: boolean }[] = [
  { to: '', label: 'Overview' },
  { to: 'calendar', label: 'Calendar' },
  { to: 'queue', label: 'Queue' },
  { to: 'services', label: 'Services', ownerOnly: true },
  { to: 'staff', label: 'Staff', ownerOnly: true },
  { to: 'blackouts', label: 'Blackouts' },
  { to: 'settings', label: 'Settings', ownerOnly: true },
  { to: 'audit', label: 'Audit log', ownerOnly: true },
];

export default function DashboardLayout() {
  const { slug = '' } = useParams();
  const { memberships, roleIn, logout } = useAuth();
  const navigate = useNavigate();
  const role = roleIn(slug) ?? 'STAFF';
  const { data: settings, isLoading, error, refetch } = useTenantSettings(slug);
  const links = NAV.filter((item) => !item.ownerOnly || role === 'OWNER');

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Logo />
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="text-sm text-slate-500 hover:text-slate-900 md:hidden"
          >
            Sign out
          </button>
        </div>
        {memberships.length > 1 && (
          <div className="px-4 pb-3">
            <label htmlFor="tenant-switcher" className="sr-only">
              Business
            </label>
            <select
              id="tenant-switcher"
              value={slug}
              onChange={(event) => navigate(`/dashboard/${event.target.value}`)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {memberships.map((m) => (
                <option key={m.tenantSlug} value={m.tenantSlug}>
                  {m.tenantName}
                </option>
              ))}
            </select>
          </div>
        )}
        <nav
          aria-label="Dashboard"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible"
        >
          {links.map((item) => (
            <NavLink key={item.label} to={item.to} end={item.to === ''} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
          <a
            href={`/b/${slug}/display`}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            TV display ↗
          </a>
          <NavLink to="/my/bookings" className={linkClass}>
            My bookings
          </NavLink>
        </nav>
        <div className="hidden px-4 py-4 md:absolute md:bottom-0 md:block">
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        {isLoading ? (
          <PageSpinner label="Loading business" />
        ) : error || !settings ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <Outlet context={{ slug, role, settings } satisfies DashboardContext} />
        )}
      </main>
    </div>
  );
}
