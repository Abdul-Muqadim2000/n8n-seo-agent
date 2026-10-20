import { describe, expect, it } from 'vitest';
import type { LadderCard, RecommendedKeyword, RecommendedKeywords } from '@seo/shared';
import { activeAutoLadders, announcementMail, localMoment, MAX_FAILED_STARTS, proposalDecision, proposalDetails, proposedBeforeOf, type ProposalState } from '../src/services/autoStart';

// The next keyword, proposed by the system (SCHEDULING_KEYWORDS_PLAN.md §5.6 / §5.7): which keyword is proposed, when nothing is, and when
// the research is refreshed first. The decision is pure (every input is passed in); the store, the timer and the client's decisions run
// end to end on a real Postgres in keywordFirst.test.ts.

const NOW = Date.parse('2026-10-20T12:00:00Z');
const counts = (planned: number, total = 6) => ({ total, published: total - planned, waiting: 0, writing: 0, planned });
const card = (id: string, o: Partial<LadderCard> = {}): ProposalState['cards'][number] => ({ id, head: id, mode: 'auto', status: 'writing', counts: counts(3), ...o });
const rec = (keyword: string, o: Partial<RecommendedKeyword> = {}): RecommendedKeyword => ({
  keyword,
  volume: 200,
  kd: 20,
  intent: 'commercial',
  pageType: 'Service Page',
  why: '',
  difficultyForYou: 'easy',
  planType: 'direct',
  months: '2-4',
  label: 'Easy for your site · Direct plan · 2-4 months',
  source: 'priority',
  overlaps: [],
  ...o,
});
const recommended = (keywords: RecommendedKeyword[], o: Partial<RecommendedKeywords> = {}): RecommendedKeywords => ({ reportId: 'rep-1', receivedAt: new Date(NOW - 10 * 864e5).toISOString(), ageDays: 10, stale: false, reach: 30, country: 'United Arab Emirates', keywords, ...o });

const state = (o: Partial<ProposalState> = {}): ProposalState => ({
  enabled: true,
  level: 2,
  maxActive: 2,
  cards: [card('lad_a')],
  ladders: [{ id: 'lad_a', head: 'e invoicing in uae', keywords: ['peppol uae', 'e invoicing in uae'] }],
  recommended: recommended([rec('hard one', { difficultyForYou: 'hard', planType: 'full' }), rec('odoo partner uae', { why: 'Buyers compare partners' }), rec('erp dubai', { difficultyForYou: 'reachable', planType: 'short' })]),
  proposedBefore: [],
  open: false,
  ladderRunActive: false,
  researchRunning: false,
  paused: false,
  fitOf: new Map(),
  ...o,
});

