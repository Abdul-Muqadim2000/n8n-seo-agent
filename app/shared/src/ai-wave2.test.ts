import { describe, expect, it } from 'vitest';
import {
  aiAnswerDetail,
  aiEngineRatesOf,
  aiLatestExtras,
  aiLegacySourcesList,
  aiSovOf,
  parseAiImpact,
  parseAiSentiment,
  parseAiSources2,
  parseAiShopping,
} from './ai-detail';
import { aiAlertRulesOf, aiAlertRulesSchema, aiFilterFrom, aiFilterQuery, aiFilterSegment, aiMatchesFilter, aiOpenRunNote, aiRulePreview, aiRuleSentence, aiTrendRows, aiTwoProp, aiWilson, type AiRuleRun } from './ai-trends';
import { parseAiImport } from './ai-import';
import { AI_EXPORT_COLUMNS, aiCsvLine, parseAiPanelCsvWithKeyword } from './ai-export';
import { monitorSettingsSchema, adminActionSchema } from './schemas';
import { monitorsBody } from './payload';
import type { AiCompare } from './ai-compare';

// W2-A (2026-10-23, WAVE2_CONTRACTS.md): the app's readers of the engine's wave-2 columns, the filter, trends with breaks, owner alert
// rules, the open-run note, the AI report imports and the CSV downloads.

describe('§1 answer columns', () => {
  const row = {
    answer_text: 'Acme and Globex lead. See https://techand.ai/erp for more.',
    cited_json: JSON.stringify([{ url: 'https://globex.com/x', host: 'globex.com', entity_id: 'globex', role: 'competitor', position: 2 }, { url: 'https://www.techand.ai/erp', position: 1 }]),
    retrieved_json: JSON.stringify([{ url: 'https://techand.ai/pricing' }, { url: 'https://acme.com/a', entity_id: 'acme' }]),
    fanout_json: JSON.stringify(['best erp uae', 'erp partner dubai']),
    products_json: JSON.stringify([{ title: 'ERP Pro', merchant: 'Acme', price: '99.5', currency: 'USD', url: 'https://acme.com/p', position: 1 }]),
    ads_json: JSON.stringify([{ advertiser: 'Initech', url: 'https://initech.com', rendered: true }]),
    local_json: '[]',
    model: 'gpt-5',
    detail_json: JSON.stringify({ answer_cut: true }),
  };
  it('reads every column, orders citations and marks our own URLs (www and subdomains)', () => {
    const d = aiAnswerDetail(row, 'techand.ai');
    expect(d.answerText).toContain('Acme');
    expect(d.answerCut).toBe(true);
    expect(d.citations?.map((c) => c.url)).toEqual(['https://www.techand.ai/erp', 'https://globex.com/x']);
    expect(d.citations?.[0].own).toBe(true);
    expect(d.retrieved?.find((r) => r.url.includes('pricing'))?.own).toBe(true);
    expect(d.fanoutQueries).toEqual(['best erp uae', 'erp partner dubai']);
    expect(d.products?.[0]).toMatchObject({ price: 99.5, own: false });
    expect(d.ads?.[0]).toMatchObject({ host: 'initech.com', rendered: true });
    expect(d.local).toEqual([]);
    expect(d.model).toBe('gpt-5');
  });
  it('an older row has none of it: null, never an empty list read as "nothing cited"', () => {
    const d = aiAnswerDetail({ excerpt: 'old' }, 'techand.ai');
    expect(d).toMatchObject({ answerText: null, citations: null, retrieved: null, fanoutQueries: null, products: null, ads: null, local: null, model: null });
  });
});

