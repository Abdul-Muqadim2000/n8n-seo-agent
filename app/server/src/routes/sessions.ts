import { and, desc, eq, gt, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { deviceLabel, type AuthMethod, type SessionView } from '@seo/shared';
import { isUuid, requireUser } from '../auth/access';
import { db, schema } from '../db';
import type { SessionRow } from '../db/schema';
import { notFound } from '../lib/errors';
import { auditUser } from '../services/audit';

/** G1: "Where you're signed in" — the person's own sessions, sign one device out, or every other one. */
const view = (s: SessionRow, currentId: string | null): SessionView => ({
  id: s.publicId,
  current: s.id === currentId,
  device: deviceLabel(s.userAgent),
  ip: s.ip,
  createdAt: s.createdAt.toISOString(),
  lastSeenAt: s.lastSeenAt.toISOString(),
  expiresAt: s.expiresAt.toISOString(),
  authMethod: (s.authMethod as AuthMethod) ?? 'password',
  mfa: !!s.mfaAt,
});

export async function sessionRoutes(app: FastifyInstance) {
  app.get('/api/me/sessions', async (req): Promise<{ items: SessionView[] }> => {
    const user = requireUser(req);
    const rows = await db.query.sessions.findMany({
      where: and(eq(schema.sessions.userId, user.id), gt(schema.sessions.expiresAt, new Date())),
      orderBy: desc(schema.sessions.lastSeenAt),
      limit: 100,
    });
    const items = rows.map((s) => view(s, req.sessionId));
    // this device first
    return { items: [...items.filter((s) => s.current), ...items.filter((s) => !s.current)] };
  });

  app.delete('/api/me/sessions/:id', async (req) => {
    const user = requireUser(req);
    const id = (req.params as { id: string }).id;
    if (!isUuid(id)) throw notFound('Session not found');
    // only one's own sessions: another person's id is simply not found
    const [gone] = await db
      .delete(schema.sessions)
      .where(and(eq(schema.sessions.userId, user.id), eq(schema.sessions.publicId, id)))
      .returning();
    if (!gone) throw notFound('Session not found');
    await auditUser(req, user, { action: 'auth.session_revoked', target: { type: 'session', id, label: deviceLabel(gone.userAgent) }, details: { ip: gone.ip, current: gone.id === req.sessionId } });
    return { ok: true, signedOutHere: gone.id === req.sessionId };
  });

  app.post('/api/me/sessions/revoke-others', async (req) => {
    const user = requireUser(req);
    const gone = await db
      .delete(schema.sessions)
      .where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, req.sessionId ?? '')))
      .returning({ id: schema.sessions.id });
    await auditUser(req, user, { action: 'auth.sessions_revoked', details: { devices: gone.length } });
    return { ok: true, revoked: gone.length };
  });
}
