import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import {
  isScimToken,
  parseScimFilter,
  ROLE_RANK,
  isClientRole,
  provisionedRole,
  SCIM,
  scimBool,
  ssoEmailDomain,
  type Role,
  type ScimGroupView,
  type ScimOverview,
  type ScimTokenView,
} from '@seo/shared';
import { refreshSessionPolicy } from '../auth/session';
import { config } from '../config';
import { db, schema } from '../db';
import type { MembershipRow, OrgRow, ScimGroupRow, UserRow } from '../db/schema';
import { randomToken, sha256 } from '../lib/crypto';
import { HttpError, notFound } from '../lib/errors';
import { audit, type AuditActor } from './audit';
import { verifiedDomains } from './sso';

/**
 * G1 SCIM 2.0 (RFC 7643 / 7644; app/docs/IDENTITY.md §5): an identity provider creates, updates, deactivates and removes the people
 * of ONE company (the one its bearer token belongs to), and pushes groups that the company maps to roles. It may only provision
 * addresses on the company's DNS-verified domains, and it never touches an owner.
 */

export class ScimError extends Error {
  constructor(
    public status: number,
    message: string,
    public scimType?: string,
  ) {
    super(message);
  }
}
const invalid = (m: string, t = 'invalidValue') => new ScimError(400, m, t);

export interface ScimAuth {
  org: OrgRow;
  actor: AuditActor;
}

const base = () => `${config.publicApiUrl}/api/scim/v2`;   // machine-to-machine: straight to this server (PUBLIC_API_URL)

// ------------------------------------------------------------------ tokens (managed in the app)

const toTokenView = (t: typeof schema.scimTokens.$inferSelect, by: string | null): ScimTokenView => ({
  id: t.id,
  name: t.name,
  prefix: t.prefix,
  createdAt: t.createdAt.toISOString(),
  createdByName: by,
  lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  revokedAt: t.revokedAt?.toISOString() ?? null,
});

export async function scimOverview(org: OrgRow): Promise<ScimOverview> {
  const [tokens, groups, domains] = await Promise.all([
    db
      .select({ t: schema.scimTokens, by: schema.users.name })
      .from(schema.scimTokens)
      .leftJoin(schema.users, eq(schema.scimTokens.createdBy, schema.users.id))
      .where(eq(schema.scimTokens.orgId, org.id))
      .orderBy(desc(schema.scimTokens.createdAt))
      .limit(20),
    db
      .select({ g: schema.scimGroups, n: sql<number>`(select count(*)::int from ${schema.scimGroupMembers} m where m.group_id = ${schema.scimGroups.id})` })
      .from(schema.scimGroups)
      .where(eq(schema.scimGroups.orgId, org.id))
      .orderBy(asc(schema.scimGroups.displayName)),
    verifiedDomains(org.id),
  ]);
  return {
    baseUrl: base(),
    tokens: tokens.map((r) => toTokenView(r.t, r.by ?? null)),
    groups: groups.map((r): ScimGroupView => ({ id: r.g.id, displayName: r.g.displayName, members: Number(r.n), role: (r.g.role as ScimGroupView['role']) ?? null })),
    verifiedDomains: domains,
  };
}

export async function createScimToken(req: FastifyRequest, org: OrgRow, user: UserRow, name: string): Promise<ScimTokenView & { token: string }> {
  const live = await db.select({ n: sql<number>`count(*)::int` }).from(schema.scimTokens).where(and(eq(schema.scimTokens.orgId, org.id), isNull(schema.scimTokens.revokedAt)));
  if (Number(live[0]?.n ?? 0) >= SCIM.maxLive) throw new HttpError(409, `This company already has ${SCIM.maxLive} live provisioning tokens. Revoke one first.`, 'scim_token_limit');
  const token = SCIM.prefix + randomToken(32);
  const [row] = await db.insert(schema.scimTokens).values({ orgId: org.id, name, prefix: token.slice(0, 13), tokenHash: sha256(token), createdBy: user.id }).returning();
  await audit(req, org.id, { action: 'scim.token_created', target: { type: 'scim_token', id: row.id, label: `${name} (${row.prefix}...)` } });
  return { ...toTokenView(row, user.name), token };
}

