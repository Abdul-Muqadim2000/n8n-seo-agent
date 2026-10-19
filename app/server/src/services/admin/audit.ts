import type { FastifyRequest } from 'fastify';
import { db, schema } from '../../db';

/** One line in the platform admin's own activity log (admin_audit). A failed write is logged and never fails the action. */
export async function adminAudit(
  req: FastifyRequest,
  action: string,
  target: { type: string; id?: string | null; label?: string | null },
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(schema.adminAudit).values({
      actorUserId: req.user?.id ?? null,
      actorEmail: req.user?.email ?? 'platform administrator',
      action,
      targetType: target.type,
      targetId: target.id ?? null,
      targetLabel: (target.label ?? '').slice(0, 200),
      details,
    });
  } catch (err) {
    req.log.error({ err: String(err), action }, 'admin audit line could not be written');
  }
}
