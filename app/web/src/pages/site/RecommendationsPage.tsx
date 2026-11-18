import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownCircle, CheckCircle2, Clock, HelpCircle, Lightbulb, ListFilter, OctagonAlert, Scale, ShieldAlert, TriangleAlert, XCircle } from 'lucide-react';
import { queueBands, type Priority, type QueueBand, type Recommendation, type RecommendationBoard, type RecommendationCategory } from '@seo/shared';
import { useRecommendationBoard } from '@/lib/queries';
import { useCycleDay } from '@/lib/cycle-day';
import { cn } from '@/lib/utils';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { Segmented, Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { CountUp, HeroNextStep, HeroStat, Stagger, SummaryHero, type IconTileTone } from '@/components/insight';
import { DataGate, FilterChips, Panel, RunAnalysisMenu, ToolButton, useSitePage } from './_components/kit';
import { useTicketStates } from '@/components/site/TicketButton';
import { countBy, plural } from './_components/format';
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_ORDER, RecommendationButton, RecommendationItem, sortRecommendations } from './_components/recommendations';

type CatFilter = RecommendationCategory | 'all';
type PrioFilter = Priority | 'all';
type GroupBy = 'worth' | 'priority' | 'category';

export default function RecommendationsPage() {
  const { org, site } = useSitePage();
  // CR17-H (client report 2026-11-17, Q4): the four tabs, read from the same states as the Overview and the Pipeline
  const q = useRecommendationBoard(org.id, site.id);
  useTicketStates(site.id); // G4: the state of tickets made from these, read back from the tracker
  return (
    <div>
      <PageHeader
        icon={<Lightbulb />}
        title="Recommendations"
        description="Every next step we see for this website, from tracking, audits, rankings, AI answers and backlinks. Each one says why, how to do it and how we check it is done; what our checks confirmed moves to Resolved."
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
        {(board) => <Board board={board} refetching={q.isFetching} />}
      </DataGate>
    </div>
  );
}

type BoardTab = 'todo' | 'waiting' | 'resolved' | 'dismissed';

/** CR17-H: To do / Waiting for Google / Resolved / Dismissed. Resolved also lists what is no longer reported but no check confirmed. */
function Board({ board, refetching }: { board: RecommendationBoard; refetching: boolean }) {
  const [tab, setTab] = useState<BoardTab>('todo');
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as BoardTab)}>
      <TabList>
        <Tab value="todo" count={board.todo.length}>
          To do
        </Tab>
        <Tab value="waiting" count={board.waiting.length}>
          Waiting for Google
        </Tab>
        <Tab value="resolved" count={board.resolved.length}>
          Resolved
        </Tab>
        <Tab value="dismissed" count={board.dismissed.length}>
          Dismissed
        </Tab>
      </TabList>
      <TabPanel value="todo">
        <Recommendations recs={board.todo} refetching={refetching} />
      </TabPanel>
      <TabPanel value="waiting">
        <StateList
          items={board.waiting}
          icon={<Clock />}
          title="Waiting for Google"
          description="Done on your website; Google has not read the pages again yet. The daily index check looks every day and moves each one to Resolved when Google has it."
          empty="Nothing is waiting for Google right now."
        />
      </TabPanel>
      <TabPanel value="resolved" className="space-y-6">
        <StateList
          items={board.resolved}
          icon={<CheckCircle2 />}
          title="Resolved in the last 90 days"
          description="Each one was confirmed by a check of ours, with the date and what it saw."
          empty="Nothing confirmed resolved yet. When a check of ours confirms a step is done, it moves here with the date and the proof."
        />
        {board.expired.length > 0 && (
          <StateList
            items={board.expired}
            icon={<HelpCircle />}
            title="No longer reported"
            description="Their source stopped listing them, but no check of ours could confirm they are fixed, so they are not called resolved."
            empty=""
          />
        )}
      </TabPanel>
      <TabPanel value="dismissed">
        <StateList items={board.dismissed} icon={<XCircle />} title="Dismissed" description="You said these do not apply, with the reason. Bring one back at any time." empty="Nothing dismissed." />
      </TabPanel>
    </Tabs>
  );
}