export async function revokeScimToken(req: FastifyRequest, org: OrgRow, id: string): Promise<ScimTokenView> {
  const [row] = await db
    .update(schema.scimTokens)
    .set({ revokedAt: sql`coalesce(${schema.scimTokens.revokedAt}, now())` })
    .where(and(eq(schema.scimTokens.orgId, org.id), eq(schema.scimTokens.id, id)))
    .returning();
  if (!row) throw notFound('Token not found');
  await audit(req, org.id, { action: 'scim.token_revoked', target: { type: 'scim_token', id: row.id, label: `${row.name} (${row.prefix}...)` } });
  return toTokenView(row, null);
}

/** the company a presented token belongs to (unknown and revoked tokens look the same: null) */
export async function authenticateScim(token: string | null): Promise<ScimAuth | null> {
  if (!isScimToken(token)) return null;
  const rows = await db
    .select({ t: schema.scimTokens, org: schema.organizations })
    .from(schema.scimTokens)
    .innerJoin(schema.organizations, eq(schema.scimTokens.orgId, schema.organizations.id))
    .where(eq(schema.scimTokens.tokenHash, sha256(token)))
    .limit(1);
  const r = rows[0];
  if (!r || r.t.revokedAt) return null;
  if (!r.t.lastUsedAt || Date.now() - r.t.lastUsedAt.getTime() > 60_000) await db.update(schema.scimTokens).set({ lastUsedAt: new Date() }).where(eq(schema.scimTokens.id, r.t.id));
  return { org: r.org, actor: { type: 'scim', label: `${r.t.name} (provisioning)` } };
}

// ------------------------------------------------------------------ resources

type Member = { user: UserRow; m: MembershipRow };

async function groupsOf(orgId: string, userIds: string[]): Promise<Map<string, { value: string; display: string }[]>> {
  const out = new Map<string, { value: string; display: string }[]>();
  if (!userIds.length) return out;
  const rows = await db
    .select({ userId: schema.scimGroupMembers.userId, id: schema.scimGroups.id, name: schema.scimGroups.displayName })
    .from(schema.scimGroupMembers)
    .innerJoin(schema.scimGroups, eq(schema.scimGroupMembers.groupId, schema.scimGroups.id))
    .where(and(eq(schema.scimGroups.orgId, orgId), inArray(schema.scimGroupMembers.userId, userIds)));
  for (const r of rows) out.set(r.userId, [...(out.get(r.userId) ?? []), { value: r.id, display: r.name }]);
  return out;
}

function toScimUser(x: Member, groups: { value: string; display: string }[] = []) {
  const [given, ...rest] = x.user.name.split(' ');
  return {
    schemas: [SCIM.schemas.user],
    id: x.user.id,
    ...(x.m.scimExternalId ? { externalId: x.m.scimExternalId } : {}),
    userName: x.user.email,
    name: { formatted: x.user.name, givenName: given ?? '', familyName: rest.join(' ') },
    displayName: x.user.name,
    emails: [{ value: x.user.email, primary: true, type: 'work' }],
    active: !x.m.deactivatedAt,
    groups,
    meta: { resourceType: 'User', created: x.m.createdAt.toISOString(), lastModified: (x.m.deactivatedAt ?? x.m.createdAt).toISOString(), location: `${base()}/Users/${x.user.id}` },
  };
}

async function member(orgId: string, userId: string): Promise<Member> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new ScimError(404, 'User not found');
  const rows = await db
    .select({ user: schema.users, m: schema.memberships })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new ScimError(404, 'User not found');
  return rows[0];
}

const list = (resources: unknown[], total: number, startIndex: number) => ({ schemas: [SCIM.schemas.list], totalResults: total, startIndex, itemsPerPage: resources.length, Resources: resources });

function page(q: Record<string, unknown>) {
  const startIndex = Math.max(1, Number(q.startIndex) || 1);
  const count = Math.min(SCIM.maxPage, Math.max(0, Number.isFinite(Number(q.count)) && q.count !== undefined ? Number(q.count) : 100));
  return { startIndex, count };
}

