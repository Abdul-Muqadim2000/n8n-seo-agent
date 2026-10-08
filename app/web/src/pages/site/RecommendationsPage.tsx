import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownCircle, Lightbulb, ListFilter, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { Priority, Recommendation, RecommendationCategory } from '@seo/shared';
import { useRecommendations } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/tabs';
import { CountUp, HeroNextStep, HeroStat, Stagger, SummaryHero, type IconTileTone } from '@/components/insight';
import { DataGate, FilterChips, Panel, RunAnalysisMenu, ToolButton, useSitePage } from './_components/kit';
import { countBy, plural } from './_components/format';
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_ORDER, RecommendationButton, RecommendationItem, sortRecommendations } from './_components/recommendations';

type CatFilter = RecommendationCategory | 'all';
type PrioFilter = Priority | 'all';
type GroupBy = 'priority' | 'category';

export default function RecommendationsPage() {
  const { org, site } = useSitePage();
  const q = useRecommendations(org.id, site.id);
  return (
    <div>
      <PageHeader
        icon={<Lightbulb />}
        title="Recommendations"
        description="Every next step the SEO engine sees for this website, from tracking, audits, rankings, AI answers and backlinks — most important first."
        actions={<RunAnalysisMenu />}
      />
      <DataGate
        q={q}
        skeleton={
          <div className="space-y-6" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-[300px] rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-[420px] rounded-xl" />
          </div>
        }
      >
        {(recs) => <Recommendations recs={recs} refetching={q.isFetching} />}
      </DataGate>
    </div>
  );
}

