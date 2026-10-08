import { useMemo, useState } from 'react';
import { Bot, ExternalLink as ExternalIcon, Globe, Sparkles } from 'lucide-react';
import { compactNumber, estimateAiVisibilityCost, formatUsd, titleCase, type AiData, type AiDay, type AiEngineStat, type AiRun } from '@seo/shared';
import { useSiteData } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { ChartCard, ShareBars, Sparkline, TimeSeriesChart, type Series } from '@/components/charts';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Delta, PageHeader, StatTile } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { EngineActionList } from './_components/actions';
import { AnswersExplorer, QuestionGrid, QuestionManager, engineLabel } from './_components/ai';
import { AccessPanel, AiTrafficPanel, DiscoveryPanel, GroupsPanel, IndexPanel, PerceptionPanel } from './_components/ai-insights';
import { Chips, DataGate, KpiGrid, MetricSwitch, Kind, Panel, SectionHeading, ToolButton, YesNo, useSitePage } from './_components/kit';
import { diff, lastTwo, pct, sortByDate, timeAxisFormat, urlPath } from './_components/format';

export default function AiVisibilityPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'ai');
  return (
    <div>
      <PageHeader
        title="AI visibility"
        description={`Is ${site.domain} named when buyers ask ChatGPT, Gemini, Perplexity, Claude and Google’s AI — and what is it worth? Your questions are asked every day on the fast engines and fully every Monday.`}
        actions={
          <ToolButton mode="ai_visibility" variant="primary" icon={<Bot className="size-4" />}>
            Run an AI visibility check
          </ToolButton>
        }
      />
      <DataGate q={q}>{(d) => <AiBody d={d} refetching={q.isFetching} />}</DataGate>
    </div>
  );
}

