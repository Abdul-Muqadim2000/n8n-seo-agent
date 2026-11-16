import { describe, expect, it } from 'vitest';
import { AI_CLIENT_TEXT_BANNED, aiTargetCode, aiTargetView, type AiTargetLike } from './ai-target-status';
import { aiRankWhyPlain } from './ai-rank-client';

// Client report 2026-11-16 (devaicon.com, issue 1, F8 / F11): the AI visibility page printed `set_aside`, "Being written" for a page that had
// been live for days, and reasons such as "a page run (cad_20261113_devaicon-com_2) was started ... seo_content_log row" or "AI ranking (L06):
// ... 5 cell(s), expected gain 0.0119 over $9.63 (client time at $25 an hour)". The state now follows the page; the sentence is ours.

const clean = (t: string) => AI_CLIENT_TEXT_BANNED.filter((re) => re.test(t)).map(String);

// the production rows of 2026-11-16 (devaicon.com), as stored
const T41: AiTargetLike = {
  status: 'writing', kind: 'answer', keyword: 'governed vs autonomous ai agents', requestId: 'cad_20261113_devaicon-com_2', updatedAt: '2026-11-13T01:28:00Z',
  reason: 'a page run (cad_20261113_devaicon-com_2) was started on 2026-11-13; nothing has been written yet — this row moves to "written" only against a seo_content_log row for that run',
};
const LOG66 = { keyword: 'governed vs autonomous ai agents', request_id: 'cad_20261113_devaicon-com_2', status: 'published', published_url: 'https://devaicon.com/insights/governed-vs-autonomous-ai-agents', published_at: '2026-11-13T11:08:00Z', started_at: '2026-11-13T01:28:00Z', source: 'ai_answer' };
const T37: AiTargetLike = { status: 'written', kind: 'answer', keyword: 'agentic ai development companies uae', requestId: 'cad_20261106_devaicon-com_2', writtenAt: '2026-11-06T01:28:11Z', reason: 'no page answers it yet' };
const LOG59 = { keyword: 'ai app development companies', request_id: 'cad_20261106_devaicon-com_2', status: 'published', published_url: 'https://devaicon.com/services/ai-app-development-companies', source: 'ladder', started_at: '2026-11-06T01:28:11Z' };
const T42: AiTargetLike = {
  status: 'set_aside', kind: 'answer', keyword: 'ai project engagement models',
  reason: 'not a search this website should target: 0% of its own words match what this website sells and the keywords you chose (25% is the bar): project, engagement, models. Add it to your services if you do sell it. (off topic); set aside, so no page is written for it. ',
};
const AIR: AiTargetLike = {
  status: 'queued', kind: 'refresh', keyword: 'best ai automation services dubai', pageUrl: 'https://devaicon.com/ai-automation-services-pakistan', origin: 'ai_rank',
  reason: 'AI ranking (L06): Refresh the ranking page for the searches the engines run: 5 cell(s), expected gain 0.0119 over $9.63 (client time at $25 an hour), typical 30 days',
};

