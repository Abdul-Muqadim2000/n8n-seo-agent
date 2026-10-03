import {
  LADDER_SETTINGS_COLUMNS,
  LADDER_SITE_ROW,
  n8nSiteId,
  type LadderPrefs,
  type LadderRow,
  type LadderSettingsInput,
  type LadderSettingsRow,
  type SiteAutomation,
  type SiteAutomationInput,
} from '@seo/shared';
import type { SiteRow } from '../db/schema';
import { badRequest, notFound } from '../lib/errors';
import { deleteRows, ensureTable, siteRows, upsertRow } from '../n8n/client';
import { siteAutomation } from './ladders';

// The person's controls over the keyword ladders of a website, written to n8n's seo_ladder_settings (one row per ladder, plus the
// '_site' row with the website's defaults; the Content Cadence reads them every Monday, Cadence_Plan.js). The pure functions
// decide what to write; the async ones read the current rows (fresh), write them and drop the cached reads.
//
// - A ladder row the app creates without a mode keeps mode '' (= the website's default mode applies) and status 'active'.
// - Priorities: a ladder that gets a row needs a priority, or it would jump in the order (ladders with a priority come first). It
//   gets the next number after the existing ones, and so does every ladder without a priority ahead of it in the visible order.
// - The app never writes 'stuck' (n8n would stop writing the ladder; it is display-only) and writes 'won' only from the rank
//   tracker's callback.

export interface SettingsWrite {
  ladderId: string;
  /** the columns to set: only the changed ones for an existing row, the whole row for a new one */
  data: Record<string, unknown>;
  insert: boolean;
}

const COLUMN_NAMES = new Set<string>(LADDER_SETTINGS_COLUMNS.map((c) => c.name));
const prioOf = (r: LadderSettingsRow | undefined) => (r && Number(r.priority) >= 1 ? Number(r.priority) : Infinity);

/** Only real columns of seo_ladder_settings (n8n refuses unknown ones). */
export function settingsData(d: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(d).filter(([k, v]) => COLUMN_NAMES.has(k) && v !== undefined));
}

function settingsByLadder(settings: LadderSettingsRow[]): Map<string, LadderSettingsRow> {
  return new Map(settings.filter((r) => r.ladder_id && r.ladder_id !== LADDER_SITE_ROW).map((r) => [String(r.ladder_id), r]));
}

/** The website's ladders in the order the cadence serves them: settings priority, then the oldest start, then the id. */
export function ladderOrder(ladders: LadderRow[], settings: LadderSettingsRow[]): string[] {
  const of = settingsByLadder(settings);
  const start = new Map<string, string>();
  for (const r of ladders) {
    if (!r.ladder_id) continue;
    const s = String(r.start_date || '');
    const cur = start.get(r.ladder_id);
    if (cur === undefined || (s && (!cur || s < cur))) start.set(r.ladder_id, s);
  }
  const startOf = (id: string) => start.get(id) || String(of.get(id)?.created_at || '');
  return [...start.keys()].sort((a, b) => prioOf(of.get(a)) - prioOf(of.get(b)) || startOf(a).localeCompare(startOf(b)) || a.localeCompare(b));
}

/** A new ladder row: mode '' follows the website's default. */
function newLadderRow(site: { domain: string }, ladderId: string, ladders: LadderRow[], now: string, extra: Record<string, unknown>): Record<string, unknown> {
  const rows = ladders.filter((r) => r.ladder_id === ladderId);
  const head = rows.find((r) => Number(r.rung) === 4)?.keyword || rows[0]?.head_keyword || '';
  return settingsData({
    ladder_id: ladderId,
    site_id: n8nSiteId(site.domain),
    domain: site.domain,
    head_keyword: head,
    mode: '',
    status: 'active',
    plan_type: '',
    source: 'app',
    opportunities: '',
    auto_start: false,
    created_at: now,
    updated_at: now,
    ...extra,
  });
}

function write(site: { domain: string }, ladders: LadderRow[], existing: LadderSettingsRow | undefined, ladderId: string, change: Record<string, unknown>, now: string): SettingsWrite {
  return existing
    ? { ladderId, insert: false, data: settingsData({ ...change, updated_at: now }) }
    : { ladderId, insert: true, data: newLadderRow(site, ladderId, ladders, now, change) };
}

/** Writes for one ladder's mode / status (PATCH …/ladders/:ladderId), with the priorities that keep the order as it is. */
export function ladderSettingsWrites(o: { site: { domain: string }; ladders: LadderRow[]; settings: LadderSettingsRow[]; ladderId: string; change: LadderSettingsInput; now: string }): SettingsWrite[] {
  const of = settingsByLadder(o.settings);
  const change: Record<string, unknown> = {};
  if (o.change.mode) change.mode = o.change.mode;
  if (o.change.status) change.status = o.change.status;
  const writes = new Map<string, Record<string, unknown>>();
  if (prioOf(of.get(o.ladderId)) === Infinity) {
    const order = ladderOrder(o.ladders, o.settings);
    let next = Math.max(0, ...order.map((id) => prioOf(of.get(id))).filter((p) => p !== Infinity));
    for (const id of order) {
      if (prioOf(of.get(id)) !== Infinity) continue;
      writes.set(id, { priority: ++next });
      if (id === o.ladderId) break;
    }
  }
  writes.set(o.ladderId, { ...(writes.get(o.ladderId) ?? {}), ...change });
  return [...writes.entries()].map(([id, c]) => write(o.site, o.ladders, of.get(id), id, c, o.now));
}

