import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Ban, BarChart3, CalendarRange, CheckCircle2, Flag, GitFork, Lightbulb, ListChecks, MousePointerClick, Network, PenLine, Route, Search, Target, TrendingUp, Wrench } from 'lucide-react';
import {
  asDifficulty,
  asPlanChoice,
  DIFFICULTY_HINT,
  DIFFICULTY_LABEL,
  PLAN_CHOICE_LABEL,
  PLAN_ORDER_TEXT,
  type DifficultyForYou,
  type PlanType,
  type ReportDetail,
} from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtDate } from '@/lib/utils';
import { Badge, type Tone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { CountUp, HeroStat, IconTile, InsightItem, Stagger } from '@/components/insight';
import { DifficultyBadge, PlanBadge } from '@/components/site/keyword';
import { ExternalLink } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { Block, Bullets, Facts, has, LedgerCard, n, num, obj, objs, SectionTitle, shortUrl, str, strs, usd, verdictLabel, type P } from './kit';
import { isCountry, keywordPrefill } from './meta';
import { PositionPill, ReportHero, ScoreMark, StatusMark, WordValue } from './visuals';

const feasTone = (status: string): Tone => {
  const s = status.toLowerCase();
  if (/not|impossible|avoid|unwinnable/.test(s)) return 'critical';
  if (/winnable|easy|go/.test(s)) return 'good';
  return 'warning';
};

const months = (v: unknown) => {
  const m = (Array.isArray(v) ? v : []).map(Number).filter(Number.isFinite);
  if (!m.length) return '';
  return m.length > 1 && m[0] !== m[m.length - 1] ? `Months ${m[0]}–${m[m.length - 1]}` : `Month ${m[0]}`;
};

const statusTone = (s: string): Tone => (s === 'published' || s === 'exists' ? 'good' : s === 'writing' ? 'accent' : 'neutral');

export function LadderReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const head = obj(p.head);
  const feas = obj(p.feasibility);
  const rungs = objs(p.rungs).sort((a, b) => (num(b.rung) ?? 0) - (num(a.rung) ?? 0));
  const top = obj(p.top_page);
  const linkMap = objs(p.link_map);
  const timeline = objs(p.timeline);
  const requirements = objs(p.requirements);
  const stats = obj(p.stats);
  const started = new Set([...strs(p.pages_started), ...objs(p.write_now).map((w) => str(w.keyword))].map((k) => k.toLowerCase()));
  const tracker = obj(p.tracker);
  const country = str(p.country);
  const headKw = str(p.keyword) || str(head.keyword);
  // v4.8: the plan for this website, or why nothing was planned
  const refusal = obj(p.refusal);
  const refused = p.planned === false || has(refusal);
  const planType = asPlanChoice(p.plan_type);
  const difficulty = asDifficulty(p.difficulty_for_you);
  const excluded = objs(p.excluded_keywords);

  const pagesTotal = num(stats.pages_total);
  const duplicate = str(refusal.reason) === 'duplicate';

  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={country || undefined}
        title={
          refused ? (
            <>Not planned: “{headKw}”</>
          ) : pagesTotal != null ? (
            <>
              A {pagesTotal}-page ladder to rank for “{headKw}”
            </>
          ) : (
            <>Ladder plan for “{headKw}”</>
          )
        }
        description={
          refused
            ? duplicate
              ? 'You already have a ladder for this keyword: continue that one instead.'
              : 'The check advised against a ladder for this keyword on your website.'
            : `Win the easy pages first; each rung links up to the main page and builds the authority it needs.${p.tracking_registered === true ? ' Weekly rank tracking is on.' : ''}`
        }
        aside={
          refused ? (
            <StatusMark tone={duplicate ? 'warning' : 'critical'} icon={<Ban />} title="Not planned" caption={duplicate ? 'A ladder for this keyword exists' : 'Not realistic for this website'} />
          ) : (
            <FeasibilityMark feas={feas} />
          )
        }
        actions={
          difficulty || (planType && planType !== 'none') || feas.navigational === true ? (
            <span className="flex flex-wrap gap-1.5">
              <DifficultyBadge difficulty={difficulty} />
              <PlanBadge plan={planType} months={str(p.months)} stretch={p.stretch === true} />
              {/* the verdict and the status sit in the feasibility mark next to this; a refused plan says why in its callout */}
              {feas.navigational === true && <Badge tone="warning">navigational search</Badge>}
            </span>
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="Searches / month" value={num(head.volume) != null ? <CountUp value={num(head.volume)!} format={(v) => n(Math.round(v))} /> : '–'} hint={num(head.cpc) != null ? `Cost per click ${usd(head.cpc)}` : 'Cost per click –'} />
            <HeroStat label="Difficulty" value={num(head.kd) != null ? String(num(head.kd)) : '–'} hint="Keyword difficulty, 0-100" />
            <HeroStat label="Your position" value={num(head.your_position) ? `#${num(head.your_position)}` : <WordValue>Not ranking</WordValue>} hint="Google, today" />
            {!refused && (
              <HeroStat
                label="Time to rank"
                value={num(feas.time_to_rank_months) != null ? <WordValue>~{num(feas.time_to_rank_months)} months</WordValue> : '–'}
                hint={`Visits / month at top 3: ${n(feas.expected_visits_top3)}`}
              />
            )}
          </>
        }
      />
      {refused && <Refusal refusal={refusal} keyword={headKw} alternatives={strs(feas.alternatives)} country={country} siteId={report.siteId} />}

      {!refused && (strs(feas.reasons).length > 0 || strs(feas.what_must_change).length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {strs(feas.reasons).length > 0 && (
            <Block title="Why it can work" description="The evidence behind the verdict" icon={<Lightbulb />}>
              <Bullets items={strs(feas.reasons)} tone="good" />
            </Block>
          )}
          {strs(feas.what_must_change).length > 0 && (
            <Block title="What it takes" description="Without these the head term will not move" icon={<Wrench />} iconTone="warning">
              <Bullets items={strs(feas.what_must_change)} tone="warning" />
            </Block>
          )}
        </div>
      )}
      {!refused && planType && planType !== 'none' && <WhyThisPlan p={p} planType={planType} difficulty={difficulty} />}

      {!refused && strs(feas.alternatives).length > 0 && (
        <Callout tone="info" title={p.stretch === true ? 'Consider these first: easier for your website' : 'Alternatives worth considering'}>
          <Alternatives items={strs(feas.alternatives)} country={country} siteId={report.siteId} />
        </Callout>
      )}

      {excluded.length > 0 && <Excluded items={excluded} siteId={report.siteId} />}

      {!refused && (
        <>
      <Facts
        cols="sm:grid-cols-3 lg:grid-cols-5"
        items={[
          { icon: <GitFork />, label: 'Pages in the ladder', value: n(stats.pages_total) },
          { icon: <Target />, label: 'Keywords covered', value: n(stats.keywords_covered) },
          { icon: <TrendingUp />, label: 'Traffic potential', value: n(stats.traffic_potential_total), hint: 'visits / month when all rank' },
          { icon: <Search />, label: 'Keywords researched', value: n(stats.pool_size) },
          { icon: <CheckCircle2 />, label: 'Relevant after AI review', value: n(stats.relevant) },
        ]}
      />

      <Block title="The ladder" description="Win the easy pages first; each rung links up to the top page and builds the authority it needs" icon={<GitFork />}>
        <ol className="relative space-y-5 before:absolute before:top-4 before:bottom-4 before:left-[17px] before:w-0.5 before:rounded-full before:bg-accent-soft">
          {has(top) && (
            <RungStep marker={<Flag aria-hidden />} title={planType === 'direct' ? 'Main page (written first)' : 'Main page'} sub={months(top.months)} highlight>
              <PageRow page={top} country={country} siteId={report.siteId} writingNow={started.has(str(top.keyword).toLowerCase())} />
            </RungStep>
          )}
          {rungs.map((r) => (
            <RungStep key={num(r.rung)} marker={<span className="text-xs font-semibold">{num(r.rung)}</span>} title={str(r.label) || `Rung ${num(r.rung)}`} sub={[months(r.months), num(r.available_keywords) != null ? `${num(r.available_keywords)} keywords available` : ''].filter(Boolean).join(' · ')}>
              <div className="space-y-2">
                {!objs(r.pages).length && <p className="text-[13px] text-ink-3">No page on this rung: no keyword fell into its difficulty band.</p>}
                {objs(r.pages).map((pg, i) => (
                  <PageRow key={i} page={pg} country={country} siteId={report.siteId} writingNow={started.has(str(pg.keyword).toLowerCase())} />
                ))}
              </div>
            </RungStep>
          ))}
        </ol>
        {strs(p.notes).length > 0 && (
          <div className="mt-4">
            <Bullets items={strs(p.notes)} />
          </div>
        )}
      </Block>

      {timeline.length > 0 && <Timeline items={timeline} />}

      {requirements.length > 0 && (
        <Block title="Requirements" description="What has to happen outside the pages" icon={<ListChecks />} flush>
          <ul className="divide-y divide-line">
            {requirements.map((r, i) => (
              <InsightItem key={i} icon={<CheckCircle2 />} title={str(r.item)} description={<span className="text-[13px] leading-relaxed text-ink-2">{str(r.detail)}</span>} />
            ))}
          </ul>
        </Block>
      )}

      {linkMap.length > 0 && <LinkMap links={linkMap} />}
        </>
      )}

      {(p.tracking_registered === true || has(tracker)) && (
        <Callout tone={p.tracking_registered === true ? 'good' : 'info'} title={p.tracking_registered === true ? 'Weekly rank tracking is on' : 'Rank tracking'}>
          Every page in the ladder is checked on Google {str(tracker.cadence) || 'weekly'}
          {str(tracker.stop_rule) && <>; tracking stops when the {str(tracker.stop_rule)}</>}.
          {tracker.auto_next_rung === false && ' Start the next rung yourself when the tracker says the current one is ready.'}
          {str(p.store_error) && <span className="mt-1 block text-critical-text">Storing the plan failed: {str(p.store_error)}</span>}
        </Callout>
      )}

      <LedgerCard ledger={p.run_ledger} />
    </Stagger>
  );
}

