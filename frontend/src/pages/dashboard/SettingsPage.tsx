import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { TenantSettings } from '@/lib/types';
import { Button, Card, Field, PageHeader } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useDashboard } from './DashboardLayout';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Required').max(120),
    contactEmail: z.union([z.literal(''), z.string().email('Enter a valid email')]),
    contactPhone: z.string().max(32),
    address: z.string().max(255),
    bookingLeadTimeMinutes: z.coerce.number().int().min(0).max(10080),
    cancellationWindowHours: z.coerce.number().int().min(0).max(720),
    depositRequired: z.boolean(),
    depositPercent: z.coerce.number().int().min(0).max(100),
  })
  .refine((v) => !v.depositRequired || v.depositPercent >= 1, {
    path: ['depositPercent'],
    message: 'Set a percentage between 1 and 100',
  });

type SettingsForm = z.infer<typeof schema>;

export default function SettingsPage() {
  const { slug, settings } = useDashboard();
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<SettingsForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: settings.name,
      contactEmail: settings.contactEmail ?? '',
      contactPhone: settings.contactPhone ?? '',
      address: settings.address ?? '',
      bookingLeadTimeMinutes: settings.bookingLeadTimeMinutes,
      cancellationWindowHours: settings.cancellationWindowHours,
      depositRequired: settings.depositRequired,
      depositPercent: settings.depositPercent,
    },
  });

  const onSubmit = async (values: SettingsForm) => {
    try {
      const updated = await api.patch<TenantSettings>(`/api/t/${slug}/settings`, values);
      queryClient.setQueryData(queryKeys.settings(slug), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicTenant(slug) });
      reset(values);
      toast.success('Settings saved.');
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors()).forEach(([field, message]) =>
          setError(field as keyof SettingsForm, { message }),
        );
      }
      toast.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description={`Booking page: /b/${slug} · Time zone: ${settings.timezone}`}
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Card>
          <h2 className="mb-4 font-semibold">Business info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" {...register('name')} error={errors.name?.message} />
            <Field
              label="Contact email"
              type="email"
              {...register('contactEmail')}
              error={errors.contactEmail?.message}
            />
            <Field
              label="Contact phone"
              type="tel"
              {...register('contactPhone')}
              error={errors.contactPhone?.message}
            />
            <Field label="Address" {...register('address')} error={errors.address?.message} />
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Booking rules</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Lead time (minutes)"
              type="number"
              hint="How soon before a slot customers can still book it."
              {...register('bookingLeadTimeMinutes')}
              error={errors.bookingLeadTimeMinutes?.message}
            />
            <Field
              label="Cancellation window (hours)"
              type="number"
              hint="Customers can cancel or reschedule until this many hours before."
              {...register('cancellationWindowHours')}
              error={errors.cancellationWindowHours?.message}
            />
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Deposits</h2>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              {...register('depositRequired')}
            />
            Require a deposit through PayMongo (GCash, Maya, card)
          </label>
          {watch('depositRequired') && (
            <Field
              className="mt-4 max-w-xs"
              label="Deposit (% of price)"
              type="number"
              {...register('depositPercent')}
              error={errors.depositPercent?.message}
            />
          )}
        </Card>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save settings
        </Button>
      </form>
    </div>
  );
}
