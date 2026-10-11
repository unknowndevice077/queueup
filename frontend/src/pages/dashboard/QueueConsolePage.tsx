import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { formatTime, ticketLabel } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import { useLiveQueue } from '@/lib/useLiveQueue';
import type { StaffQueueEntry } from '@/lib/types';
import { Badge, Button, ErrorState, PageHeader, SkeletonList } from '@/components/ui';
import { Phone } from '@/components/icons';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

type Action = 'serve' | 'done' | 'skip';

function waitedFor(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 90) {
    return `${minutes} min`;
  }
  return `${Math.round(minutes / 60)} h`;
}

/** Keys that appeared since the first load, so rows that change live can be highlighted once. */
function useNewKeys(keys: string[] | undefined) {
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set<string>();
  if (keys && seen.current !== null) {
    keys.forEach((key) => !seen.current!.has(key) && fresh.add(key));
  }
  useEffect(() => {
    if (!keys) {
      return;
    }
    seen.current ??= new Set();
    keys.forEach((key) => seen.current!.add(key));
  });
  return fresh;
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export default function QueueConsolePage() {
  const { slug, settings } = useDashboard();
  const toast = useToast();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.staffQueue(slug) });
  const { connected } = useLiveQueue(slug, () => void refresh());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.staffQueue(slug),
    queryFn: () => api.get<StaffQueueEntry[]>(`/api/t/${slug}/queue`),
  });

  const callNext = useMutation({
    mutationFn: () => api.post<StaffQueueEntry>(`/api/t/${slug}/queue/call-next`),
    onSuccess: (entry) => {
      toast.success(`Called ${ticketLabel(entry.ticketNumber)}, ${entry.customerName}.`);
      return refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError && e.status === 404 ? 'No one is waiting.' : e),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) =>
      api.post<StaffQueueEntry>(`/api/t/${slug}/queue/${id}/${action}`),
    onSuccess: refresh,
    onError: (e) => toast.error(e),
  });
  const acting = (id: string, action: Action) =>
    act.isPending && act.variables?.id === id && act.variables.action === action;

  const entries = data ?? [];
  const active = entries.filter((e) => e.status === 'CALLED' || e.status === 'SERVING');
  const waiting = entries.filter((e) => e.status === 'WAITING');
  const finished = entries.filter((e) => e.status === 'DONE' || e.status === 'SKIPPED');
  const next = waiting[0];
  const fresh = useNewKeys(data?.map((e) => `${e.id}:${e.status}`));
  const flash = (e: StaffQueueEntry) => (fresh.has(`${e.id}:${e.status}`) ? 'animate-flash' : '');

  // N calls the next ticket from anywhere on the page, so the counter never has to reach for the mouse.
  const canCall = Boolean(next) && !callNext.isPending;
  const callRef = useRef(() => {});
  callRef.current = () => {
    if (canCall) {
      callNext.mutate();
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'n' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTyping(event.target)
      ) {
        event.preventDefault();
        callRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div>
      <PageHeader
        title="Walk-in counter"
        description={
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
              {connected && (
                <span className="absolute inset-0 animate-ping rounded-full bg-pine-500 opacity-60 motion-reduce:hidden" />
              )}
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-pine-500' : 'bg-ink-faint'}`} />
            </span>
            {connected ? 'Live. Changes from other staff appear here instantly.' : 'Connecting…'}
          </span>
        }
      />
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="space-y-6">
            <section
              aria-labelledby="next-heading"
              className="overflow-hidden rounded-lg border border-ink bg-ink text-paper"
            >
              <div className="px-5 pb-5 pt-4">
                <h2 id="next-heading" className="text-[13px] font-medium text-paper/60">
                  Next in line
                </h2>
                {next ? (
                  <div key={next.id} className="animate-fade-in">
                    <p className="num mt-2 text-[56px] font-semibold leading-none text-marigold-400">
                      {ticketLabel(next.ticketNumber)}
                    </p>
                    <p className="mt-2 text-sm text-paper/90">{next.customerName}</p>
                    <p className="text-sm text-paper/60">
                      {next.serviceName ?? 'Any service'}, waiting{' '}
                      <span className="num">{waitedFor(next.joinedAt)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-paper/60">Nobody is waiting.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => callNext.mutate()}
                disabled={!canCall}
                aria-keyshortcuts="N"
                className="flex h-14 w-full items-center justify-center gap-3 border-t border-paper/15 bg-marigold-400 text-[15px] font-semibold text-ink transition-[background-color,transform] duration-150 hover:bg-marigold-300 active:translate-y-px disabled:bg-paper/10 disabled:text-paper/40"
              >
                {callNext.isPending ? 'Calling…' : 'Call next'}
                {canCall && <kbd className="border-ink/30 text-ink/60">N</kbd>}
              </button>
            </section>

            <section aria-labelledby="counter-heading">
              <h2 id="counter-heading" className="caption mb-2">
                At the counter
              </h2>
              {active.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-4 text-sm text-ink-muted">
                  Nobody called yet. Press Call next when a chair is free.
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {active.map((entry) => (
                    <li key={entry.id} className={`px-4 py-3 ${flash(entry)}`}>
                      <div className="flex items-baseline justify-between">
                        <span className="num text-xl font-medium">{ticketLabel(entry.ticketNumber)}</span>
                        <Badge
                          value={entry.status}
                          label={entry.status === 'CALLED' ? 'Called' : 'In service'}
                        />
                      </div>
                      <p className="mt-0.5 text-sm">{entry.customerName}</p>
                      <p className="text-[13px] text-ink-muted">{entry.serviceName ?? 'Any service'}</p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {entry.status === 'CALLED' && (
                          <Button
                            size="sm"
                            loading={acting(entry.id, 'serve')}
                            onClick={() => act.mutate({ id: entry.id, action: 'serve' })}
                          >
                            Start
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={acting(entry.id, 'done')}
                          onClick={() => act.mutate({ id: entry.id, action: 'done' })}
                        >
                          Done
                        </Button>
                        {entry.status === 'CALLED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={acting(entry.id, 'skip')}
                            onClick={() => act.mutate({ id: entry.id, action: 'skip' })}
                          >
                            Didn&apos;t show
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section aria-labelledby="waiting-heading">
              <h2 id="waiting-heading" className="caption mb-2">
                Waiting <span className="num text-ink-faint">({waiting.length})</span>
              </h2>
              {waiting.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
                  The line is empty. Walk-ins join at <span className="num">/b/{slug}/queue</span>
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="caption w-20 px-4 py-2.5">Ticket</th>
                        <th className="caption px-4 py-2.5">Customer</th>
                        <th className="caption hidden px-4 py-2.5 md:table-cell">Joined</th>
                        <th className="px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {waiting.map((entry, index) => (
                        <tr
                          key={entry.id}
                          className={`group transition-colors hover:bg-paper/60 ${flash(entry)}`}
                        >
                          <td className="num px-4 py-2.5 text-base">
                            {ticketLabel(entry.ticketNumber)}
                            {index === 0 && (
                              <span className="block font-sans text-[11px] font-medium text-pine-600">
                                Next
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-medium">{entry.customerName}</span>
                            <span className="flex flex-wrap items-center gap-x-3 text-[13px] text-ink-muted">
                              {entry.serviceName ?? 'Any service'}
                              <a
                                href={`tel:${entry.customerPhone}`}
                                className="num inline-flex items-center gap-1 rounded underline-offset-2 hover:text-ink hover:underline"
                              >
                                <Phone className="h-3 w-3" />
                                {entry.customerPhone}
                              </a>
                            </span>
                          </td>
                          <td className="num hidden whitespace-nowrap px-4 py-2.5 text-ink-muted md:table-cell">
                            {formatTime(entry.joinedAt, settings.timezone)}
                            <span className="block text-xs text-ink-faint">
                              {waitedFor(entry.joinedAt)} ago
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right">
                            <span className="inline-flex gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={acting(entry.id, 'serve')}
                                onClick={() => act.mutate({ id: entry.id, action: 'serve' })}
                              >
                                Serve now
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={acting(entry.id, 'skip')}
                                onClick={() => act.mutate({ id: entry.id, action: 'skip' })}
                              >
                                Skip
                              </Button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {finished.length > 0 && (
              <section aria-labelledby="finished-heading">
                <h2 id="finished-heading" className="caption mb-2">
                  Finished today <span className="num text-ink-faint">({finished.length})</span>
                </h2>
                <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-muted">
                  {finished.map((entry) => (
                    <li
                      key={entry.id}
                      title={entry.status === 'SKIPPED' ? 'Skipped' : 'Done'}
                      className={entry.status === 'SKIPPED' ? 'line-through decoration-brick-500/60' : ''}
                    >
                      <span className="num text-ink-2">{ticketLabel(entry.ticketNumber)}</span>{' '}
                      {entry.customerName}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
