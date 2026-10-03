import { describe, expect, it } from 'vitest';
import type { RankPoint } from './data';
import { improvedWithin, isStuck, isWon, keywordTokens, keywordsOverlap, ladderOverlaps, ladderStatus, type StatusPage } from './ladders';

const NOW = Date.parse('2026-10-03T12:00:00Z');
const DAY = 864e5;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
/** weekly checks, oldest first, the last one `endDaysAgo` days ago */
const weekly = (positions: number[], endDaysAgo = 1): RankPoint[] => positions.map((position, i) => ({ checkedAt: ago(endDaysAgo + (positions.length - 1 - i) * 7), position }));
const page = (o: Partial<StatusPage> = {}): StatusPage => ({ state: 'planned', writtenAt: null, publishedAt: null, history: [], ...o });

describe('keyword overlap', () => {
  it('tokens: lower case, stop words and one-letter words out, light stem, place names kept', () => {
    expect(keywordTokens('E-Invoicing in the UAE')).toEqual(['invoic', 'uae']);
    expect(keywordTokens('ERP companies near me in Abu Dhabi')).toEqual(['erp', 'company', 'abu', 'dhabi']);
    expect(keywordTokens('the best of')).toEqual([]);
  });

  it('the same search: equal word sets, or 75%+ of the words in common', () => {
    expect(keywordsOverlap('e invoicing uae', 'e invoicing in uae')).toBe(true);
    expect(keywordsOverlap('E-invoicing UAE', 'uae e invoicing')).toBe(true);
    expect(keywordsOverlap('erp implementation dubai cost', 'erp implementation dubai costs')).toBe(true);
    // 3 of 4 words: 75%
    expect(keywordsOverlap('erp software dubai', 'erp software dubai pricing')).toBe(true);
    expect(keywordsOverlap('e invoicing uae', 'payroll software uae')).toBe(false);
    expect(keywordsOverlap('e invoicing uae', 'e invoicing software uae')).toBe(false);
    expect(keywordsOverlap('erp dubai', 'erp abu dhabi')).toBe(false);
    expect(keywordsOverlap('', 'erp')).toBe(false);
    expect(keywordsOverlap('the', 'a')).toBe(false);
  });

  it('ladder overlaps: keywords of one ladder that match any keyword of another, exact duplicates included', () => {
    const m = ladderOverlaps([
      { id: 'a', head: 'e invoicing in uae', keywords: ['e invoicing in uae', 'uae e invoicing penalties', 'peppol uae'] },
      { id: 'b', head: 'e invoicing uae', keywords: ['e invoicing uae', 'peppol uae'] },
      { id: 'c', head: 'payroll software uae', keywords: ['payroll software uae', 'wps payroll uae'] },
    ]);
    expect(m.get('a')).toEqual([{ ladderId: 'b', head: 'e invoicing uae', keywords: ['e invoicing in uae', 'peppol uae'] }]);
    expect(m.get('b')).toEqual([{ ladderId: 'a', head: 'e invoicing in uae', keywords: ['e invoicing uae', 'peppol uae'] }]);
    expect(m.get('c')).toEqual([]);
  });
});

