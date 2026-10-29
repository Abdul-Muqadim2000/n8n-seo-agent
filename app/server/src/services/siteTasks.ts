import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import {
  cleanDomain,
  deriveSiteTasks,
  indexingCauseOfKey,
  indexingCauseReadings,
  indexingPageFixed,
  INDEXING_CHECK_MAX_URLS,
  INDEXING_FETCHES_PAGES,
  INDEXING_NEEDS_SITEMAP,
  isSitemapIndex,
  n8nSiteId,
  robotsBlocked,
  safeJson,
  samePageUrl,
  sitemapLocs,
  siteTaskPayload,
  type AiGrowthRow,
  type IndexPageRow,
  type IndexRunRow,
  type AiVisibilityRow,
  type SiteTask,
  type SiteTaskCheck,
  type SiteTaskCheckBy,
  type SiteTaskInputs,
  type SiteTaskKind,
  type StoredSiteTask,
} from '@seo/shared';
import { requireVerified, type SiteAccess } from '../auth/access';
import { db, schema } from '../db';
import type { OrgRow, SiteRow, SiteTaskRow } from '../db/schema';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { rows as n8nRows, siteRows } from '../n8n/client';
import { audit } from './audit';
import { fetchPublicOnce, fetchPublicText } from './verify';

/** what this module logs through: a request's or the app's logger, or the callback's delivery log */
type Log = { warn: (o: object, msg: string) => void };

// Steps on your website (app/docs/SITE_TASKS.md, 2026-10-28). The rule for what a step is and whether it is done lives in
// shared/src/site-tasks.ts; this module feeds it the engine's readings and the stored rows, runs each step's own check on the client's
// website, stores what the app saw, and keeps checking every day so a client on autopilot who never presses a button still sees "Done"
// once the change is made, and sees it reopened if it is undone.

const DAY = 864e5;
/** websites being read right now (the client's check and the daily job never read one website at the same time) */
const inFlight = new Set<string>();
/** a daily check that misses a done step looks again this much later; only the second miss reopens it */
const MISS_RECHECK_MS = 60 * 60 * 1000;
/** one check may take this long at most (a website that trickles its answer must not hold the daily job) */
const CHECK_DEADLINE_MS = 45_000;

// ---------------------------------------------------------------- the engine's readings (three small reads, not the whole dashboard)

type P = Record<string, unknown>;
const arrOf = (v: unknown): P[] => (Array.isArray(v) ? (v as P[]) : []);
const s = (v: unknown) => (v == null ? '' : String(v));

/**
 * The latest AI growth run (the IndexNow key and whether the file was found), the newest AI visibility run that read crawler access,
 * and the latest FULL backlink report (the weekly light watch does not look for broken pages, so its silence would read as "fixed").
 */
export async function engineReadings(org: Pick<OrgRow, 'id'>, site: Pick<SiteRow, 'id' | 'domain'>): Promise<SiteTaskInputs> {
  const d = site.domain;
  const [growth, vis, full, indexing] = await Promise.all([
    siteRows<AiGrowthRow>('aiGrowth', d, { sortBy: 'checked_at:desc', max: 1 }).catch(() => [] as AiGrowthRow[]),
    siteRows<AiVisibilityRow>('aiVisibility', d, { sortBy: 'checked_at:desc', max: 10 }).catch(() => [] as AiVisibilityRow[]),
    db.query.reports.findFirst({
      where: and(eq(schema.reports.orgId, org.id), eq(schema.reports.siteId, site.id), eq(schema.reports.stage, 'backlinks'), sql`${schema.reports.payload}->>'mode' = 'full'`),
      orderBy: desc(schema.reports.receivedAt),
      columns: { payload: true, receivedAt: true },
    }),
    indexingReading(d),
  ]);
  const g = growth[0];
  const inx = g ? ((safeJson<P>(s(g.submitted_json), {}).indexnow ?? {}) as P) : {};
  const keyUrl = s(inx.key_url);
  const key = (keyUrl.match(/\/([a-f0-9]{32})\.txt$/) || [])[1] || '';
  const accessRow = vis.find((v) => s((v as unknown as P).access_json).length > 2);
  const acc = accessRow ? safeJson<P>(s((accessRow as unknown as P).access_json), {}) : null;
  const rp = (full?.payload ?? null) as P | null;
  return {
    domain: cleanDomain(d),
    indexnow: g && key ? { keyUrl, key, verified: inx.verified === true || inx.verified === 'true', checkedAt: s(g.checked_at) } : null,
    access: acc
      ? {
          checkedAt: s(acc.checked_at) || s((accessRow as unknown as P).checked_at),
          bots: arrOf(acc.bots).map((b) => ({
            bot: s(b.bot),
            owner: s(b.owner),
            group: s(b.group) === 'training' ? ('training' as const) : ('answer' as const),
            // the stored row says `allowed` (AI_Metrics.js); the crawler node's own output `allowed_root`
            allowed: (b.allowed_root ?? b.allowed) === true || (b.allowed_root ?? b.allowed) === 'true',
            rule: s(b.rule),
            blockedPaths: Array.isArray(b.blocked_paths) ? b.blocked_paths.map(String) : [],
          })),
        }
      : null,
    reclaim: rp && full
      ? { receivedAt: full.receivedAt.toISOString(), items: arrOf(rp.reclaim).map((r) => ({ brokenUrl: s(r.broken_url), redirectTo: s(r.redirect_to), links: Number(r.links) || 0, domains: Array.isArray(r.domains) ? r.domains.map(String) : [] })) }
      : null,
    indexing,
  };
}

