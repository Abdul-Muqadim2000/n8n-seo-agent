import { describe, expect, it } from 'vitest';
import { aiFormPageType, aiQuestionAction, aiSearchOwner, aiTargetInput, type AiQuestionInputs } from './ai-question-action';
import { keywordInput } from './schemas';

// Client report 2026-11-16 (devaicon.com, issue 1): "Win the answer to 'Which companies offer the best AI automation services for businesses
// in Dubai?'" opened the page form with the panel TOPIC "ai automation services" (the search of the client's own service page), so the tool
// then treated the answer page as a second version of that service page. Every button now goes through one resolver.

const DUBAI = 'Which companies offer the best AI automation services for businesses in Dubai?';
const prompts = [
  { promptId: 'q_dubai', prompt: DUBAI, keyword: 'best ai automation services dubai', topic: 'ai automation services', kind: 'compare' },
  { promptId: 'q_gov', prompt: 'Governed vs autonomous AI agents: which is safer for a bank?', keyword: 'governed vs autonomous ai agents', topic: 'agentic ai development in uae', kind: 'compare' },
];
// the AI report action an engine from before the fix stored: the topic as keyword, the question's target kept
const oldBody = { mode: 'keyword', keyword: 'ai automation services', page_type: 'Comparison Page', ai_target: { question: DUBAI, kind: 'answer', fanout: ['ai automation companies dubai'], sources: [{ u: 'https://clutch.co/ae/ai', t: 'Clutch' }], competitors: ['rival.ae'] } };
const servicePage = { keyword: 'ai automation services', status: 'published', publishedUrl: 'https://devaicon.com/services/ai-automation-services-pakistan', startedAt: '2026-11-10T14:54:00Z', source: 'app' };
const base: AiQuestionInputs = { prompts, questions: [], targets: [], written: [servicePage], market: 'United Arab Emirates' };

describe('aiQuestionAction: the question\'s own search, never the topic (F1)', () => {
  it('an older report action with the topic keyword is corrected through the stored question', () => {
    const a = aiQuestionAction({ apiBody: oldBody }, base);
    expect(a.keyword).toBe('best ai automation services dubai');
    expect(a.step).toBe('write');
    expect(a.run?.mode).toBe('keyword');
    expect(a.run?.prefill).toMatchObject({ keyword: 'best ai automation services dubai', pageType: 'Guide', receiveContent: true });
    expect(a.aiTarget).toMatchObject({ question: DUBAI, kind: 'answer', sources: [{ url: 'https://clutch.co/ae/ai', title: 'Clutch' }], competitors: ['rival.ae'] });
    expect(a.source).toBe('ai_answer');
    // the form takes it as it is
    expect(keywordInput.safeParse({ mode: 'keyword', siteId: null, country: 'United Arab Emirates', ...a.run!.prefill }).success).toBe(true);
  });

  it('a lost question (the gap row) uses the panel question\'s search; a comparison opens as a guide, never a service page', () => {
    const a = aiQuestionAction({ question: DUBAI, topic: 'ai automation services', kind: 'compare', fanout: ['x'], competitors: ['rival.ae'] }, base);
    expect(a.keyword).toBe('best ai automation services dubai');
    expect(a.pageType).toBe('Guide');
    expect(a.aiTarget?.question).toBe(DUBAI);
  });

  it('a newer engine\'s gap row with its own keyword is used as it is; the topic only when nothing else is known', () => {
    expect(aiQuestionAction({ question: 'Who installs Dynamics 365 in Riyadh for retailers?', keyword: 'dynamics 365 partner riyadh' }, {}).keyword).toBe('dynamics 365 partner riyadh');
    expect(aiQuestionAction({ question: 'Who installs Dynamics 365 in Riyadh for retailers?', topic: 'Dynamics 365' }, {}).keyword).toBe('dynamics 365');
  });

  it('the Pakistan service page is another market: no "you already have a page", the answer page is written', () => {
    expect(aiSearchOwner('best ai automation services dubai', [servicePage], 'United Arab Emirates')).toBeNull();
  });
});

