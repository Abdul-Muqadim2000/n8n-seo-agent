import { describe, expect, it } from 'vitest';
import { chooseForMe, forYouLabel, ladderOverlapsOf, recommendedFromStrategy, toAssessment, type LadderKeywords } from './keywords';
import { keywordAssessSchema, siteAutomationFormSchema, siteAutomationSchema } from './schemas';

// The keyword_strategy callback as n8n's Build_Ideas_Response.js sends it (v4.8: labels for the website).
const kw = (keyword: string, o: Record<string, unknown> = {}) => ({ keyword, volume: 100, kd: 20, intent: 'commercial', page_type: 'Service Page', why: '', difficulty_for_you: null, plan_type: null, months: null, label: null, ...o });
const easy = { difficulty_for_you: 'easy', plan_type: 'direct', months: '2-4', label: 'Easy for your site · Direct plan · 2-4 months' };
const reachable = { difficulty_for_you: 'reachable', plan_type: 'short', months: '4-8', label: 'Reachable for your site · Short ladder · 4-8 months' };
const hard = { difficulty_for_you: 'hard', plan_type: 'full', months: '9-15', label: 'Hard for your site · Full ladder · 9-15 months' };

const ladders: LadderKeywords[] = [{ id: 'lad_inv', head: 'e invoicing in uae', keywords: ['peppol uae', 'e invoicing in uae', 'fta e invoicing deadline'] }];

describe('recommended keywords from the keyword strategy', () => {
  const payload = {
    stage: 'keyword_strategy',
    reach: { reach: 30 },
    start_with: kw('erp software dubai', { ...hard, why: 'High buyer intent with 0.123456 CPC ratio' }),
    priority: [kw('ERP software Dubai', hard), kw('odoo partner uae', easy), kw('UAE e-invoicing', reachable), kw('erp implementation cost uae', reachable)],
    quick_wins: [kw('odoo pricing uae', easy), kw('peppol uae', easy)],
    content_plan: [
      { tier: 'Now', topic: 'Odoo', primary_keyword: 'odoo implementation uae', keyword_count: 6, total_volume: 900, page_type: 'Pillar Page', ...reachable },
      { tier: 'Later', topic: 'Payroll', primary_keyword: 'payroll software uae', keyword_count: 3, total_volume: 400 },
    ],
  };

  it('one card per search, within reach first, the discovery’s order next, overlapping ladders last', () => {
    const list = recommendedFromStrategy(payload, ladders);
    expect(list.map((k) => [k.keyword, k.difficultyForYou, k.source, k.overlaps.length])).toEqual([
      ['odoo partner uae', 'easy', 'priority', 0],
      ['odoo pricing uae', 'easy', 'quick_win', 0],
      ['erp implementation cost uae', 'reachable', 'priority', 0],
      ['odoo implementation uae', 'reachable', 'content_plan', 0],
      ['erp software dubai', 'hard', 'start_with', 0],
      ['peppol uae', 'easy', 'quick_win', 1],
      ['uae e-invoicing', 'reachable', 'priority', 1],
    ]);
    const start = list.find((k) => k.source === 'start_with')!;
    expect(start.why).toBe('High buyer intent with 0.12 CPC ratio');
    expect(start.label).toBe('Hard for your site · Full ladder · 9-15 months');
    expect(list.find((k) => k.keyword === 'uae e-invoicing')!.overlaps).toEqual([{ ladderId: 'lad_inv', head: 'e invoicing in uae', keyword: 'e invoicing in uae' }]);
    expect(list.find((k) => k.keyword === 'odoo implementation uae')!.why).toBe('Topic “Odoo”: 6 related searches on one page');
    // "Later" topics are not ladder candidates
    expect(list.some((k) => k.keyword === 'payroll software uae')).toBe(false);
  });

  it('Choose for me: the first easy or reachable card no ladder covers', () => {
    const list = recommendedFromStrategy(payload, ladders);
    expect(chooseForMe(list)?.keyword).toBe('odoo partner uae');
    expect(chooseForMe(list.filter((k) => k.difficultyForYou !== 'easy'))?.keyword).toBe('erp implementation cost uae');
    expect(chooseForMe(list.filter((k) => k.difficultyForYou === 'hard' || k.overlaps.length))).toBeNull();
  });

  it('a report without a website (no labels): not rated, nothing chosen automatically', () => {
    const list = recommendedFromStrategy({ priority: [kw('crm for dentists'), kw('dental crm')] }, []);
    expect(list.map((k) => [k.keyword, k.difficultyForYou, k.label])).toEqual([
      ['crm for dentists', null, ''],
      ['dental crm', null, ''],
    ]);
    expect(chooseForMe(list)).toBeNull();
  });

  it('caps the list and ignores junk', () => {
    const many = Array.from({ length: 30 }, (_, i) => kw(`keyword number ${i}`, easy));
    expect(recommendedFromStrategy({ priority: [...many, { keyword: '' }, null, 'x', { keyword: 'a' }] }, [], 12)).toHaveLength(12);
    expect(recommendedFromStrategy({}, [])).toEqual([]);
  });
});

