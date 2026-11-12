// KI: keyword intelligence (docs/keyword-intel-2026-11-08/CONTRACTS.md §1, §7). W0 holds the one rule the run path needs now: a Competitors
// or Keyword research run starts only when the website's engine setting (seo_monitors.ki_mode) is On, or Trial and the person is a platform
// admin. The engine refuses on its own as well (SEOagentKIntel1), so this is the guard that keeps a refusal from ever being quoted or charged.
// The routes, data reads and CSV are the next package (A1).
//
// FX-A (2026-11-08, reviews CONSISTENCY H1 / PERF_SAFETY H1): the ONE Trial check. A Trial run is quoted and charged 0 credits to the client
// company and the run, its reports, its notices, Needs-you items, delivery digests and log, events, the Overview, the runs lists, the credit
// activity, API v1 / MCP and the exports are for platform admins only (or nobody, where no person asks). Every path uses the predicates
// below (JS: `kiRunVisible` / `kiReportVisible`; SQL: `NOT_KI_TRIAL_RUN` / `NOT_KI_TRIAL_REPORT` and `kiRunConds` / `kiReportConds`), never
// a copy of its own.

import { sql, type SQL } from 'drizzle-orm';
import { isKiRunMode, KI_KILL_KEY, kiKilled, kiMayRun, kiModeOf, kiTrialReport, kiTrialRun, type KiMode, type MonitorsRow, type RunInput } from '@seo/shared';
import { isPlatformAdmin } from '../auth/access';
import * as schema from '../db/schema';
import type { SiteRow, UserRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { rows, siteRows } from '../n8n/client';

const sameDomain = (d: string) => (r: { domain?: unknown }) => String(r?.domain ?? '').trim().toLowerCase() === d.toLowerCase();

/** The website's KI mode as the engine stores it (its own row, matched by domain); null when the engine cannot be read (nothing starts). */
export async function kiModeFor(domain: string, read: (d: string) => Promise<MonitorsRow[]> = (d) => siteRows<MonitorsRow>('monitors', d, { max: 5 })): Promise<KiMode | null> {
  try {
    const all = await read(domain);
    // PERF_SAFETY L8: the same lookup as kiState (the row of this domain), never simply the first row
    const row = all.find(sameDomain(domain)) ?? (all.length === 1 && all[0] && !String(all[0].domain ?? '').trim() ? all[0] : undefined);
    return kiModeOf(row?.ki_mode);
  } catch {
    return null;
  }
}

/** seo_cache `ki:kill` = 1, or unreadable: every KI read behaves as Off and no run starts (fails closed, CONTRACTS §1). */
export async function kiKillSwitch(read: () => Promise<{ key?: unknown; value?: unknown }[]> = () => rows<{ key?: unknown; value?: unknown }>('cache', { filters: [{ columnName: 'key', condition: 'eq', value: KI_KILL_KEY }], max: 3 })): Promise<boolean> {
  try {
    return kiKilled(await read());
  } catch {
    return true;
  }
}

/**
 * Throws unless this person may start this KI run on this website: 409 `ki_mode_unknown` when the setting cannot be read, 403
 * `ki_not_available` when the website is Off, or in Trial and the person is not a platform admin, 409 `ki_paused` while the kill switch is on
 * (PERF_SAFETY L3: before any credit is locked). Any other mode passes untouched. Answers whether the run is a Trial run (charged 0).
 */
export async function assertKiRunAllowed(
  input: Pick<RunInput, 'mode'>,
  site: Pick<SiteRow, 'domain'> | null,
  user: UserRow,
  read?: (d: string) => Promise<MonitorsRow[]>,
  killed: () => Promise<boolean> = () => kiKillSwitch(),
): Promise<{ trial: boolean }> {
  if (!isKiRunMode(input.mode)) return { trial: false };
  if (!site) throw new HttpError(400, 'Choose a website', 'bad_request', { siteId: 'Required' });
  const mode = await kiModeFor(site.domain, read);
  if (mode === null) throw new HttpError(409, 'We could not confirm that this analysis is switched on for this website. Please try again in a minute. Nothing was charged.', 'ki_mode_unknown');
  if (!kiMayRun(mode, isPlatformAdmin(user)))
    throw new HttpError(403, 'This analysis is not available for this website yet. Ask us if you would like it switched on.', 'ki_not_available');
  if (await killed()) throw new HttpError(409, 'This analysis is paused for maintenance for a short while. Please try again later. Nothing was charged.', 'ki_paused');
  return { trial: mode === 'trial' };
}

// ---------------------------------------------------------------------------------------------------------------------------
// A1 (2026-11-08): what the run path and the report paths need without loading the KI data reads (services/kiData.ts)
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * The KI data reads keep their mapped rows for a short while, per website (owner's performance rule, 2026-11-08: a page view must not hit the
 * engine's API). services/kiData.ts fills it; a KI callback, a status change and the mode switch empty it for that website.
 * PERF_SAFETY M3: bounded (oldest out first) and expired entries are swept on every write.
 */
export const KI_CACHE_MS = 60_000;
export const KI_CACHE_MAX = 200;
class BoundedCache<V> extends Map<string, V> {
  override set(k: string, v: V): this {
    const now = Date.now();
    for (const [key, val] of this) if (now - Number((val as { at?: number })?.at ?? 0) >= KI_CACHE_MS) super.delete(key);
    if (super.has(k)) super.delete(k);
    while (this.size >= KI_CACHE_MAX) {
      const first = this.keys().next().value;
      if (first === undefined) break;
      super.delete(first);
    }
    return super.set(k, v);
  }
}
export const kiCache = new BoundedCache<{ at: number; value: unknown }>();
export function invalidateKi(domain: string): void {
  const d = String(domain || '').toLowerCase();
  for (const k of [...kiCache.keys()]) if (k === d || k.startsWith(d + '|')) kiCache.delete(k);
}

/** every callback stage of a KI run (started notices and final answers): the cost sync reads them by name (services/admin/costSync.ts) */
export const KI_STAGE_LIST: readonly string[] = ['ki_competitors', 'ki_research', 'ki_competitors_started', 'ki_research_started'];
const KI_STAGE_SET = new Set(KI_STAGE_LIST);
export const isKiStage = (stage: string): boolean => KI_STAGE_SET.has(stage);

/** A KI callback of a run in Trial (the body says so). */
export const kiTrialCallback = (stage: string, body: Record<string, unknown>): boolean => isKiStage(stage) && String(body.mode ?? '').trim().toLowerCase() === 'trial';

/**
 * A callback that belongs to our team's Trial check: a KI callback in Trial, or any callback of a run started in Trial (a refusal at the door
 * has stage `rejected` and no mode: PERF_SAFETY L2). Its report is stored with `summary.trial = true`, never delivered, never an event.
 */
export const kiTrialOf = (stage: string, body: Record<string, unknown>, run: { input?: Record<string, unknown> | null } | null | undefined): boolean =>
  kiTrialCallback(stage, body) || kiTrialRun(run);

/** May this person see this run? Every run but a Trial KI one; that one only a platform admin. */
export function kiRunVisible(run: { input?: Record<string, unknown> | null } | null | undefined, user: UserRow | null): boolean {
  return !kiTrialRun(run) || isPlatformAdmin(user);
}

/** May this person see this stored report? Every report but a Trial one; that one only a platform admin. */
export function kiReportVisible(r: { stage?: string; summary?: Record<string, unknown> | null }, user: UserRow | null): boolean {
  return !kiTrialReport(r) || isPlatformAdmin(user);
}

/** SQL twins of `kiTrialRun` / `kiTrialReport` (the same marks: `input.kiTrial`, `summary.trial`), applied before any `limit` (L13). */
export const NOT_KI_TRIAL_RUN: SQL = sql`coalesce(${schema.runs.input}->>'kiTrial', '') <> 'true'`;
export const NOT_KI_TRIAL_REPORT: SQL = sql`coalesce(${schema.reports.summary}->>'trial', '') <> 'true'`;
/** The runs / reports conditions of a list read for this person (none for a platform admin; `null` = nobody asks, hide). */
export const kiRunConds = (user: UserRow | null): SQL[] => (user && isPlatformAdmin(user) ? [] : [NOT_KI_TRIAL_RUN]);
export const kiReportConds = (user: UserRow | null): SQL[] => (user && isPlatformAdmin(user) ? [] : [NOT_KI_TRIAL_REPORT]);
