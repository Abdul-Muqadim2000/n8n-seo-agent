import { describe, expect, it } from 'vitest';
import { GUIDES } from './guides';
import { clientTextIssues } from './client-copy';
import { scoreOf, priorityFromScore, ruleScoreFor } from './queue';
import { DISMISS_DAYS, DISMISS_REASONS, REC_RULES, foldByIssue, issueKeyOf, nextRecState, recRuleFor, recRuleView, withRule, type RecVerdict, type RecommendationState } from './recommendation-rules';
import type { Recommendation } from './data';

// CR17-H (client report 2026-11-17, Q4): "Recommendations are not understandable or answerable; they are High but never confirmed resolved".

const rec = (id: string, over: Partial<Recommendation> = {}): Recommendation => ({ id, category: 'technical', priority: 'medium', title: 't', detail: 'd', ...over });

describe('the registry: every family says why, how and how we check it', () => {
  const guideIds = new Set(GUIDES.map((g) => g.id));
  it.each(REC_RULES.map((r) => [r.prefix, r]))('%s', (_p, r) => {
    expect(r.why.length, 'why').toBeGreaterThan(10);
    expect(r.how.text.length, 'how').toBeGreaterThan(5);
    expect(r.source.length, 'source').toBeGreaterThan(2);
    if (r.kpi) {
      // a measure is not a task: nothing checks it, it never enters the to-do list
      expect(r.check).toBeNull();
    } else {
      expect(r.check, 'check').not.toBeNull();
      expect(r.check!.text.length).toBeGreaterThan(10);
      expect(r.check!.when.length).toBeGreaterThan(3);
      expect(r.how.guide, 'a guide for how to do it').toBeTruthy();
    }
    if (r.how.guide) expect(guideIds.has(r.how.guide), `guide ${r.how.guide} exists`).toBe(true);
    // the copy rules hold in every client sentence of the registry
    for (const t of [r.why, r.how.text, r.check?.text ?? '', r.check?.when ?? '', r.absentMeansDone ?? '']) expect(clientTextIssues(t), t).toEqual([]);
  });
  it('prefixes are unique, and the longest one wins', () => {
    expect(new Set(REC_RULES.map((r) => r.prefix)).size).toBe(REC_RULES.length);
    expect(recRuleFor('engine:site_tracker:index:erp')?.prefix).toBe('engine:site_tracker:index');
    expect(recRuleFor('engine:site_tracker:striking:erp')?.prefix).toBe('engine:site_tracker');
    expect(recRuleFor('ix:site_fix:sitemap_dates')?.prefix).toBe('ix:site_fix');
    expect(recRuleFor('tech:score-drop')?.prefix).toBe('tech:score-drop');
    expect(recRuleFor('nothing:here')).toBeUndefined();
  });
  it('a card shows its rule', () => {
    expect(recRuleView('content:publish:erp')).toMatchObject({ guide: 'publish-page', canCheckNow: false });
    expect(recRuleView('ai:indexnow')).toMatchObject({ guide: 'indexnow-key-file', canCheckNow: true });
  });
  it('dismiss reasons are plain and unique', () => {
    expect(new Set(DISMISS_REASONS.map((r) => r.id)).size).toBe(DISMISS_REASONS.length);
    for (const r of DISMISS_REASONS) expect(clientTextIssues(r.label)).toEqual([]);
  });
});

describe('the badge comes from the queue score', () => {
  const s = (impact: number, confidence: 'measured' | 'modelled' | 'rule', effort: 'minutes' | 'hour' | 'session' = 'session') => scoreOf({ impact, confidence, effort, basis: 'b' });
  it('measured and modelled values set High / Medium / Low', () => {
    expect(priorityFromScore(s(9.6, 'measured'), { checked: true })).toBe('high'); // 2.6
    expect(priorityFromScore(s(3.4, 'measured'), { checked: true })).toBe('medium'); // 0.9
    expect(priorityFromScore(s(2, 'modelled'), { checked: true })).toBe('low'); // 0.3
  });
  it('a rule-only item is at most Medium, unless its family is urgent and its source said so', () => {
    expect(priorityFromScore(s(7, 'rule', 'minutes'), { checked: true })).toBe('medium'); // 1.75
    expect(priorityFromScore(s(7, 'rule', 'minutes'), { checked: true, urgent: true })).toBe('high');
  });
  it('nothing checks it: at most Low; blocking setup: High; not ranked: Medium', () => {
    expect(priorityFromScore(s(9.6, 'measured'), { checked: false })).toBe('low');
    expect(priorityFromScore(scoreOf({ ...ruleScoreFor('setup:gsc')! }), { checked: true })).toBe('high');
    expect(priorityFromScore(scoreOf({ impact: null, confidence: 'rule', effort: 'session', basis: '', reason: 'r' }), { checked: true })).toBe('medium');
  });
  it('withRule: devaicon\'s list of 2026-11-17 has no High left from a source\'s own number', () => {
    // the rank tracker's next step (engine priority 1, rule impact 5): High before, Medium now
    const rank = withRule(rec('engine:rank_tracker:next_rung:ai app development', { priority: 'high', score: scoreOf({ impact: 5, confidence: 'rule', effort: 'session', basis: 'b' }) }))!;
    expect(rank.priority).toBe('medium');
    // a written page waiting to be published stays High (an urgent family, its source said so)
    const pub = withRule(rec('content:publish:erp', { priority: 'high', score: scoreOf({ ...ruleScoreFor('content:publish:erp')! }) }))!;
    expect(pub.priority).toBe('high');
    // the source can lower, never raise: an item the autopilot has scheduled stays Low
    expect(withRule(rec('auto:audit', { priority: 'low', score: scoreOf({ impact: null, confidence: 'rule', effort: 'minutes', basis: '', reason: 'r' }) }))!.priority).toBe('low');
    // a KPI leaves the list
    expect(withRule(rec('ai:low', { priority: 'high' }))).toBeNull();
    expect(withRule(rec('bl:spam', { priority: 'low' }))).toBeNull();
  });
});

