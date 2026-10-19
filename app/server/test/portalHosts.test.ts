import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// G5 (app/docs/WHITE_LABEL.md §2, §5), the portal host: the DNS proof (TXT + CNAME), one owner per host, a released host cannot be
// taken over with an old record, re-checks that lapse a host, strict hosts (421), the on-demand TLS ask, tenant resolution by host
// (a person on one agency's portal reaches nothing else), host-only cookies, the session hand-off, and branded e-mail senders.

vi.hoisted(() => {
  process.env.IDENTITY_KEY = 'ab'.repeat(32); // a test-only key
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.PORTAL_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.PORTAL_STRICT_HOSTS = 'true';
  process.env.PORTAL_CNAME_TARGET = 'portals.alaventra.app';
  process.env.APP_EXTRA_HOSTS = 'app.alaventra.app';
  process.env.SEO_MAIL_FROM = 'Alaventra <reports@alaventra.app>';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { setPortalDns, recheckDomains, invalidatePortalHosts } = await import('../src/services/portalHosts');
const { senderFor, setFromDns, checkFrom } = await import('../src/services/portalMail');
const { Client, signUp } = await import('./helpers/client');

type C = InstanceType<typeof Client>;
const PW = 'correct horse battery staple';
const HOST = 'seo.north-agency.com';

// DNS answered from tables
const txt = new Map<string, string[]>();
const cname = new Map<string, string[]>();
const addrs = new Map<string, string[]>();
const nx = () => Object.assign(new Error('not found'), { code: 'ENOTFOUND' });

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  setPortalDns({
    txt: async (n) => {
      const r = txt.get(n);
      if (!r) throw nx();
      return r.map((x) => [x]);
    },
    cname: async (n) => {
      const r = cname.get(n);
      if (!r) throw nx();
      return r;
    },
    addrs: async (n) => addrs.get(n) ?? [],
  });
});
afterAll(async () => {
  setPortalDns(null);
  await app.close();
});

const on = (host: string) => ({ host });
let owner: C;
let agency: { id: string };
let client: { id: string };
let person: C;
let domainId: string;
let token: string;

describe('claiming and proving a portal host', () => {
  it('refuses the platform\'s own hosts and private names; claims a public host with a fresh token', async () => {
    owner = (await signUp(app, 'owner@north-agency.com')).c;
    agency = (await owner.post('/api/orgs', { name: 'North Agency' })).body;
    // a standard company has no portal
    expect((await owner.post(`/api/orgs/${agency.id}/portal/domains`, { host: HOST })).status).toBe(404);
    await owner.post(`/api/orgs/${agency.id}/agency`);
    for (const bad of ['app.alaventra.app', 'x.alaventra.app', 'portals.alaventra.app', 'localhost', '10.0.0.1', 'seo.agency.test'])
      expect((await owner.post(`/api/orgs/${agency.id}/portal/domains`, { host: bad })).status, bad).toBe(400);
    const r = await owner.post(`/api/orgs/${agency.id}/portal/domains`, { host: `https://${HOST.toUpperCase()}/login` });
    expect(r.status, r.text).toBe(200);
    expect(r.body).toMatchObject({ host: HOST, status: 'pending', txtName: `_portal-verification.${HOST}`, cnameTarget: 'portals.alaventra.app' });
    domainId = r.body.id;
    token = r.body.txtValue;
    // a second claim of the same host by the same agency returns the same row (and token)
    expect((await owner.post(`/api/orgs/${agency.id}/portal/domains`, { host: HOST })).body.txtValue).toBe(token);
  });

  it('verifies only when the TXT record and the CNAME are both there', async () => {
    let v = await owner.post(`/api/orgs/${agency.id}/portal/domains/${domainId}/verify`);
    expect(v.body.check).toMatchObject({ ok: false, txt: 'missing', cname: 'missing' });
    txt.set(`_portal-verification.${HOST}`, [token]);
    v = await owner.post(`/api/orgs/${agency.id}/portal/domains/${domainId}/verify`);
    expect(v.body.check).toMatchObject({ ok: false, txt: 'found', cname: 'missing' });
    cname.set(HOST, ['elsewhere.example.net.']);
    v = await owner.post(`/api/orgs/${agency.id}/portal/domains/${domainId}/verify`);
    expect(v.body.check).toMatchObject({ ok: false, cname: 'elsewhere' });
    cname.set(HOST, ['portals.alaventra.app.']);
    v = await owner.post(`/api/orgs/${agency.id}/portal/domains/${domainId}/verify`);
    expect(v.body.check.ok).toBe(true);
    expect(v.body.domain).toMatchObject({ status: 'verified', lastCheckOk: true });
    const log = (await owner.get(`/api/orgs/${agency.id}/audit`)).body.items.map((e: { action: string }) => e.action);
    expect(log).toEqual(expect.arrayContaining(['portal.domain_claimed', 'portal.domain_verified', 'portal.domain_check_failed']));
  });

  it('an apex that cannot be a CNAME may resolve to the same addresses as the target', async () => {
    const { checkPortalDomain } = await import('../src/services/portalHosts');
    txt.set('_portal-verification.northagency.com', ['portal-verification=apex1']);
    addrs.set('portals.alaventra.app', ['203.0.113.10']);
    addrs.set('northagency.com', ['203.0.113.10']);
    expect((await checkPortalDomain('northagency.com', 'apex1')).ok).toBe(true);
    addrs.set('northagency.com', ['198.51.100.7']);
    expect(await checkPortalDomain('northagency.com', 'apex1')).toMatchObject({ ok: false, cname: 'elsewhere' });
  });
});

