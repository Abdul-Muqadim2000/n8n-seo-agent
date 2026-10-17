import { X509Certificate } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { and, eq, isNotNull, ne, or, sql } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as oidc from 'openid-client';
import { SAML, ValidateInResponseTo, type CacheProvider, type Profile } from '@node-saml/node-saml';
import {
  ssoEmailDomain,
  policyOf,
  SSO,
  ssoConnectionSchema,
  type Role,
  type SsoCertInfo,
  type SsoConnectionView,
  type SsoDomainView,
  type SsoOverview,
  type SsoServiceProvider,
} from '@seo/shared';
import { z } from 'zod';
import { refreshSessionPolicy, createSession } from '../auth/session';
import { startMfaChallenge } from '../auth/signin';
import { createFlow, consumeFlow, markSeenOnce } from '../auth/flows';
import { userHasMfa } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, SsoConnectionRow, SsoDomainRow, UserRow } from '../db/schema';
import { randomToken, sha256 } from '../lib/crypto';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../lib/errors';
import { guardedFetch } from '../lib/safeFetch';
import { identitySecretsReady, sealIdentity, unsealIdentity } from '../lib/secretBox';
import { audit } from './audit';

/**
 * G1 single sign-on (app/docs/IDENTITY.md §3-4): OIDC through `openid-client` (code flow + PKCE + nonce, issuer / audience / expiry
 * checked by the library) and SAML 2.0 through `@node-saml/node-saml` (signed assertions, audience, InResponseTo against requests we
 * issued, clock skew), plus our own checks the libraries leave to the caller: the assertion's issuer and recipient, a single use of
 * each assertion id, and that the address is on one of the company's DNS-verified domains.
 */

/** the outside world, swappable in tests (a mock OIDC issuer, made-up DNS answers) */
export const ssoDeps = {
  fetch: guardedFetch as (url: string, init?: Parameters<typeof guardedFetch>[1]) => Promise<Response>,
  resolveTxt: (domain: string) => dns.resolveTxt(domain),
  now: () => Date.now(),
};

export const SSO_COOKIE = 'sso_flow';
const ssoCookieOpts = () =>
  // the SAML answer comes back as a cross-site POST: on https the binding cookie must be SameSite=None to travel with it
  ({ path: '/api/sso', httpOnly: true, secure: config.cookieSecure, sameSite: (config.cookieSecure ? 'none' : 'lax') as 'none' | 'lax', maxAge: SSO.flowMinutes * 60 });

// ------------------------------------------------------------------ views

export const spInfo = (conn: Pick<SsoConnectionRow, 'id'> | null): SsoServiceProvider => ({
  oidcRedirectUri: `${config.appUrl}/api/sso/oidc/callback`,
  samlEntityId: conn ? `${config.appUrl}/api/sso/saml/${conn.id}` : null,
  samlAcsUrl: conn ? `${config.appUrl}/api/sso/saml/${conn.id}/acs` : null,
  samlMetadataUrl: conn ? `${config.appUrl}/api/sso/saml/${conn.id}/metadata` : null,
  loginUrl: `${config.appUrl}/login/sso`,
});

const toDomainView = (d: SsoDomainRow): SsoDomainView => ({
  id: d.id,
  domain: d.domain,
  verified: !!d.verifiedAt,
  verifiedAt: d.verifiedAt?.toISOString() ?? null,
  txtValue: SSO.txtPrefix + d.verificationToken,
});

export function certInfo(pem: string): SsoCertInfo {
  try {
    const c = new X509Certificate(pem);
    return { subject: c.subject.replace(/\n/g, ', '), notAfter: new Date(c.validTo).toISOString(), expired: new Date(c.validTo).getTime() < Date.now(), fingerprint: c.fingerprint256 };
  } catch {
    return { subject: 'Unreadable certificate', notAfter: '', expired: true, fingerprint: '' };
  }
}

