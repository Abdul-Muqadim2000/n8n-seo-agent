import { describe, expect, it } from 'vitest';
import { baseRateText, CAREER_NOTE, chanceLabel, checkEvidenceLines, chanceText, chooseForMe, FIT_UNKNOWN_NOTE, forYouLabel, ladderOverlapsOf, PLAN_CHANCE, planChance, REACH_BASE_RATE, reachMeasured, recommendedFromStrategy, SERVICE_OUT_NOTE, toAssessment, toChance, UNMEASURED_CHANCE, type LadderKeywords } from './keywords';

// FIX_PLAN G3 (2026-10-11): the 2025 base rate and the chance band per plan, the same words as n8n's _reach.js (reachChance / reachBaseRateText /
// reachChanceText); the band is marked uncalibrated everywhere until the system has measured its own ladders.
describe('time to rank: 2025 base rate and the chance band per plan', () => {
  it('cites the 2025 Ahrefs figures, never the 2017 one', () => {
    expect(REACH_BASE_RATE.year).toBe(2025);
    expect(REACH_BASE_RATE.top10WithinYearPct).toBe(1.74);
    expect(REACH_BASE_RATE.ofThoseWithinMonthPct).toBe(40.8);
    expect(baseRateText()).toBe("Base rate (Ahrefs, 2025): only 1.74% of new pages reach Google's top 10 within a year, and 40.8% of those do so within a month. The rest take months.");
    expect(baseRateText()).not.toContain('5.7');
  });
  it('one band per plan type, a stretch band for very hard keywords, none without a ladder', () => {
    expect(planChance('direct')).toEqual({ band: 'good', range: [50, 70] });
    expect(planChance('short')).toEqual({ band: 'fair', range: [30, 50] });
    expect(planChance('full')).toEqual({ band: 'low', range: [15, 30] });
    expect(planChance('full', true)).toEqual({ band: 'slim', range: [5, 15] });
    expect(planChance('none')).toEqual({ band: 'none', range: [0, 0] });
    expect(planChance(null)).toEqual(PLAN_CHANCE.none);
  });
  it('chanceLabel matches n8n\'s reachChance().label and says uncalibrated', () => {
    expect(chanceLabel('direct')).toBe('estimated chance good (50-70%, uncalibrated)');
    expect(chanceLabel('full', true)).toBe('estimated chance slim (5-15%, uncalibrated)');
    expect(chanceLabel('none')).toBe('');
    expect(chanceLabel(null)).toBe('');
  });
  it('chanceText matches n8n\'s reachChanceText: band, uncalibrated, base rate', () => {
    expect(chanceText('short', '4-8')).toBe(
      "Estimated chance of reaching the top 10 within 4-8 months: fair (30-50%): an uncalibrated estimate until this system has measured its own ladders. Base rate (Ahrefs, 2025): only 1.74% of new pages reach Google's top 10 within a year, and 40.8% of those do so within a month. The rest take months.",
    );
    expect(chanceText('none', '')).toBe('');
    expect(chanceText('direct', '')).toBe('');
  });
  it('toChance reads the engine\'s object and falls back to the plan\'s band', () => {
    expect(toChance({ band: 'fair', range: [30, 50], label: 'x' }, 'full')).toEqual({ band: 'fair', range: [30, 50] });
    expect(toChance(null, 'full', true)).toEqual({ band: 'slim', range: [5, 15] });
    expect(toChance({ band: 'great' }, 'direct')).toEqual({ band: 'good', range: [50, 70] });
  });
  // R49 (2026-10-16): exec 598 showed "good (50-70%)" for a site whose reach was the size tier for 0 top-10 keywords
  it('no band on a reach that rests on no measured ranking: the same rule and words as n8n\'s reachMeasured / reachChance', () => {
    const unmeasured = { method: 'size', p75: null, sample: 0, top10: 0 };
    expect(reachMeasured(unmeasured)).toBe(false);
    expect(reachMeasured(unmeasured, 14)).toBe(true);
    expect(reachMeasured({ method: 'percentile', sample: 14, top10: 14 })).toBe(true);
    expect(reachMeasured({ method: 'size', sample: 3, top10: 3 })).toBe(true);
    expect(reachMeasured({ used: true })).toBe(true);
    expect(planChance('direct', false, reachMeasured(unmeasured))).toEqual(UNMEASURED_CHANCE);
    expect(chanceLabel('direct', false, false)).toBe('no estimated chance (no measured ranking to judge it by)');
    expect(chanceLabel('direct', false, false)).not.toMatch(/50-70/);
    expect(chanceText('direct', '2-4', false, false)).toMatch(/^No estimated chance: the reach this plan is judged against rests on no measured ranking/);
    expect(chanceText('direct', '2-4', false, false)).toContain('1.74%');
    expect(chanceLabel('none', false, false)).toBe('');
    expect(toChance({ band: 'unmeasured', range: [0, 0], label: 'no estimated chance (no measured ranking to judge it by)' }, 'direct')).toEqual(UNMEASURED_CHANCE);
    expect(planChance('direct')).toEqual({ band: 'good', range: [50, 70] });
  });
});
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

  it('one card per search, in the discovery\'s own order (its start-with pick first), overlapping ladders last', () => {
    const list = recommendedFromStrategy(payload, ladders);
    expect(list.map((k) => [k.keyword, k.difficultyForYou, k.source, k.overlaps.length])).toEqual([
      ['erp software dubai', 'hard', 'start_with', 0],
      ['odoo partner uae', 'easy', 'priority', 0],
      ['erp implementation cost uae', 'reachable', 'priority', 0],
      ['odoo pricing uae', 'easy', 'quick_win', 0],
      ['odoo implementation uae', 'reachable', 'content_plan', 0],
      ['uae e-invoicing', 'reachable', 'priority', 1],
      ['peppol uae', 'easy', 'quick_win', 1],
    ]);
    const start = list.find((k) => k.source === 'start_with')!;
    expect(start.why).toBe('High buyer intent with 0.12 CPC ratio');
    expect(start.label).toBe('Hard for your site · Full ladder · 9-15 months');
    expect(list.find((k) => k.keyword === 'uae e-invoicing')!.overlaps).toEqual([{ ladderId: 'lad_inv', head: 'e invoicing in uae', keyword: 'e invoicing in uae' }]);
    expect(list.find((k) => k.keyword === 'odoo implementation uae')!.why).toBe('Topic "Odoo": 6 related searches on one page');
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

  // F-REH (2026-10-20): the real-credit rehearsal. techand.ai listed "CRM implementation, Dynamics 365 Business Central, Dynamics 365 Sales,
  // E-invoicing compliance"; the research's top cards were IT-company searches, all "easy". The engine now says whether each keyword is one of
  // the services the client listed (service_fit), and the list a non-technical owner picks from starts with those.
  it('what the client sells first: in, then not judged, then out (with a plain note); a search a ladder holds still goes last', () => {
    const rehearsal = {
      start_with: kw('crm system', { ...reachable, service_fit: 'in' }),
      priority: [
        kw('software development company in dubai', { ...easy, service_fit: 'out' }),
        kw('it company in dubai', { ...easy, service_fit: 'out' }),
        kw('dubai it solutions', { ...easy, service_fit: 'out' }),
        kw('crm service provider uae', { ...reachable, service_fit: 'in' }),
        kw('dynamics 365 sales', { ...hard, service_fit: 'in' }),
        kw('odoo partner uae', { ...easy, service_fit: 'unknown' }),
        kw('peppol uae', { ...easy, service_fit: 'in' }),
      ],
      content_plan: [{ tier: 'Now', topic: 'IT', primary_keyword: 'it companies in abu dhabi', keyword_count: 3, total_volume: 480, ...easy, service_fit: 'out' }],
    };
    const list = recommendedFromStrategy(rehearsal, ladders);
    expect(list.map((k) => [k.keyword, k.serviceFit, k.difficultyForYou])).toEqual([
      ['crm system', 'in', 'reachable'],
      ['crm service provider uae', 'in', 'reachable'],
      ['dynamics 365 sales', 'in', 'hard'],
      ['odoo partner uae', 'unknown', 'easy'],
      ['software development company in dubai', 'out', 'easy'],
      ['it company in dubai', 'out', 'easy'],
      ['dubai it solutions', 'out', 'easy'],
      ['it companies in abu dhabi', 'out', 'easy'],
      ['peppol uae', 'in', 'easy'],
    ]);
    expect(list.filter((k) => k.serviceFit === 'out').every((k) => k.note === SERVICE_OUT_NOTE)).toBe(true);
    expect(list.filter((k) => k.serviceFit !== 'out').every((k) => k.note === '')).toBe(true);
    expect(SERVICE_OUT_NOTE).toBe('Not one of the services you listed');
    // the customer's words: no em dash, no arrow, no internal term
    expect(/[—–→]|service_fit/.test(SERVICE_OUT_NOTE)).toBe(false);
    // "Choose for me" then lands on one of the client's services, never on the easier IT search above it in the old order
    expect(chooseForMe(list)?.keyword).toBe('crm system');
  });
  it('chooseForMe never picks a keyword outside the services the client listed', () => {
    const base = { volume: 100, overlaps: [] as never[], planType: 'direct', months: '2-4', why: '' };
    const list = [
      { ...base, keyword: 'it company in dubai', difficultyForYou: 'easy', serviceFit: 'out' },
      { ...base, keyword: 'crm system', difficultyForYou: 'reachable', serviceFit: 'in' },
    ] as never[];
    expect((chooseForMe(list) as { keyword: string } | null)?.keyword).toBe('crm system');
    expect(chooseForMe([list[0]])).toBeNull();
  });


  it('a report from before service fit (no service_fit): every card is not judged and the order is exactly as before', () => {
    const list = recommendedFromStrategy(payload, ladders);
    expect(list.every((k) => k.serviceFit === 'unknown' && k.note === '')).toBe(true);
    expect(list.map((k) => k.keyword)).toEqual(['erp software dubai', 'odoo partner uae', 'erp implementation cost uae', 'odoo pricing uae', 'odoo implementation uae', 'uae e-invoicing', 'peppol uae']);
    // anything that is not 'in' or 'out' is read as not judged
    expect(recommendedFromStrategy({ priority: [kw('a b', { service_fit: 'maybe' }), kw('c d', { service_fit: null })] }, []).map((k) => k.serviceFit)).toEqual(['unknown', 'unknown']);
  });

  // KW-APP D3 (2026-10-21, live run on techand.ai, exec 111): the engine put its start-with pick first and a job search last with its reason;
  // the app re-ranked by difficulty, so the pick became card #5 and the job search card #3 with no note.
  it('keeps the engine\'s order: its start-with pick first, a job or training search last with its note, never chosen for the client', () => {
    const career = 'it is part of what you sell; people searching it are mostly looking for work or training, not for a provider: job, salary or course pages rank for it (bayt.com, naukri.com); you are already at #11';
    const live = {
      start_with: kw('financial reporting automation', { ...reachable, service_fit: 'in' }),
      priority: [
        kw('dynamics 365 finance and operations pricing dubai', { ...easy, service_fit: 'in' }),
        kw('dynamics 365 finance vat compliance uae', { ...reachable, service_fit: 'in' }),
        kw('financial reporting automation', { ...reachable, service_fit: 'in' }),
        kw('dynamics 365 finance implementation', { ...reachable, service_fit: 'in' }),
        kw('artificial intelligence consultancy', { ...easy, service_fit: 'out' }),
        kw('microsoft dynamics ax dubai', { ...easy, service_fit: 'in', why: career }),
      ],
    };
    const list = recommendedFromStrategy(live, []);
    expect(list.map((k) => k.keyword)).toEqual([
      'financial reporting automation',
      'dynamics 365 finance and operations pricing dubai',
      'dynamics 365 finance vat compliance uae',
      'dynamics 365 finance implementation',
      'artificial intelligence consultancy',
      'microsoft dynamics ax dubai',
    ]);
    const ax = list.at(-1)!;
    expect(ax.career).toBe(true);
    expect(ax.note).toBe('People searching it are mostly looking for work or training, not for a provider: job, salary or course pages rank for it (bayt.com, naukri.com)');
    expect(list.slice(0, -1).every((k) => k.career === false)).toBe(true);
    // the engine's own flag, when the callback carries it, wins over reading `why`
    const flagged = recommendedFromStrategy({ priority: [kw('sap jobs dubai', { ...easy, career: { detail: 'mostly job seekers (bayt.com)' } }), kw('sap partner uae', reachable)] }, []);
    expect(flagged.map((k) => [k.keyword, k.career, k.note])).toEqual([
      ['sap partner uae', false, ''],
      ['sap jobs dubai', true, 'Mostly job seekers (bayt.com)'],
    ]);
    expect(recommendedFromStrategy({ priority: [kw('sap jobs dubai', { ...easy, career: true })] }, [])[0].note).toBe(CAREER_NOTE);
    // KWL-RES (2026-10-22): the engine sends career as a boolean with career_note; an explicit false is final, even when `why` reads like a job search
    expect(recommendedFromStrategy({ priority: [kw('sap jobs dubai', { ...easy, career: true, career_note: 'job and course pages rank for it (bayt.com)' })] }, [])[0].note)
      .toBe('Job and course pages rank for it (bayt.com)');
    expect(recommendedFromStrategy({ priority: [kw('microsoft dynamics ax dubai', { ...easy, service_fit: 'in', why: career, career: false, career_note: null })] }, [])[0].career).toBe(false);
    // "Choose for me" takes the engine's pick and never a job search, however easy
    expect(chooseForMe(list)?.keyword).toBe('financial reporting automation');
    expect(chooseForMe(list.filter((k) => k.career))).toBeNull();
    expect(/[\u2014\u2013\u2026\u201c\u201d]/.test(CAREER_NOTE)).toBe(false);
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

describe('the keyword check\'s answer', () => {
  it('maps the engine\'s answer (labels as n8n words them)', () => {
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
    expect(a).toMatchObject({ difficultyForYou: 'not_realistic', planType: 'none', months: '', fit: null, position: null, navigational: true });
    // R3 (2026-10-13, the re-rating run): a topic check that could not be read has to show in the label, not only in `warnings`, live, the
    // Keyword Check shipped `fit: null` for "business central partner uae" and the app displayed the difficulty as if the topic had been checked
    expect(a.label).toBe('Not realistic for your site \u00b7 ' + FIT_UNKNOWN_NOTE);
    expect(toAssessment({ keyword: 'x', fit: 2, difficulty_for_you: 'reachable', plan_type: 'short', months: '4-8' }).label).not.toContain(FIT_UNKNOWN_NOTE);
    expect(toAssessment({ keyword: 'x', label: 'Reachable for your site \u00b7 ' + FIT_UNKNOWN_NOTE }).label).toBe('Reachable for your site \u00b7 ' + FIT_UNKNOWN_NOTE);
    expect(a.alternatives).toEqual(['e invoicing software uae', 'fta e invoicing']);
    expect(toAssessment({})).toMatchObject({ keyword: '', volume: null, difficultyForYou: null, planType: null, label: '' });
  });
  it('forYouLabel matches n8n\'s reachLabel', () => {
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

// KW-APP D15 (2026-10-21, live run): the engine sent which page it matched and that it reused today's results page; the app showed neither.
describe('what a keyword check matched and how it read Google', () => {
  it('maps the existing page and the reading, and says both in the customer\'s words', () => {
    const live = toAssessment({
      keyword: 'ai consulting dubai',
      fit: 2,
      existing: { how: 'a page of yours', matched_by: 'title', page_url: 'https://www.techand.ai/whatwedo/ai-automation', page_title: 'AI & Automation | What We Do | Tech&', page_status: 'live', ladder_id: null },
      serp: { read: true, read_today: true, read_note: 'read earlier today at 18:37 UTC', checked_at: '2026-10-21 18:37:33 +00:00' },
    });
    expect(live.existingPage).toEqual({ url: 'https://www.techand.ai/whatwedo/ai-automation', title: 'AI & Automation | What We Do | Tech&', matchedBy: 'title', status: 'live', ladder: false, evidence: '' });
    expect(live.reading).toEqual({ readToday: true, note: 'read earlier today at 18:37 UTC', checkedAt: '2026-10-21 18:37:33 +00:00' });
    expect(checkEvidenceLines(live)).toEqual([
      'Matched to your page https://www.techand.ai/whatwedo/ai-automation ("AI & Automation | What We Do | Tech&"), by its title.',
      "Google's results page read earlier today at 18:37 UTC: that reading was used again, at no extra cost.",
    ]);
    // a ladder's page with the engine's evidence; a fresh reading says nothing
    const ladder = toAssessment({
      existing: { how: 'the same keyword', page_url: 'https://www.techand.ai/ai-consultant/', ladder_id: 'lad_x', page_status: 'not_ready', evidence: 'its title and H1 name the search' },
      serp: { read: true, read_today: false, read_note: '' },
    });
    expect(checkEvidenceLines(ladder)).toEqual(['One of your keyword ladders already holds this search; its page: https://www.techand.ai/ai-consultant/. Its title and H1 name the search. Its status: not ready.']);
    // nothing matched, nothing read: no lines, and an older answer without these blocks still maps
    const none = toAssessment({ keyword: 'x y', existing: { page_url: null }, serp: { read: false } });
    expect([none.existingPage, none.reading, checkEvidenceLines(none)]).toEqual([null, null, []]);
    expect(checkEvidenceLines(toAssessment({}))).toEqual([]);
    for (const line of checkEvidenceLines(live)) expect(/[\u2014\u2013\u2026\u201c\u201d]|SERP|lad_/.test(line)).toBe(false);
  });
});
