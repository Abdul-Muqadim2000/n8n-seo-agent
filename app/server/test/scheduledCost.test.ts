import { describe, expect, it } from 'vitest';
import { callbackCostCountsForRun, isScheduledCallback } from '../src/services/runs';
import { ledgerCost } from '../src/services/summaries';

// D-3 (re-rating 2026-10-17): the Rank Tracker's weekly run (exec 785) cost $0.116 once, but posted one report per ladder, each with
// the whole run's ledger and the request id of the run that had planned that ladder. `ingestCallback` added every one of them to the
// matched app run: "Ladder: peppol uae" (2026-10-08, plan $0.1185) went to 0.1905 on 10-16 and 0.3065 on 10-17. The callbacks below
// are shaped as the real ones (build_ladder_extras.py "POST Progress"; Site_Metrics.js on_demand).

const rankReport = {
  status: 'progress',
  stage: 'rank_tracker',
  request_id: '219',
  ladder_id: 'lad_muz4gf79ifhk',
  domain: 'techand.ai',
  head_keyword: 'peppol uae',
  run_ledger: { dataforseo_usd: 0.116, dataforseo_source: 'account', cost_basis: 'DataForSEO $0.1160 measured' },
  cost_usd: 0.116,
};

describe("a schedule's spend is not the matched run's (D-3)", () => {
  it('the weekly rank check adds nothing to the run that planned the ladder', () => {
    expect(isScheduledCallback('rank_tracker', rankReport)).toBe(true);
    expect(callbackCostCountsForRun('rank_tracker', rankReport)).toBe(false);
    // before: every one of the nine per-ladder reports carried a cost the run took in
    expect(ledgerCost(rankReport)?.usd).toBeCloseTo(0.116, 4);
  });

  it('nine reports of one tracker run move the old run by $0, not 9 x $0.116', () => {
    let actual = 0.1185;
    for (let i = 0; i < 9; i++) if (callbackCostCountsForRun('rank_tracker', rankReport)) actual += ledgerCost(rankReport)?.usd ?? 0;
    expect(actual).toBeCloseTo(0.1185, 4);
  });

  it('a weekly report with on_demand: false never counts; the run’s own report does', () => {
    expect(callbackCostCountsForRun('site_tracker', { stage: 'site_tracker', on_demand: false, run_ledger: { dataforseo_usd: 0.031, ai_usd: 0.0491 } })).toBe(false);
    expect(callbackCostCountsForRun('site_tracker', { stage: 'site_tracker', on_demand: true, run_ledger: { dataforseo_usd: 0.031, ai_usd: 0.0491 } })).toBe(true);
    expect(callbackCostCountsForRun('ladder_plan', { stage: 'ladder_plan', run_ledger: { dataforseo_usd: 0.1615, ai_usd: 0.1478 } })).toBe(true);
    // the pages a ladder run writes report on the same request id and are that run's own spend
    expect(callbackCostCountsForRun('content', { stage: 'content', run_ledger: { dataforseo_usd: 0.0241, ai_usd: 0.9659 } })).toBe(true);
    expect(callbackCostCountsForRun('content_cadence', { stage: 'content_cadence' })).toBe(false);
  });
});
