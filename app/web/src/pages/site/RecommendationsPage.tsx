import { useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { Priority, Recommendation, RecommendationCategory } from '@seo/shared';
import { useRecommendations } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { PageHeader, StatTile } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/tabs';
import { DataGate, FilterChips, KpiGrid, PriorityBadge, RunAnalysisMenu, SectionHeading, ToolButton, useSitePage } from './_components/kit';
import { countBy, plural } from './_components/format';
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_ORDER, RecommendationCard, sortRecommendations } from './_components/recommendations';

type CatFilter = RecommendationCategory | 'all';
type PrioFilter = Priority | 'all';
type GroupBy = 'priority' | 'category';

export default function RecommendationsPage() {
  const { org, site } = useSitePage();
  const q = useRecommendations(org.id, site.id);
  return (
    <div>
      <PageHeader
        title="Recommendations"
        description="Every next step the SEO engine sees for this website, from tracking, audits, rankings, AI answers and backlinks — most important first."
        actions={<RunAnalysisMenu />}
      />
      <DataGate
        q={q}
        skeleton={
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
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
  const groups =
    groupBy === 'priority'
      ? PRIORITY_ORDER.map((p) => ({ key: p, title: <PriorityBadge priority={p} />, items: shown.filter((r) => r.priority === p) }))
      : CATEGORY_ORDER.map((c) => ({
          key: c,
          title: (
            <span className="inline-flex items-center gap-2">
              <span className="text-ink-3">{CATEGORY_META[c].icon}</span>
              {CATEGORY_META[c].label}
            </span>
          ),
          items: shown.filter((r) => r.category === c),
        }));

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
    <div className={cn('space-y-6 transition-opacity', refetching && 'opacity-80')}>
      <KpiGrid cols={4} dense>
        <StatTile label="All recommendations" value={recs.length} hint={`Across ${plural(Object.keys(countBy(recs, (r) => r.category)).length, 'area')}`} onClick={() => setPrio('all')} />
        <StatTile label="High priority" value={byPrio.high ?? 0} hint="Do these first: they block results or cost traffic now" onClick={() => setPrio('high')} />
        <StatTile label="Medium" value={byPrio.medium ?? 0} hint="Clear wins once the urgent items are done" onClick={() => setPrio('medium')} />
        <StatTile label="Low" value={byPrio.low ?? 0} hint="Polish and longer-term growth" onClick={() => setPrio('low')} />
      </KpiGrid>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
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
        <EmptyState title="Nothing matches these filters" description="Clear a filter to see the other recommendations." />
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.key} aria-label={String(g.key)}>
              <SectionHeading title={<span className="inline-flex items-center gap-2">{g.title}<span className="text-sm font-normal text-ink-3 tabular">{g.items.length}</span></span>} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {g.items.map((r) => (
                  <RecommendationCard key={r.id} rec={r} />
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
