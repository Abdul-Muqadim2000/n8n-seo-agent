import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { n8nSiteId } from '@seo/shared';

// The production-safety review of the keyword-first server (2026-10-20), end to end on a real Postgres (PGlite, every migration) with the
// engine replaced by an in-memory Data Table store. Each test fails on the code before the fix:
//   1 one engine site id, one website (create, verify, every read and write keyed by site id)   2 system keyword checks are autopilot spend
//   3 a failed proposal start is a failure                 4 free research: only a 4xx gives it back, keyed by the registrable domain
//   5 a plan without a due time is refused, NULLS LAST     6 re-announcement e-mails, in the website's zone
//   7 the auto-pause is never lost behind a failed write  8 onboarding "keyword", `source`, the engine's real cycle row, proposal details
//   9 a missing autopilot_level column is a clear, logged error

const t = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  starts: [] as Record<string, unknown>[],
  startOk: true,
  startStatus: 503,
  mails: [] as { to: string; subject: string; lines: string[] }[],
  assess: { difficulty_for_you: 'easy', fit: 2 } as Record<string, unknown>,
  /** a write the engine refuses: (table, data) -> the error to throw, or null */
  upsertFail: null as null | ((table: string, data: Record<string, unknown>) => Error | null),
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
vi.mock('../src/lib/mailer', async (orig) => {
  const real = await orig<typeof import('../src/lib/mailer')>();
  return { ...real, sendMail: vi.fn(async (m: { to: string; subject: string; lines: string[] }) => (t.mails.push({ to: m.to, subject: m.subject, lines: m.lines }), true)) };
});
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  type F = { columnName: string; condition: string; value: unknown };
  const match = (r: Record<string, unknown>, fs: F[] = []) => fs.every((f) => String(r[f.columnName] ?? '') === String(f.value ?? ''));
  const tbl = (n: string) => (t.tables[n] ??= []);
  let n = 0;
  return {
    ...real,
    startRun: vi.fn(async (body: Record<string, unknown>) =>
      (t.starts.push(body), t.startOk ? { ok: true, status: 202, requestId: `exec-${++n}`, etaMinutes: 5, error: null, duplicate: false, firstSeenAt: null } : { ok: false, status: t.startStatus, requestId: null, etaMinutes: null, error: 'refused', duplicate: false, firstSeenAt: null }),
    ),
    rows: vi.fn(async (table: string, q: { filters?: F[] } = {}) => tbl(table).filter((r) => match(r, q.filters))),
    siteRows: vi.fn(async (table: string, domain: string, q: { extra?: F[] } = {}) => tbl(table).filter((r) => r.domain === domain && match(r, q.extra))),
    insertRows: vi.fn(async (table: string, rows: Record<string, unknown>[]) => (tbl(table).push(...rows), true)),
    updateRows: vi.fn(async (table: string, fs: F[], data: Record<string, unknown>) => {
      for (const r of tbl(table).filter((x) => match(x, fs))) Object.assign(r, data);
      return true;
    }),
    upsertRow: vi.fn(async (table: string, fs: F[], data: Record<string, unknown>) => {
      const err = t.upsertFail?.(table, data);
      if (err) throw err;
      const r = tbl(table).find((x) => match(x, fs));
      if (r) Object.assign(r, data);
      else tbl(table).push({ ...Object.fromEntries(fs.map((f) => [f.columnName, f.value])), ...data });
    }),
    deleteRows: vi.fn(async (table: string, fs: F[]) => ((t.tables[table] = tbl(table).filter((r) => !match(r, fs))), true)),
    ensureTable: vi.fn(async () => 'tbl'),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => ({ ok: true, action: String(b.action), affected: 1, error: null })),
    assessCall: vi.fn(async (body: Record<string, unknown>) => ({ kind: 'answered', status: 200, json: { ok: true, keyword: body.keyword, country: body.country, volume: 300, kd: 20, ...t.assess }, error: null })),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { ingestCallback } = await import('../src/services/runs');
const { proposeForSite, startDueProposals } = await import('../src/services/autoStart');
const { latestPreview } = await import('../src/services/comingUp');
const { assessKeyword } = await import('../src/services/keywordChecks');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const log = { info: () => undefined, warn: () => undefined, error: () => undefined };
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));

interface Co { c: InstanceType<typeof Client>; org: { id: string }; userId: string }
async function company(email: string, name: string): Promise<Co> {
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name })).body;
  await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
  const user = (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!;
  t.mails.length = 0;
  return { c: u.c, org, userId: user.id };
}
async function site(orgId: string, domain: string, extra: Partial<typeof schema.sites.$inferInsert> = {}) {
  const [s] = await db
    .insert(schema.sites)
    .values({ orgId, domain, country: 'United States', business: 'CRM implementation for sales teams', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), ...extra })
    .returning();
  return s;
}
const orgRow = async (id: string) => (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, id) }))!;
const base = (co: Co, siteId: string) => `/api/orgs/${co.org.id}/sites/${siteId}`;
const strategy = (orgId: string, siteId: string, keywords: Record<string, unknown>[]) =>
  db.insert(schema.reports).values({ orgId, siteId, stage: 'keyword_strategy', status: 'completed', title: 'Keyword strategy', scheduled: false, payload: { country: 'United States', priority: keywords }, receivedAt: new Date(Date.now() - 2 * DAY) });

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.starts = [];
  t.startOk = true;
  t.startStatus = 503;
  t.mails = [];
  t.assess = { difficulty_for_you: 'easy', fit: 2 };
  t.upsertFail = null;
});

