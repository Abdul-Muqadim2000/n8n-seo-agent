import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndexingData, IndexingForRecs, Recommendation, SiteTask } from '@seo/shared';

// Index coverage (2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md §6) on PGlite, the engine's tables and the client's
// website in memory: the Indexing page's reads (viewer and up, verified only, a read that fails is "could not read" and never breaks the
// recommendations), the steps on the website for each cause only the client can fix ("I've done it, check now" with the page's own
// noindex header, the sitemap, unreachable = nothing recorded), the exhaustive check switch, and the daily tick's fair budget. Client text
// anonymised (Nova&, novaand-demo.com).

const t = vi.hoisted(() => ({
  web: {} as Record<string, { status: number; text?: string; location?: string; headers?: Record<string, string> } | null>,
  fetched: [] as string[],
  pages: [] as Record<string, unknown>[],
  runs: [] as Record<string, unknown>[],
  history: [] as Record<string, unknown>[],
  failIndex: false,
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
  type F = { columnName: string; value: unknown };
  const match = (xs: Record<string, unknown>[], filters: F[] = []) => xs.filter((r) => filters.every((f) => String(r[f.columnName] ?? '') === String(f.value)));
  const rows = vi.fn(async (table: string, q: { filters?: F[]; max?: number } = {}) => {
    const index = ['indexPages', 'indexRuns', 'indexHistory', 'googleEvents', 'updateImpact'].includes(table);
    if (index && t.failIndex) throw new Error('n8n API /data-tables answered 502');
    if (table === 'indexPages') return match(t.pages, q.filters).slice(0, q.max ?? 2000);
    if (table === 'indexRuns') return match(t.runs, q.filters).slice(0, q.max ?? 2000);
    if (table === 'indexHistory') return match(t.history, q.filters);
    if (table === 'googleEvents') return [{ event_id: 'core-2026-10', kind: 'core', status: 'rolling_out', title: 'October 2026 core update', started_at: '2026-10-20' }];
    return [];
  });
  return { ...real, rows, siteRows: vi.fn(async () => []), insertRows: vi.fn(async () => true), updateRows: vi.fn(async () => true), upsertRow: vi.fn(async () => undefined), deleteRows: vi.fn(async () => true), ensureTable: vi.fn(async () => 'tbl'), invalidateSite: vi.fn(), executions: vi.fn(async () => []) };
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
  t.history = [];
  t.failIndex = false;
});

let seq = 0;
async function setup(o: { verified?: boolean } = {}) {
  const n = ++seq;
  const email = `owner${n}@indexing.test`;
  const u = await signUp(app, email, 'Sam Owner');
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Indexing ${n}` })).body as { id: string };
  const domain = `novaand-demo${n}.com`;
  const [site] = await db
    .insert(schema.sites)
    .values({ orgId: org.id, domain, country: 'United Arab Emirates', verificationToken: 't', verifiedAt: o.verified === false ? null : new Date(Date.now() - 5 * DAY), trackingStatus: 'active' })
    .returning();
  const sid = `site_${domain.replace(/[^a-z0-9]+/g, '-')}`;
  const url = (p: string) => `https://www.${domain}${p}`;
  return { u, org, site: site!, domain, sid, url, base: `/api/orgs/${org.id}/sites/${site!.id}` };
}
type S = Awaited<ReturnType<typeof setup>>;

function engine(s: S, o: { runAt?: string } = {}) {
  const runAt = o.runAt ?? new Date(Date.now() - 3_600_000).toISOString();
  t.runs.push({ site_id: s.sid, domain: s.domain, run_at: runAt, known: 4, indexed: 1, backlog_left: 0, inspected: 4, by_cause_json: JSON.stringify({ noindex: 2, crawled_not_indexed: 1 }), freeze: false });
  t.pages.push(
    { site_id: s.sid, domain: s.domain, url: s.url('/'), lane: 'existing', state: 'indexed', cause: 'indexed', action: 'none', impressions_28d: 90 },
    { site_id: s.sid, domain: s.domain, url: s.url('/services'), lane: 'existing', state: 'not_indexed', cause: 'noindex', action: 'site_fix', impressions_28d: 30, inspect_at: runAt, in_sitemap: true },
    { site_id: s.sid, domain: s.domain, url: s.url('/about'), lane: 'existing', state: 'not_indexed', cause: 'noindex', action: 'site_fix', impressions_28d: 4, inspect_at: runAt, in_sitemap: true },
    { site_id: s.sid, domain: s.domain, url: s.url('/blog/peppol'), lane: 'new', state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality', title: 'Peppol in the UAE | Nova&', impressions_28d: 12 },
    // another domain that shares the engine id (engineIdCollides) is never shown
    { site_id: s.sid, domain: 'other-domain.com', url: 'https://other-domain.com/x', lane: 'existing', state: 'not_indexed', cause: 'noindex', action: 'site_fix' },
  );
}
const tasksOf = async (s: S) => ((await s.u.c.get(`${s.base}/tasks`)).body as { tasks: SiteTask[] }).tasks;
const rowOf = async (siteId: string, key: string) => (await db.select().from(schema.siteTasks).where(and(eq(schema.siteTasks.siteId, siteId), eq(schema.siteTasks.taskKey, key))))[0];
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('the Indexing page reads', () => {
  it('answers the page in one read, only this domain\'s rows, with the update rolling out', async () => {
    const s = await setup();
    engine(s);
    const r = await s.u.c.get(`${s.base}/data/indexing`);
    expect(r.status).toBe(200);
    const d = r.body as IndexingData;
    expect(d.status).toBe('ok');
    expect(d.totals.known).toBe(4);
    expect(d.groups[0]).toMatchObject({ action: 'site_fix', cause: 'noindex', count: 2, taskKey: 'indexing:noindex' });
    expect(d.rollingOut?.title).toBe('October 2026 core update');
    expect(d.freeze.on).toBe(true);
    expect(d.settings).toEqual({ on: true, dailyCap: 300 });
  });

  it('a viewer reads it; another company and an unverified website do not', async () => {
    const s = await setup();
    engine(s);
    const v = await signUp(app, `viewer${seq}@indexing.test`);
    const me = v.me as { user?: { id: string }; id?: string };
    await db.insert(schema.memberships).values({ orgId: s.org.id, userId: (me.user?.id ?? me.id)!, role: 'viewer' });
    expect((await v.c.get(`${s.base}/data/indexing`)).status).toBe(200);
    const other = await setup();
    expect([403, 404]).toContain((await other.u.c.get(`${s.base}/data/indexing`)).status);
    const u = await setup({ verified: false });
    expect((await u.u.c.get(`${u.base}/data/indexing`)).status).toBe(403);
  });

  it('pages and history; an address of another website is refused', async () => {
    const s = await setup();
    engine(s);
    t.history.push({ site_id: s.sid, url: s.url('/services'), at: '2026-10-27T06:00:00Z', state: 'not_indexed', cause: 'noindex' }, { site_id: s.sid, url: s.url('/services'), at: '2026-09-01T06:00:00Z', state: 'indexed', cause: '' });
    const p = await s.u.c.get(`${s.base}/data/indexing/pages?lane=existing&action=site_fix&cause=noindex&page=1`);
    expect(p.body).toMatchObject({ status: 'ok', total: 2 });
    const h = await s.u.c.get(`${s.base}/data/indexing/history?url=${encodeURIComponent(s.url('/services'))}`);
    expect(h.body.history.map((x: { label: string }) => x.label)).toEqual(['Your page tells Google to leave it out', 'In Google search']);
    expect((await s.u.c.get(`${s.base}/data/indexing/history?url=${encodeURIComponent('https://elsewhere.com/x')}`)).status).toBe(404);
  });

  it('an engine that cannot be read is "could not read" on this page and breaks nothing else', async () => {
    const s = await setup();
    t.failIndex = true;
    const r = await s.u.c.get(`${s.base}/data/indexing`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('unreadable');
    expect((await s.u.c.get(`${s.base}/data/indexing/pages?lane=new`)).body.status).toBe('unreadable');
    expect((await s.u.c.get(`${s.base}/recommendations`)).status).toBe(200);
    expect((await s.u.c.get(`${s.base}/tasks`)).status).toBe(200);
  });
});

describe('the steps on the website (indexing)', () => {
  it('one step per cause, done when the pages no longer carry noindex in the page or the server answer', async () => {
    const s = await setup();
    engine(s);
    const tasks = await tasksOf(s);
    const step = tasks.find((x) => x.key === 'indexing:noindex')!;
    expect(step).toMatchObject({ kind: 'indexing', state: 'todo', severity: 'warning' });
    expect(step.values.map((v) => v.value)).toEqual([s.url('/services'), s.url('/about')]);
    await settle();
    // still noindex in the server's header on one page
    t.web[s.url('/services')] = { status: 200, text: '<html><head></head></html>', headers: { 'x-robots-tag': 'noindex' } };
    t.web[s.url('/about')] = { status: 200, text: '<html><head></head></html>' };
    const miss = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:noindex' });
    expect(miss.status).toBe(200);
    expect(miss.body.task.state).toBe('todo');
    expect(miss.body.task.lastCheck.message).toContain("X-Robots-Tag");
    t.web[s.url('/services')] = { status: 200, text: '<html><head></head></html>', headers: {} };
    const ok = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:noindex' });
    expect(ok.body.task.state).toBe('done');
    expect((await rowOf(s.site.id, 'indexing:noindex'))!.lastCheck).toMatchObject({ ok: true, by: 'you' });
    expect(t.fetched.every((u) => u.includes(s.domain))).toBe(true);
  });

  it('a website that does not answer records nothing (503)', async () => {
    const s = await setup();
    engine(s);
    await tasksOf(s);
    await settle();
    t.web[s.url('/services')] = null;
    t.web[s.url('/about')] = { status: 200, text: '' };
    const before = (await rowOf(s.site.id, 'indexing:noindex'))!.lastCheck;
    expect((await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:noindex' })).status).toBe(503);
    expect((await rowOf(s.site.id, 'indexing:noindex'))!.lastCheck).toEqual(before);
  });

  it('a sitemap step reads the sitemap the robots.txt names', async () => {
    const s = await setup();
    const runAt = new Date(Date.now() - 3_600_000).toISOString();
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: runAt });
    t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url('/pricing'), lane: 'existing', state: 'indexed', cause: 'indexed_not_in_sitemap', action: 'site_fix', inspect_at: runAt });
    await tasksOf(s);
    await settle();
    t.web[`https://${s.domain}/robots.txt`] = { status: 200, text: `User-agent: *\nSitemap: https://${s.domain}/maps/index.xml\n` };
    t.web[`https://${s.domain}/maps/index.xml`] = { status: 200, text: `<sitemapindex><sitemap><loc>https://${s.domain}/maps/pages.xml</loc></sitemap></sitemapindex>` };
    t.web[`https://${s.domain}/maps/pages.xml`] = { status: 200, text: `<urlset><url><loc>https://${s.domain}/pricing/</loc></url></urlset>` };
    const r = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:indexed_not_in_sitemap' });
    expect(r.body.task.state).toBe('done');
  });

  it('every kind has its check; a kind this build does not know reads nothing', async () => {
    const out = await svc.runSiteTaskCheck('novaand-demo.com', 'made_up' as never, {});
    expect(out.reached).toBe(false);
  });

  it('the daily tick keeps its budget fair: the other kinds first, indexing steps at most a third', async () => {
    const s = await setup();
    const now = new Date();
    const mk = (key: string, kind: 'indexnow' | 'redirect' | 'indexing') =>
      db.insert(schema.siteTasks).values({ orgId: s.org.id, siteId: s.site.id, taskKey: key, kind, payload: kind === 'indexing' ? { cause: 'server_error', urls: [s.url('/x')], total: 1 } : { brokenUrl: s.url('/old'), redirectTo: s.url('/'), links: 1 }, createdAt: now });
    for (let i = 0; i < 4; i++) await mk(`indexing:${['noindex', 'server_error', 'soft_404', 'access_denied'][i]}`, 'indexing');
    for (let i = 0; i < 4; i++) await mk(`redirect:${s.domain}/old${i}`, 'redirect');
    t.web[s.url('/x')] = { status: 200, text: '' };
    // rows other tests left due are read as fresh, so this tick sees only these
    await db.update(schema.siteTasks).set({ lastCheckAt: now });
    await db.update(schema.siteTasks).set({ lastCheckAt: new Date(Date.now() - 9 * DAY) }).where(eq(schema.siteTasks.siteId, s.site.id));
    const { checked } = await svc.siteTaskTick(log, { sites: 0, checks: 6 });
    expect(checked).toBeLessThanOrEqual(6);
    const rows = await db.select().from(schema.siteTasks).where(eq(schema.siteTasks.siteId, s.site.id));
    const fresh = rows.filter((r) => r.lastCheckAt && r.lastCheckAt.getTime() > Date.now() - DAY);
    expect(fresh.filter((r) => r.kind === 'redirect')).toHaveLength(4);
    expect(fresh.filter((r) => r.kind === 'indexing').length).toBeLessThanOrEqual(2);
  });
});

describe('recommendations', () => {
  const task = (key: string, title: string): SiteTask => ({ key, kind: 'indexing', state: 'todo', reopened: false, doneAt: null, lastCheck: null, severity: 'warning', title, detail: '', values: [{ label: 'Page 1', value: 'https://novaand-demo.com/a' }], guide: 'index-remove-noindex', guideVars: {}, skipped: null });
  const run = (o: Partial<IndexingForRecs> = {}) => {
    const out: Recommendation[] = [];
    indexingRecommendations(
      { on: true, runAt: '2026-10-28', freeze: { on: false, reason: '' }, siteFix: [], other: [{ action: 'quality', cause: 'crawled_not_indexed', total: 2 }, { action: 'links', cause: 'unknown_to_google', total: 3 }], quality: [{ url: 'https://novaand-demo.com/blog/peppol', title: 'Peppol in the UAE | Nova&', impressions28d: 12 }], ...o },
      [task('indexing:noindex', 'Remove noindex'), task('indexing:robots_blocked', 'Robots')],
      [{ id: 'tech:indexability|robots.txt blocks key pages', category: 'technical', priority: 'high', title: 'Fix: robots.txt blocks key pages', detail: '' }] as Recommendation[],
      (r) => out.push(r),
    );
    return out;
  };
  it('one per cause, no second ask for what an audit finding already asks, quality opens the page form', () => {
    const ids = run().map((r) => r.id);
    expect(ids).toEqual(['ix:site_fix:noindex', 'ix:quality:crawled_not_indexed', 'ix:links:unknown_to_google']);
    const q = run().find((r) => r.id === 'ix:quality:crawled_not_indexed')!;
    expect(q.action).toMatchObject({ label: 'Improve this page', mode: 'keyword', prefill: { keyword: 'Peppol in the UAE', existingPageUrl: 'https://novaand-demo.com/blog/peppol' } });
    expect(run()[0]).toMatchObject({ taskKey: 'indexing:noindex', action: { page: 'indexing' } });
  });
  it('no quality item while a Google update rolls out; nothing at all when the check is off', () => {
    expect(run({ freeze: { on: true, reason: 'core update' } }).some((r) => r.id.startsWith('ix:quality'))).toBe(false);
    expect(run({ on: false })).toEqual([]);
  });
});