function AiBody({ d, refetching }: { d: AiData; refetching: boolean }) {
  const { site, can, page } = useSitePage();
  const runs = useMemo(() => sortByDate(d.runs, (r) => r.checkedAt), [d.runs]);
  const [L, P] = lastTwo(runs);
  const engineNames = useMemo(() => Object.fromEntries((d.latest?.engines ?? []).map((e) => [e.key, e.name])), [d.latest]);

  if (!L && !d.latest && !d.report)
    return (
      <EmptyState
        icon={<Bot className="size-5" />}
        title="No AI visibility check yet"
        description={`The check asks your buyers’ questions on ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews, and shows who gets named, how AI describes you, which sources it trusts, whether AI crawlers can read your site and what AI visits are worth. About ${formatUsd(estimateAiVisibilityCost().fullRun + estimateAiVisibilityCost().weekly / 4.33)} for the first full check.`}
        action={
          <>
            <ToolButton mode="ai_visibility" variant="primary">
              Run the first check
            </ToolButton>
            {can('admin') && (
              <ButtonLink to={page('settings/tracking')} variant="secondary">
                Weekly monitor settings
              </ButtonLink>
            )}
          </>
        }
      />
    );

  const brief = d.report?.brief;
  const alerts = L?.alerts ?? [];

  return (
    <div className="space-y-6">
      {(brief?.headline || brief?.summary) && (
        <Callout title={brief?.headline}>
          {brief?.summary}
          {d.report && <span className="mt-1 block text-xs text-ink-3">Weekly AI visibility report · {fmtAgo(d.report.receivedAt)}</span>}
        </Callout>
      )}
      {alerts.length > 0 && (
        <Callout tone="warning" title="Alerts from the latest run">
          <ul className="list-disc space-y-0.5 pl-4">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Callout>
      )}

      {L && (
        <KpiGrid cols={5}>
          <StatTile
            label="Named in answers"
            value={pct(L.mentionRate)}
            delta={<Delta value={diff(L.mentionRate, P?.mentionRate)} suffix=" pts" />}
            trend={<Sparkline data={runs.map((r) => ({ v: r.mentionRate }))} dataKey="v" />}
            hint={L.mentionLo != null && L.mentionHi != null ? `95% range ${pct(L.mentionLo, 0)}–${pct(L.mentionHi, 0)} · ${compactNumber(L.samples)} answers in 7 days` : `of ${compactNumber(L.answers)} answers to ${L.prompts} questions`}
          />
          <StatTile
            label="AI visibility score"
            value={L.visibilityScore != null ? `${L.visibilityScore.toFixed(0)}/100` : '–'}
            delta={L.visibilityScore != null && P?.visibilityScore != null ? <Delta value={L.visibilityScore - P.visibilityScore} suffix="" /> : undefined}
            trend={runs.some((r) => r.visibilityScore != null) ? <Sparkline data={runs.filter((r) => r.visibilityScore != null).map((r) => ({ v: r.visibilityScore }))} dataKey="v" /> : undefined}
            hint="Named, how high in the list, linked — weighted by how often each question is asked"
          />
          <StatTile
            label="Share of voice"
            value={pct(L.shareOfVoice)}
            delta={<Delta value={diff(L.shareOfVoice, P?.shareOfVoice)} suffix=" pts" />}
            trend={<Sparkline data={runs.map((r) => ({ v: r.shareOfVoice }))} dataKey="v" />}
            hint={L.indexSov != null ? `Market-wide (every AI answer): ${pct(L.indexSov)}` : 'Your mentions among all brands named'}
          />
          <StatTile
            label="AI visits (28 days)"
            value={L.aiSessions != null ? compactNumber(L.aiSessions) : '–'}
            delta={L.aiSessions != null && P?.aiSessions != null && P.aiSessions > 0 ? <Delta value={(100 * (L.aiSessions - P.aiSessions)) / P.aiSessions} suffix="%" /> : undefined}
            trend={runs.some((r) => r.aiSessions != null) ? <Sparkline data={runs.filter((r) => r.aiSessions != null).map((r) => ({ v: r.aiSessions }))} dataKey="v" /> : undefined}
            hint={L.aiSessions != null ? `${compactNumber(L.aiConversions ?? 0)} key events${L.aiRevenue ? ` · ${compactNumber(L.aiRevenue)} revenue` : ''} from ChatGPT, Gemini, Perplexity …` : L.runKind ? 'Connect GA4 to see visits and revenue from AI' : 'From the next weekly run (GA4 visits and revenue from AI)'}
          />
          <StatTile
            label="Your pages cited"
            value={pct(L.citationRate)}
            delta={<Delta value={diff(L.citationRate, P?.citationRate)} suffix=" pts" />}
            trend={<Sparkline data={runs.map((r) => ({ v: r.citationRate }))} dataKey="v" />}
            hint={`Answers that link to a page of yours · AI Overview shown for ${pct(L.aioPresence, 0)} of your searches`}
          />
        </KpiGrid>
      )}
      {L && <p className="-mt-3 text-xs text-ink-3">{P ? `Run of ${fmtDate(L.checkedAt)}; changes are in percentage points against the run of ${fmtDate(P.checkedAt)}. AI answers vary between asks: read a change against the 95% range.` : `First run, ${fmtDate(L.checkedAt)}: changes appear from the next weekly run.`}</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <RunsTrend runs={runs} daily={d.daily} loading={refetching} className="xl:col-span-3" />
        <Panel title="Share of voice" description="Brands named across all answers in the latest run" className="xl:col-span-2">
          {d.latest?.competitors.length || L ? (
            <>
              <ShareBars
                highlight={site.domain}
                items={[...(d.latest?.competitors ?? []).filter((c) => c.domain !== site.domain).map((c) => ({ label: c.domain, value: c.share, sub: `${c.mentions}${c.auto ? '' : ' ★'}` })), ...(L ? [{ label: site.domain, value: L.shareOfVoice, sub: 'you' }] : [])]
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 9)}
              />
              <p className="mt-3 text-xs text-ink-3">Share of all brand mentions; the number is mentions. ★ = a competitor you set; others were found in the answers.</p>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-ink-3">No brands named yet.</p>
          )}
        </Panel>
      </div>

      {d.latest && <AiTrafficPanel traffic={d.latest.traffic} />}

      {d.latest && (d.latest.perception || d.latest.access) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
          <PerceptionPanel perception={d.latest.perception} />
          <AccessPanel access={d.latest.access} />
        </div>
      )}

      {d.latest && <GroupsPanel stages={d.latest.stages} clusters={d.latest.clusters} />}

      {d.latest && d.latest.engines.length > 0 && (
        <section>
          <SectionHeading title="By engine" description="Each assistant over the past 7 days (Monday's run plus the daily pulse on ChatGPT, Gemini and Google AI Mode). Claude is asked on the monthly full run; its result is carried between runs." />
          <Card className="p-4">
            <EngineTable engines={d.latest.engines} />
          </Card>
        </section>
      )}

      {d.report && d.report.questions.length > 0 && (
        <section>
          <SectionHeading title="Question × engine" description={`Every tracked buyer question on every engine · report of ${fmtDate(d.report.receivedAt)}`} />
          <Card className="p-4">
            <QuestionGrid questions={d.report.questions} engineNames={engineNames} />
          </Card>
        </section>
      )}

      {d.latest && d.latest.gaps.length > 0 && <Gaps d={d} />}

      {d.report && d.report.actions.length > 0 && (
        <Panel title="What to do next" description="The engine’s actions from the latest AI visibility report" icon={<Sparkles className="size-4" />} flush>
          <EngineActionList actions={d.report.actions} />
        </Panel>
      )}

      {d.latest?.index && <IndexPanel index={d.latest.index} domain={site.domain} />}
      {d.latest?.index && <DiscoveryPanel index={d.latest.index} tracked={d.prompts.map((p) => p.prompt)} />}

      {d.latest && (
        <Panel title="Sources AI trusts" description="Domains the assistants cite for your questions — being mentioned there is how you get into the answers" flush>
          <div className="px-4 pb-4">
            <SourcesTable sources={d.latest.sources} />
          </div>
        </Panel>
      )}

      {d.latest && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="contents">
            <Panel title="Your pages AI cites" description="Pages of yours used as a source">
              {d.latest.pages.length ? (
                <ul className="space-y-2">
                  {d.latest.pages.map((p) => (
                    <li key={p.url} className="flex items-start justify-between gap-3 text-sm">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-accent-text hover:underline" title={p.url}>
                        {urlPath(p.url)}
                      </a>
                      <span className="shrink-0 text-right text-xs text-ink-3">
                        <span className="font-medium tabular text-ink">{p.citations}</span> · {p.engines.map((e) => engineLabel(e, e)).join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] leading-relaxed text-ink-2">No page of yours is cited yet. Pages that answer one question directly, with sources and a clear author, are the ones assistants quote — see “What to do next”.</p>
              )}
            </Panel>
            {d.latest.market && <MarketView market={d.latest.market} domain={site.domain} />}
          </div>
        </div>
      )}

      <section>
        <SectionHeading title="Answers" description="What each assistant actually said, from the latest run" />
        <Card className="p-4">
          <AnswersExplorer answers={d.answers} engineNames={engineNames} />
        </Card>
      </section>

      <section>
        <SectionHeading title="Tracked buyer questions" description={can('admin') ? 'Add the questions your buyers ask, or switch off ones that do not fit' : 'The questions asked every week (admins can change them)'} />
        <Card className="p-4">
          <QuestionManager prompts={d.prompts} />
        </Card>
      </section>
    </div>
  );
}

type TMetric = 'you' | 'daily' | 'score' | 'aio';
function RunsTrend({ runs, daily, loading, className }: { runs: AiRun[]; daily: AiDay[]; loading: boolean; className?: string }) {
  const [m, setM] = useState<TMetric>('you');
  const pctS = (key: string, label: string): Series => ({ key, label, format: (v) => pct(v) });
  const series: Series[] =
    m === 'you'
      ? [pctS('mentionRate', 'Named'), pctS('citationRate', 'Cited'), pctS('shareOfVoice', 'Share of voice')]
      : m === 'daily'
        ? [pctS('mentionRate', 'Named'), pctS('citationRate', 'Cited')]
        : m === 'score'
          ? [{ key: 'visibilityScore', label: 'Visibility score', format: (v) => `${v.toFixed(0)}/100` }]
          : [pctS('aioPresence', 'AI Overview shown'), pctS('aioCitationRate', 'You cited in AI Overviews')];
  const rows = runs.map((r) => ({ checkedAt: r.checkedAt, mentionRate: r.mentionRate, citationRate: r.citationRate, shareOfVoice: r.shareOfVoice, aioPresence: r.aioPresence, aioCitationRate: r.aioCitationRate, visibilityScore: r.visibilityScore, prompts: r.prompts, answers: r.answers, costUsd: r.costUsd }));
  const dayRows = daily.map((x) => ({ checkedAt: `${x.date}T12:00:00.000Z`, mentionRate: x.mentionRate, citationRate: x.citationRate, visibilityScore: x.visibilityScore, answers: x.samples }));
  const data = m === 'daily' ? dayRows : m === 'score' ? rows.filter((r) => r.visibilityScore != null) : rows;
  const options: { value: TMetric; label: string }[] = [
    { value: 'you', label: 'Weekly' },
    ...(daily.length ? [{ value: 'daily' as const, label: 'Daily' }] : []),
    ...(runs.some((r) => r.visibilityScore != null) ? [{ value: 'score' as const, label: 'Score' }] : []),
    { value: 'aio', label: 'AI Overviews' },
  ];
  return (
    <ChartCard
      className={className}
      title="Over time"
      description={m === 'daily' ? `${daily.length} days of the AI pulse (ChatGPT, Gemini, Google AI Mode) · percent of answers` : `${runs.length} ${runs.length === 1 ? 'run' : 'runs'} · ${m === 'score' ? '0-100' : 'percent of answers'}`}
      series={series}
      loading={loading}
      actions={<MetricSwitch label="Metric" value={m} onChange={setM} options={options} />}
      table={{
        columns: [
          { key: 'checkedAt', label: m === 'daily' ? 'Day' : 'Run', format: (v) => fmtDate(String(v)) },
          { key: 'mentionRate', label: 'Named', align: 'right', format: (v) => pct(Number(v)) },
          { key: 'citationRate', label: 'Cited', align: 'right', format: (v) => pct(Number(v)) },
          ...(m === 'daily' ? [] : [{ key: 'shareOfVoice', label: 'SoV', align: 'right' as const, format: (v: unknown) => pct(Number(v)) }, { key: 'aioPresence', label: 'AIO shown', align: 'right' as const, format: (v: unknown) => pct(Number(v)) }]),
          { key: 'visibilityScore', label: 'Score', align: 'right', format: (v) => (v == null ? '–' : Number(v).toFixed(0)) },
          { key: 'answers', label: 'Answers', align: 'right' },
          ...(m === 'daily' ? [] : [{ key: 'costUsd', label: 'Cost', align: 'right' as const, format: (v: unknown) => formatUsd(Number(v)) }]),
        ],
        rows: [...data].reverse(),
      }}
    >
      {data.length ? (
        <TimeSeriesChart data={data} xKey="checkedAt" xFormat={timeAxisFormat(data.map((r) => r.checkedAt))} series={series} height={250} yFormat={(v) => (m === 'score' ? `${v}` : `${v}%`)} yDomain={[0, m === 'score' ? 100 : 'auto']} />
      ) : (
        <EmptyState className="py-10" title="No runs stored yet" />
      )}
    </ChartCard>
  );
}

function EngineTable({ engines }: { engines: AiEngineStat[] }) {
  const columns: Column<AiEngineStat>[] = [
    {
      key: 'name',
      header: 'Engine',
      sortValue: (e) => e.name,
      cell: (e) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-ink">{e.name || engineLabel(e.key)}</span>
          {e.carried && <Kind>monthly · carried</Kind>}
        </span>
      ),
    },
    { key: 'samples', header: 'Answers (7 days)', align: 'right', sortValue: (e) => e.samples, cell: (e) => <span title={e.pulseSamples ? `${e.pulseSamples} from the daily pulse` : undefined}>{e.samples}{e.pulseSamples ? <span className="text-xs text-ink-3"> ({e.pulseSamples} daily)</span> : null}</span> },
    {
      key: 'mentioned',
      header: 'Named',
      align: 'right',
      sortValue: (e) => e.mentionRate,
      cell: (e) => (
        <span>
          {e.mentioned} <span className="text-xs text-ink-3">({pct(e.mentionRate, 0)})</span>
        </span>
      ),
    },
    {
      key: 'cited',
      header: 'Cited',
      align: 'right',
      sortValue: (e) => e.citationRate,
      cell: (e) => (
        <span>
          {e.cited} <span className="text-xs text-ink-3">({pct(e.citationRate, 0)})</span>
        </span>
      ),
    },
    { key: 'ci', header: '95% range', hideOnMobile: true, sortValue: (e) => (e.ci ? e.ci[1] - e.ci[0] : 999), cell: (e) => (e.ci ? <span className="tabular text-[13px] text-ink-2">{pct(e.ci[0], 0)}–{pct(e.ci[1], 0)}</span> : <span className="text-ink-3">–</span>) },
    { key: 'knows', header: 'Knows your brand', sortValue: (e) => (e.knowsBrand == null ? -1 : e.knowsBrand ? 1 : 0), cell: (e) => <YesNo value={e.knowsBrand} unknown="Not asked" /> },
    { key: 'errors', header: 'Errors', align: 'right', hideOnMobile: true, sortValue: (e) => e.errors, cell: (e) => (e.errors ? <span className="text-warning-text">{e.errors}</span> : <span className="text-ink-3">0</span>) },
  ];
  return (
    <>
      <DataTable rows={engines} columns={columns} rowKey={(e) => e.key} dense pageSize={20} />
      <p className="mt-2 text-xs text-ink-3">“Knows your brand” asks each assistant directly what it knows about you — a brand it does not know is rarely recommended. The 95% range is where the true rate most likely lies; it narrows as answers add up.</p>
    </>
  );
}