describe('1. one engine site id, one website', () => {
  it('adding a domain whose engine id another verified website holds is refused, both ways; an unverified, untracked one does not block', async () => {
    const a = await company('ps-eng-a@ps.test', 'Eng A');
    const b = await company('ps-eng-b@ps.test', 'Eng B');
    await site(a.org.id, 'collide.co.uk');
    const r1 = await b.c.post(`/api/orgs/${b.org.id}/sites`, { domain: 'collide-co.uk', country: 'United States' });
    expect([r1.status, r1.body.code]).toEqual([409, 'engine_id_taken']);
    expect(JSON.stringify(r1.body)).not.toMatch(/collide\.co\.uk/); // the other company's domain is never named
    await site(a.org.id, 'other-co.uk');
    const r2 = await b.c.post(`/api/orgs/${b.org.id}/sites`, { domain: 'other.co.uk', country: 'United States' });
    expect([r2.status, r2.body.code]).toEqual([409, 'engine_id_taken']);
    // a tracked (even unverified) website holds its id too
    await site(a.org.id, 'tracked.co.uk', { verifiedAt: null, trackingStatus: 'active' });
    expect((await b.c.post(`/api/orgs/${b.org.id}/sites`, { domain: 'tracked-co.uk', country: 'United States' })).body.code).toBe('engine_id_taken');
    // an unverified, untracked one does not block
    await site(a.org.id, 'idle.co.uk', { verifiedAt: null });
    expect((await b.c.post(`/api/orgs/${b.org.id}/sites`, { domain: 'idle-co.uk', country: 'United States' })).status).toBe(200);
  });

  it('verifying is refused while another website holds the id (both ways), and the database refuses a second verified one', async () => {
    const a = await company('ps-ver-a@ps.test', 'Ver A');
    const b = await company('ps-ver-b@ps.test', 'Ver B');
    const mine = await site(b.org.id, 'verify-co.uk', { verifiedAt: null });
    await site(a.org.id, 'verify.co.uk');
    const r = await b.c.post(`${base(b, mine.id)}/verify`, { method: 'dns' });
    expect([r.status, r.body.code]).toEqual([409, 'engine_id_taken']);
    const theirs = await site(a.org.id, 'flip-co.uk', { verifiedAt: null });
    await site(b.org.id, 'flip.co.uk');
    expect((await a.c.post(`${base(a, theirs.id)}/verify`, { method: 'meta' })).body.code).toBe('engine_id_taken');
    // two verifications at the same moment: the unique index decides
    await expect(db.update(schema.sites).set({ verifiedAt: new Date() }).where(eq(schema.sites.id, mine.id))).rejects.toThrow();
  });

  it('an engine row another domain holds under the same site id is never read or written (cycle, weekday, Coming up, approvals)', async () => {
    const co = await company('ps-dd@ps.test', 'Defence Co');
    const s = await site(co.org.id, 'shared.co.uk', { trackingStatus: 'active', trackingStartedAt: new Date(Date.now() - 2 * DAY), timezone: 'UTC' });
    const sid = n8nSiteId('shared.co.uk');
    const key = `cyc:${sid}:2026-10-14`;
    // the engine's rows of shared-co.uk, another website with the same id (as if verified before the guard existed)
    t.tables.cycles = [{ site_id: sid, domain: 'shared-co.uk', anchor_at: '2026-10-14T08:00:00.000Z', tz: 'UTC', cycle_weekday: 3, local_time: '06:00', monthly_day: 14, next_due_at: '2099-01-07T06:00:00.000Z', next_preview_at: '', current_key: key, status: 'active', skip_jobs: '', last_cycle_at: '2026-10-14T08:01:00.000Z', last_monthly_key: '2026-10', adopted: false, updated_at: '' }];
    t.tables.cycleJobs = [{ key: `${key}:backlinks`, site_id: sid, cycle_key: key, job: 'backlinks', status: 'done', attempts: 1, monthly: true, reason: '' }];
    t.tables.skips = [{ key: `${sid}:always:crm data migration`, site_id: sid, cycle_key: '', item_key: 'crm data migration', decision: 'skip', scope: 'always', by: 'them@other.test', created_at: new Date().toISOString() }];
    const v = (await co.c.get(`${base(co, s.id)}/cycle`)).body;
    expect(v).toMatchObject({ known: false, canChangeWeekday: false, current: null });
    const p = await co.c.patch(`${base(co, s.id)}/cycle`, { weekday: 5 });
    expect([p.status, p.body.code]).toEqual([409, 'cycle_not_started']);
    expect(t.tables.cycles[0].cycle_weekday).toBe(3); // the other website's week never moves
    const due = new Date(Date.now() + 2 * DAY).toISOString();
    const ckey = `cyc:${sid}:${due.slice(0, 10)}`;
    await db.insert(schema.cyclePreviews).values({ orgId: co.org.id, siteId: s.id, cycleKey: ckey, scheduledFor: new Date(due), body: { cycle_key: ckey, scheduled_for: due, level: 2, items: [{ item_key: 'crm data migration', keyword: 'crm data migration', source: 'trend', auto: false, est_usd: 0.8 }], suggestions: [] } });
    const view = (await co.c.get(`${base(co, s.id)}/coming-up`)).body;
    expect(view.items[0].decision).toBeNull(); // the other website's skip is not this website's
    const d = await co.c.post(`${base(co, s.id)}/coming-up/decisions`, { itemKey: 'crm data migration', decision: 'approve', scope: 'cycle' });
    expect([d.status, d.body.code]).toEqual([409, 'engine_site_conflict']);
    expect(t.tables.skips).toHaveLength(1);
  });
});