describe('takeover', () => {
  it('a verified host cannot be claimed by another company; after release, an old TXT record proves nothing', async () => {
    const other = (await signUp(app, 'boss@rival.agency')).c;
    const rival = (await other.post('/api/orgs', { name: 'Rival' })).body;
    await other.post(`/api/orgs/${rival.id}/agency`);
    expect((await other.post(`/api/orgs/${rival.id}/portal/domains`, { host: HOST })).status).toBe(409);
    // North releases it but leaves its TXT record and the CNAME in DNS (the dangling-record case)
    expect((await owner.del(`/api/orgs/${agency.id}/portal/domains/${domainId}`)).status).toBe(200);
    const claim = await other.post(`/api/orgs/${rival.id}/portal/domains`, { host: HOST });
    expect(claim.status).toBe(200);
    expect(claim.body.txtValue).not.toBe(token);
    const v = await other.post(`/api/orgs/${rival.id}/portal/domains/${claim.body.id}/verify`);
    expect(v.body.check).toMatchObject({ ok: false, txt: 'wrong' });
    // the rival goes away; North claims again with a NEW token, which must be published
    await other.del(`/api/orgs/${rival.id}/portal/domains/${claim.body.id}`);
    const again = await owner.post(`/api/orgs/${agency.id}/portal/domains`, { host: HOST });
    expect(again.body.txtValue).not.toBe(token);
    domainId = again.body.id;
    token = again.body.txtValue;
    txt.set(`_portal-verification.${HOST}`, [token]);
    expect((await owner.post(`/api/orgs/${agency.id}/portal/domains/${domainId}/verify`)).body.domain.status).toBe('verified');
  });
});

