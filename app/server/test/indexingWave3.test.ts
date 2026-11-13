import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndexingData, Recommendation, SiteTask } from '@seo/shared';

// Index coverage wave 3 (n8n/seo-agent/docs/indexing-2026-10-29/DESIGN_WAVE3.md §3), the server half, on PGlite with the engine's tables and
// the client's website in memory, devaicon-shaped (anonymised: novaand-demo.com): the client's own mark on a page (`page-type`: members and
// up, this website's known pages only, ONLY `type_override` written through the Data Table write, audited, nothing saved when the write
// fails, the page shown in its new state at once), the sitemap dates step `indexing:sitemap_dates` (raised by the engine's reading, our own
// check reads the sitemap's <lastmod> counts, every SITE_TASKS.md rule), its recommendation, and the page's escalated pages.

const t = vi.hoisted(() => ({
  web: {} as Record<string, { status: number; text?: string; location?: string; headers?: Record<string, string> } | null>,
  fetched: [] as string[],
  pages: [] as Record<string, unknown>[],
  runs: [] as Record<string, unknown>[],
  monitors: [] as Record<string, unknown>[],
  updates: [] as { table: string; filters: unknown; data: Record<string, unknown> }[],
  updateOk: true,
}));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  type F = { columnName: string; condition?: string; value: unknown };
  // n8n's AND filters (eq / neq / gte) and its sortBy, as the app uses them
  const match = (xs: Record<string, unknown>[], filters: F[] = []) =>
    xs.filter((r) =>
      filters.every((f) => {
        const v = String(r[f.columnName] ?? '');
        return f.condition === 'neq' ? v !== String(f.value) : f.condition === 'gte' ? v !== '' && v >= String(f.value) : v === String(f.value);
      }),
    );
  const sorted = (xs: Record<string, unknown>[], sortBy?: string) => {
    if (!sortBy) return xs;
    const [col, dir] = sortBy.split(':');
    const v = (r: Record<string, unknown>) => r[col] ?? '';
    return [...xs].sort((a, b) => (v(a) === v(b) ? 0 : (v(a) > v(b) ? 1 : -1) * (dir === 'desc' ? -1 : 1)));
  };
  const rows = vi.fn(async (table: string, q: { filters?: F[]; max?: number; sortBy?: string } = {}) => {
    if (table === 'indexPages') return sorted(match(t.pages, q.filters), q.sortBy).slice(0, q.max ?? 2000);
    if (table === 'indexRuns') return sorted(match(t.runs, q.filters), q.sortBy).slice(0, q.max ?? 2000);
    return [];
  });
  const siteRows = vi.fn(async (table: string, domain: string) => (table === 'monitors' ? t.monitors.filter((m) => m.domain === domain) : []));
  const updateRows = vi.fn(async (table: string, filters: F[], data: Record<string, unknown>) => {
    t.updates.push({ table, filters, data });
    if (!t.updateOk) return false;
    for (const r of match(table === 'indexPages' ? t.pages : [], filters)) Object.assign(r, data);
    return true;
  });
  return { ...real, rows, siteRows, insertRows: vi.fn(async () => true), updateRows, upsertRow: vi.fn(async () => undefined), deleteRows: vi.fn(async () => true), ensureTable: vi.fn(async () => 'tbl'), invalidateSite: vi.fn(), executions: vi.fn(async () => []) };
});
vi.mock('../src/services/verify', async (orig) => {
  const real = await orig<typeof import('../src/services/verify')>();
  const answer = (url: string) => (url in t.web ? t.web[url] : { status: 404, text: 'not found' });
  return {
    ...real,
    fetchPublicText: vi.fn(async (url: string, _max?: number, _hops?: number, opts?: { headers?: boolean }) => {
      t.fetched.push(url);
      let cur = url;
      let first = 0;
      for (let i = 0; i < 5; i++) {
        const r = answer(cur);
        if (!r) return null;
        if (r.location) {
          if (i === 0) first = r.status;
          cur = r.location;
          continue;
        }
        return opts?.headers ? { status: r.status, text: r.text ?? '', finalUrl: cur, headers: r.headers ?? {}, firstStatus: first } : { status: r.status, text: r.text ?? '', finalUrl: cur };
      }
      return null;
    }),
    fetchPublicOnce: vi.fn(async (url: string) => {
      t.fetched.push(url);
      const r = answer(url);
      return r ? { status: r.status, location: r.location ?? null, text: r.text ?? '' } : null;
    }),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const svc = await import('../src/services/siteTasks');
const { indexingRecommendations } = await import('../src/services/recommendations');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const log = { warn: () => undefined };

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.web = {};
  t.fetched = [];
  t.pages = [];
  t.runs = [];
  t.monitors = [];
  t.updates = [];
  t.updateOk = true;
  svc.forgetSitemaps();
});

let seq = 0;
async function setup() {
  const n = ++seq;
  const email = `owner${n}@ixwave3.test`;
  const u = await signUp(app, email, 'Sam Owner');
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Index wave 3 ${n}` })).body as { id: string };
  const domain = `novaand-demo${n}.com`;
  const [site] = await db
    .insert(schema.sites)
    .values({ orgId: org.id, domain, country: 'United Arab Emirates', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active' })
    .returning();
  const sid = `site_${domain.replace(/[^a-z0-9]+/g, '-')}`;
  const url = (p: string) => `https://www.${domain}${p}`;
  return { u, org, site: site!, domain, sid, url, base: `/api/orgs/${org.id}/sites/${site!.id}` };
}
type S = Awaited<ReturnType<typeof setup>>;
const tasksOf = async (s: S) => ((await s.u.c.get(`${s.base}/tasks`)).body as { tasks: SiteTask[] }).tasks;
const rowOf = async (siteId: string, key: string) => (await db.select().from(schema.siteTasks).where(and(eq(schema.siteTasks.siteId, siteId), eq(schema.siteTasks.taskKey, key))))[0];
const settle = () => new Promise((r) => setTimeout(r, 50));
const html = (body: string) => `<html><head><title>x</title></head><body>${body}</body></html>`;

function run(s: S, o: { sitemaps?: Record<string, unknown>; at?: number } = {}) {
  const runAt = new Date(Date.now() - (o.at ?? 3_600_000)).toISOString();
  t.runs.push({
    site_id: s.sid,
    domain: s.domain,
    run_at: runAt,
    known: 10,
    indexed: 4,
    inspected: 10,
    by_cause_json: JSON.stringify({ unknown_to_google: 3, low_value: 1 }),
    by_action_json: JSON.stringify({ wait: 3, leave_out: 1 }),
    ...(o.sitemaps ? { sitemaps_json: JSON.stringify(o.sitemaps) } : {}),
  });
  return runAt;
}
/** devaicon's shape: pages Google has not visited (one of them escalated after 3 weeks), a policy page, the home page in search */
function site(s: S, runAt: string) {
  const p = (path: string, o: Record<string, unknown>) => t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url(path), lane: 'existing', state: 'not_indexed', inspect_at: runAt, http_status: 200, in_sitemap: true, ...o });
  p('/industries/retail', { cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([s.url('/')]), priority: 2, link_depth: 1, linked_n: 2, robots_ok: 'yes', words: 800 });
  p('/insights/agentic-ai', { cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([s.url('/insights')]), priority: 1, link_depth: 2, linked_n: 1, escalated_at: runAt, escalate_why: 'not_asked,weak_links,sitemap_no_dates' });
  p('/careers/dev', { cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([s.url('/careers')]), priority: 3 });
  p('/privacy', { cause: 'low_value', action: 'leave_out', state: 'excluded' });
  p('/', { cause: 'indexed', action: 'none', state: 'indexed' });
}
const pageOf = (d: IndexingData, path: string) => [...d.groups.flatMap((g) => g.pages), ...d.escalated].find((p) => p.path === path);

