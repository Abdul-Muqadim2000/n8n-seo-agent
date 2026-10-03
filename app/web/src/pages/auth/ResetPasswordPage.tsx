import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { resetSchema } from '@seo/shared';
import type { z } from 'zod';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { errorMessage } from '@/lib/api';
import { usePost } from '@/lib/queries';
import { AuthCard } from './shared';

type Values = z.input<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = usePost<Values>('/api/auth/reset');
  const form = useForm<Values>({ resolver: zodResolver(resetSchema), defaultValues: { token, password: '' } });

  if (!token)
    return (
      <AuthCard title="Link incomplete">
        <Callout tone="warning">This reset link is missing its code. Open the link from the e-mail again, or request a new one.</Callout>
        <ButtonLink to="/forgot-password" variant="secondary" className="mt-5 w-full">
          Request a new link
        </ButtonLink>
      </AuthCard>
    );

  if (reset.isSuccess)
    return (
      <AuthCard title="Password changed">
        <div className="flex items-start gap-3 text-sm text-ink-2">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good-text" />
          Your new password is set. For safety, every other session was signed out.
        </div>
        <ButtonLink to="/login" className="mt-6 w-full" size="lg">
          Sign in
        </ButtonLink>
      </AuthCard>
    );

  return (
    <AuthCard title="Choose a new password" footer={<Link to="/login" className="font-medium text-accent-text hover:underline">Back to sign in</Link>}>
      <form onSubmit={form.handleSubmit((v) => reset.mutate(v))} className="space-y-4" noValidate>
        <Field label="New password" hint="At least 10 characters, with letters and numbers or symbols." error={form.formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" autoFocus {...form.register('password')} />}
        </Field>
        {reset.isError && <Callout tone="critical">{errorMessage(reset.error)}</Callout>}
        <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
          Set password
        </Button>
      </form>
    </AuthCard>
  );
}