/** The hero's feasibility mark: the score ring in the verdict's colour, the verdict (GO / GO WITH CHANGES / AVOID) or the status as the word, the other one under it. */
function FeasibilityMark({ feas }: { feas: P }) {
  const verdict = str(feas.verdict);
  const status = str(feas.status).replace(/_/g, ' ');
  const goLike = /^(GO|AVOID)/i.test(verdict);
  return (
    <ScoreMark
      score={num(feas.score)}
      label="Feasibility"
      verdict={goLike ? verdict : undefined}
      status={goLike ? undefined : status || (verdict ? verdictLabel(verdict) : undefined)}
      statusTone={goLike ? undefined : status ? feasTone(str(feas.status)) : 'neutral'}
      caption={goLike ? status || undefined : status && verdict ? verdictLabel(verdict) : undefined}
    />
  );
}

/** "Why this plan": the website's reach, the keyword's difficulty for it, the plan, its order and months (PIPELINE_FEATURE_SPEC.md §5.5). */
function WhyThisPlan({ p, planType, difficulty }: { p: P; planType: PlanType; difficulty: DifficultyForYou | null }) {
  const info = obj(p.reach_info);
  const reach = num(p.reach) ?? num(info.reach);
  const kd = num(obj(p.head).kd);
  const how =
    str(info.method) === 'percentile'
      ? `75% of the ${num(info.sample) ?? 'many'} searches it ranks in the top 10 for are at or below it`
      : str(info.method) === 'size'
        ? `from the number of searches it ranks in the top 10 for (${n(info.top10)})`
        : 'a starting value: the website ranks for few searches yet';
  return (
    <Block title="Why this plan" icon={<Route />}>
      <ul className="space-y-2.5 text-sm leading-relaxed text-ink-2">
        {reach != null && (
          <li>
            <span className="font-medium text-ink">Your website’s reach: difficulty {reach}.</span> That is the difficulty it already wins ({how}
            {info.cached === true && str(info.cached_at) ? `, measured ${fmtDate(str(info.cached_at))}` : ''}).
          </li>
        )}
        {difficulty && (
          <li>
            <span className="font-medium text-ink">{DIFFICULTY_LABEL[difficulty]}.</span> {kd != null ? `The main keyword’s difficulty is ${kd}${reach != null ? ` against your reach of ${reach}` : ''}. ` : ''}
            {DIFFICULTY_HINT[difficulty]}
          </li>
        )}
        <li>
          <span className="font-medium text-ink">
            {PLAN_CHOICE_LABEL[planType]}
            {p.stretch === true ? ' (stretch)' : ''}:
          </span>{' '}
          {str(p.order) ? `${str(p.order).replace(/^\w/, (c) => c.toUpperCase())}.` : PLAN_ORDER_TEXT[planType]}
          {str(p.months) && ` Expected about ${str(p.months).replace('-', '–')} months until the main keyword ranks.`}
        </li>
      </ul>
    </Block>
  );
}

