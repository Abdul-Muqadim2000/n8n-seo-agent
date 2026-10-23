import { and, eq, sql } from 'drizzle-orm';
import { creditRate, type PayloadCredits, type RunCredits } from '@seo/shared';
import { db, schema } from '../db';
import type { RunRow } from '../db/schema';
import { settingsRow } from './admin/settings';
import { execRows } from './admin/sqlRows';

// Credits of a run as the customer reads them (app/docs/CREDITS.md): the quote it started with, what the ledger charged it, its state.
// Kept apart from services/runs.ts and services/billing.ts so the webhooks, the exports and the API read it without the run and billing
// machinery (and without an import cycle).

/** services/billing.ts `quoteCredits`, the same rounding (whole credits, rounded up, never 0 for paid work; test/runCredits.test.ts) */
export function quoteOf(estimatedUsd: number, s: { creditValueUsd: number; markup: number }): number {
  if (!(estimatedUsd > 0)) return 0;
  return Math.max(1, Math.ceil(Math.round(estimatedUsd * creditRate(s) * 100) / 100 - 1e-9));
}

export interface RunCharge {
  /** −Σ the company's usage entries of the run (the `failed:` return included) */
  charged: number;
  /** any entry was capped at the quote (`ref.absorbed` > 0) */
  capped: boolean;
}

/**
 * What these runs were charged, from the credit ledger: one query for the whole page (a usage entry names its run in `ref.runId`).
 * A run with no usage entry yet is absent from the map.
 */
export async function chargesByRun(orgId: string, runIds: string[]): Promise<Map<string, RunCharge>> {
  const out = new Map<string, RunCharge>();
  const ids = [...new Set(runIds)].filter(Boolean);
  // in slices, so an export of many thousand runs stays within the driver's parameter limit
  for (let i = 0; i < ids.length; i += 1000) {
    const part = ids.slice(i, i + 1000);
    const rows = await execRows<{ run_id: string; charged: number; capped: boolean | string }>(db, sql`
      select ref->>'runId' as run_id, (-sum(credits))::float as charged,
             coalesce(bool_or(coalesce((ref->>'absorbed')::float, 0) > 0), false) as capped
      from ${schema.creditLedger}
      where org_id = ${orgId}::uuid and kind = 'usage' and ref->>'runId' in (${sql.join(part.map((id) => sql`${id}`), sql`, `)})
      group by 1`);
    for (const r of rows) out.set(r.run_id, { charged: Math.round(Math.max(0, Number(r.charged)) * 100) / 100, capped: r.capped === true || r.capped === 't' });
  }
  return out;
}

/**
 * A run's credits as the customer sees them. `quoted` is what it was quoted when it started (`runs.quoted_credits`); a run from before
 * credits is quoted now from its own estimate, the same rounding (`quoteOf`).
 */
export function runCreditsOf(
  r: Pick<RunRow, 'status' | 'quotedCredits' | 'engineCostEstimateUsd' | 'estimatedCostUsd'>,
  charge: RunCharge | undefined,
  s: { creditValueUsd: number; markup: number },
): RunCredits {
  const quoted = r.quotedCredits ?? quoteOf(r.engineCostEstimateUsd ?? r.estimatedCostUsd ?? 0, s);
  const charged = charge ? charge.charged : null;
  const capped = charge?.capped ?? false;
  const state: RunCredits['state'] =
    r.status === 'failed' || r.status === 'joined'
      ? 'not_charged'
      : !(quoted > 0) && !(charged && charged > 0)
        ? 'free'
        : r.status === 'running' || r.status === 'accepted' || r.status === 'submitting'
          ? 'held'
          : r.status === 'completed' && charged != null
            ? 'charged'
            : 'quoted';
  return { quoted, charged, state, capped };
}

/** The credits of a page of runs: one ledger read, one settings read. */
export async function creditsForRuns(orgId: string, rows: Pick<RunRow, 'id' | 'status' | 'quotedCredits' | 'engineCostEstimateUsd' | 'estimatedCostUsd'>[]): Promise<Map<string, RunCredits>> {
  const [charges, s] = await Promise.all([chargesByRun(orgId, rows.map((r) => r.id)), settingsRow()]);
  return new Map(rows.map((r) => [r.id, runCreditsOf(r, charges.get(r.id), s)]));
}

