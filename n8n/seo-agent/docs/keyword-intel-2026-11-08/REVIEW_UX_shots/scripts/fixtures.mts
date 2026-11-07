// UX review fixtures: engine table rows (shared/src/ki.ts) mapped through the server's own view functions (shared/src/ki-api.ts), so
// every /api answer has exactly the shape the A1 server sends. Two realistic sites + state sites.
import {
  kiCompetitorView, kiKeywordView, kiGapView, kiRunView, kiSummaryOf, kiKeywordQueryOf, kiKeywordMatches, kiKeywordComparator, kiPage,
  kiFacetsOf, kiCompetitorOrder, kiBrandTokens,
} from '/app/shared/src/ki-api.ts';

const now = '2026-11-08T06:12:00.000Z';
const earlier = '2026-11-02T05:40:00.000Z';
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pickR = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

export type Persona = 'owner' | 'admin' | 'member' | 'viewer' | 'padmin';

export interface SiteFx {
  id: string; domain: string; country: string; business: string; market: string; mode: 'on' | 'trial' | 'off'; killed?: boolean;
  comps: any[]; kws: any[]; gaps: any[]; runs: any[]; plan: any[]; ai?: any;
}

const stageW: Record<string, number> = { hire: 1, compare: 0.9, solution: 0.65, problem: 0.5, info: 0.3 };

function kwRow(site: SiteFx, k: { keyword: string; stage: string; volume: number | null; cluster: string; head: boolean; size?: number; gate?: string; gateReason?: string; gsc?: [number, number] | null; comps?: { domain: string; position: number }[]; pageAction?: string; pageUrl?: string; sources?: string[]; win?: number; review?: boolean; cannibal?: boolean; evidence?: string }) {
  const fit = k.gate === 'fail' ? 0.1 : 0.7 + rnd() * 0.3;
  const demand = k.volume == null ? 0.2 : Math.min(1, Math.log10(Math.max(10, k.volume)) / 4);
  const win = k.win ?? rnd();
  const value = 0.3 + rnd() * 0.6;
  const gap = rnd();
  const score = k.gate === 'fail' ? 0 : Math.round(100 * (0.25 * fit + 0.2 * demand + 0.3 * win + 0.15 * value + 0.1 * gap) * (0.6 + 0.4 * stageW[k.stage]));
  const spread = 4 + Math.round(rnd() * 14);
  const verdict = k.gate === 'fail' ? 'gated' : win >= 0.6 ? 'go' : win >= 0.35 ? 'months' : 'hard';
  const srcs = k.sources ?? [pickR(['gsc', 'paa', 'autocomplete', 'labs_ideas', 'related']), pickR(['competitor', 'labs_suggestions', 'seed', 'gap'])];
  return {
    id: 0, createdAt: now, updatedAt: now,
    site_id: site.id, domain: site.domain, market: site.market, keyword: k.keyword, kw_key: k.keyword,
    sources_json: JSON.stringify([...new Set(srcs)].map((s) => ({ source: s, fetched_at: now }))), source_count: srcs.length,
    volume: k.volume, volume_basis: k.volume == null ? null : 'provider_estimate', volume_source: k.volume == null ? null : 'Google Ads', cpc: 3.4, kd: Math.round(rnd() * 80),
    trend_json: null, gsc_impressions: k.gsc ? k.gsc[1] : null, gsc_clicks: k.gsc ? Math.round(k.gsc[1] * 0.02) : null, gsc_position: k.gsc ? k.gsc[0] : null,
    gsc_page: k.gsc ? `https://${site.domain}/services/${k.cluster}` : null, intent: 'commercial', stage: k.stage,
    stage_evidence_json: k.evidence ? JSON.stringify(k.evidence) : null, intent_confidence: 0.8, needs_review: !!k.review,
    gate: k.gate === 'fail' ? 'fail' : 'pass', gate_reason: k.gateReason ?? null, fit, demand, win, value, gap, score, score_low: Math.max(0, score - spread), score_high: Math.min(100, score + spread),
    low_confidence: spread > 15, verdict, cluster_id: k.cluster, is_head: k.head, cluster_size: k.size ?? null, cluster_demand: k.head && k.volume ? k.volume * (k.size ?? 1) : null,
    serp_read_at: now, top10_json: null, page_action: k.pageAction ?? (k.gsc ? 'refresh' : 'new'), page_url: k.pageUrl ?? (k.gsc ? `https://${site.domain}/services/${k.cluster}` : null),
    cannibal_json: k.cannibal ? JSON.stringify([`https://${site.domain}/a`, `https://${site.domain}/b`]) : null,
    competitors_json: JSON.stringify(k.comps ?? []), striking: !!(k.gsc && k.gsc[0] >= 8 && k.gsc[0] <= 20 && k.gsc[1] >= 30), run_id: 'run-r', fetched_at: now, updated_at: now,
  };
}

