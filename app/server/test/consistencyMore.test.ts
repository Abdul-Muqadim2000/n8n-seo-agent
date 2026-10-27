import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cycleNorm, n8nSiteId } from '@seo/shared';

// The remaining cases of the mismatch audit (n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §3) on the server, end to end on a real
// Postgres (PGlite, every migration) with the engine replaced by an in-memory Data Table store, like consistency.test.ts. The production
// replay first: techand.ai on 2026-10-26, where one click on "Start this ladder" planned "erp & crm software" next to the Auto ladder
// "dynamics 365 erp system" and wrote a page (about 111 credits) without saying so. Now the click answers 409 `confirm_needed` with the
// new-ladder warning (quote, overlap), nothing starts until it is answered, and Cancel is the default.

const t = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, starts: [] as Record<string, unknown>[], admin: [] as Record<string, unknown>[] }));
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
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => (t.admin.push(b), { ok: true, action: String(b.action), affected: 1, error: null })),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { runWarnings, redirectTarget } = await import('../src/services/consistency');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const FACTS = 'Microsoft Dynamics 365 partner since 2015, 120 projects delivered in the UAE.';

interface Co { c: InstanceType<typeof Client>; org: { id: string }; userId: string }
async function company(email: string, name: string, credits = false): Promise<Co> {
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name })).body;
  await db.update(schema.organizations).set({ creditsEnforced: credits, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
  const user = (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!;
  return { c: u.c, org, userId: user.id };
}
async function site(orgId: string, domain: string, extra: Partial<typeof schema.sites.$inferInsert> = {}) {
  const [s] = await db
    .insert(schema.sites)
    .values({ orgId, domain, country: 'United Arab Emirates', business: 'Microsoft Dynamics 365 partner', businessFacts: FACTS, verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active', ...extra })
    .returning();
  return s;
}
const base = (co: Co, siteId: string) => `/api/orgs/${co.org.id}/sites/${siteId}`;
/** the website's engine rows: its Auto ladder "dynamics 365 erp system" with pages left, and a complete author profile */
function engine(domain: string, o: { ready?: boolean } = {}) {
  const id = 'lad_d365';
  t.tables.ladders = [
    ...(t.tables.ladders ?? []),
    { ladder_id: id, domain, site_id: n8nSiteId(domain), head_keyword: 'dynamics 365 erp system', keyword: 'dynamics 365 erp system', rung: 4, page_no: 1, status: 'published', country: 'United Arab Emirates', location_code: 2784, target_url: `https://${domain}/dynamics-365-erp` },
    { ladder_id: id, domain, site_id: n8nSiteId(domain), head_keyword: 'dynamics 365 erp system', keyword: 'business central partner uae', rung: 2, page_no: 2, status: 'planned', country: 'United Arab Emirates', location_code: 2784 },
    { ladder_id: id, domain, site_id: n8nSiteId(domain), head_keyword: 'dynamics 365 erp system', keyword: 'dynamics 365 finance uae', rung: 2, page_no: 3, status: 'planned', country: 'United Arab Emirates', location_code: 2784 },
  ];
  t.tables.ladderSettings = [...(t.tables.ladderSettings ?? []), { domain, site_id: n8nSiteId(domain), ladder_id: id, mode: 'auto', status: 'active', priority: 1, chosen_by: 'client_typed' }];
  if (o.ready !== false) t.tables.profiles = [...(t.tables.profiles ?? []), { domain, site_id: n8nSiteId(domain), author_name: 'Sara Khan', author_job_title: 'Head of ERP', author_bio: 'Fifteen years of Dynamics 365 projects.' }];
}
async function proposal(orgId: string, siteId: string, keyword: string) {
  const [p] = await db.insert(schema.keywordProposals).values({ orgId, siteId, keyword, keywordNorm: cycleNorm(keyword), details: { why: 'Within reach for your website.', difficultyForYou: 'reachable', planType: 'short' }, level: 2 }).returning();
  return p;
}

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

describe('D1 production replay: "Start this ladder" on a suggestion (techand.ai, 2026-10-26)', () => {
  it('the one click no longer starts anything: 409 with the new-ladder warning (new ladder, page now, credits, overlap), then the D2 family warning', async () => {
    const co = await company('d1-replay@more.test', 'Techand');
    const s = await site(co.org.id, 'techand-replay.ai');
    engine(s.domain);
    const p = await proposal(co.org.id, s.id, 'erp & crm software');
    const r = await co.c.post(`${base(co, s.id)}/keyword-proposals/${p.id}/approve`, {});
    expect([r.status, r.body.code]).toEqual([409, 'confirm_needed']);
    const [d1, ...rest] = r.body.warnings as { id: string; code: string; title: string; body: string; confirm: string; accept: { label: string; change: unknown } }[];
    expect(d1!.code).toBe('money.new_ladder');
    expect(d1!.title).toBe('This starts a new keyword ladder for "erp & crm software"');
    expect(d1!.body).toMatch(/becomes keyword ladder number 2, next to "dynamics 365 erp system"\. Starting it plans the ladder and writes its first page now: about \d+ credits in total/);
    expect(d1!.body).toContain('It is about ERP like your ladder "dynamics 365 erp system"');
    expect(d1!.body).toContain('Nothing has started yet.');
    expect(d1!.accept.change).toEqual({ kind: 'fields', set: { ladderMode: 'manual' } });
    expect(rest.map((w) => w.code)).toContain('money.same_family');
    expect(r.body.needsAcknowledge).toEqual(expect.arrayContaining(['money.new_ladder:erp crm software', 'money.same_family:erp crm software:lad_d365']));
    // nothing reached the engine, no run, the suggestion still waits
    expect(t.starts).toEqual([]);
    expect(await db.query.runs.findMany({ where: eq(schema.runs.siteId, s.id) })).toEqual([]);
    expect((await db.query.keywordProposals.findFirst({ where: eq(schema.keywordProposals.id, p.id) }))!.status).toBe('pending');
  });

  it('Continue anyway: it starts, quoted what the warning said, and the choice is in the run, the proposal decision and the audit log', async () => {
    const co = await company('d1-ack@more.test', 'Techand Ack');
    const s = await site(co.org.id, 'techand-ack.ai');
    engine(s.domain);
    const p = await proposal(co.org.id, s.id, 'erp & crm software');
    const first = await co.c.post(`${base(co, s.id)}/keyword-proposals/${p.id}/approve`, {});
    const quoted = Number(String(first.body.warnings[0].body).match(/about (\d+) credits in total/)![1]);
    const ok = await co.c.post(`${base(co, s.id)}/keyword-proposals/${p.id}/approve`, { acknowledge: first.body.needsAcknowledge });
    expect(ok.status).toBe(200);
    const run = (await db.query.runs.findFirst({ where: eq(schema.runs.id, ok.body.runId) }))!;
    expect(Math.round(Number(run.quotedCredits))).toBe(quoted);
    expect((run.input as Record<string, unknown>).acknowledged).toEqual(expect.arrayContaining(['money.new_ladder:erp crm software']));
    const over = await db.query.auditEvents.findFirst({ where: and(eq(schema.auditEvents.orgId, co.org.id), eq(schema.auditEvents.action, 'warning.overridden')) });
    expect(over!.details).toMatchObject({ codes: expect.arrayContaining(['money.new_ladder', 'money.same_family']), what: 'run:ladder' });
    const decided = await db.query.auditEvents.findFirst({ where: and(eq(schema.auditEvents.orgId, co.org.id), eq(schema.auditEvents.action, 'site.keyword_proposal_decided')) });
    expect(decided!.details).toMatchObject({ decision: 'approve', acknowledged: expect.arrayContaining(['money.new_ladder:erp crm software']) });
    expect(t.starts).toHaveLength(1);
  });

  it('Accept "Plan it without writing a page": the ladder starts Manual, quoted for the plan alone', async () => {
    const co = await company('d1-accept@more.test', 'Techand Accept');
    const s = await site(co.org.id, 'techand-accept.ai');
    engine(s.domain);
    const p = await proposal(co.org.id, s.id, 'erp & crm software');
    const first = await co.c.post(`${base(co, s.id)}/keyword-proposals/${p.id}/approve`, {});
    const quoted = Number(String(first.body.warnings[0].body).match(/about (\d+) credits in total/)![1]);
    // the dialog resends with the accepted fields and the other warning's acknowledgement
    const ok = await co.c.post(`${base(co, s.id)}/keyword-proposals/${p.id}/approve`, { ladderMode: 'manual', acknowledge: ['money.same_family:erp crm software:lad_d365'] });
    expect(ok.status).toBe(200);
    const run = (await db.query.runs.findFirst({ where: eq(schema.runs.id, ok.body.runId) }))!;
    expect(run.input).toMatchObject({ ladderMode: 'manual', pagesHeld: 'manual', chosenBy: 'client_picked' });
    expect(Number(run.quotedCredits)).toBeLessThan(quoted);
  });

  it('D2 Accept "Add it to ..." adds the keyword to the existing ladder and closes the suggestion; nothing new starts', async () => {
    const co = await company('d2-add@more.test', 'Techand Add');
    const s = await site(co.org.id, 'techand-add.ai');
    engine(s.domain);
    const p = await proposal(co.org.id, s.id, 'erp & crm software');
    const add = await co.c.post(`${base(co, s.id)}/ladders/lad_d365/keywords`, { keyword: 'erp & crm software' });
    expect(add.status).toBe(200);
    expect(t.tables.ladders!.some((r) => r.domain === s.domain && r.keyword === 'erp & crm software')).toBe(true);
    expect((await db.query.keywordProposals.findFirst({ where: eq(schema.keywordProposals.id, p.id) }))!.status).toBe('skipped');
    expect(t.starts).toEqual([]);
  });

  it('a level-3 automatic start is not asked D1 (its announcement is the warning) but stops on D2', async () => {
    const co = await company('d1-auto@more.test', 'Techand Auto');
    const s = await site(co.org.id, 'techand-auto.ai');
    engine(s.domain);
    const org = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, co.org.id) }))!;
    const w = await runWarnings(org, s, { mode: 'ladder', siteId: s.id, keyword: 'erp & crm software', country: 'United Arab Emirates', pagesNow: 1 } as never, { proposal: true, auto: true });
    expect(w.map((x) => x.code)).not.toContain('money.new_ladder');
    expect(w.map((x) => x.code)).toContain('money.same_family');
  });
});

