import { z } from 'zod';

/**
 * G1 (2026-10-17): enterprise identity, two-step verification, step-up, the company security policy, sessions, SSO, SCIM and the
 * audit log. Design: `app/docs/IDENTITY.md`. This file holds what the server and the web app share: limits, request schemas, answer
 * types and the pure rules, unit-tested once in `identity.test.ts`. Anything that needs node:crypto lives in the server.
 */

// ---------------------------------------------------------------------------------------------------------------------------
// 1. Two-step verification
// ---------------------------------------------------------------------------------------------------------------------------

export const MFA = {
  /** RFC 6238 defaults every authenticator app understands: SHA-1, 6 digits, 30-second steps */
  digits: 6,
  periodSeconds: 30,
  /** one step either side for clock drift (±30 s) */
  window: 1,
  /** 160-bit secret (RFC 4226 §4 recommends at least 128) */
  secretBytes: 20,
  /** ten single-use recovery codes of 16 base32 characters (80 bits) each */
  recoveryCodes: 10,
  recoveryLength: 16,
  /** a password-checked sign-in waits this long for its second factor, and allows this many wrong codes */
  flowMinutes: 5,
  flowAttempts: 5,
  /** security-relevant changes need a proof of presence this recent */
  stepUpMinutes: 10,
  /** passkeys per person */
  maxPasskeys: 10,
} as const;

export const MFA_METHODS = ['totp', 'recovery', 'webauthn'] as const;
export type MfaMethod = (typeof MFA_METHODS)[number];
/** what a step-up can be done with: a second factor, the password (people without two-step verification), or signing in again */
export type StepUpMethod = MfaMethod | 'password' | 'signin';

const CODE_RE = new RegExp(`^\\d{${MFA.digits}}$`);
/** a 6-digit code as typed: spaces and dashes ignored ("123 456") */
export const cleanTotpCode = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\s-]/g, '') : '');
export const isTotpCode = (v: unknown): boolean => CODE_RE.test(cleanTotpCode(v));

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/** a recovery code as typed -> its canonical form (upper case, no separators, 0/1/8 read as O/I/B), or '' when it cannot be one */
export function normalizeRecoveryCode(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.toUpperCase().replace(/[\s-]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B');
  return s.length === MFA.recoveryLength && [...s].every((c) => B32.includes(c)) ? s : '';
}
/** canonical -> shown in groups of four ("ABCD-EFGH-IJKL-MNOP") */
export const formatRecoveryCode = (canonical: string): string => canonical.match(/.{1,4}/g)?.join('-') ?? canonical;

export const mfaVerifySchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('totp'), code: z.string().trim().max(20).refine(isTotpCode, 'Enter the 6-digit code from your app') }),
  z.object({ method: z.literal('recovery'), code: z.string().trim().max(40).refine((v) => !!normalizeRecoveryCode(v), 'Enter one of your recovery codes (16 letters and digits)') }),
  z.object({ method: z.literal('webauthn'), response: z.record(z.string(), z.unknown()) }),
]);
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const stepUpSchema = z.discriminatedUnion('method', [
  ...mfaVerifySchema.options,
  z.object({ method: z.literal('password'), password: z.string().min(1, 'Enter your password').max(200) }),
]);
export type StepUpInput = z.infer<typeof stepUpSchema>;

export const totpConfirmSchema = z.object({ code: z.string().trim().max(20).refine(isTotpCode, 'Enter the 6-digit code from your app') });
export const passkeyNameSchema = z.object({ name: z.string().trim().min(1, 'Give the passkey a name').max(60, 'At most 60 characters') });
export const passkeyRegisterSchema = passkeyNameSchema.extend({ response: z.record(z.string(), z.unknown()) });

export interface PasskeyView {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  /** synced across the person's devices (iCloud Keychain, Google Password Manager...) or bound to one device / security key */
  synced: boolean;
}

export interface MfaStatus {
  /** at least one second factor is set up */
  enabled: boolean;
  totp: { enabled: boolean; enabledAt: string | null };
  passkeys: PasskeyView[];
  recoveryCodes: { remaining: number; total: number };
  /** names of the person's companies that require two-step verification */
  requiredBy: string[];
  /** false when the server has no key to seal secrets with (IDENTITY_KEY / MAILBOX_KEY): authenticator apps cannot be set up */
  totpAvailable: boolean;
  /** whether this session has passed a second factor */
  sessionVerified: boolean;
}