function compRow(site: SiteFx, d: string, o: any = {}) {
  const seen = o.seen ?? 9;
  return {
    id: 0, createdAt: now, updatedAt: now,
    site_id: site.id, domain: site.domain, market: site.market, comp_domain: d, class: o.cls ?? 'direct', class_basis: o.basis ?? 'rule', class_confidence: o.conf ?? 0.9,
    scored: ['direct', 'adjacent'].includes(o.cls ?? 'direct'), score: o.score ?? null, score_low: o.score != null ? o.score - 8 : null, score_high: o.score != null ? o.score + 8 : null,
    serp_share: o.share ?? (o.score != null ? o.score / 400 : null), topic_sim: 0.7, geo_match: 1, ai_share: 0.1, size_tag: o.size ?? 'peer', seeds_seen: seen, seeds_total: 14,
    reasons_json: JSON.stringify(o.reasons ?? [`In the first 10 Google results for ${seen} of 14 of your service searches in ${site.country}.`, 'Sells the same services to the same kind of buyer.']),
    evidence_json: '[]', declared: !!o.declared, status: o.status ?? 'candidate', status_by: o.status && o.status !== 'candidate' ? 'user' : 'auto', first_seen: earlier, last_seen: now, misses: 0,
    profile_json: o.noProfile ? null : JSON.stringify({ etv: o.etv ?? 4200, keywords: 860, refdomains: 140, pace_per_month: 6, brand_share: 0.31,
      top_pages: [{ url: `https://${d}/services/erp-implementation-partner-dubai-abu-dhabi-sharjah-and-the-northern-emirates`, etv: 900, keywords: 80, page_type: 'service_page' }, { url: `https://${d}/business-central`, etv: 600, keywords: 40, page_type: 'service' }, { url: `https://${d}/blog/erp-cost-guide`, etv: 300, keywords: 30, page_type: 'blog_post' }],
      basis: { etv: 'provider_estimate', keywords: 'provider_estimate', refdomains: 'provider_estimate', pace_per_month: 'modelled' }, fetched_at: now }),
    run_id: 'run-c', updated_at: now,
  };
}

function gapRow(site: SiteFx, i: number, o: any) {
  return { id: 0, createdAt: now, updatedAt: now, gap_id: `g${i}`, site_id: site.id, domain: site.domain, market: site.market, type: o.type, keyword: o.keyword ?? null, cluster_id: null,
    competitor_domains_json: JSON.stringify(o.comps ?? []), client_position: o.pos ?? null, evidence_json: null, sample_note: o.note ?? null, action: o.action, action_target: o.target ?? null,
    credits: o.credits ?? null, status: o.status ?? 'open', run_id: 'run-c', created_at: now, updated_at: `2026-11-08T06:${String(10 + (i % 40)).padStart(2, '0')}:00.000Z` };
}

function runRow(site: SiteFx, kind: string, o: any = {}) {
  return { id: 0, createdAt: now, updatedAt: now, site_id: site.id, domain: site.domain, run_id: `${site.id}-${kind}-${o.n ?? 1}`, request_id: 'rq', kind, market: site.market, location_code: 2784, language_code: 'en',
    mode: site.mode === 'trial' ? 'trial' : 'on', rule_version: 'ki-1', started_at: o.started ?? now, finished_at: o.finished === undefined ? now : o.finished, status: o.status ?? 'ok', reason: o.reason ?? '',
    sections_json: JSON.stringify(o.sections ?? []), counts_json: JSON.stringify(o.counts ?? {}), cost_dfs_usd: 0.4, cost_claude_usd: 0.1, config_json: null };
}

