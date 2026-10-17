import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import type { AuthFlowRow } from '../db/schema';
import { randomToken, sha256 } from '../lib/crypto';

/**
 * G1: short-lived server-side state of a multi-step sign-in (`auth_flows`). The browser holds a random token (cookie, OAuth `state`
 * or SAML `RelayState`); the table keeps only its SHA-256, so a database copy cannot complete anyone's sign-in.
 *
 * Kinds: `mfa_login` (password / Google / SSO checked, second factor pending), `webauthn_reg` (passkey being added),
 * `webauthn_auth` (a step-up passkey challenge), `stepup_fail` (failed step-ups of a session), `oidc`
 * (state, nonce, PKCE verifier), `saml_req` (an AuthnRequest id we issued), `saml_seen` (an assertion id already accepted).
 */
export type FlowKind = 'mfa_login' | 'webauthn_reg' | 'webauthn_auth' | 'stepup_fail' | 'oidc' | 'saml_req' | 'saml_seen';

export async function createFlow(kind: FlowKind, o: { userId?: string | null; orgId?: string | null; data?: Record<string, unknown>; ttlMinutes: number; token?: string }): Promise<string> {
  const token = o.token ?? randomToken(32);
  const row = {
    kind,
    userId: o.userId ?? null,
    orgId: o.orgId ?? null,
    data: o.data ?? {},
    attempts: 0,
    expiresAt: new Date(Date.now() + o.ttlMinutes * 60_000),
  };
  // a derived token (`reg:<session>`) replaces the previous challenge of the same session
  await db
    .insert(schema.authFlows)
    .values({ id: sha256(token), ...row })
    .onConflictDoUpdate({ target: schema.authFlows.id, set: row });
  return token;
}

/** the live flow for a token, or null (unknown, other kind, expired) */
export async function readFlow(token: unknown, kind: FlowKind): Promise<AuthFlowRow | null> {
  if (typeof token !== 'string' || !token || token.length > 200) return null;
  const row = await db.query.authFlows.findFirst({ where: and(eq(schema.authFlows.id, sha256(token)), eq(schema.authFlows.kind, kind), gt(schema.authFlows.expiresAt, new Date())) });
  return row ?? null;
}

/** deletes and returns the live flow: whoever gets the row back is the only one who may complete it (single use, race-safe) */
export async function consumeFlow(token: unknown, kind: FlowKind): Promise<AuthFlowRow | null> {
  if (typeof token !== 'string' || !token || token.length > 200) return null;
  const rows = await db
    .delete(schema.authFlows)
    .where(and(eq(schema.authFlows.id, sha256(token)), eq(schema.authFlows.kind, kind), gt(schema.authFlows.expiresAt, new Date())))
    .returning();
  return rows[0] ?? null;
}

export async function updateFlowData(id: string, data: Record<string, unknown>): Promise<void> {
  await db.update(schema.authFlows).set({ data }).where(eq(schema.authFlows.id, id));
}

/** counts one failed attempt; returns the new count (the caller voids the flow past its limit) */
export async function failFlowAttempt(id: string): Promise<number> {
  const rows = await db
    .update(schema.authFlows)
    .set({ attempts: sql`${schema.authFlows.attempts} + 1` })
    .where(eq(schema.authFlows.id, id))
    .returning({ attempts: schema.authFlows.attempts });
  return rows[0]?.attempts ?? Number.MAX_SAFE_INTEGER;
}

/** a counter that lives `ttlMinutes` from its first bump (failed step-ups of one session); returns the new count */
export async function bumpCounter(token: string, kind: FlowKind, ttlMinutes: number): Promise<number> {
  const rows = await db
    .insert(schema.authFlows)
    .values({ id: sha256(token), kind, attempts: 1, expiresAt: new Date(Date.now() + ttlMinutes * 60_000) })
    .onConflictDoUpdate({
      target: schema.authFlows.id,
      // an expired counter starts again
      set: {
        attempts: sql`case when ${schema.authFlows.expiresAt} < now() then 1 else ${schema.authFlows.attempts} + 1 end`,
        expiresAt: sql`case when ${schema.authFlows.expiresAt} < now() then excluded.expires_at else ${schema.authFlows.expiresAt} end`,
      },
    })
    .returning({ attempts: schema.authFlows.attempts });
  return rows[0]?.attempts ?? 1;
}

export async function deleteFlow(id: string): Promise<void> {
  await db.delete(schema.authFlows).where(eq(schema.authFlows.id, id));
}

/**
 * Records a one-time id (a SAML assertion id) until `until`. Returns false when it was recorded before — a replay. The primary key
 * makes this atomic: two requests carrying the same assertion cannot both insert it.
 */
export async function markSeenOnce(key: string, until: Date): Promise<boolean> {
  const rows = await db
    .insert(schema.authFlows)
    .values({ id: sha256(`seen:${key}`), kind: 'saml_seen', expiresAt: until })
    .onConflictDoNothing()
    .returning({ id: schema.authFlows.id });
  return rows.length === 1;
}

export async function purgeExpiredFlows(): Promise<void> {
  await db.delete(schema.authFlows).where(lt(schema.authFlows.expiresAt, new Date()));
}
