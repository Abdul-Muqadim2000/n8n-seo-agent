import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// FX-LINKS (review R2 M4 / M5 / L4, 2026-11-18): "I sent it myself" follows the rules the app's own sender follows (consent, the website's
// opt-out by address and by domain, one conversation per site, the 90-day rest, the draft gate, the weekly limit under one lock), and
// "Mark won" is a claim (no reply waits for ever) that becomes won when our check finds the link. Real Postgres (PGlite, every migration);
// the engine is an in-memory fake. Synthetic data only.

const st = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, admin: [] as Record<string, unknown>[] }));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.ENGINE_EMAILS = 'false';
  process.env.ACCOUNT_EMAILS = 'false';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => ({ ...(await orig<typeof import('../src/lib/mailer')>()), sendMail: vi.fn(async () => true) }));
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return {
    ...real,
    rows: vi.fn(async () => []),
    siteRows: vi.fn(async (table: string, _domain: string, q: { extra?: { columnName: string; value: unknown }[] } = {}) =>
      (st.tables[table] ?? []).filter((r) => (q.extra ?? []).every((e) => String(r[e.columnName] ?? '') === String(e.value)))),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    deleteRows: vi.fn(async () => true),
    upsertRow: vi.fn(async () => true),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => (st.admin.push(b), { ok: true, action: String(b.action), affected: 1, error: null })),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const { suppress, linkSummary, MANUAL_WEEKLY_LIMIT } = await import('../src/services/linkBuilder');
const { settingsDeclaredPart } = await import('../src/services/kiData');
vi.setConfig({ testTimeout: 30_000 });

const DOMAIN = 'fxlinks.test';
let app: FastifyInstance;
let c: Awaited<ReturnType<typeof signUp>>['c'];
let orgId = '';
let siteId = '';
const base = () => `/api/orgs/${orgId}/sites/${siteId}/link-building`;
const steps = (d: string) => JSON.stringify([
  { step: 0, wait_days: 0, subject: 'Your Open edX hosting guide', body: `Hello, I read "Open edX hosting guide" on your site. Our page https://${DOMAIN}/open-edx-services covers hosting in depth. Would you consider adding it to your list?\n\nBest regards` },
  { step: 1, wait_days: 4, subject: '', body: `A short follow-up on https://${DOMAIN}/open-edx-services. Would it fit your guide?` },
]);
const row = (d: string, o: Record<string, unknown> = {}) => ({ site_id: `site_${DOMAIN.replace(/\./g, '-')}`, domain: DOMAIN, prospect_domain: d, type: 'resource', status: 'drafted', score: 50, fit: 0.6, fit_reason: '', checks_json: '{}',
  page_url: `https://${d}/open-edx-hosting-guide`, page_title: 'Open edX hosting guide', evidence: '', contacts_json: JSON.stringify([{ email: `editor@${d}`, kind: 'editorial', own: true }]), contact_email: '', contact_form_url: `https://${d}/contact`,
  country: 'PK', language: 'en', target_url: `https://${DOMAIN}/open-edx-services`, target_reason: '', anchor_hint: 'brand', anchor_text: 'Fx Links', sequence_json: steps(d), deadline: '', drafted_at: '2026-11-15T00:00:00.000Z', checked_at: '2026-11-15T00:00:00.000Z', ...o });
const send = (d: string, extra: Record<string, unknown> = {}) => c.post(`${base()}/manual-sent`, { prospectDomain: d, type: 'resource', toEmail: `editor@${d}`, ...extra });

beforeAll(async () => {
  app = await buildApp();
  const u = await signUp(app, 'owner@fxlinks.test');
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, 'owner@fxlinks.test'));
  c = u.c;
  orgId = (await c.post('/api/orgs', { name: 'Fx Links Co' })).body.id;
  const [s] = await db.insert(schema.sites).values({ orgId, domain: DOMAIN, country: 'Pakistan', verificationToken: 't', verifiedAt: new Date(), trackingStatus: 'active' }).returning();
  siteId = s!.id;
  st.tables.linkOutreach = [
    row('ok.example'), row('german.example', { country: 'DE' }), row('held.example', { status: 'needs_edit' }), row('blocked.example', { contacts_json: '[]' }),
    row('rest.example'), row('bracket.example', { sequence_json: JSON.stringify([{ step: 0, subject: 'Hello', body: `Hi [Name], see https://${DOMAIN}/open-edx-services about "Open edX hosting guide". Would you add it?` }]) }),
    row('race1.example'), row('race2.example'), row('claim.example'),
  ];
  st.tables.prospects = [];
});
afterAll(async () => { await app.close(); });

