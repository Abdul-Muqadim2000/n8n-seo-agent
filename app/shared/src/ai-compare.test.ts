// F3 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/APP_AUDIT.md): the shared halves of A1 A2 A3 A4 A5 A7 A8 A18.
import { describe, expect, it } from 'vitest';
import {
  aiAlertsOf,
  aiChangeOf,
  aiCompareInterim,
  aiEngineSetOf,
  aiPulseDayInfo,
  aiTwoProportion,
  aiUrlsOf,
  aiWindowLabel,
  parseAiCompareJson,
  type AiCompareSide,
} from './ai-compare';
import { aiAskedSet, aiOnDemandRunUsd, aiPanelOverflow, aiRunPanelOf, estimateAiPanelCost } from './ai-panel';
import { AI_PANEL_VALUE, COST_TABLE, estimateRunCost, estimateRunCostParts } from './cost';
import { EXPORT_TABLES } from './integrations';
import { aiPrecisionTable } from './ai-visibility';

const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `q_${from + i}`);
const side = (over: Partial<AiCompareSide> = {}): AiCompareSide => ({
  runId: 'ai_1', checkedAt: '2026-10-19T07:00:00Z', prompts: 99, samples: 400, mentionRate: 3.1, citationRate: 1, shareOfVoice: 4, visibilityScore: 10, avgRank: 2,
  engines: ['ai_mode', 'ai_overview', 'chatgpt', 'gemini', 'perplexity'], questionIds: ids(98), ...over,
});

describe('A1: the comparison stored by the engine (compare_json)', () => {
  it('reads a comparable row with its tests', () => {
    const c = parseAiCompareJson(JSON.stringify({ rule_version: 'v1', comparable: true, reason: null, previous_run_id: 'p', previous_at: '2026-10-12T07:00:00Z', panel_overlap: 0.95, engines_same: true,
      window: { from: '2026-10-12', to: '2026-10-19', days: 7 },
      metrics: { named_rate: { now: 30, prev: 20, delta: 10, n_now: 400, n_prev: 380, significant: true, p: 0.001 }, cited_rate: { now: 5, prev: 4, delta: 1, n_now: 400, n_prev: 380, significant: false, p: 0.4 } } }))!;
    expect(c.source).toBe('engine');
    expect(aiChangeOf(c, 'named_rate')).toEqual({ delta: 10, verdict: 'real' });
    expect(aiChangeOf(c, 'cited_rate')).toEqual({ delta: 1, verdict: 'noise' });
    expect(aiChangeOf(c, 'share_of_voice').verdict).toBe('none');
    expect(aiWindowLabel(c)).toBe('2026-10-12 to 2026-10-19 (7 days)');
  });
  it('a row the engine refused carries no delta, whatever it holds, and says why', () => {
    const c = parseAiCompareJson({ comparable: false, reason: 'a different panel', metrics: { named_rate: { now: 3, prev: 7, delta: -4, significant: true } } })!;
    expect(c.comparable).toBe(false);
    expect(c.reason).toBe('a different panel');
    expect(aiChangeOf(c, 'named_rate')).toEqual({ delta: null, verdict: 'none' });
  });
  it('an absent or unreadable column is not a comparison (the caller falls back, never to "comparable")', () => {
    expect(parseAiCompareJson('')).toBeNull();
    expect(parseAiCompareJson('{oops')).toBeNull();
    expect(parseAiCompareJson('{"metrics":{}}')).toBeNull();
  });
});

