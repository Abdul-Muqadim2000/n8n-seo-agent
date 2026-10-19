import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { n8nSiteId } from '@seo/shared';

// Keyword-first autopilot and the website's own cycle, end to end on a real Postgres (PGlite, every migration) with the engine replaced by an
// in-memory Data Table store (SCHEDULING_KEYWORDS_PLAN.md §5, §14.6): the run bodies (track, ladder, discover), the free research at setup,
// the cycle view and the weekday, the "Coming up" plan and its decisions, the autopilot level, cycle callbacks filed as scheduled reports,
// "Not what I wanted" and the auto-pause, and the roles of every new route.

const t = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  starts: [] as Record<string, unknown>[],
  startOk: true,
  mails: [] as { to: string; subject: string; lines: string[] }[],
  assess: { difficulty_for_you: 'easy', fit: 2 } as Record<string, unknown>,
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
    startRun: vi.fn(async (body: Record<string, unknown>) => (t.starts.push(body), t.startOk ? { ok: true, status: 202, requestId: `exec-${++n}`, etaMinutes: 5, error: null, duplicate: false, firstSeenAt: null } : { ok: false, status: 503, requestId: null, etaMinutes: null, error: 'down', duplicate: false, firstSeenAt: null })),
    rows: vi.fn(async (table: string, q: { filters?: F[] } = {}) => tbl(table).filter((r) => match(r, q.filters))),
    siteRows: vi.fn(async (table: string, domain: string, q: { extra?: F[] } = {}) => tbl(table).filter((r) => r.domain === domain && match(r, q.extra))),
    insertRows: vi.fn(async (table: string, rows: Record<string, unknown>[]) => (tbl(table).push(...rows), true)),
    updateRows: vi.fn(async (table: string, fs: F[], data: Record<string, unknown>) => {
      const hit = tbl(table).filter((r) => match(r, fs));
      for (const r of hit) Object.assign(r, data);
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
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => ({ ok: true, action: String(b.action), affected: 1, error: null })),
    assessCall: vi.fn(async (body: Record<string, unknown>) => ({ kind: 'answered', status: 200, json: { ok: true, keyword: body.keyword, country: body.country, volume: 300, kd: 20, ...t.assess }, error: null })),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { ingestCallback } = await import('../src/services/runs');
const { startDueProposals, proposeForSite } = await import('../src/services/autoStart');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const log = { info: () => undefined, warn: () => undefined, error: () => undefined };
const flush = () => new Promise((r) => setTimeout(r, 30));

interface Co { c: InstanceType<typeof Client>; org: { id: string; hookToken?: string }; userId: string }
async function company(email: string, name: string): Promise<Co> {
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name })).body;
  await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
  const user = (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!;
  t.mails.length = 0; // the sign-up's own e-mail is not what these tests look at
  return { c: u.c, org, userId: user.id };
}
async function member(co: Co, email: string, role: 'member' | 'viewer' | 'admin') {
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const user = (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!;
  await db.insert(schema.memberships).values({ orgId: co.org.id, userId: user.id, role });
  t.mails = t.mails.filter((m) => !/^Confirm your e-mail/.test(m.subject));
  return u.c;
}
async function site(orgId: string, domain: string, extra: Partial<typeof schema.sites.$inferInsert> = {}) {
  const [s] = await db
    .insert(schema.sites)
    .values({ orgId, domain, country: 'United States', business: 'CRM implementation for sales teams', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), ...extra })
    .returning();
  return s;
}
const hookOf = async (orgId: string) => (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) }))!;
const base = (co: Co, siteId: string) => `/api/orgs/${co.org.id}/sites/${siteId}`;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.starts = [];
  t.startOk = true;
  t.mails = [];
});

