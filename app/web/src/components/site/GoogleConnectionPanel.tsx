import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart3, ChevronDown, Plug, RefreshCw, Search } from 'lucide-react';
import { IconTile } from '@/components/ui/icon-tile';
import type { GoogleConnection, Site } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ChoiceCard, Field, Input } from '@/components/ui/field';
import { KeyValue } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { qk, useGoogleConnection, useUpdateSite } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Ga4Steps, SearchConsoleSteps } from './ServiceAccountSteps';

// What our Google service account can read for this website: the Search Console property (and its permission) and the GA4
// properties it has Viewer access to. The company picks the GA4 property that measures the site (stored on the site).

const PERMISSION_LABELS: Record<string, string> = {
  siteOwner: 'Owner',
  siteFullUser: 'Full',
  siteRestrictedUser: 'Restricted',
  siteUnverifiedUser: 'Unverified',
};

export function permissionLabel(p: string | null | undefined): string {
  return p ? (PERMISSION_LABELS[p] ?? p) : '–';
}

export function GoogleConnectionPanel({ orgId, site, canEdit, className }: { orgId: string; site: Site; canEdit: boolean; className?: string }) {
  const conn = useGoogleConnection(orgId, site.id, true);

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile size="sm" className="mt-px">
            <Plug />
          </IconTile>
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">Google data</h3>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-3">Search Console and GA4 feed the weekly report, audits and recommendations.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className={cn('size-3.5', conn.isFetching && 'animate-spin')} />} onClick={() => conn.refetch()} disabled={conn.isFetching}>
          Check again
        </Button>
      </div>
      <div className="px-5 py-4">
        {conn.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
          </div>
        ) : conn.isError ? (
          <ErrorState error={conn.error} onRetry={() => conn.refetch()} title="Could not check the Google connection" />
        ) : (
          <ConnectionBody orgId={orgId} site={site} conn={conn.data} canEdit={canEdit} />
        )}
      </div>
    </Card>
  );
}