describe('the Indexing page with the engine\'s wave 3 columns', () => {
  it('escalated pages in their own list, the waiting group as a to-do, the sitemap dates reading', async () => {
    const s = await setup();
    const runAt = run(s, { sitemaps: { submitted: 1, read: 1, complete: true, dates: { urls: 40, with_lastmod: 0, distinct: 0 } } });
    site(s, runAt);
    const d = (await s.u.c.get(`${s.base}/data/indexing`)).body as IndexingData;
    expect(d.escalated.map((p) => p.path)).toEqual(['/insights/agentic-ai']);
    expect(d.escalated[0].escalateWhy).toEqual(['not_asked', 'weak_links', 'sitemap_no_dates']);
    const g = d.groups.find((x) => x.cause === 'linked_waiting')!;
    expect(g.pages.map((p) => p.path)).toEqual(['/industries/retail', '/careers/dev']);
    expect(g.todo!.text).toBe('Google has not visited 2 pages. 2 matter most. Do this: add dates to your sitemap.');
    expect(d.sitemapDates).toMatchObject({ urls: 40, withLastmod: 0, missing: true });
  });
});

describe('"This is an important page" / "Fine to leave out" / "Undo" (DESIGN_WAVE3 §3.4)', () => {
  const mark = (s: S, c: S['u']['c'], url: string, type: unknown) => c.post(`${s.base}/data/indexing/page-type`, { url, type });
  const audits = (s: S) => db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.orgId, s.org.id), eq(schema.auditEvents.action, 'indexing.page_type')));
  it('writes only type_override on that page\'s row, audits it, and the page shows its new state at once', async () => {
    const s = await setup();
    site(s, run(s));
    const r = await mark(s, s.u.c, s.url('/careers/dev'), 'utility');
    expect(r.status).toBe(200);
    expect(t.updates).toHaveLength(1);
    expect(t.updates[0]).toMatchObject({ table: 'indexPages', filters: [{ columnName: 'site_id', value: s.sid }, { columnName: 'url', value: s.url('/careers/dev') }] });
    expect(t.updates[0].data).toEqual({ type_override: 'utility' });
    expect(r.body.page).toMatchObject({ typeOverride: 'utility', action: 'leave_out', note: 'You marked this page as fine to leave out of Google.' });
    const [a] = await audits(s);
    expect(a.details).toMatchObject({ url: s.url('/careers/dev'), type: 'utility', was: '' });
    // the engine has not run since: the page is already filed as the client marked it
    const d = (await s.u.c.get(`${s.base}/data/indexing`)).body as IndexingData;
    expect(d.groups.find((g) => g.cause === 'marked_utility')!.pages.map((p) => p.path)).toEqual(['/careers/dev']);
    // the same mark again writes nothing; Undo writes '' and the page is back
    expect((await mark(s, s.u.c, s.url('/careers/dev'), 'utility')).status).toBe(200);
    expect(t.updates).toHaveLength(1);
    expect((await mark(s, s.u.c, s.url('/careers/dev'), '')).status).toBe(200);
    expect(t.updates[1].data).toEqual({ type_override: '' });
    const after = (await s.u.c.get(`${s.base}/data/indexing`)).body as IndexingData;
    expect(pageOf(after, '/careers/dev')).toMatchObject({ typeOverride: '', action: 'wait' });
    expect(await audits(s)).toHaveLength(2);
  });
  it('a policy page marked important waits for our next check instead of "fine to leave out"', async () => {
    const s = await setup();
    site(s, run(s));
    const r = await mark(s, s.u.c, s.url('/privacy'), 'important');
    expect(r.status).toBe(200);
    expect(r.body.page).toMatchObject({ typeOverride: 'important', typePending: true, utility: false });
    const d = (await s.u.c.get(`${s.base}/data/indexing`)).body as IndexingData;
    expect(d.groups.find((g) => g.cause === 'utility')).toBeUndefined();
    expect(d.groups.find((g) => g.cause === 'type_pending')!.pages.map((p) => p.path)).toEqual(['/privacy']);
  });
  it('members and up only; this website\'s known pages only; a known type only; a page in search is never left out; a failed write saves nothing', async () => {
    const s = await setup();
    site(s, run(s));
    const v = await signUp(app, `typeviewer${seq}@ixwave3.test`);
    const me = v.me as { user?: { id: string }; id?: string };
    await db.insert(schema.memberships).values({ orgId: s.org.id, userId: (me.user?.id ?? me.id)!, role: 'viewer' });
    expect((await mark(s, v.c, s.url('/careers/dev'), 'utility')).status).toBe(403);
    const other = await setup();
    expect([403, 404]).toContain((await mark(s, other.u.c, s.url('/careers/dev'), 'utility')).status);
    expect((await mark(s, s.u.c, 'https://elsewhere.com/careers/dev', 'utility')).status).toBe(404);
    expect((await mark(s, s.u.c, s.url('/never-seen'), 'utility')).status).toBe(404);
    const bad = await mark(s, s.u.c, s.url('/careers/dev'), 'policy');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('bad_type');
    const indexed = await mark(s, s.u.c, s.url('/'), 'utility');
    expect(indexed.status).toBe(409);
    expect(indexed.body.code).toBe('already_in_search');
    expect(t.updates).toHaveLength(0);
    t.updateOk = false;
    const failed = await mark(s, s.u.c, s.url('/careers/dev'), 'utility');
    expect(failed.status).toBe(503);
    expect(t.pages.find((p) => p.url === s.url('/careers/dev'))!.type_override).toBeUndefined();
    expect(await audits(s)).toHaveLength(0);
  });
});