/** Writes for a new order (PUT …/ladders/order): priorities 1..n, only where they change. Every ladder of the website once. */
export function ladderOrderWrites(o: { site: { domain: string }; ladders: LadderRow[]; settings: LadderSettingsRow[]; ladderIds: string[]; now: string }): SettingsWrite[] {
  const ids = new Set(o.ladders.filter((r) => r.ladder_id).map((r) => r.ladder_id));
  if (o.ladderIds.length !== ids.size || o.ladderIds.some((id) => !ids.has(id)))
    throw badRequest('List every keyword ladder of this website once, in the new order.', { ladderIds: 'List every keyword ladder of this website once' });
  const of = settingsByLadder(o.settings);
  return o.ladderIds
    .map((id, i) => ({ id, priority: i + 1 }))
    .filter((x) => prioOf(of.get(x.id)) !== x.priority)
    .map((x) => write(o.site, o.ladders, of.get(x.id), x.id, { priority: x.priority }, o.now));
}

/** The write that records a won ladder (rank tracker callback); none when it is paused, archived or already won. */
export function wonWrite(o: { site: { domain: string }; ladders: LadderRow[]; settings: LadderSettingsRow[]; ladderId: string; now: string }): SettingsWrite | null {
  const cur = settingsByLadder(o.settings).get(o.ladderId);
  const st = String(cur?.status || '').toLowerCase();
  if (['paused', 'archived', 'won'].includes(st)) return null;
  return write(o.site, o.ladders, cur, o.ladderId, { status: 'won' }, o.now);
}

/** The settings with the writes applied (what n8n holds afterwards). */
function withWrites(settings: LadderSettingsRow[], writes: SettingsWrite[]): LadderSettingsRow[] {
  const out = settings.map((r) => ({ ...r }));
  for (const w of writes) {
    const cur = out.find((r) => r.ladder_id === w.ladderId);
    if (cur) Object.assign(cur, w.data);
    else out.push({ ...(w.data as unknown as LadderSettingsRow) });
  }
  return out;
}

/**
 * Writes for the choices made in the "New keyword ladder" flow, applied when the ladder's plan arrives: `first` moves it to priority 1
 * (the others keep their order behind it), `mode` sets Auto / Manual. One write per ladder.
 */
export function ladderPrefsWrites(o: { site: { domain: string }; ladders: LadderRow[]; settings: LadderSettingsRow[]; ladderId: string; prefs: LadderPrefs; now: string }): SettingsWrite[] {
  let settings = o.settings;
  const out = new Map<string, SettingsWrite>();
  const add = (writes: SettingsWrite[]) => {
    for (const w of writes) {
      const prev = out.get(w.ladderId);
      out.set(w.ladderId, prev ? { ...prev, data: { ...prev.data, ...w.data } } : w);
    }
    settings = withWrites(settings, writes);
  };
  if (o.prefs.first) {
    const order = ladderOrder(o.ladders, settings);
    add(ladderOrderWrites({ site: o.site, ladders: o.ladders, settings, ladderIds: [o.ladderId, ...order.filter((id) => id !== o.ladderId)], now: o.now }));
  }
  if (o.prefs.mode) add(ladderSettingsWrites({ site: o.site, ladders: o.ladders, settings, ladderId: o.ladderId, change: { mode: o.prefs.mode }, now: o.now }));
  return [...out.values()];
}

/** The '_site' row for new defaults (PATCH …/automation): the changed columns, or the whole row (current values + change) when new. */
export function automationWrite(o: { site: { domain: string }; settings: LadderSettingsRow[]; change: SiteAutomationInput; now: string }): { data: Record<string, unknown>; insert: boolean; automation: SiteAutomation } {
  const cur = siteAutomation(o.settings);
  const next: SiteAutomation = {
    ...cur,
    ...(o.change.defaultMode ? { defaultMode: o.change.defaultMode } : {}),
    ...(o.change.opportunities ? { opportunities: o.change.opportunities } : {}),
    ...(o.change.maxActiveLadders != null ? { maxActiveLadders: o.change.maxActiveLadders } : {}),
    ...(o.change.maxWaiting != null ? { maxWaiting: o.change.maxWaiting } : {}),
    ...(o.change.autoStartLadders != null ? { autoStartLadders: o.change.autoStartLadders } : {}),
  };
  const cols = { mode: o.change.defaultMode, opportunities: o.change.opportunities, max_active: o.change.maxActiveLadders, max_waiting: o.change.maxWaiting, auto_start: o.change.autoStartLadders };
  const exists = o.settings.some((r) => r.ladder_id === LADDER_SITE_ROW);
  if (exists) return { insert: false, automation: next, data: settingsData({ ...cols, updated_at: o.now }) };
  return {
    insert: true,
    automation: next,
    data: settingsData({
      ladder_id: LADDER_SITE_ROW,
      site_id: n8nSiteId(o.site.domain),
      domain: o.site.domain,
      head_keyword: '',
      mode: next.defaultMode,
      status: '',
      plan_type: '',
      source: 'app',
      opportunities: next.opportunities,
      auto_start: next.autoStartLadders,
      max_active: next.maxActiveLadders,
      max_waiting: next.maxWaiting,
      created_at: o.now,
      updated_at: o.now,
    }),
  };
}