describe('8c. the engine\'s real seo_cycles row', () => {
  it('an adopted row with exactly the columns CYC.newCycleRow writes (numbers as n8n returns them) is read, and its weekday moves', async () => {
    const co = await company('ps-own@ps.test', 'Own Co');
    const s = await site(co.org.id, 'own-kf.com', { trackingStatus: 'active', trackingStartedAt: new Date('2026-10-14T08:00:00Z'), timezone: 'America/New_York' });
    const sid = n8nSiteId('own-kf.com');
    t.tables.cycles = [{ id: 7, site_id: sid, domain: 'own-kf.com', anchor_at: '2026-10-14T08:00:00.000Z', tz: 'America/New_York', cycle_weekday: 3, local_time: '06:00', monthly_day: 14, next_due_at: '2026-10-21T10:00:00.000Z', next_preview_at: '', current_key: '', status: 'active', skip_jobs: '', last_cycle_at: '', last_monthly_key: '', adopted: true, updated_at: '2026-10-14T08:00:00.000Z', createdAt: '2026-10-14T08:00:00.000Z', updatedAt: '2026-10-14T08:00:00.000Z' }];
    t.tables.cycleJobs = [];
    const v = (await co.c.get(`${base(co, s.id)}/cycle`)).body;
    expect(v).toMatchObject({ known: true, canChangeWeekday: true, weekday: 3 });
    const p = await co.c.patch(`${base(co, s.id)}/cycle`, { weekday: 5 });
    expect([p.status, p.body.weekdayName]).toEqual([200, 'Friday']);
    expect(t.tables.cycles[0].cycle_weekday).toBe(5);
  });
});

describe('2. keyword checks the system starts', () => {
  it('the queued-ladder re-check acts for the first ACTIVE owner and is filed as autopilot spend; a person\'s check stays on demand', async () => {
    const { syncCosts } = await import('../src/services/admin/costSync');
    const co = await company('ps-kc@ps.test', 'Check Co');
    // a second owner; the first one leaves (deactivated): the system never acts for them
    const second = await signUp(app, 'ps-kc-2@ps.test');
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, 'ps-kc-2@ps.test'));
    const u2 = (await db.query.users.findFirst({ where: eq(schema.users.email, 'ps-kc-2@ps.test') }))!;
    await db.insert(schema.memberships).values({ orgId: co.org.id, userId: u2.id, role: 'owner' });
    await db.update(schema.memberships).set({ deactivatedAt: new Date() }).where(and(eq(schema.memberships.orgId, co.org.id), eq(schema.memberships.userId, co.userId)));
    void second;
    const s = await site(co.org.id, 'kc-ps.com', { trackingStatus: 'active' });
    const planned = new Date(Date.now() - 70 * DAY).toISOString();
    t.tables.ladders = [
      ...(t.tables.ladders ?? []),
      { ladder_id: 'lad_kc', domain: 'kc-ps.com', head_keyword: 'crm consulting dubai', keyword: 'crm consulting dubai', rung: 4, page_no: 9, status: 'planned', start_date: planned },
    ];
    const org = await orgRow(co.org.id);
    const cadence = (queued: string[]) => ({ stage: 'content_cadence', status: 'progress', domain: 'kc-ps.com', trigger: 'cycle', queued_ladders: queued.map((ladder_id) => ({ ladder_id })), won_ladders: [] });
    await ingestCallback(org, cadence(['lad_kc']));
    await flush();
    await ingestCallback(org, cadence([]));
    await flush(300);
    const checks = await db.query.keywordChecks.findMany({ where: eq(schema.keywordChecks.siteId, s.id) });
    expect(checks.map((c) => [c.keyword, c.automatic, c.userId])).toEqual([['crm consulting dubai', true, u2.id]]);
    // the person's own check of the same website
    await assessKeyword({ org, site: s, user: u2 }, { keyword: 'crm training dubai' }, { acknowledge: ['market.keyword_place:crm training dubai:US'] });   // MKT: a Dubai keyword on a US website is asked first
    await syncCosts({ readLedger: async () => [], full: true });
    const events = await db.query.costEvents.findMany({ where: and(eq(schema.costEvents.orgId, co.org.id), eq(schema.costEvents.source, 'keyword_check')) });
    const originOf = (id: string) => events.find((e) => e.eventKey === `kc:${id}`)?.origin;
    const mine = (await db.query.keywordChecks.findMany({ where: eq(schema.keywordChecks.siteId, s.id) })).find((c) => !c.automatic)!;
    expect([originOf(checks[0].id), originOf(mine.id)]).toEqual(['schedule', 'app']);
  });
});

