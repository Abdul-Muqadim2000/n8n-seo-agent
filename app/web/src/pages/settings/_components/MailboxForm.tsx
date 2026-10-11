// Company settings → Mailboxes: connect or change the mailbox link-building pitches go out from (LINK_BUILDER_SPEC.md §2). SMTP + IMAP with an
// app password; the server logs in to both before it saves anything, and the password is never shown again.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { mailboxSchema, type MailboxView } from '@seo/shared';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useCreateMailbox, useUpdateMailbox } from '@/lib/queries';
import { applyServerErrors } from '@/components/site/helpers';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Checkbox, ChoiceCard, Field, Input, Select, Textarea } from '@/components/ui/field';
import { ExternalLink } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';

type Values = z.input<typeof mailboxSchema>;
type Output = z.output<typeof mailboxSchema>;

interface Provider {
  id: string;
  label: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  help: ReactNode;
  warn?: boolean;
}
const PROVIDERS: Provider[] = [
  {
    id: 'google',
    label: 'Gmail / Google Workspace',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    help: (
      <>
        Use an app password, not your normal password: turn on 2-Step Verification, then create one at{' '}
        <ExternalLink href="https://myaccount.google.com/apppasswords">myaccount.google.com/apppasswords</ExternalLink>. A Workspace admin can switch app passwords off for the
        domain.
      </>
    ),
  },
  {
    id: 'microsoft',
    label: 'Microsoft 365 / Outlook',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    warn: true,
    help: 'Sending with a password (SMTP AUTH) must be allowed for this mailbox, and Microsoft turns it off by default at the end of December 2026. Use an app password if your account has multi-factor sign-in. Port 587 uses STARTTLS.',
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    smtpHost: 'smtp.zoho.com',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: 'imap.zoho.com',
    imapPort: 993,
    imapSecure: true,
    help: 'Turn on IMAP access in Zoho Mail settings and create an application-specific password (Zoho Accounts → Security) if two-factor sign-in is on. EU accounts use smtp.zoho.eu and imap.zoho.eu.',
  },
  {
    id: 'fastmail',
    label: 'Fastmail',
    smtpHost: 'smtp.fastmail.com',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: 'imap.fastmail.com',
    imapPort: 993,
    imapSecure: true,
    help: 'Create an app password in Settings → Privacy & Security → Manage app passwords, with access to IMAP and SMTP.',
  },
  {
    id: 'other',
    label: 'Other',
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    help: 'Your provider’s SMTP (sending) and IMAP (reading replies) settings. Port 465 uses SSL from the start; port 587 uses STARTTLS (untick SSL).',
  },
];
const providerOf = (host: string) => PROVIDERS.find((p) => p.smtpHost && p.smtpHost === host.trim().toLowerCase())?.id ?? 'other';

