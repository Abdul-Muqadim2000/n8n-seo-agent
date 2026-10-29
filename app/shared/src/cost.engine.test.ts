import { describe, expect, it } from 'vitest';
import { COST_TABLE, countedRunCost, estOf, estimateRunCost, ledgerBreakdown, parseCalibration, runCostEstimate } from './cost';

// R100 / R102 / R114 / R115 (fixer A13): the pre-run figure is what the engine reserves, a figure without the model calls is partial,
// and a report's ledger card says whose each figure is.

describe('R102 / R115: a figure without the model calls is partial', () => {
  it('is labelled search data only, never actual, and says what is missing', () => {
    const f = runCostEstimate({ mode: 'keyword', actualCostUsd: 0.0221, actualCostPartial: true });
    expect(f.source).toBe('partial');
    expect(f.estimated).toBe(true);
    expect(f.basis).toContain('did not report its model calls');
    expect(f.basis).not.toContain('and the model calls it made');
  });
  it('shows the engine\'s whole-run estimate instead when it is higher than the partial figure', () => {
    const f = runCostEstimate({ mode: 'keyword', actualCostUsd: 0.0221, actualCostPartial: true, engineCostEstimateUsd: 0.84 });
    expect(f.source).toBe('engine');
    expect(f.usd).toBe(0.84);
    expect(f.basis).toContain('search-data costs only');
  });
  it('a complete actual is still actual', () => {
    expect(runCostEstimate({ mode: 'keyword', actualCostUsd: 0.5, actualCostPartial: false }).source).toBe('measured');
  });
  it('counts for the budget at no less than the best whole-run estimate', () => {
    expect(countedRunCost({ actual: 0.0221, partial: true, engine: null, own: 0.84 })).toBe(0.84);
    expect(countedRunCost({ actual: 0.0221, partial: true, engine: 1.4, own: 0.84 })).toBe(1.4);
    expect(countedRunCost({ actual: 0.5, partial: false, engine: 1.4, own: 0.84 })).toBe(0.5);
    expect(countedRunCost({ actual: null, partial: false, engine: null, own: 0.84 })).toBe(0.84);
  });
});

describe('R100: the pre-run figure is what the engine reserves (the seo_cache rows of 2026-10-15)', () => {
  const rows = [
    { key: 'cost:ai:content', value: JSON.stringify({ n: 2, mean: 1.0983, max: 1.1862, recent: [1.1862, 0.8933] }) },
    { key: 'cost:dfs:content', value: JSON.stringify({ n: 2, mean: 0.0241, max: 0.0301, recent: [0.0301, 0.0221] }) },
    { key: 'cost:dfs:crawl', value: JSON.stringify({ n: 1, mean: 0.09, max: 0.09, recent: [0.09] }) },
    { key: 'cost:model:opus', value: JSON.stringify({ month: '2026-10', usd: 4 }) },
    { key: 'cost:factor:claude', value: '{"opus":1.1}' },
    { key: 'cost:ai:not_a_mode', value: '{"n":1,"mean":9}' },
    { key: 'cost:ai:verdict', value: 'not json' },
  ];
  const cal = parseCalibration(rows);
  it('reads only cost:ai / cost:dfs rows of known keys and survives garbage', () => {
    expect(Object.keys(cal.ai)).toEqual(['content']);
    expect(Object.keys(cal.dfs).sort()).toEqual(['content', 'crawl']);
  });
  it('a written page: the engine reserves 1.0983 x 1.25 + 0.0301 = 1.4030, and since D8 (2026-10-29) it is quoted no lower than its measured $1.90', () => {
    expect(estOf('ai', 'content', cal).usd).toBeCloseTo(1.86, 4);   // the rolling 1.3729 is under the measured floor
    expect(estimateRunCost('keyword', {}, cal)).toBe(1.9);
    expect(estimateRunCost('keyword', {})).toBe(1.9);
    // a key with no floor still follows the engine's rolling figure (the verdict below, the crawl beside it)
    expect(estOf('dfs', 'crawl', cal).usd).toBeCloseTo(0.1125, 4);
  });
  it('a technical audit is the crawl at 0.09 x 1.25 = 0.1125', () => {
    expect(Math.abs(estimateRunCost('audit', { reportType: 'technical' }, cal) - 0.1125)).toBeLessThan(0.0001);
  });
  it('never reserves below what the key recently cost, and never rolls above five times the default', () => {
    const high = parseCalibration([{ key: 'cost:dfs:verdict', value: JSON.stringify({ n: 3, mean: 5, max: 5, recent: [5] }) }]);
    expect(estOf('dfs', 'verdict', high).usd).toBe(5); // the floor is absolute
    const run = parseCalibration([{ key: 'cost:ai:verdict', value: JSON.stringify({ n: 3, mean: 5, max: 0.2, recent: [0.2] }) }]);
    expect(estOf('ai', 'verdict', run).usd).toBeCloseTo(0.8, 4); // 5 x 1.25 capped at 5 x 0.16
  });
  it('without rows it is the shipped table, and a key with no history keeps its default', () => {
    expect(estimateRunCost('keyword', {}, { ai: {}, dfs: {} })).toBe(estimateRunCost('keyword', {}));
    expect(estOf('ai', 'report', cal)).toEqual({ usd: COST_TABLE.report.ai, calibrated: false });
  });
});

describe('R114: the report ledger says search data and model calls, and whose each figure is', () => {
  it('a page run: Claude line, total and "estimated"', () => {
    const b = ledgerBreakdown({ dataforseo_usd: 0.0241, ai_usd: 0.8933, ai_cost_estimated: true });
    expect(b.model).toMatchObject({ usd: 0.8933, state: 'estimated' });
    expect(b.data.state).toBe('measured');
    expect(b.total).toBeCloseTo(0.9174, 4);
    expect(b.partial).toBe(false);
  });
  it('a crawl estimate makes the search-data line partly estimated', () => {
    expect(ledgerBreakdown({ dataforseo_usd: 0.026, dataforseo_estimated_usd: 0.0211, ai_usd: 0 }).data.state).toBe('partly estimated');
  });
  it('measured and estimated model parts are both named', () => {
    const b = ledgerBreakdown({ dataforseo_usd: 0.1, ai_usd: 0.5, ai_cost_estimated: true, ai_cost: { usd: 0.5, measured_usd: 0.2, estimated_usd: 0.3, estimated: true } });
    expect(b.model.state).toBe('partly estimated');
    expect(b.model.note).toContain('$0.2000 measured');
  });
  it('ai_usd: 0 is a measured $0; a missing ai_usd is "not reported" and the total is partial', () => {
    expect(ledgerBreakdown({ dataforseo_usd: 0.09, ai_usd: 0 }).model).toMatchObject({ usd: 0, state: 'measured' });
    const b = ledgerBreakdown({ dataforseo_usd: 0.7794 });
    expect(b.model).toMatchObject({ usd: null, state: 'not reported' });
    expect(b.partial).toBe(true);
  });
  it('a monitor report with only cost_usd still shows its search-data figure, as partial', () => {
    const b = ledgerBreakdown(undefined, 0.3725);
    expect(b.data.usd).toBe(0.3725);
    expect(b.partial).toBe(true);
  });
});
