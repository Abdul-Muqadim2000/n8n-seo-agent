// G6 (2026-10-18): the panel manager's CSV import, the segments and panel the AI visibility page reads, and the settings that reach the
// engine. The cost formula has its own golden-case test (cost.aipanel.test.ts).
import { describe, expect, it } from 'vitest';
import { aiPanelFromJson, aiSegmentsFromJson, parseAiPanelCsv } from './ai-panel';
import { monitorsBody } from './payload';
import { adminActionSchema, monitorSettingsSchema } from './schemas';

describe('parseAiPanelCsv', () => {
  it('reads a header in any order, normalises market / cluster / stage / pin, and skips repeats and blank lines', () => {
    const r = parseAiPanelCsv('Market,Question,Buyer role,Cluster,Stage,Pinned\nsa-EN,"Which payroll software suits a 50-person company in Riyadh?",CFO,Payroll Software,decision,yes\n\n,  \nAE,"Which payroll software suits a 50-person company in Riyadh?",CFO,x,,\nAE,How do I choose an ERP partner for a distributor?,IT manager,ERP,consideration,no\n');
    expect(r.errors).toEqual([]);
    expect(r.skipped).toBe(1);
    expect(r.rows).toEqual([
      { prompt: 'Which payroll software suits a 50-person company in Riyadh?', persona: 'CFO', cluster: 'payroll software', stage: 'decision', market: 'SA-en', pinned: true },
      { prompt: 'How do I choose an ERP partner for a distributor?', persona: 'IT manager', cluster: 'erp', stage: 'consideration', market: 'AE-en', pinned: false },
    ]);
  });
  it('without a header the first column is the question; quotes, doubled quotes, commas and semicolon files', () => {
    const r = parseAiPanelCsv('"Which firms handle VAT, payroll and audit in Dubai?"\n"What does a ""fractional CFO"" cost in Abu Dhabi?"');
    expect(r.rows.map((x) => x.prompt)).toEqual(['Which firms handle VAT, payroll and audit in Dubai?', 'What does a "fractional CFO" cost in Abu Dhabi?']);
    const s = parseAiPanelCsv('question;market\nWhich ERP vendors support Arabic invoices?;SA-ar');
    expect(s.rows[0]).toMatchObject({ prompt: 'Which ERP vendors support Arabic invoices?', market: 'SA-ar' });
  });
  it('names every line it refuses, with the reason, and saves none of them', () => {
    const r = parseAiPanelCsv('question,stage,market\nToo short,,\nWhich ERP partner fits a retailer?,purchase,\nWhich ERP partner fits a wholesaler?,,Dubai\n' + 'x'.repeat(301) + ',,');
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
    expect(r.errors[1].message).toMatch(/awareness, consideration or decision/);
    expect(r.errors[2].message).toMatch(/country code and a language/);
  });
  it('stops at 500 questions', () => {
    const r = parseAiPanelCsv(Array.from({ length: 520 }, (_, i) => `Which provider is best for need number ${i}?`).join('\n'));
    expect(r.rows.length).toBe(500);
    expect(r.skipped).toBe(20);
  });
  it('an empty file says so', () => expect(parseAiPanelCsv('').errors[0].message).toMatch(/empty/));
});

describe('aiSegmentsFromJson / aiPanelFromJson', () => {
  it('expands the compact stored rows with their 95% range and the too-few rule', () => {
    const s = aiSegmentsFromJson(JSON.stringify({ v: 1, cols: ['dim', 'key', 'questions', 'n', 'k', 'cited', 'sov', 'leader', 'pulse_n', 'delta', 'significant'],
      rows: [['cluster', 'payroll', 40, 210, 30, 5, 12.5, 'rival.com', 60, -12.3, true], ['market', 'QA-en', 2, 10, 1, 0, null, '', 0, null, null]],
      family: { method: 'benjamini-hochberg', q: 0.1, tests: 7, rejected: 1, note: 'n' }, moves: [{ dim: 'cluster', key: 'payroll', rate: 14.3, delta: -12.3, n: 210 }], min_answers: 12 }))!;
    expect(s.rows[0]).toMatchObject({ dim: 'cluster', key: 'payroll', n: 210, k: 30, rate: 14.3, enough: true, sov: 12.5, leader: 'rival.com', delta: -12.3, significant: true });
    expect(s.rows[0].ci).toEqual([10.2, 19.7]);
    expect(s.rows[1]).toMatchObject({ enough: false, rate: 10, significant: null });
    expect(s.family?.method).toBe('benjamini-hochberg');
    expect(aiSegmentsFromJson('')).toBeNull();
  });
  it('the panel record without its question ids', () => {
    const p = aiPanelFromJson({ ids: ['a', 'b'], size: 2, setting: 100, engines: ['chatgpt'], composition: { cluster: { x: 2 }, persona: {}, market: { 'AE-en': 2 }, stage: {} },
      overlap_with_previous: { share: 0.5, same: false, common: 1 }, half_width: { measured: { headline: 2.1, median_cluster: 7 }, achievable: { headline: 1.2, cluster: 7.5, per_week: 3 } }, executions: 2 })!;
    expect(p).toMatchObject({ size: 2, setting: 100, overlapWithPrevious: { same: false }, executions: 2, halfWidth: { achievable: { perWeek: 3 } } });
    expect(JSON.stringify(p)).not.toMatch(/"ids"/);
  });
});

describe('panel settings and the panel manager reach the engine', () => {
  it('buyer roles, markets and the pulse sampling are validated and sent as Site Admin fields', () => {
    const m = monitorSettingsSchema.parse({ aiPersonas: ['CFO', 'IT manager'], aiMarkets: ['SA-en'], aiPulseMode: 'sample', aiPulsePerWeek: 2 });
    expect(monitorsBody(m)).toMatchObject({ ai_personas: 'CFO, IT manager', ai_markets: 'SA-en', ai_pulse_mode: 'sample', ai_pulse_per_week: 2 });
    expect(monitorSettingsSchema.safeParse({ aiMarkets: ['Dubai'] }).success).toBe(false);
    expect(monitorSettingsSchema.safeParse({ aiPersonas: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }).success).toBe(false);
    expect(monitorSettingsSchema.safeParse({ aiPulsePerWeek: 7 }).success).toBe(false);
  });
  it('ai_prompts takes up to 500 questions with their fields, and edit / enable / pin / unpin', () => {
    const ok = adminActionSchema.parse({ action: 'ai_prompts', add: ['Which payroll software suits a small company?', { prompt: 'Which ERP partner fits a retailer in Riyadh?', persona: 'CFO', market: 'SA-en', pinned: true }], edit: [{ promptId: 'p_1', persona: 'CFO' }], pin: ['p_2'] });
    expect(ok.action === 'ai_prompts' && ok.add.length === 2 && ok.edit[0].promptId === 'p_1' && ok.enable.length === 0).toBe(true);
    expect(adminActionSchema.safeParse({ action: 'ai_prompts', add: Array.from({ length: 501 }, (_, i) => `Question number ${i} about payroll?`) }).success).toBe(false);
    expect(adminActionSchema.safeParse({ action: 'ai_prompts', add: [{ prompt: 'Which ERP partner fits a retailer?', stage: 'purchase' }] }).success).toBe(false);
  });
});
