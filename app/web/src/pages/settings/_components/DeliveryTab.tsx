import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Clock, Mail, Send, Share2, Webhook } from 'lucide-react';
import {
  DELIVERY,
  DELIVERY_FREQUENCIES,
  DELIVERY_FREQUENCY_LABELS,
  DELIVERY_STATUS_LABELS,
  deliveryScheduleLabel,
  STAGE_LABELS,
  WEEKDAYS,
  type DeliveryFrequency,
  type DeliveryRecord,
  type DeliverySettings,
} from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { SwitchRow } from '@/components/ui/tabs';
import { TagInput } from '@/components/ui/tag-input';
import { DataTable, type Column } from '@/components/ui/table';
import { toastError } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useDelivery, useSaveDelivery, useTestDelivery } from '@/lib/queries';
import { fmtAgo } from '@/lib/utils';
import { SettingsCard } from './SettingsCard';

/**
 * B-R1, where this company's finished reports go.
 *
 * Reports used to wait in the app until somebody logged in. This is the page that changes that: a schedule, an e-mail list and a
 * webhook. The one thing it deliberately does not offer is a way to push a report the run marked not ready, a page that failed its
 * quality check or a verdict the engine could not read stays in the app with its reason, and the log at the bottom names it.
 */

/** The reports worth choosing between; leaving every box clear sends all of them. */
const CHOOSABLE_STAGES = ['site_tracker', 'rank_tracker', 'site_audit', 'full_report', 'content', 'ladder_plan', 'ai_visibility', 'ai_growth', 'backlinks', 'link_builder', 'keyword_strategy', 'index_coverage'];