// ------------------------------------------------------------------ site A: ERP / Dynamics 365 partner, UAE, 5,000 searches
const A: SiteFx = { id: 's-erp', domain: 'gulfdynamics-partners.ae', country: 'United Arab Emirates', business: 'Microsoft Dynamics 365 and ERP implementation partner', market: 'AE-en', mode: 'on', comps: [], kws: [], gaps: [], runs: [], plan: [] };
{
  const services = ['dynamics 365 business central', 'dynamics 365 finance and operations', 'erp implementation', 'erp software', 'cloud erp', 'sap business one', 'erp for manufacturing', 'erp support', 'vat compliant accounting software', 'e-invoicing software', 'inventory management software', 'dynamics 365 crm', 'power bi consulting', 'erp for trading companies', 'erp for construction companies'];
  const mods: [string, string][] = [['partner', 'hire'], ['consultants', 'hire'], ['company', 'hire'], ['services', 'hire'], ['implementation cost', 'compare'], ['pricing', 'compare'], ['best', 'compare'], ['support', 'hire'], ['migration', 'solution'], ['training', 'solution'], ['licensing', 'compare'], ['for small business', 'solution'], ['features', 'info'], ['demo', 'compare'], ['reviews', 'compare'], ['upgrade', 'solution'], ['integration', 'solution'], ['customization', 'solution'], ['near me', 'hire'], ['free trial', 'compare'], ['benefits', 'info'], ['vs quickbooks', 'compare'], ['tutorial', 'info'], ['certified', 'hire'], ['agency', 'hire']];
  const places = ['dubai', 'abu dhabi', 'uae', 'sharjah', 'ajman', 'ras al khaimah', 'al ain', 'fujairah', 'jebel ali', 'dubai silicon oasis', ''];
  const seen = new Set<string>();
  const comps = ['northpeak-erp.ae', 'bluefin-consulting.ae', 'atlas-dynamics-partners-international-consulting.com', 'gulfledger.ae'];
  let ci = 0;
  for (const s of services)
    for (const p of places) {
      const cluster = `${s}-${p || 'all'}`.replace(/\s+/g, '-');
      let first = true;
      const members: any[] = [];
      for (const [m, st] of mods) {
        const kw = m === 'best' ? `best ${s} ${p}`.trim() : m.startsWith('for ') || m.startsWith('vs ') ? `${s} ${m} ${p}`.trim() : `${s} ${m} ${p}`.trim();
        if (seen.has(kw)) continue;
        seen.add(kw);
        const vol = rnd() < 0.08 ? null : Math.round(10 + rnd() * rnd() * 2400);
        const gscPos = rnd() < 0.12 ? 3 + Math.round(rnd() * 30) : null;
        members.push({ keyword: kw, stage: st, volume: vol, cluster, head: false, gsc: gscPos ? [gscPos, 30 + Math.round(rnd() * 900)] : null, comps: rnd() < 0.5 ? [{ domain: comps[ci % 4], position: 1 + Math.round(rnd() * 9) }] : [], win: rnd() });
        ci++;
      }
      members.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      members[0].head = true; members[0].size = members.length;
      members[0].evidence = rnd() < 0.3 ? 'Page one shows service pages and "contact us" forms from implementation partners.' : undefined;
      for (const m of members) A.kws.push(kwRow(A, m));
      if (A.kws.length > 4600) break;
    }
  // questions, gated, a very long search, brand searches
  const qs = ['how much does dynamics 365 business central cost in dubai', 'what is the difference between dynamics 365 business central and finance and operations', 'is sap business one good for small trading companies in the uae', 'how long does an erp implementation take for a 50 person company in abu dhabi', 'which erp is best for construction companies in uae', 'do i need e-invoicing software for the uae phase 1 mandate in 2026'];
  for (const q of qs) A.kws.push(kwRow(A, { keyword: q, stage: 'compare', volume: 90 + Math.round(rnd() * 300), cluster: 'q-' + q.slice(0, 12), head: true, size: 1, sources: ['paa', 'autocomplete'], win: 0.65 }));
  const gated: [string, string][] = [['dynamics 365 jobs dubai', 'career'], ['erp consultant salary uae', 'career'], ['northpeak erp login', 'other_brand'], ['ministry of finance e-invoicing portal login', 'government'], ['erp software india', 'market_mismatch'], ['sap business one free download crack', 'off_service']];
  for (const [g, r] of gated) A.kws.push(kwRow(A, { keyword: g, stage: 'info', volume: 880, cluster: 'gated-' + g, head: true, size: 1, gate: 'fail', gateReason: r }));
  A.kws.push(kwRow(A, { keyword: 'microsoft dynamics 365 business central implementation partner for wholesale distribution and logistics companies in dubai abu dhabi and sharjah with arabic support', stage: 'hire', volume: 20, cluster: 'long-1', head: true, size: 1, win: 0.7, review: true, cannibal: true, gsc: [12, 64] }));
  A.kws.push(kwRow(A, { keyword: 'gulfdynamics partners reviews', stage: 'compare', volume: 30, cluster: 'brand-1', head: true, size: 1, win: 0.9, gsc: [1, 210] }));
  let i = 0;
  while (A.kws.length < 5000) { const kw = `erp implementation checklist ${++i} for ${pickR(['retail', 'trading', 'logistics', 'manufacturing', 'healthcare'])} uae`; A.kws.push(kwRow(A, { keyword: kw, stage: 'info', volume: null, cluster: 'misc-' + (i % 40), head: false })); }

  A.comps = [
    compRow(A, 'northpeak-erp.ae', { status: 'chosen', score: 78, size: 'peer' }),
    compRow(A, 'bluefin-consulting.ae', { status: 'chosen', score: 66, size: 'leader', etv: 18400 }),
    compRow(A, 'atlas-dynamics-partners-international-consulting.com', { cls: 'adjacent', score: 54, size: 'out_of_reach', seen: 6 }),
    compRow(A, 'gulfledger.ae', { score: 47, size: 'smaller', seen: 5, declared: true }),
    compRow(A, 'sandstone-tech.ae', { score: 41, size: 'peer', seen: 4, basis: 'llm', conf: 0.5, noProfile: true }),
    compRow(A, 'orbit-erp.com', { status: 'watch', score: 39, seen: 4 }),
    compRow(A, 'clutch.co', { cls: 'directory', seen: 11 }), compRow(A, 'goodfirms.co', { cls: 'directory', seen: 7 }),
    compRow(A, 'top-erp-consultants-uae-2026.example-rankings.com', { cls: 'publisher_list', seen: 5 }),
    compRow(A, 'microsoft.com', { cls: 'principal', seen: 12 }), compRow(A, 'linkedin.com', { cls: 'platform', seen: 8 }), compRow(A, 'gulfnews.com', { cls: 'media', seen: 3 }),
    compRow(A, 'erp-lookalike.example', { status: 'dismissed', score: 30 }),
  ];
  const gt: any[] = [
    { type: 'missing', keyword: 'dynamics 365 business central partner abu dhabi', comps: ['northpeak-erp.ae', 'bluefin-consulting.ae'], action: 'new_page', credits: 114 },
    { type: 'weak', keyword: 'erp software uae', comps: ['bluefin-consulting.ae'], pos: 18, action: 'refresh', target: `https://${A.domain}/erp-software`, credits: 40, note: 'sample of 300 of 1,240 searches' },
    { type: 'listing', target: 'clutch.co', comps: ['northpeak-erp.ae', 'bluefin-consulting.ae'], action: 'list', credits: 0 },
    { type: 'page_type', keyword: 'erp implementation cost uae', comps: ['northpeak-erp.ae', 'gulfledger.ae'], action: 'new_page', credits: 114 },
    { type: 'ai_answer', keyword: 'best dynamics 365 partner in dubai', comps: ['bluefin-consulting.ae'], action: 'pitch', credits: 6 },
    { type: 'backlink', target: 'dubaichamber.com', comps: ['northpeak-erp.ae'], action: 'link', credits: 2 },
    { type: 'untapped', keyword: 'microsoft dynamics 365 business central implementation partner for wholesale distribution and logistics companies in dubai abu dhabi and sharjah with arabic support', comps: ['northpeak-erp.ae'], action: 'new_page', credits: 114 },
    { type: 'strong', keyword: 'gulfdynamics partners reviews', comps: [], pos: 1, action: 'defend', credits: 0 },
  ];
  for (let j = 0; j < 30; j++) A.gaps.push(gapRow(A, j, j < gt.length ? gt[j] : { type: pickR(['missing', 'weak', 'striking', 'topic']), keyword: A.kws[j * 13].keyword, comps: ['northpeak-erp.ae'], action: pickR(['new_page', 'refresh']), credits: pickR([40, 114]) }));
  A.runs = [runRow(A, 'competitors', { counts: { competitors: 6, chosen: 2, listings: 3 } }), runRow(A, 'keyword_research', { counts: { keywords: 5000, clusters: 160, striking: 41 } })];
  A.plan = [
    { action_id: 'a1', kind: 'refresh', title: 'Improve your Business Central page', why: 'You are #14 for "dynamics 365 business central partner abu dhabi" and two of your competitors are on page one.', target: `https://${A.domain}/business-central`, credits: 40 },
    { action_id: 'a2', kind: 'new_page', title: 'Write a page for "erp implementation cost uae"', why: 'Buyers comparing providers search it about 320 times a month; you have no page.', target: '', credits: 114 },
    { action_id: 'a3', kind: 'list', title: 'Get listed on clutch.co', why: 'It shows three of your competitors for your services, and not you.', target: 'clutch.co', credits: 0 },
    { action_id: 'a4', kind: 'ladder', title: 'Plan a keyword ladder for "erp software uae"', why: 'The topic is held by bigger sites; three supporting pages first make it winnable in a few months.', target: '', credits: 180 },
    { action_id: 'a5', kind: 'pitch', title: 'Ask to be added to "Top ERP consultants in the UAE 2026"', why: 'AI answers quote this list for your main service.', target: 'top-erp-consultants-uae-2026.example-rankings.com', credits: 0 },
  ];
  A.ai = { latest: { checkedAt: now, competitors: [{ domain: 'bluefin-consulting.ae', share: 34, mentions: 41 }, { domain: 'northpeak-erp.ae', share: 21, mentions: 25 }, { domain: 'microsoft.com', share: 18, mentions: 22 }], extras: {} }, runs: [{ checkedAt: now, shareOfVoice: 4 }] };
}

