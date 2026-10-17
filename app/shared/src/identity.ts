import { z } from 'zod';

/**
 * G1 (2026-10-17): enterprise identity — two-step verification, step-up, the company security policy, sessions, SSO, SCIM and the
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
/** a recovery code as typed → its canonical form (upper case, no separators, 0/1/8 read as O/I/B), or '' when it cannot be one */
export function normalizeRecoveryCode(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.toUpperCase().replace(/[\s-]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B');
  return s.length === MFA.recoveryLength && [...s].every((c) => B32.includes(c)) ? s : '';
}
/** canonical → shown in groups of four ("ABCD-EFGH-IJKL-MNOP") */
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
  /** synced across the person's devices (iCloud Keychain, Google Password Manager…) or bound to one device / security key */
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
  /** otpauth://totp/… — what the QR code holds */
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

/** "a…e@example.com" */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const shown = local.length <= 2 ? local.slice(0, 1) : `${local[0]}…${local[local.length - 1]}`;
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
  /** a Google sign-in counts as two-step (Google's own 2-Step Verification — which we cannot see — is then the company's to enforce) */
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

/** the stored jsonb → a complete policy (unknown keys dropped, missing or invalid ones at their defaults) */
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

export interface MemberSecurity {
  userId: string;
  mfaEnabled: boolean;
}

