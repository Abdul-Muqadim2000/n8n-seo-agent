import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AUDIT_ACTIONS } from '@seo/shared';

// G1 phase 2, the customer-visible audit log, through the real app on a real Postgres: what is written by whom, who may read it
// (admins of that company only), filters and paging, the CSV export (formula-safe, itself audited), the append-only trigger,
// retention, and that nothing secret is ever stored.

vi.hoisted(() => {
  process.env.IDENTITY_KEY = 'ab'.repeat(32); // a test-only key
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { purgeAudit } = await import('../src/services/audit');
const { Client, signUp } = await import('./helpers/client');

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

const PW = 'correct horse battery staple';

async function company(email: string, name: string) {
  const owner = await signUp(app, email);
  const org = (await owner.c.post('/api/orgs', { name })).body;
  return { owner, org };
}
async function join(owner: InstanceType<typeof Client>, orgId: string, email: string, role: 'admin' | 'member' | 'viewer') {
  const inv = await owner.post(`/api/orgs/${orgId}/invitations`, { email, role });
  const c = new Client(app);
  const r = await c.post('/api/auth/signup', { name: email.split('@')[0], email, password: PW, inviteToken: inv.body.inviteUrl.split('/invite/')[1] });
  expect(r.status).toBe(200);
  return c;
}
/** the database's own refusal (drizzle wraps it: the trigger's message is the cause) */
async function refused(p: PromiseLike<unknown>) {
  let err: unknown = null;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err, 'the write was not refused').toBeTruthy();
  const e = err as { message?: string; cause?: { message?: string } };
  expect(`${e.message} ${e.cause?.message ?? ''}`).toMatch(/append-only/);
}
const log = async (c: InstanceType<typeof Client>, orgId: string, qs = '') => c.get(`/api/orgs/${orgId}/audit${qs}`);

describe('what is written', () => {
  it('records sign-ins (also failures), team changes and settings changes with actor, IP, user agent and before/after', async () => {
    const { owner, org } = await company('own@audit.test', 'Audit Co');
    const member = await join(owner.c, org.id, 'mem@audit.test', 'member');
    const memberId = (await member.get('/api/me')).body.user.id;
    // a wrong password and a right one for the member
    expect((await new Client(app).post('/api/auth/login', { email: 'mem@audit.test', password: 'not it at all 1' })).status).toBe(401);
    expect((await new Client(app, { ip: '203.0.113.9' }).post('/api/auth/login', { email: 'mem@audit.test', password: PW })).status).toBe(200);
    await owner.c.patch(`/api/orgs/${org.id}/members/${memberId}`, { role: 'viewer' });
    // credits (app/docs/CREDITS.md): the dollar guard is the platform admin's; an owner's attempt is refused and changes nothing
    expect((await owner.c.patch(`/api/orgs/${org.id}/budget`, { monthlyBudgetUsd: 40 })).status).toBe(403);
    await owner.c.put(`/api/orgs/${org.id}/security`, { requireMfa: false, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: 60, auditRetentionDays: 730 });

    const r = await log(owner.c, org.id);
    expect(r.status).toBe(200);
    const by = (a: string) => r.body.items.filter((e: { action: string }) => e.action === a);
    expect(by('team.invited')[0]).toMatchObject({ actorLabel: 'own@audit.test', targetLabel: 'mem@audit.test', details: { role: 'member' }, label: 'Invited someone', category: 'team' });
    expect(by('team.joined')[0]).toMatchObject({ actorLabel: 'mem@audit.test' });
    expect(by('auth.login.failed')[0]).toMatchObject({ outcome: 'failure', actorLabel: 'mem@audit.test', details: { method: 'password' } });
    expect(by('auth.login.succeeded')[0]).toMatchObject({ ip: '203.0.113.9', outcome: 'success' });
    expect(by('auth.login.succeeded')[0].userAgent).toContain('Chrome');
    expect(by('team.role_changed')[0]).toMatchObject({ targetLabel: 'mem@audit.test', details: { before: 'member', after: 'viewer' } });
    expect(by('company.budget_changed')).toEqual([]);
    expect(by('company.security_changed')[0].details).toEqual({ before: { idleTimeoutMinutes: null, auditRetentionDays: 365 }, after: { idleTimeoutMinutes: 60, auditRetentionDays: 730 } });
    // newest first
    const ids = r.body.items.map((e: { id: string }) => Number(e.id));
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
    expect(r.body.retentionDays).toBe(730);
    expect(r.body.actors.map((a: { label: string }) => a.label)).toEqual(['mem@audit.test', 'own@audit.test']);
  });

  it('two-step changes are written to every company the person belongs to', async () => {
    const a = await company('multi@audit.test', 'Multi A');
    const b = (await a.owner.c.post('/api/orgs', { name: 'Multi B' })).body;
    await a.owner.c.post('/api/me/mfa/recovery-codes'); // no factor yet: refused, nothing written
    await a.owner.c.post('/api/me/password', { currentPassword: PW, newPassword: 'another good pass 2' });
    for (const id of [a.org.id, b.id]) {
      const items = (await log(a.owner.c, id)).body.items;
      expect(items.filter((e: { action: string }) => e.action === 'account.password_changed')).toHaveLength(1);
      expect(items.some((e: { action: string }) => e.action === 'mfa.recovery.regenerated')).toBe(false);
    }
  });

  it('never stores a secret, whatever a route passes in', async () => {
    const { owner, org } = await company('secret@audit.test', 'Secret Co');
    const key = await owner.c.post(`/api/orgs/${org.id}/api-keys`, { name: 'CI', scopes: ['read'], expiresInDays: 30 });
    expect(key.status).toBe(200);
    const text = JSON.stringify((await log(owner.c, org.id)).body);
    expect(text).toContain('apikey.created');
    expect(text).not.toContain(key.body.token);
    const rows = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.orgId, org.id));
    expect(JSON.stringify(rows)).not.toContain(key.body.token);
    expect(JSON.stringify(rows)).not.toContain(PW);
  });
});

