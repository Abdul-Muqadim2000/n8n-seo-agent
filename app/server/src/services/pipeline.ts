import {
  AUTOMATIONS,
  formatPercent,
  normKeyword,
  MONITOR_COSTS,
  nextScheduledRun,
  type AutomationId,
  type AutomationStatus,
  type ContentLogRow,
  type DetectedPage,
  type LadderCard,
  type LadderDetail,
  type LadderRow,
  type LadderSettingsRow,
  type ModeId,
  type NeedsYouItem,
  type PipelineData,
  type PipelineStage,
  type QueryRow,
  type QueueItem,
  type RankHistoryRow,
  type Report,
  type ThisWeekItem,
  type TrendRow,
} from '@seo/shared';
import { config } from '../config';
import type { OrgRow, SiteRow } from '../db/schema';
import { notFound } from '../lib/errors';
import { executions, siteRows } from '../n8n/client';
import { CADENCE, simulateCadence, type CadenceWeek } from './cadence';
import { buildLadders, ladderAppSources, ladderNeedsYou, ladderReports, sortNeedsYou, type LadderBuild, type LadderSchedule, type SiteRun } from './ladders';
import { loadBundle, recommend, type SiteBundle } from './recommendations';
import { latestReport, monthSpend, reportsList } from './runs';

// The pipeline of one website: every automation n8n runs for it (Mondays and the 1st of the month), whether it is on, when it runs
// next, what it did last, and the posts the Content Cadence will write next — computed with the cadence's own rules by the mirror
// in cadence.ts (v5/code/Cadence_Plan.js): the keyword ladders in priority order (Auto, active, at most N at a time, the main page
// after its support), then striking-distance queries and rising searches when opportunity posts are Auto; nothing while too many
// pages wait to be published; nothing written in the last 90 days, no brand queries.

const norm = normKeyword;

/** Pages written and not published (the content log; every age), oldest first. */
export function waitingPages(logs: ContentLogRow[], now = Date.now()): PipelineData['queue']['waiting'] {
  return logs
    .filter((l) => l.status === 'started' && !l.published_url)
    .map((l) => ({ keyword: l.keyword, startedAt: l.started_at, days: Math.max(0, Math.round((now - Date.parse(l.started_at || new Date(now).toISOString())) / 864e5)) }))
    .sort((a, b) => b.days - a.days);
}

/** The ladders' schedule from the cadence mirror: the pages its coming runs write and what the first run decides. */
export function cadenceSchedule(weeks: CadenceWeek[], on: boolean): Pick<LadderSchedule, 'dated' | 'plan'> {
  const w = weeks[0];
  const nextOf = new Map<string, QueueItem>();
  for (const l of w.ladders) if (l.eligible[0]) nextOf.set(l.id, l.eligible[0]);
  return {
    dated: on ? weeks.flatMap((x) => x.picks.map((item) => ({ item, at: x.at }))) : [],
    plan: { queued: w.queued, awaitingApproval: w.awaitingApproval, nextOf, pileup: on && w.pausedReason === 'pileup', waitingPublish: w.waitingPublish, maxWaiting: w.config.maxWaiting },
  };
}

// ---------- what the schedule is executing right now ----------
// n8n's executions API: schedule-started executions have mode "trigger" (on-demand runs are "integrated" / "webhook" and belong
// to whoever started them). One scheduled execution covers every website. Cached 30 s; n8n not answering means "nothing running".
let runningCache: { at: number; value: PipelineData['running'] } | null = null;

async function scheduledRunning(): Promise<PipelineData['running']> {
  if (runningCache && Date.now() - runningCache.at < 30_000) return runningCache.value;
  const since = Date.now() - 12 * 3600_000;
  const lists = await Promise.all(
    AUTOMATIONS.map(async (a) => {
      const list = await executions(a.workflow, 'running', 5).catch(() => []);
      const e = list.filter((x) => x.mode === 'trigger' && Date.parse(x.startedAt) >= since).sort((x, y) => y.startedAt.localeCompare(x.startedAt))[0];
      return e ? [{ automation: a.id, startedAt: e.startedAt }] : [];
    }),
  );
  runningCache = { at: Date.now(), value: lists.flat() };
  return runningCache.value;
}

const ACTIVE_RUN = ['submitting', 'accepted', 'running'];

