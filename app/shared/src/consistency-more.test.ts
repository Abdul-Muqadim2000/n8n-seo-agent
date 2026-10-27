import { describe, expect, it } from 'vitest';
import { consistencyWarnings, needsAcknowledge, type ConsistencyCtx, type Warning } from './consistency';
import { productFamilies } from './consistency-more';
import type { PipelineData } from './data';
import { importTargetHosts } from './link-import';

// The remaining cases of the mismatch audit (n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §3), as entries of the one registry.
// Fixtures are the production facts: techand.ai on 2026-10-26 (one click on "Start this ladder" planned "erp & crm software" next to its
// Auto ladder "dynamics 365 erp system" and wrote a page, about 111 credits), devaicon.com (Pakistan), "ms 365 erp".

const TECHAND = { domain: 'techand.ai', country: 'United Arab Emirates', business: 'Microsoft Dynamics 365 partner in the UAE', customers: 'Finance teams', businessFacts: 'Gold partner since 2015, 120 projects.', services: ['Dynamics 365 Business Central'], competitors: ['cleartax.com'] };
const API = '/api/orgs/org-1/sites/site-1';

type Card = { id: string; head: string; mode: 'auto' | 'manual'; status: string; planned?: number };
function pipeline(o: { cards?: Card[]; defaultMode?: 'auto' | 'manual'; ready?: boolean; waiting?: number; pagesPerWeek?: number; maxActive?: number; maxWaiting?: number; level?: 1 | 2 | 3; written?: PipelineData['written']; notChosen?: string[]; keywords?: Record<string, string[]>; paused?: boolean } = {}): PipelineData {
  const cards = o.cards ?? [{ id: 'lad_d365', head: 'dynamics 365 erp system', mode: 'auto', status: 'climbing', planned: 4 }];
  return {
    activeRuns: [],
    automations: [],
    running: [],
    written: o.written ?? [],
    tracking: { status: o.paused ? 'paused' : 'active', verified: true, reportsToThisApp: true, engineEmails: false },
    queue: { pagesPerWeek: o.pagesPerWeek ?? 1, next: [], later: [], waiting: Array.from({ length: o.waiting ?? 0 }, (_x, i) => ({ keyword: `page ${i + 1}`, startedAt: '2026-10-20T00:00:00Z', days: 7 })), engineUpcoming: [], engineUpcomingAt: null },
    ladders: cards.map((c) => ({ id: c.id, head: c.head, pages: 6, published: 1, planned: [], keywords: o.keywords?.[c.id] ?? [c.head] })),
    ladderCards: cards.map((c) => ({ id: c.id, head: c.head, mode: c.mode, status: c.status, counts: { total: 6, published: 1, waiting: 0, writing: 0, planned: c.planned ?? 4 } })),
    automation: { defaultMode: o.defaultMode ?? 'auto', opportunities: 'manual', autoStartLadders: false, maxActiveLadders: o.maxActive ?? 2, maxWaiting: o.maxWaiting ?? 3, autopilotLevel: o.level ?? 2 },
    autopilot: { level: o.level ?? 2, waitingForKeyword: false, reason: '', suggestions: [], refused: [], dropped: null, notChosen: o.notChosen ?? [] },
    readiness: o.ready === false ? { ready: false, profileReady: false, factsReady: true, missing: ['author_name', 'author_bio'], missingText: "your author's name and a short author bio" } : { ready: true, profileReady: true, factsReady: true, missing: [], missingText: '' },
  } as unknown as PipelineData;
}
const ctx = (over: Partial<ConsistencyCtx> = {}): ConsistencyCtx => ({ site: TECHAND, siteApi: API, tracked: true, pipeline: pipeline(), ...over });
const ids = (w: Warning[]) => w.map((x) => x.id);
const byCode = (w: Warning[], code: string) => w.find((x) => x.code === code);
const PROPOSAL = { mode: 'ladder', keyword: 'erp & crm software', country: 'United Arab Emirates', pagesNow: 1, chosenBy: 'client_picked' };

