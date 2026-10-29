import { linkSummary } from './linkBuilder';
import {
  formatPercent,
  wilsonRange,
  AI_MIN_RATE_SAMPLES,
  DRAFT_BY_HAND,
  NO_RERUN_NEEDED,
  MODE_IDS,
  PAGE_TYPE_VALUES,
  type AiData,
  type AlertsData,
  type BacklinksData,
  type ContentData,
  type ContentItem,
  type EngineAction,
  type ModeId,
  type OverviewData,
  type Priority,
  type RankingsData,
  type Recommendation,
  type RecommendationAction,
  type RecommendationCategory,
  type SearchData,
  type SiteSettingsData,
  type TechnicalData,
  urlOnHost,
  RECOMMENDATIONS_MAX_AGE_DAYS,
  fitTopic,
  normKeyword,
  impactFromAuditWeight,
  impactFromClicks,
  impactFromPoints,
  queueOrder,
  ruleScoreFor,
  scoreOf,
  type ScoreInput,
  autopilotRuns,
  redirectTaskKey,
  type SiteTask,
} from '@seo/shared';
import type { OrgRow, SiteRow } from '../db/schema';
import { aiData, alertsData, backlinksData, contentData, ga4Now, gscNow, previousOfType, rankingsData, searchData, settingsData, technicalData } from './data';
import { latestReport, reportsList } from './runs';

// Next steps for a website, from everything stored about it: setup gaps, Search Console opportunities, open audit issues, AI
// answers lost to competitors, links to reclaim, pages to publish, ladder rungs to write, plus the actions the SEO engine itself
// recommended in its latest weekly reports. Every item says why (evidence) and carries the one action that does it.

export interface SiteBundle {
  search: SearchData;
  rankings: RankingsData;
  content: ContentData;
  technical: TechnicalData;
  ai: AiData;
  backlinks: BacklinksData;
  alerts: AlertsData;
  settings: SiteSettingsData;
  rankNext: EngineAction | null;
  /** the engine tracks the site but its weekly reports go to another address (an older setup): they never reach this app */
  reportsElsewhere: boolean;
  /** v4.13 Link Builder: pitches waiting, a mailbox, replies waiting, listings competitors have */
  links?: { drafted: number; mailbox: boolean; repliesWaiting: number; listingsMissing: { name: string; competitors: string[] }[] };
  /** keyword-first: when the website's latest keyword research arrived (null: none yet) */
  researchAt?: string | null;
}

export async function loadBundle(org: OrgRow, site: SiteRow): Promise<SiteBundle> {
  const [search, rankings, content, technical, ai, backlinks, alerts, settings, rank, links, research] = await Promise.all([
    searchData(org, site),
    rankingsData(site),
    contentData(org, site),
    technicalData(org, site),
    aiData(org, site, { answers: false }),   // A11 (2026-10-23): the answers are the AI page's alone
    backlinksData(org, site),
    alertsData(site),
    settingsData(org, site),
    latestReport(org.id, site.id, ['rank_tracker']),
    linkSummary(org, site),
    latestReport(org.id, site.id, ['keyword_strategy']).catch(() => null),
  ]);
  const reportsElsewhere = settings.tracking.tracked && settings.tracking.status === 'active' && !settings.tracking.reportsToThisApp;
  let rankNext: EngineAction | null = null;
  const ns = rank?.payload.next_step as Record<string, unknown> | undefined;
  if (rank && ns && (ns.text || ns.action)) {
    rankNext = {
      source: 'rank_tracker',
      priority: 1,
      type: String(ns.action ?? 'next_rung'),
      action: String(ns.text ?? ns.action),
      why: `Ladder "${String(rank.payload.head_keyword ?? '')}": the tracker's recommended next step.`,
      keyword: (rank.payload.api_body as Record<string, unknown> | undefined)?.keyword ? String((rank.payload.api_body as Record<string, unknown>).keyword) : null,
      url: null,
      receivedAt: rank.report.receivedAt,
      apiBody: (rank.payload.api_body as Record<string, unknown>) ?? null,
    };
  }
  return { search, rankings, content, technical, ai, backlinks, alerts, settings, rankNext, reportsElsewhere, links, researchAt: research?.report.receivedAt ?? null };
}

const PAGE_TYPES = new Set<string>(PAGE_TYPE_VALUES);

/** An n8n API body (snake_case) -> the app's tool link (mode + camelCase prefill). */
export function actionFromApiBody(body: Record<string, unknown> | null, label: string): RecommendationAction | undefined {
  if (!body) return undefined;
  let mode = String(body.mode ?? 'keyword') as ModeId;
  if (mode === ('check' as ModeId)) mode = 'verdict';
  if (!MODE_IDS.includes(mode)) return undefined;
  const prefill: Record<string, unknown> = {};
  if (body.keyword) prefill.keyword = String(body.keyword);
  if (body.country) prefill.country = String(body.country);
  if (body.page_type) {
    const pt = String(body.page_type);
    prefill.pageType = PAGE_TYPES.has(pt) ? pt : /pillar|hub/i.test(pt) ? 'Pillar Page' : /local/i.test(pt) ? 'Local Page' : /blog/i.test(pt) ? 'Blog Post' : /guide/i.test(pt) ? 'Guide' : 'Service Page';
  }
  if (body.existing_page_url) prefill.existingPageUrl = String(body.existing_page_url);
  // a ladder page keeps its ladder (links to the top page and a sibling; the ladder marks it written)
  if (body.ladder_id && body.ladder_rung != null) prefill.ladder = { id: String(body.ladder_id), rung: Number(body.ladder_rung) || 0, head: String(body.ladder_head ?? ''), pageNo: Number(body.ladder_page_no) || 0 };
  if (body.published_url) prefill.publishedUrl = String(body.published_url);
  if (Array.isArray(body.receive)) {
    prefill.receiveReport = body.receive.some((r) => /report/i.test(String(r)));
    prefill.receiveContent = body.receive.some((r) => /content/i.test(String(r)));
  }
  return { label, mode, prefill };
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const CAT_RANK: Record<RecommendationCategory, number> = { setup: 0, technical: 1, search: 2, content: 3, rankings: 4, ai: 5, backlinks: 6 };
const fmtPos = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(1));

/** REP 3.3 (benchmark pass 2026-10-14): what the Search Console CTR benchmarks say a query could earn at a better position.
 * These are the public click-through benchmarks, not this site's own numbers, so everything derived from them is `modelled`. */
