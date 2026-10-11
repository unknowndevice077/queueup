import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button, Field } from '@/components/ui';
import { AuthShell } from '@/components/AuthShell';
import { useToast } from '@/components/Toaster';
import { api, ApiError } from '@/lib/api';
import type { TenantSettings } from '@/lib/types';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the business name').max(120),
  slug: z
    .string()
    .min(3, 'At least 3 characters')
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and single dashes only'),
  contactPhone: z.string().max(32).optional(),
});

type CreateForm = z.infer<typeof schema>;

export function CreateBusinessPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { reloadProfile } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(schema) });
  const slug = watch('slug');

  const onSubmit = async (values: CreateForm) => {
    try {
      const tenant = await api.post<TenantSettings>('/api/tenants', { ...values, timezone: 'Asia/Manila' });
      await reloadProfile();
      toast.success(`${tenant.name} is set up. Add your services next.`);
      navigate(`/dashboard/${tenant.slug}/services`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError('slug', { message: 'That address is taken. Try another.' });
      } else {
        toast.error(error);
      }
    }
  };

  return (
    <AuthShell
      title="Set up your business"
      intro="You'll be the owner. Staff, services and opening hours come next."
      aside={
        <div className="text-sm text-ink-2">
          <p className="caption">Your booking page</p>
          <p className="num mt-3 break-all text-[15px] text-ink">
            {window.location.host}/b/<span className="text-pine-600">{slug || 'your-shop'}</span>
          </p>
          <p className="mt-3 text-ink-muted">
            Print it on a QR code by the door. Walk-ins use the same address with{' '}
            <span className="num">/queue</span>.
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field
          label="Business name"
          placeholder="Kanto Cuts Barbershop"
          {...register('name')}
          error={errors.name?.message}
        />
        <Field
          label="Booking page address"
          hint="Lowercase letters, numbers and dashes."
          placeholder="kanto-cuts"
          autoCapitalize="none"
          {...register('slug')}
          error={errors.slug?.message}
        />
        <Field label="Contact number (optional)" type="tel" {...register('contactPhone')} />
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Create business
        </Button>
      </form>
    </AuthShell>
  );
}
