import { gte } from 'drizzle-orm';
import {
  SCHEDULES,
  INDEX_COVERAGE_SCHEDULE,
  cycleOverdue,
  n8nSiteId,
  nextScheduledRun,
  type AutomationInfo,
  type CycleJobRow,
  type CycleRow,
  type ScheduleInfo,
  type AlertDelivery,
  type DeliveryCount,
  type DeliveryReport,
  type DeliveryWeek,
  type MissedSchedule,
} from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import { executions, rows, type ExecutionSummary } from '../n8n/client';
import { JOB_LABELS } from './cycles';

// G21 (2026-10-13, system review FIX_PLAN G21; it depends on D25a and on R6): nothing measured whether what should have run did run,
// or whether what ran reached the customer. The engine's own failure watcher (engineFailures.ts) marks a run failed, and n8n's Error
// Handler records an alert, but no figure anywhere said "99 of 100 runs were delivered last week", or that a Monday schedule never
// fired at all, which on a Mac-hosted stack happens whenever the machine sleeps through the schedule time (D25a).
//
// Three things are measured here, all over whole weeks (Monday to Monday, UTC):
//   * ON DEMAND, the runs the app started. `runs` rows: delivered means the run completed AND at least one report arrived, because a
//     run that finishes with no report delivered nothing. A run still going is left OUT of the rate instead of counted against it; a
//     run that never finished and is older than n8n's own execution timeout is `stuck` and does count against it.
//   * SCHEDULED, the ten weekly / daily / monthly schedules (the nine automations and the daily Page Watch, R103). A scheduled run has no `runs` row (its report arrives by callback),
//     so the measure is the schedule's own clock against n8n's execution history: every time it should have fired, whether an
//     execution exists near that time, and whether that execution succeeded. The fires it left behind are the MISSED SCHEDULES.
//   * ALERTS, `seo_ops_alerts`, now that R6 writes `delivered` and `channels` back on the row. Before that every row sat at
//     "pending" and this could not be measured at all.
//   * 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4 / §8): the weekly work no longer fires on a shared clock. It runs in each website's own
//     cycle, so its side is measured per website from the Cycle Dispatcher's own records: every job of a cycle due in the week (seo_cycle_jobs)
//     that finished is delivered; one that gave up after 3 attempts, or is still not done a day after its cycle was due, is MISSED; a
//     cycle more than a day overdue that never opened (seo_cycles) is missed too. Skipped jobs (switched off, nothing to do) are not counted.
//     Only the daily schedules (the AI Pulse, Page Watch) are still measured against n8n's executions.
//
// The arithmetic is pure (`deliveryReport`) so it can be tested without a database or n8n; `loadDeliveryReport` only fetches.

/** How long after its own start a run that never finished is counted as lost rather than running (n8n's execution timeout). */
export const STUCK_MINUTES = 180;
/** How late a schedule may fire and still count as having run: a Mac that woke up late is late, not missing. */
export const SCHEDULE_GRACE_MINUTES = 90;
/** The target the fix plan sets for the delivery rate. */
export const TARGET_PCT = 99;
/** How many whole weeks the admin page shows. */
export const WEEKS = 6;

const DAY_MS = 86_400_000;

export interface RunFact {
  mode: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  reportCount: number;
}
export interface AlertFact {
  delivered?: unknown;
  channels?: unknown;
}

/** The Monday 00:00 UTC of the week `d` falls in. */
export function weekStart(d: Date): Date {
  const u = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const back = (new Date(u).getUTCDay() + 6) % 7; // Monday = 0
  return new Date(u - back * DAY_MS);
}

/** The last `count` whole-or-current weeks, oldest first, as Monday 00:00 UTC dates. */
export function weeksBack(count: number, now: Date): Date[] {
  const thisWeek = weekStart(now).getTime();
  return Array.from({ length: count }, (_, i) => new Date(thisWeek - (count - 1 - i) * 7 * DAY_MS));
}

/** Every time a schedule should have fired in [from, to), on n8n's own clock (DST-safe, `nextScheduledRun` does the work). A cycle job has no
 *  shared clock (it runs in each website's own cycle, measured by `cycleWeek`): none. */
