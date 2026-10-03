import { Outlet, useLocation, useParams } from 'react-router';
import { Globe, ShieldAlert } from 'lucide-react';
import { SiteContext, useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtAgo } from '@/lib/utils';
import { Badge, StatusBadge } from '../ui/badge';
import { ButtonLink } from '../ui/button';
import { EmptyState } from '../ui/feedback';
import { ExternalLink } from '../ui/misc';

/** /o/:orgId/sites/:siteId/* — the site header; data pages wait for domain verification (their API answers 403 before). */
export function SiteLayout() {
  const { siteId = '' } = useParams();
  const { org, sites, can } = useOrgCtx();
  const loc = useLocation();
  const site = sites.find((s) => s.id === siteId);

  if (!site)
    return (
      <EmptyState
        icon={<Globe className="size-5" />}
        title="Website not found"
        description="It may have been removed from this company."
        action={<ButtonLink to={paths.org(org.id)}>Back to the dashboard</ButtonLink>}
      />
    );

  const onSettings = loc.pathname.includes('/settings');
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
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-ink">
          <Globe className="size-4 text-ink-3" />
          <ExternalLink href={`https://${site.domain}`} className="text-ink hover:text-accent-text">
            {site.domain}
          </ExternalLink>
        </span>
        {site.verifiedAt ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>}
        {tracking}
        {site.trackingStartedAt && <span className="text-xs text-ink-3">since {fmtAgo(site.trackingStartedAt)}</span>}
      </div>
      {!site.verifiedAt && !onSettings ? (
        <EmptyState
          icon={<ShieldAlert className="size-5" />}
          title={`Verify that you own ${site.domain}`}
          description="Dashboards, tracking and site checks open once ownership is confirmed: give our Google service account access in Search Console (this also connects your data), or add a DNS record or a meta tag."
          action={can('admin') ? <ButtonLink to={paths.site(org.id, site.id, 'settings/verification')}>Verify ownership</ButtonLink> : <span className="text-sm text-ink-3">Ask an admin of your company to verify it.</span>}
        />
      ) : (
        <Outlet />
      )}
    </SiteContext.Provider>
  );
}