describe('3. a proposal whose ladder run failed', () => {
  it('approve with a run the engine refused: failed with a note, and the keyword can be proposed again (twice at most)', async () => {
    const co = await company('ps-fail@ps.test', 'Fail Co');
    const s = await site(co.org.id, 'fail-ps.com', { trackingStatus: 'active', autopilotLevel: 2 });
    await strategy(co.org.id, s.id, [{ keyword: 'crm consulting', difficulty_for_you: 'easy', plan_type: 'direct' }]);
    const org = await orgRow(co.org.id);
    await proposeForSite(org, s, undefined, Date.now(), log);
    const id = (await co.c.get(`${base(co, s.id)}/keyword-proposals`)).body.pending[0].id;
    t.startOk = false;
    t.startStatus = 400;
    // MKT D1 (2026-10-27): the first click asks (a new ladder, its page now, the quote); the answer starts it
    const ask = await co.c.post(`${base(co, s.id)}/keyword-proposals/${id}/approve`);
    expect([ask.status, ask.body.needsAcknowledge]).toEqual([409, ['money.new_ladder:crm consulting']]);
    const ap = await co.c.post(`${base(co, s.id)}/keyword-proposals/${id}/approve`, { acknowledge: ask.body.needsAcknowledge });
    expect(ap.status).toBe(200);
    expect(ap.body.proposal).toMatchObject({ keyword: 'crm consulting', status: 'failed' });
    expect(ap.body.proposal.note).toMatch(/did not start.*can be proposed again/);
    t.startOk = true;
    const again = await proposeForSite(org, s, undefined, Date.now(), log);
    expect(again).toMatchObject({ keyword: 'crm consulting' });
    expect(again.proposalId).not.toBeNull();
  });

  it('a claim found after a crash whose run failed is recorded as failed, not as started', async () => {
    const co = await company('ps-stale@ps.test', 'Stale Co');
    const s = await site(co.org.id, 'stale-ps.com', { trackingStatus: 'active', autopilotLevel: 3 });
    const [p] = await db.insert(schema.keywordProposals).values({ orgId: co.org.id, siteId: s.id, keyword: 'crm audit', keywordNorm: 'crm audit', status: 'starting', level: 3, claimedAt: new Date(Date.now() - 60 * 60_000) }).returning();
    await db.insert(schema.runs).values({ orgId: co.org.id, siteId: s.id, mode: 'ladder', title: 'x', status: 'failed', error: 'refused', input: { proposalId: p.id, chosenBy: 'system_announced', keyword: 'crm audit' } });
    await startDueProposals(log);
    const after = (await db.query.keywordProposals.findFirst({ where: eq(schema.keywordProposals.id, p.id) }))!;
    expect(after.status).toBe('failed');
    expect(after.note).toMatch(/did not start/);
  });
});

describe('4. the free research at setup', () => {
  it('a start with no answer or a 5xx keeps the grant used; only a 4xx gives it back', async () => {
    const co = await company('ps-res@ps.test', 'Res Co');
    const s = await site(co.org.id, 'res5xx-ps.com');
    t.startOk = false;
    t.startStatus = 503;
    expect((await co.c.post(`${base(co, s.id)}/research/start`)).body).toMatchObject({ started: false });
    expect(await db.query.freeResearchGrants.findFirst({ where: eq(schema.freeResearchGrants.domain, 'res5xx-ps.com') })).toBeTruthy();
    t.startOk = true;
    expect((await co.c.post(`${base(co, s.id)}/research/start`)).body.code).toBe('research_not_free');
    const s0 = await site(co.org.id, 'res0-ps.com');
    t.startOk = false;
    t.startStatus = 0; // the 30 s timeout: the engine may be working on it
    await co.c.post(`${base(co, s0.id)}/research/start`);
    expect(await db.query.freeResearchGrants.findFirst({ where: eq(schema.freeResearchGrants.domain, 'res0-ps.com') })).toBeTruthy();
  });

  it('one free research per registrable domain: a subdomain (any company) gets none; a grant stored by the full domain still counts', async () => {
    const a = await company('ps-reg-a@ps.test', 'Reg A');
    const b = await company('ps-reg-b@ps.test', 'Reg B');
    const s = await site(a.org.id, 'reg-ps.com');
    expect((await a.c.post(`${base(a, s.id)}/research/start`)).body).toMatchObject({ free: true, started: true });
    expect((await db.query.freeResearchGrants.findFirst({ where: eq(schema.freeResearchGrants.domain, 'reg-ps.com') }))?.siteId).toBe(s.id);
    const sub = await site(b.org.id, 'blog.reg-ps.com');
    expect((await b.c.post(`${base(b, sub.id)}/research/start`)).body.code).toBe('research_not_free');
    await db.insert(schema.freeResearchGrants).values({ domain: 'shop.legacy-ps.com', orgId: a.org.id });
    const legacy = await site(a.org.id, 'shop.legacy-ps.com');
    expect((await a.c.post(`${base(a, legacy.id)}/research/start`)).body.code).toBe('research_not_free');
  });
});

