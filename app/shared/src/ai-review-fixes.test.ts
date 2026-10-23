import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AI_SENTIMENT_EARLY, parseAiSentiment } from './ai-detail';
import { aiDateColumn, aiIsDay, parseAiImport } from './ai-import';
import { importDate, parseCsv } from './link-import';

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

describe('R-A5 upload dates: the whole column decides, every day is a real day, no file is stamped today', () => {
  it('month-first when a second number is over 12, day-first when a first one is', () => {
    expect(aiDateColumn(['10/22/2026', '10/05/2026'])).toEqual({ days: ['2026-10-22', '2026-10-05'], order: 'mdy' });
    expect(aiDateColumn(['22/10/2026', '05/10/2026'])).toEqual({ days: ['2026-10-22', '2026-10-05'], order: 'dmy' });
    expect(aiDateColumn(['22.10.2026', '5.10.2026']).order).toBe('dmy');
  });
  it('ambiguous files are refused unless the owner says which; a mixed file is refused', () => {
    expect(() => aiDateColumn(['10/05/2026', '11/05/2026'])).toThrow(/day\/month or month\/day/);
    expect(aiDateColumn(['10/05/2026'], 'mdy').days).toEqual(['2026-10-05']);
    expect(aiDateColumn(['10/05/2026'], 'dmy').days).toEqual(['2026-05-10']);
    expect(() => aiDateColumn(['22/10/2026', '10/22/2026'])).toThrow(/not written one way/);
    expect(() => aiDateColumn(['10/22/2026'], 'dmy')).toThrow(/You chose day first/);
  });
  it('ISO and month names read as they are; impossible days are not days', () => {
    expect(aiDateColumn(['2026-10-22', 'Oct 5, 2026', '5 Oct 2026']).days).toEqual(['2026-10-22', '2026-10-05', '2026-10-05']);
    expect(aiDateColumn(['2026-22-10', '2026-02-31']).days).toEqual(['', '']);
    expect(aiIsDay('2026-02-31')).toBe(false);
    expect(aiIsDay('2026-02-28')).toBe(true);
    expect(importDate('10/22/2026')).toBe('');
  });
  it('the parser: Bing month-first file, an undated file needs its period end, never today', () => {
    const r = parseAiImport('Date,Page,Citations\n10/22/2026,https://techand.ai/a,3\n10/05/2026,https://techand.ai/b,1\n', 'techand.ai', { today: '2026-10-24' });
    expect(r.days).toEqual({ from: '2026-10-05', to: '2026-10-22' });
    expect(() => parseAiImport('Top queries,Clicks,Impressions\nerp uae,1,10\n', 'techand.ai', { today: '2026-10-24' })).toThrow(/no date column/);
    expect(() => parseAiImport('Top queries,Clicks,Impressions\nerp uae,1,10\n', 'techand.ai', { periodEnd: '2026-02-31', today: '2026-10-24' })).toThrow(/not a date/);
    expect(() => parseAiImport('Top queries,Clicks,Impressions\nerp uae,1,10\n', 'techand.ai', { periodEnd: '2026-11-30', today: '2026-10-24' })).toThrow(/future/);
    const q = parseAiImport('Search Console export\nTop queries,Clicks,Impressions\nerp uae,1,10\nvat uae,0,4\n', 'techand.ai', { periodEnd: '2026-10-20', today: '2026-10-24' });
    expect(q.rows.every((x) => x.day === '2026-10-20')).toBe(true);
    // R-A13: a file without pages shows its top queries
    expect(q.topQueries).toEqual(['erp uae', 'vat uae']);
  });
  it('R-A21: the delimiter comes from the first line that has one (a title line first)', () => {
    expect(parseCsv('Performance report\nDate;Clicks;Impressions\n2026-10-20;1;10\n')[1]).toEqual(['Date', 'Clicks', 'Impressions']);
  });
});
