import { and, eq, gt, inArray, ne, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import type { RunRow } from '../db/schema';
import type { OrgAccess } from '../auth/access';
import type { Role } from '@seo/shared';
import { emitRunsFailed } from './webhooks';
import { createRunWithMeta, releaseFailedPages, STALE_RUN_ERROR } from './runs';
import { parseRunInput, runOverdueMinutes, RUN_RESULT_GRACE_MINUTES } from '@seo/shared';
import { executionFailure, executionState, executions, isN8nNotFound, subExecutionOf, subExecutionsOf } from '../n8n/client';

// Without e-mail, a run that fails inside n8n would only show as failed after the 3-hour timeout (n8n's Error Handler mails the
// operator, not the user). This watcher reads n8n's failed executions while runs are active, finds the request id the execution
// carried, and marks that run failed with n8n's error at once.

// KI (2026-11-08, CONTRACTS.md §7): SEOagentKIntel1, keyword intelligence (Competitors / Keyword research), started by the API front door
export const WATCHED = ['SEOagentV4Full01', 'SEOagentAIVisib1', 'SEOagentBacklnk1', 'SEOagentSiteTrk1', 'SEOagentTracker1', 'SEOagentCadence1', 'SEOagentAuditSc1', 'SEOagentKIntel1'];
const ACTIVE = ['submitting', 'accepted', 'running'];
const seen = new Set<string>();
let sweeping = false;

export async function checkEngineFailures(): Promise<number> {
  if (sweeping) return 0; // a sweep that starts runs again can outlast the 90-second timer
  sweeping = true;
  try {
    return await sweep();
  } finally {
    sweeping = false;
  }
}

async function sweep(): Promise<number> {
  const active = await db.select().from(schema.runs).where(inArray(schema.runs.status, ACTIVE));
  const waiting = active.filter((r) => r.requestId);
  const closed: string[] = [];
  const since = Math.min(...waiting.map((r) => r.createdAt.getTime())) - 60_000;
  for (const wf of waiting.length ? WATCHED : []) {
    let list;
    try {
      list = await executions(wf, 'error', 20);
    } catch {
      continue;
    }
    for (const e of list) {
      if (seen.has(e.id)) continue;
      if (Date.parse(e.startedAt) < since) {
        seen.add(e.id);
        continue;
      }
      const f = await executionFailure(e.id).catch(() => null);
      if (!f) continue;
      seen.add(e.id);
      const run = waiting.find((r) => r.requestId === f.requestId);
      if (!run) continue;
      await db
        .update(schema.runs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          error: `The SEO engine stopped with an error${f.node ? ` in "${f.node}"` : ''}: ${f.error} (n8n execution ${e.id}). Start it again; if it repeats, the operator can open that execution in n8n.`,
        })
        .where(and(eq(schema.runs.id, run.id), inArray(schema.runs.status, ACTIVE)));
      closed.push(run.id);
    }
  }
  if (seen.size > 5000) seen.clear();
  // the runs the expiry closed recently: a crash before this watcher knew about crashes (or while the app was down) is still started again
  const expired = await db
    .select()
    .from(schema.runs)
    .where(and(eq(schema.runs.status, 'failed'), eq(schema.runs.error, STALE_RUN_ERROR), gt(schema.runs.completedAt, sql`now() - interval '12 hours'`)));
  closed.push(...(await recoverCrashedRuns([...waiting.filter((r) => !closed.includes(r.id)), ...expired])));
  // G4: subscribers hear about it the moment the app does
  if (closed.length) void emitRunsFailed(closed).catch(() => undefined);
  // W06-B (2026-10-30, WAVE05 3.2): a failed page run wrote no page, so its opening content-log row must not read as one
  if (closed.length) void releaseFailedPages(closed).catch(() => undefined);
  return closed.length;
}

// Prod 2026-11-02 (devaicon.com: "about 10 minutes", still running 2.5 hours later): the engine's host is a spot VM and was preempted five
// times that day. A restart kills the run in flight; n8n marks that execution `crashed`, not `error`, and rebuilds its node data from its
// event log without the items, so neither the read above nor its request id ever sees it and the run waited for the 3-hour expiry with a
// sentence that blamed a refusal. The app's request id is the front door's execution; the work runs in the execution it started, so
// follow that link and ask n8n how it ended. A crash is not the customer's doing, so the run is started again for them, once.
export const ENGINE_RESTART_ERROR =
  'The SEO engine restarted while this run was working, so it stopped before it finished and nothing was delivered. No credits are charged for it. Start it again.';
export const ENGINE_RESTART_RETRIED =
  'The SEO engine restarted while this run was working, so it was started again automatically: follow the new run for the result. No credits are charged for this one.';
