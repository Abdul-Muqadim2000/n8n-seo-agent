import { eq } from 'drizzle-orm';
import {
  CYCLE_JOBS,
  CYCLE_LOCAL_TIME,
  ENGINE_TIMEZONE,
  WEEKDAY_NAMES,
  cycleDateOf,
  cycleOverdue,
  intentOfRow,
  isValidTimezone,
  localDateOf,
  n8nSiteId,
  nextCycleAfter,
  readCycleIntent,
  roleAtLeast,
  upcomingCycles,
  type CycleIntent,
  type CycleJob,
  type CycleJobRow,
  type CycleJobView,
  type CycleRow,
  type CycleSummary,
  type CycleWeekdayResult,
  type Role,
  type SiteCycleView,
} from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { SiteRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { rows as n8nRows, updateRows } from '../n8n/client';
import { ownEngineRows } from './engineSite';

// A website's own 7-day cycle as the app shows it (SCHEDULING_KEYWORDS_PLAN.md §4, §14.1, §14.6): read from the engine's seo_cycles row
// (one per website, written by the Track flow / Site Kickoff and the Cycle Dispatcher) and seo_cycle_jobs (one row per website x cycle x
// job). The app never writes either, except the weekday (PATCH .../cycle writes ONLY seo_cycles.cycle_weekday: the engine recomputes the
// due time at its next sweep, from the same rule the shared cycle clock mirrors). Before the engine has a row, the app's own anchor
// (sites.trackingStartedAt) and zone (sites.timezone) say when the cycles will run.

export const JOB_LABELS: Record<Exclude<CycleJob, 'cycle'>, string> = {
  ai_visibility: 'AI visibility',
  backlinks: 'Backlinks',
  rank_tracker: 'Rank tracking',
  site_tracker: 'Weekly site report',
  ai_growth: 'AI growth',
  content_cadence: 'Pages for your keywords',
  link_builder: 'Link building',
  audit: 'Monthly technical audit',
  preview: '"Coming up" plan',
};

const S = (v: unknown) => String(v == null ? '' : v).trim();
const yes = (v: unknown) => v === true || /^(true|1|yes|on)$/i.test(S(v));
const iso = (v: unknown): string | null => {
  const t = Date.parse(S(v));
  return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : null;
};

/** The website's zone as the app knows it: its own, else the engine's. */
export const siteTimezone = (site: Pick<SiteRow, 'timezone'>): string => (isValidTimezone(site.timezone) ? site.timezone : ENGINE_TIMEZONE);

/** What the app knows of the website's cycle: the engine's row, else (tracking started, no row yet) the app's own anchor and zone. */
export function cycleIntentOf(site: Pick<SiteRow, 'timezone' | 'trackingStartedAt' | 'cycleWeekday'>, row: Partial<CycleRow> | null): CycleIntent | null {
  if (row && S(row.anchor_at)) return intentOfRow(row);
  if (!site.trackingStartedAt) return null;
  // cycle 0 opens with "Track my site" itself (the engine writes the row and starts it at once), so the next one is the first to come
  const anchorAt = site.trackingStartedAt.toISOString();
  return { anchorAt, tz: siteTimezone(site), weekday: site.cycleWeekday ?? null, localTime: CYCLE_LOCAL_TIME, lastCycleAt: anchorAt };
}

/**
 * D9 (pre-launch run 2026-10-21): what a finished job did, said for each job. The engine's own reason for a finished job is about its
 * ledger row ("finished: its ledger row ... settled (execution 30)"), so the cycle view showed nothing at all, even for a content job that
 * wrote nothing because the page waited for the author profile. A note from the job's own report (`note`) says more when there is one.
 */
export const JOB_DONE_TEXT: Record<Exclude<CycleJob, 'cycle'>, string> = {
  ai_visibility: 'Done: the AI visibility report is under Reports',
  backlinks: 'Done: the backlink report is under Reports',
  rank_tracker: 'Done: the new positions are on Rankings',
  site_tracker: 'Done: the weekly site report is under Reports',
  ai_growth: 'Done: the AI growth report is under Reports',
  content_cadence: 'Done: what it wrote, or why it wrote nothing, is on Content and under Reports',
  link_builder: 'Done: new pitches, if any, are on Link building',
  audit: 'Started the audit: its report arrives under Reports when the crawl is finished',
  preview: 'Done: the plan is under Coming up',
};

/** Words about our own machinery that never reach a customer (an execution, a ledger row, a table, the engine). */
const INTERNAL = /execution|ledger|seo_|n8n|workflow|run guard|skip_jobs/i;

/**
 * A job's reason in the customer's words: the engine's skip reasons are already plain sentences ("skipped: AI visibility is switched off
 * for this website"); anything about executions, ledgers or capacity becomes what it means for the customer. Every finished, skipped or
 * stopped job says something (D9): a done job its JOB_DONE_TEXT, or the note its own report gave.
 */
export function jobReason(status: string, reason: string, attempts: number, job?: string, note?: string): string {
  const r = S(reason);
  switch (status) {
    case 'done':
      return S(note) || (job ? (JOB_DONE_TEXT[job as Exclude<CycleJob, 'cycle'>] ?? '') : '');
    case 'skipped': {
      if (/^set aside/i.test(r)) return 'Not run: the next cycle started before it could run';
      // D9: "already run when tracking was set up (execution 16, finished ...), so cycle 0 does not run it twice"
      if (/already run when tracking was set up/i.test(r)) return 'Already ran when tracking was set up today, so this first run does not repeat it';
      if (/next cycle is due/i.test(r)) return 'Not run: the next weekly run came soon enough to cover it';
      const why = r.replace(/^skipped:\s*/i, '').replace(/\s*\([^)]*\)/g, '').trim();
      return !why || INTERNAL.test(why) ? 'Not needed this week' : why.charAt(0).toUpperCase() + why.slice(1);
    }
    case 'refused':
      return 'Waiting for a free slot: it starts again automatically';
    case 'failed':
      return `Did not finish: it starts again automatically (attempt ${Math.max(1, attempts)} of 3)`;
    case 'gave_up':
      return 'Did not run after 3 attempts. Our team has been told and will look into it.';
    default:
      return '';
  }
}

