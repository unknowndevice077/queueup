import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { useToast } from '@/components/Toaster';
import { DateCalendar } from '@/components/DateCalendar';
import { SlotPicker } from '@/components/SlotPicker';
import { ANY_STAFF } from '@/lib/slots';
import { Button, Card, ErrorState, SkeletonList } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatDuration, formatLocalDate, formatPeso, todayIn } from '@/lib/format';
import { queryKeys, useAvailability, usePublicTenant } from '@/lib/queries';
import type { Booking, PaymentIntent, PublicTenant, Service } from '@/lib/types';

const STEPS = ['Service', 'Date', 'Staff', 'Time', 'Confirm'] as const;

/**
 * Booking wizard: service, date, staff (or anyone), slot, confirm. All choices live in the URL so the flow
 * survives a sign-in redirect and the back button works. With ?reschedule=<bookingId> it moves an existing booking.
 */
export function BookingFlow() {
  const { slug = '' } = useParams();
  const { data: tenant, isLoading, error, refetch } = usePublicTenant(slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <SkeletonList rows={4} />
      </div>
    );
  }
  if (error || !tenant) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState error={error ?? new Error('Business not found')} onRetry={() => refetch()} />
      </div>
    );
  }
  return <BookingWizard tenant={tenant} />;
}

