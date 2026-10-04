import { Link, useParams } from 'react-router-dom';
import { usePublicTenant } from '@/lib/queries';
import { formatDuration, formatPeso } from '@/lib/format';
import { Card, EmptyState, ErrorState, Skeleton, SkeletonList } from '@/components/ui';

export function BusinessPage() {
  const { slug = '' } = useParams();
  const { data: tenant, isLoading, error, refetch } = usePublicTenant(slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-8">
          <SkeletonList rows={4} />
        </div>
      </div>
    );
  }
  if (error || !tenant) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState error={error ?? new Error('Business not found')} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
      <p className="mt-2 text-slate-600">
        {[tenant.address, tenant.contactPhone].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to={`/b/${slug}/book`}
          className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white shadow hover:bg-brand-700"
        >
          Book an appointment
        </Link>
        <Link
          to={`/b/${slug}/queue`}
          className="rounded-lg bg-white px-5 py-3 font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Join the walk-in queue
        </Link>
      </div>
      {tenant.depositRequired && (
        <p className="mt-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
          A {tenant.depositPercent}% deposit secures your booking (GCash, Maya or card).
        </p>
      )}

      <h2 className="mt-10 text-xl font-semibold">Services</h2>
      {tenant.services.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No services listed yet" />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {tenant.services.map((service) => (
            <li key={service.id}>
              <Card className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{service.name}</h3>
                  {service.description && (
                    <p className="mt-1 text-sm text-slate-600">{service.description}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-500">{formatDuration(service.durationMinutes)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPeso(service.priceCentavos)}</p>
                  <Link
                    to={`/b/${slug}/book?service=${service.id}`}
                    className="mt-1 inline-block text-sm font-medium text-brand-600 underline"
                    aria-label={`Book ${service.name}`}
                  >
                    Book
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm text-slate-500">
        Free cancellation up to {tenant.cancellationWindowHours} hours before your appointment. Times are in{' '}
        {tenant.timezone}.
      </p>
    </div>
  );
}
