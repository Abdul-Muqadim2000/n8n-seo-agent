import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cycleNorm } from '@seo/shared';
import { cadenceInputFromTables, planCadence, triggerOf, type CadenceTables } from '../src/services/cadence';

// The shared fixture of the keyword-first rules (SCHEDULING_KEYWORDS_PLAN.md §9): the engine's harness runs every case through the
// real Cadence Plan node (harness/scenarios_keyword_first.js, KF2 / KF3); this suite runs the same cases through the app's mirror
// (server/src/services/cadence.ts). Both read ONE file, so the mirror cannot drift from the engine without a test failing here.

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(here, '../../../n8n/seo-agent/harness/fixtures/cadence_levels.json');

interface FixtureCase {
  name: string;
  doc: string;
  level: number;
  now: string;
  trigger: Record<string, unknown>;
  tables: CadenceTables & Record<string, unknown>;
  expect: {
    picks: { keyword: string; source: string }[];
    suggestions: { keyword: string; source: string }[];
    waiting_for_keyword: boolean;
    refused: { keyword: string; reason: string }[];
    items?: { keyword: string; source: string; auto: boolean }[];
    awaiting?: string[];
    skipped?: string[];
    budget_spent?: number;
    approved_not_written?: { keyword: string; reason: string }[];
  };
}

const FX = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { _doc: string; contract: string; cases: FixtureCase[] };
const ks = (a: { keyword: string; source: string }[]) => a.map((x) => ({ keyword: x.keyword, source: x.source }));
const sortJ = (a: unknown[]) => a.map((x) => JSON.stringify(x)).sort();

const planOf = (c: FixtureCase) => planCadence(cadenceInputFromTables(c.tables, { estPageUsd: 0.84 }), Date.parse(c.now), triggerOf(c.trigger));

describe('the shared keyword-first fixture (n8n/seo-agent/harness/fixtures/cadence_levels.json)', () => {
  it('is the file the engine runs: it names this mirror and the contract, and holds the 57 cases', () => {
    expect(FX._doc).toMatch(/cadence\.ts/);
    expect(FX.contract).toBe('app/shared/src/cycles.ts');
    expect(FX.cases.length).toBe(57);
  });

  for (const c of FX.cases) {
    describe(c.name, () => {
      const p = planOf(c);
      it('picks, in order', () => expect(ks(p.picks)).toEqual(c.expect.picks));
      it('suggestions, in order', () => expect(ks(p.suggestions)).toEqual(c.expect.suggestions));
      it(`waiting for the first keyword: ${c.expect.waiting_for_keyword}`, () => expect(p.waitingForKeyword).toBe(c.expect.waiting_for_keyword));
      it('refused, with their reasons', () => expect(sortJ(p.refused.map((x) => ({ keyword: x.keyword, reason: x.reason })))).toEqual(sortJ(c.expect.refused)));
      it(`the effective level is ${c.level}`, () => expect(p.level).toBe(c.level));
      if (c.expect.items) it('the preview plan (items with auto)', () => expect(p.items.map((x) => ({ keyword: x.keyword, source: x.source, auto: x.auto }))).toEqual(c.expect.items));
      if (c.expect.awaiting) it('waiting for approval', () => expect(p.awaitingApproval.map((x) => x.keyword)).toEqual(c.expect.awaiting));
      if (c.expect.skipped) it('skipped by the client', () => expect(p.skipped.map((x) => x.itemKey).sort()).toEqual([...(c.expect.skipped ?? [])].sort()));
      if (c.expect.budget_spent != null) it(`R-K7: pages already spent in the cycle = ${c.expect.budget_spent}`, () => expect(p.budget.spent).toBe(c.expect.budget_spent));
      if (c.expect.approved_not_written)
        it('approvals not written this cycle, with the reason', () => expect(p.approvedNotWritten.map((x) => ({ keyword: x.keyword, reason: x.reason }))).toEqual(c.expect.approved_not_written));
      // the invariants every run holds (the harness's KF3)
      it('no refused keyword is written or suggested (R-K4)', () => {
        const refused = new Set(p.refused.map((x) => cycleNorm(x.keyword)));
        expect([...p.picks, ...p.suggestions].some((x) => refused.has(cycleNorm(x.keyword)))).toBe(false);
      });
      it('pages_per_week bounds everything automatic (the AI page on top only at level 3, never with 0 a week)', () => {
        const pages = Number(((c.tables.cadence ?? [])[0] ?? {}).pages_per_week) || 0;
        expect(p.picks.filter((x) => !/^ai_/.test(x.source) || c.level !== 3).length).toBeLessThanOrEqual(pages);
        if (!pages) expect(p.picks).toEqual([]);
      });
      it('every suggestion waits for an OK, with its item key, its price and its source', () => {
        expect(p.suggestions.every((s) => s.auto === false && s.itemKey === cycleNorm(s.keyword) && s.estUsd > 0 && !!s.source)).toBe(true);
      });
      it('every pick carries its item key', () => expect(p.picks.every((x) => x.itemKey === cycleNorm(x.keyword))).toBe(true));
    });
  }
});