export async function listUsers(a: ScimAuth, q: Record<string, unknown>) {
  const f = parseScimFilter(q.filter);
  if (f === 'invalid') throw invalid('Only "attribute eq \\"value\\"" filters on userName, externalId, emails.value or id are supported', 'invalidFilter');
  const cond = [eq(schema.memberships.orgId, a.org.id)];
  if (f?.attr === 'userName' || f?.attr === 'email') cond.push(eq(schema.users.email, f.value.toLowerCase()));
  else if (f?.attr === 'externalId') cond.push(eq(schema.memberships.scimExternalId, f.value));
  else if (f?.attr === 'id') {
    if (!/^[0-9a-f-]{36}$/i.test(f.value)) return list([], 0, 1);
    cond.push(eq(schema.users.id, f.value));
  } else if (f) throw invalid(`Filtering users by ${f.attr} is not supported`, 'invalidFilter');
  const { startIndex, count } = page(q);
  const where = and(...cond);
  const total = Number((await db.select({ n: sql<number>`count(*)::int` }).from(schema.memberships).innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id)).where(where))[0]?.n ?? 0);
  const rows = count
    ? await db.select({ user: schema.users, m: schema.memberships }).from(schema.memberships).innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id)).where(where).orderBy(asc(schema.memberships.createdAt)).limit(count).offset(startIndex - 1)
    : [];
  const groups = await groupsOf(a.org.id, rows.map((r) => r.user.id));
  return list(rows.map((r) => toScimUser(r, groups.get(r.user.id))), total, startIndex);
}

export async function getUser(a: ScimAuth, id: string) {
  const x = await member(a.org.id, id);
  return toScimUser(x, (await groupsOf(a.org.id, [id])).get(id));
}

/** what a SCIM user body says, normalised (PUT, POST, and the PATCH ops after folding) */
interface UserChanges {
  userName?: string;
  name?: string;
  externalId?: string | null;
  active?: boolean;
}

function changesFromBody(b: Record<string, unknown>): UserChanges {
  const c: UserChanges = {};
  const email = typeof b.userName === 'string' ? b.userName : Array.isArray(b.emails) ? (b.emails as { value?: string; primary?: boolean }[]).find((e) => e.primary)?.value ?? (b.emails as { value?: string }[])[0]?.value : undefined;
  if (typeof email === 'string') c.userName = email.trim().toLowerCase();
  const n = (b.name ?? {}) as Record<string, unknown>;
  const name = (typeof n.formatted === 'string' && n.formatted.trim()) || [n.givenName, n.familyName].filter((x) => typeof x === 'string' && x.trim()).join(' ') || (typeof b.displayName === 'string' ? b.displayName.trim() : '');
  if (name) c.name = name.slice(0, 100);
  if ('externalId' in b) c.externalId = typeof b.externalId === 'string' ? b.externalId.slice(0, 200) : null;
  const active = scimBool(b.active);
  if (active !== undefined) c.active = active;
  return c;
}

async function domainCheck(orgId: string, email: string): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('userName must be an e-mail address');
  const domains = await verifiedDomains(orgId);
  if (!domains.includes(ssoEmailDomain(email))) throw invalid(`${email} is not on one of this company's verified domains (${domains.join(', ') || 'none'})`);
}

async function defaultRole(orgId: string): Promise<Role> {
  // G5: a client workspace provisions client people only, whatever the connection's default says
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId), columns: { kind: true } });
  if (org?.kind === 'client') return 'client_viewer';
  const c = await db.query.ssoConnections.findFirst({ where: eq(schema.ssoConnections.orgId, orgId) });
  return (c?.defaultRole as Role) ?? 'member';
}

export async function createUser(req: FastifyRequest, a: ScimAuth, body: Record<string, unknown>) {
  const c = changesFromBody(body);
  if (!c.userName) throw invalid('userName is required');
  await domainCheck(a.org.id, c.userName);
  let user = await db.query.users.findFirst({ where: eq(schema.users.email, c.userName) });
  if (user) {
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, a.org.id), eq(schema.memberships.userId, user.id)) });
    if (m) throw new ScimError(409, `${c.userName} is already a member`, 'uniqueness');
  } else {
    // the company vouches for an address on its own verified domain
    [user] = await db.insert(schema.users).values({ email: c.userName, name: c.name || c.userName.split('@')[0], emailVerifiedAt: new Date() }).returning();
  }
  const active = c.active ?? true;
  await db.insert(schema.memberships).values({ orgId: a.org.id, userId: user.id, role: await defaultRole(a.org.id), provisionedBy: 'scim', scimExternalId: c.externalId ?? null, deactivatedAt: active ? null : new Date() });
  await refreshSessionPolicy([user.id]);
  await audit(req, a.org.id, { action: 'scim.user_created', actor: a.actor, target: { type: 'user', id: user.id, label: user.email }, details: { active, externalId: c.externalId ?? null } });
  return getUser(a, user.id);
}

