// Company settings → Mailboxes (v4.13 Link Builder): the mailboxes link-building pitches go out from (status, today's counts and the warm-up,
// SPF / DMARC / DKIM, replies read, errors; test, change, pause, remove) and the company's opt-out list. Admins change, members read.
import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, Pause, Pencil, Play, Plus, ShieldBan, ShieldCheck, Trash2, Wifi } from 'lucide-react';
import type { DnsCheck, MailboxView } from '@seo/shared';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useAddSuppression, useDeleteMailbox, useDeleteSuppression, useMailboxAction, useMailboxes, useSuppressions, useTestMailbox, type MailboxTestResult, type Suppression } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { IconTile, ProgressBar, Stagger } from '@/components/insight';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { MailboxDialog } from './MailboxForm';
import { SettingsCard } from './SettingsCard';

const STATUS: Record<MailboxView['status'], { tone: Tone; label: string }> = {
  active: { tone: 'good', label: 'Sending' },
  paused: { tone: 'warning', label: 'Paused' },
  error: { tone: 'critical', label: 'Error' },
};
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function MailboxesTab() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const q = useMailboxes(org.id);
  const [edit, setEdit] = useState<MailboxView | 'new' | null>(null);
  const [remove, setRemove] = useState<MailboxView | null>(null);

  return (
    <Stagger className="max-w-4xl space-y-5">
      <SettingsCard
        icon={<Mail />}
        title="Mailboxes"
        description="Link-building pitches go out from your own address, a few a day, and replies are read from its inbox."
        info="Sent Monday to Friday inside the sending window, 4–9 minutes apart, plain text with no tracking, with a copy in your Sent folder. A mailbox pauses itself at 3 bounces in 50 sends or a policy block from the mail server."
        actions={
          admin ? (
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>
              Connect a mailbox
            </Button>
          ) : undefined
        }
      >
        <CardBody>
          {q.isPending ? (
            <Skeleton className="h-40" />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} title="Could not load the mailboxes" />
          ) : q.data.length ? (
            <ul className="space-y-3">
              {q.data.map((m) => (
                <MailboxCard key={m.id} m={m} admin={admin} onEdit={() => setEdit(m)} onRemove={() => setRemove(m)} />
              ))}
            </ul>
          ) : (
            <EmptyState
              className="py-8"
              icon={<Mail className="size-5" />}
              title="No mailbox connected"
              description="Pitches go out from your own address so replies come back to you. Connect Gmail, Google Workspace, Microsoft 365, Zoho, Fastmail or any mail host with an app password."
              action={
                admin ? (
                  <Button icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>
                    Connect a mailbox
                  </Button>
                ) : (
                  <span className="text-sm text-ink-3">An admin of your company connects it.</span>
                )
              }
            />
          )}
        </CardBody>
      </SettingsCard>

      <OptOutCard />

      {edit && <MailboxDialog orgId={org.id} company={org.name} mailbox={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {remove && <RemoveDialog m={remove} onClose={() => setRemove(null)} />}
    </Stagger>
  );
}

