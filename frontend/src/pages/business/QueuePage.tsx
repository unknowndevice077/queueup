import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { queryKeys, usePublicQueue, usePublicTenant } from '@/lib/queries';
import { useLiveQueue } from '@/lib/useLiveQueue';
import { ticketLabel, todayIn } from '@/lib/format';
import type { PublicQueueState, QueueTicket } from '@/lib/types';
import { Badge, Button, Card, ErrorState, Field, SkeletonList } from '@/components/ui';
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

  useEffect(() => {
    if (tenant) {
      setTicket(loadTicket(slug, tenant.timezone));
    }
  }, [slug, tenant]);

  if (isLoading || !tenant) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <SkeletonList rows={3} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link to={`/b/${slug}`} className="text-sm text-brand-600 underline">
        ← {tenant.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Walk-in queue</h1>
      <p className="mt-1 text-sm text-slate-600" aria-live="polite">
        {state?.waitingCount ?? 0} waiting now{' '}
        <span className={connected ? 'text-emerald-600' : 'text-slate-400'}>
          · {connected ? 'live' : 'connecting'}
        </span>
      </p>
      {ticket ? (
        <TicketCard
          ticket={ticket}
          state={state}
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
    <Card className="mt-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
          hint="Only staff can see this, in case they need to reach you."
          {...register('customerPhone')}
          error={errors.customerPhone?.message}
        />
        <div>
          <label htmlFor="serviceId" className="block text-sm font-medium text-slate-700">
            Service (optional)
          </label>
          <select
            id="serviceId"
            {...register('serviceId')}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Not sure yet</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Get a ticket
        </Button>
      </form>
    </Card>
  );
}

function TicketCard({
  ticket,
  state,
  onLeave,
}: {
  ticket: QueueTicket;
  state: PublicQueueState | undefined;
  onLeave(): void;
}) {
  const live = state?.entries.find((e) => e.id === ticket.id);
  const status = live?.status ?? ticket.status;
  const position = live?.position ?? ticket.position;
  const yourTurn = status === 'CALLED' || status === 'SERVING';

  return (
    <Card className={`mt-6 text-center ${yourTurn ? 'ring-2 ring-emerald-500' : ''}`}>
      <p className="text-sm font-medium text-slate-500">Your ticket</p>
      <p className="mt-1 text-6xl font-extrabold tracking-tight text-brand-700">
        {ticketLabel(ticket.ticketNumber)}
      </p>
      <div className="mt-3">
        <Badge value={status} />
      </div>
      <p className="mt-4 text-lg font-semibold" aria-live="assertive">
        {yourTurn
          ? "It's your turn! Please proceed to the counter."
          : status === 'WAITING'
            ? position <= 1
              ? "You're next."
              : `${position - 1} ${position - 1 === 1 ? 'person' : 'people'} ahead of you`
            : status === 'DONE'
              ? 'Thanks for visiting!'
              : 'Your ticket was skipped. Please ask the staff.'}
      </p>
      <p className="mt-2 text-sm text-slate-500">Keep this page open. It updates automatically.</p>
      {(status === 'DONE' || status === 'SKIPPED') && (
        <Button variant="secondary" className="mt-4" onClick={onLeave}>
          Get a new ticket
        </Button>
      )}
    </Card>
  );
}