/** Nothing was planned: the main keyword is another ladder's (duplicate) or not realistic for the website. */
function Refusal({ refusal, keyword, alternatives, country, siteId }: { refusal: P; keyword: string; alternatives: string[]; country: string; siteId: string | null }) {
  const { org } = useOrgCtx();
  const reason = str(refusal.reason);
  if (reason === 'duplicate')
    return (
      <Callout tone="warning" title={`Not planned: you already have a ladder for “${str(refusal.head) || keyword}”`}>
        <p>One search needs one page: a second ladder would write pages that compete with the first in Google. No pages were planned or written; continue the existing ladder instead.</p>
        {siteId && str(refusal.ladder_id) && (
          <ButtonLink to={paths.ladder(org.id, siteId, str(refusal.ladder_id))} variant="secondary" size="sm" className="mt-2">
            Open that ladder
          </ButtonLink>
        )}
      </Callout>
    );
  return (
    <Callout tone="critical" title={`Not planned: “${keyword}” is not realistic for your website`}>
      <p>{str(refusal.message) || 'People searching it look for one particular website or brand, or the check advised against it. No pages were planned.'}</p>
      {alternatives.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-ink">Check one of these instead:</p>
          <Alternatives items={alternatives} country={country} siteId={siteId} />
        </div>
      )}
    </Callout>
  );
}