describe('who may read it', () => {
  it('owners and admins of that company only; filters and paging; never another company\'s events', async () => {
    const { owner, org } = await company('boss@iso.test', 'Iso One');
    const viewer = await join(owner.c, org.id, 'view@iso.test', 'viewer');
    const member = await join(owner.c, org.id, 'm@iso.test', 'member');
    const admin = await join(owner.c, org.id, 'adm@iso.test', 'admin');
    expect((await log(viewer, org.id)).status).toBe(403);
    expect((await log(member, org.id)).status).toBe(403);
    expect((await viewer.get(`/api/orgs/${org.id}/audit.csv`)).status).toBe(403);
    expect((await log(admin, org.id)).status).toBe(200);
    const other = await company('boss@iso2.test', 'Iso Two');
    expect((await log(other.owner.c, org.id)).status).toBe(404);
    expect((await other.owner.c.get(`/api/orgs/${org.id}/audit.csv`)).status).toBe(404);
    const theirs = (await log(other.owner.c, other.org.id)).body.items;
    expect(theirs.every((e: { actorLabel: string }) => !e.actorLabel.endsWith('@iso.test'))).toBe(true);
    // signed out
    expect((await new Client(app).get(`/api/orgs/${org.id}/audit`)).status).toBe(401);

    // filters
    const team = (await log(owner.c, org.id, '?category=team')).body.items;
    expect(team.length).toBe(6);
    expect(team.every((e: { category: string }) => e.category === 'team')).toBe(true);
    const ownerId = (await owner.c.get('/api/me')).body.user.id;
    const mine = (await log(owner.c, org.id, `?actor=${ownerId}`)).body.items;
    expect(mine.every((e: { actorId: string }) => e.actorId === ownerId)).toBe(true);
    expect((await log(owner.c, org.id, '?outcome=failure')).body.items).toEqual([]);
    expect((await log(owner.c, org.id, '?limit=500')).status).toBe(400);
    expect((await log(owner.c, org.id, '?category=nope')).status).toBe(400);
    // paging with the cursor walks every event once
    const all = (await log(owner.c, org.id, '?limit=200')).body.items.map((e: { id: string }) => e.id);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const p: { items: { id: string }[]; nextCursor: string | null } = (await log(owner.c, org.id, `?limit=2${cursor ? `&before=${cursor}` : ''}`)).body;
      seen.push(...p.items.map((e) => e.id));
      cursor = p.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all);
    const today = new Date().toISOString().slice(0, 10);
    expect((await log(owner.c, org.id, `?from=${today}&to=${today}`)).body.items.length).toBe(all.length);
    expect((await log(owner.c, org.id, '?to=2020-01-01')).body.items).toEqual([]);
  });
});

