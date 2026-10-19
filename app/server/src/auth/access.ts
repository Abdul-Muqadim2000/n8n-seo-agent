import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { ACCOUNT_SUSPENDED, clientWorkspaceRole, IDENTITY_ERRORS, isClientRole, MFA, policyOf, roleAtLeast, sessionMeetsMfa, type Role, type StepUpMethod } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, SessionRow, SiteRow, UserRow } from '../db/schema';
import { forbidden, HttpError, notFound, unauthorized } from '../lib/errors';

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow | null;
    sessionId: string | null;
    /** G1: the session row behind the cookie (how it signed in, second factor, last step-up) */
    session: SessionRow | null;
    /** G1: set when this request's session was ended (idle timeout) */
    sessionEnded?: 'idle' | 'suspended';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export function requireUser(req: FastifyRequest): UserRow {
  if (!req.user && req.sessionEnded === 'idle') throw new HttpError(401, 'You were signed out after a period of inactivity. Sign in again.', IDENTITY_ERRORS.sessionIdle);
  if (!req.user && req.sessionEnded === 'suspended') throw new HttpError(401, ACCOUNT_SUSPENDED.message, ACCOUNT_SUSPENDED.code);
  if (!req.user) throw unauthorized();
  return req.user;
}

export function isPlatformAdmin(user: UserRow | null): boolean {
  return !!user && !!user.emailVerifiedAt && config.platformAdmins.includes(user.email.toLowerCase());
}

export interface OrgAccess {
  user: UserRow;
  org: OrgRow;
  role: Role;
}

/**
 * The signed-in user's role in the company, at least `min`; 404 for companies they do not belong to.
 *
 * G5 (app/docs/WHITE_LABEL.md §4): in an agency's client workspace the role comes from what the person holds there AND in its agency
 * (`clientWorkspaceRole`): agency owners / admins reach every client, members / viewers only clients they were assigned to, client
 * people their client role, never anything from an agency membership that is gone or switched off. Client roles rank below viewer,
 * so a route that asks for viewer or more refuses them; the portal's routes pass `min: 'client_viewer'` explicitly. On a portal host,
 * every company outside that agency is a 404.
 */
export async function orgAccess(req: FastifyRequest, orgId: unknown, min: Role = 'viewer'): Promise<OrgAccess> {
  const user = requireUser(req);
  if (!isUuid(orgId)) throw notFound('Company not found');
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw notFound('Company not found');
  const portal = req.portal;
  if (portal && org.id !== portal.orgId && org.parentOrgId !== portal.orgId) throw notFound('Company not found');
  const direct = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, org.id), eq(schema.memberships.userId, user.id)) });
  let role: Role | null;
  let agency: OrgRow | null = null;
  if (org.kind === 'client' && org.parentOrgId) {
    const am = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, org.parentOrgId), eq(schema.memberships.userId, user.id)) });
    role = clientWorkspaceRole({
      direct: direct ? { role: direct.role, deactivated: !!direct.deactivatedAt } : null,
      agency: am ? { role: am.role, deactivated: !!am.deactivatedAt } : null,
    });
    if (!role) {
      if (direct?.deactivatedAt || am?.deactivatedAt) throw new HttpError(403, `Your access to ${org.name} has been switched off by your organisation.`, 'membership_deactivated');
      throw notFound('Company not found');
    }
    // agency staff also answer to the agency's own two-step policy
    if (!isClientRole(role)) agency = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, org.parentOrgId) })) ?? null;
  } else {
    if (!direct) throw notFound('Company not found');
    // G1: switched off by the company's identity provider (SCIM)
    if (direct.deactivatedAt) throw new HttpError(403, `Your access to ${org.name} has been switched off by your organisation.`, 'membership_deactivated');
    // a client role outside a client workspace means nothing (never written; refused anyway)
    if (isClientRole(direct.role)) throw notFound('Company not found');
    role = direct.role as Role;
  }
  if (agency) await requireCompanyMfa(req, agency, user);
  await requireCompanyMfa(req, org, user);
  if (!roleAtLeast(role, min)) throw forbidden(isClientRole(role) ? 'This is not part of your client portal.' : `This needs the ${min} role or higher`);
  return { user, org, role };
}

/** has the person set up at least one second factor? */
export async function userHasMfa(user: UserRow): Promise<boolean> {
  if (user.mfaTotpEnabledAt) return true;
  const k = await db.query.webauthnCredentials.findFirst({ where: eq(schema.webauthnCredentials.userId, user.id), columns: { id: true } });
  return !!k;
}

/**
 * G1: a company that requires two-step verification shows nothing to a session that has not passed one (or a sign-in the company
 * counts as one). 403 `mfa_enrolment_required` when the person has no factor yet, `mfa_verification_required` when they have one.
 */
export async function requireCompanyMfa(req: FastifyRequest, org: OrgRow, user: UserRow): Promise<void> {
  const policy = policyOf(org.securityPolicy);
  if (!policy.requireMfa) return;
  const s = req.session;
  if (s && sessionMeetsMfa(policy, s, org.id)) return;
  if (await userHasMfa(user))
    throw new HttpError(403, `${org.name} requires two-step verification. Confirm it is you with your authenticator app, a passkey or a recovery code.`, IDENTITY_ERRORS.mfaVerification);
  throw new HttpError(403, `${org.name} requires two-step verification. Set it up on your account to continue.`, IDENTITY_ERRORS.mfaEnrolment);
}

/** the ways this person can prove presence again (step-up) */
export async function stepUpMethods(user: UserRow): Promise<StepUpMethod[]> {
  const out: StepUpMethod[] = [];
  if (user.mfaTotpEnabledAt) out.push('totp');
  const k = await db.query.webauthnCredentials.findFirst({ where: eq(schema.webauthnCredentials.userId, user.id), columns: { id: true } });
  if (k) out.push('webauthn');
  if (out.length) return [...out, 'recovery'];
  return user.passwordHash ? ['password'] : ['signin'];
}

/**
 * G1 step-up: a security-relevant change needs a proof of presence (sign-in or step-up) within the last `MFA.stepUpMinutes`.
 * Otherwise 403 `reauth_required` with the methods that will do; the web app opens one dialog and retries the request.
 */
export async function requireRecentAuth(req: FastifyRequest): Promise<void> {
  const user = requireUser(req);
  const at = req.session?.reauthAt?.getTime() ?? 0;
  if (Date.now() - at <= MFA.stepUpMinutes * 60_000) return;
  const methods = await stepUpMethods(user);
  throw new HttpError(403, 'Confirm it is you to make this change.', IDENTITY_ERRORS.reauth, undefined, { methods });
}

export interface SiteAccess extends OrgAccess {
  site: SiteRow;
}

export async function siteAccess(req: FastifyRequest, orgId: unknown, siteId: unknown, min: Role = 'viewer'): Promise<SiteAccess> {
  const a = await orgAccess(req, orgId, min);
  if (!isUuid(siteId)) throw notFound('Website not found');
  const site = await db.query.sites.findFirst({ where: and(eq(schema.sites.id, siteId), eq(schema.sites.orgId, a.org.id)) });
  if (!site) throw notFound('Website not found');
  return { ...a, site };
}

/** Dashboards read the n8n Data Tables by domain, so only a company that proved it owns the domain may see them. */
export function requireVerified(site: SiteRow) {
  if (!site.verifiedAt) throw forbidden(`Verify that you own ${site.domain} to see its data and run site checks`);
}
