import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Globe, KeyRound, Link2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { SsoConnectionInput, SsoOverview, SsoProtocol } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, ChoiceCard, Field, Input, Select, Textarea } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { SwitchRow } from '@/components/ui/tabs';
import { api, ApiRequestError, toastError } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useSso, useSsoMutation } from '@/lib/queries';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import { ScimCard } from './ScimCard';
import { SettingsCard } from './SettingsCard';

/**
 * G1: single sign-on (Company settings -> Single sign-on): the e-mail domains the company proves by DNS, its identity provider (OIDC
 * or SAML 2.0), a test sign-in, then switching it on and, for owners, making it required. SCIM provisioning sits below.
 */
export function SsoTab() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const sso = useSso(org.id, admin);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const t = params.get('test');
    if (!t) return;
    if (t === 'ok') toast.success('Test sign-in worked', { description: 'You can switch single sign-on on now.' });
    else toast.error('The test sign-in did not work', { description: 'The reason is under "Last test".' });
    setParams({}, { replace: true });
  }, [params, setParams]);

  if (!admin)
    return (
      <Callout tone="info" title="Only owners and admins set up single sign-on">
        Ask an owner or admin of {org.name}.
      </Callout>
    );
  if (sso.error) return <ErrorState error={sso.error} onRetry={() => void sso.refetch()} />;
  if (!sso.data) return <Skeleton className="h-96 max-w-4xl" />;
  return (
    <div className="max-w-4xl space-y-5">
      <DomainsCard data={sso.data} />
      <ConnectionCard data={sso.data} />
      {sso.data.connection && <SwitchesCard data={sso.data} />}
      <ScimCard />
    </div>
  );
}

