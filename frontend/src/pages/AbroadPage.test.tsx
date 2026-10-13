import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbroadPage } from './AbroadPage';
import { fakeAuth, renderWithProviders } from '@/test/renderWithProviders';

let posted: unknown[];

beforeEach(() => {
  posted = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      posted.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ position: 12, total: 12 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('<AbroadPage />', () => {
  it('joins the family waitlist with the visitor source and shows their place', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AbroadPage />, {
      route: '/abroad?src=fb-ofw-leyte',
      auth: fakeAuth({ status: 'anonymous', user: null }),
    });

    const form = within(screen.getByRole('form', { name: 'Early list for families' }));
    await user.type(form.getByLabelText('Your name'), 'Maricel Santos');
    await user.type(form.getByLabelText('Email'), 'maricel@example.com');
    await user.selectOptions(form.getByLabelText('Where do you work now?'), 'Saudi Arabia');
    await user.type(form.getByLabelText('Where does your family live?'), 'Ormoc City');
    await user.selectOptions(form.getByLabelText('Who would you book for?'), 'A parent');
    await user.click(form.getByLabelText('Dental'));
    await user.click(form.getByLabelText('Every few months'));

    await user.click(form.getByRole('button', { name: 'Join the early list' }));
    expect(await screen.findByText(/Please agree/)).toBeInTheDocument();
    expect(posted).toHaveLength(0);

    await user.click(form.getByLabelText(/I agree to be contacted/));
    await user.click(form.getByRole('button', { name: 'Join the early list' }));

    expect(await screen.findByText('#12')).toBeInTheDocument();
    expect(posted).toEqual([
      expect.objectContaining({
        kind: 'FAMILY',
        fullName: 'Maricel Santos',
        email: 'maricel@example.com',
        country: 'Saudi Arabia',
        familyLocation: 'Ormoc City',
        relation: 'A parent',
        services: ['Dental'],
        frequency: 'Every few months',
        consent: true,
        source: 'fb-ofw-leyte',
      }),
    ]);
  });
});