// ------------------------------------------------------------------ site B: software agency, Open edX niche, US market; partial research run
const B: SiteFx = { id: 's-edx', domain: 'openlearn-studio.io', country: 'United States', business: 'Software agency: Open edX hosting, theming and custom LMS development', market: 'US-en', mode: 'on', comps: [], kws: [], gaps: [], runs: [], plan: [] };
{
  const topics: [string, string][] = [['open edx hosting', 'hire'], ['open edx development company', 'hire'], ['open edx theme customization', 'solution'], ['open edx vs moodle', 'compare'], ['custom lms development', 'hire'], ['tutor open edx deployment', 'solution'], ['open edx plugin development', 'solution'], ['open edx consulting', 'hire'], ['edx course authoring services', 'hire'], ['open edx migration from moodle', 'solution']];
  const tails = ['', ' pricing', ' services', ' agency', ' for universities', ' for corporate training', ' aws', ' kubernetes', ' support', ' experts', ' cost', ' examples', ' tutorial', ' best practices'];
  for (const [t, st] of topics) {
    const members = tails.map((x) => ({ keyword: (t + x).trim(), stage: x === ' tutorial' || x === ' examples' ? 'info' : st, volume: rnd() < 0.15 ? null : Math.round(10 + rnd() * 700), cluster: t.replace(/\s+/g, '-'), head: false, gsc: rnd() < 0.2 ? [6 + Math.round(rnd() * 20), 40 + Math.round(rnd() * 400)] as [number, number] : null, comps: [{ domain: pickR(['lmsforge.dev', 'edtech-cloudworks.com', 'campusbyte.io']), position: 1 + Math.round(rnd() * 8) }], win: rnd() }));
    members.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    (members[0] as any).head = true; (members[0] as any).size = members.length;
    for (const m of members) B.kws.push(kwRow(B, m));
  }
  B.kws.push(kwRow(B, { keyword: 'what is open edx and how is it different from edx.org', stage: 'info', volume: 320, cluster: 'q1', head: true, size: 1, sources: ['paa'], win: 0.7 }));
  B.kws.push(kwRow(B, { keyword: 'how much does it cost to host open edx', stage: 'compare', volume: 90, cluster: 'q2', head: true, size: 1, sources: ['paa', 'autocomplete'], win: 0.66 }));
  B.kws.push(kwRow(B, { keyword: 'edx jobs remote', stage: 'info', volume: 1300, cluster: 'g1', head: true, size: 1, gate: 'fail', gateReason: 'jobs' }));
  B.comps = [
    compRow(B, 'lmsforge.dev', { score: 71, size: 'peer', reasons: ['In the first 10 Google results for 11 of 14 of your service searches in the United States.'] }),
    compRow(B, 'edtech-cloudworks.com', { score: 58, size: 'leader', etv: 9300 }),
    compRow(B, 'campusbyte.io', { cls: 'adjacent', score: 44, size: 'smaller' }),
    compRow(B, 'clutch.co', { cls: 'directory', seen: 6 }),
    compRow(B, 'openedx.org', { cls: 'principal', seen: 13 }), compRow(B, 'edx.org', { cls: 'platform', seen: 10 }), compRow(B, 'elearningindustry.com', { cls: 'publisher_list', seen: 8 }),
  ];
  B.gaps = [];
  B.runs = [runRow(B, 'competitors', {}), runRow(B, 'keyword_research', { status: 'partial', sections: [{ key: 'serp', state: 'ok', reason: '', rows: 140 }, { key: 'enrich', state: 'missing', reason: 'provider_timeout', rows: 0 }, { key: 'gsc', state: 'partial', reason: 'quota', rows: 20 }] })];
  B.plan = [];
}

