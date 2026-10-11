import type { ReactNode } from 'react';
import { formatTime, localHourOf } from '@/lib/format';
import { slotOptions } from '@/lib/slots';
import type { StaffAvailability } from '@/lib/types';
import { EmptyState } from './ui';

interface SlotPickerProps {
  availability: StaffAvailability[];
  /** A staff id, or ANY_STAFF to merge everyone's slots. */
  staffId: string;
  timeZone: string;
  selected: string | null;
  onSelect(start: string, staffId: string | null): void;
  /** Shown under the empty state, e.g. a button that jumps to the next day. */
  emptyAction?: ReactNode;
}

const PERIODS = [
  { label: 'Morning', from: 0, to: 12 },
  { label: 'Afternoon', from: 12, to: 17 },
  { label: 'Evening', from: 17, to: 24 },
];

export function SlotPicker({
  availability,
  staffId,
  timeZone,
  selected,
  onSelect,
  emptyAction,
}: SlotPickerProps) {
  const options = slotOptions(availability, staffId);
  if (options.length === 0) {
    return (
      <EmptyState title="No open slots on this day" action={emptyAction}>
        Try another date, or let anyone available take you.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-6">
      {PERIODS.map((period) => {
        const slots = options.filter((o) => {
          const hour = localHourOf(o.start, timeZone);
          return hour >= period.from && hour < period.to;
        });
        if (slots.length === 0) {
          return null;
        }
        return (
          <fieldset key={period.label}>
            <legend className="mb-2.5 text-sm font-medium text-ink">
              {period.label}
              <span aria-hidden="true" className="ml-2 font-normal text-ink-faint">
                {slots.length} open
              </span>
            </legend>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 xl:grid-cols-5">
              {slots.map((slot) => {
                const isSelected =
                  selected !== null && new Date(selected).getTime() === new Date(slot.start).getTime();
                return (
                  <button
                    key={slot.start}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(slot.start, slot.staffId)}
                    className={`h-11 rounded-md border font-mono text-[13px] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${
                      isSelected
                        ? 'border-pine-600 bg-pine-600 font-medium text-white'
                        : 'border-line-strong bg-surface text-ink hover:border-pine-600 hover:bg-pine-50'
                    }`}
                  >
                    {formatTime(slot.start, timeZone)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
