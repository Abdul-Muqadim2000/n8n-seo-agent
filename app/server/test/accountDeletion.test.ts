import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// CR17-B (client report 2026-11-17, C1), end to end on a real Postgres (PGlite, every migration): sign-up records the Terms / Privacy
// version (and refuses without the tick, by e-mail and by Google), "Delete my account" with its rules (typed confirmation, step-up, the
// only owner of a company with members, an agency with client workspaces, a platform admin), a company only the person belongs to goes
// with the account and its websites' engine history with it; the engine-history purge matches exactly (devaicon.com never touches
// mydevaicon.com, devaicon.com.au, or global rows) and leaves the id-keyed tables alone while another domain holds the engine id.

vi.hoisted(() => {
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@admin.test';
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
});
const eng = vi.hoisted(() => ({ purged: [] as { table: string; filters: { columnName: string; value: string }[]; match: string }[], adminCalls: [] as Record<string, unknown>[], foreign: [] as { domain: string }[] }));
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return {
    ...real,
    rows: vi.fn(async (_t: string) => eng.foreign),
    siteRows: vi.fn(async () => []),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    deleteRows: vi.fn(async () => true),
    deleteRowsByName: vi.fn(async (table: string, filters: { columnName: string; value: string }[], match: string) => {
      eng.purged.push({ table, filters, match });
      return true;
    }),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => {
      eng.adminCalls.push(b);
      return { ok: true, action: String(b.action), affected: 1, error: null };
    }),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
  };
});
vi.mock('../src/auth/google', async (orig) => ({
  ...(await orig<typeof import('../src/auth/google')>()),
  exchangeGoogleCode: vi.fn(async () => ({ sub: 'g-sub-new', email: 'gnew@acme.test', emailVerified: true, name: 'G New', picture: null, accessToken: null })),
}));

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { LEGAL_VERSION, ENGINE_SITE_PURGE, ENGINE_SITE_KEEP, TABLES, enginePurgePlan, enginePurgeMatches } = await import('@seo/shared');
const { purgeEngineHistory } = await import('../src/services/enginePurge');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const PW = 'correct horse battery staple';
const userOf = (email: string) => db.query.users.findFirst({ where: eq(schema.users.email, email) });
async function company(email: string, name: string) {
  const u = await signUp(app, email);
  const org = (await u.c.post('/api/orgs', { name })).body;
  return { c: u.c, org };
}
const makeStale = async (email: string) => {
  const u = (await userOf(email))!;
  await db.update(schema.sessions).set({ reauthAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.sessions.userId, u.id));
};

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => app?.close());
beforeEach(() => {
  eng.purged = [];
  eng.adminCalls = [];
  eng.foreign = [];
});

describe('sign-up records the Terms and Privacy Policy version', () => {
  it('refuses a sign-up without the tick, with the field named', async () => {
    const r = await new Client(app).post('/api/auth/signup', { name: 'No Tick', email: 'notick@acme.test', password: PW });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.fields ?? {})).toContain('acceptTerms');
    expect(await userOf('notick@acme.test')).toBeUndefined();
    const f = await new Client(app).post('/api/auth/signup', { name: 'False', email: 'false@acme.test', password: PW, acceptTerms: false });
    expect(f.status).toBe(400);
  });
  it('stores the current version and the time; /api/me says termsAccepted', async () => {
    const before = Date.now();
    const { c, me } = await signUp(app, 'tick@acme.test');
    expect(me.user.termsAccepted).toBe(true);
    expect(me.user.termsVersion).toBe(LEGAL_VERSION);
    const u = (await userOf('tick@acme.test'))!;
    expect(u.termsVersion).toBe(LEGAL_VERSION);
    expect(u.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect((await c.get('/api/me')).body.user.termsAccepted).toBe(true);
  });
  it('an account from before (no version) is not forced through a wall, and /api/me says it has not agreed', async () => {
    const { c } = await signUp(app, 'older@acme.test');
    await db.update(schema.users).set({ termsVersion: null, termsAcceptedAt: null }).where(eq(schema.users.email, 'older@acme.test'));
    const me = await c.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.user.termsAccepted).toBe(false);
    expect((await c.get('/api/me/sessions')).status).toBe(200);
  });
  it('Google: a NEW account needs the tick from the sign-up page; with it the version is stored', async () => {
    const start = async (c: InstanceType<typeof Client>, q: string) => {
      const r = await c.get(`/api/auth/google${q}`);
      expect(r.status).toBe(302);
      return String(new URL(String(r.headers.location)).searchParams.get('state'));
    };
    const no = new Client(app);
    const s1 = await start(no, '?next=/onboarding');
    const r1 = await no.get(`/api/auth/google/callback?code=x&state=${s1}`);
    expect(r1.status).toBe(302);
    expect(String(r1.headers.location)).toBe('/signup?error=terms_required&next=%2Fonboarding');
    expect(await userOf('gnew@acme.test')).toBeUndefined();
    // an old or forged version is not an agreement
    const old = new Client(app);
    const s2 = await start(old, '?terms=2020-01-01');
    expect(String((await old.get(`/api/auth/google/callback?code=x&state=${s2}`)).headers.location)).toMatch(/^\/signup\?error=terms_required/);
    const yes = new Client(app);
    const s3 = await start(yes, `?terms=${LEGAL_VERSION}&next=/onboarding`);
    const r3 = await yes.get(`/api/auth/google/callback?code=x&state=${s3}`);
    expect(String(r3.headers.location)).toBe('/onboarding');
    const u = (await userOf('gnew@acme.test'))!;
    expect(u.termsVersion).toBe(LEGAL_VERSION);
    expect(u.termsAcceptedAt).toBeTruthy();
    // an EXISTING account signs in with Google without the tick
    const again = new Client(app);
    const s4 = await start(again, '');
    expect(String((await again.get(`/api/auth/google/callback?code=x&state=${s4}`)).headers.location)).toBe('/');
  });
});

