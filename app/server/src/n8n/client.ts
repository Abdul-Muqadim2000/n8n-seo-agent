import { n8nSiteId, TABLES, type TableKey } from '@seo/shared';
import { config } from '../config';
import { HttpError } from '../lib/errors';

// Everything the app needs from n8n: the API front door (start a run), the Admin API (Site Admin actions) and the public API's Data
// Tables (read the stored results). The webhook secret and the n8n API key never leave this server.

export interface StartRunResult {
  ok: boolean;
  status: number;
  requestId: string | null;
  etaMinutes: number | null;
  error: string | null;
  /** B-A6: the engine recognised this as a repeat of a request already running and did NOT start a second run or spend again.
   *  `requestId` is then the FIRST run's id, so the caller must resolve to that run rather than wait for a callback of its own. */
  duplicate: boolean;
  firstSeenAt: string | null;
}

export async function startRun(body: Record<string, unknown>, orgId: string): Promise<StartRunResult> {
  if (!config.n8n.webhookKey)
    return { ok: false, status: 0, requestId: null, etaMinutes: null, error: 'The SEO engine is not configured (SEO_API_KEY missing)', duplicate: false, firstSeenAt: null };
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + config.n8n.runPath, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.n8n.webhookKey,
        // Quick Validate turns this into client_ip; the Rate Limit keys app requests per company (build_v4.py section 21)
        'x-forwarded-for': `app:${orgId}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    return { ok: false, status: 0, requestId: null, etaMinutes: null, error: 'The SEO engine is not reachable right now (' + String((err as Error).message || err) + ')', duplicate: false, firstSeenAt: null };
  }
  const json = (await res.json().catch(() => ({}))) as { status?: string; request_id?: unknown; estimated_minutes?: unknown; error?: string; message?: string; duplicate?: unknown; first_seen_at?: unknown };
  if (res.status === 202 && json.status === 'accepted') {
    return {
      ok: true,
      status: 202,
      requestId: json.request_id != null ? String(json.request_id) : null,
      etaMinutes: Number(json.estimated_minutes) || null,
      error: null,
      duplicate: json.duplicate === true,
      firstSeenAt: json.first_seen_at != null && json.first_seen_at !== '' ? String(json.first_seen_at) : null,
    };
  }
  const error = json.error || json.message || (res.status === 404 ? 'The SEO engine webhook is not active' : `The SEO engine answered ${res.status}`);
  return { ok: false, status: res.status, requestId: json.request_id != null ? String(json.request_id) : null, etaMinutes: null, error, duplicate: false, firstSeenAt: null };
}

export interface AssessCallResult {
  /** answered: n8n's HTTP status and JSON (200 answer, 400 invalid, 429 limit, 502 DataForSEO failed, ...); unreachable: never arrived */
  kind: 'answered' | 'unreachable' | 'timeout';
  status: number;
  json: Record<string, unknown>;
  error: string | null;
}

/** The Keyword Check (SEOagentAssess): one keyword for one website, answered in about 5-20 s. Costs money in n8n (DataForSEO). */
export async function assessCall(body: Record<string, unknown>, orgId: string, timeoutMs: number): Promise<AssessCallResult> {
  if (!config.n8n.webhookKey) return { kind: 'unreachable', status: 0, json: {}, error: 'The SEO engine is not configured (SEO_API_KEY missing)' };
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + config.n8n.assessPath, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.n8n.webhookKey,
        // the check's own daily limit keys app requests per company (as the API front door's Rate Limit)
        'x-forwarded-for': `app:${orgId}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const e = err as Error;
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return { kind: timeout ? 'timeout' : 'unreachable', status: 0, json: {}, error: String(e?.message || err) };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { kind: 'answered', status: res.status, json: json && typeof json === 'object' && !Array.isArray(json) ? json : {}, error: null };
}

