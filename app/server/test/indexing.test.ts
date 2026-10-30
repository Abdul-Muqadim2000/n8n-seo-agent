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
  reads: [] as string[],
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
  // n8n's AND filters (eq / neq) and its sortBy, as the app uses them; rows come back in insertion order otherwise
  const match = (xs: Record<string, unknown>[], filters: F[] = []) =>
    xs.filter((r) => filters.every((f) => (f.condition === 'neq' ? String(r[f.columnName] ?? '') !== String(f.value) : String(r[f.columnName] ?? '') === String(f.value))));
  const sorted = (xs: Record<string, unknown>[], sortBy?: string) => {
    if (!sortBy) return xs;
    const [col, dir] = sortBy.split(':');
    const v = (r: Record<string, unknown>) => r[col] ?? '';
    return [...xs].sort((a, b) => (v(a) === v(b) ? 0 : (v(a) > v(b) ? 1 : -1) * (dir === 'desc' ? -1 : 1)));
  };
  const rows = vi.fn(async (table: string, q: { filters?: F[]; max?: number; sortBy?: string } = {}) => {
    const index = ['indexPages', 'indexRuns', 'indexHistory', 'googleEvents', 'updateImpact'].includes(table);
    if (index && t.failIndex) throw new Error('n8n API /data-tables answered 502');
    t.reads.push(table);
    if (table === 'indexPages') return sorted(match(t.pages, q.filters), q.sortBy).slice(0, q.max ?? 2000);
    if (table === 'indexRuns') return sorted(match(t.runs, q.filters), q.sortBy).slice(0, q.max ?? 2000);
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
  t.reads = [];
  svc.forgetSitemaps();
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
    // A11: the freeze is the engine's newest run flag (false here), the events only give the banner its words
    expect(d.freeze.on).toBe(false);
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
      { on: true, runAt: '2026-10-28', freeze: { on: false, reason: '' }, siteFix: [], askGoogle: [], other: [{ action: 'quality', cause: 'crawled_not_indexed', total: 2 }, { action: 'links', cause: 'unknown_to_google', total: 3 }], quality: [{ url: 'https://novaand-demo.com/blog/peppol', title: 'Peppol in the UAE | Nova&', impressions28d: 12 }], ...o },
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

// ---------------------------------------------------------------- fix wave 1 (REVIEW_APP.md / REVIEW_CROSS.md, FIX_CONTRACT.md)
describe('fix wave 1: the own check only ticks a step off on the exact positive signal', () => {
  const step = (cause: string, urls: string[]) => ({ cause, urls, total: urls.length });

  it('A1: a page in a 7th child sitemap of an index we only read in part, still answering 403, is not done', async () => {
    const d = 'novaand-probe.com';
    const kids = Array.from({ length: 14 }, (_, i) => `https://${d}/s${i}.xml`);
    t.web[`https://${d}/robots.txt`] = { status: 404, text: '' };
    t.web[`https://${d}/sitemap.xml`] = { status: 200, text: `<sitemapindex>${kids.map((k) => `<sitemap><loc>${k}</loc></sitemap>`).join('')}</sitemapindex>` };
    kids.forEach((k, i) => (t.web[k] = { status: 200, text: `<urlset><url><loc>https://${d}/page${i}</loc></url></urlset>` }));
    t.web[`https://${d}/page13`] = { status: 403, text: 'forbidden' };
    const out = await svc.runSiteTaskCheck(d, 'indexing', step('redirect', [`https://${d}/page13`]));
    expect(out.ok).toBe(false);
    expect(out.reached).toBe(false);
  });

  it('A1: a sitemap address that answers the app shell (HTML 200) is no sitemap: a page still 404 is not done', async () => {
    const d = 'novaand-spa.com';
    t.web[`https://${d}/robots.txt`] = { status: 404, text: '' };
    t.web[`https://${d}/sitemap.xml`] = { status: 200, text: '<!doctype html><html><body><div id="root"></div></body></html>' };
    t.web[`https://${d}/gone`] = { status: 404, text: 'nf' };
    const out = await svc.runSiteTaskCheck(d, 'indexing', step('not_found', [`https://${d}/gone`]));
    expect(out.ok).toBe(false);
  });

  it('A2: a server-error step whose page answers a 403 firewall to us is "could not tell", never done', async () => {
    const d = 'novaand-waf.com';
    t.web[`https://${d}/x`] = { status: 403, text: '<html><head><title>Attention Required! | Cloudflare</title></head></html>' };
    const out = await svc.runSiteTaskCheck(d, 'indexing', step('server_error', [`https://${d}/x`]));
    expect(out).toMatchObject({ ok: false, reached: false, unsure: true });
  });

  it('A2: a click that cannot tell records nothing (409) and the step keeps its state', async () => {
    const s = await setup();
    engine(s);
    await tasksOf(s);
    await settle();
    t.web[s.url('/services')] = { status: 200, text: '<html><head><title>Just a moment...</title></head><body>cf-chl-bypass</body></html>' };
    t.web[s.url('/about')] = { status: 200, text: '<html><head></head><body>ok</body></html>' };
    const before = (await rowOf(s.site.id, 'indexing:noindex'))!.lastCheck;
    const r = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:noindex' });
    expect(r.status).toBe(409);
    expect((await rowOf(s.site.id, 'indexing:noindex'))!.lastCheck).toEqual(before);
  });

  it('A16: a robots.txt that answers 403 to us is not "robots.txt lets Google read"', async () => {
    const d = 'novaand-robots.com';
    t.web[`https://${d}/robots.txt`] = { status: 403, text: 'Forbidden' };
    const out = await svc.runSiteTaskCheck(d, 'indexing', step('robots_blocked', [`https://${d}/blog`]));
    expect(out.ok).toBe(false);
    expect(out.reached).toBe(false);
  });

  it('A27: every sitemap step of one website in one round reads the sitemap once', async () => {
    const d = 'novaand-once.com';
    t.web[`https://${d}/robots.txt`] = { status: 404, text: '' };
    t.web[`https://${d}/sitemap.xml`] = { status: 200, text: `<urlset><url><loc>https://${d}/a</loc></url></urlset>` };
    await svc.runSiteTaskCheck(d, 'indexing', step('not_in_sitemap', [`https://${d}/a`]));
    await svc.runSiteTaskCheck(d, 'indexing', step('indexed_not_in_sitemap', [`https://${d}/a`]));
    expect(t.fetched.filter((u) => u === `https://${d}/sitemap.xml`)).toHaveLength(1);
  });

  it('X5: the sitemap step is read by the daily index check only; a click says so and records nothing', async () => {
    const s = await setup();
    const runAt = new Date(Date.now() - 3_600_000).toISOString();
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: runAt, known: 3, indexed: 3, inspected: 3, by_cause_json: '{}', sitemaps_json: JSON.stringify({ submitted: 0, submitted_errors: 0, read: 1, capped: false, errors: [] }) });
    const step = (await tasksOf(s)).find((x) => x.key === 'indexing:sitemap')!;
    expect(step).toMatchObject({ state: 'todo', title: 'Submit your sitemap in Search Console', guide: 'index-submit-sitemap' });
    await settle();
    const r = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:sitemap' });
    expect(r.status).toBe(409);
    // the next run reads a submitted sitemap with no errors: done
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: new Date(Date.now() + 1000).toISOString(), known: 3, indexed: 3, inspected: 3, by_cause_json: '{}', sitemaps_json: JSON.stringify({ submitted: 1, submitted_errors: 0, read: 1 }) });
    expect((await tasksOf(s)).find((x) => x.key === 'indexing:sitemap')!.state).toBe('done');
  });
});

