import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { queryKeys, usePublicQueue, usePublicTenant } from '@/lib/queries';
import { useLiveQueue } from '@/lib/useLiveQueue';
import { formatTime, ticketLabel, todayIn } from '@/lib/format';
import type { PublicQueueState, QueueTicket } from '@/lib/types';
import { BackLink, Button, ErrorState, Field, Select, SkeletonList } from '@/components/ui';
import { useToast } from '@/components/Toaster';

const schema = z.object({
  customerName: z.string().trim().min(1, 'Enter your name').max(120),
  customerPhone: z
    .string()
    .trim()
    .min(7, 'Enter a valid mobile number')
    .max(32)
    .regex(/^[0-9+()\-\s]+$/, 'Use digits, spaces, + or -'),
  serviceId: z.string().optional(),
});

type JoinForm = z.infer<typeof schema>;

const storageKey = (slug: string) => `queueup.ticket.${slug}`;

function loadTicket(slug: string, timeZone: string): QueueTicket | null {
  try {
    const ticket = JSON.parse(localStorage.getItem(storageKey(slug)) ?? 'null') as QueueTicket | null;
    return ticket && ticket.queueDate === todayIn(timeZone) ? ticket : null;
  } catch {
    return null;
  }
}

export function QueuePage() {
  const { slug = '' } = useParams();
  const { data: tenant } = usePublicTenant(slug);
  const { data: initialState, isLoading, error, refetch } = usePublicQueue(slug);
  const { state: liveState, connected } = useLiveQueue(slug);
  const state: PublicQueueState | undefined = liveState ?? initialState;
  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [justJoined, setJustJoined] = useState(false);

  useEffect(() => {
    if (tenant) {
      setTicket(loadTicket(slug, tenant.timezone));
    }
  }, [slug, tenant]);

  if (isLoading || !tenant) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <SkeletonList rows={3} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const nowServing = (state?.entries ?? []).filter((e) => e.status === 'CALLED' || e.status === 'SERVING');

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <BackLink to={`/b/${slug}`}>{tenant.name}</BackLink>
      <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.015em]">Walk-in queue</h1>

      <div className="mt-5 grid grid-cols-2 divide-x divide-line rounded-md border border-line bg-surface">
        <div className="px-4 py-3">
          <p className="caption">Waiting</p>
          <p
            key={state?.waitingCount}
            className="num mt-1 animate-number-in text-2xl font-medium"
            aria-live="polite"
          >
            {state?.waitingCount ?? 0}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="caption">At the counter</p>
          <p className="num mt-1 text-2xl font-medium">
            {nowServing.length === 0 ? '—' : nowServing.map((e) => ticketLabel(e.ticketNumber)).join(' ')}
          </p>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
        <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
          {connected && (
            <span className="absolute inset-0 animate-ping rounded-full bg-pine-500 opacity-60 motion-reduce:hidden" />
          )}
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-pine-500' : 'bg-ink-faint'}`} />
        </span>
        {connected ? 'Live. Updates as staff call tickets.' : 'Connecting…'}
      </p>

      {ticket ? (
        <TicketCard
          ticket={ticket}
          state={state}
          businessName={tenant.name}
          timeZone={tenant.timezone}
          justJoined={justJoined}
          onLeave={() => {
            localStorage.removeItem(storageKey(slug));
            setTicket(null);
          }}
        />
      ) : (
        <JoinQueueForm
          slug={slug}
          services={tenant.services}
          onJoined={(t) => {
            localStorage.setItem(storageKey(slug), JSON.stringify(t));
            setJustJoined(true);
            setTicket(t);
          }}
        />
      )}
    </div>
  );
}

