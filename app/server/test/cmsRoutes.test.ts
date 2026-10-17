import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CmsHttpRequest, CmsHttpResponse } from '../src/services/cms/http';

// G2: the CMS publishing routes end to end against a real Postgres (the migrations, the real app with its session, CSRF and role
// checks), with only the CMS's HTTP API and the engine's run start replaced. Run it with a throwaway database:
//   CMS_DB_TEST=1 DATABASE_URL=postgres://… npx vitest run test/cmsRoutes.test.ts
// Without CMS_DB_TEST it is skipped (the unit tests above cover the rule and the request shapes without a database).

const DB = process.env.CMS_DB_TEST === '1';
const env = vi.hoisted(() => {
  process.env.MAILBOX_KEY = process.env.MAILBOX_KEY || 'a'.repeat(64);
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.APP_URL = 'https://app.example.com';
  return { engineRuns: [] as Record<string, unknown>[] };
});

// the engine's "I published a page" run: recorded, with a real runs row so the publish record can point at it
vi.mock('../src/services/runs', async (orig) => {
  const real = await orig<typeof import('../src/services/runs')>();
  return {
    ...real,
    createRun: vi.fn(async (a: { org: { id: string }; user: { id: string } }, input: Record<string, unknown>) => {
      env.engineRuns.push(input);
      const { db, schema } = await import('../src/db');
      const [row] = await db.insert(schema.runs).values({ orgId: a.org.id, userId: a.user.id, siteId: String(input.siteId), mode: 'published', title: 'Publish check', status: 'accepted', input }).returning();
      return row;
    }),
  };
});

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(24).toString('base64url');

