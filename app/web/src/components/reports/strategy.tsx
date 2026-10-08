import { BarChart3, Bot, CircleHelp, Flag, Globe, Layers, ListTree, MousePointerClick, PenLine, Search, Swords, Target, TrendingUp, Zap } from 'lucide-react';
import { asDifficulty, asPlanChoice, PLAN_CHOICE_LABEL, type ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { CountUp, HeroNextStep, HeroStat, IconTile, InsightItem, Stagger } from '@/components/insight';
import { KeyValue } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { ShareBars } from '@/components/charts';
import { DifficultyBadge, PlanBadge } from '@/components/site/keyword';
import { Block, Bullets, Chips, Facts, has, LedgerCard, n, num, obj, objs, SectionTitle, str, strs, usd, type P } from './kit';
import { isCountry, keywordPrefill } from './meta';
import { KdMeter, PositionPill, ReportHero, VolumeBar } from './visuals';

function WriteLink({ keyword, pageType, country, siteId, label = 'Write', primary }: { keyword: string; pageType?: unknown; country?: unknown; siteId: string | null; label?: string; primary?: boolean }) {
  const { org, can } = useOrgCtx();
  if (!keyword || !can('member')) return null;
  return (
    <ButtonLink
      to={paths.tool(org.id, 'keyword', { siteId, prefill: keywordPrefill({ keyword, pageType, country }) })}
      variant={primary ? 'primary' : 'secondary'}
      size="sm"
      icon={<PenLine className="size-3.5" />}
      aria-label={`${label}: ${keyword}`}
    >
      {label}
    </ButtonLink>
  );
}

/** Opens the "New keyword ladder" flow with the keyword: the pages from easy to hard that make the website rank for it. */
function RankLink({ keyword, country, siteId, label = 'Rank for this keyword', primary }: { keyword: string; country?: unknown; siteId: string | null; label?: string; primary?: boolean }) {
  const { org, can } = useOrgCtx();
  if (!keyword || !siteId || !can('member')) return null;
  return (
    <ButtonLink
      to={paths.newLadder(org.id, siteId, { keyword, ...(isCountry(country) ? { country } : {}) })}
      variant={primary ? 'primary' : 'secondary'}
      size="sm"
      icon={<TrendingUp className="size-3.5" />}
      aria-label={`Rank for this keyword: ${keyword}`}
      title="Plan a keyword ladder: easy pages first, then the page for this keyword"
    >
      {label}
    </ButtonLink>
  );
}

const DIFF_RANK: Record<string, number> = { easy: 0, reachable: 1, hard: 2, very_hard: 3, not_realistic: 4 };

/** The keyword's difficulty for the website and its plan ("Easy for your site · Direct plan · 2-4 months"), when the research knew the website. */
function ForYou({ k, compact }: { k: P; compact?: boolean }) {
  const d = asDifficulty(k.difficulty_for_you);
  if (!d) return null;
  const plan = asPlanChoice(k.plan_type);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={str(k.label) || undefined}>
      <DifficultyBadge difficulty={d} compact={compact} />
      {compact ? (
        plan && plan !== 'none' && <span className="whitespace-nowrap text-xs text-ink-3">{`${PLAN_CHOICE_LABEL[plan]}${str(k.months) ? ` · ${str(k.months).replace('-', '–')} mo` : ''}`}</span>
      ) : (
        <PlanBadge plan={plan} months={str(k.months)} />
      )}
    </span>
  );
}

/** "Write" and "Rank for this keyword" side by side. */
function KeywordActions({ keyword, pageType, country, siteId, compact }: { keyword: string; pageType?: unknown; country?: unknown; siteId: string | null; compact?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <WriteLink keyword={keyword} pageType={pageType} country={country} siteId={siteId} label={compact ? 'Write' : 'Write a page'} />
      <RankLink keyword={keyword} country={country} siteId={siteId} label={compact ? 'Rank for it' : 'Rank for this keyword'} />
    </span>
  );
}