// ------------------------------------------------------------------ state sites
const mk = (id: string, domain: string, o: Partial<SiteFx> = {}): SiteFx => ({ id, domain, country: 'United Arab Emirates', business: 'IT services', market: 'AE-en', mode: 'on', comps: [], kws: [], gaps: [], runs: [], plan: [], ...o });
const EMPTY = mk('s-new', 'brandnew-consulting.ae');
const ONE = mk('s-one', 'tinyfirm-accounting.ae');
ONE.kws = [kwRow(ONE, { keyword: 'vat registration consultant sharjah', stage: 'hire', volume: 140, cluster: 'vat', head: true, size: 1, win: 0.72, gsc: [11, 95] })];
ONE.comps = [compRow(ONE, 'sharjah-vat-experts.ae', { score: 62 })];
ONE.runs = [runRow(ONE, 'competitors'), runRow(ONE, 'keyword_research')];
ONE.plan = [{ action_id: 'o1', kind: 'refresh', title: 'Improve your VAT registration page', why: 'You are #11 and the page is thin.', target: `https://${ONE.domain}/vat`, credits: 40 }];
const REFUSED = mk('s-refused', 'refused-market.ae'); REFUSED.runs = [runRow(REFUSED, 'keyword_research', { status: 'refused', reason: 'market_mismatch', finished: now }), runRow(REFUSED, 'competitors', { status: 'refused', reason: 'market_mismatch' })];
const CREDITS = mk('s-credits', 'nocredits-co.ae'); CREDITS.runs = [runRow(CREDITS, 'keyword_research', { status: 'failed', reason: 'no_credits' }), runRow(CREDITS, 'competitors', { status: 'failed', reason: 'insufficient credits' })];
const TRIAL = { ...A, id: 's-trial', domain: 'trial-client-erp.ae', mode: 'trial' as const };
TRIAL.kws = A.kws.slice(0, 400).map((r) => ({ ...r, domain: TRIAL.domain })); TRIAL.comps = A.comps.map((r) => ({ ...r, domain: TRIAL.domain })); TRIAL.gaps = A.gaps.map((r) => ({ ...r, domain: TRIAL.domain })); TRIAL.runs = A.runs.map((r) => ({ ...r, domain: TRIAL.domain, mode: 'trial' }));
const OFF = mk('s-off', 'off-client.ae', { mode: 'off' });
const KILLED = { ...TRIAL, id: 's-killed', domain: 'paused-client.ae', mode: 'on' as const, killed: true };