/** a pasted certificate (PEM, or the bare base64 most IdPs show) → PEM, or a 400 */
export function normalizeCert(input: string): string {
  const body = input.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=]{100,}$/.test(body)) throw badRequest('That does not look like a certificate. Paste the X.509 signing certificate (PEM or base64).', { 'saml.certificates': 'Not a certificate' });
  const pem = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----\n`;
  try {
    new X509Certificate(pem);
  } catch {
    throw badRequest('That certificate could not be read. Download it again from your identity provider.', { 'saml.certificates': 'Unreadable' });
  }
  return pem;
}

export const toConnectionView = (c: SsoConnectionRow): SsoConnectionView => ({
  id: c.id,
  protocol: c.protocol as 'oidc' | 'saml',
  enabled: c.enabled,
  enforced: c.enforced,
  jitEnabled: c.jitEnabled,
  defaultRole: c.defaultRole as 'admin' | 'member' | 'viewer',
  oidc: c.protocol === 'oidc' ? { issuer: c.oidcIssuer ?? '', clientId: c.oidcClientId ?? '', hasClientSecret: !!c.oidcClientSecret } : null,
  saml: c.protocol === 'saml' ? { entityId: c.samlEntityId ?? '', ssoUrl: c.samlSsoUrl ?? '', certificates: c.samlCerts.map(certInfo) } : null,
  lastTest: c.lastTestAt ? { at: c.lastTestAt.toISOString(), ok: !!c.lastTestOk, message: c.lastTestMessage ?? '' } : null,
  lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
  updatedAt: c.updatedAt.toISOString(),
});

const connectionOf = (orgId: string) => db.query.ssoConnections.findFirst({ where: eq(schema.ssoConnections.orgId, orgId) });
const verifiedDomains = async (orgId: string) =>
  (await db.query.ssoDomains.findMany({ where: and(eq(schema.ssoDomains.orgId, orgId), isNotNull(schema.ssoDomains.verifiedAt)) })).map((d) => d.domain);

export async function ssoOverview(org: OrgRow): Promise<SsoOverview> {
  const [domains, conn] = await Promise.all([db.query.ssoDomains.findMany({ where: eq(schema.ssoDomains.orgId, org.id), orderBy: schema.ssoDomains.createdAt }), connectionOf(org.id)]);
  return { domains: domains.map(toDomainView), connection: conn ? toConnectionView(conn) : null, sp: spInfo(conn ?? null), secretsReady: identitySecretsReady() };
}

// ------------------------------------------------------------------ domains

export async function addDomain(req: FastifyRequest, org: OrgRow, user: UserRow, domain: string): Promise<SsoDomainView> {
  const count = await db.select({ n: sql<number>`count(*)::int` }).from(schema.ssoDomains).where(eq(schema.ssoDomains.orgId, org.id));
  if (Number(count[0]?.n ?? 0) >= SSO.maxDomains) throw badRequest(`A company can claim up to ${SSO.maxDomains} domains.`);
  const taken = await db.query.ssoDomains.findFirst({ where: and(eq(schema.ssoDomains.domain, domain), isNotNull(schema.ssoDomains.verifiedAt), ne(schema.ssoDomains.orgId, org.id)) });
  if (taken) throw conflict(`${domain} is already verified by another company on this platform.`, 'domain_claimed');
  const [row] = await db.insert(schema.ssoDomains).values({ orgId: org.id, domain, verificationToken: randomToken(18), createdBy: user.id }).onConflictDoNothing().returning();
  if (!row) throw conflict(`${domain} is already on your list.`);
  await audit(req, org.id, { action: 'sso.domain_added', target: { type: 'domain', id: row.id, label: domain } });
  return toDomainView(row);
}

export async function verifyDomain(req: FastifyRequest, org: OrgRow, id: string): Promise<{ domain: SsoDomainView; verified: boolean; message: string }> {
  const row = await db.query.ssoDomains.findFirst({ where: and(eq(schema.ssoDomains.id, id), eq(schema.ssoDomains.orgId, org.id)) });
  if (!row) throw notFound('Domain not found');
  if (row.verifiedAt) return { domain: toDomainView(row), verified: true, message: 'Already verified.' };
  const expected = SSO.txtPrefix + row.verificationToken;
  let records: string[] = [];
  try {
    records = (await ssoDeps.resolveTxt(row.domain)).map((c) => c.join(''));
  } catch (err) {
    return { domain: toDomainView(row), verified: false, message: `Could not read the DNS records of ${row.domain} (${(err as NodeJS.ErrnoException).code ?? 'lookup failed'}).` };
  }
  if (!records.some((r) => r.trim() === expected))
    return { domain: toDomainView(row), verified: false, message: `No TXT record "${expected}" on ${row.domain} yet. DNS changes can take a few minutes to an hour.` };
  const taken = await db.query.ssoDomains.findFirst({ where: and(eq(schema.ssoDomains.domain, row.domain), isNotNull(schema.ssoDomains.verifiedAt), ne(schema.ssoDomains.orgId, org.id)) });
  if (taken) throw conflict(`${row.domain} is already verified by another company on this platform.`, 'domain_claimed');
  const [v] = await db.update(schema.ssoDomains).set({ verifiedAt: new Date(ssoDeps.now()) }).where(eq(schema.ssoDomains.id, row.id)).returning();
  await audit(req, org.id, { action: 'sso.domain_verified', target: { type: 'domain', id: row.id, label: row.domain } });
  return { domain: toDomainView(v), verified: true, message: 'TXT record found.' };
}

export async function removeDomain(req: FastifyRequest, org: OrgRow, id: string): Promise<void> {
  const [row] = await db.delete(schema.ssoDomains).where(and(eq(schema.ssoDomains.id, id), eq(schema.ssoDomains.orgId, org.id))).returning();
  if (!row) throw notFound('Domain not found');
  await audit(req, org.id, { action: 'sso.domain_removed', target: { type: 'domain', id: row.id, label: row.domain }, details: { wasVerified: !!row.verifiedAt } });
  // without a verified domain nothing can be enforced
  if (!(await verifiedDomains(org.id)).length) await db.update(schema.ssoConnections).set({ enforced: false }).where(eq(schema.ssoConnections.orgId, org.id));
}

// ------------------------------------------------------------------ the connection

export async function saveConnection(req: FastifyRequest, org: OrgRow, input: z.output<typeof ssoConnectionSchema>): Promise<SsoConnectionView> {
  const before = await connectionOf(org.id);
  const next: Partial<SsoConnectionRow> = { protocol: input.protocol, jitEnabled: input.jitEnabled, defaultRole: input.defaultRole, updatedAt: new Date() };
  if (input.protocol === 'oidc' && input.oidc) {
    const issuer = input.oidc.issuer.replace(/\/+$/, '');
    next.oidcIssuer = issuer;
    next.oidcClientId = input.oidc.clientId;
    if (input.oidc.clientSecret) {
      if (!identitySecretsReady()) throw badRequest('This server cannot store the client secret yet (IDENTITY_KEY is not set). Ask the platform administrator.');
      next.oidcClientSecret = sealIdentity(input.oidc.clientSecret);
    } else if (!before?.oidcClientSecret || before.protocol !== 'oidc') throw badRequest('Enter the client secret', { 'oidc.clientSecret': 'Required' });
    next.samlEntityId = null;
    next.samlSsoUrl = null;
    next.samlCerts = [];
  } else if (input.protocol === 'saml' && input.saml) {
    next.samlEntityId = input.saml.entityId;
    next.samlSsoUrl = input.saml.ssoUrl;
    if (input.saml.certificates.length) next.samlCerts = input.saml.certificates.map(normalizeCert);
    else if (before?.protocol === 'saml' && before.samlCerts.length) next.samlCerts = before.samlCerts;
    else throw badRequest('Paste the signing certificate', { 'saml.certificates': 'Required' });
    next.oidcIssuer = null;
    next.oidcClientId = null;
    next.oidcClientSecret = null;
  }
  // a changed identity provider must be tested again before anyone signs in through it
  const idpChanged =
    !before ||
    before.protocol !== next.protocol ||
    before.oidcIssuer !== next.oidcIssuer ||
    before.oidcClientId !== next.oidcClientId ||
    (input.protocol === 'oidc' && !!input.oidc?.clientSecret) ||
    before.samlEntityId !== next.samlEntityId ||
    before.samlSsoUrl !== next.samlSsoUrl ||
    JSON.stringify(before.samlCerts) !== JSON.stringify(next.samlCerts);
  if (idpChanged) Object.assign(next, { enabled: false, enforced: false, lastTestOk: null, lastTestAt: null, lastTestMessage: null });
  const [row] = before
    ? await db.update(schema.ssoConnections).set(next).where(eq(schema.ssoConnections.id, before.id)).returning()
    : await db.insert(schema.ssoConnections).values({ ...(next as typeof schema.ssoConnections.$inferInsert), orgId: org.id }).returning();
  oidcCache.delete(row.id);
  await audit(req, org.id, {
    action: 'sso.connection_saved',
    target: { type: 'sso_connection', id: row.id, label: row.protocol.toUpperCase() },
    details: {
      protocol: row.protocol,
      issuer: row.oidcIssuer ?? row.samlEntityId,
      clientId: row.oidcClientId,
      jitEnabled: row.jitEnabled,
      defaultRole: row.defaultRole,
      idpChanged,
      ...(idpChanged && before?.enabled ? { disabledUntilTested: true } : {}),
    },
  });
  return toConnectionView(row);
}

export async function deleteConnection(req: FastifyRequest, org: OrgRow): Promise<void> {
  const [row] = await db.delete(schema.ssoConnections).where(eq(schema.ssoConnections.orgId, org.id)).returning();
  if (!row) throw notFound('No single sign-on connection');
  oidcCache.delete(row.id);
  await audit(req, org.id, { action: 'sso.connection_deleted', target: { type: 'sso_connection', id: row.id, label: row.protocol.toUpperCase() } });
}

/** switch sign-on on / off, and make it required for the company's domains (owners only, with conditions) */
export async function setSwitches(req: FastifyRequest, org: OrgRow, user: UserRow, role: Role, s: { enabled?: boolean; enforced?: boolean }): Promise<SsoConnectionView> {
  const conn = await connectionOf(org.id);
  if (!conn) throw notFound('Set up the connection first');
  const domains = await verifiedDomains(org.id);
  const enabled = s.enabled ?? conn.enabled;
  let enforced = s.enforced ?? conn.enforced;
  if (!enabled) enforced = false;
  if (enabled && !conn.enabled) {
    if (!conn.lastTestOk) throw badRequest('Test the connection first: a sign-in must succeed once before it can be switched on.');
    if (!domains.length) throw badRequest('Verify at least one e-mail domain first.');
  }
  if (enforced && !conn.enforced) {
    if (role !== 'owner') throw forbidden('Only an owner can make single sign-on required.');
    if (!domains.length) throw badRequest('Verify at least one e-mail domain first.');
    // the owner's password is the way in when the identity provider is down: it must be protected by a second factor
    if (!(await userHasMfa(user))) throw badRequest('Turn on two-step verification for your own account first: as an owner you keep your password as the way in if your identity provider is down.');
  }
  if (s.enforced === false && conn.enforced && role !== 'owner') throw forbidden('Only an owner can stop requiring single sign-on.');
  const [row] = await db.update(schema.ssoConnections).set({ enabled, enforced, updatedAt: new Date() }).where(eq(schema.ssoConnections.id, conn.id)).returning();
  if (enforced && !conn.enforced) {
    const revoked = await revokeNonSsoSessions(org.id, domains);
    await audit(req, org.id, { action: 'sso.enforced', target: { type: 'sso_connection', id: conn.id }, details: { domains, sessionsSignedOut: revoked } });
  } else if (!enforced && conn.enforced) await audit(req, org.id, { action: 'sso.unenforced', target: { type: 'sso_connection', id: conn.id } });
  if (enabled !== conn.enabled) await audit(req, org.id, { action: 'sso.connection_saved', target: { type: 'sso_connection', id: conn.id }, details: { enabled } });
  return toConnectionView(row);
}

/** enforcement starts now: members on the domains (owners excepted) lose the sessions they opened without this company's SSO */
async function revokeNonSsoSessions(orgId: string, domains: string[]): Promise<number> {
  const members = await db
    .select({ id: schema.users.id, email: schema.users.email, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(eq(schema.memberships.orgId, orgId));
  let n = 0;
  for (const m of members.filter((x) => x.role !== 'owner' && domains.includes(ssoEmailDomain(x.email)))) {
    const gone = await db
      .delete(schema.sessions)
      .where(and(eq(schema.sessions.userId, m.id), or(ne(schema.sessions.authMethod, 'sso'), sql`${schema.sessions.ssoOrgId} is distinct from ${orgId}`)))
      .returning({ id: schema.sessions.id });
    n += gone.length;
  }
  return n;
}

// ------------------------------------------------------------------ who signs in where

/** the enabled connection serving this address's domain, with its company */
export async function connectionForEmail(email: string): Promise<{ conn: SsoConnectionRow; org: OrgRow } | null> {
  const d = ssoEmailDomain(email);
  if (!d) return null;
  const rows = await db
    .select({ conn: schema.ssoConnections, org: schema.organizations })
    .from(schema.ssoDomains)
    .innerJoin(schema.ssoConnections, eq(schema.ssoConnections.orgId, schema.ssoDomains.orgId))
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.ssoDomains.orgId))
    .where(and(eq(schema.ssoDomains.domain, d), isNotNull(schema.ssoDomains.verifiedAt), eq(schema.ssoConnections.enabled, true)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Must this address sign in through its company's identity provider? Null when not (no enforced connection for its domain, or the
 * person is an owner of that company — the break-glass account). Checked before any password is.
 */
export async function ssoRequiredFor(email: string, userId: string | null): Promise<{ orgName: string; url: string } | null> {
  const hit = await connectionForEmail(email);
  if (!hit || !hit.conn.enforced) return null;
  if (userId) {
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, hit.org.id), eq(schema.memberships.userId, userId)) });
    if (m?.role === 'owner') return null;
  }
  return { orgName: hit.org.name, url: `/api/sso/start?email=${encodeURIComponent(email)}` };
}

export function ssoRequiredError(r: { orgName: string; url: string }): HttpError {
  return new HttpError(403, `${r.orgName} signs you in through its identity provider. Use "Sign in with SSO".`, 'sso_required', undefined, { ssoUrl: r.url });
}

// ------------------------------------------------------------------ OIDC

const oidcCache = new Map<string, { at: number; updatedAt: number; cfg: oidc.Configuration }>();

async function oidcConfig(conn: SsoConnectionRow): Promise<oidc.Configuration> {
  const hit = oidcCache.get(conn.id);
  if (hit && hit.updatedAt === conn.updatedAt.getTime() && Date.now() - hit.at < 10 * 60_000) return hit.cfg;
  if (!conn.oidcIssuer || !conn.oidcClientId || !conn.oidcClientSecret) throw badRequest('The OIDC connection is incomplete.');
  const secret = unsealIdentity(conn.oidcClientSecret);
  const fetchFn = ((url: string, opts: { method?: string; headers?: Record<string, string>; body?: unknown; signal?: AbortSignal }) => ssoDeps.fetch(url, opts)) as unknown as oidc.CustomFetch;
  let cfg = await oidc.discovery(new URL(conn.oidcIssuer), conn.oidcClientId, undefined, oidc.ClientSecretBasic(secret), {
    [oidc.customFetch]: fetchFn,
    ...(config.ssoAllowPrivateHosts && conn.oidcIssuer.startsWith('http:') ? { execute: [oidc.allowInsecureRequests] } : {}),
  });
  const methods = cfg.serverMetadata().token_endpoint_auth_methods_supported;
  if (methods && !methods.includes('client_secret_basic') && methods.includes('client_secret_post')) {
    cfg = new oidc.Configuration(cfg.serverMetadata(), conn.oidcClientId, undefined, oidc.ClientSecretPost(secret));
    cfg[oidc.customFetch] = fetchFn;
  }
  oidcCache.set(conn.id, { at: Date.now(), updatedAt: conn.updatedAt.getTime(), cfg });
  return cfg;
}

// ------------------------------------------------------------------ SAML

/** request ids we issued, per connection, single use (node-saml removes them when it accepts the answer) */
const samlCache = (connId: string): CacheProvider => ({
  saveAsync: async (key, value) => {
    await createFlow('saml_req', { token: `samlreq:${connId}:${key}`, data: { value }, ttlMinutes: SSO.flowMinutes });
    return { value, createdAt: Date.now() };
  },
  getAsync: async (key) => {
    const row = await db.query.authFlows.findFirst({ where: and(eq(schema.authFlows.id, sha256(`samlreq:${connId}:${key}`)), sql`${schema.authFlows.expiresAt} > now()`) });
    return row ? String(row.data.value ?? '1') : null;
  },
  removeAsync: async (key) => {
    if (!key) return null;
    const gone = await consumeFlow(`samlreq:${connId}:${key}`, 'saml_req');
    return gone ? String(gone.data.value ?? '1') : null;
  },
});

function samlFor(conn: SsoConnectionRow): SAML {
  const sp = spInfo(conn);
  if (!conn.samlSsoUrl || !conn.samlEntityId || !conn.samlCerts.length) throw badRequest('The SAML connection is incomplete.');
  return new SAML({
    callbackUrl: sp.samlAcsUrl!,
    entryPoint: conn.samlSsoUrl,
    issuer: sp.samlEntityId!,
    audience: sp.samlEntityId!,
    idpCert: conn.samlCerts,
    idpIssuer: conn.samlEntityId,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    acceptedClockSkewMs: SSO.clockSkewSeconds * 1000,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: SSO.flowMinutes * 60_000,
    cacheProvider: samlCache(conn.id),
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    disableRequestedAuthnContext: true,
  });
}

export function samlMetadata(conn: SsoConnectionRow): string {
  const sp = spInfo(conn);
  return new SAML({ callbackUrl: sp.samlAcsUrl!, issuer: sp.samlEntityId!, idpCert: 'unused', wantAssertionsSigned: true }).generateServiceProviderMetadata(null, null);
}

const attr = (xml: string, el: string, name: string): string | null => xml.match(new RegExp(`<(?:[\\w-]+:)?${el}\\b[^>]*\\s${name}="([^"]+)"`))?.[1] ?? null;
const text = (xml: string, el: string): string | null => xml.match(new RegExp(`<(?:[\\w-]+:)?${el}\\b[^>]*>\\s*([^<]+?)\\s*</`))?.[1] ?? null;