describe('runs: what the app sends the engine', () => {
  it('track: the time zone, what the website sells and the first tracking moment (kept on every re-save); the website keeps them', async () => {
    const co = await company('track@kf.test', 'Track Co');
    const s = await site(co.org.id, 'track-kf.com');
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'track', siteId: s.id, country: 'United States', timezone: 'Asia/Dubai', services: ['CRM implementation', 'CRM training'], blogsPerWeek: 1 });
    expect(r.status).toBe(200);
    const body = t.starts.at(-1)!;
    expect(body).toMatchObject({ mode: 'track', timezone: 'Asia/Dubai', services: ['CRM implementation', 'CRM training'], blogs_per_week: 1 });
    expect(Date.parse(String(body.tracking_started_at))).toBeGreaterThan(Date.now() - 60_000);
    const after = (await db.query.sites.findFirst({ where: eq(schema.sites.id, s.id) }))!;
    expect([after.timezone, after.services, after.trackingStatus, after.trackingStartedAt?.toISOString()]).toEqual(['Asia/Dubai', ['CRM implementation', 'CRM training'], 'active', body.tracking_started_at]);
    // a re-save keeps the anchor (the cycle never moves) and the stored zone and services when none are sent
    await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'track', siteId: s.id, country: 'United States' });
    expect(t.starts.at(-1)).toMatchObject({ tracking_started_at: body.tracking_started_at, timezone: 'Asia/Dubai', services: ['CRM implementation', 'CRM training'] });
    // an unknown zone is refused before anything starts
    expect((await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'track', siteId: s.id, country: 'United States', timezone: 'Mars/Olympus' })).status).toBe(400);
  });

  it('ladder: chosen_by (typed by default, picked when said, never "announced" from a person) and the start mode for admins', async () => {
    const co = await company('ladder@kf.test', 'Ladder Co');
    const s = await site(co.org.id, 'ladder-kf.com');
    const run = (o: Record<string, unknown>) => co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'ladder', siteId: s.id, keyword: 'crm consulting', country: 'United States', ...o });
    await run({});
    expect(t.starts.at(-1)).toMatchObject({ mode: 'ladder', chosen_by: 'client_typed' });
    expect(t.starts.at(-1)).not.toHaveProperty('ladder_mode');
    await run({ keyword: 'crm partner', chosenBy: 'client_picked', ladderMode: 'manual' });
    expect(t.starts.at(-1)).toMatchObject({ chosen_by: 'client_picked', ladder_mode: 'manual' });
    await run({ keyword: 'crm agency', chosenBy: 'system_announced', ladderPrefs: { mode: 'auto' } });
    expect(t.starts.at(-1)).toMatchObject({ chosen_by: 'client_typed', ladder_mode: 'auto' });
    // a member's start mode is a ladder setting: dropped (the website's default applies)
    const m = await member(co, 'ladder-member@kf.test', 'member');
    await m.post(`/api/orgs/${co.org.id}/runs`, { mode: 'ladder', siteId: s.id, keyword: 'crm services', country: 'United States', ladderMode: 'manual' });
    expect(t.starts.at(-1)).not.toHaveProperty('ladder_mode');
  });

  it('discover from the app never asks for a page on its own pick, whatever the caller sends', async () => {
    const co = await company('disc@kf.test', 'Disc Co');
    const s = await site(co.org.id, 'disc-kf.com');
    await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'discover', siteId: s.id, country: 'United States', receiveContent: true });
    expect(t.starts.at(-1)).toMatchObject({ mode: 'discover', receive: ['Keyword Report'] });
    const run = await db.query.runs.findFirst({ where: and(eq(schema.runs.siteId, s.id), eq(schema.runs.mode, 'discover')) });
    expect((run!.input as Record<string, unknown>).receiveContent).toBe(false);
  });
});

describe('the free keyword research at setup (D3)', () => {
  it('once per website, keyed by the domain; running research is answered as running; later research is paid (409 with its price)', async () => {
    const co = await company('research@kf.test', 'Research Co');
    const s = await site(co.org.id, 'research-kf.com');
    const r = await co.c.post(`${base(co, s.id)}/research/start`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'running', free: true, started: true });
    const run = (await db.query.runs.findFirst({ where: eq(schema.runs.id, r.body.runId) }))!;
    // quoted 0: the cost sync never charges a run beyond its quote
    expect([run.mode, run.quotedCredits, (run.input as Record<string, unknown>).freeResearch]).toEqual(['discover', 0, true]);
    expect(t.starts.at(-1)).toMatchObject({ mode: 'discover', receive: ['Keyword Report'] });
    // asked again while it runs: the same run, nothing new
    const again = await co.c.post(`${base(co, s.id)}/research/start`);
    expect(again.body).toMatchObject({ status: 'running', runId: r.body.runId, started: false });
    expect(t.starts).toHaveLength(1);
    const rec = await co.c.get(`${base(co, s.id)}/keywords/recommended`);
    expect(rec.body).toMatchObject({ status: 'running', runId: r.body.runId, freeResearch: false });
    // the run finished without a strategy: the free one is used; deleting the website and adding it again earns no second one
    await db.update(schema.runs).set({ status: 'completed' }).where(eq(schema.runs.id, r.body.runId));
    const paid = await co.c.post(`${base(co, s.id)}/research/start`);
    expect([paid.status, paid.body.code, typeof paid.body.credits]).toEqual([409, 'research_not_free', 'number']);
    await db.delete(schema.sites).where(eq(schema.sites.id, s.id));
    const s2 = await site(co.org.id, 'research-kf.com');
    expect((await co.c.post(`${base(co, s2.id)}/research/start`)).body.code).toBe('research_not_free');
  });

  it('a request the engine refused gives the grant back; only at setup; viewers cannot start it', async () => {
    const co = await company('research2@kf.test', 'Research Two');
    const s = await site(co.org.id, 'research2-kf.com');
    t.startOk = false;
    const r = await co.c.post(`${base(co, s.id)}/research/start`);
    expect(r.body).toMatchObject({ status: 'none', free: true, started: false });
    expect(await db.query.freeResearchGrants.findFirst({ where: eq(schema.freeResearchGrants.domain, 'research2-kf.com') })).toBeUndefined();
    t.startOk = true;
    // tracking started three days ago: not setup any more
    const old = await site(co.org.id, 'research3-kf.com', { trackingStatus: 'active', trackingStartedAt: new Date(Date.now() - 3 * DAY) });
    expect((await co.c.post(`${base(co, old.id)}/research/start`)).body.code).toBe('research_not_free');
    const v = await member(co, 'research-viewer@kf.test', 'viewer');
    expect((await v.post(`${base(co, s.id)}/research/start`)).status).toBe(403);
  });
});