export function KeywordStrategyReport({ report }: { report: ReportDetail }) {
  const { can } = useOrgCtx();
  const p = report.payload;
  const summary = obj(p.summary);
  const start = obj(p.start_with);
  const priority = objs(p.priority);
  const quick = objs(p.quick_wins);
  const plan = objs(p.content_plan);
  const questions = strs(p.questions);
  const gaps = objs(p.competitor_gaps);
  const ai = obj(p.ai_demand);
  const followUps = obj(p.follow_ups);
  const failures = arr2str(p.research_failures);
  const country = str(p.country);
  const siteId = report.siteId;
  const reach = num(obj(p.reach).reach);
  // v4.8: with a website every keyword carries its difficulty for that website (null without one)
  const hasForYou = [start, ...priority, ...quick, ...gaps].some((k) => asDifficulty(k.difficulty_for_you));
  const maxVolume = Math.max(0, ...[...priority, ...gaps].map((k) => num(k.volume) ?? 0));

  const kwColumns: Column<P>[] = [
    {
      key: 'keyword',
      header: 'Keyword',
      sortValue: (r) => str(r.keyword),
      cell: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-ink">{str(r.keyword)}</p>
          <p className="text-xs text-ink-3">
            {[str(r.page_type), str(r.intent), str(r.topic)].filter(Boolean).join(' · ')}
          </p>
        </div>
      ),
    },
    ...(hasForYou
      ? [
          {
            key: 'for_you',
            header: 'For your site',
            sortValue: (r: P) => DIFF_RANK[str(r.difficulty_for_you)] ?? 9,
            cell: (r: P) => (
              <span className="block min-w-[9rem]">
                <ForYou k={r} compact />
              </span>
            ),
          } satisfies Column<P>,
        ]
      : []),
    { key: 'volume', header: 'Volume', align: 'right', sortValue: (r) => num(r.volume), cell: (r) => <VolumeBar value={num(r.volume)} max={maxVolume} text={n(r.volume)} /> },
    { key: 'kd', header: 'KD', align: 'right', sortValue: (r) => num(r.kd), cell: (r) => <KdMeter value={num(r.kd)} /> },
    { key: 'cpc', header: 'CPC', align: 'right', sortValue: (r) => num(r.cpc), cell: (r) => (num(r.cpc) == null ? '–' : usd(r.cpc)), hideOnMobile: true },
    { key: 'traffic_potential', header: 'Traffic potential', align: 'right', sortValue: (r) => num(r.traffic_potential), cell: (r) => n(r.traffic_potential), hideOnMobile: true },
    { key: 'opportunity', header: 'Opportunity', align: 'right', sortValue: (r) => num(r.opportunity), cell: (r) => <span className="font-semibold text-accent-text tabular">{n(r.opportunity)}</span> },
    { key: 'ai_search_volume', header: 'AI volume', align: 'right', sortValue: (r) => num(r.ai_search_volume), cell: (r) => n(r.ai_search_volume), hideOnMobile: true },
    { key: 'go', header: <span className="sr-only">Write or rank</span>, align: 'right', cell: (r) => <span className="block min-w-[11rem]"><KeywordActions keyword={str(r.keyword)} pageType={r.page_type} country={country} siteId={siteId} compact /></span> },
  ];

  const tiers = ['Now', 'Next', 'Later'].map((t) => ({ tier: t, items: plan.filter((c) => str(c.tier).toLowerCase() === t.toLowerCase()) }));
  const otherTier = plan.filter((c) => !['now', 'next', 'later'].includes(str(c.tier).toLowerCase()));
  if (otherTier.length) tiers.push({ tier: 'Other', items: otherTier });
  const live = obj(start.live);
  const aiTop = objs(ai.top);

  const reachText =
    reach != null
      ? `“For your site”: your website already wins searches up to difficulty ${reach}. Easy = up to ${reach + 5} (or you already rank in the top 20), reachable = up to ${reach + 20}, hard = up to ${reach + 40}, very hard above.`
      : null;
  const startKw = str(start.keyword);

  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={country || undefined}
        title={startKw ? <>Start with “{startKw}”</> : `${n(summary.relevant)} keywords fit your business`}
        description={`${n(summary.keywords_researched)} keywords researched, ${n(summary.relevant)} relevant to your business in ${n(summary.clusters)} topic clusters${priority.length ? `; ${priority.length} priority keywords and ${quick.length} quick wins below` : ''}.`}
        aside={
          startKw && can('member') ? (
            <HeroNextStep
              icon={<Flag />}
              eyebrow="Next step · the best first page"
              title={startKw}
              actions={
                <>
                  <WriteLink keyword={startKw} pageType={start.page_type} country={country} siteId={siteId} label="Write this page" primary />
                  <RankLink keyword={startKw} country={country} siteId={siteId} />
                </>
              }
            />
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="Keywords researched" value={num(summary.keywords_researched) != null ? <CountUp value={num(summary.keywords_researched)!} /> : '–'} hint="From several sources" />
            <HeroStat label="Reviewed by AI for relevance" value={num(summary.ai_reviewed) != null ? <CountUp value={num(summary.ai_reviewed)!} /> : '–'} />
            <HeroStat label="Relevant to your business" value={num(summary.relevant) != null ? <CountUp value={num(summary.relevant)!} /> : '–'} />
            <HeroStat label="Topic clusters" value={num(summary.clusters) != null ? <CountUp value={num(summary.clusters)!} /> : '–'} hint={plan.length ? `${plan.length} pages in the content plan` : undefined} />
          </>
        }
      />
      {strs(summary.competitors).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <IconTile size="xs">
            <Swords />
          </IconTile>
          Competitors analysed: <Chips items={strs(summary.competitors)} />
        </div>
      )}

      {(followUps.content === true || followUps.audit === true) && (
        <Callout tone="info" title="More reports are on the way">
          {followUps.content === true && <>The keyword report{start.keyword ? <> for “{str(start.keyword)}”</> : ''} follows as its own report. </>}
          {followUps.audit === true && <>The website audit you asked for follows separately.</>}
        </Callout>
      )}
      {failures.length > 0 && (
        <Callout tone="warning" title="Some research sources did not answer">
          <Bullets items={failures} />
        </Callout>
      )}

      {has(start) && (
        <Card className="overflow-hidden border-accent/40">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <IconTile tone="solid" size="md">
                  <Flag />
                </IconTile>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-accent-text">Start with</p>
                  <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">{str(start.keyword)}</h2>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <ForYou k={start} />
                {str(start.page_type) && <Badge tone="accent">{str(start.page_type)}</Badge>}
                {str(start.intent) && <Badge>{str(start.intent)}</Badge>}
                {str(start.topic) && <Badge>{str(start.topic)}</Badge>}
              </div>
              {str(start.why) && <p className="mt-3 text-sm leading-relaxed text-ink-2">{str(start.why).replace(/(\d+\.\d{3,})/g, (m) => Number(m).toFixed(2))}</p>}
              <Facts
                className="mt-4"
                items={[
                  { icon: <Search />, label: 'Searches / month', value: n(start.volume) },
                  { icon: <BarChart3 />, label: 'Difficulty', value: num(start.kd) != null ? String(num(start.kd)) : '–' },
                  { icon: <MousePointerClick />, label: 'Cost per click', value: num(start.cpc) != null ? usd(start.cpc) : '–' },
                  { icon: <TrendingUp />, label: 'Traffic potential', value: n(start.traffic_potential) },
                ]}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <WriteLink keyword={str(start.keyword)} pageType={start.page_type} country={country} siteId={siteId} label="Write this page" primary />
                <RankLink keyword={str(start.keyword)} country={country} siteId={siteId} />
              </div>
            </div>
            {has(live) && (
              <div className="rounded-xl bg-surface-2/60 p-4 text-sm">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <IconTile size="xs">
                    <Globe />
                  </IconTile>
                  Live on Google now
                </p>
                <KeyValue
                  items={[
                    { label: 'Your position', value: num(live.your_position) != null ? <PositionPill value={num(live.your_position)} text={`#${num(live.your_position)}`} /> : 'Not in the top results' },
                    { label: 'AI Overview', value: live.ai_overview === true ? 'Shown' : live.ai_overview === false ? 'Not shown' : '–' },
                  ]}
                />
                {strs(live.top_domains).length > 0 && (
                  <>
                    <SectionTitle className="mt-4">Ranking today</SectionTitle>
                    <ol className="space-y-1 text-[13px] text-ink-2">
                      {strs(live.top_domains).map((d, i) => (
                        <li key={d} className="flex items-center gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold text-ink-2 tabular ring-1 ring-line">{i + 1}</span>
                          <span className="min-w-0 truncate">{d}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
                {strs(live.paa).length > 0 && (
                  <>
                    <SectionTitle className="mt-4">People also ask</SectionTitle>
                    <Bullets items={strs(live.paa)} />
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {priority.length > 0 && (
        <Block title="Priority keywords" description="The best opportunities, checked live on Google" icon={<Target />} info={reachText ?? undefined}>
          <DataTable rows={priority} columns={kwColumns} rowKey={(r, i) => `${str(r.keyword)}-${i}`} initialSort={{ key: 'opportunity', dir: 'desc' }} pageSize={15} />
        </Block>
      )}

      {reachText && !priority.length && <p className="text-[13px] leading-snug text-ink-3">{reachText}</p>}

      {quick.length > 0 && (
        <Block title="Quick wins" description="Low difficulty with real demand: the fastest pages to rank" icon={<Zap />} flush>
          <ul className="divide-y divide-line">
            {quick.map((q, i) => (
              <InsightItem
                key={i}
                icon={<Zap />}
                title={str(q.keyword)}
                description={`${n(q.volume)} searches · KD ${num(q.kd) ?? '–'} · ${str(q.page_type) || 'page'}`}
                meta={asDifficulty(q.difficulty_for_you) ? <ForYou k={q} compact /> : undefined}
                action={<KeywordActions keyword={str(q.keyword)} pageType={q.page_type} country={country} siteId={siteId} />}
                actionPosition="side"
              />
            ))}
          </ul>
        </Block>
      )}

      {plan.length > 0 && (
        <Block title="Content plan" description="Topic clusters in the order to write them: one page per cluster, supporting keywords as sections" icon={<ListTree />}>
          <div className="grid gap-4 lg:grid-cols-3">
            {tiers
              .filter((t) => t.items.length)
              .map((t) => (
                <div key={t.tier} className="min-w-0 rounded-xl bg-surface-2/50 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <IconTile tone={t.tier === 'Now' ? 'solid' : t.tier === 'Next' ? 'blue' : 'neutral'} size="xs">
                      <Layers />
                    </IconTile>
                    <Badge tone={t.tier === 'Now' ? 'accent' : 'neutral'}>{t.tier}</Badge>
                    <span className="text-xs text-ink-3">{t.items.length} pages</span>
                  </div>
                  <ul className="space-y-2.5">
                    {t.items.map((c, i) => (
                      <li key={i} className="rounded-lg border border-line bg-surface p-3 shadow-card transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-raised">
                        <p className="text-xs text-ink-3">{str(c.topic)}</p>
                        <p className="mt-0.5 font-medium text-ink">{str(c.primary_keyword)}</p>
                        <p className="mt-1 text-xs text-ink-3">
                          {str(c.page_type)} · {num(c.keyword_count) ?? '–'} keywords · {n(c.total_volume)} searches
                        </p>
                        {asDifficulty(c.difficulty_for_you) && (
                          <div className="mt-1.5">
                            <ForYou k={c} compact />
                          </div>
                        )}
                        {strs(c.supporting).length > 0 && <Chips items={strs(c.supporting)} max={4} className="mt-2" />}
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <WriteLink keyword={str(c.primary_keyword)} pageType={c.page_type} country={country} siteId={siteId} label="Write a page" />
                          <RankLink keyword={str(c.primary_keyword)} country={country} siteId={siteId} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </Block>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {questions.length > 0 && (
          <Block title="Questions people ask" description="Good blog posts, FAQ sections and AI-answer targets" icon={<CircleHelp />} flush>
            <ul className="divide-y divide-line">
              {questions.map((q) => (
                <InsightItem key={q} icon={<CircleHelp />} title={q} action={<WriteLink keyword={q} pageType="Blog Post" country={country} siteId={siteId} />} actionPosition="side" />
              ))}
            </ul>
          </Block>
        )}
        {(aiTop.length > 0 || str(ai.error)) && (
          <Block title="AI search demand" description="How often people ask AI assistants about these topics (monthly)" icon={<Bot />}>
            {aiTop.length > 0 ? (
              <ShareBars
                items={aiTop.map((t) => ({ label: str(t.keyword), value: num(t.ai_search_volume) ?? 0, sub: num(t.google_volume) != null ? `· ${n(t.google_volume)} on Google` : undefined }))}
                valueFormat={(v) => n(v)}
              />
            ) : (
              <p className="text-sm text-ink-3">AI demand data was not available: {str(ai.error)}</p>
            )}
          </Block>
        )}
      </div>

      {gaps.length > 0 && (
        <Block title="Competitor gaps" description="Keywords your competitors rank for and you do not" icon={<Swords />}>
          <DataTable rows={gaps} columns={kwColumns.filter((c) => c.key !== 'ai_search_volume')} rowKey={(r, i) => `${str(r.keyword)}-${i}`} initialSort={{ key: 'volume', dir: 'desc' }} pageSize={10} />
        </Block>
      )}

      <LedgerCard ledger={p.run_ledger} />
    </Stagger>
  );
}

function arr2str(v: unknown): string[] {
  return (Array.isArray(v) ? v : []).map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? str((x as P).error) || str((x as P).source) || JSON.stringify(x) : '')).filter(Boolean);
}
