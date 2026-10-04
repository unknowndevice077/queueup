import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Field } from '@/components/ui';
import { ApiError } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginForm = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Owner', email: 'owner@demo.queueup' },
  { label: 'Staff', email: 'staff@demo.queueup' },
  { label: 'Customer', email: 'customer@demo.queueup' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: LoginForm) => {
    setFormError(null);
    try {
      const profile = await login(values.email, values.password);
      const next = params.get('next');
      if (next && next.startsWith('/')) {
        navigate(next, { replace: true });
      } else {
        navigate(profile.memberships.length > 0 ? '/dashboard' : '/my/bookings', { replace: true });
      }
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not sign in. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">
        New here?{' '}
        <Link
          to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`}
          className="font-medium text-brand-600 underline"
        >
          Create an account
        </Link>
      </p>
      <Card className="mt-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>
      </Card>
      <Card className="mt-4 bg-brand-50 ring-brand-100">
        <p className="text-sm font-semibold text-brand-900">Demo accounts (password Demo12345!)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="rounded-md bg-white px-2.5 py-1 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
              onClick={() => {
                setValue('email', account.email);
                setValue('password', 'Demo12345!');
              }}
            >
              Use {account.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