describe('the cycle of a website', () => {
  it('before the engine has a row: when it will run (from the app\'s anchor); the weekday cannot change yet (409)', async () => {
    const co = await company('cycle@kf.test', 'Cycle Co');
    const s = await site(co.org.id, 'cycle-kf.com', { trackingStatus: 'active', trackingStartedAt: new Date('2026-10-14T08:00:00Z'), timezone: 'Asia/Dubai' });
    const v = (await co.c.get(`${base(co, s.id)}/cycle`)).body;
    expect(v).toMatchObject({ known: false, status: 'active', timezone: 'Asia/Dubai', weekday: 3, weekdayName: 'Wednesday', localTime: '06:00', canChangeWeekday: true });
    expect(v.upcoming.length).toBe(5);
    expect(v.upcoming.every((c: { at: string }) => new Date(c.at).getUTCHours() === 2)).toBe(true); // 06:00 in Dubai
    expect((await co.c.patch(`${base(co, s.id)}/cycle`, { weekday: 5 })).status).toBe(409);
  });

  it('with the engine\'s row: its jobs in order with customer reasons; PATCH writes only cycle_weekday; admins only', async () => {
    const co = await company('cycle2@kf.test', 'Cycle Two');
    const s = await site(co.org.id, 'cycle2-kf.com', { trackingStatus: 'active', trackingStartedAt: new Date('2026-10-14T08:00:00Z'), timezone: 'UTC' });
    const sid = n8nSiteId('cycle2-kf.com');
    t.tables.cycles = [{ site_id: sid, domain: 'cycle2-kf.com', anchor_at: '2026-10-14T08:00:00.000Z', tz: 'UTC', cycle_weekday: 3, local_time: '06:00', monthly_day: 14, next_due_at: '2099-01-07T06:00:00.000Z', next_preview_at: '', current_key: `cyc:${sid}:2026-10-14`, status: 'active', skip_jobs: 'site_tracker', last_cycle_at: '2026-10-14T08:01:00.000Z', last_monthly_key: '2026-10', adopted: false, updated_at: '' }];
    const key = `cyc:${sid}:2026-10-14`;
    t.tables.cycleJobs = [
      { key: `${key}:cycle`, site_id: sid, cycle_key: key, job: 'cycle', status: 'running', monthly: true, reason: 'cycle 0' },
      { key: `${key}:backlinks`, site_id: sid, cycle_key: key, job: 'backlinks', status: 'done', attempts: 1, monthly: true, reason: 'finished: its ledger row cycle:x settled (execution 812)', due_at: '2026-10-14T08:00:00.000Z' },
      { key: `${key}:ai_visibility`, site_id: sid, cycle_key: key, job: 'ai_visibility', status: 'gave_up', attempts: 3, monthly: true, reason: 'execution 811 crashed' },
      { key: `${key}:site_tracker`, site_id: sid, cycle_key: key, job: 'site_tracker', status: 'skipped', attempts: 0, monthly: true, reason: 'skipped: "Track my site" already ran it when tracking was set up (cycle 0)' },
    ];
    const v = (await co.c.get(`${base(co, s.id)}/cycle`)).body;
    expect(v).toMatchObject({ known: true, weekday: 3, current: { cycleKey: key, date: '2026-10-14', monthly: true, cycle0: true, status: 'running' } });
    expect(v.current.jobs.map((j: { job: string }) => j.job)).toEqual(['ai_visibility', 'backlinks', 'site_tracker']);
    const reasons = v.current.jobs.map((j: { reason: string }) => j.reason).join(' | ');
    expect(reasons).not.toMatch(/execution|ledger|seo_/);
    expect(v.current.jobs[0].reason).toMatch(/after 3 attempts/);
    expect(v.current.jobs[2].reason).toMatch(/^"Track my site" already ran it/);
    const viewer = await member(co, 'cycle-viewer@kf.test', 'viewer');
    expect((await viewer.get(`${base(co, s.id)}/cycle`)).body.canChangeWeekday).toBe(false);
    expect((await viewer.patch(`${base(co, s.id)}/cycle`, { weekday: 5 })).status).toBe(403);
    expect((await co.c.patch(`${base(co, s.id)}/cycle`, { weekday: 7 })).status).toBe(400);
    const r = await co.c.patch(`${base(co, s.id)}/cycle`, { weekday: 5 });
    expect(r.status).toBe(200);
    // the next Friday at least 3 days after the last cycle started (Wed 14 Oct): Fri 23 Oct at 06:00 UTC... unless that is past, then the next due
    expect(r.body).toMatchObject({ weekday: 5, weekdayName: 'Friday', timezone: 'UTC' });
    const row = t.tables.cycles[0];
    expect([row.cycle_weekday, row.next_due_at, row.anchor_at]).toEqual([5, '2099-01-07T06:00:00.000Z', '2026-10-14T08:00:00.000Z']);
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, s.id) }))!.cycleWeekday).toBe(5);
    const ev = await db.query.auditEvents.findFirst({ where: and(eq(schema.auditEvents.orgId, co.org.id), eq(schema.auditEvents.action, 'site.cycle_weekday_changed')) });
    expect(ev?.details).toMatchObject({ before: 'Wednesday', after: 'Friday' });
  });
});

