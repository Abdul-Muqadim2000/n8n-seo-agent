import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AIF } from './ai-focus';

// AI-FOCUS (2026-10-27): ONE focus rule for the AI question panel. The app's module (ai-focus.generated.js, written by build_v4.py through
// ai_focus_app.py) must be the engine's kit (n8n/seo-agent/v5/code/_ai_focus.js) byte for byte, and decide every labelled case of
// n8n/seo-agent/harness/accuracy/ai_panel_focus.json exactly as the kit does. The kit is evaluated here straight from the engine folder (with the
// fit gate it reads its place helpers from), so a kit change without a rebuild fails this suite. Needs the repo root (CI checks it out whole).

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(here, '../../../n8n/seo-agent');
const KIT_SRC = readFileSync(join(ENGINE, 'v5/code/_ai_focus.js'), 'utf8').replace(/\n+$/, '');
const GATE_SRC = readFileSync(join(ENGINE, 'v5/code/_fit_gate.js'), 'utf8');
const GENERATED = readFileSync(join(here, 'ai-focus.generated.js'), 'utf8');
const KIT = new Function(GATE_SRC + '\n' + KIT_SRC + '\nreturn AIF;')() as typeof AIF;

interface Case {
  id: string;
  iso: string;
  own_market: string;
  markets?: string[];
  N: number;
  weeks: number;
  full: boolean;
  ladders: unknown;
  settings: Record<string, unknown>[];
  content_log: Record<string, unknown>[];
  keywords: string[];
  services: string[];
  stored: unknown;
}
const LAB = JSON.parse(readFileSync(join(ENGINE, 'harness/accuracy/ai_panel_focus.json'), 'utf8')) as { now: string; cases: Case[] };

describe('the app runs the engine\'s focus kit', () => {
  it('ai-focus.generated.js is _ai_focus.js unchanged (rebuild with python3 build_v4.py when this fails)', () => {
    expect(GENERATED.includes(KIT_SRC)).toBe(true);
  });
  for (const c of LAB.cases.filter((x) => Array.isArray(x.ladders) && Array.isArray(x.stored))) {
    it(`${c.id}: the same focus and the same reconcile`, () => {
      const args = { ladders: c.ladders as Record<string, unknown>[], settings: c.settings, content_log: c.content_log, keywords: c.keywords, services: c.services, gsc: [], iso: c.iso, now: LAB.now };
      const a = AIF.focusOf(args), b = KIT.focusOf(args);
      expect(a).toEqual(b);
      const r = { stored: c.stored as never[], N: c.N, now: LAB.now, full: c.full, weeks: c.weeks, own_market: c.own_market, markets: c.markets ?? [], ladder_ids: (c.ladders as { ladder_id: string }[]).map((l) => l.ladder_id) };
      expect(AIF.reconcile({ ...r, focus: a })).toEqual(KIT.reconcile({ ...r, focus: b }));
    });
  }
});