/** Keywords to try instead, each with "Check this one" (opens the keyword check of the "New keyword ladder" flow). */
function Alternatives({ items, country, siteId }: { items: string[]; country: string; siteId: string | null }) {
  const { org, can } = useOrgCtx();
  return (
    <ul className="mt-1.5 space-y-1.5">
      {items.map((a) => (
        <li key={a} className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-words text-ink">{a.replace(/^["“”]+|["“”]+$/g, '')}</span>
          {siteId && can('member') && (
            <ButtonLink to={paths.newLadder(org.id, siteId, { keyword: a.replace(/["“”]/g, ''), tab: 'check', ...(isCountry(country) ? { country } : {}) })} variant="secondary" size="sm" icon={<Search className="size-3.5" />}>
              Check this one
            </ButtonLink>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Keywords left out of this ladder because another ladder of the website plans them already (one search, one page). */
function Excluded({ items, siteId }: { items: P[]; siteId: string | null }) {
  const { org } = useOrgCtx();
  return (
    <Block title="Left out: other ladders cover them" description="One search needs one page, so these were not planned again here." icon={<GitFork />}>
      <ul className="divide-y divide-line">
        {items.slice(0, 20).map((x, i) => (
          <li key={`${str(x.keyword)}-${i}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
            <span className="min-w-0 break-words text-ink">“{str(x.keyword)}”</span>
            <span className="text-[13px] text-ink-3">
              {siteId && str(x.ladder_id) ? (
                <Link to={paths.ladder(org.id, siteId, str(x.ladder_id))} className="text-accent-text hover:underline transition-colors duration-150 ease-brand">
                  ladder “{str(x.head) || str(x.ladder_id)}”
                </Link>
              ) : (
                <>ladder “{str(x.head)}”</>
              )}
              {str(x.as) ? ` (${str(x.as).replace(/_/g, ' ')})` : ''}
            </span>
          </li>
        ))}
      </ul>
      {items.length > 20 && <p className="mt-2 text-xs text-ink-3">and {items.length - 20} more</p>}
    </Block>
  );
}

function RungStep({ marker, title, sub, children, highlight }: { marker: ReactNode; title: ReactNode; sub?: string; children: ReactNode; highlight?: boolean }) {
  return (
    <li className="relative pl-12">
      <IconTile tone={highlight ? 'solid' : 'blue'} size="md" className="absolute top-0 left-0 ring-4 ring-surface">
        {marker}
      </IconTile>
      <div className="mb-2 flex min-h-9 flex-wrap items-center gap-x-2">
        <h4 className="font-display text-sm font-semibold tracking-[-0.01em] text-ink">{title}</h4>
        {sub && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-ink-3">{sub}</span>}
      </div>
      {children}
    </li>
  );
}

function PageRow({ page, country, siteId, writingNow }: { page: P; country: string; siteId: string | null; writingNow: boolean }) {
  const { org, can } = useOrgCtx();
  const status = str(page.status);
  const exists = page.exists === true;
  const target = str(page.target_url);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface p-3 transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-card">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-ink">{str(page.keyword)}</p>
          {writingNow ? <Badge tone="accent">being written now</Badge> : status && <Badge tone={statusTone(status)}>{exists && status === 'new' ? 'exists' : status}</Badge>}
          {str(page.page_type) && <span className="text-xs text-ink-3">{str(page.page_type)}</span>}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Search className="size-3.5" aria-hidden />
            {n(page.total_volume ?? page.volume)} searches
          </span>
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="size-3.5" aria-hidden />
            KD {num(page.kd) ?? '–'}
          </span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="size-3.5" aria-hidden />
            {n(page.traffic_potential)} potential visits
          </span>
          {num(page.your_position) ? (
            <span className="inline-flex items-center gap-1">
              you rank <PositionPill value={num(page.your_position)} text={`#${num(page.your_position)}`} />
            </span>
          ) : null}
        </p>
        {target && (
          <p className="mt-1 text-xs">
            <ExternalLink href={target}>{shortUrl(target)}</ExternalLink>
          </p>
        )}
        {strs(page.supporting).length > 0 && <p className="mt-1 text-xs text-ink-3">Also covers: {strs(page.supporting).join(', ')}</p>}
      </div>
      {!writingNow && can('member') && (
        <ButtonLink
          to={paths.tool(org.id, 'keyword', { siteId, prefill: keywordPrefill({ keyword: str(page.keyword), pageType: page.page_type, country, existingPageUrl: exists ? target : '' }) })}
          variant="secondary"
          size="sm"
          icon={<PenLine className="size-3.5" />}
        >
          {exists ? 'Improve' : 'Write'}
        </ButtonLink>
      )}
    </div>
  );
}

function Timeline({ items }: { items: P[] }) {
  const max = Math.max(1, ...items.flatMap((t) => (Array.isArray(t.months) ? t.months.map(Number).filter(Number.isFinite) : [])));
  return (
    <Block title="Timeline" description={`About ${max} months from the first page to the head term`} icon={<CalendarRange />}>
      <div className="space-y-3">
        {items.map((t, i) => {
          const m = (Array.isArray(t.months) ? t.months : []).map(Number).filter(Number.isFinite);
          const start = m[0] ?? 1;
          const end = m[m.length - 1] ?? start;
          return (
            <div key={i} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm">
              <span className="truncate text-ink-2" title={str(t.label)}>
                {str(t.label)}
                <span className="block text-xs text-ink-3">{plural(num(t.pages) ?? 0)}</span>
              </span>
              <div className="relative h-6 rounded-md bg-surface-2">
                <div
                  className="absolute inset-y-0 flex items-center rounded-md bg-accent px-2 text-xs font-medium text-accent-ink"
                  style={{ left: `${((start - 1) / max) * 100}%`, width: `${Math.max(8, ((end - start + 1) / max) * 100)}%` }}
                >
                  <span className="truncate">{start === end ? `M${start}` : `M${start}–${end}`}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 text-xs text-ink-3">
          <span />
          <div className="flex justify-between">
            <span>Month 1</span>
            <span>Month {max}</span>
          </div>
        </div>
      </div>
    </Block>
  );
}

const plural = (k: number) => `${k} page${k === 1 ? '' : 's'}`;

function LinkMap({ links }: { links: P[] }) {
  const cols: Column<P>[] = [
    { key: 'from', header: 'From', sortValue: (r) => str(r.from), cell: (r) => <span className="text-[13px]">{shortUrl(str(r.from))}</span> },
    {
      key: 'type',
      header: 'Link',
      sortValue: (r) => str(r.type),
      cell: (r) => <Badge tone={str(r.type) === 'up' ? 'accent' : 'neutral'}>{str(r.type) === 'up' ? '↑ up' : str(r.type) === 'down' ? '↓ down' : '↔ sideways'}</Badge>,
    },
    { key: 'to', header: 'To', sortValue: (r) => str(r.to), cell: (r) => <span className="text-[13px]">{shortUrl(str(r.to))}</span> },
  ];
  return (
    <Block title="Link map" description="Internal links to add as each page goes live: up to the top page, sideways to a sibling" icon={<Network />}>
      <SectionTitle className="sr-only">Links</SectionTitle>
      <DataTable rows={links} columns={cols} rowKey={(r, i) => `${str(r.from)}-${str(r.to)}-${i}`} pageSize={12} dense searchable searchPlaceholder="Filter by page…" searchText={(r) => `${str(r.from)} ${str(r.to)}`} />
    </Block>
  );
}
