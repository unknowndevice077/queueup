import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { useToast } from '@/components/Toaster';
import { DateCalendar } from '@/components/DateCalendar';
import { SlotPicker } from '@/components/SlotPicker';
import { Button, ErrorState, SkeletonList, TextArea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { ANY_STAFF } from '@/lib/slots';
import { formatDuration, formatLocalDate, formatPeso, formatTime, todayIn } from '@/lib/format';
import { queryKeys, useAvailability, usePublicTenant } from '@/lib/queries';
import type { Booking, PaymentIntent, PublicTenant, Service, StaffAvailability } from '@/lib/types';

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
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <SkeletonList rows={4} />
      </div>
    );
  }
  if (error || !tenant) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
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
  const assignedStaff = params.get('assigned');
  const rescheduleId = params.get('reschedule');

  const service = tenant.services.find((s) => s.id === serviceId) ?? null;
  const step = !service ? 0 : !date ? 1 : !staffId ? 2 : !start ? 3 : 4;
  const { data: availability } = useAvailability(tenant.slug, service?.id ?? null, date);

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

  const staffLabel =
    staffId === null
      ? null
      : staffId === ANY_STAFF && !assignedStaff
        ? 'Anyone available'
        : staffNameOf(availability, assignedStaff ?? staffId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link to={`/b/${tenant.slug}`} className="text-sm text-ink-muted hover:text-ink">
        ← {tenant.name}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-[-0.015em]">
          {rescheduleId ? 'Move your booking' : 'Book an appointment'}
        </h1>
        <p className="num text-sm text-ink-muted">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Booking progress">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              disabled={index >= step}
              onClick={() => goToStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className="group w-full text-left disabled:cursor-default"
            >
              <span
                className={`block h-1 rounded-full ${
                  index < step ? 'bg-pine-600 group-hover:bg-pine-700' : index === step ? 'bg-ink' : 'bg-line'
                }`}
              />
              <span
                className={`mt-1.5 hidden text-xs sm:block ${index === step ? 'font-medium text-ink' : 'text-ink-muted'}`}
              >
                {index + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr,300px]">
        <div className="min-w-0">
          {step === 0 && (
            <ServiceStep services={tenant.services} onSelect={(id) => update({ service: id })} />
          )}
          {step === 1 && (
            <StepSection id="date" title="Pick a date">
              <DateCalendar
                value={date}
                today={todayIn(tenant.timezone)}
                onChange={(d) => update({ date: d })}
              />
            </StepSection>
          )}
          {step >= 2 && service && date && (
            <AvailabilitySteps
              tenant={tenant}
              service={service}
              date={date}
              staffId={staffId}
              start={start}
              assignedStaff={assignedStaff}
              rescheduleId={rescheduleId}
              staffName={staffLabel ?? ''}
              onStaff={(id) => update({ staff: id, start: null, assigned: null })}
              onSlot={(slot, assigned) => update({ start: slot, assigned })}
            />
          )}
        </div>

        {service && step < 4 && (
          <p className="order-first -mt-2 flex items-baseline justify-between gap-3 border-y border-line py-2.5 text-sm lg:hidden">
            <span className="min-w-0 truncate">
              {service.name}
              {date && <span className="text-ink-muted"> · {formatLocalDate(date)}</span>}
            </span>
            <span className="num shrink-0">{formatPeso(service.priceCentavos)}</span>
          </p>
        )}

        <aside aria-label="Your booking" className="hidden lg:block">
          <div className="ticket rounded-md lg:sticky lg:top-6">
            <div className="px-4 py-3">
              <p className="eyebrow">{tenant.name}</p>
            </div>
            <div className="ticket-tear" />
            <dl className="divide-y divide-line text-sm">
              <SummaryRow
                label="Service"
                value={service?.name}
                onChange={step > 0 ? () => goToStep(0) : undefined}
              />
              <SummaryRow
                label="Date"
                value={date ? formatLocalDate(date) : undefined}
                onChange={step > 1 ? () => goToStep(1) : undefined}
              />
              <SummaryRow
                label="With"
                value={staffLabel ?? undefined}
                onChange={step > 2 ? () => goToStep(2) : undefined}
              />
              <SummaryRow
                label="Time"
                value={start ? formatTime(start, tenant.timezone) : undefined}
                mono
                onChange={step > 3 ? () => goToStep(3) : undefined}
              />
            </dl>
            {service && (
              <>
                <div className="ticket-tear" />
                <div className="flex items-baseline justify-between px-4 py-3">
                  <span className="text-sm text-ink-muted">{formatDuration(service.durationMinutes)}</span>
                  <span className="num text-[17px] font-medium">{formatPeso(service.priceCentavos)}</span>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
  onChange,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  onChange?: () => void;
}) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2.5">
      <dt className="w-14 shrink-0 text-xs text-ink-muted">{label}</dt>
      <dd className={`min-w-0 flex-1 truncate ${value ? 'text-ink' : 'text-ink-faint'} ${mono ? 'num' : ''}`}>
        {value ?? '—'}
      </dd>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          Change<span className="sr-only"> {label.toLowerCase()}</span>
        </button>
      )}
    </div>
  );
}

