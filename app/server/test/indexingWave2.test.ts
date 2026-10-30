import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndexingData, Recommendation, SiteTask } from '@seo/shared';

// Index coverage wave 2 (n8n/seo-agent/docs/indexing-2026-10-29/DESIGN_WAVE2.md §3), the server half, on PGlite with the engine's tables and
// the client's website in memory, devaicon-shaped (anonymised: novaand-demo.com): the links step `indexing:links` (its own check opens the
// pages to add the link on, partial counts, every SITE_TASKS.md rule, its share of the daily tick), "I asked Google" (members and up, this
// website's pages only, the engine's table written through the Data Table write, audited, nothing saved when the write fails), a canonical
// to another page outside the sitemap (closed only when the page names itself), the sitemap switch (no "submit your sitemap" step with Full
// access and the switch on), the Indexing page's sitemap state, and the recommendation of the links step.

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
  const email = `owner${n}@ixwave2.test`;
  const u = await signUp(app, email, 'Sam Owner');
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Index wave 2 ${n}` })).body as { id: string };
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

function run(s: S, o: { byAction?: Record<string, number>; byCause?: Record<string, number>; sitemaps?: Record<string, unknown> } = {}) {
  const runAt = new Date(Date.now() - 3_600_000).toISOString();
  t.runs.push({
    site_id: s.sid,
    domain: s.domain,
    run_at: runAt,
    known: 10,
    indexed: 4,
    inspected: 10,
    by_cause_json: JSON.stringify(o.byCause ?? { unknown_to_google: 3, discovered_not_crawled: 1 }),
    by_action_json: JSON.stringify(o.byAction ?? { links: 2, wait: 2 }),
    ...(o.sitemaps ? { sitemaps_json: JSON.stringify(o.sitemaps) } : {}),
  });
  return runAt;
}
/** devaicon's shape: two pages no other page links to (with suggestions), two the home page already links to (wait) */
function linksSite(s: S, runAt: string) {
  const p = (path: string, o: Record<string, unknown>) => t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url(path), lane: 'existing', state: 'not_indexed', inspect_at: runAt, ...o });
  p('/capabilities/open-edx-services/hosting', { cause: 'unknown_to_google', action: 'links', impressions_28d: 5, link_from: JSON.stringify([{ url: s.url('/capabilities/open-edx-services'), title: 'Open edX' }]) });
  p('/insights/agentic-ai', { cause: 'discovered_not_crawled', action: 'links', impressions_28d: 2, link_from: JSON.stringify([{ url: s.url('/insights'), title: 'Insights' }]) });
  p('/whatwedo', { cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([s.url('/')]) });
  p('/capabilities/cloud', { cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([s.url('/')]) });
}

describe('the links step (indexing:links)', () => {
  it('one step for the pages that need a link, never for pages the website already links to', async () => {
    const s = await setup();
    linksSite(s, run(s));
    const tasks = await tasksOf(s);
    const step = tasks.find((x) => x.key === 'indexing:links')!;
    expect(step).toMatchObject({ kind: 'index_links', state: 'todo', guide: 'index-add-internal-links' });
    expect(step.values.map((v) => v.value)).toEqual([s.url('/capabilities/open-edx-services/hosting'), s.url('/insights/agentic-ai')]);
    expect(step.values.map((v) => v.label)).toEqual(['On /capabilities/open-edx-services, add a link to', 'On /insights, add a link to']);
    expect(JSON.stringify(step)).not.toContain('/whatwedo');
  });

  it('"check now": partial counts, then done when every link is there', async () => {
    const s = await setup();
    linksSite(s, run(s));
    await tasksOf(s);
    await settle();
    t.web[s.url('/capabilities/open-edx-services')] = { status: 200, text: html('<a href="/capabilities/open-edx-services/hosting">Hosting</a>') };
    t.web[s.url('/insights')] = { status: 200, text: html('<a href="/insights/other">Other</a>') };
    const half = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:links' });
    expect(half.status).toBe(200);
    expect(half.body.task.state).toBe('todo');
    expect(half.body.task.lastCheck.message).toContain('1 of 2 links found');
    expect(half.body.task.lastCheck.message).toContain('/insights has no link to /insights/agentic-ai yet');
    t.web[s.url('/insights')] = { status: 200, text: html('<p>Read <a href="https://novaand-demo-x.com/no">elsewhere</a> or <a href="insights/agentic-ai/">agentic AI</a></p>') };
    const done = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:links' });
    expect(done.body.task.state).toBe('done');
    expect((await rowOf(s.site.id, 'indexing:links'))!.lastCheck).toMatchObject({ ok: true, by: 'you' });
    // only the website's own pages were opened
    expect(t.fetched.every((u) => u.includes(s.domain))).toBe(true);
    const audits = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.orgId, s.org.id), eq(schema.auditEvents.action, 'site_task.checked')));
    expect(audits.length).toBe(2);
  });

  it('a page to add the link on that does not answer records nothing (503); a firewall is "could not tell" (409)', async () => {
    const s = await setup();
    linksSite(s, run(s));
    await tasksOf(s);
    await settle();
    const before = (await rowOf(s.site.id, 'indexing:links'))!.lastCheck;
    t.web[s.url('/capabilities/open-edx-services')] = null;
    t.web[s.url('/insights')] = { status: 200, text: html('<a href="/insights/agentic-ai">x</a>') };
    expect((await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:links' })).status).toBe(503);
    t.web[s.url('/capabilities/open-edx-services')] = { status: 403, text: '<html><head><title>Just a moment...</title></head></html>' };
    const r = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:links' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('site_unsure');
    expect((await rowOf(s.site.id, 'indexing:links'))!.lastCheck).toEqual(before);
  });

  it('a viewer sees the step but cannot check it', async () => {
    const s = await setup();
    linksSite(s, run(s));
    const v = await signUp(app, `viewer${seq}@ixwave2.test`);
    const me = v.me as { user?: { id: string }; id?: string };
    await db.insert(schema.memberships).values({ orgId: s.org.id, userId: (me.user?.id ?? me.id)!, role: 'viewer' });
    expect(((await v.c.get(`${s.base}/tasks`)).body.tasks as SiteTask[]).some((x) => x.key === 'indexing:links')).toBe(true);
    expect((await v.c.post(`${s.base}/tasks/check`, { key: 'indexing:links' })).status).toBe(403);
  });

  it('the daily tick gives links steps the indexing share, and a done step found missing twice is reopened', async () => {
    const s = await setup();
    const now = new Date();
    const pairs = [{ target: s.url('/t'), source: s.url('/s'), since: now.toISOString() }];
    await db.insert(schema.siteTasks).values({ orgId: s.org.id, siteId: s.site.id, taskKey: 'indexing:links', kind: 'index_links', payload: { pairs, total: 1 }, lastCheck: { at: now.toISOString(), ok: true, message: 'ok', by: 'you' }, doneAt: now });
    for (let i = 0; i < 6; i++)
      await db.insert(schema.siteTasks).values({ orgId: s.org.id, siteId: s.site.id, taskKey: `redirect:${s.domain}/old${i}`, kind: 'redirect', payload: { brokenUrl: s.url(`/old${i}`), redirectTo: s.url('/'), links: 1 } });
    t.web[s.url('/s')] = { status: 200, text: html('<p>no link</p>') };
    await db.update(schema.siteTasks).set({ lastCheckAt: now });
    await db.update(schema.siteTasks).set({ lastCheckAt: new Date(Date.now() - 9 * DAY) }).where(eq(schema.siteTasks.siteId, s.site.id));
    await svc.siteTaskTick(log, { sites: 0, checks: 6 });
    // the links step was checked even though six other steps filled the budget; its first miss is only looked at again an hour later
    let row = (await rowOf(s.site.id, 'indexing:links'))!;
    expect(row.missAt).toBeTruthy();
    expect(row.lastCheck).toMatchObject({ ok: true });
    await db.update(schema.siteTasks).set({ lastCheckAt: new Date(Date.now() - 2 * DAY) }).where(eq(schema.siteTasks.id, row.id));
    await svc.siteTaskTick(log, { sites: 0, checks: 6 });
    row = (await rowOf(s.site.id, 'indexing:links'))!;
    expect(row.lastCheck).toMatchObject({ ok: false, by: 'daily' });
    expect(row.lastCheck!.message).toContain('0 of 1 link found');
  });
});

describe('"I asked Google" (DESIGN_WAVE2 §3.2)', () => {
  const ask = (s: S, c: S['u']['c'], url: string) => c.post(`${s.base}/data/indexing/asked-google`, { url });
  function askSite(s: S) {
    const runAt = run(s, { byCause: { discovered_not_crawled: 1 }, byAction: { wait: 1 } });
    t.pages.push(
      { site_id: s.sid, domain: s.domain, url: s.url('/capabilities/ai'), lane: 'existing', state: 'not_indexed', cause: 'discovered_not_crawled', action: 'wait', ask_google: true, inspect_at: runAt },
      { site_id: s.sid, domain: s.domain, url: s.url('/'), lane: 'existing', state: 'indexed', cause: 'indexed', action: 'none', inspect_at: runAt },
    );
  }
  it('writes asked_google_at on that page\'s row, audits it, and the page then waits for Google', async () => {
    const s = await setup();
    askSite(s);
    const r = await ask(s, s.u.c, s.url('/capabilities/ai'));
    expect(r.status).toBe(200);
    expect(t.updates).toHaveLength(1);
    expect(t.updates[0]).toMatchObject({ table: 'indexPages', filters: [{ columnName: 'site_id', value: s.sid }, { columnName: 'url', value: s.url('/capabilities/ai') }] });
    expect(Object.keys(t.updates[0].data)).toEqual(['asked_google_at']);
    expect(r.body.page.askedGoogleAt).toBe(t.updates[0].data.asked_google_at);
    const audits = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.orgId, s.org.id), eq(schema.auditEvents.action, 'indexing.asked_google')));
    expect(audits).toHaveLength(1);
    const d = (await s.u.c.get(`${s.base}/data/indexing`)).body as IndexingData;
    expect(d.askGoogle[0]).toMatchObject({ path: '/capabilities/ai', askedGoogleAt: t.updates[0].data.asked_google_at });
    // a second click the same day keeps the first time and writes nothing
    expect((await ask(s, s.u.c, s.url('/capabilities/ai'))).status).toBe(200);
    expect(t.updates).toHaveLength(1);
  });
  it('a press an overlapping engine run wrote back is shown as not recorded (from the app\'s own audit log), and can be pressed again', async () => {
    const s = await setup();
    askSite(s);
    expect((await ask(s, s.u.c, s.url('/capabilities/ai'))).status).toBe(200);
    // the engine's run loaded the row before the write and saved it after: the column is back to empty
    delete t.pages.find((p) => p.url === s.url('/capabilities/ai'))!.asked_google_at;
    const d = (await s.u.c.get(`${s.base}/data/indexing`)).body as IndexingData;
    expect(d.askGoogle[0]).toMatchObject({ path: '/capabilities/ai', askedGoogleAt: '' });
    expect(d.askGoogle[0].askNotRecorded).toBeTruthy();
    // pressed again: written again (the earlier write is not "recent" for a row that lost it)
    expect((await ask(s, s.u.c, s.url('/capabilities/ai'))).status).toBe(200);
    expect(t.updates).toHaveLength(2);
    const d2 = (await s.u.c.get(`${s.base}/data/indexing`)).body as IndexingData;
    expect(d2.askGoogle[0].askNotRecorded).toBe('');
  });
  it('members and up only; this website\'s known pages only; a page in search is refused; a failed write saves nothing', async () => {
    const s = await setup();
    askSite(s);
    const v = await signUp(app, `askviewer${seq}@ixwave2.test`);
    const me = v.me as { user?: { id: string }; id?: string };
    await db.insert(schema.memberships).values({ orgId: s.org.id, userId: (me.user?.id ?? me.id)!, role: 'viewer' });
    expect((await ask(s, v.c, s.url('/capabilities/ai'))).status).toBe(403);
    const other = await setup();
    expect([403, 404]).toContain((await ask(s, other.u.c, s.url('/capabilities/ai'))).status);
    expect((await ask(s, s.u.c, 'https://elsewhere.com/capabilities/ai')).status).toBe(404);
    expect((await ask(s, s.u.c, s.url('/never-seen'))).status).toBe(404);
    const indexed = await ask(s, s.u.c, s.url('/'));
    expect(indexed.status).toBe(409);
    expect(indexed.body.code).toBe('already_in_search');
    t.updateOk = false;
    const failed = await ask(s, s.u.c, s.url('/capabilities/ai'));
    expect(failed.status).toBe(503);
    expect(t.pages.find((p) => p.url === s.url('/capabilities/ai'))!.asked_google_at).toBeUndefined();
    expect((await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.orgId, s.org.id), eq(schema.auditEvents.action, 'indexing.asked_google')))).length).toBe(0);
  });
});

describe('a canonical to another page outside the sitemap', () => {
  it('stays to do while the page names /industries, and is done once it names itself (its absence from the sitemap is not the fix)', async () => {
    const s = await setup();
    const runAt = run(s, { byCause: { canonical_elsewhere: 1 }, byAction: { site_fix: 1 } });
    t.pages.push({ site_id: s.sid, domain: s.domain, url: s.url('/industries/bfsi'), lane: 'existing', state: 'excluded', cause: 'canonical_elsewhere', action: 'site_fix', in_sitemap: false, inspect_at: runAt });
    const step = (await tasksOf(s)).find((x) => x.key === 'indexing:canonical_elsewhere')!;
    expect(step.title).toBe('Let pages with a title of their own name themselves as the main version');
    await settle();
    t.web[`https://${s.domain}/robots.txt`] = { status: 404, text: '' };
    t.web[`https://${s.domain}/sitemap.xml`] = { status: 200, text: `<urlset><url><loc>${s.url('/industries')}</loc></url></urlset>` };
    const page = (canon: string) => ({ status: 200, text: `<html><head><title>Banking</title><link rel="canonical" href="${canon}"></head><body>x</body></html>` });
    t.web[s.url('/industries/bfsi')] = page(s.url('/industries'));
    const miss = await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:canonical_elsewhere' });
    expect(miss.body.task.state).toBe('todo');
    expect(miss.body.task.lastCheck.message).toContain('still names /industries as the main version');
    t.web[s.url('/industries/bfsi')] = page(s.url('/industries/bfsi'));
    expect((await s.u.c.post(`${s.base}/tasks/check`, { key: 'indexing:canonical_elsewhere' })).body.task.state).toBe('done');
  });
});

