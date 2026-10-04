import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { AuditEntry, Page, StaffMember } from '@/lib/types';
import { Button, Card, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui';
import { useDashboard } from './DashboardLayout';

export default function AuditLogPage() {
  const { slug, settings } = useDashboard();
  const [page, setPage] = useState(0);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.audit(slug, page),
    queryFn: () => api.get<Page<AuditEntry>>(`/api/t/${slug}/audit-log?page=${page}&size=25`),
    placeholderData: keepPreviousData,
  });
  const staff = useQuery({
    queryKey: queryKeys.staff(slug),
    queryFn: () => api.get<StaffMember[]>(`/api/t/${slug}/staff`),
  });
  const actorName = (id?: string) =>
    !id ? 'System / customer' : (staff.data?.find((s) => s.userId === id)?.fullName ?? 'Customer');

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every change to bookings, staff, services, settings and the queue."
      />
      {isLoading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data!.content.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data!.content.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatDateTime(entry.createdAt, settings.timezone)}
                  </td>
                  <td className="px-4 py-2">{actorName(entry.actorUserId)}</td>
                  <td className="px-4 py-2 font-medium">{entry.action.replaceAll('_', ' ').toLowerCase()}</td>
                  <td className="max-w-md truncate px-4 py-2 font-mono text-xs text-slate-500">
                    {entry.details ? JSON.stringify(entry.details) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data && data.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0 || isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page + 1} of {data.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page + 1 >= data.totalPages || isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
