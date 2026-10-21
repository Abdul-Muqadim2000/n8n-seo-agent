/*__COVERAGE__*/
/*__FIT_GATE__*/
/*__SITE_MODEL__*/
// B3-7 (2026-10-16, benchmark area 3): "is this page publishable?" without a $0.80 content run.
// `POST /webhook/seo-publish-check` runs the DETERMINISTIC half of the content gate over Markdown the caller supplies: the very same
// *Content QA* and *Originality Check* node code the content run executes (build_api.py copies both from the generated main workflow
// and asserts they are byte-identical), so every rule exists once. This node plays the part *Parse Brief* plays in a content run — it
// is named so because Content QA reads its context as `$('Parse Brief')` — and it also answers the caller's field errors (400).
// Nothing here calls a model, fetches a page or writes a row. What the gate's Claude half does (the editor review) and what needs data
// the caller did not send (sources, competitor pages, terms, a word target) is listed by the verdict as `not_checked`, with the reason.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : (raw && typeof raw === 'object' && raw.markdown != null ? raw : {});
const S = (v) => String(v == null ? '' : v);
const errors = [];
const LIM = { markdown_chars: 200000, competitors: 10, competitor_chars: 30000, sources: 20, source_chars: 40000, terms: 60, internal_links: 500, facts_chars: 5000 };
const isUrl = (u) => /^https?:\/\/[^\s\/?#]+\.[^\s\/?#]+(?:[\/?#]\S*)?$/i.test(S(u).trim());
const hostOf = (u) => { const m = S(u).trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };

const markdown = S(b.markdown != null ? b.markdown : b.page_markdown).replace(/\r\n?/g, '\n');
if (!markdown.trim()) errors.push('markdown is required: the page as Markdown (optional "Title:", "Meta Description:" and "Slug:" lines above the H1)');
else if (markdown.length > LIM.markdown_chars) errors.push('markdown is longer than ' + LIM.markdown_chars + ' characters');
else if (markdown.split(/\s+/).filter(Boolean).length < 50) errors.push('markdown has fewer than 50 words: there is no page to judge');
const keyword = S(b.keyword).trim().replace(/\s+/g, ' ');
if (!keyword) errors.push('keyword is required: the search the page is written for');
else if (keyword.length > 120) errors.push('keyword is longer than 120 characters');
const domain = S(b.domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
if (b.domain != null && S(b.domain).trim() && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) errors.push('domain must be a host name such as example.com');
const tw = b.target_words == null || b.target_words === '' ? null : Number(b.target_words);
if (tw != null && !(Number.isFinite(tw) && tw >= 200 && tw <= 10000)) errors.push('target_words must be a number between 200 and 10000');
const arr = (v, name, max) => { if (v == null) return []; if (!Array.isArray(v)) { errors.push(name + ' must be an array'); return []; } if (v.length > max) errors.push(name + ' allows at most ' + max + ' entries'); return v.slice(0, max); };
const terms = arr(b.terms, 'terms', LIM.terms).map(t => (t && typeof t === 'object') ? { term: S(t.term).trim().toLowerCase(), min_count: Math.max(1, Math.round(Number(t.min_count) || 1)) } : { term: S(t).trim().toLowerCase(), min_count: 1 }).filter(t => t.term && t.term.length <= 80);
const competitors = arr(b.competitors, 'competitors', LIM.competitors).map((c, i) => {
  const url = S(c && c.url).trim(), text = S(c && (c.content != null ? c.content : c.text));
  if (!isUrl(url)) errors.push('competitors[' + i + '].url must be a full http(s) address');
  if (text.length > LIM.competitor_chars) errors.push('competitors[' + i + '].content is longer than ' + LIM.competitor_chars + ' characters');
  const headings = text.split('\n').filter(l => /^#{1,4}\s/.test(l.trim())).map(l => 'H' + (l.trim().match(/^#+/)[0].length) + ': ' + l.replace(/^\s*#+\s*/, '').trim()).slice(0, 40);
  return { url, domain: hostOf(url), rank: Number(c && c.rank) || i + 1, title: S(c && c.title).slice(0, 200), content_full: text.slice(0, LIM.competitor_chars), content: text.slice(0, LIM.competitor_chars), headings,
    word_count: text.split(/\s+/).filter(Boolean).length };
}).filter(c => c.content_full.trim());
const sources = arr(b.sources, 'sources', LIM.sources).map((s, i) => {
  const url = S(s && s.url).trim(); if (!isUrl(url)) errors.push('sources[' + i + '].url must be a full http(s) address');
  return { url, text: S(s && s.text).slice(0, LIM.source_chars) };
}).filter(s => s.url && s.text.trim());
const internal = arr(b.internal_links, 'internal_links', LIM.internal_links).map(u => S(u).trim()).filter(isUrl);
const currency = S(b.currency).trim().toUpperCase();
if (currency && !/^[A-Z]{3}$/.test(currency)) errors.push('currency must be an ISO code such as AED or USD');
const facts = S(b.business_facts);
if (facts.length > LIM.facts_chars) errors.push('business_facts is longer than ' + LIM.facts_chars + ' characters');
const aiq = S(b.ai_question).trim();
const fanout = arr(b.ai_fanout, 'ai_fanout', 12).map(S).map(x => x.trim()).filter(Boolean);
const pageType = S(b.page_type).trim() || 'Blog Post / Guide';

// what the page is measured against, as a content run would hold it
const withoutMeta = markdown.replace(/^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):.*$/gm, '');
const faqStart = withoutMeta.search(/^## (Frequently Asked Questions|FAQs?)/im);
const afterFaq = faqStart >= 0 ? withoutMeta.slice(faqStart + 5).search(/^## /m) : -1;
const faqPart = faqStart >= 0 ? withoutMeta.slice(faqStart, afterFaq >= 0 ? faqStart + 5 + afterFaq : undefined) : '';
const ownWords = withoutMeta.replace(faqPart, '').split(/\s+/).filter(Boolean).length;
// the coverage target, by the kit's own rules (CVG.best / target / subtopics), the way Parse Analysis builds it for a content run
let coverage_target = null;
if (terms.length && competitors.length) {
  const kind = CVG.kindFor(pageType);
  const bc = CVG.best(competitors, terms, { kind, keyword });
  if (bc && bc.coverage_pct != null) coverage_target = { terms_total: bc.terms_total, terms: terms.map(t => t.term),
    best: { domain: bc.domain, url: bc.url, rank: bc.rank, coverage_pct: bc.coverage_pct, terms_used: bc.terms_used, word_count: bc.word_count, sections: bc.sections, kind: bc.kind },
    page_kind: kind, type_match: bc.type_match, measure: 'presence', average_pct: bc.average_pct, pages_compared: bc.pages_compared, target_pct: CVG.target(bc.coverage_pct),
    subtopics: bc.type_match === false ? [] : CVG.subtopics(competitors.find(c => c.url === bc.url) || null, 12, { labels: fitLabels, keyword, brands: competitors.map(c => c.domain || c.url).filter(Boolean) }) };   // A-16; D5 (2026-10-21): only from a page of the kind being checked
}
// links to the site's own pages: only what the caller listed is a real page; with no list, the links the page itself makes are trusted
// (and the verdict says they were not verified), so the check never strips a link it cannot judge
const ownLinks = domain ? [...markdown.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].map(m => m[1]).filter(u => u.startsWith('/') || hostOf(u) === domain || hostOf(u).endsWith('.' + domain)).map(u => u.startsWith('/') ? SM.siteUrl({ domain }, u) : u) : [];   // the same URL Content QA builds for a relative link (SM.siteUrl)

const ok = errors.length === 0;
return [{ json: {
  ok, errors, error: errors.join('; '),
  output: markdown, critique: null,
  keyword, domain, country: S(b.country).trim(), currency, page_type: pageType, page_role: 'standard', article_like: false,
  business: '', business_facts: facts.slice(0, LIM.facts_chars), case_facts_text: '',
  facts: sources.map(s => ({ url: s.url, text: s.text, claim: '' })),
  term_model: [], coverage_target, competitors,
  content_brief: { target_word_count: tw || ownWords, outline: [], terms_to_use: terms, evidence_plan: [], snippet_targets: [], secondary_keywords: [] },
  internal_link_candidates: internal.map(u => ({ url: u })), site_urls: internal.length ? internal : ownLinks, planned_link_targets: [], hub_pages: [],
  existing_page: null, ladder_id: '', author: null, reviewer: null, site_profile: null, site_description: null, video: null, style_guide: null,
  ai_target: aiq ? { question: aiq, fanout } : null, qa_max_rounds: 1, originality_max_overlap_pct: 15, client_pages: [],
  publish_check: { target_words_given: tw != null, terms_given: terms.length, competitors_given: competitors.length, sources_given: sources.length,
    internal_links_given: internal.length, own_links_in_page: ownLinks.length, domain_given: !!domain, ai_question_given: !!aiq }
} }];