describe('Delete my account', () => {
  it('refuses a wrong confirmation, then deletes the person, their sessions, and the company only they belong to with its websites in the engine', async () => {
    const { c, org } = await company('solo@acme.test', 'Solo Trading');
    await db.insert(schema.sites).values({ orgId: org.id, domain: 'devaicon-solo.test', country: 'United States', verificationToken: 't-solo', verifiedAt: new Date() });
    await db.insert(schema.sites).values({ orgId: org.id, domain: 'unverified-solo.test', country: 'United States', verificationToken: 't-un' });
    const plan = (await c.get('/api/me/deletion')).body;
    expect(plan).toMatchObject({ canDelete: true, soleOwnerOf: [], agencyWithClients: [], platformAdmin: false, leaves: [] });
    expect(plan.deletes).toEqual([{ id: org.id, name: 'Solo Trading', slug: expect.any(String), websites: 2 }]);
    const bad = await c.del('/api/me', { confirm: 'someone@else.test' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.confirm).toBeTruthy();
    const u = (await userOf('solo@acme.test'))!;
    const ok = await c.del('/api/me', { confirm: ' SOLO@acme.test ' });
    expect(ok.status).toBe(200);
    expect(ok.body.deletedCompanies.map((x: { name: string }) => x.name)).toEqual(['Solo Trading']);
    expect(await userOf('solo@acme.test')).toBeUndefined();
    expect(await db.query.organizations.findFirst({ where: eq(schema.organizations.id, org.id) })).toBeUndefined();
    expect(await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, u.id) })).toBeUndefined();
    expect((await c.get('/api/me')).body).toBeNull();
    // the verified website stopped in the engine and its history went, table by table; the unverified one was never in the engine
    expect(eng.adminCalls.map((b) => `${b.action}:${b.domain}`)).toEqual(['delete:devaicon-solo.test']);
    expect(eng.adminCalls[0].purge_ids).toBe(true);   // FX-SERVER (R5 M5): no other domain holds the id: Site Admin purges the id-keyed rows too
    expect(new Set(eng.purged.map((p) => p.table))).toEqual(new Set(ENGINE_SITE_PURGE.map((t) => t.table)));
    expect(eng.purged.every((p) => p.filters.every((f) => ['devaicon-solo.test', 'www.devaicon-solo.test', 'site_devaicon-solo-test'].includes(f.value)))).toBe(true);
    // the platform's record of it
    const rec = await db.query.adminAudit.findFirst({ where: eq(schema.adminAudit.targetId, u.id) });
    expect(rec).toMatchObject({ action: 'user.self_deleted', actorEmail: 'solo@acme.test' });
  });

  it('the only owner of a company with other members is refused, with the company named', async () => {
    const own = await company('owner2@acme.test', 'Shared Co');
    const inv = await own.c.post(`/api/orgs/${own.org.id}/invitations`, { email: 'member2@acme.test', role: 'member' });
    const m = new Client(app);
    expect((await m.post('/api/auth/signup', { acceptTerms: true, name: 'Member', email: 'member2@acme.test', password: PW, inviteToken: inv.body.inviteUrl.split('/invite/')[1] })).status).toBe(200);
    const plan = (await own.c.get('/api/me/deletion')).body;
    expect(plan.canDelete).toBe(false);
    expect(plan.soleOwnerOf.map((x: { name: string }) => x.name)).toEqual(['Shared Co']);
    const r = await own.c.del('/api/me', { confirm: 'owner2@acme.test' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('sole_owner');
    expect(r.body.error).toMatch(/only owner of Shared Co/);
    expect(await userOf('owner2@acme.test')).toBeTruthy();
    // the member leaves: the company stays, its log says the member left with their account
    const left = await m.del('/api/me', { confirm: 'member2@acme.test' });
    expect(left.status).toBe(200);
    expect(left.body.deletedCompanies).toEqual([]);
    expect(left.body.leftCompanies.map((x: { name: string }) => x.name)).toEqual(['Shared Co']);
    expect(await db.query.organizations.findFirst({ where: eq(schema.organizations.id, own.org.id) })).toBeTruthy();
    const ev = await db.query.auditEvents.findFirst({ where: eq(schema.auditEvents.orgId, own.org.id), orderBy: (t, { desc }) => [desc(t.at)] });
    expect(ev).toMatchObject({ action: 'team.left' });
    expect(eng.adminCalls).toEqual([]);
  });

  it('needs a recent proof of presence (step-up), then goes through', async () => {
    const { c } = await company('stale@acme.test', 'Stale Co');
    await makeStale('stale@acme.test');
    const r = await c.del('/api/me', { confirm: 'stale@acme.test' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('reauth_required');
    expect(await userOf('stale@acme.test')).toBeTruthy();
    expect((await c.post('/api/auth/step-up', { method: 'password', password: PW })).status).toBe(200);
    expect((await c.del('/api/me', { confirm: 'stale@acme.test' })).status).toBe(200);
  });

  it('a platform administrator cannot delete their own account here', async () => {
    const { c } = await signUp(app, 'boss@admin.test');
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, 'boss@admin.test'));
    expect((await c.get('/api/me/deletion')).body).toMatchObject({ canDelete: false, platformAdmin: true });
    const r = await c.del('/api/me', { confirm: 'boss@admin.test' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('platform_admin');
  });

  it('the admin delete goes through the same deletion: the sole company and its website history go with "delete"', async () => {
    const boss = new Client(app);
    expect((await boss.post('/api/auth/login', { email: 'boss@admin.test', password: PW })).status).toBe(200);
    const { org } = await company('gone@acme.test', 'Gone Co');
    await db.insert(schema.sites).values({ orgId: org.id, domain: 'gone-co.test', country: 'United States', verificationToken: 't-gone', verifiedAt: new Date() });
    const u = (await userOf('gone@acme.test'))!;
    expect((await boss.del(`/api/admin/users/${u.id}`, {})).body.code).toBe('sole_member_companies');
    const r = await boss.del(`/api/admin/users/${u.id}`, { soleCompanies: 'delete' });
    expect(r.status).toBe(200);
    expect(r.body.deletedCompanies.map((x: { name: string }) => x.name)).toEqual(['Gone Co']);
    expect(await userOf('gone@acme.test')).toBeUndefined();
    expect(eng.adminCalls.map((b) => `${b.action}:${b.domain}`)).toEqual(['delete:gone-co.test']);
    expect(eng.purged.length).toBeGreaterThanOrEqual(ENGINE_SITE_PURGE.length);
  });
});

describe('the engine-history purge matches exactly', () => {
  const D = 'devaicon.com';
  const LOOK = ['mydevaicon.com', 'devaicon.com.au', 'xdevaicon.com'];
  const sid = (d: string) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
  const store = () => {
    const s: Record<string, Record<string, string>[]> = {};
    for (const t of ENGINE_SITE_PURGE) {
      const rows: Record<string, string>[] = [];
      const add = (dom: string, tag: string) => rows.push({ tag, domain: dom, site_id: sid(dom.replace(/^www\./, '')), ladder_id: sid(dom.replace(/^www\./, '')) });
      add(D, 'own');
      add(`www.${D}`, 'own');
      for (const x of LOOK) {
        add(x, 'other');
        add(`www.${x}`, 'other');
      }
      if (t.table === 'seo_cache') rows.push({ tag: 'own', site_id: D, key: 'idem:keyword:1' }, { tag: 'global', site_id: '', key: 'serp:crm|2784|en|desktop' });
      s[t.table] = rows;
    }
    return s;
  };
  const run = async (idSafe: boolean) => {
    const s = store();
    const res = await purgeEngineHistory(D, { warn: () => undefined }, {
      idSafe,
      del: async (table, filters, match) => {
        expect(match).toBe('or');
        s[table] = s[table].filter((r) => !filters.some((f) => r[f.columnName] === f.value));
        return true;
      },
    });
    return { s, res };
  };

  it('removes every row of the website and its www. form in every listed table, and nothing else', async () => {
    const { s, res } = await run(true);
    expect(res.failed).toEqual([]);
    for (const [t, rows] of Object.entries(s)) {
      expect(rows.filter((r) => r.tag === 'own'), t).toEqual([]);
      expect(rows.filter((r) => r.tag !== 'own').length, t).toBe(LOOK.length * 2 + (t === 'seo_cache' ? 1 : 0));
    }
  });

  it('while another domain holds the engine id, the tables keyed only by that id are left alone', async () => {
    const { s, res } = await run(false);
    expect(res.idSkipped).toBe(true);
    for (const t of ['seo_pages', 'seo_index_history', 'seo_cycle_jobs', 'seo_skips']) expect(s[t].filter((r) => r.tag === 'own').length, t).toBe(2);
    expect(s.seo_profiles.filter((r) => r.tag === 'own')).toEqual([]);
  });

  it('the plan names only exact values (never a look-alike) and never a kept table; every engine table the app knows is purged or kept', () => {
    const plan = enginePurgePlan('https://www.DevAicon.com/', { idSafe: true });
    expect(new Set(plan.flatMap((p) => p.values))).toEqual(new Set([D, `www.${D}`, sid(D)]));
    expect(plan.some((p) => p.table in ENGINE_SITE_KEEP)).toBe(false);
    expect(enginePurgeMatches({ column: 'domain', values: [D] }, { domain: 'mydevaicon.com' })).toBe(false);
    const listed = new Set([...ENGINE_SITE_PURGE.map((t) => t.table), ...Object.keys(ENGINE_SITE_KEEP)]);
    for (const name of Object.values(TABLES)) expect(listed.has(name), name).toBe(true);
    for (const t of ['seo_profiles', 'seo_link_outreach', 'seo_query_history', 'seo_console_alerts', 'seo_link_prospects']) expect(plan.some((p) => p.table === t), t).toBe(true);
    expect(enginePurgePlan('', { idSafe: true })).toEqual([]);
  });

  it('a delete that fails is named and the others still go', async () => {
    const s = store();
    const res = await purgeEngineHistory(D, { warn: () => undefined }, {
      idSafe: true,
      del: async (table, filters) => {
        if (table === 'seo_profiles') throw new Error('engine down');
        s[table] = s[table].filter((r) => !filters.some((f) => r[f.columnName] === f.value));
        return true;
      },
    });
    expect(res.failed).toEqual(['seo_profiles.domain']);
    expect(s.seo_link_outreach.filter((r) => r.tag === 'own')).toEqual([]);
  });

  it('a website delete reads who holds the engine id BEFORE the engine deletes the rows that tell, and keeps id-keyed rows when it is another domain', async () => {
    const { org, c } = await company('ids@acme.test', 'Ids Co');
    const [site] = await db.insert(schema.sites).values({ orgId: org.id, domain: 'foo.co.uk', country: 'United Kingdom', verificationToken: 't-foo', verifiedAt: new Date() }).returning();
    eng.foreign = [{ domain: 'foo-co.uk' }];
    expect((await c.del(`/api/orgs/${org.id}/sites/${site.id}`)).status).toBe(200);
    expect(eng.adminCalls.map((b) => b.action)).toEqual(['delete']);
    // FX-SERVER (review R5 M5): the engine's own delete is told too, so Site Admin keeps the id-keyed rows (it vouched for them by the slug alone)
    expect(eng.adminCalls[0]).toMatchObject({ domain: 'foo.co.uk', site_id: 'site_foo-co-uk', purge_ids: false });
    const tables = new Set(eng.purged.map((p) => p.table));
    expect(tables.has('seo_profiles')).toBe(true);
    expect(tables.has('seo_pages')).toBe(false);
    expect(eng.purged.flatMap((p) => p.filters.map((f) => f.value)).every((v) => v === 'foo.co.uk' || v === 'www.foo.co.uk')).toBe(true);
  });
});