describe('aiTargetView', () => {
  it('a target still `writing` whose page went live shows as published, with the page (target 41)', () => {
    const v = aiTargetView(T41, [LOG66]);
    expect(v.state).toBe('live');
    expect(v.badge).toBe('Published');
    expect(v.pageUrl).toBe(LOG66.published_url);
    expect(v.sentence).toBe('Your page /insights/governed-vs-autonomous-ai-agents answers it, published 13 Nov 2026. AI answers usually take a few weeks to change.');
  });
  it('without the content log row it is being written, in plain words (no run id, no table name, no em dash)', () => {
    const v = aiTargetView(T41, []);
    expect(v.badge).toBe('Being written');
    expect(v.sentence).toBe('The page is being written (started 13 Nov 2026).');
    expect(clean(v.sentence)).toEqual([]);
  });
  it('a question folded into a ladder page for ANOTHER search is not shown as answered by it (target 37)', () => {
    const v = aiTargetView(T37, [LOG59]);
    expect(v.state).toBe('queued');
    expect(v.sentence).toContain('covers another search');
  });
  it('set aside: "Not for this website" and the plain sentence (target 42)', () => {
    const v = aiTargetView(T42, []);
    expect(v.badge).toBe('Not for this website');
    expect(v.sentence).toContain('not about what you sell');
    expect(clean(v.sentence)).toEqual([]);
    expect(aiTargetCode(T42)).toBe('off_topic');
  });
  it('picked by AI ranking: no lever id, cells, expected gain or money', () => {
    const v = aiTargetView(AIR, []);
    expect(v.sentence).toBe('Chosen by AI ranking: improving /ai-automation-services-pakistan is the step most likely to get you named here.');
    expect(clean(v.sentence)).toEqual([]);
  });
  it('reads the engine\'s reason code and its values (CONTRACT_ISSUE1.md §3); an unknown code falls back to the status', () => {
    expect(aiTargetView({ status: 'queued', kind: 'refresh', reasonCode: 'same_search_page', reasonArgs: '{"page_url":"https://www.techand.ai/dynamics-365-crm-uae"}' }).sentence).toBe(
      'Your page /dynamics-365-crm-uae already owns this search, so we improve it for this question instead of writing a second page.',
    );
    expect(aiTargetView({ status: 'skipped', reasonCode: 'lower_value' }).badge).toBe('Later');
    expect(aiTargetView({ status: 'set_aside', reasonCode: 'other_market' }).sentence).toBe('It is about another country than the one you sell in.');
    expect(aiTargetView({ status: 'queued', reasonCode: 'something_new' }).sentence).toBe('We plan a new answer page for this question in a coming week.');
    expect(aiTargetView({ status: 'skipped', reasonCode: 'no_longer_lost' }).hidden).toBe(true);
    expect(aiTargetView({ status: 'won' }).badge).toBe('Won');
  });
  it('a failed page run reads "will be tried again"; a page waiting for a fix says so', () => {
    expect(aiTargetView({ status: 'writing', keyword: 'k', requestId: 'r1' }, [{ keyword: 'k', request_id: 'r1', status: 'failed' }]).state).toBe('retry');
    expect(aiTargetView({ status: 'writing', keyword: 'k', requestId: 'r1' }, [{ keyword: 'k', request_id: 'r1', status: 'not_ready' }]).badge).toBe('Needs a fix');
  });
  it('every state and every known code renders a clean sentence', () => {
    const statuses = ['queued', 'writing', 'written', 'won', 'skipped', 'set_aside', 'whatever'];
    const codes = ['', 'new_page', 'refresh_page', 'writing', 'written', 'live', 'won', 'lower_value', 'fresh_page', 'no_longer_lost', 'off_topic', 'other_market', 'same_search_page', 'run_failed', 'ai_rank', 'ladder', 'kept', 'other_brand', 'own_brand', 'government', 'job', 'navigational', 'needs_fix'];
    for (const status of statuses)
      for (const reasonCode of codes)
        for (const kind of ['answer', 'refresh']) {
          const v = aiTargetView({ status, reasonCode, kind, pageUrl: 'https://devaicon.com/services/x', reason: T41.reason, requestId: 'cad_20261113_devaicon-com_2' }, [LOG66]);
          expect(v.sentence.length).toBeGreaterThan(10);
          expect(clean(v.sentence + ' ' + v.badge)).toEqual([]);
          expect(v.badge).not.toMatch(/_/);
        }
  });
});

describe('aiRankWhyPlain', () => {
  it('drops the engine\'s scoring line whole and keeps a real sentence, made plain', () => {
    expect(aiRankWhyPlain(AIR.reason)).toBe('');
    expect(aiRankWhyPlain('Refresh the page for the searches the engines run: 5 cells, expected gain 0.01')).toBe('');
    expect(aiRankWhyPlain('AI ranking (L08): AI answers cite a list that does not name you yet.')).toBe('AI answers cite a list that does not name you yet.');
  });
});
