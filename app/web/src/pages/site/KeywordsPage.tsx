// Keyword research (KI 2026-11-08, n8n/seo-agent/docs/keyword-intel-2026-11-08/DESIGN.md §6): what buyers search to hire a service like
// this website's, from every source we read, grouped into topics, each with the one verdict (Go / Takes a few months / Hard for your website
// now / Not for you), a score with its likely range and the factors behind it; the searches just off page one; buyer questions to add to
// the AI question panel; the plan of up to 10 steps; every search in one paged table with filters and a CSV. Every number says how it was
// found and when. Shown only where the website's KI is visible (On, or Trial for platform admins).
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Download, Filter, Layers, ListOrdered, MessageCircleQuestion, Search, Telescope, TrendingUp } from 'lucide-react';
import { compactNumber, KI_KEYWORD_GAP_TYPES, KI_SOURCE_LABELS, KI_STAGES, KI_STRIKING_WORDS, KI_VERDICT_IDS, KI_VERDICTS, type KiKeywordGapType, type KiPlanAction, type KiSource, type KiStage, type KiVerdict as Verdict } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { CountUp, HeroNextStep, HeroStat, InsightItem, Stagger, SummaryHero } from '@/components/insight';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { KiVerdict } from '@/components/site/KiVerdict';
import {
  KI_GAP_ACTION_LABELS,
  KI_GAP_LABELS,
  KI_KW_FILTER_EMPTY,
  KI_PAGE_SIZE,
  KI_PAGE_SIZE_PHONE,
  kiActiveFilters,
  kiBasisLine,
  kiClustersOf,
  kiAnd,
  kiCsvUrl,
  kiKwParams,
  kiQuestionsOf,
  kiStopNote,
  kiStrikingOf,
  kiMarketName,
  planOf,
  type KiGap,
  type KiKeywords,
  type KiKw,
  type KiKwFilter,
  type KiOverview,
} from '@/lib/ki';
import { formatCredits } from '@/lib/credits';
import { useKi, useKiApproveQuestions, useKiKeywords, useReport, useReports } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { InfoTip } from '@/components/insight';
import { Panel, useSitePage } from './_components/kit';
import { DashSkeleton, HeroEyebrow } from './_components/visuals';
import { KI_TIP, KiActionButton, KiFigure, KiIndex, KiNotAvailable, KiOtherPage, KiRunButton, KiRunNotes, KiScore, KiTrialBanner, KiUpdated, TAP, useIsPhone, useShowAll } from './_components/ki/common';

// A1_ROUTES: the topic heads, the searches just off page one and the questions are each one filtered read (page_size at most 200)
const HEADS = { heads: '1', sort: '-score', page: '1', page_size: '200' };
const STRIKING = { striking: '1', sort: 'position', page: '1', page_size: '30' };
const QUESTIONS = { questions: '1', sort: '-score', page: '1', page_size: '30' };
const n0 = (v: number) => v.toLocaleString('en-US');

export default function KeywordsPage() {
  const { org, site, can, tool } = useSitePage();
  const navigate = useNavigate();
  // the guide's closing button starts the run (members) or closes the guide on the page it explains
  const finish = can('member') ? { label: 'Research my keywords', onClick: () => navigate(tool('keyword_research')) } : undefined;
  const [filter, setFilter] = useState<KiKwFilter>(KI_KW_FILTER_EMPTY);
  // all reads start together: the overview, the summary (topics, striking, questions), this page of the table and the gaps
  const ki = useKi(org.id, site.id);
  const summary = useKiKeywords(org.id, site.id, HEADS);
  const striking = useKiKeywords(org.id, site.id, STRIKING);
  const questions = useKiKeywords(org.id, site.id, QUESTIONS);
  const pageSize = useIsPhone() ? KI_PAGE_SIZE_PHONE : KI_PAGE_SIZE;
  const table = useKiKeywords(org.id, site.id, kiKwParams(filter, pageSize));
  // the plan rides on the latest research report (CONTRACTS §4) unless the overview carries it
  const reports = useReports(org.id, { siteId: site.id, stage: 'ki_research', limit: 1 });
  const report = useReport(org.id, ki.data?.plan.length ? undefined : reports.data?.[0]?.id);
  const plan = ki.data?.plan.length ? ki.data.plan : summary.data?.plan.length ? summary.data.plan : planOf(report.data?.payload?.plan);

  const header = (
    <PageHeader
      icon={<Telescope />}
      title="Keyword research"
      description={`What buyers search to find a service like yours, and which searches ${site.domain} can win.`}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <GuideButton id="ki-read-keyword-research" vars={{ domain: site.domain }} finish={finish} label="How to read this" className="max-sm:h-10 max-sm:px-3.5" />
          {ki.data?.visible && <KiRunButton kind="keyword_research" o={ki.data} ready={!!summary.data && !summary.isError} />}
        </span>
      }
    />
  );
  if (ki.isError || (ki.data && !ki.data.visible)) return <KiNotAvailable title="Keyword research" paused={!!ki.data?.killed} />;
  if (!ki.data || (summary.isPending && !summary.data))
    return (
      <div>
        {header}
        <DashSkeleton cards={4} charts={1} />
      </div>
    );
  return (
    <div>
      {header}
      {summary.isError && !summary.data ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <Keywords
          o={ki.data}
          summary={summary.data ?? { rows: [], total: 0, page: 1, pageSize: KI_PAGE_SIZE, pages: null, plan: [], questions: null }}
          striking={striking.data?.rows}
          questionRows={questions.data?.rows}
          plan={plan}
          table={table.data}
          tableLoading={table.isFetching}
          tableError={table.isError ? table.error : null}
          pageSize={pageSize}
          filter={filter}
          onFilter={setFilter}
        />
      )}
    </div>
  );
}

