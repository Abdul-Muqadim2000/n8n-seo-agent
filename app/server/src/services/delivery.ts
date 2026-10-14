import { gte } from 'drizzle-orm';
import { AUTOMATIONS, nextScheduledRun, type AutomationInfo, type AlertDelivery, type DeliveryCount, type DeliveryReport, type DeliveryWeek, type MissedSchedule } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import { executions, rows, type ExecutionSummary } from '../n8n/client';

// G21 (2026-10-13, system review FIX_PLAN G21; it depends on D25a and on R6): nothing measured whether what should have run did run,
// or whether what ran reached the customer. The engine's own failure watcher (engineFailures.ts) marks a run failed, and n8n's Error
// Handler records an alert, but no figure anywhere said "99 of 100 runs were delivered last week" — or that a Monday schedule never
// fired at all, which on a Mac-hosted stack happens whenever the machine sleeps through the schedule time (D25a).
//
// Three things are measured here, all over whole weeks (Monday to Monday, UTC):
//   * ON DEMAND — the runs the app started. `runs` rows: delivered means the run completed AND at least one report arrived, because a
//     run that finishes with no report delivered nothing. A run still going is left OUT of the rate instead of counted against it; a
//     run that never finished and is older than n8n's own execution timeout is `stuck` and does count against it.
//   * SCHEDULED — the nine weekly / daily / monthly automations. A scheduled run has no `runs` row (its report arrives by callback),
//     so the measure is the schedule's own clock against n8n's execution history: every time it should have fired, whether an
//     execution exists near that time, and whether that execution succeeded. The fires it left behind are the MISSED SCHEDULES.
//   * ALERTS — `seo_ops_alerts`, now that R6 writes `delivered` and `channels` back on the row. Before that every row sat at
//     "pending" and this could not be measured at all.
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

/** Every time a schedule should have fired in [from, to), on n8n's own clock (DST-safe — `nextScheduledRun` does the work). */
export function scheduledTimes(s: AutomationInfo['schedule'], tz: string, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  // nextScheduledRun returns the first fire strictly after its `from`, so stepping from one millisecond before the window
  // includes a fire exactly on the boundary.
  let cursor = new Date(from.getTime() - 1);
  for (let i = 0; i < 400; i++) {
    const next = nextScheduledRun(s, tz, cursor);
    if (!(next.getTime() > cursor.getTime())) break;
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

/** The scheduled side of one week: the schedules' own clock against n8n's execution history. */
export function scheduledWeek(
  automations: AutomationInfo[],
  execs: Record<string, ExecutionSummary[]>,
  tz: string,
  from: Date,
  to: Date,
  now: Date,
): { counts: DeliveryCount; missed: MissedSchedule[] } {
  const grace = SCHEDULE_GRACE_MINUTES * 60_000;
  const end = Math.min(to.getTime(), now.getTime() - grace); // a fire that is still inside its grace window is not late yet
  let delivered = 0, failed = 0, started = 0;
  const missed: MissedSchedule[] = [];
  for (const a of automations) {
    const known = (execs[a.workflow] ?? []).map((e) => ({ at: Date.parse(e.startedAt), status: String(e.status) })).filter((e) => Number.isFinite(e.at));
    for (const at of scheduledTimes(a.schedule, tz, from, to)) {
      if (at.getTime() > end) continue;
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
  // a schedule that never fired is not "in flight" and not a failure of the engine's logic — it is a missed run, and it counts
  // against the rate, which is the whole point of showing it (D25a).
  return { counts: count({ started, delivered, failed, noReport: 0, stuck: missed.length, inFlight: 0 }), missed };
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
  automations?: AutomationInfo[];
  notes?: string[];
}

/** The whole report, from facts only — no database, no n8n. */
export function deliveryReport(input: DeliveryInput): DeliveryReport {
  const automations = input.automations ?? AUTOMATIONS;
  const notes = [...(input.notes ?? [])];
  const weeks: DeliveryWeek[] = weeksBack(input.weeks, input.now).map((from) => {
    const to = new Date(from.getTime() + 7 * DAY_MS);
    const onDemand = onDemandWeek(input.runs, from, to, input.now);
    const { counts: scheduled, missed } = scheduledWeek(automations, input.execs, input.timezone, from, to, input.now);
    const settled = onDemand.settled + scheduled.settled;
    const overallPct = pct(onDemand.delivered + scheduled.delivered, settled);
    return { week: from.toISOString().slice(0, 10), onDemand, scheduled, overallPct, belowTarget: overallPct != null && overallPct < TARGET_PCT, missed };
  });
  if (!Object.keys(input.execs).length) notes.push('No execution history could be read from the engine, so the scheduled side of every week is unmeasured, not perfect.');
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
  for (const wf of [...new Set(AUTOMATIONS.map((a) => a.workflow))]) {
    try {
      const [ok, bad] = await Promise.all([executions(wf, 'success', 150), executions(wf, 'error', 50)]);
      execs[wf] = [...ok, ...bad];
    } catch {
      failedWorkflows.push(wf);
    }
  }
  if (failedWorkflows.length) notes.push(`The engine did not answer for ${failedWorkflows.length} of ${new Set(AUTOMATIONS.map((a) => a.workflow)).size} scheduled workflows, so their weeks are unmeasured rather than perfect.`);
  let alerts: AlertFact[] = [];
  try {
    alerts = await rows<AlertFact>('opsAlerts', { max: 500 });
  } catch {
    notes.push('The ops-alert table could not be read, so the alert delivery rate is unknown.');
  }
  return deliveryReport({ now, weeks: WEEKS, runs: runRows.map((r) => ({ ...r, reportCount: Number(r.reportCount ?? 0) })), execs, alerts, timezone: config.n8nTimezone, notes });
}
