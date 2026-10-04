import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlotPicker } from './SlotPicker';
import { ANY_STAFF, slotOptions } from '@/lib/slots';
import type { StaffAvailability } from '@/lib/types';

const availability: StaffAvailability[] = [
  {
    staffId: 'mark',
    staffName: 'Mark',
    slots: ['2026-10-06T09:00:00+08:00', '2026-10-06T13:30:00+08:00'],
  },
  {
    staffId: 'jun',
    staffName: 'Jun',
    // 01:00Z is 09:00 in Manila: the same instant as Mark's first slot, written differently.
    slots: ['2026-10-06T01:00:00Z', '2026-10-06T17:15:00+08:00'],
  },
];

describe('slotOptions', () => {
  it('merges every staff member for "any", de-duplicating identical instants', () => {
    const options = slotOptions(availability, ANY_STAFF);

    expect(options).toHaveLength(3);
    expect(options.every((o) => o.staffId === null)).toBe(true);
  });

  it('filters to one staff member and keeps their id', () => {
    expect(slotOptions(availability, 'jun')).toEqual([
      { start: '2026-10-06T01:00:00Z', staffId: 'jun' },
      { start: '2026-10-06T17:15:00+08:00', staffId: 'jun' },
    ]);
  });
});

describe('<SlotPicker />', () => {
  it('shows times in the business time zone grouped by part of day', () => {
    render(
      <SlotPicker
        availability={availability}
        staffId={ANY_STAFF}
        timeZone="Asia/Manila"
        selected={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole('group', { name: 'Morning' })).toHaveTextContent(/9:00/);
    expect(screen.getByRole('group', { name: 'Afternoon' })).toHaveTextContent(/1:30/);
    expect(screen.getByRole('group', { name: 'Evening' })).toHaveTextContent(/5:15/);
  });

  it('reports the chosen start and staff, and marks the selection', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <SlotPicker
        availability={availability}
        staffId="mark"
        timeZone="Asia/Manila"
        selected={null}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /1:30/ }));

    expect(onSelect).toHaveBeenCalledWith('2026-10-06T13:30:00+08:00', 'mark');
    rerender(
      <SlotPicker
        availability={availability}
        staffId="mark"
        timeZone="Asia/Manila"
        selected="2026-10-06T13:30:00+08:00"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('button', { name: /1:30/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /9:00/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders an empty state when nothing is open', () => {
    render(
      <SlotPicker
        availability={[]}
        staffId={ANY_STAFF}
        timeZone="Asia/Manila"
        selected={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('No open slots on this day')).toBeInTheDocument();
  });
});
