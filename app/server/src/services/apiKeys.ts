import { and, desc, eq, isNull, or, gt, sql } from 'drizzle-orm';
import { API_KEY, API_SCOPES, apiKeyState, isApiKeyToken, keyDisplayPrefix, keyExpiry, type ApiKeyView, type ApiScope } from '@seo/shared';
import { db, schema } from '../db';
import type { ApiKeyRow, OrgRow, UserRow } from '../db/schema';
import type { Role } from '@seo/shared';
import { randomToken, sha256 } from '../lib/crypto';
import { HttpError, notFound } from '../lib/errors';

/**
 * B5-11 (v4.18): company API keys for the read API. Design note: app/API.md "Read API v1".
 * A key is 256 random bits after `asc_`; only its SHA-256 is stored, so a database copy hands out no working key. It is returned once,
 * by `createKey`. A key resolves to exactly one company (`authenticateKey`), and that company id is the only one any v1 handler uses.
 */

const scopesOf = (v: unknown): ApiScope[] => (Array.isArray(v) ? v.filter((x): x is ApiScope => (API_SCOPES as readonly string[]).includes(String(x))) : []);

export const toKeyView = (r: ApiKeyRow, createdByName: string | null, now = new Date()): ApiKeyView => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  scopes: scopesOf(r.scopes),
  state: apiKeyState(r, now),
  createdAt: r.createdAt.toISOString(),
  createdByName,
  expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
  lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
  revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
});

export async function listKeys(orgId: string): Promise<ApiKeyView[]> {
  const rows = await db
    .select({ k: schema.apiKeys, name: schema.users.name })
    .from(schema.apiKeys)
    .leftJoin(schema.users, eq(schema.apiKeys.createdBy, schema.users.id))
    .where(eq(schema.apiKeys.orgId, orgId))
    .orderBy(desc(schema.apiKeys.createdAt))
    .limit(100);
  const now = new Date();
  return rows.map((r) => toKeyView(r.k, r.name ?? null, now));
}

export async function createKey(o: { org: OrgRow; user: UserRow; name: string; scopes: ApiScope[]; expiresInDays: number }): Promise<{ key: ApiKeyView; token: string }> {
  const live = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.orgId, o.org.id), isNull(schema.apiKeys.revokedAt), or(isNull(schema.apiKeys.expiresAt), gt(schema.apiKeys.expiresAt, new Date()))));
  if (Number(live[0]?.n ?? 0) >= API_KEY.maxLive)
    throw new HttpError(409, `This company already has ${API_KEY.maxLive} live API keys. Revoke one before creating another.`, 'api_key_limit');
  const token = API_KEY.prefix + randomToken(API_KEY.tokenBytes);
  const [row] = await db
    .insert(schema.apiKeys)
    .values({
      orgId: o.org.id,
      name: o.name,
      prefix: keyDisplayPrefix(token),
      tokenHash: sha256(token),
      scopes: [...new Set(o.scopes)],
      createdBy: o.user.id,
      expiresAt: keyExpiry(o.expiresInDays),
    })
    .returning();
  return { key: toKeyView(row, o.user.name), token };
}

/** Revokes a key of this company (a key of another company is simply not found). */
export async function revokeKey(orgId: string, keyId: string): Promise<ApiKeyView> {
  const [row] = await db
    .update(schema.apiKeys)
    .set({ revokedAt: sql`coalesce(${schema.apiKeys.revokedAt}, now())` })
    .where(and(eq(schema.apiKeys.orgId, orgId), eq(schema.apiKeys.id, keyId)))
    .returning();
  if (!row) throw notFound('API key not found');
  return toKeyView(row, null);
}

export interface KeyAuth {
  key: ApiKeyRow;
  org: OrgRow;
}

/** last-use writes are batched to one a minute per key, so a busy script does not write on every request */
const LAST_USED_MS = 60_000;

/** The company a presented key belongs to, or null for an unknown, revoked or expired key (one answer for all three). */
export async function authenticateKey(token: string, now = new Date()): Promise<KeyAuth | null> {
  if (!isApiKeyToken(token)) return null;
  const rows = await db
    .select({ k: schema.apiKeys, org: schema.organizations })
    .from(schema.apiKeys)
    .innerJoin(schema.organizations, eq(schema.apiKeys.orgId, schema.organizations.id))
    .where(eq(schema.apiKeys.tokenHash, sha256(token)))
    .limit(1);
  const r = rows[0];
  if (!r || apiKeyState(r.k, now) !== 'active') return null;
  if (!r.k.lastUsedAt || now.getTime() - r.k.lastUsedAt.getTime() > LAST_USED_MS) {
    await db.update(schema.apiKeys).set({ lastUsedAt: now }).where(eq(schema.apiKeys.id, r.k.id));
  }
  return { key: r.k, org: r.org };
}

/** G4: the key creator's CURRENT membership of the company (null when they left or never were): a key acts as its creator. */
export async function creatorMembership(orgId: string, userId: string | null): Promise<{ user: UserRow; role: Role } | null> {
  if (!userId) return null;
  const rows = await db
    .select({ user: schema.users, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, userId)))
    .limit(1);
  return rows[0] ? { user: rows[0].user, role: rows[0].role as Role } : null;
}