function Gaps({ d }: { d: AiData }) {
  const { can, tool } = useSitePage();
  const topicOf = (prompt: string) => {
    const q = d.report?.questions.find((x) => x.prompt === prompt);
    const p = d.prompts.find((x) => x.prompt === prompt);
    return (q?.topic || p?.keyword || p?.topic || prompt).toLowerCase().slice(0, 80);
  };
  const kindOf = (prompt: string) => d.report?.questions.find((x) => x.prompt === prompt)?.kind ?? d.prompts.find((x) => x.prompt === prompt)?.kind ?? '';
  return (
    <section>
      <SectionHeading title="Questions you lose" description="Assistants answer these without you. The page that wins them answers the question directly and is cited by the sources listed." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {d.latest!.gaps.map((g) => (
          <Card key={g.prompt} className="flex flex-col p-4">
            <p className="text-sm font-semibold leading-snug text-ink">{g.prompt}</p>
            {(g.volume || g.stage) && (
              <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-ink-3">
                {g.stage && <Kind>{titleCase(g.stage)}</Kind>}
                {g.volume ? <span>{compactNumber(g.volume)} AI searches / month</span> : null}
              </p>
            )}
            <dl className="mt-3 space-y-2 text-xs">
              <div>
                <dt className="mb-1 text-ink-3">Named instead</dt>
                <dd>
                  <Chips items={g.competitors} max={5} empty="No brand named" />
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-ink-3">Sources the answers rely on</dt>
                <dd>
                  <Chips items={g.sources} max={5} />
                </dd>
              </div>
              {g.fanout.length > 0 && (
                <div>
                  <dt className="mb-1 text-ink-3">What AI searched to answer it</dt>
                  <dd className="text-ink-2">{g.fanout.slice(0, 2).join(' · ')}</dd>
                </div>
              )}
            </dl>
            {can('member') && (
              <div className="mt-auto flex justify-end pt-3">
                <ButtonLink to={tool('keyword', { keyword: topicOf(g.prompt), pageType: kindOf(g.prompt) === 'compare' ? 'Guide' : 'Service Page' })} size="sm" variant="secondary">
                  Write the page
                </ButtonLink>
              </div>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

type Source = NonNullable<AiData['latest']>['sources'][number];
function SourcesTable({ sources }: { sources: Source[] }) {
  const columns: Column<Source>[] = [
    {
      key: 'domain',
      header: 'Domain',
      sortValue: (s) => s.domain,
      cell: (s) => (
        <a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink hover:text-accent-text">
          <Globe className="size-3.5 text-ink-3" aria-hidden />
          {s.domain}
          <ExternalIcon className="size-3 text-ink-3" aria-hidden />
        </a>
      ),
    },
    { key: 'kind', header: 'Kind', sortValue: (s) => s.kind, cell: (s) => (s.kind ? <Kind>{titleCase(s.kind)}</Kind> : '–') },
    { key: 'citations', header: 'Citations', align: 'right', sortValue: (s) => s.citations, cell: (s) => s.citations },
    { key: 'engines', header: 'Cited by', hideOnMobile: true, sortValue: (s) => s.engines.length, cell: (s) => <span className="text-[13px] text-ink-2">{s.engines.join(', ') || '–'}</span> },
    { key: 'topics', header: 'For questions about', hideOnMobile: true, cell: (s) => <Chips items={s.topics} max={2} /> },
  ];
  return <DataTable rows={sources} columns={columns} rowKey={(s) => s.domain} initialSort={{ key: 'citations', dir: 'desc' }} dense pageSize={10} empty="No sources cited in the latest run." />;
}

function MarketView({ market, domain }: { market: NonNullable<NonNullable<AiData['latest']>['market']>; domain: string }) {
  const items = [...market.top.filter((t) => t.domain !== domain).map((t) => ({ label: t.domain, value: t.mentions, sub: '' })), ...(market.you ? [{ label: domain, value: market.you.mentions, sub: 'you' }] : [])].sort((a, b) => b.value - a.value);
  return (
    <Panel title="Market view" description={`AI mentions for “${market.keyword}” across the market · ${fmtDate(market.checkedAt)}`}>
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        <div>
          <div className="text-xs text-ink-3">Mentions in AI answers</div>
          <div className="font-semibold text-ink">{compactNumber(market.totalMentions)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-3">AI search volume</div>
          <div className="font-semibold text-ink">{compactNumber(market.aiSearchVolume)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-3">You</div>
          <div className="font-semibold text-ink">{market.you ? `${compactNumber(market.you.mentions)} mentions` : <Badge>Not mentioned</Badge>}</div>
        </div>
      </div>
      {items.length > 0 && <ShareBars items={items} highlight={domain} valueFormat={(v) => compactNumber(v)} />}
      <p className="mt-3 text-xs text-ink-3">Refreshed monthly from AI answer data across the market, not only your questions.</p>
    </Panel>
  );
}