describe('the "Coming up" plan', () => {
  const plan = (sid: string, cycleKey: string, scheduledFor: string) => ({
    stage: 'cycle_preview',
    status: 'progress',
    request_id: `cyc_${sid.replace(/^site_/, '')}_${cycleKey.slice(-10).replace(/-/g, '')}_preview`,
    trigger: 'cycle',
    site_id: sid,
    domain: 'plan-kf.com',
    cycle_key: cycleKey,
    cycle_date: cycleKey.slice(-10),
    scheduled_for: scheduledFor,
    level: 2,
    pages_per_week: 2,
    waiting_for_keyword: false,
    paused_reason: '',
    reason: '',
    dry_run: true,
    preview: true,
    items: [
      { item_key: 'crm implementation cost', keyword: 'crm implementation cost', source: 'ladder', page_type: 'Guide', existing_page_url: '', ladder_id: 'lad_1', rung: 1, why: 'keyword ladder', auto: true, est_usd: 0.84, ai_target: null },
      { item_key: 'crm data migration', keyword: 'crm data migration', source: 'ladder', page_type: 'Guide', existing_page_url: '', ladder_id: 'lad_2', rung: 1, why: 'waits for your OK', auto: false, est_usd: 0.84, ai_target: null },
    ],
    suggestions: [{ item_key: 'best crm consultants', keyword: 'best crm consultants', source: 'ai_answer', page_type: 'Guide', existing_page_url: '', ladder_id: '', rung: 0, why: 'AI answers', auto: false, est_usd: 0.84, ai_target: { question: 'Who are the best CRM consultants?', kind: 'answer', target_id: 'ait_1', fanout: ['a'], sources: [{ u: 'https://x.test/a', t: 'A' }], competitors: ['rival.test'] } }],
    refused: [{ keyword: 'office coffee machines', source: 'trend', reason: 'off topic', detail: '0% of its own words match' }],
    callback_url: 'https://should-never-be-stored',
  });

  it('a plan callback is a scheduled report of the website, kept once per cycle, e-mailed once, in credits', async () => {
    const co = await company('plan@kf.test', 'Plan Co');
    const s = await site(co.org.id, 'plan-kf.com', { trackingStatus: 'active' });
    const sid = n8nSiteId('plan-kf.com');
    const due = new Date(Date.now() + 2 * DAY).toISOString();
    const key = `cyc:${sid}:${due.slice(0, 10)}`;
    const org = await hookOf(co.org.id);
    // a run of the app with the same request id must never take a cycle's report
    await db.insert(schema.runs).values({ orgId: co.org.id, siteId: s.id, mode: 'track', title: 'x', status: 'running', requestId: plan(sid, key, due).request_id, input: {} });
    const r1 = await ingestCallback(org, plan(sid, key, due));
    await flush();
    expect(r1.runId).toBeNull();
    const rep = (await db.query.reports.findFirst({ where: eq(schema.reports.id, r1.reportId) }))!;
    expect([rep.stage, rep.scheduled, rep.siteId, rep.title]).toEqual(['cycle_preview', true, s.id, 'Coming up plan · plan-kf.com']);
    expect(rep.summary).toMatchObject({ automatic: 1, needsOk: 2, level: 2 });
    const kept = await db.query.cyclePreviews.findMany({ where: eq(schema.cyclePreviews.siteId, s.id) });
    expect(kept.map((k) => k.cycleKey)).toEqual([key]);
    expect(JSON.stringify(kept[0].body)).not.toMatch(/should-never-be-stored/);
    expect(t.mails.map((m) => m.subject)).toEqual([expect.stringMatching(/^Coming up on \w+day for plan-kf\.com$/)]);
    expect(t.mails[0].lines.join(' ')).toMatch(/"crm implementation cost" \(about 51 credits\)/);
    expect(t.mails[0].lines.join(' ')).not.toMatch(/\$|USD|DataForSEO|Claude/);
    // the same cycle's plan again (re-made): kept as one, no second e-mail
    await ingestCallback(org, plan(sid, key, due));
    await flush();
    expect((await db.query.cyclePreviews.findMany({ where: eq(schema.cyclePreviews.siteId, s.id) })).length).toBe(1);
    expect(t.mails).toHaveLength(1);

    const v = (await co.c.get(`${base(co, s.id)}/coming-up`)).body;
    expect(v).toMatchObject({ available: true, cycleKey: key, level: 2, pagesPerWeek: 2, canDecide: true, closed: false, autoCredits: 51 });
    expect(v.items.map((i: { keyword: string; auto: boolean; canApprove: boolean; credits: number }) => [i.keyword, i.auto, i.canApprove, i.credits])).toEqual([
      ['crm implementation cost', true, false, 51],
      ['crm data migration', false, true, 51],
    ]);
    expect(v.suggestions[0].aiTarget).toEqual({ targetId: 'ait_1', question: 'Who are the best CRM consultants?', kind: 'answer', fanout: ['a'], sources: [{ url: 'https://x.test/a', title: 'A' }], competitors: ['rival.test'] });
    expect(v.refused).toEqual([{ keyword: 'office coffee machines', source: 'trend', reason: 'off topic', detail: '0% of its own words match' }]);
    expect(JSON.stringify(v)).not.toMatch(/est_usd|estUsd|0\.84/);
  });

  it('decisions: written to seo_skips with the contract\'s key; checked against the plan; roles; closed once the cycle started', async () => {
    const co = await company('decide@kf.test', 'Decide Co');
    const s = await site(co.org.id, 'plan-kf.com', { trackingStatus: 'active', verifiedAt: null });
    // the domain is verified by the first company already: this one is not; use its own domain instead
    await db.update(schema.sites).set({ domain: 'decide-kf.com', verifiedAt: new Date() }).where(eq(schema.sites.id, s.id));
    const sid = n8nSiteId('decide-kf.com');
    const due = new Date(Date.now() + 2 * DAY).toISOString();
    const key = `cyc:${sid}:${due.slice(0, 10)}`;
    await ingestCallback(await hookOf(co.org.id), { ...plan(sid, key, due), domain: 'decide-kf.com' });
    await flush();
    const url = `${base(co, s.id)}/coming-up/decisions`;
    t.tables.skips = [];
    const skip = await co.c.post(url, { itemKey: 'CRM Implementation Cost', decision: 'skip' });
    expect(skip.status).toBe(200);
    expect(skip.body.key).toBe(`${sid}:${key}:crm implementation cost`);
    expect(t.tables.skips[0]).toMatchObject({ key: `${sid}:${key}:crm implementation cost`, site_id: sid, cycle_key: key, item_key: 'crm implementation cost', decision: 'skip', scope: 'cycle', by: 'decide@kf.test' });
    expect(skip.body.item.decision).toMatchObject({ decision: 'skip', scope: 'cycle' });
    // an automatic item cannot be approved (it is written anyway); an approval is for this cycle only; unknown items are refused
    expect((await co.c.post(url, { itemKey: 'crm implementation cost', decision: 'approve' })).status).toBe(400);
    expect((await co.c.post(url, { itemKey: 'best crm consultants', decision: 'approve', scope: 'always' })).status).toBe(400);
    expect((await co.c.post(url, { itemKey: 'something else', decision: 'skip' })).status).toBe(400);
    // always-skip, then approve the same item for this cycle: the approval clears the always-skip (the client's newest word wins)
    await co.c.post(url, { itemKey: 'best crm consultants', decision: 'skip', scope: 'always' });
    expect(t.tables.skips.some((r) => r.key === `${sid}:always:best crm consultants`)).toBe(true);
    const ok = await co.c.post(url, { itemKey: 'best crm consultants', decision: 'approve' });
    expect(ok.body.item.decision).toMatchObject({ decision: 'approve', scope: 'cycle' });
    expect(t.tables.skips.some((r) => r.key === `${sid}:always:best crm consultants`)).toBe(false);
    // a member may decide, a viewer may read and not decide
    const m = await member(co, 'decide-member@kf.test', 'member');
    expect((await m.post(url, { itemKey: 'crm data migration', decision: 'approve' })).status).toBe(200);
    const v = await member(co, 'decide-viewer@kf.test', 'viewer');
    expect((await v.get(`${base(co, s.id)}/coming-up`)).body.canDecide).toBe(false);
    expect((await v.post(url, { itemKey: 'crm data migration', decision: 'skip' })).status).toBe(403);
    expect((await db.query.auditEvents.findMany({ where: and(eq(schema.auditEvents.orgId, co.org.id), eq(schema.auditEvents.action, 'site.coming_up_decided')) })).length).toBe(4);
    // the cycle started: closed
    await db.update(schema.cyclePreviews).set({ scheduledFor: new Date(Date.now() - 60_000) }).where(eq(schema.cyclePreviews.siteId, s.id));
    expect((await co.c.post(url, { itemKey: 'crm data migration', decision: 'skip' })).status).toBe(409);
    expect((await co.c.get(`${base(co, s.id)}/coming-up`)).body).toMatchObject({ closed: true });
  });

  it('no plan yet: available false; a cycle job\'s report (cyc_ request id) is the website\'s scheduled report, never an app run\'s', async () => {
    const co = await company('noplan@kf.test', 'No Plan');
    const s = await site(co.org.id, 'noplan-kf.com', { trackingStatus: 'active' });
    expect((await co.c.get(`${base(co, s.id)}/coming-up`)).body).toMatchObject({ available: false, items: [] });
    const sid = n8nSiteId('noplan-kf.com');
    const rid = `cyc_${sid.replace(/^site_/, '')}_20261021_ai_visibility`;
    const r = await ingestCallback(await hookOf(co.org.id), { stage: 'ai_visibility', status: 'progress', request_id: rid, trigger: 'cycle', cycle_key: `cyc:${sid}:2026-10-21`, domain: 'noplan-kf.com', run_ledger: { usd: 1 } });
    const rep = (await db.query.reports.findFirst({ where: eq(schema.reports.id, r.reportId) }))!;
    expect([r.runId, rep.scheduled, rep.siteId]).toEqual([null, true, s.id]);
  });
});

