import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpDown, ArrowUpRight, BarChart3, Check, Circle, ExternalLink as ExternalIcon, Flag, History, Info, LineChart, ListOrdered, Loader, PenSquare, Plus, Send, TrendingUp, X } from 'lucide-react';
import { PAGE_TYPE_VALUES, compactNumber, type Ladder, type LadderRung, type RankPoint, type RankingsData, type TrackedKeyword } from '@seo/shared';
import { paths } from '@/lib/paths';
import { useSiteData } from '@/lib/queries';
import { cn, fmtAgo, fmtDate } from '@/lib/utils';
import { BarsChart, ChartCard, SERIES_COLORS, Sparkline } from '@/components/charts';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { ExternalLink, KeyValue, PageHeader } from '@/components/ui/misc';
import { CountUp, DistributionBar, HeroLink, HeroNextStep, HeroStat, IconTile, ScoreRing, SEQ, Stagger, SummaryHero } from '@/components/insight';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { Chips, DataGate, FillHeight, Kind, Panel, RunAnalysisMenu, SectionHeading, ToolButton, useSitePage } from './_components/kit';
import { plural, sortByDate, urlPath } from './_components/format';
import { BUCKETS, bucketOf, moveOf, plotPos, posSort, posText, PositionMove, PositionPill, ranked, type Bucket } from './_components/positions';
import { PositionHistoryCard, type HistoryLine } from './_components/history';
import { ChartTitle, DashSkeleton, HeroEyebrow } from './_components/visuals';

export default function RankingsPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'rankings');
  return (
    <div>
      <PageHeader
        icon={<Activity />}
        title="Rankings"
        description="Live Google positions for your keyword ladders and tracked keywords, checked every Monday."
        actions={
          <>
            <ToolButton mode="ladder" icon={<Plus className="size-4" />}>
              Rank for a new keyword
            </ToolButton>
            <RunAnalysisMenu />
          </>
        }
      />
      <DataGate q={q} skeleton={<DashSkeleton cards={0} />}>
        {(d) => <Rankings d={d} refetching={q.isFetching} />}
      </DataGate>
    </div>
  );
}

interface Kw {
  id: string;
  keyword: string;
  source: 'ladder' | 'site';
  ladder?: string;
  rung?: number;
  url: string;
  latest: number | null;
  prev: number | null;
  best: number | null;
  lastChecked: string | null;
  history: RankPoint[];
}

function collect(d: RankingsData): Kw[] {
  const out = new Map<string, Kw>();
  for (const l of d.ladders)
    for (const r of l.rungs)
      out.set(r.keyword, {
        id: `l:${l.ladderId}:${r.keyword}`,
        keyword: r.keyword,
        source: 'ladder',
        ladder: l.headKeyword,
        rung: r.rung,
        url: r.targetUrl,
        latest: r.latestPosition,
        prev: r.previousPosition,
        best: r.bestPosition,
        lastChecked: r.lastChecked,
        history: r.history,
      });
  for (const k of d.keywords) {
    const existing = out.get(k.keyword);
    // a keyword in a ladder and in site tracking: keep the more recent check
    if (existing && (existing.lastChecked ?? '') >= (k.lastChecked ?? '')) continue;
    out.set(k.keyword, { id: `s:${k.keyword}`, keyword: k.keyword, source: 'site', url: k.url, latest: k.latestPosition, prev: k.previousPosition, best: k.bestPosition, lastChecked: k.lastChecked, history: k.history });
  }
  return [...out.values()];
}