describe('§2 visibility columns', () => {
  it('an older row (no wave-2 column, the old sources_json array) reads as all-null blocks', () => {
    const x = aiLatestExtras({ sources_json: JSON.stringify([{ domain: 'g2.com', citations: 3 }]), alerts: '' });
    expect(Object.entries(x).filter(([k, v]) => k !== 'execIds' && v != null)).toEqual([]);
    expect(x.execIds).toEqual([]);
  });
  it('sources: types sorted by count, domains with half-life (null kept as unknown)', () => {
    const s = parseAiSources2({ types: { ugc: { n: 4, share: 40 }, own: { n: 6, share: 60 } }, domains: [{ host: 'reddit.com', type: 'ugc', cited_n: 4, share: 40, first_seen: '2026-09-01', last_seen: '2026-10-20', half_life_days: null }], n: 10 });
    expect(s?.types.map((t) => t.type)).toEqual(['own', 'ugc']);
    expect(s?.domains[0].halfLifeDays).toBeNull();
  });
  it('shopping with no products reads "no shopping results", never 0%', () => {
    expect(parseAiShopping({ answers_n: 40, products_n: 0, trigger_rate: 0 })?.status).toBe('no shopping results');
    expect(parseAiShopping({ status: 'measured', answers_n: 40, products_n: 5, trigger_rate: 12.5 })?.status).toBe('measured');
  });
  it('sentiment is withheld under 12 answers: no net, no aspects', () => {
    const s = parseAiSentiment({ net: 40, net_lo: 10, net_hi: 60, n: 8, by_aspect: [{ aspect: 'price', pos: 3, neg: 1 }] });
    expect(s).toMatchObject({ withheld: true, net: null, byAspect: [] });
    expect(parseAiSentiment({ net: 40, n: 30, by_aspect: [{ aspect: 'price', pos: 3, neg: 1, n: 4 }] })?.byAspect).toHaveLength(1);
  });
  it('impact: only the engine three words; anything else is "can\'t tell", never "caused"', () => {
    const v = parseAiImpact([{ action_id: 'a1', verdict: 'caused' }, { action_id: 'a2', verdict: 'likely helped', did: { effect: 8, lo: 2, hi: 14 } }]);
    expect(v?.map((x) => x.verdict)).toEqual(["can't tell", 'likely helped']);
    expect(v?.[1].did).toEqual({ effect: 8, lo: 2, hi: 14 });
  });
  it('per-run engine rates and share of voice: the fixed set when stored, else every brand named', () => {
    expect(aiEngineRatesOf(JSON.stringify({ chatgpt: { name: 'ChatGPT', mention_rate: 10, citation_rate: 2, samples: 40, ci: [4, 22] } }))[0]).toMatchObject({ key: 'chatgpt', mentionRate: 10, ci: [4, 22] });
    expect(aiSovOf('', JSON.stringify([{ domain: 'acme.com', share: 30, mentions: 12 }]))).toEqual({ basis: 'all', brands: [{ id: 'acme.com', name: 'acme.com', share: 30, n: 12 }] });
    expect(aiSovOf(JSON.stringify({ set: ['acme'], by_entity: [{ id: 'acme', name: 'Acme', share: 50, n: 20 }] }), '[]').basis).toBe('set');
  });
});

describe('filter', () => {
  it('from a URL: trimmed, dates only as YYYY-MM-DD, round trip keeps only set keys', () => {
    const f = aiFilterFrom(new URLSearchParams('engine=chatgpt&cluster=%20erp%20&from=2026-10-01&to=yesterday'));
    expect(f).toMatchObject({ engine: 'chatgpt', cluster: 'erp', from: '2026-10-01', to: '' });
    expect(aiFilterQuery(f)).toEqual({ engine: 'chatgpt', cluster: 'erp', from: '2026-10-01' });
  });
  it('one dimension is a segment with its own trend; two are not', () => {
    expect(aiFilterSegment(aiFilterFrom({ persona: 'CFO', from: '2026-01-01' }))).toEqual({ dim: 'persona', key: 'CFO' });
    expect(aiFilterSegment(aiFilterFrom({ persona: 'CFO', market: 'AE-en' }))).toBeNull();
  });
  it('answers match on the engine and on the question facets', () => {
    const f = aiFilterFrom({ engine: 'gemini', persona: 'CFO' });
    expect(aiMatchesFilter({ engine: 'gemini', promptId: 'p' }, { cluster: '', persona: 'CFO', market: '', stage: '' }, f)).toBe(true);
    expect(aiMatchesFilter({ engine: 'gemini', promptId: 'p' }, undefined, f)).toBe(false);
    expect(aiMatchesFilter({ engine: 'chatgpt', promptId: 'p' }, { cluster: '', persona: 'CFO', market: '', stage: '' }, f)).toBe(false);
  });
});