/** applies changes to one member; `replace` (PUT) also clears an omitted externalId */
async function applyUser(req: FastifyRequest, a: ScimAuth, id: string, c: UserChanges): Promise<void> {
  const x = await member(a.org.id, id);
  const isOwner = x.m.role === 'owner';
  // the person's own account: only renamed when the address is on this company's domain (it is the company's identity)
  const companyIdentity = (await verifiedDomains(a.org.id)).includes(ssoEmailDomain(x.user.email));
  const userSet: Partial<UserRow> = {};
  if (c.userName && c.userName !== x.user.email) {
    if (isOwner) throw invalid('The owner\'s address cannot be changed by provisioning', 'mutability');
    await domainCheck(a.org.id, c.userName);
    if (!companyIdentity) throw invalid('This account\'s address is not on your domain; it cannot be changed by provisioning', 'mutability');
    if (await db.query.users.findFirst({ where: eq(schema.users.email, c.userName) })) throw new ScimError(409, `${c.userName} is taken`, 'uniqueness');
    userSet.email = c.userName;
  }
  if (c.name && c.name !== x.user.name && companyIdentity) userSet.name = c.name;
  if (Object.keys(userSet).length) await db.update(schema.users).set(userSet).where(eq(schema.users.id, id));
  const mSet: Partial<MembershipRow> = {};
  if (c.externalId !== undefined && c.externalId !== x.m.scimExternalId) mSet.scimExternalId = c.externalId;
  if (c.active !== undefined && c.active === !!x.m.deactivatedAt) {
    if (isOwner && !c.active) throw invalid('The owner cannot be deactivated by provisioning. Transfer ownership first.', 'mutability');
    mSet.deactivatedAt = c.active ? null : new Date();
  }
  if (Object.keys(mSet).length) await db.update(schema.memberships).set(mSet).where(and(eq(schema.memberships.orgId, a.org.id), eq(schema.memberships.userId, id)));
  if (mSet.deactivatedAt !== undefined) {
    if (mSet.deactivatedAt) await endCompanySessions(a.org.id, id);
    await refreshSessionPolicy([id]);
    await audit(req, a.org.id, { action: mSet.deactivatedAt ? 'scim.user_deactivated' : 'scim.user_reactivated', actor: a.actor, target: { type: 'user', id, label: userSet.email ?? x.user.email } });
  }
  const changed = [...Object.keys(userSet), ...Object.keys(mSet).filter((k) => k !== 'deactivatedAt')];
  if (changed.length) await audit(req, a.org.id, { action: 'scim.user_updated', actor: a.actor, target: { type: 'user', id, label: userSet.email ?? x.user.email }, details: { changed } });
}

/** a deactivated person loses at once the sessions this company's identity provider opened for them */
async function endCompanySessions(orgId: string, userId: string) {
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.ssoOrgId, orgId)));
}

export async function replaceUser(req: FastifyRequest, a: ScimAuth, id: string, body: Record<string, unknown>) {
  const c = changesFromBody(body);
  await applyUser(req, a, id, { ...c, externalId: c.externalId ?? null, active: c.active ?? true });
  return getUser(a, id);
}

type Op = { op?: string; path?: string; value?: unknown };
const opsOf = (body: Record<string, unknown>): Op[] => {
  const ops = body.Operations ?? body.operations;
  if (!Array.isArray(ops) || !ops.length) throw invalid('PATCH needs Operations', 'invalidSyntax');
  return ops as Op[];
};

