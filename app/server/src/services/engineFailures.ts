import { and, eq, gt, inArray, ne, sql } from 'drizzle-orm';
import { parseRunInput } from '@seo/shared';
import { db, schema } from '../db';
import type { RunRow } from '../db/schema';
import type { OrgAccess } from '../auth/access';
import type { Role } from '@seo/shared';
import { emitRunsFailed } from './webhooks';
import { createRunWithMeta, releaseFailedPages, STALE_RUN_ERROR } from './runs';
import { executionFailure, executionStatus, executions, subExecutionOf } from '../n8n/client';

// Without e-mail, a run that fails inside n8n would only show as failed after the 3-hour timeout (n8n's Error Handler mails the
// operator, not the user). This watcher reads n8n's failed executions while runs are active, finds the request id the execution
// carried, and marks that run failed with n8n's error at once.

const WATCHED = ['SEOagentV4Full01', 'SEOagentAIVisib1', 'SEOagentBacklnk1', 'SEOagentSiteTrk1', 'SEOagentTracker1', 'SEOagentCadence1', 'SEOagentAuditSc1'];
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
/** n8n statuses of an execution a restart cut off. `canceled` is a person stopping it in n8n: closed, never started again. */
const CUT_OFF = ['crashed', 'canceled'];
/** front-door execution id -> the execution it started (null: it started none; not asked again) */
const workOf = new Map<string, string | null>();

export interface RetryDeps {
  start: (a: OrgAccess, input: Parameters<typeof createRunWithMeta>[1], opts: Parameters<typeof createRunWithMeta>[2]) => Promise<{ run: RunRow }>;
}
const defaultDeps: RetryDeps = { start: createRunWithMeta };

async function recoverCrashedRuns(runs: RunRow[], deps: RetryDeps = defaultDeps): Promise<string[]> {
  const closed: string[] = [];
  for (const run of runs) {
    if (!run.requestId || !/^\d+$/.test(run.requestId)) continue;
    let work = workOf.get(run.requestId);
    if (work === undefined) {
      const child = await subExecutionOf(run.requestId).catch(() => undefined);
      if (child === undefined) continue; // n8n unreachable: ask again next sweep
      if (child) work = child;
      else {
        // Prod 2026-11-04 (devaicon.com publish check): the front door answered 202 and was cut off itself before it started the work, so
        // there is no work execution to follow. How the front door ended decides: cut off = this run's work never ran; still going = ask
        // again next sweep (never remember "nothing" for a door that has not finished); finished without starting work = nothing to do.
        const own = await executionStatus(run.requestId);
        if (!own || !['success', 'error', ...CUT_OFF].includes(own)) continue;
        work = CUT_OFF.includes(own) ? run.requestId : null;
      }
      workOf.set(run.requestId, work);
    }
    if (!work) continue;
    const status = await executionStatus(work);
    if (!status || !CUT_OFF.includes(status)) continue;
    if (ACTIVE.includes(run.status)) {
      const done = await db
        .update(schema.runs)
        .set({ status: 'failed', completedAt: new Date(), error: `${ENGINE_RESTART_ERROR} (n8n execution ${work}, ${status})` })
        .where(and(eq(schema.runs.id, run.id), inArray(schema.runs.status, ACTIVE)))
        .returning({ id: schema.runs.id });
      if (!done.length) continue; // its result arrived meanwhile
      closed.push(run.id);
      await releaseFailedPages([run.id]).catch(() => 0); // before the new run opens its own page row
    }
    if (status === 'crashed') await startAgain(run, work, deps).catch(() => undefined);
  }
  if (workOf.size > 5000) workOf.clear();
  return closed;
}

/** Starts a crashed run again for the person who started it, once, unless they already did or the mode is not safe to repeat. */
async function startAgain(run: RunRow, work: string, deps: RetryDeps): Promise<string | null> {
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
    .set({ error: `${ENGINE_RESTART_RETRIED} (n8n execution ${work}, crashed)`, input: sql`${schema.runs.input} || ${JSON.stringify({ retriedAs: started.run.id })}::jsonb` })
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
export const __test = { recoverCrashedRuns, workOf };