describe('the other run cases on the app route (the same path as the API and MCP)', () => {
  it('S6: a ladder start with pages now on a website whose new ladders are Manual', async () => {
    const co = await company('s6@more.test', 'S6 Co');
    const s = await site(co.org.id, 'manual-default.ai');
    t.tables.ladderSettings = [...(t.tables.ladderSettings ?? []), { domain: s.domain, site_id: n8nSiteId(s.domain), ladder_id: '_site', default_mode: 'manual', mode: 'manual' }];
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'ladder', siteId: s.id, keyword: 'odoo partner uae', country: 'United Arab Emirates', business: 'Microsoft Dynamics 365 partner', pagesNow: 1 });
    expect([r.status, r.body.code]).toEqual([409, 'confirm_needed']);
    expect(r.body.needsAcknowledge).toContain('pipeline.manual_pages_now:odoo partner uae');
    expect(t.starts).toEqual([]);
  });

  it('S8: a page without the author profile is asked before it is written', async () => {
    const co = await company('s8@more.test', 'S8 Co');
    const s = await site(co.org.id, 'no-profile.ai');
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'keyword', siteId: s.id, keyword: 'odoo partner uae', country: 'United Arab Emirates', business: 'Microsoft Dynamics 365 partner', receiveContent: true, receiveReport: true });
    expect([r.status, r.body.code]).toEqual([409, 'confirm_needed']);
    const w = r.body.warnings.find((x: { code: string }) => x.code === 'content.not_ready');
    expect(w.accept.change).toEqual({ kind: 'link', sitePage: 'settings/profile' });
  });

  it('D3: a page for a keyword a live page already answers; Accept improves that page', async () => {
    const co = await company('d3@more.test', 'D3 Co');
    const s = await site(co.org.id, 'live-page.ai');
    engine(s.domain);
    t.tables.pages = [{ domain: s.domain, site_id: n8nSiteId(s.domain), url: `https://${s.domain}/odoo-partner-uae`, title: 'Odoo partner UAE', h1: 'Odoo partner in the UAE', queries_json: '[]' }];
    const body = { mode: 'keyword', siteId: s.id, keyword: 'odoo partner uae', country: 'United Arab Emirates', business: 'Microsoft Dynamics 365 partner', receiveContent: true, receiveReport: true };
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, body);
    const w = r.body.warnings.find((x: { code: string }) => x.code === 'money.page_exists');
    expect(w.accept.change).toEqual({ kind: 'fields', set: { existingPageUrl: `https://${s.domain}/odoo-partner-uae` } });
    const ok = await co.c.post(`/api/orgs/${co.org.id}/runs`, { ...body, existingPageUrl: `https://${s.domain}/odoo-partner-uae` });
    expect(ok.status).toBe(200);
  });

  it('D7: watching a keyword a ladder already checks every week', async () => {
    const co = await company('d7@more.test', 'D7 Co');
    const s = await site(co.org.id, 'watch-dup.ai');
    engine(s.domain);
    const r = await co.c.post(`/api/orgs/${co.org.id}/runs`, { mode: 'track', siteId: s.id, country: 'United Arab Emirates', keywords: ['business central partner uae', 'odoo uae'] });
    expect([r.status, r.body.needsAcknowledge]).toEqual([409, ['money.watch_dup:business central partner uae']]);
  });
});

