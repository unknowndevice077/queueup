import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, formatPeso, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Booking, Page, PaymentIntent } from '@/lib/types';
import { Badge, Button, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui';
import { useToast } from '@/components/Toaster';

export function MyBookingsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.myBookings(),
    queryFn: () => api.get<Page<Booking>>('/api/me/bookings?size=100&sort=startsAt,desc'),
  });

  const now = Date.now();
  const bookings = data?.content ?? [];
  const isUpcoming = (b: Booking) =>
    new Date(b.startsAt).getTime() > now && (b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT');
  const upcoming = bookings.filter(isUpcoming).reverse();
  const past = bookings.filter((b) => !isUpcoming(b));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader title="My bookings" description="Every appointment you've made, at every business." />
      {isLoading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="eyebrow">
              Coming up
            </h2>
            {upcoming.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="Nothing booked yet">
                  <Link to="/b/kanto-cuts" className="font-medium text-ink underline underline-offset-4">
                    Book a haircut at Kanto Cuts
                  </Link>
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {upcoming.map((booking) => (
                  <UpcomingBooking key={booking.id} booking={booking} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="past-heading" className="mt-12">
            <h2 id="past-heading" className="eyebrow">
              History
            </h2>
            {past.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No past bookings.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {past.map((booking) => (
                  <li
                    key={booking.id}
                    className="grid grid-cols-[1fr,auto] gap-x-4 gap-y-0.5 py-3 text-sm sm:grid-cols-[150px,1fr,auto]"
                  >
                    <span className="num text-ink-muted">
                      {formatDate(booking.startsAt, booking.timezone)}
                    </span>
                    <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                      {booking.serviceName} <span className="text-ink-muted">at {booking.tenantName}</span>
                    </span>
                    <span className="row-start-1 justify-self-end sm:row-start-auto">
                      <Badge value={booking.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function UpcomingBooking({ booking }: { booking: Booking }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canChange = new Date(booking.customerChangeDeadline).getTime() > Date.now();

  const cancel = useMutation({
    mutationFn: () =>
      api.post<Booking>(`/api/t/${booking.tenantSlug}/bookings/${booking.id}/cancel`, {
        reason: 'Cancelled by customer',
      }),
    onSuccess: () => {
      toast.success('Booking cancelled.');
      return queryClient.invalidateQueries({ queryKey: queryKeys.myBookings() });
    },
    onError: (error) => toast.error(error),
  });

  const pay = useMutation({
    mutationFn: () =>
      api.post<PaymentIntent>(`/api/t/${booking.tenantSlug}/bookings/${booking.id}/payment-intent`),
    onSuccess: (intent) => window.location.assign(intent.checkoutUrl),
    onError: (error) => toast.error(error),
  });

  return (
    <li className="grid overflow-hidden rounded-md border border-line bg-surface sm:grid-cols-[132px,1fr]">
      <div className="flex items-baseline gap-3 border-b border-line bg-paper/60 px-4 py-3 sm:block sm:border-b-0 sm:border-r">
        <p className="text-[13px] text-ink-muted">{formatDate(booking.startsAt, booking.timezone)}</p>
        <p className="num text-[22px] font-medium leading-tight sm:mt-1">
          {formatTime(booking.startsAt, booking.timezone)}
        </p>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{booking.serviceName}</p>
            <p className="text-sm text-ink-muted">
              {booking.tenantName} · with {booking.staffName} ·{' '}
              <span className="num">{formatPeso(booking.priceCentavos)}</span>
            </p>
          </div>
          <Badge value={booking.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {booking.status === 'PENDING_PAYMENT' && (
            <Button size="sm" loading={pay.isPending} onClick={() => pay.mutate()}>
              Pay {formatPeso(booking.depositCentavos)} deposit
            </Button>
          )}
          {canChange ? (
            <>
              <Link
                to={`/b/${booking.tenantSlug}/book?service=${booking.serviceId}&reschedule=${booking.id}`}
                className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:border-ink-faint"
              >
                Move
              </Link>
              <Button
                size="sm"
                variant="danger"
                loading={cancel.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Cancel ${booking.serviceName} on ${formatDateTime(booking.startsAt, booking.timezone)}?`,
                    )
                  ) {
                    cancel.mutate();
                  }
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <p className="text-[13px] text-ink-muted">
              Too close to change online. Call {booking.tenantName} instead.
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
