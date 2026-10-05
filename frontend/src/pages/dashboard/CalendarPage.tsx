import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  addDays,
  formatLocalDate,
  formatPeso,
  formatTime,
  localDateOf,
  localMinutesOf,
  todayIn,
} from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Booking, Page, StaffMember } from '@/lib/types';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Segmented, SkeletonList } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

type View = 'day' | 'week';

const HOUR_PX = 64;

function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default function CalendarPage() {
  const { slug, settings } = useDashboard();
  const timeZone = settings.timezone;
  const [view, setView] = useState<View>('day');
  const [anchor, setAnchor] = useState(() => todayIn(timeZone));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const from = anchor;
  const to = view === 'day' ? anchor : addDays(anchor, 6);
  const isToday = anchor === todayIn(timeZone);

  const staff = useQuery({
    queryKey: queryKeys.staff(slug),
    queryFn: () => api.get<StaffMember[]>(`/api/t/${slug}/staff`),
  });
  const bookings = useQuery({
    queryKey: [...queryKeys.bookings(slug), from, to],
    queryFn: () => api.get<Page<Booking>>(`/api/t/${slug}/bookings?from=${from}&to=${to}&size=100`),
  });

  const list = useMemo(() => bookings.data?.content ?? [], [bookings.data]);
  const members = (staff.data ?? []).filter((m) => m.active);
  const selected = list.find((b) => b.id === selectedId) ?? null;
  const step = view === 'day' ? 1 : 7;

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title={view === 'day' ? formatLocalDate(anchor) : `${formatLocalDate(from)} – ${formatLocalDate(to)}`}
        actions={
          <>
            <Segmented<View>
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
              ]}
            />
            <div className="flex">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-r-none"
                aria-label={view === 'day' ? 'Previous day' : 'Previous week'}
                onClick={() => setAnchor(addDays(anchor, -step))}
              >
                ‹
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="-ml-px rounded-none"
                disabled={isToday}
                onClick={() => setAnchor(todayIn(timeZone))}
              >
                Today
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="-ml-px rounded-l-none"
                aria-label={view === 'day' ? 'Next day' : 'Next week'}
                onClick={() => setAnchor(addDays(anchor, step))}
              >
                ›
              </Button>
            </div>
          </>
        }
      />

      {bookings.isLoading || staff.isLoading ? (
        <SkeletonList rows={5} />
      ) : bookings.error || staff.error ? (
        <ErrorState error={bookings.error ?? staff.error} onRetry={() => bookings.refetch()} />
      ) : view === 'day' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr,280px]">
          <DayGrid
            date={anchor}
            members={members}
            bookings={list}
            timeZone={timeZone}
            showNow={isToday}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <BookingDetail
            booking={selected}
            slug={slug}
            timeZone={timeZone}
            onClose={() => setSelectedId(null)}
          />
        </div>
      ) : (
        <WeekAgenda
          from={from}
          bookings={list}
          timeZone={timeZone}
          onOpenDay={(day) => {
            setAnchor(day);
            setView('day');
          }}
        />
      )}
    </div>
  );
}