describe('"I sent it myself" follows the approve path\'s rules (M4)', () => {
  it('records a clean pitch: an active manual conversation, its first e-mail, the prospect contacted (the app\'s note marked as ours)', async () => {
    const r = await send('ok.example');
    expect(r.status).toBe(200);
    const q = await db.query.outreachSequences.findFirst({ where: eq(schema.outreachSequences.id, r.body.id) });
    expect(q).toMatchObject({ status: 'active', manual: true, step: 1 });
    expect(st.admin.at(-1)).toMatchObject({ action: 'prospect', prospect_domain: 'ok.example', status: 'contacted', note_mode: 'system' });
    expect((await send('ok.example')).status).toBe(409);   // one conversation per site
  });
  it('asks for the consent tick where the law needs it (Germany), and records it with the tick', async () => {
    const r = await send('german.example');
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('consent_needed');
    const ok = await send('german.example', { consent: true });
    expect(ok.status).toBe(200);
    expect((await db.query.outreachSequences.findFirst({ where: eq(schema.outreachSequences.id, ok.body.id) }))!.consent).toBe(true);
  });
  it('refuses a pitch held for an edit, and a text the draft gate holds (a bracket left to fill in)', async () => {
    expect((await send('held.example')).body.code).toBe('draft_held');
    expect((await send('bracket.example')).body.code).toBe('draft_held');
  });
  it('a website that asked not to be contacted is refused through its contact form too (no address)', async () => {
    await suppress(orgId, 'domain', 'blocked.example', 'asked not to be contacted');
    const r = await c.post(`${base()}/manual-sent`, { prospectDomain: 'blocked.example', type: 'resource', toEmail: '' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('suppressed');
  });
  it('gives a site that got a full sequence without a reply its 90-day rest', async () => {
    await db.insert(schema.outreachSequences).values({ orgId, siteId, mailboxId: null, prospectDomain: 'rest.example', prospectType: 'resource', toEmail: 'editor@rest.example', status: 'finished', step: 3, steps: [], lastSentAt: new Date(Date.now() - 10 * 864e5), startedAt: new Date(Date.now() - 30 * 864e5), manual: true });
    const r = await send('rest.example');
    expect(r.status).toBe(409);
    expect(r.body.error ?? r.body.message).toMatch(/90 days/);
  });
  it('the weekly limit is counted and recorded under one lock: two clicks at the limit, one passes', async () => {
    const used = (await db.select().from(schema.outreachMessages).where(and(eq(schema.outreachMessages.orgId, orgId), eq(schema.outreachMessages.step, 0)))).length;
    const [seq] = await db.insert(schema.outreachSequences).values({ orgId, siteId, mailboxId: null, prospectDomain: 'filler.example', prospectType: 'resource', toEmail: '', status: 'stopped', step: 1, steps: [], manual: true }).returning();
    const fill = MANUAL_WEEKLY_LIMIT - used - 1;
    for (let i = 0; i < fill; i++) await db.insert(schema.outreachMessages).values({ sequenceId: seq!.id, orgId, mailboxId: null, direction: 'out', step: 0, kind: 'step', subject: 's', body: 'b', toEmail: '', at: new Date() });
    const [a, b] = await Promise.all([send('race1.example'), send('race2.example')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a.body.code, b.body.code]).toContain('weekly_limit');
  });
});

describe('"Mark won" is a claim until our check finds the link (M5)', () => {
  it('the conversation is claimed, no reply waits for an answer, and it turns won when the engine verifies the link', async () => {
    const [q] = await db.insert(schema.outreachSequences).values({ orgId, siteId, mailboxId: null, prospectDomain: 'claim.example', prospectType: 'resource', toEmail: 'editor@claim.example', status: 'replied', replyClass: 'says_linked', replyAt: new Date(), step: 1, steps: [], startedAt: new Date(Date.now() - 5 * 864e5), manual: true }).returning();
    const r = await c.post(`${base()}/sequences/${q!.id}/outcome`, { status: 'won' });
    expect(r.status).toBe(200);
    expect((await db.query.outreachSequences.findFirst({ where: eq(schema.outreachSequences.id, q!.id) }))!.status).toBe('claimed');
    expect(st.admin.at(-1)).toMatchObject({ prospect_domain: 'claim.example', status: 'replied', note_mode: 'system' });
    const org = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) }))!;
    const site = (await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) }))!;
    expect((await linkSummary(org, site)).repliesWaiting).toBe(0);
    const lb1 = (await c.get(base())).body;
    expect(lb1.counts.claimed).toBe(1);
    expect(lb1.counts.won).toBe(0);
    // the engine's weekly read finds the link: the prospect is won with verified_at
    st.tables.prospects = [{ site_id: `site_fxlinks-test`, domain: DOMAIN, prospect_domain: 'claim.example', type: 'resource', status: 'won', contacted_at: '2026-11-12T00:00:00.000Z', won_at: '2026-11-17T00:00:00.000Z', verified_at: '2026-11-17T00:00:00.000Z' }];
    const lb2 = (await c.get(base())).body;
    expect(lb2.counts.won).toBe(1);
    expect(lb2.sequences.find((x: { id: string }) => x.id === q!.id)).toMatchObject({ status: 'won', wonAt: '2026-11-17T00:00:00.000Z' });
    const after = (await db.query.outreachSequences.findFirst({ where: eq(schema.outreachSequences.id, q!.id) }))!;
    expect(after.status).toBe('won');
    expect(after.nextAt).toBeNull();
  });
});

