import { createHash, createHmac } from 'node:crypto';

/**
 * AWS Signature Version 4 for S3-compatible storage (G4 export: AWS S3, Google Cloud Storage's XML API with HMAC keys, Cloudflare R2).
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html — written here instead of pulling in an SDK of a
 * few megabytes for one PUT; checked in sigv4.test.ts against the signature AWS publishes for its "GET Object" example.
 */

export const sha256Hex = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer => createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding as S3 wants it (every byte except A-Z a-z 0-9 - _ . ~; '/' kept in paths) */
export const encodeRfc3986 = (s: string, keepSlash = false): string =>
  [...Buffer.from(s, 'utf8')]
    .map((b) => {
      const c = String.fromCharCode(b);
      return /[A-Za-z0-9\-_.~]/.test(c) || (keepSlash && c === '/') ? c : '%' + b.toString(16).toUpperCase().padStart(2, '0');
    })
    .join('');

export interface SignInput {
  method: string;
  /** the full URL; its path must already be encoded with `encodeRfc3986(path, true)` */
  url: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** extra headers to sign (lower-case names), e.g. content-type, range */
  headers?: Record<string, string>;
  /** the payload's SHA-256 (hex), or 'UNSIGNED-PAYLOAD' */
  payloadHash: string;
  now?: Date;
  service?: string;
}

export function amzDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** The headers to send: the given ones plus host, x-amz-date, x-amz-content-sha256 and the Authorization header. */
export function signRequest(i: SignInput): Record<string, string> {
  const u = new URL(i.url);
  const now = i.now ?? new Date();
  const stamp = amzDate(now);
  const day = stamp.slice(0, 8);
  const service = i.service ?? 's3';
  const headers: Record<string, string> = { ...(i.headers ?? {}), host: u.host, 'x-amz-date': stamp, 'x-amz-content-sha256': i.payloadHash };
  const names = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const query = [...u.searchParams.entries()]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const canonical = [i.method.toUpperCase(), u.pathname || '/', query, canonicalHeaders, signedHeaders, i.payloadHash].join('\n');
  const scope = `${day}/${i.region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256Hex(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac('AWS4' + i.secretAccessKey, day), i.region), service), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
}
