import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteTask } from '@seo/shared';

// Site tasks (2026-10-28, app/docs/SITE_TASKS.md) end to end on PGlite, the client's website in memory: the steps a website has (from the
// engine's readings), "I've done it, check now" with each step's own check (IndexNow file, robots.txt, a redirect), the newest reading
// deciding, skip / restore, roles, the audit log, the daily check (two misses before a done step reopens; a site that does not answer
// changes nothing) and the old AI-page button now storing its check. Client text is anonymised (Nova&, novaand-demo.com).

const t = vi.hoisted(() => ({
  web: {} as Record<string, { status: number; text?: string; location?: string; finalUrl?: string } | null>,
  fetched: [] as string[],
  growth: { verified: false, checkedAt: '2026-10-25T20:08:00.000Z' } as { verified: boolean; checkedAt: string } | null,
  access: null as null | { checkedAt: string; bots: { bot: string; owner: string; group: 'answer' | 'training'; allowed: boolean; rule: string; blockedPaths: string[] }[] },
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
  // the engine's rows for the website: its latest AI growth run (the IndexNow key) and AI visibility run (crawler access)
  const siteRows = vi.fn(async (table: string, domain: string) => {
    if (table === 'aiGrowth' && t.growth)
      return [{ domain, checked_at: t.growth.checkedAt, submitted_json: JSON.stringify({ indexnow: { key_url: `https://www.${domain}/0164d4832b1f1282c628825ad67050dd.txt`, verified: t.growth.verified } }) }];
    if (table === 'aiVisibility' && t.access)
      return [{ domain, checked_at: t.access.checkedAt, access_json: JSON.stringify({ checked_at: t.access.checkedAt, bots: t.access.bots.map((b) => ({ bot: b.bot, owner: b.owner, group: b.group, allowed: b.allowed, rule: b.rule, blocked_paths: b.blockedPaths })) }) }];
    return [];
  });
  return { ...real, rows: vi.fn(async () => []), siteRows, insertRows: vi.fn(async () => true), updateRows: vi.fn(async () => true), upsertRow: vi.fn(async () => undefined), deleteRows: vi.fn(async () => true), ensureTable: vi.fn(async () => 'tbl'), invalidateSite: vi.fn(), executions: vi.fn(async () => []) };
});
vi.mock('../src/services/verify', async (orig) => {
  const real = await orig<typeof import('../src/services/verify')>();
  const answer = (url: string) => (url in t.web ? t.web[url] : { status: 404, text: 'not found' });
  return {
    ...real,
    fetchPublicText: vi.fn(async (url: string) => {
      t.fetched.push(url);
      let cur = url;
      for (let i = 0; i < 5; i++) {
        const r = answer(cur);
        if (!r) return null;
        if (r.location) {
          cur = r.location;
          continue;
        }
        return { status: r.status, text: r.text ?? '', finalUrl: r.finalUrl ?? cur };
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

const KEY = '0164d4832b1f1282c628825ad67050dd';
const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const svc = await import('../src/services/siteTasks');
const { siteTaskNeedsYou } = await import('../src/services/pipeline');
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
  t.growth = { verified: false, checkedAt: '2026-10-25T20:08:00.000Z' };
  t.access = null;
});

/** a backlink report delivered to the app (mode 'full' looks for broken pages; the weekly light watch does not) */
async function backlinkReport(o: { orgId: string; siteId: string }, mode: 'full' | 'light', receivedAt: string, reclaim: { broken_url: string; redirect_to: string; links: number; domains: string[] }[]) {
  await db.insert(schema.reports).values({ orgId: o.orgId, siteId: o.siteId, stage: 'backlinks', status: 'completed', title: 'Backlinks', payload: { stage: 'backlinks', mode, reclaim }, receivedAt: new Date(receivedAt) });
}

let seq = 0;
async function setup(o: { verified?: boolean } = {}) {
  const n = ++seq;
  const email = `owner${n}@site-tasks.test`;
  const u = await signUp(app, email, 'Sam Owner');
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Site Tasks ${n}` })).body as { id: string };
  const [site] = await db
    .insert(schema.sites)
    .values({ orgId: org.id, domain: `novaand-demo${n}.com`, country: 'United Arab Emirates', verificationToken: 't', verifiedAt: o.verified === false ? null : new Date(Date.now() - 5 * DAY), trackingStatus: 'active' })
    .returning();
  const base = `/api/orgs/${org.id}/sites/${site!.id}/tasks`;
  const keyUrl = `https://www.${site!.domain}/${KEY}.txt`;
  return { u, org, site: site!, base, keyUrl };
}
const tasksOf = (r: { body: unknown }) => (r.body as { tasks: SiteTask[] }).tasks;
const taskOf = (r: { body: unknown }) => (r.body as { task: SiteTask }).task;
const rowOf = async (siteId: string, key: string) => (await db.select().from(schema.siteTasks).where(and(eq(schema.siteTasks.siteId, siteId), eq(schema.siteTasks.taskKey, key))))[0];
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('the IndexNow file', () => {
  it('a website with an engine key and no file: the step is listed to do and stored for the daily check', async () => {
    const s = await setup();
    const r = await s.u.c.get(s.base);
    expect(r.status).toBe(200);
    const [task] = tasksOf(r);
    expect(task).toMatchObject({ key: 'indexnow', state: 'todo', reopened: false, guide: 'indexnow-key-file' });
    expect(task.values.map((v) => v.value)).toEqual([`${KEY}.txt`, KEY, s.keyUrl]);
    await settle();
    const row = await rowOf(s.site.id, 'indexnow');
    expect(row).toMatchObject({ kind: 'indexnow', payload: { keyUrl: s.keyUrl, key: KEY } });
    // its first background check found nothing and waits for a second look before it records anything
    expect(row!.lastCheck).toBeNull();
    expect(row!.missAt).not.toBeNull();
  });

  it('"check now": not there yet, then there; the newest reading wins over the older weekly run, and both are audited', async () => {
    const s = await setup();
    t.web[s.keyUrl] = { status: 404, text: 'not found' };
    const a = taskOf(await s.u.c.post(`${s.base}/check`, { key: 'indexnow' }));
    expect(a).toMatchObject({ state: 'todo', lastCheck: { ok: false, by: 'you', who: 'Sam Owner' } });
    expect(a.lastCheck!.message).toBe('The address answers 404: the file is not there yet.');
    t.web[s.keyUrl] = { status: 200, text: `${KEY}\n` };
    const b = taskOf(await s.u.c.post(`${s.base}/check`, { key: 'indexnow' }));
    expect(b).toMatchObject({ state: 'done', lastCheck: { ok: true, by: 'you' } });
    // the engine still says "not found" from its older run: the Pipeline shows Done
    expect(tasksOf(await s.u.c.get(s.base))[0].state).toBe('done');
    const ev = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.orgId, s.org.id), eq(schema.auditEvents.action, 'site_task.checked')));
    expect(ev.map((e) => e.outcome).sort()).toEqual(['failure', 'success']);
    expect(ev[0]!.targetLabel).toBe(s.site.domain);
  });

  it('the website does not answer the button: nothing is recorded, the person is asked to retry', async () => {
    const s = await setup();
    t.web[s.keyUrl] = { status: 200, text: KEY };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: 'indexnow' })).state).toBe('done');
    t.web[s.keyUrl] = null;
    const r = await s.u.c.post(`${s.base}/check`, { key: 'indexnow' });
    expect(r.status).toBe(503);
    expect(tasksOf(await s.u.c.get(s.base))[0].state).toBe('done');
  });

  it('reading the steps writes nothing when nothing changed', async () => {
    const s = await setup();
    await s.u.c.get(s.base);
    await settle();
    const before = (await rowOf(s.site.id, 'indexnow'))!.updatedAt.getTime();
    await s.u.c.get(s.base);
    await s.u.c.get(s.base);
    expect((await rowOf(s.site.id, 'indexnow'))!.updatedAt.getTime()).toBe(before);
  });

  it('a file with something else in it is not done, and says why', async () => {
    const s = await setup();
    t.web[s.keyUrl] = { status: 200, text: `<html>${KEY}</html>` };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: 'indexnow' })).lastCheck!.message).toBe('The address answers, but the file does not contain only the key.');
  });

  it('done by the weekly run with nothing stored: shown done at once (every production website on deploy day)', async () => {
    const s = await setup();
    t.growth = { verified: true, checkedAt: '2026-10-25T20:08:00.000Z' };
    expect(tasksOf(await s.u.c.get(s.base))[0]).toMatchObject({ state: 'done', lastCheck: { by: 'weekly' } });
  });

  it('the old AI-page button stores a member\'s check and keeps its answer shape', async () => {
    const s = await setup();
    t.web[s.keyUrl] = { status: 200, text: KEY };
    const r = await s.u.c.post(`/api/orgs/${s.org.id}/sites/${s.site.id}/ai/indexnow/check`, {});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ verified: true, keyUrl: s.keyUrl, status: 200 });
    expect((await rowOf(s.site.id, 'indexnow'))!.lastCheck).toMatchObject({ ok: true, by: 'you' });
  });
});

