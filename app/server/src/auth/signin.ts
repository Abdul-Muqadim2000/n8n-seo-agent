import type { FastifyReply } from 'fastify';
import { maskEmail, MFA, type AuthMethod, type MfaChallenge } from '@seo/shared';
import { config } from '../config';
import type { UserRow } from '../db/schema';
import { mfaMethods } from '../services/mfa';
import { createFlow } from './flows';

/**
 * G1: the second half of a sign-in. When the person has two-step verification, a proven first factor (password, Google, SSO) opens
 * an `mfa_login` flow instead of a session; the browser holds its token in this cookie and completes it at /api/auth/mfa/verify.
 */
export const MFA_COOKIE = 'mfa_flow';
export const MFA_COOKIE_OPTS = { path: '/api/auth', httpOnly: true, sameSite: 'lax' as const, secure: config.cookieSecure, maxAge: MFA.flowMinutes * 60 };

export interface PendingSignIn {
  method: AuthMethod;
  ssoOrgId?: string | null;
  /** SSO: the company's IdP counts as a second factor (then no challenge is opened at all) */
  next?: string;
}

/** null when the person has no second factor (the caller creates the session); otherwise the challenge for the page */
export async function startMfaChallenge(reply: FastifyReply, user: UserRow, p: PendingSignIn): Promise<MfaChallenge | null> {
  const methods = await mfaMethods(user);
  if (!methods.length) return null;
  const token = await createFlow('mfa_login', { userId: user.id, data: { method: p.method, ssoOrgId: p.ssoOrgId ?? null, next: p.next ?? '/' }, ttlMinutes: MFA.flowMinutes });
  reply.setCookie(MFA_COOKIE, token, MFA_COOKIE_OPTS);
  return { mfaRequired: true, methods, emailHint: maskEmail(user.email) };
}