describe('5. a "Coming up" plan without a due time', () => {
  it('is refused (never stored), and an old one without a due time never pins Coming up ahead of the real next plan', async () => {
    const co = await company('ps-prev@ps.test', 'Prev Co');
    const s = await site(co.org.id, 'prev-ps.com', { trackingStatus: 'active' });
    const sid = n8nSiteId('prev-ps.com');
    const org = await orgRow(co.org.id);
    const plan = (cycleKey: string, scheduledFor: string) => ({ stage: 'cycle_preview', status: 'progress', request_id: `cyc_prev_${cycleKey.slice(-10)}_preview`, trigger: 'cycle', site_id: sid, domain: 'prev-ps.com', cycle_key: cycleKey, scheduled_for: scheduledFor, level: 2, items: [], suggestions: [] });
    await ingestCallback(org, plan(`cyc:${sid}:2026-11-04`, ''));
    await flush();
    expect(await db.query.cyclePreviews.findMany({ where: eq(schema.cyclePreviews.siteId, s.id) })).toEqual([]);
    // a plan for another domain under the same id is refused too
    await ingestCallback(org, { ...plan(`cyc:${sid}:2026-11-04`, new Date(Date.now() + DAY).toISOString()), domain: 'prev-ps-other.com' });
    await flush();
    expect(await db.query.cyclePreviews.findMany({ where: eq(schema.cyclePreviews.siteId, s.id) })).toEqual([]);
    // a row kept before the rule (no due time) and the real next plan: the real one is the latest
    await db.insert(schema.cyclePreviews).values({ orgId: co.org.id, siteId: s.id, cycleKey: `cyc:${sid}:2026-10-01`, scheduledFor: null, body: {}, receivedAt: new Date() });
    const due = new Date(Date.now() + 2 * DAY).toISOString();
    await ingestCallback(org, plan(`cyc:${sid}:${due.slice(0, 10)}`, due));
    await flush();
    expect((await latestPreview(s.id))?.cycleKey).toBe(`cyc:${sid}:${due.slice(0, 10)}`);
  });
});

describe('6. level-3 announcements', () => {
  it('a new start time after a level change is announced again, and the time is in the website\'s own zone', async () => {
    const co = await company('ps-ann@ps.test', 'Ann Co');
    const s = await site(co.org.id, 'ann-ps.com', { trackingStatus: 'active', autopilotLevel: 2, timezone: 'Asia/Dubai' });
    await strategy(co.org.id, s.id, [{ keyword: 'crm consulting', difficulty_for_you: 'easy', plan_type: 'direct' }]);
    await proposeForSite(await orgRow(co.org.id), s, undefined, Date.now(), log);
    await co.c.patch(`${base(co, s.id)}/automation`, { autopilotLevel: 3 });
    await flush(100);
    expect(t.mails.map((m) => m.subject)).toEqual(['We will start "crm consulting" for ann-ps.com']);
    expect(t.mails[0].lines.join(' ')).toMatch(/at \d\d:\d\d \(Dubai time\)/);
    expect(t.mails[0].lines.join(' ')).not.toMatch(/UTC/);
    await co.c.patch(`${base(co, s.id)}/automation`, { autopilotLevel: 1 });
    await flush(100);
    await co.c.patch(`${base(co, s.id)}/automation`, { autopilotLevel: 3 });
    await flush(100);
    expect(t.mails.map((m) => m.subject)).toEqual(['We will start "crm consulting" for ann-ps.com', 'We will start "crm consulting" for ann-ps.com']);
  });
});

describe('7. the auto-pause when the engine write fails', () => {
  it('the rejection is not stored, so the retry drops the level (it is never lost behind a stored rejection)', async () => {
    const co = await company('ps-pause@ps.test', 'Pause Co');
    const s = await site(co.org.id, 'pause-ps.com', { autopilotLevel: 3 });
    t.tables.contentLog = [
      ...(t.tables.contentLog ?? []),
      ...['a', 'b'].map((k, i) => ({ domain: 'pause-ps.com', keyword: `auto page ${k}`, source: 'decay', request_id: `cad_20261014_p_${i + 1}`, started_at: new Date(Date.now() - (i + 1) * DAY).toISOString(), status: 'written' })),
    ];
    const page = async (keyword: string, requestId: string) =>
      (await db.insert(schema.reports).values({ orgId: co.org.id, siteId: s.id, stage: 'content', status: 'completed', title: keyword, requestId, scheduled: true, payload: { keyword, request_id: requestId } }).returning())[0];
    const p1 = await page('auto page a', 'cad_20261014_p_1');
    const p2 = await page('auto page b', 'cad_20261014_p_2');
    const send = (id: string) => co.c.post(`/api/orgs/${co.org.id}/reports/${id}/feedback`, { verdict: 'reject' });
    expect((await send(p1.id)).body).toMatchObject({ levelDropped: false });
    t.upsertFail = (table) => (table === 'ladderSettings' ? new Error('n8n is down') : null);
    const failed = await send(p2.id);
    expect([failed.status, failed.body.code]).toEqual([502, 'engine_failed']);
    expect(await db.query.contentFeedback.findFirst({ where: eq(schema.contentFeedback.reportId, p2.id) })).toBeUndefined();
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, s.id) }))!.autopilotLevel).toBe(3);
    t.upsertFail = null;
    expect((await send(p2.id)).body).toMatchObject({ levelDropped: true, level: 1 });
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, s.id) }))!.autopilotLevel).toBe(1);
    expect(t.tables.ladderSettings.find((x) => x.domain === 'pause-ps.com' && x.ladder_id === '_site')).toMatchObject({ autopilot_level: 1 });
  });
});