// ---------------- n8n ----------------

const byDomain = (domain: string) => ({ columnName: 'domain', condition: 'eq' as const, value: domain });
const byLadder = (id: string) => ({ columnName: 'ladder_id', condition: 'eq' as const, value: id });

/** The website's ladder rows and settings rows, read fresh (writes must not decide on cached rows). */
async function current(site: SiteRow): Promise<{ ladders: LadderRow[]; settings: LadderSettingsRow[] }> {
  const [ladders, settings] = await Promise.all([
    siteRows<LadderRow>('ladders', site.domain, { max: 2000, fresh: true }),
    siteRows<LadderSettingsRow>('ladderSettings', site.domain, { max: 500, fresh: true }),
  ]);
  return { ladders: ladders.filter((r) => r.ladder_id && r.keyword), settings };
}

/** 404 unless the ladder is one of the website's (seo_ladders rows of its domain). */
export function assertLadderOfSite(ladders: LadderRow[], ladderId: string) {
  if (!ladderId || ladderId === LADDER_SITE_ROW || !ladders.some((r) => r.ladder_id === ladderId)) throw notFound('Keyword ladder not found');
}

async function apply(site: SiteRow, writes: SettingsWrite[]) {
  if (!writes.length) return;
  await ensureTable('ladderSettings', LADDER_SETTINGS_COLUMNS);
  // one ladder at a time: n8n's upsert runs in a transaction per call
  // each write drops the table's cached reads, so the next page load sees it
  for (const w of writes) await upsertRow('ladderSettings', [byLadder(w.ladderId), byDomain(site.domain)], w.data);
}

export async function updateLadderSettings(site: SiteRow, ladderId: string, change: LadderSettingsInput): Promise<void> {
  const cur = await current(site);
  assertLadderOfSite(cur.ladders, ladderId);
  await apply(site, ladderSettingsWrites({ site, ...cur, ladderId, change, now: new Date().toISOString() }));
}

export async function reorderLadders(site: SiteRow, ladderIds: string[]): Promise<void> {
  const cur = await current(site);
  await apply(site, ladderOrderWrites({ site, ...cur, ladderIds, now: new Date().toISOString() }));
}

/** Deletes a keyword ladder in n8n: its pages (seo_ladders), its settings row and its rank checks. Written pages stay in the content log. */
export async function deleteLadder(site: SiteRow, ladderId: string): Promise<void> {
  const cur = await current(site);
  assertLadderOfSite(cur.ladders, ladderId);
  const f = [byDomain(site.domain), byLadder(ladderId)];
  await deleteRows('ladders', f);
  await deleteRows('ladderSettings', f);
  await deleteRows('rankHistory', f);
}

export async function updateSiteAutomation(site: SiteRow, change: SiteAutomationInput): Promise<SiteAutomation> {
  const settings = await siteRows<LadderSettingsRow>('ladderSettings', site.domain, { max: 500, fresh: true });
  const w = automationWrite({ site, settings, change, now: new Date().toISOString() });
  await ensureTable('ladderSettings', LADDER_SETTINGS_COLUMNS);
  await upsertRow('ladderSettings', [byLadder(LADDER_SITE_ROW), byDomain(site.domain)], w.data);
  return w.automation;
}

/** The new ladder's choices from the "New keyword ladder" flow (ladder_plan callback). False when the ladder has no rows (yet). */
export async function applyLadderPrefs(site: SiteRow, ladderId: string, prefs: LadderPrefs): Promise<boolean> {
  const cur = await current(site);
  if (!cur.ladders.some((r) => r.ladder_id === ladderId)) return false;
  await apply(site, ladderPrefsWrites({ site, ...cur, ladderId, prefs, now: new Date().toISOString() }));
  return true;
}

/** Rank tracker callback with `won: true`: the ladder's settings say 'won' (unless the person paused it). */
export async function markLadderWon(site: SiteRow, ladderId: string): Promise<boolean> {
  const cur = await current(site);
  if (!cur.ladders.some((r) => r.ladder_id === ladderId)) return false;
  const w = wonWrite({ site, ...cur, ladderId, now: new Date().toISOString() });
  if (!w) return false;
  await apply(site, [w]);
  return true;
}
