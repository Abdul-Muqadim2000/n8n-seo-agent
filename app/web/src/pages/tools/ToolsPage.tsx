import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Clock, Coins, Globe, History, Lock, PackageCheck, Plus, Settings } from 'lucide-react';
import { formatUsd, MODE_CATEGORIES, MODES, type ModeCategory, type ModeId, type ModeInfo, type Site } from '@seo/shared';
import { lastSite, useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/misc';
import { CATEGORY_ICON, ModeGlyph } from '@/components/reports/meta';

/** Typical cost per mode as a range where the options change it (mirrors the server estimate). */
const COST_TEXT: Partial<Record<ModeId, string>> = {
  keyword: '$0.40 report · $1.20 with the page',
  discover: 'from $0.40',
  audit: '$0.10 · full report $0.90',
  ladder: 'from $1.80 (plan + 1 page)',
  track: '$0.10 setup, then weekly monitors',
};
const SETTINGS_TAB: Partial<Record<ModeId, string>> = { profile: 'settings/profile', track: 'settings/tracking' };
const CATEGORY_ORDER = Object.keys(MODE_CATEGORIES) as ModeCategory[];

export default function ToolsPage() {
  const { org, sites, can } = useOrgCtx();
  const [params, setParams] = useSearchParams();
  const remembered = lastSite(org.id);
  const site = sites.find((s) => s.id === params.get('site')) ?? sites.find((s) => s.id === remembered && s.verifiedAt) ?? sites.find((s) => s.verifiedAt) ?? sites[0] ?? null;
  const modes = Object.values(MODES);

  const pickSite = (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('site', id);
        return next;
      },
      { replace: true },
    );

  return (
    <div>
      <PageHeader
        title="Run an analysis"
        description="Pick the website, then a tool. Each run gets its own page with live progress, the reports and every file; costs count against your company's monthly budget."
        actions={
          <ButtonLink to={paths.runs(org.id)} variant="secondary" size="sm" icon={<History className="size-4" />}>
            Your runs
          </ButtonLink>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <Globe className="size-5 shrink-0 text-ink-3" aria-hidden />
        {sites.length ? (
          <>
            <label htmlFor="tools-site" className="text-sm font-medium text-ink">
              Website
            </label>
            <div className="w-full min-w-0 sm:w-72">
              <Select id="tools-site" value={site?.id ?? ''} onChange={(e) => pickSite(e.target.value)}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.domain}
                    {s.verifiedAt ? '' : ' (not verified)'}
                  </option>
                ))}
              </Select>
            </div>
            {site &&
              (site.verifiedAt ? (
                <StatusBadge tone="good">Verified</StatusBadge>
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="warning">Not verified</StatusBadge>
                  {can('admin') ? (
                    <Link to={paths.site(org.id, site.id, 'settings/verification')} className="text-[13px] font-medium text-accent-text hover:underline">
                      Verify ownership to unlock site tools
                    </Link>
                  ) : (
                    <span className="text-[13px] text-ink-3">An admin can verify it</span>
                  )}
                </span>
              ))}
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">No website yet. Keyword research works without one; every other tool needs your verified website.</p>
            {can('admin') && (
              <ButtonLink to={paths.newSite(org.id)} size="sm" icon={<Plus className="size-4" />}>
                Add a website
              </ButtonLink>
            )}
          </div>
        )}
      </Card>

      {!can('member') && (
        <Callout tone="info" title="View-only access" className="mb-6">
          You can browse the tools and read every report, but starting runs takes the member role. Ask an admin of {org.name} to change your role.
        </Callout>
      )}

      <div className="space-y-8">
        {CATEGORY_ORDER.map((cat) => {
          const list = modes.filter((m) => m.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
                {CATEGORY_ICON[cat]}
                {MODE_CATEGORIES[cat]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((m) => (
                  <ToolCard key={m.id} info={m} site={site} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ToolCard({ info, site }: { info: ModeInfo; site: Site | null }) {
  const { org, can } = useOrgCtx();
  const tab = SETTINGS_TAB[info.id];
  const verified = !!site?.verifiedAt;
  const cost = COST_TEXT[info.id] ?? (info.costUsd > 0 ? `about ${formatUsd(info.costUsd)}` : 'Free');

  let action;
  if (tab) {
    action = site ? (
      <ButtonLink to={paths.site(org.id, site.id, tab)} variant="secondary" size="sm" icon={<Settings className="size-4" />}>
        Open in website settings
      </ButtonLink>
    ) : (
      <span className="text-[13px] text-ink-3">Add a website to set this up</span>
    );
  } else if (!can('member')) {
    action = (
      <Button variant="secondary" size="sm" disabled icon={<Lock className="size-3.5" />}>
        View only
      </Button>
    );
  } else if (info.siteBound && !site) {
    action = <span className="text-[13px] text-ink-3">Needs your website</span>;
  } else if (info.siteBound && !verified && site) {
    action = can('admin') ? (
      <ButtonLink to={paths.site(org.id, site.id, 'settings/verification')} variant="secondary" size="sm" icon={<Lock className="size-3.5" />}>
        Verify {site.domain} first
      </ButtonLink>
    ) : (
      <span className="text-[13px] text-ink-3">Needs a verified website</span>
    );
  } else {
    action = (
      <ButtonLink to={paths.tool(org.id, info.id, { siteId: verified ? site?.id : undefined })} size="sm" icon={<ArrowRight className="size-4" />}>
        Start
      </ButtonLink>
    );
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <ModeGlyph mode={info.id} />
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{info.title}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {info.siteBound ? <Badge>{tab ? 'Website setting' : 'Your website'}</Badge> : <Badge tone="accent">Website optional</Badge>}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{info.summary}</p>
      <p className="mt-3 flex gap-2 text-[13px] leading-snug text-ink-3">
        <PackageCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{info.delivers}</span>
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Coins className="size-3.5" aria-hidden />
            {cost}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />~{info.etaMinutes} min
          </span>
        </div>
        {action}
      </div>
    </Card>
  );
}
