// ---- FA: the client's answers to the questions on written pages, kept once per website (H3, 2026-10-28; inlined through the FACT_ANSWERS marker) ----
// The page pipeline (H1, v5/code/_page_fix.js PF.questions) asks the client about every statement nothing on file supports, keyed by a
// business-fact key (`fact_key`, e.g. "credential.microsoft_partner"). The app stores each answer ONCE on the website (app: sites.fact_answers;
// engine: seo_sites.fact_answers_json, written by Site Admin `facts`) and every later page run carries:
//   business_facts_kv   fact_key -> the text the client confirmed or wrote (decisions yes / edit / answer): the claim check reads it as on file
//   stored_fact_keys    every key the client decided, including remove and general: PF.questions never asks it again
// The same rule as the app's factsForEngine (app/shared/src/page-review.ts): the two must change together.
// Pure: no clock, no network, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const FA = (() => {
  const KEY = /^[\p{L}\p{N}_.&-]{1,80}$/u;
  const DECISIONS = ['yes', 'edit', 'answer', 'remove', 'general'];
  const TEXT_MAX = 600, KV_MAX = 200, KEYS_MAX = 400;
  const S = (v) => String(v == null ? '' : v);
  const clean = (t) => S(t).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  const asObj = (raw) => { let o = raw; if (typeof o === 'string') { try { o = JSON.parse(o || '{}'); } catch (e) { o = null; } }
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null; };
  // { key: { decision, text } } from the stored JSON (or an object); entries with a bad key or decision are dropped and counted
  const parse = (raw) => { const o = asObj(raw); const answers = {}; let dropped = 0; if (!o) return { answers, dropped };
    for (const [k, v] of Object.entries(o).slice(0, KEYS_MAX)) {
      const decision = v && typeof v === 'object' ? S(v.decision).toLowerCase() : 'yes';
      const text = clean(v && typeof v === 'object' ? v.text : v).slice(0, TEXT_MAX);
      if (!KEY.test(k) || !DECISIONS.includes(decision) || ((decision === 'yes' || decision === 'edit' || decision === 'answer') && !text)) { dropped++; continue; }
      answers[k] = { decision, text: decision === 'remove' || decision === 'general' ? '' : text }; }
    return { answers, dropped }; };
  // the facts a page may state, and every decided key
  const kv = (answers) => { const out = {}; for (const [k, v] of Object.entries(answers || {})) if (v && v.text && (v.decision === 'yes' || v.decision === 'edit' || v.decision === 'answer')) out[k] = v.text; return out; };
  const keys = (answers) => Object.keys(answers || {}).filter(k => KEY.test(k)).sort().slice(0, KEYS_MAX);
  // what a request carries (Normalize Input): validated and capped; a malformed value is an empty one, never an error for the whole run
  const kvIn = (raw) => { const o = asObj(raw); const out = {}; if (!o) return out; let n = 0;
    for (const [k, v] of Object.entries(o)) { if (n >= KV_MAX) break; const t = clean(v).slice(0, TEXT_MAX); if (!KEY.test(k) || !t || typeof v === 'object') continue; out[k] = t; n++; }
    return out; };
  const keysIn = (raw) => { const a = Array.isArray(raw) ? raw : typeof raw === 'string' && raw.trim() ? raw.split(/[,\n]/) : [];
    return [...new Set(a.map(x => clean(x)).filter(k => KEY.test(k)))].slice(0, KEYS_MAX); };
  // the two fields a page run spawned from a stored website row carries
  const forRun = (siteRow) => { const a = parse(siteRow && siteRow.fact_answers_json).answers; return { business_facts_kv: kv(a), stored_fact_keys: keys(a) }; };
  // the stored facts as text, one per line, for the claim corpus
  const text = (kvObj) => Object.values(kvObj || {}).map(clean).filter(Boolean).join('\n');
  return { KEY, DECISIONS, TEXT_MAX, parse, kv, keys, kvIn, keysIn, forRun, text, clean };
})();
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
const page = (head ? head + '\n\n' : '') + markdown.replace(/^\n+/, '');
const withoutMeta = page.split('\n').filter(l => !META.test(l.trim())).join('\n');
const ownWords = withoutMeta.split(/\s+/).filter(Boolean).length;
const ownLinks = [...page.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]).filter(u => { const h = (u.match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i) || [])[1] || ''; const x = h.toLowerCase().replace(/^www\./, ''); return x === domain || x.endsWith('.' + domain); });
const pageType = S(b.page_type).trim() || 'Blog Post / Guide';

const ok = errors.length === 0;
return [{ json: {
  ok, errors, error: errors.join('; '),
  output: page, critique: null, had_meta,
  keyword, domain, country: S(b.country).trim(), currency: '', page_type: pageType, page_role: 'standard', article_like: false,
  business: '', business_facts: businessFacts, case_facts_text: '', business_facts_kv: kv, stored_fact_keys: stored,
  facts: [], term_model: [], coverage_target: null, competitors: [],
  content_brief: { target_word_count: ownWords, outline: [], terms_to_use: [], evidence_plan: [], snippet_targets: [], secondary_keywords: [], questions_for_client: [] },
  internal_link_candidates: ownLinks.map(u => ({ url: u })), site_urls: ownLinks, planned_link_targets: [], hub_pages: [],
  existing_page: null, existing_page_ours: false, ladder_id: '', author: null, reviewer: null, site_profile: null, site_description: null, video: null, style_guide: null,
  ai_target: null, qa_max_rounds: 1, originality_max_overlap_pct: 15, client_pages: [],
  request_id: S(b.request_id).slice(0, 120), content_request_id: S(b.content_request_id).slice(0, 120), site_id: S(b.site_id).slice(0, 120),
  finalize: { answers, client_edited, client_sentences, delivered_markdown: delivered, input_markdown: markdown, answer_texts: answerTexts, stored_keys: stored,
    answered_keys: answers.filter(a => a.decision !== 'skip' && a.fact_key).map(a => a.fact_key) }
} }];