/** The page from its data (tests render this one). */
export function Keywords({ o, summary, striking: strikingRows, questionRows, plan: planIn, table, tableLoading, tableError, filter, onFilter, pageSize = KI_PAGE_SIZE }: { o: KiOverview; summary: KiKeywords; striking?: KiKw[]; questionRows?: KiKw[]; plan?: KiPlanAction[]; table: KiKeywords | undefined; tableLoading: boolean; tableError: unknown; gaps?: KiGap[]; filter: KiKwFilter; onFilter: (f: KiKwFilter) => void; pageSize?: number }) {
  const { site } = useSitePage();
  const rows = summary.rows;
  const run = o.lastRuns.keyword_research;
  const sum = o.summary?.keywords;
  const clusters = useMemo(() => kiClustersOf(rows), [rows]);
  const striking = useMemo(() => kiStrikingOf(strikingRows?.length ? strikingRows : rows), [rows, strikingRows]);
  const questions = useMemo(() => kiQuestionsOf(questionRows?.length ? questionRows : rows, summary.questions), [rows, questionRows, summary.questions]);
  const plan = planIn?.length ? planIn : summary.plan;
  const topicsShow = useShowAll(clusters.length, 3, 12);
  const goTo = (p: Partial<KiKwFilter>) => {
    onFilter({ ...KI_KW_FILTER_EMPTY, ...p });
    document.getElementById('every-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // FX-A (review UX H3): a run that did not start or finish is said, with what to do; never the first-run empty state under it
  const stopped = !!kiStopNote(run, { siteCountry: site.country });
  if (!rows.length && stopped)
    return (
      <Stagger className="space-y-6">
        <KiTrialBanner o={o} />
        <KiRunNotes o={o} kind="keyword_research" />
      </Stagger>
    );
  if (!rows.length)
    return (
      <Stagger className="space-y-6">
        <KiTrialBanner o={o} />
        <KiRunNotes o={o} kind="keyword_research" />
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <EmptyState
            icon={<Telescope className="size-5" />}
            title="Find what your buyers search"
            description="We collect searches from your Search Console, Google's own suggestions and questions, and your competitors; keep the ones that fit what you sell; group them by topic and tell you which ones you can win. It takes about 12 minutes."
            action={<KiRunButton kind="keyword_research" o={o} />}
          />
          <p className="px-6 pb-5 text-center text-xs text-ink-3">
            Tip: choose your competitors first on the <KiOtherPage to="competitors">Competitors page</KiOtherPage>, so the research can show where they are ahead.
          </p>
        </div>
      </Stagger>
    );

  const heads = clusters.map((c) => c.head);
  // the hero counts: FX-A (review UX L11 / M8) the server's summary over every current row first (topics by verdict), then the run's
  // counts, then the rows on screen; ONE topic count for the hero and the Topics panel
  const hv = sum?.headsByVerdict;
  const count = (v: Verdict) => hv?.[v] ?? run?.counts[v] ?? heads.filter((h) => h.verdict === v).length;
  const go = count('go');
  const months = count('months');
  const total = sum?.total || run?.counts.keywords || summary.total;
  const topics = (hv ? Object.values(hv).reduce((a, b) => a + (b ?? 0), 0) : 0) || sum?.clusters || run?.counts.clusters || clusters.length;
  const strikingN = sum?.striking ?? run?.counts.striking ?? striking.length;
  const firstPlan = plan[0];
  const firstKeyword = firstPlan ? planKeyword(firstPlan, heads) : '';
  const s = (n: number, one: string, many = one + 's') => `${n0(n)} ${n === 1 ? one : many}`;

  return (
    <Stagger className="space-y-6">
      <KiTrialBanner o={o} />
      <KiRunNotes o={o} kind="keyword_research" />
      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag="Keyword research"><KiUpdated at={run?.finishedAt ?? rows[0]?.fetchedAt} market={o.market || run?.market} /></HeroEyebrow>}
        title={go ? `You can win ${s(go, 'topic')} soon${months ? `, and ${n0(months)} more in a few months` : ''}.` : months ? `${s(months, 'topic')} can be won in a few months.` : 'These searches are hard for your website right now.'}
        description={`We found ${s(total, 'search', 'searches')} people use to find a service like yours, grouped into ${s(topics, 'topic')}. Start with the plan below.`}
        stats={
          <>
            <HeroStat label="Go" value={<CountUp value={go} />} info="Topics your website can rank for soon: sites like yours already rank there." />
            <HeroStat label="Takes a few months" value={<CountUp value={months} />} info="Topics you can win with a few supporting pages first, usually over two to four months." />
            <HeroStat label="Searches found" value={<CountUp value={total} format={compactNumber} />} info="Every search we found for your services in your market, the ones that are not for you included (each says why)." />
            <HeroStat label="Just off page one" value={<CountUp value={strikingN} />} info={`Searches you already show up for, in ${KI_STRIKING_WORDS}. A better page can move these up fastest.`} />
          </>
        }
        aside={firstPlan ? <HeroNextStep title={`First step: ${firstPlan.title}`} actions={<KiActionButton kind={firstPlan.kind} keyword={firstKeyword} target={firstPlan.target} />} /> : undefined}
      />

      <KiIndex items={[{ id: 'ki-plan', label: 'Your plan' }, { id: 'ki-topics', label: 'Topics' }, { id: 'ki-striking', label: 'Just off page one' }, { id: 'every-search', label: 'Every search and filters' }]} />

      <div id="ki-plan" className="scroll-mt-20">
        <PlanPanel plan={plan} heads={heads} />
      </div>

      <div id="ki-topics" className="scroll-mt-20">
      <Panel icon={<Layers />} title="Topics" description={`${s(topics, 'topic')}, best first. One page can win each topic.`} info="Searches that Google answers with the same pages belong together, so one page can rank for the whole topic. Each topic is named after its main search." flush>
        <ul className="divide-y divide-line" id={topicsShow.listId}>
          {clusters.map(({ head, members }, i) => (
            <InsightItem
              key={head.key}
              className={topicsShow.cls(i)}
              icon={<Layers />}
              actionPosition="side"
              title={head.keyword}
              meta={
                <>
                  {/* review UX M12: the verdict leads the row */}
                  {/* review UX N2 (pass 2): one reason, in the verdict */}
                  <KiVerdict verdict={head.verdict} reason={head.verdict === 'gated' ? head.gateReason : null} size="sm" />
                  {head.stage && <Badge>{KI_STAGES[head.stage]}</Badge>}
                  <Badge>{members === 1 ? '1 search' : `${members} searches`}</Badge>
                  {head.cannibal && <Badge tone="warning">Two of your pages compete for it</Badge>}
                </>
              }
              description={
                <span className="flex flex-col gap-1">
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                    <span>
                      Searches a month: <VolumeFigure r={head} demand={head.clusterDemand} />
                    </span>
                    <span>
                      Score: <KiScore r={head} />
                    </span>
                    <span>
                      Where from: <SourcesFigure sources={head.sources.map((x) => x.source)} />
                    </span>
                  </span>
                  <span className="text-xs text-ink-3">{pageLine(head)}</span>
                  {head.stageEvidence && <span className="text-xs text-ink-3">Why this stage: {head.stageEvidence}</span>}
                </span>
              }
              action={head.verdict !== 'gated' ? <KiActionButton kind={head.pageAction === 'refresh' ? 'refresh' : head.pageAction === 'list' ? 'list' : 'new_page'} keyword={head.keyword} target={head.pageUrl} /> : undefined}
            />
          ))}
        </ul>
        {topicsShow.button && <div className="border-t border-line px-5 py-1">{topicsShow.button}</div>}
      </Panel>
      </div>

      <div id="ki-striking" className="grid scroll-mt-20 grid-cols-1 gap-4 xl:grid-cols-2">
        <StrikingPanel rows={striking} total={strikingN} onSeeAll={() => goTo({ striking: true })} />
        <QuestionsPanel questions={questions} />
      </div>

      <AllSearches o={o} clusters={heads} table={table} loading={tableLoading} error={tableError} filter={filter} onFilter={onFilter} domain={site.domain} pageSize={pageSize} />
    </Stagger>
  );
}

const sourcesText = (s: readonly KiSource[]) => {
  const u = [...new Set(s)].map((x) => KI_SOURCE_LABELS[x] ?? 'Another source');
  return u.length ? (u.length > 2 ? `${u.slice(0, 2).join(', ')} and ${u.length - 2} more` : u.join(', ')) : '-';
};
/** Where a search came from: the number of sources, the names one tap away (review UX M13: rows stay one line tall). */
function SourcesFigure({ sources }: { sources: readonly KiSource[] }) {
  const u = [...new Set(sources)].map((x) => KI_SOURCE_LABELS[x] ?? 'Another source');
  if (!u.length) return <span>-</span>;
  if (u.length === 1) return <span>{u[0]}</span>;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {u.length} sources
      <InfoTip label="Where this search came from" className={KI_TIP}>
        {kiAnd(u)}
      </InfoTip>
    </span>
  );
}
/** The search a plan step is about: its topic's main search, else its target when that is a search (not an address). */
function planKeyword(a: KiPlanAction, heads: readonly KiKw[]): string {
  const h = a.cluster_id ? heads.find((x) => x.clusterId === a.cluster_id) : undefined;
  // else the target when it is a search, else the search the step's title quotes ('Write a page for "erp cost uae"')
  return h?.keyword ?? (a.target && !/^https?:|\//.test(a.target) ? a.target : (/"([^"]{2,120})"/.exec(a.title)?.[1] ?? ''));
}
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '');
function pageLine(r: KiKw): string {
  if (r.pageAction === 'refresh' && r.pageUrl) return `Improve your page ${shortUrl(r.pageUrl)}`;
  if (r.pageAction === 'list') return 'Google shows lists and directories here: get on those lists instead of writing a page';
  if (r.pageAction === 'new') return 'Needs a new page';
  if (r.pageUrl) return `Your page: ${shortUrl(r.pageUrl)}`;
  return 'No page of yours yet';
}

