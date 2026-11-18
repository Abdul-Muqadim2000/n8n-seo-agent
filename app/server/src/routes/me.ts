import { and, eq, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { ACCOUNT_DELETE_CODES, changePasswordSchema, deleteAccountSchema, updateMeSchema, type AccountDeletionPlan } from '@seo/shared';
import { requireRecentAuth, requireUser } from '../auth/access';
import { hashPassword, verifyPassword } from '../auth/password';
import { clearSessionCookie } from '../auth/session';
import { db, schema } from '../db';
import { badRequest, HttpError, parse } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { deleteAccount, planAccountDeletion } from '../services/accountDelete';
import { adminAudit } from '../services/admin/audit';
import { auditUser } from '../services/audit';
import { buildMe } from '../services/me';
import { senderForUser } from '../services/portalMail';

export async function meRoutes(app: FastifyInstance) {
  // signed out is a normal state for this call (the app asks on every load): null instead of a 401
  app.get('/api/me', async (req) => (req.user ? buildMe(req.user, req.portal?.orgId ?? null) : null));

  app.patch('/api/me', async (req) => {
    const user = requireUser(req);
    const body = parse(updateMeSchema, req.body);
    const [u] = await db.update(schema.users).set({ name: body.name }).where(eq(schema.users.id, user.id)).returning();
    return buildMe(u, req.portal?.orgId ?? null);
  });

  app.post('/api/me/password', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req);
    const body = parse(changePasswordSchema, req.body);
    if (user.passwordHash && !(await verifyPassword(user.passwordHash, body.currentPassword)))
      throw badRequest('Your current password is not correct.', { currentPassword: 'Not correct' });
    await db.update(schema.users).set({ passwordHash: await hashPassword(body.newPassword) }).where(eq(schema.users.id, user.id));
    // every other device is signed out (the current session stays)
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, req.sessionId ?? '')));
    await auditUser(req, user, { action: 'account.password_changed', details: { otherDevicesSignedOut: true, firstPassword: !user.passwordHash } });
    return { ok: true };
  });

  // ---------- CR17-B (client report 2026-11-17, C1): deleting one's own account ----------
  /** what "Delete my account" would do: the companies deleted with it, the ones left, and what stands in the way */
  app.get('/api/me/deletion', async (req): Promise<AccountDeletionPlan> => (await planAccountDeletion(requireUser(req))).plan);

  app.delete('/api/me', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = requireUser(req);
    const body = parse(deleteAccountSchema, req.body ?? {});
    if (body.confirm.trim().toLowerCase() !== user.email.toLowerCase())
      throw badRequest('Type your e-mail address to confirm.', { confirm: 'Does not match your e-mail address' });
    const { plan, sole } = await planAccountDeletion(user);
    if (plan.platformAdmin)
      throw new HttpError(409, 'A platform administrator cannot delete their own account here. Another administrator removes your address from the administrator list first.', ACCOUNT_DELETE_CODES.platformAdmin);
    if (plan.soleOwnerOf.length)
      throw new HttpError(
        409,
        `You are the only owner of ${plan.soleOwnerOf.map((c) => c.name).join(', ')}, which ${plan.soleOwnerOf.length > 1 ? 'have' : 'has'} other members. Make another member owner, or delete the company, first.`,
        ACCOUNT_DELETE_CODES.soleOwner,
        undefined,
        { companies: plan.soleOwnerOf },
      );
    if (plan.agencyWithClients.length)
      throw new HttpError(409, `${plan.agencyWithClients.map((c) => c.name).join(', ')} still ${plan.agencyWithClients.length > 1 ? 'have' : 'has'} client workspaces. Delete those first.`, ACCOUNT_DELETE_CODES.agencyHasClients, undefined, { companies: plan.agencyWithClients });
    // G1 step-up: a proof of presence within the last minutes (the web app asks for it and sends this request again)
    await requireRecentAuth(req);
    // the goodbye e-mail goes from the brand the person knows, read before the memberships are gone
    const { sender } = await senderForUser(user.id);
    const out = await deleteAccount(req, user, sole, { soleCompanies: 'delete', actor: { type: 'user', userId: user.id, label: user.email }, by: 'self' });
    // the platform's own record that this account was deleted, and by whom (the companies' logs went with them or say "Left the company")
    await adminAudit(req, 'user.self_deleted', { type: 'user', id: user.id, label: user.email }, { deletedCompanies: out.deletedCompanies.map((c) => c.name), leftCompanies: plan.leaves.map((c) => c.name) });
    clearSessionCookie(reply);
    void sendMail(
      {
        to: user.email,
        subject: `Your ${sender.brandName} account was deleted`,
        title: 'Your account was deleted',
        lines: [
          `Hi ${user.name},`,
          out.deletedCompanies.length
            ? `Your account and ${out.deletedCompanies.length === 1 ? 'the company' : 'the companies'} only you belonged to (${out.deletedCompanies.map((c) => c.name).join(', ')}) were deleted, with their websites, reports and history.`
            : 'Your account was deleted. The companies you were in keep their data; you are no longer a member.',
        ],
        footer: 'You received this e-mail because your account was deleted. If it was not you, write to us.',
        sender,
      },
      req.log,
    ).catch(() => undefined);
    return { ok: true, deletedCompanies: out.deletedCompanies, leftCompanies: plan.leaves };
  });
}
