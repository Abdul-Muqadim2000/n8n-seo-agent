import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { MailCheck } from 'lucide-react';
import { forgotSchema } from '@seo/shared';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { errorMessage } from '@/lib/api';
import { usePost, useProviders } from '@/lib/queries';
import { AuthCard } from './shared';

type Values = z.input<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const send = usePost<Values>('/api/auth/forgot');
  const providers = useProviders();
  const form = useForm<Values>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  // the platform sends no e-mails: a reset link comes from the platform administrator
  if (providers.data && !providers.data.email)
    return (
      <AuthCard title="Reset your password" footer={<Link to="/login" className="font-medium text-accent-text hover:underline">Back to sign in</Link>}>
        <div className="flex items-start gap-3 text-sm leading-relaxed text-ink-2">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-ink-3" />
          This platform does not send e-mails. Ask your platform administrator for a password reset link: they create it in the admin area and it works for 24 hours.
          If you signed up with Google, use “Continue with Google” instead.
        </div>
      </AuthCard>
    );

  if (send.isSuccess)
    return (
      <AuthCard title="Check your inbox" footer={<Link to="/login" className="font-medium text-accent-text hover:underline">Back to sign in</Link>}>
        <div className="flex items-start gap-3 text-sm leading-relaxed text-ink-2">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-good-text" />
          If an account exists for {form.getValues('email')}, we have sent a link to set a new password. It works for one hour.
        </div>
      </AuthCard>
    );

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter the e-mail of your account and we send you a link to choose a new password."
      footer={
        <Link to="/login" className="font-medium text-accent-text hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-4" noValidate>
        <Field label="E-mail" error={form.formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        {send.isError && <Callout tone="critical">{errorMessage(send.error)}</Callout>}
        <Button type="submit" size="lg" className="w-full" loading={send.isPending}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