describe('D1 accepting a keyword suggestion starts a new ladder (production replay, techand.ai 2026-10-26)', () => {
  const w = consistencyWarnings('run', PROPOSAL, ctx({ start: { proposal: true, admin: true, credits: 111, planCredits: 12 } }));
  const d1 = byCode(w, 'money.new_ladder')!;

  it('asks first, in plain words: a new ladder, a page written now, the quote, the ladder it joins and overlaps', () => {
    expect(w[0]!.code).toBe('money.new_ladder');   // the first thing read
    expect(d1.title).toBe('This starts a new keyword ladder for "erp & crm software"');
    expect(d1.body).toContain('becomes keyword ladder number 2, next to "dynamics 365 erp system"');
    expect(d1.body).toContain('writes its first page now: about 111 credits in total (about 12 credits to plan it, the rest for the page)');
    expect(d1.body).toContain('It is about ERP like your ladder "dynamics 365 erp system", so their pages compete for the same buyers.');
    expect(d1.body).toContain('Nothing has started yet.');
    expect(d1.confirm).toBe('Start it and write the first page now (about 111 credits)');
  });

  it('is refused unless acknowledged; the safe Accept plans it without a page', () => {
    expect(needsAcknowledge(w).map((x) => x.id)).toContain('money.new_ladder:erp crm software');
    expect(d1.accept).toEqual({ label: 'Plan it without writing a page (about 12 credits)', change: { kind: 'fields', set: { ladderMode: 'manual' } } });
    // after Accept the request carries ladderMode manual: the confirmation is answered (the person chose the plan-only start)
    const after = consistencyWarnings('run', { ...PROPOSAL, ladderMode: 'manual' }, ctx({ start: { proposal: true, credits: 12, planCredits: 12 } }));
    expect(byCode(after, 'money.new_ladder')).toBeUndefined();
  });

  it('D2 joins it: "erp & crm software" and "dynamics 365 erp system" are both about ERP (word overlap is under 75%)', () => {
    const d2 = byCode(w, 'money.same_family')!;
    expect(d2.id).toBe('money.same_family:erp crm software:lad_d365');
    expect(d2.accept).toEqual({ label: 'Add it to "dynamics 365 erp system" instead', change: { kind: 'call', method: 'POST', path: `${API}/ladders/lad_d365/keywords`, body: { keyword: 'erp & crm software' }, instead: true } });
    expect(productFamilies('erp & crm software')).toEqual(['ERP', 'CRM']);
    expect(productFamilies('ai automation services')).toEqual([]);   // AI and IT are too wide to be one product
  });

  it('a held first page or a Manual default says so; an automatic start is never asked (its announcement is the warning)', () => {
    const held = byCode(consistencyWarnings('run', PROPOSAL, ctx({ pipeline: pipeline({ ready: false }), start: { proposal: true, credits: 12, planCredits: 12 } })), 'money.new_ladder')!;
    expect(held.body).toContain("Its first page waits until your author's name and a short author bio are on file");
    expect(held.accept).toBeUndefined();
    const manual = byCode(consistencyWarnings('run', PROPOSAL, ctx({ pipeline: pipeline({ defaultMode: 'manual' }), start: { proposal: true, planCredits: 12 } })), 'money.new_ladder')!;
    expect(manual.body).toContain('New ladders on your website are Manual');
    expect(manual.confirm).toBe('Start this ladder');
    expect(byCode(consistencyWarnings('run', PROPOSAL, ctx({ start: { proposal: true, auto: true } })), 'money.new_ladder')).toBeUndefined();
    expect(byCode(consistencyWarnings('run', PROPOSAL, ctx({ start: {} })), 'money.new_ladder')).toBeUndefined();   // a form start: its own flow
  });
});

