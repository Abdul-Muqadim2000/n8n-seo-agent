import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateRunCost, n8nSiteId } from '@seo/shared';

// P1 (2026-10-20, real-credit rehearsal n8n/seo-agent/docs/REHEARSAL_2026-10-20.md §4 item 1): a new client launched a ladder with no
// author profile and no business facts; its first page was written at once and refused by the quality check as not ready to publish,
// after the client paid about 62 credits. The owner's decision: the first page waits for both. End to end on a real Postgres (PGlite)
// with the engine replaced by an in-memory Data Table store: a ladder start without them is quoted for the plan alone and Needs you
// names what is missing; the client saves the facts (they reach the engine's site row) and the profile (the engine's profile row); the
// first page is then offered at once, and its run carries the facts.

const t = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  starts: [] as Record<string, unknown>[],
  admin: [] as Record<string, unknown>[],
}));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => {
  const real = await orig<typeof import('../src/lib/mailer')>();
  return { ...real, sendMail: vi.fn(async () => true) };
});
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
    // Site Admin: `facts` writes the business facts on the engine's site row, as the real workflow does
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => {
      t.admin.push(b);
      if (b.action === 'facts') for (const r of tbl('sites').filter((x) => x.site_id === b.site_id)) r.business_facts = b.business_facts;
      return { ok: true, action: String(b.action), affected: 1, error: null };
    }),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const DOMAIN = 'firstpage-p1.com';
const SID = n8nSiteId(DOMAIN);
const LADDER = 'lad_p1crm';
const FACTS = 'Founded in 2015; 25 CRM consultants; certified partner since 2017; fixed-price CRM packages from 10 weeks.';

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.starts = [];
  t.admin = [];
});