describe('ladder status', () => {
  const base = { pages: [page(), page(), page()], headHistory: [] as RankPoint[], siteWaiting: 0, maxWaiting: 3, now: NOW };

  it('won: the main keyword in the top 3 in each of the last 4 checks (failed checks do not count)', () => {
    expect(isWon(weekly([9, 3, 2, 1, 2]))).toBe(true);
    expect(isWon(weekly([3, 2, 4, 1]))).toBe(false);
    expect(isWon(weekly([2, 2, 2]))).toBe(false);
    expect(isWon([...weekly([1, 2, 3, 3]), { checkedAt: ago(0), position: -1 }])).toBe(true);
    expect(isWon(weekly([1, 2, 0, 3]))).toBe(false);
  });

  it('improvement over the last 8 weeks: latest position against the one at the start of the window', () => {
    expect(improvedWithin(weekly([30, 28, 28, 28, 28, 28, 28, 28, 27, 25]), 8, NOW)).toBe(true);
    expect(improvedWithin(weekly([12, 12, 14, 15, 15, 15, 15, 15, 15, 15]), 8, NOW)).toBe(false);
    expect(improvedWithin(weekly([0, 0, 0, 0, 0, 0, 0, 0, 0, 48]), 8, NOW)).toBe(true);
    expect(improvedWithin(weekly([20]), 8, NOW)).toBe(false);
  });

  it('stuck: live 8+ weeks and no live page moved up in 8 weeks', () => {
    const flat = page({ state: 'published', publishedAt: ago(70), history: weekly([18, 18, 19, 20, 20, 20, 20, 20, 20, 20]) });
    expect(isStuck([flat, page()], NOW)).toBe(true);
    expect(isStuck([flat, page({ state: 'published', publishedAt: ago(70), history: weekly([40, 40, 40, 40, 40, 40, 40, 40, 40, 31]) })], NOW)).toBe(false);
    // live for less than 8 weeks: too early to say
    expect(isStuck([page({ state: 'published', publishedAt: ago(30), history: weekly([20, 20, 20, 20]) })], NOW)).toBe(false);
    expect(isStuck([page()], NOW)).toBe(false);
  });

  it('planning, writing, climbing', () => {
    expect(ladderStatus(base).status).toBe('planning');
    expect(ladderStatus(base).statusText).toBe('Planned: 3 pages, none written yet.');
    const w = ladderStatus({ ...base, pages: [page({ state: 'writing' }), page({ state: 'waiting', writtenAt: ago(2) }), page()] });
    expect([w.status, w.statusText]).toEqual(['writing', '2 of 3 pages written, none live yet.']);
    const c = ladderStatus({ ...base, pages: [page({ state: 'published', publishedAt: ago(10) }), page(), page()], headHistory: weekly([0, 34]) });
    expect([c.status, c.statusText]).toEqual(['climbing', '1 of 3 pages live; the main keyword is at #34.']);
    expect(ladderStatus({ ...base, pages: [page({ state: 'published' })], headHistory: weekly([0]) }).statusText).toContain('not in the top 50 yet');
  });

  it('settings come first: paused, archived, won, queued', () => {
    expect(ladderStatus({ ...base, settingsStatus: 'paused' }).status).toBe('paused');
    expect(ladderStatus({ ...base, settingsStatus: 'archived' }).statusText).toMatch(/^Archived/);
    expect(ladderStatus({ ...base, settingsStatus: 'won' }).status).toBe('won');
    expect(ladderStatus({ ...base, headHistory: weekly([3, 2, 1, 1]) }).status).toBe('won');
    expect(ladderStatus({ ...base, queued: true }).status).toBe('queued');
    expect(ladderStatus({ ...base, settingsStatus: 'queued' }).status).toBe('queued');
    expect(ladderStatus({ ...base, settingsStatus: 'stuck' }).status).toBe('stuck');
  });

  it('needs you: a page waiting 7+ days, or the website’s pile-up of waiting pages', () => {
    const late = ladderStatus({ ...base, pages: [page({ state: 'waiting', writtenAt: ago(9) }), page()] });
    expect(late.status).toBe('needs_you');
    expect(late.statusText).toContain('the oldest for 9 days');
    expect(ladderStatus({ ...base, pages: [page({ state: 'waiting', writtenAt: ago(3) }), page()] }).status).toBe('writing');
    const pile = ladderStatus({ ...base, pages: [page({ state: 'published' }), page()], siteWaiting: 3 });
    expect(pile.status).toBe('needs_you');
    expect(pile.statusText).toContain('3 pages of this website wait');
    // nothing left to write or publish: the pile-up does not hold this ladder back
    expect(ladderStatus({ ...base, pages: [page({ state: 'published' })], siteWaiting: 5 }).status).toBe('climbing');
  });
});

describe('ladder controls: request schemas', () => {
  it('one ladder: Auto / Manual and Pause / Resume only — the system’s statuses (won, stuck, queued) are refused', async () => {
    const { ladderSettingsSchema } = await import('./schemas');
    expect(ladderSettingsSchema.parse({ mode: 'manual' })).toEqual({ mode: 'manual' });
    expect(ladderSettingsSchema.parse({ status: 'paused', mode: 'auto', extra: 1 })).toEqual({ status: 'paused', mode: 'auto' });
    for (const bad of [{}, { status: 'stuck' }, { status: 'won' }, { status: 'queued' }, { mode: 'Auto' }]) expect(ladderSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it('order: ladder ids, each once', async () => {
    const { ladderOrderSchema } = await import('./schemas');
    expect(ladderOrderSchema.parse({ ladderIds: ['lad_mupia2l2c0tp', 'lad_b'] }).ladderIds).toHaveLength(2);
    for (const bad of [{ ladderIds: [] }, { ladderIds: ['a', 'a'] }, { ladderIds: ['../x'] }, {}]) expect(ladderOrderSchema.safeParse(bad).success).toBe(false);
  });

  it('website defaults: 1-5 ladders at a time, 1-10 waiting pages, auto-start on / off, something to change', async () => {
    const { siteAutomationSchema } = await import('./schemas');
    expect(siteAutomationSchema.parse({ defaultMode: 'manual', opportunities: 'auto', maxActiveLadders: 5, maxWaiting: 10 })).toEqual({ defaultMode: 'manual', opportunities: 'auto', maxActiveLadders: 5, maxWaiting: 10 });
    for (const bad of [{}, { maxActiveLadders: 0 }, { maxActiveLadders: 6 }, { maxWaiting: 11 }, { maxWaiting: 2.5 }, { autoStartLadders: 'yes' }]) expect(siteAutomationSchema.safeParse(bad).success).toBe(false);
  });
});
