import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// G1 phase 1 — two-step verification, end to end through the real app (buildApp) on a real Postgres (PGlite) with every migration:
// enrolment, the sign-in second step, replay and brute-force limits, recovery codes, passkeys with real signatures, step-up, and the
// company's "require two-step verification" policy. Design: app/docs/IDENTITY.md.

vi.hoisted(() => {
  process.env.IDENTITY_KEY = 'ab'.repeat(32); // a test-only key
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { hotp, base32Decode, timeStep } = await import('../src/auth/totp');
const { Client, signUp } = await import('./helpers/client');
const { SoftAuthenticator } = await import('./helpers/webauthn');

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

const code = (secret: string, step: number) => hotp(base32Decode(secret), step);
const userByEmail = async (email: string) => (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!;
/** makes every session of this person older than the step-up window */
const staleSessions = async (email: string) => {
  const u = await userByEmail(email);
  await db.update(schema.sessions).set({ reauthAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.sessions.userId, u.id));
};

/** signs up and switches the authenticator app on; returns the secret and the step the confirmation used */
async function withTotp(email: string) {
  const s = await signUp(app, email);
  const start = await s.c.post('/api/me/mfa/totp/start');
  expect(start.status).toBe(200);
  expect(start.body.uri).toMatch(/^otpauth:\/\/totp\//);
  expect(start.body.qrSvg).toContain('<svg');
  const step = timeStep();
  const conf = await s.c.post('/api/me/mfa/totp/confirm', { code: code(start.body.secret, step) });
  expect(conf.status).toBe(200);
  return { ...s, secret: start.body.secret as string, step, recoveryCodes: conf.body.newRecoveryCodes as string[] };
}

async function login(email: string, password = 'correct horse battery staple') {
  const c = new Client(app);
  const r = await c.post('/api/auth/login', { email, password });
  return { c, r };
}

describe('enrolment', () => {
  it('a wrong first code does not switch it on; the right one does, returns 10 recovery codes once, and marks the session', async () => {
    const s = await signUp(app, 'enrol@northwind.test');
    const start = await s.c.post('/api/me/mfa/totp/start');
    expect((await s.c.post('/api/me/mfa/totp/confirm', { code: '000000' })).status).toBe(400);
    expect((await s.c.get('/api/me')).body.user.mfaEnabled).toBe(false);
    const ok = await s.c.post('/api/me/mfa/totp/confirm', { code: code(start.body.secret, timeStep()) });
    expect(ok.status).toBe(200);
    expect(ok.body.newRecoveryCodes).toHaveLength(10);
    expect(ok.body.newRecoveryCodes[0]).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    expect(ok.body).toMatchObject({ enabled: true, totp: { enabled: true }, recoveryCodes: { remaining: 10, total: 10 }, sessionVerified: true });
    expect((await s.c.get('/api/me')).body.user.mfaEnabled).toBe(true);
    // the secret is sealed at rest, never in clear
    const u = await userByEmail('enrol@northwind.test');
    expect(u.mfaTotpSecret).toMatch(/^v1:/);
    expect(u.mfaTotpSecret).not.toContain(start.body.secret);
    expect(u.mfaTotpPending).toBeNull();
    // recovery codes are stored hashed
    const rows = await db.query.mfaRecoveryCodes.findMany({ where: eq(schema.mfaRecoveryCodes.userId, u.id) });
    expect(rows.map((r) => r.codeHash).join()).not.toContain(ok.body.newRecoveryCodes[0].replace(/-/g, ''));
  });

  it('starting enrolment needs a fresh proof (step-up)', async () => {
    const s = await signUp(app, 'stale@northwind.test');
    await staleSessions('stale@northwind.test');
    const r = await s.c.post('/api/me/mfa/totp/start');
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'reauth_required', methods: ['password'] });
    expect((await s.c.post('/api/auth/step-up', { method: 'password', password: 'wrong password 1' })).status).toBe(401);
    expect((await s.c.post('/api/auth/step-up', { method: 'password', password: s.password })).status).toBe(200);
    expect((await s.c.post('/api/me/mfa/totp/start')).status).toBe(200);
  });
});

describe('sign-in with two-step verification', () => {
  it('the password alone opens no session; the code completes it; a code is never accepted twice', async () => {
    const t = await withTotp('signin@northwind.test');
    const { c, r } = await login('signin@northwind.test');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ mfaRequired: true, methods: ['totp', 'recovery'], emailHint: 's…n@northwind.test' });
    expect(c.jar.has('sid')).toBe(false);
    expect((await c.get('/api/me')).body).toBeNull();
    // the code the enrolment used is spent
    const replay = await c.post('/api/auth/mfa/verify', { method: 'totp', code: code(t.secret, t.step) });
    expect(replay.status).toBe(401);
    const ok = await c.post('/api/auth/mfa/verify', { method: 'totp', code: code(t.secret, t.step + 1) });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe('signin@northwind.test');
    expect(c.jar.has('sid')).toBe(true);
    expect(c.jar.has('mfa_flow')).toBe(false);
    // the same code on a second sign-in is refused
    const again = await login('signin@northwind.test');
    expect((await again.c.post('/api/auth/mfa/verify', { method: 'totp', code: code(t.secret, t.step + 1) })).status).toBe(401);
    const sessions = await db.query.sessions.findMany({ where: eq(schema.sessions.userId, (await userByEmail('signin@northwind.test')).id) });
    expect(sessions.filter((x) => x.mfaAt).length).toBeGreaterThanOrEqual(2);
  });

  it('five wrong codes void the challenge: the password must be entered again', async () => {
    const t = await withTotp('brute@northwind.test');
    const { c } = await login('brute@northwind.test');
    for (let i = 0; i < 4; i++) expect((await c.post('/api/auth/mfa/verify', { method: 'totp', code: '000000' })).body.code).toBe('mfa_invalid');
    expect((await c.post('/api/auth/mfa/verify', { method: 'totp', code: '000000' })).body.code).toBe('mfa_flow_locked');
    const late = await c.post('/api/auth/mfa/verify', { method: 'totp', code: code(t.secret, t.step + 1) });
    expect(late.status).toBe(404);
    expect(c.jar.has('sid')).toBe(false);
  });

  it('a recovery code works once, in any case and with or without dashes', async () => {
    const t = await withTotp('recover@northwind.test');
    const one = t.recoveryCodes[3];
    const a = await login('recover@northwind.test');
    const ok = await a.c.post('/api/auth/mfa/verify', { method: 'recovery', code: one.toLowerCase().replace(/-/g, ' ') });
    expect(ok.status).toBe(200);
    expect(ok.body.recoveryCodesLeft).toBe(9);
    const b = await login('recover@northwind.test');
    expect((await b.c.post('/api/auth/mfa/verify', { method: 'recovery', code: one })).status).toBe(401);
  });

  it('the challenge cookie of one person cannot complete another person’s sign-in', async () => {
    const a = await withTotp('alice@northwind.test');
    await withTotp('bob@northwind.test');
    const bob = await login('bob@northwind.test');
    // Alice's valid code against Bob's challenge
    expect((await bob.c.post('/api/auth/mfa/verify', { method: 'totp', code: code(a.secret, a.step + 1) })).status).toBe(401);
    expect(bob.c.jar.has('sid')).toBe(false);
  });

  it('a wrong password never reaches the second step', async () => {
    await withTotp('wrongpw@northwind.test');
    const { c, r } = await login('wrongpw@northwind.test', 'not the password 9');
    expect(r.status).toBe(401);
    expect(c.jar.has('mfa_flow')).toBe(false);
  });
});

