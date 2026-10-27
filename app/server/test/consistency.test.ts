import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { n8nSiteId, type RecommendedKeyword } from '@seo/shared';

// MKT (2026-10-27, n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §2): the one mismatch mechanism on the server, end to end on a real
// Postgres (PGlite, every migration) with the engine replaced by an in-memory Data Table store. The devaicon.com facts of production are
// the fixtures: a Pakistan website the engine measured in the UAE, the ladder keyword "ai automation solutions gcc", a description about
// the UAE and the GCC. Every start path answers 409 `confirm_needed` until a warning is accepted (corrected request) or acknowledged
// (Continue anyway, recorded on the run and in the audit log).

const t = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  starts: [] as Record<string, unknown>[],
  admin: [] as Record<string, unknown>[],
  assessCalls: 0,
}));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.AUTO_START_LADDERS = 'true';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => ({ ...(await orig<typeof import('../src/lib/mailer')>()), sendMail: vi.fn(async () => true) }));
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  type F = { columnName: string; condition: string; value: unknown };
  const match = (r: Record<string, unknown>, fs: F[] = []) => fs.every((f) => String(r[f.columnName] ?? '') === String(f.value ?? ''));
  const tbl = (n: string) => (t.tables[n] ??= []);
  let n = 0;
  return {
    ...real,
    startRun: vi.fn(async (body: Record<string, unknown>) => (t.starts.push(body), { ok: true, status: 202, requestId: `exec-${++n}`, etaMinutes: 5, error: null, duplicate: false, firstSeenAt: null })),
    rows: vi.fn(async (table: string, q: { filters?: F[] } = {}) => tbl(table).filter((r) => match(r, q.filters))),
    siteRows: vi.fn(async (table: string, domain: string, q: { extra?: F[] } = {}) => tbl(table).filter((r) => r.domain === domain && match(r, q.extra))),
    insertRows: vi.fn(async (table: string, rows: Record<string, unknown>[]) => (tbl(table).push(...rows), true)),
    updateRows: vi.fn(async (table: string, fs: F[], data: Record<string, unknown>) => {
      for (const r of tbl(table).filter((x) => match(x, fs))) Object.assign(r, data);
      return true;
    }),
    upsertRow: vi.fn(async (table: string, fs: F[], data: Record<string, unknown>) => {
      const r = tbl(table).find((x) => match(x, fs));
      if (r) Object.assign(r, data);
      else tbl(table).push({ ...Object.fromEntries(fs.map((f) => [f.columnName, f.value])), ...data });
    }),
    deleteRows: vi.fn(async (table: string, fs: F[]) => ((t.tables[table] = tbl(table).filter((r) => !match(r, fs))), true)),
    ensureTable: vi.fn(async () => 'tbl'),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
    // Site Admin as the engine runs it: `market` moves the site row (Admin_Action.js + Set Market), the rest only counts
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => {
      t.admin.push(b);
      if (b.action === 'market') {
        const row = tbl('sites').find((r) => r.site_id === b.site_id);
        if (!row) return { ok: true, action: 'market', affected: 0, error: null };
        const C: Record<string, [number, string]> = { Pakistan: [2586, 'en'], 'United Arab Emirates': [2784, 'en'] };
        Object.assign(row, { country: b.country, location_code: C[String(b.country)]![0], language_code: C[String(b.country)]![1] });
      }
      return { ok: true, action: String(b.action), affected: 1, error: null };
    }),
    assessCall: vi.fn(async (body: Record<string, unknown>) => (t.assessCalls++, { kind: 'answered', status: 200, json: { ok: true, keyword: body.keyword, country: body.country, volume: 300, kd: 20, difficulty_for_you: 'easy', fit: 2 }, error: null })),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { proposalDecision } = await import('../src/services/autoStart');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const BUSINESS = 'AI automation and software development for businesses, with clients across the UAE, GCC, and beyond.';

interface Co { c: InstanceType<typeof Client>; org: { id: string }; userId: string }
async function company(email: string, name: string): Promise<Co> {
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name })).body;
  await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
  const user = (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!;
  return { c: u.c, org, userId: user.id };
}
async function site(orgId: string, domain: string, extra: Partial<typeof schema.sites.$inferInsert> = {}) {
  const [s] = await db
    .insert(schema.sites)
    .values({ orgId, domain, country: 'Pakistan', business: 'Software for companies', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), ...extra })
    .returning();
  return s;
}
const base = (co: Co, siteId: string) => `/api/orgs/${co.org.id}/sites/${siteId}`;
const ladder = (siteId: string, keyword: string, extra: Record<string, unknown> = {}) => ({ mode: 'ladder', siteId, keyword, country: 'Pakistan', business: 'AI automation', pagesNow: 1, ladderMode: 'manual', ...extra });

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.starts = [];
  t.admin = [];
  t.assessCalls = 0;
});

