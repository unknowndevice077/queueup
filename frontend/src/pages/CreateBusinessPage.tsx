import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Field } from '@/components/ui';
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
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: CreateForm) => {
    try {
      const tenant = await api.post<TenantSettings>('/api/tenants', { ...values, timezone: 'Asia/Manila' });
      await reloadProfile();
      toast.success(`${tenant.name} is ready. Add your services next.`);
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
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold">Set up your business</h1>
      <p className="mt-1 text-sm text-slate-600">You will be the owner. You can invite staff afterwards.</p>
      <Card className="mt-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="Business name" {...register('name')} error={errors.name?.message} />
          <Field
            label="Booking page address"
            hint="Customers will book at /b/your-address"
            placeholder="my-barbershop"
            {...register('slug')}
            error={errors.slug?.message}
          />
          <Field label="Contact number (optional)" type="tel" {...register('contactPhone')} />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Create business
          </Button>
        </form>
      </Card>
    </div>
  );
}
