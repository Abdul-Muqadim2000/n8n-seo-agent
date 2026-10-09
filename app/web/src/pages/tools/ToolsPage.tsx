import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowRight, CheckCircle2, Clock, Coins, Compass, Globe, History, Lock, PackageCheck, PenLine, Plus, Radar, Settings, Sparkles, Telescope, TriangleAlert, Wrench } from 'lucide-react';
import { formatUsd, MODE_CATEGORIES, MODES, type ModeId, type ModeInfo, type Site } from '@seo/shared';
import { lastSite, useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/misc';
import { CountUp, HeroLink, HeroNextStep, HeroStat, IconTile, Stagger, SummaryHero } from '@/components/insight';
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
/**
 * The card's action link covers the whole card (one link, one tab stop). No press nudge on it: a transform would make the
 * link the containing block of its ::after, which would then shrink to the button mid-click and lose the click.
 */
const STRETCH = 'after:absolute after:inset-0 after:rounded-xl';

/** The tools grouped by what you want to achieve (presentation only; every tool keeps its own category label on its card). */
const GOALS: { id: string; title: string; description: string; short: string; icon: ReactNode; modes: ModeId[] }[] = [
  { id: 'research', title: 'Research', description: 'Find the keywords worth winning and what your site says about you.', short: 'Keywords and your site', icon: <Telescope />, modes: ['discover', 'verdict', 'describe'] },
  { id: 'create', title: 'Create', description: 'Pages, proof and the author behind them.', short: 'Pages and proof', icon: <PenLine />, modes: ['keyword', 'case_study', 'profile'] },
  { id: 'audit', title: 'Audit & track', description: 'Know where the site stands, page by page and week by week.', short: 'Health, pages, weekly tracking', icon: <Radar />, modes: ['audit', 'track', 'published', 'checkin'] },
  { id: 'grow', title: 'Grow visibility', description: 'Climb to a head term, get named by AI assistants and earn links.', short: 'Ladders, AI answers, links', icon: <Compass />, modes: ['ladder', 'ai_visibility', 'backlinks'] },
];

/** The tool to highlight for this website's state (display only: what the setup checklist would do next). */
function recommendedMode(site: Site | null): ModeId | null {
  if (!site) return 'discover';
  if (!site.verifiedAt) return null;
  if (site.trackingStatus !== 'active') return 'track';
  return 'ladder';
}

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

  // every tool lands in one goal; a tool added later without a goal shows under "More tools"
  const grouped = new Set(GOALS.flatMap((g) => g.modes));
  const rest = modes.filter((m) => !grouped.has(m.id)).map((m) => m.id);
  const goals = rest.length ? [...GOALS, { id: 'more', title: 'More tools', description: 'Everything else.', short: 'Everything else', icon: <Wrench />, modes: rest }] : GOALS;
  const recommended = recommendedMode(site);

  return (
    <div>
      <PageHeader
        icon={<Wrench />}
        title="Run an analysis"
        description="Pick the website, then a tool. Each run gets its own page with live progress, the reports and every file; costs count against your company's monthly budget."
        actions={
          <ButtonLink to={paths.runs(org.id)} variant="secondary" size="sm" icon={<History className="size-4" />}>
            Your runs
          </ButtonLink>
        }
      />

      <Stagger className="space-y-8">
        <ToolsHero site={site} recommended={recommended} goals={goals} onPickSite={pickSite} />

        {!can('member') && (
          <Callout tone="info" title="View-only access">
            You can browse the tools and read every report, but starting runs takes the member role. Ask an admin of {org.name} to change your role.
          </Callout>
        )}

        {goals.map((g) => {
          const list = g.modes.map((id) => MODES[id]).filter(Boolean);
          if (!list.length) return null;
          return (
            <section key={g.id} id={`goal-${g.id}`} aria-labelledby={`goal-${g.id}-title`} className="scroll-mt-6">
              <div className="mb-4 flex items-center gap-3">
                <IconTile size="md">{g.icon}</IconTile>
                <div className="min-w-0">
                  <h2 id={`goal-${g.id}-title`} className="flex items-baseline gap-2 font-display text-lg leading-tight font-semibold tracking-[-0.01em] text-ink">
                    {g.title}
                    <span className="font-mono text-xs font-medium tracking-normal text-ink-3">
                      {list.length} {list.length === 1 ? 'tool' : 'tools'}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{g.description}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((m) => (
                  <ToolCard key={m.id} info={m} site={site} recommended={m.id === recommended} />
                ))}
              </div>
            </section>
          );
        })}
      </Stagger>
    </div>
  );
}

