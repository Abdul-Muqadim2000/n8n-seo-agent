import { useState } from 'react';
import { toast } from 'sonner';
import { BellRing, Pause, Play, Plus, RefreshCw, RotateCcw, Send, Trash2, Webhook } from 'lucide-react';
import {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENTS,
  WEBHOOK_FORMAT_LABELS,
  WEBHOOK_FORMATS,
  WEBHOOKS,
  type IntegrationsOverview,
  type WebhookDeliveryView,
  type WebhookEndpointView,
  type WebhookEvent,
  type WebhookFormat,
} from '@seo/shared';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { GuideButton } from '@/components/guide';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useCreateEndpoint, useDeleteEndpoint, useRedeliver, useRotateSecret, useTestEndpoint, useUpdateEndpoint } from '@/lib/integrations';
import { fmtAgo } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';

/**
 * G4, event webhooks: signed JSON for the customer's own systems, or a Slack / Teams channel. Channel routing is one endpoint per
 * channel, each with its own events and websites (e.g. #seo-alerts gets alerts and failed runs, #seo-wins gets ranking moves).
 */

const GUIDE: Record<WebhookFormat, string> = { json: 'webhook-signature', slack: 'slack-webhook', teams: 'teams-workflow-webhook' };
const PLACEHOLDER: Record<WebhookFormat, string> = {
  json: 'https://hooks.your-company.com/alaventra',
  slack: 'https://hooks.slack.com/services/T.../B.../...',
  teams: 'https://....logic.azure.com/workflows/...',
};
const DELIVERY_TONE: Record<WebhookDeliveryView['status'], Tone> = { sent: 'good', pending: 'neutral', failed: 'warning', gave_up: 'critical' };
const DELIVERY_LABEL: Record<WebhookDeliveryView['status'], string> = { sent: 'Delivered', pending: 'Waiting', failed: 'Will retry', gave_up: 'Gave up' };
const SUGGESTED: Record<WebhookFormat, WebhookEvent[]> = {
  json: [...WEBHOOK_EVENTS],
  slack: ['alert.raised', 'run.failed', 'report.ready'],
  teams: ['alert.raised', 'run.failed', 'report.ready'],
};