export interface TotpEnrolment {
  /** base32, for typing into the app by hand */
  secret: string;
  /** otpauth://totp/..., what the QR code holds */
  uri: string;
  /** the QR code as an SVG document (rendered as an <img> data URI) */
  qrSvg: string;
}

/** `POST /api/auth/login` (and the Google callback) when a second factor is still needed: no session exists yet */
export interface MfaChallenge {
  mfaRequired: true;
  methods: MfaMethod[];
  /** the address being signed in, partly masked, so the page can say whose code it is asking for */
  emailHint: string;
}

/** "a...e@example.com" */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const shown = local.length <= 2 ? local.slice(0, 1) : `${local[0]}...${local[local.length - 1]}`;
  return domain ? `${shown}@${domain}` : shown;
}

/** error codes the web app reacts to (a full-page prompt or the step-up dialog) */
export const IDENTITY_ERRORS = {
  /** the company requires two-step verification and the person has none: set one up */
  mfaEnrolment: 'mfa_enrolment_required',
  /** the company requires it, the person has a factor, this session has not used it: verify now */
  mfaVerification: 'mfa_verification_required',
  /** the change needs a fresh proof (step-up) */
  reauth: 'reauth_required',
  /** the e-mail's domain signs in through its company's identity provider */
  ssoRequired: 'sso_required',
  /** the session ended after the company's idle timeout */
  sessionIdle: 'session_idle',
} as const;

// ---------------------------------------------------------------------------------------------------------------------------
// 2. The company's security policy
// ---------------------------------------------------------------------------------------------------------------------------

export const IDLE_TIMEOUT_CHOICES = [15, 30, 60, 120, 240, 480, 720, 1440] as const;
export const AUDIT_RETENTION_CHOICES = [30, 90, 180, 365, 730, 1095, 2555] as const;

export interface SecurityPolicy {
  /** every member must use two-step verification to see anything of the company */
  requireMfa: boolean;
  /** a Google sign-in counts as two-step (Google's own 2-Step Verification, which we cannot see, is then the company's to enforce) */
  mfaTrustGoogle: boolean;
  /** a sign-in through this company's own identity provider counts as two-step (the IdP enforces its own MFA) */
  mfaTrustSso: boolean;
  /** sign people out after this many minutes without activity; null = never (sessions last 30 days) */
  idleTimeoutMinutes: number | null;
  /** how long audit events are kept */
  auditRetentionDays: number;
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  requireMfa: false,
  mfaTrustGoogle: false,
  mfaTrustSso: true,
  idleTimeoutMinutes: null,
  auditRetentionDays: 365,
};

export const securityPolicySchema = z.object({
  requireMfa: z.boolean(),
  mfaTrustGoogle: z.boolean(),
  mfaTrustSso: z.boolean(),
  idleTimeoutMinutes: z
    .number()
    .int()
    .refine((v) => (IDLE_TIMEOUT_CHOICES as readonly number[]).includes(v), 'Choose one of the offered timeouts')
    .nullable(),
  auditRetentionDays: z
    .number()
    .int()
    .refine((v) => (AUDIT_RETENTION_CHOICES as readonly number[]).includes(v), 'Choose one of the offered periods'),
});

/** the stored jsonb -> a complete policy (unknown keys dropped, missing or invalid ones at their defaults) */
export function policyOf(raw: unknown): SecurityPolicy {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SECURITY_POLICY };
  if (typeof r.requireMfa === 'boolean') out.requireMfa = r.requireMfa;
  if (typeof r.mfaTrustGoogle === 'boolean') out.mfaTrustGoogle = r.mfaTrustGoogle;
  if (typeof r.mfaTrustSso === 'boolean') out.mfaTrustSso = r.mfaTrustSso;
  if (r.idleTimeoutMinutes === null || (IDLE_TIMEOUT_CHOICES as readonly unknown[]).includes(r.idleTimeoutMinutes)) out.idleTimeoutMinutes = (r.idleTimeoutMinutes as number | null) ?? null;
  if ((AUDIT_RETENTION_CHOICES as readonly unknown[]).includes(r.auditRetentionDays)) out.auditRetentionDays = r.auditRetentionDays as number;
  return out;
}

/** how a session was signed in */
export type AuthMethod = 'password' | 'google' | 'sso';

