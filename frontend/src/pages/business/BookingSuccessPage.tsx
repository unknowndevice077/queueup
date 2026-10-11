import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatDuration, formatPeso, formatTime } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { Badge, ErrorState, SkeletonList } from '@/components/ui';

export function BookingSuccessPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const bookingId = params.get('bookingId');
  const paymentCancelled = params.get('cancelled') === '1';

  const {
    data: booking,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['booking', slug, bookingId],
    queryFn: () => api.get<Booking>(`/api/t/${slug}/bookings/${bookingId}`),
    enabled: Boolean(bookingId),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING_PAYMENT' && !paymentCancelled ? 2000 : false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <SkeletonList rows={3} />
      </div>
    );
  }
  if (error || !booking) {
    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <ErrorState error={error ?? new Error('Booking not found')} />
      </div>
    );
  }

  const confirmed = booking.status === 'CONFIRMED';
  const heading = confirmed
    ? "You're booked."
    : paymentCancelled
      ? 'Payment not completed'
      : 'Waiting for your deposit';
  const message = confirmed
    ? `We sent the details to ${booking.customerEmail}.`
    : paymentCancelled
      ? 'Your time is held for 15 minutes. You can pay from My bookings.'
      : 'This page updates by itself once PayMongo confirms the payment.';

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-[28px] font-semibold tracking-[-0.015em]">{heading}</h1>
      <p className="mt-1.5 text-ink-2">{message}</p>

      <div className="ticket mt-8 animate-ticket-print rounded-md">
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <div>
            <p className="text-sm text-ink-muted">{booking.tenantName}</p>
            <p className="mt-2 text-lg font-medium">{booking.serviceName}</p>
            <p className="text-sm text-ink-muted">with {booking.staffName}</p>
          </div>
          <Badge value={booking.status} />
        </div>
        <div className="ticket-tear" />
        <div className="grid grid-cols-2 gap-px bg-line">
          <div className="bg-surface px-5 py-4">
            <p className="text-xs text-ink-muted">Date</p>
            <p className="mt-1 text-[15px]">{formatDate(booking.startsAt, booking.timezone)}</p>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="text-xs text-ink-muted">Time</p>
            <p className="num mt-1 text-[22px] font-medium leading-tight">
              {formatTime(booking.startsAt, booking.timezone)}
            </p>
          </div>
        </div>
        <div className="ticket-tear" />
        <dl className="space-y-1.5 px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">{formatDuration(booking.durationMinutes)}</dt>
            <dd className="num">{formatPeso(booking.priceCentavos)}</dd>
          </div>
          {booking.depositCentavos > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Deposit</dt>
              <dd className="num">{formatPeso(booking.depositCentavos)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-muted">Reference</dt>
            <dd className="num uppercase">{booking.id.slice(0, 8)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link to="/my/bookings" className="font-medium text-ink underline underline-offset-4">
          View my bookings
        </Link>
        <Link to={`/b/${slug}`} className="text-ink-muted underline underline-offset-4 hover:text-ink">
          Back to {booking.tenantName}
        </Link>
      </div>
    </div>
  );
}