describe('who may do what', () => {
  it('a viewer sees the steps but cannot check or skip them; an unverified website shows none', async () => {
    const s = await setup();
    const v = await signUp(app, `viewer${seq}@site-tasks.test`);
    const me = v.me as { user?: { id: string }; id?: string };
    await db.insert(schema.memberships).values({ orgId: s.org.id, userId: (me.user?.id ?? me.id)!, role: 'viewer' });
    expect(tasksOf(await v.c.get(s.base))).toHaveLength(1);
    expect((await v.c.post(`${s.base}/check`, { key: 'indexnow' })).status).toBe(403);
    expect((await v.c.post(`${s.base}/skip`, { key: 'indexnow' })).status).toBe(403);
    const u = await setup({ verified: false });
    expect((await u.u.c.get(u.base)).status).toBe(403);
  });

  it('skip and bring back: audited, a skipped step cannot be checked, an unknown step is a 404', async () => {
    const s = await setup();
    expect(taskOf(await s.u.c.post(`${s.base}/skip`, { key: 'indexnow' }))).toMatchObject({ state: 'skipped', skipped: { who: 'Sam Owner' } });
    expect((await s.u.c.post(`${s.base}/check`, { key: 'indexnow' })).status).toBe(400);
    expect(taskOf(await s.u.c.post(`${s.base}/restore`, { key: 'indexnow' }))).toMatchObject({ state: 'todo', skipped: null });
    expect((await s.u.c.post(`${s.base}/check`, { key: 'redirect:elsewhere.com/x' })).status).toBe(404);
    const ev = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.orgId, s.org.id));
    expect(ev.map((e) => e.action)).toEqual(expect.arrayContaining(['site_task.skipped', 'site_task.restored']));
  });
});