export function scheduledTimes(s: AutomationInfo['schedule'], tz: string, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  if (s.kind === 'cycle') return out;
  // nextScheduledRun returns the first fire strictly after its `from`, so stepping from one millisecond before the window
  // includes a fire exactly on the boundary.
  let cursor = new Date(from.getTime() - 1);
  for (let i = 0; i < 400; i++) {
    const next = nextScheduledRun(s, tz, cursor);
    if (!next || !(next.getTime() > cursor.getTime())) break;
    if (next.getTime() >= to.getTime()) break;
    out.push(next);
    cursor = next;
  }
  return out;
}

const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

const count = (c: Omit<DeliveryCount, 'settled' | 'ratePct'>): DeliveryCount => {
  const settled = c.delivered + c.failed + c.noReport + c.stuck;
  return { ...c, settled, ratePct: pct(c.delivered, settled) };
};

/** The on-demand side of one week from the app's own run rows. */
export function onDemandWeek(runs: RunFact[], from: Date, to: Date, now: Date): DeliveryCount {
  const mine = runs.filter((r) => r.createdAt >= from && r.createdAt < to);
  let delivered = 0, failed = 0, noReport = 0, stuck = 0, inFlight = 0;
  for (const r of mine) {
    if (r.status === 'completed') {
      if (r.reportCount > 0) delivered++;
      else noReport++;
    } else if (r.status === 'failed') failed++;
    else if (now.getTime() - r.createdAt.getTime() > STUCK_MINUTES * 60_000) stuck++;
    else inFlight++;
  }
  return count({ started: mine.length, delivered, failed, noReport, stuck, inFlight });
}

/**
 * R103: only the executions a SCHEDULE started. n8n marks them `mode: "trigger"`; a run started by the Test Runner, another workflow or
 * the API is `integrated` / `webhook` / `manual` and must not hide a fire that never happened. Summaries without a mode (older n8n
 * answers, the tests' own fixtures) are taken as they come.
 */
export const scheduledExecs = (list: ExecutionSummary[] | undefined): ExecutionSummary[] => (list ?? []).filter((e) => !e.mode || e.mode === 'trigger');

/** R103: the moment from which a schedule is measured, its own `since`, or the workflow's `createdAt` the engine reported. */
export const measuredFrom = (a: Pick<ScheduleInfo, 'since' | 'workflow'>, created?: Record<string, string>): number => {
  const v = [created?.[a.workflow], a.since].map((x) => (x ? Date.parse(x) : NaN)).filter(Number.isFinite);
  return v.length ? Math.max(...v) : -Infinity;
};

/** The scheduled side of one week: the schedules' own clock against n8n's execution history. */
export function scheduledWeek(
  automations: (AutomationInfo | ScheduleInfo)[],
  execs: Record<string, ExecutionSummary[]>,
  tz: string,
  from: Date,
  to: Date,
  now: Date,
  created?: Record<string, string>,
): { counts: DeliveryCount; missed: MissedSchedule[] } {
  const grace = SCHEDULE_GRACE_MINUTES * 60_000;
  const end = Math.min(to.getTime(), now.getTime() - grace); // a fire that is still inside its grace window is not late yet
  let delivered = 0, failed = 0, started = 0;
  const missed: MissedSchedule[] = [];
  for (const a of automations) {
    if (a.schedule.kind === 'cycle') continue; // measured per website (cycleWeek)
    const known = scheduledExecs(execs[a.workflow]).map((e) => ({ at: Date.parse(e.startedAt), status: String(e.status) })).filter((e) => Number.isFinite(e.at));
    const existed = measuredFrom(a, created);
    for (const at of scheduledTimes(a.schedule, tz, from, to)) {
      if (at.getTime() > end) continue;
      if (at.getTime() < existed) continue; // R103: the schedule did not exist yet, not a fire, and not a missed one
      started++;
      // the schedule's own fire, or the nearest execution of that workflow inside the grace window
      const hit = known.filter((e) => Math.abs(e.at - at.getTime()) <= grace).sort((x, y) => Math.abs(x.at - at.getTime()) - Math.abs(y.at - at.getTime()))[0];
      if (!hit) {
        missed.push({ automation: a.id, title: a.title, workflow: a.workflow, expectedAt: at.toISOString() });
        continue;
      }
      if (hit.status === 'success') delivered++;
      else failed++;
    }
  }
  // a schedule that never fired is not "in flight" and not a failure of the engine's logic, it is a missed run, and it counts
  // against the rate, which is the whole point of showing it (D25a).
  return { counts: count({ started, delivered, failed, noReport: 0, stuck: missed.length, inFlight: 0 }), missed };
}

