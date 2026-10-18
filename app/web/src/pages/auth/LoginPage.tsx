import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { KeyRound } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loginSchema, type Me, type MfaChallenge } from '@seo/shared';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { qk } from '@/lib/queries';
import { usePortalContext } from '@/lib/portal';
import { AuthCard, GOOGLE_ERRORS, GoogleButton, safeNext } from './shared';
import { SecondStep } from './SecondStep';

type Values = z.input<typeof loginSchema>;

export default function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const qc = useQueryClient();
  // G1: with two-step verification on, the password answers with a challenge instead of a session
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const login = useMutation({ mutationFn: (v: Values) => api<Me | MfaChallenge>('/api/auth/login', { method: 'POST', body: v }) });
  const form = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const googleError = params.get('error');
  // G5: on an agency's portal host Google and single sign-on run on the app's own address and hand the session back here
  const portal = usePortalContext().data ?? null;
  const viaApp = portal ? `${portal.appUrl}/login?next=${encodeURIComponent(`/portal-handoff?host=${portal.host}`)}` : null;
  // G1: the server leaves a short-lived hint when it ended a session for inactivity
  const [idle] = useState(() => {
    const was = typeof document !== 'undefined' && /(?:^|;\s*)signed_out=idle/.test(document.cookie);
    if (was) document.cookie = 'signed_out=; Max-Age=0; path=/';
    return was;
  });

  const onSubmit = form.handleSubmit((v) =>
    login.mutate(v, {
      onSuccess: (r) => {
        if ('mfaRequired' in r) return setChallenge(r);
        qc.setQueryData(qk.me, r);
        navigate(next ?? '/', { replace: true });
      },
      onError: (e) => {
        // G1: this address signs in through its company's identity provider: go there
        if (e instanceof ApiRequestError && e.code === 'sso_required' && typeof e.data.ssoUrl === 'string') {
          if (viaApp) return window.location.assign(viaApp);
          window.location.assign(`${e.data.ssoUrl}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
          return;
        }
        if (e instanceof ApiRequestError) for (const [k, m] of Object.entries(e.fields)) form.setError(k as keyof Values, { message: m });
      },
    }),
  );

  if (challenge)
    return (
      <SecondStep
        methods={challenge.methods}
        emailHint={challenge.emailHint}
        next={next}
        onCancel={() => {
          void api('/api/auth/mfa/cancel', { method: 'POST' }).catch(() => undefined);
          setChallenge(null);
          form.setValue('password', '');
        }}
      />
    );

  return (
    <AuthCard
      title="Sign in"
      subtitle={portal ? 'Sign in to your SEO portal.' : "Welcome back. Sign in to your company's SEO workspace."}
      footer={
        portal ? (
          <>Access to this portal is by invitation.</>
        ) : (
          <>
            New here?{' '}
            <Link to={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className="font-medium text-accent-text hover:underline">
              Create an account
            </Link>
          </>
        )
      }
    >
      {idle && (
        <Callout tone="info" className="mb-5">
          You were signed out after a period of inactivity, as your company asks. Sign in again to continue.
        </Callout>
      )}
      {googleError && (
        <Callout tone="critical" className="mb-5">
          {GOOGLE_ERRORS[googleError] ?? googleError}
        </Callout>
      )}
      {!portal && <GoogleButton next={next} />}
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
      {viaApp ? (
        <a
          href={viaApp}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink-2 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink"
        >
          <KeyRound className="size-4" aria-hidden /> Sign in with Google or your company account
        </a>
      ) : (
        <Link
          to={`/login/sso${next ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink-2 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink"
        >
          <KeyRound className="size-4" aria-hidden /> Sign in with SSO
        </Link>
      )}
    </AuthCard>
  );
}