function ConnectionBody({ orgId, site, conn, canEdit }: { orgId: string; site: Site; conn: GoogleConnection; canEdit: boolean }) {
  if (!conn.configured)
    return (
      <Callout tone="warning" title="Google access is not set up on this server">
        The platform administrator has not configured the Google service account yet, so Search Console and GA4 cannot be read. Tracking still runs with Google Trends
        and live rank checks.
      </Callout>
    );
  const restricted = conn.gsc.permissionLevel === 'siteRestrictedUser';
  return (
    <div className="divide-y divide-line">
      <section className="pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <IconTile size="xs" tone={conn.gsc.connected ? 'good' : 'warning'}>
            <Search />
          </IconTile>
          <h4 className="text-sm font-semibold text-ink">Search Console</h4>
          {conn.gsc.connected ? <StatusBadge tone="good">Connected</StatusBadge> : <StatusBadge tone="warning">Not connected</StatusBadge>}
        </div>
        {conn.gsc.connected ? (
          <div className="mt-3 space-y-3">
            <KeyValue
              items={[
                { label: 'Property', value: <span className="break-all">{conn.gsc.property ?? '–'}</span> },
                { label: 'Permission', value: permissionLabel(conn.gsc.permissionLevel) },
              ]}
            />
            {restricted && (
              <Callout tone="warning">
                The service account has restricted access. Change it to <strong className="font-medium">Full</strong> in Search Console (Settings → Users and permissions) so
                audits can read sitemaps and page indexing.
              </Callout>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink-2">Search Console is not connected yet. Add the service account as a user:</p>
            <SearchConsoleSteps email={conn.serviceAccountEmail} domain={site.domain} />
            {conn.gsc.error && <p className="text-[13px] text-ink-3">Google said: {conn.gsc.error}</p>}
          </div>
        )}
      </section>

      <section className="pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <IconTile size="xs" tone={conn.ga4.connected ? 'good' : 'warning'}>
            <BarChart3 />
          </IconTile>
          <h4 className="text-sm font-semibold text-ink">Google Analytics 4</h4>
          {conn.ga4.connected ? (
            <StatusBadge tone="good">Connected</StatusBadge>
          ) : conn.ga4.properties.length ? (
            <StatusBadge tone="warning">Choose a property</StatusBadge>
          ) : (
            <StatusBadge tone="warning">Not connected</StatusBadge>
          )}
          <Badge>optional</Badge>
        </div>
        <div className="mt-3 space-y-4">
          {conn.ga4.properties.length ? (
            <Ga4Picker orgId={orgId} site={site} conn={conn} canEdit={canEdit} />
          ) : (
            <>
              <p className="text-sm text-ink-2">
                GA4 adds visits and conversions from search to the weekly report. Give the service account Viewer access, then press “Check again”:
              </p>
              <Ga4Steps email={conn.serviceAccountEmail} />
              {conn.ga4.error && <p className="text-[13px] text-ink-3">Google said: {conn.ga4.error}</p>}
              <ManualGa4 orgId={orgId} site={site} canEdit={canEdit} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** After a GA4 change the connection status (connected / selected) is stale: check it again. */
function useRefreshConnection(siteId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...qk.site(siteId), 'google'] });
}

function Ga4Picker({ orgId, site, conn, canEdit }: { orgId: string; site: Site; conn: GoogleConnection; canEdit: boolean }) {
  const update = useUpdateSite(orgId, site.id);
  const refresh = useRefreshConnection(site.id);
  const current = site.ga4PropertyId || conn.ga4.selected || '';
  const [showOthers, setShowOthers] = useState(false);
  const matching = conn.ga4.properties.filter((p) => p.matchesDomain);
  const others = conn.ga4.properties.filter((p) => !p.matchesDomain);
  const visibleOthers = others.filter((p) => showOthers || p.id === current);

  const choose = (id: string) => {
    if (!canEdit || id === current) return;
    update.mutate(
      { ga4PropertyId: id },
      {
        onSuccess: () => {
          toast.success('GA4 property saved');
          refresh();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const card = (p: GoogleConnection['ga4']['properties'][number]) => (
    <ChoiceCard
      key={p.id}
      selected={p.id === current}
      onSelect={() => choose(p.id)}
      disabled={!canEdit || update.isPending}
      title={p.name}
      description={`Property ${p.id} · account ${p.account}`}
      badge={p.matchesDomain ? <Badge tone="accent">Measures {site.domain}</Badge> : undefined}
    />
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        {matching.length
          ? 'Choose the property that measures this website. The one whose web stream points to your domain is listed first.'
          : `None of the properties shared with the service account has a web stream for ${site.domain}. Choose the right one or enter its ID.`}
      </p>
      <div role="radiogroup" aria-label="GA4 property" className="space-y-2">
        {matching.map(card)}
        {visibleOthers.map(card)}
      </div>
      {others.length > visibleOthers.length && (
        <button type="button" onClick={() => setShowOthers(true)} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
          <ChevronDown className="size-3.5" aria-hidden />
          Show {others.length - visibleOthers.length} other {others.length - visibleOthers.length === 1 ? 'property' : 'properties'}
        </button>
      )}
      {!current && <p className="text-[13px] text-ink-3">If you leave it empty, the tracker picks the property whose web stream matches your domain.</p>}
      <ManualGa4 orgId={orgId} site={site} canEdit={canEdit} compact />
    </div>
  );
}

/** Enter the GA4 property ID by hand (GA4 → Admin → Property details). */
function ManualGa4({ orgId, site, canEdit, compact }: { orgId: string; site: Site; canEdit: boolean; compact?: boolean }) {
  const update = useUpdateSite(orgId, site.id);
  const refresh = useRefreshConnection(site.id);
  const [open, setOpen] = useState(!compact && !!site.ga4PropertyId);
  const [value, setValue] = useState(site.ga4PropertyId);
  const [err, setErr] = useState<string | null>(null);
  if (!canEdit) return site.ga4PropertyId ? <p className="text-[13px] text-ink-3">Saved property ID: {site.ga4PropertyId}</p> : null;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
        Enter a property ID instead
      </button>
    );
  const save = () => {
    const v = value.trim();
    if (!/^\d{0,16}$/.test(v)) {
      setErr('Digits only, for example 543096312');
      return;
    }
    setErr(null);
    update.mutate(
      { ga4PropertyId: v },
      {
        onSuccess: () => {
          toast.success(v ? 'GA4 property ID saved' : 'GA4 property ID cleared');
          refresh();
        },
        onError: (e) => setErr(errorMessage(e)),
      },
    );
  };
  return (
    <Field label="GA4 property ID" hint="GA4 → Admin → Property details. Digits only." error={err ?? undefined} className="max-w-md">
      {(p) => (
        <div className="flex gap-2">
          <Input {...p} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="543096312" />
          <Button variant="secondary" onClick={save} loading={update.isPending} className="shrink-0">
            Save ID
          </Button>
        </div>
      )}
    </Field>
  );
}