/** This website's runs started in the app and not finished (the last 12 hours; older ones expire). */
export function activeRuns(runs: SiteRun[], now = Date.now()): PipelineData['activeRuns'] {
  return runs
    .filter((r) => ACTIVE_RUN.includes(r.status) && now - Date.parse(r.createdAt) < 12 * 3600_000)
    .slice(0, 20)
    .map((r) => ({ id: r.id, mode: r.mode as ModeId, keyword: r.keyword, createdAt: r.createdAt }));
}

// ---------- Needs you: connections and failed runs (the ladders' part is in ladders.ts) ----------

const plural = (k: number, one: string, many = one + 's') => `${k} ${k === 1 ? one : many}`;

function connectionNeeds(site: SiteRow, x: SiteBundle, status: PipelineData['tracking']['status']): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  const page = 'settings/tracking';
  if (status === 'not_started' && site.verifiedAt)
    out.push({
      id: 'connection:tracking',
      kind: 'connection',
      severity: 'warning',
      title: 'Start weekly tracking',
      detail: 'Nothing in the pipeline runs for this website until weekly tracking is on: no rank checks, no weekly posts, no monitors.',
      action: { label: 'Set up tracking', page },
    });
  if (status !== 'active') return out;
  if (x.reportsElsewhere)
    out.push({
      id: 'connection:delivery',
      kind: 'connection',
      severity: 'warning',
      title: 'Send the weekly reports to this app',
      detail: 'The SEO engine tracks this website, but its weekly reports still go to an address set up before this app. Save the tracking settings once and every Monday report lands here.',
      action: { label: 'Open tracking settings', page },
    });
  const snap = x.search.snapshot;
  if (snap ? !snap.gsc.connected : !x.settings.tracking.gscProperty)
    out.push({
      id: 'connection:gsc',
      kind: 'connection',
      severity: 'warning',
      title: 'Connect Google Search Console',
      detail: 'Without it the pipeline cannot see clicks, impressions or which of your pages Google shows, and the weekly posts cannot pick searches close to page one.',
      action: { label: 'Connect', page },
    });
  return out;
}

/**
 * Ladder plans of the last 7 days that planned nothing (`planned: false`: the main keyword is another ladder's, or not realistic for
 * the website): the "New keyword ladder" flow ends on the Pipeline, where such a ladder would otherwise just never appear. Not when
 * a later plan for the same keyword was planned.
 */
export function refusedPlans(reports: Pick<Report, 'id' | 'runId' | 'stage' | 'summary' | 'receivedAt'>[], now = Date.now()): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  const seen = new Set<string>();
  for (const r of [...reports].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))) {
    if (r.stage !== 'ladder_plan' || now - Date.parse(r.receivedAt) > 7 * 864e5) continue;
    const head = typeof r.summary.head === 'string' ? r.summary.head : '';
    const key = normKeyword(head);
    if (seen.has(key)) continue;
    seen.add(key);
    const why = r.summary.refused;
    if (!why) continue;
    out.push({
      id: `refused:${r.id}`,
      kind: 'failed',
      severity: 'info',
      title: `“${head}” was not planned`,
      detail:
        why === 'duplicate'
          ? 'You already have a keyword ladder for this search: one search needs one page, so no second ladder was made. Continue the existing one.'
          : 'It is not realistic for your website (people searching it look for one particular company or website). The plan lists easier keywords to check instead.',
      action: { label: 'See why', runId: r.runId ?? undefined },
    });
  }
  return out.filter((x) => x.action?.runId).slice(0, 3);
}

/** The website's runs that failed in the last 7 days and were not started again since (newest first). */
export function failedRuns(runs: SiteRun[], now = Date.now()): NeedsYouItem[] {
  const seen = new Set<string>();
  const out: NeedsYouItem[] = [];
  for (const r of runs) {
    const key = `${r.mode}|${normKeyword(r.keyword)}`;
    if (r.status === 'failed' && now - Date.parse(r.createdAt) < 7 * 864e5 && !seen.has(key))
      out.push({
        id: `failed:${r.id}`,
        kind: 'failed',
        severity: 'warning',
        title: `${r.title}: did not finish`,
        detail: r.error ? r.error.slice(0, 240) : 'The SEO engine stopped before the result arrived.',
        action: { label: 'Open the run', runId: r.id },
      });
    seen.add(key);
  }
  return out.slice(0, 5);
}

// ---------- this week: the coming runs in order, with what each touches ----------