describe('serving the portal host', () => {
  it('strict hosts: an unknown host gets a plain 421; ours and the verified portal host are served', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/me', headers: on('phish.example.org') });
    expect(r.statusCode).toBe(421);
    expect(r.body).not.toMatch(/Alaventra/);
    expect((await app.inject({ method: 'GET', url: '/api/health', headers: on('phish.example.org') })).statusCode).not.toBe(421);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: on('localhost:5173') })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: on('app.alaventra.app') })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: on(HOST) })).statusCode).toBe(200);
  });

  it('the TLS ask answers yes for our hosts and verified portal hosts only', async () => {
    const ask = async (d: string) => (await app.inject({ method: 'GET', url: `/api/portal/tls-allow?domain=${encodeURIComponent(d)}`, headers: on('localhost') })).statusCode;
    expect(await ask(HOST)).toBe(200);
    expect(await ask('app.alaventra.app')).toBe(200);
    expect(await ask('phish.example.org')).toBe(404);
    expect(await ask('localhost')).toBe(404);
  });

  it('the page context names the agency on its host and nothing on ours; our icons are not served there', async () => {
    await owner.put(`/api/orgs/${agency.id}/branding`, { whiteLabel: true, productName: 'North Insights', accent: '#0f766e' });
    const ctx = await app.inject({ method: 'GET', url: '/api/portal/context', headers: on(HOST) });
    expect(JSON.parse(ctx.body)).toMatchObject({ host: HOST, brand: { name: 'North Insights', accent: '#0f766e' } });
    expect((await app.inject({ method: 'GET', url: '/api/portal/context', headers: on('localhost') })).body).toBe('null');
    expect((await app.inject({ method: 'GET', url: '/favicon.ico', headers: on(HOST) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/brand/alaventra-mark-white.svg', headers: on(HOST) })).statusCode).toBe(404);
  });

  it('a person on the portal host reaches only that agency and its clients; the cookie is host-only', async () => {
    client = (await owner.post(`/api/orgs/${agency.id}/clients`, { name: 'Acme' })).body;
    const inv = await owner.post(`/api/orgs/${client.id}/invitations`, { email: 'ceo@acme.example.com', role: 'client_viewer' });
    // the invitation link points at the agency's portal address
    expect(inv.body.inviteUrl.startsWith(`http://${HOST}/invite/`)).toBe(true);
    person = new Client(app);
    const s = await person.post('/api/auth/signup', { name: 'Ceo', email: 'ceo@acme.example.com', password: PW, inviteToken: inv.body.inviteUrl.split('/invite/')[1] }, on(HOST));
    expect(s.status, s.text).toBe(200);
    const cookie = String((s.headers['set-cookie'] as string[] | string) ?? '');
    expect(cookie).toMatch(/sid=/);
    expect(cookie.toLowerCase()).not.toContain('domain=');
    // the same person also owns an unrelated company: invisible on the agency's portal, visible on the app host
    const own = (await person.post('/api/orgs', { name: 'Side Project' }, on('localhost'))).body;
    const portalMe = (await person.get('/api/me', on(HOST))).body;
    expect(portalMe.orgs.map((o: { id: string }) => o.id)).toEqual([client.id]);
    expect((await person.get('/api/me', on('localhost'))).body.orgs.map((o: { id: string }) => o.id).sort()).toEqual([client.id, own.id].sort());
    expect((await person.get(`/api/orgs/${own.id}`, on(HOST))).status).toBe(404);
    expect((await person.get(`/api/orgs/${own.id}`, on('localhost'))).status).toBe(200);
    expect((await person.get(`/api/orgs/${client.id}`, on(HOST))).body.brand.name).toBe('North Insights');
  });

  it('the hand-off opens a session on the portal host once, with the same sign-in method', async () => {
    const h = await person.post('/api/portal/handoff', { host: HOST }, on('localhost'));
    expect(h.status, h.text).toBe(200);
    expect(h.body.url.startsWith(`http://${HOST}/api/portal/handoff/`)).toBe(true);
    const path = h.body.url.replace(`http://${HOST}`, '');
    // only on that host
    const wrong = await app.inject({ method: 'GET', url: path, headers: on('localhost') });
    expect(wrong.statusCode).toBe(404);
    const fresh = new Client(app);
    const r = await fresh.get(path, on(HOST));
    expect(r.status).toBe(303);
    expect(r.headers.location).toBe('/');
    expect((await fresh.get('/api/me', on(HOST))).body.user.email).toBe('ceo@acme.example.com');
    expect((await new Client(app).get(path, on(HOST))).status).toBe(400);
    // a host the person has nothing to do with, or an unknown one
    expect((await person.post('/api/portal/handoff', { host: 'phish.example.org' }, on('localhost'))).status).toBe(404);
    const stranger = (await signUp(app, 'stranger@else.example.com')).c;
    expect((await stranger.post('/api/portal/handoff', { host: HOST })).status).toBe(403);
  });
});

describe('re-checks', () => {
  it('a host whose proof is gone lapses after three failed checks and is no longer served; a pass restores it', async () => {
    txt.delete(`_portal-verification.${HOST}`);
    for (let i = 0; i < 3; i++) {
      await db.update(schema.portalDomains).set({ lastCheckAt: new Date(Date.now() - 7 * 3600_000) }).where(eq(schema.portalDomains.id, domainId));
      await recheckDomains();
    }
    const row = await db.query.portalDomains.findFirst({ where: eq(schema.portalDomains.id, domainId) });
    expect(row).toMatchObject({ status: 'lapsed', failures: 3 });
    invalidatePortalHosts();
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: on(HOST) })).statusCode).toBe(421);
    expect((await app.inject({ method: 'GET', url: `/api/portal/tls-allow?domain=${HOST}`, headers: on('localhost') })).statusCode).toBe(404);
    txt.set(`_portal-verification.${HOST}`, [token]);
    await db.update(schema.portalDomains).set({ lastCheckAt: new Date(Date.now() - 7 * 3600_000) }).where(eq(schema.portalDomains.id, domainId));
    expect(await recheckDomains()).toMatchObject({ restored: 1 });
    invalidatePortalHosts();
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: on(HOST) })).statusCode).toBe(200);
    const log = (await owner.get(`/api/orgs/${agency.id}/audit`)).body.items.map((e: { action: string }) => e.action);
    expect(log).toEqual(expect.arrayContaining(['portal.domain_lapsed', 'portal.domain_verified']));
  });
});

