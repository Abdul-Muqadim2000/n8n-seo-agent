import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { n8nSiteId } from '@seo/shared';

// D1 (paid pre-launch run 2026-10-21): zod 4 applied the create schema's defaults to every key a PATCH left out, so a partial save
// reset what it did not send. The onboarding Tracking step (keywords, GA4, competitors, brand names) wiped the business, customers,
// goal, tone, call to action and business facts the Business step had saved two steps earlier; a GA4 save in Website settings did the
// same and then cleared the facts in the engine (Site Admin `facts` with ''), so the first page waited for ever. A mailbox edit reset its
// ports, window and limits, and an OAuth mailbox could not be edited at all. End to end on PGlite, the engine in memory.

const t = vi.hoisted(() => ({
  starts: [] as Record<string, unknown>[],
  admin: [] as Record<string, unknown>[],
  mailTests: 0,
}));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => ({ ...(await orig<typeof import('../src/lib/mailer')>()), sendMail: vi.fn(async () => true) }));
// the GA4 property check reads Google: here any ID measures the website
vi.mock('../src/services/google', async (orig) => ({ ...(await orig<typeof import('../src/services/google')>()), assertGa4ForDomain: vi.fn(async () => undefined) }));
// a mailbox login test would reach a real server: counted, always fine
vi.mock('../src/services/mail', async (orig) => ({
  ...(await orig<typeof import('../src/services/mail')>()),
  testMailbox: vi.fn(async () => {
    t.mailTests++;
    return { smtp: { ok: true, error: '' }, imap: { ok: true, error: '', sentFolder: 'Sent', uidNext: 1, uidValidity: '1' }, dns: { spf: 'pass', dmarc: 'pass', dkim: 'found', checkedAt: '2026-10-21T00:00:00.000Z', notes: [] } };
  }),
}));
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  let n = 0;
  return {
    ...real,
    startRun: vi.fn(async (body: Record<string, unknown>) => (t.starts.push(body), { ok: true, status: 202, requestId: `exec-pp-${++n}`, etaMinutes: 5, error: null, duplicate: false, firstSeenAt: null })),
    rows: vi.fn(async () => []),
    siteRows: vi.fn(async () => []),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    upsertRow: vi.fn(async () => undefined),
    deleteRows: vi.fn(async () => true),
    ensureTable: vi.fn(async () => 'tbl'),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => (t.admin.push(b), { ok: true, action: String(b.action), affected: 1, error: null })),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const { seal } = await import('../src/lib/secretBox');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const FACTS = 'Founded in 2015; 25 CRM consultants; certified partner since 2017; fixed-price CRM packages from 10 weeks.';
const BUSINESS = {
  country: 'United Arab Emirates',
  business: 'CRM implementation for sales teams',
  customers: 'Sales directors at mid-size firms',
  goal: 'sales',
  tone: 'Friendly and plain-spoken',
  cta: 'Book a CRM review',
  businessFacts: FACTS,
  competitors: ['rival-crm.com'],
  brandNames: ['Acme CRM'],
  services: ['CRM implementation', 'CRM training'],
};

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.starts = [];
  t.admin = [];
  t.mailTests = 0;
});