describe('D3 / D4 / D5 / D7 pages and keywords the website already has', () => {
  it('D3: a live page that already answers the keyword; Accept improves it', () => {
    const live = [{ keyword: 'ms 365 erp', url: 'https://techand.ai/dynamics-365-business-central-uae', title: 'Dynamics 365 Business Central UAE', matchedBy: 'title' as const }];
    const w = consistencyWarnings('run', { mode: 'keyword', keyword: 'ms 365 erp', receiveContent: true, country: 'United Arab Emirates' }, ctx({ livePages: live }));
    const d3 = byCode(w, 'money.page_exists')!;
    expect(d3.title).toBe('Your page techand.ai/dynamics-365-business-central-uae already answers "ms 365 erp"');
    expect(d3.accept!.change).toEqual({ kind: 'fields', set: { existingPageUrl: 'https://techand.ai/dynamics-365-business-central-uae' } });
    // improving that page is the correction: nothing to ask
    expect(byCode(consistencyWarnings('run', { mode: 'keyword', keyword: 'ms 365 erp', receiveContent: true, existingPageUrl: live[0]!.url }, ctx({ livePages: live })), 'money.page_exists')).toBeUndefined();
    expect(byCode(consistencyWarnings('ladder_add', { keyword: 'ms 365 erp', ladderId: 'lad_d365' }, ctx({ livePages: live })), 'money.page_exists')?.confirm).toBe('Add it anyway');
  });

  it('D4: "Add to my ladder" checks the other ladders, a search nobody can win and the market', () => {
    const p = pipeline({ cards: [{ id: 'lad_d365', head: 'dynamics 365 erp system', mode: 'auto', status: 'climbing' }, { id: 'lad_einv', head: 'e invoicing uae', mode: 'auto', status: 'climbing' }], keywords: { lad_einv: ['e invoicing uae', 'peppol uae'] } });
    expect(ids(consistencyWarnings('ladder_add', { keyword: 'peppol uae', ladderId: 'lad_d365' }, ctx({ pipeline: p })))).toContain('money.ladder_add_overlap:peppol uae:lad_einv');
    expect(ids(consistencyWarnings('ladder_add', { keyword: 'fta portal login', ladderId: 'lad_d365' }, ctx({ pipeline: p })))).toContain('money.ladder_add_fit:fta portal login');
    expect(ids(consistencyWarnings('ladder_add', { keyword: 'erp software lahore', ladderId: 'lad_d365' }, ctx({ pipeline: p })))).toContain('market.keyword_place:erp software lahore:AE');
    expect(consistencyWarnings('ladder_add', { keyword: 'business central pricing', ladderId: 'lad_d365' }, ctx({ pipeline: p }))).toEqual([]);
  });

  it('D5: rewriting the published page of another keyword', () => {
    const written = [{ keyword: 'dynamics 365 business central uae', status: 'published' as const, startedAt: '2026-10-01', publishedUrl: 'https://techand.ai/dynamics-365-business-central-uae', source: 'ladder' }];
    const w = consistencyWarnings('run', { mode: 'keyword', keyword: 'ms 365 erp', receiveContent: true, existingPageUrl: 'https://www.techand.ai/dynamics-365-business-central-uae/' }, ctx({ pipeline: pipeline({ written }) }));
    const d5 = byCode(w, 'data.page_owned')!;
    expect(d5.title).toBe('techand.ai/dynamics-365-business-central-uae is your page for "dynamics 365 business central uae"');
    expect(d5.accept!.change).toEqual({ kind: 'fields', set: { existingPageUrl: '' } });
  });

  it('D7: a watched keyword a ladder already checks every week; Accept removes it', () => {
    const w = consistencyWarnings('run', { mode: 'track', keywords: ['dynamics 365 erp system', 'odoo uae'], country: 'United Arab Emirates' }, ctx());
    expect(ids(w)).toEqual(['money.watch_dup:dynamics 365 erp system']);
    expect(w[0]!.accept!.change).toEqual({ kind: 'fields', set: { keywords: ['odoo uae'] } });
  });
});

