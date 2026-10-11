import { useMemo, useState } from 'react';
import { addDays } from '@/lib/format';
import { ChevronLeft, ChevronRight } from './icons';

interface DateCalendarProps {
  /** Selected date as YYYY-MM-DD. */
  value: string | null;
  onChange(date: string): void;
  /** Today in the business time zone (YYYY-MM-DD); earlier days are disabled. */
  today: string;
  maxDaysAhead?: number;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
    const result: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(`${visible.year}-${pad(visible.month)}-${pad(day)}`);
    }
    return result;
  }, [visible]);

  const label = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(visible.year, visible.month - 1, 1)),
  );
  const canGoBack = `${visible.year}-${pad(visible.month)}-01` > today.slice(0, 8) + '01';
  const canGoForward = `${visible.year}-${pad(visible.month)}-31` < lastDay;

  const shiftMonth = (delta: number) =>
    setVisible(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });

  const navButton =
    'grid h-8 w-8 place-items-center rounded-md border border-line-strong text-ink-2 transition-colors hover:border-ink-faint hover:bg-paper active:translate-y-px disabled:pointer-events-none disabled:border-line disabled:text-ink-faint';

  return (
    <div className="w-full max-w-[360px]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium" aria-live="polite">
          {label}
        </h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!canGoBack}
            aria-label="Previous month"
            className={navButton}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canGoForward}
            aria-label="Next month"
            className={navButton}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div
        role="grid"
        aria-label={label}
        className="grid grid-cols-7 border-l border-t border-line bg-surface"
      >
        {WEEKDAYS.map((day, index) => (
          <div
            key={index}
            role="columnheader"
            className="border-b border-r border-line py-1.5 text-center text-xs text-ink-muted"
          >
            {day}
          </div>
        ))}
        {cells.map((date, index) => {
          if (!date) {
            return (
              <div
                key={`blank-${index}`}
                aria-hidden="true"
                className="border-b border-r border-line bg-paper/60"
              />
            );
          }
          const disabled = date < today || date > lastDay;
          const selected = date === value;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={disabled}
              aria-selected={selected}
              aria-label={new Intl.DateTimeFormat('en-PH', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(`${date}T00:00:00Z`))}
              onClick={() => onChange(date)}
              className={`relative aspect-square border-b border-r border-line text-left align-top font-mono text-[13px] transition-colors disabled:cursor-not-allowed disabled:bg-paper/60 disabled:text-ink-faint ${
                selected ? 'bg-pine-600 font-medium text-white' : 'text-ink hover:bg-pine-50'
              }`}
            >
              <span className="absolute left-1.5 top-1">{Number(date.slice(8))}</span>
              {date === today && !selected && (
                <span className="absolute bottom-1.5 left-1.5 h-1 w-3 bg-marigold-400" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
        <span className="h-1 w-3 bg-marigold-400" aria-hidden="true" /> Today
      </p>
    </div>
  );
}