function JoinQueueForm({
  slug,
  services,
  onJoined,
}: {
  slug: string;
  services: { id: string; name: string }[];
  onJoined(ticket: QueueTicket): void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JoinForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: JoinForm) => {
    try {
      const ticket = await api.post<QueueTicket>(
        `/api/public/tenants/${slug}/queue/join`,
        { ...values, serviceId: values.serviceId || undefined },
        { auth: false },
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicQueue(slug) });
      onJoined(ticket);
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors()).forEach(([field, message]) =>
          setError(field as keyof JoinForm, { message }),
        );
      }
      toast.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5 border-t border-line pt-6">
      <p className="text-sm text-ink-2">
        No account needed. We&apos;ll show your place in line on this page.
      </p>
      <Field
        label="Your name"
        autoComplete="given-name"
        {...register('customerName')}
        error={errors.customerName?.message}
      />
      <Field
        label="Mobile number"
        type="tel"
        autoComplete="tel"
        hint="Only staff see this, in case they need to call you back in."
        {...register('customerPhone')}
        error={errors.customerPhone?.message}
      />
      <Select label="Service (optional)" {...register('serviceId')}>
        <option value="">Not sure yet</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </Select>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Take a number
      </Button>
    </form>
  );
}

function TicketCard({
  ticket,
  state,
  businessName,
  timeZone,
  justJoined,
  onLeave,
}: {
  ticket: QueueTicket;
  state: PublicQueueState | undefined;
  businessName: string;
  timeZone: string;
  justJoined: boolean;
  onLeave(): void;
}) {
  const live = state?.entries.find((e) => e.id === ticket.id);
  const status = live?.status ?? ticket.status;
  const position = live?.position ?? ticket.position;
  const yourTurn = status === 'CALLED' || status === 'SERVING';
  const ahead = Math.max(position - 1, 0);

  // When the counter calls this ticket: buzz the phone once and put it in the tab title, so a customer who
  // switched apps notices.
  const wasCalled = useRef(yourTurn);
  useEffect(() => {
    if (yourTurn && !wasCalled.current) {
      navigator.vibrate?.([200, 100, 200]);
    }
    wasCalled.current = yourTurn;
    const previous = document.title;
    if (yourTurn) {
      document.title = `Your turn: ${ticketLabel(ticket.ticketNumber)}`;
    }
    return () => {
      document.title = previous;
    };
  }, [yourTurn, ticket.ticketNumber]);

  const message = yourTurn
    ? 'Please go to the counter.'
    : status === 'WAITING'
      ? ahead === 0
        ? "You're next."
        : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you`
      : status === 'DONE'
        ? 'Thanks for coming in.'
        : 'Your number was skipped. Please ask at the counter.';

  return (
    <div className="mt-8">
      {/* The slot the ticket feeds out of. */}
      <div aria-hidden="true" className="mx-3 h-2 rounded-full bg-ink" />
      <div className="-mt-1 overflow-hidden px-5 pt-1">
        <div
          className={`ticket rounded-b-md transition-colors duration-500 ${justJoined ? 'animate-ticket-print' : ''} ${
            yourTurn ? 'animate-nudge border-marigold-400' : ''
          }`}
        >
          <div className="px-6 pb-5 pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium">{businessName}</p>
              <p className="num shrink-0 text-xs text-ink-muted">{formatTime(ticket.joinedAt, timeZone)}</p>
            </div>
            <p className="num mt-4 text-[72px] font-semibold leading-none tracking-[-0.03em]">
              {ticketLabel(ticket.ticketNumber)}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {ticket.customerName}
              {ticket.serviceName && <>, {ticket.serviceName}</>}
            </p>
          </div>
          <div className="ticket-tear" />
          <div
            className={`px-6 py-4 transition-colors duration-500 ${yourTurn ? 'bg-marigold-400 text-ink' : ''}`}
          >
            {status === 'WAITING' && ahead > 0 ? (
              <p className="flex items-baseline gap-2" aria-live="assertive">
                <span key={ahead} className="num animate-number-in text-3xl font-semibold">
                  {ahead}
                </span>
                <span className="text-lg font-medium">{ahead === 1 ? 'person' : 'people'} ahead of you</span>
              </p>
            ) : (
              <p className={`font-medium ${yourTurn ? 'text-xl' : 'text-lg'}`} aria-live="assertive">
                {message}
              </p>
            )}
            {status === 'WAITING' && (
              <p className="mt-1 text-[13px] text-ink-muted">Keep this page open. It updates by itself.</p>
            )}
          </div>
        </div>
      </div>
      {(status === 'DONE' || status === 'SKIPPED') && (
        <Button variant="secondary" className="mt-4" onClick={onLeave}>
          Take a new number
        </Button>
      )}
    </div>
  );
}
