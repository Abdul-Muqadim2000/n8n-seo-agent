import { and, eq, inArray } from 'drizzle-orm';
import { n8nSiteId, normKeyword, stuckRung, type ContentLogRow, type LadderRow } from '@seo/shared';
import { db, schema } from '../db';
import { recentExecutions, siteRows, updateRows } from '../n8n/client';

// LADDER PACKAGE (2026-11-09, rule 5; n8n/seo-agent/docs/keyword-intel-2026-11-08/fixes/LADDER.md). Production 2026-11-05 (techand.ai, ladder
// "crm service provider"): the rung "what is a crm company" sat at `writing` (content log `started`) for days after its page run died, so the
// ladder said "Being written" for ever and the pile-up count held the next rung back. The app's run watcher (engineFailures.ts) closes app
// runs; a rung the Content Cadence started has no app run. This watcher reads every website's `writing` rungs and closes one that has been
// writing for more than three times its expected time (at least 60 minutes, the engine's own rule LRU.stuck, shared) while nothing of it is
// still alive: no open app run for the page (that one is the run watcher's, which closes it and has its credits returned: admin/costSync.ts
// step 6), and no running execution of the main workflow started after the rung was started. Closing = the ladder row `failed` with the
// reason and the content-log row `failed` (so no screen says "written"); a page run that never settled its engine ledger row is charged
// nothing. When the engine cannot be asked whether anything is running, nothing is closed.

export const LADDER_STUCK_MAIN_WORKFLOW = 'SEOagentV4Full01';
/** an unfinished execution that started this long before the rung (or any time after it) may be its page run */
export const LADDER_STUCK_START_SLACK_MS = 10 * 60_000;
/** n8n states of an execution that has ended (engineFailures.ts: ENDED + CUT_OFF); anything else (running, new = queued, waiting) is alive */
export const LADDER_FINISHED = ['success', 'error', 'crashed', 'canceled'];
const ACTIVE = ['submitting', 'accepted', 'running'];

export interface StuckRungDeps {
  sites: () => Promise<{ id: string; orgId: string; domain: string }[]>;
  ladders: (domain: string) => Promise<LadderRow[]>;
  logs: (domain: string) => Promise<ContentLogRow[]>;
  /** the main workflow's newest executions in any state; null = n8n could not be asked */
  running: () => Promise<{ startedAt?: string | null; status?: string }[] | null>;
  openRuns: (siteId: string) => Promise<{ id: string; input: unknown }[]>;
  update: typeof updateRows;
}

export interface StuckRung {
  domain: string;
  ladderId: string;
  keyword: string;
  minutes: number;
  reason: string;
}

/** The rungs to close, pure: rows of one website, its content log, the running executions (null = could not be asked), open app runs. */
export function stuckRungsOf(o: {
  domain: string;
  ladders: LadderRow[];
  logs: ContentLogRow[];
  running: { startedAt?: string | null; status?: string }[] | null;
  openKeywords: ReadonlySet<string>;
  now: number;
}): StuckRung[] {
  const out: StuckRung[] = [];
  for (const r of o.ladders) {
    if (String(r.status || '') !== 'writing' || !r.keyword || !r.ladder_id) continue;
    const k = normKeyword(r.keyword);
    const log = o.logs
      .filter((l) => normKeyword(l.keyword) === k && String(l.status || '') === 'started')
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
    const since = String(log?.started_at || r.updatedAt || '');
    const t = Date.parse(since);
    const live: boolean | null = o.openKeywords.has(k)
      ? true
      : o.running === null
        ? null
        : o.running.some((e) => {
            // review H1 (2026-11-10): production runs n8n with a concurrency limit, so a page run can wait in n8n's queue (`new` / `waiting`)
            // for over an hour: any queued execution keeps every rung alive, and so does any unfinished one that started around or after it
            const st = String(e.status ?? 'running');
            if (LADDER_FINISHED.includes(st)) return false;
            if (st === 'new' || st === 'waiting' || !e.startedAt) return true;
            const s = Date.parse(e.startedAt);
            return !Number.isFinite(t) || !Number.isFinite(s) || s >= t - LADDER_STUCK_START_SLACK_MS;
          });
    const v = stuckRung({ status: 'writing', since, live, now: o.now });
    if (v.stuck) out.push({ domain: o.domain, ladderId: String(r.ladder_id), keyword: String(r.keyword), minutes: v.minutes ?? 0, reason: v.reason });
  }
  return out;
}

const defaultDeps: StuckRungDeps = {
  sites: () => db.select({ id: schema.sites.id, orgId: schema.sites.orgId, domain: schema.sites.domain }).from(schema.sites),
  ladders: (domain) => siteRows<LadderRow>('ladders', domain, { fresh: true, max: 500, extra: [{ columnName: 'status', condition: 'eq', value: 'writing' }] }),   // review L8: only the writing rows
  logs: (domain) => siteRows<ContentLogRow>('contentLog', domain, { fresh: true, max: 2000, sortBy: 'started_at:desc' }),
  running: () => recentExecutions(LADDER_STUCK_MAIN_WORKFLOW, 100).catch(() => null),
  openRuns: (siteId) =>
    db.select({ id: schema.runs.id, input: schema.runs.input }).from(schema.runs).where(and(eq(schema.runs.siteId, siteId), inArray(schema.runs.status, ACTIVE))),
  update: updateRows,
};

let sweeping = false;

/** One sweep over every website. Returns the rungs it closed. */
export async function checkStuckRungs(deps: StuckRungDeps = defaultDeps, now = Date.now()): Promise<StuckRung[]> {
  if (sweeping) return [];
  sweeping = true;
  try {
    const running = await deps.running();
    const closed: StuckRung[] = [];
    for (const site of await deps.sites()) {
      const ladders = await deps.ladders(site.domain).catch(() => [] as LadderRow[]);
      if (!ladders.some((r) => r.status === 'writing')) continue;
      const logs = await deps.logs(site.domain).catch(() => [] as ContentLogRow[]);
      const open = await deps.openRuns(site.id).catch(() => []);
      const openKeywords = new Set(open.map((r) => normKeyword(String(((r.input ?? {}) as { keyword?: unknown }).keyword ?? ''))).filter(Boolean));
      for (const st of stuckRungsOf({ domain: site.domain, ladders, logs, running, openKeywords, now })) {
        const day = new Date(now).toISOString().slice(0, 10);
        const note = `failed: ${st.reason} (closed ${day}). Nothing was written; the next page of the ladder goes on. If the run finishes after all, the page shows here as written; otherwise write it again from the ladder page.`.slice(0, 480);
        const ok = await deps
          .update('ladders', [
            { columnName: 'ladder_id', condition: 'eq', value: st.ladderId },
            { columnName: 'keyword', condition: 'eq', value: st.keyword },
            { columnName: 'status', condition: 'eq', value: 'writing' },
          ], { status: 'failed', status_note: note })
          .catch(() => false);
        if (!ok) continue;
        await deps
          .update('contentLog', [
            { columnName: 'site_id', condition: 'eq', value: n8nSiteId(site.domain) },
            { columnName: 'keyword', condition: 'eq', value: st.keyword },
            { columnName: 'status', condition: 'eq', value: 'started' },
          ], { status: 'failed', qa_reasons: `page run failed: ${st.reason}`.slice(0, 480) })
          .catch(() => false);
        closed.push(st);
      }
    }
    return closed;
  } finally {
    sweeping = false;
  }
}
