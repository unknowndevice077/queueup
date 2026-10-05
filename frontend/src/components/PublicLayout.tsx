import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-2 ${inverted ? 'text-paper' : 'text-ink'}`}
      aria-label="QueueUp home"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill={inverted ? '#F6F4EE' : '#17160F'} />
        <path d="M8 10.5h16M8 16h11M8 21.5h6" stroke="#F2BC1F" strokeWidth="2.6" strokeLinecap="square" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[-0.02em]">QueueUp</span>
    </Link>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-2.5 py-1.5 text-sm transition-colors ${
    isActive ? 'text-ink underline decoration-2 underline-offset-[6px]' : 'text-ink-muted hover:text-ink'
  }`;

export function PublicLayout() {
  const { status, user, memberships, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-1">
            {status === 'authenticated' ? (
              <>
                <NavLink to="/my/bookings" className={navClass}>
                  My bookings
                </NavLink>
                {memberships.length > 0 && (
                  <NavLink to="/dashboard" className={navClass}>
                    Dashboard
                  </NavLink>
                )}
                <span className="mx-2 hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
                <span className="hidden max-w-[160px] truncate text-sm text-ink-muted md:inline">
                  {user?.fullName}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  className="px-2.5 py-1.5 text-sm text-ink-muted hover:text-ink"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Sign in
                </NavLink>
                <Link
                  to="/register"
                  className="ml-1 inline-flex h-8 items-center rounded-md bg-ink px-3 text-[13px] font-medium text-paper hover:bg-ink-2"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-[13px] text-ink-muted sm:flex-row sm:justify-between sm:px-6">
          <span>QueueUp. Bookings and walk-in queues for neighbourhood businesses.</span>
          <span className="num">Times shown in each business&apos;s local time.</span>
        </div>
      </footer>
    </div>
  );
}