function Recommendations({ recs, refetching }: { recs: Recommendation[]; refetching: boolean }) {
  const [cat, setCat] = useState<CatFilter>('all');
  const [prio, setPrio] = useState<PrioFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('priority');
  const sorted = useMemo(() => sortRecommendations(recs), [recs]);
  const byPrio = countBy(recs, (r) => r.priority);
  // category counts follow the priority filter, priority counts follow the category filter
  const catCounts = countBy(
    recs.filter((r) => prio === 'all' || r.priority === prio),
    (r) => r.category,
  );
  const prioCounts = countBy(
    recs.filter((r) => cat === 'all' || r.category === cat),
    (r) => r.priority,
  );
  const shown = sorted.filter((r) => (cat === 'all' || r.category === cat) && (prio === 'all' || r.priority === prio));
  const groups: { key: string; title: string; icon: ReactNode; tone: IconTileTone; items: Recommendation[] }[] =
    groupBy === 'priority'
      ? PRIORITY_ORDER.map((p) => ({ key: p, ...PRIO_GROUP[p], items: shown.filter((r) => r.priority === p) }))
      : CATEGORY_ORDER.map((c) => ({ key: c, title: CATEGORY_META[c].label, icon: CATEGORY_META[c].icon, tone: 'blue' as const, items: shown.filter((r) => r.category === c) }));
  const top = sorted[0];
  const high = byPrio.high ?? 0;

  if (!recs.length)
    return (
      <EmptyState
        icon={<Lightbulb className="size-5" />}
        title="No recommendations right now"
        description="They come from the weekly tracking report, technical audits, rank checks, AI visibility and backlink monitors. Start one of them, or check back after Monday’s runs."
        action={
          <>
            <ToolButton mode="audit" variant="primary">
              Run a technical audit
            </ToolButton>
            <ToolButton mode="ai_visibility">Check AI visibility</ToolButton>
          </>
        }
      />
    );

  return (
    <Stagger className={cn('space-y-6 transition-opacity', refetching && 'opacity-80')}>
      <SummaryHero
        tone="blue"
        eyebrow={<span className="font-mono tracking-[0.02em] uppercase">To do · most important first</span>}
        title={high ? `${plural(high, 'high-priority step')} to do first` : `${plural(recs.length, 'recommendation')}, none urgent`}
        description={`${plural(recs.length, 'recommendation is', 'recommendations are')} open across ${plural(Object.keys(countBy(recs, (r) => r.category)).length, 'area')}. Select a number to show only that priority.`}
        aside={
          top ? (
            <HeroNextStep
              icon={(CATEGORY_META[top.category] ?? CATEGORY_META.setup).icon}
              eyebrow={`Next step · ${(CATEGORY_META[top.category] ?? CATEGORY_META.setup).label}`}
              title={top.title}
              actions={top.action ? <RecommendationButton action={top.action} variant="secondary" /> : undefined}
            />
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="All recommendations" value={<CountUp value={recs.length} />} hint={`Across ${plural(Object.keys(countBy(recs, (r) => r.category)).length, 'area')}`} onClick={() => setPrio('all')} />
            <HeroStat label="High priority" value={<CountUp value={byPrio.high ?? 0} />} hint="Do these first: they block results or cost traffic now" onClick={() => setPrio('high')} />
            <HeroStat label="Medium" value={<CountUp value={byPrio.medium ?? 0} />} hint="Clear wins once the urgent items are done" onClick={() => setPrio('medium')} />
            <HeroStat label="Low" value={<CountUp value={byPrio.low ?? 0} />} hint="Polish and longer-term growth" onClick={() => setPrio('low')} />
          </>
        }
      />

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <p className="flex items-center gap-2 text-xs font-medium text-ink-3">
          <ListFilter className="size-3.5" aria-hidden />
          Filter
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            label="Priority"
            value={prio}
            onChange={setPrio}
            options={[
              { value: 'all', label: 'All priorities', count: Object.values(prioCounts).reduce((a, b) => a + b, 0) },
              ...PRIORITY_ORDER.map((p) => ({ value: p, label: p === 'high' ? 'High' : p === 'medium' ? 'Medium' : 'Low', count: prioCounts[p] ?? 0 })),
            ]}
          />
          <div className="flex items-center gap-2 text-[13px] text-ink-3">
            <span id="group-by-label">Group by</span>
            <Segmented
              size="sm"
              value={groupBy}
              onChange={setGroupBy}
              options={[
                { value: 'priority', label: 'Priority' },
                { value: 'category', label: 'Area' },
              ]}
            />
          </div>
        </div>
        <FilterChips
          label="Area"
          value={cat}
          onChange={setCat}
          options={[
            { value: 'all', label: 'All areas', count: Object.values(catCounts).reduce((a, b) => a + b, 0) },
            ...CATEGORY_ORDER.filter((c) => recs.some((r) => r.category === c)).map((c) => ({ value: c, label: CATEGORY_META[c].label, count: catCounts[c] ?? 0, icon: <span className="text-ink-3 [&_svg]:size-3.5">{CATEGORY_META[c].icon}</span> })),
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<ListFilter className="size-5" />} title="Nothing matches these filters" description="Clear a filter to see the other recommendations." />
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.key} aria-label={String(g.key)}>
              <Panel
                icon={g.icon}
                iconTone={g.tone}
                title={
                  <span className="inline-flex items-center gap-2">
                    {g.title}
                    <span className="rounded-full bg-surface-2 px-2 text-xs font-semibold tabular text-ink-2">{g.items.length}</span>
                  </span>
                }
                flush
              >
                <ul className="divide-y divide-line border-t border-line">
                  {g.items.map((r) => (
                    <RecommendationItem key={r.id} rec={r} />
                  ))}
                </ul>
              </Panel>
            </section>
          ))
      )}
    </Stagger>
  );
}

/** A priority group's heading: the word and a status tile (the priority badges in the rows carry it too). */
const PRIO_GROUP: Record<Priority, { title: string; icon: ReactNode; tone: IconTileTone }> = {
  high: { title: 'High priority', icon: <OctagonAlert />, tone: 'serious' },
  medium: { title: 'Medium', icon: <TriangleAlert />, tone: 'warning' },
  low: { title: 'Low', icon: <ArrowDownCircle />, tone: 'neutral' },
};
