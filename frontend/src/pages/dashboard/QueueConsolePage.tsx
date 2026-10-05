import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { formatTime, ticketLabel } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import { useLiveQueue } from '@/lib/useLiveQueue';
import type { StaffQueueEntry } from '@/lib/types';
import { Badge, Button, ErrorState, PageHeader, SkeletonList } from '@/components/ui';
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

  const entries = data ?? [];
  const active = entries.filter((e) => e.status === 'CALLED' || e.status === 'SERVING');
  const waiting = entries.filter((e) => e.status === 'WAITING');
  const finished = entries.filter((e) => e.status === 'DONE' || e.status === 'SKIPPED');
  const next = waiting[0];

  return (
    <div>
      <PageHeader
        eyebrow="Walk-in queue"
        title="Counter"
        description={
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-pine-500' : 'bg-ink-faint'}`}
            />
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
                <h2 id="next-heading" className="font-mono text-2xs uppercase tracking-label text-paper/60">
                  Next in line
                </h2>
                {next ? (
                  <>
                    <p className="num mt-2 text-[56px] font-semibold leading-none text-marigold-400">
                      {ticketLabel(next.ticketNumber)}
                    </p>
                    <p className="mt-2 text-sm text-paper/80">
                      {next.customerName} · {next.serviceName ?? 'Any service'}
                    </p>
                    <p className="num mt-0.5 text-xs text-paper/50">waiting {waitedFor(next.joinedAt)}</p>
                  </>
                ) : (
                  <p className="mt-3 text-paper/60">Nobody is waiting.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => callNext.mutate()}
                disabled={!next || callNext.isPending}
                className="flex h-14 w-full items-center justify-center gap-2 border-t border-paper/15 bg-marigold-400 text-[15px] font-semibold text-ink transition-colors hover:bg-marigold-300 disabled:bg-paper/10 disabled:text-paper/40"
              >
                {callNext.isPending ? 'Calling…' : 'Call next'}
              </button>
            </section>

            <section aria-labelledby="counter-heading">
              <h2 id="counter-heading" className="eyebrow mb-2">
                At the counter
              </h2>
              {active.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-4 text-sm text-ink-muted">
                  Nobody called yet.
                </p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                  {active.map((entry) => (
                    <li key={entry.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between">
                        <span className="num text-xl font-medium">{ticketLabel(entry.ticketNumber)}</span>
                        <Badge
                          value={entry.status}
                          label={entry.status === 'CALLED' ? 'Called' : 'In service'}
                        />
                      </div>
                      <p className="mt-0.5 text-sm">
                        {entry.customerName}{' '}
                        <span className="text-ink-muted">· {entry.serviceName ?? 'Any service'}</span>
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {entry.status === 'CALLED' && (
                          <Button size="sm" onClick={() => act.mutate({ id: entry.id, action: 'serve' })}>
                            Start
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => act.mutate({ id: entry.id, action: 'done' })}
                        >
                          Done
                        </Button>
                        {entry.status === 'CALLED' && (
                          <Button
                            size="sm"
                            variant="ghost"
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
              <h2 id="waiting-heading" className="eyebrow mb-2">
                Waiting · {waiting.length}
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
                        <th className="eyebrow w-20 px-4 py-2.5 font-medium">Ticket</th>
                        <th className="eyebrow px-4 py-2.5 font-medium">Customer</th>
                        <th className="eyebrow hidden px-4 py-2.5 font-medium md:table-cell">Joined</th>
                        <th className="px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {waiting.map((entry) => (
                        <tr key={entry.id}>
                          <td className="num px-4 py-2.5 text-base">{ticketLabel(entry.ticketNumber)}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-medium">{entry.customerName}</span>
                            <span className="block text-[13px] text-ink-muted">
                              {entry.serviceName ?? 'Any service'} ·{' '}
                              <a
                                href={`tel:${entry.customerPhone}`}
                                className="num underline-offset-2 hover:underline"
                              >
                                {entry.customerPhone}
                              </a>
                            </span>
                          </td>
                          <td className="num hidden px-4 py-2.5 text-ink-muted md:table-cell">
                            {formatTime(entry.joinedAt, settings.timezone)}
                            <span className="block text-xs text-ink-faint">
                              {waitedFor(entry.joinedAt)} ago
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => act.mutate({ id: entry.id, action: 'serve' })}
                            >
                              Serve now
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => act.mutate({ id: entry.id, action: 'skip' })}
                            >
                              Skip
                            </Button>
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
                <h2 id="finished-heading" className="eyebrow mb-2">
                  Finished today · {finished.length}
                </h2>
                <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-muted">
                  {finished.map((entry) => (
                    <li
                      key={entry.id}
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
