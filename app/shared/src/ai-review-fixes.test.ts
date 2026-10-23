import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AI_SENTIMENT_EARLY, parseAiImportsSummary, parseAiSentiment } from './ai-detail';
import { aiDateColumn, aiIsDay, parseAiImport } from './ai-import';
import { aiAnswersPageOf, aiFilterFrom, aiJoinedOf } from './ai-trends';
import { aiCompareInterim } from './ai-compare';
import { csvCell } from './identity';
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
    expect(String(out.note)).toMatch(/not (yet )?validated/i);
  });

  it('the reader keeps validated, the note and the kappa object; objections are held back', () => {
    const s = parseAiSentiment(JSON.stringify(out))!;
    expect(s.withheld).toBe(false);
    expect(s.validated).toBe(false);
    expect(s.status).toBe('early_reading');
    expect(s.label).toBe(AI_SENTIMENT_EARLY);
    expect(s.net).toBe(23);
    expect(s.note).toMatch(/not (yet )?validated/i);
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

describe('R-A9 the answers page is computed the same on the server and, against an older API, in the web', () => {
  const a = (promptId: string, engine: string, over: Record<string, unknown> = {}) =>
    ({ promptId, prompt: `Question ${promptId}?`, engine, answered: true, mentioned: false, cited: false, excerpt: 'x', competitors: ['acme.com'], sources: [], error: '', persona: '', cluster: '', market: '', stage: '', ...over }) as never;
  const all = [a('q1', 'chatgpt', { mentioned: true, persona: 'CFO' }), a('q2', 'gemini'), a('q1', 'gemini', { persona: 'CFO' })];
  it('filters by the facets carried on the answers, pages, and sums the filter', () => {
    const p = aiAnswersPageOf(all, { filter: aiFilterFrom({ persona: 'CFO' }), pageSize: 5 }, { runId: 'r1', checkedAt: '2026-10-20', runs: [] });
    expect(p.total).toBe(2);
    expect(p.summary).toMatchObject({ answers: 2, named: 1, enough: false });
    expect(p.engines.sort()).toEqual(['chatgpt', 'gemini']);
    expect(aiAnswersPageOf(all, { filter: aiFilterFrom({}), result: 'named' }, { runId: 'r1', checkedAt: null, runs: [] }).total).toBe(1);
  });
});

describe('a named rate or share of voice stored as null (not measured) is never compared as 0', () => {
  it('the change is null and untested', () => {
    const side = (over: Record<string, unknown>) => ({ runId: 'r', checkedAt: '2026-10-20', prompts: 20, samples: 100, mentionRate: 30, citationRate: 5, shareOfVoice: 20, visibilityScore: null, avgRank: null, engines: ['chatgpt'], questionIds: Array.from({ length: 20 }, (_, i) => `q${i}`), ...over });
    const c = aiCompareInterim(side({ mentionRate: null, shareOfVoice: null }) as never, side({ checkedAt: '2026-10-13' }) as never);
    expect(c.comparable).toBe(true);
    expect(c.metrics?.named_rate).toMatchObject({ now: null, delta: null, significant: null });
    expect(c.metrics?.share_of_voice).toMatchObject({ now: null, delta: null });
    expect(c.metrics?.cited_rate?.delta).toBe(0);
  });
});

describe('R-A18 csvCell', () => {
  it('neutralises a formula after leading whitespace or a line break too', () => {
    expect(csvCell(' =HYPERLINK("x")')).toBe('"\' =HYPERLINK(""x"")"');
    expect(csvCell('\n=1+1')).toBe('"\'\n=1+1"');
    expect(csvCell('plain text')).toBe('"plain text"');
  });
});

describe('already_measured is closed like a joined run', () => {
  it('the note leads with the words the screens show', () => {
    expect(aiJoinedOf({ reason: 'already_measured', error: 'Measured at 08:00.' })).toEqual({ lastStage: 'already_measured', note: 'Already measured today: showing the stored week. Measured at 08:00.' });
    expect(aiJoinedOf({ reason: 'open_run' })?.lastStage).toBe('joined_open_run');
    expect(aiJoinedOf({ reason: 'budget' })).toBeNull();
  });
});

describe('R-A10 imports_json in the shape the engine writes (fixes/W2-E3.md §4)', () => {
  const engine = {
    period: { from: '2026-09-26', to: '2026-10-23' },
    sources: {
      bing_ai: { rows: 3, days: { from: '2026-10-01', to: '2026-10-20' }, impressions: 40, citations: 7, clicks: 2, urls_n: 2, queries_n: 1,
        top_urls: [{ url: 'https://techand.ai/a', impressions: 30, citations: 5, clicks: 1 }], top_queries: [{ query: 'erp uae', impressions: 40, citations: 7, clicks: 2 }],
        files: ['bing.csv'], imported_at: '2026-10-21T10:00:00.000Z' },
    },
    copilot: { source: 'bing_ai', citations: 7, impressions: 40, urls_n: 2, as_of: '2026-10-20', label: 'from Bing Webmaster (your export of 2026-10-20)', note: 'n' },
    note: 'Your uploaded reports, 2026-09-26 to 2026-10-23: Bing AI Performance (3 rows)',
  };
  it('days, period and the Copilot line are read (they were blank / dropped)', () => {
    const p = parseAiImportsSummary(JSON.stringify(engine))!;
    expect(p.period).toEqual({ from: '2026-09-26', to: '2026-10-23' });
    expect(p.sources).toHaveLength(1);
    expect(p.sources[0]).toMatchObject({ source: 'bing_ai', rows: 3, from: '2026-10-01', to: '2026-10-20', urlsN: 2, files: ['bing.csv'], importedAt: '2026-10-21T10:00:00.000Z' });
    expect(p.sources[0].topQueries[0]).toEqual({ query: 'erp uae', impressions: 40, citations: 7, clicks: 2 });
    expect(p.copilot).toMatchObject({ citations: 7, label: 'from Bing Webmaster (your export of 2026-10-20)' });
  });
  it('the top-level period / copilot objects are never read as sources; empty column = null', () => {
    expect(parseAiImportsSummary(JSON.stringify({ period: { from: 'a', to: 'b' }, sources: {}, copilot: null, note: '' }))).toBeNull();
    expect(parseAiImportsSummary('')).toBeNull();
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
