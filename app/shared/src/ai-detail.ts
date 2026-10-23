// AI visibility wave 2 (W2-A, 2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §1-§2): the app's readers of
// the engine's new answer columns and visibility-row JSON columns.
//
// Rules (the contract's): every JSON column is a string holding JSON; every rate is 0-100 and travels with its n; an ABSENT field means
// "older row", never 0. So every reader here returns null for a column that is missing or unreadable, and the page then shows today's
// view for that block. A field inside a present column that is missing is read as null (unknown), never as 0.

export type Obj = Record<string, unknown>;
const rec = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '');
const num = (v: unknown): number | null => (v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(Number(v)) ? null : Number(v));
const int0 = (v: unknown): number => Math.max(0, Math.round(num(v) ?? 0));
const bool = (v: unknown): boolean => v === true || v === 'true' || v === 1;

/** A JSON column as stored: a string holding JSON (or an object already parsed). null when absent, empty or unreadable. */
export function aiJson(v: unknown): unknown {
  if (v && typeof v === 'object') return v;
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** The host of a URL without www., by regex (the engine's Code sandbox has no URL constructor; the app follows the same rule). */
export const aiHostOf = (u: string): string => (str(u).match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i)?.[1] ?? '').toLowerCase().replace(/^www\./, '');
/** A URL on the website or one of its subdomains. */
export const aiIsOwnUrl = (u: string, domain: string): boolean => {
  const h = aiHostOf(u), d = str(domain).toLowerCase().replace(/^www\./, '');
  return !!h && !!d && (h === d || h.endsWith('.' + d));
};

// ---------------- §1: one answer ----------------

export interface AiCitation { url: string; host: string; entityId: string; role: string; position: number | null; own: boolean }
export interface AiRetrievedPage { url: string; host: string; entityId: string; own: boolean }
export interface AiProductCard { title: string; merchant: string; price: number | null; currency: string; url: string; position: number | null; entityId: string; own: boolean }
export interface AiAdCard { advertiser: string; url: string; host: string; rendered: boolean }
export interface AiLocalCard { name: string; url: string; host: string; position: number | null; own: boolean }

/** What a wave-2 answer row adds. Every field is null on a row written before it existed. */
export interface AiAnswerDetail {
  /** the whole answer (normalised, capped at 12,000 characters by the engine); null when the row has none (older, or no longer kept) */
  answerText: string | null;
  answerCut: boolean;
  /** the engine stored the whole answer once and has since blanked it (kept 35 days for the weekly run, 7 for the pulse) */
  answerExpired: boolean;
  /** the answer's length in characters as the engine recorded it (detail_json.answer_len), null when not recorded */
  answerLen: number | null;
  /** every source the answer cited, in order */
  citations: AiCitation[] | null;
  /** pages the engine retrieved or looked at and did NOT cite */
  retrieved: AiRetrievedPage[] | null;
  /** the searches the engine ran before answering (the new JSON column; the older ' | ' column is read too) */
  fanoutQueries: string[] | null;
  products: AiProductCard[] | null;
  ads: AiAdCard[] | null;
  local: AiLocalCard[] | null;
  /** the model / mode the engine reported ('' = it did not report one) */
  model: string | null;
}

const hasCol = (row: Obj, k: string) => k in row && row[k] != null && !(typeof row[k] === 'string' && !(row[k] as string).trim());
const arrayCol = <T>(row: Obj, k: string, map: (o: Obj) => T | null): T[] | null => {
  if (!hasCol(row, k)) return null;
  const j = aiJson(row[k]);
  if (!Array.isArray(j)) return null;
  return j.map((x) => map(rec(x))).filter((x): x is T => x != null);
};

/** Reads the §1 columns of a stored answer row (`seo_ai_answers`), the website's domain marks its own URLs. */
export function aiAnswerDetail(row: Obj, domain: string): AiAnswerDetail {
  const own = (u: string, flag?: unknown) => (flag === true || flag === 'true' ? true : aiIsOwnUrl(u, domain));
  const detail = rec(aiJson(row.detail_json));
  const text = hasCol(row, 'answer_text') ? str(row.answer_text) : null;
  const answerLen = num(detail.answer_len);
  return {
    answerText: text,
    answerCut: bool(detail.answer_cut) || bool(row.answer_cut),
    // W2-E1: answer_text / retrieved_json are blanked after 35 days (weekly) or 7 (pulse); detail_json still says there was an answer
    answerExpired: text == null && (answerLen ?? 0) > 0,
    answerLen,
    citations: arrayCol(row, 'cited_json', (o) => {
      const url = str(o.url);
      if (!url) return null;
      return { url, host: str(o.host) || aiHostOf(url), entityId: str(o.entity_id), role: str(o.role), position: num(o.position), own: own(url) || str(o.role) === 'self' };
    })?.sort((a, b) => (a.position ?? 999) - (b.position ?? 999)) ?? null,
    retrieved: arrayCol(row, 'retrieved_json', (o) => {
      const url = str(o.url);
      return url ? { url, host: str(o.host) || aiHostOf(url), entityId: str(o.entity_id), own: own(url) } : null;
    }),
    fanoutQueries: hasCol(row, 'fanout_json') ? list(aiJson(row.fanout_json)).map(str).filter(Boolean) : null,
    products: arrayCol(row, 'products_json', (o) => ({ title: str(o.title), merchant: str(o.merchant), price: num(o.price), currency: str(o.currency), url: str(o.url), position: num(o.position), entityId: str(o.entity_id), own: own(str(o.url), o.own) })),
    ads: arrayCol(row, 'ads_json', (o) => ({ advertiser: str(o.advertiser), url: str(o.url), host: str(o.host) || aiHostOf(str(o.url)), rendered: bool(o.rendered) })),
    local: arrayCol(row, 'local_json', (o) => ({ name: str(o.name), url: str(o.url), host: str(o.host) || aiHostOf(str(o.url)), position: num(o.position), own: own(str(o.url), o.own) })),
    model: hasCol(row, 'model') || 'model' in row ? str(row.model) : null,
  };
}

// ---------------- §2: the visibility row's new JSON columns ----------------

export interface AiUrlsPanel {
  own: { url: string; citedN: number; retrievedN: number; citedRate: number | null; answersN: number; engines: string[]; questions: string[]; rivalCitedInstead: { url: string; host: string; n: number }[] }[];
  rivals: { url: string; host: string; entityId: string; citedN: number }[];
  retrievedNotCited: { url: string; retrievedN: number; topCompeting: { url: string; host: string; n: number }[] }[];
}
export function parseAiUrls(v: unknown): AiUrlsPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  const urlN = (o: Obj) => ({ url: str(o.url), host: str(o.host) || aiHostOf(str(o.url)), n: int0(o.n) });
  return {
    own: list(x.own).map((o0) => {
      const o = rec(o0);
      return { url: str(o.url), citedN: int0(o.cited_n), retrievedN: int0(o.retrieved_n), citedRate: num(o.cited_rate), answersN: int0(o.answers_n), engines: list(o.engines).map(str), questions: list(o.questions).map(str), rivalCitedInstead: list(o.rival_cited_instead).map((r) => urlN(rec(r))) };
    }).filter((o) => o.url),
    rivals: list(x.rivals).map((o0) => { const o = rec(o0); return { url: str(o.url), host: str(o.host) || aiHostOf(str(o.url)), entityId: str(o.entity_id), citedN: int0(o.cited_n) }; }).filter((o) => o.url),
    retrievedNotCited: list(x.retrieved_not_cited).map((o0) => { const o = rec(o0); return { url: str(o.url), retrievedN: int0(o.retrieved_n), topCompeting: list(o.top_competing).map((r) => urlN(rec(r))) }; }).filter((o) => o.url),
  };
}

