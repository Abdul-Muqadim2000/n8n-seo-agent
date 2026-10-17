import { eq, lt } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthMethod, User } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { SessionRow, UserRow } from '../db/schema';
import { randomToken, sha256 } from '../lib/crypto';

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 30;
const REFRESH_WHEN_DAYS_LEFT = 15;
const DAY = 24 * 60 * 60 * 1000;

export interface SessionOptions {
  /** how the person proved who they are (default password) */
  method?: AuthMethod;
  /** a second factor was verified (or the company's IdP counts as one) */
  mfa?: boolean;
  /** SSO: the company whose identity provider signed the person in */
  ssoOrgId?: string | null;
}

export async function createSession(reply: FastifyReply, req: FastifyRequest, userId: string, opts: SessionOptions = {}): Promise<void> {
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY);
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
    ip: req.ip,
    authMethod: opts.method ?? 'password',
    ssoOrgId: opts.ssoOrgId ?? null,
    mfaAt: opts.mfa ? now : null,
    // signing in is itself a fresh proof of presence (step-up window)
    reauthAt: now,
  });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
  setSessionCookie(reply, token, expiresAt);
}

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Resolves the cookie to a user; extends the session when it is past half its life. */
export async function readSession(req: FastifyRequest, reply: FastifyReply): Promise<{ user: UserRow; sessionId: string; session: SessionRow } | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const rows = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
    clearSessionCookie(reply);
    return null;
  }
  if (row.session.expiresAt.getTime() - Date.now() < REFRESH_WHEN_DAYS_LEFT * DAY) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
    await db.update(schema.sessions).set({ expiresAt, lastSeenAt: new Date() }).where(eq(schema.sessions.id, id));
    setSessionCookie(reply, token, expiresAt);
  }
  return { user: row.user, sessionId: id, session: row.session };
}

export async function deleteSession(sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function deleteUserSessions(userId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export async function purgeExpiredSessions() {
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}

/** `mfaPasskeys`: how many passkeys the person has (buildMe counts them; 0 where it does not matter) */
export function toUser(u: UserRow, mfaPasskeys = 0): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    emailVerified: !!u.emailVerifiedAt,
    hasPassword: !!u.passwordHash,
    googleLinked: !!u.googleSub,
    mfaEnabled: !!u.mfaTotpEnabledAt || mfaPasskeys > 0,
    createdAt: u.createdAt.toISOString(),
  };
}
