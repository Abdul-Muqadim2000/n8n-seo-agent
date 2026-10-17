import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  actionsIn,
  auditCsvRow,
  auditLabel,
  csvCell,
  safeAuditDetails,
  cleanTotpCode,
  DEFAULT_SECURITY_POLICY,
  formatRecoveryCode,
  idleLabel,
  isTotpCode,
  maskEmail,
  mfaVerifySchema,
  normalizeRecoveryCode,
  policyOf,
  retentionLabel,
  securityPolicySchema,
  sessionMeetsMfa,
  stepUpSchema,
  strictestIdle,
} from './identity';

describe('two-step codes as typed', () => {
  it('accepts six digits with spaces or a dash, nothing else', () => {
    expect(isTotpCode('123456')).toBe(true);
    expect(isTotpCode('123 456')).toBe(true);
    expect(isTotpCode('123-456')).toBe(true);
    expect(cleanTotpCode(' 12 34 56 ')).toBe('123456');
    for (const v of ['12345', '1234567', 'abcdef', '', null, 123456]) expect(isTotpCode(v)).toBe(false);
  });
  it('reads recovery codes in any case, with or without dashes, forgiving 0/1/8', () => {
    expect(normalizeRecoveryCode('abcd-efgh-ijkl-mnop')).toBe('ABCDEFGHIJKLMNOP');
    expect(normalizeRecoveryCode('ABCD EFGH IJKL MNOP')).toBe('ABCDEFGHIJKLMNOP');
    expect(normalizeRecoveryCode('A0C1-8FGH-IJKL-MNOP')).toBe('AOCIBFGHIJKLMNOP');
    expect(normalizeRecoveryCode('ABCD-EFGH-IJKL')).toBe('');
    expect(normalizeRecoveryCode('ABCD-EFGH-IJKL-MNO9')).toBe('');
    expect(normalizeRecoveryCode(undefined)).toBe('');
    expect(formatRecoveryCode('ABCDEFGHIJKLMNOP')).toBe('ABCD-EFGH-IJKL-MNOP');
  });
  it('validates the verify and step-up bodies', () => {
    expect(mfaVerifySchema.safeParse({ method: 'totp', code: '123456' }).success).toBe(true);
    expect(mfaVerifySchema.safeParse({ method: 'totp', code: '12' }).success).toBe(false);
    expect(mfaVerifySchema.safeParse({ method: 'recovery', code: 'abcd-efgh-ijkl-mnop' }).success).toBe(true);
    expect(mfaVerifySchema.safeParse({ method: 'webauthn', response: { id: 'x' } }).success).toBe(true);
    expect(mfaVerifySchema.safeParse({ method: 'password', password: 'x' }).success).toBe(false);
    expect(stepUpSchema.safeParse({ method: 'password', password: 'x' }).success).toBe(true);
    expect(stepUpSchema.safeParse({ method: 'sms', code: '123456' }).success).toBe(false);
  });
  it('masks the address on the second-step page', () => {
    expect(maskEmail('dana@northwind.test')).toBe('d…a@northwind.test');
    expect(maskEmail('jo@x.io')).toBe('j@x.io');
  });
});