describe('fix wave 1: the engine reading behind the steps', () => {
  it('A6: 1,600 rows of another cause read first never hide a cause and call its step done', async () => {
    const s = await setup();
    const runAt = new Date(Date.now() - 3_600_000).toISOString();
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: runAt, known: 1630, indexed: 1600, inspected: 30, by_cause_json: JSON.stringify({ indexed_not_in_sitemap: 1600, noindex: 30 }) });
    for (let i = 0; i < 1600; i++) t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url(`/p${i}`), state: 'indexed', cause: 'indexed_not_in_sitemap', action: 'site_fix', inspect_at: runAt });
    for (let i = 0; i < 30; i++) t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url(`/n${i}`), state: 'not_indexed', cause: 'noindex', action: 'site_fix', inspect_at: runAt, impressions_28d: i });
    await db.insert(schema.siteTasks).values({ orgId: s.org.id, siteId: s.site.id, taskKey: 'indexing:noindex', kind: 'indexing', payload: { cause: 'noindex', urls: [s.url('/n1')], total: 30 }, createdAt: new Date(Date.now() - 2 * DAY) });
    const n = (await tasksOf(s)).find((x) => x.key === 'indexing:noindex')!;
    expect(n.state).toBe('todo');
    // the list is the most important pages (most impressions first)
    expect(n.values[0].value).toBe(s.url('/n29'));
  });

  it('A15: Pipeline / Recommendations / Overview do not wait for a slow index read (deadline, then no index reading)', async () => {
    const s = await setup();
    engine(s);
    const real = (await import('../src/n8n/client')).rows as unknown as { mockImplementationOnce: (f: () => Promise<unknown>) => void };
    real.mockImplementationOnce(() => new Promise(() => undefined));
    const t0 = Date.now();
    const r = await s.u.c.get(`${s.base}/tasks`);
    expect(r.status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(15_000);
  });

  it('A27: indexing steps get their share of a tick even when the other kinds fill the whole budget', async () => {
    const s = await setup();
    const now = new Date();
    await db.update(schema.siteTasks).set({ lastCheckAt: now });
    for (let i = 0; i < 6; i++) await db.insert(schema.siteTasks).values({ orgId: s.org.id, siteId: s.site.id, taskKey: `redirect:${s.domain}/r${i}`, kind: 'redirect', payload: { brokenUrl: s.url(`/r${i}`), redirectTo: s.url('/'), links: 1 }, createdAt: now });
    await db.insert(schema.siteTasks).values({ orgId: s.org.id, siteId: s.site.id, taskKey: 'indexing:server_error', kind: 'indexing', payload: { cause: 'server_error', urls: [s.url('/x')], total: 1 }, createdAt: now });
    await db.update(schema.siteTasks).set({ lastCheckAt: new Date(Date.now() - 9 * DAY) }).where(eq(schema.siteTasks.siteId, s.site.id));
    t.web[s.url('/x')] = { status: 500, text: 'err' };
    await svc.siteTaskTick(log, { sites: 0, checks: 3 });
    const ix = (await rowOf(s.site.id, 'indexing:server_error'))!;
    expect(ix.lastCheckAt!.getTime()).toBeGreaterThan(Date.now() - DAY);
  });
});