const CTR_AT = { top3: 0.27, page1: 0.1, healthy: 0.05 };
/** 28 Search Console days scaled to a month, so every impact in the queue is "clicks a month". */
const TO_MONTH = 30 / 28;

/**
 * `tasks`: the website's steps on its own site (services/siteTasks.ts). Given, a step that is done or skipped is not recommended again,
 * the open ones carry their key (the "I've done it, check now" button) and a blocked AI search crawler is recommended too.
 */
export function recommend(site: SiteRow, x: SiteBundle, tasks?: readonly SiteTask[]): Recommendation[] {
  const taskOpen = (key: string) => !tasks || tasks.some((t) => t.key === key && t.state === 'todo');
  const out: Recommendation[] = [];
  // REP 3.3: every item carries what it is worth. Where the caller measured a quantity it passes one; where it did not, the visible
  // rule table in `queue.ts` answers for the whole family; where neither can, the item says "not ranked" with the reason and drops
  // to the bottom band instead of being given a number nobody can defend.
  const add = (r: Recommendation, score?: ScoreInput) => {
    if (out.some((o) => o.id === r.id)) return;
    const input = score ?? ruleScoreFor(r.id) ?? { impact: null, confidence: 'rule' as const, effort: 'session' as const, basis: '', reason: 'nothing measured for it yet' };
    out.push({ ...r, score: scoreOf(input) });
  };
  const tracked = site.trackingStatus === 'active' || x.settings.tracking.tracked;
  // keyword-first (§5.3): a search on the topic of one of the website's ladders can join that ladder ("Add to my ladder") instead of
  // being a page of its own: the ladder whose head and pages carry at least half of the keyword's own words, and none of its pages already is it
  const ladderFor = (kw: string): RecommendationAction | undefined => {
    let best: { l: (typeof x.rankings.ladders)[number]; share: number } | null = null;
    for (const l of x.rankings.ladders) {
      if (l.rungs.some((r) => normKeyword(r.keyword) === normKeyword(kw)) || normKeyword(l.headKeyword) === normKeyword(kw)) return undefined;
      const t = fitTopic(kw, [l.headKeyword, ...l.rungs.map((r) => r.keyword)], { topic_min_words: 1 });
      if (t.ok && t.share != null && t.share >= 0.5 && (!best || t.share > best.share)) best = { l, share: t.share };
    }
    return best ? { label: 'Add to my ladder', addToLadder: { ladderId: best.l.ladderId, head: best.l.headKeyword, keyword: kw } } : undefined;
  };

  // ---------- setup ----------
  if (!tracked)
    add({ id: 'setup:tracking', category: 'setup', priority: 'high', title: 'Start weekly tracking', detail: 'Weekly Search Console, GA4, Google Trends and live rank checks with actions, plus AI-visibility and backlink monitors. Everything on this dashboard fills from it.', action: { label: 'Set up tracking', page: 'settings/tracking' } });
  if (x.reportsElsewhere)
    add({ id: 'setup:delivery', category: 'setup', priority: 'high', title: 'Send the weekly reports to this dashboard', detail: 'The SEO engine already tracks this site, but its weekly reports still go to an address set up before this app. Save the tracking settings once and every weekly report, alert and page lands here.', action: { label: 'Open tracking settings', page: 'settings/tracking' } });
  const snap = x.search.snapshot;
  // the newer of the latest weekly report and the live check on Verification & Google: a site connected after its first report is not asked again
  if (tracked && !gscNow(snap, x.settings.tracking).connected)
    add({ id: 'setup:gsc', category: 'setup', priority: 'high', title: 'Connect Google Search Console', detail: 'Without Search Console the tracker cannot see clicks, impressions, queries or index status. Add the service account as a user of your property.', evidence: snap?.gsc.error ?? undefined, action: { label: 'Connect', page: 'settings/verification' } });
  // 2026-10-28: the newer of the weekly report and the app's own check (shared ga4ConnectionState), as Search Console above: a property chosen
  // on Verification & Google is connected before the next report reads it (devaicon.com was told to connect GA4 it had connected)
  if (tracked && (snap || x.settings.tracking.ga4LiveCheck) && !ga4Now(snap, x.settings.tracking).connected)
    add({ id: 'setup:ga4', category: 'setup', priority: 'medium', title: 'Connect Google Analytics 4', detail: 'GA4 adds organic sessions, engagement and key events (leads, sales) to the weekly report.', action: { label: 'Connect GA4', page: 'settings/verification' } });
  if (x.settings.readiness.score < 70)
    add({ id: 'setup:profile', category: 'setup', priority: x.settings.readiness.score < 40 ? 'high' : 'medium', title: 'Complete the E-E-A-T profile', detail: `Every page gets a byline, an author box, Person / LocalBusiness schema and an expert reviewer from it. These are strong trust signals for Google and AI answers.${x.ai.growth ? ' The AI outreach drafts and AI answer pages use it too: until it is complete they carry [brackets] for you to fill in.' : ''}`, evidence: `${x.settings.readiness.score}% complete · missing: ${x.settings.readiness.missing.slice(0, 4).join(', ')}`, action: { label: 'Complete the profile', page: 'settings/profile' } });
  // 2026-10-28: what the weekly cycle runs on its own is never offered as a manual first step (shared autopilotRuns, the Pipeline's rule):
  // a client ran the first audit by hand three hours before the autopilot's own, because this list said "Run the first technical audit"
  const auto = autopilotRuns({ verified: !!site.verifiedAt, trackingStatus: site.trackingStatus }, x.settings.monitors);
  // ...it is listed as scheduled instead, at the bottom: where to see when it runs, and "Run it now" for anyone who needs it sooner (or if the
  // cycle does not deliver: the item stays until the first result lands)
  const scheduled = (id: string, category: RecommendationCategory, what: string, mode: ModeId, where: string) =>
    add(
      { id, category, priority: 'low', title: `Your first ${what} is scheduled`, detail: `Your autopilot runs it on its own in your weekly cycle and the result appears under ${where}. Run it now only if you need it sooner.`, action: { label: 'See when it runs', page: 'pipeline' }, secondary: { label: 'Run it now', mode } },
      { impact: null, confidence: 'rule', effort: 'minutes', basis: '', reason: 'your autopilot runs it on its own' },
    );
  if (!x.technical.audits.length && auto.audit) scheduled('auto:audit', 'technical', 'technical audit', 'audit', 'Technical health');
  if (!x.ai.runs.length && auto.aiVisibility) scheduled('auto:ai', 'ai', 'AI visibility check', 'ai_visibility', 'AI visibility');
  if (!x.backlinks.snapshots.length && auto.backlinks) scheduled('auto:backlinks', 'backlinks', 'backlink check', 'backlinks', 'Backlinks');
  if (!x.technical.audits.length && !auto.audit)
    add({ id: 'setup:audit', category: 'technical', priority: 'high', title: 'Run the first technical audit', detail: 'Crawl, probes and scoring with a fix pack (robots.txt, llms.txt, redirects, schema, internal links). Later audits show what changed.', action: { label: 'Run audit', mode: 'audit', prefill: { reportType: 'site_audit' } } });
  if (!x.ai.runs.length && !auto.aiVisibility)
    add({ id: 'setup:ai', category: 'ai', priority: 'medium', title: 'Take an AI-visibility baseline', detail: 'See whether ChatGPT, Perplexity, Gemini, Claude and Google AI name your company for the questions your buyers ask.', action: { label: 'Check AI visibility', mode: 'ai_visibility' } });
  // v4.12 (AI_GROWTH_SPEC.md): the AI growth loop's two owner steps, the IndexNow key file, and the outreach drafts to send
  const g = x.ai.growth;
  if (g && !g.submitted.indexnow.verified && g.submitted.indexnow.key && taskOpen('indexnow'))
    add({ id: 'ai:indexnow', taskKey: 'indexnow', category: 'ai', priority: 'medium', title: 'Add one small file so new pages reach Bing the same week', detail: `Put ${g.submitted.indexnow.key}.txt (it contains only that key) at the root of ${site.domain}. From then on the weekly AI growth run sends every new or updated page to Bing (and Copilot), Yandex, Naver and the other IndexNow engines.`, evidence: g.submitted.indexnow.keyUrl, action: { label: 'Get the file', page: 'ai' }, guideVars: { indexNowKey: g.submitted.indexnow.key, indexNowFile: `${g.submitted.indexnow.key}.txt`, indexNowUrl: g.submitted.indexnow.keyUrl } });
  // site tasks: an AI search crawler robots.txt turns away (the engine's weekly reading, or a check of ours since)
  const crawlers = tasks?.find((t) => t.key === 'ai_crawlers' && t.state === 'todo');
  if (crawlers)
    add({ id: 'ai:crawlers', taskKey: 'ai_crawlers', category: 'ai', priority: crawlers.severity === 'warning' ? 'high' : 'medium', title: crawlers.title, detail: crawlers.detail, evidence: crawlers.values.slice(1).map((v) => `${v.label.replace(/^Rule that blocks /, '')}: ${v.value}`).join(' · '), action: { label: 'See crawler access', page: 'ai' } });
  const ready = g ? g.earned.filter((e) => e.drafted && e.kind !== 'competitor' && e.mentionsUs !== true && (!e.status || e.status === 'new')) : [];
  const readyHosts = [...new Set(ready.map((e) => e.host))];
  if (readyHosts.length)
    add({ id: 'ai:outreach', category: 'ai', priority: 'high', title: `${readyHosts.length} outreach draft${readyHosts.length === 1 ? '' : 's'} ready for pages AI cites`, detail: 'AI answers rely on these articles, lists and threads, and they do not name you yet. Being named there is the strongest way into the answers. Each draft asks to be included (or answers the thread as you). Send it from your own mailbox, then mark it as sent.', evidence: readyHosts.slice(0, 4).join(', '), action: { label: 'Review the drafts', page: 'ai' } });
  // v4.13 Link Builder: pitches to approve, the mailbox they need, replies to answer, listings competitors have
  const L = x.links;
  if (L && L.repliesWaiting)
    add({ id: 'links:replies', category: 'backlinks', priority: 'high', title: `${L.repliesWaiting} link-building repl${L.repliesWaiting === 1 ? 'y' : 'ies'} waiting for your answer`, detail: 'Someone answered your pitch. A suggested answer is ready: edit it and send it in the same thread. A quick answer is what turns a reply into a link.', action: { label: 'Answer', page: 'links' } });
  if (L && L.drafted && !L.mailbox)
    add({ id: 'links:mailbox', category: 'backlinks', priority: 'high', title: 'Connect your mailbox to send the link pitches', detail: `${L.drafted} pitch${L.drafted === 1 ? ' is' : 'es are'} drafted. They go out from your own address (company settings > Mailboxes) after you approve them, never from ours.`, action: { label: 'See the pitches', page: 'links' } });
  else if (L && L.drafted)
    add({ id: 'links:approve', category: 'backlinks', priority: 'high', title: `${L.drafted} link-building pitch${L.drafted === 1 ? '' : 'es'} ready for your approval`, detail: 'Each one is written for one site (a dead link to replace, a list that leaves you out, a mention without a link) with the right page of yours and the right person. Read, edit and approve: they go out from your mailbox, a few a day.', action: { label: 'Review the pitches', page: 'links' } });
  for (const l of (L?.listingsMissing ?? []).slice(0, 2))
    add({ id: `links:listing:${l.name}`, category: 'backlinks', priority: 'medium', title: `Get listed on ${l.name}`, detail: `${l.competitors.join(' and ')} ${l.competitors.length === 1 ? 'is' : 'are'} there and you are not. You add this listing yourself. The submission page and a ready description are on the Link building page.`, action: { label: 'Open the checklist', page: 'links' } });
  if (!x.backlinks.snapshots.length && !auto.backlinks)
    add({ id: 'setup:backlinks', category: 'backlinks', priority: 'low', title: 'Check your backlinks', detail: 'Lost and spammy links, a link gap against competitors and outreach drafts for the best prospects.', action: { label: 'Check backlinks', mode: 'backlinks' } });
  if (x.alerts.checkinDue)
    add({ id: 'setup:checkin', category: 'setup', priority: 'medium', title: 'Monthly Search Console check-in', detail: 'Two questions (manual action? security issue?) and the Pages report, the parts of Search Console the API cannot see.', action: { label: 'Do the check-in', mode: 'checkin' } });

  // ---------- search opportunities (latest Search Console period) ----------
  const period = x.search.periods[0];
  const queries = x.search.queries.filter((q) => q.periodEnd === period);
  const striking = queries.filter((q) => q.position >= 4 && q.position <= 20 && q.impressions >= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 6);
  for (const q of striking) {
    const onPage1 = q.position <= 10;
    add({
      id: `search:striking:${q.query}`,
      category: 'search',
      priority: onPage1 && q.impressions >= 100 ? 'high' : 'medium',
      title: onPage1 ? `Move "${q.query}" into the top 3` : `Push "${q.query}" onto page one`,
      detail: q.page ? `It already ranks with ${q.page.replace(/^https?:\/\/(www\.)?/, '')}. Improving that page (depth, intent match, internal links) is the fastest win.` : 'It already earns impressions; a focused page can win clicks.',
      evidence: `position ${fmtPos(q.position)} · ${q.impressions} impressions · ${q.clicks} clicks in the last period`,
      action: { label: q.page ? 'Improve the page' : 'Write the page', mode: 'keyword', prefill: { keyword: q.query, ...(q.page && urlOnHost(q.page, site.domain) ? { existingPageUrl: q.page } : {}), receiveReport: true, receiveContent: true } },
      ...(q.page ? {} : (() => { const a = ladderFor(q.query); return a ? { secondary: a } : {}; })()),
    }, {
      // the impressions and the CTR are this site's own; the CTR it could reach is a published benchmark, so the whole figure is modelled
      impact: impactFromClicks(Math.max(0, (onPage1 ? CTR_AT.top3 : CTR_AT.page1) - q.ctr) * q.impressions * TO_MONTH),
      confidence: 'modelled',
      effort: 'session',
      basis: `${q.impressions} impressions at ${formatPercent(q.ctr, 1, true)} from position ${fmtPos(q.position)} (Search Console, last period), against the ${onPage1 ? 'top-3' : 'page-one'} click-through benchmark`,
    });
  }
  const lowCtr = queries.filter((q) => q.position > 0 && q.position <= 5 && q.impressions >= 100 && q.ctr < 0.02).slice(0, 3);
  for (const q of lowCtr)
    add({
      id: `search:ctr:${q.query}`,
      category: 'search',
      priority: 'medium',
      title: `Rewrite the title and description for "${q.query}"`,
      detail: 'It ranks near the top but few searchers click. A sharper title and meta description that match the intent usually lift CTR.',
      evidence: `position ${fmtPos(q.position)} · CTR ${formatPercent(q.ctr, 1, true)} · ${q.impressions} impressions`,
      action: q.page ? { label: 'Open the page', href: q.page } : undefined,
    }, {
      impact: impactFromClicks(Math.max(0, CTR_AT.healthy - q.ctr) * q.impressions * TO_MONTH),
      confidence: 'modelled',
      effort: 'hour',
      basis: `${q.impressions} impressions at ${formatPercent(q.ctr, 1, true)} from position ${fmtPos(q.position)} (Search Console, last period), against a healthy ${formatPercent(CTR_AT.healthy, 0, true)}`,
    });
  const falling = queries.filter((q) => q.prevClicks >= 5 && q.clicks <= q.prevClicks * 0.5).sort((a, b) => b.prevClicks - b.clicks - (a.prevClicks - a.clicks)).slice(0, 3);
  for (const q of falling)
    add({
      id: `search:drop:${q.query}`,
      category: 'search',
      priority: 'high',
      title: `Recover the clicks lost on "${q.query}"`,
      detail: 'Clicks fell by half or more against the previous period. Check the ranking page for changes, competitors and SERP features.',
      evidence: `${q.prevClicks} to ${q.clicks} clicks, position ${fmtPos(q.prevPosition)} to ${fmtPos(q.position)}`,
      action: { label: 'Refresh the page', mode: 'keyword', prefill: { keyword: q.query, ...(q.page && urlOnHost(q.page, site.domain) ? { existingPageUrl: q.page } : {}) } },
    }, {
      // nothing modelled here: the clicks were earned and then were not
      impact: impactFromClicks(Math.max(0, q.prevClicks - q.clicks) * TO_MONTH),
      confidence: 'measured',
      effort: 'session',
      basis: `${q.prevClicks - q.clicks} clicks a period already lost (Search Console, this period against the last)`,
    });

  // E-QA (2026-10-21): a not-ready draft's button is its report (each bracket to edit), else the Content page
  const draftReport = (kw: string | null | undefined) =>
    [...x.content.generated].filter((r) => typeof r.summary.keyword === 'string' && r.summary.keyword.toLowerCase() === String(kw ?? '').toLowerCase()).sort((p, q) => q.receivedAt.localeCompare(p.receivedAt))[0];
  const draftAction = (kw: string | null | undefined): RecommendationAction => {
    const r = draftReport(kw);
    return r ? { label: 'See what to edit', report: r.id } : { label: 'See what to edit', page: 'content' };
  };

  // ---------- engine actions (weekly reports) ----------
  const engine = [...(snap?.actions ?? []), ...(x.ai.report?.actions ?? []), ...(x.rankNext ? [x.rankNext] : [])];
  for (const a of engine) {
    const fixDraft = a.type === 'fix_draft';   // R111: the engine's action for a page whose last quality round failed
    const cat: RecommendationCategory = a.source === 'ai_visibility' ? 'ai' : a.source === 'rank_tracker' ? 'rankings' : a.type === 'publish' || fixDraft ? 'content' : 'search';
    // never "Report the published URL" for a draft that failed its quality check, and never a fresh (paid) run of it either (E-QA,
    // 2026-10-21): the draft is finished by hand, so the button opens its report, where each bracket and what to do with it is listed
    let action: RecommendationAction | undefined = fixDraft ? draftAction(a.keyword) : actionFromApiBody(a.apiBody, a.source === 'ai_visibility' ? 'Write the answer page' : 'Run it');
    if (!action && a.type === 'publish' && a.keyword) action = { label: 'Report the published URL', mode: 'published', prefill: { keyword: a.keyword, ...(a.url ? { publishedUrl: a.url } : {}) } };
    // the engine may point at a subdomain page: the page form accepts only the site itself
    if (action?.prefill?.existingPageUrl && !urlOnHost(String(action.prefill.existingPageUrl), site.domain)) delete action.prefill.existingPageUrl;
    if (!action && a.url) action = { label: 'Open', href: a.url };
    if (!action) action = a.source === 'ai_visibility' ? { label: 'Open AI visibility', page: 'ai' } : a.source === 'rank_tracker' ? { label: 'Open rankings', page: 'rankings' } : { label: 'Open search & traffic', page: 'search' };
    add({
      id: `engine:${a.source}:${a.type}:${a.keyword ?? a.action.slice(0, 60)}`,
      category: cat,
      priority: a.priority <= 1 ? 'high' : a.priority === 2 ? 'medium' : 'low',
      title: a.action.length > 140 ? a.action.slice(0, 137) + '...' : a.action,
      detail: a.why,
      evidence: `from the ${a.source.replace('_', ' ')} report`,
      action,
    }, {
      // the weekly report ranked its own actions; the queue keeps that order inside the family instead of re-deriving it
      impact: a.priority <= 1 ? 5 : a.priority === 2 ? 3.5 : 2,
      confidence: 'rule',
      effort: 'session',
      basis: `the ${a.source.replace('_', ' ')} report put this ${a.priority <= 1 ? 'first' : `${a.priority}${a.priority === 2 ? 'nd' : a.priority === 3 ? 'rd' : 'th'}`} in its own list`,
    });
  }

  // ---------- technical ----------
  const t = x.technical;
  const latestAudit = t.audits[t.audits.length - 1];
  // R66: a score drop only within one report type, a full report after a technical audit is a different scale, not a fall
  const prevAudit = previousOfType(t.audits, t.audits.length - 1);
  if (latestAudit && prevAudit && latestAudit.healthScore < prevAudit.healthScore - 2)
    add({ id: 'tech:score-drop', category: 'technical', priority: 'high', title: `Health score fell from ${prevAudit.healthScore} to ${latestAudit.healthScore}`, detail: 'New issues appeared since the previous audit. Start with the new critical and high findings.', action: { label: 'See what changed', page: 'technical' } });
  // G26 (2026-10-12, FIX_PLAN): the findings arrive in the audit's own impact order (services/data.ts), so these are the six that matter most,
  // and each one carries the line the audit used to rank it. Where the audit weighted them, its three highest-impact findings are the "high"
  // ones here too, otherwise a Critical on a page nobody visits would be pushed above the index blocker on the pages that earn the traffic,
  // and the app would disagree with its own report.
  const techOpen = t.findings.filter((f) => f.status !== 'fixed' && /^(critical|high)$/i.test(f.severity));
  const techWeighted = techOpen.filter((f) => f.impact != null);
  const techTop = new Set(techWeighted.slice(0, 3).map((f) => f.key));
  for (const f of techOpen.slice(0, 6))
    add({
      id: `tech:${f.key}`,
      category: 'technical',
      // B9 (pre-launch run 2026-10-21): the badge said "Medium" beside the audit's own "High severity" on the same row. The priority now
      // follows the audit's severity (every row here is Critical or High); the order among them stays the audit's impact order (the score).
      priority: /^(critical|high)$/i.test(f.severity) ? 'high' : 'medium',
      title: `Fix: ${f.title}`,
      detail: `${f.category} · ${f.severity}${f.status === 'new' ? ' · new since the last audit' : ''}. The audit report explains the fix; the fix pack has ready files where one applies.`,
      evidence: f.impactBasis || (f.affectedCount ? `${f.affectedCount} page(s) affected` : undefined),
      action: { label: 'Open technical health', page: 'technical' },
    }, f.impact != null
      ? { impact: impactFromAuditWeight(Number(f.impact)), confidence: f.impactBasis ? 'measured' : 'modelled', effort: 'session', basis: f.impactBasis || `the audit weighted this finding at ${f.impact}` }
      // G26 weighted nothing for this row (an audit written before it, or no Search Console): the severity alone is not a quantity
      : { impact: null, confidence: 'rule', effort: 'session', basis: '', reason: `the audit could not weigh it: ${f.severity} severity on ${f.affectedCount || 'some'} page(s), with no traffic figure behind it` });
  // with the monthly audit on, the scheduler itself re-audits within 60 days (sooner when the sitemap changes): only past that is it a step
  // the audit runs in the monthly cycle and re-audits an unchanged site after 60 days, so the next one can land near day 90
  const staleDays = auto.audit ? 95 : 45;
  if (latestAudit && Date.now() - Date.parse(latestAudit.auditedAt) > staleDays * 864e5)
    add({ id: 'tech:stale', category: 'technical', priority: 'low', title: 'Re-audit the site', detail: auto.audit ? `The last audit is more than ${staleDays} days old although the monthly audit is on; run one now and check the Pipeline for why it did not run.` : 'The last audit is more than 45 days old and the monthly audit is switched off.', action: { label: 'Run audit', mode: 'audit' } });

  // ---------- AI visibility ----------
  // engine fix round (2026-10-23): a named rate the engine could not measure is stored null; no recommendation is made from it (never 0%)
  const lastAi0 = x.ai.runs[x.ai.runs.length - 1];
  const lastAi = lastAi0 && lastAi0.mentionRate != null ? { ...lastAi0, mentionRate: lastAi0.mentionRate } : undefined;
  // A16 (2026-10-23): a rate on fewer answers than the engine's floor is a straw poll, not a finding: no recommendation from it
  const aiRange = lastAi ? (lastAi.mentionLo != null && lastAi.mentionHi != null ? [lastAi.mentionLo, lastAi.mentionHi] : wilsonRange(Math.round((lastAi.mentionRate * lastAi.samples) / 100), lastAi.samples)) : null;
  if (lastAi && lastAi.mentionRate < 20 && lastAi.samples >= AI_MIN_RATE_SAMPLES)
    add({ id: 'ai:low', category: 'ai', priority: 'high', title: `AI assistants name you in ${formatPercent(lastAi.mentionRate, 0)} of buyer answers`, detail: 'Competitors are recommended instead. Pages that answer these questions directly, with proof and clear entity signals, are what AI engines cite.', evidence: `${lastAi.samples} answers counted · share of voice ${formatPercent(lastAi.shareOfVoice, 0)}`, action: { label: 'See the questions', page: 'ai' } }, {
      // the mention rate is measured; what winning those answers is worth in visits is not, so the effort band carries the doubt
      impact: impactFromPoints(Math.min(40, 100 - lastAi.mentionRate)),
      confidence: 'modelled',
      effort: 'days',
      basis: `named in ${formatPercent(lastAi.mentionRate, 0)} of ${lastAi.samples} answers we asked for ourselves${aiRange ? ` (95% range ${formatPercent(aiRange[0], 0)} to ${formatPercent(aiRange[1], 0)})` : ''}`,
    });
  // the AI report's own actions already cover its lost questions; without a delivered report, the stored gaps stand in
  for (const g of x.ai.report ? [] : (x.ai.latest?.gaps ?? []).slice(0, 3))
    add({
      id: `ai:gap:${g.prompt.slice(0, 80)}`,
      category: 'ai',
      priority: 'medium',
      title: `Win the AI answer: "${g.prompt.length > 110 ? g.prompt.slice(0, 107) + '...' : g.prompt}"`,
      detail: g.competitors.length ? `AI names ${g.competitors.slice(0, 3).join(', ')} here and not you.` : 'AI answers this without naming you.',
      evidence: g.sources.length ? `sources AI relies on: ${g.sources.slice(0, 3).join(', ')}` : undefined,
      action: { label: 'See the answers', page: 'ai' },
    });

  // ---------- backlinks (v4.10: losses are confirmed by two checks on the page; reasons, reclaims, lists, follow-ups, Google's sample) ----------
  const bl = x.backlinks;
  const lastBl = bl.snapshots[bl.snapshots.length - 1];
  const REASON: Record<string, string> = { link_removed: 'the link was removed from the page', page_gone: 'the linking page is gone', domain_gone: 'the linking site no longer exists', not_seen: 'no source has seen it for 4 months' };
  const confirmed = (bl.latest?.lost ?? []).filter((l) => !l.pending && l.reason !== 'domain_gone' && (l.domainRank >= 100 || l.reason));
  for (const l of confirmed.filter((l) => l.domainRank >= 100 || bl.refs.find((r) => r.refDomain === l.fromDomain && r.seoValue >= 35)).slice(0, 3))
    add({ id: `bl:lost:${l.fromDomain}`, category: 'backlinks', priority: 'high', title: `Win back the link from ${l.fromDomain}`, detail: `Checked twice on the page: ${REASON[l.reason ?? ''] ?? 'the link is gone'}. The outreach pipeline has a draft asking to restore it.`, evidence: `authority ${l.domainRank}${l.lastSeen ? ` · last seen ${l.lastSeen}` : ''}`, action: { label: 'Open backlinks', page: 'backlinks' } }, {
      impact: impactFromPoints(Math.min(20, l.domainRank / 30)),
      confidence: 'modelled',
      effort: 'hour',
      basis: `authority ${l.domainRank} in the backlink index, and our own two checks of the page agree it is gone`,
    });
  for (const r of (bl.report?.reclaim ?? []).filter((r) => taskOpen(redirectTaskKey(r.brokenUrl))).slice(0, 2))
    add({ id: `bl:reclaim:${r.brokenUrl}`, taskKey: redirectTaskKey(r.brokenUrl), guideVars: { brokenUrl: r.brokenUrl, redirectTo: r.redirectTo }, category: 'backlinks', priority: 'medium', title: `Redirect ${r.brokenUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}: ${r.links} link(s) point to a broken page`, detail: `A 301 redirect to ${r.redirectTo.replace(/^https?:\/\/[^/]+/, '') || '/'} keeps the value of those links.`, evidence: r.domains.slice(0, 3).join(', '), action: { label: 'Open backlinks', page: 'backlinks' } });
  if (lastBl && lastBl.spammyNew > 2)
    add({ id: 'bl:spam', category: 'backlinks', priority: 'low', title: `${lastBl.spammyNew} new spammy link(s): nothing to do unless they keep coming`, detail: 'Google ignores most link spam on its own; disavow only after a manual action or for a paid-link pattern you did not create.', action: { label: 'Review links', page: 'backlinks' } });
  const missingLists = (bl.latest?.lists ?? []).filter((l) => !l.named && l.competitors.length);
  if (missingLists.length)
    add({ id: 'bl:lists', category: 'backlinks', priority: 'medium', title: `Get onto ${missingLists.length} "best of" list(s) that name your competitors`, detail: 'Lists and comparisons are what AI answers and searchers read first. Each has an outreach draft with the facts the editor needs.', evidence: missingLists.slice(0, 2).map((l) => `${l.domain}: ${l.competitors.join(', ')}`).join(' · '), action: { label: 'Open the pipeline', page: 'backlinks' } });
  const fresh = bl.prospects.filter((p) => p.status === 'new' && p.outreachBody).sort((a, c) => c.score - a.score);
  if (fresh.length)
    add({ id: 'bl:outreach', category: 'backlinks', priority: 'medium', title: `Send outreach to ${fresh.length} link prospect(s)`, detail: 'Each has a ready subject and message (and a contact when one was found on their site). Start with the highest score; mark them contacted to get the follow-ups.', evidence: fresh.slice(0, 3).map((p) => p.prospectDomain).join(', '), action: { label: 'Open the pipeline', page: 'backlinks' } });
  const followups = bl.prospects.filter((p) => p.status === 'contacted' && p.followupBody);
  if (followups.length)
    add({ id: 'bl:followup', category: 'backlinks', priority: 'medium', title: `${followups.length} follow-up e-mail(s) are due`, detail: 'No reply and no link yet. One short follow-up roughly doubles the replies; the second is the last.', evidence: followups.slice(0, 3).map((p) => p.prospectDomain).join(', '), action: { label: 'Open the pipeline', page: 'backlinks' } });
  if (lastBl && lastBl.unionDomains != null && !bl.imports.some((i) => i.source.startsWith('gsc')))
    add({ id: 'bl:gsc-import', category: 'backlinks', priority: 'low', title: "Add Google's own list of your links", detail: 'Search Console shows a sample of the links Google knows; its API cannot read them. Export "Latest links" (Links, then Export external links) and upload the CSV: the monitor checks every page and shows how much of Google\'s view each source covers.', action: { label: 'Open backlinks', page: 'backlinks' } });

  // ---------- content ----------
  const now = Date.now();
  // R111: a draft whose last quality round failed is not a page to publish; it is a page to fix and run again (with the reasons)
  for (const c of x.content.items.filter((c) => c.status === 'not_ready').slice(0, 4)) {
    const reasons = String((c as typeof c & { qaReasons?: string }).qaReasons ?? '').split(';').map((r) => r.trim()).filter(Boolean);
    add({ id: `content:fix:${c.keyword}`, category: 'content', priority: 'high', title: `Finish the draft for "${c.keyword}" by hand`, detail: `It did not pass the quality check${reasons.length ? `: ${reasons.slice(0, 3).join('; ')}` : ''}. ${DRAFT_BY_HAND}. ${NO_RERUN_NEEDED}`, evidence: c.startedAt ? `written ${Math.max(0, Math.round((now - Date.parse(c.startedAt)) / 864e5))} days ago` : undefined, action: draftAction(c.keyword) });
  }
  // W0-D (2026-10-29): a `held` row is a page that was never written (it waits for the client's OK), so it is never offered as "publish it"
  for (const c of x.content.items.filter((c) => c.status !== 'published' && c.status !== 'not_ready' && c.status !== 'held' && c.startedAt && now - Date.parse(c.startedAt) > 3 * 864e5).slice(0, 4))
    add({ id: `content:publish:${c.keyword}`, category: 'content', priority: 'high', title: `Publish the page for "${c.keyword}"`, detail: 'It is written but not live; nothing can rank before it is published. Then report the URL so tracking and link suggestions start.', evidence: `written ${Math.round((now - Date.parse(c.startedAt)) / 864e5)} days ago`, action: { label: 'I published it', mode: 'published', prefill: { keyword: c.keyword } } });
  // keyword-first (SCHEDULING_KEYWORDS_PLAN.md §5.3): nothing is written without a keyword the client chose, so the first step is the keyword
  const ladderCount = x.rankings.ladders.length;
  const researchAge = x.researchAt ? (now - Date.parse(x.researchAt)) / 864e5 : null;
  if (!ladderCount && (researchAge == null || researchAge > RECOMMENDATIONS_MAX_AGE_DAYS))
    add({ id: 'keyword:research', category: 'content', priority: 'high', title: 'Start keyword research', detail: researchAge == null ? 'We look at your website, your services and your market and suggest the keywords you have a real chance with. You then choose the one you want to be found for; nothing is written before you do.' : `Your last keyword research is more than ${RECOMMENDATIONS_MAX_AGE_DAYS} days old. Fresh research shows what people search for now before you choose a keyword.`, action: { label: 'Find keywords', page: 'pipeline/new' } });
  else if (!ladderCount)
    add({ id: 'keyword:first', category: 'content', priority: 'high', title: 'Choose your first keyword', detail: 'Your keyword research is ready. Pick the keyword you want to be found for (or type your own): its pages are then written every week. Nothing is written before you choose.', action: { label: 'Choose a keyword', page: 'pipeline/new' } });
  if (tracked && ladderCount && (x.content.cadence?.pagesPerWeek ?? 0) === 0)
    add({ id: 'content:cadence', category: 'content', priority: 'low', title: 'Turn on weekly pages for your keywords', detail: 'Your keyword ladders have pages to write, but pages a week is 0, so they wait. Set how many pages a week we write for your keywords.', action: { label: 'Set pages a week', page: 'settings/tracking' } });
  for (const tr of x.search.trends.filter((t) => /ris|up/i.test(t.direction) && t.changePct >= 50).slice(0, 2))
    add({ id: `content:trend:${tr.keyword}`, category: 'content', priority: 'medium', title: `Rising search: "${tr.keyword}" (+${Math.round(tr.changePct)}%)`, detail: tr.rising.length ? `Rising related searches: ${tr.rising.slice(0, 3).join(', ')}.` : 'Demand is growing; a timely page can capture it.', action: { label: 'Write a page', mode: 'keyword', prefill: { keyword: tr.keyword } }, ...(() => { const a = ladderFor(tr.keyword); return a ? { secondary: a } : {}; })() });

  // ---------- rankings ----------
  for (const l of x.rankings.ladders) {
    const next = l.rungs.find((r) => r.status === 'planned');
    const lastDone = [...l.rungs].reverse().find((r) => r.status !== 'planned');
    if (next && lastDone)
      add({ id: `rank:next:${l.ladderId}`, category: 'rankings', priority: 'medium', title: `Next rung of "${l.headKeyword}": ${next.keyword}`, detail: `Rung ${next.rung} of the ladder (${next.pageType || 'page'}). Each published rung adds internal links and topical authority for the head term. The pipeline writes it with the ladder's links and marks it, so the weekly pages move on.`, evidence: `${l.published} of ${l.pages} pages published`, action: { label: 'Open the ladder', page: `pipeline/ladders/${l.ladderId}` } });
  }
  for (const k of x.rankings.keywords.filter((k) => k.previousPosition && k.latestPosition != null && (k.latestPosition === 0 || k.latestPosition - k.previousPosition >= 5)).slice(0, 3))
    add({ id: `rank:drop:${k.keyword}`, category: 'rankings', priority: 'medium', title: `"${k.keyword}" dropped`, detail: 'Check the ranking page and what moved above it.', evidence: `position ${k.previousPosition} to ${k.latestPosition === 0 ? 'out of the top 50' : k.latestPosition}`, action: { label: 'Refresh the page', mode: 'keyword', prefill: { keyword: k.keyword, ...(k.url && urlOnHost(k.url, site.domain) ? { existingPageUrl: k.url } : {}) } } });

  // One queue: blocking setup first, then by impact x confidence / effort, then the items nothing measured yet (`queue.ts`).
  return queueOrder(out).slice(0, 60);
}