function StepSection({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-lg font-semibold">
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ServiceStep({ services, onSelect }: { services: Service[]; onSelect(id: string): void }) {
  return (
    <StepSection id="service" title="Choose a service">
      <ul className="border-t border-line">
        {services.map((service) => (
          <li key={service.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => onSelect(service.id)}
              className="group flex w-full items-baseline gap-2 py-4 text-left"
            >
              <span>
                <span className="block font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                  {service.name}
                </span>
                <span className="num text-[13px] text-ink-muted">
                  {formatDuration(service.durationMinutes)}
                </span>
              </span>
              <span className="leader self-center" aria-hidden="true" />
              <span className="num text-ink">{formatPeso(service.priceCentavos)}</span>
            </button>
          </li>
        ))}
      </ul>
    </StepSection>
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
  staffName: string;
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
      <StepSection id="staff" title="Who would you like?" subtitle={formatLocalDate(date)}>
        <ul className="border-t border-line">
          <li className="border-b border-line">
            <StaffOption
              name="Any available"
              detail={`${totalSlots} open times`}
              onClick={() => onStaff(ANY_STAFF)}
            />
          </li>
          {availability.map((a) => (
            <li key={a.staffId} className="border-b border-line">
              <StaffOption
                name={a.staffName}
                detail={a.slots.length === 0 ? 'Fully booked' : `${a.slots.length} open times`}
                disabled={a.slots.length === 0}
                onClick={() => onStaff(a.staffId)}
              />
            </li>
          ))}
        </ul>
      </StepSection>
    );
  }

  if (!start) {
    return (
      <StepSection
        id="time"
        title="Pick a time"
        subtitle={`${formatLocalDate(date)} · ${staffId === ANY_STAFF ? 'Anyone available' : staffNameOf(availability, staffId)}`}
      >
        <SlotPicker
          availability={availability}
          staffId={staffId}
          timeZone={tenant.timezone}
          selected={start}
          onSelect={onSlot}
        />
      </StepSection>
    );
  }

  return <ConfirmStep {...props} />;
}

function staffNameOf(availability: StaffAvailability[] | undefined, staffId: string) {
  return availability?.find((a) => a.staffId === staffId)?.staffName ?? 'Anyone available';
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
      className="group flex w-full items-center justify-between gap-4 py-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="font-medium group-enabled:group-hover:underline group-enabled:group-hover:underline-offset-4">
        {name}
      </span>
      <span className="num text-[13px] text-ink-muted">{detail}</span>
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
}: AvailabilityStepsProps) {
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
      const booking = rescheduleId
        ? await api.post<Booking>(`/api/t/${tenant.slug}/bookings/${rescheduleId}/reschedule`, {
            startsAt: start,
            staffId: assignedStaff ?? undefined,
          })
        : await api.post<Booking>(`/api/t/${tenant.slug}/bookings`, {
            serviceId: service.id,
            staffId: assignedStaff ?? undefined,
            startsAt: start,
            notes: notes || undefined,
          });
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

  const nextUrl = encodeURIComponent(location.pathname + location.search);

  return (
    <section aria-labelledby="confirm-heading">
      <h2 id="confirm-heading" className="text-lg font-semibold">
        Confirm your booking
      </h2>
      <dl className="mt-5 grid grid-cols-[110px,1fr] border-t border-line text-[15px]">
        <dt className="border-b border-line py-3 text-sm text-ink-muted">Service</dt>
        <dd className="border-b border-line py-3">{service.name}</dd>
        <dt className="border-b border-line py-3 text-sm text-ink-muted">When</dt>
        <dd className="border-b border-line py-3">
          {start && (
            <>
              {formatLocalDate(start.slice(0, 10))},{' '}
              <span className="num">{formatTime(start, tenant.timezone)}</span>
            </>
          )}
        </dd>
        <dt className="border-b border-line py-3 text-sm text-ink-muted">With</dt>
        <dd className="border-b border-line py-3">{staffName}</dd>
        <dt className="border-b border-line py-3 text-sm text-ink-muted">Price</dt>
        <dd className="num border-b border-line py-3">{formatPeso(service.priceCentavos)}</dd>
        {deposit > 0 && !rescheduleId && (
          <>
            <dt className="border-b border-line py-3 text-sm text-ink-muted">Pay now</dt>
            <dd className="border-b border-line py-3">
              <span className="num">{formatPeso(deposit)}</span>{' '}
              <span className="text-sm text-ink-muted">deposit, rest at the counter</span>
            </dd>
          </>
        )}
      </dl>

      {!rescheduleId && (
        <TextArea
          className="mt-5"
          label="Notes for the business (optional)"
          id="notes"
          maxLength={500}
          rows={2}
          placeholder="e.g. low fade, sensitive teeth"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      )}

      <p className="mt-4 text-[13px] text-ink-muted">
        You can cancel or move this booking for free until {tenant.cancellationWindowHours} hours before.
      </p>

      <div className="mt-6">
        {status === 'authenticated' ? (
          <Button size="lg" className="w-full sm:w-auto" loading={submitting} onClick={confirm}>
            {rescheduleId ? 'Move my booking' : deposit > 0 ? 'Confirm and pay deposit' : 'Confirm booking'}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/login?next=${nextUrl}`}
              className="inline-flex h-12 items-center rounded-md bg-pine-600 px-5 font-medium text-white hover:bg-pine-700"
            >
              Sign in to confirm
            </Link>
            <Link
              to={`/register?next=${nextUrl}`}
              className="text-sm text-ink-2 underline underline-offset-4"
            >
              or create an account
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