describe('S6 / S8 / B1 / M5 what a start will really do', () => {
  it('S6: pages asked for now while new ladders are Manual; Accept makes this ladder Auto', () => {
    const w = consistencyWarnings('run', { mode: 'ladder', keyword: 'odoo partner uae', pagesNow: 2, country: 'United Arab Emirates' }, ctx({ pipeline: pipeline({ defaultMode: 'manual', cards: [] }) }));
    const s6 = byCode(w, 'pipeline.manual_pages_now')!;
    expect(s6.body).toContain('although you asked for 2 pages');
    expect(s6.accept!.change).toEqual({ kind: 'fields', set: { ladderMode: 'auto' } });
    expect(byCode(consistencyWarnings('run', { mode: 'ladder', keyword: 'odoo partner uae', ladderMode: 'manual' }, ctx({ pipeline: pipeline({ defaultMode: 'manual', cards: [] }) })), 'pipeline.manual_pages_now')).toBeUndefined();
  });

  it('S8: a page without the author profile is asked; a ladder only says its first page waits', () => {
    const page = byCode(consistencyWarnings('run', { mode: 'keyword', keyword: 'odoo uae', receiveContent: true }, ctx({ pipeline: pipeline({ ready: false }) })), 'content.not_ready')!;
    expect([page.tone, page.confirm, page.accept!.change]).toEqual(['warning', 'Write it anyway', { kind: 'link', sitePage: 'settings/profile' }]);
    const ladder = byCode(consistencyWarnings('run', { mode: 'ladder', keyword: 'odoo uae' }, ctx({ pipeline: pipeline({ ready: false, cards: [] }) })), 'content.not_ready')!;
    expect(ladder.tone).toBe('info');
  });

  it('B1: the form describes the business differently (information, Accept uses the settings); M5: a profile address abroad', () => {
    const b1 = byCode(consistencyWarnings('run', { mode: 'discover', business: 'Bakery and cake shop for weddings' }, ctx()), 'data.run_business')!;
    expect([b1.tone, b1.accept!.change]).toEqual(['info', { kind: 'fields', set: { business: TECHAND.business } }]);
    expect(byCode(consistencyWarnings('run', { mode: 'discover', business: 'Microsoft Dynamics 365 partner in the UAE and Oman' }, ctx()), 'data.run_business')).toBeUndefined();
    const m5 = byCode(consistencyWarnings('run', { mode: 'profile', country: 'Pakistan' }, ctx()), 'market.profile_address')!;
    expect([m5.tone, m5.title]).toEqual(['info', 'Your business address is in Pakistan, your main country is United Arab Emirates']);
  });
});

