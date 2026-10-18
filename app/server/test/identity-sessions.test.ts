import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// G1 phase 3 — "Where you're signed in" and the company idle timeout, through the real app on a real Postgres.

vi.hoisted(() => {
  process.env.IDENTITY_KEY = 'ab'.repeat(32); // a test-only key
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

const PW = 'correct horse battery staple';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const userId = async (email: string) => (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))!.id;
const idleFor = async (email: string, minutes: number) =>
  db.update(schema.sessions).set({ lastSeenAt: new Date(Date.now() - minutes * 60_000) }).where(eq(schema.sessions.userId, await userId(email)));

describe('your devices', () => {
  it('lists this person’s sessions (this one first, with a readable device), revokes one, then every other', async () => {
    const a = await signUp(app, 'dev@sess.test');
    const phone = new Client(app, { ua: IPHONE, ip: '198.51.100.7' });
    await phone.post('/api/auth/login', { email: 'dev@sess.test', password: PW });
    const third = new Client(app);
    await third.post('/api/auth/login', { email: 'dev@sess.test', password: PW });

    const list = (await a.c.get('/api/me/sessions')).body.items;
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ current: true, device: 'Chrome on macOS', authMethod: 'password', mfa: false });
    const ph = list.find((s: { device: string }) => s.device === 'Safari on iOS');
    expect(ph).toMatchObject({ current: false, ip: '198.51.100.7' });
    // the session key never leaves the server
    const keys = (await db.query.sessions.findMany()).map((s) => s.id);
    expect(JSON.stringify(list)).not.toMatch(new RegExp(keys.join('|')));

    // someone else cannot sign this person's phone out
    const intruder = await signUp(app, 'intruder@sess.test');
    expect((await intruder.c.del(`/api/me/sessions/${ph.id}`)).status).toBe(404);
    expect((await phone.get('/api/me')).body.user.email).toBe('dev@sess.test');

    expect((await a.c.del(`/api/me/sessions/${ph.id}`)).body).toEqual({ ok: true, signedOutHere: false });
    expect((await phone.get('/api/me')).body).toBeNull();
    expect((await a.c.post('/api/me/sessions/revoke-others')).body).toEqual({ ok: true, revoked: 1 });
    expect((await third.get('/api/me')).body).toBeNull();
    expect((await a.c.get('/api/me')).body.user.email).toBe('dev@sess.test');
    expect((await a.c.del('/api/me/sessions/not-a-uuid')).status).toBe(404);
  });
});

describe('company idle timeout', () => {
  it('signs a session out after the strictest timeout of the person’s companies, and says why', async () => {
    const owner = await signUp(app, 'idle@sess.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Idle Co' })).body;
    const policy = { requireMfa: false, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: 15, auditRetentionDays: 365 };
    expect((await owner.c.put(`/api/orgs/${org.id}/security`, policy)).status).toBe(200);
    // the open session took the new timeout at once
    const s = await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, await userId('idle@sess.test')) });
    expect(s?.idleTimeoutMinutes).toBe(15);

    await idleFor('idle@sess.test', 10);
    expect((await owner.c.get(`/api/orgs/${org.id}`)).status).toBe(200);
    await idleFor('idle@sess.test', 16);
    const r = await owner.c.get(`/api/orgs/${org.id}`);
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('session_idle');
    expect(owner.c.jar.get('signed_out')).toBe('idle');
    expect(owner.c.jar.has('sid')).toBe(false);
    // written to the log
    const again = new Client(app);
    await again.post('/api/auth/login', { email: 'idle@sess.test', password: PW });
    const log = (await again.get(`/api/orgs/${org.id}/audit?category=signin`)).body.items;
    expect(log.some((e: { action: string }) => e.action === 'auth.session_idle')).toBe(true);
    // a new sign-in carries the timeout from the start
    const fresh = await db.query.sessions.findMany({ where: eq(schema.sessions.userId, await userId('idle@sess.test')) });
    expect(fresh.every((x) => x.idleTimeoutMinutes === 15)).toBe(true);
  });

  it('a background poll from a hidden tab is not activity; a real request is', async () => {
    const owner = await signUp(app, 'poll@sess.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Poll Co' })).body;
    await owner.c.put(`/api/orgs/${org.id}/security`, { requireMfa: false, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: 15, auditRetentionDays: 365 });
    await idleFor('poll@sess.test', 5);
    const before = (await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, await userId('poll@sess.test')) }))!.lastSeenAt.getTime();
    await owner.c.get('/api/me', { 'x-alaventra-passive': '1' });
    const passive = (await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, await userId('poll@sess.test')) }))!.lastSeenAt.getTime();
    expect(passive).toBe(before);
    await owner.c.get('/api/me');
    const active = (await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, await userId('poll@sess.test')) }))!.lastSeenAt.getTime();
    expect(active).toBeGreaterThan(before);
  });

  it('joining a company with a timeout applies it; leaving lifts it', async () => {
    const owner = await signUp(app, 'strict@sess.test');
    const org = (await owner.c.post('/api/orgs', { name: 'Strict Co' })).body;
    await owner.c.put(`/api/orgs/${org.id}/security`, { requireMfa: false, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: 30, auditRetentionDays: 365 });
    const lax = await signUp(app, 'lax@sess.test');
    const inv = await owner.c.post(`/api/orgs/${org.id}/invitations`, { email: 'lax@sess.test', role: 'member' });
    expect((await lax.c.post(`/api/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`)).status).toBe(200);
    const laxId = await userId('lax@sess.test');
    expect((await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, laxId) }))?.idleTimeoutMinutes).toBe(30);
    expect((await owner.c.del(`/api/orgs/${org.id}/members/${laxId}`)).status).toBe(200);
    expect((await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, laxId) }))?.idleTimeoutMinutes).toBeNull();
  });
});
