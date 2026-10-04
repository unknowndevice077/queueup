import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
} from 'recharts';
import { api } from '@/lib/api';
import { addDays, formatPeso, formatTime, todayIn } from '@/lib/format';
import { downloadFile } from '@/lib/download';
import { queryKeys } from '@/lib/queries';
import type { AnalyticsSummary, Booking, Page, StaffQueueEntry } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
];

export default function OverviewPage() {
  const { slug, role, settings } = useDashboard();
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
  const waiting = (queue.data ?? []).filter((e) => e.status === 'WAITING').length;

  return (
    <div>
      <PageHeader title={settings.name} description={`Today is ${today} (${settings.timezone})`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Bookings today" value={todaysBookings.isLoading ? null : String(active.length)} />
        <Kpi label="Waiting in queue" value={queue.isLoading ? null : String(waiting)} />
        <Kpi
          label="Next appointment"
          value={
            todaysBookings.isLoading
              ? null
              : (() => {
                  const next = active.find((b) => new Date(b.startsAt).getTime() > Date.now());
                  return next ? formatTime(next.startsAt, settings.timezone) : 'None';
                })()
          }
        />
        <Kpi
          label="Completed today"
          value={
            todaysBookings.isLoading ? null : String(active.filter((b) => b.status === 'COMPLETED').length)
          }
        />
      </div>

      {role === 'OWNER' && <Analytics slug={slug} today={today} />}

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Today&apos;s bookings</h2>
          <Link to="calendar" className="text-sm font-medium text-brand-600 underline">
            Open calendar
          </Link>
        </div>
        {todaysBookings.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : todaysBookings.error ? (
          <ErrorState error={todaysBookings.error} />
        ) : active.length === 0 ? (
          <EmptyState title="No bookings today" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="w-20 font-medium tabular-nums">
                  {formatTime(booking.startsAt, settings.timezone)}
                </span>
                <span className="flex-1 truncate">
                  {booking.customerName} · {booking.serviceName}
                </span>
                <span className="hidden text-slate-500 sm:inline">{booking.staffName}</span>
                <Badge value={booking.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function Analytics({ slug, today }: { slug: string; today: string }) {
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
    label: d.date.slice(5),
    revenue: d.revenueCentavos / 100,
    noShowRate: d.completed + d.noShow === 0 ? 0 : Math.round((d.noShow / (d.completed + d.noShow)) * 100),
  }));
  const hours = (data?.busiestHours ?? []).map((h) => ({ ...h, label: `${h.hour}:00` }));

  return (
    <section className="mt-6" aria-labelledby="analytics-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="analytics-heading" className="text-lg font-semibold">
          Performance
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Date range"
            className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200"
          >
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                aria-pressed={days === range.days}
                onClick={() => setDays(range.days)}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  days === range.days ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Bookings" value={isLoading ? null : String(data!.totals.bookings)} />
            <Kpi
              label="Revenue (completed)"
              value={isLoading ? null : formatPeso(data!.totals.revenueCentavos)}
            />
            <Kpi
              label="No-show rate"
              value={isLoading ? null : `${(data!.totals.noShowRate * 100).toFixed(1)}%`}
              hint="No-shows ÷ (completed + no-shows)"
            />
            <Kpi label="Cancelled" value={isLoading ? null : String(data!.totals.cancelled)} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Bookings per day" loading={isLoading}>
              <BarChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                <Tooltip />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#4f46e5" />
                <Bar dataKey="noShow" name="No-show" stackId="a" fill="#f59e0b" />
                <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill="#cbd5e1" />
              </BarChart>
            </ChartCard>
            <ChartCard title="Revenue per day (₱)" loading={isLoading}>
              <LineChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} />
                <YAxis tick={{ fontSize: 12 }} width={48} />
                <Tooltip formatter={(value: number) => formatPeso(value * 100)} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartCard>
            <ChartCard title="No-show rate per day (%)" loading={isLoading}>
              <LineChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} />
                <YAxis tick={{ fontSize: 12 }} width={32} domain={[0, 100]} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Line
                  type="monotone"
                  dataKey="noShowRate"
                  name="No-show rate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartCard>
            <ChartCard title="Busiest hours" loading={isLoading}>
              <BarChart data={hours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                <Tooltip />
                <Bar dataKey="bookings" name="Bookings" fill="#0ea5e9" />
              </BarChart>
            </ChartCard>
          </div>
          {data && data.topServices.length > 0 && (
            <Card className="mt-4">
              <h3 className="font-semibold">Top services</h3>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {data.topServices.map((service) => (
                  <li key={service.serviceId} className="flex justify-between py-2">
                    <span>{service.name}</span>
                    <span className="tabular-nums text-slate-600">
                      {service.bookings} bookings · {formatPeso(service.revenueCentavos)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

function ChartCard({ title, loading, children }: { title: string; loading: boolean; children: JSX.Element }) {
  return (
    <Card>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <figure aria-label={title} className="h-64">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </figure>
    </Card>
  );
}