describe('S1-S5 / S7 / C1 / M7 settings that will write nothing or contradict each other', () => {
  it('S7: weekly pages off under an Auto ladder with pages left; Accept keeps 1 a week', () => {
    const w = consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 0 }, ctx());
    expect(ids(w)).toEqual(['pipeline.ladders_stop:' + w[0]!.id.split(':')[1]]);
    expect(w[0]!.accept!.change).toEqual({ kind: 'fields', set: { pagesPerWeek: 1 } });
  });

  it('S1: pages a week with nothing to write (no chosen keyword, profile missing, pile-up, paused); S2: above the waiting limit', () => {
    expect(ids(consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 2 }, ctx({ pipeline: pipeline({ cards: [] }) })))).toEqual(['pipeline.writes_nothing:no_keyword:2']);
    expect(ids(consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 1 }, ctx({ pipeline: pipeline({ ready: false }) })))).toEqual(['pipeline.writes_nothing:profile:1']);
    expect(ids(consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 1 }, ctx({ pipeline: pipeline({ waiting: 3 }) })))).toEqual(['pipeline.writes_nothing:pileup:1']);
    expect(ids(consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 1 }, ctx({ pipeline: pipeline({ paused: true }) })))).toEqual(['pipeline.writes_nothing:paused:1']);
    const s2 = consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 3 }, ctx({ pipeline: pipeline({ waiting: 1 }) }));
    expect(ids(s2)).toEqual(['pipeline.over_pileup:3:3:1']);
    expect(s2[0]!.accept!.change).toEqual({ kind: 'call', method: 'PATCH', path: `${API}/automation`, body: { maxWaiting: 4 } });
    expect(consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 1 }, ctx())).toEqual([]);
  });

  it('S3 / S4: a limit below what is writing, full autopilot with Manual ladders, a lower level that stops the ladders we started', () => {
    const two = pipeline({ cards: [{ id: 'a', head: 'dynamics 365 erp system', mode: 'auto', status: 'climbing' }, { id: 'b', head: 'e invoicing uae', mode: 'auto', status: 'writing' }] });
    const s3 = consistencyWarnings('settings', { setting: 'automation', maxActiveLadders: 1 }, ctx({ pipeline: two }));
    expect(s3[0]!.body).toContain('"e invoicing uae" waits as Queued');
    expect(s3[0]!.accept!.change).toEqual({ kind: 'fields', set: { maxActiveLadders: 2 } });
    expect(ids(consistencyWarnings('settings', { setting: 'automation', autopilotLevel: 3 }, ctx({ pipeline: pipeline({ defaultMode: 'manual' }) })))).toEqual(['pipeline.level3_manual']);
    expect(ids(consistencyWarnings('settings', { setting: 'automation', autopilotLevel: 2 }, ctx({ pipeline: pipeline({ level: 3, notChosen: ['erp & crm software'] }) })))[0]).toMatch(/^pipeline\.level_drop_system:2:/);
  });

  it('S5: a ladder resumed while the limit is full waits as Queued', () => {
    const p = pipeline({ maxActive: 1, cards: [{ id: 'a', head: 'dynamics 365 erp system', mode: 'auto', status: 'climbing' }, { id: 'b', head: 'e invoicing uae', mode: 'auto', status: 'paused' }] });
    expect(ids(consistencyWarnings('settings', { setting: 'ladder', ladderId: 'b', status: 'active' }, ctx({ pipeline: p })))).toEqual(['pipeline.ladder_queued:b:1']);
    expect(consistencyWarnings('settings', { setting: 'ladder', ladderId: 'a', status: 'paused' }, ctx({ pipeline: p }))).toEqual([]);
  });

  it('C1: a schedule whose use outruns the balance; Accept keeps the current setting', () => {
    const w = consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 3 }, ctx({ credits: { enforced: true, available: 300, dailyBefore: 8, dailyAfter: 30, revert: { pagesPerWeek: 1 } } }));
    const c1 = byCode(w, 'money.credits_runway')!;
    expect(c1.title).toBe('With this change your credits last about 10 days');
    expect(c1.body).toContain('instead of 37 days');
    expect(c1.accept!.change).toEqual({ kind: 'fields', set: { pagesPerWeek: 1 } });
    expect(byCode(consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 3 }, ctx({ credits: { enforced: true, available: 3000, dailyBefore: 8, dailyAfter: 30 } })), 'money.credits_runway')).toBeUndefined();
    expect(byCode(consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 0 }, ctx({ credits: { enforced: true, available: 10, dailyBefore: 8, dailyAfter: 5 } })), 'money.credits_runway')).toBeUndefined();
  });

  it('M7: the own market added as an extra AI market', () => {
    const w = consistencyWarnings('settings', { setting: 'monitors', aiMarkets: ['AE-en', 'SA-en'] }, ctx());
    expect(w.map((x) => [x.id, x.accept?.change])).toEqual([['ai.extra_market_same:AE', { kind: 'fields', set: { aiMarkets: ['SA-en'] } }]]);
  });
});

