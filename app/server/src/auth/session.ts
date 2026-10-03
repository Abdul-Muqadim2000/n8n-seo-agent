import { eq, lt } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { UserRow } from '../db/schema';
import { randomToken, sha256 } from '../lib/crypto';

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 30;
const REFRESH_WHEN_DAYS_LEFT = 15;
const DAY = 24 * 60 * 60 * 1000;

export async function createSession(reply: FastifyReply, req: FastifyRequest, userId: string): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
    ip: req.ip,
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
export async function readSession(req: FastifyRequest, reply: FastifyReply): Promise<{ user: UserRow; sessionId: string } | null> {
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
  return { user: row.user, sessionId: id };
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

export function toUser(u: UserRow): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    emailVerified: !!u.emailVerifiedAt,
    hasPassword: !!u.passwordHash,
    googleLinked: !!u.googleSub,
    createdAt: u.createdAt.toISOString(),
  };
}