describe('the autopilot level', () => {
  it('PATCH automation writes the _site row and the website\'s mirror; viewers and members cannot', async () => {
    const co = await company('level@kf.test', 'Level Co');
    const s = await site(co.org.id, 'level-kf.com');
    const r = await co.c.patch(`${base(co, s.id)}/automation`, { autopilotLevel: 1 });
    expect([r.status, r.body.autopilotLevel]).toEqual([200, 1]);
    expect(t.tables.ladderSettings.find((x) => x.domain === 'level-kf.com' && x.ladder_id === '_site')).toMatchObject({ autopilot_level: 1 });
    expect((await db.query.sites.findFirst({ where: eq(schema.sites.id, s.id) }))!.autopilotLevel).toBe(1);
    const m = await member(co, 'level-member@kf.test', 'member');
    expect((await m.patch(`${base(co, s.id)}/automation`, { autopilotLevel: 3 })).status).toBe(403);
  });
});

describe('"Not what I wanted" and the auto-pause', () => {
  it(`2 of the last 5 automatic non-ladder pages rejected: level 1, the owners told, one rejection per page; ladder pages never count`, async () => {
    const co = await company('reject@kf.test', 'Reject Co');
    const s = await site(co.org.id, 'reject-kf.com', { autopilotLevel: 3 });
    t.tables.contentLog = [
      ...['a', 'b', 'c'].map((k, i) => ({ domain: 'reject-kf.com', keyword: `auto page ${k}`, source: 'decay', request_id: `cad_20261014_x_${i + 1}`, started_at: new Date(Date.now() - (i + 1) * DAY).toISOString(), status: 'written' })),
      { domain: 'reject-kf.com', keyword: 'ladder page', source: 'ladder', request_id: 'cad_20261014_x_9', started_at: new Date().toISOString(), status: 'written' },
    ];
    const page = async (keyword: string, requestId: string) =>
      (await db.insert(schema.reports).values({ orgId: co.org.id, siteId: s.id, stage: 'content', status: 'completed', title: keyword, requestId, scheduled: true, payload: { keyword, request_id: requestId } }).returning())[0];
    const p1 = await page('auto page a', 'cad_20261014_x_1');
    const p2 = await page('auto page b', 'cad_20261014_x_2');
    const pl = await page('ladder page', 'cad_20261014_x_9');
    const send = (id: string, reason = '') => co.c.post(`/api/orgs/${co.org.id}/reports/${id}/feedback`, { verdict: 'reject', reason });
    expect((await send(pl.id)).body).toMatchObject({ levelDropped: false, level: 3 });
    expect((await send(p1.id, 'not my topic')).body).toMatchObject({ levelDropped: false, level: 3 });
    expect((await send(p1.id)).body).toMatchObject({ levelDropped: false }); // the same page twice: one rejection
    const drop = await send(p2.id);
    expect(drop.body).toMatchObject({ levelDropped: true, level: 1 });
    const after = (await db.query.sites.findFirst({ where: eq(schema.sites.id, s.id) }))!;
    expect([after.autopilotLevel, after.autopilotDroppedFrom, !!after.autopilotDroppedAt]).toEqual([1, 3, true]);
    expect(t.tables.ladderSettings.find((x) => x.domain === 'reject-kf.com' && x.ladder_id === '_site')).toMatchObject({ autopilot_level: 1 });
    expect(t.mails.map((m) => m.subject)).toEqual(['We paused the extra pages for reject-kf.com']);
    const fb = await db.query.contentFeedback.findMany({ where: eq(schema.contentFeedback.siteId, s.id) });
    expect(fb.map((f) => [f.keyword, f.automatic]).sort()).toEqual([['auto page a', true], ['auto page b', true], ['ladder page', false]]);
    // not a page, another company's report, a viewer: refused
    const other = (await db.insert(schema.reports).values({ orgId: co.org.id, siteId: s.id, stage: 'site_tracker', status: 'progress', title: 'x', payload: {} }).returning())[0];
    expect((await send(other.id)).status).toBe(400);
    expect((await co.c.post(`/api/orgs/${co.org.id}/reports/${p1.id}/feedback`, { verdict: 'love' })).status).toBe(400);
    const v = await member(co, 'reject-viewer@kf.test', 'viewer');
    expect((await v.post(`/api/orgs/${co.org.id}/reports/${p1.id}/feedback`, { verdict: 'reject' })).status).toBe(403);
  });
});