function VolumeFigure({ r, demand }: { r: KiKw; demand?: number | null }) {
  const v = demand ?? r.volume;
  if (v == null && r.gscImpressions != null)
    return <KiFigure value={compactNumber(r.gscImpressions)} tip="How often your website was shown in Google for this search in the last 28 days." basis={kiBasisLine('measured', '', r.fetchedAt) + ', your Search Console'} />;
  if (v == null) return <KiFigure value="not measured" tip="We found this search in two or more places, but no source measures how often it is searched. We kept it so you do not lose it." basis="found in our sources" />;
  return <KiFigure value={compactNumber(v)} tip={demand != null ? 'About how many people a month search the searches of this topic together.' : 'About how many people a month search this in your market.'} basis={kiBasisLine(r.volumeBasis ?? 'provider_estimate', r.volumeSource || 'Google Ads', r.fetchedAt)} />;
}

function PlanPanel({ plan, heads }: { plan: KiPlanAction[]; heads: readonly KiKw[] }) {
  const show = useShowAll(plan.length, 3, 10);
  return (
    <Panel icon={<ListOrdered />} title="Your plan" description={plan.length === 1 ? 'The step most likely to bring you buyers' : plan.length ? `The ${plan.length} steps most likely to bring you buyers, best first` : 'The plan appears after the research'} info="Ranked from the topics you can win and the gaps against your competitors. Each step opens the tool that does it, with the search filled in; you see its credits there before anything starts.">
      {plan.length ? (
        <>
          <ol className="divide-y divide-line" id={show.listId}>
            {plan.slice(0, 10).map((a, i) => (
              <li key={a.action_id} className={cn('flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between', show.cls(i))}>
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-medium text-accent-text">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{a.title}</p>
                    <p className="text-[13px] text-ink-2">{a.why}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-3" title={a.target || undefined}>
                      {KI_GAP_ACTION_LABELS[a.kind] ?? 'Step'}
                      {a.target ? ` · ${shortUrl(a.target)}` : ''}
                      {a.credits > 0 ? ` · about ${formatCredits(a.credits)}` : ''}
                    </p>
                  </div>
                </div>
                <KiActionButton kind={a.kind} keyword={planKeyword(a, heads)} target={a.target} className="shrink-0 self-start sm:self-center" />
              </li>
            ))}
          </ol>
          {show.button}
        </>
      ) : (
        <p className="text-sm text-ink-3">Run the research to get your plan.</p>
      )}
    </Panel>
  );
}