describe('a run start (the app route; the same path as the API, MCP, proposals and onboarding)', () => {
  it('devaicon: a GCC keyword on a Pakistan website is held with the warning, its Accept and its id; nothing reaches the engine', async () => {
    const co = await company('mk-run@mk.test', 'Run Co');
    const s = await site(co.org.id, 'devaicon-run.com');
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, ladder(s.id, 'ai automation solutions gcc'));
    expect([r.status, r.body.code]).toEqual([409, 'confirm_needed']);
    expect(r.body.needsAcknowledge).toEqual(['market.keyword_place:ai automation solutions gcc:PK']);
    expect(r.body.warnings).toEqual(r.body.notices);
    expect(r.body.warnings[0]).toMatchObject({ code: 'market.keyword_place', severity: 'market', accept: { change: { kind: 'fields', set: { keyword: 'ai automation solutions' } } } });
    expect(t.starts).toEqual([]);
    expect(await db.query.runs.findMany({ where: eq(schema.runs.siteId, s.id) })).toEqual([]);
  });

  it('Accept: the corrected request starts, with nothing to record', async () => {
    const co = await company('mk-acc@mk.test', 'Accept Co');
    const s = await site(co.org.id, 'devaicon-acc.com');
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, ladder(s.id, 'ai automation solutions'));
    expect(r.status).toBe(200);
    const run = (await db.query.runs.findFirst({ where: eq(schema.runs.id, r.body.id) }))!;
    expect((run.input as Record<string, unknown>).acknowledged).toBeUndefined();
    expect(t.starts).toHaveLength(1);
  });

  it('Continue anyway: the run starts, carries the acknowledged ids, and the audit log says who went past which warning', async () => {
    const co = await company('mk-ack@mk.test', 'Ack Co');
    const s = await site(co.org.id, 'devaicon-ack.com');
    const id = 'market.keyword_place:ai automation solutions gcc:PK';
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, { ...ladder(s.id, 'ai automation solutions gcc'), acknowledge: [id] });
    expect(r.status).toBe(200);
    const run = (await db.query.runs.findFirst({ where: eq(schema.runs.id, r.body.id) }))!;
    expect((run.input as Record<string, unknown>).acknowledged).toEqual([id]);
    expect('acknowledge' in t.starts[0]!).toBe(false);   // the engine never sees the acknowledgement
    const ev = await db.query.auditEvents.findFirst({ where: and(eq(schema.auditEvents.orgId, co.org.id), eq(schema.auditEvents.action, 'warning.overridden')) });
    expect(ev).toMatchObject({ targetType: 'run', targetId: run.id });
    expect(ev!.details).toMatchObject({ codes: ['market.keyword_place'], ids: [id], what: 'run:ladder', keyword: 'ai automation solutions gcc' });
  });

  it('M1: a run for another country than the website\'s is held; Accept is the website\'s country', async () => {
    const co = await company('mk-m1@mk.test', 'M1 Co');
    const s = await site(co.org.id, 'devaicon-m1.com');
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'audit', siteId: s.id, reportType: 'site_audit', country: 'United Arab Emirates' });
    expect([r.status, r.body.needsAcknowledge]).toEqual([409, ['market.run_country:AE:PK']]);
    expect(r.body.warnings[0].accept.change).toEqual({ kind: 'fields', set: { country: 'Pakistan' } });
    const ok = await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'audit', siteId: s.id, reportType: 'site_audit', country: 'Pakistan' });
    expect(ok.status).toBe(200);
  });

  it('the keyword check asks before the paid call', async () => {
    const co = await company('mk-kc@mk.test', 'KC Co');
    const s = await site(co.org.id, 'devaicon-kc.com');
    const r = await co.c.post(`${base(co, s.id)}/keywords/assess`, { keyword: 'ai automation solutions gcc' });
    expect([r.status, r.body.code]).toEqual([409, 'confirm_needed']);
    expect(t.assessCalls).toBe(0);
    const ok = await co.c.post(`${base(co, s.id)}/keywords/assess`, { keyword: 'ai automation solutions gcc', acknowledge: ['market.keyword_place:ai automation solutions gcc:PK'] });
    expect(ok.status).toBe(200);
    expect(t.assessCalls).toBe(1);
  });
});

