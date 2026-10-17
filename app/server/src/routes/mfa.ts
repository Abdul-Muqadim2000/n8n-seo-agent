import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { maskEmail, MFA, mfaVerifySchema, passkeyNameSchema, passkeyRegisterSchema, stepUpSchema, totpConfirmSchema, type MfaMethod } from '@seo/shared';
import { isUuid, requireRecentAuth, requireUser, stepUpMethods } from '../auth/access';
import { bumpCounter, consumeFlow, createFlow, deleteFlow, failFlowAttempt, readFlow, updateFlowData } from '../auth/flows';
import { verifyPassword } from '../auth/password';
import { createSession, deleteSession, clearSessionCookie } from '../auth/session';
import { MFA_COOKIE, MFA_COOKIE_OPTS } from '../auth/signin';
import { db, schema } from '../db';
import type { UserRow } from '../db/schema';
import { badRequest, HttpError, notFound, parse } from '../lib/errors';
import { buildMe } from '../services/me';
import {
  companiesRequiringMfa,
  confirmTotp,
  beginTotp,
  disableTotp,
  factorCount,
  markSessionMfa,
  mfaMethods,
  mfaStatus,
  passkeyAuthenticationOptions,
  passkeyRegistrationOptions,
  regenerateRecoveryCodes,
  registerPasskey,
  remainingRecoveryCodes,
  removePasskey,
  renamePasskey,
  useRecoveryCode,
  verifyPasskey,
  verifyTotp,
} from '../services/mfa';

const LIMIT = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
/** failed step-ups a session may make in this window before it is signed out */
const STEP_UP_FAILS = 5;
const STEP_UP_FAIL_WINDOW_MIN = 15;

/** one second factor, whichever kind; `challenge` is the WebAuthn challenge issued for this attempt */
async function checkFactor(user: UserRow, input: { method: MfaMethod; code?: string; response?: Record<string, unknown> }, challenge: string | null): Promise<boolean> {
  if (input.method === 'totp') return verifyTotp(user, String(input.code ?? '').replace(/[\s-]/g, ''));
  if (input.method === 'recovery') return useRecoveryCode(user.id, String(input.code ?? ''));
  if (input.method === 'webauthn') return !!challenge && verifyPasskey(user.id, challenge, input.response);
  return false;
}

/** removing this factor would leave nothing while a company requires two-step verification */
async function guardLastFactor(user: UserRow): Promise<void> {
  if ((await factorCount(user)) > 1) return;
  const req = await companiesRequiringMfa(user.id);
  if (req.length) throw badRequest(`${req.join(', ')} require${req.length === 1 ? 's' : ''} two-step verification. Add another method before removing this one.`);
}

const reloadUser = async (id: string) => (await db.query.users.findFirst({ where: eq(schema.users.id, id) }))!;