describe('keyword proposals: the decision', () => {
  it('proposes the first recommended keyword that is easy or reachable when there is room, with why', () => {
    const d = proposalDecision(state());
    expect(d).toMatchObject({ action: 'propose', pick: { keyword: 'odoo partner uae' }, occasion: 'room', why: 'Buyers compare partners.' });
  });

  it('the platform switch, a pause, an open proposal, a ladder being planned, research running: nothing', () => {
    expect(proposalDecision(state({ enabled: false }))).toMatchObject({ action: 'none', why: expect.stringMatching(/AUTO_START_LADDERS/) });
    expect(proposalDecision(state({ paused: true })).action).toBe('none');
    expect(proposalDecision(state({ open: true })).why).toMatch(/already waits/);
    expect(proposalDecision(state({ ladderRunActive: true })).why).toMatch(/being planned/);
    expect(proposalDecision(state({ researchRunning: true })).why).toMatch(/research is running/);
  });

  it('room: fewer Auto ladders with pages to write than the limit and none queued', () => {
    const cards = [card('a'), card('b', { status: 'needs_you' }), card('c', { mode: 'manual' }), card('d', { status: 'paused' }), card('e', { status: 'won' }), card('g', { counts: counts(0) })];
    expect(activeAutoLadders(cards)).toBe(2);
    expect(proposalDecision(state({ cards: cards.slice(0, 2) })).why).toMatch(/2 Auto ladders with pages to write \(the limit is 2\)/);
    expect(proposalDecision(state({ cards: [card('a'), card('q', { status: 'queued' })] })).why).toMatch(/wait for a free place|waits for a free place/);
    expect(proposalDecision(state({ cards: [] })).action).toBe('propose');
  });

  it('a won ladder or one with no pages left is the occasion, and says so', () => {
    const won = proposalDecision(state({ cards: [card('a', { status: 'won', counts: counts(0) })] }));
    expect(won).toMatchObject({ action: 'propose', occasion: 'won', why: expect.stringMatching(/^Your ladder reached the top 3/) });
    const done = proposalDecision(state({ cards: [card('a', { counts: counts(0) })] }));
    expect(done).toMatchObject({ action: 'propose', occasion: 'done', why: expect.stringMatching(/no pages left/) });
  });

  it('never a keyword proposed before (any outcome, any spelling), one a ladder covers, off topic (fit 0), or with no plan', () => {
    expect(proposalDecision(state({ proposedBefore: ['Odoo Partner UAE'] }))).toMatchObject({ pick: { keyword: 'erp dubai' } });
    const covered = recommended([rec('peppol uae'), rec('e invoicing uae'), rec('odoo partner uae')]);
    expect(proposalDecision(state({ recommended: covered }))).toMatchObject({ pick: { keyword: 'odoo partner uae' } });
    expect(proposalDecision(state({ fitOf: new Map([['odoo partner uae', 0]]) }))).toMatchObject({ pick: { keyword: 'erp dubai' } });
    expect(proposalDecision(state({ recommended: recommended([rec('x one', { planType: 'none' }), rec('x two', { difficultyForYou: 'not_realistic' })]) })).action).toBe('none');
  });

  it('no research, or research older than 90 days: levels 1-2 propose nothing (a recommendation offers the research); level 3 refreshes it (autopilot)', () => {
    for (const r of [recommended([], { reportId: null, ageDays: null }), recommended([rec('odoo partner uae')], { ageDays: 91 })]) {
      expect(proposalDecision(state({ recommended: r })).action).toBe('none');
      expect(proposalDecision(state({ recommended: r, level: 1 })).action).toBe('none');
      expect(proposalDecision(state({ recommended: r, level: 3 })).action).toBe('research');
    }
  });

  it('the announcement e-mail: plain words, the date it starts in the website\'s own time zone, the credits a page; no dollar figure', () => {
    const m = announcementMail({
      site: { domain: 'techand.ai', timezone: 'Asia/Dubai' },
      p: { id: 'p', siteId: 's', keyword: 'crm consulting', status: 'pending', startAt: '2026-10-22T12:00:00.000Z', level: 3, why: 'You offer CRM implementation.', occasion: 'room', searches: 320, difficulty: 'easy', chance: 'Good chance', planType: 'direct', months: '2-4', creditsPerPage: 51, runId: null, swappedFor: null, note: '', createdAt: '', decidedAt: null, decidedBy: null },
      url: 'https://app.test/x',
    });
    expect(m.subject).toBe('We will start "crm consulting" for techand.ai');
    // 12:00 UTC is 16:00 in Dubai: the owner reads the time of their own website, never UTC
    expect(m.lines.join(' ')).toMatch(/starts on Thursday 22 October at 16:00 \(Dubai time\) unless you change it/);
    expect(m.lines.join(' ')).not.toMatch(/UTC/);
    expect(m.lines.join(' ')).toMatch(/about 51 credits/);
    expect(m.details).toEqual([
      { label: 'Keyword', value: 'crm consulting' },
      { label: 'Searches a month', value: 'about 320' },
      { label: 'Your chances', value: 'Good chance' },
      { label: 'Time to rank', value: '2-4 months' },
    ]);
    expect(JSON.stringify(m)).not.toMatch(/\$|USD|—|…/);
  });
});

describe('keyword proposals: the production-safety fixes (2026-10-20)', () => {
  it('the start time in the website\'s zone, across time zones and daylight saving; an unknown zone falls back to the engine\'s', () => {
    expect(localMoment('2026-10-22T12:00:00.000Z', 'America/New_York')).toBe('Thursday 22 October at 08:00 (New York time)');
    expect(localMoment('2026-11-05T12:00:00.000Z', 'America/New_York')).toBe('Thursday 5 November at 07:00 (New York time)');
    expect(localMoment('2026-10-22T12:00:00.000Z', 'UTC')).toBe('Thursday 22 October at 12:00 (UTC)');
    expect(localMoment('2026-10-22T12:00:00.000Z', 'Mars/Olympus')).toBe('Thursday 22 October at 08:00 (New York time)');
  });

  it('a keyword whose start failed can be proposed again, until it failed MAX_FAILED_STARTS times; any other outcome is final', () => {
    expect(proposedBeforeOf([{ k: 'CRM consulting', status: 'failed' }])).toEqual([]);
    expect(proposedBeforeOf(Array.from({ length: MAX_FAILED_STARTS }, () => ({ k: 'crm consulting', status: 'failed' })))).toEqual(['crm consulting']);
    expect(proposedBeforeOf([{ k: 'a', status: 'skipped' }, { k: 'b', status: 'started' }, { k: 'c', status: 'approved' }, { k: 'd', status: 'pending' }]).sort()).toEqual(['a', 'b', 'c', 'd']);
    // the decision then proposes it again
    const d = proposalDecision(state({ proposedBefore: proposedBeforeOf([{ k: 'odoo partner uae', status: 'failed' }]) }));
    expect(d).toMatchObject({ action: 'propose', pick: { keyword: 'odoo partner uae' } });
  });

  it('every proposal carries the keys the app reads back (volume, difficultyForYou, planType, months, why), null when unknown', () => {
    const full = proposalDetails(rec('odoo partner uae'), 'Buyers compare partners.', 'rep-1');
    expect(full).toMatchObject({ volume: 200, difficultyForYou: 'easy', planType: 'direct', months: '2-4', why: 'Buyers compare partners.', reportId: 'rep-1' });
    const bare = proposalDetails({ keyword: 'x' } as Partial<RecommendedKeyword>, '', null);
    for (const k of ['volume', 'difficultyForYou', 'planType', 'months', 'why']) expect(Object.keys(JSON.parse(JSON.stringify(bare)))).toContain(k);
    expect([bare.volume, bare.difficultyForYou, bare.planType]).toEqual([null, null, null]);
  });
});