/** Modes that are safe to send again: one result, no stored plan or settings half written (a ladder, tracking, a profile, a case study are not). */
export const RETRYABLE = ['keyword', 'verdict', 'discover', 'describe', 'audit', 'published', 'checkin', 'ai_visibility', 'backlinks'];
export interface RetryDeps {
  start: (a: OrgAccess, input: Parameters<typeof createRunWithMeta>[1], opts: Parameters<typeof createRunWithMeta>[2]) => Promise<{ run: RunRow }>;
}
const defaultDeps: RetryDeps = { start: createRunWithMeta };

/** n8n statuses of an execution a restart cut off. `canceled` is a person stopping it in n8n: closed, never started again. */
const CUT_OFF = ['crashed', 'canceled'];
/** n8n statuses of an execution that ended by itself */
const ENDED = ['success', 'error'];

// Prod 2026-11-05 (devaicon.com, the publish check of 2026-11-04 seen at "Queued in the SEO engine", 69 minutes on a one-minute check):
// the watcher closed a run only when n8n said "crashed". Every other way a run can go quiet waited for the 3-hour expiry: the result was
// lost on its way to the app (the app restarting while n8n called back), the front door ended without starting the work and posted
// nothing, n8n has no record of the execution, or the work was handed on (AI visibility, backlinks run in a workflow of their own) and
// that execution was the one cut off. Once a run is overdue (runOverdueMinutes, shared with the run page), the whole chain is read:
// anything still going = leave it; anything cut off = closed (and started again once when it crashed); everything ended and still no
// result after RUN_RESULT_GRACE_MINUTES = closed with what is known. A result that arrives later still completes the run (runOutcome).
export const ENGINE_NO_WORK_ERROR =
  'The SEO engine took this run but stopped before it started the work, so nothing was delivered. No credits are charged for it. Start it again.';
export const ENGINE_NO_WORK_RETRIED =
  'The SEO engine took this run but stopped before it started the work, so it was started again automatically: follow the new run for the result. No credits are charged for this one.';
export const ENGINE_LOST_ERROR =
  'The SEO engine finished this run, but its result never reached your account, so nothing was delivered. No credits are charged for it. Start it again.';
export const ENGINE_LOST_RETRIED =
  'The SEO engine finished this run, but its result never reached your account, so it was started again automatically: follow the new run for the result. No credits are charged for this one.';
/**
 * Modes started again by themselves when their result was lost after the work ran: free and quick, so a second run costs nothing even
 * if the first result turns up after all. A paid run whose work ran is closed and left to the person (running it twice is spend).
 */
export const LOST_RESULT_RETRY = ['published', 'checkin'];

/** front-door execution id -> what it started: the work execution, or null with how the door itself ended (never cached while it runs) */
interface Door {
  work: string | null;
  /** when no work: how the door ended (`missing` = n8n has no record of it) and when */
  ended?: string;
  stoppedAt?: number | null;
}
const doorOf = new Map<string, Door>();
/** a work execution that has ended -> the executions it handed the work to (fixed once it has ended) */
const handedTo = new Map<string, string[]>();
/** kept for the tests' import name: front door -> work */
const workOf = doorOf;

async function readDoor(requestId: string): Promise<Door | undefined> {
  const known = doorOf.get(requestId);
  if (known) return known;
  let child: string | null;
  try {
    child = await subExecutionOf(requestId);
  } catch (err) {
    if (!isN8nNotFound(err)) return undefined; // n8n unreachable: ask again next sweep
    child = null;
  }
  let door: Door;
  if (child) door = { work: child };
  else {
    // Prod 2026-11-04 (devaicon.com publish check): the front door answered 202 and was cut off itself before it started the work, so
    // there is no work execution to follow. How the front door ended decides: cut off = this run's work never ran (the door is followed
    // as the work); still going = ask again next sweep (never remember "nothing" for a door that has not finished); ended = remembered.
    const own = await executionState(requestId);
    if (own === undefined) return undefined;
    if (own === null) door = { work: null, ended: 'missing', stoppedAt: null };
    else if (CUT_OFF.includes(own.status)) door = { work: requestId };
    else if (ENDED.includes(own.status)) door = { work: null, ended: own.status, stoppedAt: own.stoppedAt };
    else return undefined;
  }
  doorOf.set(requestId, door);
  return door;
}

type Verdict =
  | { kind: 'alive' }
  | { kind: 'unknown' }
  | { kind: 'cut_off'; execution: string; status: string }
  | { kind: 'ended'; execution: string; status: string; lastStop: number | null };