/** does this session satisfy the company's two-step requirement? (the server's one rule; the web app only reads the answer) */
export function sessionMeetsMfa(policy: SecurityPolicy, s: { mfaAt: Date | string | null; authMethod: string; ssoOrgId: string | null }, orgId: string): boolean {
  if (!policy.requireMfa) return true;
  if (s.mfaAt) return true;
  if (s.authMethod === 'google' && policy.mfaTrustGoogle) return true;
  if (s.authMethod === 'sso' && s.ssoOrgId === orgId && policy.mfaTrustSso) return true;
  return false;
}

/** the strictest idle timeout among a person's companies (null = none of them has one) */
export function strictestIdle(policies: SecurityPolicy[]): number | null {
  const v = policies.map((p) => p.idleTimeoutMinutes).filter((x): x is number => typeof x === 'number');
  return v.length ? Math.min(...v) : null;
}

export const idleLabel = (m: number | null): string => (m == null ? 'Never' : m < 60 ? `${m} minutes` : m < 1440 ? `${m / 60} hour${m === 60 ? '' : 's'}` : '24 hours');
export const retentionLabel = (d: number): string => (d < 365 ? `${d} days` : d === 2555 ? '7 years' : `${d / 365} year${d === 365 ? '' : 's'}`);

/** one signed-in device in "Where you're signed in" */
export interface SessionView {
  /** the session's public id (never its key) */
  id: string;
  current: boolean;
  device: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  authMethod: AuthMethod;
  mfa: boolean;
}

/** "Chrome on macOS" from a user agent, for people (no fingerprinting, no library: the big families only) */
export function deviceLabel(ua: string | null | undefined): string {
  const u = ua ?? '';
  if (!u) return 'Unknown device';
  const browser = /Edg\//.test(u)
    ? 'Edge'
    : /OPR\/|Opera/.test(u)
      ? 'Opera'
      : /Firefox\//.test(u)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(u)
          ? 'Chrome'
          : /Safari\//.test(u)
            ? 'Safari'
            : /curl|python|node|axios|Go-http/i.test(u)
              ? 'A script'
              : 'A browser';
  const os = /iPhone|iPad|iPod/.test(u)
    ? 'iOS'
    : /Android/.test(u)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(u)
        ? 'macOS'
        : /Windows/.test(u)
          ? 'Windows'
          : /CrOS/.test(u)
            ? 'ChromeOS'
            : /Linux/.test(u)
              ? 'Linux'
              : '';
  return os ? `${browser} on ${os}` : browser;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. Single sign-on
// ---------------------------------------------------------------------------------------------------------------------------

export const SSO = {
  /** the DNS TXT record that proves a company controls an e-mail domain: `alaventra-sso=<token>` at the domain itself */
  txtPrefix: 'alaventra-sso=',
  maxDomains: 20,
  /** an SSO round trip must come back within this */
  flowMinutes: 10,
  /** SAML NotBefore / NotOnOrAfter tolerance */
  clockSkewSeconds: 120,
  maxCerts: 3,
} as const;

/** consumer mail providers: nobody may claim them for single sign-on (they are not one company's domain) */
export const FREE_MAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'gmx.de', 'web.de', 'mail.com', 'yandex.com', 'yandex.ru', 'zoho.com',
  'fastmail.com', 'hey.com', 'tutanota.com', 'qq.com', '163.com', '126.com', 'naver.com', 'mail.ru',
] as const;

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
/** "Example.COM." / "@example.com" / "https://example.com/" -> "example.com", or '' when it is not a domain */
export function cleanEmailDomain(v: unknown): string {
  if (typeof v !== 'string') return '';
  const d = v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^@/, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
  return DOMAIN_RE.test(d) ? d : '';
}
/** the domain of an e-mail address (lower case), or '' */
export const ssoEmailDomain = (email: string): string => cleanEmailDomain(email.split('@')[1] ?? '');

export const ssoDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .max(253)
    .transform((v) => cleanEmailDomain(v))
    .refine((v) => !!v, 'Enter a domain like example.com')
    .refine((v) => !(FREE_MAIL_DOMAINS as readonly string[]).includes(v), 'A public mail provider cannot be claimed for single sign-on'),
});

export type SsoProtocol = 'oidc' | 'saml';

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\/[^\s/]+/i.test(v), 'Must start with https://');

