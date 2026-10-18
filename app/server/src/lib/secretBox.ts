import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';

// Secrets at rest: AES-256-GCM with a key kept outside the database (OWASP cryptographic storage). Format
// "v1:<iv>:<tag>:<ciphertext>" (base64url) so a new key version can be added later.
// - mailbox passwords and the delivery webhook secret (v4.13): MAILBOX_KEY
// - G1 identity secrets (authenticator-app secrets, OIDC client secrets): IDENTITY_KEY, falling back to MAILBOX_KEY

function parseKey(raw: string): Buffer | null {
  const k = raw.trim();
  if (!k) return null;
  const b = /^[0-9a-f]{64}$/i.test(k) ? Buffer.from(k, 'hex') : Buffer.from(k, 'base64');
  return b.length === 32 ? b : null;
}

function sealWith(k: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join(':');
}

function unsealWith(k: Buffer, sealed: string): string {
  const [v, iv, tag, body] = sealed.split(':');
  if (v !== 'v1' || !iv || !tag || body === undefined) throw new Error('Unknown secret format');
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

const key = () => parseKey(config.mailboxKey);
const identityKey = () => parseKey(config.identityKey ?? '');

export const secretsReady = (): boolean => key() !== null;

export function seal(plain: string): string {
  const k = key();
  if (!k) throw new Error('MAILBOX_KEY is not set (32 bytes, hex or base64): mailbox passwords cannot be stored');
  return sealWith(k, plain);
}

export function unseal(sealed: string): string {
  const k = key();
  if (!k) throw new Error('MAILBOX_KEY is not set: the mailbox password cannot be read');
  return unsealWith(k, sealed);
}

export const identitySecretsReady = (): boolean => identityKey() !== null;

export function sealIdentity(plain: string): string {
  const k = identityKey();
  if (!k) throw new Error('IDENTITY_KEY (or MAILBOX_KEY) is not set: identity secrets cannot be stored');
  return sealWith(k, plain);
}

export function unsealIdentity(sealed: string): string {
  const k = identityKey();
  if (!k) throw new Error('IDENTITY_KEY (or MAILBOX_KEY) is not set: identity secrets cannot be read');
  return unsealWith(k, sealed);
}