export async function patchUser(req: FastifyRequest, a: ScimAuth, id: string, body: Record<string, unknown>) {
  const c: UserChanges = {};
  for (const o of opsOf(body)) {
    const op = String(o.op ?? '').toLowerCase();
    if (!['add', 'replace', 'remove'].includes(op)) throw invalid(`Unknown op ${o.op}`, 'invalidSyntax');
    const path = (o.path ?? '').trim();
    if (!path) {
      // Okta: { op: replace, value: { active: false, ... } }
      if (o.value && typeof o.value === 'object') {
        const flat = { ...(o.value as Record<string, unknown>) };
        // Entra sometimes nests dotted keys
        for (const [k, v] of Object.entries(flat)) if (k.startsWith('name.')) flat.name = { ...((flat.name as object) ?? {}), [k.slice(5)]: v };
        Object.assign(c, changesFromBody(flat));
      }
      continue;
    }
    const p = path.toLowerCase();
    const v = op === 'remove' ? null : o.value;
    if (p === 'active') {
      const b = scimBool(v);
      if (b === undefined) throw invalid('active must be true or false');
      c.active = b;
    } else if (p === 'username' || p.startsWith('emails')) {
      if (typeof v === 'string') c.userName = v.trim().toLowerCase();
      else if (Array.isArray(v) && typeof (v[0] as { value?: unknown })?.value === 'string') c.userName = String((v[0] as { value: string }).value).toLowerCase();
    } else if (p === 'externalid') c.externalId = typeof v === 'string' ? v : null;
    else if (p === 'displayname' || p === 'name.formatted') {
      if (typeof v === 'string' && v.trim()) c.name = v.trim().slice(0, 100);
    } else if (p === 'name.givenname' || p === 'name.familyname') {
      const x = await member(a.org.id, id);
      const [g, ...rest] = (c.name ?? x.user.name).split(' ');
      if (typeof v === 'string') c.name = (p === 'name.givenname' ? [v, ...rest] : [g, v]).filter(Boolean).join(' ').slice(0, 100);
    } else if (p === 'name' && v && typeof v === 'object') Object.assign(c, changesFromBody({ name: v }));
    // other attributes (title, phone numbers, addresses...) are not kept: accepted and ignored, as RFC 7644 allows for unknown data
  }
  await applyUser(req, a, id, c);
  return getUser(a, id);
}

export async function deleteUser(req: FastifyRequest, a: ScimAuth, id: string) {
  const x = await member(a.org.id, id);
  if (x.m.role === 'owner') throw invalid('The owner cannot be removed by provisioning. Transfer ownership first.', 'mutability');
  const groups = await db.select({ id: schema.scimGroups.id }).from(schema.scimGroups).where(eq(schema.scimGroups.orgId, a.org.id));
  if (groups.length)
    await db.delete(schema.scimGroupMembers).where(and(eq(schema.scimGroupMembers.userId, id), inArray(schema.scimGroupMembers.groupId, groups.map((g) => g.id))));
  await db.delete(schema.memberships).where(and(eq(schema.memberships.orgId, a.org.id), eq(schema.memberships.userId, id)));
  await endCompanySessions(a.org.id, id);
  await refreshSessionPolicy([id]);
  await audit(req, a.org.id, { action: 'scim.user_deleted', actor: a.actor, target: { type: 'user', id, label: x.user.email }, details: { role: x.m.role } });
}

// ------------------------------------------------------------------ groups -> roles

async function groupRow(orgId: string, id: string): Promise<ScimGroupRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ScimError(404, 'Group not found');
  const g = await db.query.scimGroups.findFirst({ where: and(eq(schema.scimGroups.orgId, orgId), eq(schema.scimGroups.id, id)) });
  if (!g) throw new ScimError(404, 'Group not found');
  return g;
}

async function toScimGroup(g: ScimGroupRow, withMembers = true) {
  const members = withMembers
    ? await db
        .select({ value: schema.users.id, display: schema.users.email })
        .from(schema.scimGroupMembers)
        .innerJoin(schema.users, eq(schema.scimGroupMembers.userId, schema.users.id))
        .where(eq(schema.scimGroupMembers.groupId, g.id))
    : undefined;
  return {
    schemas: [SCIM.schemas.group],
    id: g.id,
    displayName: g.displayName,
    ...(g.externalId ? { externalId: g.externalId } : {}),
    ...(members ? { members } : {}),
    meta: { resourceType: 'Group', created: g.createdAt.toISOString(), lastModified: g.updatedAt.toISOString(), location: `${base()}/Groups/${g.id}` },
  };
}

export async function listGroups(a: ScimAuth, q: Record<string, unknown>) {
  const f = parseScimFilter(q.filter);
  if (f === 'invalid' || (f && !['displayName', 'externalId', 'id'].includes(f.attr))) throw invalid('Only displayName, externalId or id eq filters are supported for groups', 'invalidFilter');
  const cond = [eq(schema.scimGroups.orgId, a.org.id)];
  if (f?.attr === 'displayName') cond.push(eq(schema.scimGroups.displayName, f.value));
  if (f?.attr === 'externalId') cond.push(eq(schema.scimGroups.externalId, f.value));
  if (f?.attr === 'id') {
    if (!/^[0-9a-f-]{36}$/i.test(f.value)) return list([], 0, 1);
    cond.push(eq(schema.scimGroups.id, f.value));
  }
  const { startIndex, count } = page(q);
  const where = and(...cond);
  const total = Number((await db.select({ n: sql<number>`count(*)::int` }).from(schema.scimGroups).where(where))[0]?.n ?? 0);
  const rows = count ? await db.select().from(schema.scimGroups).where(where).orderBy(asc(schema.scimGroups.displayName)).limit(count).offset(startIndex - 1) : [];
  const withMembers = !String(q.excludedAttributes ?? '').toLowerCase().includes('members');
  return list(await Promise.all(rows.map((g) => toScimGroup(g, withMembers))), total, startIndex);
}

