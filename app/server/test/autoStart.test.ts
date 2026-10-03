import { describe, expect, it, vi } from 'vitest';
import type { LadderCard, PipelineData, RecommendedKeyword, RecommendedKeywords, SiteAutomation } from '@seo/shared';
import { HttpError } from '../src/lib/errors';
import { activeAutoLadders, autoStartDecision, autoStartForSite, type AutoStartDeps, type AutoStartState } from '../src/services/autoStart';

// "Choose keywords for me": which keyword starts, and when nothing does. Everything the decision reads is passed in; the job around it
// runs with fake dependencies (no database, no n8n, no paid run).

const NOW = Date.parse('2026-10-03T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 864e5).toISOString();
const AUTOMATION: SiteAutomation = { defaultMode: 'auto', opportunities: 'auto', autoStartLadders: true, maxActiveLadders: 2, maxWaiting: 3 };
const counts = (planned: number, total = 6) => ({ total, published: total - planned, waiting: 0, writing: 0, planned });
const card = (id: string, o: Partial<LadderCard> = {}): AutoStartState['cards'][number] => ({ id, mode: 'auto', status: 'writing', counts: counts(3), ...o });
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
const recommended = (keywords: RecommendedKeyword[], o: Partial<RecommendedKeywords> = {}): RecommendedKeywords => ({ reportId: 'rep-1', receivedAt: daysAgo(10), ageDays: 10, stale: false, reach: 30, country: 'United Arab Emirates', keywords, ...o });

const state = (o: Partial<AutoStartState> = {}): AutoStartState => ({
  automation: AUTOMATION,
  cards: [card('lad_a')],
  ladders: [{ id: 'lad_a', head: 'e invoicing in uae', keywords: ['peppol uae', 'e invoicing in uae'] }],
  recommended: recommended([rec('hard one', { difficultyForYou: 'hard', planType: 'full' }), rec('odoo partner uae'), rec('erp dubai', { difficultyForYou: 'reachable', planType: 'short' })]),
  previous: [],
  ladderRunActive: false,
  pileup: false,
  trackingPaused: false,
  fitOf: new Map(),
  now: NOW,
  ...o,
});

describe('auto-start: the decision', () => {
  it('starts the first recommended keyword that is easy or reachable when a slot is free', () => {
    const d = autoStartDecision(state());
    expect(d.start?.keyword).toBe('odoo partner uae');
    expect(d.reason).toMatch(/Easy for your site/);
  });

  it('off, paused, a ladder being planned, the pile-up guard: nothing starts', () => {
    expect(autoStartDecision(state({ automation: { ...AUTOMATION, autoStartLadders: false } }))).toEqual({ start: null, reason: '"Choose keywords for me" is off' });
    expect(autoStartDecision(state({ trackingPaused: true })).start).toBeNull();
    expect(autoStartDecision(state({ ladderRunActive: true })).reason).toMatch(/being planned/);
    expect(autoStartDecision(state({ pileup: true })).reason).toMatch(/wait to be published/);
  });

  it('counts only Auto ladders with pages left that are not paused, won or queued', () => {
    const cards = [
      card('a'),
      card('b', { status: 'needs_you' }),
      card('c', { mode: 'manual' }),
      card('d', { status: 'paused' }),
      card('e', { status: 'won' }),
      card('f', { status: 'queued' }),
      card('g', { counts: counts(0) }),
      card('h', { status: 'planning', counts: counts(6, 6) }),
    ];
    expect(activeAutoLadders(cards)).toBe(3);
    expect(autoStartDecision(state({ cards: cards.slice(0, 2) })).reason).toMatch(/2 Auto ladders with pages to write \(the limit is 2\)/);
    expect(autoStartDecision(state({ cards: [cards[0], cards[7]] })).start).toBeNull();
    expect(autoStartDecision(state({ cards: cards.slice(2, 7) })).start?.keyword).toBe('odoo partner uae');
    expect(autoStartDecision(state({ cards: [], automation: { ...AUTOMATION, maxActiveLadders: 1 } })).start?.keyword).toBe('odoo partner uae');
  });

  it('at most one automatic start a week; never a keyword started automatically before (or the same search)', () => {
    expect(autoStartDecision(state({ previous: [{ keyword: 'old one', at: daysAgo(6) }] })).reason).toMatch(/less than 7 days ago/);
    expect(autoStartDecision(state({ previous: [{ keyword: 'old one', at: daysAgo(8) }] })).start?.keyword).toBe('odoo partner uae');
    expect(autoStartDecision(state({ previous: [{ keyword: 'Odoo partner UAE', at: daysAgo(30) }] })).start?.keyword).toBe('erp dubai');
    expect(autoStartDecision(state({ previous: [{ keyword: 'odoo partners in the uae', at: daysAgo(30) }] })).start?.keyword).toBe('erp dubai');
  });

  it('skips keywords a ladder covers now, off-topic keywords (a check said fit 0) and plans that are not realistic', () => {
    const ladders = [{ id: 'lad_o', head: 'odoo partner uae', keywords: [] }];
    expect(autoStartDecision(state({ ladders })).start?.keyword).toBe('erp dubai');
    expect(autoStartDecision(state({ fitOf: new Map([['odoo partner uae', 0]]) })).start?.keyword).toBe('erp dubai');
    expect(autoStartDecision(state({ fitOf: new Map([['odoo partner uae', null]]) })).start?.keyword).toBe('odoo partner uae');
    const r = recommended([rec('cleartax login', { difficultyForYou: 'easy', planType: 'none' }), rec('vat software', { difficultyForYou: 'very_hard', planType: 'full' }), rec('x y z', { difficultyForYou: null, planType: null })]);
    expect(autoStartDecision(state({ recommended: r })).reason).toMatch(/no recommended keyword is easy or reachable/);
  });

  it('needs keyword research of the last 90 days', () => {
    expect(autoStartDecision(state({ recommended: recommended([], { reportId: null, ageDays: null }) })).reason).toMatch(/no keyword research/);
    expect(autoStartDecision(state({ recommended: recommended([rec('odoo partner uae')], { ageDays: 91, stale: true }) })).reason).toMatch(/older than 90 days/);
    expect(autoStartDecision(state({ recommended: recommended([rec('odoo partner uae')], { ageDays: 90 }) })).start?.keyword).toBe('odoo partner uae');
  });
});

describe('auto-start: one website', () => {
  const org = { id: 'org-1', disabled: false, monthlyBudgetUsd: 25 } as never;
  const site = {
    id: '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8',
    domain: 'techand.ai',
    country: 'United Arab Emirates',
    business: 'E-invoicing consulting',
    customers: 'finance teams',
    businessFacts: 'FTA accredited',
    goal: 'leads',
    tone: 'Professional and direct',
    cta: 'Book a call',
    verifiedAt: new Date(),
    trackingStatus: 'active',
  } as never;
  const pipeline = (o: Partial<PipelineData> = {}) =>
    ({
      automation: AUTOMATION,
      ladderCards: [card('lad_a')],
      ladders: [{ id: 'lad_a', head: 'e invoicing in uae', pages: 2, published: 0, planned: [], keywords: ['peppol uae', 'e invoicing in uae'] }],
      activeRuns: [],
      queue: { paused: null },
      tracking: { status: 'active' },
      ...o,
    }) as unknown as PipelineData;
  const deps = (o: Partial<AutoStartDeps> = {}): AutoStartDeps & { started: unknown[] } => {
    const started: unknown[] = [];
    return {
      started,
      pipeline: async () => pipeline(),
      recommended: async () => recommended([rec('odoo partner uae')]),
      previous: async () => [],
      fits: async () => new Map(),
      owner: async () => ({ id: 'owner-1', email: 'owner@example.org' }) as never,
      start: vi.fn(async (a, input) => (started.push({ a, input }), { id: 'run-1', status: 'accepted', error: null }) as never),
      ...o,
    };
  };

  it('starts a ladder run as the owner with the website’s business details, one page, no e-mail, no preferences', async () => {
    const d = deps();
    const r = await autoStartForSite(org, site, d, NOW);
    expect(r).toMatchObject({ runId: 'run-1', keyword: 'odoo partner uae' });
    expect(d.started).toHaveLength(1);
    const { a, input } = d.started[0] as { a: { role: string; user: { id: string } }; input: Record<string, unknown> };
    expect([a.role, a.user.id]).toEqual(['owner', 'owner-1']);
    expect(input).toEqual({
      mode: 'ladder',
      siteId: '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8',
      keyword: 'odoo partner uae',
      country: 'United Arab Emirates',
      business: 'E-invoicing consulting',
      customers: 'finance teams',
      businessFacts: 'FTA accredited',
      goal: 'leads',
      tone: 'Professional and direct',
      cta: 'Book a call',
      pagesNow: 1,
      emailCopy: false,
    });
  });

  it('over the budget (402): skipped, nothing else thrown; other errors surface', async () => {
    const over = deps({ start: async () => Promise.reject(new HttpError(402, 'over', 'budget')) });
    expect(await autoStartForSite(org, site, over, NOW)).toEqual({ runId: null, keyword: 'odoo partner uae', reason: 'it would go over the monthly budget' });
    const broken = deps({ start: async () => Promise.reject(new Error('db down')) });
    await expect(autoStartForSite(org, site, broken, NOW)).rejects.toThrow('db down');
  });

  it('nothing starts: a ladder run going, the pile-up guard, no owner, a disabled company, an unknown country', async () => {
    for (const p of [pipeline({ activeRuns: [{ id: 'r', mode: 'ladder', keyword: 'x', createdAt: daysAgo(0) }] }), pipeline({ queue: { paused: { reason: 'pileup', waiting: 3, max: 3 } } as never })]) {
      const d = deps({ pipeline: async () => p });
      expect((await autoStartForSite(org, site, d, NOW)).runId).toBeNull();
      expect(d.started).toHaveLength(0);
    }
    const noOwner = deps({ owner: async () => null });
    expect(await autoStartForSite(org, site, noOwner, NOW)).toMatchObject({ runId: null, reason: 'the company has no owner' });
    expect((await autoStartForSite({ ...(org as object), disabled: true } as never, site, deps(), NOW)).reason).toBe('the company is disabled');
    const narnia = deps();
    expect((await autoStartForSite(org, { ...(site as object), country: 'Narnia' } as never, narnia, NOW)).reason).toMatch(/settings are incomplete \(country\)/);
    expect(narnia.started).toHaveLength(0);
  });
});
