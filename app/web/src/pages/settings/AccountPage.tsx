import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building2, ChevronRight, KeyRound, Lock, LogIn, LogOut, Mail, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { changePasswordSchema, updateMeSchema, type Me } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { IconTile, Stagger } from '@/components/insight';
import { Callout, PageLoader } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Avatar } from '@/components/ui/misc';
import { applyServerErrors } from '@/components/site/helpers';
import { errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { useLogout, useMe, usePost, useProviders, useUpdateMe } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { StandaloneShell } from './_components/StandaloneShell';
import { RoleChip, SettingsCard } from './_components/SettingsCard';

export default function AccountPage() {
  const me = useMe();
  if (!me.data) return <PageLoader fullPage />;
  return (
    <StandaloneShell icon={<UserRound />} title="Your account" description="Your name, e-mail, sign-in methods and companies.">
      <Stagger className="space-y-4">
        <ProfileSection me={me.data} />
        <EmailSection me={me.data} />
        <SignInSection me={me.data} />
        <PasswordSection me={me.data} />
        <CompaniesSection me={me.data} />
        <SignOutSection />
      </Stagger>
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
    <SettingsCard icon={<UserRound />} title="Profile" description={`Shown to your team. Member since ${fmtDate(me.user.createdAt)}.`}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 pt-4 pb-5 sm:flex-row sm:items-start">
        <Avatar name={me.user.name} src={me.user.avatarUrl} size={56} className="ring-4 ring-accent-soft" />
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
    </SettingsCard>
  );
}

function EmailSection({ me }: { me: Me }) {
  const resend = usePost<void, { ok: boolean; sent: boolean }>('/api/auth/resend-verification', [['me']]);
  const providers = useProviders();
  // account e-mails off: nothing to confirm by e-mail, the address is only the sign-in name
  const confirming = !!providers.data?.email;
  return (
    <SettingsCard icon={<Mail />} title="E-mail address" description={confirming ? 'Used to sign in and for invitations.' : 'Used to sign in. This platform sends no e-mails: every result and invitation link is shown here.'}>
      <div className="px-5 pt-4 pb-5">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2/40 px-4 py-3">
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
      </div>
    </SettingsCard>
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
    <SettingsCard icon={<KeyRound />} title="Sign-in methods" description="Ways you can sign in to this account.">
      <div className="px-5 pt-4 pb-5">
        <ul className="divide-y divide-line rounded-xl border border-line">
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-3 text-sm text-ink">
              <IconTile size="sm" tone={me.user.googleLinked ? 'blue' : 'neutral'}>
                <LogIn />
              </IconTile>
              Google
            </span>
            {me.user.googleLinked ? (
              <StatusBadge tone="good">Linked</StatusBadge>
            ) : providers.data?.google ? (
              <a href="/api/auth/google" className="text-[13px] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
                Link Google account
              </a>
            ) : (
              <Badge>Not linked</Badge>
            )}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-3 text-sm text-ink">
              <IconTile size="sm" tone={me.user.hasPassword ? 'blue' : 'neutral'}>
                <Lock />
              </IconTile>
              E-mail and password
            </span>
            {me.user.hasPassword ? <StatusBadge tone="good">Set</StatusBadge> : <Badge>No password</Badge>}
          </li>
        </ul>
        {!me.user.googleLinked && providers.data?.google && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
            Choose the Google account you want to sign in with. If it uses {me.user.email}, linking also confirms your e-mail.
          </p>
        )}
      </div>
    </SettingsCard>
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
    <SettingsCard
      icon={<ShieldCheck />}
      title={has ? 'Change password' : 'Set a password'}
      description={has ? 'At least 10 characters, with letters and numbers or symbols.' : 'You sign in with Google. A password lets you sign in with your e-mail too.'}
    >
      <form onSubmit={submit} noValidate className="max-w-sm space-y-4 px-5 pt-4 pb-5">
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
    </SettingsCard>
  );
}

function CompaniesSection({ me }: { me: Me }) {
  return (
    <SettingsCard icon={<Building2 />} title="Companies" description="The companies you belong to and your role in each.">
      <div className="px-5 pt-4 pb-5">
        {me.orgs.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {me.orgs.map((o) => (
              <li key={o.id} className="first:*:rounded-t-[13px] last:*:rounded-b-[13px]">
                <Link to={paths.org(o.id)} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-brand hover:bg-surface-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ink-surface text-[11px] font-semibold text-on-ink dark:bg-surface-3 dark:text-ink" aria-hidden>
                    {orgInitials(o.name)}
                  </span>
                  {/* the name keeps its room: the badges wrap under it in a narrow column instead of truncating it */}
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="min-w-0 max-w-full truncate text-sm font-medium text-ink">{o.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!o.onboardedAt && <StatusBadge tone="warning">Setup not finished</StatusBadge>}
                      <RoleChip role={o.role} />
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
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
      </div>
    </SettingsCard>
  );
}

function SignOutSection() {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <SettingsCard
      icon={<LogOut />}
      iconTone="neutral"
      title="Sign out"
      description="Ends your session in this browser."
      className="pb-5"
      actions={
        <Button
          variant="secondary"
          icon={<LogOut className="size-4" />}
          loading={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }), onError: (e) => toast.error(errorMessage(e)) })}
        >
          Sign out
        </Button>
      }
    />
  );
}

/** Two initials of a company name, as in the company switcher. */
function orgInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}
