/*__FACT_ANSWERS__*/
/*__PAGE_FIX__*/
// H3 (2026-10-28, page review; docs/content-quality-2026-10-27): "Make the final version". `POST /webhook/seo-page-finalize` takes a page the
// engine already delivered (or the client's own edited version of it), the client's answers to the page's questions and the business facts,
// and returns the final page: no new research, no new full write, only the affected sections touched. The request is the app's FinalizeBody
// (app/shared/src/page-review.ts). This node plays the part *Parse Brief* plays in a content run (Content QA reads its context as
// `$('Parse Brief')`, exactly as in the Publish Check, B3-7) and it answers the caller's field errors (400).
// What the claim check treats as on file here: the business facts, the facts stored from earlier answers (business_facts_kv), the texts the
// client confirmed or wrote in THIS request (yes / edit / answer), and every sentence the client wrote in the page themself (the client is the
// source of what the client says about the client). Nothing here calls a model, fetches a page or writes a row.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : (raw && typeof raw === 'object' && raw.markdown != null ? raw : {});
const S = (v) => String(v == null ? '' : v);
const errors = [];
const LIM = { markdown_chars: 200000, answers: 400, text: 600, short: 2000, facts_chars: 5000 };
const DECISIONS = ['yes', 'edit', 'remove', 'general', 'answer', 'skip'];
const SOURCES = ['claim', 'brief', 'bracket'];
const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
const clean = (t) => S(t).replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();