export const AI_SOURCE_TYPES = ['own', 'rival', 'ugc', 'reference', 'editorial', 'government', 'directory', 'other'] as const;
export const AI_SOURCE_TYPE_LABEL: Record<string, string> = { own: 'Your site', rival: 'Competitors', ugc: 'Forums and video (UGC)', reference: 'Reference (e.g. Wikipedia)', editorial: 'Editorial and news', government: 'Government', directory: 'Directories and reviews', other: 'Other' };
/**
 * The older sources table of a visibility row. W2-E1 made sources_json an OBJECT {v: 2, types, domains, n, list}, `list` being the old
 * array; a row written before it holds the array itself. Both read here (anything else is an empty list).
 */
export function aiLegacySourcesList(v: unknown): Obj[] {
  const j = aiJson(v);
  return (Array.isArray(j) ? j : list(rec(j).list)).map(rec);
}

export interface AiSourcesPanel {
  types: { type: string; n: number; share: number | null }[];
  domains: { host: string; type: string; citedN: number; share: number | null; firstSeen: string; lastSeen: string; halfLifeDays: number | null }[];
  n: number;
}
export function parseAiSources2(v: unknown): AiSourcesPanel | null {
  const j = aiJson(v);
  // the older sources_json is an ARRAY of {domain, citations, ...}: not this shape, read by the existing reader
  if (!j || Array.isArray(j)) return null;
  const x = rec(j);
  if (!('types' in x) && !('domains' in x)) return null;
  const t = rec(x.types);
  return {
    types: Object.entries(t).map(([type, o]) => ({ type, n: int0(rec(o).n), share: num(rec(o).share) })).sort((a, b) => b.n - a.n),
    domains: list(x.domains).map((o0) => { const o = rec(o0); return { host: str(o.host), type: str(o.type) || 'other', citedN: int0(o.cited_n), share: num(o.share), firstSeen: str(o.first_seen), lastSeen: str(o.last_seen), halfLifeDays: num(o.half_life_days) }; }).filter((d) => d.host),
    n: int0(x.n),
  };
}

