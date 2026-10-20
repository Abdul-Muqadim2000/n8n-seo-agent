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
const { EngineWriteError } = await import('../src/n8n/client');
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