describe('fix wave 1: the rest of the app', () => {
  it('X16: deleting a website removes its rows in the index tables (history by the engine id; Google events stay)', async () => {
    const client = await import('../src/n8n/client');
    const del = client.deleteRows as unknown as { mock: { calls: [string, { columnName: string; value: string }[]][] }; mockClear: () => void };
    del.mockClear();
    const { clearIndexInEngine } = await import('../src/routes/sites');
    expect(await clearIndexInEngine('novaand-demo.com', { warn: () => undefined } as never)).toEqual([]);
    const calls = del.mock.calls.map(([table, f]) => `${table}:${f[0].columnName}=${f[0].value}`);
    expect(calls).toEqual(['indexPages:domain=novaand-demo.com', 'indexRuns:domain=novaand-demo.com', 'updateImpact:domain=novaand-demo.com', 'indexHistory:site_id=site_novaand-demo-com']);
  });

  it('A24: "Fix redirect chains" does not hide "Replace redirecting addresses in your sitemap"; a sitemap redirect finding does', () => {
    const task = (key: string): SiteTask => ({ key, kind: 'indexing', state: 'todo', reopened: false, doneAt: null, lastCheck: null, severity: 'info', title: 'Replace redirecting addresses in your sitemap', detail: '', values: [], guide: 'index-sitemap-redirects', guideVars: {}, skipped: null });
    const ids = (tech: string) => {
      const out: Recommendation[] = [];
      indexingRecommendations({ on: true, runAt: '2026-10-28', freeze: { on: false, reason: '' }, siteFix: [], other: [], quality: [], askGoogle: [] }, [task('indexing:redirect')], [{ id: `tech:${tech}`, category: 'technical', priority: 'high', title: 'x', detail: '' }] as Recommendation[], (r) => out.push(r));
      return out.map((r) => r.id);
    };
    expect(ids('crawlability|redirect chains on # pages')).toEqual(['ix:site_fix:redirect']);
    expect(ids('sitemap|# redirected urls listed in the sitemap')).toEqual([]);
  });

  it('X8: pages to ask Google about are one recommendation with the guide, never a page left out on purpose', () => {
    const out: Recommendation[] = [];
    indexingRecommendations({ on: true, runAt: '2026-10-28', freeze: { on: false, reason: '' }, siteFix: [], other: [], quality: [], askGoogle: [{ url: 'https://novaand-demo.com/new', title: 'New' }] }, [], [], (r) => out.push(r));
    expect(out[0]).toMatchObject({ id: 'ix:ask_google', title: 'Ask Google to read this page again', action: { page: 'indexing' } });
    expect(out[0].detail).toContain('we never do it for you');
  });
});

