import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { api } from '@/lib/api';
import { addDays, formatLocalDate, formatPeso, formatTime, ticketLabel, todayIn } from '@/lib/format';
import { downloadFile } from '@/lib/download';
import { queryKeys } from '@/lib/queries';
import type { AnalyticsSummary, Booking, Page, StaffQueueEntry } from '@/lib/types';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Skeleton,
  StatStrip,
} from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

const INK = '#17160F';
const PINE = '#1F5C3E';
const MARIGOLD = '#F2BC1F';
const LINE = '#E4E0D5';
const MUTED = '#6C685C';
const AXIS = { fontSize: 11, fill: MUTED, fontFamily: 'IBM Plex Mono, monospace' };

export default function OverviewPage() {
  const { slug, role, settings } = useDashboard();
  const navigate = useNavigate();
  const today = todayIn(settings.timezone);

  const todaysBookings = useQuery({
    queryKey: [...queryKeys.bookings(slug), 'today', today],
    queryFn: () => api.get<Page<Booking>>(`/api/t/${slug}/bookings?from=${today}&to=${today}&size=100`),
  });
  const queue = useQuery({
    queryKey: queryKeys.staffQueue(slug),
    queryFn: () => api.get<StaffQueueEntry[]>(`/api/t/${slug}/queue`),
  });

  const active = (todaysBookings.data?.content ?? []).filter((b) => b.status !== 'CANCELLED');
  const waiting = (queue.data ?? []).filter((e) => e.status === 'WAITING');
  const atCounter = (queue.data ?? []).filter((e) => e.status === 'CALLED' || e.status === 'SERVING');
  const next = active.find((b) => new Date(b.startsAt).getTime() > Date.now() && b.status === 'CONFIRMED');
  const loading = todaysBookings.isLoading || queue.isLoading;

  return (
    <div>
      <PageHeader title={formatLocalDate(today)} description={settings.name} />

      <StatStrip
        items={[
          { label: 'Appointments today', value: loading ? <Skeleton className="h-6 w-10" /> : active.length },
          {
            label: 'Next appointment',
            value: loading ? (
              <Skeleton className="h-6 w-16" />
            ) : next ? (
              formatTime(next.startsAt, settings.timezone)
            ) : (
              '—'
            ),
            note: next ? `${next.customerName}, ${next.serviceName}` : undefined,
          },
          { label: 'Walk-ins waiting', value: loading ? <Skeleton className="h-6 w-10" /> : waiting.length },
          {
            label: 'Done today',
            value: loading ? (
              <Skeleton className="h-6 w-10" />
            ) : (
              active.filter((b) => b.status === 'COMPLETED').length
            ),
          },
        ]}
      />

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr,300px]">
        <section aria-labelledby="today-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="today-heading" className="font-semibold">
              Today&apos;s appointments
            </h2>
            <Link
              to="calendar"
              className="text-[13px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Open calendar
            </Link>
          </div>
          {todaysBookings.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : todaysBookings.error ? (
            <ErrorState error={todaysBookings.error} />
          ) : active.length === 0 ? (
            <EmptyState title="No appointments today">
              Bookings made on your booking page show up here.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="caption w-20 px-4 py-2.5">Time</th>
                    <th className="caption px-4 py-2.5">Customer</th>
                    <th className="caption hidden px-4 py-2.5 sm:table-cell">With</th>
                    <th className="caption px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {active.map((booking) => (
                    <tr
                      key={booking.id}
                      onClick={() => navigate(`calendar?booking=${booking.id}`)}
                      className={`row-action ${booking.status === 'COMPLETED' ? 'text-ink-muted' : ''}`}
                    >
                      <td className="num whitespace-nowrap px-4 py-2.5">
                        {formatTime(booking.startsAt, settings.timezone)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`calendar?booking=${booking.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-ink hover:underline hover:underline-offset-2"
                        >
                          {booking.customerName}
                        </Link>
                        <span className="block text-[13px] text-ink-muted">{booking.serviceName}</span>
                      </td>
                      <td className="hidden px-4 py-2.5 text-ink-2 sm:table-cell">{booking.staffName}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge value={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="queue-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="queue-heading" className="font-semibold">
              Walk-ins right now
            </h2>
            <Link
              to="queue"
              className="text-[13px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Open counter
            </Link>
          </div>
          <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <p className="text-xs text-ink-muted">At the counter</p>
              <p className="num mt-1 text-lg">
                {atCounter.length === 0 ? '—' : atCounter.map((e) => ticketLabel(e.ticketNumber)).join('  ')}
              </p>
            </div>
            <ul className="divide-y divide-line text-sm">
              {waiting.slice(0, 5).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between px-4 py-2 animate-fade-in">
                  <span className="num">{ticketLabel(entry.ticketNumber)}</span>
                  <span className="truncate pl-3 text-ink-muted">{entry.customerName}</span>
                </li>
              ))}
              {waiting.length === 0 && <li className="px-4 py-3 text-ink-muted">Nobody waiting.</li>}
            </ul>
          </div>
        </section>
      </div>

      {role === 'OWNER' && <Performance slug={slug} today={today} />}
    </div>
  );
}

function Performance({ slug, today }: { slug: string; today: string }) {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [exporting, setExporting] = useState(false);
  const from = addDays(today, -(days - 1));
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.analytics(slug, from, today),
    queryFn: () => api.get<AnalyticsSummary>(`/api/t/${slug}/analytics/summary?from=${from}&to=${today}`),
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(
        `/api/t/${slug}/analytics/export.csv?from=${from}&to=${today}`,
        `${slug}-bookings.csv`,
      );
    } catch (e) {
      toast.error(e);
    } finally {
      setExporting(false);
    }
  };

  const perDay = (data?.bookingsPerDay ?? []).map((d) => ({
    ...d,
    label: d.date.slice(5).replace('-', '/'),
    revenue: d.revenueCentavos / 100,
    noShowRate: d.completed + d.noShow === 0 ? 0 : Math.round((d.noShow / (d.completed + d.noShow)) * 100),
  }));
  const hours = (data?.busiestHours ?? []).map((h) => ({
    ...h,
    label: `${h.hour % 12 || 12}${h.hour < 12 ? 'a' : 'p'}`,
  }));
  const topTotal = Math.max(1, ...(data?.topServices ?? []).map((s) => s.bookings));

  return (
    <section className="mt-12" aria-labelledby="performance-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 id="performance-heading" className="text-lg font-semibold">
            How the shop is doing
          </h2>
          <p className="text-[13px] text-ink-muted">
            {formatLocalDate(from)} to {formatLocalDate(today)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<number>
            label="Date range"
            value={days}
            onChange={setDays}
            options={[
              { value: 7, label: '7 days' },
              { value: 30, label: '30 days' },
              { value: 60, label: '60 days' },
            ]}
          />
          <Button variant="secondary" size="sm" loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <StatStrip
            items={[
              { label: 'Bookings', value: isLoading ? '…' : data!.totals.bookings },
              {
                label: 'Revenue',
                value: isLoading ? '…' : formatPeso(data!.totals.revenueCentavos),
                note: 'Completed visits',
              },
              {
                label: 'No-show rate',
                value: isLoading ? '…' : `${(data!.totals.noShowRate * 100).toFixed(1)}%`,
                note: 'Of visits that should have happened',
              },
              { label: 'Cancelled', value: isLoading ? '…' : data!.totals.cancelled },
            ]}
          />

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartPanel
              title="Bookings per day"
              loading={isLoading}
              legend={[
                [PINE, 'Completed'],
                [MARIGOLD, 'No-show'],
                [LINE, 'Cancelled'],
              ]}
            >
              <BarChart data={perDay} barCategoryGap={2}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={{ stroke: LINE }}
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,22,15,0.04)' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill={PINE} />
                <Bar dataKey="noShow" name="No-show" stackId="a" fill={MARIGOLD} />
                <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill={LINE} />
              </BarChart>
            </ChartPanel>
            <ChartPanel title="Revenue per day" loading={isLoading}>
              <LineChart data={perDay}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={{ stroke: LINE }}
                  minTickGap={24}
                />
                <YAxis
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                />
                <Tooltip content={<ChartTooltip money />} />
                <Line
                  type="linear"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={INK}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ChartPanel>
            <ChartPanel title="No-show rate per day" loading={isLoading}>
              <LineChart data={perDay}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={{ stroke: LINE }}
                  minTickGap={24}
                />
                <YAxis
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  domain={[0, 'auto']}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip percent />} />
                <Line
                  type="step"
                  dataKey="noShowRate"
                  name="No-show rate"
                  stroke={MARIGOLD}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ChartPanel>
            <ChartPanel title="Busiest hours" loading={isLoading}>
              <BarChart data={hours}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: LINE }} />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,22,15,0.04)' }} />
                <Bar dataKey="bookings" name="Bookings" fill={INK} />
              </BarChart>
            </ChartPanel>
          </div>

          {data && data.topServices.length > 0 && (
            <div className="mt-4 rounded-lg border border-line bg-surface p-5">
              <h3 className="font-semibold">Most booked services</h3>
              <ul className="mt-4 space-y-3">
                {data.topServices.map((service) => (
                  <li
                    key={service.serviceId}
                    className="grid grid-cols-[1fr,auto] items-center gap-x-4 gap-y-1 text-sm sm:grid-cols-[180px,1fr,170px]"
                  >
                    <span className="truncate">{service.name}</span>
                    <span className="col-span-2 row-start-2 h-1.5 bg-line sm:col-span-1 sm:row-start-auto">
                      <span
                        className="block h-full origin-left animate-[bar-grow_700ms_cubic-bezier(0.22,1,0.36,1)_both] bg-pine-600"
                        style={{ width: `${(service.bookings / topTotal) * 100}%` }}
                      />
                    </span>
                    <span className="num text-right text-ink-muted">
                      {service.bookings} booked, {formatPeso(service.revenueCentavos)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ChartPanel({
  title,
  loading,
  legend,
  children,
}: {
  title: string;
  loading: boolean;
  legend?: [string, string][];
  children: ReactElement;
}) {
  return (
    <figure className="rounded-lg border border-line bg-surface p-5">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{title}</span>
        {legend && (
          <span className="flex gap-3 text-xs text-ink-muted">
            {legend.map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="h-2 w-2" style={{ background: color }} aria-hidden="true" />
                {label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="h-56">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  money = false,
  percent = false,
}: TooltipProps<number, string> & { money?: boolean; percent?: boolean }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  return (
    <div className="rounded-md bg-ink px-3 py-2 text-xs text-paper">
      <p className="num mb-1 text-paper/60">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex justify-between gap-4">
          <span>{item.name}</span>
          <span className="num">
            {money ? formatPeso((item.value ?? 0) * 100) : percent ? `${item.value}%` : item.value}
          </span>
        </p>
      ))}
    </div>
  );
}