export const SITES: SiteFx[] = [A, B, EMPTY, ONE, REFUSED, CREDITS, TRIAL, OFF, KILLED];

// ------------------------------------------------------------------ the app shell
const ORG = 'org-1';
export function me(p: Persona) {
  const role = p === 'padmin' ? 'owner' : p;
  return { user: { id: 'u-' + p, email: `${p}@gulfdynamics-partners.ae`, name: { owner: 'Fatima Al Mansoori', admin: 'Omar Haddad', member: 'Priya Nair', viewer: 'Daniel Brooks', padmin: 'Alaventra Support' }[p], avatarUrl: null, emailVerified: true, hasPassword: true, googleLinked: false, createdAt: now, mfaEnabled: false }, orgs: [{ id: ORG, name: 'Gulf Dynamics Partners', slug: 'gulf', role, onboardingStep: 'done', onboardedAt: now }], platformAdmin: p === 'padmin' };
}
export const org = (p: Persona) => ({ id: ORG, name: 'Gulf Dynamics Partners', slug: 'gulf', industry: 'IT services', size: '11-50', website: A.domain, monthlyBudgetUsd: 50, disabled: false, onboardingStep: 'done', onboardedAt: now, createdAt: now, role: p === 'padmin' ? 'owner' : p, kind: 'standard', agency: null, brand: null, clientApproval: false });
const siteOut = (s: SiteFx) => ({ id: s.id, orgId: ORG, domain: s.domain, n8nSiteId: 'site_' + s.domain, country: s.country, business: s.business, customers: '', goal: 'leads', tone: '', cta: '', businessFacts: '', competitors: [], brandNames: [], keywords: [], ga4PropertyId: '', gscProperty: 'sc-domain:' + s.domain, blogsPerWeek: 1, verifiedAt: now, verificationMethod: 'dns', trackingStatus: 'active', trackingStartedAt: now, createdAt: now, timezone: 'Asia/Dubai', services: [], cycleWeekday: 1, autopilotLevel: 1 });

