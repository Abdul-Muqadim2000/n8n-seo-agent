import { describe, expect, it, vi } from 'vitest';
import type { SitePageRow } from '@seo/shared';
import { sitePageInventory } from '../src/services/pipeline';

// The n8n Data Table `seo_pages` is keyed by `site_id` and has no `domain` column: n8n answers a filter on an unknown column with an
// error. The mock behaves the same way, so a read filtered by `domain` (the 2026-10-17 bug) fails here as it failed live.
const inventory = [
  { site_id: 'site_techand-ai', url: 'https://www.techand.ai/ai-consulting', title: 'AI Consulting', h1: 'AI Consulting', source: 'sitemap' },
] as SitePageRow[];
let fail = false;
const calls: { table: string; filters: { columnName: string; value: unknown }[] }[] = [];
vi.mock('../src/n8n/client', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    rows: vi.fn(async (table: string, q: { filters?: { columnName: string; condition: string; value: unknown }[] }) => {
      calls.push({ table, filters: q.filters ?? [] });
      if (fail) throw new Error('n8n is not reachable');
      if (table !== 'pages') return [];
      const f = q.filters ?? [];
      if (f.some((x) => x.columnName === 'domain')) throw new Error('n8n /data-tables/x/rows answered 400: unknown column "domain"');
      return f.some((x) => x.columnName === 'site_id' && x.value === 'site_techand-ai') ? inventory : [];
    }),
  };
});

describe('pipeline: the page inventory (seo_pages)', () => {
  it('reads by site_id, not domain, and returns the live pages', async () => {
    const warn = vi.fn();
    const out = await sitePageInventory('techand.ai', warn);
    expect(out.map((p) => p.url)).toEqual(['https://www.techand.ai/ai-consulting']);
    expect(calls.at(-1)).toMatchObject({ table: 'pages', filters: [{ columnName: 'site_id', value: 'site_techand-ai' }] });
    expect(warn).not.toHaveBeenCalled();
  });

  it('an unreadable inventory degrades to [] and is logged, not swallowed', async () => {
    const warn = vi.fn();
    fail = true;
    try {
      expect(await sitePageInventory('techand.ai', warn)).toEqual([]);
    } finally {
      fail = false;
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatchObject({ site: 'techand.ai', table: 'seo_pages' });
    expect(String(warn.mock.calls[0]![1])).toMatch(/page inventory not read/);
  });
});
