import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { useToast } from '@/components/Toaster';
import { DateCalendar } from '@/components/DateCalendar';
import { SlotPicker } from '@/components/SlotPicker';
import { Calendar, ChevronDown, ChevronRight } from '@/components/icons';
import {
  Avatar,
  BackLink,
  Button,
  buttonClass,
  ErrorState,
  Skeleton,
  SkeletonList,
  TextArea,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { ANY_STAFF, slotOptions } from '@/lib/slots';
import {
  addDays,
  formatDuration,
  formatLocalDate,
  formatPeso,
  formatTime,
  shortName,
  todayIn,
} from '@/lib/format';
import { queryKeys, useAvailability, usePublicTenant } from '@/lib/queries';
import type { Booking, PaymentIntent, PublicTenant, Service, StaffAvailability } from '@/lib/types';

const STEPS = ['Service', 'Date and time', 'Confirm'] as const;
const STRIP_DAYS = 14;

/** "Tuesday, October 13": the accessible name for a day, shared by the strip and the month grid. */
function dayLabel(date: string) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function shortDay(date: string, part: 'weekday' | 'month') {
  return new Intl.DateTimeFormat('en-PH', { [part]: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/**
 * Booking wizard in three steps: service, then date + staff + time on one screen, then confirm. All choices live
 * in the URL so the flow survives a sign-in redirect and the back button works. With ?reschedule=<bookingId> it
 * moves an existing booking.
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
  const today = todayIn(tenant.timezone);
  const serviceId = params.get('service');
  const date = params.get('date') ?? today;
  const staffId = params.get('staff') ?? ANY_STAFF;
  const start = params.get('start');
  const assignedStaff = params.get('assigned');
  const reviewing = params.get('review') === '1';
  const rescheduleId = params.get('reschedule');

  const service = tenant.services.find((s) => s.id === serviceId) ?? null;
  const step = !service ? 0 : start && reviewing ? 2 : 1;
  const availability = useAvailability(tenant.slug, service?.id ?? null, service ? date : null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    setParams(next);
  };

  const goToStep = (target: number) => {
    if (target === 0) {
      update({ service: null, date: null, staff: null, start: null, assigned: null, review: null });
    } else {
      update({ review: null });
    }
  };

  // Bring the top of the wizard back into view when the step changes on a long page.
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.scrollY > 120) {
      topRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [step]);

  const staffLabel =
    staffId === ANY_STAFF && !assignedStaff
      ? 'Anyone available'
      : staffNameOf(availability.data, assignedStaff ?? staffId, tenant);
  const timeLabel = start ? formatTime(start, tenant.timezone) : null;

  return (
    <div ref={topRef} className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:pb-16">
      <BackLink to={`/b/${tenant.slug}`}>{tenant.name}</BackLink>
      <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.015em]">
        {rescheduleId ? 'Move your booking' : 'Book an appointment'}
      </h1>

      <ol className="mt-5 grid grid-cols-3 gap-1.5" aria-label="Booking progress">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              disabled={index >= step || (index === 0 && Boolean(rescheduleId))}
              onClick={() => goToStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className="group w-full text-left disabled:cursor-default"
            >
              <span className="block h-1 overflow-hidden rounded-full bg-line">
                <span
                  className={`block h-full origin-left rounded-full transition-transform duration-500 ease-out ${
                    index < step
                      ? 'scale-x-100 bg-pine-600 group-hover:bg-pine-700'
                      : index === step
                        ? 'scale-x-100 bg-ink'
                        : 'scale-x-0 bg-ink'
                  }`}
                />
              </span>
              <span
                className={`mt-1.5 block text-xs ${
                  index === step
                    ? 'font-medium text-ink'
                    : index < step
                      ? 'text-ink-2 group-hover:text-ink group-hover:underline group-hover:underline-offset-2'
                      : 'text-ink-faint'
                }`}
              >
                <span className="sm:hidden">{index === step ? label : ' '}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr,300px]">
        <div key={step} className="min-w-0 animate-fade-in">
          {step === 0 && (
            <ServiceStep services={tenant.services} onSelect={(id) => update({ service: id })} />
          )}
          {step === 1 && service && (
            <WhenStep
              tenant={tenant}
              today={today}
              date={date}
              staffId={staffId}
              start={start}
              availability={availability}
              onDate={(d) => update({ date: d, start: null, assigned: null })}
              onStaff={(id) => update({ staff: id === ANY_STAFF ? null : id, start: null, assigned: null })}
              onSlot={(slot, assigned) => update({ start: slot, assigned })}
            />
          )}
          {step === 2 && service && start && (
            <ConfirmStep
              tenant={tenant}
              service={service}
              start={start}
              assignedStaff={assignedStaff}
              rescheduleId={rescheduleId}
              staffName={staffLabel}
            />
          )}
        </div>

        <aside aria-label="Your booking" className="hidden lg:block">
          <div className="ticket rounded-md lg:sticky lg:top-20">
            <div className="px-4 py-3">
              <p className="text-sm font-medium text-ink">{tenant.name}</p>
            </div>
            <div className="ticket-tear" />
            <dl className="divide-y divide-line text-sm">
              <SummaryRow
                label="Service"
                value={service?.name}
                onChange={step > 0 && !rescheduleId ? () => goToStep(0) : undefined}
              />
              <SummaryRow
                label="Date"
                value={service ? formatLocalDate(date) : undefined}
                onChange={step > 1 ? () => goToStep(1) : undefined}
              />
              <SummaryRow
                label="With"
                value={service ? staffLabel : undefined}
                onChange={step > 1 ? () => goToStep(1) : undefined}
              />
              <SummaryRow
                label="Time"
                value={timeLabel ?? undefined}
                mono
                onChange={step > 1 ? () => goToStep(1) : undefined}
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
            {step === 1 && (
              <div className="border-t border-line p-3">
                <Button className="w-full" disabled={!start} onClick={() => update({ review: '1' })}>
                  {start ? 'Continue' : 'Pick a time to continue'}
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {step === 1 && start && service && (
        <div className="fixed inset-x-0 bottom-0 z-20 animate-bar-up border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="num font-medium">{timeLabel}</p>
              <p className="truncate text-ink-muted">
                {formatLocalDate(date)}, {service.name}
              </p>
            </div>
            <Button size="lg" onClick={() => update({ review: '1' })}>
              Continue
            </Button>
          </div>
        </div>
      )}
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
      <dd
        key={value}
        className={`min-w-0 flex-1 truncate ${value ? 'animate-fade-in text-ink' : 'text-ink-faint'} ${mono ? 'num' : ''}`}
      >
        {value ?? '—'}
      </dd>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          className="rounded text-xs text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
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
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-lg font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
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
              className="group -mx-3 flex w-[calc(100%+24px)] items-center gap-3 rounded-md px-3 py-4 text-left transition-colors duration-150 hover:bg-surface active:bg-pine-50"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline">
                  <span className="font-medium text-ink">{service.name}</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="num text-ink">{formatPeso(service.priceCentavos)}</span>
                </span>
                <span className="mt-0.5 block text-[13px] text-ink-muted">
                  {formatDuration(service.durationMinutes)}
                  {service.description && <>. {service.description}</>}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-faint transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-ink" />
            </button>
          </li>
        ))}
      </ul>
    </StepSection>
  );
}

function WhenStep({
  tenant,
  today,
  date,
  staffId,
  start,
  availability,
  onDate,
  onStaff,
  onSlot,
}: {
  tenant: PublicTenant;
  today: string;
  date: string;
  staffId: string;
  start: string | null;
  availability: ReturnType<typeof useAvailability>;
  onDate(date: string): void;
  onStaff(id: string): void;
  onSlot(start: string, staffId: string | null): void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { data, isLoading, isPlaceholderData, error, refetch } = availability;
  const tomorrow = addDays(date, 1);

  const pickDate = (d: string) => {
    setCalendarOpen(false);
    onDate(d);
  };

  return (
    <StepSection
      id="time"
      title="Pick a time"
      aside={<p className="text-sm text-ink-muted">{tenant.timezone.replace('_', ' ')} time</p>}
    >
      <DateStrip
        today={today}
        value={date}
        onChange={pickDate}
        calendarOpen={calendarOpen}
        onToggleCalendar={() => setCalendarOpen((open) => !open)}
      />
      {calendarOpen && (
        <div className="mt-3 animate-fade-in rounded-lg border border-line bg-surface p-4">
          <DateCalendar value={date} today={today} onChange={pickDate} />
        </div>
      )}

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-6" role="status" aria-label="Loading times">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-32 rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          </div>
        ) : error || !data ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <div
            className={`transition-opacity duration-150 ${isPlaceholderData ? 'pointer-events-none opacity-40' : ''}`}
            aria-busy={isPlaceholderData || undefined}
          >
            <StaffChips availability={data} value={staffId} onChange={onStaff} />
            <div className="mt-6">
              <SlotPicker
                availability={data}
                staffId={staffId}
                timeZone={tenant.timezone}
                selected={start}
                onSelect={onSlot}
                emptyAction={
                  <Button variant="secondary" size="sm" onClick={() => pickDate(tomorrow)}>
                    Try {dayLabel(tomorrow)}
                  </Button>
                }
              />
            </div>
          </div>
        )}
      </div>
    </StepSection>
  );
}

/** Two weeks of days in a scrollable row, with the month grid one tap away for anything further out. */
function DateStrip({
  today,
  value,
  onChange,
  calendarOpen,
  onToggleCalendar,
}: {
  today: string;
  value: string;
  onChange(date: string): void;
  calendarOpen: boolean;
  onToggleCalendar(): void;
}) {
  const lastStripDay = addDays(today, STRIP_DAYS - 1);
  const first = value > lastStripDay ? addDays(value, -6) : today;
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(first, i));
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const button = selectedRef.current;
    const strip = button?.parentElement;
    if (button && strip && typeof strip.scrollTo === 'function') {
      strip.scrollTo({ left: button.offsetLeft - strip.clientWidth / 2 + button.clientWidth / 2 });
    }
  }, [value]);

  return (
    <div className="flex items-stretch gap-2">
      <div
        role="group"
        aria-label="Date"
        className="relative -mx-1 flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
      >
        {days.map((day, index) => {
          const selected = day === value;
          const showMonth = index === 0 || day.endsWith('-01');
          return (
            <button
              key={day}
              ref={selected ? selectedRef : undefined}
              type="button"
              aria-label={dayLabel(day)}
              aria-pressed={selected}
              onClick={() => onChange(day)}
              className={`flex w-[58px] shrink-0 snap-start flex-col items-center rounded-md border py-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${
                selected
                  ? 'border-pine-600 bg-pine-600 text-white'
                  : 'border-line-strong bg-surface text-ink hover:border-pine-600 hover:bg-pine-50'
              }`}
            >
              <span className={`text-[11px] ${selected ? 'text-white/80' : 'text-ink-muted'}`}>
                {day === today ? 'Today' : shortDay(day, 'weekday')}
              </span>
              <span className="num text-lg font-medium leading-tight">{Number(day.slice(8))}</span>
              <span className={`text-[11px] ${selected ? 'text-white/80' : 'text-ink-faint'}`}>
                {showMonth ? shortDay(day, 'month') : ' '}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onToggleCalendar}
        aria-expanded={calendarOpen}
        aria-label="More dates"
        className={`flex w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border text-[11px] transition-colors duration-150 ${
          calendarOpen
            ? 'border-ink bg-ink text-paper'
            : 'border-dashed border-line-strong text-ink-muted hover:border-ink-faint hover:text-ink'
        }`}
      >
        <Calendar />
        <span className="flex items-center gap-0.5">
          More
          <ChevronDown className={`h-3 w-3 transition-transform ${calendarOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>
    </div>
  );
}

function StaffChips({
  availability,
  value,
  onChange,
}: {
  availability: StaffAvailability[];
  value: string;
  onChange(id: string): void;
}) {
  const options = [
    { id: ANY_STAFF, name: 'Anyone', open: slotOptions(availability, ANY_STAFF).length },
    ...availability.map((a) => ({ id: a.staffId, name: a.staffName, open: a.slots.length })),
  ];
  return (
    <div
      role="group"
      aria-label="With"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {options.map((option) => {
        const selected = option.id === value;
        const full = option.open === 0;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            disabled={full && !selected}
            onClick={() => onChange(option.id)}
            title={option.name}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full border pl-1 pr-3.5 text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${
              selected
                ? 'border-ink bg-ink text-paper'
                : 'border-line-strong bg-surface text-ink hover:border-ink-faint'
            }`}
          >
            {option.id === ANY_STAFF ? (
              <span
                aria-hidden="true"
                className={`grid h-8 w-8 place-items-center rounded-full text-[11px] ${
                  selected ? 'bg-paper/15' : 'bg-line'
                }`}
              >
                All
              </span>
            ) : (
              <Avatar
                name={option.name}
                className={`h-8 w-8 text-xs ${selected ? '!bg-paper/15 !text-paper' : ''}`}
              />
            )}
            <span className="font-medium">{shortName(option.name)}</span>
            <span className={`num text-xs ${selected ? 'text-paper/60' : 'text-ink-muted'}`}>
              {full ? 'full' : `${option.open} open`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function staffNameOf(availability: StaffAvailability[] | undefined, staffId: string, tenant: PublicTenant) {
  return (
    availability?.find((a) => a.staffId === staffId)?.staffName ??
    tenant.staff.find((s) => s.id === staffId)?.name ??
    'Anyone available'
  );
}

function ConfirmStep({
  tenant,
  service,
  start,
  assignedStaff,
  rescheduleId,
  staffName,
}: {
  tenant: PublicTenant;
  service: Service;
  start: string;
  assignedStaff: string | null;
  rescheduleId: string | null;
  staffName: string;
}) {
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
        ['start', 'assigned', 'review'].forEach((key) => next.delete(key));
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
      <dl className="mt-4 grid grid-cols-[110px,1fr] border-t border-line text-[15px]">
        <dt className="border-b border-line py-3 text-sm text-ink-muted">Service</dt>
        <dd className="border-b border-line py-3">{service.name}</dd>
        <dt className="border-b border-line py-3 text-sm text-ink-muted">When</dt>
        <dd className="border-b border-line py-3">
          {formatLocalDate(start.slice(0, 10))},{' '}
          <span className="num">{formatTime(start, tenant.timezone)}</span>
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
              <span className="text-sm text-ink-muted">deposit, the rest at the counter</span>
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
            <Link to={`/login?next=${nextUrl}`} className={buttonClass('primary', 'lg')}>
              Sign in to confirm
            </Link>
            <Link
              to={`/register?next=${nextUrl}`}
              className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
            >
              or create an account
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
