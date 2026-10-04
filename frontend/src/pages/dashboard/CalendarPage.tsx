import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { addDays, formatLocalDate, formatPeso, formatTime, localDateOf, todayIn } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Booking, Page, StaffMember } from '@/lib/types';
import { Badge, Button, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

type View = 'day' | 'week';

export default function CalendarPage() {
  const { slug, settings } = useDashboard();
  const timeZone = settings.timezone;
  const [view, setView] = useState<View>('day');
  const [anchor, setAnchor] = useState(() => todayIn(timeZone));
  const from = anchor;
  const to = view === 'day' ? anchor : addDays(anchor, 6);

  const staff = useQuery({
    queryKey: queryKeys.staff(slug),
    queryFn: () => api.get<StaffMember[]>(`/api/t/${slug}/staff`),
  });
  const bookings = useQuery({
    queryKey: [...queryKeys.bookings(slug), from, to],
    queryFn: () => api.get<Page<Booking>>(`/api/t/${slug}/bookings?from=${from}&to=${to}&size=100`),
  });

  const list = bookings.data?.content ?? [];
  const members = (staff.data ?? []).filter((m) => m.active);

  return (
    <div>
      <PageHeader
        title="Calendar"
        description={
          view === 'day' ? formatLocalDate(anchor) : `${formatLocalDate(from)} – ${formatLocalDate(to)}`
        }
        actions={
          <>
            <div
              role="group"
              aria-label="View"
              className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200"
            >
              {(['day', 'week'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${
                    view === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAnchor(addDays(anchor, view === 'day' ? -1 : -7))}
            >
              ‹ Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAnchor(todayIn(timeZone))}>
              Today
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAnchor(addDays(anchor, view === 'day' ? 1 : 7))}
            >
              Next ›
            </Button>
          </>
        }
      />
      {bookings.isLoading || staff.isLoading ? (
        <SkeletonList rows={4} />
      ) : bookings.error || staff.error ? (
        <ErrorState error={bookings.error ?? staff.error} onRetry={() => bookings.refetch()} />
      ) : view === 'day' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <Column
              key={member.id}
              title={member.fullName}
              bookings={list.filter((b) => b.staffId === member.id)}
              slug={slug}
              timeZone={timeZone}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((day) => (
            <div key={day} className="w-72 shrink-0">
              <Column
                title={formatLocalDate(day)}
                bookings={list.filter((b) => localDateOf(b.startsAt, timeZone) === day)}
                slug={slug}
                timeZone={timeZone}
                showStaff
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  bookings,
  slug,
  timeZone,
  showStaff = false,
}: {
  title: string;
  bookings: Booking[];
  slug: string;
  timeZone: string;
  showStaff?: boolean;
}) {
  return (
    <section aria-label={title} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 px-1 font-semibold">{title}</h2>
      {bookings.length === 0 ? (
        <EmptyState title="No bookings" />
      ) : (
        <ul className="space-y-2">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              slug={slug}
              timeZone={timeZone}
              showStaff={showStaff}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingCard({
  booking,
  slug,
  timeZone,
  showStaff,
}: {
  booking: Booking;
  slug: string;
  timeZone: string;
  showStaff: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationFn: (kind: 'complete' | 'no-show' | 'cancel') =>
      api.post<Booking>(
        `/api/t/${slug}/bookings/${booking.id}/${kind}`,
        kind === 'cancel' ? { reason: 'Cancelled by the business' } : undefined,
      ),
    onSuccess: (updated) => {
      toast.success(`Booking marked ${updated.status.replace('_', ' ').toLowerCase()}.`);
      return queryClient.invalidateQueries({ queryKey: queryKeys.bookings(slug) });
    },
    onError: (error) => toast.error(error),
  });
  const started = new Date(booking.startsAt).getTime() <= Date.now();
  const cancelled = booking.status === 'CANCELLED';

  return (
    <li
      className={`rounded-lg border p-3 text-sm ${cancelled ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold tabular-nums">
            {formatTime(booking.startsAt, timeZone)} – {formatTime(booking.endsAt, timeZone)}
          </p>
          <p>{booking.serviceName}</p>
          <p className="text-slate-600">
            {booking.customerName}
            {booking.customerPhone && ` · ${booking.customerPhone}`}
          </p>
          {showStaff && <p className="text-slate-500">with {booking.staffName}</p>}
          {booking.notes && <p className="mt-1 italic text-slate-500">“{booking.notes}”</p>}
          <p className="text-slate-500">{formatPeso(booking.priceCentavos)}</p>
        </div>
        <Badge value={booking.status} />
      </div>
      {booking.status === 'CONFIRMED' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => action.mutate('complete')} disabled={action.isPending}>
            Complete
          </Button>
          {started && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => action.mutate('no-show')}
              disabled={action.isPending}
            >
              No-show
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              window.confirm('Cancel this booking? The customer will be emailed.') && action.mutate('cancel')
            }
            disabled={action.isPending}
          >
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}
