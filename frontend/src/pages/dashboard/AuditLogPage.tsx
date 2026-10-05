import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatTime, localDateOf } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { AuditEntry, Page, StaffMember } from '@/lib/types';
import { Button, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui';
import { useDashboard } from './DashboardLayout';

const ACTION_TEXT: Record<string, string> = {
  TENANT_CREATED: 'created the business',
  SETTINGS_UPDATED: 'changed settings',
  STAFF_ADDED: 'added a team member',
  STAFF_UPDATED: 'changed a team member',
  STAFF_REMOVED: 'removed a team member',
  STAFF_SERVICES_UPDATED: "changed someone's services",
  STAFF_SCHEDULE_UPDATED: "changed someone's hours",
  SERVICE_CREATED: 'added a service',
  SERVICE_UPDATED: 'edited a service',
  SERVICE_DEACTIVATED: 'hid a service',
  BLACKOUT_CREATED: 'blocked time',
  BLACKOUT_UPDATED: 'changed blocked time',
  BLACKOUT_DELETED: 'removed blocked time',
  BOOKING_CREATED: 'booked an appointment',
  BOOKING_CANCELLED: 'cancelled a booking',
  BOOKING_COMPLETED: 'marked a booking done',
  BOOKING_NO_SHOW: 'marked a no-show',
  BOOKING_RESCHEDULED: 'moved a booking',
  BOOKING_CONFIRMED: 'deposit paid, booking confirmed',
  BOOKING_EXPIRED: 'unpaid booking released',
  QUEUE_JOINED: 'walk-in took a number',
  QUEUE_CALLED: 'called a ticket',
  QUEUE_SERVING: 'started serving a ticket',
  QUEUE_DONE: 'finished a ticket',
  QUEUE_SKIPPED: 'skipped a ticket',
};

function detailText(details?: Record<string, unknown>): string {
  if (!details) {
    return '';
  }
  return Object.entries(details)
    .filter(([key]) => !key.toLowerCase().endsWith('id') && key !== 'serviceIds')
    .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${String(value)}`)
    .join(' · ');
}

export default function AuditLogPage() {
  const { slug, settings } = useDashboard();
  const [page, setPage] = useState(0);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.audit(slug, page),
    queryFn: () => api.get<Page<AuditEntry>>(`/api/t/${slug}/audit-log?page=${page}&size=30`),
    placeholderData: keepPreviousData,
  });
  const staff = useQuery({
    queryKey: queryKeys.staff(slug),
    queryFn: () => api.get<StaffMember[]>(`/api/t/${slug}/staff`),
  });
  const actorName = (entry: AuditEntry) => {
    if (!entry.actorUserId) {
      return entry.action.startsWith('QUEUE_JOINED') ? 'Walk-in' : 'System';
    }
    return staff.data?.find((s) => s.userId === entry.actorUserId)?.fullName ?? 'Customer';
  };

  const entries = data?.content ?? [];
  const tz = settings.timezone;

  return (
    <div>
      <PageHeader
        eyebrow="Set up"
        title="Activity log"
        description="Every change to bookings, the team, services, settings and the queue."
      />
      {isLoading ? (
        <SkeletonList rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <ol className="rounded-lg border border-line bg-surface">
          {entries.map((entry, index) => {
            const day = localDateOf(entry.createdAt, tz);
            const newDay = index === 0 || localDateOf(entries[index - 1].createdAt, tz) !== day;
            return (
              <li key={entry.id}>
                {newDay && (
                  <p className={`eyebrow bg-paper/70 px-5 py-2 ${index > 0 ? 'border-t border-line' : ''}`}>
                    {formatDate(entry.createdAt, tz)}
                  </p>
                )}
                <div className="grid grid-cols-[64px,1fr] gap-x-4 border-t border-line px-5 py-2.5 text-sm">
                  <span className="num text-ink-muted">{formatTime(entry.createdAt, tz)}</span>
                  <span>
                    <span className="font-medium">{actorName(entry)}</span>{' '}
                    <span className="text-ink-2">
                      {ACTION_TEXT[entry.action] ?? entry.action.toLowerCase()}
                    </span>
                    {detailText(entry.details) && (
                      <span className="mt-0.5 block truncate text-[13px] text-ink-muted">
                        {detailText(entry.details)}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {data && data.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0 || isFetching}
            onClick={() => setPage(page - 1)}
          >
            Newer
          </Button>
          <span className="num text-ink-muted">
            {page + 1} / {data.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page + 1 >= data.totalPages || isFetching}
            onClick={() => setPage(page + 1)}
          >
            Older
          </Button>
        </nav>
      )}
    </div>
  );
}