describe('branded e-mail', () => {
  it('client workspaces send under the agency\'s name and reply-to; a custom From needs SPF and DKIM', async () => {
    // a name that could break the address header is refused
    expect((await owner.put(`/api/orgs/${agency.id}/portal/mail`, { senderName: 'North "Insights" <x@y>', replyTo: '', fromMailboxId: null, dkimSelector: '' })).status).toBe(400);
    const put = await owner.put(`/api/orgs/${agency.id}/portal/mail`, { senderName: '', replyTo: 'team@north-agency.com', fromMailboxId: null, dkimSelector: '' });
    expect(put.status, put.text).toBe(200);
    const clientRow = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, client.id) }))!;
    const s = await senderFor(clientRow);
    expect(s).toMatchObject({ brandName: 'North Insights', from: '"North Insights" <reports@alaventra.app>', replyTo: 'team@north-agency.com' });
    expect(s.buttonColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(s.via).toBeUndefined();
    // a standard company keeps ours
    expect((await senderFor(null)).brandName).toBe('Alaventra');
    // a client person's own account e-mails (verification, password) come from the agency and open its portal address; a person
    // with any other company keeps ours
    const { senderForUser } = await import('../src/services/portalMail');
    const ceo = (await db.query.users.findFirst({ where: eq(schema.users.email, 'ceo@acme.example.com') }))!;
    const own = await senderForUser(ceo.id);
    expect(own.sender.brandName).toBe('Alaventra'); // the CEO also owns "Side Project"
    const solo = (await db.query.users.findFirst({ where: eq(schema.users.email, 'owner@north-agency.com') }))!;
    expect((await senderForUser(solo.id)).sender.brandName).toBe('Alaventra');
    await db.delete(schema.memberships).where(eq(schema.memberships.userId, ceo.id));
    await db.insert(schema.memberships).values({ orgId: client.id, userId: ceo.id, role: 'client_viewer' });
    const branded = await senderForUser(ceo.id);
    expect(branded.sender.brandName).toBe('North Insights');
    expect(branded.baseUrl).toBe(`http://${HOST}`);

    // a mailbox of the agency whose domain has SPF but no DKIM cannot be the sender
    const [mb] = await db
      .insert(schema.mailboxes)
      .values({ orgId: agency.id, fromName: 'North', fromEmail: 'hello@north-agency.com', smtpHost: 'smtp.north-agency.com', imapHost: 'imap.north-agency.com', username: 'hello', secret: 'x', status: 'active' })
      .returning();
    setFromDns({ check: async () => ({ spf: 'pass', dmarc: 'pass', dkim: 'unknown', checkedAt: new Date().toISOString(), notes: ['No DKIM key found under the common selectors'] }), txt: async () => [] });
    const bad = await owner.put(`/api/orgs/${agency.id}/portal/mail`, { senderName: 'North', replyTo: '', fromMailboxId: mb.id, dkimSelector: '' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('from_not_verified');
    // the selector they name has the key
    setFromDns({ check: async () => ({ spf: 'pass', dmarc: 'pass', dkim: 'unknown', checkedAt: new Date().toISOString(), notes: [] }), txt: async (n) => (n === 'nk1._domainkey.north-agency.com' ? [['v=DKIM1; p=MIIB']] : []) });
    expect((await checkFrom('hello@north-agency.com', 'nk1')).ok).toBe(true);
    const good = await owner.put(`/api/orgs/${agency.id}/portal/mail`, { senderName: 'North', replyTo: '', fromMailboxId: mb.id, dkimSelector: 'nk1' });
    expect(good.status, good.text).toBe(200);
    expect(good.body).toMatchObject({ fromEmail: 'hello@north-agency.com', effectiveFrom: '"North" <hello@north-agency.com>' });
    const s2 = await senderFor(clientRow);
    expect(s2.from).toBe('"North" <hello@north-agency.com>');
    expect(typeof s2.via).toBe('function');
    // another company's mailbox can never be chosen
    const [foreign] = await db.insert(schema.mailboxes).values({ orgId: client.id, fromName: 'A', fromEmail: 'a@acme.example.com', smtpHost: 's', imapHost: 'i', username: 'u', secret: 'x' }).returning();
    expect((await owner.put(`/api/orgs/${agency.id}/portal/mail`, { senderName: 'North', replyTo: '', fromMailboxId: foreign.id, dkimSelector: '' })).status).toBe(404);
    setFromDns(null);
  });
});