function DayGrid({
  date,
  members,
  bookings,
  timeZone,
  showNow,
  selectedId,
  onSelect,
}: {
  date: string;
  members: StaffMember[];
  bookings: Booking[];
  timeZone: string;
  showNow: boolean;
  selectedId: string | null;
  onSelect(id: string): void;
}) {
  const weekday = isoWeekday(date);
  const [nowMinutes, setNowMinutes] = useState(() => localMinutesOf(new Date().toISOString(), timeZone));

  useEffect(() => {
    const timer = window.setInterval(
      () => setNowMinutes(localMinutesOf(new Date().toISOString(), timeZone)),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, [timeZone]);

  const ranges = members.flatMap((m) => m.workingHours.filter((h) => h.dayOfWeek === weekday));
  const bookingMinutes = bookings.flatMap((b) => [
    localMinutesOf(b.startsAt, timeZone),
    localMinutesOf(b.endsAt, timeZone),
  ]);
  const startHour = Math.min(
    8,
    ...ranges.map((r) => Math.floor(toMinutes(r.startTime) / 60)),
    ...bookingMinutes.map((m) => Math.floor(m / 60)),
  );
  const endHour = Math.max(
    19,
    ...ranges.map((r) => Math.ceil(toMinutes(r.endTime) / 60)),
    ...bookingMinutes.map((m) => Math.ceil(m / 60)),
  );
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * HOUR_PX;
  const y = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_PX;

  if (members.length === 0) {
    return <EmptyState title="No active staff">Add staff and their hours to see the day.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <div style={{ minWidth: 56 + members.length * 200 }}>
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="w-14 shrink-0" />
          {members.map((member) => {
            const count = bookings.filter((b) => b.staffId === member.id && b.status !== 'CANCELLED').length;
            return (
              <div key={member.id} className="min-w-[200px] flex-1 border-l border-line px-3 py-2.5">
                <p className="truncate text-sm font-medium">{member.fullName}</p>
                <p className="num text-xs text-ink-muted">
                  {count} {count === 1 ? 'booking' : 'bookings'}
                </p>
              </div>
            );
          })}
        </div>

        <div className="relative flex" style={{ height }}>
          <div className="relative w-14 shrink-0">
            {hours.map((hour) => (
              <span
                key={hour}
                className="num absolute right-2 -translate-y-1/2 text-2xs text-ink-faint"
                style={{ top: y(hour * 60) }}
              >
                {hour === startHour ? '' : `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`}
              </span>
            ))}
          </div>

          {members.map((member) => {
            const working = member.workingHours.filter((h) => h.dayOfWeek === weekday);
            const columnBookings = bookings.filter((b) => b.staffId === member.id);
            return (
              <div key={member.id} className="hatched relative min-w-[200px] flex-1 border-l border-line">
                {working.map((range) => (
                  <div
                    key={range.startTime}
                    className="absolute inset-x-0 bg-surface"
                    style={{
                      top: y(toMinutes(range.startTime)),
                      height: y(toMinutes(range.endTime)) - y(toMinutes(range.startTime)),
                    }}
                  />
                ))}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-x-0 border-t border-line/70"
                    style={{ top: y(hour * 60) }}
                  />
                ))}
                {columnBookings.map((booking) => {
                  const top = y(localMinutesOf(booking.startsAt, timeZone));
                  const blockHeight = Math.max(y(localMinutesOf(booking.endsAt, timeZone)) - top, 22);
                  const cancelled = booking.status === 'CANCELLED';
                  const tone =
                    booking.status === 'COMPLETED'
                      ? 'border-ink-faint bg-paper text-ink-muted'
                      : booking.status === 'NO_SHOW'
                        ? 'border-marigold-400 bg-marigold-100 text-ink'
                        : booking.status === 'PENDING_PAYMENT'
                          ? 'border-slateblue-600 bg-slateblue-50 text-ink'
                          : cancelled
                            ? 'border-line-strong bg-surface/80 text-ink-faint line-through'
                            : 'border-pine-600 bg-pine-50 text-ink';
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onSelect(booking.id)}
                      aria-pressed={selectedId === booking.id}
                      className={`absolute inset-x-1 overflow-hidden rounded-sm border-l-[3px] px-2 py-0.5 text-left text-xs transition-shadow ${tone} ${
                        cancelled ? 'z-0 opacity-70' : 'z-[1]'
                      } ${selectedId === booking.id ? 'ring-2 ring-ink ring-offset-1' : 'hover:brightness-[0.97]'}`}
                      style={{ top: top + 1, height: blockHeight - 2 }}
                    >
                      {blockHeight < 40 ? (
                        <span className="block truncate leading-[18px]">
                          <span className="num text-[11px] text-ink-muted">
                            {formatTime(booking.startsAt, timeZone)}
                          </span>{' '}
                          <span className="font-medium">{booking.customerName}</span>
                        </span>
                      ) : (
                        <>
                          <span className="num block text-[11px] text-ink-muted">
                            {formatTime(booking.startsAt, timeZone)}
                          </span>
                          <span className="block truncate font-medium">{booking.customerName}</span>
                          {blockHeight > 56 && (
                            <span className="block truncate text-ink-muted">{booking.serviceName}</span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {showNow && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 && (
            <div
              className="pointer-events-none absolute left-14 right-0 z-[2] flex items-center"
              style={{ top: y(nowMinutes) }}
            >
              <span className="-ml-1 h-2 w-2 rounded-full bg-marigold-400" />
              <span className="h-[2px] flex-1 bg-marigold-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingDetail({
  booking,
  slug,
  timeZone,
  onClose,
}: {
  booking: Booking | null;
  slug: string;
  timeZone: string;
  onClose(): void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationFn: (kind: 'complete' | 'no-show' | 'cancel') =>
      api.post<Booking>(
        `/api/t/${slug}/bookings/${booking!.id}/${kind}`,
        kind === 'cancel' ? { reason: 'Cancelled by the business' } : undefined,
      ),
    onSuccess: (updated) => {
      toast.success(`${updated.customerName}: ${updated.status.replace('_', ' ').toLowerCase()}.`);
      return queryClient.invalidateQueries({ queryKey: queryKeys.bookings(slug) });
    },
    onError: (error) => toast.error(error),
  });

  if (!booking) {
    return (
      <div className="hidden rounded-lg border border-dashed border-line-strong p-5 text-sm text-ink-muted xl:block">
        Select a booking to see the customer&apos;s details and mark it done.
      </div>
    );
  }

  const started = new Date(booking.startsAt).getTime() <= Date.now();
  return (
    <aside
      aria-label="Booking details"
      className="self-start rounded-lg border border-line bg-surface xl:sticky xl:top-6"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="num text-sm text-ink-muted">
            {formatTime(booking.startsAt, timeZone)} – {formatTime(booking.endsAt, timeZone)}
          </p>
          <p className="mt-0.5 text-lg font-medium leading-snug">{booking.customerName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-muted hover:text-ink"
          aria-label="Close details"
        >
          ×
        </button>
      </div>
      <dl className="space-y-2.5 px-5 py-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Service</dt>
          <dd className="text-right">{booking.serviceName}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">With</dt>
          <dd>{booking.staffName}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Price</dt>
          <dd className="num">{formatPeso(booking.priceCentavos)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Status</dt>
          <dd>
            <Badge value={booking.status} />
          </dd>
        </div>
        {booking.customerPhone && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Phone</dt>
            <dd>
              <a href={`tel:${booking.customerPhone}`} className="num underline underline-offset-2">
                {booking.customerPhone}
              </a>
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Email</dt>
          <dd className="truncate">{booking.customerEmail}</dd>
        </div>
        {booking.notes && (
          <div className="border-l-2 border-marigold-400 bg-marigold-100/50 px-3 py-2 text-ink-2">
            {booking.notes}
          </div>
        )}
        {booking.cancelledReason && <p className="text-ink-muted">{booking.cancelledReason}</p>}
      </dl>
      {booking.status === 'CONFIRMED' && (
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <Button
            size="sm"
            onClick={() => action.mutate('complete')}
            loading={action.isPending && action.variables === 'complete'}
          >
            Mark done
          </Button>
          {started && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => action.mutate('no-show')}
              disabled={action.isPending}
            >
              No-show
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() =>
              window.confirm('Cancel this booking? The customer will get an email.') &&
              action.mutate('cancel')
            }
            disabled={action.isPending}
          >
            Cancel
          </Button>
        </div>
      )}
    </aside>
  );
}

function WeekAgenda({
  from,
  bookings,
  timeZone,
  onOpenDay,
}: {
  from: string;
  bookings: Booking[];
  timeZone: string;
  onOpenDay(day: string): void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-7">
      {days.map((day, index) => {
        const dayBookings = bookings.filter(
          (b) => localDateOf(b.startsAt, timeZone) === day && b.status !== 'CANCELLED',
        );
        const [, , dd] = day.split('-');
        return (
          <section
            key={day}
            aria-label={formatLocalDate(day)}
            className={`min-h-[180px] ${index > 0 ? 'border-t border-line md:border-l md:border-t-0' : ''}`}
          >
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              className="flex w-full items-baseline justify-between border-b border-line px-3 py-2 text-left hover:bg-paper"
            >
              <span className="text-xs text-ink-muted">
                {new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: 'UTC' }).format(
                  new Date(`${day}T00:00:00Z`),
                )}
              </span>
              <span className="num text-lg">{Number(dd)}</span>
            </button>
            <ul className="space-y-px p-1.5">
              {dayBookings.length === 0 && <li className="px-1.5 py-1 text-xs text-ink-faint">Free</li>}
              {dayBookings.map((booking) => (
                <li key={booking.id} className="rounded-sm px-1.5 py-1 text-xs hover:bg-paper">
                  <span className="num text-ink-muted">{formatTime(booking.startsAt, timeZone)}</span>{' '}
                  <span className="text-ink">{booking.customerName}</span>
                  <span className="block truncate text-ink-faint">
                    {booking.serviceName} · {booking.staffName.split(' ')[0]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
