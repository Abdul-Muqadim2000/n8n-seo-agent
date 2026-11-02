import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { emitRunsFailed } from './webhooks';
import { releaseFailedPages } from './runs';
import { executionFailure, executionStatus, executions, subExecutionOf } from '../n8n/client';

// Without e-mail, a run that fails inside n8n would only show as failed after the 3-hour timeout (n8n's Error Handler mails the
// operator, not the user). This watcher reads n8n's failed executions while runs are active, finds the request id the execution
// carried, and marks that run failed with n8n's error at once.

const WATCHED = ['SEOagentV4Full01', 'SEOagentAIVisib1', 'SEOagentBacklnk1', 'SEOagentSiteTrk1', 'SEOagentTracker1', 'SEOagentCadence1', 'SEOagentAuditSc1'];
const ACTIVE = ['submitting', 'accepted', 'running'];
const seen = new Set<string>();

export async function checkEngineFailures(): Promise<number> {
  const active = await db
    .select({ id: schema.runs.id, requestId: schema.runs.requestId, createdAt: schema.runs.createdAt })
    .from(schema.runs)
    .where(inArray(schema.runs.status, ACTIVE));
  const waiting = active.filter((r) => r.requestId);
  if (!waiting.length) return 0;
  const since = Math.min(...waiting.map((r) => r.createdAt.getTime())) - 60_000;
  const closed: string[] = [];
  for (const wf of WATCHED) {
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
  closed.push(...(await closeCrashedRuns(waiting.filter((r) => !closed.includes(r.id)))));
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
// follow that link and ask n8n how it ended.
export const ENGINE_RESTART_ERROR =
  'The SEO engine restarted while this run was working, so it stopped before it finished and nothing was delivered. No credits are charged for it. Start it again.';
const ENDED_WITHOUT_RESULT = ['crashed', 'canceled'];
/** front-door execution id -> the execution it started (null: it started none; not asked again) */
const workOf = new Map<string, string | null>();

async function closeCrashedRuns(runs: { id: string; requestId: string | null }[]): Promise<string[]> {
  const closed: string[] = [];
  for (const run of runs) {
    if (!run.requestId || !/^\d+$/.test(run.requestId)) continue;
    let work = workOf.get(run.requestId);
    if (work === undefined) {
      work = await subExecutionOf(run.requestId).catch(() => undefined);
      if (work === undefined) continue; // n8n unreachable: ask again next sweep
      workOf.set(run.requestId, work);
    }
    if (!work) continue;
    const status = await executionStatus(work);
    if (!status || !ENDED_WITHOUT_RESULT.includes(status)) continue;
    const done = await db
      .update(schema.runs)
      .set({ status: 'failed', completedAt: new Date(), error: `${ENGINE_RESTART_ERROR} (n8n execution ${work}, ${status})` })
      .where(and(eq(schema.runs.id, run.id), inArray(schema.runs.status, ACTIVE)))
      .returning({ id: schema.runs.id });
    if (done.length) closed.push(run.id);
  }
  if (workOf.size > 5000) workOf.clear();
  return closed;
}
