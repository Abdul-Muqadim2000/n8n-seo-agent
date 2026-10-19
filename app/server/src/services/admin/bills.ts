import { sql } from 'drizzle-orm';
import type { ProviderBill } from '@seo/shared';
import { config } from '../../config';
import { db, schema } from '../../db';
import type { PeriodRange } from './period';
import { execRows, tsv } from './sqlRows';

// What the providers really billed, platform-wide, beside what the panel attributed to runs. Never throws: a provider that cannot be
// read answers `source: 'unavailable'` with the reason in one sentence.

/** the network, replaceable in tests */
export const providerHttp = {
  fetch: (url: string, init: RequestInit): Promise<Response> => fetch(url, init),
};

const CACHE_MS = 15 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, f: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await f();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return value;
}
export const resetBillCache = () => cache.clear();

const ratio = (billed: number | null, attributed: number) => (billed != null && attributed > 0 ? Math.round((billed / attributed) * 1000) / 1000 : null);
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const why = (err: unknown) => String((err as Error)?.message ?? err).slice(0, 120);

// ---------------- Anthropic: the Admin API cost report ----------------
// GET /v1/organizations/cost_report (Admin key, `anthropic-version: 2023-06-01`), daily buckets (`bucket_width=1d`, at most 31 per
// page, `has_more` / `next_page`); each bucket's `results[].amount` is a decimal STRING in the lowest currency unit (cents), USD.