describe('A1: the interim like-for-like rule on older rows', () => {
  it('the handoff scenario: 8 questions then 99 now is a different panel, no delta', () => {
    const c = aiCompareInterim(side(), side({ runId: 'ai_0', checkedAt: '2026-10-12T07:00:00Z', prompts: 8, mentionRate: 7.6, questionIds: ids(7) }));
    expect(c.comparable).toBe(false);
    expect(c.reason).toMatch(/only 7% of the questions asked now were asked then/);
    expect(aiChangeOf(c, 'named_rate').delta).toBeNull();
  });
  it('different engines (Copilot switched on) are not compared', () => {
    const c = aiCompareInterim(side({ engines: ['chatgpt', 'copilot'] }), side({ engines: ['chatgpt'] }));
    expect(c.comparable).toBe(false);
    expect(c.reason).toMatch(/different engines/);
  });
  it('rows that do not record their questions are never compared', () => {
    const c = aiCompareInterim(side({ questionIds: null }), side({ questionIds: null }));
    expect(c.comparable).toBe(false);
    expect(c.reason).toMatch(/do not record which questions/);
    // the engine's own overlap on the newer row is used when ids are missing on one side
    expect(aiCompareInterim(side({ questionIds: null, overlapWithPrevious: { share: 0.9, same: true } }), side({ questionIds: null })).comparable).toBe(true);
    expect(aiCompareInterim(side({ questionIds: null, overlapWithPrevious: { share: 0.9, same: false } }), side({ questionIds: null })).comparable).toBe(false);
  });
  it('a comparable pair tests the named and cited rates; share of voice and the score are shown untested', () => {
    const c = aiCompareInterim(side({ mentionRate: 30, citationRate: 6 }), side({ checkedAt: '2026-10-12T07:00:00Z', mentionRate: 20, citationRate: 5 }));
    expect(c.comparable).toBe(true);
    expect(aiChangeOf(c, 'named_rate')).toEqual({ delta: 10, verdict: 'real' });
    expect(aiChangeOf(c, 'cited_rate')).toEqual({ delta: 1, verdict: 'noise' });
    expect(aiChangeOf(c, 'share_of_voice').verdict).toBe('untested');
    expect(aiChangeOf(c, 'visibility_score').verdict).toBe('untested');
    expect(c.window).toEqual({ from: '2026-10-12', to: '2026-10-19', days: 7 });
  });
  it('the first run has nothing to compare', () => {
    const c = aiCompareInterim(side(), null);
    expect(c.comparable).toBe(false);
    expect(aiWindowLabel(c)).toBe('this run');
  });
  it('two-proportion test: the engine\'s |z| >= 1.96 and 5 points; no test under 12 answers', () => {
    expect(aiTwoProportion(120, 400, 80, 400).significant).toBe(true);
    expect(aiTwoProportion(2010, 4000, 1950, 4000).significant).toBe(false);   // 1.5 points: under the 5-point floor
    expect(aiTwoProportion(5, 9, 1, 9).significant).toBeNull();
  });
  it('the engine set leaves out monthly, carried and fully failed engines', () => {
    expect(aiEngineSetOf({ chatgpt: { asked: 5, answered: 5 }, claude: { asked: 5, answered: 5 }, gemini: { asked: 5, answered: 0, errors: 5 }, perplexity: { carried: true, answered: 3 }, ai_overview: { asked: 5, answered: 0, errors: 0 } }))
      .toEqual(['ai_overview', 'chatgpt']);
  });
});

describe('A4: the engine\'s separators', () => {
  it('alerts are " | "-joined with a level, and a text may hold commas', () => {
    expect(aiAlertsOf('high: AI states something wrong about you (ChatGPT, Gemini): x | medium: wafeq.com gained 12 points')).toEqual([
      { level: 'high', text: 'AI states something wrong about you (ChatGPT, Gemini): x' },
      { level: 'medium', text: 'wafeq.com gained 12 points' },
    ]);
    expect(aiAlertsOf('[{"level":"low","text":"a, b"}]')).toEqual([{ level: 'low', text: 'a, b' }]);
    expect(aiAlertsOf('')).toEqual([]);
  });
  it('our cited URLs are space-joined; a JSON array is read too', () => {
    expect(aiUrlsOf('https://d/a https://d/b')).toEqual(['https://d/a', 'https://d/b']);
    expect(aiUrlsOf('["https://d/a",{"u":"https://d/b"}]')).toEqual(['https://d/a', 'https://d/b']);
    expect(aiUrlsOf('https://d/a, https://d/a')).toEqual(['https://d/a']);
  });
});

describe('A7: what a pulse morning asked', () => {
  it('reads the new columns, else sample_json; an older row is unknown', () => {
    expect(aiPulseDayInfo({ sample_mode: 'sample', questions_asked: 100, partial: true, engines_answered: 'chatgpt, ai_mode' })).toMatchObject({ sampleMode: 'sample', questionsAsked: 100, partial: true, enginesAnswered: ['chatgpt', 'ai_mode'] });
    expect(aiPulseDayInfo({ sample_json: JSON.stringify({ mode: 'full', asked: 40 }) })).toMatchObject({ sampleMode: 'full', questionsAsked: 40, partial: false });
    expect(aiPulseDayInfo({})).toMatchObject({ sampleMode: '', questionsAsked: null, partial: false });
  });
});