// ---------------- overview ----------------

/**
 * B2 (pre-launch run 2026-10-21): the Overview's content counts, read the way the Content page reads them. Live = reported published or
 * found live (a `published_url`); a draft that failed its quality check (`not_ready`, R111) needs a fix and is never "waiting to publish".
 * Every written page is in exactly one of the three.
 */
export function overviewContentCounts(items: readonly Pick<ContentItem, 'status' | 'publishedUrl'>[], extra: { pagesPerWeek: number; caseStudies: number }): OverviewData['content'] {
  const live = (c: Pick<ContentItem, 'status' | 'publishedUrl'>) => c.status === 'published' || !!c.publishedUrl;
  const fix = items.filter((c) => !live(c) && c.status === 'not_ready').length;
  const published = items.filter(live).length;
  return { started: items.length, published, pendingPublish: items.length - published - fix, needsFix: fix, ...extra };
}

/** The Overview's "Latest reports": results only (no "Coming up" plan), the six newest. */
export const overviewReports = <R extends { stage: string }>(reports: readonly R[], limit = 6): R[] => reports.filter((r) => r.stage !== 'cycle_preview').slice(0, limit);

export async function overviewData(org: OrgRow, site: SiteRow): Promise<OverviewData> {
  const [x, recent, tasks] = await Promise.all([
    loadBundle(org, site),
    reportsList(org.id, { siteId: site.id, limit: 12 }),
    // site tasks: the Overview's top recommendations agree with the Recommendations page (undefined when they cannot be read)
    site.verifiedAt ? import('./siteTasks').then((m) => m.siteTasksOf(org, site)).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  // B13 (pre-launch run 2026-10-21): the "Coming up" plan is the Pipeline's preview of the next run, not a result: it filled the top of
  // "Latest reports" twice a week. It stays under Reports and on the Pipeline.
  const reports = overviewReports(recent);
  const snap = x.search.snapshot;
  const m = x.search.metrics;
  const lastMetrics = m[m.length - 1] ?? null;
  const audits = x.technical.audits;
  const aiRuns = x.ai.runs;
  const bl = x.backlinks.snapshots;
  const kw = x.rankings.keywords;
  const ladderRungs = x.rankings.ladders.flatMap((l) => l.rungs);
  const positions = [...kw.map((k) => k.latestPosition), ...ladderRungs.map((r) => r.latestPosition)].filter((p): p is number => p != null && p > 0);
  const movers = [...kw.map((k) => ({ keyword: k.keyword, from: k.previousPosition, to: k.latestPosition })), ...ladderRungs.map((r) => ({ keyword: r.keyword, from: r.previousPosition, to: r.latestPosition }))]
    .filter((mv) => mv.from != null && mv.to != null && mv.from !== mv.to)
    .sort((a, b) => Math.abs((b.from ?? 0) - (b.to ?? 0)) - Math.abs((a.from ?? 0) - (a.to ?? 0)))
    .slice(0, 6);

  // the weekly metrics table may be empty while weekly reports exist: fall back to the report's daily series
  const series = m.length
    ? m.map((p) => ({ periodEnd: p.periodEnd, clicks: p.clicks, impressions: p.impressions, position: p.position, sessions: p.sessions }))
    : (snap?.gsc.daily ?? []).map((d) => ({ periodEnd: d.date, clicks: d.clicks, impressions: d.impressions, position: d.position, sessions: 0 }));

  const latest =
    lastMetrics ??
    (snap?.gsc.current
      ? {
          periodStart: snap.period?.current.start ?? '',
          periodEnd: snap.period?.current.end ?? '',
          checkedAt: snap.receivedAt,
          gscConnected: snap.gsc.connected,
          ga4Connected: snap.ga4.connected,
          clicks: snap.gsc.current.clicks,
          impressions: snap.gsc.current.impressions,
          ctr: snap.gsc.current.ctr,
          position: snap.gsc.current.position,
          prevClicks: snap.gsc.previous?.clicks ?? 0,
          prevImpressions: snap.gsc.previous?.impressions ?? 0,
          prevCtr: snap.gsc.previous?.ctr ?? 0,
          prevPosition: snap.gsc.previous?.position ?? 0,
          yoyClicks: 0,
          yoyImpressions: 0,
          sessions: snap.ga4.organic?.sessions ?? 0,
          engagedSessions: snap.ga4.organic?.engaged ?? 0,
          keyEvents: snap.ga4.organic?.keyEvents ?? 0,
          prevSessions: snap.ga4.organicPrev?.sessions ?? 0,
          prevEngagedSessions: snap.ga4.organicPrev?.engaged ?? 0,
          prevKeyEvents: snap.ga4.organicPrev?.keyEvents ?? 0,
          organicShare: snap.ga4.organicShare ?? 0,
          queries: x.search.queries.filter((q) => q.periodEnd === x.search.periods[0]).length,
          striking: x.search.queries.filter((q) => q.periodEnd === x.search.periods[0] && q.position >= 4 && q.position <= 20).length,
          alerts: [],
        }
      : null);

  // a free-sources-only check (v4.10, mode 'free') has no DataForSEO figures: the overview shows the latest check that used DataForSEO
  const lastBl = [...bl].reverse().find((b) => b.mode !== 'free') ?? bl[bl.length - 1] ?? null;
  const ga4 = ga4Now(snap, x.settings.tracking);
  return {
    site: { domain: site.domain, trackingStatus: site.trackingStatus, verified: !!site.verifiedAt },
    // 2026-10-28: what the weekly cycle runs on its own (the checklist offers it as scheduled, not as a manual run) and GA4 by the shared rule
    autopilot: autopilotRuns({ verified: !!site.verifiedAt, trackingStatus: site.trackingStatus }, x.settings.monitors),
    ga4: { connected: ga4.connected, awaitingReport: ga4.awaitingReport },
    // G12 / G29: the overview chart carries the same event marks and the same lineage as the search page (computed once, in searchData)
    search: { latest, series, seriesKind: m.length ? 'weekly' : 'daily', annotations: x.search.annotations, lineage: x.search.lineage },
    // R66: one score scale per line, the series holds the latest audit's own report type only (a full report weighs other findings)
    health: { latest: audits[audits.length - 1] ?? null, series: audits.filter((a) => a.reportType === audits[audits.length - 1]?.reportType).map((a) => ({ auditedAt: a.auditedAt, healthScore: a.healthScore })) },
    ai: { latest: aiRuns[aiRuns.length - 1] ?? null, series: aiRuns.map((r) => ({ checkedAt: r.checkedAt, mentionRate: r.mentionRate, citationRate: r.citationRate, shareOfVoice: r.shareOfVoice })) },
    backlinks: {
      latest: lastBl,
      series: x.backlinks.latest?.timeseries.length
        ? x.backlinks.latest.timeseries.map((t) => ({ month: t.month, referringDomains: t.referringDomains, backlinks: t.backlinks }))
        : bl.map((b) => ({ month: b.checkedAt.slice(0, 7), referringDomains: b.referringDomains, backlinks: b.backlinks })),
    },
    rankings: {
      ladders: x.rankings.ladders.length,
      keywords: kw.length + ladderRungs.length,
      top3: positions.filter((p) => p <= 3).length,
      top10: positions.filter((p) => p <= 10).length,
      top50: positions.filter((p) => p <= 50).length,
      movers,
    },
    content: overviewContentCounts(x.content.items, {
      pagesPerWeek: x.content.cadence?.pagesPerWeek ?? 0,
      caseStudies: x.content.caseStudies.length,
    }),
    alerts: { open: x.alerts.alerts.filter((a) => a.status !== 'resolved' && a.status !== 'closed').length, checkinDue: x.alerts.checkinDue },
    recommendations: recommend(site, x, tasks).slice(0, 6),
    reports,
  };
}
