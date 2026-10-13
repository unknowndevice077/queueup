import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { shortName } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Service, StaffMember, WorkingHoursRange } from '@/lib/types';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ErrorState,
  Field,
  PageHeader,
  SkeletonList,
} from '@/components/ui';
import { useConfirm } from '@/components/Dialog';
import { Close, Plus } from '@/components/icons';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function shortTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`;
}

/** ["9a–12p", "1p–7p"] for a day, used in the compact weekly summary. */
function dayRanges(hours: WorkingHoursRange[], day: number) {
  return hours
    .filter((h) => h.dayOfWeek === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((r) => `${shortTime(r.startTime)}–${shortTime(r.endTime)}`);
}

export default function StaffPage() {
  const { slug } = useDashboard();
  const toast = useToast();
  const confirm = useConfirm();
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
      toast.success(`${member.fullName} joined the team.`);
      setInviteEmail('');
      setExpanded(member.id);
      return refresh();
    },
    onError: (e) => toast.error(e),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Pick<StaffMember, 'role' | 'active'>> }) =>
      api.patch<StaffMember>(`/api/t/${slug}/staff/${id}`, body),
    onSuccess: (member, { body }) => {
      toast.success(
        body.role === 'OWNER'
          ? `${member.fullName} is now an owner.`
          : body.active === false
            ? `${member.fullName} was removed. Their past bookings stay on record.`
            : `${member.fullName} is back on the team.`,
      );
      return refresh();
    },
    onError: (e) => toast.error(e),
  });

  const serviceName = (id: string) => services.data?.find((s) => s.id === id)?.name;

  return (
    <div>
      <PageHeader title="Staff & hours" description="Who works here, what they do, and when they're in." />

      <form
        className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (inviteEmail.trim()) {
            invite.mutate(inviteEmail.trim());
          }
        }}
      >
        <Field
          label="Add someone by email"
          name="invite-email"
          type="email"
          placeholder="name@example.com"
          value={inviteEmail}
          onChange={(event) => setInviteEmail(event.target.value)}
          hint="They need to create a QueueUp account first."
          className="flex-1 sm:max-w-sm"
        />
        <Button type="submit" variant="ink" loading={invite.isPending} className="sm:mb-[26px]">
          Add to team
        </Button>
      </form>

      {staff.isLoading || services.isLoading ? (
        <SkeletonList rows={3} />
      ) : staff.error ? (
        <ErrorState error={staff.error} onRetry={() => staff.refetch()} />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {staff.data!.map((member) => (
            <li key={member.id} className={member.active ? '' : 'bg-paper/60'}>
              <div className="grid gap-4 px-5 py-4 lg:grid-cols-[220px,minmax(0,1fr),250px] lg:items-start">
                <div className="flex min-w-0 gap-3">
                  <Avatar name={member.fullName} className="h-9 w-9 text-xs" />
                  <div className="min-w-0">
                    <p className={`font-medium ${member.active ? '' : 'text-ink-muted line-through'}`}>
                      {member.fullName}
                    </p>
                    <p className="truncate text-[13px] text-ink-muted">{member.email}</p>
                    <div className="mt-1">
                      <Badge
                        value={member.role}
                        label={member.active ? (member.role === 'OWNER' ? 'Owner' : 'Staff') : 'Removed'}
                      />
                    </div>
                  </div>
                </div>
                <div className="min-w-0 text-[13px]">
                  <div className="grid max-w-[560px] grid-cols-7 gap-px overflow-hidden rounded border border-line bg-line">
                    {DAYS.map((day, index) => {
                      const ranges = dayRanges(member.workingHours, index + 1);
                      return (
                        <div
                          key={day}
                          className={`px-1.5 py-1.5 ${ranges.length ? 'bg-surface' : 'hatched bg-paper'}`}
                        >
                          <p className="text-[11px] text-ink-muted">{day}</p>
                          {ranges.length === 0 ? (
                            <p className="num text-[11px] leading-tight text-ink-faint">off</p>
                          ) : (
                            ranges.map((range) => (
                              <p
                                key={range}
                                className="num whitespace-nowrap text-[11px] leading-tight text-ink-2"
                              >
                                {range}
                              </p>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 truncate text-ink-muted">
                    {member.serviceIds.length === 0
                      ? 'No services assigned, so customers cannot book them.'
                      : member.serviceIds.map(serviceName).filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 lg:flex-nowrap lg:justify-end">
                  <Button
                    size="sm"
                    variant={expanded === member.id ? 'ink' : 'secondary'}
                    aria-expanded={expanded === member.id}
                    onClick={() => setExpanded(expanded === member.id ? null : member.id)}
                  >
                    {expanded === member.id ? 'Close' : 'Edit hours'}
                  </Button>
                  {member.active && member.role === 'STAFF' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Make ${member.fullName} an owner?`,
                          body: 'Owners can change services, prices, staff and settings, and see the activity log.',
                          confirmLabel: 'Make owner',
                        });
                        if (ok) {
                          update.mutate({ id: member.id, body: { role: 'OWNER' } });
                        }
                      }}
                    >
                      Make owner
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (member.active) {
                        const ok = await confirm({
                          title: `Remove ${member.fullName} from the team?`,
                          body: 'They stop appearing on the booking page. Their past and upcoming bookings stay on the calendar.',
                          confirmLabel: 'Remove',
                          danger: true,
                        });
                        if (!ok) {
                          return;
                        }
                      }
                      update.mutate({ id: member.id, body: { active: !member.active } });
                    }}
                  >
                    {member.active ? 'Remove' : 'Restore'}
                  </Button>
                </div>
              </div>
              {expanded === member.id && (
                <StaffEditor slug={slug} member={member} services={services.data ?? []} onSaved={refresh} />
              )}
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
      toast.success(`Saved ${member.fullName}'s services and hours.`);
      onSaved();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const setRange = (index: number, patch: Partial<WorkingHoursRange>) =>
    setHours((current) => current.map((h, i) => (i === index ? { ...h, ...patch } : h)));

  const copyMondayToWeekdays = () => {
    const monday = hours.filter((h) => h.dayOfWeek === 1);
    setHours((current) => [
      ...current.filter((h) => h.dayOfWeek === 1 || h.dayOfWeek > 5),
      ...[2, 3, 4, 5].flatMap((day) => monday.map((h) => ({ ...h, dayOfWeek: day }))),
    ]);
  };

  const timeInput =
    'h-8 rounded border border-line-strong bg-surface px-1.5 text-[13px] transition-colors hover:border-ink-faint focus:border-pine-600 focus:outline-none focus:ring-[3px] focus:ring-pine-600/15';

  return (
    <div className="grid animate-fade-in gap-8 border-t border-line bg-paper/50 px-5 py-5 lg:grid-cols-[220px,1fr]">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Does these services</legend>
        <div className="space-y-1">
          {services
            .filter((s) => s.active)
            .map((service) => (
              <Checkbox
                key={service.id}
                label={service.name}
                checked={serviceIds.includes(service.id)}
                onChange={(event) =>
                  setServiceIds((ids) =>
                    event.target.checked ? [...ids, service.id] : ids.filter((id) => id !== service.id),
                  )
                }
              />
            ))}
        </div>
      </fieldset>

      <fieldset>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <legend className="text-sm font-semibold">Weekly hours</legend>
          <button
            type="button"
            onClick={copyMondayToWeekdays}
            className="text-[13px] text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            Copy Monday to Tue–Fri
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line border-y border-line">
            {DAY_NAMES.map((dayName, dayIndex) => {
              const day = dayIndex + 1;
              const ranges = hours.map((h, i) => ({ h, i })).filter(({ h }) => h.dayOfWeek === day);
              return (
                <tr key={day}>
                  <th scope="row" className="w-28 py-2 pr-3 text-left align-top font-normal text-ink-2">
                    {dayName}
                  </th>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {ranges.length === 0 && <span className="text-ink-faint">Day off</span>}
                      {ranges.map(({ h, i }) => (
                        <span key={i} className="inline-flex items-center gap-1.5">
                          <label className="sr-only" htmlFor={`start-${member.id}-${i}`}>
                            {dayName} start
                          </label>
                          <input
                            id={`start-${member.id}-${i}`}
                            type="time"
                            step={900}
                            value={h.startTime}
                            onChange={(event) => setRange(i, { startTime: event.target.value })}
                            className={timeInput}
                          />
                          <span aria-hidden="true" className="text-ink-faint">
                            –
                          </span>
                          <label className="sr-only" htmlFor={`end-${member.id}-${i}`}>
                            {dayName} end
                          </label>
                          <input
                            id={`end-${member.id}-${i}`}
                            type="time"
                            step={900}
                            value={h.endTime}
                            onChange={(event) => setRange(i, { endTime: event.target.value })}
                            className={timeInput}
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${dayName} ${h.startTime} to ${h.endTime}`}
                            onClick={() => setHours((current) => current.filter((_, j) => j !== i))}
                            className="grid h-7 w-7 place-items-center rounded text-ink-faint transition-colors hover:bg-brick-50 hover:text-brick-600"
                          >
                            <Close className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="w-24 py-2 text-right align-top">
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
                      className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[13px] text-pine-600 transition-colors hover:bg-pine-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {ranges.length === 0 ? 'Add hours' : 'After break'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>

      <div className="flex gap-2 lg:col-span-2">
        <Button onClick={save} loading={saving}>
          Save {shortName(member.fullName)}&apos;s schedule
        </Button>
      </div>
    </div>
  );
}
