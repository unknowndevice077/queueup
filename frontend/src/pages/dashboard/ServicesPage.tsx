import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDuration, formatPeso } from '@/lib/format';
import { queryKeys } from '@/lib/queries';
import type { Service } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  SkeletonList,
} from '@/components/ui';
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

  const deactivate = useMutation({
    mutationFn: (service: Service) => api.del(`/api/t/${slug}/services/${service.id}`),
    onSuccess: () => {
      toast.success('Service hidden from customers.');
      return invalidate();
    },
    onError: (e) => toast.error(e),
  });

  return (
    <div>
      <PageHeader
        title="Services"
        description="What customers can book. Buffer is clean-up time blocked after each booking."
        actions={<Button onClick={() => setEditing('new')}>Add service</Button>}
      />
      {editing && (
        <ServiceEditor
          slug={slug}
          service={editing === 'new' ? null : editing}
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
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No services yet">Add your first service so customers can book.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data!.map((service) => (
                <tr key={service.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{service.name}</p>
                    {service.description && <p className="text-slate-500">{service.description}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDuration(service.durationMinutes)}
                    {service.bufferMinutes > 0 && (
                      <span className="text-slate-500"> +{service.bufferMinutes}m</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatPeso(service.priceCentavos)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      value={service.active ? 'CONFIRMED' : 'CANCELLED'}
                      label={service.active ? 'active' : 'hidden'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(service)}>
                      Edit
                    </Button>
                    {service.active && (
                      <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(service)}>
                        Hide
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function ServiceEditor({ slug, service, onDone }: { slug: string; service: Service | null; onDone(): void }) {
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
      active: true,
    };
    try {
      if (service) {
        await api.put(`/api/t/${slug}/services/${service.id}`, body);
      } else {
        await api.post(`/api/t/${slug}/services`, body);
      }
      toast.success(service ? 'Service updated.' : 'Service added.');
      onDone();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Card className="mb-6">
      <h2 className="mb-4 font-semibold">{service ? `Edit ${service.name}` : 'New service'}</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" {...register('name')} error={errors.name?.message} />
        <Field
          label="Price (₱)"
          type="number"
          step="0.01"
          min={0}
          {...register('pricePesos')}
          error={errors.pricePesos?.message}
        />
        <Field
          label="Duration (minutes)"
          type="number"
          min={5}
          max={480}
          {...register('durationMinutes')}
          error={errors.durationMinutes?.message}
        />
        <Field
          label="Buffer after (minutes)"
          type="number"
          min={0}
          max={240}
          {...register('bufferMinutes')}
          error={errors.bufferMinutes?.message}
        />
        <Field
          label="Description"
          className="sm:col-span-2"
          {...register('description')}
          error={errors.description?.message}
        />
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={isSubmitting}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
