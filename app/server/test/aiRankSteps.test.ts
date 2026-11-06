import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteTask } from '@seo/shared';

// RC-3 (review C, 2026-11-06, docs/ai-ranking-2026-11-05/REVIEW_C_ONMODE_APP.md): an AI ranking step that only the client can do somewhere
// else (a LinkedIn article, a press mention, a Wikidata item) is checked on the address the client pastes on it, end to end on PGlite with
// the client's pages in memory (the same harness as siteTasks.test.ts). Client text is anonymised (Nova&, novaand-demo.com).

const t = vi.hoisted(() => ({
  web: {} as Record<string, { status: number; text?: string; location?: string; finalUrl?: string } | null>,
  fetched: [] as string[],
  upserts: [] as unknown[][],
  updates: [] as unknown[][],
  failWrites: false,
  growth: { verified: false, checkedAt: '2026-10-25T20:08:00.000Z' } as { verified: boolean; checkedAt: string } | null,
  monitors: [] as Record<string, unknown>[],
  actions: [] as Record<string, unknown>[],
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
    if (table === 'monitors') return t.monitors.map((m) => ({ domain, ...m }));
    if (table === 'aiRankActions') return t.actions.map((a) => ({ domain, ...a }));
    if (table === 'aiVisibility' && t.access)
      return [{ domain, checked_at: t.access.checkedAt, access_json: JSON.stringify({ checked_at: t.access.checkedAt, bots: t.access.bots.map((b) => ({ bot: b.bot, owner: b.owner, group: b.group, allowed: b.allowed, rule: b.rule, blocked_paths: b.blockedPaths })) }) }];
    return [];
  });
  return { ...real, rows: vi.fn(async () => []), siteRows, insertRows: vi.fn(async () => true), updateRows: vi.fn(async (...args: unknown[]) => { if (t.failWrites) throw new Error('no column client_url'); t.updates.push(args); return true; }), upsertRow: vi.fn(async (...args: unknown[]) => { if (t.failWrites) throw new Error('engine down'); t.upserts.push(args); }), deleteRows: vi.fn(async () => true), ensureTable: vi.fn(async () => 'tbl'), invalidateSite: vi.fn(), executions: vi.fn(async () => []) };
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


const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.web = {};
  t.fetched = [];
  t.upserts = [];
  t.updates = [];
  t.failWrites = false;
  t.growth = null;
  t.access = null;
  t.monitors = [{ ai_rank_mode: 'on' }];
  t.actions = [{ action_id: 'act_L12', status: 'queued', mode: 'on' }, { action_id: 'act_L17', status: 'queued', mode: 'on' }, { action_id: 'act_L01', status: 'queued', mode: 'on' }];
});