describe('A2: an on-demand AI visibility run is quoted from the website\'s panel', () => {
  it('a 100-question panel is quoted at its full run, not the 8-question table row', () => {
    const panel = aiRunPanelOf({ aiPromptsMax: 100, aiEngines: [] });
    const full = estimateAiPanelCost({ panel: 100 }).run.full.usd;
    expect(aiOnDemandRunUsd(panel)).toBe(full);
    expect(estimateRunCost('ai_visibility', { [AI_PANEL_VALUE]: panel })).toBeCloseTo(full, 4);
    expect(full).toBeGreaterThan(COST_TABLE.ai_visibility.ai + COST_TABLE.ai_visibility.dfs);
    expect(estimateRunCostParts('ai_visibility', { [AI_PANEL_VALUE]: panel }).usd).toBeCloseTo(full, 4);
  });
  it('no monitors row = the engine\'s default 50; an empty size = 20; no panel = the table row (fallback)', () => {
    expect(aiRunPanelOf(null).panel).toBe(50);
    expect(aiRunPanelOf({ aiPromptsMax: null }).panel).toBe(20);
    expect(estimateRunCost('ai_visibility', {})).toBeCloseTo(COST_TABLE.ai_visibility.ai + COST_TABLE.ai_visibility.dfs, 4);
  });
});

describe('A3: the questions a weekly run asks', () => {
  const row = (id: string, o: Partial<{ status: string; source: string; pinned: boolean }> = {}) => ({ promptId: id, status: 'active', source: 'auto', pinned: false, ...o });
  it('size 50, 200 own + 49 automatic: 50 asked (own first), 199 not asked', () => {
    const prompts = [...ids(49).map((id) => row('auto_' + id)), ...ids(200).map((id) => row(id, { source: 'custom' }))];
    const cut = aiAskedSet(prompts, 50);
    expect(cut.asked.size).toBe(50);
    expect(cut.over.size).toBe(199);
    expect([...cut.asked].every((id) => !id.startsWith('auto_'))).toBe(true);
  });
  it('pinned first, switched off and refused never asked', () => {
    const cut = aiAskedSet([row('a'), row('b', { status: 'off' }), row('c', { status: 'refused' }), row('d', { pinned: true })], 1);
    expect([...cut.asked]).toEqual(['d']);
    expect([...cut.over]).toEqual(['a']);
  });
  it('an import past the size says how many are left out and what size asks them all', () => {
    expect(aiPanelOverflow(10, 200, 50)).toEqual({ notAsked: 160, sizeNeeded: 210 });
    expect(aiPanelOverflow(0, 5, 50).notAsked).toBe(0);
    expect(aiPanelOverflow(400, 200, 50).sizeNeeded).toBe(500);
  });
});

describe('A5: AI rate columns are documented as percentages, 0-100', () => {
  it('every rate column says 0-100 and none says 0-1', () => {
    const t = EXPORT_TABLES.find((x) => x.id === 'ai_visibility')!;
    for (const c of ['mention_rate', 'mention_lo', 'mention_hi', 'citation_rate', 'share_of_voice', 'aio_presence', 'aio_citation_rate']) {
      const d = t.columns.find((x) => x.name === c)!.description;
      expect(d, c).toMatch(/0-100/);
      expect(d, c).not.toMatch(/\(0-1\)/);
    }
    expect(t.columns.some((c) => c.name === 'credits_charged')).toBe(true);
  });
});

describe('A18: the precision table follows the pulse setting the cost box uses', () => {
  it('a fixed 1 morning a week is wider than automatic at 200 questions', () => {
    const auto = aiPrecisionTable({ panel: 200, pulse: true }).rows.find((r) => r.current)!;
    const one = aiPrecisionTable({ panel: 200, pulse: true, pulseMode: 'sample', pulsePerWeek: 1 }).rows.find((r) => r.current)!;
    expect(one.answers).toBeLessThan(auto.answers);
  });
});