/** the most site-fix page rows one website's steps read (the steps list 25 pages a cause; the count beyond the cap says "at least") */
const INDEXING_READ_MAX = 1500;

/**
 * Index coverage (2026-10-29): the engine's daily index check, as the steps need it: its newest run (when it read the website) and the
 * pages only the client can fix, grouped by cause. Two small reads by the engine's site id (the table is keyed by it); rows of another
 * domain that shares the id are dropped (engineIdCollides). A failure is null: a step already stored keeps its last state, nothing else
 * changes, and the other steps still read.
 */
async function indexingReading(domain: string): Promise<SiteTaskInputs['indexing']> {
  const sid = n8nSiteId(domain);
  const mine = <T extends { domain?: string }>(xs: T[]) => xs.filter((r) => !r.domain || cleanDomain(r.domain) === cleanDomain(domain));
  try {
    const [runs, pages] = await Promise.all([
      n8nRows<IndexRunRow>('indexRuns', { filters: [{ columnName: 'site_id', condition: 'eq', value: sid }], sortBy: 'run_at:desc', max: 1 }),
      n8nRows<IndexPageRow>('indexPages', { filters: [{ columnName: 'site_id', condition: 'eq', value: sid }, { columnName: 'action', condition: 'eq', value: 'site_fix' }], max: INDEXING_READ_MAX }),
    ]);
    const run = mine(runs)[0];
    if (!run?.run_at) return null;
    return { runAt: String(run.run_at), causes: indexingCauseReadings(mine(pages)) };
  } catch {
    return null;
  }
}

/** two payloads alike whatever their key order (Postgres jsonb stores keys in its own order) */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as P).sort().map((k) => [k, canon((v as P)[k])])) : v;
const samePayload = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// ---------------------------------------------------------------- stored rows

async function rowsOf(siteId: string): Promise<SiteTaskRow[]> {
  return db.select().from(schema.siteTasks).where(eq(schema.siteTasks.siteId, siteId));
}