let seq = 0;
async function company() {
  const email = `owner${++seq}@partial-patch.test`;
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Partial Patch ${seq}` })).body as { id: string };
  await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
  return { u, org };
}
async function trackedSite(orgId: string, domain: string, o: Partial<typeof schema.sites.$inferInsert> = {}) {
  const [site] = await db
    .insert(schema.sites)
    .values({
      orgId, domain, ...BUSINESS, keywords: ['crm uae', 'crm partner uae'], verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active', trackingStartedAt: new Date(Date.now() - DAY), timezone: 'Asia/Dubai', ...o,
    } as typeof schema.sites.$inferInsert)
    .returning();
  return site;
}
const kept = async (siteId: string) => {
  const s = (await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) }))!;
  return { business: s.business, customers: s.customers, goal: s.goal, tone: s.tone, cta: s.cta, businessFacts: s.businessFacts, competitors: s.competitors, brandNames: s.brandNames, services: s.services };
};

describe('a website PATCH changes only what it was sent (D1)', () => {
  it('the GA4 picker in Website settings keeps every other field, and sends no facts to the engine', async () => {
    const { u, org } = await company();
    const site = await trackedSite(org.id, 'ga4-keeps.com');
    const r = await u.c.patch(`/api/orgs/${org.id}/sites/${site.id}`, { ga4PropertyId: '543096312' });
    expect(r.status).toBe(200);
    const { country: _country, ...stored } = BUSINESS;
    expect(await kept(site.id)).toEqual(stored);
    const s = (await db.query.sites.findFirst({ where: eq(schema.sites.id, site.id) }))!;
    expect([s.ga4PropertyId, s.keywords, s.timezone]).toEqual(['543096312', ['crm uae', 'crm partner uae'], 'Asia/Dubai']);
    expect(t.admin.filter((b) => b.action === 'facts')).toEqual([]);
  });

  it('the facts alone keep the business, customers, goal and tone, and reach the engine', async () => {
    const { u, org } = await company();
    const site = await trackedSite(org.id, 'facts-alone.com', { businessFacts: '' });
    const r = await u.c.patch(`/api/orgs/${org.id}/sites/${site.id}`, { businessFacts: FACTS });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ business: BUSINESS.business, customers: BUSINESS.customers, goal: 'sales', tone: BUSINESS.tone, cta: BUSINESS.cta, businessFacts: FACTS });
    expect(t.admin).toEqual([expect.objectContaining({ action: 'facts', site_id: n8nSiteId('facts-alone.com'), business_facts: FACTS })]);
  });

  it('a save without the facts sends no Site Admin `facts`, even on a tracked website with stored facts', async () => {
    const { u, org } = await company();
    const site = await trackedSite(org.id, 'no-facts-push.com');
    await u.c.patch(`/api/orgs/${org.id}/sites/${site.id}`, { keywords: ['crm dubai'] });
    await u.c.patch(`/api/orgs/${org.id}/sites/${site.id}`, { business: 'CRM rollouts for sales teams' });
    expect(t.admin).toEqual([]);
    expect((await kept(site.id)).businessFacts).toBe(FACTS);
  });

  it('onboarding: the Business step, then the Tracking step, then Track my site: the facts are still there and reach the engine', async () => {
    const { u, org } = await company();
    const site = await trackedSite(org.id, 'onboarding-keeps.com', { business: '', customers: '', businessFacts: '', cta: '', competitors: [], brandNames: [], services: [], keywords: [], trackingStatus: 'not_started', trackingStartedAt: null });
    const base = `/api/orgs/${org.id}/sites/${site.id}`;
    // BusinessStep.tsx: the whole business form (businessOnly)
    expect((await u.c.patch(base, BUSINESS)).status).toBe(200);
    // TrackingStep.tsx: what the website itself stores (no business field)
    const tracking = await u.c.patch(base, { keywords: ['crm uae'], ga4PropertyId: '', competitors: ['rival-crm.com'], brandNames: ['Acme CRM'] });
    expect(tracking.status).toBe(200);
    expect(tracking.body).toMatchObject({ business: BUSINESS.business, customers: BUSINESS.customers, goal: 'sales', tone: BUSINESS.tone, cta: BUSINESS.cta, businessFacts: FACTS });
    // the GA4 picker on the Verify step, the same
    expect((await u.c.patch(base, { ga4PropertyId: '123456' })).body.businessFacts).toBe(FACTS);
    // the launch: Track my site carries the facts the client typed
    const tr = await u.c.post(`/api/orgs/${org.id}/runs`, { mode: 'track', siteId: site.id, country: 'United Arab Emirates' });
    expect(tr.status).toBe(200);
    expect(t.starts.at(-1)).toMatchObject({ mode: 'track', business_facts: FACTS });
  });
});

describe('a mailbox PATCH changes only what it was sent (D1)', () => {
  const mailbox = (orgId: string, o: Partial<typeof schema.mailboxes.$inferInsert> = {}) =>
    db
      .insert(schema.mailboxes)
      .values({
        orgId, label: 'Outreach', fromName: 'Sara Khan', fromEmail: `sara${++seq}@partial-patch-mail.com`, smtpHost: 'smtp.partial-patch-mail.com', smtpPort: 587, smtpSecure: false,
        imapHost: 'imap.partial-patch-mail.com', imapPort: 143, imapSecure: false, username: 'sara', secret: seal('app-password'), signatureName: 'Sara Khan', signatureTitle: 'Partner manager',
        company: 'Acme', postalAddress: '1 Market Street, Dubai', timezone: 'Asia/Dubai', windowStart: 9, windowEnd: 18, dailyFirstMax: 12, dailyMax: 30, ...o,
      } as typeof schema.mailboxes.$inferInsert)
      .returning()
      .then((r) => r[0]!);
  const settings = (m: typeof schema.mailboxes.$inferSelect) => ({
    label: m.label, smtpPort: m.smtpPort, smtpSecure: m.smtpSecure, imapPort: m.imapPort, imapSecure: m.imapSecure, signatureName: m.signatureName, signatureTitle: m.signatureTitle,
    company: m.company, timezone: m.timezone, windowEnd: m.windowEnd, dailyFirstMax: m.dailyFirstMax, dailyMax: m.dailyMax,
  });

  it('a new window start keeps the ports, signature and limits, and makes no login test', async () => {
    const { u, org } = await company();
    const mb = await mailbox(org.id);
    const r = await u.c.patch(`/api/orgs/${org.id}/mailboxes/${mb.id}`, { windowStart: 10 });
    expect(r.status).toBe(200);
    const after = (await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, mb.id)) }))!;
    expect(after.windowStart).toBe(10);
    expect(settings(after)).toEqual(settings(mb));
    expect(t.mailTests).toBe(0);
    // a start past 17 is allowed when the stored window ends later (it was refused against the default end of 17)
    expect((await u.c.patch(`/api/orgs/${org.id}/mailboxes/${mb.id}`, { windowStart: 17 })).status).toBe(200);
  });

  it('an OAuth mailbox can be renamed (it has no server settings, and none are sent)', async () => {
    const { u, org } = await company();
    const mb = await mailbox(org.id, { provider: 'ms_graph', secret: '', smtpHost: '', imapHost: '', username: '' });
    const r = await u.c.patch(`/api/orgs/${org.id}/mailboxes/${mb.id}`, { label: 'Sales' });
    expect(r.status).toBe(200);
    expect((await db.query.mailboxes.findFirst({ where: eq(schema.mailboxes.id, mb.id) }))!.label).toBe('Sales');
    expect(t.mailTests).toBe(0);
    // a server setting on an OAuth mailbox is still refused
    expect((await u.c.patch(`/api/orgs/${org.id}/mailboxes/${mb.id}`, { smtpPort: 465 })).status).toBe(400);
  });
});