const cmp = (comparable: boolean, metrics: AiCompare['metrics'] = {}): AiCompare => ({ source: 'engine', ruleVersion: '1', comparable, reason: comparable ? null : 'a different panel', previousRunId: null, previousAt: null, panelOverlap: null, enginesSame: null, window: null, metrics });

describe('trend rows', () => {
  it('a not-comparable run starts a new segment: a gap row between, a break marker with the reason', () => {
    const runs = [
      { runId: 'a', checkedAt: '2026-10-05T07:00:00.000Z', compare: null, v: 5 },
      { runId: 'b', checkedAt: '2026-10-12T07:00:00.000Z', compare: cmp(true), v: 6 },
      { runId: 'c', checkedAt: '2026-10-19T07:00:00.000Z', compare: cmp(false), v: 20 },
    ];
    const t = aiTrendRows(runs, (r) => ({ named: r.v }));
    expect(t.rows).toHaveLength(4);
    expect(t.rows[2]).toMatchObject({ gap: true });
    expect(t.rows[2].named).toBeUndefined();
    expect(t.breaks).toEqual([{ at: '2026-10-19T07:00:00.000Z', reason: 'a different panel' }]);
  });
  it('Wilson and the two-proportion test match the engine (untested under 12 a side, 5-point floor)', () => {
    expect(aiWilson(0, 0)).toBeNull();
    expect(aiWilson(5, 50)).toEqual([4.3, 21.4]);
    expect(aiTwoProp(30, 11, 10, 100).significant).toBeNull();
    expect(aiTwoProp(30, 200, 10, 200).significant).toBe(true);
    expect(aiTwoProp(12, 200, 10, 200).significant).toBe(false);
  });
});

describe('owner alert rules', () => {
  const rule = { id: 'r1', metric: 'named_rate' as const, scope: {}, direction: 'drop' as const, threshold_points: 5, enabled: true };
  it('validates: competitor rules need a competitor, ids are unique, at most 20', () => {
    expect(aiAlertRulesSchema.safeParse([rule]).success).toBe(true);
    expect(aiAlertRulesSchema.safeParse([{ ...rule, metric: 'competitor_share' }]).success).toBe(false);
    expect(aiAlertRulesSchema.safeParse([rule, rule]).success).toBe(false);
    expect(aiAlertRulesSchema.safeParse(Array.from({ length: 21 }, (_, i) => ({ ...rule, id: 'r' + i }))).success).toBe(false);
    expect(aiAlertRulesSchema.safeParse([{ ...rule, threshold_points: 0.1 }]).success).toBe(false);
  });
  it('the stored JSON is read back tolerantly (a bad rule dropped)', () => {
    expect(aiAlertRulesOf(JSON.stringify([rule, { id: 'x' }]))).toHaveLength(1);
    expect(aiAlertRulesOf('not json')).toEqual([]);
  });
  it('a rule in words', () => {
    expect(aiRuleSentence({ ...rule, scope: { engine: 'chatgpt' } }, () => 'ChatGPT')).toBe('Named in answers on ChatGPT drops by 5 points or more');
    expect(aiRuleSentence({ ...rule, metric: 'avg_position', direction: 'drop', threshold_points: 2 })).toBe('Average place named gets worse by 2 places or more');
  });
  it('preview: fires only on a comparable pair whose own test passed and whose change reaches the threshold', () => {
    const runs: AiRuleRun[] = [
      { runId: 'a', checkedAt: '2026-10-05', compare: null },
      { runId: 'b', checkedAt: '2026-10-12', compare: cmp(true, { named_rate: { now: 4, prev: 12, delta: -8, nNow: 300, nPrev: 300, significant: true, p: 0.001 } }) },
      { runId: 'c', checkedAt: '2026-10-19', compare: cmp(true, { named_rate: { now: 1, prev: 4, delta: -3, nNow: 300, nPrev: 300, significant: true, p: 0.01 } }) },
      { runId: 'd', checkedAt: '2026-10-26', compare: cmp(true, { named_rate: { now: -5, prev: 1, delta: -6, nNow: 30, nPrev: 30, significant: false, p: 0.2 } }) },
      { runId: 'e', checkedAt: '2026-11-02', compare: cmp(false) },
    ];
    const p = aiRulePreview(rule, runs);
    expect(p.fired.map((f) => f.at)).toEqual(['2026-10-12']);
    expect(p).toMatchObject({ evaluated: 3, notComparable: 1, untested: 0 });
    // a noisy change inside the range (significant false) never fires, whatever its size
    expect(aiRulePreview({ ...rule, threshold_points: 1 }, runs).fired).toHaveLength(2);
  });
  it('preview of an engine rule tests the engine\'s own rates; a topic rule is not replayed (said so)', () => {
    const e = (r: number, n: number) => [{ key: 'chatgpt', mentionRate: r, citationRate: 0, samples: n }];
    const runs: AiRuleRun[] = [
      { runId: 'a', checkedAt: '2026-10-05', compare: null, engines: e(30, 200) },
      { runId: 'b', checkedAt: '2026-10-12', compare: cmp(true), engines: e(10, 200) },
    ];
    expect(aiRulePreview({ ...rule, scope: { engine: 'chatgpt' } }, runs).fired).toHaveLength(1);
    expect(aiRulePreview({ ...rule, scope: { cluster: 'erp' } }, runs).unavailable).toMatch(/segment/);
  });
});

