import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// G1 phase 4, single sign-on, through the real app on a real Postgres, against a mock OIDC issuer and a SAML IdP with a locally
// generated key and certificate: domain proof, configuration, the test sign-in, JIT provisioning, the protocol checks (state, nonce,
// PKCE, audience, issuer, recipient, signature, expiry, replay, unsolicited answers), enforcement with the owner's break-glass, and
// isolation between companies.

vi.hoisted(() => {
  process.env.IDENTITY_KEY = 'ab'.repeat(32); // a test-only key
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { ssoDeps } = await import('../src/services/sso');
const { hotp, base32Decode, timeStep } = await import('../src/auth/totp');
const { Client, signUp } = await import('./helpers/client');
const { MockOidcIssuer, MockSamlIdp } = await import('./helpers/idp');

let app: FastifyInstance;
let idp: InstanceType<typeof MockOidcIssuer>;
let saml: InstanceType<typeof MockSamlIdp>;
const txt = new Map<string, string[]>();

beforeAll(async () => {
  app = await buildApp();
  idp = await new MockOidcIssuer().init();
  saml = await new MockSamlIdp().init();
  ssoDeps.fetch = idp.fetch as typeof ssoDeps.fetch;
  ssoDeps.resolveTxt = async (d: string) => {
    const r = txt.get(d);
    if (!r) throw Object.assign(new Error('no records'), { code: 'ENODATA' });
    return r.map((x) => [x]);
  };
});
afterAll(async () => {
  await app.close();
});

type C = InstanceType<typeof Client>;
const PW = 'correct horse battery staple';

/** a company with a verified domain; the owner has an authenticator app (needed to enforce) */
async function companyWithDomain(ownerEmail: string, name: string, domain: string) {
  const owner = await signUp(app, ownerEmail);
  const org = (await owner.c.post('/api/orgs', { name })).body;
  const start = await owner.c.post('/api/me/mfa/totp/start');
  await owner.c.post('/api/me/mfa/totp/confirm', { code: hotp(base32Decode(start.body.secret), timeStep()) });
  const d = await owner.c.post(`/api/orgs/${org.id}/sso/domains`, { domain });
  expect(d.status).toBe(200);
  txt.set(domain, ['v=spf1 -all', d.body.txtValue]);
  const v = await owner.c.post(`/api/orgs/${org.id}/sso/domains/${d.body.id}/verify`);
  expect(v.body.verified).toBe(true);
  return { owner: owner.c, org };
}

const oidcSettings = () => ({ protocol: 'oidc', oidc: { issuer: idp.issuer, clientId: idp.clientId, clientSecret: idp.clientSecret }, jitEnabled: true, defaultRole: 'member' });

/** one OIDC round trip in a browser `c`: start (by e-mail, or a test started by an admin), the IdP signs `user` in, the callback */
async function oidcRound(c: C, start: { email?: string; testOrg?: string }, user: Parameters<InstanceType<typeof MockOidcIssuer>['authorize']>[1], bend?: (q: { code: string; state: string }) => void) {
  let location: string;
  if (start.testOrg) location = (await c.post(`/api/orgs/${start.testOrg}/sso/connection/test`)).body.url;
  else location = String((await c.get(`/api/sso/start?email=${encodeURIComponent(start.email!)}`)).headers.location);
  const q = idp.authorize(location, user);
  bend?.(q);
  return c.get(`/api/sso/oidc/callback?code=${q.code}&state=${q.state}`);
}

async function oidcCompany(ownerEmail: string, name: string, domain: string) {
  const co = await companyWithDomain(ownerEmail, name, domain);
  expect((await co.owner.put(`/api/orgs/${co.org.id}/sso/connection`, oidcSettings())).status).toBe(200);
  // enabling needs a passing test
  expect((await co.owner.patch(`/api/orgs/${co.org.id}/sso/connection`, { enabled: true })).status).toBe(400);
  const t = await oidcRound(co.owner, { testOrg: co.org.id }, { sub: 'admin-sub', email: `it@${domain}`, name: 'IT Admin' });
  expect(t.headers.location).toBe(`/o/${co.org.id}/settings/sso?test=ok`);
  expect((await co.owner.patch(`/api/orgs/${co.org.id}/sso/connection`, { enabled: true })).status).toBe(200);
  return co;
}

describe('domains', () => {
  it('a domain is proven by DNS, cannot be a public mail provider, and belongs to one company', async () => {
    const owner = await signUp(app, 'o@dom-a.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Dom A' })).body;
    expect((await owner.c.post(`/api/orgs/${org.id}/sso/domains`, { domain: 'gmail.com' })).status).toBe(400);
    expect((await owner.c.post(`/api/orgs/${org.id}/sso/domains`, { domain: 'not a domain' })).status).toBe(400);
    const d = await owner.c.post(`/api/orgs/${org.id}/sso/domains`, { domain: 'https://Shared-Dom.TEST/' });
    expect(d.body).toMatchObject({ domain: 'shared-dom.test', verified: false });
    expect(d.body.txtValue).toMatch(/^alaventra-sso=/);
    const miss = await owner.c.post(`/api/orgs/${org.id}/sso/domains/${d.body.id}/verify`);
    expect(miss.body.verified).toBe(false);
    txt.set('shared-dom.test', ['alaventra-sso=wrong']);
    expect((await owner.c.post(`/api/orgs/${org.id}/sso/domains/${d.body.id}/verify`)).body.verified).toBe(false);
    txt.set('shared-dom.test', [d.body.txtValue]);
    expect((await owner.c.post(`/api/orgs/${org.id}/sso/domains/${d.body.id}/verify`)).body.verified).toBe(true);
    // another company can neither claim nor verify it
    const other = await signUp(app, 'o@dom-b.test');
    const org2 = (await other.c.post('/api/orgs', { name: 'Dom B' })).body;
    expect((await other.c.post(`/api/orgs/${org2.id}/sso/domains`, { domain: 'shared-dom.test' })).status).toBe(409);
    // nor see or remove the first company's
    expect((await other.c.get(`/api/orgs/${org.id}/sso`)).status).toBe(404);
    expect((await other.c.del(`/api/orgs/${org2.id}/sso/domains/${d.body.id}`)).status).toBe(404);
  });
});

