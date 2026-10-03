import { and, eq, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { changePasswordSchema, updateMeSchema } from '@seo/shared';
import { requireUser } from '../auth/access';
import { hashPassword, verifyPassword } from '../auth/password';
import { db, schema } from '../db';
import { badRequest, parse } from '../lib/errors';
import { buildMe } from '../services/me';

export async function meRoutes(app: FastifyInstance) {
  // signed out is a normal state for this call (the app asks on every load): null instead of a 401
  app.get('/api/me', async (req) => (req.user ? buildMe(req.user) : null));

  app.patch('/api/me', async (req) => {
    const user = requireUser(req);
    const body = parse(updateMeSchema, req.body);
    const [u] = await db.update(schema.users).set({ name: body.name }).where(eq(schema.users.id, user.id)).returning();
    return buildMe(u);
  });

  app.post('/api/me/password', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req);
    const body = parse(changePasswordSchema, req.body);
    if (user.passwordHash && !(await verifyPassword(user.passwordHash, body.currentPassword)))
      throw badRequest('Your current password is not correct.', { currentPassword: 'Not correct' });
    await db.update(schema.users).set({ passwordHash: await hashPassword(body.newPassword) }).where(eq(schema.users.id, user.id));
    // every other device is signed out (the current session stays)
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, req.sessionId ?? '')));
    return { ok: true };
  });
}
