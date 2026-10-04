import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BOOKING_STATUS_LABEL, formatDateTime, formatPeso } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { Badge, Card, ErrorState, SkeletonList } from '@/components/ui';

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
      <div className="mx-auto max-w-xl px-4 py-12">
        <SkeletonList rows={2} />
      </div>
    );
  }
  if (error || !booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <ErrorState error={error ?? new Error('Booking not found')} />
      </div>
    );
  }

  const confirmed = booking.status === 'CONFIRMED';
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="text-center">
        <div
          aria-hidden="true"
          className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl ${
            confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {confirmed ? '✓' : '…'}
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {confirmed
            ? "You're booked!"
            : paymentCancelled
              ? 'Payment was not completed'
              : 'Waiting for your deposit'}
        </h1>
        <p className="mt-2 text-slate-600">
          {confirmed
            ? 'A confirmation email is on its way.'
            : paymentCancelled
              ? 'Your slot is held for 15 minutes. You can retry from My bookings.'
              : 'We will confirm as soon as PayMongo tells us the payment went through.'}
        </p>
      </div>
      <Card className="mt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{booking.serviceName}</p>
            <p className="text-sm text-slate-600">
              {formatDateTime(booking.startsAt, booking.timezone)} · {booking.staffName}
            </p>
            <p className="mt-1 text-sm text-slate-600">{booking.tenantName}</p>
          </div>
          <Badge value={booking.status} label={BOOKING_STATUS_LABEL[booking.status]} />
        </div>
        <p className="mt-3 text-sm">
          {formatPeso(booking.priceCentavos)}
          {booking.depositCentavos > 0 && ` (deposit ${formatPeso(booking.depositCentavos)})`}
        </p>
      </Card>
      <div className="mt-6 flex justify-center gap-4 text-sm font-medium">
        <Link to="/my/bookings" className="text-brand-600 underline">
          View my bookings
        </Link>
        <Link to={`/b/${slug}`} className="text-slate-600 underline">
          Back to {booking.tenantName}
        </Link>
      </div>
    </div>
  );
}