describe('settings, "Add to my ladder" and integrations', () => {
  it('D4: adding a keyword another ladder covers is asked first', async () => {
    const co = await company('d4@more.test', 'D4 Co');
    const s = await site(co.org.id, 'add-dup.ai');
    engine(s.domain);
    t.tables.ladders!.push({ ladder_id: 'lad_einv', domain: s.domain, site_id: n8nSiteId(s.domain), head_keyword: 'e invoicing uae', keyword: 'e invoicing uae', rung: 4, page_no: 1, status: 'planned', country: 'United Arab Emirates' });
    const r = await co.c.post(`${base(co, s.id)}/ladders/lad_d365/keywords`, { keyword: 'e-invoicing in the uae' });
    expect([r.status, r.body.needsAcknowledge]).toEqual([409, ['money.ladder_add_overlap:e invoicing in the uae:lad_einv']]);
    const ok = await co.c.post(`${base(co, s.id)}/ladders/lad_d365/keywords`, { keyword: 'e-invoicing in the uae', acknowledge: r.body.needsAcknowledge });
    expect([ok.status, ok.body.error, ok.body.needsAcknowledge]).toEqual([200, undefined, undefined]);
  });

  it('S7: weekly pages off under an Auto ladder with pages left; nothing reaches the engine until answered', async () => {
    const co = await company('s7@more.test', 'S7 Co');
    const s = await site(co.org.id, 'pages-off.ai', { blogsPerWeek: 1 });
    engine(s.domain);
    const r = await co.c.post(`${base(co, s.id)}/admin`, { action: 'cadence', pagesPerWeek: 0 });
    expect([r.status, r.body.warnings[0].code]).toEqual([409, 'pipeline.ladders_stop']);
    expect(t.admin).toEqual([]);
    expect((await co.c.post(`${base(co, s.id)}/admin`, { action: 'cadence', pagesPerWeek: 0, acknowledge: r.body.needsAcknowledge })).status).toBe(200);
    expect(t.admin.at(-1)).toMatchObject({ action: 'cadence', pages_per_week: 0 });
  });

  it('C1: more weekly pages than the credits can pay for (full autopilot, empty balance)', async () => {
    const co = await company('c1@more.test', 'C1 Co', true);
    const s = await site(co.org.id, 'no-credits.ai', { blogsPerWeek: 0, autopilotLevel: 3 });
    engine(s.domain);
    const r = await co.c.post(`${base(co, s.id)}/admin`, { action: 'cadence', pagesPerWeek: 3 });
    expect(r.status).toBe(409);
    const w = r.body.warnings.find((x: { code: string }) => x.code === 'money.credits_runway');
    expect(w.title).toMatch(/^With this change your credits last about \d+ days?$/);
    expect(w.accept.change).toEqual({ kind: 'fields', set: { pagesPerWeek: 0 } });
  });

  it('S3: the limit lowered below the ladders writing now', async () => {
    const co = await company('s3@more.test', 'S3 Co');
    const s = await site(co.org.id, 'limit.ai');
    engine(s.domain);
    t.tables.ladders!.push({ ladder_id: 'lad_einv', domain: s.domain, site_id: n8nSiteId(s.domain), head_keyword: 'e invoicing uae', keyword: 'e invoicing uae', rung: 4, page_no: 1, status: 'planned', country: 'United Arab Emirates' });
    t.tables.ladderSettings!.push({ domain: s.domain, site_id: n8nSiteId(s.domain), ladder_id: 'lad_einv', mode: 'auto', status: 'active', priority: 2 });
    const r = await co.c.patch(`${base(co, s.id)}/automation`, { maxActiveLadders: 1 });
    expect([r.status, r.body.warnings[0].code]).toEqual([409, 'pipeline.limit_below_active']);
  });

  it('I1: a CMS connection publishing to another domain is asked before anything is saved', async () => {
    const co = await company('i1@more.test', 'I1 Co');
    const s = await site(co.org.id, 'cms-site.ai');
    const r = await co.c.post(`${base(co, s.id)}/cms/connections`, { kind: 'webhook', label: 'Blog', baseUrl: 'https://hooks.example.net/in', publicUrlTemplate: 'https://blog.othersite.com/{slug}' });
    expect([r.status, r.body.needsAcknowledge]).toEqual([409, ['data.cms_domain:blog.othersite.com']]);
    expect(await db.query.cmsConnections.findMany({ where: eq(schema.cmsConnections.siteId, s.id) })).toEqual([]);
  });

  it('I3: a backlinks file of another website is asked before it is loaded', async () => {
    const co = await company('i3@more.test', 'I3 Co');
    const s = await site(co.org.id, 'links-site.ai');
    const csv = 'Source URL,Target URL,Anchor\nhttps://a.com/x,https://othersite.com/p1,erp\nhttps://b.com/y,https://othersite.com/p2,erp\nhttps://c.com/z,https://othersite.com/,home\n';
    const r = await co.c.post(`${base(co, s.id)}/backlinks/import`, { csv });
    expect([r.status, r.body.needsAcknowledge]).toEqual([409, ['data.import_other_site:othersite.com:links-site.ai']]);
    expect(t.tables.linkImports ?? []).toEqual([]);
  });

  it('I7: where the address sends visitors (a fake fetch; the real one is never called in tests)', async () => {
    const to = (url: string) => (async () => ({ url, body: null })) as unknown as typeof fetch;
    expect(await redirectTarget('techand.com', to('https://www.techand.ai/'))).toBe('techand.ai');
    expect(await redirectTarget('techand.ai', to('https://techand.ai/en/'))).toBe('');
    expect(await redirectTarget('techand.ai', (async () => Promise.reject(new Error('down'))) as unknown as typeof fetch)).toBe('');
    expect(await redirectTarget('techand.ai')).toBe('');
  });
});