describe('AI search crawlers (robots.txt, the engine\'s rules)', () => {
  it('blocked, still blocked, then allowed by a named group', async () => {
    const s = await setup();
    t.growth = null;
    t.access = { checkedAt: '2026-10-25T19:43:00.000Z', bots: [{ bot: 'PerplexityBot', owner: 'Perplexity', group: 'answer', allowed: false, rule: 'Disallow: /', blockedPaths: [] }, { bot: 'GPTBot', owner: 'OpenAI training', group: 'training', allowed: false, rule: 'Disallow: /', blockedPaths: [] }] };
    const [task] = tasksOf(await s.u.c.get(s.base));
    expect(task).toMatchObject({ key: 'ai_crawlers', state: 'todo' });
    const robots = `https://${s.site.domain}/robots.txt`;
    t.web[robots] = { status: 200, text: 'User-agent: *\nDisallow: /\n' };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: 'ai_crawlers' })).lastCheck!.message).toBe('robots.txt still blocks PerplexityBot from / (Disallow: /).');
    t.web[robots] = { status: 200, text: 'User-agent: *\nDisallow: /\n\nUser-agent: PerplexityBot\nAllow: /\n' };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: 'ai_crawlers' }))).toMatchObject({ state: 'done' });
  });

  it('a robots.txt that errors is not done (crawlers read it as "do not crawl"); a missing one blocks nothing', async () => {
    const s = await setup();
    t.growth = null;
    t.access = { checkedAt: '2026-10-25T19:43:00.000Z', bots: [{ bot: 'Bingbot', owner: 'Bing', group: 'answer', allowed: false, rule: 'Disallow: /', blockedPaths: [] }] };
    await s.u.c.get(s.base);
    const robots = `https://${s.site.domain}/robots.txt`;
    t.web[robots] = { status: 503, text: '' };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: 'ai_crawlers' })).state).toBe('todo');
    t.web[robots] = { status: 404, text: '' };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: 'ai_crawlers' })).state).toBe('done');
  });
});