describe('passkeys (WebAuthn, real signatures)', () => {
  it('registers a passkey, signs in with it, refuses a wrong origin, a replayed challenge and another person’s key', async () => {
    const s = await signUp(app, 'passkey@northwind.test');
    const auth = new SoftAuthenticator('localhost', 'http://localhost:5173');
    const opts = await s.c.post('/api/me/mfa/passkeys/options');
    expect(opts.status).toBe(200);
    expect(opts.body.rp.id).toBe('localhost');
    const reg = await s.c.post('/api/me/mfa/passkeys', { name: 'MacBook Touch ID', response: auth.register(opts.body) });
    expect(reg.status).toBe(200);
    expect(reg.body.passkeys).toHaveLength(1);
    expect(reg.body.newRecoveryCodes).toHaveLength(10);

    const { c, r } = await login('passkey@northwind.test');
    expect(r.body.methods).toEqual(['webauthn', 'recovery']);
    const o1 = await c.post('/api/auth/mfa/webauthn/options');
    expect(o1.body.allowCredentials[0].id).toBe(auth.id);
    // signed for another site
    expect((await c.post('/api/auth/mfa/verify', { method: 'webauthn', response: auth.assert(o1.body, { origin: 'https://evil.test' }) })).status).toBe(401);
    const o2 = await c.post('/api/auth/mfa/webauthn/options');
    // an assertion over an old challenge
    expect((await c.post('/api/auth/mfa/verify', { method: 'webauthn', response: auth.assert(o1.body) })).status).toBe(401);
    const ok = await c.post('/api/auth/mfa/verify', { method: 'webauthn', response: auth.assert(o2.body) });
    expect(ok.status).toBe(200);
    const key = await db.query.webauthnCredentials.findFirst({ where: eq(schema.webauthnCredentials.credentialId, auth.id) });
    expect(key?.lastUsedAt).toBeTruthy();
    expect(key?.counter).toBeGreaterThan(0);

    // someone else's authenticator cannot answer this person's challenge
    const other = new SoftAuthenticator('localhost', 'http://localhost:5173');
    const x = await login('passkey@northwind.test');
    const o3 = await x.c.post('/api/auth/mfa/webauthn/options');
    expect((await x.c.post('/api/auth/mfa/verify', { method: 'webauthn', response: other.assert(o3.body) })).status).toBe(401);
  });

  it('removing a passkey needs step-up, only works on one’s own, and renames stay per person', async () => {
    const s = await signUp(app, 'pk2@northwind.test');
    const auth = new SoftAuthenticator('localhost', 'http://localhost:5173');
    const opts = await s.c.post('/api/me/mfa/passkeys/options');
    const reg = await s.c.post('/api/me/mfa/passkeys', { name: 'Key', response: auth.register(opts.body) });
    const id = reg.body.passkeys[0].id;
    const intruder = await signUp(app, 'intruder@northwind.test');
    expect((await intruder.c.patch(`/api/me/mfa/passkeys/${id}`, { name: 'mine now' })).status).toBe(404);
    expect((await intruder.c.del(`/api/me/mfa/passkeys/${id}`)).status).toBe(404);
    await staleSessions('pk2@northwind.test');
    const r = await s.c.del(`/api/me/mfa/passkeys/${id}`);
    expect(r.body).toMatchObject({ code: 'reauth_required', methods: ['webauthn', 'recovery'] });
    // a password is not a step-up for someone with a second factor
    expect((await s.c.post('/api/auth/step-up', { method: 'password', password: s.password })).status).toBe(400);
    const o = await s.c.post('/api/auth/step-up/webauthn/options');
    expect((await s.c.post('/api/auth/step-up', { method: 'webauthn', response: auth.assert(o.body) })).status).toBe(200);
    const del = await s.c.del(`/api/me/mfa/passkeys/${id}`);
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ enabled: false, recoveryCodes: { remaining: 0 } });
  });
});

