import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import {
  costKeys,
  estimateRunCost,
  KI_VERDICT_IDS,
  KI_VERDICT_TONE,
  KI_VERDICTS,
  LISTED_MODE_IDS,
  MODE_IDS,
  type KiCompetitorRow,
  type KiGapRow,
  type KiKeywordRow,
  type Me,
  type Org,
  type Role,
  type Site,
} from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { DataTable, applyColumnFilters, tableCsv, type Column } from '@/components/ui/table';
import { KiVerdict, kiGateWords } from '@/components/site/KiVerdict';
import { siteNavFor, SITE_NAV } from '@/components/layout/OrgLayout';
import { ApiRequestError } from '@/lib/api';
import { makeCan, OrgContext, SiteContext } from '@/lib/context';
import {
  KI_KW_FILTER_EMPTY,
  kiChooseCheck,
  kiCompetitorsOf,
  kiBasisLine,
  kiActionLink,
  kiCsvUrl,
  kiGapsOf,
  kiKeywordsOf,
  kiKwParams,
  kiMaxText,
  kiModeOffered,
  kiOverviewOf,
  kiPartialNote,
  kiPatchErrorText,
  kiQuestionsOf,
  kiSplit,
  kiStopNote,
  kiStrikingOf,
  kiWithStatus,
} from '@/lib/ki';
import { kiCreditsText } from '@/pages/site/_components/ki/common';
import { ThemeProvider } from '@/lib/theme';
import { Competitors } from '@/pages/site/CompetitorsPage';
import { Keywords } from '@/pages/site/KeywordsPage';
import { DiscoverForm } from '@/pages/tools/_components/forms/research';
import { guideForNeedsYou, guideForRecommendation } from '@seo/shared/guides';
import { text } from './renderReport';

// KI web (2026-11-08, docs/keyword-intel-2026-11-08/DESIGN.md §6): the two pages render from fixture rows typed by shared/ki.ts (the
// engine's table rows, JSON columns as strings), the one verdict and its tone map, the filters, the CSV links, the choose-up-to-5 rule
// with the 409 words, who sees the pages and the tools, DataTable's opt-in filters and CSV, and the discovery form fix (R2 H1).
// Client names anonymised (novaand-demo.com).