describe('keyword proposals', () => {
  const strategy = (orgId: string, siteId: string, keywords: { keyword: string; difficulty_for_you: string; plan_type: string; months?: string; why?: string }[], age = 2) =>
    db.insert(schema.reports).values({ orgId, siteId, stage: 'keyword_strategy', status: 'completed', title: 'Keyword strategy', scheduled: false, payload: { country: 'United States', priority: keywords }, receivedAt: new Date(Date.now() - age * DAY) });

  it('level 3: announced (start in 48 h, an e-mail), started when due as "system_announced" (autopilot), once; a skipped keyword never returns', async () => {
    const co = await company('propose@kf.test', 'Propose Co');
    const s = await site(co.org.id, 'propose-kf.com', { trackingStatus: 'active', autopilotLevel: 3 });
    await strategy(co.org.id, s.id, [
      { keyword: 'crm consulting', difficulty_for_you: 'easy', plan_type: 'direct', months: '2-4', why: 'You offer CRM implementation' },
      { keyword: 'crm training', difficulty_for_you: 'reachable', plan_type: 'short', months: '4-6' },
      { keyword: 'enterprise crm', difficulty_for_you: 'hard', plan_type: 'full' },
    ]);
    const org = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, co.org.id) }))!;
    const r1 = await proposeForSite(org, s, undefined, Date.now(), log);
    expect(r1).toMatchObject({ keyword: 'crm consulting' });
    // again (a second timer tick, a second server): the open proposal stops it
    expect((await proposeForSite(org, s, undefined, Date.now(), log)).proposalId).toBeNull();
    const list = (await co.c.get(`${base(co, s.id)}/keyword-proposals`)).body;
    expect(list).toMatchObject({ level: 3, enabled: true, pending: [{ keyword: 'crm consulting', level: 3, chance: 'Good chance', months: '2-4', occasion: 'room' }] });
    expect(Date.parse(list.pending[0].startAt) - Date.now()).toBeGreaterThan(47 * 3_600_000);
    expect(t.mails.map((m) => m.subject)).toEqual(['We will start "crm consulting" for propose-kf.com']);
    // not due yet: nothing starts; due: it starts once, on the owner's behalf, as an announced keyword
    expect(await startDueProposals(log)).toBe(0);
    await db.update(schema.keywordProposals).set({ startAt: new Date(Date.now() - 60_000) }).where(eq(schema.keywordProposals.siteId, s.id));
    expect(await startDueProposals(log)).toBe(1);
    expect(await startDueProposals(log)).toBe(0);
    expect(t.starts.filter((b) => b.mode === 'ladder')).toEqual([expect.objectContaining({ keyword: 'crm consulting', chosen_by: 'system_announced', pages_now: 1 })]);
    const run = (await db.query.runs.findFirst({ where: and(eq(schema.runs.siteId, s.id), eq(schema.runs.mode, 'ladder')) }))!;
    expect((run.input as Record<string, unknown>).autoStart).toBe(true); // autopilot spend
    const p = (await co.c.get(`${base(co, s.id)}/keyword-proposals`)).body;
    expect(p.recent[0]).toMatchObject({ keyword: 'crm consulting', status: 'started', runId: run.id });
  });

  it('levels 1-2: a suggestion (no start time) that waits; approve starts it as the client\'s pick; skip proposes the next one; swap checks first', async () => {
    const co = await company('suggest@kf.test', 'Suggest Co');
    const s = await site(co.org.id, 'suggest-kf.com', { trackingStatus: 'active', autopilotLevel: 2 });
    await strategy(co.org.id, s.id, [
      { keyword: 'crm consulting', difficulty_for_you: 'easy', plan_type: 'direct' },
      { keyword: 'crm training', difficulty_for_you: 'reachable', plan_type: 'short' },
      { keyword: 'crm migration', difficulty_for_you: 'easy', plan_type: 'direct' },
    ]);
    const org = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, co.org.id) }))!;
    await proposeForSite(org, s, undefined, Date.now(), log);
    let list = (await co.c.get(`${base(co, s.id)}/keyword-proposals`)).body;
    expect(list.pending).toEqual([expect.objectContaining({ keyword: 'crm consulting', startAt: null, level: 2 })]);
    expect(t.mails).toEqual([]); // a suggestion is not announced
    await db.update(schema.keywordProposals).set({ startAt: new Date(Date.now() - 60_000) }).where(eq(schema.keywordProposals.siteId, s.id));
    expect(await startDueProposals(log)).toBe(0); // levels 1-2 never start on their own
    // skip: never again, the next one is proposed
    const sk = await co.c.post(`${base(co, s.id)}/keyword-proposals/${list.pending[0].id}/skip`);
    // the next best one: easy before reachable (the research's own order inside each)
    expect(sk.body).toMatchObject({ proposal: { status: 'skipped' }, next: { keyword: 'crm migration' } });
    expect((await co.c.post(`${base(co, s.id)}/keyword-proposals/${list.pending[0].id}/skip`)).status).toBe(409);
    // swap for a typed keyword that is not realistic: refused with the check, nothing started
    list = (await co.c.get(`${base(co, s.id)}/keyword-proposals`)).body;
    t.assess = { difficulty_for_you: 'not_realistic', fit: 2 };
    const bad = await co.c.post(`${base(co, s.id)}/keyword-proposals/${list.pending[0].id}/swap`, { keyword: 'salesforce' });
    expect([bad.status, bad.body.code]).toEqual([409, 'keyword_not_suitable']);
    expect(t.starts.filter((b) => b.mode === 'ladder')).toEqual([]);
    // approve: starts now as the client's pick
    t.assess = { difficulty_for_you: 'easy', fit: 2 };
    const ap = await co.c.post(`${base(co, s.id)}/keyword-proposals/${list.pending[0].id}/approve`);
    expect(ap.body.proposal).toMatchObject({ keyword: 'crm migration', status: 'approved', decidedBy: 'suggest@kf.test' });
    expect(t.starts.at(-1)).toMatchObject({ mode: 'ladder', keyword: 'crm migration', chosen_by: 'client_picked' });
    // a viewer cannot decide
    const v = await member(co, 'suggest-viewer@kf.test', 'viewer');
    expect((await v.post(`${base(co, s.id)}/keyword-proposals/${list.pending[0].id}/approve`)).status).toBe(403);
  });

  it('never for a paused or credit-paused website; never twice for one keyword (a database rule)', async () => {
    const co = await company('paused@kf.test', 'Paused Co');
    const s = await site(co.org.id, 'paused-kf.com', { trackingStatus: 'paused', autopilotLevel: 3 });
    await strategy(co.org.id, s.id, [{ keyword: 'crm consulting', difficulty_for_you: 'easy', plan_type: 'direct' }]);
    const org = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, co.org.id) }))!;
    expect((await proposeForSite(org, s, undefined, Date.now(), log)).proposalId).toBeNull();
    const s2 = await site(co.org.id, 'credit-kf.com', { trackingStatus: 'active', creditsPausedAt: new Date(), autopilotLevel: 3 });
    expect((await proposeForSite(org, s2, undefined, Date.now(), log)).proposalId).toBeNull();
    // the database refuses a second proposal of the same keyword for one website, and a second open one
    const row = { orgId: co.org.id, siteId: s.id, keyword: 'x', keywordNorm: 'x', status: 'skipped', level: 2 };
    await db.insert(schema.keywordProposals).values(row);
    await expect(db.insert(schema.keywordProposals).values(row)).rejects.toThrow();
    await db.insert(schema.keywordProposals).values({ ...row, keyword: 'y', keywordNorm: 'y', status: 'pending' });
    await expect(db.insert(schema.keywordProposals).values({ ...row, keyword: 'z', keywordNorm: 'z', status: 'pending' })).rejects.toThrow();
  });
});
