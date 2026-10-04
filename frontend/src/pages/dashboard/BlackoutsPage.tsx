import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime, zonedIso } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Blackout, Page, StaffMember } from '@/lib/types';
import { Button, Card, EmptyState, ErrorState, Field, PageHeader, SkeletonList } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/auth/AuthContext';
import { useDashboard } from './DashboardLayout';

export default function BlackoutsPage() {
  const { slug, role, settings } = useDashboard();
  const { memberships } = useAuth();
  const myMembershipId = memberships.find((m) => m.tenantSlug === slug)?.membershipId ?? '';
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    membershipId: role === 'OWNER' ? '' : myMembershipId,
    startsAt: '',
    endsAt: '',
    reason: '',
  });

  const blackouts = useQuery({
    queryKey: queryKeys.blackouts(slug),
    queryFn: () => api.get<Page<Blackout>>(`/api/t/${slug}/blackouts?size=100`),
  });
  const staff = useQuery({
    queryKey: queryKeys.staff(slug),
    queryFn: () => api.get<StaffMember[]>(`/api/t/${slug}/staff`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.blackouts(slug) });
  const staffName = (id?: string) =>
    id ? (staff.data?.find((s) => s.id === id)?.fullName ?? 'Staff') : 'Whole business';

  const create = useMutation({
    mutationFn: () =>
      api.post<Blackout>(`/api/t/${slug}/blackouts`, {
        membershipId: form.membershipId || undefined,
        startsAt: zonedIso(form.startsAt, settings.timezone),
        endsAt: zonedIso(form.endsAt, settings.timezone),
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Blackout added. Those times are no longer bookable.');
      setForm((f) => ({ ...f, startsAt: '', endsAt: '', reason: '' }));
      return refresh();
    },
    onError: (e) => toast.error(e),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/t/${slug}/blackouts/${id}`),
    onSuccess: refresh,
    onError: (e) => toast.error(e),
  });

  return (
    <div>
      <PageHeader
        title="Blackouts"
        description={`Days off, holidays and closures. Times are in ${settings.timezone}.`}
      />
      <Card className="mb-6">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <label htmlFor="blackout-who" className="block text-sm font-medium text-slate-700">
              Who
            </label>
            <select
              id="blackout-who"
              value={form.membershipId}
              disabled={role !== 'OWNER'}
              onChange={(event) => setForm({ ...form, membershipId: event.target.value })}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm"
            >
              {role === 'OWNER' && <option value="">Whole business</option>}
              {(staff.data ?? [])
                .filter((s) => role === 'OWNER' || s.id === myMembershipId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
            </select>
          </div>
          <Field
            label="From"
            name="blackout-from"
            type="datetime-local"
            required
            value={form.startsAt}
            onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
          />
          <Field
            label="Until"
            name="blackout-until"
            type="datetime-local"
            required
            value={form.endsAt}
            onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
          />
          <Field
            label="Reason"
            name="blackout-reason"
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
          <Button type="submit" loading={create.isPending} disabled={!form.startsAt || !form.endsAt}>
            Add blackout
          </Button>
        </form>
      </Card>
      {blackouts.isLoading ? (
        <SkeletonList rows={3} />
      ) : blackouts.error ? (
        <ErrorState error={blackouts.error} onRetry={() => blackouts.refetch()} />
      ) : blackouts.data!.content.length === 0 ? (
        <EmptyState title="No blackouts" />
      ) : (
        <ul className="space-y-2">
          {blackouts.data!.content.map((blackout) => (
            <li key={blackout.id}>
              <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold">{staffName(blackout.membershipId)}</p>
                  <p className="text-slate-600">
                    {formatDateTime(blackout.startsAt, settings.timezone)} →{' '}
                    {formatDateTime(blackout.endsAt, settings.timezone)}
                  </p>
                  {blackout.reason && <p className="text-slate-500">{blackout.reason}</p>}
                </div>
                {(role === 'OWNER' || blackout.membershipId === myMembershipId) && (
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(blackout.id)}>
                    Delete
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