function thisWeekItems(
  p: { automations: AutomationStatus[]; calendar: PipelineData['calendar']; running: PipelineData['running']; queue: { next: QueueItem[] }; plan: CadenceWeek; x: SiteBundle; build: LadderBuild; tz: string },
  now = Date.now(),
): ThisWeekItem[] {
  const dayOfMonth = (iso: string) => Number(new Intl.DateTimeFormat('en-US', { timeZone: p.tz, day: 'numeric' }).format(new Date(iso)));
  // the monthly extras run on the month's first Monday (AI visibility: Gemini, Claude, the market view; backlinks: the full report)
  const firstRun = (iso: string) => dayOfMonth(iso) <= 7;
  const nextCadence = p.calendar.find((c) => c.automation === 'content_cadence')?.at;
  const pages = p.build.cards.reduce((t, c) => t + c.counts.total, 0);
  const tr = p.x.settings.tracking;
  const detail = (id: AutomationId, at: string, running: boolean): string => {
    const a = p.automations.find((x) => x.id === id);
    switch (id) {
      case 'ai_visibility':
        return `${a?.detail ?? 'Your buyer questions'}${firstRun(at) ? ' · Gemini, Claude and the market view (first run of the month)' : ''}`;
      case 'backlinks':
        return firstRun(at) ? 'Full monthly report: lost links, unlinked mentions and outreach drafts' : 'Watches for lost and spammy links';
      case 'rank_tracker':
        return `${plural(p.build.cards.length, 'ladder')}, ${plural(pages, 'page')}`;
      case 'site_tracker':
        return [tr.gscProperty ? 'Search Console' : null, tr.ga4PropertyId ? 'GA4' : null, 'Google Trends', tr.keywords.length ? `live checks of ${plural(tr.keywords.length, 'tracked keyword')}` : null]
          .filter(Boolean)
          .join(' · ');
      case 'content_cadence':
        if (running) return 'Writing this week’s posts';
        if (at !== nextCadence) return 'The next posts in the queue';
        return cadenceDetail(p.queue.next, p.plan, p.build);
      case 'audit':
        return `Technical audit, ${a?.detail ?? 'up to 200 pages'}: skipped when nothing changed on the site`;
    }
  };
  const title = (id: AutomationId) => AUTOMATIONS.find((a) => a.id === id)!.title;
  return [
    ...p.running.map((r) => ({ at: r.startedAt, automation: r.automation, title: title(r.automation), detail: detail(r.automation, r.startedAt, true), running: true })),
    ...p.calendar
      .filter((c) => Date.parse(c.at) <= now + 7 * 864e5)
      .map((c) => ({ at: c.at, automation: c.automation, title: title(c.automation), detail: detail(c.automation, c.at, false), running: false })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

/** What the coming Content Cadence run does: its posts, or why it writes nothing (as n8n decides it, cadence.ts). */
export function cadenceDetail(next: QueueItem[], plan: CadenceWeek, build: Pick<LadderBuild, 'cards'>): string {
  const headOf = (id: string) => build.cards.find((c) => c.id === id)?.head ?? '';
  if (plan.pausedReason === 'pileup')
    return `Writes nothing: ${plural(plan.waitingPublish, 'page')} wait to be published (your limit is ${plan.config.maxWaiting}). Publish them to continue`;
  if (next.length) return next.map((q) => (q.ladder ? `“${q.keyword}” for ladder “${q.ladder.head}”` : `“${q.keyword}” (${q.source === 'striking' ? 'close to page one' : 'rising search'})`)).join(' · ');
  const why: string[] = [];
  if (plan.awaitingApproval.length)
    why.push(
      plan.awaitingApproval.length === 1
        ? `the next page of the Manual ladder “${plan.awaitingApproval[0].ladder?.head || headOf(plan.awaitingApproval[0].ladder?.id ?? '')}” waits for your OK`
        : `${plan.awaitingApproval.length} pages of Manual ladders wait for your OK`,
    );
  if (plan.waitingForSupport.length) why.push(`the main page of “${headOf(plan.waitingForSupport[0])}” waits until half of its supporting pages are live`);
  if (plan.suggestions.length) why.push('opportunity posts are Manual: they are suggestions');
  return why.length ? `Nothing to write automatically: ${why.join('; ')}` : 'Nothing in the queue to write';
}

/** Pages already written for the website: published ones at any age, the others for 180 days (newest first, one per keyword). */
export function writtenPages(logs: ContentLogRow[], ladders: LadderRow[], now = Date.now()): PipelineData['written'] {
  const all: PipelineData['written'] = [
    ...logs
      .filter((l) => l.keyword && (l.status === 'published' || now - Date.parse(l.started_at || '1970-01-01') < 180 * 864e5))
      .map((l) => ({
        keyword: l.keyword,
        status: (l.status === 'published' ? 'published' : 'started') as 'published' | 'started',
        startedAt: l.started_at || '',
        publishedUrl: l.published_url || '',
        source: String(l.request_id || '').startsWith('cad_') ? 'cadence' : l.source || 'app',
      })),
    ...ladders
      .filter((l) => l.keyword && (l.status === 'writing' || l.status === 'published'))
      .map((l) => ({ keyword: l.keyword, status: l.status as 'writing' | 'published', startedAt: '', publishedUrl: l.status === 'published' ? l.target_url || '' : '', source: 'ladder' })),
  ];
  // one entry per keyword: a published page (with its address) wins, then the newest; the content log knows dates the ladder lacks
  const rank = (w: PipelineData['written'][number]) => (w.status === 'published' ? (w.publishedUrl ? 2 : 1) : 0);
  const best = new Map<string, PipelineData['written'][number]>();
  for (const w of all) {
    const cur = best.get(norm(w.keyword));
    if (!cur || rank(w) > rank(cur) || (rank(w) === rank(cur) && w.startedAt > cur.startedAt)) best.set(norm(w.keyword), w);
  }
  return [...best.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 300);
}

/** Keyword ladders with the pages still to write. */
export function ladderSummaries(ladders: LadderRow[]): PipelineData['ladders'] {
  const by = new Map<string, LadderRow[]>();
  for (const l of ladders) if (l.ladder_id) by.set(l.ladder_id, [...(by.get(l.ladder_id) ?? []), l]);
  return [...by.entries()].map(([id, rows]) => ({
    id,
    head: rows[0].head_keyword || '',
    pages: rows.length,
    published: rows.filter((r) => r.status === 'published').length,
    planned: rows
      .filter((r) => String(r.status || 'planned') === 'planned' && r.keyword)
      .sort((a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0) || (Number(a.page_no) || 0) - (Number(b.page_no) || 0))
      .map((r) => ({ keyword: r.keyword, rung: Number(r.rung) || 0, pageNo: Number(r.page_no) || 0, pageType: r.page_type || 'Service Page' })),
    keywords: rows.map((r) => r.keyword).filter(Boolean),
  }));
}

/** Pages the weekly site report found live (Phase 4), newest first, one per address, with their ladder's main keyword. */
export function detectedFeed(detected: DetectedPage[], cards: Pick<LadderCard, 'id' | 'head'>[]): DetectedPage[] {
  const seen = new Set<string>();
  return [...detected]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((d) => {
      const k = d.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((d) => ({ ...d, head: d.head || cards.find((c) => c.id === d.ladderId)?.head || '' }))
    .slice(0, 20);
}

export async function pipelineData(org: OrgRow, site: SiteRow): Promise<PipelineData> {
  return (await pipelineState(org, site)).data;
}

/** The website's keyword-ladder cards, in priority order (after a change from the ladder controls). */
export async function ladderCards(org: OrgRow, site: SiteRow): Promise<LadderCard[]> {
  return (await pipelineState(org, site)).data.ladderCards;
}

/** One keyword ladder of the website (404 when it is not one of this domain's ladders). */
export async function ladderDetailData(org: OrgRow, site: SiteRow, ladderId: string): Promise<LadderDetail> {
  const { ladders } = await pipelineState(org, site);
  const d = ladders.details.get(ladderId);
  if (!d) throw notFound('Keyword ladder not found');
  const pageReports = d.pages.map((p) => p.reportId).filter((id): id is string => !!id);
  return { ...d, reports: await ladderReports(org, site, ladderId, pageReports) };
}

async function pipelineState(org: OrgRow, site: SiteRow): Promise<{ data: PipelineData; ladders: LadderBuild }> {
  const d = site.domain;
  const [x, ladders, queries, trends, logs, history, settingsRows, app, spent, cadenceReport, recentReports, running] = await Promise.all([
    loadBundle(org, site),
    siteRows<LadderRow>('ladders', d, { max: 1000 }),
    siteRows<QueryRow>('queryHistory', d, { sortBy: 'period_end:desc', max: 4000 }),
    siteRows<TrendRow>('trends', d, { sortBy: 'checked_at:desc', max: 300 }),
    siteRows<ContentLogRow>('contentLog', d, { sortBy: 'started_at:desc', max: 1000 }),
    // same reads as the rankings dashboard (shared while in flight, then cached)
    siteRows<RankHistoryRow>('rankHistory', d, { sortBy: 'checked_at:asc', max: 5000 }),
    // created by n8n in Phase 2: missing (or unreadable) means every ladder runs with the defaults
    siteRows<LadderSettingsRow>('ladderSettings', d, { max: 500 }).catch(() => [] as LadderSettingsRow[]),
    ladderAppSources(org, site),
    monthSpend(org.id),
    latestReport(org.id, site.id, ['content_cadence']),
    reportsList(org.id, { siteId: site.id, limit: 60 }),
    scheduledRunning(),
  ]);
  const ownRuns = activeRuns(app.runs);
  const verified = !!site.verifiedAt;
  const engineTracked = x.settings.tracking.tracked && x.settings.tracking.status !== 'paused';
  const status: PipelineData['tracking']['status'] = site.trackingStatus === 'paused' || x.settings.tracking.status === 'paused' ? 'paused' : site.trackingStatus === 'active' || engineTracked ? 'active' : 'not_started';
  const active = status === 'active';
  const m = x.settings.monitors;
  const pagesPerWeek = x.content.cadence && x.content.cadence.status !== 'off' ? x.content.cadence.pagesPerWeek : 0;
  const now = Date.now();
  const tz = config.n8nTimezone;

  const reportOf = (stages: string[]) => recentReports.find((r) => stages.includes(r.stage)) ?? null;
  const lastIso = (...v: (string | null | undefined)[]) => v.filter((s): s is string => !!s).sort().pop() ?? null;

  const aiRuns = x.ai.runs;
  const lastAi = aiRuns[aiRuns.length - 1];
  const snaps = x.backlinks.snapshots;
  const lastBl = snaps[snaps.length - 1];
  const audits = x.technical.audits;
  const lastAudit = audits[audits.length - 1];
  const rungChecks = x.rankings.ladders.flatMap((l) => l.rungs.map((r) => r.lastChecked)).filter(Boolean) as string[];
  // pages the Content Cadence started (its request ids are cad_<week>_<site>_<n>; their source is ladder / striking / trend)
  const cadenceLogs = logs.filter((l) => String(l.request_id || '').startsWith('cad_'));
  const snap = x.search.snapshot;

  const base = (id: AutomationId, on: boolean, reason: string | null, extra: Partial<AutomationStatus>): AutomationStatus => {
    const info = AUTOMATIONS.find((a) => a.id === id)!;
    const state: AutomationStatus['state'] = !verified || status === 'not_started' ? 'needs_setup' : status === 'paused' ? 'paused' : on ? 'on' : 'off';
    return {
      id,
      state,
      reason: state === 'needs_setup' ? (verified ? 'Start weekly tracking to switch it on' : 'Verify the website first') : state === 'paused' ? 'Tracking is paused' : on ? null : reason,
      nextRunAt: state === 'on' ? nextScheduledRun(info.schedule, tz).toISOString() : null,
      lastRunAt: null,
      lastResult: null,
      lastReportId: null,
      detail: null,
      ...extra,
      monthlyCostUsd: Math.round((extra.monthlyCostUsd ?? 0) * 100) / 100,
    };
  };

  const aiReport = reportOf(['ai_visibility']);
  const blReport = reportOf(['backlinks']);
  const rtReport = reportOf(['rank_tracker']);
  const stReport = reportOf(['site_tracker']);
  const auReport = reportOf(['site_audit', 'full_report']);
  const automations: AutomationStatus[] = [
    base('ai_visibility', m?.aiVisibility ?? true, 'Switched off in the monitor settings', {
      lastRunAt: lastIso(lastAi?.checkedAt, aiReport?.receivedAt),
      lastResult: lastAi ? `Named in ${formatPercent(lastAi.mentionRate, 0)} of ${lastAi.answers} answers · share of voice ${formatPercent(lastAi.shareOfVoice, 0)}` : null,
      lastReportId: aiReport?.id ?? null,
      monthlyCostUsd: m?.aiVisibility === false ? 0 : MONITOR_COSTS.aiVisibilityMonthly,
      detail: m ? `${m.aiPromptsMax} questions · ${m.aiEngines.length} engines` : '8 questions · 6 engines (defaults)',
    }),
    base('backlinks', m?.backlinks ?? true, 'Switched off in the monitor settings', {
      lastRunAt: lastIso(lastBl?.checkedAt, blReport?.receivedAt),
      lastResult: lastBl ? `${lastBl.referringDomains} referring domains · ${lastBl.lostLinks} lost · ${lastBl.newLinks} new` : null,
      lastReportId: blReport?.id ?? null,
      monthlyCostUsd: m?.backlinks === false ? 0 : MONITOR_COSTS.backlinksMonthly,
      detail: x.backlinks.prospects.length ? `${x.backlinks.prospects.filter((p) => p.status === 'new').length} new link prospects` : null,
    }),
    base('rank_tracker', x.rankings.ladders.length > 0, 'No keyword ladder yet: plan one with "Rank my site for a keyword"', {
      lastRunAt: lastIso(...rungChecks, rtReport?.receivedAt),
      lastResult: x.rankings.ladders.length
        ? `${x.rankings.ladders.reduce((t, l) => t + l.rungs.filter((r) => r.latestPosition != null && r.latestPosition > 0 && r.latestPosition <= 10).length, 0)} ladder pages in the top 10`
        : null,
      lastReportId: rtReport?.id ?? null,
      monthlyCostUsd: x.rankings.ladders.length ? 0.1 : 0,
      detail: x.rankings.ladders.length ? `${x.rankings.ladders.length} ladder(s) · ${x.rankings.ladders.reduce((t, l) => t + l.pages, 0)} pages` : null,
    }),
    base('site_tracker', true, null, {
      lastRunAt: lastIso(x.settings.tracking.lastRunAt, stReport?.receivedAt),
      lastResult: snap?.gsc.current ? `${snap.gsc.current.clicks} clicks · ${snap.gsc.current.impressions} impressions (28 days)` : x.settings.tracking.lastStatus,
      lastReportId: stReport?.id ?? null,
      monthlyCostUsd: MONITOR_COSTS.siteTrackerMonthly,
      detail: `${x.settings.tracking.keywords.length} tracked keywords${x.settings.tracking.gscProperty ? ' · Search Console' : ''}${x.settings.tracking.ga4PropertyId ? ' · GA4' : ''}`,
    }),
    base('content_cadence', pagesPerWeek > 0, 'Blog posts per week is 0', {
      lastRunAt: lastIso(cadenceLogs[0]?.started_at, cadenceReport?.report.receivedAt),
      lastResult: cadenceLogs.length ? `${cadenceLogs.length} post(s) written by the cadence · ${cadenceLogs.filter((l) => l.status === 'published').length} published` : null,
      lastReportId: cadenceReport?.report.id ?? null,
      monthlyCostUsd: pagesPerWeek * MONITOR_COSTS.weeksPerMonth * MONITOR_COSTS.blogPostEach,
      detail: pagesPerWeek ? `${pagesPerWeek} post(s) every Monday` : null,
    }),
    base('audit', m?.auditMonthly ?? true, 'Switched off in the monitor settings', {
      lastRunAt: lastIso(lastAudit?.auditedAt, auReport?.receivedAt),
      lastResult: lastAudit ? `Health ${lastAudit.healthScore}/100 (${lastAudit.grade}) · ${lastAudit.findings} findings` : null,
      lastReportId: auReport?.id ?? null,
      monthlyCostUsd: m?.auditMonthly === false ? 0 : MONITOR_COSTS.auditMonthly,
      detail: m ? `up to ${m.auditPages} pages${m.auditJs ? ' · JavaScript' : ''}` : 'up to 200 pages',
    }),
  ];

  // ---------- calendar: the next 4 weeks ----------
  const calendar: PipelineData['calendar'] = [];
  const horizon = now + 28 * 864e5;
  for (const a of automations.filter((x) => x.state === 'on')) {
    const info = AUTOMATIONS.find((i) => i.id === a.id)!;
    let at = nextScheduledRun(info.schedule, tz);
    for (let i = 0; i < 6 && at.getTime() <= horizon; i++) {
      calendar.push({ at: at.toISOString(), automation: a.id });
      at = nextScheduledRun(info.schedule, tz, new Date(at.getTime() + 60_000));
    }
  }
  calendar.sort((a, b) => a.at.localeCompare(b.at));

  // ---------- the content queue: the cadence mirror, run by run (cadence.ts) ----------
  const on = (id: AutomationId) => automations.find((a) => a.id === id && a.state === 'on');
  const cadenceOn = !!on('content_cadence');
  const cadenceRuns = cadenceOn ? calendar.filter((c) => c.automation === 'content_cadence').map((c) => c.at) : [];
  const weeks = simulateCadence({ domain: d, pagesPerWeek: cadenceOn ? pagesPerWeek : 0, ladders, queries, trends, logs, settings: settingsRows, history }, cadenceRuns, now);
  const week0 = weeks[0];
  const nextPicks = cadenceOn ? week0.picks : [];
  const queue = {
    next: nextPicks,
    later: week0.candidates.slice(nextPicks.length, nextPicks.length + CADENCE.later),
    waiting: waitingPages(logs, now),
    suggestions: week0.suggestions,
    paused: week0.pausedReason === 'pileup' ? { reason: 'pileup' as const, waiting: week0.waitingPublish, max: week0.config.maxWaiting } : null,
  };
  const cp = cadenceReport?.payload as { upcoming?: { keyword: string; source: string; why: string }[]; paused_reason?: string; waiting_publish?: number; max_waiting?: number } | undefined;

  // ---------- the growth loop ----------
  const recs = recommend(site, x);
  const high = recs.filter((r) => r.priority === 'high').length;
  const ladderPages = x.rankings.ladders.reduce((t, l) => t + l.pages, 0);
  const ladderPublished = x.rankings.ladders.reduce((t, l) => t + l.published, 0);
  const strategy = recentReports.find((r) => r.stage === 'keyword_strategy');
  const positions = [...x.rankings.keywords.map((k) => k.latestPosition), ...x.rankings.ladders.flatMap((l) => l.rungs.map((r) => r.latestPosition))].filter((p): p is number => p != null && p > 0);
  const stages: PipelineStage[] = [
    {
      id: 'research',
      title: 'Research',
      state: ladders.length || strategy ? 'done' : 'waiting',
      headline: ladders.length ? `${new Set(x.rankings.ladders.map((l) => l.headKeyword)).size} target keyword(s)` : strategy ? 'Keyword strategy ready' : 'No target keyword yet',
      detail: ladders.length ? [...new Set(x.rankings.ladders.map((l) => l.headKeyword))].slice(0, 3).join(', ') : 'Find the keywords worth winning for your business',
      action: ladders.length ? { label: 'More keywords', mode: 'discover' } : { label: 'Find keywords', mode: 'discover' },
    },
    {
      id: 'plan',
      title: 'Plan',
      state: ladderPages ? 'done' : 'waiting',
      headline: ladderPages ? `${ladderPages} pages planned` : 'No ladder yet',
      detail: ladderPages ? `${ladderPublished} published · from long-tail pages up to the head term` : 'A keyword ladder turns one target into a page plan',
      action: { label: ladderPages ? 'Plan another ladder' : 'Plan a ladder', mode: 'ladder' },
    },
    {
      id: 'write',
      title: 'Write',
      state: pagesPerWeek ? 'active' : 'waiting',
      headline: pagesPerWeek ? `${pagesPerWeek} post(s) every Monday` : 'Weekly posts off',
      detail: queue.next.length ? `Next: ${queue.next.map((q) => q.keyword).join(', ')}` : queue.later.length ? `${queue.later.length} topics ready` : 'No topics yet — plan a ladder or wait for Search Console data',
      action: { label: 'Posts per week', page: 'settings/tracking' },
    },
    {
      id: 'publish',
      title: 'Publish',
      state: queue.waiting.some((w) => w.days >= 7) ? 'attention' : queue.waiting.length ? 'active' : x.content.items.some((c) => c.status === 'published') ? 'done' : 'waiting',
      headline: queue.waiting.length ? `${queue.waiting.length} page(s) to publish` : `${x.content.items.filter((c) => c.status === 'published').length} published`,
      detail: queue.waiting.length ? 'Publish them on your site, then report each URL so tracking starts' : 'Every written page is live',
      action: queue.waiting.length ? { label: 'Report a published URL', mode: 'published' } : { label: 'Content', page: 'content' },
    },
    {
      id: 'track',
      title: 'Track',
      state: active ? 'active' : 'waiting',
      headline: positions.length ? `${positions.filter((p) => p <= 10).length} keywords in the top 10` : active ? 'Tracking every Monday' : 'Not tracked yet',
      detail: `${x.rankings.keywords.length + ladderPages} keywords checked · Search Console ${x.settings.tracking.gscProperty ? 'connected' : 'not connected'}`,
      action: { label: 'Rankings', page: 'rankings' },
    },
    {
      id: 'monitor',
      title: 'Monitor',
      state: active ? 'active' : 'waiting',
      headline: lastAudit ? `Health ${lastAudit.healthScore}/100` : 'No audit yet',
      detail: [lastAi ? `AI named ${formatPercent(lastAi.mentionRate, 0)}` : null, lastBl ? `${lastBl.referringDomains} ref. domains` : null].filter(Boolean).join(' · ') || 'AI answers, backlinks and technical health',
      action: { label: 'Technical health', page: 'technical' },
    },
    {
      id: 'improve',
      title: 'Improve',
      state: high ? 'attention' : recs.length ? 'active' : 'done',
      headline: `${recs.length} recommendation(s)`,
      detail: high ? `${high} high priority` : 'Nothing urgent',
      action: { label: 'Recommendations', page: 'recommendations' },
    },
  ];

  // ---------- keyword ladders: cards, Needs you, this week ----------
  const runningHere = running.filter((r) => automations.some((a) => a.id === r.automation && a.state === 'on'));
  // the last Monday run said the pile-up guard held, and nothing was published since
  const lastAt = cadenceReport?.report.receivedAt ?? '';
  const lastRunPileup =
    cadenceOn && cp?.paused_reason === 'pileup' && lastAt && now - Date.parse(lastAt) < 8 * 864e5 && !logs.some((l) => String(l.published_at || '') > lastAt)
      ? { at: lastAt, waiting: Number(cp.waiting_publish) || 0, max: Number(cp.max_waiting) || week0.config.maxWaiting }
      : null;
  const build = buildLadders(
    { ladders, history, logs, queries, settings: settingsRows, ...app },
    { ...cadenceSchedule(weeks, cadenceOn), cadenceRuns, rankNextAt: on('rank_tracker')?.nextRunAt ?? null, lastRunPileup },
  );
  const needsYou = sortNeedsYou([...connectionNeeds(site, x, status), ...failedRuns(app.runs), ...refusedPlans(recentReports), ...ladderNeedsYou(build)]);
  const thisWeek = thisWeekItems({ automations, calendar, running: runningHere, queue, plan: week0, x, build, tz });
  const month = new Date().toISOString().slice(0, 7);
  const top10 = build.cards.reduce((t, c) => t + c.top10, 0);

  const data: PipelineData = {
    timezone: tz,
    tracking: { status, verified, reportsToThisApp: x.settings.tracking.reportsToThisApp, engineEmails: config.engineEmails },
    stages,
    automations,
    queue: {
      pagesPerWeek,
      next: queue.next,
      later: queue.later,
      waiting: queue.waiting,
      suggestions: queue.suggestions,
      paused: cadenceOn ? queue.paused : null,
      engineUpcoming: cp?.upcoming ?? [],
      engineUpcomingAt: cadenceReport?.report.receivedAt ?? null,
    },
    calendar,
    activity: recentReports.filter((r) => r.scheduled).slice(0, 15),
    monthlyCostUsd: Math.round(automations.filter((a) => a.state === 'on').reduce((t, a) => t + a.monthlyCostUsd, 0) * 100) / 100,
    // a schedule run covers this website only while its automation is on for it
    running: runningHere,
    activeRuns: ownRuns,
    written: writtenPages(logs, ladders),
    ladders: ladderSummaries(ladders),
    ladderCards: build.cards,
    needsYou,
    thisWeek,
    summary: {
      publishedThisMonth: logs.filter((l) => String(l.published_at || '').startsWith(month)).length,
      top10,
      clicks28d: build.clicks28d,
      spendThisMonthUsd: Math.round(spent * 100) / 100,
      budgetUsd: org.monthlyBudgetUsd,
    },
    automation: build.automation,
    detected: detectedFeed(app.detected ?? [], build.cards),
    autoStartEnabled: config.autoStartLadders,
  };
  return { data, ladders: build };
}
