import { describe, expect, it } from 'vitest';
import { aiTargetView } from './ai-target-status';
import { aiAnsweredView, aiQuestionAction, type AiQuestionInputs, type AiTargetForAction } from './ai-question-action';
import { LRU } from './ladder-rules';

// CR17 review R5 (FX-LADDER, 2026-11-18): the app reads what the engine settled.
//  H1: a question the engine settled on its ladder's MAIN page (LRU.questionPage: the question carries every word of the main keyword) is
//      live, never "Queued: the page written then covers another search" with a "Write the page" button (devaicon.com question 37).
//  M3: a refresh AI Growth planned for a page is never hidden behind "Answered" by that same page.

const AE = 'AE';
const HEAD_URL = 'https://devaicon.com/services/crm-software-uae';

describe('H1: the engine\'s settle on a ladder main page is the app\'s answer', () => {
  const log = { keyword: 'crm software uae', rung: 4, source: 'ladder', status: 'published', request_id: 'R1', published_url: HEAD_URL, published_at: '2026-11-13T09:30:00Z' };
  const target = { status: 'written', keyword: 'best crm software for small business uae', requestId: 'R1', reasonCode: 'live', reasonArgs: { page_url: HEAD_URL, date: '2026-11-13' } };

  it('the kit agrees: the question is the main page\'s question', () => {
    expect(LRU.questionPage(target.keyword, { keyword: log.keyword, rung: log.rung }, AE)).toBe(true);
    expect(LRU.sameSearch(target.keyword, log.keyword)).toBe(false);
  });
  it('the run\'s own row (the ladder main page) is the question\'s page: live, with its address', () => {
    const v = aiTargetView(target, [log], { market: AE });
    expect(v.state).toBe('live');
    expect(v.pageUrl).toBe(HEAD_URL);
  });
  it('an older row (no live code) whose run wrote the main page: the engine\'s question-page rule finds it live', () => {
    const v = aiTargetView({ ...target, reasonCode: 'written', reasonArgs: {} }, [log], { market: AE });
    expect(v.state).toBe('live');
    expect(v.pageUrl).toBe(HEAD_URL);
  });
  it('even without the market the engine-settled live row shows live (status written, code live, the page in its args)', () => {
    const v = aiTargetView({ ...target, requestId: '' }, []);
    expect(v.state).toBe('live');
    expect(v.sentence).toMatch(/\/services\/crm-software-uae answers it, published 13 Nov 2026/);
  });
  it('a rung of ANOTHER search (not the main page) is still "covers another search"', () => {
    const rung = { ...log, keyword: 'crm data migration', rung: 2 };
    const v = aiTargetView({ ...target, reasonCode: 'written', reasonArgs: {} }, [rung], { market: AE });
    expect(v.state).toBe('queued');
  });
  it('the button follows: "See the page", never "Write the page"', () => {
    const v = aiTargetView(target, [log], { market: AE });
    const t: AiTargetForAction = { targetId: 't1', question: 'Best CRM software for small business in the UAE?', keyword: target.keyword, kind: 'answer', status: 'written', state: v.state, statePageUrl: v.pageUrl, reason: v.sentence };
    const a = aiQuestionAction({ targetId: 't1' }, { targets: [t], market: AE });
    expect(a.step).toBe('open');
    expect(a.pageUrl).toBe(HEAD_URL);
  });
});

describe('M3: a planned refresh is never hidden by the page it improves', () => {
  const PAGE = 'https://devaicon.com/insights/best-crm-uae';
  const inputs: Pick<AiQuestionInputs, 'written' | 'market' | 'ladderHeads' | 'nextAiCheck'> = {
    written: [{ keyword: 'best crm uae', status: 'published', publishedUrl: PAGE, source: 'ai_answer', aiTargetId: 't9', publishedAt: '2026-09-01T00:00:00Z' }],
    market: AE,
    ladderHeads: [],
  };
  const base = { targetId: 't9', question: 'What is the best CRM in the UAE?', keyword: 'best crm uae', updatedAt: '2026-11-13T01:00:00Z' };
  it('a queued refresh of that very page keeps the engine\'s plan', () => {
    expect(aiAnsweredView({ ...base, state: 'queued', kind: 'refresh', pageUrl: PAGE, statePageUrl: PAGE }, inputs)).toBeNull();
    expect(aiAnsweredView({ ...base, state: 'queued', kind: 'refresh', pageUrl: PAGE }, inputs)).toBeNull();
  });
  it('a queued answer target still shows the page written for it as the answer', () => {
    expect(aiAnsweredView({ ...base, state: 'queued', kind: 'answer' }, inputs)?.state).toBe('live');
  });
  it('the button says Improve, as the engine plans', () => {
    const t: AiTargetForAction = { ...base, kind: 'refresh', pageUrl: PAGE, statePageUrl: PAGE, state: 'queued', status: 'queued' };
    const a = aiQuestionAction({ targetId: 't9' }, { ...inputs, targets: [t] });
    expect(a.step).toBe('improve');
    expect(a.existingPageUrl).toBe(PAGE);
  });
});
