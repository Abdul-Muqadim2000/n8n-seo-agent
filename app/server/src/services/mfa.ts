import { randomBytes } from 'node:crypto';
import { and, asc, count, eq, isNull, or, sql } from 'drizzle-orm';
import QRCode from 'qrcode';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { formatRecoveryCode, MFA, normalizeRecoveryCode, policyOf, type MfaMethod, type MfaStatus, type PasskeyView, type TotpEnrolment } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { SessionRow, UserRow, WebauthnCredentialRow } from '../db/schema';
import { sha256 } from '../lib/crypto';
import { badRequest, notFound } from '../lib/errors';
import { identitySecretsReady, sealIdentity, unsealIdentity } from '../lib/secretBox';
import { base32Encode, matchTotp, newTotpSecret, otpauthUri } from '../auth/totp';

/**
 * G1 two-step verification: authenticator apps (RFC 6238), passkeys / security keys (WebAuthn) and single-use recovery codes.
 * Design: app/docs/IDENTITY.md §3. Every write here is followed by an audit event written by the route that called it.
 */

const RP = () => {
  const u = new URL(config.appUrl);
  return { rpID: u.hostname, origin: u.origin, rpName: config.brand };
};

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function newRecoveryCode(): string {
  const bytes = randomBytes(MFA.recoveryLength);
  return [...bytes].map((b) => B32[b & 31]).join('');
}

export const toPasskeyView = (k: WebauthnCredentialRow): PasskeyView => ({
  id: k.id,
  name: k.name,
  createdAt: k.createdAt.toISOString(),
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  synced: k.backedUp || k.deviceType === 'multiDevice',
});

export async function listPasskeys(userId: string): Promise<WebauthnCredentialRow[]> {
  return db.query.webauthnCredentials.findMany({ where: eq(schema.webauthnCredentials.userId, userId), orderBy: asc(schema.webauthnCredentials.createdAt) });
}

async function recoveryCounts(userId: string): Promise<{ remaining: number; total: number }> {
  const rows = await db
    .select({ total: count(), remaining: sql<number>`count(*) filter (where ${schema.mfaRecoveryCodes.usedAt} is null)::int` })
    .from(schema.mfaRecoveryCodes)
    .where(eq(schema.mfaRecoveryCodes.userId, userId));
  return { remaining: Number(rows[0]?.remaining ?? 0), total: Number(rows[0]?.total ?? 0) };
}

/** names of the person's companies that require two-step verification */
export async function companiesRequiringMfa(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: schema.organizations.name, policy: schema.organizations.securityPolicy })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(eq(schema.memberships.userId, userId));
  return rows.filter((r) => policyOf(r.policy).requireMfa).map((r) => r.name);
}

export async function mfaStatus(user: UserRow, session: SessionRow | null): Promise<MfaStatus> {
  const [passkeys, codes, requiredBy] = await Promise.all([listPasskeys(user.id), recoveryCounts(user.id), companiesRequiringMfa(user.id)]);
  const totpOn = !!user.mfaTotpEnabledAt;
  return {
    enabled: totpOn || passkeys.length > 0,
    totp: { enabled: totpOn, enabledAt: user.mfaTotpEnabledAt?.toISOString() ?? null },
    passkeys: passkeys.map(toPasskeyView),
    recoveryCodes: codes,
    requiredBy,
    totpAvailable: identitySecretsReady(),
    sessionVerified: !!session?.mfaAt,
  };
}

export async function factorCount(user: UserRow): Promise<number> {
  const keys = await db.select({ n: count() }).from(schema.webauthnCredentials).where(eq(schema.webauthnCredentials.userId, user.id));
  return (user.mfaTotpEnabledAt ? 1 : 0) + Number(keys[0]?.n ?? 0);
}

/** the methods a sign-in challenge offers this person */
export async function mfaMethods(user: UserRow): Promise<MfaMethod[]> {
  const out: MfaMethod[] = [];
  if (user.mfaTotpEnabledAt) out.push('totp');
  if ((await listPasskeys(user.id)).length) out.push('webauthn');
  if (out.length) out.push('recovery');
  return out;
}

// ---------------------------------------------------------------- authenticator app