export interface AiShoppingPanel {
  status: 'measured' | 'no shopping results';
  triggerRate: number | null; triggerN: number; answersN: number; productsN: number;
  ownPresenceRate: number | null; ownAvgPosition: number | null;
  merchants: { merchant: string; share: number | null; n: number }[];
  byEngine: { engine: string; triggerRate: number | null; answersN: number; productsN: number }[];
}
export function parseAiShopping(v: unknown): AiShoppingPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  const be = rec(x.by_engine);
  const measured = str(x.status) === 'measured' || (str(x.status) !== 'no shopping results' && int0(x.products_n) > 0);
  return {
    status: measured ? 'measured' : 'no shopping results',
    // "no shopping results" carries no rate (the engine sends null): never read as 0%
    triggerRate: measured ? num(x.trigger_rate) : null, triggerN: int0(x.trigger_n), answersN: int0(x.answers_n), productsN: int0(x.products_n),
    ownPresenceRate: measured ? num(x.own_presence_rate) : null, ownAvgPosition: measured ? num(x.own_avg_position) : null,
    merchants: list(x.merchants).map((o0) => { const o = rec(o0); return { merchant: str(o.merchant), share: num(o.share), n: int0(o.n) }; }).filter((m) => m.merchant),
    byEngine: Object.entries(be).map(([engine, o0]) => { const o = rec(o0); return { engine, triggerRate: num(o.trigger_rate), answersN: int0(o.answers_n), productsN: int0(o.products_n) }; }),
  };
}

export interface AiAdsLocalPanel {
  ads: { seenN: number; answersN: number; advertisers: { name: string; host: string; n: number }[] } | null;
  local: { seenN: number; ownN: number; answersN: number; rivals: { name: string; n: number }[] } | null;
}
export function parseAiAdsLocal(v: unknown): AiAdsLocalPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  const a = x.ads ? rec(x.ads) : null, l = x.local ? rec(x.local) : null;
  return {
    ads: a ? { seenN: int0(a.seen_n), answersN: int0(a.answers_n), advertisers: list(a.advertisers).map((o0) => { const o = rec(o0); return { name: str(o.name), host: str(o.host), n: int0(o.n) }; }) } : null,
    local: l ? { seenN: int0(l.seen_n), ownN: int0(l.own_n), answersN: int0(l.answers_n), rivals: list(l.rivals).map((o0) => { const o = rec(o0); return { name: str(o.name), n: int0(o.n) }; }) } : null,
  };
}

export interface AiCiRange { lo: number; hi: number; nAnswers: number | null; nQuestions: number | null; deff: number | null }
export interface AiCiPanel { method: string; headline: Partial<Record<string, AiCiRange>>; note: string }
export function parseAiCi(v: unknown): AiCiPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  const headline: AiCiPanel['headline'] = {};
  for (const [k, o0] of Object.entries(rec(x.headline))) {
    const o = rec(o0), lo = num(o.lo), hi = num(o.hi);
    if (lo != null && hi != null) headline[k] = { lo, hi, nAnswers: num(o.n_answers), nQuestions: num(o.n_questions), deff: num(o.deff) };
  }
  return { method: str(x.method), headline, note: str(x.note) };
}
/** "clustered by question" / "design effect": what the range is, in words */
export const aiCiMethodLabel = (m: string): string => (m === 'question-bootstrap' ? 'resampled by question (answers to one question are not counted as independent)' : m === 'design-effect' ? 'widened for answers to the same question (design effect)' : 'Wilson range on answers');

