import { Outlet, useLocation, useParams } from 'react-router';
import { ArrowUpRight, Globe, ShieldAlert } from 'lucide-react';
import { SiteContext, useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtAgo } from '@/lib/utils';
import { Badge, StatusBadge } from '../ui/badge';
import { ButtonLink } from '../ui/button';
import { EmptyState } from '../ui/feedback';
import { PageHeader } from '../ui/misc';
import { SITE_NAV } from './OrgLayout';

/** /o/:orgId/sites/:siteId/* — the site header; data pages wait for domain verification (their API answers 403 before). */
export function SiteLayout() {
  const { siteId = '' } = useParams();
  const { org, sites, can } = useOrgCtx();
  const loc = useLocation();
  const site = sites.find((s) => s.id === siteId);

  if (!site)
    return (
      <div className="rounded-xl border border-line bg-surface shadow-card">
        <EmptyState
          titleAs="h1"
          icon={<Globe className="size-5" />}
          title="Website not found"
          description="It may have been removed from this company."
          action={<ButtonLink to={paths.org(org.id)}>Back to the dashboard</ButtonLink>}
        />
      </div>
    );

  const onSettings = loc.pathname.includes('/settings');
  // the page this URL asked for, named like the sidebar (the gate below stands in for it until the site is verified)
  const segment = loc.pathname.split(`/sites/${site.id}/`)[1]?.split('/') ?? [];
  const pageLabel = segment[0] === 'pipeline' && segment[1] === 'new' ? 'New keyword ladder' : segment[0] === 'pipeline' && segment[1] === 'ladders' ? 'Keyword ladder' : (SITE_NAV.find((n) => n.to === segment[0])?.label ?? 'Website');
  const tracking =
    site.trackingStatus === 'active' ? (
      <StatusBadge tone="good">Tracking weekly</StatusBadge>
    ) : site.trackingStatus === 'paused' ? (
      <StatusBadge tone="warning">Tracking paused</StatusBadge>
    ) : (
      <Badge>Not tracked yet</Badge>
    );

  return (
    <SiteContext.Provider value={{ site }}>
      {/* website context strip: which site every page below belongs to, and its state */}
      <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-line pb-4">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-3 shadow-card" aria-hidden>
            <Globe className="size-4" />
          </span>
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex min-w-0 items-center gap-1 rounded-md font-display text-base font-semibold tracking-[-0.01em] text-ink transition-colors duration-150 ease-brand hover:text-accent-text"
          >
            <span className="truncate">{site.domain}</span>
            <ArrowUpRight className="size-3.5 shrink-0 text-ink-3 transition-[color,transform] duration-150 ease-brand group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-accent-text" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {site.verifiedAt ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>}
          {tracking}
          {site.trackingStartedAt && <span className="text-xs text-ink-3">since {fmtAgo(site.trackingStartedAt)}</span>}
        </span>
      </div>
      {!site.verifiedAt && !onSettings ? (
        <>
          <PageHeader title={pageLabel} />
          <div className="rounded-xl border border-line bg-surface shadow-card">
            <EmptyState
              icon={<ShieldAlert className="size-5" />}
              title={`Verify that you own ${site.domain}`}
              description="Dashboards, tracking and site checks open once ownership is confirmed: give our Google service account access in Search Console (this also connects your data), or add a DNS record or a meta tag."
              action={can('admin') ? <ButtonLink to={paths.site(org.id, site.id, 'settings/verification')}>Verify ownership</ButtonLink> : <span className="text-sm text-ink-3">Ask an admin of your company to verify it.</span>}
            />
          </div>
        </>
      ) : (
        <Outlet />
      )}
    </SiteContext.Provider>
  );
}