/** Small status chip inside the blue hero (on-dark colours, icon + word). */
function HeroChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md bg-on-ink/10 px-2.5 text-xs font-medium text-on-ink ring-1 ring-line-on-ink [&_svg]:size-3.5 [&_svg]:shrink-0">
      {icon}
      {children}
    </span>
  );
}

/** The website the tools run on, how many tools it unlocks and the recommended next tool. */
function ToolsHero({ site, recommended, goals, onPickSite }: { site: Site | null; recommended: ModeId | null; goals: typeof GOALS; onPickSite: (id: string) => void }) {
  const { org, sites, can } = useOrgCtx();
  const all = Object.values(MODES);
  const verified = !!site?.verifiedAt;
  const ready = all.filter((m) => !m.siteBound || verified).length;
  const headline = !site
    ? `${ready} ${ready === 1 ? 'tool works' : 'tools work'} without a website`
    : verified
      ? `${ready === all.length ? `All ${all.length}` : `${ready} of ${all.length}`} tools are ready for ${site.domain}`
      : `Verify ${site.domain} to unlock ${all.length - ready} more tools`;

  // the recommended tool's target: the same link its card opens
  const rec = recommended ? MODES[recommended] : null;
  const recTab = recommended ? SETTINGS_TAB[recommended] : undefined;
  const recTo = !rec
    ? null
    : recTab
      ? site
        ? paths.site(org.id, site.id, recTab)
        : null
      : can('member') && (!rec.siteBound || verified)
        ? paths.tool(org.id, rec.id, { siteId: verified ? site?.id : undefined })
        : null;

  const scrollTo = (id: string) => document.getElementById(`goal-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <SummaryHero
      tone="blue"
      eyebrow={
        <>
          <span className="font-mono tracking-[0.02em] uppercase">Tools</span>
          <span aria-hidden>·</span>
          <span>{org.name}</span>
        </>
      }
      title={headline}
      description={
        !sites.length
          ? 'No website yet. Keyword research works without one; every other tool needs your verified website.'
          : verified
            ? 'Site tools run on this website; the research tools also work without one.'
            : 'Checks run only against websites you have proven you own.'
      }
      actions={
        sites.length ? (
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2.5">
            <label htmlFor="tools-site" className="inline-flex items-center gap-1.5 text-sm font-medium text-on-ink">
              <Globe className="size-4" aria-hidden />
              Website
            </label>
            <div className="w-full min-w-0 sm:w-72">
              <Select id="tools-site" value={site?.id ?? ''} onChange={(e) => onPickSite(e.target.value)}>
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
                <HeroChip icon={<CheckCircle2 />}>Verified</HeroChip>
              ) : (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <HeroChip icon={<TriangleAlert />}>Not verified</HeroChip>
                  {can('admin') ? (
                    <HeroLink to={paths.site(org.id, site.id, 'settings/verification')}>Verify ownership to unlock site tools</HeroLink>
                  ) : (
                    <span className="text-[13px] text-on-ink">An admin can verify it</span>
                  )}
                </span>
              ))}
          </div>
        ) : can('admin') ? (
          <ButtonLink to={paths.newSite(org.id)} size="sm" variant="secondary" icon={<Plus className="size-4" />}>
            Add a website
          </ButtonLink>
        ) : undefined
      }
      aside={
        rec && recTo ? (
          <HeroNextStep
            icon={<Sparkles />}
            eyebrow="Recommended next"
            title={rec.title}
            actions={
              <ButtonLink to={recTo} variant="secondary" size="sm" icon={recTab ? <Settings className="size-4" /> : undefined} className="group/rec">
                {recTab ? 'Open in website settings' : 'Start'}
                {!recTab && <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover/rec:translate-x-0.5" aria-hidden />}
              </ButtonLink>
            }
          />
        ) : undefined
      }
      stats={
        <>
          {goals.slice(0, 4).map((g) => (
            <HeroStat
              key={g.id}
              label={g.title}
              value={
                <>
                  <CountUp value={g.modes.length} />
                  <span className="ml-1.5 font-sans text-[13px] font-medium tracking-normal">{g.modes.length === 1 ? 'tool' : 'tools'}</span>
                </>
              }
              hint={g.short}
              onClick={() => scrollTo(g.id)}
            />
          ))}
        </>
      }
    />
  );
}

function ToolCard({ info, site, recommended }: { info: ModeInfo; site: Site | null; recommended: boolean }) {
  const { org, can } = useOrgCtx();
  const tab = SETTINGS_TAB[info.id];
  const verified = !!site?.verifiedAt;
  const cost = COST_TEXT[info.id] ?? (info.costUsd > 0 ? `about ${formatUsd(info.costUsd)}` : 'Free');

  let action;
  let opens = false; // the action is a link (styling only: hover lift, glyph highlight)
  if (tab) {
    opens = !!site;
    action = site ? (
      <ButtonLink to={paths.site(org.id, site.id, tab)} variant="secondary" size="sm" icon={<Settings className="size-4" />} className={STRETCH}>
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
    opens = can('admin');
    action = can('admin') ? (
      <ButtonLink to={paths.site(org.id, site.id, 'settings/verification')} variant="secondary" size="sm" icon={<Lock className="size-3.5" />} className={STRETCH}>
        Verify {site.domain} first
      </ButtonLink>
    ) : (
      <span className="text-[13px] text-ink-3">Needs a verified website</span>
    );
  } else {
    opens = true;
    action = (
      <ButtonLink to={paths.tool(org.id, info.id, { siteId: verified ? site?.id : undefined })} size="sm" className={STRETCH} aria-label={`Start: ${info.title}`}>
        Start
        <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
      </ButtonLink>
    );
  }
  const locked = !opens && !tab;

  // a launcher tile: icon, name, what it does and delivers, cost and time; the whole tile opens its action when that is a link
  return (
    <Card
      interactive={opens}
      className={cn('group relative flex flex-col p-5', opens && 'hover:-translate-y-0.5', recommended && 'border-accent-text/60 shadow-raised ring-1 ring-accent-text/40')}
    >
      <div className="flex items-start justify-between gap-3">
        <ModeGlyph
          mode={info.id}
          size="lg"
          className={cn(
            opens && 'transition-colors duration-200 ease-brand group-hover:bg-accent group-hover:text-accent-ink',
            recommended && 'bg-accent text-accent-ink',
            locked && 'bg-surface-2 text-ink-3',
          )}
        />
        <div className="flex flex-wrap justify-end gap-1.5">
          {recommended && (
            <Badge tone="accent" icon={<Sparkles className="size-3" aria-hidden />}>
              Recommended next
            </Badge>
          )}
          {info.siteBound ? <Badge icon={locked ? <Lock className="size-3" aria-hidden /> : undefined}>{tab ? 'Website setting' : 'Your website'}</Badge> : <Badge tone="accent">Website optional</Badge>}
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-ink-3 [&_svg]:size-3.5">
        {CATEGORY_ICON[info.category]}
        {MODE_CATEGORIES[info.category]}
      </p>
      <h3 className="mt-1 font-display text-base font-semibold tracking-[-0.01em] text-ink">{info.title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{info.summary}</p>
      <div className="mt-3 flex gap-2.5 rounded-lg bg-surface-2/70 px-3 py-2.5 text-xs leading-snug text-ink-2">
        <PackageCheck className="mt-px size-3.5 shrink-0 text-accent-text" aria-hidden />
        <span>
          <span className="sr-only">You get: </span>
          {info.delivers}
        </span>
      </div>
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex h-6 items-center gap-1 rounded-md bg-accent-soft px-2 font-medium text-accent-text">
              <Coins className="size-3.5 shrink-0" aria-hidden />
              {cost}
            </span>
            <span className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-2 px-2 font-medium text-ink-2">
              <Clock className="size-3.5 shrink-0 text-ink-3" aria-hidden />~{info.etaMinutes} min
            </span>
          </span>
          <span className="ml-auto">{action}</span>
        </div>
      </div>
    </Card>
  );
}
