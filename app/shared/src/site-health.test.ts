import { describe, expect, it } from 'vitest';
import { buildIndexingData, INDEX_POPULATION_LINE, inGooglePopulation, indexPageOf, indexReportFigures } from './indexing';
import { healthLabelFor, pagesInGoogle, pagesInGoogleLead, technicalGrade, TECHNICAL_HEALTH_LABEL } from './site-health';
import type { IndexPageRow } from './tables';

// CR17-C (client report 2026-11-17, devaicon.com, C3 + F6): one population ("pages that should be in Google"), counted once, read by the
// Indexing page, the Overview, Technical health and the report. The fixture has the shape of devaicon.com on 17 Nov (anonymised paths):
// 45 sitemap pages that open directly (18 in Google: 13 of 29 existing, 5 of 16 new), and 5 old addresses that now redirect - three filed
// as moved, two still filed "in Google, missing from the sitemap" by the engine before section 193 (rows 7 and 100).
const W = 'https://dev.example';
const row = (o: Partial<IndexPageRow>): Partial<IndexPageRow> => ({ site_id: 'site_dev-example', in_sitemap: true, lane: 'existing', action: 'none', cause: '', ...o });
function devaicon(preFix: boolean): Partial<IndexPageRow>[] {
  const rows: Partial<IndexPageRow>[] = [];
  for (let i = 0; i < 13; i++) rows.push(row({ url: `${W}/existing-in-${i}`, state: 'indexed' }));
  for (let i = 0; i < 12; i++) rows.push(row({ url: `${W}/existing-out-${i}`, state: 'not_indexed', cause: i % 2 ? 'discovered_not_crawled' : 'unknown_to_google', action: i % 3 ? 'links' : 'wait' }));
  rows.push(row({ url: `${W}/careers`, state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality' }));
  rows.push(row({ url: `${W}/privacy`, state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality', type_override: 'important' }));
  rows.push(row({ url: `${W}/cookies`, state: 'not_indexed', cause: 'unknown_to_google', action: 'links', type_override: 'important' }));
  rows.push(row({ url: `${W}/insights/agentic-ai`, state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links' }));
  for (let i = 0; i < 5; i++) rows.push(row({ url: `${W}/services/new-in-${i}`, state: 'indexed', lane: 'new' }));
  for (let i = 0; i < 11; i++) rows.push(row({ url: `${W}/services/new-out-${i}`, state: 'not_indexed', cause: 'wait_new', action: 'wait', lane: 'new' }));
  // the old addresses (not in the sitemap), each now a 301 to a page above
  for (const [i, p] of ['engagement-models', 'industries/bfsi', 'capabilities/application-software-development'].entries())
    rows.push(row({ url: `${W}/${p}`, in_sitemap: false, state: 'excluded', cause: 'redirect', action: 'leave_out', final_url: `${W}/services/new-out-${i}` }));
  for (const [i, p] of ['capabilities/consulting-transformation', 'ai-automation-services-pakistan'].entries())
    rows.push(
      preFix
        ? row({ url: `${W}/${p}`, in_sitemap: false, state: 'indexed', cause: 'indexed_not_in_sitemap', action: 'site_fix', final_url: `${W}/services/new-out-${3 + i}`, http_status: 200 })
        : row({ url: `${W}/${p}`, in_sitemap: false, state: 'excluded', cause: 'redirect', action: 'leave_out', final_url: `${W}/services/new-out-${3 + i}` }),
    );
  return rows;
}
const data = (rows: Partial<IndexPageRow>[]) => buildIndexingData({ rows, runs: [], events: [], impacts: [], settings: { on: true, dailyCap: 300 }, now: Date.parse('2026-11-17T12:00:00Z') });

describe('pages that should be in Google: one population, counted once', () => {
  for (const preFix of [true, false]) {
    it(`devaicon-like site (${preFix ? 'rows written before the engine fix' : 'after the engine fix'}): 18 of 45, existing 13 of 29, 11 new waiting`, () => {
      const d = data(devaicon(preFix));
      expect(d.totals.shouldBe).toBe(45);
      expect(d.totals.indexed).toBe(18);
      expect(d.lanes.existing.shouldBe).toBe(29);
      expect(d.lanes.existing.indexed).toBe(13);
      const p = pagesInGoogle(d, 'dev.example')!;
      expect(p.inGoogle).toBe(18);
      expect(p.shouldBe).toBe(45);
      expect(p.existing).toEqual({ inGoogle: 13, shouldBe: 29, pct: 45 });
      expect(p.newPages.waiting).toBe(11);
      expect(p.tone).toBe('critical');
      expect(p.headline).toBe('Google shows only 13 of your 29 existing pages');
      expect(p.detail).toBe('Google has 18 of the 45 pages that should be in Google. 11 pages are new and waiting for Google (it usually takes a few days to a few weeks).');
      expect(p.population).toBe(INDEX_POPULATION_LINE);
      expect(pagesInGoogleLead(p, 90)).toBe('Technically sound, but Google shows only 13 of your 29 existing pages');
      expect(pagesInGoogleLead(p, 55)).toBe('Google shows only 13 of your 29 existing pages');
    });
  }

  it('a moved address counts once (through its new address): never as a second page, never as "in Google"', () => {
    const moved = indexPageOf(row({ url: `${W}/old`, state: 'indexed', cause: 'indexed_not_in_sitemap', action: 'site_fix', final_url: `${W}/new` }));
    expect(inGooglePopulation(moved)).toBe(false);
    expect(inGooglePopulation(indexPageOf(row({ url: `${W}/new`, state: 'not_indexed', cause: 'wait_new', action: 'wait' })))).toBe(true);
    // a slash / www form of itself is the same page, not a move
    expect(inGooglePopulation(indexPageOf(row({ url: `${W}/same`, state: 'indexed', final_url: `https://www.dev.example/same/` })))).toBe(true);
    // left out on purpose, gone, another page's copy: not counted; an accidental noindex IS counted (as out of Google)
    expect(inGooglePopulation(indexPageOf(row({ url: `${W}/tag/x`, state: 'excluded', cause: 'low_value', action: 'leave_out' })))).toBe(false);
    expect(inGooglePopulation(indexPageOf(row({ url: `${W}/gone`, state: 'excluded', cause: 'not_found', action: 'site_fix' })))).toBe(false);
    expect(inGooglePopulation(indexPageOf(row({ url: `${W}/copy`, state: 'excluded', cause: 'canonical_elsewhere', action: 'site_fix' })))).toBe(false);
    expect(inGooglePopulation(indexPageOf(row({ url: `${W}/blocked`, state: 'excluded', cause: 'noindex', action: 'site_fix' })))).toBe(true);
  });

  it('bands on the existing pages: >= 90% good, 70-89% warning, < 70% critical; only new pages: waiting; no reading: null', () => {
    const site = (inN: number, of: number) => data(Array.from({ length: of }, (_, i) => row({ url: `${W}/p${i}`, state: i < inN ? 'indexed' : 'not_indexed', cause: i < inN ? '' : 'crawled_not_indexed', action: i < inN ? 'none' : 'quality' })));
    expect(pagesInGoogle(site(47, 48))!.tone).toBe('good'); // techand.ai, 17 Nov
    expect(pagesInGoogle(site(9, 10))!.tone).toBe('good');
    expect(pagesInGoogle(site(8, 10))!.tone).toBe('warning');
    expect(pagesInGoogle(site(7, 10))!.tone).toBe('warning');
    expect(pagesInGoogle(site(6, 10))!.tone).toBe('critical');
    expect(pagesInGoogle(site(47, 48))!.headline).toBe('Google shows 47 of your 48 pages');
    const fresh = data([row({ url: `${W}/n`, state: 'not_indexed', cause: 'wait_new', action: 'wait', lane: 'new' })]);
    expect(pagesInGoogle(fresh)!.tone).toBe('waiting');
    expect(pagesInGoogleLead(pagesInGoogle(site(47, 48)), 90)).toBeNull();
    expect(pagesInGoogle(data([]))).toBeNull();
  });

  it('a report carrying the engine\'s in_google / should_be shows them; an older report keeps its own figures', () => {
    expect(indexReportFigures({ known: 50, indexed: 20, in_google: 18, should_be: 45, unknown: 0 })).toEqual({ indexed: 18, shouldBe: 45, known: 50, notChecked: 0 });
    expect(indexReportFigures({ known: 50, indexed: 20, not_indexed: 27, excluded: 3, unknown: 0, by_action: { leave_out: 3 } })).toEqual({ indexed: 20, shouldBe: 47, known: 50, notChecked: 0 });
  });
});

describe('Technical health: the audit score\'s name and grade words', () => {
  it('names the score Technical health (a full report: SEO health)', () => {
    expect(healthLabelFor('site_audit')).toBe(TECHNICAL_HEALTH_LABEL);
    expect(healthLabelFor(undefined)).toBe('Technical health');
    expect(healthLabelFor('full_report')).toBe('SEO health');
  });
  it('keeps the engine\'s bands (90 / 75 / 60) and always says "(technical)"', () => {
    expect(technicalGrade(90)).toEqual({ grade: 'Excellent', label: 'Excellent (technical)', tone: 'good' });
    expect(technicalGrade(89)!.grade).toBe('Good');
    expect(technicalGrade(75)!.grade).toBe('Good');
    expect(technicalGrade(74)).toEqual({ grade: 'Needs improvement', label: 'Needs improvement (technical)', tone: 'warning' });
    expect(technicalGrade(59)).toEqual({ grade: 'Poor', label: 'Poor (technical)', tone: 'critical' });
    expect(technicalGrade(null)).toBeNull();
  });
});