describe('8. onboarding, source, proposal details', () => {
  it('a: the server stores the "keyword" onboarding step', async () => {
    const co = await company('ps-onb@ps.test', 'Onb Co');
    const r = await co.c.patch(`/api/orgs/${co.org.id}/onboarding`, { step: 'keyword' });
    expect(r.status).toBe(200);
    expect((await orgRow(co.org.id)).onboardingStep).toBe('keyword');
  });

  it('b: a keyword run keeps where the suggestion came from on the content log; the engine is not sent a field it does not read', async () => {
    const co = await company('ps-src@ps.test', 'Src Co');
    const s = await site(co.org.id, 'src-ps.com');
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'keyword', siteId: s.id, keyword: 'best crm consultants dubai', country: 'United States', source: 'ai_answer', acknowledge: ['market.keyword_place:best crm consultants dubai:US', 'content.not_ready:author_name,author_job_title,author_bio,business_facts'] });
    expect(r.status).toBe(200);
    expect(t.tables.contentLog.find((x) => x.domain === 'src-ps.com')).toMatchObject({ keyword: 'best crm consultants dubai', source: 'ai_answer' });
    expect('source' in t.starts.at(-1)!).toBe(false);
    expect((await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'keyword', siteId: s.id, keyword: 'crm audit', country: 'United States', source: 'made_up' })).status).toBe(400);
  });

  it('d: every proposal stores volume, difficultyForYou and planType (null when the research did not say)', async () => {
    const co = await company('ps-det@ps.test', 'Det Co');
    const s = await site(co.org.id, 'det-ps.com', { trackingStatus: 'active' });
    await strategy(co.org.id, s.id, [{ keyword: 'crm consulting', difficulty_for_you: 'easy', plan_type: 'direct' }]);
    await proposeForSite(await orgRow(co.org.id), s, undefined, Date.now(), log);
    const p = (await db.query.keywordProposals.findFirst({ where: eq(schema.keywordProposals.siteId, s.id) }))!;
    for (const k of ['volume', 'difficultyForYou', 'planType', 'months', 'why']) expect(Object.keys(p.details)).toContain(k);
    expect(p.details).toMatchObject({ difficultyForYou: 'easy', planType: 'direct' });
  });
});

describe('9. the engine without seo_ladder_settings.autopilot_level', () => {
  it('PATCH automation answers a clear 503 and changes nothing; another refusal is not mistaken for it', async () => {
    const { missingLevelColumn } = await import('../src/services/ladderSettings');
    const { EngineWriteError } = await import('../src/n8n/client');
    const co = await company('ps-col@ps.test', 'Col Co');
    const s = await site(co.org.id, 'col-ps.com', { autopilotLevel: 2 });
    t.upsertFail = (table, data) => (table === 'ladderSettings' && 'autopilot_level' in data ? new EngineWriteError('rows/upsert answered 400', 400, "unknown column name 'autopilot_level'", 'seo_ladder_settings') : null);
    const r = await co.c.patch(`${base(co, s.id)}/automation`, { autopilotLevel: 3 });
    expect([r.status, r.body.code]).toEqual([503, 'engine_not_ready']);
    expect(JSON.stringify(r.body)).not.toMatch(/autopilot_level|column|seo_/);
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, s.id) }))!.autopilotLevel).toBe(2);
    expect(missingLevelColumn(new EngineWriteError('x', 400, 'unknown column', 't'), { autopilot_level: 1 })).toBe(true);
    expect(missingLevelColumn(new EngineWriteError('x', 500, 'unknown column', 't'), { autopilot_level: 1 })).toBe(false);
    expect(missingLevelColumn(new EngineWriteError('x', 400, 'unknown column', 't'), { mode: 'auto' })).toBe(false);
    expect(missingLevelColumn(new Error('unknown column'), { autopilot_level: 1 })).toBe(false);
  });
});

// ======================================================================================================================================
// The app half of F-KW (2026-10-20): the engine's keyword-first review fixes, mirrored and acted on by the app
// ======================================================================================================================================