export async function mfaRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------------ sign-in, second step
  /** what the second-step page needs: the methods and whose sign-in it is (no session exists yet) */
  app.get('/api/auth/mfa', async (req) => {
    const flow = await readFlow(req.cookies[MFA_COOKIE], 'mfa_login');
    if (!flow?.userId) throw new HttpError(404, 'This sign-in has expired. Sign in again.', 'mfa_flow_missing');
    const user = await reloadUser(flow.userId);
    return { methods: await mfaMethods(user), emailHint: maskEmail(user.email), next: String(flow.data.next ?? '/') };
  });

  app.post('/api/auth/mfa/webauthn/options', LIMIT, async (req) => {
    const flow = await readFlow(req.cookies[MFA_COOKIE], 'mfa_login');
    if (!flow?.userId) throw new HttpError(404, 'This sign-in has expired. Sign in again.', 'mfa_flow_missing');
    const options = await passkeyAuthenticationOptions(flow.userId);
    await updateFlowData(flow.id, { ...flow.data, challenge: options.challenge });
    return options;
  });

  app.post('/api/auth/mfa/verify', LIMIT, async (req, reply) => {
    const body = parse(mfaVerifySchema, req.body);
    const token = req.cookies[MFA_COOKIE];
    const flow = await readFlow(token, 'mfa_login');
    if (!flow?.userId) throw new HttpError(404, 'This sign-in has expired. Sign in again.', 'mfa_flow_missing');
    const user = await reloadUser(flow.userId);
    const ok = await checkFactor(user, body as never, typeof flow.data.challenge === 'string' ? flow.data.challenge : null);
    if (!ok) {
      const n = await failFlowAttempt(flow.id);
      if (n >= MFA.flowAttempts) {
        await deleteFlow(flow.id);
        reply.clearCookie(MFA_COOKIE, { path: MFA_COOKIE_OPTS.path });
        throw new HttpError(401, 'Too many wrong codes. Sign in again.', 'mfa_flow_locked');
      }
      throw new HttpError(401, body.method === 'recovery' ? 'That recovery code is not valid or was already used.' : body.method === 'webauthn' ? 'The passkey could not be verified.' : 'That code did not match. Enter the newest code from your app.', 'mfa_invalid', {
        code: 'Did not match',
      });
    }
    // single use: whoever deletes the flow completes the sign-in
    const done = await consumeFlow(token, 'mfa_login');
    if (!done) throw new HttpError(404, 'This sign-in has expired. Sign in again.', 'mfa_flow_missing');
    reply.clearCookie(MFA_COOKIE, { path: MFA_COOKIE_OPTS.path });
    const method = (done.data.method as 'password' | 'google' | 'sso') ?? 'password';
    await createSession(reply, req, user.id, { method, mfa: true, ssoOrgId: (done.data.ssoOrgId as string | null) ?? null });
    const recoveryLeft = body.method === 'recovery' ? await remainingRecoveryCodes(user.id) : null;
    return { ...(await buildMe(user)), next: String(done.data.next ?? '/'), recoveryCodesLeft: recoveryLeft };
  });

  app.post('/api/auth/mfa/cancel', async (req, reply) => {
    await consumeFlow(req.cookies[MFA_COOKIE], 'mfa_login');
    reply.clearCookie(MFA_COOKIE, { path: MFA_COOKIE_OPTS.path });
    return { ok: true };
  });

  // ------------------------------------------------------------------ step-up
  app.get('/api/auth/step-up', async (req) => {
    const user = requireUser(req);
    return { methods: await stepUpMethods(user), validUntil: req.session?.reauthAt ? new Date(req.session.reauthAt.getTime() + MFA.stepUpMinutes * 60_000).toISOString() : null };
  });

  app.post('/api/auth/step-up/webauthn/options', LIMIT, async (req) => {
    const user = requireUser(req);
    const options = await passkeyAuthenticationOptions(user.id);
    await createFlow('webauthn_auth', { token: `stepup:${req.sessionId}`, userId: user.id, data: { challenge: options.challenge }, ttlMinutes: MFA.flowMinutes });
    return options;
  });

  app.post('/api/auth/step-up', LIMIT, async (req, reply) => {
    const user = requireUser(req);
    const body = parse(stepUpSchema, req.body);
    const allowed = await stepUpMethods(user);
    if (!allowed.includes(body.method)) throw badRequest(body.method === 'password' ? 'Use your second factor to confirm it is you.' : 'This method is not set up on your account.');
    let ok = false;
    if (body.method === 'password') ok = !!user.passwordHash && (await verifyPassword(user.passwordHash, body.password));
    else {
      const flow = body.method === 'webauthn' ? await consumeFlow(`stepup:${req.sessionId}`, 'webauthn_auth') : null;
      ok = await checkFactor(user, body as never, typeof flow?.data.challenge === 'string' ? flow.data.challenge : null);
    }
    if (!ok) {
      const n = await bumpCounter(`stepfail:${req.sessionId}`, 'stepup_fail', STEP_UP_FAIL_WINDOW_MIN);
      if (n >= STEP_UP_FAILS && req.sessionId) {
        // too many wrong proofs from one session: it may not be its owner using it
        await deleteSession(req.sessionId);
        clearSessionCookie(reply);
        throw new HttpError(401, 'Too many failed attempts. You have been signed out; sign in again.', 'stepup_locked');
      }
      throw new HttpError(401, body.method === 'password' ? 'That password is not correct.' : 'That did not match. Try again.', 'stepup_invalid', { [body.method === 'password' ? 'password' : 'code']: 'Did not match' });
    }
    const now = new Date();
    await db
      .update(schema.sessions)
      .set(body.method === 'password' ? { reauthAt: now } : { reauthAt: now, mfaAt: now })
      .where(eq(schema.sessions.id, req.sessionId ?? ''));
    return { ok: true, validUntil: new Date(now.getTime() + MFA.stepUpMinutes * 60_000).toISOString() };
  });

  // ------------------------------------------------------------------ the person's own factors
  app.get('/api/me/mfa', async (req) => mfaStatus(requireUser(req), req.session));

  app.post('/api/me/mfa/totp/start', LIMIT, async (req) => {
    const user = requireUser(req);
    await requireRecentAuth(req);
    return beginTotp(user);
  });

  app.post('/api/me/mfa/totp/confirm', LIMIT, async (req) => {
    const user = requireUser(req);
    const { code } = parse(totpConfirmSchema, req.body);
    const firstFactor = (await factorCount(user)) === 0;
    const r = await confirmTotp(user, code.replace(/[\s-]/g, ''));
    await markSessionMfa(req.sessionId);
    return { ...(await mfaStatus(await reloadUser(user.id), { ...req.session!, mfaAt: new Date() })), newRecoveryCodes: r.recoveryCodes };
  });

  app.delete('/api/me/mfa/totp', async (req) => {
    const user = requireUser(req);
    await requireRecentAuth(req);
    if (!user.mfaTotpEnabledAt) throw notFound('No authenticator app is set up');
    await guardLastFactor(user);
    await disableTotp(user);
    return mfaStatus(await reloadUser(user.id), req.session);
  });

  app.post('/api/me/mfa/recovery-codes', LIMIT, async (req) => {
    const user = requireUser(req);
    await requireRecentAuth(req);
    if ((await factorCount(user)) === 0) throw badRequest('Set up an authenticator app or a passkey first; recovery codes come with it.');
    const codes = await regenerateRecoveryCodes(user.id);
    return { newRecoveryCodes: codes };
  });

  app.post('/api/me/mfa/passkeys/options', LIMIT, async (req) => {
    const user = requireUser(req);
    await requireRecentAuth(req);
    const options = await passkeyRegistrationOptions(user);
    await createFlow('webauthn_reg', { token: `reg:${req.sessionId}`, userId: user.id, data: { challenge: options.challenge }, ttlMinutes: MFA.flowMinutes });
    return options;
  });

  app.post('/api/me/mfa/passkeys', LIMIT, async (req) => {
    const user = requireUser(req);
    const body = parse(passkeyRegisterSchema, req.body);
    const flow = await consumeFlow(`reg:${req.sessionId}`, 'webauthn_reg');
    if (!flow || flow.userId !== user.id || typeof flow.data.challenge !== 'string') throw badRequest('The passkey request expired. Start again.');
    const firstFactor = (await factorCount(user)) === 0;
    const r = await registerPasskey(user, flow.data.challenge, body.response, body.name);
    await markSessionMfa(req.sessionId);
    return { ...(await mfaStatus(await reloadUser(user.id), { ...req.session!, mfaAt: new Date() })), newRecoveryCodes: r.recoveryCodes };
  });

  app.patch('/api/me/mfa/passkeys/:id', async (req) => {
    const user = requireUser(req);
    const id = (req.params as { id: string }).id;
    if (!isUuid(id)) throw notFound('Passkey not found');
    const { name } = parse(passkeyNameSchema, req.body);
    return renamePasskey(user.id, id, name);
  });

  app.delete('/api/me/mfa/passkeys/:id', async (req) => {
    const user = requireUser(req);
    await requireRecentAuth(req);
    const id = (req.params as { id: string }).id;
    if (!isUuid(id)) throw notFound('Passkey not found');
    const owned = await db.query.webauthnCredentials.findFirst({ where: eq(schema.webauthnCredentials.id, id) });
    if (!owned || owned.userId !== user.id) throw notFound('Passkey not found');
    await guardLastFactor(user);
    const removed = await removePasskey(user.id, id);
    return mfaStatus(await reloadUser(user.id), req.session);
  });
}