function BookingWizard({ tenant }: { tenant: PublicTenant }) {
  const [params, setParams] = useSearchParams();
  const serviceId = params.get('service');
  const date = params.get('date');
  const staffId = params.get('staff');
  const start = params.get('start');
  const chosenStaff = params.get('assigned');
  const rescheduleId = params.get('reschedule');

  const service = tenant.services.find((s) => s.id === serviceId) ?? null;
  const step = !service ? 0 : !date ? 1 : !staffId ? 2 : !start ? 3 : 4;

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    setParams(next);
  };

  const goToStep = (target: number) => {
    const clear = ['service', 'date', 'staff', 'start', 'assigned'].slice(target);
    update(Object.fromEntries(clear.map((key) => [key, null])));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to={`/b/${tenant.slug}`} className="text-sm text-brand-600 underline">
        ← {tenant.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {rescheduleId ? 'Reschedule your booking' : 'Book an appointment'}
      </h1>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs font-medium" aria-label="Booking progress">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              disabled={index >= step}
              onClick={() => goToStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className={`rounded-full px-3 py-1 ${
                index === step
                  ? 'bg-brand-600 text-white'
                  : index < step
                    ? 'bg-brand-100 text-brand-800 hover:bg-brand-200'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === 0 && <ServiceStep services={tenant.services} onSelect={(id) => update({ service: id })} />}
        {step === 1 && (
          <section aria-labelledby="date-heading">
            <h2 id="date-heading" className="mb-3 text-lg font-semibold">
              Pick a date
            </h2>
            <DateCalendar
              value={date}
              today={todayIn(tenant.timezone)}
              onChange={(d) => update({ date: d })}
            />
          </section>
        )}
        {step >= 2 && service && date && (
          <AvailabilitySteps
            tenant={tenant}
            service={service}
            date={date}
            staffId={staffId}
            start={start}
            assignedStaff={chosenStaff}
            rescheduleId={rescheduleId}
            onStaff={(id) => update({ staff: id, start: null, assigned: null })}
            onSlot={(slot, assigned) => update({ start: slot, assigned })}
          />
        )}
      </div>
    </div>
  );
}

function ServiceStep({ services, onSelect }: { services: Service[]; onSelect(id: string): void }) {
  return (
    <section aria-labelledby="service-heading">
      <h2 id="service-heading" className="mb-3 text-lg font-semibold">
        Choose a service
      </h2>
      <ul className="space-y-2">
        {services.map((service) => (
          <li key={service.id}>
            <button
              type="button"
              onClick={() => onSelect(service.id)}
              className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
            >
              <span>
                <span className="block font-semibold">{service.name}</span>
                <span className="text-sm text-slate-500">{formatDuration(service.durationMinutes)}</span>
              </span>
              <span className="font-semibold">{formatPeso(service.priceCentavos)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface AvailabilityStepsProps {
  tenant: PublicTenant;
  service: Service;
  date: string;
  staffId: string | null;
  start: string | null;
  assignedStaff: string | null;
  rescheduleId: string | null;
  onStaff(id: string): void;
  onSlot(start: string, staffId: string | null): void;
}

function AvailabilitySteps(props: AvailabilityStepsProps) {
  const { tenant, service, date, staffId, start, onStaff, onSlot } = props;
  const { data: availability, isLoading, error, refetch } = useAvailability(tenant.slug, service.id, date);

  if (isLoading) {
    return <SkeletonList rows={3} />;
  }
  if (error || !availability) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  if (!staffId) {
    const totalSlots = new Set(availability.flatMap((a) => a.slots)).size;
    return (
      <section aria-labelledby="staff-heading">
        <h2 id="staff-heading" className="mb-1 text-lg font-semibold">
          Who would you like?
        </h2>
        <p className="mb-3 text-sm text-slate-600">{formatLocalDate(date)}</p>
        <ul className="space-y-2">
          <li>
            <StaffOption
              name="Any available"
              detail={`${totalSlots} open times`}
              onClick={() => onStaff(ANY_STAFF)}
            />
          </li>
          {availability.map((a) => (
            <li key={a.staffId}>
              <StaffOption
                name={a.staffName}
                detail={a.slots.length === 0 ? 'Fully booked' : `${a.slots.length} open times`}
                disabled={a.slots.length === 0}
                onClick={() => onStaff(a.staffId)}
              />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!start) {
    return (
      <section aria-labelledby="time-heading">
        <h2 id="time-heading" className="mb-1 text-lg font-semibold">
          Pick a time
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          {formatLocalDate(date)} ·{' '}
          {staffId === ANY_STAFF ? 'Any available' : staffNameOf(availability, staffId)}
        </p>
        <SlotPicker
          availability={availability}
          staffId={staffId}
          timeZone={tenant.timezone}
          selected={start}
          onSelect={onSlot}
        />
      </section>
    );
  }

  return <ConfirmStep {...props} staffName={staffNameOf(availability, props.assignedStaff ?? staffId)} />;
}

function staffNameOf(availability: { staffId: string; staffName: string }[], staffId: string) {
  return availability.find((a) => a.staffId === staffId)?.staffName ?? 'Any available';
}

function StaffOption({
  name,
  detail,
  disabled,
  onClick,
}: {
  name: string;
  detail: string;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand-500 disabled:opacity-50"
    >
      <span className="font-semibold">{name}</span>
      <span className="text-sm text-slate-500">{detail}</span>
    </button>
  );
}

function ConfirmStep({
  tenant,
  service,
  start,
  assignedStaff,
  rescheduleId,
  staffName,
}: AvailabilityStepsProps & { staffName: string }) {
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const deposit = tenant.depositRequired
    ? Math.round((service.priceCentavos * tenant.depositPercent) / 100)
    : 0;

  const confirm = async () => {
    setSubmitting(true);
    try {
      const body = {
        serviceId: service.id,
        staffId: assignedStaff ?? undefined,
        startsAt: start,
        notes: notes || undefined,
      };
      const booking = rescheduleId
        ? await api.post<Booking>(`/api/t/${tenant.slug}/bookings/${rescheduleId}/reschedule`, {
            startsAt: start,
            staffId: assignedStaff ?? undefined,
          })
        : await api.post<Booking>(`/api/t/${tenant.slug}/bookings`, body);
      await queryClient.invalidateQueries({ queryKey: ['availability', tenant.slug] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myBookings() });
      if (booking.status === 'PENDING_PAYMENT') {
        await payDeposit(booking);
        return;
      }
      navigate(`/b/${tenant.slug}/book/success?bookingId=${booking.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('Sorry, that time was just taken. Please pick another.');
        await queryClient.invalidateQueries({ queryKey: ['availability', tenant.slug] });
        const next = new URLSearchParams(location.search);
        next.delete('start');
        next.delete('assigned');
        navigate({ search: next.toString() }, { replace: true });
      } else {
        toast.error(error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const payDeposit = async (booking: Booking) => {
    try {
      const intent = await api.post<PaymentIntent>(
        `/api/t/${tenant.slug}/bookings/${booking.id}/payment-intent`,
      );
      window.location.assign(intent.checkoutUrl);
    } catch (error) {
      toast.error(error);
      navigate(`/b/${tenant.slug}/book/success?bookingId=${booking.id}`, { replace: true });
    }
  };

  return (
    <section aria-labelledby="confirm-heading">
      <h2 id="confirm-heading" className="mb-3 text-lg font-semibold">
        Confirm your booking
      </h2>
      <Card>
        <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-500">Service</dt>
          <dd className="font-medium">{service.name}</dd>
          <dt className="text-slate-500">When</dt>
          <dd className="font-medium">{start && formatDateTime(start, tenant.timezone)}</dd>
          <dt className="text-slate-500">With</dt>
          <dd className="font-medium">{staffName}</dd>
          <dt className="text-slate-500">Price</dt>
          <dd className="font-medium">{formatPeso(service.priceCentavos)}</dd>
          {deposit > 0 && !rescheduleId && (
            <>
              <dt className="text-slate-500">Deposit now</dt>
              <dd className="font-medium">{formatPeso(deposit)}</dd>
            </>
          )}
        </dl>
        {!rescheduleId && (
          <div className="mt-4">
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
              Notes for the business (optional)
            </label>
            <textarea
              id="notes"
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              rows={2}
            />
          </div>
        )}
        <div className="mt-5">
          {status === 'authenticated' ? (
            <Button size="lg" className="w-full sm:w-auto" loading={submitting} onClick={confirm}>
              {rescheduleId ? 'Move my booking' : deposit > 0 ? 'Confirm and pay deposit' : 'Confirm booking'}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
                className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
              >
                Sign in to confirm
              </Link>
              <Link
                to={`/register?next=${encodeURIComponent(location.pathname + location.search)}`}
                className="text-sm font-medium text-brand-600 underline"
              >
                or create an account
              </Link>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