export async function getGroup(a: ScimAuth, id: string) {
  return toScimGroup(await groupRow(a.org.id, id));
}

/** member ids must be members of this company (a SCIM client cannot pull outsiders in through a group) */
async function memberIds(orgId: string, v: unknown): Promise<string[]> {
  const ids = (Array.isArray(v) ? v : v ? [v] : []).map((x) => (typeof x === 'object' && x ? String((x as { value?: unknown }).value ?? '') : String(x))).filter(Boolean);
  if (!ids.length) return [];
  if (ids.some((x) => !/^[0-9a-f-]{36}$/i.test(x))) throw invalid('members must be user ids');
  const found = await db.select({ id: schema.memberships.userId }).from(schema.memberships).where(and(eq(schema.memberships.orgId, orgId), inArray(schema.memberships.userId, ids)));
  if (found.length !== new Set(ids).size) throw invalid('Every member must be a user of this company');
  return [...new Set(ids)];
}

async function setMembers(groupId: string, add: string[], remove: string[]) {
  if (add.length) await db.insert(schema.scimGroupMembers).values(add.map((userId) => ({ groupId, userId }))).onConflictDoNothing();
  if (remove.length) await db.delete(schema.scimGroupMembers).where(and(eq(schema.scimGroupMembers.groupId, groupId), inArray(schema.scimGroupMembers.userId, remove)));
}

export async function createGroup(req: FastifyRequest, a: ScimAuth, body: Record<string, unknown>) {
  const name = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 200) : '';
  if (!name) throw invalid('displayName is required');
  if (await db.query.scimGroups.findFirst({ where: and(eq(schema.scimGroups.orgId, a.org.id), eq(schema.scimGroups.displayName, name)) })) throw new ScimError(409, `Group ${name} exists`, 'uniqueness');
  const ids = await memberIds(a.org.id, body.members);
  const [g] = await db.insert(schema.scimGroups).values({ orgId: a.org.id, displayName: name, externalId: typeof body.externalId === 'string' ? body.externalId : null }).returning();
  await setMembers(g.id, ids, []);
  await audit(req, a.org.id, { action: 'scim.group_changed', actor: a.actor, target: { type: 'group', id: g.id, label: name }, details: { created: true, members: ids.length } });
  return toScimGroup(g);
}

export async function replaceGroup(req: FastifyRequest, a: ScimAuth, id: string, body: Record<string, unknown>) {
  const g = await groupRow(a.org.id, id);
  const ids = await memberIds(a.org.id, body.members);
  const before = (await db.select({ id: schema.scimGroupMembers.userId }).from(schema.scimGroupMembers).where(eq(schema.scimGroupMembers.groupId, id))).map((r) => r.id);
  const name = typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim().slice(0, 200) : g.displayName;
  await db.update(schema.scimGroups).set({ displayName: name, externalId: typeof body.externalId === 'string' ? body.externalId : g.externalId, updatedAt: new Date() }).where(eq(schema.scimGroups.id, id));
  await setMembers(id, ids, before.filter((x) => !ids.includes(x)));
  await recomputeRoles(req, a.org.id, [...before, ...ids], a.actor);
  await audit(req, a.org.id, { action: 'scim.group_changed', actor: a.actor, target: { type: 'group', id, label: name }, details: { members: ids.length } });
  return getGroup(a, id);
}

