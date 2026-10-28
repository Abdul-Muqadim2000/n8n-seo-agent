import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ListTodo, Plug, RefreshCw, Trash2 } from 'lucide-react';
import { INTEGRATION_LABELS, TRACKER_KINDS, type IntegrationsOverview, type IntegrationView, type TrackerConnectInput, type TrackerKind } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { GuideButton } from '@/components/guide';
import { ApiRequestError, toastError } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useConnectTracker, useDeleteIntegration, useTestIntegration } from '@/lib/integrations';
import { fmtAgo } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';

/**
 * G4, Jira Cloud, Linear and Asana: one of each per company. Connecting checks the token and the project / team with the vendor
 * before anything is stored; afterwards "Create ticket" appears beside every audit finding and recommendation.
 */

interface FieldDef {
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  secret?: boolean;
  type?: string;
}
const FORMS: Record<TrackerKind, { guide: string; blurb: string; fields: FieldDef[] }> = {
  jira: {
    guide: 'jira-api-token',
    blurb: 'Tickets in one Jira Cloud project, with the evidence and the fix in the description.',
    fields: [
      { name: 'siteUrl', label: 'Jira address', placeholder: 'https://your-company.atlassian.net', type: 'url' },
      { name: 'email', label: 'Atlassian account e-mail', hint: 'The account the API token belongs to; tickets are created as this person.', type: 'email' },
      { name: 'apiToken', label: 'API token', secret: true },
      { name: 'projectKey', label: 'Project key', placeholder: 'SEO', hint: 'The letters before every ticket number, e.g. SEO in SEO-12.' },
      { name: 'issueType', label: 'Issue type', placeholder: 'Task', hint: 'Task, Bug, Story and so on, as it is named in the project.' },
    ],
  },
  linear: {
    guide: 'linear-api-key',
    blurb: 'Issues in one Linear team, written in Markdown.',
    fields: [
      { name: 'apiKey', label: 'Personal API key', placeholder: 'lin_api_...', secret: true },
      { name: 'teamKey', label: 'Team key', placeholder: 'WEB', hint: 'The letters before every issue number, e.g. WEB in WEB-7.' },
    ],
  },
  asana: {
    guide: 'asana-pat',
    blurb: 'Tasks in one Asana project.',
    fields: [
      { name: 'token', label: 'Personal access token', secret: true },
      { name: 'projectGid', label: 'Project id', placeholder: '1201234567890123', hint: 'The long number in the project\'s address: app.asana.com/0/<this>/...' },
    ],
  },
};

const target = (i: IntegrationView) => String(i.config.projectName || i.config.teamName || i.config.projectKey || i.config.teamKey || '');

function TrackerForm({ kind, onDone }: { kind: TrackerKind; onDone: () => void }) {
  const { org } = useOrgCtx();
  const connect = useConnectTracker(org.id);
  const [v, setV] = useState<Record<string, string>>(kind === 'jira' ? { issueType: 'Task' } : {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const def = FORMS[kind];
  const submit = async () => {
    setErrors({});
    try {
      await connect.mutateAsync({ kind, ...v } as TrackerConnectInput);
      toast.success(`${INTEGRATION_LABELS[kind]} connected`);
      onDone();
    } catch (e) {
      if (e instanceof ApiRequestError) setErrors(e.fields);
      toastError(e);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {def.fields.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint} error={errors[f.name]}>
            {(p) => <Input {...p} type={f.secret ? 'password' : (f.type ?? 'text')} autoComplete="off" value={v[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />}
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void submit()} loading={connect.isPending} disabled={def.fields.some((f) => !(v[f.name] ?? '').trim())}>
          Check and connect
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <p className="text-[13px] text-ink-3">The token is checked with {INTEGRATION_LABELS[kind]} first, then stored encrypted.</p>
      </div>
    </div>
  );
}

export function TrackersCard({ data }: { data: IntegrationsOverview }) {
  const { org } = useOrgCtx();
  const test = useTestIntegration(org.id);
  const remove = useDeleteIntegration(org.id);
  const [open, setOpen] = useState<TrackerKind | null>(null);
  const tickets = data.issues.filter((i) => i.status === 'created');
  return (
    <SettingsCard
      icon={<ListTodo />}
      title="Issue trackers"
      description="Send an audit finding or a recommendation to Jira, Linear or Asana as a ticket. One ticket per finding, with its state shown back here."
      info="The ticket carries the finding's evidence, example pages and the fix, and links back to Alaventra. Pushing the same finding again opens the ticket already made. Any member can create a ticket; only owners and admins connect a tracker."
    >
      <CardBody className="space-y-3">
        {TRACKER_KINDS.map((kind) => {
          const conn = data.integrations.find((i) => i.kind === kind);
          return (
            <div key={kind} className="rounded-lg border border-line p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{INTEGRATION_LABELS[kind]}</span>
                    {conn && <StatusBadge tone={conn.status === 'ok' ? 'good' : conn.status === 'error' ? 'critical' : 'neutral'}>{conn.status === 'ok' ? 'Connected' : conn.status === 'error' ? 'Needs attention' : 'Not checked'}</StatusBadge>}
                  </div>
                  <p className="mt-1 text-[13px] text-ink-2">{conn ? `${target(conn)} · ${conn.secretHint}${conn.lastCheckedAt ? ` · checked ${fmtAgo(conn.lastCheckedAt)}` : ''}` : FORMS[kind].blurb}</p>
                  {conn?.lastError && <p className="mt-1 text-[13px] text-critical-text">{conn.lastError}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {conn ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<CheckCircle2 />}
                        loading={test.isPending && test.variables === conn.id}
                        onClick={() =>
                          void test.mutateAsync(conn.id).then(
                            (r) => (r.ok ? toast.success(`${INTEGRATION_LABELS[kind]} answers`) : toast.error(r.error)),
                            (e) => toastError(e),
                          )
                        }
                      >
                        Test
                      </Button>
                      <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setOpen(kind)}>
                        Replace
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 />}
                        onClick={() =>
                          window.confirm(`Disconnect ${INTEGRATION_LABELS[kind]}? Tickets already made stay where they are.`) &&
                          void remove.mutateAsync(conn.id).then(
                            () => toast.success('Disconnected'),
                            (e) => toastError(e),
                          )
                        }
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    open !== kind && (
                      <Button size="sm" icon={<Plug />} onClick={() => setOpen(kind)} disabled={!data.secretsReady}>
                        Connect
                      </Button>
                    )
                  )}
                  <GuideButton id={FORMS[kind].guide} variant="icon" label={`How to get the ${INTEGRATION_LABELS[kind]} token`} />
                </div>
              </div>
              {open === kind && (
                <div className="mt-4 border-t border-line pt-4">
                  <TrackerForm kind={kind} onDone={() => setOpen(null)} />
                </div>
              )}
            </div>
          );
        })}
      </CardBody>
      {tickets.length > 0 && (
        <CardFooter>
          <p className="text-sm text-ink-3">
            {tickets.length} ticket{tickets.length === 1 ? '' : 's'} made · {tickets.filter((t) => t.remoteState === 'done').length} done in the tracker. Each one is shown beside its finding.
          </p>
        </CardFooter>
      )}
    </SettingsCard>
  );
}