describe('OIDC', () => {
  it('test sign-in, then JIT provisioning with the default role, matched by subject next time', async () => {
    const co = await oidcCompany('owner@north-oidc.test', 'North OIDC', 'north-oidc.test');
    const conn = (await co.owner.get(`/api/orgs/${co.org.id}/sso`)).body.connection;
    expect(conn).toMatchObject({ protocol: 'oidc', enabled: true, enforced: false, oidc: { issuer: idp.issuer, clientId: idp.clientId, hasClientSecret: true }, lastTest: { ok: true } });
    expect(conn.lastTest.message).toContain('it@north-oidc.test');
    expect(JSON.stringify(conn)).not.toContain(idp.clientSecret);
    // the test made no account and no session for the IdP's user
    expect(await db.query.users.findFirst({ where: eq(schema.users.email, 'it@north-oidc.test') })).toBeUndefined();

    // discovery from the sign-in page
    expect((await new Client(app).post('/api/sso/discover', { email: 'new@north-oidc.test' })).body).toMatchObject({ sso: true, orgName: 'North OIDC' });
    expect((await new Client(app).post('/api/sso/discover', { email: 'x@nowhere.test' })).body).toEqual({ sso: false });

    const b = new Client(app);
    const r = await oidcRound(b, { email: 'new@north-oidc.test' }, { sub: 'okta-123', email: 'New@North-OIDC.test', name: 'Nia New' });
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('/');
    const me = (await b.get('/api/me')).body;
    expect(me.user).toMatchObject({ email: 'new@north-oidc.test', name: 'Nia New', emailVerified: true, hasPassword: false });
    expect(me.orgs[0]).toMatchObject({ id: co.org.id, role: 'member' });
    const s = await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, me.user.id) });
    expect(s).toMatchObject({ authMethod: 'sso', ssoOrgId: co.org.id });
    // a changed address at the IdP still finds the same person by subject
    const again = new Client(app);
    await oidcRound(again, { email: 'new@north-oidc.test' }, { sub: 'okta-123', email: 'nia.renamed@north-oidc.test' });
    expect((await again.get('/api/me')).body.user.id).toBe(me.user.id);
    const log = (await co.owner.get(`/api/orgs/${co.org.id}/audit?category=sso`)).body.items.map((e: { action: string }) => e.action);
    expect(log).toEqual(expect.arrayContaining(['sso.user_provisioned', 'sso.connection_tested', 'sso.domain_verified', 'sso.connection_saved']));
  });

  it('refuses a stolen state, a wrong nonce, another audience, another issuer, an expired token and an address off the domain', async () => {
    const co = await oidcCompany('owner@checks-oidc.test', 'Checks OIDC', 'checks-oidc.test');
    const user = { sub: 'u1', email: 'u1@checks-oidc.test' };
    // the callback in a browser that did not start the sign-in (login CSRF)
    const started = new Client(app);
    const loc = String((await started.get('/api/sso/start?email=u1@checks-oidc.test')).headers.location);
    const q = idp.authorize(loc, user);
    const other = new Client(app);
    expect((await other.get(`/api/sso/oidc/callback?code=${q.code}&state=${q.state}`)).headers.location).toBe('/login?error=sso_state');
    for (const tamper of [{ nonce: 'other' }, { aud: 'someone-else' }, { iss: 'https://evil.test' }, { expSeconds: -600 }]) {
      idp.tamper = tamper;
      const c = new Client(app);
      const r = await oidcRound(c, { email: 'u1@checks-oidc.test' }, user);
      expect(r.headers.location, JSON.stringify(tamper)).toBe('/login?error=sso_failed');
      expect(c.jar.has('sid')).toBe(false);
    }
    idp.tamper = {};
    const off = new Client(app);
    expect((await oidcRound(off, { email: 'u1@checks-oidc.test' }, { sub: 'u2', email: 'u2@elsewhere.test' })).headers.location).toBe('/login?error=sso_domain');
    // the state is single use
    const c = new Client(app);
    const loc2 = String((await c.get('/api/sso/start?email=u1@checks-oidc.test')).headers.location);
    const q2 = idp.authorize(loc2, user);
    expect((await c.get(`/api/sso/oidc/callback?code=${q2.code}&state=${q2.state}`)).headers.location).toBe('/');
    c.jar.set('sso_flow', q2.state);
    expect((await c.get(`/api/sso/oidc/callback?code=${q2.code}&state=${q2.state}`)).headers.location).toBe('/login?error=sso_state');
    const failures = (await co.owner.get(`/api/orgs/${co.org.id}/audit?outcome=failure`)).body.items;
    expect(failures.some((e: { action: string }) => e.action === 'auth.sso.failed')).toBe(true);
  });

  it('a suspended account is refused before JIT gives it a membership (admin panel)', async () => {
    const co = await oidcCompany('owner@sus-oidc.test', 'Sus OIDC', 'sus-oidc.test');
    await signUp(app, 'held@sus-oidc.test');
    await db.update(schema.users).set({ suspendedAt: new Date() }).where(eq(schema.users.email, 'held@sus-oidc.test'));
    const c = new Client(app);
    const r = await oidcRound(c, { email: 'held@sus-oidc.test' }, { sub: 'held-1', email: 'held@sus-oidc.test' });
    expect(r.headers.location).toBe('/login?error=account_suspended');
    expect(c.jar.has('sid')).toBe(false);
    const u = await db.query.users.findFirst({ where: eq(schema.users.email, 'held@sus-oidc.test') });
    expect(await db.query.memberships.findFirst({ where: eq(schema.memberships.userId, u!.id) })).toBeUndefined();
    expect(co.org.id).toBeTruthy();
  });

  it('without JIT, only existing members get in', async () => {
    const co = await oidcCompany('owner@nojit.test', 'No JIT', 'nojit.test');
    await co.owner.put(`/api/orgs/${co.org.id}/sso/connection`, { ...oidcSettings(), oidc: { issuer: idp.issuer, clientId: idp.clientId }, jitEnabled: false });
    // settings that do not touch the IdP keep it switched on
    expect((await co.owner.get(`/api/orgs/${co.org.id}/sso`)).body.connection).toMatchObject({ enabled: true, jitEnabled: false });
    const c = new Client(app);
    expect((await oidcRound(c, { email: 'x@nojit.test' }, { sub: 'x', email: 'x@nojit.test' })).headers.location).toBe('/login?error=sso_not_provisioned');
    // a changed IdP switches it off until tested again
    await co.owner.put(`/api/orgs/${co.org.id}/sso/connection`, { ...oidcSettings(), oidc: { issuer: idp.issuer, clientId: 'another-client', clientSecret: 'x' } });
    expect((await co.owner.get(`/api/orgs/${co.org.id}/sso`)).body.connection).toMatchObject({ enabled: false, lastTest: null });
  });

  it('asks for the person\'s own second step when the company does not count its IdP as one', async () => {
    const co = await oidcCompany('owner@strict-sso.test', 'Strict SSO', 'strict-sso.test');
    await co.owner.put(`/api/orgs/${co.org.id}/security`, { requireMfa: false, mfaTrustGoogle: false, mfaTrustSso: false, idleTimeoutMinutes: null, auditRetentionDays: 365 });
    // the owner's address is on the domain? no, give a member a factor and an SSO identity
    const m = new Client(app);
    await oidcRound(m, { email: 'mfa@strict-sso.test' }, { sub: 'mfa1', email: 'mfa@strict-sso.test' });
    const start = await m.post('/api/me/mfa/passkeys/options');
    expect(start.status).toBe(200);
    const s = await m.post('/api/me/mfa/totp/start');
    await m.post('/api/me/mfa/totp/confirm', { code: hotp(base32Decode(s.body.secret), timeStep()) });
    const b = new Client(app);
    const r = await oidcRound(b, { email: 'mfa@strict-sso.test' }, { sub: 'mfa1', email: 'mfa@strict-sso.test' });
    expect(r.headers.location).toBe('/login/mfa');
    expect(b.jar.has('sid')).toBe(false);
    expect(b.jar.has('mfa_flow')).toBe(true);
  });
});

