import { useMemo, useState } from 'react';
import { addDays } from '@/lib/format';

interface DateCalendarProps {
  /** Selected date as YYYY-MM-DD. */
  value: string | null;
  onChange(date: string): void;
  /** Today in the business time zone (YYYY-MM-DD); earlier days are disabled. */
  today: string;
  maxDaysAhead?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthOf(date: string) {
  const [y, m] = date.split('-').map(Number);
  return { year: y, month: m };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Month grid date picker. Dates are plain YYYY-MM-DD strings, so there is no browser time-zone drift. */
export function DateCalendar({ value, onChange, today, maxDaysAhead = 60 }: DateCalendarProps) {
  const [visible, setVisible] = useState(() => monthOf(value ?? today));
  const lastDay = addDays(today, maxDaysAhead);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(visible.year, visible.month - 1, 1));
    const daysInMonth = new Date(Date.UTC(visible.year, visible.month, 0)).getUTCDate();
    const leading = first.getUTCDay();
    const result: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(`${visible.year}-${pad(visible.month)}-${pad(day)}`);
    }
    return result;
  }, [visible]);

  const label = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(visible.year, visible.month - 1, 1)),
  );
  const firstOfVisible = `${visible.year}-${pad(visible.month)}-01`;
  const canGoBack = firstOfVisible > today.slice(0, 8) + '01';
  const canGoForward = `${visible.year}-${pad(visible.month)}-31` < lastDay;

  const shiftMonth = (delta: number) =>
    setVisible(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });

  return (
    <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          ‹
        </button>
        <h3 className="font-semibold" aria-live="polite">
          {label}
        </h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={!canGoForward}
          aria-label="Next month"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div role="grid" aria-label={label} className="grid grid-cols-7 gap-1 text-center text-sm">
        {WEEKDAYS.map((day) => (
          <div key={day} role="columnheader" className="py-1 text-xs font-medium text-slate-500">
            {day}
          </div>
        ))}
        {cells.map((date, index) =>
          date ? (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={date < today || date > lastDay}
              aria-selected={date === value}
              aria-label={new Intl.DateTimeFormat('en-PH', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(`${date}T00:00:00Z`))}
              onClick={() => onChange(date)}
              className={`rounded-lg py-2 font-medium transition disabled:cursor-not-allowed disabled:text-slate-300 ${
                date === value
                  ? 'bg-brand-600 text-white'
                  : date === today
                    ? 'text-brand-700 ring-1 ring-brand-300 hover:bg-brand-50'
                    : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              {Number(date.slice(8))}
            </button>
          ) : (
            <div key={`blank-${index}`} aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  );
}