describe('the company security policy', () => {
  it('reads stored jsonb defensively: unknown keys dropped, invalid values at their defaults', () => {
    expect(policyOf(null)).toEqual(DEFAULT_SECURITY_POLICY);
    expect(policyOf({ requireMfa: true, idleTimeoutMinutes: 30, auditRetentionDays: 90, evil: 1 })).toEqual({ ...DEFAULT_SECURITY_POLICY, requireMfa: true, idleTimeoutMinutes: 30, auditRetentionDays: 90 });
    expect(policyOf({ requireMfa: 'yes', idleTimeoutMinutes: 7, auditRetentionDays: 3 })).toEqual(DEFAULT_SECURITY_POLICY);
  });
  it('validates a change to the offered choices only', () => {
    expect(securityPolicySchema.safeParse({ ...DEFAULT_SECURITY_POLICY, idleTimeoutMinutes: 60 }).success).toBe(true);
    expect(securityPolicySchema.safeParse({ ...DEFAULT_SECURITY_POLICY, idleTimeoutMinutes: 61 }).success).toBe(false);
    expect(securityPolicySchema.safeParse({ ...DEFAULT_SECURITY_POLICY, auditRetentionDays: 10 }).success).toBe(false);
  });
  it('decides when a session meets a two-step requirement', () => {
    const p = { ...DEFAULT_SECURITY_POLICY, requireMfa: true };
    const s = { mfaAt: null, authMethod: 'password', ssoOrgId: null };
    expect(sessionMeetsMfa(DEFAULT_SECURITY_POLICY, s, 'o1')).toBe(true);
    expect(sessionMeetsMfa(p, s, 'o1')).toBe(false);
    expect(sessionMeetsMfa(p, { ...s, mfaAt: new Date() }, 'o1')).toBe(true);
    // Google counts only when the company says so
    expect(sessionMeetsMfa(p, { ...s, authMethod: 'google' }, 'o1')).toBe(false);
    expect(sessionMeetsMfa({ ...p, mfaTrustGoogle: true }, { ...s, authMethod: 'google' }, 'o1')).toBe(true);
    // SSO counts only for the company whose IdP it was
    expect(sessionMeetsMfa(p, { ...s, authMethod: 'sso', ssoOrgId: 'o1' }, 'o1')).toBe(true);
    expect(sessionMeetsMfa(p, { ...s, authMethod: 'sso', ssoOrgId: 'o2' }, 'o1')).toBe(false);
    expect(sessionMeetsMfa({ ...p, mfaTrustSso: false }, { ...s, authMethod: 'sso', ssoOrgId: 'o1' }, 'o1')).toBe(false);
  });
  it('takes the strictest idle timeout of a person’s companies', () => {
    expect(strictestIdle([])).toBeNull();
    expect(strictestIdle([DEFAULT_SECURITY_POLICY])).toBeNull();
    expect(strictestIdle([{ ...DEFAULT_SECURITY_POLICY, idleTimeoutMinutes: 240 }, DEFAULT_SECURITY_POLICY, { ...DEFAULT_SECURITY_POLICY, idleTimeoutMinutes: 30 }])).toBe(30);
  });
  it('labels the choices in words', () => {
    expect(idleLabel(null)).toBe('Never');
    expect(idleLabel(15)).toBe('15 minutes');
    expect(idleLabel(60)).toBe('1 hour');
    expect(idleLabel(480)).toBe('8 hours');
    expect(retentionLabel(90)).toBe('90 days');
    expect(retentionLabel(365)).toBe('1 year');
    expect(retentionLabel(730)).toBe('2 years');
    expect(retentionLabel(2555)).toBe('7 years');
  });
});

describe('the audit log', () => {
  it('files every action under a known category with words for it', () => {
    for (const [a, v] of Object.entries(AUDIT_ACTIONS)) {
      expect(Object.keys(AUDIT_CATEGORIES), a).toContain(v.category);
      expect(v.label.length, a).toBeGreaterThan(3);
    }
    for (const c of Object.keys(AUDIT_CATEGORIES)) expect(actionsIn(c as never).length, c).toBeGreaterThan(0);
    expect(auditLabel('team.invited')).toBe('Invited someone');
    expect(auditLabel('unknown.thing')).toBe('unknown.thing');
  });
  it('drops anything that looks like a secret from the details, at any level', () => {
    const d = safeAuditDetails({
      role: 'admin',
      password: 'hunter2',
      webhook: { url: 'https://x.test', secret: 's3cret', signingSecret: 'x' },
      apiKey: 'asc_123',
      token: 't',
      code: '123456',
      clientSecret: 'cs',
      privateKey: 'pk',
      list: [{ token: 'a', name: 'n' }],
      long: 'x'.repeat(1000),
    });
    expect(d).toEqual({ role: 'admin', webhook: { url: 'https://x.test' }, list: [{ name: 'n' }], long: 'x'.repeat(300) });
    expect(safeAuditDetails('not an object')).toEqual({});
  });
  it('writes CSV cells that a spreadsheet will not execute', () => {
    expect(csvCell('plain')).toBe('"plain"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    for (const v of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx']) expect(csvCell(v).startsWith(`"'`), v).toBe(true);
    expect(csvCell(null)).toBe('""');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
    const row = auditCsvRow({ id: '1', at: '2026-10-17T10:00:00.000Z', action: 'team.invited', label: 'Invited someone', category: 'team', outcome: 'success', actorType: 'user', actorId: null, actorLabel: 'a@b.test', targetType: 'invitation', targetId: 'i1', targetLabel: '=evil()', ip: '1.2.3.4', userAgent: 'UA', details: { role: 'member' } });
    expect(row).toBe('"2026-10-17T10:00:00.000Z","team.invited","Invited someone","success","user","a@b.test","invitation","\'=evil()","1.2.3.4","UA","{""role"":""member""}"');
  });
});
