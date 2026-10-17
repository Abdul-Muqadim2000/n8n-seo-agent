import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// G4 (app/docs/INTEGRATIONS.md) end to end against a real Postgres: the migrations, the real app with its sessions, CSRF, roles and
// API keys, the company lock and the budget — with only the network replaced (the SEO engine's front door and Data Tables, and every
// vendor through lib/netGuard.ts `transport`). Run it against a throwaway database:
//   G4_DB_TEST=1 DATABASE_URL=postgres://… npx vitest run test/integrations.pg.test.ts
// Without G4_DB_TEST it is skipped (the unit tests cover the rules and the vendor request shapes without a database).

const DB = process.env.G4_DB_TEST === '1';
const st = vi.hoisted(() => {
  process.env.MAILBOX_KEY = process.env.MAILBOX_KEY || 'b'.repeat(64);
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.APP_URL = 'https://app.example.com';
  // nothing may reach a real n8n: an unmocked call fails at once
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  return {
    starts: [] as Record<string, unknown>[],
    startDelayMs: 0,
    tables: {} as Record<string, Record<string, unknown>[]>,
    sent: [] as { url: string; method: string; headers: Record<string, string>; body: string }[],
    answer: (_r: { url: string; method: string }) => ({ status: 200, text: '{}', headers: {} as Record<string, string> }),
  };
});

vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  let n = 0;
  return {
    ...real,
    startRun: vi.fn(async (body: Record<string, unknown>) => {
      st.starts.push(body);
      if (st.startDelayMs) await new Promise((r) => setTimeout(r, st.startDelayMs));
      return { ok: true, status: 202, requestId: `exec-${++n}`, etaMinutes: 5, error: null, duplicate: false, firstSeenAt: null };
    }),
    siteRows: vi.fn(async (table: string) => st.tables[table] ?? []),
    rows: vi.fn(async () => []),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    upsertRow: vi.fn(async () => undefined),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
  };
});

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(24).toString('base64url');
const until = async (f: () => Promise<boolean>, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await f()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
};