export async function patchGroup(req: FastifyRequest, a: ScimAuth, id: string, body: Record<string, unknown>) {
  const g = await groupRow(a.org.id, id);
  const touched = new Set<string>();
  let name = g.displayName;
  for (const o of opsOf(body)) {
    const op = String(o.op ?? '').toLowerCase();
    const path = (o.path ?? '').trim();
    const p = path.toLowerCase();
    if (!path && o.value && typeof o.value === 'object') {
      const v = o.value as Record<string, unknown>;
      if (typeof v.displayName === 'string' && v.displayName.trim()) name = v.displayName.trim().slice(0, 200);
      if ('members' in v) {
        const ids = await memberIds(a.org.id, v.members);
        const before = (await db.select({ id: schema.scimGroupMembers.userId }).from(schema.scimGroupMembers).where(eq(schema.scimGroupMembers.groupId, id))).map((r) => r.id);
        if (op === 'replace') await setMembers(id, ids, before.filter((x) => !ids.includes(x)));
        else await setMembers(id, ids, []);
        [...before, ...ids].forEach((x) => touched.add(x));
      }
    } else if (p === 'displayname') {
      if (typeof o.value === 'string' && o.value.trim()) name = o.value.trim().slice(0, 200);
    } else if (p === 'members') {
      if (op === 'add') {
        const ids = await memberIds(a.org.id, o.value);
        await setMembers(id, ids, []);
        ids.forEach((x) => touched.add(x));
      } else if (op === 'remove') {
        // Entra: { op: Remove, path: members, value: [{ value }] }; no value = every member
        const all = (await db.select({ id: schema.scimGroupMembers.userId }).from(schema.scimGroupMembers).where(eq(schema.scimGroupMembers.groupId, id))).map((r) => r.id);
        const ids = o.value ? (Array.isArray(o.value) ? o.value : [o.value]).map((x) => String((x as { value?: unknown }).value ?? x)).filter((x) => /^[0-9a-f-]{36}$/i.test(x)) : all;
        await setMembers(id, [], ids);
        ids.forEach((x) => touched.add(x));
      } else if (op === 'replace') {
        const ids = await memberIds(a.org.id, o.value);
        const before = (await db.select({ id: schema.scimGroupMembers.userId }).from(schema.scimGroupMembers).where(eq(schema.scimGroupMembers.groupId, id))).map((r) => r.id);
        await setMembers(id, ids, before.filter((x) => !ids.includes(x)));
        [...before, ...ids].forEach((x) => touched.add(x));
      } else throw invalid(`Unknown op ${o.op}`, 'invalidSyntax');
    } else if (/^members\[value eq "([^"]+)"\]$/i.test(path) && op === 'remove') {
      const uid = /"([^"]+)"/.exec(path)![1];
      if (!/^[0-9a-f-]{36}$/i.test(uid)) throw invalid('members must be user ids');
      await setMembers(id, [], [uid]);
      touched.add(uid);
    } else if (p === 'externalid') {
      await db.update(schema.scimGroups).set({ externalId: typeof o.value === 'string' ? o.value : null }).where(eq(schema.scimGroups.id, id));
    } else throw invalid(`Unsupported path ${path}`, 'invalidPath');
  }
  if (name !== g.displayName) {
    if (await db.query.scimGroups.findFirst({ where: and(eq(schema.scimGroups.orgId, a.org.id), eq(schema.scimGroups.displayName, name)) })) throw new ScimError(409, `Group ${name} exists`, 'uniqueness');
    await db.update(schema.scimGroups).set({ displayName: name }).where(eq(schema.scimGroups.id, id));
  }
  await db.update(schema.scimGroups).set({ updatedAt: new Date() }).where(eq(schema.scimGroups.id, id));
  await recomputeRoles(req, a.org.id, [...touched], a.actor);
  await audit(req, a.org.id, { action: 'scim.group_changed', actor: a.actor, target: { type: 'group', id, label: name }, details: { membersTouched: touched.size } });
  return getGroup(a, id);
}

export async function deleteGroup(req: FastifyRequest, a: ScimAuth, id: string) {
  const g = await groupRow(a.org.id, id);
  const members = (await db.select({ id: schema.scimGroupMembers.userId }).from(schema.scimGroupMembers).where(eq(schema.scimGroupMembers.groupId, id))).map((r) => r.id);
  await db.delete(schema.scimGroups).where(eq(schema.scimGroups.id, id));
  await recomputeRoles(req, a.org.id, members, a.actor);
  await audit(req, a.org.id, { action: 'scim.group_changed', actor: a.actor, target: { type: 'group', id, label: g.displayName }, details: { deleted: true } });
}

/**
 * A person's role from their groups: the highest role mapped from any group they are in. With no mapped group, people SCIM created
 * fall back to the default role; people who were invited keep the role an admin gave them. The owner is never changed.
 */