describe('Site settings saves only the declared part of the one list (L4)', () => {
  it('a Competitors page choice stays a choice there; a declared or newly typed domain is declared', async () => {
    st.tables.monitors = [{ site_id: 'x', domain: DOMAIN, competitors: 'declared.ae', not_competitors: '' }];
    st.tables.kiCompetitors = [{ site_id: 'x', domain: DOMAIN, market: 'AE-en', comp_domain: 'chosen.ae', status: 'chosen', status_by: 'user', updated_at: '2026-11-10T00:00:00.000Z' },
      { site_id: 'x', domain: DOMAIN, market: 'AE-en', comp_domain: 'declared.ae', status: 'chosen', status_by: 'user', updated_at: '2026-11-10T00:00:00.000Z' }];
    const site = (await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) }))!;
    expect(await settingsDeclaredPart(site, ['declared.ae', 'chosen.ae', 'typed.ae'])).toEqual(['declared.ae', 'typed.ae']);
  });
});

describe('one decision per competitor domain on the Competitors page (M3 / L5)', () => {
  it('every row of a domain shows the client\'s latest decision; a market-less row shows only when chosen and is never "found"', async () => {
    const { latestDecision, compsInMarket } = await import('../src/services/kiData');
    const v = (o: Record<string, string>) => ({ compDomain: 'rival.ae', market: 'AE-en', status: 'candidate', statusBy: 'auto', fetchedAt: '2026-11-01T00:00:00.000Z', ...o });
    const rows = latestDecision([v({ market: '', status: 'dismissed', statusBy: 'user', fetchedAt: '2026-11-10T00:00:00.000Z' }), v({ status: 'chosen', statusBy: 'user', fetchedAt: '2026-11-12T00:00:00.000Z' })]);
    expect(rows.map((r) => r.status)).toEqual(['chosen', 'chosen']);
    const sap = v({ compDomain: 'sap.com', market: '', status: 'dismissed', statusBy: 'user' });
    const own = v({ compDomain: 'mine.ae', market: '', status: 'chosen', statusBy: 'user' });
    const inAE = compsInMarket([v({}), sap, own], 'AE-en').map((r) => r.compDomain);
    expect(inAE).toEqual(['rival.ae', 'mine.ae']);
    expect(compsInMarket([v({}), v({ market: '', status: 'chosen', statusBy: 'user' })], 'AE-en')).toHaveLength(1);   // the KI row is shown, not its market-less twin
  });
  it('the role context reads the one list: a later choice beats an older "not a competitor"', async () => {
    const { competitorSiteOf } = await import('../src/services/data');
    const ctx = competitorSiteOf({ domain: DOMAIN }, { competitors: '', not_competitors: '' } as never, [
      { comp_domain: 'rival.ae', market: '', status: 'dismissed', status_by: 'user', updated_at: '2026-11-10T00:00:00.000Z' },
      { comp_domain: 'rival.ae', market: 'AE-en', status: 'chosen', status_by: 'user', updated_at: '2026-11-12T00:00:00.000Z' },
    ] as never);
    expect(ctx.chosen).toContain('rival.ae');
    expect(ctx.notCompetitors).not.toContain('rival.ae');
  });
});
