import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COST_TABLE, CRAWL_BASE_PAGES, CRAWL_JS_MULT, crawlFactor, estimateRunCost, estimateRunCostParts } from './cost';

// B-9 (re-rating 2026-10-17): exec 739 asked for a JavaScript crawl of up to 200 pages (DataForSEO quoted $0.36, 4x the plain crawl)
// and the pre-run figure was $0.11, the crawl row was one plain 200-page crawl whatever the form said.
describe('B-9, the audit estimate follows the pages and JavaScript the form asks for', () => {
  it('a 200-page plain crawl is the table row, unchanged', () => {
    expect(crawlFactor(200, false)).toBe(1);
    expect(estimateRunCost('audit', { crawlPages: 200, crawlJs: false })).toBe(estimateRunCost('audit', {}));
  });
  it('a JavaScript crawl of 200 pages costs 4x the crawl (exec 739: $0.36, not $0.09)', () => {
    const p = estimateRunCostParts('audit', { crawlPages: 200, crawlJs: true });
    expect(p.dfs).toBeCloseTo(COST_TABLE.crawl.dfs * 4, 4);
    expect(p.dfs).toBeCloseTo(0.36, 4);
  });
  it('a 1,000-page plain crawl is five times the crawl; a full report scales only its crawl part', () => {
    expect(estimateRunCostParts('audit', { crawlPages: 1000 }).dfs).toBeCloseTo(0.45, 4);
    const full = estimateRunCostParts('audit', { reportType: 'full', crawlPages: 400, crawlJs: true }).dfs;
    expect(full).toBeCloseTo(COST_TABLE.full.dfs + COST_TABLE.crawl.dfs * (8 - 1), 4);
  });
  it('no other mode moves', () => {
    expect(estimateRunCost('keyword', { crawlPages: 1000, crawlJs: true })).toBe(estimateRunCost('keyword', {}));
  });
  const KIT = join(__dirname, '../../../n8n/seo-agent/v5/code/_cost_cal.js');
  it.skipIf(!existsSync(KIT))('uses the engine\'s own constants and crawl price (CC.crawlFactor, DFS_EST.crawl)', () => {
    const src = readFileSync(KIT, 'utf8');
    const m = src.match(/const CRAWL_BASE_PAGES = (\d+), CRAWL_JS_MULT = (\d+);/);
    expect(m).not.toBeNull();
    expect([Number(m![1]), Number(m![2])]).toEqual([CRAWL_BASE_PAGES, CRAWL_JS_MULT]);
    const crawl = src.match(/\n\s+crawl: ([\d.]+),\s+\/\//);
    expect(Number(crawl![1])).toBe(COST_TABLE.crawl.dfs);
  });
});
