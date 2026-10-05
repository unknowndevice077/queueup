import { Link, useParams } from 'react-router-dom';
import { usePublicQueue, usePublicTenant } from '@/lib/queries';
import { formatDuration, formatPeso } from '@/lib/format';
import { EmptyState, ErrorState, Skeleton, SkeletonList } from '@/components/ui';

export function BusinessPage() {
  const { slug = '' } = useParams();
  const { data: tenant, isLoading, error, refetch } = usePublicTenant(slug);
  const { data: queue } = usePublicQueue(slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-3 h-4 w-96" />
        <div className="mt-10">
          <SkeletonList rows={4} />
        </div>
      </div>
    );
  }
  if (error || !tenant) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <ErrorState error={error ?? new Error('Business not found')} onRetry={() => refetch()} />
      </div>
    );
  }

  const waiting = queue?.waitingCount ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="border-b border-line pb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">
          {tenant.name}
        </h1>
        <p className="mt-2 text-ink-2">{tenant.address}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/b/${slug}/book`}
            className="inline-flex h-11 items-center rounded-md bg-pine-600 px-5 font-medium text-white hover:bg-pine-700"
          >
            Book an appointment
          </Link>
          <Link
            to={`/b/${slug}/queue`}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-medium text-ink hover:border-ink-faint"
          >
            Walk in instead
            {waiting !== null && (
              <span className="num text-[13px] font-normal text-ink-muted">· {waiting} waiting</span>
            )}
          </Link>
        </div>
      </header>

      <div className="grid gap-12 pt-8 lg:grid-cols-[1fr,280px]">
        <section aria-labelledby="services-heading">
          <h2 id="services-heading" className="eyebrow">
            Services and prices
          </h2>
          {tenant.services.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No services listed yet" />
            </div>
          ) : (
            <ul className="mt-3">
              {tenant.services.map((service) => (
                <li key={service.id} className="border-b border-line">
                  <Link
                    to={`/b/${slug}/book?service=${service.id}`}
                    aria-label={`Book ${service.name}`}
                    className="group block py-4"
                  >
                    <div className="flex items-baseline">
                      <span className="text-[17px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                        {service.name}
                      </span>
                      <span className="leader" aria-hidden="true" />
                      <span className="num text-[16px] text-ink">{formatPeso(service.priceCentavos)}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      <span className="num">{formatDuration(service.durationMinutes)}</span>
                      {service.description && <> · {service.description}</>}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-8 text-sm">
          <div>
            <h2 className="eyebrow">Contact</h2>
            <dl className="mt-3 space-y-1 text-ink-2">
              {tenant.contactPhone && <dd className="num">{tenant.contactPhone}</dd>}
              {tenant.contactEmail && <dd>{tenant.contactEmail}</dd>}
            </dl>
          </div>
          <div>
            <h2 className="eyebrow">Good to know</h2>
            <ul className="mt-3 space-y-2 text-ink-2">
              <li>Free cancellation until {tenant.cancellationWindowHours} hours before your appointment.</li>
              <li>Book at least {formatDuration(tenant.bookingLeadTimeMinutes)} ahead.</li>
              {tenant.depositRequired && (
                <li>
                  A <span className="num">{tenant.depositPercent}%</span> deposit holds your slot (GCash, Maya
                  or card).
                </li>
              )}
              <li>Times are in {tenant.timezone.replace('_', ' ')} time.</li>
            </ul>
          </div>
          {tenant.staff.length > 0 && (
            <div>
              <h2 className="eyebrow">Team</h2>
              <ul className="mt-3 space-y-1 text-ink-2">
                {tenant.staff.map((member) => (
                  <li key={member.id}>{member.name}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
