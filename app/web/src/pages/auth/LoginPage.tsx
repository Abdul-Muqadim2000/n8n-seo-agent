import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { loginSchema } from '@seo/shared';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useAuthMutation } from '@/lib/queries';
import { AuthCard, GOOGLE_ERRORS, GoogleButton, safeNext } from './shared';

type Values = z.input<typeof loginSchema>;

export default function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const login = useAuthMutation<Values>('/api/auth/login');
  const form = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const googleError = params.get('error');

  const onSubmit = form.handleSubmit((v) =>
    login.mutate(v, {
      onSuccess: () => navigate(next ?? '/', { replace: true }),
      onError: (e) => {
        if (e instanceof ApiRequestError) for (const [k, m] of Object.entries(e.fields)) form.setError(k as keyof Values, { message: m });
      },
    }),
  );

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Sign in to your company's SEO workspace."
      footer={
        <>
          New here?{' '}
          <Link to={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className="font-medium text-accent-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {googleError && (
        <Callout tone="critical" className="mb-5">
          {GOOGLE_ERRORS[googleError] ?? googleError}
        </Callout>
      )}
      <GoogleButton next={next} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Work e-mail" error={form.formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />}
        </Field>
        <Field
          label="Password"
          labelAction={
            <Link to="/forgot-password" className="rounded-sm text-xs font-medium text-accent-text underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          }
          error={form.formState.errors.password?.message}
        >
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...form.register('password')} />}
        </Field>
        {login.isError && !Object.keys((login.error as ApiRequestError).fields ?? {}).length && <Callout tone="critical">{errorMessage(login.error)}</Callout>}
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
