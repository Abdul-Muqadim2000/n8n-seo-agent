import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { executionFailure, executions } from '../n8n/client';

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
  let failed = 0;
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
      failed++;
    }
  }
  if (seen.size > 5000) seen.clear();
  return failed;
}
