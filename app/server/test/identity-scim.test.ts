import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// G1 phase 5, SCIM 2.0 through the real app on a real Postgres, the way Okta and Microsoft Entra ID call it: token auth, the
// filter -> create -> patch -> deactivate -> delete life cycle, Entra's PATCH shapes, groups mapped to roles, the owner protected,
// verified domains only, and isolation between companies (a token reaches one company and nothing else).

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
const { Client, signUp } = await import('./helpers/client');

let app: FastifyInstance;
const txt = new Map<string, string[]>();
beforeAll(async () => {
  app = await buildApp();
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
const SCIM_JSON = { 'content-type': 'application/scim+json' };

async function company(ownerEmail: string, name: string, domain: string) {
  const owner = await signUp(app, ownerEmail);
  const org = (await owner.c.post('/api/orgs', { name })).body;
  const d = await owner.c.post(`/api/orgs/${org.id}/sso/domains`, { domain });
  txt.set(domain, [d.body.txtValue]);
  expect((await owner.c.post(`/api/orgs/${org.id}/sso/domains/${d.body.id}/verify`)).body.verified).toBe(true);
  const t = await owner.c.post(`/api/orgs/${org.id}/scim/tokens`, { name: 'Okta' });
  expect(t.status).toBe(200);
  expect(t.body.token).toMatch(/^scim_[A-Za-z0-9_-]{43}$/);
  return { owner: owner.c, org, token: t.body.token as string };
}

/** an identity provider calling SCIM with a bearer token (no cookie, no CSRF header) */
function idp(token: string) {
  const c = new Client(app, { csrf: false });
  const h = { authorization: `Bearer ${token}`, ...SCIM_JSON };
  return {
    get: (p: string) => c.req('GET', `/api/scim/v2${p}`, undefined, { authorization: `Bearer ${token}` }),
    post: (p: string, b: unknown) => c.req('POST', `/api/scim/v2${p}`, JSON.stringify(b), h),
    put: (p: string, b: unknown) => c.req('PUT', `/api/scim/v2${p}`, JSON.stringify(b), h),
    patch: (p: string, ops: unknown[]) => c.req('PATCH', `/api/scim/v2${p}`, JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: ops }), h),
    del: (p: string) => c.req('DELETE', `/api/scim/v2${p}`, undefined, { authorization: `Bearer ${token}` }),
  };
}
const userBody = (email: string, extra: Record<string, unknown> = {}) => ({
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
  userName: email,
  name: { givenName: 'Sam', familyName: 'Lee' },
  emails: [{ primary: true, value: email, type: 'work' }],
  active: true,
  ...extra,
});
const membership = async (orgId: string, email: string) => {
  const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  return u ? db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, u.id)) }) : undefined;
};

describe('authentication', () => {
  it('needs a live token of this kind; never a cookie; errors are SCIM errors', async () => {
    const co = await company('own@scim-auth.test', 'Scim Auth', 'scim-auth.test');
    const none = await new Client(app, { csrf: false }).get('/api/scim/v2/Users');
    expect(none.status).toBe(401);
    expect(none.headers['content-type']).toContain('application/scim+json');
    expect(none.body).toMatchObject({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: '401' });
    // the owner's browser session is not a SCIM credential
    expect((await co.owner.get('/api/scim/v2/Users')).status).toBe(401);
    // an API key of the read API is not one either
    expect((await idp('asc_' + 'x'.repeat(43)).get('/Users')).status).toBe(401);
    expect((await idp(co.token).get('/ServiceProviderConfig')).body).toMatchObject({ patch: { supported: true }, bulk: { supported: false } });
    expect((await idp(co.token).get('/ResourceTypes')).body.totalResults).toBe(2);
    // shown once: the overview lists it by prefix only
    const ov = (await co.owner.get(`/api/orgs/${co.org.id}/scim`)).body;
    expect(ov).toMatchObject({ baseUrl: 'http://localhost:5173/api/scim/v2', verifiedDomains: ['scim-auth.test'] });
    expect(JSON.stringify(ov)).not.toContain(co.token);
    const stored = await db.query.scimTokens.findFirst({ where: eq(schema.scimTokens.orgId, co.org.id) });
    expect(stored?.tokenHash).not.toContain(co.token);
    // revoked: refused at once
    await co.owner.del(`/api/orgs/${co.org.id}/scim/tokens/${ov.tokens[0].id}`);
    expect((await idp(co.token).get('/Users')).status).toBe(401);
    // a member cannot make tokens
    const inv = await co.owner.post(`/api/orgs/${co.org.id}/invitations`, { email: 'm@else.test', role: 'member' });
    const m = new Client(app);
    await m.post('/api/auth/signup', { name: 'M', email: 'm@else.test', password: PW, inviteToken: inv.body.inviteUrl.split('/invite/')[1] });
    expect((await m.post(`/api/orgs/${co.org.id}/scim/tokens`, { name: 'x' })).status).toBe(403);
    expect((await m.get(`/api/orgs/${co.org.id}/scim`)).status).toBe(403);
  });
});

