import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useToast } from '@/components/Toaster';
import { Button, buttonClass } from '@/components/ui';
import { External } from '@/components/icons';

const DEMO_PASSWORD = 'Demo12345!';

type Role = {
  key: string;
  who: string;
  what: string;
  steps: string[];
  email?: string;
  to: string;
  newTab?: boolean;
  action: string;
};

const ROLES: Role[] = [
  {
    key: 'customer',
    who: 'A customer',
    what: 'Book a haircut at Kanto Cuts from your phone.',
    steps: ['Pick a service', 'Choose a day, barber and time', 'Confirm and see it in My bookings'],
    email: 'customer@demo.queueup',
    to: '/b/kanto-cuts',
    action: 'Book as Ana',
  },
  {
    key: 'walkin',
    who: 'A walk-in',
    what: 'Take a number without an account and watch your place in line.',
    steps: ['Enter your name', 'Get a ticket', 'Your phone buzzes when you are called'],
    to: '/b/kanto-cuts/queue',
    action: 'Take a number',
  },
  {
    key: 'staff',
    who: 'The barber at the counter',
    what: 'Call the next walk-in and mark appointments done.',
    steps: ['See who is next', 'Press Call next (or N)', 'The TV and phones update at once'],
    email: 'staff@demo.queueup',
    to: '/dashboard/kanto-cuts/queue',
    action: 'Open the counter as Mark',
  },
  {
    key: 'owner',
    who: 'The owner',
    what: 'See the day, the week, and how the shop is doing.',
    steps: ['Today’s appointments and walk-ins', 'Calendar for every barber', 'Revenue and no-shows'],
    email: 'owner@demo.queueup',
    to: '/dashboard/kanto-cuts',
    action: 'Open the dashboard as Paeng',
  },
];

/** One-tap entry into the demo businesses, for links shared on social media. */
export function DemoPage() {
  const { login, status, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const enter = async (role: Role) => {
    if (!role.email) {
      navigate(role.to);
      return;
    }
    setBusy(role.key);
    try {
      if (status === 'authenticated') {
        await logout();
      }
      await login(role.email, DEMO_PASSWORD);
      navigate(role.to);
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="max-w-2xl text-[34px] font-semibold leading-tight tracking-[-0.02em] sm:text-[42px]">
        Try QueueUp at a real-looking barbershop
      </h1>
      <p className="mt-3 max-w-xl text-[17px] text-ink-2">
        Kanto Cuts is a demo shop with three barbers, two months of history and people already in line. Pick
        who you want to be. Nothing you do here reaches a real business.
      </p>

      <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
        {ROLES.map((role) => (
          <li key={role.key} className="flex flex-col bg-surface p-6">
            <h2 className="text-lg font-semibold">{role.who}</h2>
            <p className="mt-1 text-ink-2">{role.what}</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-ink-muted">
              {role.steps.map((step) => (
                <li key={step} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                  {step}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button
                size="lg"
                variant={role.key === 'customer' ? 'primary' : 'secondary'}
                loading={busy === role.key}
                disabled={busy !== null && busy !== role.key}
                onClick={() => enter(role)}
              >
                {role.action}
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-6 border-t border-line pt-8 sm:grid-cols-2">
        <div>
          <h2 className="font-semibold">Put the TV board next to it</h2>
          <p className="mt-1 text-sm text-ink-2">
            Open the waiting-room display in another window, then call a ticket from the counter. The number
            changes on the board, the phone and the console at the same time.
          </p>
          <a
            href="/b/kanto-cuts/display"
            target="_blank"
            rel="noreferrer"
            className={buttonClass('ink', 'md', 'mt-4')}
          >
            Open the TV board
            <External />
          </a>
        </div>
        <div>
          <h2 className="font-semibold">Want this for your shop or clinic?</h2>
          <p className="mt-1 text-sm text-ink-2">
            Create your own business in a couple of minutes, or see the dental clinic demo that takes a
            deposit before booking.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link to="/register?next=/start" className={buttonClass('secondary', 'md')}>
              Set up my business
            </Link>
            <Link
              to="/b/sanare-dental"
              className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
            >
              Sanare Dental demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