describe('the website: description vs country (M5), the engine\'s market (M2), ladders (M3)', () => {
  it('M5 on save: a description about the UAE and the GCC on a Pakistan website asks; Continue anyway keeps it quiet', async () => {
    const co = await company('mk-m5@mk.test', 'M5 Co');
    const s = await site(co.org.id, 'devaicon-m5.com');
    const r = await co.c.patch(base(co, s.id), { business: BUSINESS });
    expect([r.status, r.body.code]).toEqual([409, 'confirm_needed']);
    const w = r.body.warnings.find((x: { code: string }) => x.code === 'market.business_text');
    expect(w.accept.change).toEqual({ kind: 'fields', set: { country: 'United Arab Emirates' } });
    const ok = await co.c.patch(base(co, s.id), { business: BUSINESS, acknowledge: [w.id] });
    expect(ok.status).toBe(200);
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, s.id) }))!.acknowledgedWarnings).toEqual([w.id]);
    // a later save of the same facts is not asked again; the standing banner is quiet too
    expect((await co.c.patch(base(co, s.id), { business: BUSINESS, cta: 'Book a call' })).status).toBe(200);
    expect((await co.c.get(`${base(co, s.id)}/consistency`)).body.warnings.map((x: { code: string }) => x.code)).not.toContain('market.business_text');
  });

  it('M2: devaicon tracked in Pakistan while the engine measures the UAE: the banner, then Accept moves the engine (history untouched)', async () => {
    const co = await company('mk-m2@mk.test', 'M2 Co');
    const s = await site(co.org.id, 'devaicon-m2.com', { trackingStatus: 'active' });
    t.tables.sites = [...(t.tables.sites ?? []), { site_id: n8nSiteId('devaicon-m2.com'), domain: 'devaicon-m2.com', country: 'United Arab Emirates', location_code: 2784, language_code: 'en' }];
    t.tables.rankHistory = [{ ladder_id: n8nSiteId('devaicon-m2.com'), domain: 'devaicon-m2.com', keyword: 'open edx provider', position: 9 }];
    const g = await co.c.get(`${base(co, s.id)}/consistency`);
    expect(g.body.warnings.map((x: { id: string }) => x.id)).toEqual(['market.engine_drift:AE:PK']);
    expect(g.body.warnings[0].accept.change).toEqual({ kind: 'call', method: 'POST', path: `${base(co, s.id)}/market/sync` });
    const sync = await co.c.post(`${base(co, s.id)}/market/sync`, {});
    expect(sync.status).toBe(200);
    expect(t.admin.at(-1)).toMatchObject({ action: 'market', domain: 'devaicon-m2.com', site_id: n8nSiteId('devaicon-m2.com'), country: 'Pakistan' });
    expect(t.tables.sites!.find((r) => r.domain === 'devaicon-m2.com')).toMatchObject({ country: 'Pakistan', location_code: 2586 });
    expect(t.tables.rankHistory).toEqual([{ ladder_id: n8nSiteId('devaicon-m2.com'), domain: 'devaicon-m2.com', keyword: 'open edx provider', position: 9 }]);
    expect((await co.c.get(`${base(co, s.id)}/consistency`)).body.warnings).toEqual([]);
    expect(await db.query.auditEvents.findFirst({ where: and(eq(schema.auditEvents.orgId, co.org.id), eq(schema.auditEvents.action, 'site.market_synced')) })).toBeTruthy();
  });

  it('M2: a new main country on a tracked website moves the engine at once; an untracked website has nothing to move', async () => {
    const co = await company('mk-cc@mk.test', 'CC Co');
    const s = await site(co.org.id, 'devaicon-cc.com', { trackingStatus: 'active', country: 'United Arab Emirates' });
    t.tables.sites = [...(t.tables.sites ?? []), { site_id: n8nSiteId('devaicon-cc.com'), domain: 'devaicon-cc.com', country: 'United Arab Emirates', location_code: 2784, language_code: 'en' }];
    const r = await co.c.patch(base(co, s.id), { country: 'Pakistan' });
    expect(r.status).toBe(200);
    expect(t.admin.find((b) => b.action === 'market')).toMatchObject({ country: 'Pakistan' });
    expect(t.tables.sites!.find((x) => x.domain === 'devaicon-cc.com')).toMatchObject({ location_code: 2586 });
    const u = await site(co.org.id, 'untracked-cc.com');
    t.admin = [];
    expect((await co.c.patch(base(co, u.id), { country: 'India' })).status).toBe(200);
    expect(t.admin).toEqual([]);
    expect((await co.c.post(`${base(co, u.id)}/market/sync`, {})).status).toBe(409);
  });

  it('M3: a ladder in another country; Accept moves its rows; Continue anyway on a standing warning is stored', async () => {
    const co = await company('mk-m3@mk.test', 'M3 Co');
    const s = await site(co.org.id, 'devaicon-m3.com');
    t.tables.ladders = [
      ...(t.tables.ladders ?? []),
      { ladder_id: 'lad_gcc', domain: 'devaicon-m3.com', head_keyword: 'ai automation solutions gcc', keyword: 'ai automation solutions gcc', rung: 4, status: 'planned', country: 'United Arab Emirates', location_code: 2784 },
      { ladder_id: 'lad_gcc', domain: 'devaicon-m3.com', head_keyword: 'ai automation solutions gcc', keyword: 'ai workflow automation', rung: 1, status: 'planned', country: 'United Arab Emirates', location_code: 2784 },
    ];
    const g = await co.c.get(`${base(co, s.id)}/consistency`);
    expect(g.body.warnings.map((x: { id: string }) => x.id)).toEqual(['market.ladder_country:lad_gcc:AE:PK']);
    expect((await co.c.post(`${base(co, s.id)}/ladders/lad_gcc/market`, {})).status).toBe(200);
    expect(t.tables.ladders!.filter((r) => r.ladder_id === 'lad_gcc').map((r) => [r.country, r.location_code])).toEqual([
      ['Pakistan', 2586],
      ['Pakistan', 2586],
    ]);
    // Continue anyway on a standing warning (a second ladder)
    t.tables.ladders!.push({ ladder_id: 'lad_uk', domain: 'devaicon-m3.com', head_keyword: 'erp london', keyword: 'erp london', rung: 4, status: 'planned', country: 'United Kingdom', location_code: 2826 });
    const id = 'market.ladder_country:lad_uk:GB:PK';
    expect((await co.c.post(`${base(co, s.id)}/consistency/acknowledge`, { acknowledge: [id] })).status).toBe(200);
    const after = await co.c.get(`${base(co, s.id)}/consistency`);
    expect(after.body.warnings).toEqual([]);
    expect(after.body.acknowledged.map((x: { id: string }) => x.id)).toEqual([id]);
    expect((await co.c.post(`${base(co, s.id)}/consistency/acknowledge`, { acknowledge: ['made.up:1'] })).status).toBe(400);
  });

  it('M7: AI questions about Dubai on a Pakistan website; a new one is held on add', async () => {
    const co = await company('mk-m7@mk.test', 'M7 Co');
    const s = await site(co.org.id, 'devaicon-m7.com', { trackingStatus: 'active' });
    t.tables.aiPrompts = [
      { prompt_id: 'p1', domain: 'devaicon-m7.com', prompt: 'Which companies offer AI automation in Dubai?', status: 'active', source: 'auto' },
      { prompt_id: 'p2', domain: 'devaicon-m7.com', prompt: 'How do I automate invoicing with AI?', status: 'active', source: 'auto' },
    ];
    const g = await co.c.get(`${base(co, s.id)}/consistency`);
    const w = g.body.warnings.find((x: { code: string }) => x.code === 'ai.question_place');
    expect(w.accept.change).toEqual({ kind: 'call', method: 'POST', path: `${base(co, s.id)}/admin`, body: { action: 'ai_prompts', remove: ['p1'] } });
    const add = await co.c.post(`${base(co, s.id)}/admin`, { action: 'ai_prompts', add: ['Which AI automation firms work in Abu Dhabi?'] });
    expect([add.status, add.body.code]).toEqual([409, 'confirm_needed']);
    expect(t.admin).toEqual([]);
    const removed = await co.c.post(`${base(co, s.id)}/admin`, { action: 'ai_prompts', remove: ['p1'] });
    expect(removed.status).toBe(200);
    expect(t.admin.at(-1)).toMatchObject({ action: 'ai_prompts', remove: ['p1'] });
  });
});

