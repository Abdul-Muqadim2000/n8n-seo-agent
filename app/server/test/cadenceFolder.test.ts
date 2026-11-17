import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cadenceInputFromTables, planCadence, triggerOf, type CadenceTables } from '../src/services/cadence';

// CR17-G (client report 2026-11-17, F4, build section 197): a ladder rung planned at the root of a website that keeps its service pages in a
// folder is written at the folder address (LRU.folderFor). The engine runs the same fixture through the real Cadence Plan (harness
// scenarios_cr17_g.js, CR17G2); this suite runs it through the app's mirror, so the two cannot place a page differently.

const here = dirname(fileURLToPath(import.meta.url));
const FX = JSON.parse(readFileSync(resolve(here, '../../../n8n/seo-agent/harness/fixtures/cr17_g_folder.json'), 'utf8')) as {
  _doc: string;
  cases: { name: string; doc: string; now: string; trigger: Record<string, unknown>; tables: CadenceTables & Record<string, unknown>; expect: { pick_keyword: string; target_url: string } }[];
};

describe('CR17-G F4: the cadence writes a page in the folder the website keeps that kind of page in (shared fixture)', () => {
  it('names the engine scenario and this mirror', () => {
    expect(FX._doc).toMatch(/cadence\.ts/);
    expect(FX.cases.length).toBe(2);
  });
  for (const c of FX.cases)
    it(`${c.name}: ${c.doc}`, () => {
      const p = planCadence(cadenceInputFromTables(c.tables, { estPageUsd: 0.84 }), Date.parse(c.now), triggerOf(c.trigger));
      const pick = p.picks.find((x) => x.keyword === c.expect.pick_keyword);
      expect(pick?.plannedUrl).toBe(c.expect.target_url);
      expect(pick?.existingPageUrl ?? '').toBe('');
    });
});