/**
 * P1 (2026-11-12): how deep a chain of hand-offs is followed. A page run that waits for a writing slot longer than one execution may wait
 * hands its place in line to a new execution of itself (6 hours in line is about 9 hand-offs); every link is an execution its predecessor
 * started, so the chain is read link by link.
 */
const HANDOFF_DEPTH = 16;

/** How the work of a run stands: the work execution, then (once it has ended) every execution it handed the work to, and theirs in turn. */
async function readWork(work: string, depth = 0): Promise<Verdict> {
  const own = await executionState(work);
  if (own === undefined) return { kind: 'unknown' };
  if (own === null) return { kind: 'ended', execution: work, status: 'missing', lastStop: null };
  if (CUT_OFF.includes(own.status)) return { kind: 'cut_off', execution: work, status: own.status };
  if (!ENDED.includes(own.status)) return { kind: 'alive' };
  let children = handedTo.get(work);
  if (!children) {
    try {
      children = await subExecutionsOf(work);
    } catch (err) {
      if (!isN8nNotFound(err)) return { kind: 'unknown' };
      children = [];
    }
    handedTo.set(work, children);
  }
  let lastStop = own.stoppedAt;
  for (const c of children) {
    if (depth < HANDOFF_DEPTH) {
      // the child and, once it has ended, what it handed on in turn (a page run's wait for a writing slot continues in a new execution)
      const v = await readWork(c, depth + 1);
      if (v.kind !== 'ended') return v;
      if (v.lastStop != null) lastStop = Math.max(lastStop ?? 0, v.lastStop); // a pruned child (missing) ended long ago: nothing to add
      continue;
    }
    const st = await executionState(c);
    if (st === undefined) return { kind: 'unknown' };
    if (st === null) continue; // pruned: it ended long ago
    if (CUT_OFF.includes(st.status)) return { kind: 'cut_off', execution: c, status: st.status };
    if (!ENDED.includes(st.status)) return { kind: 'alive' };
    if (st.stoppedAt != null) lastStop = Math.max(lastStop ?? 0, st.stoppedAt);
  }
  return { kind: 'ended', execution: work, status: own.status, lastStop };
}

const MIN = 60_000;
function overdue(run: RunRow, now: number): boolean {
  const from = (run.acceptedAt ?? run.createdAt).getTime();
  return now - from >= runOverdueMinutes(run.etaMinutes) * MIN;
}
/** the result had its time to arrive after the last execution ended (an unknown end counts from when the run became overdue) */
function graceOver(lastStop: number | null | undefined, now: number): boolean {
  return lastStop == null || now - lastStop >= RUN_RESULT_GRACE_MINUTES * MIN;
}

async function recoverCrashedRuns(runs: RunRow[], deps: RetryDeps = defaultDeps, now = Date.now()): Promise<string[]> {
  const closed: string[] = [];
  for (const run of runs) {
    if (!run.requestId || !/^\d+$/.test(run.requestId)) continue;
    const door = await readDoor(run.requestId);
    if (!door) continue;
    const active = ACTIVE.includes(run.status);
    if (!door.work) {
      // the door ended without starting the work and the run heard nothing: once overdue, closed (nothing ran, so started again once)
      if (!active || (run.reportCount ?? 0) > 0 || !overdue(run, now) || !graceOver(door.stoppedAt, now)) continue;
      if (await close(run, `${ENGINE_NO_WORK_ERROR} (n8n execution ${run.requestId}, ${door.ended})`)) closed.push(run.id);
      else continue;
      await startAgain(run, `${ENGINE_NO_WORK_RETRIED} (n8n execution ${run.requestId}, ${door.ended})`, deps).catch(() => undefined);
      continue;
    }
    const v = await readWork(door.work);
    if (v.kind === 'alive' || v.kind === 'unknown') continue;
    if (v.kind === 'cut_off') {
      if (active) {
        if (!(await close(run, `${ENGINE_RESTART_ERROR} (n8n execution ${v.execution}, ${v.status})`))) continue; // its result arrived meanwhile
        closed.push(run.id);
      }
      if (v.status === 'crashed') await startAgain(run, `${ENGINE_RESTART_RETRIED} (n8n execution ${v.execution}, crashed)`, deps).catch(() => undefined);
      continue;
    }
    // everything ended and no final result: lost on the way, or an error the first read did not see. Only once overdue and after the
    // grace, so a result still being posted is never overtaken, and only for a run that received nothing at all: a run that delivered
    // some reports (a ladder's pages) is left to the expiry, as before.
    if (!active || (run.reportCount ?? 0) > 0 || !overdue(run, now) || !graceOver(v.lastStop, now)) continue;
    if (v.status === 'error') {
      const f = await executionFailure(v.execution).catch(() => null);
      const text = `The SEO engine stopped with an error${f?.node ? ` in "${f.node}"` : ''}${f?.error ? `: ${f.error}` : ''} (n8n execution ${v.execution}). Start it again; if it repeats, the operator can open that execution in n8n.`;
      if (await close(run, text)) closed.push(run.id);
      continue;
    }
    if (!(await close(run, `${ENGINE_LOST_ERROR} (n8n execution ${v.execution}, ${v.status})`))) continue;
    closed.push(run.id);
    if (LOST_RESULT_RETRY.includes(run.mode)) await startAgain(run, `${ENGINE_LOST_RETRIED} (n8n execution ${v.execution}, ${v.status})`, deps).catch(() => undefined);
  }
  if (doorOf.size > 5000) doorOf.clear();
  if (handedTo.size > 5000) handedTo.clear();
  return closed;
}

