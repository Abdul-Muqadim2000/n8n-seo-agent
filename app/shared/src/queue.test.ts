// REP 3.3 (benchmark pass of 2026-10-14): the one queue. What these tests hold to is the rule the benchmark programme sets,
// a number only where something was measured, a named reason where it was not, and one order for the whole app.
import { describe, expect, it } from 'vitest';
import {
  BAND_NOTE,
  CONFIDENCE,
  EFFORT_BANDS,
  IMPACT_AUDIT_CEILING,
  IMPACT_CLICKS_CEILING,
  RULE_SCORES,
  bandOf,
  impactFromAuditWeight,
  impactFromClicks,
  impactFromPoints,
  queueBands,
  queueOrder,
  ruleScoreFor,
  scoreNote,
  scoreOf,
  type RecommendationScore,
} from './queue';

const ranked = (input: Parameters<typeof scoreOf>[0]) => {
  const s = scoreOf(input);
  if (!s.ranked) throw new Error('expected a ranked score');
  return s;
};

describe('impact scales', () => {
  it('reads 0 for nothing and 10 at the ceiling', () => {
    expect(impactFromClicks(0)).toBe(0);
    expect(impactFromClicks(-5)).toBe(0);
    expect(impactFromClicks(Number.NaN)).toBe(0);
    expect(impactFromClicks(IMPACT_CLICKS_CEILING)).toBe(10);
    expect(impactFromAuditWeight(IMPACT_AUDIT_CEILING)).toBe(10);
    expect(impactFromPoints(20)).toBe(10);
  });

  it('never goes above 10, however big the quantity', () => {
    for (const v of [500, 5_000, 1e9]) {
      expect(impactFromClicks(v)).toBeLessThanOrEqual(10);
      expect(impactFromAuditWeight(v)).toBeLessThanOrEqual(10);
      expect(impactFromPoints(v)).toBeLessThanOrEqual(10);
    }
  });

  it('rises with the quantity and compresses the top (a log scale, not a linear one)', () => {
    expect(impactFromClicks(50)).toBeGreaterThan(impactFromClicks(5));
    expect(impactFromClicks(500) - impactFromClicks(450)).toBeLessThan(impactFromClicks(50) - impactFromClicks(5));
  });
});

describe('scoreOf', () => {
  it('computes impact x confidence / effort', () => {
    const s = ranked({ impact: 8, confidence: 'measured', effort: 'hour', basis: '120 clicks lost' });
    expect(s.value).toBe(Math.round((8 * CONFIDENCE.measured.value * 10) / EFFORT_BANDS.hour.weight) / 10);
    expect(s.value).toBe(3.2);
    expect(s.confidence).toBe(0.8);
    expect(s.effort).toBe(2);
  });

  it('ranks a measured item above the same item modelled, and a quick one above a slow one', () => {
    const base = { impact: 6, effort: 'hour' as const, basis: 'x' };
    expect(ranked({ ...base, confidence: 'measured' }).value).toBeGreaterThan(ranked({ ...base, confidence: 'modelled' }).value);
    expect(ranked({ ...base, confidence: 'modelled' }).value).toBeGreaterThan(ranked({ ...base, confidence: 'rule' }).value);
    expect(ranked({ impact: 6, confidence: 'measured', effort: 'minutes', basis: 'x' }).value).toBeGreaterThan(ranked({ impact: 6, confidence: 'measured', effort: 'weeks', basis: 'x' }).value);
  });

  it('refuses to invent a number when nothing was measured, and keeps the reason', () => {
    const s = scoreOf({ impact: null, confidence: 'rule', effort: 'session', basis: '', reason: 'the audit could not weigh it' });
    expect(s.ranked).toBe(false);
    if (s.ranked) throw new Error('unreachable');
    expect(s.reason).toBe('the audit could not weigh it');
    expect(s.effortLabel).toBe(EFFORT_BANDS.session.label);
    expect(scoreNote(s)).toBe('Not ranked: the audit could not weigh it.');
    // and it never acquires a value by accident
    expect((s as unknown as { value?: number }).value).toBeUndefined();
  });

  it('gives an unranked item a reason even when the caller forgot one', () => {
    const s = scoreOf({ impact: null, confidence: 'rule', effort: 'hour', basis: '' });
    expect(s.ranked).toBe(false);
    if (!s.ranked) expect(s.reason.length).toBeGreaterThan(0);
  });

  it('clamps an impact outside 0-10 instead of trusting the caller', () => {
    expect(ranked({ impact: 99, confidence: 'rule', effort: 'minutes', basis: 'x' }).impact).toBe(10);
    expect(ranked({ impact: -3, confidence: 'rule', effort: 'minutes', basis: 'x' }).impact).toBe(0);
  });

  it("names the quantity, the confidence class and the work in the note a customer reads", () => {
    const note = scoreNote(ranked({ impact: 7, confidence: 'measured', effort: 'minutes', basis: '42 clicks a period already lost' }));
    expect(note).toContain('42 clicks a period already lost');
    expect(note).toContain('80% confidence');
    expect(note).toContain(EFFORT_BANDS.minutes.label);
  });
});