describe('F-KW 2. the fresh keyword check of an old plan', () => {
  const ladder = (domain: string, planned: string) => [
    { ladder_id: 'lad_old', domain, head_keyword: 'crm consulting dubai', keyword: 'crm consulting dubai', rung: 4, page_no: 9, status: 'planned', start_date: planned },
    { ladder_id: 'lad_old', domain, head_keyword: 'crm consulting dubai', keyword: 'crm consulting cost', rung: 1, page_no: 1, status: 'planned', start_date: planned },
  ];
  const cadence = (domain: string, extra: Record<string, unknown>) => ({ stage: 'content_cadence', status: 'progress', domain, trigger: 'cycle', queued_ladders: [], won_ladders: [], ...extra });

  it('a ladder active all along that the cadence lists in recheck_ladders is checked; a pass writes rechecked_at, nothing is paused', async () => {
    const co = await company('fkw-rc1@ps.test', 'Recheck One');
    const s = await site(co.org.id, 'rc1-ps.com', { trackingStatus: 'active' });
    t.tables.ladders = [...(t.tables.ladders ?? []), ...ladder('rc1-ps.com', new Date(Date.now() - 70 * DAY).toISOString())];
    const org = await orgRow(co.org.id);
    // never in a queued list: the old trigger (the queued-list diff) never fired for it
    await ingestCallback(org, cadence('rc1-ps.com', { recheck_ladders: [{ ladder_id: 'lad_old', head: 'crm consulting dubai', planned_at: '', reason: 'checking this keyword again before writing' }] }));
    await flush(300);
    const rows = await db.query.ladderRechecks.findMany({ where: eq(schema.ladderRechecks.siteId, s.id) });
    expect(rows.map((r) => [r.ladderId, r.status, r.paused])).toEqual([['lad_old', 'done', false]]);
    const st = t.tables.ladderSettings.find((r) => r.ladder_id === 'lad_old' && r.domain === 'rc1-ps.com')!;
    expect(Date.parse(String(st.rechecked_at))).toBeGreaterThan(Date.now() - 60_000);
    expect(st.status).not.toBe('paused');
    const check = (await db.query.keywordChecks.findMany({ where: eq(schema.keywordChecks.siteId, s.id) }))[0];
    expect(check.automatic).toBe(true);
  });

  it('a check that fell pauses the ladder and writes no rechecked_at; a check that failed to run is tried again on the next plan', async () => {
    const co = await company('fkw-rc2@ps.test', 'Recheck Two');
    const s = await site(co.org.id, 'rc2-ps.com', { trackingStatus: 'active' });
    t.tables.ladders = [...(t.tables.ladders ?? []), ...ladder('rc2-ps.com', new Date(Date.now() - 70 * DAY).toISOString())];
    const org = await orgRow(co.org.id);
    const list = { recheck_ladders: [{ ladder_id: 'lad_old', head: 'crm consulting dubai' }] };
    // the engine cannot be reached: the check failed to run
    const { assessCall } = await import('../src/n8n/client');
    vi.mocked(assessCall).mockResolvedValueOnce({ kind: 'unreachable', status: 0, json: {}, error: 'down' });
    await ingestCallback(org, cadence('rc2-ps.com', list));
    await flush(300);
    expect((await db.query.ladderRechecks.findMany({ where: eq(schema.ladderRechecks.siteId, s.id) })).map((r) => r.status)).toEqual(['failed']);
    // the next plan: it runs again, and this time the keyword fell
    t.assess = { difficulty_for_you: 'not_realistic', fit: 2 };
    await ingestCallback(org, { ...cadence('rc2-ps.com', list), stage: 'cycle_preview', cycle_key: `cyc:${n8nSiteId('rc2-ps.com')}:2026-11-04`, scheduled_for: new Date(Date.now() + 2 * DAY).toISOString(), items: [], suggestions: [] });
    await flush(300);
    const rows = await db.query.ladderRechecks.findMany({ where: eq(schema.ladderRechecks.siteId, s.id) });
    expect(rows.map((r) => [r.status, r.paused])).toEqual([['done', true]]);
    const st = t.tables.ladderSettings.find((r) => r.ladder_id === 'lad_old' && r.domain === 'rc2-ps.com')!;
    expect([st.status, st.rechecked_at ?? '']).toEqual(['paused', '']);
  });
});

describe('F-KW 3. "Not what I wanted" on page 2 of a ladder start', () => {
  it('finds the page\'s own content-log row by request id AND keyword (pages of one start share the request id)', async () => {
    const co = await company('fkw-rid@ps.test', 'Rid Co');
    const s = await site(co.org.id, 'rid-ps.com', { autopilotLevel: 3 });
    const rid = 'cad_20261021_rid-ps-com_1';
    t.tables.contentLog = [
      ...(t.tables.contentLog ?? []),
      { domain: 'rid-ps.com', keyword: 'crm consulting cost', source: 'ladder', request_id: rid, started_at: new Date(Date.now() - DAY).toISOString(), status: 'written' },
      { domain: 'rid-ps.com', keyword: 'crm adoption tips', source: 'decay', request_id: rid, started_at: new Date(Date.now() - DAY).toISOString(), status: 'written' },
    ];
    const [rep] = await db.insert(schema.reports).values({ orgId: co.org.id, siteId: s.id, stage: 'content', status: 'completed', title: 'x', requestId: rid, scheduled: true, payload: { keyword: 'crm adoption tips', request_id: rid } }).returning();
    expect((await co.c.post(`/api/orgs/${co.org.id}/reports/${rep.id}/feedback`, { verdict: 'reject' })).status).toBe(200);
    const fb = (await db.query.contentFeedback.findFirst({ where: eq(schema.contentFeedback.reportId, rep.id) }))!;
    // the decay refresh the autopilot chose, not the ladder page that shares its request id
    expect([fb.source, fb.automatic]).toEqual(['decay', true]);
  });
});