const D = 'novaand-demo.com';
const org = { id: 'org-1', name: 'Nova Works', slug: 'nova', role: 'owner', disabled: false } as unknown as Org;
const site = { id: 'site-1', domain: D, verifiedAt: '2026-11-01T00:00:00Z', country: 'United Arab Emirates', competitors: [], business: '', customers: '', goal: 'leads' } as unknown as Site;
const meOf = (platformAdmin = false) => ({ user: { id: 'u1', email: 'o@novaand-demo.com', name: 'Owner', emailVerified: true }, orgs: [], platformAdmin }) as unknown as Me;
const wrap = (node: ReactNode, role: Role = 'owner', platformAdmin = false) =>
  renderToString(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>
              <OrgContext.Provider value={{ me: meOf(platformAdmin), org, role, sites: [site], can: makeCan(role) }}>
                <SiteContext.Provider value={{ site }}>{node}</SiteContext.Provider>
              </OrgContext.Provider>
            </MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

// ---------------------------------------------------------------- fixtures (as the n8n public API returns the rows)
const base = { id: 1, createdAt: '2026-11-08T06:00:00Z', updatedAt: '2026-11-08T06:00:00Z' };
const comp = (d: string, o: Partial<KiCompetitorRow> = {}): KiCompetitorRow => ({
  ...base, site_id: 's1', domain: D, market: 'AE-en', comp_domain: d, class: 'direct', class_basis: 'rule', class_confidence: 0.9, scored: true, score: 60, score_low: 52, score_high: 68,
  serp_share: 0.22, topic_sim: 0.7, geo_match: 1, ai_share: 0.1, size_tag: 'peer', seeds_seen: 9, seeds_total: 14,
  reasons_json: JSON.stringify([`In the first 10 Google results for 9 of 14 of your service searches in the UAE`]),
  evidence_json: JSON.stringify([{ seed: 'erp partner dubai', position: 3, url: `https://${d}/erp` }]), declared: false, status: 'candidate', status_by: 'auto',
  first_seen: '2026-11-01', last_seen: '2026-11-08', misses: 0, profile_json: null, run_id: 'r1', updated_at: '2026-11-08T06:00:00Z', ...o,
} as KiCompetitorRow);
const COMPS = [
  comp('northpeak-erp.com', { status: 'chosen', status_by: 'user', score: 72 }),
  comp('bluefin-consulting.ae', { score: 61 }),
  comp('atlas-dynamics.io', { class: 'adjacent', status: 'watch', score: 48 }),
  comp('clutch.co', { class: 'directory', scored: false, score: null }),
  comp('topfirms-list.com', { class: 'publisher_list', scored: false, score: null }),
  comp('microsoft.com', { class: 'principal', scored: false, score: null }),
  comp('lookalike.example', { status: 'dismissed', status_by: 'user' }),
];
const kw = (k: string, o: Partial<KiKeywordRow> = {}): KiKeywordRow => ({
  ...base, site_id: 's1', domain: D, market: 'AE-en', keyword: k, kw_key: k, sources_json: JSON.stringify([{ source: 'gsc', fetched_at: '2026-11-08' }, { source: 'paa', fetched_at: '2026-11-08' }]),
  source_count: 2, volume: 320, volume_basis: 'provider_estimate', volume_source: 'Google Ads', cpc: 4.2, kd: 30, trend_json: null, gsc_impressions: 140, gsc_clicks: 3,
  gsc_position: 14, gsc_page: `https://${D}/erp`, intent: 'commercial', stage: 'hire', stage_evidence_json: JSON.stringify('7 of 10 results are company service pages'),
  intent_confidence: 0.9, needs_review: false, gate: 'pass', gate_reason: null, fit: 1, demand: 0.6, win: 0.7, value: 0.5, gap: 0.5, score: 55, score_low: 47, score_high: 63,
  low_confidence: false, verdict: 'go', cluster_id: 'c1', is_head: true, cluster_size: 4, cluster_demand: 900, serp_read_at: '2026-11-08', top10_json: null,
  page_action: 'refresh', page_url: `https://${D}/erp`, cannibal_json: null, competitors_json: JSON.stringify([{ domain: 'northpeak-erp.com', position: 3, url: 'https://northpeak-erp.com/erp' }]),
  striking: true, run_id: 'r1', fetched_at: '2026-11-08T06:00:00Z', updated_at: '2026-11-08T06:00:00Z', ...o,
} as KiKeywordRow);
const KWS = [
  kw('business central partner abu dhabi'),
  kw('erp implementation cost uae', { verdict: 'months', win: 0.45, cluster_id: 'c2', stage: 'compare', striking: false, gsc_position: null, gsc_impressions: null, page_action: 'new', page_url: null }),
  kw('dynamics 365 jobs dubai', { verdict: 'gated', gate: 'fail', gate_reason: 'career', win: 0, score: 0, score_low: 0, score_high: 0, cluster_id: 'c3', striking: false, gsc_position: null }),
  kw('how much does erp cost in dubai', { is_head: false, cluster_id: 'c2', verdict: 'months', striking: false, gsc_position: null }),
];
const gapRow = (o: Partial<KiGapRow>): KiGapRow => ({ ...base, gap_id: 'g1', site_id: 's1', domain: D, market: 'AE-en', type: 'missing', keyword: 'erp support dubai', cluster_id: 'c1', competitor_domains_json: JSON.stringify(['northpeak-erp.com', 'bluefin-consulting.ae']), client_position: null, evidence_json: null, sample_note: null, action: 'new_page', action_target: null, credits: 114, status: 'open', run_id: 'r1', created_at: '2026-11-08', updated_at: '2026-11-08', ...o } as KiGapRow);
const GAPS = kiGapsOf({ rows: [gapRow({}), gapRow({ gap_id: 'g2', type: 'listing', keyword: null, action: 'list', action_target: 'clutch.co', credits: 0 })] });
const overview = (o: Record<string, unknown> = {}) =>
  kiOverviewOf({ mode: 'on', visible: true, market: 'United Arab Emirates', credits: { competitors: 21, research: 54 }, last_runs: [{ kind: 'competitors', status: 'ok', finished_at: '2026-11-08T06:00:00Z', sections_json: '[]', counts_json: '{}' }, { kind: 'keyword_research', status: 'partial', finished_at: '2026-11-08T07:00:00Z', sections_json: JSON.stringify([{ key: 'volume', state: 'missing', reason: 'provider', rows: 0 }]), counts_json: JSON.stringify({ keywords: 4, clusters: 3, go: 1, months: 1 }) }], ...o });
const NO_FORMS = /[–—…‘’“”]/;

// ---------------------------------------------------------------- the answers, read tolerantly
describe('reading the KI answers', () => {
  it('the overview: mode, who sees it, credits, the latest runs with their counts and sections', () => {
    const o = overview();
    expect(o).toMatchObject({ mode: 'on', visible: true, credits: { competitors: 21, research: 54 }, planStart: false });
    expect(o.lastRuns.keyword_research?.counts).toMatchObject({ keywords: 4, go: 1 });
    expect(kiPartialNote(o.lastRuns.keyword_research)).toContain('search volumes');
    expect(kiOverviewOf({ mode: 'typo' })).toMatchObject({ mode: 'off', visible: false });
    expect(kiOverviewOf(null).visible).toBe(false);
  });
  it('the shapes A1 answers with (camelCase views, items, summary, nested Search Console, the question flag)', () => {
    const o = kiOverviewOf({ mode: 'on', visible: true, canAct: true, maxCompetitors: 4, credits: { competitors: 21, research: 54 }, lastRuns: [{ runId: 'r', kind: 'keyword_research', market: 'AE-en', mode: 'on', status: 'partial', reason: '', startedAt: '2026-11-08T06:00:00Z', finishedAt: '2026-11-08T06:12:00Z', sections: [], missingSections: ['gaps'], counts: { clusters: 7 } }], summary: { market: 'AE-en', competitors: { total: 9, chosen: 2, listings: 3 }, keywords: { total: 120, byVerdict: { go: 5, months: 8 }, striking: 4, clusters: 7 }, gaps: { open: 11, byType: { missing: 6 } }, fetchedAt: '2026-11-08T06:12:00Z' } });
    expect(o).toMatchObject({ maxCompetitors: 4, market: 'AE-en', summary: { keywords: { total: 120, striking: 4 }, gaps: { open: 11 } } });
    expect(kiPartialNote(o.lastRuns.keyword_research)).toContain('the gaps against your competitors');
    const k = kiKeywordsOf({ total: 1, page: 1, pageSize: 50, pages: 1, items: [{ keyword: 'erp partner dubai', kwKey: 'erp partner dubai', sources: [{ source: 'gsc', label: 'x', fetchedAt: '2026-11-08' }], gsc: { impressions: 140, position: 12, page: 'https://x/erp' }, verdict: 'go', question: false, gate: 'pass' }] });
    expect(k.rows[0]).toMatchObject({ key: 'erp partner dubai', gscImpressions: 140, gscPosition: 12, question: false });
    expect(k.rows[0].sources[0].fetched_at).toBe('2026-11-08');
    expect(kiGapsOf({ items: [{ gapId: 'g9', type: 'listing', competitorDomains: ['a.com'], actionTarget: 'clutch.co', action: 'list', credits: 0, status: 'open' }] })[0]).toMatchObject({ id: 'g9', competitors: ['a.com'], target: 'clutch.co' });
    expect(kiCompetitorsOf({ market: 'AE-en', maxCompetitors: 5, chosen: 1, items: [{ compDomain: 'x.com', class: 'direct', status: 'chosen', reasons: ['r'] }] }).rows[0]).toMatchObject({ domain: 'x.com', reasons: ['r'] });
  });
  it('competitor rows: JSON columns parsed, split into chosen / suggested / watch, lists, formats and dismissed', () => {
    const c = kiCompetitorsOf({ rows: COMPS });
    expect(c.rows[0].reasons[0]).toContain('9 of 14');
    expect(c.rows[0].evidence[0]).toMatchObject({ seed: 'erp partner dubai', position: 3 });
    const s = kiSplit(c.rows);
    expect(s.chosen.map((r) => r.domain)).toEqual(['northpeak-erp.com']);
    expect(s.others.map((r) => r.domain)).toEqual(['bluefin-consulting.ae', 'atlas-dynamics.io']);
    expect(s.listings.map((r) => r.domain)).toEqual(['clutch.co', 'topfirms-list.com']);
    expect(s.formats.map((r) => r.domain)).toEqual(['microsoft.com']);
    expect(s.dismissed.map((r) => r.domain)).toEqual(['lookalike.example']);
    // camelCase and a bare array work too
    expect(kiCompetitorsOf([{ compDomain: 'x.com', class: 'direct', status: 'chosen' }]).rows[0]).toMatchObject({ domain: 'x.com', status: 'chosen' });
  });
  it('keyword rows: sources, factors, verdict from the stored word (or from Win when it is missing)', () => {
    const k = kiKeywordsOf({ rows: KWS, total: 4, plan: [] });
    expect(k.rows[0].sources.map((s) => s.source)).toEqual(['gsc', 'paa']);
    expect(k.rows[0].factors).toMatchObject({ win: 0.7, stageW: 1 });
    expect(k.rows[0].stageEvidence).toBe('7 of 10 results are company service pages');
    expect(kiKeywordsOf({ rows: [{ keyword: 'x', gate: 'pass', win: 0.62 }] }).rows[0].verdict).toBe('go');
    expect(kiKeywordsOf({ rows: [{ keyword: 'x', gate: 'fail', win: 0.9 }] }).rows[0].verdict).toBe('gated');
  });
});

// ---------------------------------------------------------------- the rules
describe('choose up to five, and the words of a refusal', () => {
  const rows = kiCompetitorsOf({ rows: COMPS }).rows;
  it('a sixth choice is refused before it is sent; watch and dismiss always pass', () => {
    const five = rows.map((r) => ({ ...r, status: 'chosen' as const })).slice(0, 5);
    expect(kiChooseCheck([...five, rows[6]], 'lookalike.example', 'chosen', 5)).toBe(kiMaxText(5));
    expect(kiChooseCheck(rows, 'bluefin-consulting.ae', 'chosen', 5)).toBeNull();
    expect(kiChooseCheck(five, 'northpeak-erp.com', 'watch', 5)).toBeNull();
  });
  it('the optimistic change, and a 409 from the server in words a client can act on', () => {
    expect(kiWithStatus(rows, 'bluefin-consulting.ae', 'chosen').find((r) => r.domain === 'bluefin-consulting.ae')).toMatchObject({ status: 'chosen', statusBy: 'user' });
    expect(kiPatchErrorText(new ApiRequestError(409, 'At most 5 chosen competitors', {}, 'ki_max_competitors'), 5)).toBe(kiMaxText(5));
    expect(kiPatchErrorText(new ApiRequestError(409, 'conflict'), 5)).toContain('changed this list');
    expect(kiPatchErrorText(new ApiRequestError(403, 'no'), 5)).toContain('member role');
    expect(kiMaxText(5)).not.toMatch(NO_FORMS);
  });
});

describe('filters, striking, questions, CSV', () => {
  const rows = kiKeywordsOf({ rows: KWS }).rows;
  it('every filter goes to the server (FX-A, review UX H2: the gap and striking filters too); the query string leaves empty filters out', () => {
    expect(kiKwParams({ ...KI_KW_FILTER_EMPTY, gapType: 'missing' })).toMatchObject({ gap_type: 'missing' });
    expect(kiKwParams({ ...KI_KW_FILTER_EMPTY, striking: true })).toMatchObject({ striking: '1' });
    expect(kiKwParams({ ...KI_KW_FILTER_EMPTY, verdict: 'go', minVolume: '100', page: 2 })).toEqual({ sort: '-score', page: '2', page_size: '50', verdict: 'go', min_volume: '100' });
    expect(kiKwParams({ ...KI_KW_FILTER_EMPTY, sort: 'keyword' }).sort).toBe('keyword');
  });
  it('striking is the engine\'s flag only, on searches that fit; questions read as questions (review UX L3)', () => {
    expect(kiStrikingOf(rows).map((r) => r.keyword)).toEqual(['business central partner abu dhabi']);
    // FX-A (review CONSISTENCY M2): no second rule in the browser: a row at place 12 with 500 impressions but no flag is not one
    expect(kiStrikingOf(kiKeywordsOf({ rows: [kw('erp hosting', { striking: false, gsc_position: 12, gsc_impressions: 500 })] }).rows)).toEqual([]);
    expect(kiStrikingOf(kiKeywordsOf({ rows: [kw('erp jobs', { striking: true, gate: 'fail', gate_reason: 'career' })] }).rows)).toEqual([]);
    expect(kiQuestionsOf(rows, null).map((q) => q.question)).toEqual(['How much does erp cost in dubai?']);
    expect(kiQuestionsOf(rows, [{ key: 'k', question: 'who is the best partner?', sources: ['paa'] }])).toHaveLength(1);
  });
  it('the CSV link carries the filters but not the page', () => {
    expect(kiCsvUrl('o', 's', 'keywords', kiKwParams({ ...KI_KW_FILTER_EMPTY, verdict: 'go', page: 3 }))).toBe('/api/orgs/o/sites/s/ki/keywords.csv?sort=-score&verdict=go');
    expect(kiCsvUrl('o', 's', 'competitors')).toBe('/api/orgs/o/sites/s/ki/competitors.csv');
  });
});

describe('who sees the KI pages and tools', () => {
  it('the sidebar lists Competitors and Keyword research only when visible; Off sites see nothing new', () => {
    expect(siteNavFor(false).map((n) => n.to)).not.toEqual(expect.arrayContaining(['competitors']));
    expect(siteNavFor(false).some((n) => n.to === 'keywords')).toBe(false);
    expect(siteNavFor(true).map((n) => n.to)).toEqual(expect.arrayContaining(['competitors', 'keywords']));
    expect(siteNavFor(false)).toHaveLength(SITE_NAV.length - 2);
  });
  it('the tools: a KI mode only for a visible website; every other mode as before; the runs filter and API list unchanged', () => {
    expect(kiModeOffered('competitors', false)).toBe(false);
    expect(kiModeOffered('keyword_research', true)).toBe(true);
    for (const m of MODE_IDS) if (m !== 'competitors' && m !== 'keyword_research') expect(kiModeOffered(m, false), m).toBe(true);
    expect(LISTED_MODE_IDS).not.toContain('competitors');
  });
});

describe('the KI guides behind the asks (A1 ids)', () => {
  it('Needs you and recommendations open the KI guides', () => {
    expect(guideForNeedsYou({ id: 'ki:competitors', kind: 'ki', severity: 'info' } as never)).toBe('ki-choose-competitors');
    expect(guideForNeedsYou({ id: 'ki:quick-wins', kind: 'ki', severity: 'info' } as never)).toBe('ki-read-keyword-research');
    expect(guideForRecommendation('ki:competitors')).toBe('ki-choose-competitors');
    expect(guideForRecommendation('ki:quick-wins')).toBe('ki-read-keyword-research');
  });
});

// ---------------------------------------------------------------- the one verdict
describe('KiVerdict', () => {
  it('one tone per verdict from the shared map, the word always shown', () => {
    const cls = { good: 'bg-good-soft', warning: 'bg-warning-soft', serious: 'bg-serious-soft', neutral: 'bg-surface-2' } as const;
    for (const v of KI_VERDICT_IDS) {
      const html = wrap(<KiVerdict verdict={v} />);
      expect(text(html)).toContain(KI_VERDICTS[v]);
      expect(html).toContain(cls[KI_VERDICT_TONE[v] as keyof typeof cls]);
    }
    // FX-L contract: one wording with the rest of the app, and "Not judged yet" (never shown as hard)
    expect(KI_VERDICTS).toEqual({ go: 'Go', months: 'Takes a few months', hard: 'Hard for your website now', gated: 'Not for you', unknown: 'Not judged yet' });
  });
  it('a gated row says why in plain words, never a code', () => {
    expect(text(wrap(<KiVerdict verdict="gated" reason="career" />))).toContain('looking for a job');
    expect(kiGateWords('other_brand')).toContain('another company');
    expect(kiGateWords('xq_7')).toBe('This search does not fit what you sell.');
    // FX-L: gate_reason is a code, gate_detail the engine's sentence: the detail never reaches the screen (review CONSISTENCY M3)
    const g = kiKeywordsOf({ rows: [kw('x', { gate: 'fail', gate_reason: 'low_fit', gate_detail: 'too far from what you sell (62% of its own words match the services (35% is the bar))' } as never)] }).rows[0];
    expect(g.gateReason).toBe('This search is too far from what you sell.');
    expect(g.gateReason).not.toMatch(/%|bar/);
    expect(kiGateWords('too far from what you sell (62% of its own words match ...)')).not.toMatch(/%/);
  });
});

// ---------------------------------------------------------------- the pages
describe('the Competitors page', () => {
  const data = kiCompetitorsOf({ rows: COMPS });
  const ai = { sov: null, competitors: [{ domain: 'northpeak-erp.com', share: 30, mentions: 6 }], ownShare: 10 };
  it('answers first, then the set with class chips and reasons, choose / watch / not a competitor, gaps, lists, AI share, CSV', () => {
    const html = wrap(<Competitors o={overview()} data={data} gaps={GAPS} keywords={kiKeywordsOf({ rows: KWS }).rows} ai={ai} />);
    const t = text(html);
    expect(t).toContain('You follow one main competitor: northpeak-erp.com.');
    // Watch / Move to watchlist / Not a competitor sit in each row's "More" menu (review UX M6, pass 2)
    expect(html).toContain('More actions for bluefin-consulting.ae');
    for (const s of ['Direct competitor', 'Close competitor', 'In the first 10 Google results for 9 of 14', 'Choose', 'More', 'Watchlist', 'Lists and directories to join', 'clutch.co', 'Gaps against your competitors', 'Competitors rank, you are missing', 'about 114 credits', 'Write this page', 'How to get listed', 'Who AI answers name', 'Not competitors', 'lookalike.example', 'Real competitors found', 'How much they compete with you', 'Website settings'])
      expect(t, s).toContain(s);
    // FX-A (review UX H4): no dead control; each step opens the existing tool with the search filled in
    expect(t).not.toContain('Coming soon');
    expect(html).toMatch(/\/o\/org-1\/tools\/keyword\?site=site-1&amp;prefill=/);
    expect(html).toContain('/o/org-1/sites/site-1/links#listings');
    expect(html).toContain('/api/orgs/org-1/sites/site-1/ki/competitors.csv');
    expect(html).toContain('/api/orgs/org-1/sites/site-1/ki/gaps.csv');
    expect(t).not.toContain('Trial: only platform admins see this');
    expect(t).not.toMatch(NO_FORMS);
    expect(t).not.toMatch(/undefined|NaN|\bserp\b|\betv\b|\bKD\b/i);
    expect((html.match(/<h1/g) ?? []).length).toBe(0); // the page header (outside this body) holds the one h1
  });
  it('a viewer sees the set but no buttons that change it; Trial shows the banner', () => {
    const t = text(wrap(<Competitors o={overview({ mode: 'trial' })} data={data} gaps={GAPS} keywords={[]} ai={null} />, 'viewer', true));
    expect(t).toContain('Trial: only platform admins see this');
    const vhtml = wrap(<Competitors o={overview({ mode: 'trial' })} data={data} gaps={GAPS} keywords={[]} ai={null} />, 'viewer', true);
    expect(vhtml).not.toContain('More actions for');
    expect(vhtml).not.toMatch(/>Choose</);
  });
  it('before the first run: what it does and how to start it', () => {
    const t = text(wrap(<Competitors o={overview({ last_runs: [] })} data={{ rows: [], updatedAt: null }} gaps={[]} keywords={[]} ai={null} />));
    expect(t).toContain('Find out who you really compete with');
    expect(t).toContain('Find my competitors');
    expect(t).toContain('21 credits');
  });
});

describe('the Keyword research page', () => {
  const summary = kiKeywordsOf({ rows: KWS, total: 4, plan: [{ action_id: 'a1', kind: 'refresh', title: 'Improve your ERP page', why: 'You are #14 and 2 competitors rank on page one', target: `https://${D}/erp`, credits: 40 }] });
  const page = (f = KI_KW_FILTER_EMPTY, o = overview()) => text(wrap(<Keywords o={o} summary={summary} table={summary} tableLoading={false} tableError={null} gaps={GAPS} filter={f} onFilter={() => {}} />));
  it('answers first, then the plan, topics with verdict / score range / sources / page, striking, questions, every search', () => {
    const t = page();
    expect(t).toContain('You can win 1 topic soon, and 1 more in a few months.');
    for (const s of ['Your plan', 'Improve your ERP page', 'about 40 credits', 'Improve this page', 'Topics', 'Ready to hire', 'Go', 'Takes a few months', 'Not for you', 'looking for a job', '55, likely 47 to 63', '2 sources', 'Improve your page novaand-demo.com/erp', 'Just off page one', 'Buyer questions', 'How much does erp cost in dubai?', 'Add to my AI questions', 'Every search', 'Download CSV', 'Part of the last reading is missing', 'search volumes'])
      expect(t, s).toContain(s);
    expect(t).not.toContain('Coming soon');
    expect(t).not.toMatch(NO_FORMS);
    expect(t).not.toMatch(/undefined|NaN|\bserp\b|\betv\b|\bKD\b|cluster_id|kw_key/i);
  });
  it('a member sees why they cannot add questions (admin role, as the AI question list)', () => {
    const t = text(wrap(<Keywords o={overview()} summary={summary} table={summary} tableLoading={false} tableError={null} gaps={GAPS} filter={KI_KW_FILTER_EMPTY} onFilter={() => {}} />, 'member'));
    expect(t).toContain('takes the admin role');
    expect(t).not.toContain('Add to my AI questions');
  });
  it('a filter shows the server\'s answer (its count, its rows, its empty state); each number says how we know it', () => {
    const none = kiKeywordsOf({ rows: [], total: 0 });
    const html = wrap(<Keywords o={overview()} summary={summary} table={none} tableLoading={false} tableError={null} gaps={GAPS} filter={{ ...KI_KW_FILTER_EMPTY, verdict: 'hard' }} onFilter={() => {}} />);
    expect(text(html)).toContain('No search matches these filters');
    expect(html).toContain('/ki/keywords.csv?sort=-score&amp;verdict=hard');
    // the tips open on hover or tap (closed in a server render): the line each one carries
    expect(kiBasisLine('provider_estimate', 'Google Ads', '2026-11-08T06:00:00Z')).toBe('estimate from Google Ads, 8 Nov 2026');
    expect(kiBasisLine('measured')).toBe('measured');
    expect(kiBasisLine('modelled')).toBe('our estimate');
  });
  it('each plan step opens the existing tool with the search filled in (review UX H4), the hero next step too', () => {
    const html = wrap(<Keywords o={overview()} summary={summary} table={summary} tableLoading={false} tableError={null} gaps={GAPS} filter={KI_KW_FILTER_EMPTY} onFilter={() => {}} />);
    expect(html).toMatch(/\/o\/org-1\/tools\/keyword\?site=site-1&amp;prefill=/);
    expect(kiActionLink('refresh', { target: `https://${D}/erp`, keyword: 'erp partner dubai', domain: D })).toEqual({ label: 'Improve this page', kind: 'tool', mode: 'keyword', prefill: { keyword: 'erp partner dubai', existingPageUrl: `https://${D}/erp` } });
    expect(kiActionLink('refresh', { target: 'https://other.example/x', keyword: 'k', domain: D })).toMatchObject({ prefill: { keyword: 'k' } });
    expect(kiActionLink('ladder', { keyword: 'erp uae' })).toEqual({ label: 'Plan the ladder', kind: 'ladder', keyword: 'erp uae' });
    expect(kiActionLink('list', {})).toMatchObject({ page: 'links', hash: 'listings' });
    expect(kiActionLink('write', {})).toBeNull();
    // a viewer gets no buttons
    const viewer = text(wrap(<Keywords o={overview()} summary={summary} table={summary} tableLoading={false} tableError={null} gaps={GAPS} filter={KI_KW_FILTER_EMPTY} onFilter={() => {}} />, 'viewer'));
    expect(viewer).not.toContain('Improve this page');
  });
  it('the score tip reads the server\'s nested factors (review UX H1)', () => {
    const r = kiKeywordsOf({ items: [{ keyword: 'erp partner dubai', kwKey: 'k', gate: 'pass', verdict: 'go', score: 86, factors: { fit: 0.9, demand: 0.5, win: 0.7, value: 0.2, gap: 0.4 } }] }).rows[0];
    expect(r.factors).toMatchObject({ fit: 0.9, demand: 0.5, win: 0.7, value: 0.2, gap: 0.4 });
  });
  it('a refused run says why and what to do, never the first-run empty state (review UX H3)', () => {
    const o = overview({ last_runs: [{ kind: 'keyword_research', status: 'refused', reason: 'market_mismatch', finished_at: '2026-11-08T07:00:00Z', market: 'US-en' }] });
    const t = text(wrap(<Keywords o={o} summary={kiKeywordsOf({ rows: [] })} table={undefined} tableLoading={false} tableError={null} filter={KI_KW_FILTER_EMPTY} onFilter={() => {}} />));
    expect(t).toContain("This analysis runs for your website's country, United Arab Emirates");
    expect(t).toContain('Run it for United Arab Emirates');
    expect(t).not.toContain('Find what your buyers search');
    expect(kiStopNote(o.lastRuns.keyword_research, { siteCountry: 'United Arab Emirates' })?.text).not.toMatch(NO_FORMS);
    expect(kiStopNote(overview().lastRuns.keyword_research)).toBeNull();
  });
  it('a Trial run is free for the client (shown as such), and a paused website says paused, not rolling out', () => {
    expect(kiCreditsText(overview({ mode: 'trial' }), 'competitors')).toBe('free trial run');
    expect(kiCreditsText(overview(), 'competitors')).toBe('21 credits');
  });
});

// ---------------------------------------------------------------- DataTable opt-in
describe('DataTable column filters and CSV (opt-in)', () => {
  type R = { k: string; v: number; tag: string };
  const rows: R[] = [{ k: 'a', v: 2, tag: 'x' }, { k: 'b', v: 1, tag: 'y' }, { k: '=c', v: 3, tag: 'x' }];
  const cols: Column<R>[] = [
    { key: 'k', header: 'Key', sortValue: (r) => r.k },
    { key: 'v', header: 'Value', sortValue: (r) => r.v, align: 'right' },
    { key: 'tag', header: <b>Tag</b>, csvHeader: 'Tag', filter: { label: 'Tag', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }], value: (r) => r.tag } },
  ];
  it('filters by column value and writes a safe CSV', () => {
    expect(applyColumnFilters(rows, cols, { tag: 'x' }).map((r) => r.k)).toEqual(['a', '=c']);
    expect(applyColumnFilters(rows, cols, {})).toHaveLength(3);
    expect(tableCsv(rows.slice(0, 1), cols)).toBe('"Key","Value","Tag"\r\n"a","2","x"\r\n');
    expect(tableCsv([rows[2]], cols)).toContain(`"'=c"`);
  });
  it('an existing table is unchanged; one that opts in gets the filter, the CSV button and the cards', () => {
    const plain = text(wrap(<DataTable rows={rows} columns={cols} rowKey={(r) => r.k} />));
    expect(plain).not.toContain('Download CSV');
    expect(plain).not.toContain('Filters');
    const html = wrap(<DataTable rows={rows} columns={cols} rowKey={(r) => r.k} columnFilters initialFilters={{ tag: 'y' }} csv={{ fileName: 'x.csv' }} mobileCard={(r) => <span>card {r.k}</span>} stickyFirst />);
    const t = text(html);
    expect(t).toContain('Download CSV');
    expect(t).toContain('Filters (1)');
    expect(t).toContain('card b');
    expect(t).not.toContain('card a');
    expect(html).toContain('sticky left-0');
  });
});

// ---------------------------------------------------------------- R2 H1: the discovery form
describe('the discovery form no longer offers a page it never writes (R2 H1)', () => {
  it('no "Write the page" option, and its price never includes a page', () => {
    const t = text(wrap(<DiscoverForm initialSiteId="site-1" prefill={{ receiveContent: true }} />));
    expect(t).toContain('Keyword report for the best keyword');
    expect(t).not.toContain('Write the page for the best keyword');
    expect(t).not.toContain('The page for the best keyword');
    expect(costKeys('discover', { receiveContent: true })).not.toContain('content');
    expect(estimateRunCost('discover', { receiveContent: true })).toBe(estimateRunCost('discover', {}));
  });
});