describe('redirects of broken pages other sites link to', () => {
  async function withRedirect() {
    const s = await setup();
    t.growth = null;
    const broken = `https://${s.site.domain}/old-guide`;
    const to = `https://${s.site.domain}/guides/new`;
    await backlinkReport({ orgId: s.org.id, siteId: s.site.id }, 'full', '2026-10-20T00:00:00.000Z', [{ broken_url: broken, redirect_to: to, links: 3, domains: ['partner.example'] }]);
    const key = `redirect:${s.site.domain}/old-guide`;
    expect(tasksOf(await s.u.c.get(s.base))[0]).toMatchObject({ key, state: 'todo', title: 'Redirect /old-guide' });
    return { ...s, broken, to, key };
  }
  it('a temporary redirect is not done; a permanent one to a live page of the site is', async () => {
    const s = await withRedirect();
    t.web[s.broken] = { status: 302, location: s.to };
    t.web[s.to] = { status: 200, text: '<html></html>' };
    const a = taskOf(await s.u.c.post(`${s.base}/check`, { key: s.key }));
    expect(a.state).toBe('todo');
    expect(a.lastCheck!.message).toContain('temporary 302');
    t.web[s.broken] = { status: 301, location: s.to };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: s.key }))).toMatchObject({ state: 'done' });
  });
  it('a weekly light watch (it does not look for broken pages) never marks a redirect done; a newer full report without it does', async () => {
    const s = await withRedirect();
    await backlinkReport({ orgId: s.org.id, siteId: s.site.id }, 'light', '2026-11-03T00:00:00.000Z', []);
    expect(tasksOf(await s.u.c.get(s.base))[0]).toMatchObject({ key: s.key, state: 'todo' });
    await backlinkReport({ orgId: s.org.id, siteId: s.site.id }, 'full', '2099-11-20T00:00:00.000Z', []);
    expect(tasksOf(await s.u.c.get(s.base))[0]).toMatchObject({ key: s.key, state: 'done', lastCheck: { by: 'monthly' } });
  });
  it('a Location with a user name in it (good host before the @, private address after) is refused before any request', async () => {
    const s = await withRedirect();
    t.web[s.broken] = { status: 301, location: `https://${s.site.domain}:x@10.0.0.5/` };
    const { publicHttpsHost } = await vi.importActual<typeof import('../src/services/verify')>('../src/services/verify');
    expect(publicHttpsHost(`https://${s.site.domain}:x@10.0.0.5/`)).toBeNull();
    expect(publicHttpsHost('https://10.0.0.5/')).toBeNull();
    expect(publicHttpsHost('http://novaand-demo.com/')).toBeNull();
    expect(publicHttpsHost('https://www.novaand-demo.com/a')).toBe('www.novaand-demo.com');
  });
  it('a redirect to another website, or to a page that is missing too, is not done; the page back at its address is', async () => {
    const s = await withRedirect();
    t.web[s.broken] = { status: 301, location: 'https://elsewhere.example/x' };
    t.web['https://elsewhere.example/x'] = { status: 200, text: '' };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: s.key })).lastCheck!.message).toContain('another website');
    t.web[s.broken] = { status: 308, location: s.to };
    t.web[s.to] = { status: 404, text: '' };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: s.key })).lastCheck!.message).toContain('answers 404');
    t.web[s.broken] = { status: 200, text: '<html></html>' };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: s.key }))).toMatchObject({ state: 'done' });
  });
});