describe('the rule table', () => {
  it('answers for a family by id prefix, longest match first', () => {
    expect(ruleScoreFor('bl:followup')?.basis).toBe(RULE_SCORES['bl:followup'].basis);
    expect(ruleScoreFor('links:listing:Capterra')?.basis).toBe(RULE_SCORES['links:listing'].basis);
    expect(ruleScoreFor('content:publish:erp software uae')?.impact).toBe(RULE_SCORES['content:publish'].impact);
  });

  it('does not answer for an id in no family, so the caller must say "not ranked"', () => {
    expect(ruleScoreFor('something:new')).toBeUndefined();
    // a prefix must be a whole segment: 'setup:gsc-export' is not 'setup:gsc'
    expect(ruleScoreFor('setup:gscexport')).toBeUndefined();
  });

  it('marks every rule it uses as a rule, never as measured', () => {
    for (const id of Object.keys(RULE_SCORES)) expect(ruleScoreFor(id)?.confidence).toBe('rule');
  });

  it('carries the blocking flag only for the setup steps that gate measurement', () => {
    const blocking = Object.entries(RULE_SCORES).filter(([, r]) => r.blocking).map(([k]) => k);
    expect(blocking.sort()).toEqual(['setup:delivery', 'setup:ga4', 'setup:gsc', 'setup:tracking']);
  });

  it('gives every entry a non-empty basis and a known effort band', () => {
    for (const [id, r] of Object.entries(RULE_SCORES)) {
      expect(r.basis.length, id).toBeGreaterThan(10);
      expect(EFFORT_BANDS[r.effort], id).toBeDefined();
      expect(r.impact, id).toBeGreaterThanOrEqual(0);
      expect(r.impact, id).toBeLessThanOrEqual(10);
    }
  });
});

describe('the queue order', () => {
  const item = (id: string, score?: RecommendationScore) => ({ id, score });

  it('puts the blocking band first, whatever it is worth', () => {
    const blocker = item('setup:gsc', scoreOf({ impact: 1, confidence: 'rule', effort: 'weeks', basis: 'x', blocking: true }));
    const big = item('search:striking:a', scoreOf({ impact: 10, confidence: 'measured', effort: 'minutes', basis: 'x' }));
    expect(queueOrder([big, blocker]).map((i) => i.id)).toEqual(['setup:gsc', 'search:striking:a']);
  });

  it('orders the ranked band by value, not by category or priority', () => {
    const a = item('tech:a', scoreOf({ impact: 4, confidence: 'measured', effort: 'session', basis: 'x' }));
    const b = item('search:b', scoreOf({ impact: 9, confidence: 'measured', effort: 'hour', basis: 'x' }));
    expect(queueOrder([a, b]).map((i) => i.id)).toEqual(['search:b', 'tech:a']);
  });

  it('drops the unranked ones to the bottom instead of guessing where they belong', () => {
    const ranked1 = item('a', scoreOf({ impact: 0.1, confidence: 'rule', effort: 'weeks', basis: 'x' }));
    const none = item('b', scoreOf({ impact: null, confidence: 'rule', effort: 'minutes', basis: '', reason: 'no data' }));
    const noScore = item('c');
    expect(queueOrder([none, noScore, ranked1]).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('is stable: equal values keep a fixed order, so the list does not reshuffle between loads', () => {
    const mk = (id: string) => item(id, scoreOf({ impact: 5, confidence: 'measured', effort: 'hour', basis: 'x' }));
    expect(queueOrder([mk('z'), mk('a'), mk('m')]).map((i) => i.id)).toEqual(['a', 'm', 'z']);
    expect(queueOrder([mk('a'), mk('m'), mk('z')]).map((i) => i.id)).toEqual(['a', 'm', 'z']);
  });

  it('does not mutate what it was given', () => {
    const list = [item('b', scoreOf({ impact: 1, confidence: 'rule', effort: 'hour', basis: 'x' })), item('a', scoreOf({ impact: 9, confidence: 'rule', effort: 'hour', basis: 'x' }))];
    queueOrder(list);
    expect(list.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('bands an item with no score at all as unranked rather than throwing', () => {
    expect(bandOf(undefined)).toBe('unranked');
  });
});

describe('queueBands', () => {
  it('returns the bands in reading order with their note, and drops the empty ones', () => {
    const bands = queueBands([
      { id: 'setup:tracking', score: scoreOf({ impact: 8, confidence: 'rule', effort: 'minutes', basis: 'x', blocking: true }) },
      { id: 'search:a', score: scoreOf({ impact: 6, confidence: 'measured', effort: 'hour', basis: 'x' }) },
    ]);
    expect(bands.map((b) => b.band)).toEqual(['blocking', 'ranked']);
    expect(bands[0].note).toBe(BAND_NOTE.blocking);
    expect(bands.every((b) => b.items.length > 0)).toBe(true);
  });

  it('holds every item exactly once', () => {
    const items = [
      { id: 'a', score: scoreOf({ impact: 5, confidence: 'measured', effort: 'hour', basis: 'x' }) },
      { id: 'b', score: scoreOf({ impact: null, confidence: 'rule', effort: 'hour', basis: '', reason: 'no data' }) },
      { id: 'c', score: scoreOf({ impact: 2, confidence: 'rule', effort: 'minutes', basis: 'x', blocking: true }) },
      { id: 'd' },
    ];
    const flat = queueBands(items).flatMap((b) => b.items.map((i) => i.id));
    expect(flat.sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