const JOB_ORDER = new Map<string, number>([...CYCLE_JOBS.map((j, i) => [j.job as string, i + 1] as const), ['preview', 0]]);

/** What a job's own report said about one cycle (D9): `notes[cycleKey][job]`, e.g. the content job that wrote nothing and why. */
export type CycleNotes = Record<string, Partial<Record<Exclude<CycleJob, 'cycle'>, string>>>;

/** One cycle of the website and its jobs (in the cycle's order), from the job rows. */
export function cycleSummary(cycleKey: string, jobs: CycleJobRow[], anchorDate: string, notes: CycleNotes = {}): CycleSummary {
  const mine = jobs.filter((j) => S(j.cycle_key) === cycleKey);
  const marker = mine.find((j) => S(j.job) === 'cycle');
  const list: CycleJobView[] = mine
    .filter((j) => S(j.job) !== 'cycle')
    .sort((a, b) => (JOB_ORDER.get(S(a.job)) ?? 99) - (JOB_ORDER.get(S(b.job)) ?? 99))
    .map((j) => {
      const job = S(j.job) as Exclude<CycleJob, 'cycle'>;
      const status = S(j.status) as CycleJobView['status'];
      return {
        job,
        label: JOB_LABELS[job] ?? job,
        status,
        attempts: Number(j.attempts) || 0,
        monthly: yes(j.monthly),
        reason: jobReason(status, S(j.reason), Number(j.attempts) || 0, job, notes[cycleKey]?.[job]),
        dueAt: iso(j.due_at),
        startedAt: iso(j.started_at),
        finishedAt: iso(j.finished_at),
      };
    });
  const date = cycleDateOf(cycleKey);
  const st = S(marker?.status);
  return {
    cycleKey,
    date,
    monthly: marker ? yes(marker.monthly) : list.some((j) => j.monthly),
    cycle0: !!date && date === anchorDate,
    status: st === 'skipped' ? 'skipped' : st === 'done' || (!marker && list.length > 0 && list.every((j) => ['done', 'skipped', 'gave_up'].includes(j.status))) ? 'done' : 'running',
    jobs: list,
  };
}

