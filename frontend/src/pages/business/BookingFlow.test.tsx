import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { BookingFlow } from './BookingFlow';
import { addDays, todayIn } from '@/lib/format';
import { fakeAuth, renderWithProviders } from '@/test/renderWithProviders';
import type { PublicTenant } from '@/lib/types';

const TZ = 'Asia/Manila';
const tomorrow = addDays(todayIn(TZ), 1);
const tenSlot = `${tomorrow}T10:00:00+08:00`;
const elevenSlot = `${tomorrow}T11:00:00+08:00`;

const tenant: PublicTenant = {
  name: 'Kanto Cuts Barbershop',
  slug: 'kanto-cuts',
  timezone: TZ,
  currency: 'PHP',
  bookingLeadTimeMinutes: 30,
  cancellationWindowHours: 2,
  depositRequired: false,
  depositPercent: 0,
  services: [
    {
      id: 'svc-cut',
      name: 'Classic Haircut',
      durationMinutes: 30,
      bufferMinutes: 5,
      priceCentavos: 25000,
      active: true,
    },
  ],
  staff: [{ id: 'mark', name: 'Mark Villanueva', serviceIds: ['svc-cut'] }],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let bookingResponses: Response[];
let postedBodies: unknown[];

beforeEach(() => {
  postedBodies = [];
  bookingResponses = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/public/tenants/kanto-cuts')) {
        return json(200, tenant);
      }
      if (url.includes('/availability')) {
        return json(200, [{ staffId: 'mark', staffName: 'Mark Villanueva', slots: [tenSlot, elevenSlot] }]);
      }
      if (url.endsWith('/api/t/kanto-cuts/bookings') && init?.method === 'POST') {
        postedBodies.push(JSON.parse(String(init.body)));
        return bookingResponses.shift() ?? json(500, {});
      }
      return json(404, { status: 404, title: 'Not Found', detail: url, errors: [] });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderFlow(auth = fakeAuth()) {
  return renderWithProviders(
    <Routes>
      <Route path="/b/:slug/book" element={<BookingFlow />} />
      <Route path="/b/:slug/book/success" element={<p>success page</p>} />
    </Routes>,
    { route: '/b/kanto-cuts/book', auth },
  );
}

async function walkToConfirmStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Classic Haircut/ }));

  const dayLabel = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${tomorrow}T00:00:00Z`));
  if (!screen.queryByRole('gridcell', { name: dayLabel })) {
    await user.click(screen.getByRole('button', { name: 'Next month' }));
  }
  await user.click(screen.getByRole('gridcell', { name: dayLabel }));

  await user.click(await screen.findByRole('button', { name: /Any available/ }));
  await user.click(await screen.findByRole('button', { name: /10:00/ }));
  return screen.findByRole('heading', { name: 'Confirm your booking' });
}

describe('<BookingFlow />', () => {
  it('walks service -> date -> staff -> slot -> confirm and books the chosen slot', async () => {
    const user = userEvent.setup();
    bookingResponses.push(json(201, { id: 'b-1', status: 'CONFIRMED' }));
    renderFlow();

    await walkToConfirmStep(user);
    const summary = screen.getByRole('heading', { name: 'Confirm your booking' }).closest('section')!;
    expect(within(summary).getByText('Classic Haircut')).toBeInTheDocument();
    expect(within(summary).getByText('₱250.00')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Notes for the business/), 'Low fade please');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText('success page')).toBeInTheDocument();
    expect(postedBodies).toEqual([{ serviceId: 'svc-cut', startsAt: tenSlot, notes: 'Low fade please' }]);
  });

  it('asks anonymous visitors to sign in before confirming, keeping their choices', async () => {
    const user = userEvent.setup();
    renderFlow(fakeAuth({ status: 'anonymous', user: null }));

    await walkToConfirmStep(user);

    const signIn = screen.getByRole('link', { name: 'Sign in to confirm' });
    const next = new URL(signIn.getAttribute('href')!, 'http://app.test').searchParams.get('next')!;
    expect(next.startsWith('/b/kanto-cuts/book?')).toBe(true);
    expect(new URL(next, 'http://app.test').searchParams.get('start')).toBe(tenSlot);
    expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument();
  });

  it('sends the customer back to the time picker when the slot was just taken (409)', async () => {
    const user = userEvent.setup();
    bookingResponses.push(
      json(409, { status: 409, title: 'Conflict', detail: 'Slot no longer available', errors: [] }),
    );
    renderFlow();

    await walkToConfirmStep(user);
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText(/that time was just taken/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeInTheDocument());
  });
});