/** How long after its cycle was due a job that has not finished counts as missed (the engine retries within it). */
export const CYCLE_JOB_MISSED_HOURS = 24;

/**
 * The cycle side of one week: every job of a website's cycle that was due in [from, to) (seo_cycle_jobs), and the cycles that should have
 * opened in the week and did not (seo_cycles, more than a day overdue). `domains` names the websites in the missed list.
 */
export function cycleWeek(jobs: CycleJobRow[], cycles: CycleRow[], from: Date, to: Date, now: Date, domains: Map<string, string> = new Map()): { counts: DeliveryCount; missed: MissedSchedule[] } {
  let delivered = 0, failed = 0, stuck = 0, inFlight = 0, started = 0;
  const missed: MissedSchedule[] = [];
  const nameOf = (siteId: string) => domains.get(siteId) || cycles.find((c) => c.site_id === siteId)?.domain || siteId.replace(/^site_/, '');
  for (const j of jobs) {
    const job = String(j.job ?? '');
    if (!job || job === 'cycle') continue;
    const due = Date.parse(String(j.due_at || j.started_at || ''));
    if (!Number.isFinite(due) || due < from.getTime() || due >= to.getTime()) continue;
    const st = String(j.status ?? '');
    if (st === 'skipped') continue;
    started++;
    if (st === 'done') {
      delivered++;
      continue;
    }
    const late = now.getTime() - due > CYCLE_JOB_MISSED_HOURS * 3_600_000;
    if (st === 'gave_up' || late) {
      stuck++;
      missed.push({ automation: job, title: `${JOB_LABELS[job as keyof typeof JOB_LABELS] ?? job} · ${nameOf(String(j.site_id))}`, workflow: String(j.workflow_id ?? ''), expectedAt: new Date(due).toISOString() });
    } else inFlight++;
  }
  for (const c of cycles) {
    const due = Date.parse(String(c.next_due_at ?? ''));
    if (!Number.isFinite(due) || due < from.getTime() || due >= to.getTime() || !cycleOverdue(c, now.getTime())) continue;
    started++;
    stuck++;
    missed.push({ automation: 'cycle', title: `Weekly cycle · ${nameOf(String(c.site_id))}`, workflow: 'SEOagentCycleDsp', expectedAt: new Date(due).toISOString() });
  }
  return { counts: count({ started, delivered, failed, noReport: 0, stuck, inFlight }), missed };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// R104 (2026-10-16): what the Pipeline says about one schedule. It showed the newest report or data row of ANY origin as each
// automation's "last run", so five schedules that had never fired on their own showed a last run (the on-demand and Test Runner runs
// of the evening) and a "next run Monday" as if the schedule worked. Only n8n's execution mode tells a scheduled fire from an on-demand
// run (an on-demand pulse even replaces the day's seo_ai_daily row), so this reads the schedule's own `trigger` executions.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ScheduleState {
  /** whether the engine's execution history could be read at all; when it could not, nothing is claimed either way */
  known: boolean;
  /** the schedule's own last fire (its real start time), or null when it has not fired in the history read */
  lastScheduledAt: string | null;
  /** the most recent due time that nothing fired for (a late fire still counts as a fire) */
  missedAt: string | null;
  /** the newest result of this automation for the site came from a run the schedule did not start */
  onDemandAt: string | null;
  /** the words for the Pipeline, e.g. "scheduled run missed on 2026-10-12 · last run on demand 2026-10-12 19:48 UTC" */
  note: string;
}