/** The whole view (pure): the engine's row and job rows, or the app's own anchor before the engine has a row. */
export function siteCycleView(site: Pick<SiteRow, 'timezone' | 'trackingStartedAt' | 'cycleWeekday' | 'trackingStatus'>, row: Partial<CycleRow> | null, jobs: CycleJobRow[], now: number, role: Role, notes: CycleNotes = {}): SiteCycleView {
  const intent = cycleIntentOf(site, row);
  const r = intent ? readCycleIntent(intent) : null;
  const upcoming = intent ? upcomingCycles(intent, now, 5) : [];
  const status: SiteCycleView['status'] = row && S(row.anchor_at)
    ? S(row.status) === 'paused' || site.trackingStatus === 'paused'
      ? 'paused'
      : S(row.status) === 'off'
        ? 'off'
        : 'active'
    : site.trackingStatus === 'active'
      ? 'active'
      : site.trackingStatus === 'paused'
        ? 'paused'
        : 'not_started';
  const keys = [...new Set(jobs.map((j) => S(j.cycle_key)).filter((k) => cycleDateOf(k)))].sort((a, b) => cycleDateOf(b).localeCompare(cycleDateOf(a)));
  const currentKey = S(row?.current_key) || keys[0] || '';
  const anchorDate = r?.anchorDate ?? '';
  const nextDue = upcoming[0]?.at ?? null;
  return {
    known: !!(row && S(row.anchor_at)),
    status,
    timezone: r?.tz ?? siteTimezone(site),
    weekday: r ? r.weekday : null,
    weekdayName: r ? WEEKDAY_NAMES[r.weekday] : null,
    localTime: r?.localTime ?? CYCLE_LOCAL_TIME,
    anchorAt: intent ? iso(intent.anchorAt) : null,
    monthlyDay: r?.monthlyDay ?? null,
    nextDueAt: status === 'active' ? nextDue : null,
    nextPreviewAt: status === 'active' ? iso(row?.next_preview_at) ?? (upcoming[0]?.previewAt || null) : null,
    lastCycleAt: iso(row?.last_cycle_at),
    current: currentKey ? cycleSummary(currentKey, jobs, anchorDate, notes) : null,
    recent: keys.filter((k) => k !== currentKey).slice(0, 8).map((k) => cycleSummary(k, jobs, anchorDate, notes)),
    upcoming: status === 'active' ? upcoming : [],
    overdue: !!row && status === 'active' && cycleOverdue(row, now),
    // the weekday lives on the engine's row (PATCH writes only seo_cycles.cycle_weekday): before the engine has it, nothing to change yet
    canChangeWeekday: roleAtLeast(role, 'admin') && !!(row && S(row.anchor_at)),
  };
}

// ---------------- n8n ----------------

/**
 * The website's seo_cycles row (null before the engine has one) and its job rows, newest cycles first (up to 400 rows). Only rows that
 * really are this website's: the cycle row must name its domain (two domains can share one engine site id, engineSite.ts), and the job
 * rows, which carry no domain, are used only when the site id's cycle row is this website's and no other domain holds it.
 */
export async function loadCycleRows(site: Pick<SiteRow, 'domain'>, opts: { fresh?: boolean } = {}): Promise<{ row: CycleRow | null; jobs: CycleJobRow[] }> {
  const sid = n8nSiteId(site.domain);
  const [cyc, jobs] = await Promise.all([
    n8nRows<CycleRow>('cycles', { filters: [{ columnName: 'site_id', condition: 'eq', value: sid }], max: 5, fresh: opts.fresh }),
    n8nRows<CycleJobRow>('cycleJobs', { filters: [{ columnName: 'site_id', condition: 'eq', value: sid }], sortBy: 'updated_at:desc', max: 400, fresh: opts.fresh }),
  ]);
  const own = ownEngineRows(cyc, site);
  const foreign = cyc.length > own.length;
  return { row: foreign ? null : (own[0] ?? null), jobs: own.length && !foreign ? jobs : [] };
}

/** GET .../cycle. An engine that cannot be read degrades to the app's own anchor (the view says `known: false`). */
export async function loadSiteCycle(site: SiteRow, role: Role, now = Date.now()): Promise<SiteCycleView> {
  const r = await loadCycleRows(site).catch(() => ({ row: null, jobs: [] as CycleJobRow[] }));
  return siteCycleView(site, r.row, r.jobs, now, role);
}