function DomainsCard({ data }: { data: SsoOverview }) {
  const { org } = useOrgCtx();
  const [domain, setDomain] = useState('');
  const add = useSsoMutation(org.id, (d: string) => api(`/api/orgs/${org.id}/sso/domains`, { method: 'POST', body: { domain: d } }));
  const verify = useSsoMutation(org.id, (id: string) => api<{ verified: boolean; message: string }>(`/api/orgs/${org.id}/sso/domains/${id}/verify`, { method: 'POST' }));
  const remove = useSsoMutation(org.id, (id: string) => api(`/api/orgs/${org.id}/sso/domains/${id}`, { method: 'DELETE' }));
  return (
    <SettingsCard icon={<Globe />} title="Your e-mail domains" description="Single sign-on serves the addresses on domains you prove are yours with a DNS record." actions={<GuideButton id="sso-domain" vars={{ domain: data.domains[0]?.domain, dnsValue: data.domains.find((d) => !d.verified)?.txtValue }} />}>
      <CardBody className="space-y-4">
        {data.domains.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.domains.map((d) => (
              <li key={d.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    {d.domain} {d.verified ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>}
                  </span>
                  <span className="flex items-center gap-2">
                    {!d.verified && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={verify.isPending && verify.variables === d.id}
                        onClick={() => verify.mutate(d.id, { onSuccess: (r) => (r.verified ? toast.success(`${d.domain} verified`) : toast.info(r.message)), onError: (e) => toastError(e) })}
                      >
                        Check now
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label={`Remove ${d.domain}`} onClick={() => window.confirm(`Remove ${d.domain}? Single sign-on stops for its addresses.`) && remove.mutate(d.id, { onError: (e) => toastError(e) })}>
                      <Trash2 />
                    </Button>
                  </span>
                </div>
                {!d.verified && (
                  <div className="rounded-lg border border-line bg-surface-2/40 p-3 text-[13px] text-ink-2">
                    Add a <b>TXT</b> record at <code className="font-mono">{d.domain}</code> with this value, then press Check now:
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                      <code className="min-w-0 max-w-full break-all rounded-md border bg-surface px-2 py-1 font-mono text-xs">{d.txtValue}</code>
                      <CopyButton text={d.txtValue} />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(domain, { onSuccess: () => setDomain(''), onError: (er) => toastError(er) });
          }}
        >
          <Field label="Add a domain" hint="The part after @ in your colleagues' addresses." className="min-w-0 flex-1">
            {(p) => <Input {...p} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />}
          </Field>
          <Button type="submit" variant="secondary" loading={add.isPending} disabled={!domain.trim()}>
            <Plus /> Add
          </Button>
        </form>
      </CardBody>
    </SettingsCard>
  );
}

type Draft = { protocol: SsoProtocol; issuer: string; clientId: string; clientSecret: string; entityId: string; ssoUrl: string; certificate: string; jitEnabled: boolean; defaultRole: 'admin' | 'member' | 'viewer' };

function ConnectionCard({ data }: { data: SsoOverview }) {
  const { org } = useOrgCtx();
  const c = data.connection;
  const blank: Draft = { protocol: 'oidc', issuer: '', clientId: '', clientSecret: '', entityId: '', ssoUrl: '', certificate: '', jitEnabled: true, defaultRole: 'member' };
  const fromConn = (): Draft =>
    c ? { ...blank, protocol: c.protocol, issuer: c.oidc?.issuer ?? '', clientId: c.oidc?.clientId ?? '', entityId: c.saml?.entityId ?? '', ssoUrl: c.saml?.ssoUrl ?? '', jitEnabled: c.jitEnabled, defaultRole: c.defaultRole } : blank;
  const [d, setD] = useState<Draft>(fromConn);
  const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => setD(fromConn()), [c?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useSsoMutation(org.id, (b: SsoConnectionInput) => api(`/api/orgs/${org.id}/sso/connection`, { method: 'PUT', body: b }));
  const del = useSsoMutation(org.id, () => api(`/api/orgs/${org.id}/sso/connection`, { method: 'DELETE' }));
  const [testing, setTesting] = useState(false);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const submit = () => {
    setFields({});
    const body: SsoConnectionInput =
      d.protocol === 'oidc'
        ? { protocol: 'oidc', oidc: { issuer: d.issuer.trim(), clientId: d.clientId.trim(), ...(d.clientSecret ? { clientSecret: d.clientSecret } : {}) }, jitEnabled: d.jitEnabled, defaultRole: d.defaultRole }
        : { protocol: 'saml', saml: { entityId: d.entityId.trim(), ssoUrl: d.ssoUrl.trim(), certificates: d.certificate.trim() ? [d.certificate.trim()] : [] }, jitEnabled: d.jitEnabled, defaultRole: d.defaultRole };
    save.mutate(body, {
      onSuccess: () => {
        set({ clientSecret: '', certificate: '' });
        toast.success('Connection saved', { description: 'Run a test sign-in before switching it on.' });
      },
      onError: (e) => {
        if (e instanceof ApiRequestError) setFields(e.fields);
        toastError(e);
      },
    });
  };
  const test = async () => {
    setTesting(true);
    try {
      const r = await api<{ url: string }>(`/api/orgs/${org.id}/sso/connection/test`, { method: 'POST' });
      window.location.assign(r.url);
    } catch (e) {
      setTesting(false);
      toastError(e);
    }
  };
  const sp = data.sp;
  return (
    <SettingsCard
      icon={<KeyRound />}
      title="Identity provider"
      description="Okta, Microsoft Entra ID, Google Workspace or any OIDC / SAML 2.0 provider."
      actions={<GuideButton id="sso-identity-provider" vars={{ redirectUri: sp.oidcRedirectUri, acsUrl: sp.samlAcsUrl ?? 'shown after you save a SAML connection', entityId: sp.samlEntityId ?? 'shown after you save a SAML connection', metadataUrl: sp.samlMetadataUrl ?? 'shown after you save a SAML connection' }} />}
    >
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard selected={d.protocol === 'oidc'} onSelect={() => set({ protocol: 'oidc' })} title="OpenID Connect (OIDC)" description="Simplest: an app with a client ID and secret." />
          <ChoiceCard selected={d.protocol === 'saml'} onSelect={() => set({ protocol: 'saml' })} title="SAML 2.0" description="An app with a signing certificate." />
        </div>

        <div className="rounded-lg border border-line bg-surface-2/40 p-3">
          <p className="mb-2 text-[13px] font-medium text-ink">Give your identity provider these values</p>
          <dl className="space-y-2 text-[13px]">
            {(d.protocol === 'oidc'
              ? [['Sign-in redirect URI', sp.oidcRedirectUri], ['Initiate login URI', sp.loginUrl]]
              : [['ACS (reply) URL', sp.samlAcsUrl], ['Entity ID (audience)', sp.samlEntityId], ['Metadata URL', sp.samlMetadataUrl]]
            ).map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-wrap items-center gap-2">
                <dt className="w-44 shrink-0 text-ink-3">{k}</dt>
                {v ? (
                  <>
                    <dd className="min-w-0 break-all font-mono text-xs text-ink">{v}</dd>
                    <CopyButton text={v} />
                  </>
                ) : (
                  <dd className="text-ink-3">Save a SAML connection first</dd>
                )}
              </div>
            ))}
          </dl>
        </div>

        {d.protocol === 'oidc' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Issuer URL" hint="e.g. https://acme.okta.com or https://login.microsoftonline.com/<tenant>/v2.0" error={fields['oidc.issuer']} className="sm:col-span-2">
              {(p) => <Input {...p} value={d.issuer} onChange={(e) => set({ issuer: e.target.value })} placeholder="https://" />}
            </Field>
            <Field label="Client ID" error={fields['oidc.clientId']}>
              {(p) => <Input {...p} value={d.clientId} onChange={(e) => set({ clientId: e.target.value })} />}
            </Field>
            <Field label="Client secret" hint={c?.oidc?.hasClientSecret ? 'Stored encrypted. Leave empty to keep it.' : 'Stored encrypted; never shown again.'} error={fields['oidc.clientSecret']}>
              {(p) => <Input {...p} type="password" autoComplete="off" value={d.clientSecret} onChange={(e) => set({ clientSecret: e.target.value })} />}
            </Field>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Identity provider entity ID (issuer)" error={fields['saml.entityId']}>
              {(p) => <Input {...p} value={d.entityId} onChange={(e) => set({ entityId: e.target.value })} />}
            </Field>
            <Field label="Single sign-on URL" hint="HTTP-Redirect binding" error={fields['saml.ssoUrl']}>
              {(p) => <Input {...p} value={d.ssoUrl} onChange={(e) => set({ ssoUrl: e.target.value })} placeholder="https://" />}
            </Field>
            <Field
              label="Signing certificate"
              hint={c?.saml?.certificates.length ? `Stored: ${c.saml.certificates.map((x) => `${x.subject}, valid until ${x.notAfter ? fmtDate(x.notAfter) : '?'}${x.expired ? ' (expired)' : ''}`).join('; ')}. Leave empty to keep it, or paste a new one.` : 'PEM or base64, from your identity provider'}
              error={fields['saml.certificates'] ?? fields['saml.certificates.0']}
              className="sm:col-span-2"
            >
              {(p) => <Textarea {...p} rows={4} value={d.certificate} onChange={(e) => set({ certificate: e.target.value })} placeholder="-----BEGIN CERTIFICATE-----" className="font-mono text-xs" />}
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox label="Create accounts at first sign-in" description="People on your domains who sign in through your provider join the company. Off: only people already invited (or provisioned by SCIM) get in." checked={d.jitEnabled} onChange={(e) => set({ jitEnabled: e.target.checked })} />
          <Field label="Role for new people">
            {(p) => (
              <Select {...p} value={d.defaultRole} onChange={(e) => set({ defaultRole: e.target.value as Draft['defaultRole'] })}>
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            )}
          </Field>
        </div>

        {c?.lastTest && (
          <Callout tone={c.lastTest.ok ? 'good' : 'critical'} title={`Last test · ${fmtDateTime(c.lastTest.at)}`}>
            {c.lastTest.message}
          </Callout>
        )}
        {!data.secretsReady && d.protocol === 'oidc' && <Callout tone="warning">This server cannot store a client secret yet (IDENTITY_KEY is not set). Ask the platform administrator, or use SAML.</Callout>}
      </CardBody>
      <CardFooter className="flex-wrap justify-between gap-2">
        <span className="flex gap-2">
          {c && (
            <Button variant="ghost" onClick={() => window.confirm('Delete the single sign-on connection? Nobody can sign in through it any more.') && del.mutate(undefined, { onError: (e) => toastError(e) })}>
              <Trash2 /> Delete
            </Button>
          )}
        </span>
        <span className="flex gap-2">
          {c && (
            <Button variant="secondary" onClick={() => void test()} loading={testing}>
              <Link2 /> Test sign-in
            </Button>
          )}
          <Button onClick={submit} loading={save.isPending}>
            Save
          </Button>
        </span>
      </CardFooter>
    </SettingsCard>
  );
}

function SwitchesCard({ data }: { data: SsoOverview }) {
  const { org, can } = useOrgCtx();
  const c = data.connection!;
  const verified = data.domains.filter((d) => d.verified).map((d) => d.domain);
  const sw = useSsoMutation(org.id, (b: { enabled?: boolean; enforced?: boolean }) => api(`/api/orgs/${org.id}/sso/connection`, { method: 'PATCH', body: b }));
  const run = (b: { enabled?: boolean; enforced?: boolean }) => sw.mutate(b, { onError: (e) => toastError(e) });
  return (
    <SettingsCard icon={<ShieldCheck />} title="Sign-in rules" description={`Sign-in page: ${data.sp.loginUrl}`}>
      <CardBody className="divide-y divide-line">
        <SwitchRow
          title="Single sign-on is on"
          description={c.lastTest?.ok ? `People with an address on ${verified.join(', ') || 'a verified domain'} can use "Sign in with SSO".` : 'Run a successful test sign-in first.'}
          checked={c.enabled}
          disabled={!c.lastTest?.ok && !c.enabled}
          onCheckedChange={(v) => run({ enabled: v })}
        />
        <SwitchRow
          title="Require single sign-on"
          description="Passwords and Google sign-in stop working for those addresses, and their open sessions end. Owners keep their password (with two-step verification) as the way in if your provider is down."
          checked={c.enforced}
          disabled={!c.enabled || !can('owner')}
          onCheckedChange={(v) => window.confirm(v ? 'Require single sign-on now? Everyone on your domains except owners is signed out and must use SSO.' : 'Stop requiring single sign-on?') && run({ enforced: v })}
        />
      </CardBody>
      {!can('owner') && (
        <CardFooter>
          <p className="text-sm text-ink-3">Only an owner can make single sign-on required.</p>
        </CardFooter>
      )}
    </SettingsCard>
  );
}
