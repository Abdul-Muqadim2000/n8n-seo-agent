import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, hotp, matchTotp, newTotpSecret, otpauthUri, timeStep } from '../src/auth/totp';

// G1: the one-time-password algorithm against the RFCs' own test vectors.

const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');

describe('HOTP (RFC 4226 appendix D)', () => {
  it.each([
    [0, '755224'],
    [1, '287082'],
    [2, '359152'],
    [3, '969429'],
    [4, '338314'],
    [5, '254676'],
    [6, '287922'],
    [7, '162583'],
    [8, '399871'],
    [9, '520489'],
  ])('counter %i gives %s', (c, v) => expect(hotp(RFC_SECRET, c)).toBe(v));
});

describe('TOTP (RFC 6238 appendix B, SHA-1, 8 digits)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('T=%i gives %s', (t, v) => expect(hotp(RFC_SECRET, Math.floor(t / 30), 8)).toBe(v));
});

describe('base32 (RFC 4648)', () => {
  it('encodes the RFC vectors and round-trips', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Encode(Buffer.from('f'))).toBe('MY');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Decode('mzxw 6ytb-oi======').toString()).toBe('foobar');
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(() => base32Decode('M1!')).toThrow();
  });
});

describe('matchTotp', () => {
  const secret = base32Encode(RFC_SECRET);
  const at = 1_760_000_000_000;
  const step = timeStep(at);
  it('accepts the current step and one either side, nothing further', () => {
    expect(matchTotp(secret, hotp(RFC_SECRET, step), at)).toBe(step);
    expect(matchTotp(secret, hotp(RFC_SECRET, step - 1), at)).toBe(step - 1);
    expect(matchTotp(secret, hotp(RFC_SECRET, step + 1), at)).toBe(step + 1);
    expect(matchTotp(secret, hotp(RFC_SECRET, step - 2), at)).toBeNull();
    expect(matchTotp(secret, hotp(RFC_SECRET, step + 2), at)).toBeNull();
  });
  it('refuses anything that is not six digits', () => {
    for (const c of ['', '12345', '1234567', 'abcdef', ' 123456']) expect(matchTotp(secret, c, at)).toBeNull();
  });
  it('builds the Key URI an authenticator app reads', () => {
    const u = otpauthUri('Alaventra', 'dana@northwind.test', 'JBSWY3DPEHPK3PXP');
    expect(u).toBe('otpauth://totp/Alaventra:dana%40northwind.test?secret=JBSWY3DPEHPK3PXP&issuer=Alaventra&algorithm=SHA1&digits=6&period=30');
  });
});