describe.skipIf(!DB)('G4 integrations (real database)', () => {
  let app: FastifyInstance;
  let db: typeof import('../src/db').db;
  let schema: typeof import('../src/db').schema;
  const ids: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  const as = (who: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    app.inject({ method, url, payload: payload as object, headers: { cookie: `sid=${cookies[who]}`, 'x-requested-with': 'fetch', ...headers } });
  const withKey = (key: string, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    app.inject({ method, url, payload: payload as object, headers: { authorization: `Bearer ${key}`, ...headers } });
  const keys: Record<string, string> = {};

  beforeAll(async () => {
    const dbm = await import('../src/db');
    db = dbm.db;
    schema = dbm.schema;
    await dbm.runMigrations();
    const { transport } = await import('../src/lib/netGuard');
    transport.send = async (r) => {
      st.sent.push({ url: r.url, method: r.method, headers: r.headers ?? {}, body: Buffer.isBuffer(r.body) ? r.body.toString('utf8') : String(r.body ?? '') });
      return st.answer(r);
    };
    const { buildApp } = await import('../src/app');
    app = await buildApp();
    await app.ready();

    const sfx = randomBytes(4).toString('hex');
    for (const k of ['owner', 'admin', 'member', 'viewer', 'rival']) {
      const [u] = await db.insert(schema.users).values({ email: `${k}-${sfx}@example.org`, name: k, emailVerifiedAt: new Date() }).returning();
      ids[k] = u.id;
      const t = token();
      await db.insert(schema.sessions).values({ id: sha(t), userId: u.id, expiresAt: new Date(Date.now() + 864e5) });
      cookies[k] = t;
    }
    for (const k of ['org1', 'org2']) {
      const [o] = await db.insert(schema.organizations).values({ name: k, slug: `${k}-${sfx}`, hookToken: token(), monthlyBudgetUsd: 25 }).returning();
      ids[k] = o.id;
      ids[`hook_${k}`] = o.hookToken;
    }
    for (const [u, role] of [['owner', 'owner'], ['admin', 'admin'], ['member', 'member'], ['viewer', 'viewer']] as const) await db.insert(schema.memberships).values({ orgId: ids.org1!, userId: ids[u]!, role });
    await db.insert(schema.memberships).values({ orgId: ids.org2!, userId: ids.rival!, role: 'owner' });
    const [s1] = await db.insert(schema.sites).values({ orgId: ids.org1!, domain: `northwind-${sfx}.com`, country: 'United States', verificationToken: token(), verifiedAt: new Date() }).returning();
    const [s2] = await db.insert(schema.sites).values({ orgId: ids.org2!, domain: `rival-${sfx}.com`, country: 'United States', verificationToken: token(), verifiedAt: new Date() }).returning();
    ids.site1 = s1.id;
    ids.site2 = s2.id;
    ids.domain1 = s1.domain;

    // keys made the way an admin makes them
    for (const [name, scopes] of [['runner', ['read', 'run']], ['reader', ['read']], ['adminkey', ['read', 'admin']]] as const) {
      const r = await as('admin', 'POST', `/api/orgs/${ids.org1}/api-keys`, { name, scopes, expiresInDays: 30 });
      expect(r.statusCode).toBe(200);
      keys[name] = r.json().token;
    }
  });
  afterAll(async () => {
    await app?.close();
  });

  const audit = () => ({ mode: 'audit', websiteId: ids.site1, reportType: 'site_audit' });
  /** the runs started so far finish, so the next start is not a duplicate of them (that warning is tested on its own above) */
  const finishRuns = async () => {
    const { eq } = await import('drizzle-orm');
    await db.update(schema.runs).set({ status: 'completed' }).where(eq(schema.runs.orgId, ids.org1!));
  };

  // ------------------------------------------------------------------ write API
  describe('write API', () => {
    it('a key with "run" starts a run as its creator, through the engine front door, and the run names the key', async () => {
      const r = await withKey(keys.runner!, 'POST', '/api/v1/runs', audit());
      expect(r.statusCode).toBe(201);
      const run = await db.query.runs.findFirst({ where: (t, { eq }) => eq(t.id, r.json().run.id) });
      expect(run).toMatchObject({ orgId: ids.org1, userId: ids.admin, mode: 'audit', status: 'accepted' });
      expect(run!.apiKeyId).toBeTruthy();
      expect(st.starts.at(-1)).toMatchObject({ domain: ids.domain1 });
      const page = await as('admin', 'GET', `/api/orgs/${ids.org1}/runs/${run!.id}`);
      expect(page.json().run.apiKeyName).toBe('runner');
    });

    it('the run just started makes the next one a duplicate: 409 until its warning is acknowledged', async () => {
      const r = await withKey(keys.runner!, 'POST', '/api/v1/runs', audit());
      expect([r.statusCode, r.json().code]).toEqual([409, 'confirm_needed']);
      expect(r.json().needsAcknowledge[0]).toMatch(/^active:/);
      const ok = await withKey(keys.runner!, 'POST', '/api/v1/runs', { ...audit(), acknowledge: r.json().needsAcknowledge });
      expect(ok.statusCode).toBe(201);
    });

    it('a read key cannot, and another company’s website is not found', async () => {
      expect((await withKey(keys.reader!, 'POST', '/api/v1/runs', audit())).json().code).toBe('scope_missing');
      expect((await withKey(keys.runner!, 'POST', '/api/v1/runs', { ...audit(), websiteId: ids.site2 })).statusCode).toBe(404);
    });

    it('Idempotency-Key: two concurrent repeats start ONE run (the check holds the company lock); another body is 422', async () => {
      await finishRuns();
      const before = st.starts.length;
      st.startDelayMs = 150;
      const h = { 'idempotency-key': `job-${randomBytes(4).toString('hex')}` };
      const [a, b] = await Promise.all([withKey(keys.runner!, 'POST', '/api/v1/runs', audit(), h), withKey(keys.runner!, 'POST', '/api/v1/runs', audit(), h)]);
      st.startDelayMs = 0;
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
      expect(a.json().run.id).toBe(b.json().run.id);
      expect(st.starts.length - before).toBe(1);
      const c = await withKey(keys.runner!, 'POST', '/api/v1/runs', { ...audit(), crawlPages: 400 }, h);
      expect([c.statusCode, c.json().code]).toEqual([422, 'idempotency_mismatch']);
    });

    it('the budget is the app’s own: a run over it is 402 and nothing starts', async () => {
      await finishRuns();
      await db.update(schema.organizations).set({ monthlyBudgetUsd: 0.01 }).where((await import('drizzle-orm')).eq(schema.organizations.id, ids.org1!));
      const before = st.starts.length;
      const r = await withKey(keys.runner!, 'POST', '/api/v1/runs', audit());
      expect([r.statusCode, r.json().code]).toEqual([402, 'budget']);
      expect(st.starts.length).toBe(before);
      await db.update(schema.organizations).set({ monthlyBudgetUsd: 25 }).where((await import('drizzle-orm')).eq(schema.organizations.id, ids.org1!));
    });

    it('a session: CSRF header required, a viewer cannot start, a member can', async () => {
      const url = '/api/v1/runs';
      const noCsrf = await app.inject({ method: 'POST', url, payload: audit(), headers: { cookie: `sid=${cookies.member}`, 'x-org-id': ids.org1! } });
      expect(noCsrf.statusCode).toBe(403);
      expect((await as('viewer', 'POST', url, audit(), { 'x-org-id': ids.org1! })).statusCode).toBe(403);
      expect((await as('member', 'POST', url, { ...audit(), dryRun: true }, { 'x-org-id': ids.org1! })).json()).toMatchObject({ dryRun: true, mode: 'audit' });
      expect((await as('rival', 'POST', url, audit(), { 'x-org-id': ids.org1! })).statusCode).toBe(404);
    });

    it('a key whose creator lost the role stops starting work', async () => {
      const { eq, and } = await import('drizzle-orm');
      await db.update(schema.memberships).set({ role: 'viewer' }).where(and(eq(schema.memberships.orgId, ids.org1!), eq(schema.memberships.userId, ids.admin!)));
      expect((await withKey(keys.runner!, 'POST', '/api/v1/runs', audit())).json().code).toBe('key_owner_gone');
      await db.update(schema.memberships).set({ role: 'admin' }).where(and(eq(schema.memberships.orgId, ids.org1!), eq(schema.memberships.userId, ids.admin!)));
    });
  });

  // ------------------------------------------------------------------ webhooks
  describe('event webhooks', () => {
    it('admin only; Slack addresses checked; the signing secret is shown once and the address never', async () => {
      expect((await as('member', 'POST', `/api/orgs/${ids.org1}/webhooks`, { name: 'x', url: 'https://hooks.example.com/a', events: ['run.failed'] })).statusCode).toBe(403);
      expect((await as('admin', 'POST', `/api/orgs/${ids.org1}/webhooks`, { name: 'x', format: 'slack', url: 'https://hooks.example.com/a', events: ['run.failed'] })).statusCode).toBe(400);
      const r = await as('admin', 'POST', `/api/orgs/${ids.org1}/webhooks`, { name: 'warehouse', url: 'https://hooks.example.com/ascentra?t=secret123', events: ['rank.changed', 'report.ready'], websiteIds: [ids.site1] });
      expect(r.statusCode).toBe(200);
      expect(r.json().secret).toMatch(/^whsec_/);
      ids.ep1 = r.json().endpoint.id;
      const list = await as('admin', 'GET', `/api/orgs/${ids.org1}/webhooks`);
      expect(JSON.stringify(list.json())).not.toContain('secret123');
      expect(JSON.stringify(list.json())).not.toContain('whsec_');
      expect(list.json().items[0]).toMatchObject({ urlHost: 'hooks.example.com', hasSecret: true });
      // another company's website is refused, another company cannot see or remove it
      expect((await as('admin', 'POST', `/api/orgs/${ids.org1}/webhooks`, { name: 'y', url: 'https://hooks.example.com/b', events: ['run.failed'], websiteIds: [ids.site2] })).statusCode).toBe(400);
      expect((await as('rival', 'DELETE', `/api/orgs/${ids.org2}/webhooks/${ids.ep1}`)).statusCode).toBe(404);
      expect((await as('rival', 'DELETE', `/api/orgs/${ids.org1}/webhooks/${ids.ep1}`)).statusCode).toBe(404);
    });

    it('a rank-tracker callback becomes rank.changed + report.ready, signed, logged as sent', async () => {
      st.sent.length = 0;
      st.answer = () => ({ status: 200, text: 'ok', headers: {} });
      const cb = await app.inject({
        method: 'POST',
        url: `/api/hooks/n8n/${ids.hook_org1}`,
        payload: { stage: 'rank_tracker', status: 'progress', domain: ids.domain1, ladder_id: 'lad_1', head_keyword: 'e invoicing', positions: [{ keyword: 'peppol', position: 4, previous: 12, delta: 8 }] },
      });
      expect(cb.statusCode).toBe(200);
      expect(await until(async () => st.sent.filter((s) => s.url.startsWith('https://hooks.example.com/')).length >= 2)).toBe(true);
      const types = st.sent.map((s) => s.headers['X-Ascentra-Event']).sort();
      expect(types).toEqual(['rank.changed', 'report.ready']);
      const { verifyBody } = await import('../src/services/reportDelivery');
      const s0 = st.sent[0]!;
      expect(s0.headers['X-Ascentra-Signature']).toMatch(/^sha256=/);
      expect(verifyBody('nope', s0.headers['X-Ascentra-Timestamp']!, s0.body, s0.headers['X-Ascentra-Signature']!)).toBe(false);
      expect(await until(async () => (await as('admin', 'GET', `/api/orgs/${ids.org1}/webhooks`)).json().deliveries.filter((d: { status: string }) => d.status === 'sent').length >= 2)).toBe(true);
    });

    it('a failing receiver is retried with backoff by the timer; a 410 switches the endpoint off', async () => {
      st.answer = () => ({ status: 503, text: 'busy', headers: {} });
      await app.inject({ method: 'POST', url: `/api/hooks/n8n/${ids.hook_org1}`, payload: { stage: 'site_tracker', status: 'progress', domain: ids.domain1, alerts: [] } });
      const { eq } = await import('drizzle-orm');
      expect(await until(async () => !!(await db.query.webhookDeliveries.findFirst({ where: (t, o) => o.and(o.eq(t.endpointId, ids.ep1!), o.eq(t.status, 'failed')) })))).toBe(true);
      const failed = (await db.query.webhookDeliveries.findFirst({ where: (t, o) => o.and(o.eq(t.endpointId, ids.ep1!), o.eq(t.status, 'failed')) }))!;
      expect(failed.attempts).toBe(1);
      expect(failed.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now() + 30_000);
      await db.update(schema.webhookDeliveries).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(schema.webhookDeliveries.id, failed.id));
      st.answer = () => ({ status: 410, text: 'gone', headers: {} });
      const { webhookTick } = await import('../src/services/webhooks');
      await webhookTick({ info: () => {}, error: () => {} });
      const after = (await db.query.webhookDeliveries.findFirst({ where: (t, o) => o.eq(t.id, failed.id) }))!;
      expect([after.status, after.attempts]).toEqual(['gave_up', 2]);
      const ep = (await db.query.webhookEndpoints.findFirst({ where: (t, o) => o.eq(t.id, ids.ep1!) }))!;
      expect(ep.enabled).toBe(false);
      expect(ep.disabledReason).toContain('410');
    });
  });

  // ------------------------------------------------------------------ issue trackers
  describe('issue trackers', () => {
    const jira = (r: { url: string; method: string }) => {
      if (r.url.endsWith('/rest/api/3/project/SEO')) return { status: 200, text: JSON.stringify({ name: 'Website' }), headers: {} };
      if (r.url.includes('/issuetypes')) return { status: 200, text: JSON.stringify({ issueTypes: [{ id: '10001', name: 'Task' }] }), headers: {} };
      if (r.method === 'POST' && r.url.endsWith('/rest/api/3/issue')) return { status: 201, text: JSON.stringify({ id: '10050', key: 'SEO-42' }), headers: {} };
      if (r.url.includes('/rest/api/3/issue/SEO-42')) return { status: 200, text: JSON.stringify({ fields: { status: { name: 'Done', statusCategory: { key: 'done' } } } }), headers: {} };
      return { status: 404, text: '{}', headers: {} };
    };

    it('connecting is admin only; the token never comes back', async () => {
      st.answer = jira;
      const body = { kind: 'jira', siteUrl: 'https://northwind.atlassian.net', email: 'dana@northwind.example', apiToken: 'ATATT-super-secret-token', projectKey: 'SEO' };
      expect((await as('member', 'POST', `/api/orgs/${ids.org1}/integrations/trackers`, body)).statusCode).toBe(403);
      const r = await as('admin', 'POST', `/api/orgs/${ids.org1}/integrations/trackers`, body);
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ kind: 'jira', status: 'ok', config: { projectName: 'Website', issueTypeId: '10001' } });
      expect(JSON.stringify(r.json())).not.toContain('super-secret');
      expect(JSON.stringify((await as('admin', 'GET', `/api/orgs/${ids.org1}/integrations`)).json())).not.toContain('super-secret');
      const stored = await db.query.integrations.findFirst({ where: (t, o) => o.eq(t.orgId, ids.org1!) });
      expect(stored!.secret.startsWith('v1:')).toBe(true);
    });

    it('one finding = one ticket, even when two people push it at the same moment; the state is read back', async () => {
      st.tables.auditFindings = [{ audit_id: 'aud_1', finding_key: 'content|no h1', title: 'Pages with no H1', category: 'Content', severity: 'High', affected_count: 12, audited_at: '2026-10-17T06:00:00Z', evidence: '12 of 200 pages', sample_urls: '["https://n.example/a"]' }];
      st.sent.length = 0;
      const body = { websiteId: ids.site1, source: { type: 'finding', auditId: 'aud_1', findingKey: 'content|no h1' } };
      const [a, b] = await Promise.all([as('member', 'POST', `/api/orgs/${ids.org1}/issues`, body), as('admin', 'POST', `/api/orgs/${ids.org1}/issues`, body)]);
      const codes = [a.statusCode, b.statusCode].sort();
      expect(codes[0]).toBe(200);
      expect(st.sent.filter((s) => s.method === 'POST' && s.url.endsWith('/rest/api/3/issue')).length).toBe(1);
      const again = await as('member', 'POST', `/api/orgs/${ids.org1}/issues`, body);
      expect(again.json()).toMatchObject({ existing: true, issue: { remoteKey: 'SEO-42', remoteUrl: 'https://northwind.atlassian.net/browse/SEO-42' } });
      const created = JSON.parse(st.sent.find((s) => s.method === 'POST' && s.url.endsWith('/rest/api/3/issue'))!.body);
      expect(JSON.stringify(created.fields.description)).toContain('12 of 200 pages');
      // the viewer reads, cannot push; the rival company sees nothing
      expect((await as('viewer', 'POST', `/api/orgs/${ids.org1}/issues`, body)).statusCode).toBe(403);
      expect((await as('rival', 'GET', `/api/orgs/${ids.org2}/issues`)).json().items).toEqual([]);
      expect((await as('rival', 'POST', `/api/orgs/${ids.org2}/issues`, { ...body, websiteId: ids.site1 })).statusCode).toBe(404);
      // refresh: status read back (the 5-minute guard is moved aside for the test)
      await db.update(schema.issueLinks).set({ syncedAt: new Date(Date.now() - 600_000) });
      const ref = await as('member', 'POST', `/api/orgs/${ids.org1}/issues/refresh`);
      expect(ref.json().items[0]).toMatchObject({ remoteState: 'done', remoteStatus: 'Done' });
    });

    it('through the API, pushing needs "run"', async () => {
      const body = { websiteId: ids.site1, source: { type: 'finding', auditId: 'aud_1', findingKey: 'content|no h1' } };
      expect((await withKey(keys.reader!, 'POST', '/api/v1/issues', body)).statusCode).toBe(403);
      expect((await withKey(keys.runner!, 'POST', '/api/v1/issues', body)).json().existing).toBe(true);
    });
  });

  // ------------------------------------------------------------------ export
  describe('warehouse export', () => {
    it('S3-compatible: connect (a test object), run now: one signed object per table, the run logged; again at once is 429', async () => {
      st.tables.rankHistory = [{ keyword: 'peppol', position: 4, checked_at: '2026-10-12T06:00:00Z', ladder_id: 'lad_1', domain: 'x' }];
      st.sent.length = 0;
      st.answer = () => ({ status: 200, text: '', headers: {} });
      const body = { kind: 's3', name: 'R2', provider: 'r2', accountId: 'f'.repeat(32), bucket: 'nw-seo', prefix: 'ascentra', accessKeyId: 'AKIDTEST1234', secretAccessKey: 'super-secret-access-key', tables: ['rank_history', 'runs'], format: 'ndjson' };
      const c = await as('admin', 'POST', `/api/orgs/${ids.org1}/integrations/exports`, body);
      expect(c.statusCode).toBe(200);
      expect(c.json().secretHint).toBe('key AKID…1234');
      expect(st.sent[0]!.url).toMatch(/^https:\/\/f{32}\.r2\.cloudflarestorage\.com\/nw-seo\/ascentra\/_ascentra\/dt%3D/);
      st.sent.length = 0;
      const run = await as('admin', 'POST', `/api/orgs/${ids.org1}/integrations/${c.json().id}/run`);
      expect(run.json()).toMatchObject({ status: 'ok', trigger: 'manual' });
      expect(run.json().tables.map((t: { table: string; rows: number }) => [t.table, t.rows > 0])).toEqual([
        ['rank_history', true],
        ['runs', true],
      ]);
      const put = st.sent.find((s) => s.url.includes('/rank_history/'))!;
      expect(put.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDTEST1234\//);
      expect(JSON.parse(put.body.split('\n')[0]!)).toMatchObject({ company_id: ids.org1, website_domain: ids.domain1, keyword: 'peppol', position: 4 });
      const runsObj = st.sent.find((s) => s.url.includes('/runs/'))!;
      expect(runsObj.body).not.toContain(ids.org2!);
      expect((await as('admin', 'POST', `/api/orgs/${ids.org1}/integrations/${c.json().id}/run`)).statusCode).toBe(429);
      expect((await as('rival', 'POST', `/api/orgs/${ids.org2}/integrations/${c.json().id}/run`)).statusCode).toBe(404);
    });

    it('the same rows through the API, for the Looker Studio connector', async () => {
      const r = await withKey(keys.reader!, 'GET', `/api/v1/websites/${ids.site1}/tables/rank_history?since=2026-10-01`);
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ table: 'rank_history', items: [{ keyword: 'peppol', position: 4 }] });
      expect((await withKey(keys.reader!, 'GET', `/api/v1/websites/${ids.site2}/tables/rank_history`)).statusCode).toBe(404);
      expect((await withKey(keys.reader!, 'GET', `/api/v1/websites/${ids.site1}/tables/secrets`)).statusCode).toBe(404);
    });
  });
});