/** what an admin saves: the identity provider's side of the connection (the secret only when it is being set or changed) */
export const ssoConnectionSchema = z
  .object({
    protocol: z.enum(['oidc', 'saml']),
    oidc: z
      .object({
        issuer: httpsUrl,
        clientId: z.string().trim().min(1, 'Enter the client ID').max(300),
        /** omitted or '' = keep the stored one */
        clientSecret: z.string().max(500).optional(),
      })
      .optional(),
    saml: z
      .object({
        entityId: z.string().trim().min(1, 'Enter the identity provider\'s entity ID (issuer)').max(500),
        ssoUrl: httpsUrl,
        /** empty = keep the stored certificates */
        certificates: z.array(z.string().trim().min(40, 'Paste the whole certificate').max(20_000)).max(SSO.maxCerts).default([]),
      })
      .optional(),
    jitEnabled: z.boolean().default(true),
    defaultRole: z.enum(['admin', 'member', 'viewer']).default('member'),
  })
  .superRefine((v, ctx) => {
    if (v.protocol === 'oidc' && !v.oidc) ctx.addIssue({ code: 'custom', path: ['oidc'], message: 'Fill in the OIDC settings' });
    if (v.protocol === 'saml' && !v.saml) ctx.addIssue({ code: 'custom', path: ['saml'], message: 'Fill in the SAML settings' });
  });
export type SsoConnectionInput = z.input<typeof ssoConnectionSchema>;

export const ssoSwitchSchema = z.object({ enabled: z.boolean().optional(), enforced: z.boolean().optional() });

export interface SsoDomainView {
  id: string;
  domain: string;
  verified: boolean;
  verifiedAt: string | null;
  /** the TXT record to publish at `domain` */
  txtValue: string;
}

export interface SsoCertInfo {
  subject: string;
  notAfter: string;
  expired: boolean;
  fingerprint: string;
}

export interface SsoConnectionView {
  id: string;
  protocol: SsoProtocol;
  enabled: boolean;
  enforced: boolean;
  jitEnabled: boolean;
  defaultRole: 'admin' | 'member' | 'viewer';
  oidc: { issuer: string; clientId: string; hasClientSecret: boolean } | null;
  saml: { entityId: string; ssoUrl: string; certificates: SsoCertInfo[] } | null;
  lastTest: { at: string; ok: boolean; message: string } | null;
  lastLoginAt: string | null;
  updatedAt: string;
}

/** what the company's IT admin types into their identity provider */
export interface SsoServiceProvider {
  oidcRedirectUri: string;
  samlEntityId: string | null;
  samlAcsUrl: string | null;
  samlMetadataUrl: string | null;
  loginUrl: string;
}

export interface SsoOverview {
  domains: SsoDomainView[];
  connection: SsoConnectionView | null;
  sp: SsoServiceProvider;
  /** secrets can be stored (IDENTITY_KEY / MAILBOX_KEY) */
  secretsReady: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 5. SCIM 2.0 provisioning
// ---------------------------------------------------------------------------------------------------------------------------

export const SCIM = {
  /** `scim_` + 256 random bits: recognisable in a log or a scanner */
  prefix: 'scim_',
  maxLive: 2,
  perMinute: 600,
  maxPage: 200,
  schemas: {
    user: 'urn:ietf:params:scim:schemas:core:2.0:User',
    group: 'urn:ietf:params:scim:schemas:core:2.0:Group',
    list: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
    patch: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
    error: 'urn:ietf:params:scim:api:messages:2.0:Error',
  },
} as const;

const SCIM_TOKEN_RE = /^scim_[A-Za-z0-9_-]{43}$/;
export const isScimToken = (v: unknown): v is string => typeof v === 'string' && SCIM_TOKEN_RE.test(v);
export function scimBearer(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m && isScimToken(m[1]) ? m[1] : null;
}

/**
 * The SCIM filters identity providers send (RFC 7644 §3.4.2.2), `attr eq "value"` only, Okta sends `userName eq "a@b.c"`, Entra ID
 * `userName eq "a@b.c"` / `externalId eq "..."`, groups by `displayName eq "..."`. Anything else is refused (`invalidFilter`) rather than
 * answered wrongly.
 */
export function parseScimFilter(filter: unknown): { attr: string; value: string } | null | 'invalid' {
  if (filter == null || filter === '') return null;
  if (typeof filter !== 'string' || filter.length > 500) return 'invalid';
  const m = /^\s*([A-Za-z][\w.]*(?:\[[^\]]*\])?(?:\.\w+)?)\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i.exec(filter);
  if (!m) return 'invalid';
  const attr = m[1].toLowerCase().replace(/\[type eq "work"\]/, '');
  const known: Record<string, string> = { username: 'userName', externalid: 'externalId', 'emails.value': 'email', 'emails[primary eq true].value': 'email', displayname: 'displayName', id: 'id' };
  const a = known[attr];
  return a ? { attr: a, value: m[2].replace(/\\(.)/g, '$1') } : 'invalid';
}