export function WebhooksCard({ data }: { data: IntegrationsOverview }) {
  const { org, sites } = useOrgCtx();
  const create = useCreateEndpoint(org.id);
  const update = useUpdateEndpoint(org.id);
  const remove = useDeleteEndpoint(org.id);
  const test = useTestEndpoint(org.id);
  const rotate = useRotateSecret(org.id);
  const redeliver = useRedeliver(org.id);
  const [adding, setAdding] = useState(false);
  const [format, setFormat] = useState<WebhookFormat>('slack');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(SUGGESTED.slack);
  const [websiteIds, setWebsiteIds] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<{ name: string; secret: string } | null>(null);
  const full = data.endpoints.length >= WEBHOOKS.maxEndpoints;

  const pickFormat = (f: WebhookFormat) => {
    setFormat(f);
    setEvents(SUGGESTED[f]);
  };
  const submit = async () => {
    setFields({});
    try {
      const r = await create.mutateAsync({ name: name.trim(), format, url: url.trim(), events, websiteIds });
      if (r.secret) setFresh({ name: r.endpoint.name, secret: r.secret });
      toast.success(`${r.endpoint.name} added. Send a test to see it arrive`);
      setAdding(false);
      setName('');
      setUrl('');
    } catch (e) {
      const f = (e as { fields?: Record<string, string> }).fields;
      if (f) setFields(f);
      toast.error(errorMessage(e));
    }
  };
  const act = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const runTest = async (ep: WebhookEndpointView) => {
    try {
      const r = await test.mutateAsync(ep.id);
      if (r.ok) toast.success(`Test event delivered to ${ep.name}`);
      else toast.error(r.error || 'The test event was not delivered');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const doRotate = async (ep: WebhookEndpointView) => {
    if (!window.confirm(`Make a new signing secret for ${ep.name}? The old one stops working at once.`)) return;
    try {
      const r = await rotate.mutateAsync(ep.id);
      setFresh({ name: ep.name, secret: r.secret });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const siteName = (id: string) => sites.find((s) => s.id === id)?.domain ?? 'a removed website';

  const deliveryColumns: Column<WebhookDeliveryView>[] = [
    { key: 'createdAt', header: 'When', cell: (d) => fmtAgo(d.createdAt), sortValue: (d) => d.createdAt },
    { key: 'endpointName', header: 'Endpoint', cell: (d) => <span className="font-medium">{d.endpointName}</span> },
    { key: 'eventType', header: 'Event', cell: (d) => WEBHOOK_EVENT_LABELS[d.eventType as WebhookEvent]?.label ?? d.eventType },
    { key: 'status', header: 'Result', cell: (d) => <StatusBadge tone={DELIVERY_TONE[d.status]}>{DELIVERY_LABEL[d.status]}</StatusBadge> },
    { key: 'attempts', header: 'Tries', align: 'right', hideOnMobile: true, cell: (d) => d.attempts },
    { key: 'lastError', header: 'Why', hideOnMobile: true, cell: (d) => <span className="block max-w-xs truncate text-ink-3" title={d.lastError}>{d.status === 'failed' && d.nextAttemptAt ? `Next try ${fmtAgo(d.nextAttemptAt)}. ` : ''}{d.lastError || '-'}</span> },
    {
      key: 'again',
      header: '',
      cell: (d) =>
        d.status === 'failed' || d.status === 'gave_up' ? (
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void act(redeliver.mutateAsync(d.id), 'Sent again')} aria-label={`Send ${d.eventType} again`}>
            Send again
          </Button>
        ) : null,
    },
  ];

  return (
    <SettingsCard
      icon={<BellRing />}
      title="Alerts and events"
      description="Push what happens (finished runs, alerts, new audit findings, ranking moves) to Slack, Microsoft Teams or your own system."
      info="Each endpoint gets only the events and websites you pick, so routing is one endpoint per channel. Every event is retried after 1, 5, 30, 120 and 720 minutes before it is given up; an endpoint that keeps failing is switched off with the reason."
      actions={
        !adding && (
          <Button size="sm" icon={<Plus />} onClick={() => setAdding(true)} disabled={full || !data.secretsReady}>
            Add an endpoint
          </Button>
        )
      }
    >
      <CardBody className="space-y-5">
        {fresh && (
          <Callout tone="good" title={`Signing secret for ${fresh.name}: copy it now`} action={<Button size="sm" variant="secondary" onClick={() => setFresh(null)}>Done</Button>}>
            <p className="mb-2">It is shown this once. Your receiver checks the X-Alaventra-Signature header with it.</p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <code className="min-w-0 max-w-full break-all rounded-md border bg-surface-2 px-2 py-1 font-mono text-xs">{fresh.secret}</code>
              <CopyButton text={fresh.secret} label="Copy secret" />
            </div>
          </Callout>
        )}

        {adding && (
          <div className="space-y-4 rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Where" className="min-w-0 flex-1 sm:max-w-xs">
                {(p) => (
                  <Select {...p} value={format} onChange={(e) => pickFormat(e.target.value as WebhookFormat)}>
                    {WEBHOOK_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {WEBHOOK_FORMAT_LABELS[f]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <GuideButton id={GUIDE[format]} vars={{ appUrl: data.appUrl }} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" hint={format === 'json' ? 'What receives it, e.g. "Data warehouse"' : 'The channel, e.g. "#seo-alerts"'} error={fields.name}>
                {(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
              </Field>
              <Field label="Webhook address" error={fields.url} hint="It is stored encrypted and never shown again in full.">
                {(p) => <Input {...p} type="url" inputMode="url" value={url} placeholder={PLACEHOLDER[format]} onChange={(e) => setUrl(e.target.value)} />}
              </Field>
            </div>
            <Field label="Events" error={fields.events}>
              {() => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <Checkbox
                      key={ev}
                      checked={events.includes(ev)}
                      onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))}
                      label={WEBHOOK_EVENT_LABELS[ev].label}
                      description={WEBHOOK_EVENT_LABELS[ev].description}
                    />
                  ))}
                </div>
              )}
            </Field>
            {sites.length > 1 && (
              <Field label="Websites" hint="Leave every box clear for all of them, including websites added later.">
                {() => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sites.map((s) => (
                      <Checkbox key={s.id} checked={websiteIds.includes(s.id)} onChange={(e) => setWebsiteIds(e.target.checked ? [...websiteIds, s.id] : websiteIds.filter((x) => x !== s.id))} label={s.domain} />
                    ))}
                  </div>
                )}
              </Field>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void submit()} loading={create.isPending} disabled={!name.trim() || !url.trim() || !events.length}>
                Add endpoint
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {data.endpoints.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {data.endpoints.map((ep) => (
              <li key={ep.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{ep.name}</span>
                    <Badge tone="accent">{ep.format === 'json' ? 'Signed JSON' : ep.format === 'slack' ? 'Slack' : 'Teams'}</Badge>
                    {ep.enabled ? <StatusBadge tone={ep.consecutiveFailures ? 'warning' : 'good'}>{ep.consecutiveFailures ? `${ep.consecutiveFailures} failed in a row` : 'On'}</StatusBadge> : <StatusBadge tone="critical">Off</StatusBadge>}
                  </div>
                  <p className="font-mono text-xs text-ink-3">{`${ep.urlHost} ...${ep.urlHint}`}</p>
                  <p className="text-[13px] text-ink-2">
                    {ep.events.map((e) => WEBHOOK_EVENT_LABELS[e]?.label ?? e).join(' · ')}
                    {ep.websiteIds.length ? ` (${ep.websiteIds.map(siteName).join(', ')})` : ' (every website)'}
                  </p>
                  {ep.disabledReason && <p className="text-[13px] text-critical-text">{ep.disabledReason}</p>}
                  <p className="text-xs text-ink-3">{ep.lastSuccessAt ? `Last delivered ${fmtAgo(ep.lastSuccessAt)}` : 'Nothing delivered yet'}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" icon={<Send />} loading={test.isPending && test.variables === ep.id} onClick={() => void runTest(ep)}>
                    Test
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ep.enabled ? <Pause /> : <Play />}
                    onClick={() => void act(update.mutateAsync({ id: ep.id, body: { enabled: !ep.enabled } }), ep.enabled ? `${ep.name} paused` : `${ep.name} switched on`)}
                  >
                    {ep.enabled ? 'Pause' : 'Switch on'}
                  </Button>
                  {ep.hasSecret && (
                    <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => void doRotate(ep)}>
                      New secret
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 />}
                    aria-label={`Remove ${ep.name}`}
                    onClick={() => window.confirm(`Remove ${ep.name}? Its delivery log goes with it.`) && void act(remove.mutateAsync(ep.id), `${ep.name} removed`)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !adding && (
            <EmptyState
              icon={<Webhook />}
              title="No endpoints yet"
              description="Add a Slack or Teams channel for alerts, or your own address for every event as signed JSON."
              action={<GuideButton id="slack-webhook" label="How to get a Slack address" />}
            />
          )
        )}

        {data.deliveries.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Delivery log</h3>
            <DataTable rows={data.deliveries} columns={deliveryColumns} rowKey={(d) => d.id} pageSize={10} />
          </div>
        )}
      </CardBody>
      <CardFooter>
        <p className="text-sm text-ink-3">
          Up to {WEBHOOKS.maxEndpoints} endpoints. Signed JSON carries X-Alaventra-Signature (HMAC-SHA256 of "timestamp.body"), X-Alaventra-Event and X-Alaventra-Delivery; the log keeps {WEBHOOKS.logDays} days.
        </p>
      </CardFooter>
    </SettingsCard>
  );
}
