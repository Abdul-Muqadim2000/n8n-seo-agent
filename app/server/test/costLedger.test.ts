import { describe, expect, it } from 'vitest';
import { ledgerCost } from '../src/services/summaries';

// R102 / R115: a ledger without model calls is partial, never the run's whole cost.
describe('ledgerCost: partial figures', () => {
  it('a bare cost_usd (old monitor callbacks, the legacy rows) is partial', () => {
    expect(ledgerCost({ cost_usd: 0.7794 })).toMatchObject({ usd: 0.7794, partial: true });
  });
  it('a ledger with search data and no ai_usd is partial', () => {
    expect(ledgerCost({ run_ledger: { dataforseo_usd: 0.0221, ai_usd: null } })).toMatchObject({ usd: 0.0221, partial: true });
    expect(ledgerCost({ run_ledger: { dataforseo_usd: 0.1185 } })?.partial).toBe(true);
  });
  it('ai_usd: 0 is a real $0 (a technical audit calls no model) and is not flagged', () => {
    expect(ledgerCost({ run_ledger: { dataforseo_usd: 0.09, ai_usd: 0 } })).toMatchObject({ usd: 0.09, partial: false });
  });
  it('a complete monitor ledger is the sum and not partial; cost_usd beside it is the same money, not an addend', () => {
    const c = ledgerCost({ cost_usd: 0.78, run_ledger: { dataforseo_usd: 0.78, ai_usd: 0.0678, ai_cost: { usd: 0.0678, measured_usd: 0.0678, estimated_usd: 0, estimated: false }, settled: true } });
    expect(c?.partial).toBe(false);
    expect(c?.usd).toBeCloseTo(0.8478, 4);
  });
});
