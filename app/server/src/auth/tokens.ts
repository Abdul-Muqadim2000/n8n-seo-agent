import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { randomToken, sha256 } from '../lib/crypto';

export type TokenKind = 'verify_email' | 'reset_password';

/** Issues a one-time token (only its hash is stored); older unused tokens of the same kind are invalidated. */
export async function issueToken(userId: string, kind: TokenKind, ttlMinutes: number): Promise<string> {
  const token = randomToken(32);
  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.kind, kind), isNull(schema.authTokens.usedAt)));
  await db.insert(schema.authTokens).values({ userId, kind, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) });
  return token;
}

/** Marks the token used and returns its user, or null when it is unknown, used or expired. */
export async function consumeToken(token: string, kind: TokenKind): Promise<string | null> {
  if (!token || token.length > 100) return null;
  const rows = await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.authTokens.tokenHash, sha256(token)), eq(schema.authTokens.kind, kind), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())))
    .returning({ userId: schema.authTokens.userId });
  return rows[0]?.userId ?? null;
}
