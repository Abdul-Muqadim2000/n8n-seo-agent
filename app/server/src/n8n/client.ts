import { TABLES, type TableKey } from '@seo/shared';
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
}

export async function startRun(body: Record<string, unknown>, orgId: string): Promise<StartRunResult> {
  if (!config.n8n.webhookKey) return { ok: false, status: 0, requestId: null, etaMinutes: null, error: 'The SEO engine is not configured (SEO_API_KEY missing)' };
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
    return { ok: false, status: 0, requestId: null, etaMinutes: null, error: 'The SEO engine is not reachable right now (' + String((err as Error).message || err) + ')' };
  }
  const json = (await res.json().catch(() => ({}))) as { status?: string; request_id?: unknown; estimated_minutes?: unknown; error?: string; message?: string };
  if (res.status === 202 && json.status === 'accepted') {
    return { ok: true, status: 202, requestId: json.request_id != null ? String(json.request_id) : null, etaMinutes: Number(json.estimated_minutes) || null, error: null };
  }
  const error = json.error || json.message || (res.status === 404 ? 'The SEO engine webhook is not active' : `The SEO engine answered ${res.status}`);
  return { ok: false, status: res.status, requestId: json.request_id != null ? String(json.request_id) : null, etaMinutes: null, error };
}

export interface AssessCallResult {
  /** answered: n8n's HTTP status and JSON (200 answer, 400 invalid, 429 limit, 502 DataForSEO failed, …); unreachable: never arrived */
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

// ---------------- Data Tables (n8n public API) ----------------

type Filter = { columnName: string; condition: 'eq' | 'neq' | 'like' | 'ilike' | 'gt' | 'gte' | 'lt' | 'lte'; value: string | number | boolean };

let tableIds: Map<string, string> | null = null;
let tableIdsAt = 0;

async function api<T>(path: string): Promise<T> {
  if (!config.n8n.apiKey) throw new HttpError(503, 'N8N_API_KEY is not configured');
  let res: Response;
  try {
    res = await fetch(config.n8n.baseUrl + '/api/v1' + path, { headers: { 'x-n8n-api-key': config.n8n.apiKey, accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  } catch (err) {
    throw new HttpError(502, 'n8n is not reachable (' + String((err as Error).message || err) + ')');
  }
  if (!res.ok) throw new HttpError(502, `n8n API ${path.split('?')[0]} answered ${res.status}`);
  return (await res.json()) as T;
}

async function tableId(name: string): Promise<string | null> {
  if (!tableIds || Date.now() - tableIdsAt > 10 * 60_000 || !tableIds.has(name)) {
    const m = new Map<string, string>();
    let cursor: string | null = null;
    do {
      const page: { data: { id: string; name: string }[]; nextCursor: string | null } = await api(`/data-tables?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      for (const t of page.data) m.set(t.name, t.id);
      cursor = page.nextCursor;
    } while (cursor);
    tableIds = m;
    tableIdsAt = Date.now();
  }
  return tableIds.get(name) ?? null;
}

// Short cache: dashboards read several tables per page; the data changes weekly, a page refresh should not hammer n8n. Identical
// reads that run at the same time (one page loads several dashboards in parallel) share one request.
const cache = new Map<string, { at: number; rows: unknown[] }>();
const inflight = new Map<string, Promise<unknown[]>>();
const CACHE_MS = 60_000;
// a write bumps the table's generation: a read that started before the write must not put the old rows back into the cache
const generation = new Map<string, number>();

/** Forgets every cached read of a table (after the app wrote to it). */
function forgetTable(name: string) {
  generation.set(name, (generation.get(name) ?? 0) + 1);
  const tag = JSON.stringify(name);
  for (const k of [...cache.keys()]) if (k.includes(tag)) cache.delete(k);
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
  const hit = cache.get(key);
  if (!q.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.rows as T[];
  const running = q.fresh ? undefined : inflight.get(key);
  if (running) return (await running) as T[];
  const gen = generation.get(name) ?? 0;
  const p = fetchRows<T>(name, q).then((out) => {
    if ((generation.get(name) ?? 0) === gen) {
      cache.set(key, { at: Date.now(), rows: out });
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
    }
    return out;
  });
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    if (inflight.get(key) === p) inflight.delete(key);
  }
}

async function fetchRows<T>(name: string, q: RowQuery): Promise<T[]> {
  const id = await tableId(name);
  // the table is created on first use by the workflows: none yet means no rows (cached like rows, so the table list is not re-read)
  if (!id) return [];
  const max = q.max ?? 2000;
  const out: T[] = [];
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ limit: String(Math.min(250, max - out.length)) });
    if (q.filters?.length) params.set('filter', JSON.stringify({ type: 'and', filters: q.filters }));
    if (q.sortBy) params.set('sortBy', q.sortBy);
    if (cursor) params.set('cursor', cursor);
    const page: { data: T[]; nextCursor: string | null } = await api(`/data-tables/${id}/rows?${params}`);
    out.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor && out.length < max);
  return out;
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
    throw new HttpError(502, `The SEO engine did not save the change (rows/upsert on ${name} answered ${res.status}${why ? `: ${why}` : ''})`);
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
      forgetTable(name);
      return t.id;
    }
  } else if (res.status !== 409) {
    const why = await n8nError(res);
    throw new HttpError(502, `The SEO engine could not create the ${name} table (${res.status}${why ? `: ${why}` : ''})`);
  }
  tableIds = null;
  const id = await tableId(name);
  if (!id) throw new HttpError(502, `The SEO engine could not create the ${name} table`);
  return id;
}

/** Rows of one site: every table carries `domain` (rank history too). */
export function siteRows<T>(table: TableKey, domain: string, q: Omit<RowQuery, 'filters'> & { extra?: Filter[] } = {}): Promise<T[]> {
  return rows<T>(table, { ...q, filters: [{ columnName: 'domain', condition: 'eq', value: domain }, ...(q.extra ?? [])] });
}

export function invalidateSite(domain: string) {
  for (const k of [...cache.keys()]) if (k.includes(JSON.stringify(domain))) cache.delete(k);
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