/** Closes a run that is still open as failed with its reason, and frees the page row it opened. False when its result arrived meanwhile. */
async function close(run: RunRow, error: string): Promise<boolean> {
  const done = await db
    .update(schema.runs)
    .set({ status: 'failed', completedAt: new Date(), error })
    .where(and(eq(schema.runs.id, run.id), inArray(schema.runs.status, ACTIVE)))
    .returning({ id: schema.runs.id });
  if (!done.length) return false;
  await releaseFailedPages([run.id]).catch(() => 0); // before the new run opens its own page row
  return true;
}

/** Starts a run that stopped without a result again for the person who started it, once, unless they already did or the mode is not safe to repeat. */
async function startAgain(run: RunRow, retriedText: string, deps: RetryDeps): Promise<string | null> {
  const input = (run.input ?? {}) as Record<string, unknown>;
  if (!RETRYABLE.includes(run.mode) || input.retryOf || input.retryClaimed || input.freeResearch || !run.userId) return null;
  // the person started the same thing again themselves: nothing to do
  const keyword = typeof input.keyword === 'string' ? input.keyword : null;
  const [again] = await db
    .select({ id: schema.runs.id })
    .from(schema.runs)
    .where(
      and(
        eq(schema.runs.orgId, run.orgId),
        eq(schema.runs.mode, run.mode),
        ne(schema.runs.id, run.id),
        gt(schema.runs.createdAt, run.createdAt),
        run.siteId ? eq(schema.runs.siteId, run.siteId) : sql`${schema.runs.siteId} is null`,
        keyword ? sql`${schema.runs.input}->>'keyword' = ${keyword}` : sql`true`,
      ),
    )
    .limit(1);
  if (again) return null;
  // claimed on the row first: two sweeps, or a sweep and a restart of the app, can never start it twice
  const claimed = await db
    .update(schema.runs)
    .set({ input: sql`${schema.runs.input} || ${JSON.stringify({ retryClaimed: new Date().toISOString() })}::jsonb` })
    .where(and(eq(schema.runs.id, run.id), sql`not (${schema.runs.input} ? 'retryClaimed')`))
    .returning({ id: schema.runs.id });
  if (!claimed.length) return null;
  const a = await accessOf(run);
  const { acknowledged, autoStart, proposalId, freeResearch: _f, retryClaimed: _c, retriedAs: _r, ...rest } = input;
  const parsed = parseRunInput(rest);
  if (!a || !parsed.success) return null;
  const started = await deps.start(a, parsed.data, {
    warnings: [], // answered when the person started it; the crashed run itself would read as a duplicate now
    acknowledge: Array.isArray(acknowledged) ? acknowledged.map(String) : [],
    startedBy: autoStart ? 'auto' : 'person',
    ...(typeof proposalId === 'string' ? { proposalId } : {}),
  });
  if (!['accepted', 'running', 'submitting'].includes(started.run.status)) return null;
  await db
    .update(schema.runs)
    .set({ input: sql`${schema.runs.input} || ${JSON.stringify({ retryOf: run.id })}::jsonb` })
    .where(eq(schema.runs.id, started.run.id));
  await db
    .update(schema.runs)
    .set({ error: retriedText, input: sql`${schema.runs.input} || ${JSON.stringify({ retriedAs: started.run.id })}::jsonb` })
    .where(eq(schema.runs.id, run.id));
  return started.run.id;
}

async function accessOf(run: RunRow): Promise<OrgAccess | null> {
  if (!run.userId) return null;
  const [user, org, member] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, run.userId) }),
    db.query.organizations.findFirst({ where: eq(schema.organizations.id, run.orgId) }),
    db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, run.orgId), eq(schema.memberships.userId, run.userId)) }),
  ]);
  return user && org && member ? { user, org, role: member.role as Role } : null;
}

/** for the tests: the recovery with a fake start */
export const __test = { recoverCrashedRuns, workOf, handedTo };