describe('the CSV export', () => {
  it('exports with a header, neutralises spreadsheet formulas and records the export itself', async () => {
    const { owner, org } = await company('csv@audit.test', 'Csv Co');
    await owner.c.patch(`/api/orgs/${org.id}`, { name: '=HYPERLINK("http://evil.test","x")' });
    const r = await owner.c.get(`/api/orgs/${org.id}/audit.csv`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(String(r.headers['content-disposition'])).toMatch(/attachment; filename="csv-co-audit-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = r.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('time,action,description,outcome,actor_type,actor,target_type,target,ip,user_agent,details');
    expect(r.text).toContain(`"'=HYPERLINK(""http://evil.test"",""x"")"`);
    expect(r.text).not.toMatch(/(^|,)"=HYPERLINK/m);
    const after = (await log(owner.c, org.id)).body.items[0];
    expect(after).toMatchObject({ action: 'audit.exported', details: { rows: lines.length - 1 } });
  });
});

describe('append-only and retention', () => {
  it('the database refuses UPDATE, DELETE and TRUNCATE; the retention purge removes only what is past it', async () => {
    const { owner, org } = await company('ro@audit.test', 'Readonly Co');
    const [row] = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.orgId, org.id)).limit(1);
    expect(row).toBeTruthy();
    await refused(db.update(schema.auditEvents).set({ actorLabel: 'someone else' }).where(eq(schema.auditEvents.id, row.id)));
    await refused(db.delete(schema.auditEvents).where(eq(schema.auditEvents.id, row.id)));
    await refused(db.execute(sql`truncate audit_events`));
    // an event older than the company's retention (default 365 days) and one inside it
    await db.insert(schema.auditEvents).values([
      { orgId: org.id, action: 'auth.logout', actorType: 'system', actorLabel: 'old', at: new Date(Date.now() - 400 * 864e5) },
      { orgId: org.id, action: 'auth.logout', actorType: 'system', actorLabel: 'recent', at: new Date(Date.now() - 300 * 864e5) },
    ]);
    expect(await purgeAudit()).toBeGreaterThanOrEqual(1);
    const left = (await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.orgId, org.id))).map((r) => r.actorLabel);
    expect(left).toContain('recent');
    expect(left).not.toContain('old');
    // outside the purge, the flag is not set: the next delete is refused again
    await refused(db.delete(schema.auditEvents).where(eq(schema.auditEvents.orgId, org.id)));
    // deleting the company itself takes its log with it
    expect((await owner.c.del(`/api/orgs/${org.id}`, { confirm: 'Readonly Co' })).status).toBe(200);
    expect(await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.orgId, org.id))).toEqual([]);
  });

  it('every action written in these tests is in the shared catalogue (so the app has words for it)', async () => {
    const rows = await db.selectDistinct({ action: schema.auditEvents.action }).from(schema.auditEvents);
    expect(rows.length).toBeGreaterThan(8);
    for (const r of rows) expect(Object.keys(AUDIT_ACTIONS), r.action).toContain(r.action);
  });
});