function StateList({ items, icon, title, description, empty }: { items: Recommendation[]; icon: ReactNode; title: string; description: string; empty: string }) {
  const { site } = useSitePage();
  if (!items.length) return <EmptyState icon={<span className="[&_svg]:size-5">{icon}</span>} title={empty} />;
  return (
    <Panel icon={icon} iconTone="neutral" description={description} title={<span className="inline-flex items-center gap-2">{title}<span className="rounded-full bg-surface-2 px-2 text-xs font-semibold tabular text-ink-2">{items.length}</span></span>} flush>
      <ul className="divide-y divide-line border-t border-line">
        {items.map((r) => (
          <RecommendationItem key={r.id} rec={r} siteId={site.id} />
        ))}
      </ul>
    </Panel>
  );
}

function Recommendations({ recs, refetching }: { recs: Recommendation[]; refetching: boolean }) {
  const { site } = useSitePage();
  const day = useCycleDay(site);
  const [cat, setCat] = useState<CatFilter>('all');
  const [prio, setPrio] = useState<PrioFilter>('all');
  // REP 3.3: one queue, ordered by what each step is worth. Grouping by priority or area stays available, but the default is the
  // queue itself, the whole point of the criterion is that a customer reads one list, not one list per area.
  const scored = recs.some((r) => r.score);
  const [groupBy, setGroupBy] = useState<GroupBy>(scored ? 'worth' : 'priority');
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
  const groups: { key: string; title: string; description?: string; icon: ReactNode; tone: IconTileTone; items: Recommendation[] }[] =
    groupBy === 'worth'
      ? queueBands(shown).map((b) => ({ key: b.band, ...BAND_GROUP[b.band], description: b.note, items: b.items }))
      : groupBy === 'priority'
        ? PRIORITY_ORDER.map((p) => ({ key: p, ...PRIO_GROUP[p], items: shown.filter((r) => r.priority === p) }))
        : CATEGORY_ORDER.map((c) => ({ key: c, title: CATEGORY_META[c].label, icon: CATEGORY_META[c].icon, tone: 'blue' as const, items: shown.filter((r) => r.category === c) }));
  const top = sorted[0];
  const high = byPrio.high ?? 0;

  if (!recs.length)
    return (
      <EmptyState
        icon={<Lightbulb className="size-5" />}
        title="No recommendations right now"
        description={`They come from the weekly tracking report, technical audits, rank checks, AI visibility and backlink monitors. Start one of them, or check back after ${day.name ? `the weekly run on ${day.name}` : 'the next weekly run'}.`}
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
                ...(scored ? [{ value: 'worth' as const, label: 'Worth' }] : []),
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
                description={g.description}
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
                    <RecommendationItem key={r.id} rec={r} siteId={site.id} />
                  ))}
                </ul>
              </Panel>
            </section>
          ))
      )}
    </Stagger>
  );
}

/** The three bands of the one queue (REP 3.3, `@seo/shared/queue`), with the note that says why each exists. */
const BAND_GROUP: Record<QueueBand, { title: string; icon: ReactNode; tone: IconTileTone }> = {
  blocking: { title: 'Before anything can be measured', icon: <ShieldAlert />, tone: 'serious' },
  ranked: { title: 'Ranked by what it is worth', icon: <Scale />, tone: 'blue' },
  unranked: { title: 'Worth doing, not yet measurable', icon: <HelpCircle />, tone: 'neutral' },
};
/** A priority group's heading: the word and a status tile (the priority badges in the rows carry it too). */
const PRIO_GROUP: Record<Priority, { title: string; icon: ReactNode; tone: IconTileTone }> = {
  high: { title: 'High priority', icon: <OctagonAlert />, tone: 'serious' },
  medium: { title: 'Medium', icon: <TriangleAlert />, tone: 'warning' },
  low: { title: 'Low', icon: <ArrowDownCircle />, tone: 'neutral' },
};
