import { describe, expect, it } from 'vitest';
import { MODE_IDS, MODES, MONITOR_COSTS } from './constants';
import { APP_ESTIMATE_BASIS, COST_TABLE, costKeys, estimateRunCost, estimateRunCostParts, keyCost, modeCostUsd, runCostEstimate, type CostKey, HOLD_CHECK_USD } from './cost';

describe('one table, not two', () => {
  it('every mode\'s listed price is the table\'s price', () => {
    for (const id of MODE_IDS) expect(MODES[id].costUsd).toBe(estimateRunCost(id, {}));
  });

  it('the monitor estimates price a run through the same table', () => {
    expect(MONITOR_COSTS.blogPostEach).toBe(modeCostUsd('keyword'));
    expect(MONITOR_COSTS.auditMonthly).toBe(modeCostUsd('audit'));
  });

  it('a key\'s price is its Claude money plus its search-data money', () => {
    for (const [key, row] of Object.entries(COST_TABLE)) expect(keyCost(key as CostKey)).toBeCloseTo(row.ai + row.dfs, 6);
  });

  it('no key is priced below what it was measured at', () => {
    // the engine's own rule: a shipped default always sits above the measured figure beside it, never under it
    for (const [key, row] of Object.entries(COST_TABLE)) expect(keyCost(key as CostKey)).toBeGreaterThanOrEqual(row.measured);
  });

  it('every row says where its measurement came from', () => {
    for (const row of Object.values(COST_TABLE)) expect(row.basis.length).toBeGreaterThan(10);
  });
});

describe('the figures are the engine\'s calibrated ones, not the 2026-10-02 table', () => {
  // the old table against the measurements in BENCHMARKS_2026-10-14.md area 13 §3.1
  it('a one-page keyword ladder is the plan plus one written page at its measured cost (D8, 2026-10-29)', () => {
    const now = estimateRunCost('ladder', { pagesNow: 1 });
    expect(now).toBeCloseTo(keyCost('ladder') + 1.9, 4);
    expect(now).toBeGreaterThan(0.726);   // and not below what that run actually cost
  });

  it('a technical audit is the crawl, and the full report is the full report', () => {
    expect(estimateRunCost('audit', { reportType: 'technical' })).toBe(keyCost('site_audit') + keyCost('crawl'));
    expect(estimateRunCost('audit', { reportType: 'full' })).toBe(keyCost('full'));
    expect(estimateRunCost('audit', { reportType: 'full' })).toBeLessThan(0.9);
  });

  it('D8 (owner, 2026-10-29): a written page is quoted at its measured cost, $1.90 (about 114 credits); a keyword report stays under the old $0.40', () => {
    expect(estimateRunCost('keyword', {})).toBe(1.9);
    expect(COST_TABLE.content.measured).toBe(1.9);
    expect(estimateRunCost('keyword', { receiveContent: false })).toBeLessThan(0.4);
  });

  it('D8: a page held for the client\'s OK uses only the check, about 9 credits at the list rate (60 a dollar)', () => {
    expect(HOLD_CHECK_USD).toBe(0.15);
    expect(Math.ceil(HOLD_CHECK_USD * 60)).toBe(9);
    expect(Math.ceil(estimateRunCost('keyword', {}) * 60)).toBe(114);
  });

  it('a free backlink check reserves nothing', () => {
    expect(estimateRunCost('backlinks', { freeOnly: true })).toBe(0);
    expect(costKeys('backlinks', { freeOnly: true })).toEqual([]);
  });

  it('setting tracking up reserves nothing: the site report it starts is the first weekly report, autopilot spend', () => {
    expect(estimateRunCost('track', {})).toBe(0);
  });

  it('a ladder reserves the plan and one content run per page asked for now', () => {
    expect(costKeys('ladder', { pagesNow: 3 })).toEqual(['ladder', 'content', 'content', 'content']);
    // KW-APP D8 (2026-10-21): a Manual ladder writes nothing at start, so its quote is the plan alone (it was quoted 99, charged 23.73)
    expect(costKeys('ladder', { pagesNow: 3, ladderMode: 'manual' })).toEqual(['ladder']);
    expect(costKeys('ladder', { pagesNow: 2, pagesHeld: 'manual' })).toEqual(['ladder']);
    expect(costKeys('ladder', { pagesNow: 2, ladderMode: 'auto' })).toEqual(['ladder', 'content', 'content']);
    expect(estimateRunCost('ladder', { pagesNow: 3 })).toBeGreaterThan(estimateRunCost('ladder', { pagesNow: 1 }));
  });

  it('discovery reserves the follow-ups it starts', () => {
    expect(costKeys('discover', { receiveReport: false })).toEqual(['discover']);
    expect(costKeys('discover', {})).toEqual(['discover', 'report']);
    expect(costKeys('discover', { receiveContent: true, fullReport: true })).toEqual(['discover', 'report', 'content', 'full']);
  });

  it('a case study reserves the page it writes, not the intake', () => {
    expect(costKeys('case_study', {})).toEqual(['case_study', 'content']);
    expect(estimateRunCost('case_study', {})).toBe(estimateRunCost('keyword', {}));
  });

  it('splits a request into Claude money and search-data money', () => {
    const parts = estimateRunCostParts('audit', { reportType: 'full' });
    expect(parts.ai).toBe(COST_TABLE.full.ai);
    expect(parts.dfs).toBe(COST_TABLE.full.dfs);
    expect(parts.usd).toBeCloseTo(parts.ai + parts.dfs, 6);
  });
});