describe('I1 / I2 / I3 / I7 integrations of another website', () => {
  it('I1: a CMS connection that publishes to another domain; Accept rewrites the address pattern', () => {
    const w = consistencyWarnings('integration', { kind: 'cms', platform: 'webflow', baseUrl: '', publicUrlTemplate: 'https://blog.othersite.com/{slug}' }, ctx());
    expect(w[0]!.id).toBe('data.cms_domain:blog.othersite.com');
    expect(w[0]!.accept!.change).toEqual({ kind: 'fields', set: { publicUrlTemplate: 'https://techand.ai/{slug}' } });
    expect(consistencyWarnings('integration', { kind: 'cms', platform: 'wordpress', baseUrl: 'https://www.techand.ai', publicUrlTemplate: 'https://techand.ai/insights/{slug}' }, ctx())).toEqual([]);
  });

  it('I2: outreach sent from an address of another website (a free mailbox is the person\'s own choice)', () => {
    expect(ids(consistencyWarnings('integration', { kind: 'mailbox', address: 'sara@devaicon.com' }, ctx({ companyDomains: ['devaicon.com'] })))).toEqual(['data.mailbox_domain:devaicon.com:techand.ai']);
    expect(consistencyWarnings('integration', { kind: 'mailbox', address: 'sara@techand.ai' }, ctx())).toEqual([]);
    expect(consistencyWarnings('integration', { kind: 'mailbox', address: 'sara@gmail.com' }, ctx())).toEqual([]);
  });

  it('I3: a backlinks file whose "linked to" column is another website', () => {
    const csv = 'Source URL,Target URL,Anchor\nhttps://a.com/x,https://othersite.com/p1,erp\nhttps://b.com/y,https://othersite.com/p2,erp\nhttps://c.com/z,https://othersite.com/,home\n';
    const targets = importTargetHosts(csv);
    expect(targets).toEqual(['othersite.com', 'othersite.com', 'othersite.com']);
    expect(ids(consistencyWarnings('integration', { kind: 'link_import', targets }, ctx()))).toEqual(['data.import_other_site:othersite.com:techand.ai']);
    expect(consistencyWarnings('integration', { kind: 'link_import', targets: ['techand.ai', 'www.techand.ai', 'techand.ai'] }, ctx())).toEqual([]);
  });

  it('I7: an address that sends visitors to another domain; Accept adds that domain', () => {
    const w = consistencyWarnings('site_update', { domain: 'techand.com', country: 'United Arab Emirates' }, { site: null, redirectTo: 'techand.ai' });
    expect(w.map((x) => [x.id, x.accept?.change])).toEqual([['data.domain_redirects:techand.com:techand.ai', { kind: 'fields', set: { domain: 'techand.ai' } }]]);
    expect(consistencyWarnings('site_update', { domain: 'techand.ai', country: 'United Arab Emirates' }, { site: null, redirectTo: '' })).toEqual([]);
  });
});

describe('customer copy', () => {
  it('no em dash, no curly quotes, no ellipsis character, no internal names in any new warning', () => {
    const all: Warning[] = [
      ...consistencyWarnings('run', PROPOSAL, ctx({ start: { proposal: true, admin: true, credits: 111, planCredits: 12 } })),
      ...consistencyWarnings('settings', { setting: 'cadence', pagesPerWeek: 0 }, ctx()),
      ...consistencyWarnings('settings', { setting: 'automation', maxActiveLadders: 1, autopilotLevel: 3 }, ctx({ pipeline: pipeline({ defaultMode: 'manual', maxActive: 1 }) })),
      ...consistencyWarnings('integration', { kind: 'mailbox', address: 'sara@devaicon.com' }, ctx({ companyDomains: ['devaicon.com'] })),
    ];
    expect(all.length).toBeGreaterThan(4);
    for (const w of all) {
      const text = [w.title, w.body, w.short, w.confirm ?? '', w.accept?.label ?? ''].join(' ');
      expect(text).not.toMatch(/[—‘’“”…]/);
      expect(text).not.toMatch(/n8n|engine|seo_|ladder_id|Data Table|DataForSEO|lad_/i);
    }
  });
});
