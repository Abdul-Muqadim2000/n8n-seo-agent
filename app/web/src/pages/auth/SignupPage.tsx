import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { signupSchema } from '@seo/shared';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useAuthMutation, useProviders } from '@/lib/queries';
import { AuthCard, GoogleButton, safeNext } from './shared';

type Values = z.input<typeof signupSchema>;

export default function SignupPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const inviteToken = next?.match(/^\/invite\/([^/?#]+)/)?.[1];
  const navigate = useNavigate();
  const signup = useAuthMutation<Values>('/api/auth/signup');
  const providers = useProviders();
  const form = useForm<Values>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: params.get('email') ?? '', password: '', inviteToken },
  });

  const onSubmit = form.handleSubmit((v) =>
    signup.mutate(v, {
      onSuccess: () => navigate(next ?? '/onboarding', { replace: true }),
      onError: (e) => {
        if (e instanceof ApiRequestError) for (const [k, m] of Object.entries(e.fields)) form.setError(k as keyof Values, { message: m });
      },
    }),
  );

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start with your account, then set up your company and connect your website. It takes about five minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-medium text-accent-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton next={next ?? '/onboarding'} label="Sign up with Google" />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Your name" error={form.formState.errors.name?.message}>
          {(p) => <Input {...p} autoComplete="name" placeholder="Sara Khan" {...form.register('name')} />}
        </Field>
        <Field label="Work e-mail" error={form.formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />}
        </Field>
        <Field label="Password" hint="At least 10 characters, with letters and numbers or symbols." error={form.formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('password')} />}
        </Field>
        {signup.isError && !Object.keys((signup.error as ApiRequestError).fields ?? {}).length && <Callout tone="critical">{errorMessage(signup.error)}</Callout>}
        <Button type="submit" size="lg" className="w-full" loading={signup.isPending}>
          Create account
        </Button>
        {providers.data?.email && <p className="text-center text-xs leading-relaxed text-ink-3">We send a link to confirm your e-mail. Analyses start once it is confirmed.</p>}
      </form>
    </AuthCard>
  );
}
