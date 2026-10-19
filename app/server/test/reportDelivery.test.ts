import { describe, expect, it } from 'vitest';
import { DELIVERY, deliveryDecision, deliveryWebhookBody, type DeliveryPayload } from '@seo/shared';
import { settingsOf, signBody, verifyBody } from '../src/services/reportDelivery';

// B-R1, report delivery. The decision itself is tested in `@seo/shared` (`report-delivery.test.ts`, 38 cases); what is tested here
// is the server's own half: reading a company's stored settings, and signing a webhook body so a receiver can tell it is ours.

describe('settingsOf: a company that has never touched the setting', () => {
  it('delivers nothing until somebody asks for it', () => {
    const s = settingsOf({ deliverySettings: {}, deliveryWebhookSecret: '' });
    expect(s.frequency).toBe('off');
    expect(s.email.enabled).toBe(false);
    expect(s.webhook.enabled).toBe(false);
  });

  it('fills the gaps in a half-written row rather than failing', () => {
    const s = settingsOf({ deliverySettings: { frequency: 'weekly', email: { enabled: true } }, deliveryWebhookSecret: '' });
    expect(s.frequency).toBe('weekly');
    expect(s.email.enabled).toBe(true);
    expect(s.email.recipients).toEqual([]);
    expect(s.email.attachFiles).toBe(true);
    expect(s.hour).toBe(8);
  });

  it('falls back to "off" when the stored row makes no sense at all', () => {
    expect(settingsOf({ deliverySettings: { frequency: 'hourly' } as never, deliveryWebhookSecret: '' }).frequency).toBe('off');
  });

  it('never returns the signing secret, only whether one is stored', () => {
    const s = settingsOf({ deliverySettings: { frequency: 'each', webhook: { enabled: true, url: 'https://hooks.example.com/x' } }, deliveryWebhookSecret: 'v1:a:b:c' });
    expect(s.webhook.hasSecret).toBe(true);
    expect(JSON.stringify(s)).not.toContain('v1:a:b:c');
    expect(settingsOf({ deliverySettings: {}, deliveryWebhookSecret: '' }).webhook.hasSecret).toBe(false);
  });
});

describe('the webhook signature', () => {
  const body = JSON.stringify({ event: 'reports.delivered' });

  it('a receiver with the secret can verify it', () => {
    const sig = signBody('s3cret', '1760000000000', body);
    expect(sig.startsWith('sha256=')).toBe(true);
    expect(verifyBody('s3cret', '1760000000000', body, sig)).toBe(true);
  });

  it('a wrong secret, a changed body or a moved timestamp all fail', () => {
    const sig = signBody('s3cret', '1760000000000', body);
    expect(verifyBody('other', '1760000000000', body, sig)).toBe(false);
    expect(verifyBody('s3cret', '1760000000000', body + ' ', sig)).toBe(false);
    expect(verifyBody('s3cret', '1760000000001', body, sig)).toBe(false);
    expect(verifyBody('s3cret', '1760000000000', body, '')).toBe(false);
  });

  it('is sent under the agreed headers', () => {
    expect(DELIVERY.signatureHeader).toBe('X-Alaventra-Signature');
    expect(DELIVERY.timestampHeader).toBe('X-Alaventra-Timestamp');
  });
});

describe('the body that goes over the wire', () => {
  const payload: DeliveryPayload = {
    company: 'Techand',
    kind: 'weekly',
    generatedAt: '2026-10-19T08:00:00.000Z',
    reports: [
      {
        reportId: 'r1',
        stage: 'site_audit',
        stageLabel: 'Technical audit',
        title: 'Technical audit · techand.ai',
        siteDomain: 'techand.ai',
        receivedAt: '2026-10-19T07:55:00.000Z',
        scheduled: true,
        figures: { healthScore: 83, critical: 0, high: 4 },
        url: 'https://app.example.com/o/o1/reports/r1',
        shareUrl: 'https://app.example.com/share/tok',
        files: [],
      },
    ],
    held: [{ reportId: 'r2', title: 'Page: erp software uae', reason: 'The page did not pass the quality check.', code: 'not_ready' }],
  };

  it('carries the figures, the share link and what was held', () => {
    const b = deliveryWebhookBody(payload) as { text: string; held: { code: string }[]; reports: { figures: Record<string, unknown> }[] };
    expect(b.text).toContain('Health score: 83');
    expect(b.text).toContain('https://app.example.com/share/tok');
    expect(b.text).toMatch(/Not sent(?: \u2014|:|,) Page: erp software uae/);
    expect(b.held[0]!.code).toBe('not_ready');
    expect(b.reports[0]!.figures.healthScore).toBe(83);
  });

  it('a held report is never one of the reports in the body', () => {
    const b = deliveryWebhookBody(payload) as { reports: { id: string }[] };
    expect(b.reports.map((r) => r.id)).toEqual(['r1']);
  });

  it('and the thing it was held for would still be refused on its own', () => {
    expect(deliveryDecision({ stage: 'content', status: 'completed', payload: { qa_not_ready: true } }).deliver).toBe(false);
  });
});