/** step 1 of enrolment: a new secret, kept sealed as "pending" until a code from the app proves it was scanned */
export async function beginTotp(user: UserRow): Promise<TotpEnrolment> {
  if (!identitySecretsReady()) throw badRequest('This server cannot store authenticator secrets yet (IDENTITY_KEY is not set). Use a passkey, or ask the platform administrator.');
  const secret = newTotpSecret();
  await db.update(schema.users).set({ mfaTotpPending: sealIdentity(secret) }).where(eq(schema.users.id, user.id));
  const uri = otpauthUri(config.mfaIssuer, user.email, secret);
  const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { secret, uri, qrSvg };
}

/**
 * Step 2: the first code from the app switches the method on. Returns fresh recovery codes when the person had no unused ones (their
 * first factor) — shown once.
 */
export async function confirmTotp(user: UserRow, code: string, nowMs = Date.now()): Promise<{ recoveryCodes: string[] | null }> {
  if (!user.mfaTotpPending) throw badRequest('Start again: scan a new QR code first.');
  const secret = unsealIdentity(user.mfaTotpPending);
  const step = matchTotp(secret, code, nowMs);
  if (step === null) throw badRequest('That code did not match. Check the time on your phone is set automatically, and enter the newest code.', { code: 'Did not match' });
  await db
    .update(schema.users)
    .set({ mfaTotpSecret: sealIdentity(secret), mfaTotpPending: null, mfaTotpEnabledAt: new Date(nowMs), mfaTotpLastStep: step })
    .where(eq(schema.users.id, user.id));
  return { recoveryCodes: await ensureRecoveryCodes(user.id) };
}

/** a code from the app, accepted once (a time step equal to or older than the last accepted one is refused) */
export async function verifyTotp(user: UserRow, code: string, nowMs = Date.now()): Promise<boolean> {
  if (!user.mfaTotpEnabledAt || !user.mfaTotpSecret) return false;
  let secret: string;
  try {
    secret = unsealIdentity(user.mfaTotpSecret);
  } catch {
    return false;
  }
  const step = matchTotp(secret, code, nowMs);
  if (step === null) return false;
  const rows = await db
    .update(schema.users)
    .set({ mfaTotpLastStep: step })
    .where(and(eq(schema.users.id, user.id), or(isNull(schema.users.mfaTotpLastStep), sql`${schema.users.mfaTotpLastStep} < ${step}`)))
    .returning({ id: schema.users.id });
  return rows.length === 1;
}

export async function disableTotp(user: UserRow): Promise<void> {
  await db.update(schema.users).set({ mfaTotpSecret: null, mfaTotpPending: null, mfaTotpEnabledAt: null, mfaTotpLastStep: null }).where(eq(schema.users.id, user.id));
  await dropCodesIfNoFactor(user.id);
}

// ---------------------------------------------------------------- recovery codes

/** replaces every recovery code; returns the new ones (shown once) */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: MFA.recoveryCodes }, newRecoveryCode);
  await db.transaction(async (tx) => {
    await tx.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, userId));
    await tx.insert(schema.mfaRecoveryCodes).values(codes.map((c) => ({ userId, codeHash: sha256(c) })));
  });
  return codes.map(formatRecoveryCode);
}

/** new codes only when the person has no unused one (adding a second factor keeps the codes they already saved) */
async function ensureRecoveryCodes(userId: string): Promise<string[] | null> {
  const c = await recoveryCounts(userId);
  return c.remaining > 0 ? null : regenerateRecoveryCodes(userId);
}

async function dropCodesIfNoFactor(userId: string): Promise<void> {
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (u && (await factorCount(u)) === 0) await db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, userId));
}

/** uses one recovery code (atomic: two requests with the same code cannot both succeed) */
export async function useRecoveryCode(userId: string, typed: string): Promise<boolean> {
  const canonical = normalizeRecoveryCode(typed);
  if (!canonical) return false;
  const rows = await db
    .update(schema.mfaRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.mfaRecoveryCodes.userId, userId), eq(schema.mfaRecoveryCodes.codeHash, sha256(canonical)), isNull(schema.mfaRecoveryCodes.usedAt)))
    .returning({ id: schema.mfaRecoveryCodes.id });
  return rows.length === 1;
}

