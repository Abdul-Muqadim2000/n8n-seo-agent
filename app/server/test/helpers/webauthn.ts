import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';

/**
 * G1: a software authenticator (one ES256 passkey) that produces the exact WebAuthn JSON a browser sends — registration with "none"
 * attestation, and assertions over authenticatorData ‖ SHA-256(clientDataJSON) — so the server's passkey routes are tested against
 * real signatures, not mocks.
 */

function head(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) return Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(n, 1);
  return b;
}

/** a minimal CBOR encoder: integers, byte strings, text, maps (Map keeps integer keys, as COSE needs) */
export function cbor(v: unknown): Buffer {
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') {
    const b = Buffer.from(v, 'utf8');
    return Buffer.concat([head(3, b.length), b]);
  }
  if (v instanceof Uint8Array) return Buffer.concat([head(2, v.length), Buffer.from(v)]);
  if (v instanceof Map) return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  if (v && typeof v === 'object') {
    const e = Object.entries(v);
    return Buffer.concat([head(5, e.length), ...e.flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  }
  throw new Error(`cbor: unsupported ${typeof v}`);
}

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest();

export class SoftAuthenticator {
  readonly credId = randomBytes(16);
  private key: { privateKey: KeyObject; publicKey: KeyObject } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  private counter = 0;
  constructor(
    public rpId: string,
    public origin: string,
  ) {}

  get id() {
    return b64u(this.credId);
  }

  private coseKey(): Buffer {
    const jwk = this.key.publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    return cbor(new Map<number, unknown>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
  }

  /** what navigator.credentials.create() resolves to, as @simplewebauthn/browser serialises it */
  register(options: { challenge: string }, o: { origin?: string } = {}) {
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin: o.origin ?? this.origin, crossOrigin: false }));
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(this.credId.length);
    const authData = Buffer.concat([sha(this.rpId), Buffer.from([0x01 | 0x04 | 0x40]), Buffer.alloc(4), Buffer.alloc(16), idLen, this.credId, this.coseKey()]);
    const attestationObject = cbor({ fmt: 'none', attStmt: {}, authData });
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: { clientDataJSON: b64u(clientDataJSON), attestationObject: b64u(attestationObject), transports: ['internal'] },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }

  /** what navigator.credentials.get() resolves to */
  assert(options: { challenge: string }, o: { origin?: string; rpId?: string } = {}) {
    this.counter += 1;
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin: o.origin ?? this.origin, crossOrigin: false }));
    const cnt = Buffer.alloc(4);
    cnt.writeUInt32BE(this.counter);
    const authenticatorData = Buffer.concat([sha(o.rpId ?? this.rpId), Buffer.from([0x01 | 0x04]), cnt]);
    const signature = sign('sha256', Buffer.concat([authenticatorData, sha(clientDataJSON)]), this.key.privateKey);
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: { clientDataJSON: b64u(clientDataJSON), authenticatorData: b64u(authenticatorData), signature: b64u(signature) },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }
}