// ---------------------------------------------------------------- fix wave 2 (REVIEW_2.md, N-app-*)
describe('fix wave 2: the engine reading behind the steps', () => {
  it('N-app-2: a cause whose most-seen rows are all left out never closes its step; the step lists the pages to fix', async () => {
    const s = await setup();
    const runAt = new Date(Date.now() - 3_600_000).toISOString();
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: runAt, known: 253, indexed: 0, inspected: 253, by_cause_json: JSON.stringify({ redirect: 253 }) });
    for (let i = 0; i < 250; i++) t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url(`/old${i}`), state: 'excluded', cause: 'redirect', action: 'leave_out', inspect_at: runAt, impressions_28d: 1000 + i });
    for (let i = 0; i < 3; i++) t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url(`/fix${i}`), state: 'excluded', cause: 'redirect', action: 'site_fix', inspect_at: runAt, impressions_28d: i });
    await db.insert(schema.siteTasks).values({ orgId: s.org.id, siteId: s.site.id, taskKey: 'indexing:redirect', kind: 'indexing', payload: { cause: 'redirect', urls: [s.url('/fix0')], total: 3 }, createdAt: new Date(Date.now() - 2 * DAY) });
    const step = (await tasksOf(s)).find((x) => x.key === 'indexing:redirect')!;
    expect(step.state).toBe('todo');
    expect(step.values.map((v) => v.value).sort()).toEqual([s.url('/fix0'), s.url('/fix1'), s.url('/fix2')]);
    expect(step.lastCheck?.message ?? '').not.toMatch(/lists none/i);
  });

  it('N-app-4: an engine-only step stays done when the index read is late or fails, never back to "to do"', async () => {
    const s = await setup();
    const at1 = new Date(Date.now() - 2 * 3_600_000).toISOString();
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: at1, known: 3, indexed: 3, inspected: 3, by_cause_json: '{}', sitemaps_json: JSON.stringify({ submitted: 0, submitted_errors: 0, read: 1 }) });
    expect((await tasksOf(s)).find((x) => x.key === 'indexing:sitemap')!.state).toBe('todo');
    await settle();
    // the next day's run (after the step was stored) reads a submitted sitemap with no errors
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: new Date(Date.now() + 1000).toISOString(), known: 3, indexed: 3, inspected: 3, by_cause_json: '{}', sitemaps_json: JSON.stringify({ submitted: 1, submitted_errors: 0, read: 1 }) });
    expect((await tasksOf(s)).find((x) => x.key === 'indexing:sitemap')!.state).toBe('done');
    t.failIndex = true;
    const later = (await tasksOf(s)).find((x) => x.key === 'indexing:sitemap')!;
    expect(later.state).toBe('done');
    expect(later.lastCheck?.by).toBe('index');
  });

  it('N-app-4: a step fixed on the site, waiting for Google, stays done when the index read is missing', async () => {
    const s = await setup();
    const runAt = new Date(Date.now() - 3_600_000).toISOString();
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: runAt, known: 1, indexed: 0, inspected: 1, by_cause_json: JSON.stringify({ noindex: 1 }), by_action_json: JSON.stringify({ wait: 1 }) });
    // the engine re-inspected after it saw the fix (inspect_at after fix_seen_at): still waiting for Google (N-app-1)
    t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url('/s'), state: 'excluded', cause: 'noindex', action: 'wait', fix_seen_at: new Date(Date.now() - DAY).toISOString(), inspect_at: runAt });
    await db.insert(schema.siteTasks).values({ orgId: s.org.id, siteId: s.site.id, taskKey: 'indexing:noindex', kind: 'indexing', payload: { cause: 'noindex', urls: [s.url('/s')], total: 1 }, createdAt: new Date(Date.now() - 3 * DAY) });
    expect((await tasksOf(s)).find((x) => x.key === 'indexing:noindex')!.state).toBe('done');
    t.failIndex = true;
    expect((await tasksOf(s)).find((x) => x.key === 'indexing:noindex')!.state).toBe('done');
  });
});