export interface AiSovPanel {
  set: string[];
  othersShare: number | null;
  /** `position`: the brand's average place in the answers that name it (when the engine sends it) */
  byEntity: { id: string; name: string; share: number | null; n: number; position: number | null }[];
  denominators: { allAnswers: number | null; answersNamingAnyBrand: number | null };
  namedOfBrandedRate: number | null;
}
export function parseAiSov(v: unknown): AiSovPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  const d = rec(x.denominators);
  return {
    set: list(x.set).map(str).filter(Boolean),
    othersShare: num(x.others_share),
    byEntity: list(x.by_entity).map((o0) => { const o = rec(o0); return { id: str(o.id), name: str(o.name) || str(o.id), share: num(o.share), n: int0(o.n), position: num(o.avg_position ?? o.position) }; }).filter((e) => e.id || e.name),
    denominators: { allAnswers: num(d.all_answers), answersNamingAnyBrand: num(d.answers_naming_any_brand) },
    namedOfBrandedRate: num(x.named_of_branded_rate),
  };
}

/** sentiment is withheld under this many answers naming the business (the contract's floor) */
export const AI_SENTIMENT_MIN = 12;
export interface AiSentimentPanel {
  withheld: boolean;
  net: number | null; netLo: number | null; netHi: number | null; n: number;
  byAspect: { aspect: string; pos: number; neg: number; neu: number; net: number | null; n: number }[];
  byRival: { id: string; net: number | null; n: number }[];
  objections: string[];
  method: string;
  kappa: number | null;
}
export function parseAiSentiment(v: unknown): AiSentimentPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  const n = int0(x.n);
  const withheld = n < AI_SENTIMENT_MIN || bool(x.withheld);
  return {
    withheld,
    net: withheld ? null : num(x.net), netLo: withheld ? null : num(x.net_lo), netHi: withheld ? null : num(x.net_hi), n,
    byAspect: withheld ? [] : list(x.by_aspect).map((o0) => { const o = rec(o0); return { aspect: str(o.aspect), pos: int0(o.pos), neg: int0(o.neg), neu: int0(o.neu), net: num(o.net), n: int0(o.n) }; }).filter((a) => a.aspect),
    byRival: withheld ? [] : list(x.by_rival).map((o0) => { const o = rec(o0); return { id: str(o.id), net: num(o.net), n: int0(o.n) }; }).filter((r) => r.id),
    objections: withheld ? [] : list(x.objections).map((o) => (typeof o === 'string' ? o : str(rec(o).text))).filter(Boolean),
    method: str(x.method),
    kappa: num(x.kappa),
  };
}

export type AiImpactVerdict = 'likely helped' | "can't tell" | 'likely hurt';
export interface AiImpactItem {
  actionId: string; kind: string; targetQuestions: string[]; controlQuestions: string[];
  before: { rate: number | null; n: number }; after: { rate: number | null; n: number };
  did: { effect: number | null; lo: number | null; hi: number | null };
  verdict: AiImpactVerdict; windowDays: number | null;
}
export function parseAiImpact(v: unknown): AiImpactItem[] | null {
  const j = aiJson(v);
  if (!Array.isArray(j)) return null;
  return j.map((o0) => {
    const o = rec(o0), b = rec(o.before), a = rec(o.after), d = rec(o.did);
    const verdict = str(o.verdict);
    return {
      actionId: str(o.action_id), kind: str(o.kind), targetQuestions: list(o.target_questions).map(str), controlQuestions: list(o.control_questions).map(str),
      before: { rate: num(b.rate), n: int0(b.n) }, after: { rate: num(a.rate), n: int0(a.n) }, did: { effect: num(d.effect), lo: num(d.lo), hi: num(d.hi) },
      // only the engine's three words; anything else is read as "can't tell" (never "caused")
      verdict: (verdict === 'likely helped' || verdict === 'likely hurt' ? verdict : "can't tell") as AiImpactVerdict,
      windowDays: num(o.window_days),
    };
  });
}