/** How long after a scheduled fire its own results may still arrive (n8n's execution timeout is 30 minutes; a slow day is slower). */
const RESULT_WINDOW_MS = 3 * 3_600_000;
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export function scheduleState(
  a: Pick<ScheduleInfo, 'schedule' | 'since' | 'workflow'>,
  execs: ExecutionSummary[] | undefined,
  tz: string,
  now: Date,
  /** the newest result the app holds for this automation and site (report or data row), whoever started it */
  dataLastAt?: string | null,
  created?: Record<string, string>,
): ScheduleState {
  if (!execs || a.schedule.kind === 'cycle') return { known: false, lastScheduledAt: null, missedAt: null, onDemandAt: null, note: '' };
  const grace = SCHEDULE_GRACE_MINUTES * 60_000;
  const fires = scheduledExecs(execs).map((e) => Date.parse(e.startedAt)).filter(Number.isFinite).sort((x, y) => y - x);
  const last = fires.length ? fires[0] : null;
  const existed = measuredFrom(a, created);
  const dues = scheduledTimes(a.schedule, tz, new Date(now.getTime() - 35 * DAY_MS), new Date(now.getTime() - grace)).filter((d) => d.getTime() >= existed);
  const due = dues.length ? dues[dues.length - 1].getTime() : null;
  const missed = due != null && !fires.some((t) => t >= due - grace) ? due : null;
  const data = dataLastAt ? Date.parse(dataLastAt) : NaN;
  const onDemand = Number.isFinite(data) && (last == null || data > last + RESULT_WINDOW_MS) ? data : null;
  const note = [missed != null ? `scheduled run missed on ${new Date(missed).toISOString().slice(0, 10)}` : '', onDemand != null ? `last run on demand ${utc(onDemand)}` : '']
    .filter(Boolean)
    .join(' · ');
  return {
    known: true,
    lastScheduledAt: last != null ? new Date(last).toISOString() : null,
    missedAt: missed != null ? new Date(missed).toISOString() : null,
    onDemandAt: onDemand != null ? new Date(onDemand).toISOString() : null,
    note,
  };
}

/** The ops-alert side: which channel carried each alert (R6). */
export function alertDelivery(alerts: AlertFact[]): AlertDelivery {
  const byChannel: Record<string, number> = {};
  let delivered = 0, pending = 0, failed = 0, deduped = 0, notSent = 0;
  for (const a of alerts) {
    const d = String(a.delivered ?? '').trim().toLowerCase();
    if (!d || d === 'pending') { pending++; continue; }
    if (d === 'failed') { failed++; continue; }
    if (d === 'deduped') { deduped++; continue; }
    if (d === 'not_sent') { notSent++; continue; }
    delivered++;
    for (const c of d.split(',').map((x) => x.trim()).filter(Boolean)) byChannel[c] = (byChannel[c] ?? 0) + 1;
  }
  // `deduped` is a deliberate non-send (the same failure inside the dedupe window), so it is not held against the rate
  const settled = delivered + pending + failed + notSent;
  return { total: alerts.length, delivered, pending, failed, deduped, notSent, ratePct: pct(delivered, settled), byChannel };
}

export interface DeliveryInput {
  now: Date;
  weeks: number;
  runs: RunFact[];
  execs: Record<string, ExecutionSummary[]>;
  alerts: AlertFact[];
  timezone: string;
  automations?: (AutomationInfo | ScheduleInfo)[];
  notes?: string[];
  /** R103: the workflows' own `createdAt`, when the engine answered (overrides the built-in `since` when it is later) */
  created?: Record<string, string>;
  /** 2026-10-19: the websites' cycles and their jobs (null = could not be read) */
  cycles?: { rows: CycleRow[]; jobs: CycleJobRow[]; domains?: Map<string, string> } | null;
}

/** The whole report, from facts only, no database, no n8n. */
export function deliveryReport(input: DeliveryInput): DeliveryReport {
  // X10: a schedule with no known start (no built-in `since`, no start read from the engine) is not measured at all, never "missed forever"
  const automations = (input.automations ?? SCHEDULES).filter((a) => !a.sinceFromData || a.since || input.created?.[a.workflow]);
  const notes = [...(input.notes ?? [])];
  const weeks: DeliveryWeek[] = weeksBack(input.weeks, input.now).map((from) => {
    const to = new Date(from.getTime() + 7 * DAY_MS);
    const onDemand = onDemandWeek(input.runs, from, to, input.now);
    const daily = scheduledWeek(automations, input.execs, input.timezone, from, to, input.now, input.created);
    const cyc = input.cycles ? cycleWeek(input.cycles.jobs, input.cycles.rows, from, to, input.now, input.cycles.domains) : null;
    const scheduled = cyc ? count({ started: daily.counts.started + cyc.counts.started, delivered: daily.counts.delivered + cyc.counts.delivered, failed: daily.counts.failed + cyc.counts.failed, noReport: 0, stuck: daily.counts.stuck + cyc.counts.stuck, inFlight: daily.counts.inFlight + cyc.counts.inFlight }) : daily.counts;
    const missed = [...daily.missed, ...(cyc?.missed ?? [])].sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
    const settled = onDemand.settled + scheduled.settled;
    const overallPct = pct(onDemand.delivered + scheduled.delivered, settled);
    return { week: from.toISOString().slice(0, 10), onDemand, scheduled, overallPct, belowTarget: overallPct != null && overallPct < TARGET_PCT, missed };
  });
  if (!Object.keys(input.execs).length) notes.push('No execution history could be read from the engine, so the daily schedules of every week are unmeasured, not perfect.');
  if (input.cycles === null) notes.push("The websites' weekly cycles could not be read from the engine, so the weekly work of every week is unmeasured, not perfect.");
  // R103: say where the measurement starts, so an empty early week reads as "not measured yet" rather than as perfect or as 0%
  const firstFrom = Math.min(...automations.map((a) => measuredFrom(a, input.created)));
  if (Number.isFinite(firstFrom) && weeksBack(input.weeks, input.now)[0].getTime() < firstFrom)
    notes.push(`Each schedule is counted from the day it was created (the first on ${new Date(firstFrom).toISOString().slice(0, 10)}); a week before a schedule existed is unmeasured for it, not missed. Only runs the schedule itself started count as its fires; a test or on-demand run does not.`);
  if (!input.alerts.length) notes.push('No ops alert has been recorded yet, so there is no alert delivery rate to show.');
  return { generatedAt: input.now.toISOString(), timezone: input.timezone, targetPct: TARGET_PCT, weeks, alerts: alertDelivery(input.alerts), notes };
}

