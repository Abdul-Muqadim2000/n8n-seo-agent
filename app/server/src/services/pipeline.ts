import {
  AUTOMATIONS,
  formatPercent,
  normKeyword,
  AI_PROMPTS_DEFAULT,
  aiPulseQuestions,
  estimateAiPanelCost,
  nextScheduledRun,
  // G12 / G29 (2026-10-13, FIX_PLAN): the ladder's chart marks, its page-change readings and the lineage of its numbers
  buildAnnotations,
  pageChangeTests,
  CHANGE_TEST_METHOD,
  lineage,
  lineagePeriod,
  lineageSample,
  lineageUnknown,
  n8nSiteId,
  cycleKey,
  estimateRunCost,
  upcomingCycles,
  type CycleJobRow,
  type CycleOccurrence,
  type CycleRow,
  type PipelineAutopilot,
  type SkipRow,
  type AuditPoint,
  type Lineage,
  type PagePeriodPoint,
  type AutomationId,
  type AutopilotRowId,
  type MonitorsRow,
  type AutomationStatus,
  type AiTargetRow,
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
  type SitePageRow,
  type ThisWeekItem,
  type TrendRow,
  contentReadiness,
  READINESS_REASON,
} from '@seo/shared';
import { config } from '../config';
import { db } from '../db';
import { monthStartUtc, siteAutopilotRows, usageSince } from './billing';
import { creditsOfUsd, settingsRow, wholeCreditsOfUsd } from './admin/settings';
import type { OrgRow, SiteRow } from '../db/schema';
import { notFound } from '../lib/errors';
import { executions, rows as n8nRows, siteRows, type ExecutionSummary } from '../n8n/client';
import { aiQuotaOf, chosenLadderWriting, competitorsOf, declaredServicesOf, levelOf, navPagesOf, servicesOf, type CadenceSiteRow } from './cadence';
import { skipsOf } from './comingUp';
import { contentCycleNote, cycleIntentOf, loadCycleRows, siteCycleView } from './cycles';
import { engineCostTable } from './engineCost';
import { autopilotNeedsYou, nudgeDue } from './autopilot';
import { schema } from '../db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { scheduleState } from './delivery';
import { annotatePublishNeeds } from './cms/service';
import { CADENCE, simulateCadence, type CadenceWeek } from './cadence';
import { profileNeedsYou } from './readiness';
import { aiPanelNeedsYou } from '@seo/shared';
import { buildLadders, draftQa, ladderAppSources, ladderNeedsYou, ladderReports, sortNeedsYou, type LadderBuild, type LadderSchedule, type SiteRun, type WaitingPage } from './ladders';
import { loadBundle, recommend, type SiteBundle } from './recommendations';
import { gscNow } from './data';
import { latestReport, monthSpend, reportsList } from './runs';

// The pipeline of one website: every automation the engine runs for it (in the website's own weekly cycle since 2026-10-19, the daily
// AI pulse and page watch on the engine's clock), whether it is on, when it runs next, what it did last, and the pages the Content
// Cadence will write next, computed with the cadence's own rules by the mirror in cadence.ts (v5/code/Cadence_Plan.js, keyword-first):
// the keyword ladders the client chose in priority order (Auto, active, at most N at a time, the main page after its support), then what
// the website's autopilot level writes on its own; suggestions with their price for everything else; nothing before the first keyword
// at levels 1 and 2; nothing while too many pages wait to be published; nothing written in the last 90 days, no brand queries.

const norm = normKeyword;

/** A waiting page as the Pipeline returns it; R111 adds whether its draft failed the quality check (and why). */
export type WaitingEntry = PipelineData['queue']['waiting'][number];

/**
 * Pages written and not published (the content log; every age), oldest first.
 * R111 (2026-10-16): a row the engine marked `not_ready` (its last quality round failed) still waits, the pile-up guard counts
 * it, but carries `needsFix` and the QA reasons, so nothing downstream offers to publish it.
 */
export function waitingPages(logs: ContentLogRow[], now = Date.now()): WaitingEntry[] {
  return logs
    .filter((l) => l.status !== 'published' && !l.published_url) // D5: 'started' (the run was spawned) and 'written' (the page exists) both wait
    .map((l) => {
      const qa = draftQa([l]);
      return {
        keyword: l.keyword,
        startedAt: l.started_at,
        days: Math.max(0, Math.round((now - Date.parse(l.started_at || new Date(now).toISOString())) / 864e5)),
        ...(qa.needsFix ? { needsFix: true, reasons: qa.reasons } : {}),
      };
    })
    .sort((a, b) => b.days - a.days);
}

/** R111: the Publish step of the growth loop, drafts that failed their quality check are "needs a fix", never "to publish". */
export function publishStage(waiting: WaitingEntry[], publishedCount: number): PipelineStage {
  const ready = waiting.filter((w) => !w.needsFix);
  const fix = waiting.filter((w) => w.needsFix);
  const headline = [ready.length ? `${ready.length} page(s) to publish` : '', fix.length ? `${fix.length} need${fix.length === 1 ? 's' : ''} a fix` : ''].filter(Boolean).join(' · ');
  return {
    id: 'publish',
    title: 'Publish',
    state: fix.length || ready.some((w) => w.days >= 7) ? 'attention' : ready.length ? 'active' : publishedCount ? 'done' : 'waiting',
    headline: headline || `${publishedCount} published`,
    detail: !waiting.length
      ? 'Every written page is live'
      : [
          ready.length ? 'Publish them on your site, then report each URL so tracking starts' : '',
          fix.length ? `${fix.map((w) => `"${w.keyword}"`).slice(0, 3).join(', ')} did not pass the quality check: finish ${fix.length === 1 ? 'it' : 'them'} by hand (each bracket ${fix.length === 1 ? 'its' : 'their'} report lists), then publish ${fix.length === 1 ? 'it' : 'them'}` : '',
        ]
          .filter(Boolean)
          .join('. '),
    action: ready.length
      ? { label: 'Report a published URL', mode: 'published' }
      : fix.length
        ? { label: 'See what to edit', page: 'content' }
        : { label: 'Content', page: 'content' },
  };
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
    AUTOMATIONS.filter((a) => a.schedule.kind !== 'cycle').map(async (a) => {
      const list = await executions(a.workflow, 'running', 5).catch(() => []);
      const e = list.filter((x) => x.mode === 'trigger' && Date.parse(x.startedAt) >= since).sort((x, y) => y.startedAt.localeCompare(x.startedAt))[0];
      return e ? [{ automation: a.id, startedAt: e.startedAt }] : [];
    }),
  );
  runningCache = { at: Date.now(), value: lists.flat() };
  return runningCache.value;
}

