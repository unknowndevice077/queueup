import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDuration, formatPeso } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Service } from '@/lib/types';
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader, SkeletonList } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  description: z.string().max(1000).optional(),
  durationMinutes: z.coerce.number().int().min(5, 'At least 5 minutes').max(480, 'At most 8 hours'),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  pricePesos: z.coerce.number().min(0, 'Cannot be negative').max(1_000_000),
});

type ServiceForm = z.infer<typeof schema>;

export default function ServicesPage() {
  const { slug } = useDashboard();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services(slug),
    queryFn: () => api.get<Service[]>(`/api/t/${slug}/services`),
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.services(slug) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicTenant(slug) }),
    ]);

  const setActive = useMutation({
    mutationFn: async ({ service, active }: { service: Service; active: boolean }) =>
      active
        ? api.put(`/api/t/${slug}/services/${service.id}`, {
            name: service.name,
            description: service.description,
            durationMinutes: service.durationMinutes,
            bufferMinutes: service.bufferMinutes,
            priceCentavos: service.priceCentavos,
            active: true,
          })
        : api.del(`/api/t/${slug}/services/${service.id}`),
    onSuccess: (_, { active }) => {
      toast.success(active ? 'Service is bookable again.' : 'Service hidden from customers.');
      return invalidate();
    },
    onError: (e) => toast.error(e),
  });

  const services = data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Set up"
        title="Services"
        description="What customers can book. Clean-up time is blocked after each booking so you're never rushed."
        actions={
          editing === null && (
            <Button variant="ink" onClick={() => setEditing('new')}>
              Add service
            </Button>
          )
        }
      />
      {editing === 'new' && (
        <ServiceEditor
          slug={slug}
          service={null}
          onDone={async () => {
            setEditing(null);
            await invalidate();
          }}
        />
      )}
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : services.length === 0 ? (
        <EmptyState title="No services yet">Add your first service so customers can book it.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="eyebrow px-4 py-2.5 font-medium">Service</th>
                <th className="eyebrow px-4 py-2.5 font-medium">Time</th>
                <th className="eyebrow px-4 py-2.5 text-right font-medium">Price</th>
                <th className="eyebrow px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {services.map((service) =>
                editing !== null && editing !== 'new' && editing.id === service.id ? (
                  <tr key={service.id}>
                    <td colSpan={5} className="bg-paper/60 p-0">
                      <ServiceEditor
                        slug={slug}
                        service={service}
                        embedded
                        onDone={async () => {
                          setEditing(null);
                          await invalidate();
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={service.id} className={service.active ? '' : 'text-ink-muted'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{service.name}</p>
                      {service.description && (
                        <p className="text-[13px] text-ink-muted">{service.description}</p>
                      )}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3">
                      {formatDuration(service.durationMinutes)}
                      {service.bufferMinutes > 0 && (
                        <span className="block text-xs text-ink-faint">
                          +{service.bufferMinutes} min clean-up
                        </span>
                      )}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right">
                      {formatPeso(service.priceCentavos)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        value={service.active ? 'CONFIRMED' : 'DONE'}
                        label={service.active ? 'Bookable' : 'Hidden'}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(service)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActive.mutate({ service, active: !service.active })}
                      >
                        {service.active ? 'Hide' : 'Show'}
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ServiceEditor({
  slug,
  service,
  embedded = false,
  onDone,
}: {
  slug: string;
  service: Service | null;
  embedded?: boolean;
  onDone(): void;
}) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServiceForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: service?.name ?? '',
      description: service?.description ?? '',
      durationMinutes: service?.durationMinutes ?? 30,
      bufferMinutes: service?.bufferMinutes ?? 0,
      pricePesos: service ? service.priceCentavos / 100 : 0,
    },
  });

  const onSubmit = async (values: ServiceForm) => {
    const body = {
      name: values.name,
      description: values.description || undefined,
      durationMinutes: values.durationMinutes,
      bufferMinutes: values.bufferMinutes,
      priceCentavos: Math.round(values.pricePesos * 100),
      active: service?.active ?? true,
    };
    try {
      if (service) {
        await api.put(`/api/t/${slug}/services/${service.id}`, body);
      } else {
        await api.post(`/api/t/${slug}/services`, body);
      }
      toast.success(service ? `Saved ${values.name}.` : `Added ${values.name}.`);
      onDone();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={embedded ? 'p-4' : 'mb-6 rounded-lg border border-ink bg-surface p-5'}
    >
      {!embedded && <h2 className="mb-4 font-medium">New service</h2>}
      <div className="grid gap-4 sm:grid-cols-[2fr,1fr,1fr,1fr]">
        <Field label="Name" {...register('name')} error={errors.name?.message} />
        <Field
          label="Minutes"
          type="number"
          min={5}
          max={480}
          {...register('durationMinutes')}
          error={errors.durationMinutes?.message}
        />
        <Field
          label="Clean-up (min)"
          type="number"
          min={0}
          max={240}
          {...register('bufferMinutes')}
          error={errors.bufferMinutes?.message}
        />
        <Field
          label="Price (₱)"
          type="number"
          step="0.01"
          min={0}
          {...register('pricePesos')}
          error={errors.pricePesos?.message}
        />
        <Field
          label="Description (optional)"
          className="sm:col-span-4"
          {...register('description')}
          error={errors.description?.message}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          {service ? 'Save' : 'Add service'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