export interface AiRuleResult { ruleId: string; fired: boolean; metric: string; scope: Obj; delta: number | null; test: string; reason: string }
export function parseAiRuleResults(v: unknown): AiRuleResult[] | null {
  const j = aiJson(v);
  if (!Array.isArray(j)) return null;
  return j.map((o0) => { const o = rec(o0); return { ruleId: str(o.rule_id), fired: bool(o.fired), metric: str(o.metric), scope: rec(o.scope), delta: num(o.delta), test: str(o.test), reason: str(o.reason) }; });
}

export interface AiFanoutGapPanel {
  queries: { query: string; freq: number; engines: string[]; ourRank: number | null; ourUrl: string | null; targetUrl: string | null; topDomains: string[]; cited: boolean }[];
  checkedN: number;
}
export function parseAiFanoutGap(v: unknown): AiFanoutGapPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  return {
    queries: list(x.queries).map((o0) => { const o = rec(o0); return { query: str(o.query), freq: int0(o.freq), engines: list(o.engines).map(str), ourRank: num(o.our_rank), ourUrl: str(o.our_url) || null, targetUrl: str(o.target_url) || null, topDomains: list(o.top_domains).map((d) => (typeof d === 'string' ? d : str(rec(d).domain))).filter(Boolean), cited: bool(o.cited) }; }).filter((q) => q.query),
    checkedN: int0(x.checked_n),
  };
}

export interface AiDemandPanel {
  questions: { promptId: string; proxies: { source: string; value: number | null; asOf: string; note: string }[]; lo: number | null; hi: number | null }[];
  market: { historical: Obj[]; newLost: Obj[]; topBrands: { name: string; mentions: number | null }[] };
  note: string;
}
export function parseAiDemand(v: unknown): AiDemandPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  const m = rec(x.market);
  return {
    questions: list(x.questions).map((o0) => { const o = rec(o0); return { promptId: str(o.prompt_id), lo: num(o.lo), hi: num(o.hi), proxies: list(o.proxies).map((p0) => { const p = rec(p0); return { source: str(p.source), value: num(p.value), asOf: str(p.as_of), note: str(p.note) }; }) }; }).filter((q) => q.promptId),
    market: { historical: list(m.historical).map(rec), newLost: list(m.new_lost).map(rec), topBrands: list(m.top_brands).map((o0) => { const o = rec(o0); return { name: str(o.name) || str(o.brand) || str(o.domain), mentions: num(o.mentions) }; }).filter((b) => b.name) },
    note: str(x.note),
  };
}

export interface AiNotesPanel { lostNote: string; unanalysedNote: string; marketFallbackN: number | null }
export function parseAiNotes(v: unknown): AiNotesPanel | null {
  const x = rec(aiJson(v));
  if (!Object.keys(x).length) return null;
  return { lostNote: str(x.lost_note), unanalysedNote: str(x.unanalysed_note), marketFallbackN: num(x.market_fallback_n) };
}

/** imports_json: the engine's summary of the owner's uploads for the period (shape not fixed by the contract: read loosely) */
export interface AiImportsPanel { sources: { source: string; rows: number | null; citations: number | null; impressions: number | null; clicks: number | null; from: string; to: string }[]; note: string }
export function parseAiImportsSummary(v: unknown): AiImportsPanel | null {
  const j = aiJson(v);
  if (j == null) return null;
  const x = rec(j);
  const entries: [string, Obj][] = Array.isArray(j) ? j.map((o) => [str(rec(o).source), rec(o)]) : Object.entries(rec(x.sources ?? x)).filter(([, o]) => o && typeof o === 'object').map(([k, o]) => [k, rec(o)]);
  const sources = entries.map(([source, o]) => ({ source: source || str(o.source), rows: num(o.rows), citations: num(o.citations), impressions: num(o.impressions), clicks: num(o.clicks), from: str(o.from), to: str(o.to) })).filter((s) => s.source);
  return sources.length || str(x.note) ? { sources, note: str(x.note) } : null;
}

/**
 * The persona effect (MARKET_RND gap 7: each buyer role sent to the API engines as context, asked with and without it). The contract
 * (WAVE2_CONTRACTS.md) names the setting (§4 ai_persona_context) but no column for the result yet: this reads `persona_effect_json` on
 * the row, or `notes_json.persona_effect`, shaped [{role, with:{rate,n}, without:{rate,n}, delta, lo, hi, significant}]. ASSUMPTION, to
 * be confirmed by the engine agent; nothing is shown until one of them is present.
 */
