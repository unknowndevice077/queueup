/** Formatting helpers. Prices arrive as integer centavos; times are shown in the business time zone. */

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

export function formatPeso(centavos: number): string {
  return pesoFormatter.format(centavos / 100);
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone, hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timeZone: string): string {
  return `${formatDate(iso, timeZone)}, ${formatTime(iso, timeZone)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Today's calendar date (YYYY-MM-DD) in the given time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return localDateOf(now.toISOString(), timeZone);
}

/** The calendar date (YYYY-MM-DD) of an instant in the given time zone. */
export function localDateOf(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The local hour (0-23) of an instant in the given time zone. */
export function localHourOf(iso: string, timeZone: string): number {
  return (
    Number(
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(new Date(iso)),
    ) % 24
  );
}

/** Adds days to a YYYY-MM-DD date string without any time-zone drift. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return result.toISOString().slice(0, 10);
}

export function formatLocalDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function ticketLabel(ticketNumber: number): string {
  return `#${String(ticketNumber).padStart(3, '0')}`;
}

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting deposit',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
};

/** Converts a datetime-local value (wall clock in the business zone) to an ISO string with the zone's offset. */
export function zonedIso(local: string, timeZone: string): string {
  const asUtc = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(asUtc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const offsetMinutes = Math.round((wallAsUtc - asUtc.getTime()) / 60000);
  return new Date(asUtc.getTime() - offsetMinutes * 60000).toISOString();
}