/** Reads the facts (app runs, n8n executions, ops alerts) and returns the report. Platform admin only. */
export async function loadDeliveryReport(now = new Date()): Promise<DeliveryReport> {
  const from = weeksBack(WEEKS, now)[0];
  const runRows = await db
    .select({ mode: schema.runs.mode, status: schema.runs.status, createdAt: schema.runs.createdAt, completedAt: schema.runs.completedAt, reportCount: schema.runs.reportCount })
    .from(schema.runs)
    .where(gte(schema.runs.createdAt, from));
  const execs: Record<string, ExecutionSummary[]> = {};
  const notes: string[] = [];
  const failedWorkflows: string[] = [];
  // X10: the daily index check is counted from its first run row (any website); before that it is not measured
  const created: Record<string, string> = {};
  try {
    const first = (await rows<{ run_at?: string }>('indexRuns', { sortBy: 'run_at:asc', max: 1 }))[0];
    if (first?.run_at && Number.isFinite(Date.parse(String(first.run_at)))) created[INDEX_COVERAGE_SCHEDULE.workflow] = String(first.run_at);
  } catch {
    /* not known: the schedule is left out (no start) */
  }
  const daily = SCHEDULES.filter((a) => a.schedule.kind !== 'cycle' && (!a.sinceFromData || a.since || created[a.workflow]));
  for (const wf of [...new Set(daily.map((a) => a.workflow))]) {
    try {
      const [ok, bad] = await Promise.all([executions(wf, 'success', 150), executions(wf, 'error', 50)]);
      execs[wf] = [...ok, ...bad];
    } catch {
      failedWorkflows.push(wf);
    }
  }
  if (failedWorkflows.length) notes.push(`The engine did not answer for ${failedWorkflows.length} of ${new Set(daily.map((a) => a.workflow)).size} daily schedules, so their weeks are unmeasured rather than perfect.`);
  let cycles: DeliveryInput['cycles'] = null;
  try {
    const [cycleRows, jobRows, siteRows] = await Promise.all([
      rows<CycleRow>('cycles', { max: 5000 }),
      rows<CycleJobRow>('cycleJobs', { sortBy: 'updated_at:desc', max: 20000 }),
      db.select({ domain: schema.sites.domain }).from(schema.sites),
    ]);
    const fromMs = from.getTime();
    cycles = { rows: cycleRows, jobs: jobRows.filter((j) => Date.parse(String(j.due_at || j.started_at || '')) >= fromMs), domains: new Map(siteRows.map((x) => [n8nSiteId(x.domain), x.domain])) };
  } catch {
    cycles = null;
  }
  let alerts: AlertFact[] = [];
  try {
    alerts = await rows<AlertFact>('opsAlerts', { max: 500 });
  } catch {
    notes.push('The ops-alert table could not be read, so the alert delivery rate is unknown.');
  }
  return deliveryReport({ now, weeks: WEEKS, runs: runRows.map((r) => ({ ...r, reportCount: Number(r.reportCount ?? 0) })), execs, alerts, timezone: config.n8nTimezone, notes, cycles, created });
}