describe('the daily check', () => {
  const makeDue = (id: string) => db.update(schema.siteTasks).set({ lastCheckAt: new Date(Date.now() - 2 * DAY) }).where(eq(schema.siteTasks.id, id));
  it('a done step found missing reopens only on the second miss; a website that does not answer changes nothing', async () => {
    const s = await setup();
    t.web[s.keyUrl] = { status: 200, text: KEY };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: 'indexnow' })).state).toBe('done');
    const row = (await rowOf(s.site.id, 'indexnow'))!;
    // the site is down: nothing recorded
    t.web[s.keyUrl] = null;
    await makeDue(row.id);
    await svc.siteTaskTick(log, { sites: 0 });
    expect(tasksOf(await s.u.c.get(s.base))[0].state).toBe('done');
    // the file is gone: first miss, still done, due again within the hour
    t.web[s.keyUrl] = { status: 404 };
    await makeDue(row.id);
    await svc.siteTaskTick(log, { sites: 0 });
    const r1 = (await rowOf(s.site.id, 'indexnow'))!;
    expect(r1.missAt).not.toBeNull();
    expect(r1.lastCheckAt!.getTime()).toBeLessThan(Date.now() - DAY + 61 * 60 * 1000);
    expect(tasksOf(await s.u.c.get(s.base))[0].state).toBe('done');
    // second miss: reopened, important, says what the check found
    await makeDue(row.id);
    await svc.siteTaskTick(log, { sites: 0 });
    const t2 = tasksOf(await s.u.c.get(s.base))[0];
    expect(t2).toMatchObject({ state: 'todo', reopened: true, severity: 'warning', lastCheck: { by: 'daily', ok: false } });
    expect(siteTaskNeedsYou([t2])[0]).toMatchObject({ id: 'task:indexnow', kind: 'site_task', severity: 'warning', title: 'Add the IndexNow file to your website (needed again)' });
  });

  it('a client on autopilot who made the change without pressing anything sees it done after the daily check', async () => {
    const s = await setup();
    await s.u.c.get(s.base);
    await settle();
    t.web[s.keyUrl] = { status: 200, text: KEY };
    const row = (await rowOf(s.site.id, 'indexnow'))!;
    await makeDue(row.id);
    await svc.siteTaskTick(log, { sites: 0 });
    expect(tasksOf(await s.u.c.get(s.base))[0]).toMatchObject({ state: 'done', lastCheck: { by: 'daily' } });
  });

  it('stores the steps of websites nobody opened (autopilot), from the engine\'s data', async () => {
    const s = await setup();
    expect(await rowOf(s.site.id, 'indexnow')).toBeUndefined();
    await svc.siteTaskTick(log, { sites: 1000, checks: 0 });
    expect(await rowOf(s.site.id, 'indexnow')).toBeDefined();
  });

  it('skipped steps are never checked', async () => {
    const s = await setup();
    await s.u.c.post(`${s.base}/skip`, { key: 'indexnow' });
    const row = (await rowOf(s.site.id, 'indexnow'))!;
    await makeDue(row.id);
    t.fetched = [];
    await svc.siteTaskTick(log, { sites: 0 });
    expect(t.fetched).not.toContain(s.keyUrl);
  });
});

describe('Needs you', () => {
  it('only steps to do become Needs-you items, with their guide values', () => {
    const base = { kind: 'indexnow' as const, reopened: false, doneAt: null, lastCheck: null, severity: 'info' as const, title: 'T', detail: 'D', values: [], guide: 'indexnow-key-file', guideVars: { indexNowKey: KEY }, skipped: null };
    const items = siteTaskNeedsYou([{ ...base, key: 'indexnow', state: 'todo' }, { ...base, key: 'x', state: 'done' }, { ...base, key: 'y', state: 'skipped' }]);
    expect(items).toEqual([{ id: 'task:indexnow', kind: 'site_task', severity: 'info', title: 'T', detail: 'D', action: { label: 'Open the step', page: 'pipeline' }, guideVars: { indexNowKey: KEY } }]);
  });
});