describe('open run (§6)', () => {
  it('reason open_run becomes "Part of the open run (finishes about ...)" with the engine sentence; other reasons none', () => {
    const n = aiOpenRunNote({ reason: 'open_run', error: 'A run of 200 questions is in progress.', open_run: { expected_finish: '2099-01-01T09:40:00.000Z' } });
    expect(n).toBe('Part of the open run (finishes about 09:40 UTC on 2099-01-01). A run of 200 questions is in progress.');
    expect(aiOpenRunNote({ reason: 'run_stopped' })).toBeNull();
  });
});

describe('AI report imports (§5)', () => {
  // ASSUMED headers (see ai-import.ts): Bing AI Performance pages-by-day and Search Console's Queries / Pages / Dates CSV
  const bing = 'Date,Page,Citations\r\n2026-10-20,https://www.techand.ai/erp,4\r\n2026-10-20,https://techand.ai/erp,1\r\n2026-10-21,https://techand.ai/pricing,2\r\n2026-10-21,https://other.com/x,9\r\n';
  it('Bing: citations per page and day, www merged, a stray other-site row skipped', () => {
    const r = parseAiImport(bing, 'techand.ai');
    expect(r.source).toBe('bing_ai');
    expect(r.rows).toHaveLength(3);
    expect(r.totals.citations).toBe(7);
    expect(r.days).toEqual({ from: '2026-10-20', to: '2026-10-21' });
    expect(r.skipped).toBe(1);
  });
  it('a file for another website is refused, naming it', () => {
    expect(() => parseAiImport('Page,Citations\nhttps://acme.com/a,3\nhttps://acme.com/b,2\n', 'techand.ai')).toThrow(/acme\.com, not techand\.ai/);
  });
  it('Search Console Queries file: no date, dated on the period end; percent CTR ignored', () => {
    const r = parseAiImport('Top queries,Clicks,Impressions,CTR,Position\nerp uae,3,"1,200",0.25%,4.1\ncrm dubai,0,40,0%,9\n', 'techand.ai', { periodEnd: '2026-10-22' });
    expect(r.source).toBe('gsc_ai');
    expect(r.rows[0]).toMatchObject({ day: '2026-10-22', query: 'erp uae', impressions: 1200, clicks: 3, url: '' });
    expect(r.label).toMatch(/period ending 2026-10-22/);
  });
  it('a file with no figure column is refused with a sentence', () => {
    expect(() => parseAiImport('Name,Notes\na,b\n', 'techand.ai')).toThrow();
    expect(() => parseAiImport('', 'techand.ai')).toThrow(/no rows/);
  });
});

