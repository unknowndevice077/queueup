import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatTime, localDateOf, zonedIso } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Blackout, Page, StaffMember } from '@/lib/types';
import { Button, EmptyState, ErrorState, Field, PageHeader, Select, SkeletonList } from '@/components/ui';
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
    id ? (staff.data?.find((s) => s.id === id)?.fullName ?? 'Staff') : 'Whole shop';

  const create = useMutation({
    mutationFn: () =>
      api.post<Blackout>(`/api/t/${slug}/blackouts`, {
        membershipId: form.membershipId || undefined,
        startsAt: zonedIso(form.startsAt, settings.timezone),
        endsAt: zonedIso(form.endsAt, settings.timezone),
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Added. Customers can no longer book those times.');
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

  const now = Date.now();
  const items = blackouts.data?.content ?? [];
  const upcoming = items.filter((b) => new Date(b.endsAt).getTime() >= now);
  const past = items.filter((b) => new Date(b.endsAt).getTime() < now);

  const describe = (blackout: Blackout) => {
    const tz = settings.timezone;
    const sameDay = localDateOf(blackout.startsAt, tz) === localDateOf(blackout.endsAt, tz);
    return sameDay
      ? `${formatDate(blackout.startsAt, tz)}, ${formatTime(blackout.startsAt, tz)} – ${formatTime(blackout.endsAt, tz)}`
      : `${formatDate(blackout.startsAt, tz)} ${formatTime(blackout.startsAt, tz)} → ${formatDate(blackout.endsAt, tz)} ${formatTime(blackout.endsAt, tz)}`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Set up"
        title="Time off"
        description={`Holidays, day offs and early closings. Times are ${settings.timezone.replace('_', ' ')} time.`}
      />

      <form
        className="mb-10 grid gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-[1fr,1fr,1fr,1.2fr,auto] lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Select
          label="Who"
          id="blackout-who"
          value={form.membershipId}
          disabled={role !== 'OWNER'}
          onChange={(event) => setForm({ ...form, membershipId: event.target.value })}
        >
          {role === 'OWNER' && <option value="">Whole shop</option>}
          {(staff.data ?? [])
            .filter((s) => s.active && (role === 'OWNER' || s.id === myMembershipId))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
        </Select>
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
          label="Reason (optional)"
          name="blackout-reason"
          placeholder="e.g. Barangay fiesta"
          value={form.reason}
          onChange={(event) => setForm({ ...form, reason: event.target.value })}
        />
        <Button
          type="submit"
          variant="ink"
          loading={create.isPending}
          disabled={!form.startsAt || !form.endsAt}
        >
          Block time
        </Button>
      </form>

      {blackouts.isLoading ? (
        <SkeletonList rows={3} />
      ) : blackouts.error ? (
        <ErrorState error={blackouts.error} onRetry={() => blackouts.refetch()} />
      ) : (
        <>
          <h2 className="eyebrow mb-2">Coming up</h2>
          {upcoming.length === 0 ? (
            <EmptyState title="No time off scheduled" />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {upcoming.map((blackout) => (
                <li
                  key={blackout.id}
                  className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[160px,1fr,auto] sm:items-center sm:gap-4"
                >
                  <span className="font-medium">{staffName(blackout.membershipId)}</span>
                  <span>
                    <span className="num text-ink-2">{describe(blackout)}</span>
                    {blackout.reason && <span className="block text-ink-muted">{blackout.reason}</span>}
                  </span>
                  {(role === 'OWNER' || blackout.membershipId === myMembershipId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(blackout.id)}
                      className="justify-self-start sm:justify-self-end"
                    >
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <>
              <h2 className="eyebrow mb-2 mt-8">Past</h2>
              <ul className="space-y-1 text-sm text-ink-muted">
                {past.map((blackout) => (
                  <li key={blackout.id}>
                    {staffName(blackout.membershipId)} · <span className="num">{describe(blackout)}</span>
                    {blackout.reason && <> · {blackout.reason}</>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