if (b.mode != null && S(b.mode) !== 'finalize') errors.push('mode must be finalize');
const markdown = S(b.markdown).replace(/\r\n?/g, '\n');
if (!markdown.trim()) errors.push('markdown is required: the delivered page (or your edited version of it) as Markdown');
else if (markdown.length > LIM.markdown_chars) errors.push('markdown is longer than ' + LIM.markdown_chars + ' characters');
else if (markdown.split(/\s+/).filter(Boolean).length < 50) errors.push('markdown has fewer than 50 words: there is no page to finalise');
const delivered = S(b.delivered_markdown).replace(/\r\n?/g, '\n');
if (delivered.length > LIM.markdown_chars) errors.push('delivered_markdown is longer than ' + LIM.markdown_chars + ' characters');
const domain = S(b.domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
if (!domain) errors.push('domain is required');
else if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) errors.push('domain must be a host name such as example.com');
const meta = (b.meta && typeof b.meta === 'object' && !Array.isArray(b.meta)) ? b.meta : {};
if (b.meta != null && (typeof b.meta !== 'object' || Array.isArray(b.meta))) errors.push('meta must be an object { title, meta_description, slug, h1 }');
const h1Of = (markdown.match(/^# (.+)$/m) || [])[1] || '';
const keyword = S(b.keyword).trim().replace(/\s+/g, ' ') || S(meta.h1 || h1Of).trim().toLowerCase().slice(0, 120);
if (!keyword) errors.push('keyword is required: the search the page is written for');
else if (keyword.length > 120) errors.push('keyword is longer than 120 characters');
const facts = S(b.business_facts);
if (facts.length > LIM.facts_chars) errors.push('business_facts is longer than ' + LIM.facts_chars + ' characters');
if (b.business_facts_kv != null && (typeof b.business_facts_kv !== 'object' || Array.isArray(b.business_facts_kv))) errors.push('business_facts_kv must be an object fact_key -> text');
if (b.stored_fact_keys != null && !Array.isArray(b.stored_fact_keys)) errors.push('stored_fact_keys must be an array of fact keys');
const kv = FA.kvIn(b.business_facts_kv);
const stored = FA.keysIn(b.stored_fact_keys);

// W0-B (2026-10-29, page-quality PLAN Fix 2, REVIEW_CODE H2 / M8, owner decision D2): the PAGE-RUN CONTEXT (PRC, harness/README.md) of
// the page this final version is made from. The final version of production page 3299 (finalize 3336) was graded against itself: no
// facts, no terms, no length band, its own word count as the target, and the page run's blocker ("this website already has a page for the
// same search") never reached it, so it came back "Ready" at 100. The app now sends `page_run`, derived from the ORIGINAL report:
//   * gating fields (in every stored report): qa_blocking, duplicate_targets, verdict, score, score_withheld, page_type,
//     verdict_acknowledged, plus copied_passages (the passages the first check found repeated from another page). The two that carry a
//     block (qa_blocking, duplicate_targets) are required: without them nothing can say the page is ready. The others have the contract's
//     defaults (null / false / '') and never block, so a page whose verdict was not stored (the ranking guide of exec 949) is not held back;
//   * grading fields (page runs from W0-B on): length_band, coverage_target, terms, facts, sources_cited, style_guide, site_urls,
//     serp_shapes, regulatory_facts (+ regulatory_topics), content_request_id. A missing one is advice "not checked", never a block.
// `duplicate_decision` is the client's explicit answer to the duplicate-page blocker (D2): `update` of one of the pages the first check
// named (the final version is then the new text of that page: its address and slug), or `differs` with the reason, which is recorded
// and shown; the fit limit stays in the grade.
const LIMP = { blockers: 40, dups: 10, passages: 20, terms: 80, facts: 40, sources: 30, urls: 300, reg: 40 };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const httpUrl = (u) => /^https?:\/\/[^\s<>"]+$/i.test(S(u).trim()) ? S(u).trim().slice(0, 600) : '';
const pageKey = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const PRC_BLOCK = ['qa_blocking', 'duplicate_targets'];
const PRC_GRADING = ['length_band', 'coverage_target', 'terms', 'facts', 'sources_cited', 'style_guide', 'site_urls', 'serp_shapes', 'regulatory_facts'];
const pr = isObj(b.page_run) ? b.page_run : null;
if (b.page_run != null && !pr) errors.push('page_run must be an object (the context of the page run the page came from)');
const prc = (() => {
  const g = pr || {};
  const told = Array.isArray(g.missing) ? g.missing.map(x => S(x).trim()).filter(Boolean) : [];
  const gating_missing = [];
  const blk = Array.isArray(g.qa_blocking) && !told.includes('qa_blocking') ? g.qa_blocking.filter(isObj).slice(0, LIMP.blockers)
    .map(x => ({ code: S(x.code).trim().slice(0, 40) || 'other', text: clean(x.text).slice(0, 600), action: clean(x.action).slice(0, 300),
      ...(Array.isArray(x.urls) ? { urls: x.urls.map(httpUrl).filter(Boolean).slice(0, 5) } : {}) })) : null;
  if (!blk) gating_missing.push('qa_blocking');
  const dups = Array.isArray(g.duplicate_targets) && !told.includes('duplicate_targets') ? g.duplicate_targets.filter(isObj).map(x => ({ url: httpUrl(x.url), title: clean(x.title).slice(0, 200),
    keyword_words_shared_pct: Number.isFinite(Number(x.keyword_words_shared_pct)) ? Number(x.keyword_words_shared_pct) : null })).filter(x => x.url).slice(0, LIMP.dups) : null;
  if (!dups) gating_missing.push('duplicate_targets');
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const gating = { qa_blocking: blk || [], duplicate_targets: dups || [],
    verdict: S(g.verdict).trim().toUpperCase().slice(0, 30) || null, score: num(g.score), score_withheld: g.score_withheld === true,
    page_type: S(g.page_type).trim().slice(0, 60), verdict_acknowledged: g.verdict_acknowledged === true,
    copied_passages: (Array.isArray(g.copied_passages) ? g.copied_passages : []).map(x => S(x).replace(/\s+/g, ' ').trim()).filter(x => x.split(' ').length >= 6).map(x => x.slice(0, 400)).slice(0, LIMP.passages) };
  // the grading fields, each read only when it has the contract's shape
  const lb = isObj(g.length_band) && Number(g.length_band.low) > 0 && Number(g.length_band.high) >= Number(g.length_band.low)
    ? { low: Math.round(Number(g.length_band.low)), high: Math.round(Number(g.length_band.high)), source: S(g.length_band.source) || 'ranking_pages', sample: Number(g.length_band.sample) || 0,
      basis: clean(g.length_band.basis).slice(0, 400), target: Number(g.length_band.target) > 0 ? Math.round(Number(g.length_band.target)) : null } : null;
  const terms = Array.isArray(g.terms) ? g.terms.map(t => typeof t === 'string' ? { term: t } : (isObj(t) ? t : null)).filter(t => t && S(t.term).trim())
    .map(t => ({ term: S(t.term).trim().toLowerCase().slice(0, 80), min_count: Math.max(1, Math.min(20, Number(t.min_count) || 1)) })).slice(0, LIMP.terms) : null;
  const factsIn = Array.isArray(g.facts) ? g.facts.filter(isObj).map(f => ({ claim: S(f.claim).replace(/\s+/g, ' ').trim().slice(0, 600), source: S(f.source).trim().slice(0, 120),
    url: httpUrl(f.url), title: S(f.title).replace(/\s+/g, ' ').trim().slice(0, 200), ...(f.regulatory ? { regulatory: true } : {}) })).filter(f => f.claim || f.url).slice(0, LIMP.facts) : null;
  const cited = Array.isArray(g.sources_cited) ? g.sources_cited.filter(isObj).map(x => ({ anchor: S(x.anchor).replace(/\s+/g, ' ').trim().slice(0, 200), url: httpUrl(x.url),
    host: S(x.host).trim().slice(0, 120), tier: x.tier == null ? null : (typeof x.tier === 'number' ? x.tier : S(x.tier).slice(0, 30)) })).filter(x => x.url).slice(0, LIMP.sources) : null;
  const siteUrls = Array.isArray(g.site_urls) ? g.site_urls.map(httpUrl).filter(Boolean).slice(0, LIMP.urls) : null;
  const regFacts = Array.isArray(g.regulatory_facts) ? g.regulatory_facts.filter(isObj).slice(0, LIMP.reg) : null;
  const regTopics = Array.isArray(g.regulatory_topics) ? g.regulatory_topics.filter(isObj).map(t => ({ id: S(t.id).slice(0, 60), relevance: S(t.relevance).slice(0, 20) })).filter(t => t.id).slice(0, 12) : null;
  const grading = { length_band: lb, coverage_target: isObj(g.coverage_target) ? g.coverage_target : null, terms, facts: factsIn, sources_cited: cited,
    style_guide: isObj(g.style_guide) ? g.style_guide : null, site_urls: siteUrls, serp_shapes: isObj(g.serp_shapes) ? g.serp_shapes : null,
    regulatory_facts: regFacts, regulatory_topics: regTopics };
  const grading_missing = PRC_GRADING.filter(k => grading[k] == null);
  return { received: !!pr, gating, gating_missing, blocks_known: gating_missing.length === 0, grading, grading_missing,
    content_request_id: S(g.content_request_id || b.content_request_id).trim().slice(0, 120) };
})();
const dupUrls = [...new Set(prc.gating.duplicate_targets.map(d => d.url).concat(...prc.gating.qa_blocking.filter(x => x.code === 'duplicate_page').map(x => x.urls || [])))];
let duplicate_decision = null;
if (b.duplicate_decision != null) {
  const dd = b.duplicate_decision;
  if (!isObj(dd)) errors.push('duplicate_decision must be an object { choice: update | differs, url, reason }');
  else {
    const choice = S(dd.choice).trim().toLowerCase(); const url = httpUrl(dd.url); const reason = clean(dd.reason);
    if (!['update', 'differs'].includes(choice)) errors.push('duplicate_decision.choice must be update or differs');
    else if (choice === 'update' && !url) errors.push('duplicate_decision.url is required for update: the address of the page this text replaces');
    else if (choice === 'update' && dupUrls.length && !dupUrls.some(u => pageKey(u) === pageKey(url))) errors.push('duplicate_decision.url must be one of the pages the first check found for this search: ' + dupUrls.slice(0, 3).join(', '));
    else if (choice === 'differs' && (reason.length < 20 || reason.length > 600)) errors.push('duplicate_decision.reason must say in 20 to 600 characters how this page differs from the one your website has');
    else if (choice === 'differs' && /[<>]/.test(reason)) errors.push('duplicate_decision.reason must be plain text (no < or >)');
    else duplicate_decision = { choice, url: choice === 'update' ? url : '', reason: choice === 'differs' ? reason : '', applies: dupUrls.length > 0 };
  }
}

// the answers: each one checked, a malformed one refuses the request (the client must not get a page that silently ignored an answer)
let answers = [];
if (b.answers != null && !Array.isArray(b.answers)) errors.push('answers must be an array');
else {
  const list = Array.isArray(b.answers) ? b.answers : [];
  if (list.length > LIM.answers) errors.push('answers allows at most ' + LIM.answers + ' entries');
  const ids = new Set();
  list.slice(0, LIM.answers).forEach((a, i) => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) { errors.push('answers[' + i + '] must be an object'); return; }
    const id = S(a.id).trim(); const decision = S(a.decision).trim().toLowerCase(); const source = S(a.source || 'claim').trim().toLowerCase();
    const text = clean(a.text);
    if (!id || id.length > 40) errors.push('answers[' + i + '].id is required (at most 40 characters)');
    else if (ids.has(id)) errors.push('answers[' + i + '].id "' + id + '" is given twice'); else ids.add(id);
    if (!DECISIONS.includes(decision)) errors.push('answers[' + i + '].decision must be one of ' + DECISIONS.join(', '));
    if (!SOURCES.includes(source)) errors.push('answers[' + i + '].source must be claim, brief or bracket');
    if (S(a.text).length > LIM.text) errors.push('answers[' + i + '].text is longer than ' + LIM.text + ' characters');
    if ((decision === 'yes' || decision === 'edit' || decision === 'answer') && !text) errors.push('answers[' + i + '].text is required for ' + decision);
    if (/[<>]/.test(text)) errors.push('answers[' + i + '].text must be plain text (no < or >)');
    const fk = S(a.fact_key).trim();
    if (fk && !FA.KEY.test(fk)) errors.push('answers[' + i + '].fact_key is not a valid key');
    for (const f of ['question', 'original', 'neutral', 'section']) if (S(a[f]).length > LIM.short) errors.push('answers[' + i + '].' + f + ' is longer than ' + LIM.short + ' characters');
    const inPage = S(a.in_page).trim();
    answers.push({ id, fact_key: fk, source, decision, text: text.slice(0, LIM.text), question: clean(a.question).slice(0, LIM.short), original: clean(a.original).slice(0, LIM.short),
      neutral: S(a.neutral).replace(/\s+/g, ' ').trim().slice(0, LIM.short), in_page: ['neutral', 'cta', 'left_out'].includes(inPage) ? inPage : 'left_out', section: clean(a.section).slice(0, 300) });
  });
}

// the sentences the client wrote themself (in the edited version, not in the delivered one): on file, and never changed by the engine
const norm = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%$€£&]+/gu, ' ').replace(/\s+/g, ' ').trim();
const sentencesOf = (md) => S(md).split('\n').filter(l => l.trim() && !META.test(l.trim()) && !/^\s*\|?\s*:?-{2,}/.test(l)).flatMap(l => l.replace(/^\s*(?:#{1,6}|[-*+]|\d{1,3}[.)]|>)\s*/, '').split(/(?<=[.!?])\s+(?=[A-Z0-9"'\[(*])/))
  .map(x => x.trim()).filter(x => norm(x).split(' ').length >= 4);
const client_edited = b.client_edited === true && !!delivered.trim();
const deliveredSet = new Set(sentencesOf(delivered).map(norm));
const deliveredAll = norm(delivered);
const client_sentences = client_edited ? sentencesOf(markdown).filter(x => { const n = norm(x); return !deliveredSet.has(n) && !deliveredAll.includes(n); }).slice(0, 300) : [];

const answerTexts = answers.filter(a => a.decision === 'yes' || a.decision === 'edit' || a.decision === 'answer').map(a => a.text).filter(Boolean);
const businessFacts = [facts.slice(0, LIM.facts_chars), FA.text(kv), answerTexts.join('\n'), client_sentences.join('\n')].filter(x => S(x).trim()).join('\n');

// the page as a content run holds it: the meta lines above the H1 (from `meta` when the Markdown has none, removed again from the answer)
const had_meta = markdown.split('\n').some(l => /^(Title|Meta Description|Slug)\s*:/i.test(l.trim()));
const head = had_meta ? '' : [meta.title ? 'Title: ' + clean(meta.title) : '', meta.meta_description ? 'Meta Description: ' + clean(meta.meta_description) : '', meta.slug ? 'Slug: ' + clean(meta.slug) : ''].filter(Boolean).join('\n');
// W0-A (2026-10-29, page-quality PLAN Fix 1.4, REVIEW_CODE H4): the app sent back the stored meta description, and for production page
// 3299 that was "Slug: ms-365-erp-uae" (finalize 3336). The final version never runs Page Fix, so the meta rule (PF.meta) runs here once
// the head is built: a description that is missing, short or a field label is written from the page's Quick answer (or introduction)
const metaFix = PF.meta((head ? head + '\n\n' : '') + markdown.replace(/^\n+/, ''), { keyword, own_text: businessFacts });
const page = metaFix.md;
const withoutMeta = page.split('\n').filter(l => !META.test(l.trim())).join('\n');
const ownWords = withoutMeta.split(/\s+/).filter(Boolean).length;
const ownLinks = [...page.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]).filter(u => { const h = (u.match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i) || [])[1] || ''; const x = h.toLowerCase().replace(/^www\./, ''); return x === domain || x.endsWith('.' + domain); });
const pageType = S(b.page_type).trim() || prc.gating.page_type || 'Blog Post / Guide';

// W0-B: the length the page is judged against is the page run's band (never the page's own word count, which gave 15 of 15 by
// construction). A page written before the band was kept with it:
//   * the grade takes the length points the page run itself measured on the delivered page against the pages that rank (`length_points`,
//     from the original report's grade; Finalize Verdict puts them in), so the final version is neither flattered nor judged on a guess;
//   * a page with no such grade either is held to the usual band for its kind of page (Parse Analysis' bands), with (about) full points
//     anywhere inside it: a band read off no ranking page must not cut a long guide that ranks (the guide of exec 949 has 3,500 words);
//   and the advice says the length of the pages that rank was not checked.
const LEN = (() => {
  const lb = prc.grading.length_band;
  if (lb) { const mid = Math.round((lb.low + lb.high) / 200) * 100; const target = lb.target && lb.target >= lb.low && lb.target <= lb.high ? lb.target : Math.min(lb.high, Math.max(lb.low, mid));
    return { target, band: { ok: lb.source === 'ranking_pages', source: lb.source, low: lb.low, high: lb.high, sample: lb.sample, basis: lb.basis, target_word_count: target }, from: 'page_run' }; }
  const pts = pr && pr.length_points !== null && pr.length_points !== '' && Number.isFinite(Number(pr.length_points)) ? Math.max(0, Math.min(15, Number(pr.length_points))) : null;
  if (pts != null) return { target: Math.max(1, ownWords), band: null, from: 'first_check', points: pts };
  const pt = pageType.toLowerCase(); const isGuide = /blog|guide|article/.test(pt); const isHub = /pillar|hub/.test(pt); const isShort = /case stud|local/.test(pt);
  const lo = isHub ? 1800 : isShort ? 800 : isGuide ? 1200 : 900, hi = isHub ? 3500 : isShort ? 1800 : isGuide ? 3000 : 2400;
  const target = Math.min(hi, Math.max(lo, ownWords));
  return { target, band: { ok: false, source: 'page_type', low: lo, high: hi, sample: 0, target_word_count: target,
    basis: 'the usual length for this kind of page is used: ' + lo.toLocaleString('en-US') + '-' + hi.toLocaleString('en-US') + ' words (the length of the pages that rank was not kept with this page)' }, from: 'page_type' };
})();
const G = prc.grading;
const siteUrls = [...new Set(ownLinks.concat(G.site_urls || []))];

const ok = errors.length === 0;
return [{ json: {
  ok, errors, error: errors.join('; '),
  output: page, critique: null, had_meta,
  keyword, domain, country: S(b.country).trim(), currency: '', page_type: pageType, page_role: 'standard', article_like: false,
  business: '', business_facts: businessFacts, case_facts_text: '', business_facts_kv: kv, stored_fact_keys: stored,
  // W0-B: the page run's context (PRC grading fields) where the request carried it, else what the page itself holds
  facts: G.facts || [], term_model: [], coverage_target: G.coverage_target || null, competitors: [],
  content_brief: { target_word_count: LEN.target, outline: [], terms_to_use: G.terms || [], evidence_plan: (G.sources_cited || []).map(x => ({ source_url: x.url, claim: x.anchor, source: x.host })),
    snippet_targets: [], secondary_keywords: [], questions_for_client: [] },
  length_band: LEN.band, own_word_count: ownWords,
  internal_link_candidates: ownLinks.map(u => ({ url: u })), site_urls: siteUrls, planned_link_targets: [], hub_pages: [],
  existing_page: null, existing_page_ours: false, ladder_id: '', author: null, reviewer: null, site_profile: null, site_description: null, video: null, style_guide: G.style_guide || null,
  serp_shapes: G.serp_shapes || null, regulatory: G.regulatory_facts ? { topics: G.regulatory_topics || [...new Set(G.regulatory_facts.map(f => S(f.topic)).filter(Boolean))].map(id => ({ id, relevance: 'core' })), facts: G.regulatory_facts } : null,
  ai_target: null, qa_max_rounds: 1, originality_max_overlap_pct: 15, client_pages: [],
  request_id: S(b.request_id).slice(0, 120), content_request_id: S(prc.content_request_id || b.content_request_id).slice(0, 120), site_id: S(b.site_id).slice(0, 120),
  prc: { received: prc.received, gating: prc.gating, gating_missing: prc.gating_missing, blocks_known: prc.blocks_known, grading_missing: prc.grading_missing, length_from: LEN.from,
    length_points: LEN.points == null ? null : LEN.points,
    duplicate_urls: dupUrls, duplicate_decision },
  finalize: { answers, client_edited, client_sentences, delivered_markdown: delivered, input_markdown: markdown, answer_texts: answerTexts, stored_keys: stored,
    answered_keys: answers.filter(a => a.decision !== 'skip' && a.fact_key).map(a => a.fact_key),
    meta_fix: { how: metaFix.how, description: metaFix.description, problem: metaFix.problem, fixes: metaFix.fixes } }
} }];
