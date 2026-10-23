import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AI_SENTIMENT_EARLY, parseAiSentiment } from './ai-detail';

// R-APP (2026-10-23, docs/ai-visibility-2026-10-23/REVIEW_APP.md): the shared halves of the app fixes of the AI visibility review.

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(here, '../../../n8n/seo-agent');

/** The engine's own sentiment kit (v5/code/_ai_sentiment.js), with its interval kit stubbed: its aggregate() is what sentiment_json holds. */
function engineSentiment(): { aggregate: (a: unknown[], m: Map<string, unknown>, o?: unknown) => Record<string, unknown> } {
  const src = readFileSync(join(ENGINE, 'v5/code/_ai_sentiment.js'), 'utf8');
  const AVX = { ratio: () => ({ value: 23, lo: 5, hi: 41, n_questions: 7 }) };
  return new Function('AVX', src + '\nreturn SENT;')(AVX);
}

describe('R-A2 sentiment: an early reading is never shown as a finding', () => {
  const SENT = engineSentiment();
  const answers = Array.from({ length: 14 }, (_, i) => ({ key: `r|q${i}|chatgpt`, prompt_id: `q${i}`, engine: 'chatgpt', snippet: 'Techand is reliable but expensive.', rival_names: [], rivals: [] }));
  const model = new Map(answers.map((a, i) => [a.key, { polarity: i % 3 ? 'positive' : 'negative', aspects: [{ aspect: 'price', polarity: 'negative' }], objection: 'pricing is not public', rivals: [] }]));
  const out = SENT.aggregate(answers, model, { business: 'Techand' });

  it('the engine writes validated: false and kappa as an object today (the model is not measured)', () => {
    expect(out.validated).toBe(false);
    expect(typeof out.kappa).toBe('object');
    expect(String(out.note)).toContain('not yet validated');
  });

  it('the reader keeps validated, the note and the kappa object; objections are held back', () => {
    const s = parseAiSentiment(JSON.stringify(out))!;
    expect(s.withheld).toBe(false);
    expect(s.validated).toBe(false);
    expect(s.status).toBe('early_reading');
    expect(s.label).toBe(AI_SENTIMENT_EARLY);
    expect(s.net).toBe(23);
    expect(s.note).toContain('not yet validated');
    expect(s.kappa).toBeNull();
    expect(s.kappaRules).toBeCloseTo(0.548);
    expect(s.kappaGate).toBe(0.7);
    expect(s.objections).toEqual([]);
    expect(s.objectionsHeld).toBe(1);
  });

  it('validated only when the engine says so and the model clears its gate', () => {
    const ok = parseAiSentiment({ ...out, validated: true, kappa: { model: 0.81, gate: 0.7 } })!;
    expect(ok).toMatchObject({ validated: true, status: 'validated', label: '', objectionsHeld: 0 });
    expect(ok.objections).toEqual(['pricing is not public']);
    expect(parseAiSentiment({ ...out, validated: true, kappa: { model: 0.5, gate: 0.7 } })?.validated).toBe(false);
    // absent on a present column = not validated
    const { validated: _v, ...noFlag } = out;
    expect(parseAiSentiment(noFlag)?.validated).toBe(false);
  });

  it('withheld stays withheld (no figure, no label of a figure)', () => {
    const s = parseAiSentiment({ n: 4, withheld: true, validated: false })!;
    expect(s).toMatchObject({ withheld: true, status: 'withheld', net: null, objections: [] });
  });
});
