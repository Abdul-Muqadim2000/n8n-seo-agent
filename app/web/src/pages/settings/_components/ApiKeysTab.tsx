import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { API_KEY, API_SCOPE_LABELS, API_SCOPES, type ApiKeyView, type ApiScope } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { SettingsCard } from './SettingsCard';

/**
 * B5-11 (v4.18) — the company's API keys for the read API (app/API.md "Read API v1").
 * A key reads this company's websites, audits and findings, runs, reports and files, and can run the free publish check. It can never
 * start an analysis or change anything. The key is shown once, right after it is made; afterwards only its first characters are.
 */

const STATE_TONE = { active: 'good', expired: 'warning', revoked: 'neutral' } as const;
const STATE_LABEL = { active: 'Active', expired: 'Expired', revoked: 'Revoked' } as const;
const expiryLabel = (d: number) => (d === 0 ? 'Never' : d === 365 ? '1 year' : `${d} days`);

export function ApiKeysTab() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const { data, isLoading, error, refetch } = useApiKeys(org.id, admin);
  const create = useCreateApiKey(org.id);
  const revoke = useRevokeApiKey(org.id);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiScope[]>(['read', 'publish_check']);
  const [days, setDays] = useState<number>(API_KEY.defaultExpiryDays);
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);

  if (!admin)
    return (
      <Callout tone="info" title="Only owners and admins manage API keys">
        Ask an owner or admin of {org.name} for a key if you need to read your data from a script or another tool.
      </Callout>
    );
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <Skeleton className="h-64" />;

  const live = data.items.filter((k) => k.state === 'active').length;
  const submit = async () => {
    try {
      const k = await create.mutateAsync({ name: name.trim(), scopes, expiresInDays: days });
      setFresh({ name: k.name, token: k.token });
      setName('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const doRevoke = async (k: ApiKeyView) => {
    if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working on its next request.`)) return;
    try {
      await revoke.mutateAsync(k.id);
      toast.success('Key revoked');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: Column<ApiKeyView>[] = [
    { key: 'name', header: 'Name', cell: (k) => <span className="font-medium">{k.name}</span> },
    { key: 'prefix', header: 'Key', cell: (k) => <code className="font-mono text-xs">{k.prefix}…</code> },
    { key: 'scopes', header: 'Can', cell: (k) => <span className="text-sm text-ink-2">{k.scopes.map((s) => (s === 'read' ? 'read' : 'publish check')).join(' · ')}</span> },
    { key: 'state', header: 'Status', cell: (k) => <StatusBadge tone={STATE_TONE[k.state]}>{STATE_LABEL[k.state]}</StatusBadge> },
    { key: 'lastUsedAt', header: 'Last used', cell: (k) => (k.lastUsedAt ? fmtAgo(k.lastUsedAt) : 'Never'), sortValue: (k) => k.lastUsedAt ?? '' },
    { key: 'expiresAt', header: 'Expires', cell: (k) => (k.expiresAt ? fmtDate(k.expiresAt) : 'Never') },
    {
      key: 'actions',
      header: '',
      cell: (k) =>
        k.state === 'active' ? (
          <Button size="sm" variant="ghost" onClick={() => void doRevoke(k)} aria-label={`Revoke ${k.name}`}>
            <Trash2 /> Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="max-w-4xl space-y-5">
      {fresh && (
        <Callout tone="good" title={`Your new key "${fresh.name}" — copy it now`} action={<Button size="sm" variant="secondary" onClick={() => setFresh(null)}>Done</Button>}>
          <p className="mb-2">This is the only time the whole key is shown. We keep only a fingerprint of it, so we cannot show it again.</p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="min-w-0 max-w-full break-all rounded-md border bg-surface-2 px-2 py-1 font-mono text-xs">{fresh.token}</code>
            <CopyButton text={fresh.token} label="Copy key" />
          </div>
        </Callout>
      )}

      <SettingsCard icon={<KeyRound />} title="Create an API key" description={`Read your own data from a script, a BI tool or an AI assistant. ${live} of ${data.max} live keys.`}>
        <CardBody className="space-y-5">
          <Field label="Name" hint='What uses it, e.g. "Looker Studio" or "Release check in CI"'>
            {(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">What it may do</legend>
            {API_SCOPES.map((s) => (
              <Checkbox
                key={s}
                label={API_SCOPE_LABELS[s]}
                checked={scopes.includes(s)}
                onChange={(e) => setScopes(e.target.checked ? [...new Set([...scopes, s])] : scopes.filter((x) => x !== s))}
              />
            ))}
          </fieldset>
          <Field label="Expires">
            {(p) => (
              <Select {...p} value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
                {API_KEY.expiryDays.map((d) => (
                  <option key={d} value={d}>
                    {expiryLabel(d)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </CardBody>
        <CardFooter>
          <Button onClick={() => void submit()} disabled={!name.trim() || !scopes.length || live >= data.max} loading={create.isPending}>
            <Plus /> Create key
          </Button>
        </CardFooter>
      </SettingsCard>

      <SettingsCard icon={<ShieldCheck />} title="Your keys" description="A key reads only this company's data. It can never start an analysis, spend money or change a setting.">
        <CardBody>
          {data.items.length ? (
            <DataTable rows={data.items} columns={columns} rowKey={(k) => k.id} pageSize={20} />
          ) : (
            <EmptyState icon={<KeyRound />} title="No API keys yet" description="Create one above to read your websites, audits, reports and runs from outside the app." />
          )}
        </CardBody>
        <CardFooter>
          <p className="text-sm text-ink-2">
            Send it as <code className="font-mono">Authorization: Bearer asc_…</code> to <code className="font-mono">/api/v1</code>. Up to {API_KEY.perMinute} requests a minute per key.
            AI assistants that speak MCP can connect to <code className="font-mono">/api/v1/mcp</code> with the same key.
          </p>
        </CardFooter>
      </SettingsCard>
    </div>
  );
}
