import { describe, expect, it, vi } from 'vitest';
import { COST_TABLE, estimateAiPanelCost } from '@seo/shared';

// A2 (2026-10-23, AI visibility app audit): an on-demand AI visibility run is quoted (and its credits checked) from the website's own
// panel, read on the server from its monitors row; a client cannot send a panel of its own.

const st = vi.hoisted(() => ({ monitors: [] as Record<string, unknown>[], fail: false }));
vi.mock('../src/n8n/client', () => ({
  siteRows: vi.fn(async (table: string) => {
    if (st.fail) throw new Error('n8n down');
    return table === 'monitors' ? st.monitors : [];
  }),
  insertRows: vi.fn(), invalidateSite: vi.fn(), startRun: vi.fn(), updateRows: vi.fn(),
}));
vi.mock('../src/services/engineCost', () => ({ engineCostTable: vi.fn(async () => ({ calibration: null })) }));

const { estimateCost } = await import('../src/services/runs');
const input = { mode: 'ai_visibility', siteId: 's', country: 'US', topics: [], competitors: [] } as never;
const site = { domain: 'techand.ai' };

describe('A2: the on-demand AI visibility quote', () => {
  it('a website whose monitors row says 100 questions is quoted at that panel\'s full run, not the 8-question figure', async () => {
    st.monitors = [{ site_id: 'site_techand-ai', domain: 'techand.ai', ai_prompts_max: 100, ai_engines: '' }];
    st.fail = false;
    const usd = await estimateCost(input, site);
    expect(usd).toBeCloseTo(estimateAiPanelCost({ panel: 100 }).run.full.usd, 4);
    expect(usd).toBeGreaterThan(COST_TABLE.ai_visibility.ai + COST_TABLE.ai_visibility.dfs);
  });
  it('no monitors row = the engine\'s default panel of 50; n8n unreadable = the table row', async () => {
    st.monitors = [];
    expect(await estimateCost(input, site)).toBeCloseTo(estimateAiPanelCost({ panel: 50 }).run.full.usd, 4);
    st.fail = true;
    expect(await estimateCost(input, site)).toBeCloseTo(COST_TABLE.ai_visibility.ai + COST_TABLE.ai_visibility.dfs, 4);
  });
  it('a panel sent by the client is ignored', async () => {
    st.fail = true;
    expect(await estimateCost({ ...(input as object), aiPanel: { panel: 3, engines: ['chatgpt'] } } as never, site)).toBeCloseTo(COST_TABLE.ai_visibility.ai + COST_TABLE.ai_visibility.dfs, 4);
  });
});