describe('the sitemap dates step (indexing:sitemap_dates, DESIGN_WAVE3 §3.3)', () => {
  const NO_DATES = { submitted: 1, read: 1, complete: true, dates: { urls: 12, with_lastmod: 0, distinct: 0 } };
  const urlset = (s: S, entries: { path: string; day?: string }[]) =>
    `<?xml version="1.0"?><urlset>${entries.map((e) => `<url><loc>${s.url(e.path)}</loc>${e.day ? `<lastmod>${e.day}</lastmod>` : ''}</url>`).join('')}</urlset>`;
  const twelve = (day: (i: number) => string | undefined) => Array.from({ length: 12 }, (_, i) => ({ path: `/p${i}`, day: day(i) }));
  it('raised by the engine\'s reading; "check now" reads the sitemap: no dates is a miss, dates on every page that differ is done', async () => {
    const s = await setup();
    run(s, { sitemaps: NO_DATES });
    const step = (await tasksOf(s)).find((x) => x.key === 'indexing:sitemap_dates')!;
    expect(step).toMatchObject({ state: 'todo', guide: 'index-sitemap-dates', title: 'Add the date each page last changed to your sitemap' });
    await settle();
    t.web[`https://${s.domain}/robots.txt`] = { status: 200, text: `User-agent: *\nSitemap: https://${s.domain}/sitemap.xml` };
    t.web[`https://${s.domain}/sitemap.xml`] = { status: 200, text: urlset(s, twelve(() => '2026-11-01')) };
    const same = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:sitemap_dates' });
    expect(same.status).toBe(200);
    expect(same.body.task.state).toBe('todo');
    expect(same.body.task.lastCheck.message).toContain('gives every one the same date');
    t.web[`https://${s.domain}/sitemap.xml`] = { status: 200, text: urlset(s, twelve((i) => `2026-10-${String(10 + i).padStart(2, '0')}`)) };
    const done = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:sitemap_dates' });
    expect(done.body.task).toMatchObject({ state: 'done', lastCheck: { by: 'you', ok: true } });
    expect((await rowOf(s.site.id, 'indexing:sitemap_dates'))!.doneAt).toBeTruthy();
  });
  it('a sitemap index: every child counted once; a website that does not answer records nothing (503); a tree read in part that looks done is "could not tell" (409)', async () => {
    const s = await setup();
    run(s, { sitemaps: NO_DATES });
    await tasksOf(s);
    await settle();
    t.web[`https://${s.domain}/robots.txt`] = { status: 404, text: '' };
    t.web[`https://${s.domain}/sitemap.xml`] = { status: 200, text: `<sitemapindex><sitemap><loc>https://${s.domain}/a.xml</loc></sitemap><sitemap><loc>https://${s.domain}/b.xml</loc></sitemap></sitemapindex>` };
    t.web[`https://${s.domain}/a.xml`] = { status: 200, text: urlset(s, twelve((i) => `2026-10-${String(10 + i).padStart(2, '0')}`).slice(0, 6)) };
    // the same addresses listed twice, the second time with no date: counted once, with its date
    t.web[`https://${s.domain}/b.xml`] = { status: 200, text: urlset(s, [...twelve((i) => `2026-10-${String(10 + i).padStart(2, '0')}`).slice(6), ...twelve(() => undefined).slice(0, 6)]) };
    const done = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:sitemap_dates' });
    expect(done.body.task.state).toBe('done');
    expect(done.body.task.lastCheck.message).toBe('Your sitemap lists 12 pages and gives a date for each of them.');

    const u = await setup();
    run(u, { sitemaps: NO_DATES });
    await tasksOf(u);
    await settle();
    t.web[`https://${u.domain}/robots.txt`] = null;
    t.web[`https://${u.domain}/sitemap.xml`] = null;
    expect((await u.u.c.post(`${u.base}/tasks/check`, { key: 'indexing:sitemap_dates' })).status).toBe(503);
    // only the engine's reading is on the row: nothing of ours was recorded
    expect((await rowOf(u.site.id, 'indexing:sitemap_dates'))?.lastCheck?.by).not.toBe('you');

    const w = await setup();
    run(w, { sitemaps: NO_DATES });
    await tasksOf(w);
    await settle();
    // robots.txt behind a firewall: the read is partial, and its part has dates everywhere
    t.web[`https://${w.domain}/robots.txt`] = { status: 403, text: 'denied' };
    t.web[`https://${w.domain}/sitemap.xml`] = { status: 200, text: urlset(w, twelve((i) => `2026-10-${String(10 + i).padStart(2, '0')}`)) };
    const unsure = await w.u.c.post(`${w.base}/tasks/check`, { key: 'indexing:sitemap_dates' });
    expect(unsure.status).toBe(409);
    expect(unsure.body.code).toBe('site_unsure');
  });
  it('the engine\'s next reading with usable dates closes it; a sitemap with usable dates raises nothing', async () => {
    const s = await setup();
    run(s, { sitemaps: NO_DATES, at: 7_200_000 });
    expect((await tasksOf(s)).find((x) => x.key === 'indexing:sitemap_dates')!.state).toBe('todo');
    await settle();
    run(s, { sitemaps: { ...NO_DATES, dates: { urls: 12, with_lastmod: 12, distinct: 7 } }, at: 0 });
    // the stored row was created after the first reading; the newer one closes it
    const t2 = (await tasksOf(s)).find((x) => x.key === 'indexing:sitemap_dates')!;
    expect(t2).toMatchObject({ state: 'done', lastCheck: { by: 'index', ok: true } });

    const r = await setup();
    run(r, { sitemaps: { ...NO_DATES, dates: { urls: 12, with_lastmod: 12, distinct: 7 } } });
    expect((await tasksOf(r)).some((x) => x.key === 'indexing:sitemap_dates')).toBe(false);
  });
  it('is one recommendation with its guide and the step', () => {
    const step: SiteTask = { key: 'indexing:sitemap_dates', kind: 'indexing', state: 'todo', reopened: false, doneAt: null, lastCheck: null, severity: 'info', title: 'Add the date each page last changed to your sitemap', detail: 'd', values: [], guide: 'index-sitemap-dates', guideVars: {}, skipped: null };
    const out: Recommendation[] = [];
    indexingRecommendations({ on: true, runAt: '2026-11-12', freeze: { on: false, reason: '' }, siteFix: [], askGoogle: [], other: [], quality: [] }, [step], [], (r) => out.push(r));
    expect(out).toEqual([expect.objectContaining({ id: 'ix:site_fix:sitemap_dates', taskKey: 'indexing:sitemap_dates', action: { label: 'See the step', page: 'pipeline' } })]);
  });
});