export const remainingRecoveryCodes = async (userId: string) => (await recoveryCounts(userId)).remaining;

// ---------------------------------------------------------------- passkeys

export async function passkeyRegistrationOptions(user: UserRow): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await listPasskeys(user.id);
  if (existing.length >= MFA.maxPasskeys) throw badRequest(`You already have ${MFA.maxPasskeys} passkeys. Remove one first.`);
  const { rpID, rpName } = RP();
  return generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: existing.map((k) => ({ id: k.credentialId, transports: k.transports })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
}

export async function registerPasskey(user: UserRow, expectedChallenge: string, response: unknown, name: string): Promise<{ passkey: PasskeyView; recoveryCodes: string[] | null }> {
  const { rpID, origin } = RP();
  let v;
  try {
    v = await verifyRegistrationResponse({ response: response as RegistrationResponseJSON, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
  } catch (err) {
    throw badRequest(`The passkey could not be added: ${(err as Error).message}`);
  }
  if (!v.verified) throw badRequest('The passkey could not be verified. Try again.');
  const c = v.registrationInfo.credential;
  const [row] = await db
    .insert(schema.webauthnCredentials)
    .values({
      userId: user.id,
      credentialId: c.id,
      publicKey: Buffer.from(c.publicKey),
      counter: c.counter,
      transports: c.transports ?? [],
      deviceType: v.registrationInfo.credentialDeviceType,
      backedUp: v.registrationInfo.credentialBackedUp,
      name,
    })
    .returning();
  return { passkey: toPasskeyView(row), recoveryCodes: await ensureRecoveryCodes(user.id) };
}

export async function renamePasskey(userId: string, id: string, name: string): Promise<PasskeyView> {
  const [row] = await db
    .update(schema.webauthnCredentials)
    .set({ name })
    .where(and(eq(schema.webauthnCredentials.userId, userId), eq(schema.webauthnCredentials.id, id)))
    .returning();
  if (!row) throw notFound('Passkey not found');
  return toPasskeyView(row);
}

export async function removePasskey(userId: string, id: string): Promise<WebauthnCredentialRow> {
  const [row] = await db
    .delete(schema.webauthnCredentials)
    .where(and(eq(schema.webauthnCredentials.userId, userId), eq(schema.webauthnCredentials.id, id)))
    .returning();
  if (!row) throw notFound('Passkey not found');
  await dropCodesIfNoFactor(userId);
  return row;
}

export async function passkeyAuthenticationOptions(userId: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const keys = await listPasskeys(userId);
  if (!keys.length) throw badRequest('You have no passkey on this account.');
  return generateAuthenticationOptions({ rpID: RP().rpID, allowCredentials: keys.map((k) => ({ id: k.credentialId, transports: k.transports as never })), userVerification: 'preferred' });
}

/** checks a passkey assertion against the person's own credentials; true when it verified (the counter is advanced) */
export async function verifyPasskey(userId: string, expectedChallenge: string, response: unknown): Promise<boolean> {
  const r = response as AuthenticationResponseJSON;
  if (!r || typeof r.id !== 'string') return false;
  const key = await db.query.webauthnCredentials.findFirst({ where: and(eq(schema.webauthnCredentials.userId, userId), eq(schema.webauthnCredentials.credentialId, r.id)) });
  if (!key) return false;
  const { rpID, origin } = RP();
  try {
    const v = await verifyAuthenticationResponse({
      response: r,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: key.credentialId, publicKey: new Uint8Array(key.publicKey), counter: key.counter, transports: key.transports },
      requireUserVerification: false,
    });
    if (!v.verified) return false;
    await db.update(schema.webauthnCredentials).set({ counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(schema.webauthnCredentials.id, key.id));
    return true;
  } catch {
    return false;
  }
}

/** marks this session as having passed a second factor (and as a fresh step-up) */
export async function markSessionMfa(sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  const now = new Date();
  await db.update(schema.sessions).set({ mfaAt: now, reauthAt: now }).where(eq(schema.sessions.id, sessionId));
}

export const _test = { newRecoveryCode, base32Encode };
