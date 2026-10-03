import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Code2, Search, Server, ShieldCheck } from 'lucide-react';
import { VERIFICATION_META_NAME, type Site, type VerificationMethod, type VerifyResult } from '@seo/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ChoiceCard } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { qk, useProviders, useVerification, useVerifySite } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { fmtDate } from '@/lib/utils';
import { GoogleConnectionPanel } from './GoogleConnectionPanel';
import { StepList } from './ServiceAccountSteps';

// Proof that the company owns the website before any of its data is shown: the person's own Google account owns the domain in
// Search Console ("Verify with Google", when Google sign-in is configured), a DNS TXT record, or a meta tag on the homepage.
// Giving the engine's service account access connects the data afterwards; it is not proof of ownership.

export const METHOD_LABELS: Record<VerificationMethod, string> = {
  search_console: 'Google (Search Console owner)',
  dns: 'DNS record',
  meta: 'Meta tag',
};

export function VerificationPanel({
  orgId,
  site,
  canEdit,
  showGoogle = true,
  onVerified,
}: {
  orgId: string;
  site: Site;
  canEdit: boolean;
  /** show the Google connection (Search Console / GA4) once verified */
  showGoogle?: boolean;
  onVerified?: (r: VerifyResult) => void;
}) {
  const info = useVerification(orgId, site.id);
  const verify = useVerifySite(orgId, site.id);
  const providers = useProviders();
  const google = !!providers.data?.google;
  const [method, setMethod] = useState<VerificationMethod>('dns');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();

  useEffect(() => {
    if (google) setMethod((m) => (m === 'dns' ? 'search_console' : m));
  }, [google]);

  // back from Google: ?google=verified | not_owner | claimed | already | failed | disabled
  useEffect(() => {
    const g = params.get('google');
    if (!g) return;
    const msg: Record<string, [string, 'success' | 'error']> = {
      verified: [`${site.domain} is verified with Google`, 'success'],
      already: [`${site.domain} was already verified`, 'success'],
      not_owner: [`That Google account is not a verified owner of ${site.domain} in Search Console. Sign in with the owner's account, or use a DNS record or meta tag.`, 'error'],
      claimed: [`${site.domain} is already verified by another company`, 'error'],
      disabled: ['Google sign-in is not configured on this server', 'error'],
      failed: ['Google did not complete the check. Please try again.', 'error'],
    };
    const [text, kind] = msg[g] ?? msg.failed;
    if (kind === 'success') toast.success(text);
    else toast.error(text);
    if (g === 'verified') {
      qc.invalidateQueries({ queryKey: qk.site(site.id) });
      qc.invalidateQueries({ queryKey: qk.sites(orgId) });
      info.refetch();
      onVerified?.({ verified: true, method: 'search_console', message: text });
    }
    const next = new URLSearchParams(params);
    next.delete('google');
    setParams(next, { replace: true });
  }, [params, setParams, site.domain, site.id, orgId, qc, info, onVerified]);

  if (info.isPending)
    return (
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  if (info.isError) return <ErrorState error={info.error} onRetry={() => info.refetch()} title="Could not load the verification details" />;
  const v = info.data;
  const verified = v.verified || !!site.verifiedAt;

  if (verified)
    return (
      <div className="space-y-5">
        <Callout tone="good" title={`${site.domain} is verified`}>
          Confirmed {fmtDate(v.verifiedAt ?? site.verifiedAt)}
          {(v.method ?? site.verificationMethod) && <> with {METHOD_LABELS[(v.method ?? site.verificationMethod)!].toLowerCase()}</>}. Dashboards, tracking and site checks are
          open for this website.
        </Callout>
        {showGoogle && (canEdit ? <GoogleConnectionPanel orgId={orgId} site={site} canEdit={canEdit} /> : <p className="text-[13px] text-ink-3">An admin of your company manages the Search Console and GA4 connection.</p>)}
      </div>
    );

  if (v.claimedElsewhere)
    return (
      <Callout tone="critical" title={`Another company has already verified ${site.domain}`}>
        A website can belong to one company only. If it is yours, ask the owner of that company to invite you, or contact the platform administrator. You can delete this
        website from your company in Website settings → Delete.
      </Callout>
    );

  const check = () => {
    setResult(null);
    verify.mutate(
      { method },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.verified) {
            toast.success(`${site.domain} is verified`);
            onVerified?.(r);
          }
        },
      },
    );
  };

  const methods: { id: VerificationMethod; title: string; description: string; icon: ReactNode; badge?: ReactNode }[] = [
    ...(google
      ? [
          {
            id: 'search_console' as const,
            title: 'Verify with Google',
            description: 'Sign in with the Google account that owns the site in Search Console. We check, read-only, that you are a verified owner.',
            icon: <Search className="size-5" />,
            badge: <Badge tone="accent">Fastest</Badge>,
          },
        ]
      : []),
    {
      id: 'dns',
      title: 'Add a DNS record',
      description: 'A TXT record at your domain provider. Good if you manage DNS but cannot edit the website.',
      icon: <Server className="size-5" />,
    },
    {
      id: 'meta',
      title: 'Add a meta tag',
      description: 'One line in the <head> of your homepage. Good if you can edit the site but not DNS.',
      icon: <Code2 className="size-5" />,
    },
  ];

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Verification method" className={google ? 'grid gap-2 lg:grid-cols-3' : 'grid gap-2 md:grid-cols-2'}>
        {methods.map((m) => (
          <ChoiceCard
            key={m.id}
            selected={method === m.id}
            onSelect={() => {
              setMethod(m.id);
              setResult(null);
            }}
            title={m.title}
            description={m.description}
            icon={m.icon}
            badge={m.badge}
          />
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface-2 p-4 sm:p-5">
        {method === 'search_console' && (
          <div className="space-y-4">
            <StepList
              steps={[
                <>Press “Verify with Google” and choose the Google account that is an <strong>owner</strong> of {site.domain} in Search Console.</>,
                <>Allow read-only access to Search Console. We only check that you own the property; nothing is changed.</>,
                <>You come back here verified. Then connect the data: add our service account to Search Console and GA4 (the next step shows how).</>,
              ]}
            />
            <p className="text-[13px] leading-relaxed text-ink-3">Not an owner yourself? Ask the owner to verify, or use a DNS record or meta tag instead.</p>
          </div>
        )}

        {method === 'dns' && (
          <div className="space-y-4">
            <StepList
              steps={[
                <>Sign in where you manage your domain's DNS (GoDaddy, Cloudflare, Namecheap, your hosting panel…).</>,
                <>Add a new record with these values:</>,
              ]}
            />
            <div className="overflow-x-auto rounded-lg border border-line-strong bg-surface">
              <table className="w-full text-sm">
                <tbody>
                  <RecordRow label="Type" value={v.dnsRecord.type} />
                  <RecordRow label="Host / name" value={v.dnsRecord.host} copy />
                  <RecordRow label="Value" value={v.dnsRecord.value} copy />
                </tbody>
              </table>
            </div>
            <StepList start={3} steps={[<>Save it, then press “Check now”.</>]} />
            <p className="text-[13px] leading-relaxed text-ink-3">
              Some providers want “@” instead of the domain as the host. New records usually appear within minutes but can take up to an hour or two; you can leave this
              page and check later. Keep the record in place.
            </p>
          </div>
        )}

        {method === 'meta' && (
          <div className="space-y-4">
            <StepList
              steps={[
                <>Copy this tag:</>,
              ]}
            />
            <div className="flex flex-wrap items-start gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{v.metaTag}</code>
              <CopyButton text={v.metaTag} label="Copy tag" />
            </div>
            <StepList
              start={2}
              steps={[
                <>
                  Paste it inside the <code className="font-mono text-[13px]">&lt;head&gt;</code> of your homepage, https://{site.domain}/. In WordPress, use your SEO
                  plugin's “webmaster verification” or a header-code setting.
                </>,
                <>Publish the change, then press “Check now”.</>,
              ]}
            />
            <p className="text-[13px] leading-relaxed text-ink-3">
              We look for <code className="font-mono">{VERIFICATION_META_NAME}</code> on https://{site.domain}/ and https://www.{site.domain}/. Clear your site's cache if the
              change does not show.
            </p>
          </div>
        )}
      </div>

      {result && !result.verified && (
        <Callout tone="critical" title="Not verified yet">
          {result.message}
        </Callout>
      )}
      {verify.isError && <Callout tone="critical">{errorMessage(verify.error)}</Callout>}

      <div className="flex flex-wrap items-center gap-3">
        {method === 'search_console' ? (
          canEdit && (
            <a
              href={`/api/orgs/${orgId}/sites/${site.id}/verify/google?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink shadow-sm hover:bg-accent-hover"
            >
              <ShieldCheck className="size-4" />
              Verify with Google
            </a>
          )
        ) : (
          <Button onClick={check} loading={verify.isPending} disabled={!canEdit} icon={<ShieldCheck className="size-4" />}>
            Check now
          </Button>
        )}
        {!canEdit && <span className="text-[13px] text-ink-3">Only admins of your company can verify a website.</span>}
      </div>
    </div>
  );
}

function RecordRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className="w-32 whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-ink-3">
        {label}
      </th>
      <td className="px-3 py-2">
        <code className="break-all font-mono text-[13px] text-ink">{value}</code>
      </td>
      <td className="w-24 px-3 py-2 text-right">{copy && <CopyButton text={value} />}</td>
    </tr>
  );
}