export function DeliveryTab() {
  const { org, can } = useOrgCtx();
  const owner = can('owner');
  const { data, isLoading, error, refetch } = useDelivery(org.id);
  const save = useSaveDelivery(org.id);
  const test = useTestDelivery(org.id);
  const [draft, setDraft] = useState<DeliverySettings | null>(null);
  /** undefined = leave the stored secret alone; '' = remove it; anything else = replace it */
  const [secret, setSecret] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (data) setDraft(data.settings);
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !draft) return <Skeleton className="h-64" />;

  const set = (patch: Partial<DeliverySettings>) => setDraft({ ...draft, ...patch });
  const on = draft.frequency !== 'off';
  const anyChannel = draft.email.enabled || draft.webhook.enabled;

  const submit = async () => {
    try {
      await save.mutateAsync({ ...draft, webhook: { ...draft.webhook, ...(secret === undefined ? {} : { secret }) } });
      setSecret(undefined);
      toast.success('Report delivery saved');
    } catch (e) {
      toastError(e);
    }
  };

  const runTest = async () => {
    try {
      const res = await test.mutateAsync();
      if (res.delivered) toast.success('Test delivery sent');
      else toast.error(res.outcomes.map((o) => `${o.channel}: ${o.error}`).join(' · ') || 'Nothing was sent');
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsCard
        icon={<Send />}
        title="When reports go out"
        description="Reports always appear in Alaventra. This decides whether they are also sent to you."
        info="A report the analysis itself marked as not ready (a page that failed its quality check, a plan the engine refused, a verdict it could not check) is never sent. It stays here with the reason on it."
        actions={on ? <Badge>{deliveryScheduleLabel(draft)}</Badge> : undefined}
      >
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="How often">
              {(p) => (
                <Select {...p} disabled={!owner} value={draft.frequency} onChange={(e) => set({ frequency: e.target.value as DeliveryFrequency })}>
                  {DELIVERY_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {DELIVERY_FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {draft.frequency === 'weekly' && (
              <Field label="Day">
                {(p) => (
                  <Select {...p} disabled={!owner} value={String(draft.weekday)} onChange={(e) => set({ weekday: Number(e.target.value) })}>
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {draft.frequency === 'monthly' && (
              <Field label="Day of the month" hint="1 to 28, so every month has one.">
                {(p) => <Input {...p} type="number" min={1} max={28} disabled={!owner} value={draft.dayOfMonth} onChange={(e) => set({ dayOfMonth: Number(e.target.value) })} />}
              </Field>
            )}
            {on && draft.frequency !== 'each' && (
              <Field label="Time (UTC)">
                {(p) => (
                  <Select {...p} disabled={!owner} value={String(draft.hour)} onChange={(e) => set({ hour: Number(e.target.value) })}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </div>
          {on && (
            <Field label="Which reports" hint="Leave every box clear to send all of them.">
              {() => (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {CHOOSABLE_STAGES.map((stage) => {
                    const picked = draft.stages.includes(stage);
                    return (
                      <Checkbox
                        key={stage}
                        disabled={!owner}
                        checked={picked}
                        onChange={() => set({ stages: picked ? draft.stages.filter((s) => s !== stage) : [...draft.stages, stage] })}
                        label={STAGE_LABELS[stage] ?? stage}
                      />
                    );
                  })}
                </div>
              )}
            </Field>
          )}
          {on && (
            <SwitchRow
              checked={draft.shareLinks}
              onCheckedChange={(v) => set({ shareLinks: v })}
              disabled={!owner}
              title="Add a link anyone can open"
              description={`Each report also carries an expiring, revocable link (${DELIVERY.shareDays} days) so it can be forwarded to somebody without an Alaventra account.`}
            />
          )}
        </CardBody>
      </SettingsCard>

      <SettingsCard icon={<Mail />} title="By e-mail" description="A message with each report's figures, its files and the links that open it.">
        <CardBody className="space-y-4">
          {!data?.mailReady && (
            <Callout tone="warning" title="No mail account on this server">
              Nothing can be e-mailed until one is set up. A webhook works without it.
            </Callout>
          )}
          <SwitchRow checked={draft.email.enabled} onCheckedChange={(v) => set({ email: { ...draft.email, enabled: v } })} disabled={!owner || !data?.mailReady} title="Send reports by e-mail" />
          {draft.email.enabled && (
            <>
              <Field label="Who receives them" hint="Leave this empty to send to everyone in your company who can see reports.">
                {(p) => (
                  <TagInput
                    id={p.id}
                    describedBy={p['aria-describedby']}
                    value={draft.email.recipients}
                    onChange={(v) => set({ email: { ...draft.email, recipients: v } })}
                    placeholder="name@company.com"
                    max={DELIVERY.maxRecipients}
                  />
                )}
              </Field>
              <SwitchRow
                checked={draft.email.attachFiles}
                onCheckedChange={(v) => set({ email: { ...draft.email, attachFiles: v } })}
                disabled={!owner}
                title="Attach the files"
                description="The PDF, the Word draft and the fix pack arrive in the message instead of only behind a link."
              />
            </>
          )}
        </CardBody>
      </SettingsCard>

      <SettingsCard icon={<Webhook />} title="To a webhook" description="A POST with the report as JSON. Slack, Teams and Discord show it as it is.">
        <CardBody className="space-y-4">
          <SwitchRow checked={draft.webhook.enabled} onCheckedChange={(v) => set({ webhook: { ...draft.webhook, enabled: v } })} disabled={!owner} title="Send reports to a webhook" />
          {draft.webhook.enabled && (
            <>
              <Field label="Address" hint="Must start with https://">
                {(p) => (
                  <Input
                    {...p}
                    disabled={!owner}
                    value={draft.webhook.url}
                    onChange={(e) => set({ webhook: { ...draft.webhook, url: e.target.value } })}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                )}
              </Field>
              <Field
                label="Signing secret"
                optional
                hint={
                  data?.signingReady && secret === undefined
                    ? `A secret is stored. Type a new one to replace it, or clear the box to remove it.`
                    : `With one set, every body is signed as ${DELIVERY.signatureHeader} over "<timestamp>.<body>", so your receiver can tell the message is ours.`
                }
              >
                {(p) => <Input {...p} type="password" disabled={!owner} value={secret ?? ''} placeholder={data?.signingReady ? '••••••••' : ''} onChange={(e) => setSecret(e.target.value)} />}
              </Field>
            </>
          )}
        </CardBody>
      </SettingsCard>

      {owner && (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface">
          <p className="text-[13px] text-ink-3">
            {on && anyChannel
              ? data?.nextAt
                ? `Next summary ${fmtAgo(data.nextAt)}.`
                : 'Each report is sent as soon as it is ready.'
              : 'Reports stay in Alaventra until you switch a channel on.'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void runTest()} loading={test.isPending} disabled={!anyChannel}>
              Send a test
            </Button>
            <Button onClick={() => void submit()} loading={save.isPending}>
              Save
            </Button>
          </div>
        </CardFooter>
      )}

      <SettingsCard icon={<Clock />} title="What went out" description="Every delivery, and every report deliberately held back with the reason.">
        <DeliveryLog rows={data?.recent ?? []} />
      </SettingsCard>
    </div>
  );
}

const STATUS_TONE = { sent: 'good', failed: 'critical', held: 'warning', pending: 'neutral' } as const;

function DeliveryLog({ rows }: { rows: DeliveryRecord[] }) {
  if (!rows.length)
    return (
      <CardBody>
        <EmptyState icon={<Share2 className="size-5" />} title="Nothing has been sent yet" description="Once delivery is on, every report that goes out, and every one held back, is listed here." />
      </CardBody>
    );
  const columns: Column<DeliveryRecord>[] = [
    { key: 'createdAt', header: 'When', cell: (r) => fmtAgo(r.createdAt), sortValue: (r) => r.createdAt },
    { key: 'reportTitle', header: 'Report', cell: (r) => r.reportTitle || '-' },
    { key: 'channel', header: 'Channel', cell: (r) => (r.channel === 'email' ? 'E-mail' : 'Webhook'), hideOnMobile: true },
    { key: 'target', header: 'To', cell: (r) => <span className="block max-w-[22ch] truncate">{r.target || '-'}</span>, hideOnMobile: true },
    {
      key: 'status',
      header: 'Result',
      cell: (r) => (
        <div className="flex min-w-0 flex-col gap-1">
          <StatusBadge tone={STATUS_TONE[r.status]}>{DELIVERY_STATUS_LABELS[r.status]}</StatusBadge>
          {r.reason && <span className="text-[13px] leading-snug text-ink-3">{r.reason}</span>}
        </div>
      ),
    },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} initialSort={{ key: 'createdAt', dir: 'desc' }} />;
}