describe('F-KW 4 and 5. Coming up: approvals per item, what was not written, pages checked again', () => {
  it('an approval writes the item\'s source and ladder on its seo_skips row; a skip names only the keyword', async () => {
    const co = await company('fkw-ap@ps.test', 'Approve Co');
    const s = await site(co.org.id, 'ap-ps.com', { trackingStatus: 'active' });
    const sid = n8nSiteId('ap-ps.com');
    const due = new Date(Date.now() + 2 * DAY).toISOString();
    const ckey = `cyc:${sid}:${due.slice(0, 10)}`;
    await db.insert(schema.cyclePreviews).values({
      orgId: co.org.id,
      siteId: s.id,
      cycleKey: ckey,
      scheduledFor: new Date(due),
      body: {
        cycle_key: ckey,
        scheduled_for: due,
        level: 1,
        items: [{ item_key: 'crm data migration', keyword: 'crm data migration', source: 'ladder', ladder_id: 'lad_2', auto: false, est_usd: 0.8 }],
        suggestions: [{ item_key: 'crm adoption tips', keyword: 'crm adoption tips', source: 'trend', ladder_id: '', auto: false, est_usd: 0.8 }],
      },
    });
    await co.c.post(`${base(co, s.id)}/coming-up/decisions`, { itemKey: 'crm data migration', decision: 'approve', scope: 'cycle' });
    await co.c.post(`${base(co, s.id)}/coming-up/decisions`, { itemKey: 'crm adoption tips', decision: 'skip', scope: 'cycle' });
    const rows = (t.tables.skips ?? []).filter((r) => r.site_id === sid);
    expect(rows.find((r) => r.item_key === 'crm data migration')).toMatchObject({ decision: 'approve', source: 'ladder', ladder_id: 'lad_2' });
    expect(rows.find((r) => r.item_key === 'crm adoption tips')).toMatchObject({ decision: 'skip', source: '', ladder_id: '' });
  });

  it('a plan\'s approvals not written (ambiguous explained), its pages waiting for a fresh check, and its budget reach the view', async () => {
    const co = await company('fkw-view@ps.test', 'View Co');
    const s = await site(co.org.id, 'view-ps.com', { trackingStatus: 'active' });
    const sid = n8nSiteId('view-ps.com');
    const due = new Date(Date.now() + 2 * DAY).toISOString();
    const ckey = `cyc:${sid}:${due.slice(0, 10)}`;
    const org = await orgRow(co.org.id);
    await ingestCallback(org, {
      stage: 'cycle_preview',
      status: 'progress',
      request_id: `cyc_view-ps-com_${due.slice(0, 10).replace(/-/g, '')}_preview`,
      trigger: 'cycle',
      site_id: sid,
      domain: 'view-ps.com',
      cycle_key: ckey,
      scheduled_for: due,
      level: 2,
      pages_per_week: 1,
      items: [{ item_key: 'crm consulting cost', keyword: 'crm consulting cost', source: 'ladder', ladder_id: 'lad_old', rung: 1, why: 'checking this keyword again before writing: it was planned more than 60 days ago', auto: false, est_usd: 0.84 }],
      suggestions: [],
      recheck_ladders: [{ ladder_id: 'lad_old', head: 'crm consulting dubai', planned_at: '2026-08-01T00:00:00.000Z', reason: 'checking this keyword again before writing' }],
      approved_not_written: [{ keyword: 'crm implementation partner uae', source: '', reason: 'ambiguous', detail: 'your approval names only the keyword, and 2 different pages share it (decay, striking): approve the one you want again' }],
      budget: { pages_per_week: 1, spent: 1, room: 0, window_start: due, ladder_start_window: new Date(Date.now() - 5 * DAY).toISOString(), spent_keywords: [] },
    });
    await flush();
    const v = (await co.c.get(`${base(co, s.id)}/coming-up`)).body;
    expect(v.items[0]).toMatchObject({ keyword: 'crm consulting cost', recheck: true, canApprove: false });
    expect(v.recheckLadders).toEqual([{ ladderId: 'lad_old', head: 'crm consulting dubai', plannedAt: '2026-08-01T00:00:00.000Z' }]);
    expect(v.approvedNotWritten).toEqual([{ keyword: 'crm implementation partner uae', reason: 'ambiguous', message: expect.stringMatching(/2 different pages share this search.*Approve the one you want again/) }]);
    expect(JSON.stringify(v.approvedNotWritten)).not.toMatch(/decay|striking|—|…/);
    expect(v.budget).toMatchObject({ pagesPerWeek: 1, spent: 1, room: 0 });
    expect(Date.parse(v.budget.ladderStartWindow)).toBeLessThan(Date.now());
  });
});