describe('aiQuestionAction: what the system already did for the question (F5)', () => {
  const target = (over: Record<string, unknown>) => ({ targetId: 'ait_1', promptId: 'q_gov', question: prompts[1].prompt, keyword: 'governed vs autonomous ai agents', kind: 'answer', pageUrl: '', pageType: 'Comparison Page', status: 'queued', ...over });
  it('a question whose page is live: "See the page", no write button', () => {
    const a = aiQuestionAction({ promptId: 'q_gov' }, { ...base, targets: [target({ status: 'writing', state: 'live', statePageUrl: 'https://devaicon.com/insights/governed-vs-autonomous-ai-agents' })] });
    expect(a.step).toBe('open');
    expect(a.run).toBeNull();
    expect(a.pageUrl).toBe('https://devaicon.com/insights/governed-vs-autonomous-ai-agents');
    expect(a.note).toContain('/insights/governed-vs-autonomous-ai-agents answers this question');
  });
  it('being written: nothing to start; written: publish it', () => {
    expect(aiQuestionAction({ promptId: 'q_gov' }, { ...base, targets: [target({ state: 'writing' })] }).run).toBeNull();
    const w = aiQuestionAction({ promptId: 'q_gov' }, { ...base, targets: [target({ state: 'written' })] });
    expect(w.step).toBe('publish');
    expect(w.run).toEqual({ mode: 'published', prefill: { keyword: 'governed vs autonomous ai agents' } });
  });
  it('won: nothing to do', () => {
    expect(aiQuestionAction({ promptId: 'q_gov' }, { ...base, targets: [target({ state: 'won' })] }).step).toBe('none');
  });
  it('a target planned as a refresh: "Improve the page" with the page and the target as a refresh', () => {
    const a = aiQuestionAction({ targetId: 'ait_1' }, { ...base, targets: [target({ kind: 'refresh', pageUrl: 'https://devaicon.com/services/engagement-models' })] });
    expect(a.step).toBe('improve');
    expect(a.run?.prefill).toMatchObject({ existingPageUrl: 'https://devaicon.com/services/engagement-models', pageType: 'Service Page', aiTarget: { kind: 'refresh' } });
    expect(a.source).toBe('ai_refresh');
  });
  it('a page the app wrote for this question (its run carried the question) is found even when its keyword was the topic', () => {
    const a = aiQuestionAction({ apiBody: oldBody }, { ...base, written: [{ ...servicePage, aiQuestion: DUBAI }] });
    expect(a.step).toBe('open');
  });
});

describe('aiQuestionAction: one search, one page (F2, the techand case)', () => {
  const crm = 'Who are the best CRM service providers in the UAE for a growing real estate company?';
  const inputs: AiQuestionInputs = {
    prompts: [{ promptId: 'q_crm', prompt: crm, keyword: 'best crm service provider uae', topic: 'crm service provider in uae' }],
    written: [{ keyword: 'crm service provider', status: 'published', publishedUrl: 'https://www.techand.ai/dynamics-365-crm-uae', source: 'ladder' }],
    market: 'AE',
  };
  it('the live ladder head owns the question\'s search: "Improve the page for this question", never a second page', () => {
    const a = aiQuestionAction({ promptId: 'q_crm' }, inputs);
    expect(a.step).toBe('improve');
    expect(a.existingPageUrl).toBe('https://www.techand.ai/dynamics-365-crm-uae');
    expect(a.aiTarget?.kind).toBe('refresh');
    expect(a.note).toContain('/dynamics-365-crm-uae is already the page for this search');
  });
  it('a page for the same search that is not live yet: no second page', () => {
    const a = aiQuestionAction({ promptId: 'q_crm' }, { ...inputs, written: [{ keyword: 'best crm service providers uae', status: 'written', publishedUrl: '', source: 'app' }] });
    expect(a.step).toBe('none');
  });
});

describe('aiFormPageType (F13)', () => {
  it('maps every engine type to one the form accepts', () => {
    expect(aiFormPageType('Comparison Page')).toBe('Guide');
    expect(aiFormPageType('Service Page')).toBe('Guide');
    expect(aiFormPageType('')).toBe('Guide');
    expect(aiFormPageType('Blog Post')).toBe('Blog Post');
    expect(aiFormPageType('', { kind: 'refresh', pageUrl: 'https://x.com/insights/a' })).toBe('Guide');
    expect(aiFormPageType('', { kind: 'refresh', pageUrl: 'https://x.com/services/a' })).toBe('Service Page');
  });
});

describe('aiTargetInput', () => {
  it('keeps the schema\'s limits (sources must be links, at most 8 searches)', () => {
    const t = aiTargetInput({ question: 'What does an ERP cost in Dubai?', target_id: 'ait_9', fanout: 'a | b | c', sources: [{ u: 'not a link' }, { u: 'https://a.test/x', t: 'A' }], competitors: Array.from({ length: 12 }, (_, i) => `r${i}`) });
    expect(t).toEqual({ question: 'What does an ERP cost in Dubai?', kind: 'answer', targetId: 'ait_9', fanout: ['a', 'b', 'c'], sources: [{ url: 'https://a.test/x', title: 'A' }], competitors: ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'] });
    expect(aiTargetInput({ question: 'short' })).toBeNull();
  });
});
