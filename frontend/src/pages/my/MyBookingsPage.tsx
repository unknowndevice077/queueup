import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BOOKING_STATUS_LABEL, formatDateTime, formatPeso } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Booking, Page, PaymentIntent } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui';
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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="My bookings"
        description="Upcoming appointments and your history across every business."
      />
      {isLoading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <div className="mt-3 space-y-3">
            {upcoming.length === 0 ? (
              <EmptyState title="No upcoming bookings">
                <Link to="/b/kanto-cuts" className="font-medium text-brand-600 underline">
                  Book something
                </Link>
              </EmptyState>
            ) : (
              upcoming.map((booking) => <BookingRow key={booking.id} booking={booking} upcoming />)
            )}
          </div>
          <h2 className="mt-10 text-lg font-semibold">Past and cancelled</h2>
          <div className="mt-3 space-y-3">
            {past.length === 0 ? (
              <EmptyState title="Nothing here yet" />
            ) : (
              past.map((booking) => <BookingRow key={booking.id} booking={booking} upcoming={false} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BookingRow({ booking, upcoming }: { booking: Booking; upcoming: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canChange = upcoming && new Date(booking.customerChangeDeadline).getTime() > Date.now();

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
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">
            {booking.serviceName} <span className="font-normal text-slate-500">at</span> {booking.tenantName}
          </p>
          <p className="text-sm text-slate-600">
            {formatDateTime(booking.startsAt, booking.timezone)} · {booking.staffName}
          </p>
          <p className="mt-1 text-sm text-slate-600">{formatPeso(booking.priceCentavos)}</p>
          {booking.cancelledReason && (
            <p className="mt-1 text-sm text-slate-500">{booking.cancelledReason}</p>
          )}
        </div>
        <Badge value={booking.status} label={BOOKING_STATUS_LABEL[booking.status]} />
      </div>
      {upcoming && (
        <div className="mt-4 flex flex-wrap gap-2">
          {booking.status === 'PENDING_PAYMENT' && (
            <Button size="sm" loading={pay.isPending} onClick={() => pay.mutate()}>
              Pay deposit ({formatPeso(booking.depositCentavos)})
            </Button>
          )}
          {canChange ? (
            <>
              <Link
                to={`/b/${booking.tenantSlug}/book?service=${booking.serviceId}&reschedule=${booking.id}`}
                className="rounded-lg bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              >
                Reschedule
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
            <p className="text-sm text-slate-500">
              Changes closed {formatDateTime(booking.customerChangeDeadline, booking.timezone)}. Contact the
              business.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
