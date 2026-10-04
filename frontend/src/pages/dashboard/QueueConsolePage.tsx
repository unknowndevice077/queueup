import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { formatTime, ticketLabel } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import { useLiveQueue } from '@/lib/useLiveQueue';
import type { StaffQueueEntry } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

type Action = 'serve' | 'done' | 'skip';

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
      toast.success(`Calling ${ticketLabel(entry.ticketNumber)} (${entry.customerName})`);
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

  return (
    <div>
      <PageHeader
        title="Queue"
        description={`${waiting.length} waiting · ${connected ? 'live' : 'connecting…'}`}
        actions={
          <Button
            size="lg"
            loading={callNext.isPending}
            onClick={() => callNext.mutate()}
            disabled={waiting.length === 0}
          >
            Call next
          </Button>
        }
      />
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold">At the counter</h2>
            {active.length === 0 ? (
              <EmptyState title="Nobody called yet" />
            ) : (
              <ul className="space-y-2">
                {active.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} timeZone={settings.timezone}>
                    {entry.status === 'CALLED' && (
                      <Button size="sm" onClick={() => act.mutate({ id: entry.id, action: 'serve' })}>
                        Start serving
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
                        Skip
                      </Button>
                    )}
                  </EntryRow>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Waiting</h2>
            {waiting.length === 0 ? (
              <EmptyState title="The queue is empty">Walk-ins join at /b/{slug}/queue</EmptyState>
            ) : (
              <ol className="space-y-2">
                {waiting.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} timeZone={settings.timezone}>
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
                  </EntryRow>
                ))}
              </ol>
            )}
          </Card>
          {finished.length > 0 && (
            <Card className="lg:col-span-2">
              <h2 className="mb-3 font-semibold">Finished today</h2>
              <ul className="flex flex-wrap gap-2 text-sm">
                {finished.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="font-semibold">{ticketLabel(entry.ticketNumber)}</span>
                    <span>{entry.customerName}</span>
                    <Badge value={entry.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  timeZone,
  children,
}: {
  entry: StaffQueueEntry;
  timeZone: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold tabular-nums text-brand-700">
          {ticketLabel(entry.ticketNumber)}
        </span>
        <div className="text-sm">
          <p className="font-medium">
            {entry.customerName} <Badge value={entry.status} />
          </p>
          <p className="text-slate-500">
            {entry.serviceName ?? 'Any service'} · joined {formatTime(entry.joinedAt, timeZone)} ·{' '}
            <a href={`tel:${entry.customerPhone}`} className="underline">
              {entry.customerPhone}
            </a>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </li>
  );
}
