import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';

// Mailbox passwords at rest (v4.13): AES-256-GCM with a key kept outside the database (MAILBOX_KEY, 32 bytes as 64 hex characters or
// base64; OWASP cryptographic storage). Format "v1:<iv>:<tag>:<ciphertext>" (base64url) so a new key version can be added later.

function key(): Buffer | null {
  const k = config.mailboxKey.trim();
  if (!k) return null;
  const b = /^[0-9a-f]{64}$/i.test(k) ? Buffer.from(k, 'hex') : Buffer.from(k, 'base64');
  return b.length === 32 ? b : null;
}

export const secretsReady = (): boolean => key() !== null;

export function seal(plain: string): string {
  const k = key();
  if (!k) throw new Error('MAILBOX_KEY is not set (32 bytes, hex or base64): mailbox passwords cannot be stored');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join(':');
}

export function unseal(sealed: string): string {
  const k = key();
  if (!k) throw new Error('MAILBOX_KEY is not set: the mailbox password cannot be read');
  const [v, iv, tag, body] = sealed.split(':');
  if (v !== 'v1' || !iv || !tag || body === undefined) throw new Error('Unknown secret format');
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}
