import { describe, expect, it } from 'vitest';
import { aiPanelFocus, aiPanelNeedsYou, type AiFocusContext } from './ai-focus';
import { consistencyWarnings, CONSISTENCY_CHECKS } from './consistency';
import { GUIDE_FOR_NEEDS_YOU_KIND } from './guide-links';
import { GUIDES } from './guides';

// AI-FOCUS (2026-10-27, n8n/seo-agent/docs/ai-panel-focus-2026-10-27): the AI panel's two warnings in the one registry, on devaicon.com's
// production state (Pakistan; a ladder about AI automation; 9 questions about Open edX written for the UAE before the ladder existed).
const NOW = '2026-10-27T10:00:00Z';
const openEdx = Array.from({ length: 9 }, (_, i) => ({ prompt_id: `dv_${i}`, prompt: `Which Open edX providers in the UAE offer option ${i}?`, kind: 'recommend', source: 'auto', status: 'active',
  keyword: 'open edx provider uae', cluster: 'open edx provider', market: 'AE-en', created_at: '2026-10-25T09:00:00Z' }));
const devaicon = (over: Partial<AiFocusContext> = {}): AiFocusContext => ({
  panelSize: 10,
  iso: 'PK',
  ownMarket: 'PK-en',
  ladders: [{ id: 'lad_dev1', head: 'ai automation solutions gcc', status: 'active', createdAt: '2026-10-26T08:00:00Z', rungs: ['ai automation for small business'] }],
  pages: [{ keyword: 'ai in industrial automation', status: 'published', at: '2026-10-26T12:00:00Z' }],
  services: ['AI workflow automation', 'AI agents', 'Custom software development'],
  keywords: ['open edx provider'],
  questions: [{ prompt_id: 'dv_brand', prompt: 'What is Devaicon?', kind: 'brand', source: 'auto', status: 'active', market: 'AE-en' }, ...openEdx],
  ...over,
});
const site = { domain: 'devaicon.com', country: 'Pakistan' };
const standing = (ctx: AiFocusContext) => consistencyWarnings('site_standing', {}, { site, siteApi: '/api/orgs/o1/sites/s1', aiFocus: ctx });

describe('ai.panel_off_focus', () => {
  it('is one of the registry\'s checks (one mechanism, not a second one)', () => {
    expect(CONSISTENCY_CHECKS.map((c) => c.code)).toEqual(expect.arrayContaining(['ai.panel_off_focus', 'ai.ladder_not_measured']));
  });
  it('devaicon.com: most questions are about Open edX while its keywords are about AI automation; Accept retires them', () => {
    const w = standing(devaicon()).find((x) => x.code === 'ai.panel_off_focus');
    expect(w).toBeTruthy();
    expect(w!.title).toBe('Most of your AI questions are about "open edx provider", but your keywords are about "ai automation solutions"');
    expect(w!.tone).toBe('warning');
    expect(w!.confirm).toBe('Keep these questions');
    expect(w!.accept?.label).toBe('Ask about "ai automation solutions" instead');
    expect(w!.accept?.change).toEqual({ kind: 'call', method: 'POST', path: '/api/orgs/o1/sites/s1/admin', body: { action: 'ai_prompts', retire: openEdx.map((q) => q.prompt_id) } });
    for (const s of [w!.title, w!.body]) expect(s).not.toMatch(/[—‘’“”…]/);   // no em dash, curly quotes or ellipsis character in customer copy
  });
  it('a panel about the keywords the client works on raises nothing', () => {
    const onFocus = Array.from({ length: 6 }, (_, i) => ({ prompt_id: `af_${i}`, prompt: `AI automation question ${i}`, kind: 'recommend', source: 'auto', status: 'active', keyword: 'ai automation solutions', cluster: 'ai automation solutions', market: 'PK-en' }));
    expect(standing(devaicon({ questions: onFocus })).some((x) => x.code === 'ai.panel_off_focus')).toBe(false);
  });
  it('the owner\'s own questions are never in Accept (they are theirs to switch off)', () => {
    const own = openEdx.map((q) => ({ ...q, source: 'custom' }));
    const w = standing(devaicon({ questions: own })).find((x) => x.code === 'ai.panel_off_focus');
    expect(w && w.accept).toBeFalsy();
  });
  it('says nothing when the owner switched the focus off', () => {
    expect(standing(devaicon({ focusMode: 'off' })).length).toBe(0);
  });
});

describe('ai.ladder_not_measured', () => {
  it('five ladders on a panel of 10: the one with no room, the bigger panel and its price, Accept = the panel size', () => {
    const ladders = ['accounting software uk', 'payroll outsourcing london', 'vat returns service', 'bookkeeping for startups', 'cloud cfo services'].map((h, i) => ({ id: `lad_d${i + 1}`, head: h, status: 'active', createdAt: `2026-10-2${i}T00:00:00Z` }));
    const questions = ladders.slice(0, 3).flatMap((l, i) => Array.from({ length: [4, 3, 2][i] }, (_, k) => ({ prompt_id: `${l.id}_${k}`, prompt: `${l.head} ${k}`, kind: 'recommend', source: 'auto', status: 'active', keyword: l.head, cluster: l.head, market: 'GB-en' })));
    const w = consistencyWarnings('site_standing', {}, { site: { domain: 'multi.co.uk', country: 'United Kingdom' }, siteApi: '/api/orgs/o/sites/s',
      aiFocus: { panelSize: 10, iso: 'GB', ownMarket: 'GB-en', ladders, services: [], keywords: [], questions, raisePrice: (n) => `about ${n * 3} more credits a month` } }).find((x) => x.code === 'ai.ladder_not_measured');
    expect(w).toBeTruthy();
    expect(w!.tone).toBe('info');
    expect(w!.title).toContain('"bookkeeping for startups"');   // with no priority set, the newest ladder is measured first
    expect(w!.body).toContain('12 questions would cover it too (about 36 more credits a month)');
    expect(w!.accept?.change).toEqual({ kind: 'call', method: 'POST', path: '/api/orgs/o/sites/s/admin', body: { action: 'monitors', monitors: { aiPromptsMax: 12 } } });
  });
});

describe('the Needs-you items and the guide', () => {
  it('each panel warning is a Needs-you item that opens the AI page, with its own guide', () => {
    const items = aiPanelNeedsYou(standing(devaicon()));
    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({ kind: 'ai_panel', severity: 'warning', action: { page: 'ai' } });
    expect(GUIDE_FOR_NEEDS_YOU_KIND.ai_panel).toBe('ai-panel-focus');
    expect(GUIDES.some((g) => g.id === 'ai-panel-focus')).toBe(true);
  });
  it('the topic view the panel manager reads: the questions grouped by what they measure', () => {
    const { focus, rec } = aiPanelFocus(devaicon(), NOW);
    expect(focus.topics.find((t) => t.state === 'active')?.label).toBe('ai automation solutions');
    expect(rec.topic_of.filter((t) => t.state === 'watch').length).toBe(9);
  });
});