let seq = 0;
async function setup() {
  const n = ++seq;
  const email = `owner${n}@ai-rank-steps.test`;
  const u = await signUp(app, email, 'Sam Owner');
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Nova Works ${n}` })).body as { id: string };
  const [site] = await db
    .insert(schema.sites)
    .values({ orgId: org.id, domain: `novaand-demo${n}.com`, country: 'United Arab Emirates', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active', brandNames: ['Nova&'] })
    .returning();
  // the newest AI growth report carries the plan's human steps (the ai_growth callback's ai_rank key)
  const steps = [
    { key: 'ai_rank:L12:p:aip_1', lever: 'L12', what: 'A LinkedIn article by a named person', why: 'B2B answers cite LinkedIn articles by named people', check: 'you give us the address', url: '', action_id: 'act_L12', status: 'queued' },
    { key: 'ai_rank:L17:p:aip_1', lever: 'L17', what: 'A Wikidata entry for your business', why: 'three earned mentions verified', check: 'Wikidata lists your website', url: '', action_id: 'act_L17', status: 'queued' },
    { key: 'ai_rank:L01:p:aip_1', lever: 'L01', what: 'Let AI assistants read your website', why: 'robots.txt blocks them', check: 'the next robots.txt reading', url: '', action_id: 'act_L01', status: 'queued' },
  ];
  await db.insert(schema.reports).values({ orgId: org.id, siteId: site!.id, stage: 'ai_growth', status: 'progress', title: 'AI growth', payload: { stage: 'ai_growth', ai_rank: { v: 1, mode: 'on', checked_at: '2026-11-09T09:30:00Z', steps } }, receivedAt: new Date() });
  return { u, org, site: site!, base: `/api/orgs/${org.id}/sites/${site!.id}/tasks` };
}
const tasksOf = (r: { body: unknown }) => (r.body as { tasks: SiteTask[] }).tasks;
const taskOf = (r: { body: unknown }) => (r.body as { task: SiteTask }).task;
const rowOf = async (siteId: string, key: string) => (await db.select().from(schema.siteTasks).where(and(eq(schema.siteTasks.siteId, siteId), eq(schema.siteTasks.taskKey, key))))[0];
const L12 = 'ai_rank:L12:p:aip_1';

describe('an AI ranking step checked on the address the client gives', () => {
  it('lists the address field; "check now" without an address asks for it (400, nothing recorded)', async () => {
    const s = await setup();
    const t12 = tasksOf(await s.u.c.get(s.base)).find((x) => x.key === L12)!;
    expect(t12.address).toEqual({ required: true, label: 'The address of your LinkedIn article', value: '' });
    const r = await s.u.c.post(`${s.base}/check`, { key: L12 });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toMatch(/Paste the address of the page/);
    expect((await rowOf(s.site.id, L12))?.lastCheck ?? null).toBeNull();
  });

  it('an address whose page names the business: done after "check now", stored for the daily check, handed to the engine', async () => {
    const s = await setup();
    const url = 'https://www.linkedin.com/pulse/how-we-run-crm-rollouts';
    t.web[url] = { status: 200, text: '<html><body><h1>How we run CRM rollouts</h1><p>Written by Sara, head of delivery at Nova&amp;.</p></body></html>' };
    const done = taskOf(await s.u.c.post(`${s.base}/check`, { key: L12, clientUrl: url }));
    expect(done).toMatchObject({ state: 'done', lastCheck: { ok: true, by: 'you' }, address: { value: url } });
    expect(done.lastCheck!.message).toBe(`${url} names your business.`);
    expect(t.fetched).toContain(url);
    const row = await rowOf(s.site.id, L12);
    expect(row!.payload).toMatchObject({ clientUrl: url, actionId: 'act_L12' });
    expect(row!.doneAt).not.toBeNull();
    // handed to the engine's verification input: the action row's client_url and a source row named by the client's page
    expect(t.updates).toEqual([['aiRankActions', [{ columnName: 'action_id', condition: 'eq', value: 'act_L12' }], { client_url: url, updated_at: expect.any(String) }]]);
    const sid = `site_${s.site.domain.replace(/\./g, '-')}`;
    expect(t.upserts).toEqual([
      [
        'aiRankSources',
        [{ columnName: 'site_id', condition: 'eq', value: sid }, { columnName: 'url_key', condition: 'eq', value: 'linkedin.com/pulse/how-we-run-crm-rollouts' }],
        expect.objectContaining({ site_id: sid, domain: s.site.domain, url_key: 'linkedin.com/pulse/how-we-run-crm-rollouts', url, host: 'linkedin.com', names_client: true, source_from: 'client' }),
      ],
    ]);
    for (const k of ['first_seen', 'last_seen', 'checked_at']) expect((t.upserts[0][2] as Record<string, unknown>)[k]).toEqual(expect.any(String));
    // the next read keeps it done
    expect(tasksOf(await s.u.c.get(s.base)).find((x) => x.key === L12)!.state).toBe('done');
  });

  it('an engine write that fails never fails the check (the step is still done); a miss writes nothing to the engine', async () => {
    const s = await setup();
    const url = 'https://www.linkedin.com/pulse/x';
    t.web[url] = { status: 200, text: `<a href="https://${s.site.domain}">site</a>` };
    t.failWrites = true;
    const r = await s.u.c.post(`${s.base}/check`, { key: L12, clientUrl: url });
    expect(r.status).toBe(200);
    expect(taskOf(r).state).toBe('done');
    t.failWrites = false;
    const miss = 'https://news.example.org/nothing';
    t.web[miss] = { status: 200, text: '<p>nothing here</p>' };
    await s.u.c.post(`${s.base}/check`, { key: L12, clientUrl: miss });
    expect([...t.updates, ...t.upserts]).toEqual([]);
  });

  it('the source key is the engine kit\'s AIRF.urlKey, rule for rule', async () => {
    const { readFileSync } = await import('node:fs');
    const kit = readFileSync(new URL('../../../n8n/seo-agent/v5/code/_ai_rank_flags.js', import.meta.url), 'utf8');
    const AIRF = new Function(`${kit}\nreturn AIRF;`)() as { urlKey: (u: string) => string };
    const { aiRankUrlKey } = await import('../src/services/siteTasks');
    for (const u of ['https://WWW.LinkedIn.com/pulse/x/', 'http://news.example.org:8080/a/b?q=1#top', 'https://wikidata.org./wiki/Q42', 'ftp://x.org/a', '', `https://x.org/${'a'.repeat(400)}`])
      expect(aiRankUrlKey(u), u).toBe(AIRF.urlKey(u));
  });

  it('a page that does not name the business stays to do and says what we looked for', async () => {
    const s = await setup();
    const url = 'https://news.example.org/crm-trends';
    t.web[url] = { status: 200, text: '<p>CRM trends in the Gulf, with quotes from three vendors.</p>' };
    const t12 = taskOf(await s.u.c.post(`${s.base}/check`, { key: L12, clientUrl: url }));
    expect(t12.state).toBe('todo');
    expect(t12.lastCheck!.message).toMatch(/does not name your business yet \(we looked for novaand-demo\d+\.com, Nova&/);
  });

  it('an address with a password, an IP literal or a private host is refused before anything is fetched', async () => {
    const s = await setup();
    for (const bad of ['https://user:pw@www.linkedin.com/pulse/x', 'https://10.0.0.5/admin', 'http://169.254.169.254/latest/meta-data', 'https://localhost/x']) {
      const r = await s.u.c.post(`${s.base}/check`, { key: L12, clientUrl: bad });
      expect(r.status, bad).toBe(400);
    }
    expect(t.fetched).toEqual([]);
  });

  it('L17: only a Wikidata item that lists the website itself', async () => {
    const s = await setup();
    const L17 = 'ai_rank:L17:p:aip_1';
    expect((await s.u.c.post(`${s.base}/check`, { key: L17, clientUrl: 'https://www.linkedin.com/company/nova' })).status).toBe(400);
    const item = 'https://www.wikidata.org/wiki/Q123456';
    t.web[item] = { status: 200, text: `<div>official website <a href="https://${s.site.domain}/">https://${s.site.domain}/</a></div>` };
    expect(taskOf(await s.u.c.post(`${s.base}/check`, { key: L17, clientUrl: item })).state).toBe('done');
  });

  it('a step the weekly check decides keeps its old answer (409), and has no address field', async () => {
    const s = await setup();
    const L01 = 'ai_rank:L01:p:aip_1';
    expect(tasksOf(await s.u.c.get(s.base)).find((x) => x.key === L01)!.address).toBeUndefined();
    expect((await s.u.c.post(`${s.base}/check`, { key: L01 })).status).toBe(409);
  });
});
