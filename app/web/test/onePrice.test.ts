import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { estimateRunCost, estimateRunMinutes, MODE_IDS, type ModeId } from '@seo/shared';
import { runCost, runMinutes } from '@/lib/prices';

// D-2 (re-rating 2026-10-17): one run showed two prices — the tools card "about $0.20" beside its form's "$0.18", the onboarding launch
// step's audit "$0.09" beside "$0.11", the ladder card "~8 min" beside the form's "about 18 min". The cards and the launch step read
// MODES[].costUsd (the shipped table) and MODES[].etaMinutes (the base time without the pages written), the forms the engine's
// calibrated estimate. One rule now: a screen names a mode's price and time only through lib/prices.ts (runCost / runMinutes / PRICES).

const SRC = join(__dirname, '..', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

describe('one price and one time per run (D-2)', () => {
  it('no screen shows the shipped MODES price or base time', () => {
    const offenders: string[] = [];
    for (const f of files(SRC)) {
      const src = readFileSync(f, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (/(MODES(\[[^\]]+\]|\.\w+)|\binfo)\.(costUsd|etaMinutes)\b/.test(line)) offenders.push(`${relative(SRC, f)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the card's figure is the form's figure (same function, same calibration)", () => {
    for (const m of MODE_IDS as readonly ModeId[]) {
      expect(runCost(m), m).toBe(estimateRunCost(m, {}, null));
      expect(runMinutes(m), m).toBe(estimateRunMinutes(m, {}));
    }
    // the ladder card prices "plan + 1 page", so its time is the plan and that page, as the form says
    expect(runMinutes('ladder')).toBe(estimateRunMinutes('ladder', { pagesNow: 1 }));
    expect(runMinutes('ladder')).toBeGreaterThan(10);
  });
});