async function storedOf(rows: SiteTaskRow[]): Promise<StoredSiteTask[]> {
  const ids = [...new Set(rows.map((r) => r.skippedBy).filter((x): x is string => !!x))];
  const names = ids.length ? new Map((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids))).map((u) => [u.id, u.name])) : new Map<string, string>();
  return rows.map((r) => ({
    key: r.taskKey,
    kind: r.kind,
    payload: r.payload ?? {},
    lastCheck: r.lastCheck ?? null,
    doneAt: r.doneAt?.toISOString() ?? null,
    skippedAt: r.skippedAt?.toISOString() ?? null,
    skippedBy: r.skippedBy ? (names.get(r.skippedBy) ?? 'a former member') : r.skippedAt ? 'someone' : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

interface TaskState {
  inputs: SiteTaskInputs;
  rows: SiteTaskRow[];
  stored: StoredSiteTask[];
  tasks: SiteTask[];
}

async function stateOf(org: Pick<OrgRow, 'id'>, site: Pick<SiteRow, 'id' | 'domain'>): Promise<TaskState> {
  const [inputs, rows] = await Promise.all([engineReadings(org, site), rowsOf(site.id)]);
  const stored = await storedOf(rows);
  return { inputs, rows, stored, tasks: deriveSiteTasks(inputs, stored) };
}

/**
 * Keeps a row for every step the website has (so the daily check can read it even when nobody opens the app) and refreshes a to-do
 * step's values when the engine's reading changed them (another crawler blocked). Never touches a done or skipped step's values: they
 * say what was fixed. New rows are checked in the background at once.
 */
async function materialize(org: OrgRow, site: SiteRow, st: TaskState, log?: Log): Promise<void> {
  if (!site.verifiedAt) return;
  const byKey = new Map(st.rows.map((r) => [r.taskKey, r]));
  const created: string[] = [];
  for (const t of st.tasks) {
    const p = siteTaskPayload(st.inputs, st.stored, t.key);
    if (!p) continue;
    const row = byKey.get(t.key);
    if (!row) {
      const ins = await db
        .insert(schema.siteTasks)
        .values({ orgId: org.id, siteId: site.id, taskKey: t.key, kind: p.kind, payload: p.payload })
        .onConflictDoNothing()
        .returning({ id: schema.siteTasks.id });
      if (ins.length) created.push(t.key);
    } else if (t.state === 'todo' && !samePayload(row.payload, p.payload)) {
      await db.update(schema.siteTasks).set({ payload: p.payload, updatedAt: new Date() }).where(eq(schema.siteTasks.id, row.id));
    }
  }
  if (created.length) void checkSiteNow(site.id, log).catch((err) => log?.warn({ err: String(err), site: site.id }, 'site task first check failed'));
}

/** The website's steps, for the Pipeline, Recommendations, the Overview and the tasks endpoint. */
export async function siteTasksOf(org: OrgRow, site: SiteRow, log?: Log): Promise<SiteTask[]> {
  const st = await stateOf(org, site);
  await materialize(org, site, st, log).catch((err) => log?.warn({ err: String(err), site: site.id }, 'site tasks could not be stored'));
  return st.tasks;
}

// ---------------------------------------------------------------- the checks (the client's own website only)

export interface CheckOutcome {
  ok: boolean;
  message: string;
  /** false: the website did not answer at all (a daily check does not record that as "not done") */
  reached: boolean;
}

const hostOf = (url: string) => cleanDomain(url.match(/^https?:\/\/([^/?#:]+)/i)?.[1] ?? '');
const onSite = (url: string, domain: string) => hostOf(url) === cleanDomain(domain);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const shortPath = (url: string) => url.replace(/^https?:\/\/[^/]+/i, '') || '/';

async function checkIndexnow(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const keyUrl = str(payload.keyUrl);
  const m = keyUrl.match(/^https:\/\/([^/]+)\/([a-f0-9]{32})\.txt$/);
  if (!m || !onSite(keyUrl, domain)) return { ok: false, reached: true, message: 'The file address is not on your website, so there is nothing we can check yet.' };
  const r = await fetchPublicText(keyUrl, 4096).catch(() => null);
  if (!r) return { ok: false, reached: false, message: `We could not open ${keyUrl} (no answer from the website).` };
  if (r.status === 200 && r.text.trim() === m[2]) return { ok: true, reached: true, message: 'The file is in place and holds the key.' };
  if (r.status === 200) return { ok: false, reached: true, message: 'The address answers, but the file does not contain only the key.' };
  return { ok: false, reached: true, message: `The address answers ${r.status}: the file is not there yet.` };
}

async function checkCrawlers(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const bots = (Array.isArray(payload.bots) ? (payload.bots as Record<string, unknown>[]) : []).map((b) => ({ bot: str(b.bot), paths: Array.isArray(b.paths) ? b.paths.map(String) : ['/'] })).filter((b) => b.bot);
  if (!bots.length) return { ok: true, reached: true, message: 'No AI search crawler is listed as blocked.' };
  const url = `https://${cleanDomain(domain)}/robots.txt`;
  const r = await fetchPublicText(url, 512 * 1024).catch(() => null);
  if (!r) return { ok: false, reached: false, message: `We could not open ${url} (no answer from the website).` };
  // the engine's rules (v5/code/AI_Access.js): a server error means "do not crawl"; a missing file or an HTML page blocks nothing
  if (r.status >= 500) return { ok: false, reached: true, message: `robots.txt answers ${r.status}. Crawlers read a server error as "do not crawl anything", so make it answer 200 (or 404 when you have no rules).` };
  const found = r.status >= 200 && r.status < 300 && !/<html/i.test(r.text.slice(0, 500));
  const blocked = found ? bots.flatMap((b) => robotsBlocked(r.text, [b.bot], b.paths)) : [];
  if (!blocked.length) return { ok: true, reached: true, message: found ? 'robots.txt lets every AI search crawler read your pages.' : 'There is no robots.txt rule left that blocks the AI search crawlers.' };
  const first = blocked.slice(0, 3).map((b) => `${b.bot} from ${b.path} (${b.rule})`).join('; ');
  return { ok: false, reached: true, message: `robots.txt still blocks ${first}${blocked.length > 3 ? ` and ${blocked.length - 3} more` : ''}.` };
}

async function checkRedirect(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const broken = str(payload.brokenUrl).replace(/^http:\/\//i, 'https://');
  if (!/^https:\/\//i.test(broken) || !onSite(broken, domain)) return { ok: false, reached: true, message: 'The old address is not on your website, so there is nothing we can check.' };
  const first = await fetchPublicOnce(broken).catch(() => null);
  if (!first) return { ok: false, reached: false, message: `We could not open ${broken} (no answer from the website).` };
  if (first.status >= 200 && first.status < 300) return { ok: true, reached: true, message: 'The old address opens a page again.' };
  if (first.status >= 300 && first.status < 400 && first.location) {
    const to = first.location;
    if (first.status === 302 || first.status === 303 || first.status === 307)
      return { ok: false, reached: true, message: `It redirects to ${shortPath(to)}, but with a temporary ${first.status}. Change it to a permanent 301 and check again.` };
    const end = await fetchPublicText(to, 64 * 1024).catch(() => null);
    if (!end) return { ok: false, reached: false, message: `It redirects permanently to ${to}, which did not answer.` };
    if (!onSite(end.finalUrl, domain)) return { ok: false, reached: true, message: `It redirects to another website (${hostOf(end.finalUrl)}). The links only keep their value on a page of ${cleanDomain(domain)}.` };
    if (end.status !== 200) return { ok: false, reached: true, message: `It redirects permanently to ${shortPath(end.finalUrl)}, but that page answers ${end.status}.` };
    return { ok: true, reached: true, message: `It redirects permanently to ${shortPath(end.finalUrl)}, which opens.` };
  }
  return { ok: false, reached: true, message: `The old address still answers ${first.status}.` };
}

/** A website's sitemap addresses, read once for a check: robots.txt `Sitemap:` lines, else /sitemap.xml; an index is followed for at most
 *  5 child sitemaps. null: no sitemap could be read (a sitemap cause is then not decided by the app; the engine's reading decides). */
async function sitemapUrls(domain: string): Promise<Set<string> | null> {
  const d = cleanDomain(domain);
  const robots = await fetchPublicText(`https://${d}/robots.txt`, 256 * 1024).catch(() => null);
  const listed = robots && robots.status === 200 ? [...robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1].replace(/^http:\/\//i, 'https://')) : [];
  const roots = [...new Set([...listed.filter((u) => onSite(u, d)).slice(0, 3), `https://${d}/sitemap.xml`])];
  const out = new Set<string>();
  let read = false;
  // one round per level, each in parallel (the whole check must fit inside 45 s): the roots, then at most 5 child sitemaps of an index
  const level = async (urls: string[]): Promise<string[]> => {
    const answers = await Promise.all(urls.map((u) => fetchPublicText(u, 4 * 1024 * 1024).catch(() => null)));
    const children: string[] = [];
    for (const r of answers) {
      if (!r || r.status !== 200) continue;
      read = true;
      const locs = sitemapLocs(r.text);
      if (isSitemapIndex(r.text)) children.push(...locs.filter((u) => onSite(u, d)).map((u) => u.replace(/^http:\/\//i, 'https://')));
      else for (const u of locs) out.add(u);
    }
    return children;
  };
  const children = await level(roots);
  if (children.length) await level([...new Set(children)].slice(0, 5));
  return read ? out : null;
}

/**
 * Index coverage (2026-10-29): the app's own check of one indexing step. Opens at most 10 of its pages on the website's own host (the
 * safe fetcher, https, public addresses, size cap; the headers only for X-Robots-Tag), reads the sitemap once where the cause needs it
 * and robots.txt for a robots block. Done only when every page it opened is fixed. A page that did not answer means the website did not
 * answer: nothing is recorded (the SITE_TASKS.md rule).
 */
async function checkIndexing(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const cause = indexingCauseOfKey(`indexing:${str(payload.cause)}`);
  const urls = (Array.isArray(payload.urls) ? payload.urls : []).map(String).map((u) => u.replace(/^http:\/\//i, 'https://')).filter((u) => /^https:\/\//i.test(u) && onSite(u, domain)).slice(0, INDEXING_CHECK_MAX_URLS);
  if (!cause || !urls.length) return { ok: false, reached: true, message: 'None of the listed pages is on your website, so there is nothing we can check.' };
  // the sitemap and the pages are read at the same time (one check must fit inside 45 s)
  const sitemapRead = INDEXING_NEEDS_SITEMAP.has(cause) ? sitemapUrls(domain).catch(() => null) : Promise.resolve(null);
  const pagesRead = INDEXING_FETCHES_PAGES.has(cause) ? fetchAllPages(urls) : Promise.resolve(null);
  const [sitemap, answers] = await Promise.all([sitemapRead, pagesRead]);
  if ((cause === 'not_in_sitemap' || cause === 'indexed_not_in_sitemap') && !sitemap) return { ok: false, reached: true, message: `We could not read a sitemap at https://${cleanDomain(domain)}/sitemap.xml or in your robots.txt.` };
  const inSitemap = (u: string): boolean | null => (sitemap ? [...sitemap].some((x) => samePageUrl(x, u)) : null);
  if (cause === 'robots_blocked') {
    const url = `https://${cleanDomain(domain)}/robots.txt`;
    const r = await fetchPublicText(url, 512 * 1024).catch(() => null);
    if (!r) return { ok: false, reached: false, message: `We could not open ${url} (no answer from the website).` };
    if (r.status >= 500) return { ok: false, reached: true, message: `robots.txt answers ${r.status}. Google reads a server error as "do not crawl anything".` };
    const found = r.status >= 200 && r.status < 300 && !/<html/i.test(r.text.slice(0, 500));
    const blocked = found ? robotsBlocked(r.text, ['Googlebot'], urls.map(shortPath)) : [];
    if (!blocked.length) return { ok: true, reached: true, message: `robots.txt lets Google read ${urls.length === 1 ? 'the page' : `all ${urls.length} pages we checked`}.` };
    return { ok: false, reached: true, message: `robots.txt still blocks Google from ${blocked.slice(0, 3).map((x) => `${x.path} (${x.rule})`).join('; ')}${blocked.length > 3 ? ` and ${blocked.length - 3} more` : ''}.` };
  }
  const results: { fixed: boolean; why: string }[] = [];
  if (answers) {
    const silent = urls.filter((_, i) => !answers[i]);
    if (silent.length) return { ok: false, reached: false, message: `We could not open ${silent[0]}${silent.length > 1 ? ` and ${silent.length - 1} more` : ''} (no answer from the website).` };
    urls.forEach((u, i) => results.push(indexingPageFixed(cause, answers[i]!, inSitemap(u))));
  } else {
    for (const u of urls) results.push(indexingPageFixed(cause, { url: u, status: 200, finalUrl: u, redirectStatus: 0, text: '' }, inSitemap(u)));
  }
  const left = results.filter((r) => !r.fixed);
  const total = Number(payload.total) || urls.length;
  const more = total > urls.length ? ` We opened the first ${urls.length} of ${total}; the daily index check reads the others.` : '';
  if (!left.length) return { ok: true, reached: true, message: `${urls.length === 1 ? results[0].why : `All ${urls.length} pages we checked are fixed.`}${more}` };
  return { ok: false, reached: true, message: `${left.length} of ${urls.length} still to fix: ${left.slice(0, 3).map((r) => r.why).join(' ')}${left.length > 3 ? ` And ${left.length - 3} more.` : ''}` };
}

/** The pages of a step, four at a time (ten pages at 10 s each must fit inside the 45 s cap of one check); a page with no answer is null. */
async function fetchAllPages(urls: string[]): Promise<(Awaited<ReturnType<typeof fetchIndexPage>>)[]> {
  const answers: Awaited<ReturnType<typeof fetchIndexPage>>[] = new Array(urls.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (next < urls.length) {
        const i = next++;
        answers[i] = await fetchIndexPage(urls[i]);
      }
    }),
  );
  return answers;
}

/** One page of an indexing step, read the way the check needs it (status after redirects, the first hop's status, X-Robots-Tag). */
async function fetchIndexPage(url: string): Promise<{ url: string; status: number; finalUrl: string; redirectStatus: number; text: string; xRobotsTag?: string | string[] } | null> {
  const r = await fetchPublicText(url, 512 * 1024, 4, { headers: true }).catch(() => null);
  if (!r) return null;
  return { url, status: r.status, finalUrl: r.finalUrl, redirectStatus: r.firstStatus ?? 0, text: r.text, xRobotsTag: r.headers?.['x-robots-tag'] };
}

/** The one check of a step's kind. An exhaustive switch: a kind added without its check does not compile (it used to fall through to the
 *  redirect check). */
function checkOf(domain: string, kind: SiteTaskKind, payload: Record<string, unknown>): Promise<CheckOutcome> {
  switch (kind) {
    case 'indexnow':
      return checkIndexnow(domain, payload);
    case 'ai_crawlers':
      return checkCrawlers(domain, payload);
    case 'redirect':
      return checkRedirect(domain, payload);
    case 'indexing':
      return checkIndexing(domain, payload);
    default: {
      const never: never = kind;
      // a row of a kind this build does not know (written by a newer one): nothing is read and nothing recorded
      return Promise.resolve({ ok: false, reached: false, message: `Unknown step ${String(never)}.` });
    }
  }
}

export function runSiteTaskCheck(domain: string, kind: SiteTaskKind, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const run = checkOf(domain, kind, payload);
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<CheckOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reached: false, message: `${cleanDomain(domain)} took too long to answer.` }), CHECK_DEADLINE_MS);
  });
  return Promise.race([run, late]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------- writing a reading

async function recordCheck(row: Pick<SiteTaskRow, 'id'>, out: CheckOutcome, by: SiteTaskCheckBy, who?: string): Promise<void> {
  const now = new Date();
  const check: SiteTaskCheck = { at: now.toISOString(), ok: out.ok, message: out.message, by, ...(who ? { who } : {}) };
  await db
    .update(schema.siteTasks)
    // `done_at` keeps its stored value on a miss (never a stale copy read before the check started)
    .set({ lastCheck: check, lastCheckAt: now, doneAt: out.ok ? now : sql`${schema.siteTasks.doneAt}`, missAt: null, updatedAt: now })
    .where(eq(schema.siteTasks.id, row.id));
}

/** The client's "I've done it, check now": runs the step's check on their website, stores it, writes the audit log, answers the step. */
export async function checkSiteTask(a: SiteAccess, req: FastifyRequest, body: unknown): Promise<SiteTask> {
  requireVerified(a.site);
  const key = str((body as Record<string, unknown> | null)?.key).slice(0, 600);
  const st = await stateOf(a.org, a.site);
  const task = st.tasks.find((t) => t.key === key);
  if (!task) throw notFound('This step is not on the list for this website any more.');
  if (task.state === 'skipped') throw badRequest('This step is skipped. Bring it back first, then check it.');
  const p = siteTaskPayload(st.inputs, st.stored, key);
  if (!p) throw notFound('This step is not on the list for this website any more.');
  let row = st.rows.find((r) => r.taskKey === key);
  if (!row) {
    [row] = await db
      .insert(schema.siteTasks)
      .values({ orgId: a.org.id, siteId: a.site.id, taskKey: key, kind: p.kind, payload: p.payload })
      .onConflictDoUpdate({ target: [schema.siteTasks.siteId, schema.siteTasks.taskKey], set: { payload: p.payload, updatedAt: new Date() } })
      .returning();
  } else if (task.state === 'todo') {
    await db.update(schema.siteTasks).set({ payload: p.payload }).where(eq(schema.siteTasks.id, row.id));
  }
  // one reader of a website at a time: the daily job never writes an older reading over this one
  for (let i = 0; inFlight.has(a.site.id) && i < 100; i++) await new Promise((r) => setTimeout(r, 100));
  inFlight.add(a.site.id);
  let out: CheckOutcome;
  try {
    out = await runSiteTaskCheck(a.site.domain, p.kind, p.payload);
  } finally {
    inFlight.delete(a.site.id);
  }
  // the website did not answer at all: nothing is recorded (one bad minute must never reopen a done step), the person is asked to retry
  if (!out.reached) throw new HttpError(503, `Your website did not answer just now, so nothing changed. Try again in a minute. (${out.message})`, 'site_unreachable');
  await recordCheck(row, out, 'you', a.user.name || a.user.email);
  await audit(req, a.org.id, {
    action: 'site_task.checked',
    outcome: out.ok ? 'success' : 'failure',
    target: { type: 'site', id: a.site.id, label: a.site.domain },
    details: { step: key, done: out.ok, result: out.message.slice(0, 300) },
  });
  const after = deriveSiteTasks(st.inputs, await storedOf(await rowsOf(a.site.id)));
  return after.find((t) => t.key === key)!;
}

/** Skip a step ("not for us") or bring it back. Members and above; written to the audit log. */
export async function skipSiteTask(a: SiteAccess, req: FastifyRequest, body: unknown, skip: boolean): Promise<SiteTask> {
  requireVerified(a.site);
  const key = str((body as Record<string, unknown> | null)?.key).slice(0, 600);
  const st = await stateOf(a.org, a.site);
  const task = st.tasks.find((t) => t.key === key);
  if (!task) throw notFound('This step is not on the list for this website any more.');
  const p = siteTaskPayload(st.inputs, st.stored, key);
  const now = new Date();
  const set = skip ? { skippedAt: now, skippedBy: a.user.id, updatedAt: now } : { skippedAt: null, skippedBy: null, updatedAt: now };
  await db
    .insert(schema.siteTasks)
    .values({ orgId: a.org.id, siteId: a.site.id, taskKey: key, kind: task.kind, payload: p?.payload ?? {}, ...set })
    .onConflictDoUpdate({ target: [schema.siteTasks.siteId, schema.siteTasks.taskKey], set });
  await audit(req, a.org.id, { action: skip ? 'site_task.skipped' : 'site_task.restored', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { step: key } });
  const after = deriveSiteTasks(st.inputs, await storedOf(await rowsOf(a.site.id)));
  return after.find((t) => t.key === key)!;
}

/** The old AI-page button (POST …/ai/indexnow/check, kept for open tabs): the same check, now stored like "check now". */
export async function checkIndexnowStep(a: SiteAccess, req: FastifyRequest): Promise<{ verified: boolean; keyUrl: string; message: string } | null> {
  const st = await stateOf(a.org, a.site);
  if (!st.tasks.some((t) => t.key === 'indexnow' && t.state !== 'skipped')) return null;
  const t = await checkSiteTask(a, req, { key: 'indexnow' });
  return { verified: t.state === 'done', keyUrl: str(siteTaskPayload(st.inputs, st.stored, 'indexnow')?.payload.keyUrl), message: t.lastCheck?.message ?? '' };
}

// ---------------------------------------------------------------- the daily check (SITE_TASK_JOBS)

/**
 * One daily reading of a stored step. A website that does not answer leaves the step as it was. A done step that is missing is looked at
 * again an hour later and reopened only on the second miss, so one bad minute of the client's hosting never raises a false alarm.
 */
async function dailyCheck(row: SiteTaskRow, domain: string): Promise<void> {
  const out = await runSiteTaskCheck(domain, row.kind, row.payload ?? {});
  const now = new Date();
  if (!out.reached) {
    await db.update(schema.siteTasks).set({ lastCheckAt: now }).where(eq(schema.siteTasks.id, row.id));
    return;
  }
  // no reading of ours yet: the engine may already call it done, so a first miss is looked at twice like a done step's
  const wasDone = row.lastCheck ? row.lastCheck.ok : true;
  if (!out.ok && wasDone && !row.missAt) {
    // first miss: due again in an hour (the tick picks rows whose last check is older than a day)
    await db.update(schema.siteTasks).set({ missAt: now, lastCheckAt: new Date(now.getTime() - DAY + MISS_RECHECK_MS) }).where(eq(schema.siteTasks.id, row.id));
    return;
  }
  await recordCheck(row, out, 'daily');
}

/** Checks one website's stored steps now (after they are first stored). */
async function checkSiteNow(siteId: string, log?: Log): Promise<void> {
  if (inFlight.has(siteId)) return;
  inFlight.add(siteId);
  try {
    const site = await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) });
    if (!site?.verifiedAt) return;
    for (const row of await db.select().from(schema.siteTasks).where(and(eq(schema.siteTasks.siteId, siteId), isNull(schema.siteTasks.skippedAt), isNull(schema.siteTasks.lastCheckAt))))
      await dailyCheck(row, site.domain).catch((err) => log?.warn({ err: String(err), task: row.taskKey }, 'site task check failed'));
  } finally {
    inFlight.delete(siteId);
  }
}

const synced = new Map<string, number>();

/**
 * The background job (index.ts, every 30 minutes; SITE_TASK_JOBS=false stops it): (1) stores the steps of websites nobody opened in the
 * last day, from the engine's data, so autopilot clients are covered too (a few websites a tick); (2) checks every stored step whose last
 * reading is older than a day (at most 60 a tick, one website at a time).
 */
let ticking = false;

export async function siteTaskTick(log: Log, opts: { sites?: number; checks?: number } = {}): Promise<{ synced: number; checked: number }> {
  // a tick still running (slow websites) is not joined by the next one
  if (ticking) return { synced: 0, checked: 0 };
  ticking = true;
  try {
    return await tick(log, opts);
  } finally {
    ticking = false;
  }
}

async function tick(log: Log, opts: { sites?: number; checks?: number }): Promise<{ synced: number; checked: number }> {
  const now = Date.now();
  let syncedN = 0;
  const sites = await db
    .select({ site: schema.sites, org: schema.organizations })
    .from(schema.sites)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.sites.orgId))
    .where(and(isNotNull(schema.sites.verifiedAt), eq(schema.sites.trackingStatus, 'active')));
  // the websites read longest ago first, so every tracked website gets its turn however many there are
  const order = sites.filter((x) => now - (synced.get(x.site.id) ?? 0) > DAY).sort((a, b) => (synced.get(a.site.id) ?? 0) - (synced.get(b.site.id) ?? 0));
  for (const { site, org } of order.slice(0, opts.sites ?? 5)) {
    synced.set(site.id, now);
    try {
      const st = await stateOf(org, site);
      await materialize(org, site, st, log);
      syncedN++;
    } catch (err) {
      log.warn({ err: String(err), site: site.id }, 'site tasks could not be read');
    }
  }
  // Index coverage (2026-10-29): the tick's budget stays fair. The other kinds take their turn first; indexing steps (each opens up to ten
  // pages) get what is left, at most a third of the budget, so a website with many indexing steps never starves the IndexNow, crawler and
  // redirect checks of every other website.
  const budget = opts.checks ?? 60;
  const dueOf = (kinds: 'others' | 'indexing', limit: number) =>
    limit <= 0
      ? Promise.resolve([] as { row: SiteTaskRow; domain: string; siteId: string }[])
      : db
          .select({ row: schema.siteTasks, domain: schema.sites.domain, siteId: schema.sites.id })
          .from(schema.siteTasks)
          .innerJoin(schema.sites, eq(schema.sites.id, schema.siteTasks.siteId))
          .where(
            and(
              isNull(schema.siteTasks.skippedAt),
              isNotNull(schema.sites.verifiedAt),
              // a paused website is not read every day (its steps keep their last state)
              eq(schema.sites.trackingStatus, 'active'),
              or(isNull(schema.siteTasks.lastCheckAt), lt(schema.siteTasks.lastCheckAt, new Date(now - DAY))),
              kinds === 'indexing' ? eq(schema.siteTasks.kind, 'indexing') : ne(schema.siteTasks.kind, 'indexing'),
            ),
          )
          .orderBy(sql`${schema.siteTasks.lastCheckAt} asc nulls first`, asc(schema.siteTasks.createdAt))
          .limit(limit);
  const others = await dueOf('others', budget);
  const due = [...others, ...(await dueOf('indexing', Math.min(Math.ceil(budget / 3), budget - others.length)))];
  let checked = 0;
  for (const d of due) {
    if (inFlight.has(d.siteId)) continue;
    inFlight.add(d.siteId);
    try {
      await dailyCheck(d.row, d.domain);
      checked++;
    } catch (err) {
      log.warn({ err: String(err), task: d.row.taskKey }, 'site task daily check failed');
    } finally {
      inFlight.delete(d.siteId);
    }
  }
  return { synced: syncedN, checked };
}

/** A callback that brings new engine readings (AI growth, AI visibility, backlinks): store the website's steps from them. */
export const SITE_TASK_STAGES: ReadonlySet<string> = new Set(['ai_growth', 'ai_visibility', 'backlinks', 'index_coverage']);
export async function afterSiteTaskCallback(org: OrgRow, site: SiteRow, log?: Log): Promise<void> {
  synced.set(site.id, Date.now());
  const st = await stateOf(org, site);
  await materialize(org, site, st, log);
}