describe.skipIf(!DB)('CMS publishing routes (real database)', () => {
  let app: FastifyInstance;
  let setCmsTransport: (t: ((r: CmsHttpRequest) => Promise<CmsHttpResponse>) | null) => unknown;
  const ids: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  const sent: CmsHttpRequest[] = [];
  // a fake WordPress: posts by slug
  const posts = new Map<string, { id: number; slug: string; status: string }>();
  let nextId = 40;

  const req = (who: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown, csrf = true) =>
    app.inject({ method, url, payload: payload as object, headers: { cookie: `sid=${cookies[who]}`, ...(csrf ? { 'x-requested-with': 'fetch' } : {}) } });

  beforeAll(async () => {
    const { runMigrations, db, schema } = await import('../src/db');
    await runMigrations();
    ({ setCmsTransport } = await import('../src/services/cms/http'));
    const { buildApp } = await import('../src/app');
    app = await buildApp();
    await app.ready();

    const sfx = randomBytes(4).toString('hex');
    const user = async (k: string) => {
      const [u] = await db.insert(schema.users).values({ email: `${k}-${sfx}@example.org`, name: k[0]!.toUpperCase() + k.slice(1), emailVerifiedAt: new Date() }).returning();
      ids[k] = u.id;
      const t = token();
      await db.insert(schema.sessions).values({ id: sha(t), userId: u.id, expiresAt: new Date(Date.now() + 864e5) });
      cookies[k] = t;
    };
    for (const k of ['owner', 'admin', 'member', 'viewer', 'rival']) await user(k);
    const org = async (k: string) => {
      const [o] = await db.insert(schema.organizations).values({ name: k, slug: `${k}-${sfx}`, hookToken: token(), monthlyBudgetUsd: 25 }).returning();
      ids[k] = o.id;
    };
    await org('org1');
    await org('org2');
    for (const [u, role] of [['owner', 'owner'], ['admin', 'admin'], ['member', 'member'], ['viewer', 'viewer']] as const) await db.insert(schema.memberships).values({ orgId: ids.org1!, userId: ids[u]!, role });
    await db.insert(schema.memberships).values({ orgId: ids.org2!, userId: ids.rival!, role: 'owner' });
    const [s1] = await db.insert(schema.sites).values({ orgId: ids.org1!, domain: `techand-${sfx}.ai`, country: 'AE', verificationToken: token(), verifiedAt: new Date() }).returning();
    const [s2] = await db.insert(schema.sites).values({ orgId: ids.org2!, domain: `rival-${sfx}.com`, country: 'AE', verificationToken: token(), verifiedAt: new Date() }).returning();
    ids.site1 = s1.id;
    ids.site2 = s2.id;
    ids.domain1 = s1.domain;

    const words = Array.from({ length: 90 }, (_, i) => `w${i}`).join(' ');
    const content = (slug: string, extra: Record<string, unknown> = {}, html = `<article><h1>Guide</h1><p>${words}</p></article>`) => ({
      status: 'completed',
      stage: 'content',
      keyword: slug.replace(/-/g, ' '),
      domain: s1.domain,
      qa_publishable: true,
      qa_summary: 'Quality check passed',
      html,
      markdown: `# Guide\n\n${words}`,
      meta: { title: `Guide to ${slug}`, h1: 'Guide', slug, meta_description: 'A guide.', domain: s1.domain, publishable: true },
      ...extra,
    });
    const report = async (k: string, orgId: string, siteId: string, payload: Record<string, unknown>) => {
      const [r] = await db.insert(schema.reports).values({ orgId, siteId, stage: 'content', status: String(payload.status), title: k, payload }).returning();
      ids[k] = r.id;
    };
    await report('good', ids.org1!, s1.id, content('e-invoicing-uae'));
    await report('failed', ids.org1!, s1.id, content('vat-guide', { qa_publishable: false, qa_not_ready: true, qa_reasons: ['12 placeholders left'] }));
    await report('holes', ids.org1!, s1.id, content('corporate-tax', {}, `<article><p>${words} From [Price] a month, [Confirm: AED 50m].</p></article>`));
    await report('adopt', ids.org1!, s1.id, content('peppol-uae'));
    await report('foreign', ids.org2!, s2.id, { ...content('rival-page'), domain: s2.domain, meta: { title: 'R', slug: 'rival-page', domain: s2.domain, publishable: true } });

    posts.set('peppol-uae', { id: 99, slug: 'peppol-uae', status: 'draft' });
    setCmsTransport(async (r) => {
      sent.push(r);
      const ok = (status: number, json: unknown): CmsHttpResponse => ({ status, headers: {}, text: JSON.stringify(json), json });
      const u = r.url;
      if (/\/users\/me/.test(u)) return ok(200, { id: 1, name: 'Editor', capabilities: { edit_posts: true, publish_posts: true, unfiltered_html: true } });
      if (r.method === 'OPTIONS' || /\/wp-json\/$/.test(u)) return ok(200, {});
      const slug = u.match(/[?&]slug=([^&]+)/)?.[1];
      if (r.method === 'GET' && slug) return ok(200, [...posts.values()].filter((p) => p.slug === slug).map((p) => ({ id: p.id, link: `https://blog.example.org/?p=${p.id}`, status: p.status })));
      const one = u.match(/\/wp\/v2\/posts\/(\d+)/);
      if (r.method === 'GET' && one) {
        const p = [...posts.values()].find((x) => x.id === Number(one[1]));
        return p ? ok(200, { id: p.id, status: p.status, link: p.status === 'publish' ? `https://${s1.domain}/${p.slug}/` : `https://blog.example.org/?p=${p.id}` }) : ok(404, {});
      }
      if (r.method === 'POST' && /\/wp\/v2\/posts(\/\d+)?$/.test(u)) {
        const b = JSON.parse(String(r.body));
        const p = one ? [...posts.values()].find((x) => x.id === Number(one[1]))! : { id: ++nextId, slug: b.slug, status: 'draft' };
        p.status = b.status;
        posts.set(p.slug, p);
        return ok(one ? 200 : 201, { id: p.id, status: p.status, link: p.status === 'publish' ? `https://${s1.domain}/${p.slug}/` : `https://blog.example.org/?p=${p.id}` });
      }
      return ok(404, { message: 'no route' });
    });
  });

  afterAll(async () => {
    setCmsTransport(null);
    await app?.close();
    const { sqlClient } = await import('../src/db');
    await sqlClient.end({ timeout: 5 });
  });

  const site1 = () => `/api/orgs/${ids.org1}/sites/${ids.site1}/cms`;
  const wpBody = { kind: 'wordpress', baseUrl: 'https://blog.example.org', username: 'editor', secret: 'abcd efgh ijkl mnop qrst' };

  it('connecting is for admins, needs the CSRF header, and refuses private addresses', async () => {
    expect((await req('viewer', 'POST', `${site1()}/connections`, wpBody)).statusCode).toBe(403);
    expect((await req('member', 'POST', `${site1()}/connections`, wpBody)).statusCode).toBe(403);
    expect((await req('admin', 'POST', `${site1()}/connections`, wpBody, false)).statusCode).toBe(403);
    for (const baseUrl of ['https://10.0.0.5', 'https://localhost', 'http://blog.example.org', 'https://169.254.169.254/latest'])
      expect((await req('admin', 'POST', `${site1()}/connections`, { ...wpBody, baseUrl })).statusCode, baseUrl).toBe(400);
    const res = await req('admin', 'POST', `${site1()}/connections`, wpBody);
    expect(res.statusCode).toBe(200);
    ids.wp = res.json().connection.id;
    expect(res.json().connection).toMatchObject({ kind: 'wordpress', hasSecret: true, status: 'untested' });
    expect(res.body).not.toContain('abcd efgh');
  });

  it('the secret is sealed at rest and never returned, to anybody', async () => {
    const { db, schema } = await import('../src/db');
    const { eq } = await import('drizzle-orm');
    const row = await db.query.cmsConnections.findFirst({ where: eq(schema.cmsConnections.id, ids.wp!) });
    expect(row!.secret).toMatch(/^v1:/);
    expect(row!.secret).not.toContain('abcd');
    const list = await req('viewer', 'GET', `${site1()}/connections`);
    expect(list.statusCode).toBe(200);
    expect(list.body).not.toMatch(/abcd efgh|"secret"/);
  });

  it('another company sees nothing: its site, connection and report are 404s both ways', async () => {
    expect((await req('rival', 'GET', `${site1()}/connections`)).statusCode).toBe(404);
    expect((await req('rival', 'POST', `${site1()}/connections/${ids.wp}/test`)).statusCode).toBe(404);
    expect((await req('rival', 'GET', `/api/orgs/${ids.org1}/reports/${ids.good}/cms`)).statusCode).toBe(404);
    // org2's own report through org1's connection id, and org1's report through its own org path with org2's report id
    expect((await req('rival', 'POST', `/api/orgs/${ids.org2}/reports/${ids.foreign}/cms/publish`, { connectionId: ids.wp })).statusCode).toBe(404);
    expect((await req('admin', 'POST', `/api/orgs/${ids.org1}/reports/${ids.foreign}/cms/publish`, { connectionId: ids.wp })).statusCode).toBe(404);
  });

  it('test connection stores what the CMS answered', async () => {
    const res = await req('admin', 'POST', `${site1()}/connections/${ids.wp}/test`);
    expect(res.json()).toMatchObject({ ok: true, connection: { status: 'ok', settings: { account: 'Editor', canPublish: true, unfilteredHtml: true } } });
  });

  it('a page that failed its quality check is refused, recorded, and nothing reaches the CMS', async () => {
    sent.length = 0;
    const res = await req('member', 'POST', `/api/orgs/${ids.org1}/reports/${ids.failed}/cms/publish`, { connectionId: ids.wp });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false, record: { status: 'blocked', blockers: [{ code: 'not_ready' }] } });
    expect(res.json().record.blockers[0].message).toContain('12 placeholders left');
    expect(sent).toEqual([]);
  });

  it('placeholders are refused with the list', async () => {
    const res = await req('admin', 'POST', `/api/orgs/${ids.org1}/reports/${ids.holes}/cms/publish`, { connectionId: ids.wp, mode: 'live', confirmLive: true });
    expect(res.json().ok).toBe(false);
    expect(res.json().record.blockers[0]).toMatchObject({ code: 'placeholders', items: [{ token: '[Price]', count: 1, kind: 'placeholder' }, { token: '[Confirm: AED 50m]', count: 1, kind: 'review_note' }] });
  });

  it('the report state says who may do what', async () => {
    const v = (await req('viewer', 'GET', `/api/orgs/${ids.org1}/reports/${ids.good}/cms`)).json();
    expect(v).toMatchObject({ canDraft: false, canLive: false, readiness: { draftAllowed: true, liveAllowed: true }, page: { slug: 'e-invoicing-uae' } });
    expect((await req('member', 'GET', `/api/orgs/${ids.org1}/reports/${ids.good}/cms`)).json()).toMatchObject({ canDraft: true, canLive: false });
    expect((await req('admin', 'GET', `/api/orgs/${ids.org1}/reports/${ids.good}/cms`)).json()).toMatchObject({ canDraft: true, canLive: true });
  });

  it('a member sends a draft; the engine is not told (nothing is live)', async () => {
    const res = await req('member', 'POST', `/api/orgs/${ids.org1}/reports/${ids.good}/cms/publish`, { connectionId: ids.wp });
    expect(res.json()).toMatchObject({ ok: true, record: { status: 'sent', mode: 'draft' }, item: { remoteStatus: 'draft', slug: 'e-invoicing-uae' }, engine: { told: false } });
    ids.remote = res.json().item.remoteId;
    expect(env.engineRuns).toEqual([]);
    expect(sent.some((s) => s.method === 'POST' && /\/wp\/v2\/posts$/.test(s.url))).toBe(true);
  });

  it('live is for admins with the explicit confirmation; viewers cannot even send a draft', async () => {
    expect((await req('viewer', 'POST', `/api/orgs/${ids.org1}/reports/${ids.good}/cms/publish`, { connectionId: ids.wp })).statusCode).toBe(403);
    expect((await req('member', 'POST', `/api/orgs/${ids.org1}/reports/${ids.good}/cms/publish`, { connectionId: ids.wp, mode: 'live', confirmLive: true })).statusCode).toBe(403);
    const res = await req('admin', 'POST', `/api/orgs/${ids.org1}/reports/${ids.good}/cms/publish`, { connectionId: ids.wp, mode: 'live' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('confirm_live');
  });

  it('publishing live updates the SAME item and tells the engine', async () => {
    sent.length = 0;
    const res = await req('admin', 'POST', `/api/orgs/${ids.org1}/reports/${ids.good}/cms/publish`, { connectionId: ids.wp, mode: 'live', confirmLive: true });
    const j = res.json();
    expect(j).toMatchObject({ ok: true, item: { remoteId: ids.remote, remoteStatus: 'published' }, engine: { told: true } });
    expect(sent.some((s) => s.method === 'POST' && new RegExp(`/wp/v2/posts/${ids.remote}$`).test(s.url))).toBe(true);
    expect(sent.some((s) => s.method === 'POST' && /\/wp\/v2\/posts$/.test(s.url))).toBe(false);
    expect(env.engineRuns).toEqual([{ mode: 'published', siteId: ids.site1, keyword: 'e invoicing uae', publishedUrl: `https://${ids.domain1}/e-invoicing-uae/`, emailCopy: false }]);
    expect(j.record.engineRunId).toBeTruthy();
    expect(j.item.engineToldAt).toBeTruthy();
  });

  it('a live page is never replaced by a "draft"', async () => {
    const res = await req('member', 'POST', `/api/orgs/${ids.org1}/reports/${ids.good}/cms/publish`, { connectionId: ids.wp });
    expect(res.json()).toMatchObject({ ok: false, record: { status: 'blocked' } });
    expect(res.json().record.error).toMatch(/already live/);
  });

  it('an item the CMS already has under the slug is adopted, not duplicated', async () => {
    sent.length = 0;
    const res = await req('member', 'POST', `/api/orgs/${ids.org1}/reports/${ids.adopt}/cms/publish`, { connectionId: ids.wp });
    expect(res.json()).toMatchObject({ ok: true, item: { remoteId: '99' } });
    expect(res.json().record.notes.join(' ')).toMatch(/already in the CMS: it was updated, not duplicated/);
    expect(sent.some((s) => s.method === 'POST' && /\/wp\/v2\/posts\/99$/.test(s.url))).toBe(true);
  });

  it('two publishes at once: the second is refused while the first holds the item', async () => {
    const { db, schema } = await import('../src/db');
    const { eq } = await import('drizzle-orm');
    await db.update(schema.cmsItems).set({ lockUntil: new Date(Date.now() + 60_000) }).where(eq(schema.cmsItems.slug, 'peppol-uae'));
    const res = await req('member', 'POST', `/api/orgs/${ids.org1}/reports/${ids.adopt}/cms/publish`, { connectionId: ids.wp });
    expect(res.statusCode).toBe(409);
    await db.update(schema.cmsItems).set({ lockUntil: null }).where(eq(schema.cmsItems.slug, 'peppol-uae'));
  });

  it('"check if it is live" finds a draft published in the CMS and tells the engine once', async () => {
    posts.get('peppol-uae')!.status = 'publish';
    env.engineRuns.length = 0;
    const res = await req('member', 'POST', `/api/orgs/${ids.org1}/reports/${ids.adopt}/cms/refresh`, { connectionId: ids.wp });
    expect(res.json()).toMatchObject({ ok: true, item: { remoteStatus: 'published' }, engine: { told: true } });
    expect(env.engineRuns).toHaveLength(1);
    await req('member', 'POST', `/api/orgs/${ids.org1}/reports/${ids.adopt}/cms/refresh`, { connectionId: ids.wp });
    expect(env.engineRuns).toHaveLength(1);
  });

  it('the website state lists the items and the attempts', async () => {
    const s = (await req('viewer', 'GET', `${site1()}/state`)).json();
    expect(s.items.map((i: { slug: string; remoteStatus: string }) => `${i.slug}:${i.remoteStatus}`).sort()).toEqual(['e-invoicing-uae:published', 'peppol-uae:published']);
    expect(s.recent.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(s)).not.toContain('abcd efgh');
  });

  it('a webhook connection shows its signing secret once', async () => {
    const res = await req('owner', 'POST', `${site1()}/connections`, { kind: 'webhook', baseUrl: 'https://hooks.example.org/ascentra' });
    expect(res.json().signingSecret).toMatch(/^whsec_/);
    const list = await req('owner', 'GET', `${site1()}/connections`);
    expect(list.body).not.toContain(res.json().signingSecret);
  });

  it('removing a connection keeps the publishing history', async () => {
    expect((await req('member', 'DELETE', `${site1()}/connections/${ids.wp}`)).statusCode).toBe(403);
    expect((await req('admin', 'DELETE', `${site1()}/connections/${ids.wp}`)).statusCode).toBe(200);
    const s = (await req('viewer', 'GET', `${site1()}/state`)).json();
    expect(s.items).toEqual([]);
    expect(s.recent.some((r: { connectionLabel: string; status: string }) => r.connectionLabel === 'WordPress' && r.status === 'sent')).toBe(true);
  });
});