function MailboxCard({ m, admin, onEdit, onRemove }: { m: MailboxView; admin: boolean; onEdit: () => void; onRemove: () => void }) {
  const { org } = useOrgCtx();
  const test = useTestMailbox(org.id);
  const act = useMailboxAction(org.id);
  const [result, setResult] = useState<MailboxTestResult | null>(null);
  const st = STATUS[m.status] ?? STATUS.error;
  const warming = m.today.firstCap < Math.min(30, m.dailyFirstMax);
  const run = () =>
    test.mutate(
      { id: m.id },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.ok) toast.success(`${m.fromEmail}: sending and reading replies work`);
          else toast.error(`${m.fromEmail}: the test failed`);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  const toggle = (action: 'pause' | 'resume') =>
    act.mutate({ id: m.id, action }, { onSuccess: () => toast.success(`${m.fromEmail} ${action === 'pause' ? 'paused' : 'resumed'}`), onError: (e) => toast.error(errorMessage(e)) });

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start gap-3">
        <IconTile size="md">
          <Mail />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{m.label || m.fromName}</span>
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          </div>
          <p className="mt-0.5 text-[13px] break-all text-ink-2">{m.fromEmail}</p>
          {m.statusReason && m.status !== 'active' && <p className="mt-1 text-[13px] text-warning-text">{m.statusReason}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProgressBar label="First e-mails today" valueLabel={`${m.today.first} of ${m.today.firstCap}`} value={m.today.first} max={Math.max(1, m.today.firstCap)} />
        <ProgressBar label="All e-mails today" valueLabel={`${m.today.total} of ${m.today.totalCap}`} value={m.today.total} max={Math.max(1, m.today.totalCap)} />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        {warming ? `Warming up since ${fmtDate(m.startedAt)}: ${m.today.firstCap} first e-mails a day now (5 → 10 → your limit of ${m.dailyFirstMax}). ` : ''}
        Sends Mon–Fri {hh(m.windowStart)}–{hh(m.windowEnd)} ({m.timezone}) · replies checked {m.lastPollAt ? fmtAgo(m.lastPollAt) : 'not yet'} · last sent {m.lastSendAt ? fmtAgo(m.lastSendAt) : 'never'}
      </p>
      {m.lastError && <p className="mt-1.5 text-xs font-medium text-critical-text [overflow-wrap:anywhere]">Last error: {m.lastError}</p>}

      <DnsChecks dns={result?.dns ?? m.dns} />

      {result && (
        <Callout className="mt-3" tone={result.ok ? 'good' : 'critical'} title={result.ok ? 'Both logins work' : 'The test failed'}>
          <span className="block">Sending (SMTP): {result.smtp.ok ? 'works' : result.smtp.error || 'failed'}</span>
          <span className="block">Reading replies (IMAP): {result.imap.ok ? 'works' : result.imap.error || 'failed'}</span>
        </Callout>
      )}

      <details className="mt-3 text-[13px] text-ink-2">
        <summary className="cursor-pointer text-xs font-medium text-accent-text">Connection and signature</summary>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt className="text-ink-3">Sending</dt>
          <dd className="break-all">
            {m.smtpHost}:{m.smtpPort} · {m.smtpSecure ? 'SSL' : 'STARTTLS'}
          </dd>
          <dt className="text-ink-3">Replies</dt>
          <dd className="break-all">
            {m.imapHost}:{m.imapPort} · {m.imapSecure ? 'SSL' : 'plain'}
          </dd>
          <dt className="text-ink-3">Username</dt>
          <dd className="break-all">{m.username}</dd>
          <dt className="text-ink-3">Signature</dt>
          <dd>{[m.signatureName || m.fromName, m.signatureTitle, m.company].filter(Boolean).join(' · ')}</dd>
          <dt className="text-ink-3">Postal address</dt>
          <dd>{m.postalAddress || <span className="text-critical-text">missing: nothing can be sent until it is added</span>}</dd>
          <dt className="text-ink-3">Limits</dt>
          <dd>
            {m.dailyFirstMax} first e-mails, {m.dailyMax} in all a day
          </dd>
        </dl>
      </details>

      {admin && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button size="sm" variant="secondary" icon={<Wifi className="size-3.5" />} loading={test.isPending} onClick={run}>
            Test
          </Button>
          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={onEdit}>
            Change
          </Button>
          {m.status === 'active' ? (
            <Button size="sm" variant="ghost" icon={<Pause className="size-3.5" />} loading={act.isPending} onClick={() => toggle('pause')}>
              Pause
            </Button>
          ) : m.status === 'paused' ? (
            <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} loading={act.isPending} onClick={() => toggle('resume')}>
              Resume
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="ml-auto" icon={<Trash2 className="size-3.5" />} onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </li>
  );
}

/** SPF / DMARC / DKIM of the From domain: they decide whether pitches reach the inbox. */
function DnsChecks({ dns }: { dns: DnsCheck | null }) {
  if (!dns) return null;
  const spf: [Tone, string] = dns.spf === 'pass' ? ['good', 'SPF set'] : dns.spf === 'weak' ? ['warning', 'SPF weak'] : ['serious', 'SPF missing'];
  const dmarc: [Tone, string] = dns.dmarc === 'pass' ? ['good', 'DMARC set'] : dns.dmarc === 'none' ? ['warning', 'DMARC p=none'] : ['serious', 'DMARC missing'];
  return (
    <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <ShieldCheck className="size-4 text-ink-3" aria-hidden />
        <span className="mr-1 text-xs font-medium text-ink-2">Inbox checks</span>
        <StatusBadge tone={spf[0]}>{spf[1]}</StatusBadge>
        <StatusBadge tone={dmarc[0]}>{dmarc[1]}</StatusBadge>
        {dns.dkim === 'found' ? <StatusBadge tone="good">DKIM found</StatusBadge> : <Badge>DKIM not found at common selectors</Badge>}
        <span className="text-xs text-ink-3">· {fmtDate(dns.checkedAt)}</span>
      </div>
      {dns.notes.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-ink-2">
          {dns.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RemoveDialog({ m, onClose }: { m: MailboxView; onClose: () => void }) {
  const { org } = useOrgCtx();
  const del = useDeleteMailbox(org.id);
  const go = () =>
    del.mutate(
      { id: m.id },
      {
        onSuccess: () => {
          toast.success(`${m.fromEmail} was removed`);
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Remove ${m.fromEmail}?`}
      description="Its stored password is deleted. Conversations that send from it are paused; you can resume them from another mailbox."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />} loading={del.isPending} onClick={go}>
            Remove
          </Button>
        </>
      }
    />
  );
}

function OptOutCard() {
  const { org, can } = useOrgCtx();
  const q = useSuppressions(org.id);
  const add = useAddSuppression(org.id);
  const del = useDeleteSuppression(org.id);
  const [value, setValue] = useState('');
  const [kind, setKind] = useState<'email' | 'domain'>('email');
  const [err, setErr] = useState<string | undefined>();
  const submit = () => {
    const v = value.trim().toLowerCase();
    if (kind === 'email' ? !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) : !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))) {
      setErr(kind === 'email' ? 'A valid e-mail address' : 'A domain like example.com');
      return;
    }
    setErr(undefined);
    add.mutate(
      { value: v, kind },
      {
        onSuccess: () => {
          toast.success('Added to the opt-out list');
          setValue('');
        },
        onError: (e) => setErr(errorMessage(e)),
      },
    );
  };
  const cols: Column<Suppression>[] = [
    { key: 'hint', header: 'Address or domain', sortValue: (r) => r.hint, cell: (r) => <span className="break-all text-ink">{r.hint}</span> },
    { key: 'kind', header: 'Kind', cell: (r) => <Badge>{r.kind === 'domain' ? 'Whole domain' : 'Address'}</Badge>, hideOnMobile: true },
    { key: 'reason', header: 'Why', cell: (r) => <span className="text-[13px] text-ink-2">{r.reason}</span>, hideOnMobile: true },
    { key: 'createdAt', header: 'Added', sortValue: (r) => r.createdAt, cell: (r) => <span className="whitespace-nowrap text-xs text-ink-3">{fmtDate(r.createdAt)}</span> },
    ...(can('admin')
      ? [
          {
            key: 'remove',
            header: <span className="sr-only">Remove</span>,
            align: 'right' as const,
            cell: (r: Suppression) => (
              <Button size="sm" variant="ghost" aria-label={`Remove ${r.hint} from the opt-out list`} loading={del.isPending && del.variables?.id === r.id} onClick={() => del.mutate({ id: r.id }, { onSuccess: () => toast.success('Removed from the opt-out list'), onError: (e) => toast.error(errorMessage(e)) })}>
                Remove
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <SettingsCard
      icon={<ShieldBan />}
      title="Opt-out list"
      description="Addresses and domains that never get another e-mail from your company: people who said no, bounces, and those you add."
      info="Opt-outs are honoured at once (the law gives 10 business days). Only a masked hint is kept, not the address itself."
    >
      <CardBody className="space-y-4">
        {can('member') && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Field label="Address or domain" error={err} className="min-w-0 flex-1">
              {(f) => <Input {...f} value={value} maxLength={200} placeholder={kind === 'email' ? 'name@example.com' : 'example.com'} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />}
            </Field>
            <Field label="Kind" className="sm:w-40">
              {(f) => (
                <Select {...f} value={kind} onChange={(e) => setKind(e.target.value as 'email' | 'domain')}>
                  <option value="email">Address</option>
                  <option value="domain">Whole domain</option>
                </Select>
              )}
            </Field>
            <Button className="sm:mt-6" variant="secondary" loading={add.isPending} disabled={!value.trim()} onClick={submit}>
              Add
            </Button>
          </div>
        )}
        {q.isPending ? (
          <Skeleton className="h-24" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} title="Could not load the opt-out list" />
        ) : (
          <DataTable rows={q.data} columns={cols} rowKey={(r) => r.id} dense searchable={q.data.length > 10} searchPlaceholder="Search the list…" initialSort={{ key: 'createdAt', dir: 'desc' }} empty="Nobody has opted out yet." />
        )}
      </CardBody>
    </SettingsCard>
  );
}
