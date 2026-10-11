import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { TenantSettings } from '@/lib/types';
import { Button, Field, PageHeader, Switch } from '@/components/ui';
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

/** A settings group: explanation on the left, inputs on the right. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 border-b border-line py-8 first:pt-0 md:grid-cols-[260px,1fr] md:gap-10">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
      </div>
      <div className="max-w-xl space-y-5">{children}</div>
    </section>
  );
}

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

  const depositRequired = watch('depositRequired');

  return (
    <div>
      <PageHeader
        title="Settings"
        description={
          <>
            Your booking page is{' '}
            <a
              href={`/b/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="num text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              /b/{slug}
            </a>
          </>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Section
          title="Business details"
          description="Shown on your booking page and in every email customers receive."
        >
          <Field label="Business name" {...register('name')} error={errors.name?.message} />
          <Field label="Address" {...register('address')} error={errors.address?.message} />
          <div className="grid gap-5 sm:grid-cols-2">
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
          </div>
        </Section>

        <Section
          title="Booking rules"
          description="Keep last-minute bookings and cancellations to a level the shop can handle."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Minimum notice (minutes)"
              type="number"
              hint="How far ahead customers must book."
              {...register('bookingLeadTimeMinutes')}
              error={errors.bookingLeadTimeMinutes?.message}
            />
            <Field
              label="Free cancellation until (hours)"
              type="number"
              hint="Before the appointment. After that, only staff can cancel."
              {...register('cancellationWindowHours')}
              error={errors.cancellationWindowHours?.message}
            />
          </div>
        </Section>

        <Section
          title="Deposits"
          description="Ask for part of the price up front through PayMongo (GCash, Maya, cards). Unpaid holds are released after 15 minutes."
        >
          <Switch
            id="depositRequired"
            label="Require a deposit to book"
            description="Customers pay before the booking is confirmed."
            {...register('depositRequired')}
          />
          {depositRequired && (
            <Field
              className="max-w-[200px] animate-fade-in"
              label="Deposit (% of price)"
              type="number"
              {...register('depositPercent')}
              error={errors.depositPercent?.message}
            />
          )}
        </Section>

        {isDirty || isSubmitting ? (
          <div className="sticky bottom-0 -mx-4 flex animate-bar-up items-center gap-3 border-t border-ink bg-ink px-4 py-3 text-paper sm:-mx-8 sm:px-8">
            <span className="flex-1 text-sm">You have unsaved changes.</span>
            <Button
              type="button"
              variant="ghost"
              className="!text-paper/80 hover:!bg-paper/10"
              onClick={() => reset()}
            >
              Discard
            </Button>
            <Button
              type="submit"
              className="!bg-marigold-400 !text-ink hover:!bg-marigold-300"
              loading={isSubmitting}
            >
              Save changes
            </Button>
          </div>
        ) : (
          <p className="py-6 text-[13px] text-ink-muted">All changes saved.</p>
        )}
      </form>
    </div>
  );
}
