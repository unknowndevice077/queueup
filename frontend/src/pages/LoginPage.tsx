import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button, Field } from '@/components/ui';
import { AuthShell, FormError } from '@/components/AuthShell';
import { ApiError } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginForm = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Owner', email: 'owner@demo.queueup', note: 'Both demo businesses' },
  { label: 'Staff', email: 'staff@demo.queueup', note: 'Barber at Kanto Cuts' },
  { label: 'Customer', email: 'customer@demo.queueup', note: 'Has upcoming bookings' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: LoginForm) => {
    setFormError(null);
    try {
      const profile = await login(values.email, values.password);
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
    <AuthShell
      title="Sign in"
      intro={
        <>
          No account yet?{' '}
          <Link
            to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-ink underline underline-offset-4"
          >
            Create one
          </Link>
          . It takes a minute.
        </>
      }
      aside={
        <div>
          <p className="caption">Demo accounts</p>
          <p className="mt-2 text-sm text-ink-2">
            Every demo account uses the password <span className="num">Demo12345!</span>
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{account.label}</p>
                  <p className="num truncate text-[13px] text-ink-muted">{account.email}</p>
                  <p className="text-xs text-ink-faint">{account.note}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setValue('email', account.email);
                    setValue('password', 'Demo12345!');
                    setFocus('password');
                  }}
                >
                  Use {account.label}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <FormError message={formError} />
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
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
