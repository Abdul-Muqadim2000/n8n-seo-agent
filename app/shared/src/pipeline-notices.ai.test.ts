import { describe, expect, it } from 'vitest';
import type { PipelineData } from './data';
import { pipelineNotices, type NoticeInput } from './pipeline-notices';

// Client report 2026-11-16 (devaicon.com, issue 1): the form said 'You already have a page for "ai automation services" ... live at
// devaicon.com/services/ai-automation-services-pakistan' under "Written to be the page AI cites", for a page meant to answer an AI question.
// For an AI page the notice now follows the engine's rule: one page per question, one page per search, another market's page is not it.

const NOW = new Date('2026-11-16T09:00:00Z');
const DUBAI = 'Which companies offer the best AI automation services for businesses in Dubai?';

function data(written: PipelineData['written'], heads: string[] = []): PipelineData {
  return {
    activeRuns: [],
    automations: [],
    running: [],
    written,
    ladders: heads.map((head, i) => ({ id: `lad${i}`, head, pages: 4, published: 1, planned: [], keywords: [head] })),
    queue: { pagesPerWeek: 1, next: [], later: [], waiting: [], engineUpcoming: [], engineUpcomingAt: null },
    automation: { defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 },
  } as unknown as PipelineData;
}
const servicePage = { keyword: 'ai automation services', status: 'published' as const, startedAt: '2026-11-10T14:54:00Z', publishedUrl: 'https://devaicon.com/services/ai-automation-services-pakistan', source: 'app' };
const ai = (over: Partial<NoticeInput> = {}): NoticeInput => ({ keyword: 'best ai automation services dubai', country: 'United Arab Emirates', receiveContent: true, aiTarget: { question: DUBAI, kind: 'answer', targetId: 'ait_36' }, ...over });
const ids = (n: { id: string }[]) => n.map((x) => x.id);

describe('pipeline notices for an AI page', () => {
  it('another question of the same topic: no "You already have a page" (the client\'s screenshot)', () => {
    const n = pipelineNotices('keyword', ai(), data([servicePage]), { now: NOW });
    expect(n.filter((x) => x.tone === 'warning')).toEqual([]);
  });

  it('a page written for THIS question (its run carried it) and live: improve it for the question, write a second one only on purpose', () => {
    const [n] = pipelineNotices('keyword', ai(), data([{ ...servicePage, keyword: 'best ai automation services dubai', publishedUrl: 'https://devaicon.com/insights/ai-automation-dubai', aiTargetId: 'ait_36', aiQuestion: DUBAI }]), { now: NOW });
    expect(n.id).toMatch(/^ai-written:/);
    expect(n.title).toBe('You already have a page for this question');
    expect(n.confirm).toBe('Write a second page anyway');
    expect(n.usePlan).toEqual({ label: 'Improve devaicon.com/insights/ai-automation-dubai for this question', pageType: 'Guide', existingPageUrl: 'https://devaicon.com/insights/ai-automation-dubai', aiKind: 'refresh' });
  });

  it('a page written for this question and not live yet: publish it first', () => {
    const [n] = pipelineNotices('keyword', ai(), data([{ keyword: 'best ai automation services dubai', status: 'started', startedAt: '2026-11-15T10:00:00Z', publishedUrl: '', source: 'ai_answer', aiTargetId: 'ait_36' }]), { now: NOW });
    expect(n.title).toBe('A page for this question was already written');
    expect(n.body).toContain('not live yet');
  });

  it('the techand case: the live ladder head owns the question\'s search -> "Improve <page> for this question" first', () => {
    const input = ai({ keyword: 'best crm service provider uae', aiTarget: { question: 'Who are the best CRM service providers in the UAE for a growing real estate company?', kind: 'answer', targetId: 'ait_16' } });
    const [n] = pipelineNotices('keyword', input, data([{ keyword: 'crm service provider', status: 'published', startedAt: '', publishedUrl: 'https://www.techand.ai/dynamics-365-crm-uae', source: 'ladder' }], ['crm service provider']), { now: NOW });
    expect(n.id).toBe('ai-owner:best crm service provider uae');
    expect(n.title).toBe('Your page techand.ai/dynamics-365-crm-uae already answers searches like this one');
    expect(n.usePlan?.label).toBe('Improve techand.ai/dynamics-365-crm-uae for this question');
    expect(n.usePlan?.aiKind).toBe('refresh');
    expect(n.usePlan?.pageType).toBe('Service Page');
    expect(n.body).not.toMatch(/—|\.\.\./);
    // improving that very page: no warning
    expect(ids(pipelineNotices('keyword', { ...input, existingPageUrl: 'https://www.techand.ai/dynamics-365-crm-uae' }, data([{ keyword: 'crm service provider', status: 'published', startedAt: '', publishedUrl: 'https://www.techand.ai/dynamics-365-crm-uae', source: 'ladder' }]), { now: NOW }))).toEqual([]);
  });

  it('a stale topic keyword whose only page was written for ANOTHER AI question: not "You already have a page"', () => {
    const n = pipelineNotices('keyword', ai({ keyword: 'ai automation services', aiTarget: { question: 'What does AI automation cost for a clinic in Dubai?', kind: 'answer' } }), data([{ ...servicePage, aiQuestion: DUBAI }]), { now: NOW });
    expect(n.some((x) => x.id.startsWith('written:'))).toBe(false);
  });

  it('a page that is not an AI page keeps the plain rule', () => {
    const [n] = pipelineNotices('keyword', { keyword: 'ai automation services', receiveContent: true }, data([servicePage]), { now: NOW });
    expect(n.id).toBe('written:ai automation services');
  });

  // review 2026-11-16 (M2): the owner is decided by the engine's own rule (LRU.sameQuestion / coversHead), never by the words of an address
  it('a page of another service whose address shares words is not the owner: no warning', () => {
    const w = [{ keyword: 'automation testing services', status: 'published' as const, startedAt: '', publishedUrl: 'https://devaicon.com/services/automation-testing', source: 'app' }];
    expect(pipelineNotices('keyword', ai({ keyword: 'ai automation services' }), data(w), { now: NOW }).filter((x) => x.tone === 'warning')).toEqual([]);
  });
  it('an AI page of the same search written for ANOTHER question says "a page for <search>", not "for this question"', () => {
    const [n] = pipelineNotices('keyword', ai(), data([{ keyword: 'best ai automation services dubai', status: 'published', startedAt: '', publishedUrl: 'https://devaicon.com/insights/x', source: 'ai_answer', aiQuestion: 'Who sells AI automation in Dubai?' }]), { now: NOW });
    expect(n.title).toBe('You already have a page for "best ai automation services dubai"');
  });
});