describe('step-up limits', () => {
  it('five failed step-ups sign the session out', async () => {
    const s = await signUp(app, 'stepfail@northwind.test');
    for (let i = 0; i < 4; i++) expect((await s.c.post('/api/auth/step-up', { method: 'password', password: `wrong password ${i}` })).body.code).toBe('stepup_invalid');
    expect((await s.c.post('/api/auth/step-up', { method: 'password', password: 'wrong password 5' })).body.code).toBe('stepup_locked');
    expect((await s.c.get('/api/me')).body).toBeNull();
  });
});

describe('company policy: require two-step verification', () => {
  it('cannot be switched on by someone without a second factor; members without one see nothing of the company', async () => {
    const owner = await signUp(app, 'owner@acme.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Acme Corp' })).body;
    const policy = { requireMfa: true, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: null, auditRetentionDays: 365 };
    const refused = await owner.c.put(`/api/orgs/${org.id}/security`, policy);
    expect(refused.status).toBe(400);
    // the owner sets up an app, then can require it
    const start = await owner.c.post('/api/me/mfa/totp/start');
    const step = timeStep();
    await owner.c.post('/api/me/mfa/totp/confirm', { code: code(start.body.secret, step) });

    // a viewer is invited before the requirement
    const inv = await owner.c.post(`/api/orgs/${org.id}/invitations`, { email: 'viewer@acme.test', role: 'viewer' });
    const token = inv.body.inviteUrl.split('/invite/')[1];
    const viewer = new Client(app);
    expect((await viewer.post('/api/auth/signup', { name: 'Vee', email: 'viewer@acme.test', password: 'correct horse battery staple', inviteToken: token })).status).toBe(200);
    expect((await viewer.get(`/api/orgs/${org.id}`)).status).toBe(200);

    expect((await owner.c.put(`/api/orgs/${org.id}/security`, policy)).status).toBe(200);
    const blocked = await viewer.get(`/api/orgs/${org.id}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('mfa_enrolment_required');
    // every company route, not only the company itself
    expect((await viewer.get(`/api/orgs/${org.id}/members`)).body.code).toBe('mfa_enrolment_required');
    expect((await viewer.get('/api/me')).body.orgs[0].requiresMfa).toBe(true);
    // a policy change needs admin
    expect((await viewer.put(`/api/orgs/${org.id}/security`, { ...policy, requireMfa: false })).status).toBe(403);

    // the viewer enrols: in
    const vs = await viewer.post('/api/me/mfa/totp/start');
    const vstep = timeStep();
    await viewer.post('/api/me/mfa/totp/confirm', { code: code(vs.body.secret, vstep) });
    expect((await viewer.get(`/api/orgs/${org.id}`)).status).toBe(200);

    // a session that has not used its factor (signed in before enrolling, say) is asked to verify, not to enrol
    const v = await userByEmail('viewer@acme.test');
    await db.update(schema.sessions).set({ mfaAt: null }).where(eq(schema.sessions.userId, v.id));
    expect((await viewer.get(`/api/orgs/${org.id}`)).body.code).toBe('mfa_verification_required');
    expect((await viewer.post('/api/auth/step-up', { method: 'totp', code: code(vs.body.secret, vstep + 1) })).status).toBe(200);
    expect((await viewer.get(`/api/orgs/${org.id}`)).status).toBe(200);

    // the owner sees who has two-step verification; the viewer does not get that column
    const ownerView = (await owner.c.get(`/api/orgs/${org.id}/members`)).body.members;
    expect(ownerView.every((m: { mfaEnabled?: boolean }) => m.mfaEnabled === true)).toBe(true);
    const viewerView = (await viewer.get(`/api/orgs/${org.id}/members`)).body.members;
    expect(viewerView.some((m: object) => 'mfaEnabled' in m)).toBe(false);
  });

  it('the last factor cannot be removed while a company requires one', async () => {
    const owner = await withTotp('lastfactor@acme2.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Acme Two' })).body;
    expect((await owner.c.put(`/api/orgs/${org.id}/security`, { requireMfa: true, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: 30, auditRetentionDays: 90 })).status).toBe(200);
    const r = await owner.c.del('/api/me/mfa/totp');
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('Acme Two');
    // the stored policy reads back whole
    expect((await owner.c.get(`/api/orgs/${org.id}/security`)).body).toEqual({ requireMfa: true, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: 30, auditRetentionDays: 90 });
    // invalid values are refused
    expect((await owner.c.put(`/api/orgs/${org.id}/security`, { requireMfa: true, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: 7, auditRetentionDays: 90 })).status).toBe(400);
  });

  it('the security routes need the CSRF header', async () => {
    const s = await signUp(app, 'csrf@acme3.test');
    const raw = new Client(app, { csrf: false });
    raw.jar = s.c.jar;
    expect((await raw.post('/api/me/mfa/totp/start')).status).toBe(403);
    expect((await raw.post('/api/auth/step-up', { method: 'password', password: s.password })).body.code).toBe('csrf');
  });
});
