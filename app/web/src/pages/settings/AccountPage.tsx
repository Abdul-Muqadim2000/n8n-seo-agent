import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building2, ChevronRight, LogOut, Plus } from 'lucide-react';
import { changePasswordSchema, ROLE_LABELS, updateMeSchema, type Me } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, Section } from '@/components/ui/card';
import { Callout, PageLoader } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Avatar } from '@/components/ui/misc';
import { applyServerErrors } from '@/components/site/helpers';
import { errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { useLogout, useMe, usePost, useProviders, useUpdateMe } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { StandaloneShell } from './_components/StandaloneShell';

export default function AccountPage() {
  const me = useMe();
  if (!me.data) return <PageLoader />;
  return (
    <StandaloneShell title="Your account" description="Your name, e-mail, sign-in methods and companies.">
      <Card className="px-5 sm:px-7">
        <ProfileSection me={me.data} />
        <EmailSection me={me.data} />
        <SignInSection me={me.data} />
        <PasswordSection me={me.data} />
        <CompaniesSection me={me.data} />
        <SignOutSection />
      </Card>
    </StandaloneShell>
  );
}

type NameValues = z.input<typeof updateMeSchema>;

function ProfileSection({ me }: { me: Me }) {
  const update = useUpdateMe();
  const form = useForm<NameValues, unknown, z.output<typeof updateMeSchema>>({ resolver: zodResolver(updateMeSchema), defaultValues: { name: me.user.name } });
  const submit = form.handleSubmit((v) =>
    update.mutate(v, {
      onSuccess: (m) => {
        form.reset({ name: m.user.name });
        toast.success('Name saved');
      },
      onError: (e) => {
        if (!applyServerErrors(e, form.setError)) form.setError('name', { message: errorMessage(e) });
      },
    }),
  );
  return (
    <Section title="Profile" description={`Shown to your team. Member since ${fmtDate(me.user.createdAt)}.`}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar name={me.user.name} src={me.user.avatarUrl} size={48} />
        <Field label="Your name" error={form.formState.errors.name?.message} className="min-w-0 flex-1">
          {(p) => (
            <div className="flex gap-2">
              <Input {...p} autoComplete="name" {...form.register('name')} />
              <Button type="submit" variant="secondary" loading={update.isPending} disabled={!form.formState.isDirty} className="shrink-0">
                Save
              </Button>
            </div>
          )}
        </Field>
      </form>
    </Section>
  );
}

function EmailSection({ me }: { me: Me }) {
  const resend = usePost<void, { ok: boolean; sent: boolean }>('/api/auth/resend-verification', [['me']]);
  const providers = useProviders();
  // account e-mails off: nothing to confirm by e-mail, the address is only the sign-in name
  const confirming = !!providers.data?.email;
  return (
    <Section title="E-mail address" description={confirming ? 'Used to sign in and for invitations.' : 'Used to sign in. This platform sends no e-mails: every result and invitation link is shown here.'}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="break-all text-sm font-medium text-ink">{me.user.email}</span>
        {me.user.emailVerified ? <StatusBadge tone="good">Confirmed</StatusBadge> : confirming ? <StatusBadge tone="warning">Not confirmed</StatusBadge> : null}
      </div>
      {!me.user.emailVerified && confirming && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-ink-2">Confirm your address to start analyses. Open the link we sent you, or ask for a new one.</p>
          <Button
            variant="secondary"
            size="sm"
            loading={resend.isPending}
            onClick={() =>
              resend.mutate(undefined, {
                onSuccess: (r) =>
                  r.sent
                    ? toast.success(`A new link is on its way to ${me.user.email}`)
                    : toast.info('No e-mail was sent', { description: 'Your address may already be confirmed (reload the page), or e-mail is not set up on this server.' }),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            Resend verification e-mail
          </Button>
        </div>
      )}
    </Section>
  );
}

function SignInSection({ me }: { me: Me }) {
  const providers = useProviders();
  const [params, setParams] = useSearchParams();
  // result of "Link Google account" (the server redirects back here)
  useEffect(() => {
    const err = params.get('error');
    if (params.get('linked') === 'google') toast.success('Google account linked. You can now sign in with Google.');
    else if (err === 'google_linked_elsewhere') toast.error('That Google account already belongs to another user of this platform.');
    else if (err) toast.error('Google did not complete the link. Please try again.');
    if (params.has('linked') || params.has('error')) setParams({}, { replace: true });
  }, [params, setParams]);
  return (
    <Section title="Sign-in methods" description="Ways you can sign in to this account.">
      <ul className="divide-y divide-line rounded-xl border border-line">
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-ink">Google</span>
          {me.user.googleLinked ? (
            <StatusBadge tone="good">Linked</StatusBadge>
          ) : providers.data?.google ? (
            <a href="/api/auth/google" className="text-[13px] font-medium text-accent-text hover:underline">
              Link Google account
            </a>
          ) : (
            <Badge>Not linked</Badge>
          )}
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-ink">E-mail and password</span>
          {me.user.hasPassword ? <StatusBadge tone="good">Set</StatusBadge> : <Badge>No password</Badge>}
        </li>
      </ul>
      {!me.user.googleLinked && providers.data?.google && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Choose the Google account you want to sign in with. If it uses {me.user.email}, linking also confirms your e-mail.
        </p>
      )}
    </Section>
  );
}

const passwordForm = changePasswordSchema.extend({ confirm: z.string() }).refine((v) => v.newPassword === v.confirm, {
  path: ['confirm'],
  message: 'The passwords do not match',
});
type PasswordValues = z.input<typeof passwordForm>;

function PasswordSection({ me }: { me: Me }) {
  const has = me.user.hasPassword;
  const change = usePost<{ currentPassword: string; newPassword: string }>('/api/me/password', [['me']]);
  const form = useForm<PasswordValues, unknown, z.output<typeof passwordForm>>({
    resolver: zodResolver(passwordForm),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const errors = form.formState.errors;
  const [error, setError] = useState<unknown>(null);
  const submit = form.handleSubmit((v) => {
    setError(null);
    if (has && !v.currentPassword) {
      form.setError('currentPassword', { message: 'Enter your current password' });
      return;
    }
    change.mutate(
      { currentPassword: has ? v.currentPassword : '', newPassword: v.newPassword },
      {
        onSuccess: () => {
          form.reset({ currentPassword: '', newPassword: '', confirm: '' });
          toast.success(has ? 'Password changed' : 'Password set', { description: has ? undefined : 'You can now also sign in with your e-mail and this password.' });
        },
        onError: (e) => {
          if (!applyServerErrors(e, form.setError)) setError(e);
        },
      },
    );
  });
  return (
    <Section
      title={has ? 'Change password' : 'Set a password'}
      description={has ? 'At least 10 characters, with letters and numbers or symbols.' : 'You sign in with Google. A password lets you sign in with your e-mail too.'}
    >
      <form onSubmit={submit} noValidate className="max-w-sm space-y-4">
        {has && (
          <Field label="Current password" error={errors.currentPassword?.message}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" {...form.register('currentPassword')} />}
          </Field>
        )}
        <Field label="New password" hint="At least 10 characters, with letters and numbers or symbols." error={errors.newPassword?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('newPassword')} />}
        </Field>
        <Field label="Repeat the new password" error={errors.confirm?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('confirm')} />}
        </Field>
        {error != null && <Callout tone="critical">{errorMessage(error)}</Callout>}
        <Button type="submit" loading={change.isPending}>
          {has ? 'Change password' : 'Set password'}
        </Button>
      </form>
    </Section>
  );
}

function CompaniesSection({ me }: { me: Me }) {
  return (
    <Section title="Companies" description="The companies you belong to and your role in each.">
      {me.orgs.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {me.orgs.map((o) => (
            <li key={o.id}>
              <Link to={paths.org(o.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <Building2 className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{o.name}</span>
                {!o.onboardedAt && <Badge tone="warning">Setup not finished</Badge>}
                <Badge>{ROLE_LABELS[o.role]}</Badge>
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">You are not in a company yet.</p>
      )}
      <ButtonLink to={paths.onboarding()} variant="secondary" size="sm" className="mt-3" icon={<Plus className="size-4" />}>
        New company
      </ButtonLink>
    </Section>
  );
}

function SignOutSection() {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <Section title="Sign out" description="Ends your session in this browser.">
      <Button
        variant="secondary"
        icon={<LogOut className="size-4" />}
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }), onError: (e) => toast.error(errorMessage(e)) })}
      >
        Sign out
      </Button>
    </Section>
  );
}