/** checks node-saml leaves to us, over the signed assertion it accepted: issuer, recipient, single use */
async function checkAssertion(conn: SsoConnectionRow, assertionXml: string): Promise<void> {
  const sp = spInfo(conn);
  const issuer = text(assertionXml, 'Issuer');
  if (issuer !== conn.samlEntityId) throw new Error(`The assertion was issued by ${issuer ?? 'nobody'}, not ${conn.samlEntityId}`);
  const recipient = attr(assertionXml, 'SubjectConfirmationData', 'Recipient');
  if (recipient && recipient !== sp.samlAcsUrl) throw new Error('The assertion was meant for another address (Recipient)');
  if (!recipient) throw new Error('The assertion names no Recipient');
  const id = attr(assertionXml, 'Assertion', 'ID');
  if (!id) throw new Error('The assertion has no ID');
  const until = attr(assertionXml, 'SubjectConfirmationData', 'NotOnOrAfter') ?? attr(assertionXml, 'Conditions', 'NotOnOrAfter');
  const exp = until ? new Date(until).getTime() + SSO.clockSkewSeconds * 1000 : Date.now() + 3600_000;
  if (!(await markSeenOnce(`saml:${conn.id}:${id}`, new Date(Math.max(exp, Date.now() + 60_000))))) throw new Error('This assertion was already used (replay)');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function samlIdentity(p: Profile): { subject: string; email: string; name: string } {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = p[k];
      const s = Array.isArray(v) ? v[0] : v;
      if (typeof s === 'string' && s.trim()) return s.trim();
    }
    return '';
  };
  const email = pick('email', 'mail', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'urn:oid:0.9.2342.19200300.100.1.3', 'Email', 'EmailAddress') || (EMAIL_RE.test(p.nameID ?? '') ? p.nameID : '');
  const given = pick('firstName', 'givenName', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname', 'urn:oid:2.5.4.42');
  const family = pick('lastName', 'surname', 'sn', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname', 'urn:oid:2.5.4.4');
  const name = pick('displayName', 'name', 'http://schemas.microsoft.com/identity/claims/displayname') || [given, family].filter(Boolean).join(' ');
  return { subject: p.nameID, email: email.toLowerCase(), name };
}

// ------------------------------------------------------------------ the round trip

interface FlowData {
  connId: string;
  next: string;
  test: boolean;
  adminUserId: string | null;
  verifier?: string;
  nonce?: string;
}

/** starts a sign-in (or a test) at the company's identity provider; returns where to send the browser */
export async function beginSso(reply: FastifyReply, conn: SsoConnectionRow, o: { next: string; test?: boolean; adminUserId?: string | null; loginHint?: string }): Promise<string> {
  const data: FlowData = { connId: conn.id, next: o.next, test: !!o.test, adminUserId: o.adminUserId ?? null };
  if (conn.protocol === 'oidc') {
    const cfg = await oidcConfig(conn);
    data.verifier = oidc.randomPKCECodeVerifier();
    data.nonce = oidc.randomNonce();
    const token = await createFlow('sso', { orgId: conn.orgId, data: { ...data }, ttlMinutes: SSO.flowMinutes });
    reply.setCookie(SSO_COOKIE, token, ssoCookieOpts());
    const url = oidc.buildAuthorizationUrl(cfg, {
      redirect_uri: spInfo(conn).oidcRedirectUri,
      scope: 'openid email profile',
      response_type: 'code',
      code_challenge: await oidc.calculatePKCECodeChallenge(data.verifier),
      code_challenge_method: 'S256',
      state: token,
      nonce: data.nonce,
      ...(o.loginHint ? { login_hint: o.loginHint } : {}),
      ...(o.test ? { prompt: 'login' } : {}),
    });
    return url.href;
  }
  const token = await createFlow('sso', { orgId: conn.orgId, data: { ...data }, ttlMinutes: SSO.flowMinutes });
  reply.setCookie(SSO_COOKIE, token, ssoCookieOpts());
  return samlFor(conn).getAuthorizeUrlAsync(token, undefined, {});
}

export interface SsoIdentity {
  subject: string;
  email: string;
  name: string;
}

/** the OIDC callback: the code, our state (bound to this browser by the cookie), PKCE and nonce → the person */
export async function completeOidc(req: FastifyRequest): Promise<{ conn: SsoConnectionRow; flow: FlowData; identity: SsoIdentity }> {
  const q = req.query as Record<string, string>;
  const cookie = req.cookies[SSO_COOKIE];
  if (!q.state || !cookie || q.state !== cookie) throw new SsoFailure('sso_state', 'The sign-in did not start in this browser, or it expired.');
  const flowRow = await consumeFlow(q.state, 'sso');
  if (!flowRow) throw new SsoFailure('sso_state', 'The sign-in expired. Start again.');
  const flow = flowRow.data as unknown as FlowData;
  const conn = await db.query.ssoConnections.findFirst({ where: eq(schema.ssoConnections.id, flow.connId) });
  if (!conn || conn.protocol !== 'oidc') throw new SsoFailure('sso_failed', 'The connection changed during the sign-in.', flow, conn);
  if (q.error) throw new SsoFailure('sso_failed', `The identity provider refused: ${String(q.error_description || q.error).slice(0, 200)}`, flow, conn);
  try {
    const cfg = await oidcConfig(conn);
    const current = new URL(`${spInfo(conn).oidcRedirectUri}?${new URLSearchParams(q)}`);
    const tokens = await oidc.authorizationCodeGrant(cfg, current, { pkceCodeVerifier: flow.verifier!, expectedState: q.state, expectedNonce: flow.nonce!, idTokenExpected: true });
    const c = tokens.claims()!;
    const asEmail = (v: unknown) => (typeof v === 'string' && EMAIL_RE.test(v) ? v.toLowerCase() : '');
    const email = asEmail(c.email) || asEmail(c.preferred_username) || asEmail(c.upn);
    const name = String(c.name ?? ([c.given_name, c.family_name].filter(Boolean).join(' ') || ''));
    return { conn, flow, identity: { subject: String(c.sub), email, name } };
  } catch (err) {
    if (err instanceof SsoFailure) throw err;
    throw new SsoFailure('sso_failed', `The identity provider's answer was refused: ${String((err as Error).message).slice(0, 200)}`, flow, conn);
  }
}

/** the SAML ACS: a signed assertion for a request we issued → the person */
export async function completeSaml(req: FastifyRequest, connId: string): Promise<{ conn: SsoConnectionRow; flow: FlowData; identity: SsoIdentity }> {
  const body = (req.body ?? {}) as Record<string, string>;
  const conn = await db.query.ssoConnections.findFirst({ where: eq(schema.ssoConnections.id, connId) });
  if (!conn || conn.protocol !== 'saml') throw new SsoFailure('sso_failed', 'Unknown single sign-on connection.');
  if (!body.SAMLResponse || !body.RelayState) throw new SsoFailure('sso_failed', 'This sign-in did not start here (no RelayState). Start it from the sign-in page.', undefined, conn);
  // on https the browser that started the sign-in carries the binding cookie; elsewhere (plain http) it cannot cross sites
  if (config.cookieSecure && req.cookies[SSO_COOKIE] !== body.RelayState) throw new SsoFailure('sso_state', 'The sign-in did not start in this browser.', undefined, conn);
  const flowRow = await consumeFlow(body.RelayState, 'sso');
  if (!flowRow || (flowRow.data as unknown as FlowData).connId !== conn.id) throw new SsoFailure('sso_state', 'The sign-in expired or belongs to another connection.', undefined, conn);
  const flow = flowRow.data as unknown as FlowData;
  try {
    const { profile } = await samlFor(conn).validatePostResponseAsync({ SAMLResponse: body.SAMLResponse });
    if (!profile) throw new Error('No assertion in the answer');
    await checkAssertion(conn, profile.getAssertionXml?.() ?? '');
    return { conn, flow, identity: samlIdentity(profile) };
  } catch (err) {
    throw new SsoFailure('sso_failed', `The identity provider's answer was refused: ${String((err as Error).message).slice(0, 200)}`, flow, conn);
  }
}

export class SsoFailure extends Error {
  constructor(
    public code: string,
    message: string,
    public flow?: FlowData,
    public conn?: SsoConnectionRow | null,
  ) {
    super(message);
  }
}

/** a failed round trip: a test records why; a sign-in is audited (when the company is known) and goes back to the sign-in page */
export async function failSso(req: FastifyRequest, reply: FastifyReply, e: SsoFailure) {
  if (e.flow?.test && e.conn) {
    await db.update(schema.ssoConnections).set({ lastTestAt: new Date(), lastTestOk: false, lastTestMessage: e.message }).where(eq(schema.ssoConnections.id, e.conn.id));
    await audit(req, e.conn.orgId, { action: 'sso.connection_tested', outcome: 'failure', actor: e.flow.adminUserId ? await adminActor(e.flow.adminUserId) : undefined, details: { reason: e.message } });
    return reply.redirect(`/o/${e.conn.orgId}/settings/sso?test=failed`);
  }
  if (e.conn) await audit(req, e.conn.orgId, { action: 'auth.sso.failed', outcome: 'failure', actor: { type: 'system', label: 'identity provider' }, details: { reason: e.message } });
  req.log.warn({ code: e.code, reason: e.message }, 'single sign-on failed');
  return reply.redirect(`/login?error=${e.code}`);
}

async function adminActor(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  return u ? { type: 'user' as const, userId: u.id, label: u.email } : undefined;
}

/** after either protocol: test result, or provisioning + the session (or the second step) */
export async function finishSso(req: FastifyRequest, reply: FastifyReply, conn: SsoConnectionRow, flow: FlowData, id: SsoIdentity) {
  const org = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, conn.orgId) }))!;
  const domains = await verifiedDomains(org.id);
  const domainOk = !!id.email && domains.includes(ssoEmailDomain(id.email));
  if (flow.test) {
    const ok = domainOk && !!id.subject;
    const message = !id.email
      ? `The identity provider signed someone in (subject ${id.subject}) but sent no e-mail address. Add the email claim / attribute.`
      : domainOk
        ? `Signed in ${id.email}${id.name ? ` (${id.name})` : ''}, subject ${id.subject}.`
        : `Signed in ${id.email}, but ${ssoEmailDomain(id.email) || 'its domain'} is not one of your verified domains (${domains.join(', ') || 'none yet'}).`;
    await db.update(schema.ssoConnections).set({ lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message }).where(eq(schema.ssoConnections.id, conn.id));
    await audit(req, org.id, { action: 'sso.connection_tested', outcome: ok ? 'success' : 'failure', actor: flow.adminUserId ? await adminActor(flow.adminUserId) : undefined, details: { result: message } });
    return reply.redirect(`/o/${org.id}/settings/sso?test=${ok ? 'ok' : 'failed'}`);
  }
  if (!domainOk) throw new SsoFailure('sso_domain', `${id.email || 'The address'} is not on a verified domain of ${org.name}.`, flow, conn);

  // the person: by the IdP's stable subject first, then by address
  const known = await db.query.ssoIdentities.findFirst({ where: and(eq(schema.ssoIdentities.connectionId, conn.id), eq(schema.ssoIdentities.subject, id.subject)) });
  let user = known ? await db.query.users.findFirst({ where: eq(schema.users.id, known.userId) }) : await db.query.users.findFirst({ where: eq(schema.users.email, id.email) });
  let provisioned = false;
  if (!user) {
    if (!conn.jitEnabled) throw new SsoFailure('sso_not_provisioned', `${id.email} has no account in ${org.name}. Ask an admin to invite you.`, flow, conn);
    [user] = await db.insert(schema.users).values({ email: id.email, name: id.name || id.email.split('@')[0], emailVerifiedAt: new Date() }).returning();
    provisioned = true;
  } else if (!user.emailVerifiedAt) {
    // the company's IdP vouches for an address on its verified domain: the account is confirmed (an unconfirmed password may be anyone's)
    [user] = await db.update(schema.users).set({ emailVerifiedAt: new Date(), passwordHash: null }).where(eq(schema.users.id, user.id)).returning();
  }
  const membership = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, org.id), eq(schema.memberships.userId, user.id)) });
  if (!membership) {
    if (!conn.jitEnabled) throw new SsoFailure('sso_not_provisioned', `${id.email} is not a member of ${org.name}. Ask an admin to invite you.`, flow, conn);
    await db.insert(schema.memberships).values({ orgId: org.id, userId: user.id, role: conn.defaultRole });
    await refreshSessionPolicy([user.id]);
    provisioned = true;
  }
  await db
    .insert(schema.ssoIdentities)
    .values({ connectionId: conn.id, subject: id.subject, userId: user.id, lastLoginAt: new Date() })
    .onConflictDoUpdate({ target: [schema.ssoIdentities.connectionId, schema.ssoIdentities.subject], set: { lastLoginAt: new Date() } });
  await db.update(schema.ssoConnections).set({ lastLoginAt: new Date() }).where(eq(schema.ssoConnections.id, conn.id));
  const actor = { type: 'user' as const, userId: user.id, label: user.email };
  if (provisioned) await audit(req, org.id, { action: 'sso.user_provisioned', actor, target: { type: 'user', id: user.id, label: user.email }, details: { role: membership?.role ?? conn.defaultRole } });

  const trusted = policyOf(org.securityPolicy).mfaTrustSso;
  if (!trusted && (await startMfaChallenge(reply, user, { method: 'sso', ssoOrgId: org.id, next: flow.next })))
    return reply.redirect(`/login/mfa${flow.next !== '/' ? `?next=${encodeURIComponent(flow.next)}` : ''}`);
  await createSession(reply, req, user.id, { method: 'sso', ssoOrgId: org.id });
  await audit(req, org.id, { action: 'auth.sso.succeeded', actor, details: { protocol: conn.protocol, subject: id.subject } });
  reply.clearCookie(SSO_COOKIE, { path: '/api/sso' });
  return reply.redirect(flow.next || '/');
}