describe('automatic starts never continue past a warning', () => {
  const kw = (keyword: string): RecommendedKeyword =>
    ({ keyword, volume: 100, kd: 10, intent: 'commercial', pageType: 'Service Page', why: '', difficultyForYou: 'easy', planType: 'direct', months: '3', label: '', source: 'research', overlaps: [] }) as unknown as RecommendedKeyword;
  const state = (over: Record<string, unknown> = {}) =>
    ({
      enabled: true,
      level: 2,
      maxActive: 2,
      cards: [],
      ladders: [],
      recommended: { reportId: 'r1', receivedAt: new Date().toISOString(), ageDays: 1, stale: false, reach: null, country: 'Pakistan', keywords: [kw('ai automation solutions gcc'), kw('ai automation services lahore')] },
      proposedBefore: [],
      open: false,
      ladderRunActive: false,
      researchRunning: false,
      paused: false,
      fitOf: new Map(),
      country: 'Pakistan',
      ...over,
    }) as Parameters<typeof proposalDecision>[0];

  it('M4: a keyword about another market is never proposed', () => {
    expect(proposalDecision(state())).toMatchObject({ action: 'propose', pick: { keyword: 'ai automation services lahore' } });
  });

  it('M6: suggestions researched for another country propose nothing (level 3 refreshes the research)', () => {
    const r = state().recommended;
    expect(proposalDecision(state({ recommended: { ...r, country: 'United Arab Emirates' } }))).toMatchObject({ action: 'none' });
    expect(proposalDecision(state({ level: 3, recommended: { ...r, country: 'United Arab Emirates' } }))).toMatchObject({ action: 'research' });
  });
});