describe('CSV downloads and the import keyword column', () => {
  it('a line neutralises formulas and quotes every cell', () => {
    expect(aiCsvLine(['=SUM(A1)', 'a"b', 3])).toBe('"\'=SUM(A1)","a""b","3"\r\n');
    expect(AI_EXPORT_COLUMNS.answers).toContain('answer_text');
  });
  it('the panel import reads an optional keyword column; the rest of the import is unchanged', () => {
    const r = parseAiPanelCsvWithKeyword('question,buyer role,keyword\nWhich ERP partner fits a retailer in Riyadh?,CFO,erp partner riyadh\nWhich payroll tool suits a small firm?,,\n');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].keyword).toBe('erp partner riyadh');
    expect(r.rows[1].keyword).toBeUndefined();
    expect(r.keywords).toBe(1);
  });
});

describe('monitor settings (§4): nothing new is sent unless set', () => {
  it('the defaults send none of the wave-2 keys (every website keeps today\'s cost)', () => {
    const body = monitorsBody(monitorSettingsSchema.parse({}));
    for (const k of ['ai_claude_weekly', 'ai_pulse_engines', 'ai_persona_context', 'ai_fanout_check', 'ai_sov_set', 'ai_alert_rules_json']) expect(body).not.toHaveProperty(k);
  });
  it('set ones go out in the engine field names; fan-out only 0 / 25 / 50 / 100', () => {
    const a = adminActionSchema.parse({ action: 'monitors', monitors: { aiClaudeWeekly: true, aiPulseEngines: ['chatgpt', 'perplexity'], aiFanoutCheck: 50, aiAlertRules: [{ id: 'r1', metric: 'named_rate', threshold_points: 5 }] } });
    if (a.action !== 'monitors') throw new Error('x');
    expect(monitorsBody(a.monitors)).toMatchObject({ ai_claude_weekly: true, ai_pulse_engines: 'chatgpt, perplexity', ai_fanout_check: 50 });
    expect(JSON.parse(String(monitorsBody(a.monitors).ai_alert_rules_json))[0]).toMatchObject({ id: 'r1', direction: 'drop', enabled: true });
    expect(adminActionSchema.safeParse({ action: 'monitors', monitors: { aiFanoutCheck: 30 } }).success).toBe(false);
  });
});

describe('W2-E1 contract update (2026-10-23)', () => {
  it('sources_json as {v: 2, types, domains, list}: the legacy list is `list`, the new panel reads types / domains; an old array still reads', () => {
    const obj = { v: 2, types: { ugc: { n: 2, share: 100 } }, domains: [{ host: 'reddit.com', type: 'ugc', cited_n: 2 }], n: 2, list: [{ domain: 'reddit.com', citations: 2 }] };
    expect(aiLegacySourcesList(JSON.stringify(obj))).toEqual([{ domain: 'reddit.com', citations: 2 }]);
    expect(aiLegacySourcesList(JSON.stringify([{ domain: 'g2.com' }]))).toEqual([{ domain: 'g2.com' }]);
    expect(parseAiSources2(JSON.stringify(obj))?.domains[0].host).toBe('reddit.com');
  });
  it('"no shopping results" carries no rate, even when the row says 0', () => {
    expect(parseAiShopping({ status: 'no shopping results', trigger_rate: 0, own_presence_rate: 0, answers_n: 30 })).toMatchObject({ triggerRate: null, ownPresenceRate: null });
  });
  it('a blanked answer (kept 35 days) is told apart from a row that never had one; [] is "showed none", absent is "not reported"', () => {
    const old = aiAnswerDetail({ answer_text: '', retrieved_json: '', products_json: '[]', ads_json: '', detail_json: JSON.stringify({ answer_len: 4200, analysed: true }) }, 'techand.ai');
    expect(old).toMatchObject({ answerText: null, answerExpired: true, answerLen: 4200, retrieved: null, products: [], ads: null });
    expect(aiAnswerDetail({ excerpt: 'x' }, 'techand.ai').answerExpired).toBe(false);
  });
  it('the question import accepts the stage "shopping"', () => {
    const r = parseAiPanelCsvWithKeyword('question,stage\nWhich running shoes are best for flat feet?,shopping\nWhich ERP partner fits a retailer?,decision\n');
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.stage)).toEqual(['shopping', 'decision']);
  });
});