function Rankings({ d, refetching }: { d: RankingsData; refetching: boolean }) {
  const { can, tool, page } = useSitePage();
  const all = useMemo(() => collect(d), [d]);
  const [dialog, setDialog] = useState<Kw | null>(null);

  if (!d.ladders.length && !d.keywords.length)
    return (
      <EmptyState
        icon={<Activity className="size-5" />}
        title="No keywords tracked yet"
        description="Plan a keyword ladder — winnable long-tail pages first, then the head term — and every page is checked on Google weekly. Or add the keywords you care about to weekly tracking."
        action={
          <>
            <ToolButton mode="ladder" variant="primary">
              Rank my site for a keyword
            </ToolButton>
            {can('admin') && (
              <ButtonLink to={page('settings/tracking')} variant="secondary">
                Add keywords to tracking
              </ButtonLink>
            )}
          </>
        }
      />
    );

  const counts: Record<Bucket, number> = { top3: 0, top10: 0, top20: 0, top50: 0, out: 0, unknown: 0 };
  for (const k of all) counts[bucketOf(k.latest)]++;
  const moves = all.map((k) => moveOf(k.prev, k.latest).kind);
  const up = moves.filter((m) => m === 'up' || m === 'entered').length;
  const down = moves.filter((m) => m === 'down' || m === 'dropped').length;
  const lastCheck = sortByDate(all.filter((k) => k.lastChecked), (k) => k.lastChecked, 'desc')[0]?.lastChecked ?? null;

  const top10 = counts.top3 + counts.top10;
  const top50 = top10 + counts.top20 + counts.top50;
  const ladderPages = d.ladders.reduce((a, l) => a + l.rungs.length, 0);
  const movers = all
    .map((k) => ({ k, m: moveOf(k.prev, k.latest) }))
    // a keyword checked for the first time is no move (moveOf calls it "entered"): only real changes since the previous check
    .filter(({ k, m }) => m.kind === 'up' || m.kind === 'down' || m.kind === 'dropped' || (m.kind === 'entered' && k.prev != null && k.prev >= 0))
    .sort((a, b) => b.m.places - a.m.places);

  return (
    <Stagger className="space-y-6">
      {/* where the keywords rank now and how they moved since the last weekly check */}
      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag="Google rankings">{`${plural(all.length, 'keyword')} checked every Monday${lastCheck ? ` · last check ${fmtAgo(lastCheck)}` : ''}`}</HeroEyebrow>}
        title={rankingsHeadline(all.length, top10, top50, up, down)}
        description={`${up} moved up or entered the top 50, ${down} moved down or left it since the last check. Ladder pages climb rung by rung as they are written and published.`}
        aside={<NextRung ladders={d.ladders} />}
        stats={
          <>
            <HeroStat label="Keywords checked weekly" value={<CountUp value={all.length} />} hint={`${plural(ladderPages, 'ladder page')} · ${plural(d.keywords.length, 'site keyword')}${lastCheck ? ` · last check ${fmtAgo(lastCheck)}` : ''}`} />
            <HeroStat label="In the top 10" value={<CountUp value={top10} />} hint={`${counts.top3} in the top 3 — page 1 of Google`} />
            <HeroStat label="In the top 50" value={<CountUp value={top50} />} hint={`${counts.top20} at 11–20, close to page 1`} />
            <HeroStat
              label="Movement since the last check"
              value={
                <span className="inline-flex items-baseline gap-4">
                  <span className="inline-flex items-center gap-1">
                    <ArrowUpRight className="size-5 self-center" aria-hidden />
                    {up}
                    <span className="sr-only"> up</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ArrowDownRight className="size-5 self-center" aria-hidden />
                    {down}
                    <span className="sr-only"> down</span>
                  </span>
                </span>
              }
              hint={`${up} moved up or entered the top 50, ${down} moved down or left it`}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title={<ChartTitle icon={<BarChart3 />}>Where your keywords rank</ChartTitle>}
          description="Latest Google position per keyword"
          loading={refetching}
          table={{ columns: [{ key: 'label', label: 'Position' }, { key: 'keywords', label: 'Keywords', align: 'right' }], rows: BUCKETS.map((b) => ({ label: b.label, keywords: counts[b.key] })) }}
        >
          <div className="flex h-full flex-col">
            <DistributionBar label="Keywords by position" segments={bucketSegments(counts)} className="px-2 pb-3" />
            <div className="min-h-0 flex-1">
              <FillHeight min={220}>
                {(h) => (
                  <BarsChart
                    data={BUCKETS.filter((b) => b.key !== 'unknown' || counts.unknown > 0).map((b) => ({ label: b.label, keywords: counts[b.key] }))}
                    categoryKey="label"
                    series={[{ key: 'keywords', label: 'Keywords' }]}
                    height={h}
                  />
                )}
              </FillHeight>
            </div>
          </div>
        </ChartCard>
        <HistoryExplorer all={all} loading={refetching} className="lg:col-span-2" />
      </div>

      {movers.length > 0 && (
        <Panel title="Biggest moves" icon={<ArrowUpDown />} description="Keywords that moved since the previous weekly check" flush>
          <ul className="grid grid-cols-1 divide-y divide-line border-t border-line lg:grid-cols-2 lg:divide-y-0">
            {movers.slice(0, 8).map(({ k }) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 transition-colors duration-150 ease-brand hover:bg-surface-2/50 lg:border-b lg:border-line">
                <span className="min-w-0 basis-full truncate text-sm text-ink sm:basis-0 sm:flex-1" title={k.keyword}>
                  {k.keyword}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
                  <PositionPill p={k.prev} />
                  <ArrowRight className="size-3" aria-hidden />
                  <PositionPill p={k.latest} />
                </span>
                <PositionMove prev={k.prev} cur={k.latest} className="ml-auto shrink-0 justify-end sm:ml-0 sm:w-28" />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {d.ladders.length > 0 && (
        <section>
          <SectionHeading icon={<TrendingUp />} title="Keyword ladders" description="Each ladder climbs from winnable long-tail pages (rung 1) to the head term at the top. Write and publish rung by rung; the rank tracker checks every page weekly." />
          <div className="space-y-4">
            {d.ladders.map((l) => (
              <LadderCard key={l.ladderId} ladder={l} onHistory={(r) => setDialog(all.find((k) => k.keyword === r.keyword) ?? null)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          icon={<ListOrdered />}
          title="Tracked site keywords"
          description="Keywords from weekly tracking, checked live on Google"
          actions={
            can('admin') ? (
              <ButtonLink to={page('settings/tracking')} variant="secondary" size="sm">
                Edit keywords
              </ButtonLink>
            ) : undefined
          }
        />
        <Card className="p-4">
          {d.keywords.length ? (
            <KeywordTable rows={d.keywords} onOpen={(k) => setDialog(all.find((x) => x.keyword === k.keyword) ?? null)} />
          ) : (
            <EmptyState className="py-8" title="No site keywords tracked" description="Add up to 20 keywords to weekly tracking to see their live Google position next to Search Console data." action={can('admin') ? <ButtonLink to={page('settings/tracking')} size="sm">Add keywords</ButtonLink> : undefined} />
          )}
        </Card>
      </section>

      {dialog && (
        <Dialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          wide
          title={dialog.keyword}
          description={dialog.source === 'ladder' ? `Ladder “${dialog.ladder}”, rung ${dialog.rung}` : 'Site keyword from weekly tracking'}
          footer={
            can('member') && (
              <ButtonLink to={tool('keyword', { keyword: dialog.keyword, ...(dialog.url && ranked(dialog.latest) ? { existingPageUrl: dialog.url } : {}) })} size="sm">
                {dialog.url && ranked(dialog.latest) ? 'Improve the ranking page' : 'Write a page for it'}
                <ArrowRight className="size-3.5" aria-hidden />
              </ButtonLink>
            )
          }
        >
          <KeyValue
            className="mb-4"
            items={[
              { label: 'Latest position', value: <span className="inline-flex items-center gap-2"><PositionPill p={dialog.latest} /> <PositionMove prev={dialog.prev} cur={dialog.latest} /></span> },
              { label: 'Best position', value: posText(dialog.best) },
              { label: 'Ranking page', value: dialog.url ? <ExternalLink href={dialog.url}>{urlPath(dialog.url)}</ExternalLink> : '–' },
              { label: 'Last checked', value: dialog.lastChecked ? fmtDate(dialog.lastChecked) : 'not checked yet' },
            ]}
          />
          {dialog.history.length ? (
            <PositionHistoryCard title="Position history" lines={[{ key: dialog.keyword, label: dialog.keyword, history: sortByDate(dialog.history, (h) => h.checkedAt) }]} height={220} />
          ) : (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">No checks yet: the rank tracker runs every Monday at 08:00.</p>
          )}
        </Dialog>
      )}
    </Stagger>
  );
}

/** The hero's headline: how many keywords reach page 1 (or the top 50) and how they moved. */
function rankingsHeadline(n: number, top10: number, top50: number, up: number, down: number): string {
  const moved = up || down ? ` — ${up} up, ${down} down` : '';
  if (top10) return `${top10} of ${plural(n, 'keyword')} on page 1 of Google${moved}`;
  if (top50) return `${top50} of ${plural(n, 'keyword')} in the top 50, none on page 1 yet${moved}`;
  return `None of your ${plural(n, 'keyword')} is in the top 50 yet${moved}`;
}

/** Keyword counts per position bucket on the blue ramp (strongest = top 3); not ranked / not checked stay neutral. */
function bucketSegments(counts: Record<Bucket, number>) {
  const color: Record<Bucket, string> = { top3: SEQ[5], top10: SEQ[4], top20: SEQ[2], top50: SEQ[1], out: 'var(--surface-3)', unknown: 'var(--line-strong)' };
  return BUCKETS.filter((b) => b.key !== 'unknown' || counts.unknown > 0).map((b) => ({ label: b.label, value: counts[b.key], color: color[b.key] }));
}

/** The hero's next step: the first ladder page waiting to be published, else the lowest planned rung to write. */
function NextRung({ ladders }: { ladders: Ladder[] }) {
  const { org, site, can, tool } = useSitePage();
  if (!can('member')) return null;
  const rungs = ladders.flatMap((l) => l.rungs.map((r) => ({ l, r })));
  const written = rungs.find(({ r }) => r.status === 'writing' || r.status === 'started' || r.status === 'written');
  const planned = rungs.filter(({ r }) => r.status !== 'published' && !(r.status === 'writing' || r.status === 'started' || r.status === 'written')).sort((a, b) => a.r.rung - b.r.rung || a.r.pageNo - b.r.pageNo)[0];
  const pick = written ?? planned;
  if (!pick) return null;
  const { l, r } = pick;
  const pageType = (PAGE_TYPE_VALUES as readonly string[]).includes(r.pageType) ? r.pageType : undefined;
  return (
    <HeroNextStep
      icon={written ? <Send /> : <PenSquare />}
      eyebrow={`Next step · ladder “${l.headKeyword}”, rung ${r.rung}`}
      title={written ? `Publish “${r.keyword}” and report its URL` : `${r.pageExists ? 'Improve' : 'Write'} the page for “${r.keyword}”`}
      actions={
        <>
          {written ? (
            <ButtonLink to={tool('published', { keyword: r.keyword, ...(r.targetUrl ? { publishedUrl: r.targetUrl } : {}) })} size="sm" variant="secondary">
              Report published URL
            </ButtonLink>
          ) : (
            <ButtonLink to={tool('keyword', { keyword: r.keyword, ...(pageType ? { pageType } : {}), ...(r.pageExists && r.targetUrl ? { existingPageUrl: r.targetUrl } : {}) })} size="sm" variant="secondary">
              {r.pageExists ? 'Improve page' : 'Write page'}
            </ButtonLink>
          )}
          <HeroLink to={paths.ladder(org.id, site.id, l.ladderId)}>Open the ladder</HeroLink>
        </>
      }
    />
  );
}

/** Up to five keywords on one chart; each keeps its colour while others are added or removed. */
function HistoryExplorer({ all, loading, className }: { all: Kw[]; loading: boolean; className?: string }) {
  const withHistory = useMemo(() => all.filter((k) => k.history.length > 0).sort((a, b) => posSort(a.latest) - posSort(b.latest)), [all]);
  const [picked, setPicked] = useState<{ keyword: string; slot: number }[]>(() => withHistory.slice(0, 3).map((k, i) => ({ keyword: k.keyword, slot: i })));
  const lines: HistoryLine[] = picked.flatMap((p): HistoryLine[] => {
    const k = withHistory.find((x) => x.keyword === p.keyword);
    return k ? [{ key: k.keyword, label: k.keyword, history: sortByDate(k.history, (h) => h.checkedAt), slot: p.slot }] : [];
  });
  const freeSlot = () => [0, 1, 2, 3, 4].find((s) => !picked.some((p) => p.slot === s)) ?? 0;
  const options = withHistory.filter((k) => !picked.some((p) => p.keyword === k.keyword));

  if (!withHistory.length)
    return (
      <Card className={cn('flex items-center justify-center', className)}>
        <EmptyState icon={<LineChart className="size-5" />} title="No position history yet" description="The rank tracker checks every ladder page and tracked keyword on Google each Monday; the chart fills from the first check." />
      </Card>
    );

  return (
    <div className={className}>
      <PositionHistoryCard
        title="Position history"
        lines={lines}
        loading={loading}
        actions={
          picked.length < 5 && options.length > 0 ? (
            <div className="w-48">
              <Select
                aria-label="Add a keyword to the chart"
                value=""
                onChange={(e) => e.target.value && setPicked((p) => [...p, { keyword: e.target.value, slot: freeSlot() }])}
              >
                <option value="">Add a keyword…</option>
                {options.map((k) => (
                  <option key={k.id} value={k.keyword}>
                    {k.keyword} ({posText(k.latest)})
                  </option>
                ))}
              </Select>
            </div>
          ) : undefined
        }
      />
      {picked.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <span key={p.keyword} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface pl-2.5 pr-1 text-xs text-ink-2">
              <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES_COLORS[p.slot] }} aria-hidden />
              {p.keyword}
              <button type="button" onClick={() => setPicked((x) => x.filter((y) => y.keyword !== p.keyword))} className="rounded-full p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Remove ${p.keyword} from the chart`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function rungStatus(status: string) {
  const s = status.toLowerCase();
  if (s === 'published') return <StatusBadge tone="good">Published</StatusBadge>;
  if (s === 'writing' || s === 'started' || s === 'written')
    return (
      <Badge tone="accent" icon={<Loader className="size-3" aria-hidden />}>
        Written, not live
      </Badge>
    );
  return <Badge icon={<Circle className="size-3" aria-hidden />}>{s === 'planned' || s === 'new' || !s ? 'Planned' : s}</Badge>;
}

function LadderCard({ ladder, onHistory }: { ladder: Ladder; onHistory: (r: LadderRung) => void }) {
  const { org, site, can, tool } = useSitePage();
  const detail = paths.ladder(org.id, site.id, ladder.ladderId);
  const groups = useMemo(() => {
    const m = new Map<number, LadderRung[]>();
    for (const r of ladder.rungs) m.set(r.rung, [...(m.get(r.rung) ?? []), r]);
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [ladder.rungs]);
  const top = Math.max(...ladder.rungs.map((r) => r.rung), 0);
  const published = ladder.rungs.filter((r) => r.status === 'published').length;
  const pages = ladder.pages || ladder.rungs.length;
  const inTop10 = ladder.rungs.filter((r) => ranked(r.latestPosition) && r.latestPosition <= 10).length;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <IconTile tone="solid" size="md" className="mt-0.5">
            <TrendingUp />
          </IconTile>
          <div className="min-w-0">
            <div className="text-xs font-medium text-ink-3">Ladder · {ladder.country}</div>
            <h3 className="mt-0.5 font-display text-lg font-semibold text-ink">
              <Link to={detail} className="hover:text-accent-text hover:underline transition-colors duration-150 ease-brand">
                {ladder.headKeyword}
              </Link>
            </h3>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Started {fmtDate(ladder.startDate)} · {plural(pages, 'page')} on {plural(groups.length, 'rung')} · {inTop10} in the top 10
            </p>
            <Link to={detail} className="group/ol mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
              Open the ladder in the Pipeline
              <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover/ol:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="flex w-full max-w-[240px] items-center gap-3 rounded-lg bg-surface-2/70 px-3 py-2.5">
          <ScoreRing
            label="Pages published"
            value={pages ? ((ladder.published || published) / pages) * 100 : 0}
            tone={published === pages && pages > 0 ? 'good' : 'accent'}
            display={`${published}/${pages}`}
            valueText={`${published} of ${pages} published`}
            size={52}
          />
          <div className="min-w-0 text-[13px]">
            <div className="font-medium text-ink">Published</div>
            <div className="text-xs tabular text-ink-3">
              {published} / {pages}
            </div>
          </div>
        </div>
      </div>
      <ol className="px-5 py-4">
        <li className="relative pb-5 pl-11">
          <span className="absolute bottom-0 left-[15px] top-8 w-px bg-line-strong" aria-hidden />
          <span className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-full border-2 border-dashed border-accent bg-accent-soft text-accent-text" aria-hidden>
            <Flag className="size-4" />
          </span>
          <div className="pt-1">
            <h4 className="text-sm font-semibold text-ink">Goal — “{ladder.headKeyword}”</h4>
            <p className="text-xs text-ink-3">The head term: every rung below links up to its top page and builds the authority to rank for it.</p>
          </div>
        </li>
        {groups.map(([rung, rows], gi) => {
          const done = rows.every((r) => r.status === 'published');
          const months = rows.find((r) => r.months)?.months;
          return (
            <li key={rung} className="relative pb-5 pl-11 last:pb-0">
              {gi < groups.length - 1 && <span className="absolute bottom-0 left-[15px] top-8 w-px bg-line-strong" aria-hidden />}
              <span
                className={cn(
                  'absolute left-0 top-0 flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold tabular',
                  done ? 'border-good bg-good-soft text-good-text' : rung === top ? 'border-accent bg-accent-soft text-accent-text' : 'border-line-strong bg-surface text-ink-2',
                )}
                aria-hidden
              >
                {done ? <Check className="size-4" /> : rung}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2 pt-1">
                <h4 className="text-sm font-semibold text-ink">
                  Rung {rung}
                  {rung === 1 ? ' — long-tail' : rung === top && groups.length > 1 ? ' — closest to the head term' : ''}
                </h4>
                <span className="text-xs text-ink-3">
                  {months ? `aim: months ${months.replace('-', '–')} · ` : ''}
                  {rows.filter((r) => r.status === 'published').length} of {rows.length} published
                </span>
              </div>
              <ul className="mt-2 space-y-2">
                {rows
                  .sort((a, b) => a.pageNo - b.pageNo)
                  .map((r) => (
                    <li key={r.keyword} className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 md:flex-row md:items-center md:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">{r.keyword}</span>
                          {r.pageType && <Kind>{r.pageType}</Kind>}
                          {rungStatus(r.status)}
                        </div>
                        {r.supporting.length > 0 && (
                          <div className="mt-1 text-xs text-ink-3">
                            also targets <Chips items={r.supporting} max={3} />
                          </div>
                        )}
                        {r.targetUrl && (
                          <a href={r.targetUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-ink-3 hover:text-accent-text transition-colors duration-150 ease-brand">
                            {urlPath(r.targetUrl)}
                            {!r.pageExists && r.status !== 'published' && <span>(planned URL)</span>}
                            <ExternalIcon className="size-3 shrink-0" aria-hidden />
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
                        {r.history.length === 0 && r.latestPosition == null ? (
                          <span className="text-xs text-ink-3">{r.status === 'published' ? 'first check next Monday' : 'not ranked yet'}</span>
                        ) : (
                          <>
                        <div className="text-right">
                          <PositionPill p={r.latestPosition} />
                          <div className="mt-1 flex items-center justify-end gap-2">
                            <PositionMove prev={r.previousPosition} cur={r.latestPosition} />
                          </div>
                        </div>
                        <div className="hidden text-right sm:block">
                          <div className="text-xs text-ink-3">best</div>
                          <div className="text-sm tabular text-ink-2">{posText(r.bestPosition)}</div>
                        </div>
                        <div className="h-8 w-20">
                          <Sparkline data={sortByDate(r.history, (h) => h.checkedAt).map((h) => ({ p: plotPos(h.position) }))} dataKey="p" invert />
                        </div>
                          </>
                        )}
                        <div className="flex items-center gap-1.5">
                          {r.history.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => onHistory(r)} aria-label={`Position history of ${r.keyword}`} icon={<History className="size-4" />} />
                          )}
                          <RungAction r={r} can={can('member')} tool={tool} />
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function RungAction({ r, can, tool }: { r: LadderRung; can: boolean; tool: ReturnType<typeof useSitePage>['tool'] }) {
  if (r.status === 'published') {
    return r.targetUrl ? (
      <a href={r.targetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-accent-text hover:underline transition-colors duration-150 ease-brand">
        View
        <ExternalIcon className="size-3.5" aria-hidden />
      </a>
    ) : null;
  }
  if (!can) return null;
  if (r.status === 'writing' || r.status === 'started' || r.status === 'written')
    return (
      <ButtonLink to={tool('published', { keyword: r.keyword, ...(r.targetUrl ? { publishedUrl: r.targetUrl } : {}) })} size="sm" variant="secondary">
        Report published URL
      </ButtonLink>
    );
  const pageType = (PAGE_TYPE_VALUES as readonly string[]).includes(r.pageType) ? r.pageType : undefined;
  return (
    <ButtonLink to={tool('keyword', { keyword: r.keyword, ...(pageType ? { pageType } : {}), ...(r.pageExists && r.targetUrl ? { existingPageUrl: r.targetUrl } : {}) })} size="sm">
      {r.pageExists ? 'Improve page' : 'Write page'}
    </ButtonLink>
  );
}

function KeywordTable({ rows, onOpen }: { rows: TrackedKeyword[]; onOpen: (k: TrackedKeyword) => void }) {
  const columns: Column<TrackedKeyword>[] = [
    { key: 'keyword', header: 'Keyword', sortValue: (r) => r.keyword, cell: (r) => <span className="block min-w-[12rem] font-medium text-ink">{r.keyword}</span> },
    { key: 'latest', header: 'Position', align: 'right', sortValue: (r) => posSort(r.latestPosition), cell: (r) => <PositionPill p={r.latestPosition} /> },
    { key: 'move', header: 'Change', align: 'right', sortValue: (r) => (ranked(r.latestPosition) && ranked(r.previousPosition) ? r.previousPosition - r.latestPosition : null), cell: (r) => <PositionMove prev={r.previousPosition} cur={r.latestPosition} /> },
    { key: 'best', header: 'Best', align: 'right', hideOnMobile: true, sortValue: (r) => posSort(r.bestPosition), cell: (r) => posText(r.bestPosition) },
    {
      key: 'trend',
      header: 'Trend',
      cell: (r) => (
        <div className="h-8 w-24">
          <Sparkline data={sortByDate(r.history, (h) => h.checkedAt).map((h) => ({ p: plotPos(h.position) }))} dataKey="p" invert />
        </div>
      ),
    },
    {
      key: 'url',
      header: 'Ranking page',
      hideOnMobile: true,
      sortValue: (r) => r.url,
      cell: (r) => (r.url ? <span className="block max-w-[14rem] truncate text-[13px] text-ink-2" title={r.url}>{urlPath(r.url)}</span> : <span className="text-ink-3">–</span>),
    },
    { key: 'serp', header: 'Search features', hideOnMobile: true, cell: (r) => <Chips items={r.serpFeatures.map((f) => f.replace(/_/g, ' '))} max={2} /> },
    { key: 'checked', header: 'Checked', hideOnMobile: true, sortValue: (r) => r.lastChecked ?? '', cell: (r) => <span className="whitespace-nowrap text-[13px] text-ink-3">{r.lastChecked ? fmtAgo(r.lastChecked) : '–'}</span> },
  ];
  return (
    <>
      <DataTable rows={rows} columns={columns} rowKey={(r, i) => `${r.keyword}|${i}`} initialSort={{ key: 'latest', dir: 'asc' }} searchable searchPlaceholder="Search keywords" onRowClick={onOpen} dense />
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-3">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        “&gt;50” means not in the top 50 results; “check failed” is retried next week. Select a row for its history. {compactNumber(rows.filter((r) => ranked(r.latestPosition)).length)} of {rows.length} rank in the top 50.
      </p>
    </>
  );
}