function StrikingPanel({ rows, total, onSeeAll }: { rows: KiKw[]; total: number; onSeeAll: () => void }) {
  const show = useShowAll(Math.min(rows.length, 10), 3, 10);
  return (
    <Panel icon={<TrendingUp />} title="Just off page one" description="You show up in places 8 to 20: the quickest wins" info={`Searches your website already shows up for, in ${KI_STRIKING_WORDS}. Improving the page that shows up is usually enough to move it up.`}>
      {rows.length ? (
        <>
          <ul className="divide-y divide-line" id={show.listId}>
            {rows.slice(0, 10).map((r, i) => (
              <li key={r.key} className={cn('flex flex-wrap items-center justify-between gap-2 py-2.5', show.cls(i))}>
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{r.keyword}</span>
                  <span className="block truncate text-xs text-ink-3" title={r.gscPage || r.pageUrl || undefined}>
                    {r.gscPage ? `Your page: ${shortUrl(r.gscPage)}` : pageLine(r)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
                  <span>
                    Place <KiFigure value={r.gscPosition == null ? '-' : `#${Math.round(r.gscPosition)}`} tip="Your average place in Google for this search over the last 28 days." basis="measured, your Search Console" />
                  </span>
                  <span>
                    Seen <KiFigure value={r.gscImpressions == null ? '-' : compactNumber(r.gscImpressions)} tip="How many times your page was shown for this search in the last 28 days." basis="measured, your Search Console" />
                  </span>
                  <KiActionButton kind="refresh" keyword={r.keyword} target={r.gscPage || r.pageUrl} />
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-4">
            {show.button}
            {/* review UX L13: the hero counts them all; the table shows them all */}
            {total > Math.min(rows.length, 10) && (
              <button type="button" onClick={onSeeAll} className="mt-2 inline-flex min-h-10 items-center gap-1.5 px-1 text-[13px] font-medium text-accent-text hover:underline sm:min-h-8">
                See all {n0(total)} in the table <ArrowRight className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-3">None yet. Connect Search Console in Website settings to see the searches you already show up for.</p>
      )}
    </Panel>
  );
}

function QuestionsPanel({ questions }: { questions: { key: string; question: string; sources: KiSource[] }[] }) {
  const { org, site, can } = useSitePage();
  const approve = useKiApproveQuestions(org.id, site.id);
  const mayAdd = can('admin');   // as the AI question panel itself (A1_ROUTES)
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const shown = questions.slice(0, 15);
  const show = useShowAll(shown.length, 3, 15);
  const toggle = (k: string) => setPicked((p) => (p.has(k) ? new Set([...p].filter((x) => x !== k)) : new Set([...p, k])));
  const send = () =>
    approve.mutate([...picked], {
      onSuccess: (r) => {
        const added = Array.isArray(r?.added) ? r.added.length : typeof r?.added === 'number' ? r.added : picked.size;
        const full = Array.isArray(r?.skipped) && r.skipped.some((x) => x?.reason === 'panel_full');
        if (added) toast.success(`${added} question${added === 1 ? '' : 's'} added to your AI questions`, { description: 'They are asked from your next AI visibility check. Nothing is charged now.' });
        if (full) toast.info('Your AI question list is full. Remove a question on the AI visibility page to add more.');
        else if (!added) toast.info('These questions are already on your AI questions.');
        setPicked(new Set());
      },
      onError: () => toast.error('The questions were not added. Please try again.'),
    });
  return (
    <Panel
      icon={<MessageCircleQuestion />}
      title="Buyer questions"
      description="Questions buyers ask before they hire. Add the ones that matter to your AI questions."
      info="From Google's 'People also ask', its suggestions and your own Search Console. Once added, we ask ChatGPT, Gemini and other AI answers these questions and show whether they name you."
      actions={
        mayAdd && questions.length > 0 ? (
          <Button size="sm" className={TAP} icon={<Check className="size-4" />} disabled={!picked.size} loading={approve.isPending} onClick={send}>
            Add {picked.size || ''} to my AI questions
          </Button>
        ) : undefined
      }
    >
      {/* review UX L9: everyone who cannot add is told why (members and viewers) */}
      {questions.length > 0 && !mayAdd && <p className="mb-2 text-xs text-ink-3">Adding questions to your AI questions takes the admin role, as the AI question list itself. Ask an admin of your company.</p>}
      {shown.length ? (
        <>
          <ul className="divide-y divide-line" id={show.listId}>
            {shown.map((q, i) => (
              <li key={q.key} className={show.cls(i)}>
                {mayAdd ? (
                  <label className="flex min-h-10 cursor-pointer items-start gap-3 py-2.5">
                    <input type="checkbox" className="mt-1 size-4 shrink-0 accent-accent" checked={picked.has(q.key)} onChange={() => toggle(q.key)} aria-label={`Add "${q.question}" to my AI questions`} />
                    <QuestionText q={q} />
                  </label>
                ) : (
                  <div className="py-2.5">
                    <QuestionText q={q} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {show.button}
        </>
      ) : (
        <p className="text-sm text-ink-3">No buyer questions in this reading.</p>
      )}
    </Panel>
  );
}
function QuestionText({ q }: { q: { question: string; sources: KiSource[] } }) {
  return (
    <span className="min-w-0">
      <span className="block text-sm text-ink">{q.question}</span>
      <span className="block text-xs text-ink-3">From: {sourcesText(q.sources)}</span>
    </span>
  );
}

// ------------------------------------------------------------------------------------------------------------------------------
// every search: filters (a sheet on phones), the paged table (cards on phones), CSV
// ------------------------------------------------------------------------------------------------------------------------------

const VOLUME_STEPS = ['10', '50', '100', '500', '1000'];
/** review UX L4: short gap labels, so the select is not cut ("Competitors rank, yo") */
const GAP_FILTER_LABELS: Record<KiKeywordGapType, string> = { missing: 'You are missing', untapped: 'One competitor only', weak: 'You rank low', striking: 'Just off page one', strong: 'You lead' };

export function KiFilterFields({ f, set, clusters, stack }: { f: KiKwFilter; set: (p: Partial<KiKwFilter>) => void; clusters: KiKw[]; stack?: boolean }) {
  const field = (label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[], all = 'All') => (
    <label key={label} className={cn('flex min-w-0 flex-col gap-1 text-xs font-medium text-ink-3', stack ? 'w-full' : 'w-[11.5rem]')}>
      {label}
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full sm:h-9">
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
  // review UX M8: every topic loaded (up to 200), A to Z, not the first 60
  const topics = clusters.filter((c) => c.clusterId).sort((a, b) => a.keyword.localeCompare(b.keyword));
  return (
    <>
      {field('Verdict', f.verdict, (v) => set({ verdict: v as KiKwFilter['verdict'] }), KI_VERDICT_IDS.map((v) => ({ value: v, label: KI_VERDICTS[v] })))}
      {field('Buyer stage', f.stage, (v) => set({ stage: v as KiKwFilter['stage'] }), (Object.keys(KI_STAGES) as KiStage[]).map((v) => ({ value: v, label: KI_STAGES[v] })))}
      {field('Topic', f.cluster, (v) => set({ cluster: v }), topics.map((c) => ({ value: c.clusterId, label: c.keyword })))}
      {field('Where from', f.source, (v) => set({ source: v as KiKwFilter['source'] }), (Object.keys(KI_SOURCE_LABELS) as KiSource[]).map((v) => ({ value: v, label: KI_SOURCE_LABELS[v] })), 'Any source')}
      {field('Searches a month', f.minVolume, (v) => set({ minVolume: v }), VOLUME_STEPS.map((v) => ({ value: v, label: `At least ${n0(Number(v))}` })), 'Any number')}
      {field('Against competitors', f.gapType, (v) => set({ gapType: v as KiKwFilter['gapType'] }), KI_KEYWORD_GAP_TYPES.map((v) => ({ value: v, label: GAP_FILTER_LABELS[v] })), 'Any')}
      {field('Your brand', f.brand, (v) => set({ brand: v as KiKwFilter['brand'] }), [{ value: 'non_brand', label: 'Without your name' }, { value: 'brand', label: 'With your name' }], 'Both')}
    </>
  );
}

function AllSearches({ o, clusters, table, loading, error, filter, onFilter, domain, pageSize }: { o: KiOverview; clusters: KiKw[]; table: KiKeywords | undefined; loading: boolean; error: unknown; filter: KiKwFilter; onFilter: (f: KiKwFilter) => void; domain: string; pageSize: number }) {
  const { org, site } = useSitePage();
  const [sheet, setSheet] = useState(false);
  // review UX H5: on a phone the table is one tap away, under the answer and the actions
  const [phoneOpen, setPhoneOpen] = useState(false);
  const set = (p: Partial<KiKwFilter>) => onFilter({ ...filter, ...p, page: 'page' in p ? (p.page ?? 1) : 1 });
  const active = kiActiveFilters(filter);
  // FX-A (review UX H2): every filter runs on the server, so the rows, the count, the pager and the empty state are one answer
  const rows = table?.rows ?? [];
  const total = table?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (filter.page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, filter.page * pageSize);
  const params = kiKwParams(filter, pageSize);
  // review UX L15: no wall of filters above a handful of rows
  const showFilters = active > 0 || total >= 20;
  const open = phoneOpen || active > 0;

  const cols: Column<KiKw>[] = [
    {
      key: 'keyword',
      header: 'Search',
      cell: (r) => (
        <span className="block min-w-[12rem]">
          <span className="block font-medium text-ink">{r.keyword}</span>
          {r.needsReview && <span className="block text-xs text-warning-text">Please check the buyer stage</span>}
        </span>
      ),
    },
    { key: 'verdict', header: 'For you', cell: (r) => <KiVerdict verdict={r.verdict} reason={r.verdict === 'gated' ? r.gateReason : null} size="sm" /> },
    { key: 'volume', header: 'Searches a month', align: 'right', cell: (r) => <VolumeFigure r={r} /> },
    { key: 'stage', header: 'Buyer stage', hideOnMobile: true, cell: (r) => <span className="whitespace-nowrap text-ink-2">{r.stage ? KI_STAGES[r.stage] : '-'}</span> },
    { key: 'score', header: 'Score', align: 'right', cell: (r) => <KiScore r={r} /> },
    { key: 'sources', header: 'Where from', hideOnMobile: true, cell: (r) => <span className="text-xs text-ink-3"><SourcesFigure sources={r.sources.map((x) => x.source)} /></span> },
    { key: 'page', header: 'Your page', hideOnMobile: true, cell: (r) => <span className="block max-w-[16rem] truncate text-xs text-ink-3" title={r.pageUrl || r.gscPage || undefined}>{pageLine(r)}</span> },
  ];

  return (
    <section id="every-search" className="scroll-mt-20">
      <Panel
        icon={<Search />}
        title="Every search"
        description={total ? `${n0(total)} ${total === 1 ? 'search' : 'searches'}${active ? ' match your filters' : ''}` : 'Every search we kept, with its verdict'}
        info="Filter by verdict, buyer stage, topic, source, size, gap or brand. The download has every row that matches your filters, not only this page."
        actions={
          <a href={kiCsvUrl(org.id, site.id, 'keywords', params)} download rel="noopener" className={buttonClass('secondary', 'sm', TAP)}>
            <Download className="size-4" aria-hidden />
            Download CSV
          </a>
        }
      >
        {!open && (
          <button type="button" onClick={() => setPhoneOpen(true)} aria-expanded={false} className="mb-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface text-sm font-medium text-ink shadow-card md:hidden">
            See every search{total ? ` (${n0(total)})` : ''}
          </button>
        )}
        <div className={cn(!open && 'max-md:hidden')}>
          {showFilters && (
            <div className="mb-3 hidden flex-wrap items-end gap-3 md:flex" data-ki-filters>
              <KiFilterFields f={filter} set={set} clusters={clusters} />
              {active > 0 && (
                <Button variant="ghost" size="sm" onClick={() => onFilter(KI_KW_FILTER_EMPTY)}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
          {filter.striking && <p className="mb-2 text-xs text-ink-3">Showing the searches just off page one. <button type="button" className="font-medium text-accent-text hover:underline" onClick={() => set({ striking: false })}>Show every search</button></p>}
          <div className="mb-3 flex flex-wrap items-center gap-2 md:hidden">
            {showFilters && (
              <button type="button" onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink shadow-card">
                <Filter className="size-4" aria-hidden />
                Filters{active ? ` (${active})` : ''}
              </button>
            )}
            <label className="flex items-center gap-2 text-xs font-medium text-ink-3">
              Sort
              <Select value={filter.sort} onChange={(e) => set({ sort: e.target.value as KiKwFilter['sort'] })} className="h-10">
                <option value="score">Best first</option>
                <option value="volume">Most searched</option>
                <option value="keyword">A to Z</option>
              </Select>
            </label>
            <Sheet
              open={sheet}
              onOpenChange={setSheet}
              title="Filter the searches"
              footer={
                <>
                  {active > 0 && (
                    <Button variant="ghost" className="h-10" onClick={() => onFilter(KI_KW_FILTER_EMPTY)}>
                      Clear
                    </Button>
                  )}
                  <Button className="h-10" onClick={() => setSheet(false)}>
                    Show results
                  </Button>
                </>
              }
            >
              <div className="space-y-4">
                <KiFilterFields f={filter} set={set} clusters={clusters} stack />
              </div>
            </Sheet>
          </div>
          <div className="mb-2 hidden items-center justify-end gap-2 md:flex">
            <label className="flex items-center gap-2 text-xs font-medium text-ink-3">
              Sort
              <Select value={filter.sort} onChange={(e) => set({ sort: e.target.value as KiKwFilter['sort'] })} className="h-9">
                <option value="score">Best first</option>
                <option value="volume">Most searched</option>
                <option value="keyword">A to Z</option>
              </Select>
            </label>
          </div>
          {error && !table ? (
            <ErrorState error={error} />
          ) : !table ? (
            <Skeleton className="h-[320px] rounded-xl" />
          ) : (
            <div className={cn('transition-opacity duration-150', loading && 'opacity-60')} aria-busy={loading || undefined}>
              <DataTable
                rows={rows}
                columns={cols}
                rowKey={(r) => r.key}
                pageSize={Math.max(rows.length, 1)}
                stickyFirst
                empty={active ? 'No search matches these filters. Clear a filter to see more.' : 'No searches yet.'}
                mobileCard={(r) => <SearchCard r={r} />}
              />
              {pages > 1 && (
                <div className="mt-3 flex items-center justify-between gap-2 text-[13px] text-ink-3">
                  <span className="tabular">
                    {n0(from)}-{n0(to)} of {n0(total)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="mr-1 hidden tabular sm:inline">
                      Page {filter.page} of {pages}
                    </span>
                    <PagerButton disabled={filter.page <= 1} onClick={() => set({ page: filter.page - 1 })} label="Previous page" icon={<ChevronLeft className="size-4" />} />
                    <PagerButton disabled={filter.page >= pages} onClick={() => set({ page: filter.page + 1 })} label="Next page" icon={<ChevronRight className="size-4" />} />
                  </span>
                </div>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-ink-3">
            Searches for {domain} in {kiMarketName(o.market) || 'your market'}. <GuideButton id="ki-verdicts" vars={{ domain }} variant="link" label="What the verdicts mean" className="max-sm:min-h-10" />
          </p>
        </div>
      </Panel>
    </section>
  );
}

function PagerButton({ disabled, onClick, label, icon }: { disabled: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-label={label} className="inline-flex size-10 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 shadow-card transition-colors duration-150 ease-brand hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40 sm:size-8">
      {icon}
    </button>
  );
}

function SearchCard({ r }: { r: KiKw }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 font-medium text-ink">{r.keyword}</span>
        <KiVerdict verdict={r.verdict} reason={r.verdict === 'gated' ? r.gateReason : null} size="sm" className="shrink-0 items-end text-right" />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-3">Searches a month</dt>
        <dd className="text-right text-ink">
          <VolumeFigure r={r} />
        </dd>
        <dt className="text-ink-3">Score</dt>
        <dd className="text-right">
          <KiScore r={r} />
        </dd>
        <dt className="text-ink-3">Buyer stage</dt>
        <dd className="text-right text-ink-2">{r.stage ? KI_STAGES[r.stage] : '-'}</dd>
      </dl>
      <p className="flex items-start gap-1 text-xs text-ink-3">
        <ArrowRight className="mt-0.5 size-3 shrink-0" aria-hidden />
        {pageLine(r)}
      </p>
    </div>
  );
}