describe('fix wave 2: the own check', () => {
  const step = (cause: string, urls: string[], total = urls.length) => ({ cause, urls, total });

  it('N-app-3: robots.txt we could not read means the sitemap read is partial: "no longer in your sitemap" is never concluded', async () => {
    const d = 'novaand-r403.com';
    t.web[`https://${d}/robots.txt`] = { status: 403, text: 'Forbidden' };
    t.web[`https://${d}/sitemap.xml`] = { status: 200, text: `<urlset><url><loc>https://${d}/a</loc></url></urlset>` };
    t.web[`https://${d}/x`] = { status: 200, text: `<html><head><title>X</title><link rel="canonical" href="https://${d}/y"></head><body>x</body></html>` };
    const out = await svc.runSiteTaskCheck(d, 'indexing', step('canonical_elsewhere', [`https://${d}/x`]));
    expect(out.ok).toBe(false);
    expect(out.reached).toBe(false);
  });

  it('N-app-10: a guessed /sitemap.xml that answers the app shell does not make the named sitemap partial', async () => {
    const d = 'novaand-shell.com';
    t.web[`https://${d}/robots.txt`] = { status: 200, text: `User-agent: *\nSitemap: https://${d}/maps/pages.xml\n`, headers: { 'content-type': 'text/plain' } };
    t.web[`https://${d}/sitemap.xml`] = { status: 200, text: '<!doctype html><html><body><div id="root"></div></body></html>' };
    t.web[`https://${d}/maps/pages.xml`] = { status: 200, text: `<urlset><url><loc>https://${d}/a</loc></url></urlset>` };
    const out = await svc.runSiteTaskCheck(d, 'indexing', step('indexed_not_in_sitemap', [`https://${d}/b`]));
    expect(out).toMatchObject({ ok: false, reached: true });
    expect(out.message).toContain('not in your sitemap yet');
  });

  it('N-app-11: a robots.txt or a sitemap that redirects to another website is not trusted', async () => {
    const d = 'novaand-hop.com';
    t.web[`https://${d}/robots.txt`] = { status: 301, location: 'https://elsewhere-host.com/robots.txt' };
    t.web['https://elsewhere-host.com/robots.txt'] = { status: 200, text: 'User-agent: *\nAllow: /\n', headers: { 'content-type': 'text/plain' } };
    const robots = await svc.runSiteTaskCheck(d, 'indexing', step('robots_blocked', [`https://${d}/blog`]));
    expect(robots).toMatchObject({ ok: false, reached: false });
    const d2 = 'novaand-hop2.com';
    t.web[`https://${d2}/robots.txt`] = { status: 404, text: '' };
    t.web[`https://${d2}/sitemap.xml`] = { status: 301, location: 'https://elsewhere-host.com/sitemap.xml' };
    t.web['https://elsewhere-host.com/sitemap.xml'] = { status: 200, text: `<urlset><url><loc>https://${d2}/a</loc></url></urlset>` };
    const sm = await svc.runSiteTaskCheck(d2, 'indexing', step('not_in_sitemap', [`https://${d2}/b`]));
    expect(sm.reached).toBe(false);
  });

  it('N-app-7: ten fixed pages of a 30-page step are "10 of 30", never done; a click says so and records nothing', async () => {
    const d = 'novaand-many.com';
    const urls = Array.from({ length: 25 }, (_, i) => `https://${d}/p${i}`);
    for (const u of urls) t.web[u] = { status: 200, text: '<html><head><title>P</title></head><body>hi</body></html>' };
    const out = await svc.runSiteTaskCheck(d, 'indexing', step('noindex', urls, 30));
    expect(out).toMatchObject({ ok: false, reached: false, partial: true });
    expect(out.message).toContain('10 of 30');
    // every listed page checked: done
    const all = await svc.runSiteTaskCheck(d, 'indexing', step('noindex', urls.slice(0, 4), 4));
    expect(all.ok).toBe(true);
  });

  it('N-app-7: a click on a step we could check only in part answers 409 and keeps the step as it was', async () => {
    const s = await setup();
    const runAt = new Date(Date.now() - 3_600_000).toISOString();
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: runAt, known: 30, indexed: 0, inspected: 30, by_cause_json: JSON.stringify({ noindex: 30 }) });
    for (let i = 0; i < 30; i++) {
      t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url(`/n${i}`), state: 'excluded', cause: 'noindex', action: 'site_fix', inspect_at: runAt, impressions_28d: 100 - i });
      t.web[s.url(`/n${i}`)] = { status: 200, text: '<html><head><title>N</title></head><body>n</body></html>' };
    }
    await tasksOf(s);
    await settle();
    const before = (await rowOf(s.site.id, 'indexing:noindex'))!.lastCheck;
    const r = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:noindex' });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toContain('10 of 30');
    expect((await rowOf(s.site.id, 'indexing:noindex'))!.lastCheck).toEqual(before);
  });
});