/** B3-7: the Publish Check (SEOagentPubCheck), a supplied page through the content gate's deterministic half; free, writes nothing. */
export async function publishCheckCall(body: Record<string, unknown>, orgId: string, timeoutMs = 30000): Promise<AssessCallResult> {
  if (!config.n8n.webhookKey) return { kind: 'unreachable', status: 0, json: {}, error: 'The SEO engine is not configured (SEO_API_KEY missing)' };
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + config.n8n.publishCheckPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.n8n.webhookKey, 'x-forwarded-for': `app:${orgId}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const e = err as Error;
    return { kind: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'unreachable', status: 0, json: {}, error: String(e?.message || err) };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { kind: 'answered', status: res.status, json: json && typeof json === 'object' && !Array.isArray(json) ? json : {}, error: null };
}

/**
 * H3 (2026-10-28): the final version of a written page (SEOagentFinalize, POST /webhook/seo-page-finalize, synchronous): only the sections the
 * client's answers change are rewritten, then the whole page is checked. Costs a model call or two; the answer reports it (`cost`).
 */
export async function finalizeCall(body: Record<string, unknown>, orgId: string, timeoutMs: number): Promise<AssessCallResult> {
  if (!config.n8n.webhookKey) return { kind: 'unreachable', status: 0, json: {}, error: 'The SEO engine is not configured (SEO_API_KEY missing)' };
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + config.n8n.finalizePath, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.n8n.webhookKey, 'x-forwarded-for': `app:${orgId}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const e = err as Error;
    return { kind: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'unreachable', status: 0, json: {}, error: String(e?.message || err) };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { kind: 'answered', status: res.status, json: json && typeof json === 'object' && !Array.isArray(json) ? json : {}, error: null };
}

export interface AdminCallResult {
  ok: boolean;
  action: string;
  affected: number;
  error: string | null;
}

export async function siteAdmin(body: Record<string, unknown>): Promise<AdminCallResult> {
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + config.n8n.adminPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.n8n.webhookKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    throw new HttpError(502, 'The SEO engine is not reachable right now (' + String((err as Error).message || err) + ')');
  }
  const json = (await res.json().catch(() => ({}))) as Partial<AdminCallResult>;
  if (res.status === 404) throw new HttpError(502, 'The Admin API workflow is not active in n8n (SEOagentAdminAPI)');
  return { ok: !!json.ok && res.ok, action: String(json.action ?? body.action ?? ''), affected: Number(json.affected) || 0, error: json.error ?? (res.ok ? null : `n8n answered ${res.status}`) };
}

/** v4.13 Link Builder on demand: answered at once (202), the run delivers its report through the callback. */
export async function linkBuilderRun(body: Record<string, unknown>): Promise<{ ok: boolean; requestId: string | null; error: string | null }> {
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + config.n8n.linkBuilderPath, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': config.n8n.webhookKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  } catch (err) {
    throw new HttpError(502, 'The SEO engine is not reachable right now (' + String((err as Error).message || err) + ')');
  }
  if (res.status === 404) throw new HttpError(502, 'The Link Builder workflow is not active in n8n (SEOagentLinkBld1)');
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; request_id?: string; error?: string };
  return { ok: res.ok && json.ok !== false, requestId: json.request_id ?? null, error: json.error ?? (res.ok ? null : `n8n answered ${res.status}`) };
}

/** W2-FIX (2026-10-23): the AI repeat pilot (SEOagentAIPilAPI, answered 202 at once). Without `confirm: true` the engine only prices it and posts the
 *  quote to the callback (stage ai_pilot_quote); with it, it runs once and posts the result (stage ai_pilot). */
export async function aiPilotRun(body: { domain: string; confirm: boolean; callback_url: string; request_id: string }): Promise<{ ok: boolean; requestId: string | null; error: string | null }> {
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + config.n8n.aiPilotPath, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': config.n8n.webhookKey }, body: JSON.stringify({ ...body, confirm: body.confirm === true }), signal: AbortSignal.timeout(30000) });
  } catch (err) {
    throw new HttpError(502, 'The SEO engine is not reachable right now (' + String((err as Error).message || err) + ')');
  }
  if (res.status === 404) throw new HttpError(502, 'The AI repeat pilot is not active in the SEO engine yet (SEOagentAIPilAPI).');
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; request_id?: string; error?: string };
  return { ok: res.ok && json.ok !== false, requestId: json.request_id ?? null, error: json.error ?? (res.ok ? null : `n8n answered ${res.status}`) };
}

