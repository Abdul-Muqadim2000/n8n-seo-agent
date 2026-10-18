import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { AtSign, Globe2, Mail, Palette, ShieldCheck, Trash2 } from 'lucide-react';
import {
  brandingSchema,
  brandInitials,
  brandTokens,
  clientBrandingSchema,
  NEUTRALS,
  type Branding,
  type BrandTokenSet,
  type ClientBranding,
  type PortalDomainView,
} from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { AgencyLockup } from '@/components/layout/Brand';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { CopyButton, ExternalLink } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { SwitchRow } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useBranding, useCheckPortalMail, useClientSettings, usePortalDomainMutations, usePortalDomains, usePortalMail, useSaveBranding, useSavePortalMail } from '@/lib/queries';
import { fmtAgo } from '@/lib/utils';
import { SettingsCard } from './SettingsCard';

// G5 (app/docs/WHITE_LABEL.md): an agency's Branding, Portal address and Client e-mail; a client workspace's own branding override
// and its approval rule. These are the agency's admin screens, so they stay in our look; the preview shows the agency's.

const fieldErrors = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message])) as Record<string, string>;

/** a small portal header + button + link drawn with the brand's computed tokens, in light and in dark */
function BrandPreview({ name, logoUrl, logoDarkUrl, accent }: { name: string; logoUrl: string | null; logoDarkUrl: string | null; accent: string }) {
  const t = brandTokens(accent);
  const modes: { label: string; neutrals: (typeof NEUTRALS)['light'] | (typeof NEUTRALS)['dark']; tokens: BrandTokenSet | null; dark: boolean }[] = [
    { label: 'Light', neutrals: NEUTRALS.light, tokens: t?.light ?? null, dark: false },
    { label: 'Dark', neutrals: NEUTRALS.dark, tokens: t?.dark ?? null, dark: true },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {modes.map((m) => {
        // the preview's own scope: the brand's tokens and the mode's neutrals as CSS variables, so the kit's classes draw them
        const vars = {
          '--page': m.neutrals.page,
          '--surface': m.neutrals.surface,
          '--surface-2': m.neutrals.surface2,
          '--ink': m.neutrals.ink,
          '--ink-2': m.neutrals.ink,
          '--line': m.dark ? NEUTRALS.dark.surface2 : NEUTRALS.light.surface2,
          ...(m.tokens ? Object.fromEntries(Object.entries(m.tokens).map(([k, v]) => [`--${k}`, v])) : {}),
        } as CSSProperties;
        return (
          <figure key={m.label} style={vars} className={m.dark ? 'dark-preview' : ''}>
            <div className="overflow-hidden rounded-lg border border-line bg-page">
              <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2.5">
                <AgencyLockup name={name} logoUrl={m.dark ? (logoDarkUrl ?? logoUrl) : logoUrl} logoDarkUrl={null} initials={brandInitials(name)} />
              </div>
              <div className="space-y-2 p-3">
                <p className="text-[13px] text-ink">
                  Clicks rose 12% this week. <span className="font-medium text-accent-text underline underline-offset-2">See the report</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-accent-ink">Approve page</span>
                  <span className="inline-flex h-6 items-center rounded-md bg-accent-soft px-2 text-xs font-medium text-accent-text">Selected</span>
                </div>
              </div>
            </div>
            <figcaption className="mt-1.5 text-xs text-ink-3">{m.label} mode</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function ContrastReport({ accent }: { accent: string }) {
  const t = brandTokens(accent);
  if (!t) return null;
  const c = t.contrast;
  return (
    <div className="space-y-2 text-[13px]">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="good">{`Buttons ${c.ratios.button.toFixed(1)}:1`}</StatusBadge>
        <StatusBadge tone="good">{`Links, light ${c.ratios.lightText.toFixed(1)}:1`}</StatusBadge>
        <StatusBadge tone="good">{`Links, dark ${c.ratios.darkText.toFixed(1)}:1`}</StatusBadge>
      </div>
      <p className="text-ink-3">Every pairing passes WCAG AA (4.5:1). {c.adjustments.length ? 'To get there:' : 'Your colour needed no change.'}</p>
      {c.adjustments.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-ink-2">
          {c.adjustments.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ColourField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field label="Brand colour" hint="One colour, used for buttons, links and highlights. We adjust its shade where needed so text stays readable." error={error} optional>
      {(p) => (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Pick the brand colour"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#2e4bff'}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface p-1"
          />
          <Input {...p} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#1f6feb" className="font-mono" maxLength={7} />
        </div>
      )}
    </Field>
  );
}

export function BrandingTab() {
  const { org } = useOrgCtx();
  return org.kind === 'client' ? <ClientBrandingTab /> : <AgencyBrandingTab />;
}

function AgencyBrandingTab() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const q = useBranding(org.id);
  const save = useSaveBranding(org.id);
  const [draft, setDraft] = useState<Branding | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data && q.data.kind === 'agency') setDraft(q.data.branding as Branding);
  }, [q.data]);
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data || !draft) return <Skeleton className="h-96 max-w-4xl" />;
  const set = (p: Partial<Branding>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const dirty = JSON.stringify(draft) !== JSON.stringify(q.data.branding);
  const submit = () => {
    const r = brandingSchema.safeParse(draft);
    if (!r.success) return setErrors(fieldErrors(r));
    setErrors({});
    save.mutate(r.data, { onSuccess: () => toast.success('Branding saved'), onError: (e) => toast.error(errorMessage(e)) });
  };
  const name = draft.productName || org.name;
  return (
    <div className="max-w-4xl space-y-5">
      <SettingsCard icon={<Palette />} title="Your brand" description="What your clients see in the portal, on report pages, in shared reports, documents and e-mails." actions={<GuideButton id="portal-branding" />}>
        <CardBody className="space-y-5">
          <SwitchRow
            title="White-label"
            description="On: your clients see your name, logo and colour, and not ours. Off: they see the app as it is, with your company’s name."
            checked={draft.whiteLabel}
            disabled={!admin}
            onCheckedChange={(v) => set({ whiteLabel: v })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" hint={`What clients call the portal (default: ${org.name}).`} error={errors.productName} optional>
              {(p) => <Input {...p} value={draft.productName} onChange={(e) => set({ productName: e.target.value })} placeholder={`${org.name} Insights`} disabled={!admin} maxLength={60} />}
            </Field>
            <ColourField value={draft.accent} onChange={(v) => set({ accent: v })} error={errors.accent} />
            <Field label="Logo address" hint="https, on your own website or CDN. SVG or PNG, transparent background." error={errors.logoUrl} optional>
              {(p) => <Input {...p} value={draft.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://youragency.com/logo.svg" disabled={!admin} inputMode="url" />}
            </Field>
            <Field label="Logo for dark backgrounds" hint="Optional. Without it the logo sits on a white tile in dark mode." error={errors.logoDarkUrl} optional>
              {(p) => <Input {...p} value={draft.logoDarkUrl} onChange={(e) => set({ logoDarkUrl: e.target.value })} placeholder="https://youragency.com/logo-white.svg" disabled={!admin} inputMode="url" />}
            </Field>
            <Field label="Support e-mail" hint="Shown to clients, and where their replies go unless you set a reply-to." error={errors.supportEmail} optional>
              {(p) => <Input {...p} type="email" value={draft.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} placeholder="help@youragency.com" disabled={!admin} />}
            </Field>
            <Field label="Footer line" hint="For example your company name and address." error={errors.footerText} optional>
              {(p) => <Input {...p} value={draft.footerText} onChange={(e) => set({ footerText: e.target.value })} placeholder="North Agency Ltd · London" disabled={!admin} maxLength={200} />}
            </Field>
          </div>
          <SwitchRow
            title="Show “Powered by Ascentra”"
            description="A small line in the portal’s footer and on the sign-in page. Off by default."
            checked={draft.poweredBy}
            disabled={!admin}
            onCheckedChange={(v) => set({ poweredBy: v })}
          />
        </CardBody>
        {admin && (
          <CardFooter className="flex justify-end">
            <Button onClick={submit} loading={save.isPending} disabled={!dirty}>
              Save branding
            </Button>
          </CardFooter>
        )}
      </SettingsCard>
      <SettingsCard icon={<ShieldCheck />} title="Preview and contrast" description="How the portal draws your brand, and the contrast every text keeps.">
        <CardBody className="space-y-4">
          <BrandPreview name={name} logoUrl={draft.logoUrl || null} logoDarkUrl={draft.logoDarkUrl || null} accent={/^#[0-9a-f]{6}$/i.test(draft.accent) ? draft.accent : '#2e4bff'} />
          {/^#[0-9a-f]{6}$/i.test(draft.accent) ? <ContrastReport accent={draft.accent} /> : <p className="text-[13px] text-ink-3">Without a colour of your own the portal keeps the app’s blue.</p>}
        </CardBody>
      </SettingsCard>
    </div>
  );
}

function ClientBrandingTab() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const q = useBranding(org.id);
  const save = useSaveBranding(org.id);
  const settings = useClientSettings(org.id);
  const [draft, setDraft] = useState<ClientBranding | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data && q.data.kind === 'client') setDraft(q.data.branding as ClientBranding);
  }, [q.data]);
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data || !draft) return <Skeleton className="h-80 max-w-4xl" />;
  const agencyBrand = q.data.agencyBrand;
  const set = (p: Partial<ClientBranding>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const dirty = JSON.stringify(draft) !== JSON.stringify(q.data.branding);
  const submit = () => {
    const r = clientBrandingSchema.safeParse(draft);
    if (!r.success) return setErrors(fieldErrors(r));
    setErrors({});
    save.mutate(r.data, { onSuccess: () => toast.success('Branding saved'), onError: (e) => toast.error(errorMessage(e)) });
  };
  const accent = draft.accent || agencyBrand?.accent || '#2e4bff';
  return (
    <div className="max-w-4xl space-y-5">
      <SettingsCard icon={<ShieldCheck />} title="Client approvals" description="Whether this client approves pages and outreach before they go out.">
        <CardBody>
          <SwitchRow
            title="Client approval required"
            description="A page cannot be published live, and an outreach draft cannot be approved for sending, until the client’s approver has approved it under Approvals."
            checked={org.clientApproval}
            disabled={!admin || settings.isPending}
            onCheckedChange={(v) => settings.mutate({ clientApproval: v }, { onSuccess: () => toast.success(v ? 'Client approval is now required' : 'Client approval is no longer required'), onError: (e) => toast.error(errorMessage(e)) })}
          />
        </CardBody>
      </SettingsCard>
      <SettingsCard icon={<Palette />} title="This client’s brand" description="Leave a field empty to use the agency’s." actions={<GuideButton id="portal-branding" />}>
        <CardBody className="space-y-4">
          {!agencyBrand && <Callout tone="info">White-label is off for your agency, so this client sees the app as it is. Turn it on under the agency’s Company settings → Branding.</Callout>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" error={errors.productName} optional hint={agencyBrand ? `Default: ${agencyBrand.name}` : undefined}>
              {(p) => <Input {...p} value={draft.productName} onChange={(e) => set({ productName: e.target.value })} disabled={!admin} maxLength={60} />}
            </Field>
            <ColourField value={draft.accent} onChange={(v) => set({ accent: v })} error={errors.accent} />
            <Field label="Logo address" error={errors.logoUrl} optional>
              {(p) => <Input {...p} value={draft.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://…" disabled={!admin} inputMode="url" />}
            </Field>
            <Field label="Logo for dark backgrounds" error={errors.logoDarkUrl} optional>
              {(p) => <Input {...p} value={draft.logoDarkUrl} onChange={(e) => set({ logoDarkUrl: e.target.value })} placeholder="https://…" disabled={!admin} inputMode="url" />}
            </Field>
          </div>
          <BrandPreview
            name={draft.productName || agencyBrand?.name || org.name}
            logoUrl={draft.logoUrl || agencyBrand?.logoUrl || null}
            logoDarkUrl={draft.logoUrl ? draft.logoDarkUrl || null : (agencyBrand?.logoDarkUrl ?? null)}
            accent={/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#2e4bff'}
          />
        </CardBody>
        {admin && (
          <CardFooter className="flex justify-end">
            <Button onClick={submit} loading={save.isPending} disabled={!dirty}>
              Save
            </Button>
          </CardFooter>
        )}
      </SettingsCard>
    </div>
  );
}

// ---------------- portal address ----------------

const statusTone = (s: PortalDomainView['status']) => (s === 'verified' ? 'good' : s === 'lapsed' ? 'critical' : 'warning');
const statusLabel = { verified: 'Verified', pending: 'Waiting for DNS', lapsed: 'Not served: proof missing' } as const;

export function PortalDomainTab() {
  const { org, can } = useOrgCtx();
  const q = usePortalDomains(org.id);
  const m = usePortalDomainMutations(org.id);
  const [host, setHost] = useState('');
  const [releasing, setReleasing] = useState<PortalDomainView | null>(null);
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Skeleton className="h-72 max-w-4xl" />;
  const { domains, cnameTarget } = q.data;
  const claim = () =>
    m.claim.mutate(host.trim(), {
      onSuccess: (d) => {
        setHost('');
        toast.success(`${d.host} added: publish the two DNS records, then check`);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  return (
    <div className="max-w-4xl space-y-5">
      <SettingsCard
        icon={<Globe2 />}
        title="Portal address"
        description="Your clients open the portal at an address of your own. It needs two DNS records, and is checked again every few hours."
        actions={<GuideButton id="portal-domain" vars={{ host: domains[0]?.host ?? null, txtName: domains[0]?.txtName ?? null, txtValue: domains[0]?.txtValue ?? null, cnameTarget }} />}
      >
        <CardBody className="space-y-4">
          {!cnameTarget && (
            <Callout tone="info">This installation does not check where the address points. Ask your platform operator which host to point the CNAME at; only the TXT record is checked.</Callout>
          )}
          {domains.map((d) => (
            <div key={d.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-sm font-medium text-ink">{d.host}</span>
                  <StatusBadge tone={statusTone(d.status)}>{statusLabel[d.status]}</StatusBadge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.status === 'verified' && <ExternalLink href={d.url}>Open the portal</ExternalLink>}
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={m.verify.isPending && m.verify.variables === d.id}
                    onClick={() =>
                      m.verify.mutate(d.id, {
                        onSuccess: (r) => (r.check.ok ? toast.success(`${d.host} is verified`) : toast.error(r.check.detail || 'Not verified yet')),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  >
                    Check now
                  </Button>
                  {can('owner') && (
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setReleasing(d)} aria-label={`Release ${d.host}`}>
                      Release
                    </Button>
                  )}
                </div>
              </div>
              <dl className="mt-3 grid gap-2 text-[13px]">
                <DnsRow type="TXT" name={d.txtName} value={d.txtValue} />
                <DnsRow type="CNAME" name={d.host} value={d.cnameTarget ?? 'ask your platform operator'} copy={!!d.cnameTarget} />
              </dl>
              {d.lastCheckAt && (
                <p className="mt-2 text-xs text-ink-3">
                  Last checked {fmtAgo(d.lastCheckAt)}: {d.lastCheckDetail}
                </p>
              )}
            </div>
          ))}
          {domains.length < 3 && (
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (host.trim()) claim();
              }}
            >
              <Field label="Add an address" className="flex-1" hint="A sub-domain of your website works best, such as seo.youragency.com.">
                {(p) => <Input {...p} value={host} onChange={(e) => setHost(e.target.value)} placeholder="seo.youragency.com" inputMode="url" autoComplete="off" />}
              </Field>
              <Button type="submit" loading={m.claim.isPending} disabled={!host.trim()} className="sm:mb-6">
                Add address
              </Button>
            </form>
          )}
        </CardBody>
      </SettingsCard>
      <Dialog
        open={!!releasing}
        onOpenChange={(o) => !o && setReleasing(null)}
        title={`Release ${releasing?.host ?? ''}?`}
        description="Clients can no longer sign in there, and links in earlier e-mails stop working. Remove the DNS records afterwards."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReleasing(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={m.release.isPending}
              onClick={() =>
                releasing &&
                m.release.mutate(releasing.id, {
                  onSuccess: () => {
                    toast.success(`${releasing.host} released`);
                    setReleasing(null);
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              Release address
            </Button>
          </>
        }
      />
    </div>
  );
}

function DnsRow({ type, name, value, copy = true }: { type: string; name: string; value: string; copy?: boolean }) {
  return (
    <div className="grid gap-1 rounded-lg bg-surface-2 p-2.5 sm:grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-3">
      <dt>
        <Badge>{type}</Badge>
      </dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <code className="min-w-0 break-all font-mono text-[12px] text-ink">{name}</code>
        <CopyButton text={name} label={`Copy the ${type} name`} />
      </dd>
      <dd className="flex min-w-0 items-center gap-1.5">
        <code className="min-w-0 break-all font-mono text-[12px] text-ink">{value}</code>
        {copy && <CopyButton text={value} label={`Copy the ${type} value`} />}
      </dd>
    </div>
  );
}

// ---------------- client e-mail ----------------

export function ClientMailTab() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const q = usePortalMail(org.id);
  const save = useSavePortalMail(org.id);
  const check = useCheckPortalMail(org.id);
  const [draft, setDraft] = useState({ senderName: '', replyTo: '', fromMailboxId: null as string | null, dkimSelector: '' });
  useEffect(() => {
    if (q.data) setDraft({ senderName: q.data.senderName, replyTo: q.data.replyTo, fromMailboxId: q.data.fromMailboxId, dkimSelector: q.data.dkimSelector });
  }, [q.data]);
  const domain = useMemo(() => q.data?.mailboxes.find((x) => x.id === draft.fromMailboxId)?.email.split('@')[1] ?? null, [q.data, draft.fromMailboxId]);
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Skeleton className="h-72 max-w-4xl" />;
  const v = q.data;
  const fc = v.fromCheck;
  const dirty = JSON.stringify(draft) !== JSON.stringify({ senderName: v.senderName, replyTo: v.replyTo, fromMailboxId: v.fromMailboxId, dkimSelector: v.dkimSelector });
  const submit = () => save.mutate(draft, { onSuccess: () => toast.success('Client e-mail saved'), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <div className="max-w-4xl space-y-5">
      <SettingsCard icon={<Mail />} title="Who your clients hear from" description="Invitations, password e-mails and scheduled reports to your clients." actions={<GuideButton id="portal-email-auth" vars={{ domain }} />}>
        <CardBody className="space-y-4">
          {!v.smtpConfigured && <Callout tone="warning">This server has no mail account, so nothing is e-mailed yet; links are shown in the app instead. The settings below apply once it has one.</Callout>}
          <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
            <span className="text-ink-3">Clients see: </span>
            <span className="break-all font-mono text-ink">{v.effectiveFrom}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sender name" hint="Default: your product name." optional>
              {(p) => <Input {...p} value={draft.senderName} onChange={(e) => setDraft((d) => ({ ...d, senderName: e.target.value }))} disabled={!admin} maxLength={80} />}
            </Field>
            <Field label="Reply-to" hint="Where your clients’ replies go. Default: the support e-mail of your brand." optional>
              {(p) => <Input {...p} type="email" value={draft.replyTo} onChange={(e) => setDraft((d) => ({ ...d, replyTo: e.target.value }))} disabled={!admin} placeholder="team@youragency.com" />}
            </Field>
            <Field label="Send from" hint={v.mailboxes.length ? 'Your own address, once its SPF and DKIM verify.' : 'Connect a mailbox first (Company settings → Mailboxes).'}>
              {(p) => (
                <Select {...p} value={draft.fromMailboxId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, fromMailboxId: e.target.value || null }))} disabled={!admin}>
                  <option value="">Our address, with your sender name</option>
                  {v.mailboxes.map((mb) => (
                    <option key={mb.id} value={mb.id}>
                      {mb.email}
                      {mb.status !== 'active' ? ` (${mb.status})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="DKIM selector" hint="Only if your mail provider uses an uncommon one." optional>
              {(p) => <Input {...p} value={draft.dkimSelector} onChange={(e) => setDraft((d) => ({ ...d, dkimSelector: e.target.value }))} disabled={!admin || !draft.fromMailboxId} placeholder="s1" className="font-mono" />}
            </Field>
          </div>
          {fc && v.fromEmail && (
            <div className="space-y-2 rounded-xl border border-line p-3 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <AtSign className="size-4 text-ink-3" aria-hidden />
                <span className="font-mono text-ink">{fc.email}</span>
                <StatusBadge tone={fc.spf === 'pass' ? 'good' : 'warning'}>{fc.spf === 'pass' ? 'SPF passes' : fc.spf === 'weak' ? 'SPF too permissive' : 'No SPF'}</StatusBadge>
                <StatusBadge tone={fc.dkim === 'found' ? 'good' : 'warning'}>{fc.dkim === 'found' ? 'DKIM found' : 'DKIM not found'}</StatusBadge>
                <span className="text-xs text-ink-3">checked {fmtAgo(fc.checkedAt)}</span>
              </div>
              {fc.notes.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-ink-2">
                  {fc.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              {admin && (
                <Button size="sm" variant="secondary" loading={check.isPending} onClick={() => check.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}>
                  Check again
                </Button>
              )}
            </div>
          )}
          {save.isError && <Callout tone="critical">{errorMessage(save.error)}</Callout>}
        </CardBody>
        {admin && (
          <CardFooter className="flex justify-end">
            <Button onClick={submit} loading={save.isPending} disabled={!dirty}>
              Save
            </Button>
          </CardFooter>
        )}
      </SettingsCard>
    </div>
  );
}
