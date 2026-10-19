import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, UsersRound } from 'lucide-react';
import type { ScimOverview } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { qk } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { SettingsCard } from './SettingsCard';

/**
 * G1: SCIM provisioning (Company settings -> Single sign-on): the base URL and a bearer token for the identity provider, and the
 * groups it pushed, each mapped to a role (or to none). The token is shown once.
 */
export function ScimCard() {
  const { org } = useOrgCtx();
  const qc = useQueryClient();
  const key = [...qk.org(org.id), 'scim'];
  const scim = useQuery({ queryKey: key, queryFn: () => api<ScimOverview>(`/api/orgs/${org.id}/scim`) });
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!scim.data) return <Skeleton className="h-48" />;
  const d = scim.data;
  const live = d.tokens.filter((t) => !t.revokedAt);
  return (
    <SettingsCard
      icon={<UsersRound />}
      title="Provisioning (SCIM 2.0)"
      description="Let your identity provider create, update and switch off people here, and map its groups to roles."
      actions={<GuideButton id="scim-provisioning" vars={{ scimUrl: d.baseUrl }} />}
    >
      <CardBody className="space-y-5">
        {!d.verifiedDomains.length && <Callout tone="info">Verify an e-mail domain above first: provisioning only creates people with addresses on your verified domains.</Callout>}
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px]">
          <span className="w-44 shrink-0 text-ink-3">SCIM base URL</span>
          <code className="min-w-0 break-all font-mono text-xs text-ink">{d.baseUrl}</code>
          <CopyButton text={d.baseUrl} />
        </div>

        {fresh && (
          <Callout tone="good" title="Your provisioning token: copy it now" action={<Button size="sm" variant="secondary" onClick={() => setFresh(null)}>Done</Button>}>
            <p className="mb-2">Paste it into your identity provider as the API token (Bearer). It is shown only this once.</p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <code className="min-w-0 max-w-full break-all rounded-md border bg-surface-2 px-2 py-1 font-mono text-xs">{fresh}</code>
              <CopyButton text={fresh} label="Copy token" />
            </div>
          </Callout>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Tokens</p>
          {d.tokens.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {d.tokens.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{t.name}</span> <code className="font-mono text-xs text-ink-3">{t.prefix}...</code>
                    <span className="block text-xs text-ink-3">
                      Made {fmtDate(t.createdAt)}
                      {t.createdByName ? ` by ${t.createdByName}` : ''} · {t.lastUsedAt ? `used ${fmtAgo(t.lastUsedAt)}` : 'not used yet'}
                    </span>
                  </span>
                  {t.revokedAt ? (
                    <StatusBadge tone="neutral">Revoked</StatusBadge>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm(`Revoke "${t.name}"? Provisioning stops until a new token is set.`) && void run(() => api(`/api/orgs/${org.id}/scim/tokens/${t.id}`, { method: 'DELETE' }), 'Token revoked')}>
                      <Trash2 /> Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No token yet.</p>
          )}
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api<{ token: string }>(`/api/orgs/${org.id}/scim/tokens`, { method: 'POST', body: { name: name.trim() } });
                setFresh(r.token);
                setName('');
              });
            }}
          >
            <Field label="New token for" hint={`Up to 2 live tokens (${live.length} now).`} className="min-w-0 flex-1">
              {(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Okta" />}
            </Field>
            <Button type="submit" variant="secondary" disabled={!name.trim() || live.length >= 2} loading={busy}>
              <Plus /> Create token
            </Button>
          </form>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Groups and roles</p>
          {d.groups.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {d.groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{g.displayName}</span>
                    <span className="block text-xs text-ink-3">
                      {g.members} member{g.members === 1 ? '' : 's'}
                    </span>
                  </span>
                  <Select
                    aria-label={`Role for ${g.displayName}`}
                    className="w-40"
                    value={g.role ?? ''}
                    disabled={busy}
                    onChange={(e) => void run(() => api(`/api/orgs/${org.id}/scim/groups/${g.id}`, { method: 'PATCH', body: { role: e.target.value || null } }), 'Role mapping saved')}
                  >
                    <option value="">No role change</option>
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </Select>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Groups appear here once your identity provider pushes them.</p>
          )}
        </div>
      </CardBody>
      <CardFooter>
        <p className="text-sm text-ink-2">
          A person's role is the highest one mapped from their groups. Switched off in your provider, they lose access here at once; owners are never changed by provisioning.
        </p>
      </CardFooter>
    </SettingsCard>
  );
}