/** the cost report's total in USD between two instants; throws on any failure */
export async function anthropicBilled(from: Date, to: Date): Promise<number> {
  let cents = 0;
  let page: string | null = null;
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams({ starting_at: from.toISOString(), ending_at: to.toISOString(), bucket_width: '1d', limit: '31' });
    if (page) q.set('page', page);
    const res = await providerHttp.fetch(`https://api.anthropic.com/v1/organizations/cost_report?${q}`, {
      headers: { 'x-api-key': config.admin.anthropicAdminKey, 'anthropic-version': '2023-06-01', accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Anthropic answered ${res.status}${res.status === 401 || res.status === 403 ? ' (the key is not an Admin API key, or it was revoked)' : ''}`);
    const j = (await res.json()) as { data?: { results?: { amount?: unknown; currency?: unknown }[] }[]; has_more?: boolean; next_page?: string | null };
    for (const b of j.data ?? []) for (const r of b.results ?? []) {
      const n = Number(r.amount);
      if (Number.isFinite(n) && (r.currency == null || r.currency === 'USD')) cents += n;
    }
    if (!j.has_more || !j.next_page) break;
    page = j.next_page;
  }
  return r4(cents / 100);
}

export async function anthropicBill(range: PeriodRange, attributedUsd: number, earliest: Date | null): Promise<ProviderBill> {
  const base = { provider: 'anthropic' as const, attributedUsd: r4(attributedUsd) };
  if (!config.admin.anthropicAdminKey)
    return {
      ...base,
      billedUsd: null,
      ratio: null,
      asOf: null,
      source: 'unavailable',
      note: 'Not readable: set ANTHROPIC_ADMIN_API_KEY (an Admin API key, sk-ant-admin…, from the Claude Console → Settings → Admin keys) in app/.env to see what Claude really billed.',
    };
  // 'all' starts at the first cost the panel knows of (the report needs a start), at most 400 days back
  const from = range.from ?? earliest ?? new Date(range.to.getTime() - 30 * 86_400_000);
  const start = new Date(Math.max(from.getTime(), range.to.getTime() - 400 * 86_400_000));
  try {
    const billed = await cached(`anthropic:${start.toISOString().slice(0, 13)}:${range.to.toISOString().slice(0, 13)}`, () => anthropicBilled(start, range.to));
    return {
      ...base,
      billedUsd: billed,
      ratio: ratio(billed, attributedUsd),
      asOf: new Date().toISOString(),
      source: 'provider',
      note: "Anthropic's cost report for the whole organisation of the key (every workspace and every use of it, not only this platform), in daily buckets, so the newest hours may be missing.",
    };
  } catch (err) {
    return { ...base, billedUsd: null, ratio: null, asOf: null, source: 'unavailable', note: `Not readable: the Anthropic cost report could not be read (${why(err)}).` };
  }
}

// ---------------- DataForSEO: the balance ----------------
// `GET /v3/appendix/user_data` is free and answers the balance (`tasks[0].result[0].money.balance`). What DataForSEO billed in a window
// is how far the balance fell between readings: the engine takes a reading when each run is reserved and when it settles
// (`dfs_balance`, `dfs_balance_end` on seo_run_ledger, copied onto cost_events), and every fall between two consecutive readings is
// money spent. A rise is a top-up and is not counted.

export async function dataforseoBalance(): Promise<number> {
  const auth = Buffer.from(`${config.admin.dataforseo.login}:${config.admin.dataforseo.password}`).toString('base64');
  const res = await providerHttp.fetch('https://api.dataforseo.com/v3/appendix/user_data', {
    headers: { authorization: `Basic ${auth}`, accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`DataForSEO answered ${res.status}`);
  const j = (await res.json()) as { tasks?: { result?: { money?: { balance?: unknown } }[] }[] };
  const b = Number(j.tasks?.[0]?.result?.[0]?.money?.balance);
  if (!Number.isFinite(b)) throw new Error('the answer had no balance');
  return b;
}

/** the money spent between consecutive balance readings (falls only), pure */
export function balanceSpend(readings: { at: Date; balance: number }[]): number {
  const s = readings.filter((r) => r.balance > 0).sort((a, b) => a.at.getTime() - b.at.getTime());
  let spent = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i - 1].balance - s[i].balance;
    if (d > 0) spent += d;
  }
  return r4(spent);
}

export async function dataforseoBill(range: PeriodRange, attributedUsd: number): Promise<ProviderBill> {
  const base = { provider: 'dataforseo' as const, attributedUsd: r4(attributedUsd) };
  const rows = await execRows<{ started_at: string | null; occurred_at: string; balance_before: number; balance_after: number }>(
    db,
    sql`select started_at, occurred_at, balance_before, balance_after from ${schema.costEvents}
        where (balance_before > 0 or balance_after > 0) and occurred_at < ${tsv(range.to)} ${range.from ? sql`and occurred_at >= ${tsv(range.from)}` : sql``}`,
  );
  const readings: { at: Date; balance: number }[] = [];
  for (const r of rows) {
    if (Number(r.balance_before) > 0) readings.push({ at: new Date(r.started_at ?? r.occurred_at), balance: Number(r.balance_before) });
    if (Number(r.balance_after) > 0) readings.push({ at: new Date(r.occurred_at), balance: Number(r.balance_after) });
  }
  let live: number | null = null;
  let liveNote = '';
  if (config.admin.dataforseo.enabled) {
    try {
      live = await cached('dfs:balance', dataforseoBalance);
    } catch (err) {
      liveNote = ` The live balance could not be read (${why(err)}).`;
    }
  }
  // the window runs up to now: the live reading closes it
  if (live != null && Date.now() - range.to.getTime() < 60_000) readings.push({ at: new Date(), balance: live });
  const billed = readings.length >= 2 ? balanceSpend(readings) : null;
  const source: ProviderBill['source'] = live != null ? 'provider' : billed != null ? 'engine-ledger' : 'unavailable';
  const how =
    billed != null
      ? `How far the DataForSEO balance fell across ${readings.length} readings in the period (the engine reads it when runs start and settle${live != null ? ', plus the live balance now' : ''}); top-ups are not counted.`
      : live != null
        ? `The balance is $${live.toFixed(2)} now; what was billed in this period cannot be told yet: the engine recorded fewer than two balance readings in it.`
        : 'Not readable: the engine recorded fewer than two balance readings in this period.';
  const creds = config.admin.dataforseo.enabled ? '' : ' Set SEO_DATAFORSEO_LOGIN / SEO_DATAFORSEO_PASSWORD for the live balance.';
  return {
    ...base,
    billedUsd: billed,
    ratio: ratio(billed, attributedUsd),
    balanceUsd: live,
    asOf: live != null ? new Date().toISOString() : readings.length ? new Date(Math.max(...readings.map((r) => r.at.getTime()))).toISOString() : null,
    source,
    note: (how + liveNote + creds).trim(),
  };
}