describe('SAML 2.0', () => {
  async function samlCompany(ownerEmail: string, name: string, domain: string) {
    const co = await companyWithDomain(ownerEmail, name, domain);
    const put = await co.owner.put(`/api/orgs/${co.org.id}/sso/connection`, { protocol: 'saml', saml: { entityId: saml.entityId, ssoUrl: saml.ssoUrl, certificates: [saml.cert] }, jitEnabled: true, defaultRole: 'viewer' });
    expect(put.status).toBe(200);
    const view = (await co.owner.get(`/api/orgs/${co.org.id}/sso`)).body;
    expect(view.connection.saml.certificates[0]).toMatchObject({ subject: 'CN=northwind.okta.test', expired: false });
    expect(view.sp.samlAcsUrl).toBe(`http://localhost:5173/api/sso/saml/${view.connection.id}/acs`);
    return { ...co, connId: view.connection.id as string, acs: view.sp.samlAcsUrl as string, sp: view.sp.samlEntityId as string };
  }
  const post = (c: C, acs: string, SAMLResponse: string, RelayState: string) => {
    const raw = new Client(app, { csrf: false });
    raw.jar = c.jar;
    return raw.req('POST', new URL(acs).pathname, new URLSearchParams({ SAMLResponse, RelayState }).toString(), { 'content-type': 'application/x-www-form-urlencoded' });
  };
  /** start a sign-in in browser c; returns the request the SP issued */
  const startIn = async (c: C, email: string) => MockSamlIdp.requestOf(String((await c.get(`/api/sso/start?email=${encodeURIComponent(email)}`)).headers.location));

  it('serves SP metadata; a test passes; a signed assertion signs a person in (JIT, default role) and cannot be replayed', async () => {
    const co = await samlCompany('owner@north-saml.test', 'North SAML', 'north-saml.test');
    const md = await new Client(app).get(`/api/sso/saml/${co.connId}/metadata`);
    expect(md.headers['content-type']).toContain('samlmetadata+xml');
    expect(md.text).toContain(`entityID="${co.sp}"`);
    expect(md.text).toContain(`Location="${co.acs}"`);

    const testStart = MockSamlIdp.requestOf((await co.owner.post(`/api/orgs/${co.org.id}/sso/connection/test`)).body.url);
    expect(testStart.destination).toBe(saml.ssoUrl);
    const t = await post(co.owner, co.acs, saml.response({ inResponseTo: testStart.id, acs: co.acs, audience: co.sp, email: 'it@north-saml.test' }), testStart.relayState);
    expect(t.headers.location).toBe(`/o/${co.org.id}/settings/sso?test=ok`);
    expect((await co.owner.patch(`/api/orgs/${co.org.id}/sso/connection`, { enabled: true })).status).toBe(200);

    const b = new Client(app);
    const req = await startIn(b, 'dana@north-saml.test');
    const resp = saml.response({ inResponseTo: req.id, acs: co.acs, audience: co.sp, email: 'dana@north-saml.test', name: 'Dana Doe' });
    const ok = await post(b, co.acs, resp, req.relayState);
    expect(ok.headers.location).toBe('/');
    expect((await b.get('/api/me')).body.orgs[0]).toMatchObject({ id: co.org.id, role: 'viewer' });
    // the very same answer again: refused
    const c2 = new Client(app);
    const req2 = await startIn(c2, 'dana@north-saml.test');
    expect((await post(c2, co.acs, resp, req2.relayState)).headers.location).toBe('/login?error=sso_failed');
    expect(c2.jar.has('sid')).toBe(false);
  });

  it('refuses forged, tampered, expired, misaddressed, foreign and unsolicited answers', async () => {
    const co = await samlCompany('owner@checks-saml.test', 'Checks SAML', 'checks-saml.test');
    // enable through a passing test
    const ts = MockSamlIdp.requestOf((await co.owner.post(`/api/orgs/${co.org.id}/sso/connection/test`)).body.url);
    await post(co.owner, co.acs, saml.response({ inResponseTo: ts.id, acs: co.acs, audience: co.sp, email: 'it@checks-saml.test' }), ts.relayState);
    await co.owner.patch(`/api/orgs/${co.org.id}/sso/connection`, { enabled: true });
    const other = await new MockSamlIdp().init();

    const cases: [string, (id: string) => string][] = [
      ['signed with another key', (id) => saml.response({ inResponseTo: id, acs: co.acs, audience: co.sp, email: 'x@checks-saml.test', signWith: other.privateKey })],
      ['address changed after signing', (id) => saml.response({ inResponseTo: id, acs: co.acs, audience: co.sp, email: 'x@checks-saml.test', tamper: (x) => x.replace(/x@checks-saml\.test/g, 'boss@checks-saml.test') })],
      ['another audience', (id) => saml.response({ inResponseTo: id, acs: co.acs, audience: 'https://other-sp.test', email: 'x@checks-saml.test' })],
      ['expired', (id) => saml.response({ inResponseTo: id, acs: co.acs, audience: co.sp, email: 'x@checks-saml.test', notOnOrAfterMin: -10 })],
      ['meant for another recipient', (id) => saml.response({ inResponseTo: id, acs: co.acs, audience: co.sp, email: 'x@checks-saml.test', recipient: 'https://other-sp.test/acs' })],
      ['issued by another IdP', (id) => saml.response({ inResponseTo: id, acs: co.acs, audience: co.sp, email: 'x@checks-saml.test', issuer: 'http://evil.test/idp' })],
      ['answering a request we never made', () => saml.response({ inResponseTo: '_never-issued', acs: co.acs, audience: co.sp, email: 'x@checks-saml.test' })],
      ['unsolicited (IdP-initiated)', () => saml.response({ inResponseTo: null, acs: co.acs, audience: co.sp, email: 'x@checks-saml.test' })],
    ];
    for (const [why, make] of cases) {
      const c = new Client(app);
      const r = await startIn(c, 'x@checks-saml.test');
      const res = await post(c, co.acs, make(r.id), r.relayState);
      expect(res.headers.location, why).toBe('/login?error=sso_failed');
      expect(c.jar.has('sid'), why).toBe(false);
    }
    // each was refused for its own reason (not, say, all for one bug)
    const reasons = (await co.owner.get(`/api/orgs/${co.org.id}/audit?outcome=failure&limit=20`)).body.items.map((e: { details: { reason: string } }) => e.details.reason).reverse();
    const expected = [/Invalid signature/, /Invalid signature/, /audience mismatch/, /subject confirmation/, /Recipient/, /issued by http:\/\/evil\.test/, /InResponseTo is not valid/, /InResponseTo is missing/];
    expect(reasons).toHaveLength(expected.length);
    expected.forEach((re, i) => expect(reasons[i]).toMatch(re));
    // a RelayState we never issued
    const c = new Client(app);
    const r = await startIn(c, 'x@checks-saml.test');
    expect((await post(c, co.acs, saml.response({ inResponseTo: r.id, acs: co.acs, audience: co.sp, email: 'x@checks-saml.test' }), 'made-up')).headers.location).toBe('/login?error=sso_state');
    // a certificate that is not one is refused when saved
    expect((await co.owner.put(`/api/orgs/${co.org.id}/sso/connection`, { protocol: 'saml', saml: { entityId: saml.entityId, ssoUrl: saml.ssoUrl, certificates: ['x'.repeat(200)] } })).status).toBe(400);
    expect((await co.owner.put(`/api/orgs/${co.org.id}/sso/connection`, { protocol: 'saml', saml: { entityId: saml.entityId, ssoUrl: 'http://insecure.test/sso', certificates: [saml.cert] } })).status).toBe(400);
    // saving without a certificate keeps the stored one, and an unchanged IdP stays switched on
    const keep = await co.owner.put(`/api/orgs/${co.org.id}/sso/connection`, { protocol: 'saml', saml: { entityId: saml.entityId, ssoUrl: saml.ssoUrl }, jitEnabled: false, defaultRole: 'viewer' });
    expect(keep.status).toBe(200);
    expect(keep.body).toMatchObject({ enabled: true, jitEnabled: false });
    expect(keep.body.saml.certificates).toHaveLength(1);
  });
});