describe('the app defers to the engine\'s figure the moment it arrives', () => {
  const base = { mode: 'keyword' as const, estimatedCostUsd: 0.84 };

  it('uses our own table before the engine has said anything, and labels it an estimate', () => {
    const f = runCostEstimate(base);
    expect(f.source).toBe('app');
    expect(f.usd).toBe(0.84);
    expect(f.estimated).toBe(true);
    expect(f.basis).toBe(APP_ESTIMATE_BASIS);
  });

  it('prefers the engine\'s calibrated figure over ours', () => {
    const f = runCostEstimate({ ...base, engineCostEstimateUsd: 0.62, engineCostBasis: 'Claude $0.58 (calibrated); search data $0.04 (calibrated)' });
    expect(f.source).toBe('engine');
    expect(f.usd).toBe(0.62);
    expect(f.estimated).toBe(true);
    expect(f.basis).toContain('calibrated');
  });

  it('prefers what the run actually cost over every estimate', () => {
    const f = runCostEstimate({ ...base, engineCostEstimateUsd: 0.62, actualCostUsd: 0.4312 });
    expect(f.source).toBe('measured');
    expect(f.usd).toBe(0.4312);
    expect(f.estimated).toBe(false);
  });

  it('says so when part of the settled figure is itself an estimate', () => {
    const f = runCostEstimate({ ...base, actualCostUsd: 0.4312, actualCostEstimated: true });
    expect(f.source).toBe('measured');
    expect(f.estimated).toBe(true);
    expect(f.basis).toContain('estimate');
  });

  it('falls back to the table when no figure was stored at all', () => {
    expect(runCostEstimate({ mode: 'describe' }).usd).toBe(modeCostUsd('describe'));
  });

  it('treats a zero engine figure as an answer, not as silence', () => {
    const f = runCostEstimate({ mode: 'backlinks', estimatedCostUsd: 0.56, engineCostEstimateUsd: 0 });
    expect(f.source).toBe('engine');
    expect(f.usd).toBe(0);
  });

  it('ignores a figure that is not a number', () => {
    const f = runCostEstimate({ ...base, engineCostEstimateUsd: Number.NaN, actualCostUsd: null });
    expect(f.source).toBe('app');
  });
});