/**
 * The credits behind one report (a served payload's `credits_used` / `credits_state`): the run's charge when the report belongs to a
 * run; for a schedule's report, the usage entries of the engine execution that wrote it (`run_ledger.run_id` / `execution_id`, the
 * id the cost sync records as `ref.engineRunId`), when there are any.
 */
export async function reportCredits(orgId: string, report: { runId: string | null; payload: Record<string, unknown> | null }): Promise<PayloadCredits> {
  if (report.runId) {
    const run = await db.query.runs.findFirst({ where: and(eq(schema.runs.orgId, orgId), eq(schema.runs.id, report.runId)) });
    if (run) {
      const c = (await creditsForRuns(orgId, [run])).get(run.id)!;
      return { used: c.charged, state: c.state };
    }
  }
  const p = report.payload ?? {};
  const ledger = p.run_ledger && typeof p.run_ledger === 'object' ? (p.run_ledger as Record<string, unknown>) : {};
  const ids = [ledger.run_id, p.execution_id].map((v) => (v == null ? '' : String(v).trim())).filter((v) => v && v.length < 100);
  if (!ids.length) return { used: null, state: null };
  const [r] = await execRows<{ used: number | null; n: number }>(db, sql`
    select (-sum(credits))::float as used, count(*)::int as n from ${schema.creditLedger}
    where org_id = ${orgId}::uuid and kind = 'usage' and ref->>'engineRunId' in (${sql.join([...new Set(ids)].map((id) => sql`${id}`), sql`, `)})`);
  return Number(r?.n ?? 0) > 0 ? { used: Math.round(Math.max(0, Number(r!.used ?? 0)) * 100) / 100, state: 'charged' } : { used: null, state: null };
}

// ---------------- A9 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/APP_AUDIT.md): what an AI visibility run was charged ----------------

/** One usage entry of the credit ledger for the website's AI visibility runs (`ref.mode` 'ai_visibility'). */
export interface AiChargeEntry {
  at: string;
  /** credits taken (positive) */
  credits: number;
}

/** an entry may be written a little before the stored row's `checked_at` (the row's time is the run's start; its parts settle later) */
const AI_CHARGE_SLACK_MS = 30 * 60_000;

/**
 * Each entry belongs to the latest run that started before it (with a little slack): a run's executions settle after its start and
 * before the next weekly run. A run with no entry has no charge on record (null), never a figure rebuilt from its search-data cost.
 */
export function bucketAiCharges(runs: readonly { checkedAt: string }[], entries: readonly AiChargeEntry[]): (number | null)[] {
  const out: (number | null)[] = runs.map(() => null);
  const order = runs.map((r, i) => ({ t: Date.parse(r.checkedAt), i })).filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
  for (const e of entries) {
    const at = Date.parse(e.at);
    if (!Number.isFinite(at) || !(e.credits > 0)) continue;
    let hit = -1;
    for (const r of order) if (r.t - AI_CHARGE_SLACK_MS <= at) hit = r.i;
    if (hit < 0) continue;
    out[hit] = Math.round(((out[hit] ?? 0) + e.credits) * 100) / 100;
  }
  return out;
}

/** The ledger's usage entries of a website's AI visibility runs since `since` (one query). */
export async function aiChargeEntries(orgId: string, domain: string, since: string): Promise<AiChargeEntry[]> {
  const d = domain.toLowerCase().replace(/^www\./, '');
  const rows = await execRows<{ at: string; credits: number }>(db, sql`
    select created_at::text as at, (-credits)::float as credits from ${schema.creditLedger}
    where org_id = ${orgId}::uuid and kind = 'usage' and ref->>'mode' = 'ai_visibility'
      and lower(coalesce(ref->>'domain', '')) in (${d}, ${'www.' + d}) and created_at >= ${since}::timestamptz`);
  return rows.map((r) => ({ at: new Date(r.at).toISOString(), credits: Number(r.credits) || 0 }));
}