describe('enforcement', () => {
  it('only an owner with two-step verification enforces; then passwords are refused on the domain except the owner\'s', async () => {
    const co = await oidcCompany('owner@enforce.test', 'Enforce Co', 'enforce.test');
    // a member on the domain with a password, signed in before enforcement
    const inv = await co.owner.post(`/api/orgs/${co.org.id}/invitations`, { email: 'pat@enforce.test', role: 'admin' });
    const pat = new Client(app);
    await pat.post('/api/auth/signup', { name: 'Pat', email: 'pat@enforce.test', password: PW, inviteToken: inv.body.inviteUrl.split('/invite/')[1] });
    expect((await pat.get('/api/me')).body.user.email).toBe('pat@enforce.test');
    // an admin cannot enforce
    expect((await pat.patch(`/api/orgs/${co.org.id}/sso/connection`, { enforced: true })).status).toBe(403);
    const r = await co.owner.patch(`/api/orgs/${co.org.id}/sso/connection`, { enforced: true });
    expect(r.status).toBe(200);
    expect(r.body.enforced).toBe(true);
    // Pat's password session is gone, and the password no longer works
    expect((await pat.get('/api/me')).body).toBeNull();
    const login = await new Client(app).post('/api/auth/login', { email: 'pat@enforce.test', password: PW });
    expect(login.status).toBe(403);
    expect(login.body).toMatchObject({ code: 'sso_required', ssoUrl: '/api/sso/start?email=pat%40enforce.test' });
    // a wrong password says the same (no password oracle)
    expect((await new Client(app).post('/api/auth/login', { email: 'pat@enforce.test', password: 'wrong wrong 1' })).body.code).toBe('sso_required');
    // nobody signs up on the domain with a password
    expect((await new Client(app).post('/api/auth/signup', { name: 'Z', email: 'zed@enforce.test', password: PW })).body.code).toBe('sso_required');
    // the owner (break-glass) still signs in with the password (+ their second step)
    const o = await new Client(app).post('/api/auth/login', { email: 'owner@enforce.test', password: PW });
    expect(o.body.mfaRequired).toBe(true);
    // SSO works for Pat
    const c = new Client(app);
    expect((await oidcRound(c, { email: 'pat@enforce.test' }, { sub: 'pat', email: 'pat@enforce.test' })).headers.location).toBe('/');
    expect((await c.get('/api/me')).body.orgs[0].role).toBe('admin');
    const log = (await co.owner.get(`/api/orgs/${co.org.id}/audit?category=sso`)).body.items;
    expect(log.find((e: { action: string }) => e.action === 'sso.enforced').details).toMatchObject({ domains: ['enforce.test'], sessionsSignedOut: 1 });
    // switching sign-on off lifts enforcement
    await co.owner.patch(`/api/orgs/${co.org.id}/sso/connection`, { enabled: false });
    expect((await new Client(app).post('/api/auth/login', { email: 'pat@enforce.test', password: PW })).status).toBe(200);
  });

  it('configuration is for owners and admins of that company only', async () => {
    const co = await oidcCompany('owner@roles-sso.test', 'Roles SSO', 'roles-sso.test');
    const inv = await co.owner.post(`/api/orgs/${co.org.id}/invitations`, { email: 'mem@else.test', role: 'member' });
    const mem = new Client(app);
    await mem.post('/api/auth/signup', { name: 'Mem', email: 'mem@else.test', password: PW, inviteToken: inv.body.inviteUrl.split('/invite/')[1] });
    for (const r of [
      await mem.get(`/api/orgs/${co.org.id}/sso`),
      await mem.put(`/api/orgs/${co.org.id}/sso/connection`, oidcSettings()),
      await mem.post(`/api/orgs/${co.org.id}/sso/connection/test`),
      await mem.del(`/api/orgs/${co.org.id}/sso/connection`),
    ])
      expect(r.status).toBe(403);
    const stranger = await signUp(app, 'stranger@else2.test');
    expect((await stranger.c.get(`/api/orgs/${co.org.id}/sso`)).status).toBe(404);
    expect((await stranger.c.post(`/api/orgs/${co.org.id}/sso/connection/test`)).status).toBe(404);
  });
});