const isPadmin = (p: Persona) => p === 'padmin';
function visible(s: SiteFx, p: Persona) { if (s.killed) return false; return s.mode === 'on' || (s.mode === 'trial' && isPadmin(p)); }
const views = new Map<string, any>();
function data(s: SiteFx) {
  if (views.has(s.id)) return views.get(s.id);
  const tokens = kiBrandTokens(s.domain, []);
  const v = { competitors: s.comps.map(kiCompetitorView).sort(kiCompetitorOrder), keywords: s.kws.map((r) => kiKeywordView(r, tokens)), gaps: s.gaps.map(kiGapView), runs: s.runs.map(kiRunView).sort((a, b) => b.startedAt.localeCompare(a.startedAt)) };
  views.set(s.id, v);
  return v;
}
export const counters: Record<string, number> = {};

/** The /api answer for (method, url) as persona p: [status, body]. */
export function api(p: Persona, method: string, url: URL, body: any, opts: { creditsOut?: boolean } = {}): [number, any] {
  const path = url.pathname;
  const q = Object.fromEntries(url.searchParams.entries());
  counters[path] = (counters[path] ?? 0) + 1;
  if (path === '/api/auth/providers') return [200, { google: false, emailPassword: true, email: false, engineEmails: false, requireEmailVerification: false }];
  if (path === '/api/me') return [200, me(p)];
  if (path === `/api/orgs/${ORG}`) return [200, org(p)];
  if (path === `/api/orgs/${ORG}/sites`) return [200, SITES.map(siteOut)];
  const m = /^\/api\/orgs\/org-1\/sites\/([^/]+)(\/.*)?$/.exec(path);
  if (m) {
    const s = SITES.find((x) => x.id === m[1]);
    if (!s) return [404, { error: 'Website not found' }];
    const rest = m[2] ?? '';
    if (rest === '') return [200, siteOut(s)];
    if (rest === '/data/settings') return [200, { tracking: { tracked: true, status: 'active', keywords: ['erp software uae'], ga4PropertyId: '', checkedAt: now }, monitors: null, cadence: { pagesPerWeek: 1 }, aiRank: null, contentGroups: [] }];
    if (rest === '/data/ai') return s.ai ? [200, s.ai] : [404, { error: 'No data' }];
    if (rest.startsWith('/ki')) {
      const vis = visible(s, p);
      const d = data(s);
      if (rest === '/ki' && method === 'GET') {
        const base: any = { mode: isPadmin(p) ? s.mode : s.mode === 'on' ? 'on' : 'off', visible: vis, ...(isPadmin(p) ? { killed: !!s.killed } : {}), canSwitch: isPadmin(p), canAct: vis && p !== 'viewer', maxCompetitors: 5, credits: { competitors: 21, research: 54 } };
        if (!vis) return [200, { ...base, lastRuns: [], summary: null }];
        return [200, { ...base, lastRuns: d.runs, summary: kiSummaryOf(s.market, d.competitors, d.keywords, d.gaps) }];
      }
      if (!vis) return [404, { error: 'Website not found' }];
      if (rest === '/ki/competitors') return [200, { market: s.market, maxCompetitors: 5, chosen: d.competitors.filter((c: any) => c.status === 'chosen').length, items: d.competitors }];
      if (rest === '/ki/keywords') {
        const kq = kiKeywordQueryOf(q);
        const list = d.keywords.filter((v: any) => kiKeywordMatches(v, kq)).sort(kiKeywordComparator(kq.sort));
        const pg = kiPage(list, kq.page, kq.pageSize);
        return [200, { market: s.market, total: pg.total, page: pg.page, pageSize: pg.pageSize, pages: pg.pages, sort: kq.sort, items: pg.items, facets: kiFacetsOf(d.keywords) }];
      }
      if (rest === '/ki/gaps') { const pg = kiPage(d.gaps, Number(q.page) || 1, Number(q.page_size) || 50); return [200, { market: s.market, ...pg, byType: {}, byStatus: {} }]; }
      if (rest.startsWith('/ki/competitors/') && method === 'PATCH') {
        const dom = decodeURIComponent(rest.split('/').pop()!);
        if (p === 'viewer') return [403, { error: 'You need the member role.' }];
        const c = d.competitors.find((x: any) => x.compDomain === dom);
        if (body?.status === 'chosen' && d.competitors.filter((x: any) => x.status === 'chosen').length >= 5) return [409, { error: 'You can choose up to 5 competitors.', code: 'ki_max_competitors' }];
        if (c) c.status = body?.status;
        return [200, { ok: true, compDomain: dom, status: body?.status, chosen: d.competitors.filter((x: any) => x.status === 'chosen').length, maxCompetitors: 5 }];
      }
      if (rest.startsWith('/ki/gaps/') && method === 'PATCH') { const id = rest.split('/').pop(); const g = d.gaps.find((x: any) => x.gapId === id); if (g) g.status = body?.status; return [200, { ok: true, gapId: id, status: body?.status }]; }
      if (rest === '/ki/questions/approve') return p === 'admin' || p === 'owner' || p === 'padmin' ? [200, { added: (body?.keys ?? []).map((k: string) => ({ kwKey: k, question: k })), skipped: [], panelSize: 20, ownOnPanel: 3 }] : [403, { error: 'Admins only' }];
      if (rest.startsWith('/ki/plan/')) return [501, { error: 'Starting a plan step from here is not available yet. You can start the same work from the Pipeline.', code: 'not_available_yet' }];
      if (rest === '/ki/mode') { s.mode = body?.mode; return [200, { ok: true, mode: body?.mode }]; }
    }
    return [404, { error: 'Not found' }];
  }
  if (path === `/api/orgs/${ORG}/reports`) {
    const site = SITES.find((x) => x.id === q.siteId);
    if (q.stage === 'ki_research' && site?.plan.length) return [200, [{ id: 'rep-' + site.id, runId: 'run-1', siteId: site.id, siteDomain: site.domain, stage: 'ki_research', status: 'ok', title: 'Keyword research', summary: {}, receivedAt: now, scheduled: false, files: [] }]];
    return [200, []];
  }
  const rep = /^\/api\/orgs\/org-1\/reports\/rep-(.+)$/.exec(path);
  if (rep) {
    const id = rep[1];
    const variants: Record<string, any> = {
      'ok': { stage: 'ki_research', status: 'ok', summary: { keywords: 5000, clusters: 160, striking: 41, questions: 30, plan: 5 }, sections: [] },
      'partial': { stage: 'ki_research', status: 'partial', summary: { keywords: 140, clusters: 12 }, sections: [{ key: 'enrich', state: 'missing' }, { key: 'gsc', state: 'partial' }] },
      'refused': { stage: 'ki_competitors', status: 'refused', reason: 'market_mismatch', summary: {}, sections: [] },
      'comp': { stage: 'ki_competitors', status: 'ok', summary: { competitors: 6, chosen: 2, listings: 3 }, sections: [] },
    };
    const s = SITES.find((x) => x.id === id);
    const v = s ? { stage: 'ki_research', status: 'ok', summary: {}, plan: s.plan } : variants[id] ?? variants.ok;
    const site = s ?? A;
    return [200, { id: 'rep-' + id, runId: 'run-1', siteId: site.id, siteDomain: site.domain, stage: v.stage, status: v.status === 'refused' ? 'failed' : 'ok', title: v.stage === 'ki_research' ? 'Keyword research' : 'Competitors', summary: { status: v.status, ...v.summary }, receivedAt: now, scheduled: false, files: [], payload: { ...v } }];
  }
  if (path === `/api/orgs/${ORG}/runs` && method === 'POST') return opts.creditsOut ? [402, { error: 'Your company has no credits left for Keyword research (it needs about 54). Buy credits in Settings > Credits.', code: 'credits' }] : [202, { runId: 'run-new', status: 'queued' }];
  return [404, { error: 'Not found' }];
}
