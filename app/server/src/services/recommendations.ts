import {
  formatPercent,
  MODE_IDS,
  PAGE_TYPE_VALUES,
  type AiData,
  type AlertsData,
  type BacklinksData,
  type ContentData,
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
} from '@seo/shared';
import type { OrgRow, SiteRow } from '../db/schema';
import { aiData, alertsData, backlinksData, contentData, rankingsData, searchData, settingsData, technicalData } from './data';
import { latestReport, reportsList } from './runs';

// Next steps for a website, from everything stored about it: setup gaps, Search Console opportunities, open audit issues, AI
// answers lost to competitors, links to reclaim, pages to publish, ladder rungs to write — plus the actions the SEO engine itself
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
}

export async function loadBundle(org: OrgRow, site: SiteRow): Promise<SiteBundle> {
  const [search, rankings, content, technical, ai, backlinks, alerts, settings, rank] = await Promise.all([
    searchData(org, site),
    rankingsData(site),
    contentData(org, site),
    technicalData(org, site),
    aiData(org, site),
    backlinksData(org, site),
    alertsData(site),
    settingsData(org, site),
    latestReport(org.id, site.id, ['rank_tracker']),
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
  return { search, rankings, content, technical, ai, backlinks, alerts, settings, rankNext, reportsElsewhere };
}

const PAGE_TYPES = new Set<string>(PAGE_TYPE_VALUES);

/** An n8n API body (snake_case) → the app's tool link (mode + camelCase prefill). */
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

export function recommend(site: SiteRow, x: SiteBundle): Recommendation[] {
  const out: Recommendation[] = [];
  const add = (r: Recommendation) => {
    if (!out.some((o) => o.id === r.id)) out.push(r);
  };
  const tracked = site.trackingStatus === 'active' || x.settings.tracking.tracked;

  // ---------- setup ----------
  if (!tracked)
    add({ id: 'setup:tracking', category: 'setup', priority: 'high', title: 'Start weekly tracking', detail: 'Weekly Search Console, GA4, Google Trends and live rank checks with actions, plus AI-visibility and backlink monitors. Everything on this dashboard fills from it.', action: { label: 'Set up tracking', page: 'settings/tracking' } });
  if (x.reportsElsewhere)
    add({ id: 'setup:delivery', category: 'setup', priority: 'high', title: 'Send the weekly reports to this dashboard', detail: 'The SEO engine already tracks this site, but its weekly reports still go to an address set up before this app. Save the tracking settings once and every Monday report, alert and page lands here.', action: { label: 'Open tracking settings', page: 'settings/tracking' } });
  const snap = x.search.snapshot;
  if (tracked && (snap ? !snap.gsc.connected : !x.settings.tracking.gscProperty))
    add({ id: 'setup:gsc', category: 'setup', priority: 'high', title: 'Connect Google Search Console', detail: 'Without Search Console the tracker cannot see clicks, impressions, queries or index status. Add the service account as a user of your property.', evidence: snap?.gsc.error ?? undefined, action: { label: 'Connect', page: 'settings/verification' } });
  if (tracked && snap && !snap.ga4.connected)
    add({ id: 'setup:ga4', category: 'setup', priority: 'medium', title: 'Connect Google Analytics 4', detail: 'GA4 adds organic sessions, engagement and key events (leads, sales) to the weekly report.', action: { label: 'Connect GA4', page: 'settings/verification' } });
  if (x.settings.readiness.score < 70)
    add({ id: 'setup:profile', category: 'setup', priority: x.settings.readiness.score < 40 ? 'high' : 'medium', title: 'Complete the E-E-A-T profile', detail: 'Every page gets a byline, an author box, Person / LocalBusiness schema and an expert reviewer from it — strong trust signals for Google and AI answers.', evidence: `${x.settings.readiness.score}% complete · missing: ${x.settings.readiness.missing.slice(0, 4).join(', ')}`, action: { label: 'Complete the profile', page: 'settings/profile' } });
  if (!x.technical.audits.length)
    add({ id: 'setup:audit', category: 'technical', priority: 'high', title: 'Run the first technical audit', detail: 'Crawl, probes and scoring with a fix pack (robots.txt, llms.txt, redirects, schema, internal links). Later audits show what changed.', action: { label: 'Run audit', mode: 'audit', prefill: { reportType: 'site_audit' } } });
  if (!x.ai.runs.length)
    add({ id: 'setup:ai', category: 'ai', priority: 'medium', title: 'Take an AI-visibility baseline', detail: 'See whether ChatGPT, Perplexity, Gemini, Claude and Google AI name your company for the questions your buyers ask.', action: { label: 'Check AI visibility', mode: 'ai_visibility' } });
  if (!x.backlinks.snapshots.length)
    add({ id: 'setup:backlinks', category: 'backlinks', priority: 'low', title: 'Check your backlinks', detail: 'Lost and spammy links, a link gap against competitors and outreach drafts for the best prospects.', action: { label: 'Check backlinks', mode: 'backlinks' } });
  if (x.alerts.checkinDue)
    add({ id: 'setup:checkin', category: 'setup', priority: 'medium', title: 'Monthly Search Console check-in', detail: 'Two questions (manual action? security issue?) and the Pages report — the parts of Search Console the API cannot see.', action: { label: 'Do the check-in', mode: 'checkin' } });

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
    });
  const falling = queries.filter((q) => q.prevClicks >= 5 && q.clicks <= q.prevClicks * 0.5).sort((a, b) => b.prevClicks - b.clicks - (a.prevClicks - a.clicks)).slice(0, 3);
  for (const q of falling)
    add({
      id: `search:drop:${q.query}`,
      category: 'search',
      priority: 'high',
      title: `Recover the clicks lost on "${q.query}"`,
      detail: 'Clicks fell by half or more against the previous period. Check the ranking page for changes, competitors and SERP features.',
      evidence: `${q.prevClicks} → ${q.clicks} clicks · position ${fmtPos(q.prevPosition)} → ${fmtPos(q.position)}`,
      action: { label: 'Refresh the page', mode: 'keyword', prefill: { keyword: q.query, ...(q.page && urlOnHost(q.page, site.domain) ? { existingPageUrl: q.page } : {}) } },
    });

  // ---------- engine actions (weekly reports) ----------
  const engine = [...(snap?.actions ?? []), ...(x.ai.report?.actions ?? []), ...(x.rankNext ? [x.rankNext] : [])];
  for (const a of engine) {
    const cat: RecommendationCategory = a.source === 'ai_visibility' ? 'ai' : a.source === 'rank_tracker' ? 'rankings' : a.type === 'publish' ? 'content' : 'search';
    let action: RecommendationAction | undefined = actionFromApiBody(a.apiBody, a.source === 'ai_visibility' ? 'Write the answer page' : 'Run it');
    if (!action && a.type === 'publish' && a.keyword) action = { label: 'Report the published URL', mode: 'published', prefill: { keyword: a.keyword, ...(a.url ? { publishedUrl: a.url } : {}) } };
    // the engine may point at a subdomain page: the page form accepts only the site itself
    if (action?.prefill?.existingPageUrl && !urlOnHost(String(action.prefill.existingPageUrl), site.domain)) delete action.prefill.existingPageUrl;
    if (!action && a.url) action = { label: 'Open', href: a.url };
    if (!action) action = a.source === 'ai_visibility' ? { label: 'Open AI visibility', page: 'ai' } : a.source === 'rank_tracker' ? { label: 'Open rankings', page: 'rankings' } : { label: 'Open search & traffic', page: 'search' };
    add({
      id: `engine:${a.source}:${a.type}:${a.keyword ?? a.action.slice(0, 60)}`,
      category: cat,
      priority: a.priority <= 1 ? 'high' : a.priority === 2 ? 'medium' : 'low',
      title: a.action.length > 140 ? a.action.slice(0, 137) + '…' : a.action,
      detail: a.why,
      evidence: `from the ${a.source.replace('_', ' ')} report`,
      action,
    });
  }

  // ---------- technical ----------
  const t = x.technical;
  const latestAudit = t.audits[t.audits.length - 1];
  const prevAudit = t.audits[t.audits.length - 2];
  if (latestAudit && prevAudit && latestAudit.healthScore < prevAudit.healthScore - 2)
    add({ id: 'tech:score-drop', category: 'technical', priority: 'high', title: `Health score fell from ${prevAudit.healthScore} to ${latestAudit.healthScore}`, detail: 'New issues appeared since the previous audit. Start with the new critical and high findings.', action: { label: 'See what changed', page: 'technical' } });
  for (const f of t.findings.filter((f) => f.status !== 'fixed' && /^(critical|high)$/i.test(f.severity)).slice(0, 6))
    add({
      id: `tech:${f.key}`,
      category: 'technical',
      priority: /critical/i.test(f.severity) ? 'high' : f.status === 'new' ? 'high' : 'medium',
      title: `Fix: ${f.title}`,
      detail: `${f.category} · ${f.severity}${f.status === 'new' ? ' · new since the last audit' : ''}. The audit report explains the fix; the fix pack has ready files where one applies.`,
      evidence: f.affectedCount ? `${f.affectedCount} page(s) affected` : undefined,
      action: { label: 'Open technical health', page: 'technical' },
    });
  if (latestAudit && Date.now() - Date.parse(latestAudit.auditedAt) > 45 * 864e5)
    add({ id: 'tech:stale', category: 'technical', priority: 'low', title: 'Re-audit the site', detail: 'The last audit is more than 45 days old; the monthly scheduler re-audits only when the sitemap changed.', action: { label: 'Run audit', mode: 'audit' } });

  // ---------- AI visibility ----------
  const lastAi = x.ai.runs[x.ai.runs.length - 1];
  if (lastAi && lastAi.mentionRate < 20)
    add({ id: 'ai:low', category: 'ai', priority: 'high', title: `AI assistants name you in ${formatPercent(lastAi.mentionRate, 0)} of buyer answers`, detail: 'Competitors are recommended instead. Pages that answer these questions directly, with proof and clear entity signals, are what AI engines cite.', evidence: `${lastAi.answers} answers checked · share of voice ${formatPercent(lastAi.shareOfVoice, 0)}`, action: { label: 'See the questions', page: 'ai' } });
  // the AI report's own actions already cover its lost questions; without a delivered report, the stored gaps stand in
  for (const g of x.ai.report ? [] : (x.ai.latest?.gaps ?? []).slice(0, 3))
    add({
      id: `ai:gap:${g.prompt.slice(0, 80)}`,
      category: 'ai',
      priority: 'medium',
      title: `Win the AI answer: "${g.prompt.length > 110 ? g.prompt.slice(0, 107) + '…' : g.prompt}"`,
      detail: g.competitors.length ? `AI names ${g.competitors.slice(0, 3).join(', ')} here and not you.` : 'AI answers this without naming you.',
      evidence: g.sources.length ? `sources AI relies on: ${g.sources.slice(0, 3).join(', ')}` : undefined,
      action: { label: 'See the answers', page: 'ai' },
    });

  // ---------- backlinks ----------
  const lastBl = x.backlinks.snapshots[x.backlinks.snapshots.length - 1];
  for (const l of (x.backlinks.latest?.lost ?? []).filter((l) => l.domainRank >= 100).slice(0, 3))
    add({ id: `bl:lost:${l.fromDomain}`, category: 'backlinks', priority: 'high', title: `Reclaim the lost link from ${l.fromDomain}`, detail: 'An authoritative link stopped pointing to you. The prospect pipeline has an outreach draft.', evidence: `authority ${l.domainRank} · last seen ${l.lastSeen}`, action: { label: 'Open backlinks', page: 'backlinks' } });
  if (lastBl && lastBl.spammyNew > 0)
    add({ id: 'bl:spam', category: 'backlinks', priority: 'medium', title: `Review ${lastBl.spammyNew} new spammy link(s)`, detail: 'Links from link farms or PBN pages. Google mostly ignores them; disavow only if there is a pattern or a manual action.', action: { label: 'Review links', page: 'backlinks' } });
  const fresh = x.backlinks.prospects.filter((p) => p.status === 'new' && p.outreachBody);
  if (fresh.length)
    add({ id: 'bl:outreach', category: 'backlinks', priority: 'medium', title: `Send outreach to ${fresh.length} link prospect(s)`, detail: 'Each prospect has a ready subject and message. Mark them contacted to track the pipeline.', evidence: fresh.slice(0, 3).map((p) => p.prospectDomain).join(', '), action: { label: 'Open the pipeline', page: 'backlinks' } });

  // ---------- content ----------
  const now = Date.now();
  for (const c of x.content.items.filter((c) => c.status !== 'published' && c.startedAt && now - Date.parse(c.startedAt) > 3 * 864e5).slice(0, 4))
    add({ id: `content:publish:${c.keyword}`, category: 'content', priority: 'high', title: `Publish the page for "${c.keyword}"`, detail: 'It is written but not live; nothing can rank before it is published. Then report the URL so tracking and link suggestions start.', evidence: `written ${Math.round((now - Date.parse(c.startedAt)) / 864e5)} days ago`, action: { label: 'I published it', mode: 'published', prefill: { keyword: c.keyword } } });
  if (tracked && (x.content.cadence?.pagesPerWeek ?? 0) === 0)
    add({ id: 'content:cadence', category: 'content', priority: 'low', title: 'Turn on weekly blog posts', detail: 'The content cadence writes researched pages every Monday from your ladder, striking-distance queries and rising searches.', action: { label: 'Set posts per week', page: 'settings/tracking' } });
  for (const tr of x.search.trends.filter((t) => /ris|up/i.test(t.direction) && t.changePct >= 50).slice(0, 2))
    add({ id: `content:trend:${tr.keyword}`, category: 'content', priority: 'medium', title: `Rising search: "${tr.keyword}" (+${Math.round(tr.changePct)}%)`, detail: tr.rising.length ? `Rising related searches: ${tr.rising.slice(0, 3).join(', ')}.` : 'Demand is growing; a timely page can capture it.', action: { label: 'Write a page', mode: 'keyword', prefill: { keyword: tr.keyword } } });

  // ---------- rankings ----------
  for (const l of x.rankings.ladders) {
    const next = l.rungs.find((r) => r.status === 'planned');
    const lastDone = [...l.rungs].reverse().find((r) => r.status !== 'planned');
    if (next && lastDone)
      add({ id: `rank:next:${l.ladderId}`, category: 'rankings', priority: 'medium', title: `Next rung of "${l.headKeyword}": ${next.keyword}`, detail: `Rung ${next.rung} of the ladder (${next.pageType || 'page'}). Each published rung adds internal links and topical authority for the head term. The pipeline writes it with the ladder's links and marks it, so the Monday cadence moves on.`, evidence: `${l.published} of ${l.pages} pages published`, action: { label: 'Open the ladder', page: `pipeline/ladders/${l.ladderId}` } });
  }
  for (const k of x.rankings.keywords.filter((k) => k.previousPosition && k.latestPosition != null && (k.latestPosition === 0 || k.latestPosition - k.previousPosition >= 5)).slice(0, 3))
    add({ id: `rank:drop:${k.keyword}`, category: 'rankings', priority: 'medium', title: `"${k.keyword}" dropped`, detail: 'Check the ranking page and what moved above it.', evidence: `position ${k.previousPosition} → ${k.latestPosition === 0 ? 'out of the top 50' : k.latestPosition}`, action: { label: 'Refresh the page', mode: 'keyword', prefill: { keyword: k.keyword, ...(k.url && urlOnHost(k.url, site.domain) ? { existingPageUrl: k.url } : {}) } } });

  return out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || CAT_RANK[a.category] - CAT_RANK[b.category]).slice(0, 60);
}

// ---------------- overview ----------------

export async function overviewData(org: OrgRow, site: SiteRow): Promise<OverviewData> {
  const [x, reports] = await Promise.all([loadBundle(org, site), reportsList(org.id, { siteId: site.id, limit: 6 })]);
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

  const lastBl = bl[bl.length - 1] ?? null;
  return {
    site: { domain: site.domain, trackingStatus: site.trackingStatus, verified: !!site.verifiedAt },
    search: { latest, series, seriesKind: m.length ? 'weekly' : 'daily' },
    health: { latest: audits[audits.length - 1] ?? null, series: audits.map((a) => ({ auditedAt: a.auditedAt, healthScore: a.healthScore })) },
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
    content: {
      started: x.content.items.length,
      published: x.content.items.filter((c) => c.status === 'published').length,
      pendingPublish: x.content.items.filter((c) => c.status !== 'published').length,
      pagesPerWeek: x.content.cadence?.pagesPerWeek ?? 0,
      caseStudies: x.content.caseStudies.length,
    },
    alerts: { open: x.alerts.alerts.filter((a) => a.status !== 'resolved' && a.status !== 'closed').length, checkinDue: x.alerts.checkinDue },
    recommendations: recommend(site, x).slice(0, 6),
    reports,
  };
}
