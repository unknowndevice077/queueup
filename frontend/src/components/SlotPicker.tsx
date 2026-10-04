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
}

const PERIODS = [
  { label: 'Morning', from: 0, to: 12 },
  { label: 'Afternoon', from: 12, to: 17 },
  { label: 'Evening', from: 17, to: 24 },
];

export function SlotPicker({ availability, staffId, timeZone, selected, onSelect }: SlotPickerProps) {
  const options = slotOptions(availability, staffId);
  if (options.length === 0) {
    return (
      <EmptyState title="No open slots on this day">
        Try another date or choose &quot;Any available&quot;.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-5">
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
            <legend className="mb-2 text-sm font-semibold text-slate-700">{period.label}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {slots.map((slot) => {
                const isSelected =
                  selected !== null && new Date(selected).getTime() === new Date(slot.start).getTime();
                return (
                  <button
                    key={slot.start}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(slot.start, slot.staffId)}
                    className={`rounded-lg px-2 py-2.5 text-sm font-medium ring-1 ring-inset transition ${
                      isSelected
                        ? 'bg-brand-600 text-white ring-brand-600'
                        : 'bg-white text-slate-800 ring-slate-300 hover:ring-brand-500'
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