// ---------------------------------------------------------------- fix wave 3 (REVIEW_3.md)
describe('fix wave 3: Google still sees it after the client\'s fix (R1)', () => {
  // the engine's N3 row: Google crawled after the fix we saw and still reads noindex, so `fix_seen_at` is cleared, `fix_failed_at` set
  // and the row is `site_fix` again; our own fetch (no noindex for a browser) must never close the step
  async function googleOnlyNoindex() {
    const s = await setup();
    const runAt = new Date(Date.now() - 3_600_000).toISOString();
    t.runs.push({ site_id: s.sid, domain: s.domain, run_at: runAt, known: 1, indexed: 0, inspected: 1, by_cause_json: JSON.stringify({ noindex: 1 }), by_action_json: JSON.stringify({ site_fix: 1 }) });
    t.pages.push({
      site_id: s.sid, domain: s.domain, url: s.url('/g'), state: 'excluded', cause: 'noindex', action: 'site_fix', inspect_at: runAt, fix_seen_at: '',
      fix_failed_at: new Date(Date.now() - DAY).toISOString(), impressions_28d: 5,
      note: 'Google read this page again on 2026-11-04, after the change we saw on your site, and still sees the same problem.',
    });
    t.web[s.url('/g')] = { status: 200, text: '<html><head><title>G</title></head><body>g</body></html>' };
    return s;
  }

  it('the step stays to do (warning), explains it, and the own check records nothing, first check or daily', async () => {
    const s = await googleOnlyNoindex();
    const first = (await tasksOf(s)).find((x) => x.key === 'indexing:noindex')!;
    expect(first).toMatchObject({ state: 'todo', severity: 'warning' });
    expect(first.detail).toContain('different from what a browser sees');
    expect(first.guide).toBe('index-remove-noindex');
    await settle();
    await settle();
    // the first background check opened the page, found no noindex, and recorded nothing
    const row = (await rowOf(s.site.id, 'indexing:noindex'))!;
    expect(row.payload).toMatchObject({ googleStillSees: 1 });
    expect(row.lastCheck?.ok ?? false).toBe(false);
    expect(row.doneAt).toBeNull();
    // the daily tick, two days running: still nothing recorded, still to do
    for (let day = 0; day < 2; day++) {
      // other tests' rows share the database: this one is made the most overdue and the tick's budget covers them all
      await db.update(schema.siteTasks).set({ lastCheckAt: new Date(Date.now() - 400 * DAY), missAt: null }).where(eq(schema.siteTasks.id, row.id));
      await svc.siteTaskTick(log, { sites: 0, checks: 600 });
      const after = (await rowOf(s.site.id, 'indexing:noindex'))!;
      expect(after.doneAt).toBeNull();
      expect(after.lastCheck?.ok ?? false).toBe(false);
      expect(after.lastCheckAt!.getTime()).toBeGreaterThan(Date.now() - DAY);
      expect((await tasksOf(s)).find((x) => x.key === 'indexing:noindex')!.state).toBe('todo');
    }
  });

  it('a click answers 409 google_still_sees with plain words and records nothing', async () => {
    const s = await googleOnlyNoindex();
    await tasksOf(s);
    await settle();
    const before = (await rowOf(s.site.id, 'indexing:noindex'))!;
    const r = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:noindex' });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toContain('google_still_sees');
    expect(JSON.stringify(r.body)).toContain('still sees the problem');
    const after = (await rowOf(s.site.id, 'indexing:noindex'))!;
    expect(after.lastCheck).toEqual(before.lastCheck);
    expect(after.doneAt).toBeNull();
  });

  it('an own check that still finds the noindex is recorded as usual (to do either way)', async () => {
    const s = await googleOnlyNoindex();
    t.web[s.url('/g')] = { status: 200, text: '<html><head><meta name="robots" content="noindex"><title>G</title></head><body>g</body></html>' };
    await tasksOf(s);
    const r = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:noindex' });
    expect(r.status).toBe(200);
    expect((r.body as { task: SiteTask }).task).toMatchObject({ state: 'todo', lastCheck: { by: 'you', ok: false } });
  });
});
