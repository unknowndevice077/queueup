import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { Service, StaffMember, WorkingHoursRange } from '@/lib/types';
import { Badge, Button, Card, ErrorState, Field, PageHeader, SkeletonList } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StaffPage() {
  const { slug } = useDashboard();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const staff = useQuery({
    queryKey: queryKeys.staff(slug),
    queryFn: () => api.get<StaffMember[]>(`/api/t/${slug}/staff`),
  });
  const services = useQuery({
    queryKey: queryKeys.services(slug),
    queryFn: () => api.get<Service[]>(`/api/t/${slug}/services`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.staff(slug) });

  const invite = useMutation({
    mutationFn: (email: string) => api.post<StaffMember>(`/api/t/${slug}/staff`, { email }),
    onSuccess: (member) => {
      toast.success(`${member.fullName} added as staff.`);
      setInviteEmail('');
      setExpanded(member.id);
      return refresh();
    },
    onError: (e) => toast.error(e),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Pick<StaffMember, 'role' | 'active'>> }) =>
      api.patch<StaffMember>(`/api/t/${slug}/staff/${id}`, body),
    onSuccess: refresh,
    onError: (e) => toast.error(e),
  });

  return (
    <div>
      <PageHeader title="Staff" description="Who works here, what they do and when they work." />
      <Card className="mb-6">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (inviteEmail.trim()) {
              invite.mutate(inviteEmail.trim());
            }
          }}
        >
          <Field
            label="Add a team member by email"
            name="invite-email"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            hint="They need a QueueUp account first."
            className="flex-1"
          />
          <Button type="submit" loading={invite.isPending}>
            Add staff
          </Button>
        </form>
      </Card>
      {staff.isLoading || services.isLoading ? (
        <SkeletonList rows={3} />
      ) : staff.error ? (
        <ErrorState error={staff.error} onRetry={() => staff.refetch()} />
      ) : (
        <ul className="space-y-3">
          {staff.data!.map((member) => (
            <li key={member.id}>
              <Card className={member.active ? '' : 'opacity-60'}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {member.fullName} <Badge value={member.role} />{' '}
                      {!member.active && <Badge value="CANCELLED" label="removed" />}
                    </p>
                    <p className="text-sm text-slate-500">{member.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-expanded={expanded === member.id}
                      onClick={() => setExpanded(expanded === member.id ? null : member.id)}
                    >
                      {expanded === member.id ? 'Close' : 'Services & hours'}
                    </Button>
                    {member.active && member.role === 'STAFF' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => update.mutate({ id: member.id, body: { role: 'OWNER' } })}
                      >
                        Make owner
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => update.mutate({ id: member.id, body: { active: !member.active } })}
                    >
                      {member.active ? 'Remove' : 'Restore'}
                    </Button>
                  </div>
                </div>
                {expanded === member.id && (
                  <StaffEditor slug={slug} member={member} services={services.data ?? []} onSaved={refresh} />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StaffEditor({
  slug,
  member,
  services,
  onSaved,
}: {
  slug: string;
  member: StaffMember;
  services: Service[];
  onSaved(): void;
}) {
  const toast = useToast();
  const [serviceIds, setServiceIds] = useState<string[]>(member.serviceIds);
  const [hours, setHours] = useState<WorkingHoursRange[]>(
    member.workingHours.map((h) => ({
      ...h,
      startTime: h.startTime.slice(0, 5),
      endTime: h.endTime.slice(0, 5),
    })),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/t/${slug}/staff/${member.id}/services`, { serviceIds });
      await api.put(`/api/t/${slug}/staff/${member.id}/working-hours`, { ranges: hours });
      toast.success(`Saved ${member.fullName}'s services and schedule.`);
      onSaved();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const setRange = (index: number, patch: Partial<WorkingHoursRange>) =>
    setHours((current) => current.map((h, i) => (i === index ? { ...h, ...patch } : h)));

  return (
    <div className="mt-5 grid gap-6 border-t border-slate-100 pt-5 lg:grid-cols-[1fr,2fr]">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Services</legend>
        <div className="space-y-2">
          {services
            .filter((s) => s.active)
            .map((service) => (
              <label key={service.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={serviceIds.includes(service.id)}
                  onChange={(event) =>
                    setServiceIds((ids) =>
                      event.target.checked ? [...ids, service.id] : ids.filter((id) => id !== service.id),
                    )
                  }
                />
                {service.name}
              </label>
            ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Weekly schedule</legend>
        <p className="mb-3 text-xs text-slate-500">Add two ranges on a day to model a lunch break.</p>
        <div className="space-y-3">
          {DAYS.map((dayName, dayIndex) => {
            const day = dayIndex + 1;
            const ranges = hours.map((h, i) => ({ h, i })).filter(({ h }) => h.dayOfWeek === day);
            return (
              <div key={day} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <span className="w-28 pt-1.5 text-sm font-medium">{dayName}</span>
                <div className="flex flex-1 flex-col gap-2">
                  {ranges.length === 0 && <span className="pt-1.5 text-sm text-slate-400">Day off</span>}
                  {ranges.map(({ h, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`start-${member.id}-${i}`}>
                        {dayName} start
                      </label>
                      <input
                        id={`start-${member.id}-${i}`}
                        type="time"
                        value={h.startTime}
                        onChange={(event) => setRange(i, { startTime: event.target.value })}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <span aria-hidden="true">–</span>
                      <label className="sr-only" htmlFor={`end-${member.id}-${i}`}>
                        {dayName} end
                      </label>
                      <input
                        id={`end-${member.id}-${i}`}
                        type="time"
                        value={h.endTime}
                        onChange={(event) => setRange(i, { endTime: event.target.value })}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${dayName} range`}
                        onClick={() => setHours((current) => current.filter((_, j) => j !== i))}
                        className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setHours((current) => [
                      ...current,
                      ranges.length === 0
                        ? { dayOfWeek: day, startTime: '09:00', endTime: '12:00' }
                        : { dayOfWeek: day, startTime: '13:00', endTime: '18:00' },
                    ])
                  }
                  className="self-start rounded px-2 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50"
                >
                  + Add range
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="lg:col-span-2">
        <Button onClick={save} loading={saving}>
          Save services and schedule
        </Button>
      </div>
    </div>
  );
}