describe('users (the Okta life cycle)', () => {
  it('filter then create then read then deactivate (access stops) then reactivate then delete (deprovisioned)', async () => {
    const co = await company('own@scim-okta.test', 'Scim Okta', 'scim-okta.test');
    const s = idp(co.token);
    expect((await s.get('/Users?filter=userName%20eq%20%22sam%40scim-okta.test%22&startIndex=1&count=100')).body).toMatchObject({ totalResults: 0, Resources: [] });
    // someone already has an account (signed up with a password): SCIM links it rather than duplicating it
    const sam = await signUp(app, 'sam@scim-okta.test');
    const created = await s.post('/Users', userBody('Sam@Scim-Okta.test', { externalId: '00u1abc' }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ userName: 'sam@scim-okta.test', active: true, externalId: '00u1abc', meta: { resourceType: 'User' } });
    const id = created.body.id;
    expect((await sam.c.get('/api/me')).body.orgs.map((o: { id: string }) => o.id)).toContain(co.org.id);
    expect(await membership(co.org.id, 'sam@scim-okta.test')).toMatchObject({ provisionedBy: 'scim', role: 'member' });
    expect((await s.get('/Users?filter=userName%20eq%20%22sam%40scim-okta.test%22')).body.totalResults).toBe(1);
    expect((await s.get('/Users?filter=externalId%20eq%20%2200u1abc%22')).body.Resources[0].id).toBe(id);
    expect((await s.get(`/Users/${id}`)).body.emails[0].value).toBe('sam@scim-okta.test');
    expect((await s.post('/Users', userBody('sam@scim-okta.test'))).body).toMatchObject({ status: '409', scimType: 'uniqueness' });
    // a new person: an account is created for them
    const nia = await s.post('/Users', userBody('nia@scim-okta.test', { name: { formatted: 'Nia New' } }));
    expect(nia.status).toBe(201);
    expect((await db.query.users.findFirst({ where: eq(schema.users.email, 'nia@scim-okta.test') }))?.name).toBe('Nia New');
    // paging
    const p1 = (await s.get('/Users?startIndex=1&count=1')).body;
    const p2 = (await s.get('/Users?startIndex=2&count=1')).body;
    expect(p1.totalResults).toBe(3);
    expect([p1.Resources[0].id, p2.Resources[0].id]).toHaveLength(2);
    expect(p1.Resources[0].id).not.toBe(p2.Resources[0].id);

    // Okta deactivates: { op: replace, value: { active: false } }
    const off = await s.patch(`/Users/${id}`, [{ op: 'replace', value: { active: false } }]);
    expect(off.body.active).toBe(false);
    const blocked = await sam.c.get(`/api/orgs/${co.org.id}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('membership_deactivated');
    expect((await sam.c.get('/api/me')).body.orgs).toEqual([]);
    // the team list shows them as deactivated
    const team = (await co.owner.get(`/api/orgs/${co.org.id}/members`)).body.members;
    expect(team.find((m: { email: string }) => m.email === 'sam@scim-okta.test')).toMatchObject({ deactivated: true, provisionedBy: 'scim' });
    // reactivated
    await s.patch(`/Users/${id}`, [{ op: 'replace', value: { active: true } }]);
    expect((await sam.c.get(`/api/orgs/${co.org.id}`)).status).toBe(200);

    // deprovisioned
    expect((await s.del(`/Users/${id}`)).status).toBe(204);
    expect((await s.get(`/Users/${id}`)).status).toBe(404);
    expect((await sam.c.get(`/api/orgs/${co.org.id}`)).status).toBe(404);
    // the account itself stays (it may belong to other companies), and the history says who did it
    expect(await db.query.users.findFirst({ where: eq(schema.users.email, 'sam@scim-okta.test') })).toBeTruthy();
    const log = (await co.owner.get(`/api/orgs/${co.org.id}/audit?category=sso`)).body.items;
    const deleted = log.find((e: { action: string }) => e.action === 'scim.user_deleted');
    expect(deleted).toMatchObject({ actorType: 'scim', actorLabel: 'Okta (provisioning)', targetLabel: 'sam@scim-okta.test' });
    expect(log.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(['scim.user_created', 'scim.user_deactivated', 'scim.user_reactivated', 'scim.token_created']));
  });

  it('only provisions addresses on the company\'s verified domains, and never touches the owner', async () => {
    const co = await company('own@scim-guard.test', 'Scim Guard', 'scim-guard.test');
    const s = idp(co.token);
    expect((await s.post('/Users', userBody('x@elsewhere.test'))).body).toMatchObject({ status: '400', scimType: 'invalidValue' });
    expect((await s.post('/Users', userBody('not-an-email'))).status).toBe(400);
    const owner = (await co.owner.get('/api/me')).body.user;
    expect((await s.patch(`/Users/${owner.id}`, [{ op: 'replace', path: 'active', value: false }])).body.scimType).toBe('mutability');
    expect((await s.del(`/Users/${owner.id}`)).status).toBe(400);
    expect((await co.owner.get(`/api/orgs/${co.org.id}`)).status).toBe(200);
    expect((await s.get('/Users?filter=title%20eq%20%22x%22')).body.scimType).toBe('invalidFilter');
    expect((await s.get('/Users/not-a-uuid')).status).toBe(404);
  });

  it('accepts Microsoft Entra ID\'s PATCH shapes (string booleans, paths, add / replace)', async () => {
    const co = await company('own@scim-entra.test', 'Scim Entra', 'scim-entra.test');
    const s = idp(co.token);
    const u = (await s.post('/Users', userBody('ada@scim-entra.test', { externalId: 'e-1' }))).body;
    const r1 = await s.patch(`/Users/${u.id}`, [
      { op: 'Replace', path: 'active', value: 'False' },
      { op: 'Add', path: 'name.givenName', value: 'Ada' },
      { op: 'Replace', path: 'name.familyName', value: 'Lovelace' },
      { op: 'Replace', path: 'externalId', value: 'e-2' },
      { op: 'Add', path: 'title', value: 'Engineer' },
    ]);
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ active: false, externalId: 'e-2', displayName: 'Ada Lovelace' });
    const r2 = await s.patch(`/Users/${u.id}`, [{ op: 'Replace', path: 'active', value: 'True' }, { op: 'Replace', path: 'emails[type eq "work"].value', value: 'ada.l@scim-entra.test' }]);
    expect(r2.body).toMatchObject({ active: true, userName: 'ada.l@scim-entra.test' });
    // PUT replaces: externalId omitted is cleared
    const put = await s.put(`/Users/${u.id}`, userBody('ada.l@scim-entra.test', { name: { formatted: 'Ada L' } }));
    expect(put.body.externalId).toBeUndefined();
    expect(put.body.displayName).toBe('Ada L');
    expect((await s.patch(`/Users/${u.id}`, [{ op: 'Replace', path: 'active', value: 'maybe' }])).status).toBe(400);
    expect((await s.patch(`/Users/${u.id}`, [])).status).toBe(400);
  });
});

describe('groups gives roles', () => {
  it('a group mapped to a role sets its members\' role; leaving it falls back; outsiders cannot be added', async () => {
    const co = await company('own@scim-groups.test', 'Scim Groups', 'scim-groups.test');
    const s = idp(co.token);
    const a = (await s.post('/Users', userBody('a@scim-groups.test'))).body;
    const b = (await s.post('/Users', userBody('b@scim-groups.test'))).body;
    const g = await s.post('/Groups', { schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'], displayName: 'Alaventra Admins', members: [{ value: a.id }] });
    expect(g.status).toBe(201);
    expect(g.body.members).toEqual([{ value: a.id, display: 'a@scim-groups.test' }]);
    expect((await s.get('/Groups?filter=displayName%20eq%20%22Alaventra%20Admins%22&excludedAttributes=members')).body.Resources[0]).not.toHaveProperty('members');
    // no mapping yet: roles unchanged
    expect((await membership(co.org.id, 'a@scim-groups.test'))?.role).toBe('member');
    // the admin maps the group to "admin" (a step-up applies; the session is fresh)
    const map = await co.owner.patch(`/api/orgs/${co.org.id}/scim/groups/${g.body.id}`, { role: 'admin' });
    expect(map.body).toMatchObject({ role: 'admin', members: 1 });
    expect((await membership(co.org.id, 'a@scim-groups.test'))?.role).toBe('admin');
    // Okta adds b
    await s.patch(`/Groups/${g.body.id}`, [{ op: 'add', path: 'members', value: [{ value: b.id, display: 'b' }] }]);
    expect((await membership(co.org.id, 'b@scim-groups.test'))?.role).toBe('admin');
    // Okta removes a by filter path; Entra removes b by value
    await s.patch(`/Groups/${g.body.id}`, [{ op: 'remove', path: `members[value eq "${a.id}"]` }]);
    await s.patch(`/Groups/${g.body.id}`, [{ op: 'Remove', path: 'members', value: [{ value: b.id }] }]);
    expect((await membership(co.org.id, 'a@scim-groups.test'))?.role).toBe('member');
    expect((await membership(co.org.id, 'b@scim-groups.test'))?.role).toBe('member');
    // the owner in a mapped group stays the owner
    const owner = (await co.owner.get('/api/me')).body.user;
    await s.patch(`/Groups/${g.body.id}`, [{ op: 'add', path: 'members', value: [{ value: owner.id }] }]);
    expect((await membership(co.org.id, 'own@scim-groups.test'))?.role).toBe('owner');
    // rename (Okta) and delete
    expect((await s.patch(`/Groups/${g.body.id}`, [{ op: 'replace', value: { id: g.body.id, displayName: 'Admins' } }])).body.displayName).toBe('Admins');
    const other = await company('own@scim-groups2.test', 'Scim Groups 2', 'scim-groups2.test');
    const stranger = (await idp(other.token).post('/Users', userBody('z@scim-groups2.test'))).body;
    // someone of another company cannot be pulled in through a group
    expect((await s.patch(`/Groups/${g.body.id}`, [{ op: 'add', path: 'members', value: [{ value: stranger.id }] }])).body.scimType).toBe('invalidValue');
    expect((await s.post('/Groups', { displayName: 'X', members: [{ value: stranger.id }] })).status).toBe(400);
    expect((await s.post('/Groups', { displayName: 'Admins' })).body.scimType).toBe('uniqueness');
    expect((await s.del(`/Groups/${g.body.id}`)).status).toBe(204);
    expect((await co.owner.get(`/api/orgs/${co.org.id}/scim`)).body.groups).toEqual([]);
  });
});

describe('isolation between companies', () => {
  it('a token reaches its own company only', async () => {
    const one = await company('own@iso-scim1.test', 'Iso Scim 1', 'iso-scim1.test');
    const two = await company('own@iso-scim2.test', 'Iso Scim 2', 'iso-scim2.test');
    const u = (await idp(one.token).post('/Users', userBody('p@iso-scim1.test'))).body;
    const g = (await idp(one.token).post('/Groups', { displayName: 'G', members: [{ value: u.id }] })).body;
    const s2 = idp(two.token);
    expect((await s2.get(`/Users/${u.id}`)).status).toBe(404);
    expect((await s2.patch(`/Users/${u.id}`, [{ op: 'replace', path: 'active', value: false }])).status).toBe(404);
    expect((await s2.del(`/Users/${u.id}`)).status).toBe(404);
    expect((await s2.get(`/Groups/${g.id}`)).status).toBe(404);
    expect((await s2.get('/Users?filter=userName%20eq%20%22p%40iso-scim1.test%22')).body.totalResults).toBe(0);
    // company two cannot provision an address on company one's domain
    expect((await s2.post('/Users', userBody('q@iso-scim1.test'))).status).toBe(400);
    // nor map company one's group from its own settings
    expect((await two.owner.patch(`/api/orgs/${two.org.id}/scim/groups/${g.id}`, { role: 'admin' })).status).toBe(404);
    expect((await (await membership(one.org.id, 'p@iso-scim1.test'))?.deactivatedAt) ?? null).toBeNull();
  });
});
