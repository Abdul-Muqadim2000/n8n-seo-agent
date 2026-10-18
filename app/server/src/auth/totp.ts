import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MFA } from '@seo/shared';

// RFC 6238 time-based one-time passwords (HMAC-SHA-1, 6 digits, 30-second steps — what Google Authenticator, Microsoft
// Authenticator, 1Password, Authy and every other app default to), on top of RFC 4226 HOTP. No dependency: the algorithm is a page
// long and is tested against the RFC's own vectors (test/identity-totp.test.ts).

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('Invalid base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = (): string => base32Encode(randomBytes(MFA.secretBytes));

/** RFC 4226 HOTP value for a counter */
export function hotp(secret: Buffer, counter: number, digits: number = MFA.digits, algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac(algorithm, secret).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const timeStep = (nowMs: number = Date.now()): number => Math.floor(nowMs / 1000 / MFA.periodSeconds);

/**
 * The time step a code matches (the current step ± `MFA.window`), or null. The caller refuses a step that is not newer than the last
 * accepted one, so a code is never accepted twice (RFC 6238 §5.2).
 */
export function matchTotp(secretB32: string, code: string, nowMs: number = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const now = timeStep(nowMs);
  let found: number | null = null;
  // check every candidate (no early return) so the time taken does not say which step matched
  for (let d = -MFA.window; d <= MFA.window; d++) {
    const expected = Buffer.from(hotp(secret, now + d));
    if (timingSafeEqual(expected, Buffer.from(code)) && found === null) found = now + d;
  }
  return found;
}

/** the otpauth:// URI an authenticator app reads from the QR code (Key URI Format) */
export function otpauthUri(issuer: string, account: string, secretB32: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const q = new URLSearchParams({ secret: secretB32, issuer, algorithm: 'SHA1', digits: String(MFA.digits), period: String(MFA.periodSeconds) });
  return `otpauth://totp/${label}?${q}`;
}