describe('the first page waits for the author profile and the business facts (rehearsal 2026-10-20 §4 item 1)', () => {
  it('a ladder start without them holds its page (quoted for the plan alone); after the client saves both, the first page is offered and written with the facts', async () => {
    // ---- a new client: verified website, tracking started, one page a week, no author profile and no business facts ----
    const u = await signUp(app, 'owner@p1.test');
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, 'owner@p1.test'));
    const org = (await u.c.post('/api/orgs', { name: 'P1 Co' })).body as { id: string };
    await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
    const [site] = await db
      .insert(schema.sites)
      .values({ orgId: org.id, domain: DOMAIN, country: 'United Arab Emirates', business: 'CRM implementation for sales teams', businessFacts: '', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active', trackingStartedAt: new Date(Date.now() - DAY), timezone: 'Asia/Dubai' })
      .returning();
    t.tables.sites = [{ site_id: SID, domain: DOMAIN, status: 'active', business_facts: '' }];
    t.tables.cadence = [{ site_id: SID, domain: DOMAIN, pages_per_week: 1, status: 'active' }];
    const base = `/api/orgs/${org.id}/sites/${site.id}`;

    // ---- 1. the ladder start: its plan is made, its first page is held, so the run is quoted for the plan alone ----
    const r1 = await u.c.post(`/api/orgs/${org.id}/runs`, { mode: 'ladder', siteId: site.id, keyword: 'crm service provider uae', country: 'United Arab Emirates', pagesNow: 1, ladderMode: 'auto' });
    expect(r1.status).toBe(200);
    const run1 = (await db.query.runs.findFirst({ where: eq(schema.runs.id, r1.body.id) }))!;
    expect((run1.input as Record<string, unknown>).pagesHeld).toBe('profile');
    const planOnly = estimateRunCost('ladder', { pagesNow: 1, pagesHeld: 'profile' }, null);
    const withPage = estimateRunCost('ladder', { pagesNow: 1 }, null);
    expect(planOnly).toBeLessThan(withPage);
    expect(run1.estimatedCostUsd).toBeCloseTo(planOnly, 4);
    expect(t.starts.at(-1)).toMatchObject({ mode: 'ladder', keyword: 'crm service provider uae', chosen_by: 'client_typed' });
    // a caller cannot ask for the cheaper quote: on a ready website the server drops a `pagesHeld` it was sent (and quotes the page)
    t.tables.profiles = [{ site_id: SID, domain: DOMAIN, author_name: 'Sara Haddad', author_job_title: 'Head of CRM delivery', author_bio: 'Leads the CRM delivery team.' }];
    await db.update(schema.sites).set({ businessFacts: FACTS }).where(eq(schema.sites.id, site.id));
    const forged = await u.c.post(`/api/orgs/${org.id}/runs`, { mode: 'ladder', siteId: site.id, keyword: 'crm partner uae', country: 'United Arab Emirates', pagesNow: 1, ladderMode: 'auto', pagesHeld: 'profile' });
    const forgedRun = (await db.query.runs.findFirst({ where: eq(schema.runs.id, forged.body.id) }))!;
    expect([(forgedRun.input as Record<string, unknown>).pagesHeld, forgedRun.estimatedCostUsd]).toEqual([undefined, withPage]);
    t.tables.profiles = [];
    await db.update(schema.sites).set({ businessFacts: '' }).where(eq(schema.sites.id, site.id));
    await db.delete(schema.runs).where(eq(schema.runs.id, forgedRun.id));

    // the engine kept the plan and held the page: its rows stay planned, nothing was written
    t.tables.ladders = [
      { ladder_id: LADDER, domain: DOMAIN, head_keyword: 'crm service provider uae', rung: 1, page_no: 1, keyword: 'crm implementation cost uae', supporting: '', page_type: 'Guide', target_url: `https://${DOMAIN}/crm-implementation-cost-uae/`, page_exists: false, status: 'planned', start_date: new Date().toISOString(), chosen_by: 'client_typed' },
      { ladder_id: LADDER, domain: DOMAIN, head_keyword: 'crm service provider uae', rung: 4, page_no: 0, keyword: 'crm service provider uae', supporting: '', page_type: 'Service Page', target_url: `https://${DOMAIN}/crm-service-provider-uae/`, page_exists: false, status: 'planned', start_date: new Date().toISOString(), chosen_by: 'client_typed' },
    ];
    t.tables.ladderSettings = [{ ladder_id: LADDER, site_id: SID, domain: DOMAIN, mode: 'auto', status: 'active', priority: 1, chosen_by: 'client_typed', plan_type: 'short' }];

    // ---- 2. the Pipeline: Needs you names exactly what is missing and where to add it ----
    const p1 = (await u.c.get(`${base}/data/pipeline`)).body;
    const need = p1.needsYou.find((n: { kind: string }) => n.kind === 'profile');
    expect(need).toMatchObject({ id: 'profile:author', severity: 'warning', title: 'Add your author profile and business facts so we can write your first page', action: { page: 'settings/profile' } });
    expect(need.detail).toContain("your author's name, your author's job title, a short author bio and your business facts");
    expect(need.detail).toContain('"crm implementation cost uae" is written first');
    expect(p1.readiness).toMatchObject({ ready: false, missing: ['author_name', 'author_job_title', 'author_bio', 'business_facts'] });
    expect(p1.queue.next).toEqual([]);
    expect(JSON.stringify(p1.needsYou)).not.toMatch(/[—…“”]/);

    // ---- 3. the client saves the business facts: they reach the engine's site row at once (Site Admin `facts`) ----
    const patched = await u.c.patch(base, { businessFacts: FACTS });
    expect(patched.status).toBe(200);
    expect(t.admin.at(-1)).toMatchObject({ action: 'facts', site_id: SID, domain: DOMAIN, business_facts: FACTS });
    expect(t.tables.sites[0].business_facts).toBe(FACTS);
    // only the profile is missing now
    const p2 = (await u.c.get(`${base}/data/pipeline`)).body;
    expect(p2.needsYou.find((n: { kind: string }) => n.kind === 'profile')).toMatchObject({ id: 'profile:author' });
    expect(p2.readiness.missing).toEqual(['author_name', 'author_job_title', 'author_bio']);

    // ---- 4. the client saves the author profile (the engine's profile run writes seo_profiles) ----
    const prof = await u.c.post(`/api/orgs/${org.id}/runs`, { mode: 'profile', siteId: site.id, author: { name: 'Sara Haddad', jobTitle: 'Head of CRM delivery', bio: 'Sara leads the CRM delivery team and has run more than 60 rollouts.' } });
    expect(prof.status).toBe(200);
    expect(t.starts.at(-1)).toMatchObject({ mode: 'profile' });
    t.tables.profiles = [{ site_id: SID, domain: DOMAIN, author_name: 'Sara Haddad', author_job_title: 'Head of CRM delivery', author_bio: 'Sara leads the CRM delivery team and has run more than 60 rollouts.' }];

    // ---- 5. ready: the first page is offered at once ("Write it now", with its credits), or written in the next weekly run ----
    const p3 = (await u.c.get(`${base}/data/pipeline`)).body;
    expect(p3.readiness).toMatchObject({ ready: true, missing: [] });
    const first = p3.needsYou.find((n: { id: string }) => n.id === 'profile:write-first');
    expect(first).toMatchObject({ kind: 'profile', severity: 'info', title: 'Your first page is ready to write: "crm implementation cost uae"', action: { label: 'Write it now' } });
    expect(first.writeNow).toMatchObject({ keyword: 'crm implementation cost uae', source: 'ladder', ladder: { id: LADDER } });
    expect(first.writeNow.credits).toBeGreaterThan(0);
    expect(p3.queue.next.map((q: { keyword: string }) => q.keyword)).toEqual(['crm implementation cost uae']);
    expect(p3.needsYou.some((n: { id: string }) => n.id === 'profile:author' || n.id === 'profile:facts')).toBe(false);

    // ---- 6. "Write it now": the page run carries the facts the client saved ----
    const w = first.writeNow;
    const r6 = await u.c.post(`/api/orgs/${org.id}/runs`, { mode: 'keyword', siteId: site.id, keyword: w.keyword, country: 'United Arab Emirates', pageType: 'Guide', receiveReport: true, receiveContent: true, ladder: w.ladder });
    expect(r6.status).toBe(200);
    const body = t.starts.at(-1)!;
    expect(body).toMatchObject({ mode: 'keyword', keyword: 'crm implementation cost uae', business_facts: FACTS, ladder_id: LADDER });
    // and the next "Track my site" sends them too (key present: the engine stores them on its site row)
    await u.c.post(`/api/orgs/${org.id}/runs`, { mode: 'track', siteId: site.id, country: 'United Arab Emirates' });
    expect(t.starts.at(-1)).toMatchObject({ mode: 'track', business_facts: FACTS });
  });

  it('a Manual ladder start is not changed (it writes nothing at start anyway), and unchanged facts send nothing to the engine', async () => {
    const u = await signUp(app, 'owner2@p1.test');
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, 'owner2@p1.test'));
    const org = (await u.c.post('/api/orgs', { name: 'P1 Two' })).body as { id: string };
    await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
    const [site] = await db
      .insert(schema.sites)
      .values({ orgId: org.id, domain: 'manual-p1.com', country: 'United States', businessFacts: FACTS, verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active' })
      .returning();
    const r = await u.c.post(`/api/orgs/${org.id}/runs`, { mode: 'ladder', siteId: site.id, keyword: 'crm consulting', country: 'United States', ladderMode: 'manual' });
    expect(((await db.query.runs.findFirst({ where: eq(schema.runs.id, r.body.id) }))!.input as Record<string, unknown>).pagesHeld).toBeUndefined();
    await u.c.patch(`/api/orgs/${org.id}/sites/${site.id}`, { businessFacts: FACTS });
    expect(t.admin).toEqual([]);
  });
});
