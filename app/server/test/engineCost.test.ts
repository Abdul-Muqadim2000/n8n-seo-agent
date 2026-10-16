import { afterEach, describe, expect, it, vi } from 'vitest';
import { estimateRunCost } from '@seo/shared';

// R100: the app reads the engine's own `cost:*` rows, applies the engine's formula, and falls back — labelled — to the shipped table.
const rowsMock = vi.fn();
vi.mock('../src/n8n/client', () => ({ rows: (...a: unknown[]) => rowsMock(...a) }));

import { engineCostTable, resetEngineCostTable } from '../src/services/engineCost';

afterEach(() => {
  resetEngineCostTable();
  rowsMock.mockReset();
});

describe('engineCostTable', () => {
  it('reads the engine’s rows and prices a page at the engine’s reservation', async () => {
    rowsMock.mockResolvedValue([
      { key: 'cost:ai:content', value: JSON.stringify({ n: 2, mean: 1.0983, max: 1.1862, recent: [1.1862, 0.8933] }) },
      { key: 'cost:dfs:content', value: JSON.stringify({ n: 2, mean: 0.0241, max: 0.0301, recent: [0.0301, 0.0221] }) },
    ]);
    const info = await engineCostTable();
    expect(info.source).toBe('engine');
    expect(info.asOf).not.toBeNull();
    expect(Math.abs(estimateRunCost('keyword', {}, info.calibration) - 1.403)).toBeLessThan(0.0001);
    expect(rowsMock.mock.calls[0][0]).toBe('cache');
    expect(rowsMock.mock.calls[0][1].filters).toEqual([{ columnName: 'kind', condition: 'eq', value: 'cost' }]);
  });

  it('caches the reading (one read for two requests)', async () => {
    rowsMock.mockResolvedValue([]);
    await engineCostTable();
    await engineCostTable();
    expect(rowsMock).toHaveBeenCalledTimes(1);
  });

  it('says it is the shipped table when n8n cannot be read and there was never a reading', async () => {
    rowsMock.mockRejectedValue(new Error('n8n is not reachable'));
    const info = await engineCostTable();
    expect(info.source).toBe('table');
    expect(info.asOf).toBeNull();
    expect(info.basis).toContain('could not be read');
    expect(estimateRunCost('keyword', {}, info.calibration)).toBe(estimateRunCost('keyword', {}));
  });

  it('keeps the last good reading, labelled, when a later read fails', async () => {
    rowsMock.mockResolvedValueOnce([{ key: 'cost:dfs:crawl', value: JSON.stringify({ n: 1, mean: 0.09, max: 0.09, recent: [0.09] }) }]);
    const first = await engineCostTable();
    rowsMock.mockRejectedValue(new Error('timed out'));
    const second = await engineCostTable({ fresh: true });
    expect(second.calibration).toEqual(first.calibration);
    expect(second.basis).toContain('could not be re-read');
  });
});