/** "False" / "false" / false -> false (Entra ID sends booleans as strings in PATCH) */
export const scimBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : typeof v === 'string' && /^(true|false)$/i.test(v) ? v.toLowerCase() === 'true' : undefined);

export interface ScimTokenView {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  createdByName: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ScimGroupView {
  id: string;
  displayName: string;
  members: number;
  role: 'admin' | 'member' | 'viewer' | null;
}

export interface ScimOverview {
  baseUrl: string;
  tokens: ScimTokenView[];
  groups: ScimGroupView[];
  /** provisioning acts only on addresses at these domains */
  verifiedDomains: string[];
}

export const scimTokenCreateSchema = z.object({ name: z.string().trim().min(1, 'Name the token, e.g. "Okta"').max(60) });
export const scimGroupRoleSchema = z.object({ role: z.enum(['admin', 'member', 'viewer']).nullable() });

export interface MemberSecurity {
  userId: string;
  mfaEnabled: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. The audit log
// ---------------------------------------------------------------------------------------------------------------------------

export const AUDIT_CATEGORIES = {
  signin: 'Sign-in',
  account: 'Accounts and two-step verification',
  team: 'Team and roles',
  websites: 'Websites',
  settings: 'Company settings',
  data: 'Sharing and exports',
  api: 'API keys',
  sso: 'Single sign-on and provisioning',
  agency: 'Agency and client portal',
  /** G4 (app/docs/INTEGRATIONS.md): webhooks, trackers, exports, and work started through the API */
  integrations: 'Integrations and API work',
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;

/** every action the log can hold, with its words and category (the server's tests check every action it writes is listed) */
export const AUDIT_ACTIONS = {
  'auth.login.succeeded': { label: 'Signed in', category: 'signin' },
  'auth.login.failed': { label: 'Sign-in failed', category: 'signin' },
  'auth.mfa.failed': { label: 'Wrong second-step code', category: 'signin' },
  'auth.sso.succeeded': { label: 'Signed in with single sign-on', category: 'signin' },
  'auth.sso.failed': { label: 'Single sign-on failed', category: 'signin' },
  'auth.logout': { label: 'Signed out', category: 'signin' },
  'auth.session_revoked': { label: 'Signed a device out', category: 'signin' },
  'auth.sessions_revoked': { label: 'Signed out every other device', category: 'signin' },
  'auth.session_idle': { label: 'Signed out after inactivity', category: 'signin' },
  'auth.stepup.failed': { label: 'Failed to confirm identity', category: 'signin' },
  'account.password_changed': { label: 'Changed password', category: 'account' },
  'account.password_reset': { label: 'Reset password by e-mail', category: 'account' },
  'mfa.totp.enabled': { label: 'Turned on the authenticator app', category: 'account' },
  'mfa.totp.disabled': { label: 'Removed the authenticator app', category: 'account' },
  'mfa.passkey.added': { label: 'Added a passkey', category: 'account' },
  'mfa.passkey.removed': { label: 'Removed a passkey', category: 'account' },
  'mfa.recovery.regenerated': { label: 'Made new recovery codes', category: 'account' },
  'mfa.recovery.used': { label: 'Signed in with a recovery code', category: 'account' },
  'team.invited': { label: 'Invited someone', category: 'team' },
  'team.invitation_revoked': { label: 'Withdrew an invitation', category: 'team' },
  'team.joined': { label: 'Joined the company', category: 'team' },
  'team.role_changed': { label: 'Changed a role', category: 'team' },
  'team.removed': { label: 'Removed a member', category: 'team' },
  'team.left': { label: 'Left the company', category: 'team' },
  'site.added': { label: 'Added a website', category: 'websites' },
  'site.verified': { label: 'Proved ownership of a website', category: 'websites' },
  'site.verify_failed': { label: 'Website ownership check failed', category: 'websites' },
  'site.deleted': { label: 'Deleted a website', category: 'websites' },
  'company.created': { label: 'Created the company', category: 'settings' },
  'company.updated': { label: 'Changed company details', category: 'settings' },
  'company.budget_changed': { label: 'Changed the platform spending guard', category: 'settings' },
  'company.credit_limits_changed': { label: 'Changed the credit limits', category: 'settings' },
  'company.credits_requested': { label: 'Asked for credits', category: 'settings' },
  'company.delivery_changed': { label: 'Changed report delivery', category: 'settings' },
  'company.security_changed': { label: 'Changed security settings', category: 'settings' },
  'company.admin_changed': { label: 'Platform administrator changed the company', category: 'settings' },
  'mailbox.connected': { label: 'Connected a mailbox', category: 'settings' },
  'mailbox.removed': { label: 'Removed a mailbox', category: 'settings' },
  'share.created': { label: 'Shared a report by link', category: 'data' },
  'share.revoked': { label: 'Revoked a share link', category: 'data' },
  'audit.exported': { label: 'Exported the audit log', category: 'data' },
  'apikey.created': { label: 'Created an API key', category: 'api' },
  'apikey.revoked': { label: 'Revoked an API key', category: 'api' },
  'sso.domain_added': { label: 'Claimed an e-mail domain', category: 'sso' },
  'sso.domain_verified': { label: 'Verified an e-mail domain', category: 'sso' },
  'sso.domain_removed': { label: 'Removed an e-mail domain', category: 'sso' },
  'sso.connection_saved': { label: 'Changed the single sign-on connection', category: 'sso' },
  'sso.connection_tested': { label: 'Tested single sign-on', category: 'sso' },
  'sso.connection_deleted': { label: 'Deleted the single sign-on connection', category: 'sso' },
  'sso.enforced': { label: 'Made single sign-on required', category: 'sso' },
  'sso.unenforced': { label: 'Stopped requiring single sign-on', category: 'sso' },
  'sso.user_provisioned': { label: 'Created an account at first sign-on', category: 'sso' },
  'scim.token_created': { label: 'Created a provisioning token', category: 'sso' },
  'scim.token_revoked': { label: 'Revoked a provisioning token', category: 'sso' },
  'scim.user_created': { label: 'Provisioned a person', category: 'sso' },
  'scim.user_updated': { label: 'Updated a provisioned person', category: 'sso' },
  'scim.user_deactivated': { label: 'Deactivated a person', category: 'sso' },
  'scim.user_reactivated': { label: 'Reactivated a person', category: 'sso' },
  'scim.user_deleted': { label: 'Deprovisioned a person', category: 'sso' },
  'scim.group_changed': { label: 'Changed a provisioned group', category: 'sso' },
  'scim.group_mapping_changed': { label: 'Mapped a group to a role', category: 'sso' },
  // G5 (app/docs/WHITE_LABEL.md)
  'agency.enabled': { label: 'Turned on agency mode', category: 'agency' },
  'agency.client_created': { label: 'Created a client workspace', category: 'agency' },
  'agency.client_deleted': { label: 'Deleted a client workspace', category: 'agency' },
  'agency.staff_assigned': { label: 'Gave a team member access to a client', category: 'agency' },
  'agency.staff_unassigned': { label: 'Removed a team member from a client', category: 'agency' },
  'agency.client_settings_changed': { label: 'Changed a client workspace setting', category: 'agency' },
  'agency.overview_exported': { label: 'Exported the client overview', category: 'agency' },
  'branding.updated': { label: 'Changed the branding', category: 'agency' },
  'portal.domain_claimed': { label: 'Claimed a portal domain', category: 'agency' },
  'portal.domain_verified': { label: 'Verified a portal domain', category: 'agency' },
  'portal.domain_check_failed': { label: 'Portal domain check failed', category: 'agency' },
  'portal.domain_lapsed': { label: 'Portal domain stopped being served', category: 'agency' },
  'portal.domain_released': { label: 'Released a portal domain', category: 'agency' },
  'portal.mail_updated': { label: 'Changed the client e-mail settings', category: 'agency' },
  'portal.handoff': { label: 'Opened the client portal from the app', category: 'signin' },
  'approval.requested': { label: 'Asked the client for approval', category: 'agency' },
  'approval.withdrawn': { label: 'Withdrew an approval request', category: 'agency' },
  'approval.approved': { label: 'Client approved', category: 'agency' },
  'approval.changes_requested': { label: 'Client asked for changes', category: 'agency' },
  'integration.webhook_added': { label: 'Added an event endpoint', category: 'integrations' },
  'integration.webhook_changed': { label: 'Changed an event endpoint', category: 'integrations' },
  'integration.webhook_removed': { label: 'Removed an event endpoint', category: 'integrations' },
  'integration.webhook_secret_rotated': { label: 'Made a new webhook signing secret', category: 'integrations' },
  'integration.connected': { label: 'Connected an integration', category: 'integrations' },
  'integration.changed': { label: 'Changed an integration', category: 'integrations' },
  'integration.disconnected': { label: 'Disconnected an integration', category: 'integrations' },
  'integration.export_started': { label: 'Started a data export', category: 'integrations' },
  'issue.created': { label: 'Created a ticket in the issue tracker', category: 'integrations' },
  'cms.connected': { label: 'Connected a CMS', category: 'integrations' },
  'cms.changed': { label: 'Changed a CMS connection', category: 'integrations' },
  'cms.removed': { label: 'Removed a CMS connection', category: 'integrations' },
  'crawler.push_key_created': { label: 'Made a crawler log push key', category: 'integrations' },
  'crawler.push_key_revoked': { label: 'Switched crawler log pushes off', category: 'integrations' },
  'crawler.log_uploaded': { label: 'Uploaded a server log', category: 'integrations' },
  'crawler.retention_changed': { label: 'Changed how long crawler logs are kept', category: 'integrations' },
  'crawler.data_deleted': { label: 'Deleted a website\'s crawler log data', category: 'integrations' },
  'run.started_via_api': { label: 'Started an analysis through the API', category: 'integrations' },
} as const satisfies Record<string, { label: string; category: AuditCategory }>;
export type AuditAction = keyof typeof AUDIT_ACTIONS;
export const auditLabel = (a: string): string => (AUDIT_ACTIONS as Record<string, { label: string }>)[a]?.label ?? a;
export const auditCategoryOf = (a: string): AuditCategory | null => (AUDIT_ACTIONS as Record<string, { category: AuditCategory }>)[a]?.category ?? null;
export const actionsIn = (c: AuditCategory): AuditAction[] => (Object.keys(AUDIT_ACTIONS) as AuditAction[]).filter((a) => AUDIT_ACTIONS[a].category === c);

export type AuditActorType = 'user' | 'scim' | 'system' | 'platform_admin';

export interface AuditEventView {
  id: string;
  at: string;
  action: string;
  label: string;
  category: AuditCategory | null;
  outcome: 'success' | 'failure';
  actorType: AuditActorType;
  actorId: string | null;
  actorLabel: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
}

export const auditQuerySchema = z.object({
  category: z.enum(Object.keys(AUDIT_CATEGORIES) as [AuditCategory, ...AuditCategory[]]).optional(),
  action: z.string().max(60).optional(),
  actor: z.string().uuid().optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  before: z.string().regex(/^\d{1,18}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** keys whose values never go into an audit event, whatever a route passes */
const SECRET_KEY = /(secret|password|passwd|token|api.?key|private|credential|recovery.?code|^code$|cookie|assertion|response)/i;
/** the details a route passes, without secrets or huge values, at most two levels deep */
export function safeAuditDetails(d: unknown, depth = 0): Record<string, unknown> {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>).slice(0, 40)) {
    if (SECRET_KEY.test(k)) continue;
    if (v == null || typeof v === 'boolean' || typeof v === 'number') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (Array.isArray(v)) out[k] = v.slice(0, 20).map((x) => (x && typeof x === 'object' ? (depth < 1 ? safeAuditDetails(x, depth + 1) : null) : typeof x === 'string' ? x.slice(0, 120) : x));
    else if (typeof v === 'object' && depth < 1) out[k] = safeAuditDetails(v, depth + 1);
  }
  return out;
}

/** one CSV cell: quoted, and a leading = + - @ tab or CR neutralised (spreadsheet formula injection, OWASP) */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const AUDIT_CSV_COLUMNS = ['time', 'action', 'description', 'outcome', 'actor_type', 'actor', 'target_type', 'target', 'ip', 'user_agent', 'details'] as const;
export function auditCsvRow(e: AuditEventView): string {
  return [e.at, e.action, e.label, e.outcome, e.actorType, e.actorLabel, e.targetType, e.targetLabel ?? e.targetId, e.ip, e.userAgent, e.details].map(csvCell).join(',');
}

