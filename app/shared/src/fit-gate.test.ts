import { describe, expect, it } from 'vitest';
import { cycleNorm } from './cycles';
import { fitEvidence, fitGate, fitOwnLabels, fitTokens, fitTopic } from './fit-gate';
import { normKeyword } from './pipeline-notices';

// The engine's F-KW fit-gate rules (v5/code/_fit_gate.js, 2026-10-20), ported for the cadence mirror. The shared fixture runs them inside
// whole plans (server/test/cadenceLevels.test.ts); these pin each rule on its own.

describe('fit gate, F-KW port', () => {
  it('tokens and keys keep letters of every script (an Arabic keyword used to have none)', () => {
    expect(fitTokens('برنامج محاسبة في الإمارات')).toEqual(['برنامج', 'محاسبة', 'في', 'الإمارات']);
    expect(cycleNorm('برنامج  محاسبة!')).toBe('برنامج محاسبة');
    expect(normKeyword('برنامج محاسبة')).not.toBe(normKeyword('نظام رواتب')); // two Arabic keywords are two keys, never ''
    expect(normKeyword('CRM  Consulting!')).toBe('crm consulting');
  });

  it('only a distinctive domain label is the website\'s own brand: an exact-match domain\'s subject is not', () => {
    expect(fitOwnLabels('erp-software.ae', fitTokens('erp software uae'))).toEqual([]);
    expect(fitGate('erp software uae', { own_domain: 'erp-software.ae' }).ok).toBe(true);
    expect(fitOwnLabels('techand.ai', fitTokens('techand crm'))).toEqual(['techand']);
    expect(fitGate('techand crm', { own_domain: 'techand.ai' })).toMatchObject({ ok: false, reason: 'own brand' });
    expect(fitOwnLabels('crmexperts.ae', fitTokens('crmexperts reviews'))).toEqual([]);
  });

  it('positive evidence: in with any number of topic words; unknown with too little on file; out with 12+ words', () => {
    expect(fitEvidence('crm data migration', ['CRM data migration']).verdict).toBe('in');
    expect(fitEvidence('payroll outsourcing', ['CRM data migration']).verdict).toBe('unknown');
    expect(fitEvidence('anything', []).verdict).toBe('unknown');
    const many = ['CRM implementation services', 'CRM consulting for sales teams', 'CRM data migration', 'Customer support desk setup', 'Sales pipeline automation', 'CRM training and adoption'];
    expect(fitEvidence('office coffee machines', many).verdict).toBe('out');
  });

  it('a year or a number is neutral, like a place', () => {
    const t = ['CRM implementation services', 'CRM consulting for sales teams', 'CRM data migration', 'Customer support desk setup', 'Sales pipeline automation', 'CRM training and adoption'];
    expect(fitTopic('crm data migration 2026', t).share).toBe(fitTopic('crm data migration', t).share);
  });
});
