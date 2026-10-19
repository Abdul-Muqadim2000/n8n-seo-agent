// Gap #6 (app/docs/LOG_ANALYTICS.md): the Crawlers page's setup side, upload a log, the push key for Cloudflare Logpush and log
// drains, retention, deleting the data, the vendors' IP lists, and the history of every file and push read.
import { useRef, useState } from 'react';
import { CloudUpload, Database, FileClock, KeyRound, ListChecks, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { CRAWLER_LIMITS, type CrawlerData, type LogIngestView, type LogPushKeyCreated } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { Collapsible } from '@/components/insight';
import { StatusBadge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { CopyButton, Meter } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { errorMessage } from '@/lib/api';
import { useCrawlerSettings, useCreatePushKey, useDeleteCrawlerData, useRevokePushKey, useUploadLog } from '@/lib/queries';
import { fmtAgo, fmtBytes, fmtDateTime } from '@/lib/utils';
import { Panel } from './kit';

const FORMAT_LABEL: Record<LogIngestView['format'], string> = { combined: 'Apache / Nginx', w3c: 'IIS / W3C', json: 'JSON lines', unknown: '-' };
const STATUS: Record<LogIngestView['status'], { tone: Tone; label: string }> = {
  queued: { tone: 'neutral', label: 'Waiting' },
  processing: { tone: 'accent', label: 'Reading' },
  done: { tone: 'good', label: 'Read' },
  failed: { tone: 'critical', label: 'Failed' },
};
const n = (v: number) => v.toLocaleString('en-US');

/** "Upload a log": pick a file, watch it go up, then the page polls while the server reads it. */
export function UploadLogDialog({ orgId, siteId, domain, open, onOpenChange }: { orgId: string; siteId: string; domain: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const up = useUploadLog(orgId, siteId);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const tooBig = !!file && file.size > CRAWLER_LIMITS.uploadMaxBytes;
  const send = () => {
    if (!file || tooBig) return;
    setProgress(0);
    up.mutate(
      { file, onProgress: (s, t) => setProgress(t ? s / t : null) },
      {
        onSuccess: (r) => {
          toast.success(r.duplicate ? 'This file was already read: nothing was counted twice' : `${file.name} is uploaded and being read`);
          setFile(null);
          setProgress(null);
          onOpenChange(false);
        },
        onError: () => setProgress(null),
      },
    );
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !up.isPending && onOpenChange(o)}
      title="Upload a server log"
      description={`An access log of ${domain}: Apache or Nginx (combined), IIS / W3C, or JSON lines. Plain or gzip, up to ${fmtBytes(CRAWLER_LIMITS.uploadMaxBytes)} a file.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={up.isPending}>
            Cancel
          </Button>
          <Button icon={<Upload className="size-4" />} onClick={send} loading={up.isPending} disabled={!file || tooBig}>
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Log file" hint="Several days in one file are fine. Requests from people are counted and dropped; the file is deleted once it has been read." error={tooBig ? `This file is larger than ${fmtBytes(CRAWLER_LIMITS.uploadMaxBytes)}. Split it or compress it with gzip.` : undefined} labelAction={<GuideButton id="crawler-logs-upload" variant="link" label="Where is my log?" vars={{ domain }} />}>
          {(p) => <Input {...p} ref={input} type="file" accept=".log,.gz,.txt,.json,.ndjson,.jsonl,text/plain,application/gzip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={up.isPending} />}
        </Field>
        {file && <p className="text-[13px] text-ink-3">{file.name} · {fmtBytes(file.size)}</p>}
        {progress != null && <Meter value={Math.round(progress * 100)} label={`Uploading ${Math.round(progress * 100)}%`} />}
        {up.isError && <Callout tone="critical">{errorMessage(up.error)}</Callout>}
      </div>
    </Dialog>
  );
}

/** The push key: created by an admin, shown once, replaced or switched off. */
function PushKey({ d, orgId, siteId, domain, admin }: { d: CrawlerData; orgId: string; siteId: string; domain: string; admin: boolean }) {
  const create = useCreatePushKey(orgId, siteId);
  const revoke = useRevokePushKey(orgId, siteId);
  const [shown, setShown] = useState<LogPushKeyCreated | null>(null);
  const push = d.setup.push;
  const vars = { domain, logEndpoint: d.setup.endpoint, logHeader: d.setup.header };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={push.enabled ? 'good' : 'neutral'}>{push.enabled ? `Key ${push.prefix}... active` : 'No push key'}</StatusBadge>
        {push.lastPushAt && <span className="text-[13px] text-ink-3">Last push {fmtAgo(push.lastPushAt)} · {n(push.pushes24h)} in 24 hours</span>}
        <GuideButton id="crawler-logs-cloudflare" label="Cloudflare Logpush" vars={vars} />
        <GuideButton id="crawler-logs-drain" label="Vercel, Fastly, Akamai" vars={vars} />
      </div>
      <dl className="grid gap-2 text-[13px] sm:grid-cols-[10rem_1fr]">
        <dt className="text-ink-3">Endpoint</dt>
        <dd className="flex min-w-0 items-center gap-2">
          <code className="truncate font-mono text-ink">{d.setup.endpoint}</code>
          <CopyButton text={d.setup.endpoint} />
        </dd>
        <dt className="text-ink-3">Header</dt>
        <dd className="flex items-center gap-2">
          <code className="font-mono text-ink">{d.setup.header}</code>
          <CopyButton text={d.setup.header} />
        </dd>
      </dl>
      {admin ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<KeyRound className="size-3.5" />} loading={create.isPending} onClick={() => create.mutate(undefined, { onSuccess: setShown, onError: (e) => toast.error(errorMessage(e)) })}>
            {push.enabled ? 'Replace the key' : 'Create push key'}
          </Button>
          {push.enabled && (
            <Button size="sm" variant="secondary" loading={revoke.isPending} onClick={() => revoke.mutate(undefined, { onSuccess: () => toast.success('Pushes are switched off'), onError: (e) => toast.error(errorMessage(e)) })}>
              Switch pushes off
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-ink-3">An admin creates the push key.</p>
      )}
      <Dialog open={!!shown} onOpenChange={(o) => !o && setShown(null)} title="Your push key" description="Copy it now: it is shown only this once. Paste it where your CDN or log drain asks for the header value." footer={<Button onClick={() => setShown(null)}>I have copied it</Button>}>
        {shown && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-surface-2 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{shown.token}</code>
              <CopyButton text={shown.token} />
            </div>
            <p className="text-[13px] text-ink-2">
              For Cloudflare Logpush the destination is <code className="break-all font-mono">{`${shown.endpoint}?header_${shown.header}=${shown.token}`}</code> <CopyButton text={`${shown.endpoint}?header_${shown.header}=${shown.token}`} label="Copy" />
            </p>
            <Callout tone="warning">Anyone with this key can send log lines for {domain}. Keep it in your CDN settings only; replace it here if it leaks.</Callout>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Retention({ d, orgId, siteId, admin }: { d: CrawlerData; orgId: string; siteId: string; admin: boolean }) {
  const save = useCrawlerSettings(orgId, siteId);
  return (
    <Field label="Keep each crawler request for" hint={`Daily totals are kept ${CRAWLER_LIMITS.rollupDays} days. Requests from people are never stored.`}>
      {(p) => (
        <div className="max-w-[12rem]">
        <Select
          {...p}
          value={String(d.setup.retentionDays)}
          disabled={!admin || save.isPending}
          onChange={(e) => save.mutate({ retentionDays: Number(e.target.value) }, { onSuccess: () => toast.success('Saved'), onError: (err) => toast.error(errorMessage(err)) })}
        >
          {CRAWLER_LIMITS.retentionDays.map((v) => (
            <option key={v} value={v}>
              {v} days
            </option>
          ))}
        </Select>
        </div>
      )}
    </Field>
  );
}

function DeleteData({ orgId, siteId, domain }: { orgId: string; siteId: string; domain: string }) {
  const del = useDeleteCrawlerData(orgId, siteId);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  return (
    <>
      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setOpen(true)}>
        Delete all log data
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Delete all log data of this website"
        description="Every stored crawler request, the daily totals and the upload history go now. The push key stays; new pushes start again from zero."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              disabled={confirm.trim().toLowerCase() !== domain.toLowerCase()}
              onClick={() => del.mutate(confirm, { onSuccess: () => (toast.success('Log data deleted'), setOpen(false), setConfirm('')), onError: (e) => toast.error(errorMessage(e)) })}
            >
              Delete
            </Button>
          </>
        }
      >
        <Field label={`Type ${domain} to confirm`}>{(p) => <Input {...p} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}</Field>
      </Dialog>
    </>
  );
}

export function IngestTable({ items }: { items: LogIngestView[] }) {
  const cols: Column<LogIngestView>[] = [
    { key: 'when', header: 'Received', sortValue: (r) => r.createdAt, cell: (r) => <span className="tabular text-ink-2">{fmtDateTime(r.createdAt)}</span> },
    { key: 'source', header: 'From', cell: (r) => <span className="text-ink">{r.source === 'push' ? 'Push' : r.fileName || 'Upload'}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge> },
    { key: 'format', header: 'Format', hideOnMobile: true, cell: (r) => <span className="text-ink-2">{FORMAT_LABEL[r.format]}</span> },
    { key: 'lines', header: 'Lines', align: 'right', sortValue: (r) => r.stats?.lines ?? 0, cell: (r) => <span className="tabular">{r.stats ? n(r.stats.lines) : '-'}</span> },
    { key: 'bots', header: 'Crawler requests', align: 'right', sortValue: (r) => r.stats?.bots ?? 0, cell: (r) => <span className="tabular">{r.stats ? n(r.stats.bots) : '-'}</span> },
    {
      key: 'note',
      header: 'Notes',
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-[13px] text-ink-3">
          {r.error ||
            (r.stats
              ? [r.stats.malformed && `${n(r.stats.malformed)} unreadable`, r.stats.otherHost && `${n(r.stats.otherHost)} for other hosts`, r.stats.duplicates && `${n(r.stats.duplicates)} already counted`, r.stats.proxyAddresses && `${n(r.stats.proxyAddresses)} with a proxy address`]
                  .filter(Boolean)
                  .join(' · ') || `${fmtBytes(r.bytes)}`
              : fmtBytes(r.bytes))}
        </span>
      ),
    },
  ];
  return <DataTable rows={items} rowKey={(r) => r.id} columns={cols} dense pageSize={10} empty="No log has arrived yet." />;
}

/** The whole setup panel (always at the bottom of the page, and the page itself before any log arrived). */
export function CrawlerSetup({ d, orgId, siteId, domain, admin, member, onUpload }: { d: CrawlerData; orgId: string; siteId: string; domain: string; admin: boolean; member: boolean; onUpload: () => void }) {
  return (
    <section id="crawler-setup" className="scroll-mt-20 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={<CloudUpload />} title="Upload a log" description="One file at a time: the quickest way to start." actions={<GuideButton id="crawler-logs-upload" vars={{ domain }} />}>
          <p className="text-[13px] leading-relaxed text-ink-2">Apache or Nginx (combined or common), IIS / W3C extended, CloudFront standard logs, or JSON lines. gzip is read as it is.</p>
          <div className="mt-3">
            {member ? (
              <Button size="sm" icon={<Upload className="size-3.5" />} onClick={onUpload}>
                Upload a log
              </Button>
            ) : (
              <p className="text-[13px] text-ink-3">Members and admins upload logs.</p>
            )}
          </div>
        </Panel>
        <Panel icon={<KeyRound />} title="Send logs automatically" description="Cloudflare Logpush or a log drain posts here within minutes.">
          <PushKey d={d} orgId={orgId} siteId={siteId} domain={domain} admin={admin} />
        </Panel>
      </div>
      <Panel icon={<FileClock />} title="Files and pushes read" description="The last uploads, and pushes of the last 24 hours" flush>
        <IngestTable items={d.ingests} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={<Database />} title="Your data" description="What is kept, and for how long">
          <div className="space-y-4">
            <Retention d={d} orgId={orgId} siteId={siteId} admin={admin} />
            <p className="text-[13px] leading-relaxed text-ink-2">
              Stored per crawler request: time, path and parameter names (never their values), status, size, response time, which crawler, and whether it was proved. No address is kept. For a request that was not proved, only its network (/24 or /48) is kept, so a spoofer can be blocked.
            </p>
            {admin && <DeleteData orgId={orgId} siteId={siteId} domain={domain} />}
          </div>
        </Panel>
        <Panel icon={<ShieldCheck />} title="How crawlers are proved" description="The vendors' own address lists, refreshed daily">
          <Collapsible label={`${d.setup.ranges.filter((r) => !r.id.startsWith('cloudflare')).length} published lists`}>
            <ul className="divide-y divide-line text-[13px]">
              {d.setup.ranges.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
                  <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-accent-text underline-offset-2 hover:underline">
                    {r.label}
                  </a>
                  <span className="tabular text-ink-3">
                    {n(r.prefixes)} ranges · {r.creationTime ? `published ${String(r.creationTime).slice(0, 10)}` : 'no date'}
                    {r.error ? ` · last refresh failed: ${r.error}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Collapsible>
          <p className="mt-3 flex items-start gap-1.5 text-[13px] text-ink-3">
            <ListChecks className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Google, Bing, Apple and Amazon are also checked by reverse and forward DNS. Meta, ByteDance and SEO tools publish no list: their requests are shown as claimed, not verified.
          </p>
        </Panel>
      </div>
    </section>
  );
}