describe('overlap with ladders', () => {
  it('same words or 75%+ the same, main or page keyword', () => {
    expect(ladderOverlapsOf('E-invoicing in the UAE', ladders).map((o) => o.ladderId)).toEqual(['lad_inv']);
    expect(ladderOverlapsOf('peppol in uae', ladders)[0].keyword).toBe('peppol uae');
    expect(ladderOverlapsOf('e invoicing software uae', ladders)).toEqual([]);
  });
});

describe('the keyword check’s answer', () => {
  it('maps the engine’s answer (labels as n8n words them)', () => {
    const a = toAssessment({
      ok: true,
      keyword: 'e invoicing software uae',
      country: 'United Arab Emirates',
      volume: 480,
      kd: 38,
      intent: 'commercial',
      cpc: 7.25,
      position: null,
      reach: 30,
      difficulty_for_you: 'reachable',
      plan_type: 'short',
      months: '4-8',
      fit: 2,
      navigational: false,
      alternatives: [],
      cost_usd: 0.042,
      label: 'Reachable for your site · Short ladder · 4-8 months',
      stretch: false,
      warnings: [],
    });
    expect(a).toMatchObject({ volume: 480, kd: 38, reach: 30, difficultyForYou: 'reachable', planType: 'short', months: '4-8', fit: 2, position: null, navigational: false });
  });
  it('not realistic: no months, alternatives kept; unknown values are null', () => {
    const a = toAssessment({ keyword: 'cleartax login', difficulty_for_you: 'not_realistic', plan_type: 'none', months: '', fit: 'x', navigational: true, alternatives: ['E invoicing software UAE', 'e invoicing software uae', 'fta e invoicing'], position: 0 });
    expect(a).toMatchObject({ difficultyForYou: 'not_realistic', planType: 'none', months: '', fit: null, position: null, navigational: true, label: 'Not realistic for your site' });
    expect(a.alternatives).toEqual(['e invoicing software uae', 'fta e invoicing']);
    expect(toAssessment({})).toMatchObject({ keyword: '', volume: null, difficultyForYou: null, planType: null, label: '' });
  });
  it('forYouLabel matches n8n’s reachLabel', () => {
    expect(forYouLabel('easy', 'direct', '2-4')).toBe('Easy for your site · Direct plan · 2-4 months');
    expect(forYouLabel('very_hard', 'full', '9-15', true)).toBe('Very hard for your site · Full ladder (stretch) · 9-15 months');
    expect(forYouLabel('not_realistic', 'none', '')).toBe('Not realistic for your site');
    expect(forYouLabel(null, 'full', '9-15')).toBe('');
  });
});

describe('schemas', () => {
  it('keyword check: 2-100 characters, cleaned; the country is optional but must be known', () => {
    expect(keywordAssessSchema.parse({ keyword: '  E Invoicing   UAE ' })).toEqual({ keyword: 'e invoicing uae' });
    expect(keywordAssessSchema.safeParse({ keyword: 'x' }).success).toBe(false);
    expect(keywordAssessSchema.safeParse({ keyword: 'a'.repeat(101) }).success).toBe(false);
    expect(keywordAssessSchema.safeParse({ keyword: 'erp dubai', country: 'Narnia' }).success).toBe(false);
    expect(keywordAssessSchema.parse({ keyword: 'erp dubai', country: 'United Arab Emirates' }).country).toBe('United Arab Emirates');
  });
  it('pipeline settings: "Choose keywords for me" is a boolean of the form and optional in PATCH', () => {
    expect(siteAutomationFormSchema.safeParse({ defaultMode: 'auto', opportunities: 'auto', maxActiveLadders: 2, maxWaiting: 3 }).success).toBe(false);
    expect(siteAutomationFormSchema.parse({ defaultMode: 'auto', opportunities: 'auto', autoStartLadders: true, maxActiveLadders: 2, maxWaiting: 3 }).autoStartLadders).toBe(true);
    expect(siteAutomationSchema.parse({ autoStartLadders: false })).toEqual({ autoStartLadders: false });
    expect(siteAutomationSchema.safeParse({ autoStartLadders: 'yes' }).success).toBe(false);
  });
});