/** The next cycle on a new weekday: at least CYCLE_SPACING_DAYS after the last one started (or after setup), at 06:00 local. Pure. */
export function weekdayChange(row: Partial<CycleRow> | null, site: Pick<SiteRow, 'timezone' | 'trackingStartedAt' | 'cycleWeekday'>, weekday: number, now: number): CycleWeekdayResult {
  const intent = cycleIntentOf(site, row);
  const r = intent ? readCycleIntent({ ...intent, weekday }) : null;
  const tz = r?.tz ?? siteTimezone(site);
  const last = r ? r.last : 0;
  let at: number | null = null;
  // cycle 0 has not opened yet: it still runs at setup (the anchor), the new weekday applies from cycle 1
  if (r && !last) at = r.anchor;
  else if (r && intent) {
    const next = nextCycleAfter({ tz, weekday, localTime: r.localTime, last });
    // long overdue (a paused website): the engine runs the most recent due cycle once, at its next sweep
    at = next.at > now ? next.at : Date.parse(upcomingCycles({ ...intent, weekday, nextDueAt: '' }, now, 1)[0]?.at ?? '') || null;
  }
  return { weekday, weekdayName: WEEKDAY_NAMES[weekday], nextDueAt: at ? new Date(at).toISOString() : null, timezone: tz };
}

/**
 * PATCH .../cycle {weekday}: writes ONLY seo_cycles.cycle_weekday (plan §14.6; the engine recomputes next_due_at within 5 minutes) and
 * mirrors it on the website. 409 before the engine has the website's cycle (tracking not started yet, or not adopted yet).
 */
export async function setCycleWeekday(site: SiteRow, weekday: number, now = Date.now()): Promise<{ result: CycleWeekdayResult; before: number | null }> {
  const { row } = await loadCycleRows(site, { fresh: true });
  if (!row || !S(row.anchor_at))
    throw new HttpError(409, 'The weekly cycle of this website has not started yet. Start tracking first; the weekday can be changed once its first cycle has started.', 'cycle_not_started');
  const before = row.cycle_weekday === undefined || row.cycle_weekday === null || S(row.cycle_weekday) === '' ? null : Number(row.cycle_weekday);
  // the domain is part of the filter: a row another domain holds under the same site id is never written
  const ok = await updateRows(
    'cycles',
    [
      { columnName: 'site_id', condition: 'eq', value: n8nSiteId(site.domain) },
      { columnName: 'domain', condition: 'eq', value: S(row.domain) },
    ],
    { cycle_weekday: weekday },
  );
  if (!ok) throw new HttpError(502, 'The SEO engine did not save the change. Try again in a minute.', 'engine_failed');
  await db.update(schema.sites).set({ cycleWeekday: weekday, updatedAt: new Date() }).where(eq(schema.sites.id, site.id));
  return { result: weekdayChange({ ...row, cycle_weekday: weekday }, site, weekday, now), before };
}

/**
 * D9: the content job's note for its cycle, from the content report of that cycle (Cadence_Note / Cadence_Status carry `cycle_key`): the
 * pages it started, or why it wrote nothing (the engine's reason, e.g. "waiting for your author profile and business facts: ...").
 */
export function contentCycleNote(payload: Record<string, unknown> | null | undefined): CycleNotes {
  const p = payload ?? {};
  const key = S(p.cycle_key);
  if (!key) return {};
  const pages = Array.isArray(p.pages) ? (p.pages as Record<string, unknown>[]).map((x) => S(x?.keyword)).filter(Boolean) : [];
  const why = S(p.reason).replace(/\s*\([^)]*execution[^)]*\)/gi, '');
  const text = pages.length
    ? `Started ${pages.length === 1 ? '1 page' : `${pages.length} pages`}: ${pages.slice(0, 3).map((k) => `"${k}"`).join(', ')}${pages.length > 3 ? ' and more' : ''}`
    : why && !INTERNAL.test(why)
      ? `Wrote nothing: ${why.length > 240 ? `${why.slice(0, 239).replace(/\s+\S*$/, '')} (more on Content)` : why}`
      : '';
  return text ? { [key]: { content_cadence: text } } : {};
}

/** The local date in the website's zone (for "Coming up on Wednesday"). */
export const localDayName = (tz: string, at: string): string => {
  const t = Date.parse(at);
  return Number.isFinite(t) ? WEEKDAY_NAMES[localDateOf(isValidTimezone(tz) ? tz : ENGINE_TIMEZONE, t).weekday] : '';
};

export const engineTimezone = () => (isValidTimezone(config.n8nTimezone) ? config.n8nTimezone : ENGINE_TIMEZONE);
