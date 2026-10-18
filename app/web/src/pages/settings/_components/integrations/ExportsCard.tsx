import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Database, Play, Plus, Trash2 } from 'lucide-react';
import {
  EXPORT_TABLES,
  EXPORTS,
  STORAGE_PROVIDER_LABELS,
  STORAGE_PROVIDERS,
  WEEKDAYS,
  type ExportDestinationInput,
  type ExportRunView,
  type IntegrationsOverview,
  type IntegrationView,
  type StorageProvider,
} from '@seo/shared';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { GuideButton } from '@/components/guide';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useConnectExport, useDeleteIntegration, useRunExport, useTestIntegration, useUpdateExport } from '@/lib/integrations';
import { fmtAgo, fmtDateTime } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';

/**
 * G4 — the warehouse / BI export: six tables, one documented schema, to S3-compatible storage (AWS S3, Google Cloud Storage with
 * HMAC keys, Cloudflare R2) as NDJSON or CSV, or straight into BigQuery. Daily or weekly, or "Run now".
 */

type Kind = 's3' | 'bigquery';
const RUN_TONE: Record<ExportRunView['status'], Tone> = { running: 'accent', ok: 'good', partial: 'warning', failed: 'critical' };
const RUN_LABEL: Record<ExportRunView['status'], string> = { running: 'Running', ok: 'Done', partial: 'Partly done', failed: 'Failed' };
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00 UTC`;
const scheduleLabel = (c: Record<string, unknown>) =>
  c.schedule === 'off' ? 'On demand only' : c.schedule === 'weekly' ? `Weekly, ${WEEKDAYS[Number(c.weekday) || 0]} ${hourLabel(Number(c.hour) || 0)}` : `Daily, ${hourLabel(Number(c.hour) || 0)}`;
const where = (i: IntegrationView) =>
  i.kind === 'bigquery' ? `${String(i.config.projectId)}.${String(i.config.datasetId)}` : `${STORAGE_PROVIDER_LABELS[i.config.provider as StorageProvider] ?? 'Storage'} · ${String(i.config.bucket)}/${String(i.config.prefix || '')}`;

function DestinationForm({ onDone }: { onDone: () => void }) {
  const { org } = useOrgCtx();
  const connect = useConnectExport(org.id);
  const [kind, setKind] = useState<Kind>('s3');
  const [v, setV] = useState<Record<string, string>>({ provider: 'aws', region: '', prefix: 'alaventra', format: 'ndjson', location: 'US', tablePrefix: 'alaventra_' });
  const [tables, setTables] = useState<string[]>(EXPORT_TABLES.map((t) => t.id));
  const [schedule, setSchedule] = useState({ schedule: 'daily', hour: 3, weekday: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, x: string) => setV({ ...v, [k]: x });
  const provider = v.provider as StorageProvider;
  const text = (k: string, label: string, o: { hint?: string; placeholder?: string; secret?: boolean } = {}) => (
    <Field label={label} hint={o.hint} error={errors[k]}>
      {(p) => <Input {...p} type={o.secret ? 'password' : 'text'} autoComplete="off" value={v[k] ?? ''} placeholder={o.placeholder} onChange={(e) => set(k, e.target.value)} />}
    </Field>
  );
  const submit = async () => {
    setErrors({});
    const common = { tables, schedule: schedule.schedule as 'daily', hour: schedule.hour, weekday: schedule.weekday, name: v.name?.trim() || undefined };
    const body: ExportDestinationInput =
      kind === 's3'
        ? { kind, ...common, provider, region: v.region || 'auto', accountId: v.accountId ?? '', endpoint: v.endpoint ?? '', bucket: v.bucket ?? '', prefix: v.prefix ?? '', format: v.format as 'ndjson', accessKeyId: v.accessKeyId ?? '', secretAccessKey: v.secretAccessKey ?? '' }
        : { kind, ...common, projectId: v.projectId ?? '', datasetId: v.datasetId ?? '', location: v.location || 'US', tablePrefix: v.tablePrefix ?? '', serviceAccountJson: v.serviceAccountJson ?? '' };
    try {
      await connect.mutateAsync(body);
      toast.success('Destination connected — the first export runs on its schedule, or press Run now');
      onDone();
    } catch (e) {
      if (e instanceof ApiRequestError) setErrors(e.fields);
      toast.error(errorMessage(e));
    }
  };
  return (
    <div className="space-y-4 rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Kind> label="Destination" value={kind} onChange={setKind} options={[{ value: 's3', label: 'S3-compatible storage' }, { value: 'bigquery', label: 'BigQuery' }]} />
        <GuideButton id={kind === 's3' ? 's3-access-keys' : 'bigquery-service-account'} />
      </div>
      {kind === 's3' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Storage">
            {(p) => (
              <Select {...p} value={provider} onChange={(e) => set('provider', e.target.value)}>
                {STORAGE_PROVIDERS.map((x) => (
                  <option key={x} value={x}>
                    {STORAGE_PROVIDER_LABELS[x]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {provider === 'aws' && text('region', 'Region', { placeholder: 'eu-west-1', hint: 'The bucket’s region.' })}
          {provider === 'r2' && text('accountId', 'Cloudflare account id', { hint: '32 characters, on the R2 overview page.' })}
          {provider === 'other' && text('endpoint', 'Endpoint', { placeholder: 'https://s3.example-storage.com' })}
          {text('bucket', 'Bucket')}
          {text('prefix', 'Folder', { hint: 'Files go under <folder>/<table>/dt=<date>/.' })}
          <Field label="Format">
            {(p) => (
              <Select {...p} value={v.format} onChange={(e) => set('format', e.target.value)}>
                <option value="ndjson">NDJSON (one JSON row a line)</option>
                <option value="csv">CSV</option>
              </Select>
            )}
          </Field>
          {text('accessKeyId', provider === 'gcs' ? 'HMAC access key' : 'Access key id')}
          {text('secretAccessKey', provider === 'gcs' ? 'HMAC secret' : 'Secret access key', { secret: true })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {text('projectId', 'Google Cloud project id', { placeholder: 'acme-analytics' })}
          {text('datasetId', 'Dataset', { placeholder: 'seo' })}
          {text('location', 'Dataset location', { placeholder: 'US or EU' })}
          {text('tablePrefix', 'Table name prefix', { hint: 'Tables are named <prefix><table>, e.g. alaventra_rank_history.' })}
          <Field label="Service-account key (JSON)" className="sm:col-span-2" error={errors.serviceAccountJson} hint="Paste the whole key file. It is stored encrypted and never shown again.">
            {(p) => <Textarea {...p} rows={5} className="font-mono text-xs" value={v.serviceAccountJson ?? ''} onChange={(e) => set('serviceAccountJson', e.target.value)} placeholder={'{ "type": "service_account", "project_id": "…", … }'} />}
          </Field>
        </div>
      )}
      <Field label="Tables" error={errors.tables}>
        {() => (
          <div className="grid gap-2 sm:grid-cols-2">
            {EXPORT_TABLES.map((t) => (
              <Checkbox key={t.id} checked={tables.includes(t.id)} onChange={(e) => setTables(e.target.checked ? [...tables, t.id] : tables.filter((x) => x !== t.id))} label={t.label} description={t.grain} />
            ))}
          </div>
        )}
      </Field>
      <ScheduleFields value={schedule} onChange={setSchedule} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void submit()} loading={connect.isPending} disabled={!tables.length}>
          Check and connect
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ScheduleFields({ value, onChange }: { value: { schedule: string; hour: number; weekday: number }; onChange: (v: { schedule: string; hour: number; weekday: number }) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="How often">
        {(p) => (
          <Select {...p} value={value.schedule} onChange={(e) => onChange({ ...value, schedule: e.target.value })}>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="off">Only when I press Run now</option>
          </Select>
        )}
      </Field>
      {value.schedule === 'weekly' && (
        <Field label="Day">
          {(p) => (
            <Select {...p} value={String(value.weekday)} onChange={(e) => onChange({ ...value, weekday: Number(e.target.value) })}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {value.schedule !== 'off' && (
        <Field label="Time (UTC)">
          {(p) => (
            <Select {...p} value={String(value.hour)} onChange={(e) => onChange({ ...value, hour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
    </div>
  );
}

function Destination({ i, runs }: { i: IntegrationView; runs: ExportRunView[] }) {
  const { org } = useOrgCtx();
  const run = useRunExport(org.id);
  const test = useTestIntegration(org.id);
  const update = useUpdateExport(org.id);
  const remove = useDeleteIntegration(org.id);
  const [editing, setEditing] = useState(false);
  const [sched, setSched] = useState({ schedule: String(i.config.schedule ?? 'daily'), hour: Number(i.config.hour) || 0, weekday: Number(i.config.weekday) || 0 });
  const last = runs[0];
  const tables = Array.isArray(i.config.tables) ? (i.config.tables as string[]) : [];
  const go = async () => {
    try {
      const r = await run.mutateAsync(i.id);
      if (r.status === 'ok') toast.success(`Exported ${r.tables.reduce((n, t) => n + t.rows, 0).toLocaleString()} rows`);
      else toast.error(r.error || 'The export did not finish');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <li className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{i.name}</span>
            <Badge tone="accent">{i.kind === 'bigquery' ? 'BigQuery' : String(i.config.format ?? 'ndjson').toUpperCase()}</Badge>
            <StatusBadge tone={i.status === 'ok' ? 'good' : i.status === 'error' ? 'critical' : 'neutral'}>{i.status === 'ok' ? 'Working' : i.status === 'error' ? 'Needs attention' : 'Not checked'}</StatusBadge>
          </div>
          <p className="break-all font-mono text-xs text-ink-3">{where(i)}</p>
          <p className="text-[13px] text-ink-2">
            {scheduleLabel(i.config)} · {tables.length} table{tables.length === 1 ? '' : 's'} · {i.secretHint}
          </p>
          <p className="text-xs text-ink-3">
            {last ? `Last export ${fmtAgo(last.startedAt)}: ${RUN_LABEL[last.status].toLowerCase()}` : 'Not exported yet'}
            {i.nextRunAt ? ` · next ${fmtDateTime(i.nextRunAt)}` : ''}
          </p>
          {i.lastError && <p className="text-[13px] text-critical-text">{i.lastError}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" icon={<Play />} loading={run.isPending} onClick={() => void go()}>
            Run now
          </Button>
          <Button size="sm" variant="ghost" icon={<CheckCircle2 />} loading={test.isPending} onClick={() => void test.mutateAsync(i.id).then((r) => (r.ok ? toast.success('The destination answers') : toast.error(r.error)), (e) => toast.error(errorMessage(e)))}>
            Test
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>
            Schedule
          </Button>
          <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => window.confirm(`Remove ${i.name}? Files already exported stay where they are.`) && void remove.mutateAsync(i.id).then(() => toast.success('Removed'), (e) => toast.error(errorMessage(e)))}>
            Remove
          </Button>
        </div>
      </div>
      {editing && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <ScheduleFields value={sched} onChange={setSched} />
          <Button
            size="sm"
            loading={update.isPending}
            onClick={() =>
              void update.mutateAsync({ id: i.id, body: sched }).then(
                () => {
                  toast.success('Schedule saved');
                  setEditing(false);
                },
                (e) => toast.error(errorMessage(e)),
              )
            }
          >
            Save schedule
          </Button>
        </div>
      )}
      {last && last.tables.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs text-ink-3 sm:grid-cols-2">
          {last.tables.map((t) => (
            <li key={t.table} className={t.error ? 'text-critical-text' : undefined}>
              {`${t.table}: ${t.error ? t.error : `${t.rows.toLocaleString()} rows${t.truncated ? ' (cut at the limit)' : ''}`}`}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ExportsCard({ data }: { data: IntegrationsOverview }) {
  const [adding, setAdding] = useState(false);
  const dests = data.integrations.filter((i) => i.kind === 's3' || i.kind === 'bigquery');
  const runColumns: Column<ExportRunView>[] = [
    { key: 'startedAt', header: 'When', cell: (r) => fmtAgo(r.startedAt), sortValue: (r) => r.startedAt },
    { key: 'dest', header: 'Destination', cell: (r) => dests.find((d) => d.id === r.integrationId)?.name ?? '—' },
    { key: 'trigger', header: 'Started', hideOnMobile: true, cell: (r) => (r.trigger === 'manual' ? 'Run now' : 'Schedule') },
    { key: 'status', header: 'Result', cell: (r) => <StatusBadge tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status]}</StatusBadge> },
    { key: 'rows', header: 'Rows', align: 'right', cell: (r) => r.tables.reduce((n, t) => n + t.rows, 0).toLocaleString() },
  ];
  return (
    <SettingsCard
      icon={<Database />}
      title="Data export"
      description="Your rankings, Search Console and GA4 figures, audit findings, AI visibility, backlinks and analyses, delivered to your own storage or BigQuery."
      info="Each export is a full copy of the tables you choose, in one documented schema (app/docs/INTEGRATIONS.md). Storage gets one file per table in date folders; BigQuery tables are replaced each time, so nothing is counted twice."
      actions={
        !adding && (
          <Button size="sm" icon={<Plus />} onClick={() => setAdding(true)} disabled={dests.length >= EXPORTS.maxDestinations || !data.secretsReady}>
            Add a destination
          </Button>
        )
      }
    >
      <CardBody className="space-y-4">
        {adding && <DestinationForm onDone={() => setAdding(false)} />}
        {dests.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {dests.map((i) => (
              <Destination key={i.id} i={i} runs={data.exportRuns.filter((r) => r.integrationId === i.id)} />
            ))}
          </ul>
        ) : (
          !adding && <EmptyState icon={<Database />} title="Nothing is exported yet" description="Connect an S3, Google Cloud Storage or Cloudflare R2 bucket, or a BigQuery dataset." action={<GuideButton id="bigquery-service-account" label="How to set up BigQuery" />} />
        )}
        {data.exportRuns.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Recent exports</h3>
            <DataTable rows={data.exportRuns} columns={runColumns} rowKey={(r) => r.id} pageSize={10} />
          </div>
        )}
      </CardBody>
      <CardFooter>
        <p className="text-sm text-ink-3">
          Up to {EXPORTS.maxDestinations} destinations and {EXPORTS.maxRowsPerTable.toLocaleString()} rows a table per export. Snowflake and Redshift read the storage files directly.
        </p>
      </CardFooter>
    </SettingsCard>
  );
}