const ACTIVE_RUN = ['submitting', 'accepted', 'running'];

// R104: each schedule's own recent executions (n8n mode "trigger" only is used, in scheduleState), for "last run" and "missed on".
// One scheduled execution covers every website. Cached 5 minutes; a workflow n8n does not answer for is left out (nothing is claimed).
let historyCache: { at: number; value: Record<string, ExecutionSummary[]> } | null = null;

async function scheduledHistory(): Promise<Record<string, ExecutionSummary[]>> {
  if (historyCache && Date.now() - historyCache.at < 5 * 60_000) return historyCache.value;
  const out: Record<string, ExecutionSummary[]> = {};
  await Promise.all(
    [...new Set(AUTOMATIONS.filter((a) => a.schedule.kind !== 'cycle').map((a) => a.workflow))].map(async (wf) => {
      try {
        const [ok, bad] = await Promise.all([executions(wf, 'success', 40), executions(wf, 'error', 20)]);
        out[wf] = [...ok, ...bad];
      } catch {
        /* not known: the automation keeps what the app's own rows say */
      }
    }),
  );
  historyCache = { at: Date.now(), value: out };
  return out;
}

/**
 * R104: the Pipeline's "last run" is the schedule's own last fire, with its real time; a result that came from an on-demand or test run
 * is named as one, and a due time with no fire is "missed on <date>", instead of the newest row of any origin under a "next run
 * Monday" as if the schedule worked. Without the engine's history the automation is left as the app's own rows describe it.
 */
export function withScheduleTruth(list: AutomationStatus[], history: Record<string, ExecutionSummary[]>, tz: string, now = new Date(), siteSince?: string | null): AutomationStatus[] {
  return list.map((a) => {
    const info = AUTOMATIONS.find((x) => x.id === a.id);
    if (!info) return a;
    // Pre-launch run 2026-10-21 (Low): a website added at 14:08 read "scheduled run missed on 2026-10-21" for a 10:30 pulse it did not
    // exist for. A due time before the website was tracked is not one it missed.
    const st = scheduleState(info, history[info.workflow], tz, now, a.lastRunAt, siteSince ? { [info.workflow]: siteSince } : undefined);
    if (!st.known) return a;
    const on = a.state === 'on';
    const note = on ? st.note : st.onDemandAt ? `last run on demand ${st.onDemandAt.slice(0, 16).replace('T', ' ')} UTC` : '';
    return { ...a, lastRunAt: on ? st.lastScheduledAt : st.onDemandAt ? null : a.lastRunAt, lastResult: [note, a.lastResult].filter(Boolean).join(' · ') || null };
  });
}

/**
 * 2026-10-19: a job of the website's own cycle. Its last run is the last time the job finished in one of the website's cycles
 * (seo_cycle_jobs, `done`), and a job that gave up after its attempts is named; without job rows the app's own rows say what they say.
 */
export function withCycleTruth(list: AutomationStatus[], jobs: CycleJobRow[]): AutomationStatus[] {
  return list.map((a) => {
    const info = AUTOMATIONS.find((x) => x.id === a.id);
    if (!info || info.schedule.kind !== 'cycle' || !jobs.length) return a;
    const job = info.schedule.job;
    const mine = jobs.filter((j) => String(j.job) === job).sort((x, y) => String(y.due_at || y.updated_at).localeCompare(String(x.due_at || x.updated_at)));
    const done = mine.find((j) => j.status === 'done' && j.finished_at);
    const latest = mine[0];
    const note = latest && latest.status === 'gave_up' ? `did not run in the cycle of ${String(latest.due_at || latest.updated_at).slice(0, 10)} after 3 attempts` : '';
    return { ...a, lastRunAt: done?.finished_at || a.lastRunAt, lastResult: [note, a.lastResult].filter(Boolean).join(' · ') || null };
  });
}

/** The jobs of the website's cycle the dispatcher is running right now (starting or running), as the Pipeline's "running" list. */
export function cycleRunning(jobs: CycleJobRow[], currentKey: string): PipelineData['running'] {
  return jobs
    .filter((j) => String(j.cycle_key) === currentKey && (j.status === 'starting' || j.status === 'running') && AUTOMATIONS.some((a) => a.schedule.kind === 'cycle' && a.schedule.job === j.job))
    .map((j) => ({ automation: AUTOMATIONS.find((a) => a.schedule.kind === 'cycle' && a.schedule.job === j.job)!.id, startedAt: String(j.started_at || j.updated_at) }));
}