export interface ReplyReading { ok: boolean; class: string; summary: string; return_date: string; referral_email: string; referral_name: string; needs_you: boolean; suggested_reply: string; /** D14: claims in the suggested answer the facts on file do not carry (already bracketed in the text) */ unverified?: string[]; link_found: boolean; link: { url: string; rel: string; anchor: string } | null; model_error?: string; error?: string }
/** v4.13 Reply Reader (synchronous, Claude Haiku ≈ $0.001): what a reply means, a suggested answer, and our link checked on their page. */
export async function replyRead(body: Record<string, unknown>): Promise<ReplyReading | null> {
  try {
    const res = await fetch(config.n8n.baseUrl + config.n8n.replyPath, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': config.n8n.webhookKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    if (!res.ok) return null;
    return (await res.json()) as ReplyReading;
  } catch {
    return null;
  }
}

// ---------------- Data Tables (n8n public API) ----------------

type Filter = { columnName: string; condition: 'eq' | 'neq' | 'like' | 'ilike' | 'gt' | 'gte' | 'lt' | 'lte'; value: string | number | boolean };

let tableIds: Map<string, string> | null = null;
let tableIdsAt = 0;

async function api<T>(path: string): Promise<T> {
  return (await apiSized<T>(path)).data;
}

/** One n8n API read with the size of its body in bytes (R-A8: the read cache is bounded by bytes). */
async function apiSized<T>(path: string): Promise<{ data: T; bytes: number }> {
  if (!config.n8n.apiKey) throw new HttpError(503, 'N8N_API_KEY is not configured');
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + '/api/v1' + path, { headers: { 'x-n8n-api-key': config.n8n.apiKey, accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  } catch (err) {
    throw new HttpError(502, 'n8n is not reachable (' + String((err as Error).message || err) + ')');
  }
  if (!res.ok) throw new HttpError(502, `n8n API ${path.split('?')[0]} answered ${res.status}`);
  const text = await res.text();
  return { data: JSON.parse(text) as T, bytes: Buffer.byteLength(text) };
}

/**
 * R-A8 (review 2026-10-23): the read cache, bounded. Entries expire after `ttlMs` and expired ones are swept on every write (they used
 * to stay until the same key was read again); the whole cache is held under `maxBytes` (the JSON size of the reads) by dropping the least
 * recently used entries; a single read larger than `maxEntryBytes` is not cached at all. Wave 2's answer rows (whole answers, JSON
 * columns) made one site's read tens of MB on a 4 GB machine that also runs n8n and Postgres.
 */
export class ReadCache {
  private m = new Map<string, { at: number; rows: unknown[]; bytes: number }>();
  private total = 0;
  constructor(
    private ttlMs: number,
    private maxBytes: number,
    private maxEntryBytes: number,
    private maxEntries = 500,
    private now: () => number = Date.now,
  ) {}
  get(key: string): unknown[] | undefined {
    const e = this.m.get(key);
    if (!e) return undefined;
    if (this.now() - e.at >= this.ttlMs) {
      this.delete(key);
      return undefined;
    }
    // least recently used goes first: a hit moves to the end
    this.m.delete(key);
    this.m.set(key, e);
    return e.rows;
  }
  set(key: string, rows: unknown[], bytes: number): void {
    this.delete(key);
    this.sweep();
    if (bytes > this.maxEntryBytes) return;
    this.m.set(key, { at: this.now(), rows, bytes });
    this.total += bytes;
    for (const k of this.m.keys()) {
      if (this.total <= this.maxBytes && this.m.size <= this.maxEntries) break;
      this.delete(k);
    }
  }
  delete(key: string): void {
    const e = this.m.get(key);
    if (!e) return;
    this.total -= e.bytes;
    this.m.delete(key);
  }
  /** removes every expired entry */
  sweep(): void {
    const t = this.now();
    for (const [k, e] of [...this.m]) if (t - e.at >= this.ttlMs) this.delete(k);
  }
  keys(): string[] {
    return [...this.m.keys()];
  }
  stats(): { entries: number; bytes: number } {
    return { entries: this.m.size, bytes: this.total };
  }
}

/** A21: a table that was not there when the list was last read is not looked for again for this long (a table the engine has not created
 *  yet, such as the index coverage tables before its first run, used to re-read the whole table list on every read). */
const MISSING_TABLE_MS = 5 * 60_000;
const missingTables = new Map<string, number>();

async function tableId(name: string): Promise<string | null> {
  const fresh = !!tableIds && Date.now() - tableIdsAt <= 10 * 60_000;
  if (fresh && !tableIds!.has(name) && Date.now() - (missingTables.get(name) ?? 0) < MISSING_TABLE_MS) return null;
  if (!tableIds || !fresh || !tableIds.has(name)) {
    const m = new Map<string, string>();
    let cursor: string | null = null;
    do {
      const page: { data: { id: string; name: string }[]; nextCursor: string | null } = await api(`/data-tables?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      for (const t of page.data) m.set(t.name, t.id);
      cursor = page.nextCursor;
    } while (cursor);
    tableIds = m;
    tableIdsAt = Date.now();
    if (m.has(name)) missingTables.delete(name);
    else missingTables.set(name, Date.now());
  }
  return tableIds.get(name) ?? null;
}

// Short cache: dashboards read several tables per page; the data changes weekly, a page refresh should not hammer n8n. Identical
// reads that run at the same time (one page loads several dashboards in parallel) share one request.
const CACHE_MS = 60_000;
// R-A8: 96 MB in all, no single read over 24 MB (READ_CACHE_MB overrides the total)
const CACHE_MAX_BYTES = Math.max(8, Number(process.env.READ_CACHE_MB) || 96) * 1024 * 1024;
const cache = new ReadCache(CACHE_MS, CACHE_MAX_BYTES, CACHE_MAX_BYTES / 4);
const inflight = new Map<string, Promise<unknown[]>>();
/** For the platform admin and tests: what the read cache holds. */
export const readCacheStats = () => cache.stats();
// a write bumps the table's generation: a read that started before the write must not put the old rows back into the cache
const generation = new Map<string, number>();

/** Forgets every cached read of a table (after the app wrote to it). */
function forgetTable(name: string) {
  generation.set(name, (generation.get(name) ?? 0) + 1);
  const tag = JSON.stringify(name);
  for (const k of cache.keys()) if (k.includes(tag)) cache.delete(k);
  for (const k of [...inflight.keys()]) if (k.includes(tag)) inflight.delete(k);
}

export interface RowQuery {
  filters?: Filter[];
  sortBy?: string;
  /** stop after this many rows (pages of 250) */
  max?: number;
  fresh?: boolean;
}

export async function rows<T>(table: TableKey, q: RowQuery = {}): Promise<T[]> {
  const name = TABLES[table];
  const key = JSON.stringify([name, q.filters, q.sortBy, q.max]);
  const hit = q.fresh ? undefined : cache.get(key);
  if (hit) return hit as T[];
  const running = q.fresh ? undefined : inflight.get(key);
  if (running) return (await running) as T[];
  const gen = generation.get(name) ?? 0;
  const p = fetchRows<T>(name, q).then(({ rows: out, bytes }) => {
    if ((generation.get(name) ?? 0) === gen) cache.set(key, out, bytes);
    return out;
  });
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    if (inflight.get(key) === p) inflight.delete(key);
  }
}

async function fetchRows<T>(name: string, q: RowQuery): Promise<{ rows: T[]; bytes: number }> {
  const id = await tableId(name);
  // the table is created on first use by the workflows: none yet means no rows (cached like rows, so the table list is not re-read)
  if (!id) return { rows: [], bytes: 2 };
  const max = q.max ?? 2000;
  const out: T[] = [];
  let bytes = 0;
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ limit: String(Math.min(250, max - out.length)) });
    if (q.filters?.length) params.set('filter', JSON.stringify({ type: 'and', filters: q.filters }));
    if (q.sortBy) params.set('sortBy', q.sortBy);
    if (cursor) params.set('cursor', cursor);
    const r = await apiSized<{ data: T[]; nextCursor: string | null }>(`/data-tables/${id}/rows?${params}`);
    out.push(...r.data.data);
    bytes += r.bytes;
    cursor = r.data.nextCursor;
  } while (cursor && out.length < max);
  return { rows: out, bytes };
}

/** Updates every row matching all filters (n8n public API, PATCH rows/update). Returns false when the table does not exist yet. */
export async function updateRows(table: TableKey, filters: Filter[], data: Record<string, unknown>): Promise<boolean> {
  if (!config.n8n.apiKey) throw new HttpError(503, 'N8N_API_KEY is not configured');
  const id = await tableId(TABLES[table]);
  if (!id) return false;
  const res = await fetch(`${config.n8n.baseUrl}/api/v1/data-tables/${id}/rows/update`, {
    method: 'PATCH',
    headers: { 'x-n8n-api-key': config.n8n.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ filter: { type: 'and', filters }, data }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new HttpError(502, `n8n rows/update on ${TABLES[table]} answered ${res.status}`);
  forgetTable(TABLES[table]);
  return true;
}

/** Inserts rows (n8n public API, POST rows). */
export async function insertRows(table: TableKey, data: Record<string, unknown>[]): Promise<boolean> {
  if (!config.n8n.apiKey) throw new HttpError(503, 'N8N_API_KEY is not configured');
  const id = await tableId(TABLES[table]);
  if (!id || !data.length) return false;
  const res = await fetch(`${config.n8n.baseUrl}/api/v1/data-tables/${id}/rows`, {
    method: 'POST',
    headers: { 'x-n8n-api-key': config.n8n.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ data, returnType: 'count' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new HttpError(502, `n8n rows insert on ${TABLES[table]} answered ${res.status}`);
  forgetTable(TABLES[table]);
  return true;
}

/** Deletes every row matching all filters (n8n public API, DELETE rows/delete). */
export async function deleteRows(table: TableKey, filters: Filter[]): Promise<boolean> {
  if (!config.n8n.apiKey) throw new HttpError(503, 'N8N_API_KEY is not configured');
  if (!filters.length) throw new Error('deleteRows needs a filter');
  const id = await tableId(TABLES[table]);
  if (!id) return false;
  const res = await fetch(`${config.n8n.baseUrl}/api/v1/data-tables/${id}/rows/delete?filter=${encodeURIComponent(JSON.stringify({ type: 'and', filters }))}`, {
    method: 'DELETE',
    headers: { 'x-n8n-api-key': config.n8n.apiKey },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new HttpError(502, `n8n rows delete on ${TABLES[table]} answered ${res.status}`);
  forgetTable(TABLES[table]);
  return true;
}

/** A Data Table write n8n answered with an error: its HTTP status and its own message are kept for the caller to explain (never the request). */
export class EngineWriteError extends HttpError {
  constructor(
    message: string,
    public engineStatus: number,
    public engineMessage: string,
    public table: string,
  ) {
    super(502, message);
  }
}

/** n8n's error text for a failed write (its JSON `message`), short; never the request. */
async function n8nError(res: Response): Promise<string> {
  const j = (await res.json().catch(() => null)) as { message?: unknown } | null;
  return typeof j?.message === 'string' ? j.message.slice(0, 200) : '';
}

/**
 * Updates the rows matching all filters with `data` (only the given columns change), or inserts `data` as a new row when none
 * matches (n8n public API, POST rows/upsert: one transaction in n8n). The table must exist (see ensureTable).
 */
export async function upsertRow(table: TableKey, filters: Filter[], data: Record<string, unknown>): Promise<void> {
  if (!config.n8n.apiKey) throw new HttpError(503, 'N8N_API_KEY is not configured');
  if (!filters.length) throw new Error('upsertRow needs a filter');
  const name = TABLES[table];
  const id = await tableId(name);
  if (!id) throw new HttpError(502, `The SEO engine has no ${name} table yet`);
  let res: Response;
  try {
    res = await fetch(`${config.n8n.baseUrl}/api/v1/data-tables/${id}/rows/upsert`, {
      method: 'POST',
      headers: { 'x-n8n-api-key': config.n8n.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ filter: { type: 'and', filters }, data, returnData: false }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new HttpError(502, 'n8n is not reachable (' + String((err as Error).message || err) + ')');
  }
  forgetTable(name);
  if (!res.ok) {
    const why = await n8nError(res);
    throw new EngineWriteError(`The SEO engine did not save the change (rows/upsert on ${name} answered ${res.status}${why ? `: ${why}` : ''})`, res.status, why, name);
  }
}

/**
 * Creates the Data Table with exactly these columns when it does not exist yet (in the SEO Agent's n8n project); returns its id.
 * Two creators at once: n8n answers 409 to the second one, which then reads the id.
 */
export async function ensureTable(table: TableKey, columns: readonly { name: string; type: string }[]): Promise<string> {
  if (!config.n8n.apiKey) throw new HttpError(503, 'N8N_API_KEY is not configured');
  const name = TABLES[table];
  const existing = await tableId(name);
  if (existing) return existing;
  let res: Response;
  try {
    res = await fetch(`${config.n8n.baseUrl}/api/v1/data-tables`, {
      method: 'POST',
      headers: { 'x-n8n-api-key': config.n8n.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ name, columns: columns.map((c) => ({ name: c.name, type: c.type })), ...(config.n8n.projectId ? { projectId: config.n8n.projectId } : {}) }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new HttpError(502, 'n8n is not reachable (' + String((err as Error).message || err) + ')');
  }
  if (res.ok) {
    const t = (await res.json().catch(() => ({}))) as { id?: string };
    if (t.id) {
      if (tableIds) tableIds.set(name, t.id);
      missingTables.delete(name);
      forgetTable(name);
      return t.id;
    }
  } else if (res.status !== 409) {
    const why = await n8nError(res);
    throw new HttpError(502, `The SEO engine could not create the ${name} table (${res.status}${why ? `: ${why}` : ''})`);
  }
  tableIds = null;
  missingTables.delete(name);
  const id = await tableId(name);
  if (!id) throw new HttpError(502, `The SEO engine could not create the ${name} table`);
  return id;
}

/** Rows of one site: every table carries `domain` (rank history too). */
export function siteRows<T>(table: TableKey, domain: string, q: Omit<RowQuery, 'filters'> & { extra?: Filter[] } = {}): Promise<T[]> {
  return rows<T>(table, { ...q, filters: [{ columnName: 'domain', condition: 'eq', value: domain }, ...(q.extra ?? [])] });
}

/** Forgets the cached reads of one website: those filtered by its domain, and (A20) those filtered by the engine's site id, which is how
 *  the index coverage tables are read. */
export function invalidateSite(domain: string) {
  const tags = [JSON.stringify(domain), JSON.stringify(n8nSiteId(domain))];
  for (const k of [...cache.keys()]) if (tags.some((t) => k.includes(t))) cache.delete(k);
}

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  /** how it started: "trigger" (schedule), "webhook", "integrated" (sub-workflow), "manual" */
  mode?: string;
}

/** Recent executions of a workflow with a status (newest first). */
export async function executions(workflowId: string, status: 'error' | 'success' | 'running', limit = 20): Promise<ExecutionSummary[]> {
  const r: { data: ExecutionSummary[] } = await api(`/executions?workflowId=${encodeURIComponent(workflowId)}&status=${status}&limit=${limit}`);
  return r.data ?? [];
}

/**
 * Every execution of a workflow with a status that started at or after `since`, newest first, paged through n8n's cursor (N-app-5). A
 * fixed "newest 150" read covers too few days of a workflow that runs many executions a day (the daily index check runs one per website
 * plus retries), so older schedule fires read as missed. Stops at `maxPages` pages (the caller is told by `complete: false`).
 */
export async function executionsSince(
  workflowId: string,
  status: 'error' | 'success',
  since: Date,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<{ list: ExecutionSummary[]; complete: boolean }> {
  const pageSize = Math.min(250, Math.max(1, opts.pageSize ?? 250));
  const maxPages = Math.max(1, opts.maxPages ?? 40);
  const out: ExecutionSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const q = `/executions?workflowId=${encodeURIComponent(workflowId)}&status=${status}&limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const r: { data?: ExecutionSummary[]; nextCursor?: string | null } = await api(q);
    const data = r.data ?? [];
    out.push(...data);
    const oldest = data.length ? Date.parse(data[data.length - 1].startedAt) : NaN;
    cursor = r.nextCursor ?? null;
    if (!data.length || !cursor || (Number.isFinite(oldest) && oldest < since.getTime())) return { list: out.filter((e) => !(Date.parse(e.startedAt) < since.getTime())), complete: true };
  }
  return { list: out.filter((e) => !(Date.parse(e.startedAt) < since.getTime())), complete: false };
}

/** One execution with its data: the error and the request id the run carried (Normalize Input / API Entry / Manual Run). */
export async function executionFailure(id: string): Promise<{ requestId: string | null; error: string; node: string | null }> {
  const d: { data?: { resultData?: { error?: { message?: string; node?: { name?: string } }; runData?: Record<string, { data?: { main?: { json?: Record<string, unknown> }[][] } }[]> } } } =
    await api(`/executions/${encodeURIComponent(id)}?includeData=true`);
  const rd = d.data?.resultData ?? {};
  let requestId: string | null = null;
  for (const n of ['Normalize Input', 'API Entry', 'Manual Run', 'Admin Run']) {
    const j = rd.runData?.[n]?.[0]?.data?.main?.[0]?.[0]?.json;
    const v = j?.request_id ?? (j?.body as Record<string, unknown> | undefined)?.request_id;
    if (v != null && v !== '') {
      requestId = String(v);
      break;
    }
  }
  return { requestId, error: String(rd.error?.message ?? 'unknown error').slice(0, 300), node: rd.error?.node?.name ?? null };
}

export async function n8nHealth(): Promise<{ api: boolean; webhook: boolean }> {
  let apiOk = false;
  try {
    await api('/data-tables?limit=1');
    apiOk = true;
  } catch {
    apiOk = false;
  }
  let hookOk = false;
  try {
    const r = await fetch(config.n8n.baseUrl + '/healthz', { signal: AbortSignal.timeout(5000) });
    hookOk = r.ok;
  } catch {
    hookOk = false;
  }
  return { api: apiOk, webhook: hookOk };
}