function timeZones(current: string): string[] {
  let all: string[] = [];
  try {
    all = Intl.supportedValuesOf('timeZone');
  } catch {
    all = [];
  }
  return [...new Set([current, 'UTC', ...all])].filter(Boolean);
}
const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};
const HOURS = Array.from({ length: 25 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

// editing: the password is optional (empty = keep the current one)
const editSchema = mailboxSchema.extend({ password: z.union([z.literal(''), z.string().min(4, 'At least 4 characters').max(400)]).optional() });

function defaults(mb: MailboxView | null, company: string): Values {
  if (mb)
    return {
      label: mb.label,
      fromName: mb.fromName,
      fromEmail: mb.fromEmail,
      smtpHost: mb.smtpHost,
      smtpPort: mb.smtpPort,
      smtpSecure: mb.smtpSecure,
      imapHost: mb.imapHost,
      imapPort: mb.imapPort,
      imapSecure: mb.imapSecure,
      username: mb.username,
      password: '',
      signatureName: mb.signatureName,
      signatureTitle: mb.signatureTitle,
      company: mb.company,
      postalAddress: mb.postalAddress,
      timezone: mb.timezone,
      windowStart: mb.windowStart,
      windowEnd: mb.windowEnd,
      dailyFirstMax: mb.dailyFirstMax,
      dailyMax: mb.dailyMax,
    };
  const g = PROVIDERS[0]!;
  return {
    label: '',
    fromName: '',
    fromEmail: '',
    smtpHost: g.smtpHost,
    smtpPort: g.smtpPort,
    smtpSecure: g.smtpSecure,
    imapHost: g.imapHost,
    imapPort: g.imapPort,
    imapSecure: g.imapSecure,
    username: '',
    password: '',
    signatureName: '',
    signatureTitle: '',
    company,
    postalAddress: '',
    timezone: browserZone(),
    windowStart: 8,
    windowEnd: 17,
    dailyFirstMax: 20,
    dailyMax: 50,
  };
}

/** Connect a mailbox (`mailbox` null) or change one. */
export function MailboxDialog({ orgId, company, mailbox, onClose }: { orgId: string; company: string; mailbox: MailboxView | null; onClose: () => void }) {
  const editing = !!mailbox;
  const create = useCreateMailbox(orgId);
  const update = useUpdateMailbox(orgId);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [provider, setProvider] = useState(editing ? providerOf(mailbox.smtpHost) : 'google');
  const form = useForm<Values, unknown, Output>({
    resolver: (editing ? zodResolver(editSchema) : zodResolver(mailboxSchema)) as unknown as Resolver<Values, unknown, Output>,
    defaultValues: defaults(mailbox, company),
  });
  const { register, formState, watch, setValue, getFieldState } = form;
  const e = formState.errors;
  const fromEmail = watch('fromEmail');
  const zone = watch('timezone') ?? 'UTC';
  const zones = useMemo(() => timeZones(zone), [zone]);
  const p = PROVIDERS.find((x) => x.id === provider) ?? PROVIDERS[4]!;

  // the login name is usually the address itself: follow it until someone types their own
  useEffect(() => {
    if (!editing && !getFieldState('username').isDirty) setValue('username', fromEmail ?? '');
  }, [fromEmail, editing, getFieldState, setValue]);

  const pick = (id: string) => {
    setProvider(id);
    const x = PROVIDERS.find((v) => v.id === id);
    if (!x || id === 'other') return;
    for (const k of ['smtpHost', 'smtpPort', 'smtpSecure', 'imapHost', 'imapPort', 'imapSecure'] as const) setValue(k, x[k], { shouldDirty: true });
  };

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    if ((v.windowEnd ?? 17) <= (v.windowStart ?? 8)) {
      form.setError('windowEnd', { message: 'The window must end after it starts' });
      return;
    }
    try {
      if (editing) {
        // only what changed: a change to the login (host, port, username, password) is tested before it is saved
        const dirty = formState.dirtyFields as Partial<Record<keyof Values, boolean>>;
        const body: Record<string, unknown> = {};
        for (const k of Object.keys(dirty) as (keyof Output)[]) if (dirty[k] && k !== 'fromEmail' && k !== 'password') body[k] = v[k];
        if (v.password) body.password = v.password;
        if (!Object.keys(body).length) return onClose();
        await update.mutateAsync({ id: mailbox.id, ...body });
        toast.success(`${mailbox.fromEmail} saved`);
      } else {
        const mb = await create.mutateAsync(v as unknown as Record<string, unknown>);
        toast.success(`${mb.fromEmail} is connected: we could log in to send and to read replies`);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'mailbox_test_failed') setError({ title: 'We could not log in with these settings', text: err.message });
      else if (err instanceof ApiRequestError && err.code === 'no_key') setError({ title: 'Mailboxes cannot be connected on this server yet', text: err.message });
      else if (!applyServerErrors(err, form.setError)) setError({ title: 'Not saved', text: errorMessage(err) });
    }
  });
  const pending = create.isPending || update.isPending;

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      wide
      title={editing ? `Change ${mailbox.fromEmail}` : 'Connect a mailbox'}
      description="Pitches go out from this address and replies are read from its inbox. We log in to both before saving; the password is stored encrypted and never shown again."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="mailbox-form" loading={pending}>
            {editing ? 'Test and save' : 'Test and connect'}
          </Button>
        </>
      }
    >
      <form id="mailbox-form" onSubmit={submit} noValidate className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="mb-2 text-[13px] font-medium text-ink">Provider</legend>
          <div role="radiogroup" aria-label="Provider" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((x) => (
              <ChoiceCard key={x.id} selected={provider === x.id} onSelect={() => pick(x.id)} title={x.label} />
            ))}
          </div>
          <Callout tone={p.warn ? 'warning' : 'info'}>{p.help}</Callout>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your name" hint="As recipients see it" error={e.fromName?.message}>
            {(f) => <Input {...f} autoComplete="name" {...register('fromName')} />}
          </Field>
          <Field label="E-mail address" hint={editing ? 'To use another address, connect it as a new mailbox' : undefined} error={e.fromEmail?.message}>
            {(f) => <Input {...f} type="email" autoComplete="email" readOnly={editing} {...register('fromEmail')} />}
          </Field>
          <Field label="Username" hint="Usually the e-mail address" error={e.username?.message}>
            {(f) => <Input {...f} autoComplete="username" {...register('username')} />}
          </Field>
          <Field label={editing ? 'New app password' : 'App password'} optional={editing} hint={editing ? 'Leave empty to keep the current one' : 'Never shown again after saving'} error={e.password?.message}>
            {(f) => <Input {...f} type="password" autoComplete="new-password" {...register('password')} />}
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-[13px] font-medium text-ink">Server settings</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <Field label="SMTP server (sending)" error={e.smtpHost?.message}>
              {(f) => <Input {...f} placeholder="smtp.example.com" {...register('smtpHost')} />}
            </Field>
            <Field label="Port" error={e.smtpPort?.message}>
              {(f) => <Input {...f} type="number" inputMode="numeric" {...register('smtpPort', { valueAsNumber: true })} />}
            </Field>
            <Field label="IMAP server (replies)" error={e.imapHost?.message}>
              {(f) => <Input {...f} placeholder="imap.example.com" {...register('imapHost')} />}
            </Field>
            <Field label="Port" error={e.imapPort?.message}>
              {(f) => <Input {...f} type="number" inputMode="numeric" {...register('imapPort', { valueAsNumber: true })} />}
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <Checkbox label="SMTP: SSL from the start (port 465)" description="Off: STARTTLS (port 587)" {...register('smtpSecure')} />
            <Checkbox label="IMAP: SSL (port 993)" {...register('imapSecure')} />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-[13px] font-medium text-ink">Signature and footer</legend>
          <p className="text-[13px] text-ink-3">Every e-mail ends with who is writing, your postal address and a way to say no: the law asks for them (CAN-SPAM, GDPR, PECR).</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Name in the signature" optional hint="Defaults to your name" error={e.signatureName?.message}>
              {(f) => <Input {...f} {...register('signatureName')} />}
            </Field>
            <Field label="Job title" optional error={e.signatureTitle?.message}>
              {(f) => <Input {...f} {...register('signatureTitle')} />}
            </Field>
            <Field label="Company" optional error={e.company?.message}>
              {(f) => <Input {...f} autoComplete="organization" {...register('company')} />}
            </Field>
          </div>
          <Field label="Business postal address" hint="Required: every first e-mail carries it" error={e.postalAddress?.message}>
            {(f) => <Textarea {...f} rows={2} maxLength={240} autoComplete="street-address" {...register('postalAddress')} />}
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-[13px] font-medium text-ink">Sending</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Time zone" error={e.timezone?.message}>
              {(f) => (
                <Select {...f} {...register('timezone')}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Window starts" hint="Monday to Friday" error={e.windowStart?.message}>
              {(f) => (
                <Select {...f} {...register('windowStart', { valueAsNumber: true })}>
                  {HOURS.slice(0, 24).map((h) => (
                    <option key={h} value={h}>
                      {hh(h)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Window ends" error={e.windowEnd?.message}>
              {(f) => (
                <Select {...f} {...register('windowEnd', { valueAsNumber: true })}>
                  {HOURS.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {hh(h)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="First e-mails a day" hint="At most 30. A new mailbox warms up: 5 a day the first week, 10 the second, then this limit." error={e.dailyFirstMax?.message}>
              {(f) => <Input {...f} type="number" inputMode="numeric" min={1} max={30} {...register('dailyFirstMax', { valueAsNumber: true })} />}
            </Field>
            <Field label="All e-mails a day" hint="At most 50, follow-ups and answers included" error={e.dailyMax?.message}>
              {(f) => <Input {...f} type="number" inputMode="numeric" min={1} max={50} {...register('dailyMax', { valueAsNumber: true })} />}
            </Field>
            <Field label="Label" optional hint="Only you see it, e.g. “Sales”" error={e.label?.message}>
              {(f) => <Input {...f} maxLength={60} {...register('label')} />}
            </Field>
          </div>
        </fieldset>

        {error && (
          <Callout tone="critical" title={error.title}>
            {error.text}
          </Callout>
        )}
      </form>
    </Dialog>
  );
}