/** R104: the pulse's last run is its row's own `checked_at`, never a time made up from the date (it read 06:30 for an 11:11 fire). */
export function pulseLastRun(daily: { date: string; checkedAt?: string }[]): string | null {
  const d = daily[daily.length - 1];
  if (!d) return null;
  return d.checkedAt && !Number.isNaN(Date.parse(d.checkedAt)) ? d.checkedAt : d.date || null;
}

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
      detail: 'Nothing in the pipeline runs for this website until weekly tracking is on: no rank checks, no weekly pages, no monitors.',
      action: { label: 'Set up tracking', page },
    });
  if (status !== 'active') return out;
  if (x.reportsElsewhere)
    out.push({
      id: 'connection:delivery',
      kind: 'connection',
      severity: 'warning',
      title: 'Send the weekly reports to this app',
      detail: 'The SEO engine tracks this website, but its weekly reports still go to an address set up before this app. Save the tracking settings once and every weekly report lands here.',
      action: { label: 'Open tracking settings', page },
    });
  const snap = x.search.snapshot;
  // the newer of the latest weekly report and the live check on Verification & Google (as Recommendations)
  if (!gscNow(snap, x.settings.tracking).connected)
    out.push({
      id: 'connection:gsc',
      kind: 'connection',
      severity: 'warning',
      title: 'Connect Google Search Console',
      detail: 'Without it the pipeline cannot see clicks, impressions or which of your pages Google shows, and the weekly pages cannot pick searches close to page one.',
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
      title: `"${head}" was not planned`,
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
  p: { automations: AutomationStatus[]; calendar: PipelineData['calendar']; running: PipelineData['running']; queue: { next: QueueItem[] }; plan: CadenceWeek; x: SiteBundle; build: LadderBuild; tz: string; cycles: CycleOccurrence[] },
  now = Date.now(),
): ThisWeekItem[] {
  // the monthly extras run in the website's monthly cycle (AI visibility: Claude, new questions, the market-wide index; backlinks: the full report)
  const firstRun = (iso: string) => p.cycles.some((c) => c.monthly && Math.abs(Date.parse(c.at) - Date.parse(iso)) < 36e5);
  const nextCadence = p.calendar.find((c) => c.automation === 'content_cadence')?.at;
  const pages = p.build.cards.reduce((t, c) => t + c.counts.total, 0);
  const tr = p.x.settings.tracking;
  const detail = (id: AutomationId, at: string, running: boolean): string => {
    const a = p.automations.find((x) => x.id === id);
    switch (id) {
      case 'ai_visibility':
        return `${a?.detail ?? 'Your buyer questions'}${firstRun(at) ? ' · Claude, new questions and the market-wide index (the monthly cycle)' : ''}`;
      case 'ai_pulse':
        return a?.detail ?? 'Your buyer questions on ChatGPT, Gemini and Google AI Mode';
      case 'ai_growth':
        return a?.detail ?? 'Bing / IndexNow submission, AI-readiness checks, earned-media drafts and the questions to win';
      case 'backlinks':
        return firstRun(at) ? 'Full monthly report: lost links, unlinked mentions and outreach drafts' : 'Watches for lost and spammy links';
      case 'link_builder':
        return a?.detail ?? 'New opportunities, contacts, your page and the link text, drafted sequences for your approval';
      case 'rank_tracker':
        return `${plural(p.build.cards.length, 'ladder')}, ${plural(pages, 'page')}`;
      case 'site_tracker':
        return [gscNow(p.x.search.snapshot, tr).connected ? 'Search Console' : null, tr.ga4PropertyId ? 'GA4' : null, 'Google Trends', tr.keywords.length ? `live checks of ${plural(tr.keywords.length, 'tracked keyword')}` : null]
          .filter(Boolean)
          .join(' · ');
      case 'content_cadence':
        if (running) return 'Writing this week\'s pages';
        if (at !== nextCadence) return 'The next pages in the queue';
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
export function cadenceDetail(next: QueueItem[], plan: CadenceWeek, build: Pick<LadderBuild, 'cards'> & { waiting?: WaitingPage[] }): string {
  const headOf = (id: string) => build.cards.find((c) => c.id === id)?.head ?? '';
  if (plan.pausedReason === 'pileup') {
    // R111: a draft that failed its quality check is counted (it waits) but labelled, and it is never told to be published
    const fix = new Set((build.waiting ?? []).filter((w) => w.needsFix).map((w) => normKeyword(w.keyword)));
    const label = (k: string) => (fix.has(normKeyword(k)) ? `"${k}" (needs a fix)` : `"${k}"`);
    const anyFix = plan.waitingKeywords.some((k) => fix.has(normKeyword(k)));
    return (
      `Writes nothing: ${plural(plan.waitingPublish, 'written page')} waiting for publication (pile-up guard, limit ${plan.config.maxWaiting})` +
      (plan.waitingKeywords.length ? `: ${plan.waitingKeywords.slice(0, 4).map(label).join(', ')}${plan.waitingKeywords.length > 4 ? ' ...' : ''}` : '') +
      (anyFix ? '. Publish the ready ones, and finish the others by hand and publish them, to continue' : '. Publish them to continue')
    );
  }
  if (next.length)
    return next
      .map((q) => (q.ladder ? `"${q.keyword}" for ladder "${q.ladder.head}"` : `"${q.keyword}" (${q.source === 'striking' ? 'close to page one' : q.source === 'decay' ? 'refresh of a page losing visitors' : q.source === 'trend' ? 'rising search' : 'AI answer page'})`))
      .join(' · ');
  if (plan.waitingForKeyword) return `Writes nothing: waiting for your first keyword. Choose the keyword you want to be found for${plan.suggestions.length ? ` (${plan.suggestions.length} suggestion${plan.suggestions.length === 1 ? '' : 's'} wait for your OK)` : ''}`;
  if (plan.budget.pagesPerWeek > 0 && plan.budget.room === 0 && plan.budget.spent > 0)
    return `Writes nothing more this week: this cycle's ${plan.budget.pagesPerWeek} page${plan.budget.pagesPerWeek === 1 ? '' : 's'} a week ${plan.budget.spent === 1 ? 'is' : 'are'} already used (${plan.budget.spentKeywords.map((x) => `"${x.keyword}"`).join(', ')})`;
  const why: string[] = [];
  if (plan.awaitingApproval.length)
    why.push(
      plan.awaitingApproval.length === 1
        ? `the next page of the Manual ladder "${plan.awaitingApproval[0].ladder?.head || headOf(plan.awaitingApproval[0].ladder?.id ?? '')}" waits for your OK`
        : `${plan.awaitingApproval.length} pages of Manual ladders wait for your OK`,
    );
  if (plan.waitingForSupport.length) why.push(`the main page of "${headOf(plan.waitingForSupport[0])}" waits until half of its supporting pages are live`);
  if (plan.suggestions.length) why.push(`${plan.suggestions.length} suggestion${plan.suggestions.length === 1 ? ' waits' : 's wait'} for your OK`);
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
      // A-20 (F-A1): `written` / `not_ready` are a ladder row whose page run finished; here they are a page that exists and is not live
      .filter((l) => l.keyword && (l.status === 'writing' || l.status === 'written' || l.status === 'not_ready' || l.status === 'published'))
      .map((l) => ({ keyword: l.keyword, status: (l.status === 'published' ? 'published' : 'writing') as 'writing' | 'published', startedAt: '', publishedUrl: l.status === 'published' ? l.target_url || '' : '', source: 'ladder' })),
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
  const data = (await pipelineState(org, site)).data;
  // G2: a page waiting to be published says what the CMS already holds, and offers to send it from its report
  await annotatePublishNeeds(org.id, site.id, data.needsYou).catch(() => undefined);
  return data;
}

/** The website's keyword-ladder cards, in priority order (after a change from the ladder controls). */
export async function ladderCards(org: OrgRow, site: SiteRow): Promise<LadderCard[]> {
  return (await pipelineState(org, site)).data.ladderCards;
}

/** One keyword ladder of the website (404 when it is not one of this domain's ladders). */
export async function ladderDetailData(org: OrgRow, site: SiteRow, ladderId: string): Promise<LadderDetail> {
  const { ladders, rows } = await pipelineState(org, site);
  const d = ladders.details.get(ladderId);
  if (!d) throw notFound('Keyword ladder not found');
  const pageReports = d.pages.map((p) => p.reportId).filter((id): id is string => !!id);
  // ---- G12 / G29 (2026-10-13, FIX_PLAN): what to mark on this ladder's charts, what its page changes did, and where its numbers come from ----
  const mine = rows.logs.filter((r) => String(r.ladder_id ?? '') === ladderId || d.pages.some((p) => p.keyword && p.keyword === String(r.keyword ?? '')));
  const published = mine
    .filter((r) => String(r.published_at ?? ''))
    .map((r) => ({ publishedAt: String(r.published_at), keyword: String(r.keyword ?? ''), url: String(r.published_url ?? ''), source: String(r.source ?? '') }));
  const checks = d.pages.flatMap((p) => (p.history ?? []).map((h) => String(h.checkedAt).slice(0, 10))).filter(Boolean).sort();
  const from = (d.startDate || checks[0] || '').slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const annotations = buildAnnotations({
    from,
    to,
    published,
    // R66: the marks compare each audit with the one before it, so one report type only (a full report scores on other weights)
    audits: rows.audits.filter((a) => a.reportType !== 'full').map((a) => ({ auditedAt: a.auditedAt, healthScore: a.healthScore, findings: a.findings })),
  });
  const points: PagePeriodPoint[] = rows.queries
    .filter((q) => String(q.page ?? '') && Number(q.position) > 0)
    .map((q) => ({ periodEnd: String(q.period_end ?? ''), page: String(q.page), query: String(q.query ?? ''), position: Number(q.position), impressions: Number(q.impressions) || 0, clicks: Number(q.clicks) || 0 }));
  const changeTests = pageChangeTests({
    points,
    changes: published.map((p) => ({ url: p.url, t0: p.publishedAt.slice(0, 10), change: 'published', keyword: p.keyword })),
  });
  const lineageList: Lineage[] = [
    checks.length
      ? lineage('Position on Google over time', 'serp', { period: lineagePeriod(checks[0], checks[checks.length - 1]), sample: lineageSample(checks.length, 'weekly checks, one results page each'), basis: 'one_sample', note: 'one country and one device at one moment' })
      : lineageUnknown('Position on Google over time', 'this ladder has not been checked on Google yet'),
    d.traffic.points.length
      ? lineage('Clicks and impressions of this ladder\'s pages', 'gsc', { period: lineagePeriod(d.traffic.points[0]!.periodEnd, d.traffic.points[d.traffic.points.length - 1]!.periodEnd), sample: lineageSample(d.traffic.points.length, 'stored 28-day periods'), basis: 'measured' })
      : lineageUnknown('Clicks and impressions of this ladder\'s pages', 'Search Console has not reported traffic for these pages yet'),
    lineage('Expected visits in the top 3', 'model', { period: 'per month, once the pages rank', sample: lineageSample(d.counts.total, 'planned pages'), basis: 'modelled', note: 'searches after results-page click loss × a top-3 click share (modelled, never measured clicks)' }),
    changeTests.length
      ? lineage('Did publishing this page help?', 'gsc_history', { period: lineagePeriod(from, to), sample: lineageSample(changeTests.length, 'page changes read'), basis: 'measured', note: CHANGE_TEST_METHOD })
      : lineageUnknown('Did publishing this page help?', 'no page of this ladder has a recorded publish date yet'),
  ];
  return { ...d, reports: await ladderReports(org, site, ladderId, pageReports), annotations, changeTests, lineage: lineageList };
}

/**
 * The website's page inventory (n8n Data Table `seo_pages`, written by the Site Tracker). That table is keyed by `site_id` (the engine's
 * `site_` + domain id, `n8nSiteId`) and has NO `domain` column. The 2026-10-17 re-rating found this read filtered by `domain` (through
 * `siteRows`), which n8n refuses, and a silent `.catch(() => [])` turned the refusal into "no pages", so the pipeline's cadence mirror never
 * saw a live page. Read by `site_id`; an unreadable inventory still degrades to [] (the cadence runs with the defaults) but is logged.
 */
export async function sitePageInventory(
  domain: string,
  warn: (o: object, msg: string) => void = (o, msg) => console.warn(JSON.stringify({ level: 'warn', msg, ...o })),
): Promise<SitePageRow[]> {
  try {
    return await n8nRows<SitePageRow>('pages', { filters: [{ columnName: 'site_id', condition: 'eq', value: n8nSiteId(domain) }], max: 3000 });
  } catch (e) {
    warn({ site: domain, table: 'seo_pages', err: String((e as Error)?.message ?? e).slice(0, 200) }, 'page inventory not read: the pipeline runs without it');
    return [];
  }
}

async function pipelineState(org: OrgRow, site: SiteRow): Promise<{ data: PipelineData; ladders: LadderBuild; rows: { logs: ContentLogRow[]; queries: QueryRow[]; audits: AuditPoint[] } }> {
  const d = site.domain;
  const sid = n8nSiteId(d);
  const [x, ladders, queries, trends, logs, history, settingsRows, app, , cadenceReport, recentReports, running, aiTargets, sitePages, cyc, engineSite, skips, aiBrands, costTable, monRows, proposals, rechecks, published] = await Promise.all([
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
    settingsRow(), // credits: refreshes the cached credit rate the builders below price in (services/admin/settings.ts)
    latestReport(org.id, site.id, ['content_cadence']),
    reportsList(org.id, { siteId: site.id, limit: 60 }),
    scheduledRunning(),
    // v4.12: the AI growth loop's questions to win (the queued ones are the cadence's AI page of the week)
    siteRows<AiTargetRow>('aiTargets', d, { max: 100 }).catch(() => [] as AiTargetRow[]),
    sitePageInventory(d),   // D11: the website's page inventory (the cadence never writes a second page for a search a live page answers)
    // keyword-first (2026-10-19): the website's cycle, its seo_sites row (services), the client's decisions, the AI brand names, the price of a page
    loadCycleRows(site).catch(() => ({ row: null as CycleRow | null, jobs: [] as CycleJobRow[] })),
    siteRows<CadenceSiteRow>('sites', d, { max: 3 }).then((r) => r[0] ?? null).catch(() => null),
    // seo_skips has no domain column: read only when the engine's site id is this website's (engineSite.ts)
    skipsOf(site).catch(() => [] as SkipRow[]),
    n8nRows<Record<string, unknown>>('cache', { filters: [{ columnName: 'key', condition: 'eq', value: `ai_brands:${sid}` }], max: 3 }).catch(() => [] as Record<string, unknown>[]),
    engineCostTable().catch(() => null),
    siteRows<Record<string, unknown>>('monitors', d, { max: 3 }).catch(() => [] as Record<string, unknown>[]),
    db.select().from(schema.keywordProposals).where(and(eq(schema.keywordProposals.siteId, site.id), inArray(schema.keywordProposals.status, ['pending', 'starting']))).orderBy(desc(schema.keywordProposals.createdAt)).catch(() => []),
    db.select().from(schema.ladderRechecks).where(and(eq(schema.ladderRechecks.siteId, site.id), eq(schema.ladderRechecks.paused, true))).catch(() => []),
    siteRows<ContentLogRow>('contentLog', d, { extra: [{ columnName: 'status', condition: 'eq', value: 'published' }], max: 200 }).catch(() => [] as ContentLogRow[]),
  ]);
  const used = await usageSince(db, org.id, monthStartUtc()).catch(() => null);
  const creditsUsed = used ? Math.round((used.autopilot + used.onDemand) * 100) / 100 : 0;
  const ownRuns = activeRuns(app.runs);
  const verified = !!site.verifiedAt;
  const engineTracked = x.settings.tracking.tracked && x.settings.tracking.status !== 'paused';
  const status: PipelineData['tracking']['status'] = site.trackingStatus === 'paused' || x.settings.tracking.status === 'paused' ? 'paused' : site.trackingStatus === 'active' || engineTracked ? 'active' : 'not_started';
  const active = status === 'active';
  const m = x.settings.monitors;
  const pagesPerWeek = x.content.cadence && x.content.cadence.status !== 'off' ? x.content.cadence.pagesPerWeek : 0;
  const now = Date.now();
  const tz = config.n8nTimezone;
  // the website's own cycle: the engine's row, else the app's anchor and zone
  const intent = cycleIntentOf(site, cyc.row);
  const cycles = intent ? upcomingCycles(intent, now, 6) : [];
  // keyword-first (plan §5.4): pages are written on their own only while a keyword the client chose has pages left (level 3: always)
  const level = levelOf(settingsRows.find((r) => String(r.ladder_id) === '_site'));
  const writingNow = level === 3 || chosenLadderWriting(ladders, settingsRows, level);
  // P1 (2026-10-20, rehearsal §4 item 1): no page is written before the author profile and the business facts are on file (the engine's
  // rule, shared/src/readiness.ts): the profile the engine holds, the facts the client keeps here (sent to the engine on every change)
  const readiness = contentReadiness({ profile: x.content.profile, businessFacts: site.businessFacts });

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

  const base = (id: AutomationId, on: boolean, reason: string | null, { monthlyUsd, ...extra }: Partial<Omit<AutomationStatus, 'monthlyCredits'>> & { monthlyUsd?: number }): AutomationStatus => {
    const info = AUTOMATIONS.find((a) => a.id === id)!;
    const state: AutomationStatus['state'] = !verified || status === 'not_started' ? 'needs_setup' : status === 'paused' ? 'paused' : on ? 'on' : 'off';
    return {
      id,
      state,
      reason: state === 'needs_setup' ? (verified ? 'Start weekly tracking to switch it on' : 'Verify the website first') : state === 'paused' ? 'Tracking is paused' : on ? null : reason,
      nextRunAt: state === 'on' ? (nextScheduledRun(info.schedule, tz, new Date(now), intent)?.toISOString() ?? null) : null,
      lastRunAt: null,
      lastResult: null,
      lastReportId: null,
      detail: null,
      ...extra,
      monthlyCredits: creditsOfUsd(monthlyUsd ?? 0), // the builders below give the month's provider cost; the customer reads credits
    };
  };

  // B4 (pre-launch run 2026-10-21): every month figure on this page comes from the Credits page's own rows (billing.siteAutopilotRows),
  // per automation and in total, so "about N credits a month" here is the company forecast's figure for this website
  const forecastRows = siteAutopilotRows(site, (monRows[0] ?? null) as unknown as MonitorsRow | null, ladders, settingsRows);
  const rowUsd = (id: AutopilotRowId) => forecastRows.find((r) => r.id === id)?.usd ?? 0;
  const aiReport = reportOf(['ai_visibility']);
  // the pulse asks the stored panel without the brand question (asked monthly); before the first run: the setting minus that question
  const panelMax = m?.aiPromptsMax ?? AI_PROMPTS_DEFAULT;
  const storedPanel = x.ai.prompts.filter((p) => p.status !== 'off' && p.kind !== 'brand').length;
  const pulseQuestions = storedPanel ? Math.min(storedPanel, panelMax) : aiPulseQuestions(panelMax);
  // A7 (2026-10-23): above 50 questions each morning asks a rotating sample of the panel (each question N mornings a week), not all of it
  const pulsePlan = estimateAiPanelCost({ panel: panelMax, engines: m?.aiEngines, pulse: true, pulseMode: m?.aiPulseMode === 'auto' ? '' : m?.aiPulseMode, pulsePerWeek: m?.aiPulsePerWeek || null });
  const pulseSampled = pulsePlan.perWeek > 0 && pulsePlan.perWeek < 6;
  const pulseWords = pulseSampled
    ? `about ${Math.min(pulseQuestions, pulsePlan.pulseQuestionsDay)} of your ${pulseQuestions} questions each morning (a rotating sample: each question ${pulsePlan.perWeek} morning${pulsePlan.perWeek === 1 ? '' : 's'} a week)`
    : `${pulseQuestions} questions each morning`;
  const blReport = reportOf(['backlinks']);
  const rtReport = reportOf(['rank_tracker']);
  const stReport = reportOf(['site_tracker']);
  const auReport = reportOf(['site_audit', 'full_report']);
  const automationsRaw: AutomationStatus[] = [
    base('ai_visibility', m?.aiVisibility ?? true, 'Switched off in the monitor settings', {
      lastRunAt: lastIso(lastAi?.checkedAt, aiReport?.receivedAt),
      lastResult: lastAi ? `Named in ${formatPercent(lastAi.mentionRate, 0)} of ${lastAi.answers} answers · share of voice ${formatPercent(lastAi.shareOfVoice, 0)}` : null,
      lastReportId: aiReport?.id ?? null,
      monthlyUsd: rowUsd('ai_visibility'),
      detail: m ? `${m.aiPromptsMax} questions · ${m.aiEngines.length} engines` : `${AI_PROMPTS_DEFAULT} questions · 6 engines (defaults)`,
    }),
    base('ai_pulse', (m?.aiVisibility ?? true) && (m?.aiPulse ?? true), m?.aiVisibility === false ? 'AI visibility is switched off' : 'The daily pulse is switched off in the monitor settings', {
      lastRunAt: pulseLastRun(x.ai.daily as { date: string; checkedAt?: string }[]),
      lastResult: x.ai.daily.length ? (() => { const dd = x.ai.daily[x.ai.daily.length - 1]; return `Named in ${formatPercent(dd.mentionRate, 0)} of ${dd.samples} answers${dd.alerts.length ? ` · ${dd.alerts.length} alert(s)` : ''}`; })() : null,
      lastReportId: reportOf(['ai_pulse'])?.id ?? null,
      monthlyUsd: rowUsd('ai_pulse'),
      // the panel's brand question is asked once a month ("8 questions" on AI visibility, 7 a day here): said, not left to look like a mismatch
      detail: `ChatGPT, Gemini and Google AI Mode · ${pulseWords}${x.ai.prompts.some((p) => p.kind === 'brand' && p.status !== 'off') ? ' (your panel without the brand question, which is asked once a month)' : ''}`,
    }),
    base('ai_growth', (m?.aiVisibility ?? true) && (m?.aiGrowth ?? true), m?.aiVisibility === false ? 'AI visibility is switched off' : 'The AI growth loop is switched off in the monitor settings', {
      lastRunAt: lastIso(x.ai.growth?.checkedAt, reportOf(['ai_growth'])?.receivedAt),
      lastResult: x.ai.growth ? `${x.ai.growth.submitted.bing.submitted + x.ai.growth.submitted.indexnow.submitted} page(s) sent to Bing / IndexNow · ${x.ai.growth.pagesChecked} checked${x.ai.growth.avgScore != null ? ` (avg ${x.ai.growth.avgScore}/100)` : ''} · ${x.ai.growth.earned.length} pages AI cites without you` : null,
      lastReportId: reportOf(['ai_growth'])?.id ?? null,
      // rehearsal 2026-10-20: AI answer pages are written on their own at level 3 only (plan §5.4, as the credits forecast in
      // shared/src/autopilot.ts); at levels 1-2 they are suggestions and cost nothing unless approved, so they are not in this figure
      monthlyUsd: rowUsd('ai_growth'),
      detail: level === 3
        ? `${m?.aiPagesPerMonth ?? 2} AI answer page(s) a month · Bing / IndexNow · earned-media drafts`
        : 'AI answer pages are suggested for your OK · Bing / IndexNow · earned-media drafts',
    }),
    base('link_builder', m?.linkBuilder ?? true, 'The Link Builder is switched off in the monitor settings', {
      lastRunAt: reportOf(['link_builder'])?.receivedAt ?? null,
      lastResult: (() => { const r = reportOf(['link_builder']); const sm = (r?.summary ?? {}) as Record<string, unknown>; return r ? `${Number(sm.drafted) || 0} pitch(es) drafted · ${Number(sm.press) || 0} journalist request(s) · ${Number(sm.listingsMissing) || 0} listing(s) missing` : null; })(),
      lastReportId: reportOf(['link_builder'])?.id ?? null,
      monthlyUsd: rowUsd('link_builder'),
      detail: 'Up to 10 drafted sequences a week · sent from your mailbox after approval',
    }),
    base('backlinks', m?.backlinks ?? true, 'Switched off in the monitor settings', {
      lastRunAt: lastIso(lastBl?.checkedAt, blReport?.receivedAt),
      // R112: the merged count (every source) where the snapshot has one, never DataForSEO's index count shown as "the" count
      lastResult: lastBl ? `${lastBl.unionDomains ?? lastBl.referringDomains} ${lastBl.unionDomains != null ? 'linking sites (all sources)' : 'referring domains (DataForSEO)'} · ${lastBl.lostLinks} lost · ${lastBl.newLinks} new` : null,
      lastReportId: blReport?.id ?? null,
      monthlyUsd: rowUsd('backlinks'),
      detail: x.backlinks.prospects.length ? `${x.backlinks.prospects.filter((p) => p.status === 'new').length} new link prospects` : null,
    }),
    base('rank_tracker', x.rankings.ladders.length > 0, 'No keyword ladder yet: plan one with "Rank my site for a keyword"', {
      lastRunAt: lastIso(...rungChecks, rtReport?.receivedAt),
      lastResult: x.rankings.ladders.length
        ? `${x.rankings.ladders.reduce((t, l) => t + l.rungs.filter((r) => r.latestPosition != null && r.latestPosition > 0 && r.latestPosition <= 10).length, 0)} ladder pages in the top 10`
        : null,
      lastReportId: rtReport?.id ?? null,
      monthlyUsd: rowUsd('rank_tracker'),
      detail: x.rankings.ladders.length ? `${x.rankings.ladders.length} ladder(s) · ${x.rankings.ladders.reduce((t, l) => t + l.pages, 0)} pages` : null,
    }),
    base('site_tracker', true, null, {
      lastRunAt: lastIso(x.settings.tracking.lastRunAt, stReport?.receivedAt),
      lastResult: snap?.gsc.current ? `${snap.gsc.current.clicks} clicks · ${snap.gsc.current.impressions} impressions (28 days)` : x.settings.tracking.lastStatus,
      lastReportId: stReport?.id ?? null,
      monthlyUsd: rowUsd('site_report'),
      detail: `${x.settings.tracking.keywords.length} tracked keywords${gscNow(x.search.snapshot, x.settings.tracking).connected ? ' · Search Console' : ''}${x.settings.tracking.ga4PropertyId ? ' · GA4' : ''}`,
    }),
    base('content_cadence', pagesPerWeek > 0, 'Pages a week is 0', {
      lastRunAt: lastIso(cadenceLogs[0]?.started_at, cadenceReport?.report.receivedAt),
      lastResult: cadenceLogs.length ? `${cadenceLogs.length} page(s) written in your cycles · ${cadenceLogs.filter((l) => l.status === 'published').length} published` : null,
      lastReportId: cadenceReport?.report.id ?? null,
      // keyword-first (plan §5.4): pages are counted only while a keyword the client chose has pages to write (level 3: always)
      monthlyUsd: rowUsd('blog_posts'),
      detail: pagesPerWeek ? `${pagesPerWeek} page(s) a week${writingNow ? '' : ', once you have chosen a keyword'}` : null,
    }),
    base('audit', m?.auditMonthly ?? true, 'Switched off in the monitor settings', {
      lastRunAt: lastIso(lastAudit?.auditedAt, auReport?.receivedAt),
      lastResult: lastAudit ? `Health ${lastAudit.healthScore}/100 (${lastAudit.grade}) · ${lastAudit.findings} findings` : null,
      lastReportId: auReport?.id ?? null,
      monthlyUsd: rowUsd('audit'),
      detail: m ? `up to ${m.auditPages} pages${m.auditJs ? ' · JavaScript' : ''}` : 'up to 200 pages',
    }),
  ];
  // R104: "last run" is the schedule's own last fire; on-demand results and missed due times are named as such
  const siteSince = (site.trackingStartedAt ?? site.createdAt)?.toISOString() ?? null;
  const automations = withCycleTruth(withScheduleTruth(automationsRaw, await scheduledHistory().catch(() => ({}) as Record<string, ExecutionSummary[]>), tz, new Date(now), siteSince), cyc.jobs);

  // ---------- calendar: the next 4 weeks ----------
  const calendar: PipelineData['calendar'] = [];
  const horizon = now + 28 * 864e5;
  for (const a of automations.filter((x) => x.state === 'on' && x.id !== 'ai_pulse')) {   // the daily pulse would fill the calendar: it is listed with the automations
    const info = AUTOMATIONS.find((i) => i.id === a.id)!;
    const s = info.schedule;
    if (s.kind === 'cycle') {
      // the website's own cycles: every one, or the monthly ones for a monthly job
      for (const c of cycles) if (Date.parse(c.at) <= horizon && (!s.monthlyOnly || c.monthly)) calendar.push({ at: c.at, automation: a.id });
      continue;
    }
    let at = nextScheduledRun(s, tz, new Date(now), intent);
    for (let i = 0; i < 6 && at && at.getTime() <= horizon; i++) {
      calendar.push({ at: at.toISOString(), automation: a.id });
      at = nextScheduledRun(s, tz, new Date(at.getTime() + 60_000), intent);
    }
  }
  calendar.sort((a, b) => a.at.localeCompare(b.at));

  // ---------- the content queue: the cadence mirror, run by run (cadence.ts) ----------
  const on = (id: AutomationId) => automations.find((a) => a.id === id && a.state === 'on');
  const cadenceOn = !!on('content_cadence');
  // the cycles the content cadence runs in (the coming 4 weeks): each one is planned with the engine's own rules, one after the other
  const cadenceCycles = cadenceOn ? cycles.filter((c) => Date.parse(c.at) <= horizon) : [];
  const weeks = simulateCadence(
    {
      domain: d,
      siteId: sid,
      siteStatus: status === 'paused' ? 'paused' : 'active',
      pagesPerWeek: cadenceOn ? pagesPerWeek : 0,
      ladders,
      queries,
      trends,
      logs,
      settings: settingsRows,
      history,
      aiTargets,
      aiPagesPerMonth: aiQuotaOf((monRows[0] ?? null) as Parameters<typeof aiQuotaOf>[0]),
      pages: sitePages,
      services: servicesOf(engineSite, site.services),
      // F-KW: what the client said they sell (the app's "What do you sell?" and the engine row's declared_services), the menu pages, the
      // earlier cadence runs (R-K7 counts ladder starts from the previous one)
      declaredServices: declaredServicesOf(engineSite, site.services),
      navPages: navPagesOf(engineSite),
      cycleJobs: cyc.jobs,
      competitors: competitorsOf(engineSite, (monRows[0] ?? null) as Parameters<typeof competitorsOf>[1], site.competitors),
      aiBrands,
      skips,
      estPageUsd: estimateRunCost('keyword', { receiveContent: true, receiveReport: true }, costTable?.calibration ?? null),
      readiness,
    },
    cadenceCycles.map((c) => c.at),
    now,
    cadenceCycles.map((c) => cycleKey(sid, c.date)),
  );
  const week0 = weeks[0];
  const priced = <T extends QueueItem & { estUsd?: number; itemKey?: string; auto?: boolean }>(q: T): QueueItem => {
    const { estUsd, ...rest } = q as T & { estUsd?: number; inTopic?: unknown; chosenBy?: unknown; approved?: unknown };
    delete (rest as Record<string, unknown>).inTopic;
    delete (rest as Record<string, unknown>).chosenBy;
    delete (rest as Record<string, unknown>).approved;
    return { ...rest, credits: wholeCreditsOfUsd(estUsd ?? 0) };
  };
  const nextPicks = cadenceOn ? week0.picks.map(priced) : [];
  const queue = {
    next: nextPicks,
    later: week0.candidates.filter((c) => !nextPicks.some((p) => p.keyword === c.keyword)).slice(0, CADENCE.later).map(priced),
    waiting: waitingPages(logs, now),
    suggestions: week0.suggestions.map(priced),
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
      headline: pagesPerWeek ? `${pagesPerWeek} page(s) a week` : 'Weekly pages off',
      detail: queue.next.length
        ? `Next: ${queue.next.map((q) => q.keyword).join(', ')}`
        : week0.waitingForKeyword
          ? 'Waiting for your first keyword: nothing is written until you choose one'
          : queue.later.length
            ? `${queue.later.length} topics ready`
            : 'No topics yet: choose a keyword to be found for',
      action: week0.waitingForKeyword ? { label: 'Choose a keyword', page: 'pipeline/new' } : { label: 'Pages a week', page: 'settings/tracking' },
    },
    publishStage(queue.waiting, x.content.items.filter((c) => c.status === 'published').length),
    {
      id: 'track',
      title: 'Track',
      state: active ? 'active' : 'waiting',
      headline: positions.length ? `${positions.filter((p) => p <= 10).length} keywords in the top 10` : active ? 'Tracking every week' : 'Not tracked yet',
      detail: `${x.rankings.keywords.length + ladderPages} keywords checked · Search Console ${gscNow(x.search.snapshot, x.settings.tracking).connected ? 'connected' : 'not connected'}`,
      action: { label: 'Rankings', page: 'rankings' },
    },
    {
      id: 'monitor',
      title: 'Monitor',
      state: active ? 'active' : 'waiting',
      headline: lastAudit ? `Health ${lastAudit.healthScore}/100` : 'No audit yet',
      detail: [lastAi ? `AI named ${formatPercent(lastAi.mentionRate, 0)}` : null, lastBl ? `${lastBl.unionDomains ?? lastBl.referringDomains} linking sites` : null].filter(Boolean).join(' · ') || 'AI answers, backlinks and technical health',
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
  const runningHere = [...running, ...cycleRunning(cyc.jobs, String(cyc.row?.current_key ?? ''))].filter((r) => automations.some((a) => a.id === r.automation && a.state === 'on'));
  // the last Monday run said the pile-up guard held, and nothing was published since
  const lastAt = cadenceReport?.report.receivedAt ?? '';
  const lastRunPileup =
    cadenceOn && cp?.paused_reason === 'pileup' && lastAt && now - Date.parse(lastAt) < 8 * 864e5 && !logs.some((l) => String(l.published_at || '') > lastAt)
      ? { at: lastAt, waiting: Number(cp.waiting_publish) || 0, max: Number(cp.max_waiting) || week0.config.maxWaiting }
      : null;
  const build = buildLadders(
    { ladders, history, logs, queries, settings: settingsRows, ...app },
    { ...cadenceSchedule(weeks, cadenceOn), cadenceRuns: cadenceCycles.map((c) => c.at), rankNextAt: on('rank_tracker')?.nextRunAt ?? null, lastRunPileup, held: readiness.ready ? null : READINESS_REASON },
  );
  // keyword-first: the autopilot's own Needs-you items (the keyword to choose, a proposal, a paused ladder, the level)
  // every ladder is won or has no page left to write: the client chooses the next keyword (a paused ladder is the client's own pause)
  const laddersDone = build.cards.length && !build.cards.some((c) => c.counts.planned > 0 && c.status !== 'won')
    ? { head: (build.cards.find((c) => c.status === 'won') ?? build.cards[0]).head, won: build.cards.some((c) => c.status === 'won') }
    : null;
  const approvedCount = skips.filter((r) => String(r.decision) === 'approve').length;
  const dropped = site.autopilotDroppedAt ? { at: site.autopilotDroppedAt, from: site.autopilotDroppedFrom ?? 2 } : null;
  const autopilotItems = autopilotNeedsYou({
    level: week0.level,
    waitingForKeyword: week0.waitingForKeyword && verified,
    laddersDone,
    proposals,
    rechecks,
    dropped,
    nudge: nudgeDue({ level: week0.level, published: published.length, approved: approvedCount, dropped: !!dropped }),
    researching: ownRuns.some((r) => r.mode === 'discover'),
  });
  // P1: the profile and the facts the first page waits for, or (once both are on file) a first page that can be written at once
  const profileItems = profileNeedsYou({ readiness, plan: week0, anyWritten: logs.length > 0, priced: (q) => priced(q) });
  // AI-FOCUS (2026-10-27): the AI question panel's own decisions for the owner (most questions off the keywords they work on; a ladder the panel
  // has no room for, with the price of a bigger panel) - the same warnings as the website's banner, where Accept and "Keep these questions" are
  const aiPanelItems = await import('./consistency').then((m) => m.standingWarnings(org, site)).then((r) => aiPanelNeedsYou(r.warnings)).catch(() => [] as NeedsYouItem[]);
  const needsYou = sortNeedsYou([...connectionNeeds(site, x, status), ...profileItems, ...autopilotItems, ...failedRuns(app.runs), ...refusedPlans(recentReports), ...ladderNeedsYou(build, await settingsRow()), ...aiPanelItems]);
  const thisWeek = thisWeekItems({ automations, calendar, running: runningHere, queue, plan: week0, x, build, tz, cycles });
  const autopilot: PipelineAutopilot = {
    level: week0.level,
    waitingForKeyword: week0.waitingForKeyword,
    reason: week0.reason,
    suggestions: queue.suggestions,
    refused: week0.refused.map((r) => ({ keyword: r.keyword, source: r.source, reason: r.reason, detail: r.detail })),
    dropped: dropped ? { at: dropped.at.toISOString(), from: dropped.from } : null,
    notChosen: week0.ladders.filter((l) => l.role === 'not_chosen').map((l) => l.id),
  };
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
    // B4: the website's line of the Credits page's forecast (its rows, research refresh included), 0 while a person has paused it
    monthlyCredits: automations.some((a) => a.state === 'on') ? creditsOfUsd(forecastRows.reduce((t, r) => t + r.usd, 0)) : 0,
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
      creditsUsedThisMonth: creditsUsed,
    },
    automation: build.automation,
    detected: detectedFeed(app.detected ?? [], build.cards),
    autoStartEnabled: config.autoStartLadders,
    // D9: the content job says what it wrote, or why it wrote nothing, from its cycle's content report
    cycle: siteCycleView(site, cyc.row, cyc.jobs, now, 'viewer', contentCycleNote(cadenceReport?.payload as Record<string, unknown> | undefined)),
    autopilot,
    // P1: is the website ready for a written page (the author profile and the business facts), and what is missing
    readiness,
  };
  // G12 / G29: the rows the ladder detail marks its charts and states its lineage from (already read for the pipeline)
  return { data, ladders: build, rows: { logs, queries, audits: x.technical.audits } };
}