describe('one card per issue', () => {
  it('issue keys: a page, a question, a link, a search', () => {
    expect(issueKeyOf(rec('engine:site_tracker:index:ai development companies', { action: { label: 'Open', href: 'https://www.devaicon.com/services/ai-development-companies/' } }))).toBe('page:devaicon.com/services/ai-development-companies');
    expect(issueKeyOf(rec('engine:ai_visibility:answer_page:Best CRM UAE'))).toBe('aiq:best crm uae');
    expect(issueKeyOf(rec('bl:lost:www.bebee.com'))).toBe('link:bebee.com');
    expect(issueKeyOf(rec('search:striking:erp dubai'))).toBe('kw:erp dubai');
    expect(issueKeyOf(rec('content:trend:ERP Dubai'))).toBe('kw:erp dubai');
    expect(issueKeyOf(rec('search:ctr:erp dubai'))).toBe('search:ctr:erp dubai');
    expect(issueKeyOf(rec('setup:gsc'))).toBe('setup:gsc');
  });
  it('the first of an issue stays, the others become "also reported by"', () => {
    const out = foldByIssue([rec('search:striking:erp dubai'), rec('setup:gsc'), rec('content:trend:erp dubai'), rec('engine:site_tracker:striking:erp dubai')]);
    expect(out.map((r) => r.id)).toEqual(['search:striking:erp dubai', 'setup:gsc']);
    expect(out[0].alsoFrom).toEqual(['Google Trends', 'the weekly site report']);
  });
});

describe('the state machine (Search Console "Validate fix" shape)', () => {
  const now = '2026-11-20T10:00:00.000Z';
  const v = (outcome: RecVerdict['outcome'], evidence = '', at?: string): RecVerdict => ({ outcome, evidence, at });
  const row = (state: RecommendationState, stateAt = '2026-11-10T00:00:00.000Z', evidence = '') => ({ state, stateAt, evidence });
  it('a new item is open; present and checked: in progress, waiting for Google, failed', () => {
    expect(nextRecState(null, { present: true, verdict: v('unknown'), now })).toEqual({ state: 'open', stateAt: now, evidence: '' });
    expect(nextRecState(row('open'), { present: true, verdict: v('in_progress', 'being written'), now }).state).toBe('in_progress');
    expect(nextRecState(row('open'), { present: true, verdict: v('waiting', 'fixed, Google has not read it'), now }).state).toBe('waiting_for_google');
    expect(nextRecState(row('open'), { present: true, verdict: v('failed', 'still there'), now })).toMatchObject({ state: 'failed', evidence: 'still there' });
  });
  it('gone from its source: resolved only on a check\'s word, with its date; otherwise expired, never resolved', () => {
    expect(nextRecState(row('open'), { present: false, verdict: v('resolved', '/about is in Google since 2026-11-18', '2026-11-18T06:00:00.000Z'), now })).toEqual({ state: 'resolved', stateAt: '2026-11-18T06:00:00.000Z', evidence: '/about is in Google since 2026-11-18' });
    expect(nextRecState(row('open'), { present: false, verdict: v('unknown'), now }).state).toBe('expired');
    expect(nextRecState(row('waiting_for_google'), { present: false, verdict: v('unknown'), now }).state).toBe('waiting_for_google');
  });
  it('a resolved item reported again is open again, and says it came back', () => {
    expect(nextRecState(row('resolved'), { present: true, verdict: v('unknown'), now })).toEqual({ state: 'open', stateAt: now, evidence: 'It came back on 2026-11-20.' });
  });
  it('a dismissed item stays dismissed, and comes back after DISMISS_DAYS if it is still reported', () => {
    expect(nextRecState(row('dismissed', '2026-11-01T00:00:00.000Z', 'Dismissed: Not relevant'), { present: true, verdict: v('unknown'), now }).state).toBe('dismissed');
    const old = new Date(Date.parse(now) - (DISMISS_DAYS + 1) * 864e5).toISOString();
    expect(nextRecState(row('dismissed', old), { present: true, verdict: v('unknown'), now }).state).toBe('open');
    expect(nextRecState(row('dismissed', old), { present: false, verdict: v('unknown'), now }).state).toBe('dismissed');
  });
  it('a step skipped on the website is dismissed', () => {
    expect(nextRecState(row('open'), { present: false, verdict: v('dismissed', 'Skipped on your website steps.'), now }).state).toBe('dismissed');
  });
  it('an unchanged state keeps its date (a read is not an event)', () => {
    expect(nextRecState(row('open', '2026-11-10T00:00:00.000Z'), { present: true, verdict: v('unknown'), now }).stateAt).toBe('2026-11-10T00:00:00.000Z');
  });
});