export interface AiPersonaEffect { role: string; withRate: number | null; withN: number; withoutRate: number | null; withoutN: number; delta: number | null; lo: number | null; hi: number | null; significant: boolean | null }
export function parseAiPersonaEffect(v: unknown): AiPersonaEffect[] | null {
  const j = aiJson(v);
  if (!Array.isArray(j)) return null;
  return j.map((o0) => {
    const o = rec(o0), w = rec(o.with), wo = rec(o.without);
    return { role: str(o.role), withRate: num(w.rate), withN: int0(w.n), withoutRate: num(wo.rate), withoutN: int0(wo.n), delta: num(o.delta), lo: num(o.lo), hi: num(o.hi), significant: typeof o.significant === 'boolean' ? o.significant : null };
  }).filter((x) => x.role);
}

/** Everything wave 2 adds to the latest visibility row. Each block is null on a row written before it. */
export interface AiLatestExtras {
  urls: AiUrlsPanel | null;
  sources: AiSourcesPanel | null;
  shopping: AiShoppingPanel | null;
  adsLocal: AiAdsLocalPanel | null;
  ci: AiCiPanel | null;
  sov: AiSovPanel | null;
  sentiment: AiSentimentPanel | null;
  impact: AiImpactItem[] | null;
  rules: AiRuleResult[] | null;
  fanoutGap: AiFanoutGapPanel | null;
  demand: AiDemandPanel | null;
  imports: AiImportsPanel | null;
  notes: AiNotesPanel | null;
  personaEffect: AiPersonaEffect[] | null;
  /** the n8n execution ids of the run's parts (shown to admins only, for support) */
  execIds: string[];
}
export function aiLatestExtras(row: Obj): AiLatestExtras {
  return {
    urls: parseAiUrls(row.urls_json),
    sources: parseAiSources2(row.sources_json),
    shopping: parseAiShopping(row.shopping_json),
    adsLocal: parseAiAdsLocal(row.ads_local_json),
    ci: parseAiCi(row.ci_json),
    sov: parseAiSov(row.sov_json),
    sentiment: parseAiSentiment(row.sentiment_json),
    impact: parseAiImpact(row.impact_json),
    rules: parseAiRuleResults(row.alerts_rules_json),
    fanoutGap: parseAiFanoutGap(row.fanout_gap_json),
    demand: parseAiDemand(row.demand_json),
    imports: parseAiImportsSummary(row.imports_json),
    notes: parseAiNotes(row.notes_json),
    personaEffect: parseAiPersonaEffect(row.persona_effect_json ?? rec(aiJson(row.notes_json)).persona_effect),
    execIds: str(row.exec_ids).split(',').map((s) => s.trim()).filter(Boolean),
  };
}

// ---------------- per-run figures for the trend charts ----------------

/** One engine's rates in one run (engines_json), for "per engine over time". */
export interface AiEngineRate { key: string; name: string; mentionRate: number | null; citationRate: number | null; samples: number; ci: [number, number] | null; carried: boolean }
export function aiEngineRatesOf(enginesJson: unknown): AiEngineRate[] {
  return Object.entries(rec(aiJson(enginesJson))).map(([key, e0]) => {
    const e = rec(e0);
    const ci = Array.isArray(e.ci) && e.ci.length === 2 && num(e.ci[0]) != null && num(e.ci[1]) != null ? ([num(e.ci[0])!, num(e.ci[1])!] as [number, number]) : null;
    const samples = num(e.samples) ?? num(e.answered) ?? 0;
    return { key, name: str(e.name) || key, mentionRate: num(e.mention_rate), citationRate: num(e.citation_rate), samples, ci, carried: bool(e.carried) };
  });
}

/** One brand's share of voice in one run: from sov_json (a fixed set) when the row has it, else competitors_json (every brand named). */
export interface AiSovPoint { id: string; name: string; share: number | null; n: number }
export function aiSovOf(sovJson: unknown, competitorsJson: unknown): { basis: 'set' | 'all'; brands: AiSovPoint[] } {
  const s = parseAiSov(sovJson);
  if (s && s.byEntity.length) return { basis: 'set', brands: s.byEntity.map((e) => ({ id: e.id || e.name, name: e.name, share: e.share, n: e.n })) };
  return { basis: 'all', brands: list(aiJson(competitorsJson)).map((c0) => { const c = rec(c0); return { id: str(c.domain), name: str(c.domain), share: num(c.share), n: int0(c.mentions) }; }).filter((b) => b.id) };
}