export async function recomputeRoles(req: FastifyRequest, orgId: string, userIds: string[], actor: AuditActor): Promise<void> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  const mships = await db.select().from(schema.memberships).where(and(eq(schema.memberships.orgId, orgId), inArray(schema.memberships.userId, ids)));
  const mapped = await db
    .select({ userId: schema.scimGroupMembers.userId, role: schema.scimGroups.role })
    .from(schema.scimGroupMembers)
    .innerJoin(schema.scimGroups, eq(schema.scimGroupMembers.groupId, schema.scimGroups.id))
    .where(and(eq(schema.scimGroups.orgId, orgId), inArray(schema.scimGroupMembers.userId, ids)));
  const fallback = await defaultRole(orgId);
  // G5: in a client workspace a group never makes anyone staff, and the agency's own assignments are not the IdP's to change
  const client = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId), columns: { kind: true } }))?.kind === 'client';
  for (const m of mships) {
    if (m.role === 'owner') continue;
    if (client && !isClientRole(m.role)) continue;
    const roles = mapped.filter((r) => r.userId === m.userId && r.role).map((r) => r.role as Role);
    const mappedRole: Role | null = roles.length ? roles.reduce((a, b) => (ROLE_RANK[b] > ROLE_RANK[a] ? b : a)) : m.provisionedBy === 'scim' ? fallback : null;
    const next: Role | null = mappedRole && client ? provisionedRole('client', mappedRole) : mappedRole;
    if (!next || next === m.role) continue;
    await db.update(schema.memberships).set({ role: next }).where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, m.userId)));
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, m.userId) });
    await audit(req, orgId, { action: 'team.role_changed', actor, target: { type: 'user', id: m.userId, label: u?.email ?? null }, details: { before: m.role, after: next, by: 'group mapping' } });
  }
}

/** the admin maps a pushed group to a role (or to none) */
export async function setGroupRole(req: FastifyRequest, org: OrgRow, id: string, role: Role | null): Promise<ScimGroupView> {
  const g = await db.query.scimGroups.findFirst({ where: and(eq(schema.scimGroups.orgId, org.id), eq(schema.scimGroups.id, id)) });
  if (!g) throw notFound('Group not found');
  await db.update(schema.scimGroups).set({ role, updatedAt: new Date() }).where(eq(schema.scimGroups.id, id));
  const members = (await db.select({ id: schema.scimGroupMembers.userId }).from(schema.scimGroupMembers).where(eq(schema.scimGroupMembers.groupId, id))).map((r) => r.id);
  await audit(req, org.id, { action: 'scim.group_mapping_changed', target: { type: 'group', id, label: g.displayName }, details: { before: g.role, after: role } });
  const actor: AuditActor = req.user ? { type: 'user', userId: req.user.id, label: req.user.email } : { type: 'system', label: 'system' };
  await recomputeRoles(req, org.id, members, actor);
  return { id, displayName: g.displayName, members: members.length, role: role as ScimGroupView['role'] };
}

export const serviceProviderConfig = () => ({
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
  documentationUri: `${config.appUrl}/docs/identity`,
  patch: { supported: true },
  bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
  filter: { supported: true, maxResults: SCIM.maxPage },
  changePassword: { supported: false },
  sort: { supported: false },
  etag: { supported: false },
  authenticationSchemes: [{ type: 'oauthbearertoken', name: 'Bearer token', description: 'A provisioning token from Company settings > Single sign-on', primary: true }],
  meta: { resourceType: 'ServiceProviderConfig', location: `${base()}/ServiceProviderConfig` },
});

export const resourceTypes = () => ({
  schemas: [SCIM.schemas.list],
  totalResults: 2,
  Resources: [
    { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'User', name: 'User', endpoint: '/Users', schema: SCIM.schemas.user, meta: { resourceType: 'ResourceType', location: `${base()}/ResourceTypes/User` } },
    { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'Group', name: 'Group', endpoint: '/Groups', schema: SCIM.schemas.group, meta: { resourceType: 'ResourceType', location: `${base()}/ResourceTypes/Group` } },
  ],
});

export const schemasList = () => ({
  schemas: [SCIM.schemas.list],
  totalResults: 2,
  Resources: [
    { id: SCIM.schemas.user, name: 'User', attributes: ['userName', 'name', 'displayName', 'emails', 'active', 'externalId', 'groups'].map((n) => ({ name: n })) },
    { id: SCIM.schemas.group, name: 'Group', attributes: ['displayName', 'members', 'externalId'].map((n) => ({ name: n })) },
  ],
});