describe('sitemap submission (DESIGN_WAVE2 §2.5 / §3.2)', () => {
  it('switch on and Full access: no "submit your sitemap" step; read-only access: the step stays; the page shows the access and the submissions', async () => {
    const s = await setup();
    const at = new Date(Date.now() - 7_200_000).toISOString();
    run(s, { byCause: {}, byAction: {}, sitemaps: { submitted: 0, submitted_errors: 0, read: 1, complete: true, permission: 'siteFullUser', submissions: [{ path: `https://${s.domain}/sitemap.xml`, at, status: 'ok', reason: '' }] } });
    t.monitors.push({ site_id: s.sid, domain: s.domain, index_sitemap_submit: true });
    expect((await tasksOf(s)).some((x) => x.key === 'indexing:sitemap')).toBe(false);
    const d = (await s.u.c.get(`${s.base}/data/indexing`)).body as IndexingData;
    expect(d.sitemap).toMatchObject({ submitOn: true, access: 'full', submissions: [{ status: 'ok', at }] });
    expect((await s.u.c.get(`${s.base}/data/settings`)).body.monitors.indexSitemapSubmit).toBe(true);

    const r = await setup();
    run(r, { byCause: {}, byAction: {}, sitemaps: { submitted: 0, submitted_errors: 0, read: 1, complete: true, permission: 'siteRestrictedUser' } });
    t.monitors.push({ site_id: r.sid, domain: r.domain, index_sitemap_submit: true });
    expect((await tasksOf(r)).some((x) => x.key === 'indexing:sitemap')).toBe(true);
    expect(((await r.u.c.get(`${r.base}/data/indexing`)).body as IndexingData).sitemap.access).toBe('restricted');
  });
});

describe('recommendations', () => {
  it('the links step is one recommendation with its guide and the step; pages already linked add none', () => {
    const step: SiteTask = { key: 'indexing:links', kind: 'index_links', state: 'todo', reopened: false, doneAt: null, lastCheck: null, severity: 'info', title: 'Link to pages Google cannot find yet', detail: 'd', values: [{ label: 'On /insights, add a link to', value: 'https://novaand-demo.com/insights/agentic-ai' }], guide: 'index-add-internal-links', guideVars: {}, skipped: null };
    const out: Recommendation[] = [];
    indexingRecommendations({ on: true, runAt: '2026-10-30', freeze: { on: false, reason: '' }, siteFix: [], askGoogle: [], other: [], quality: [] }, [step], [], (r) => out.push(r));
    expect(out).toEqual([expect.objectContaining({ id: 'ix:links', taskKey: 'indexing:links', action: { label: 'See the step', page: 'pipeline' } })]);
  });
});
