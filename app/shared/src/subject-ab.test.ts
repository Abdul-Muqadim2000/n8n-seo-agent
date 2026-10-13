import { describe, expect, it } from 'vitest';
import { SUBJECT_AB_MIN_SENDS, subjectAbStats, subjectVariantFor, type OutreachStep } from './outreach';

// L7 (FIX_PLAN): two subject styles a batch, the reply rate of each — and no verdict before there is enough to read. The same rule runs in
// the engine (n8n/seo-agent/v5/code/_ab.js, harness S61): the two must agree.
const step = (subject: string): OutreachStep[] => [{ step: 0, waitDays: 0, subject, body: 'Hello …' }];
const seqs = (variant: string, sent: number, replied: number, subject = `subject ${variant}`) =>
  Array.from({ length: sent }, (_, i) => ({
    subjectVariant: variant,
    startedAt: '2026-10-01T09:00:00.000Z',
    replyAt: i < replied ? '2026-10-03T09:00:00.000Z' : null,
    replyClass: i < replied ? 'interested' : null,
    steps: step(subject),
  }));

describe('subject-line A/B (L7)', () => {
  it('a variant with 12 sends shows its counts and no winner', () => {
    const r = subjectAbStats([...seqs('A', 12, 3), ...seqs('B', 31, 2)]);
    expect(r.verdict).toBe('not_enough');
    expect(r.leader).toBe('');
    expect(r.enough).toBe(false);
    expect(r.rows.map((x) => [x.variant, x.sent, x.replied, x.replyRate])).toEqual([
      ['A', 12, 3, 25],
      ['B', 31, 2, 6.5],
    ]);
    expect(r.note).toContain('Not enough sends yet');
    expect(r.note).toContain('A (12 of 30)');
    expect(r.counts).toContain('3 replies from 12 e-mails');
    expect(r.minSends).toBe(SUBJECT_AB_MIN_SENDS);
  });

  it('with enough sends each the better style is called ahead by its points, and a small difference is no difference', () => {
    const ahead = subjectAbStats([...seqs('A', 40, 8), ...seqs('B', 38, 2)]);
    expect([ahead.verdict, ahead.leader, ahead.gap]).toEqual(['ahead', 'A', 14.7]);
    expect(ahead.note).toContain('a hint, not a rule');
    expect(ahead.note).not.toMatch(/winner|proves/i);
    const level = subjectAbStats([...seqs('A', 40, 8), ...seqs('B', 41, 8)]);
    expect([level.verdict, level.leader]).toEqual(['no_difference', '']);
  });

  it('a pitch that never went out, and a pitch with no variant, count for nothing', () => {
    expect(subjectAbStats([]).verdict).toBe('nothing_sent');
    expect(subjectAbStats([{ subjectVariant: 'A', startedAt: null, replyAt: null, replyClass: null, steps: step('x') }]).verdict).toBe('nothing_sent');
    expect(subjectAbStats([{ subjectVariant: '', startedAt: '2026-10-01', replyAt: null, replyClass: null, steps: step('x') }]).rows.every((r) => r.sent === 0)).toBe(true);
  });

  it('an out-of-office is not a reply, and the subject shown is the one that went out', () => {
    const r = subjectAbStats([
      { subjectVariant: 'A', startedAt: '2026-10-01', replyAt: '2026-10-02', replyClass: 'out_of_office', steps: step('Dead link on your VAT page') },
      ...seqs('A', 1, 0),
    ]);
    expect(r.rows[0]!.replied).toBe(0);
    expect(r.rows[0]!.sent).toBe(2);
    expect(r.rows[0]!.subject).toBe('Dead link on your VAT page');
  });

  it('the batch hands the two styles out in turn, so each goes out about as often', () => {
    expect([0, 1, 2, 3, 4].map(subjectVariantFor)).toEqual(['A', 'B', 'A', 'B', 'A']);
  });
});
