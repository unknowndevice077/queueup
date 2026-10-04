import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Field } from '@/components/ui';
import { ApiError } from '@/lib/api';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.string().email('Enter a valid email'),
  phone: z
    .string()
    .regex(/^[0-9+()\-\s]*$/, 'Use digits, spaces, + or -')
    .max(32)
    .optional(),
  password: z
    .string()
    .min(10, 'At least 10 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number'),
});

type RegisterForm = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: RegisterForm) => {
    setFormError(null);
    try {
      await signUp({ ...values, phone: values.phone || undefined });
      const next = params.get('next');
      navigate(next && next.startsWith('/') ? next : '/my/bookings', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors()).forEach(([field, message]) =>
          setError(field as keyof RegisterForm, { message }),
        );
        setFormError(error.message);
      } else {
        setFormError('Could not create your account. Please try again.');
      }
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-600 underline">
          Sign in
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
            label="Full name"
            autoComplete="name"
            {...register('fullName')}
            error={errors.fullName?.message}
          />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />
          <Field
            label="Mobile number (optional)"
            type="tel"
            autoComplete="tel"
            placeholder="0917 123 4567"
            {...register('phone')}
            error={errors.phone?.message}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters with a letter and a number."
            {...register('password')}
            error={errors.password?.message}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Create account
          </Button>
        </form>
      </Card>
    </div>
  );
}
