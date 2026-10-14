// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

const prev = $('Merge Keyword Data').first().json;
const verdict = parseAgentJson($input.first().json.output);

// ---- the page type, as one of the options the form offers (D10, 2026-10-12; the builders inline this file where a node asks for the PAGE_TYPE kit) ----
// The verdict and the keyword screen answer in free text: the live page of execution 365 was planned as "Service Page (ERP implementation
// UAE) with built-in vendor-neutral comparison, cost and compliance sections". That sentence then travelled as the page type into the brief
// (which read it as a guide and set 3,100 words), into the schema and into meta.json. PT.of() maps any such text to one of the fixed options
// and PT.notes() keeps the sentence itself, so nothing the verdict said is lost — it reaches the brief as page_notes instead.
const PT = (() => {
  const TYPES = ['Service Page', 'Product Page', 'Blog Post', 'Landing Page', 'Guide', 'Pillar Page', 'Local Page', 'Case Study'];
  // first match wins by POSITION in the text, not by rule order: "Service Page (…) with built-in vendor-neutral comparison" is a service
  // page that also compares, not a comparison guide.
  const RULES = [[/case stud/i, 'Case Study'], [/\bpillar\b|\bhub\b|topic cluster/i, 'Pillar Page'], [/\blocal\b|city page|area page/i, 'Local Page'],
    [/\bproducts?\b|e-?commerce|\bshop\b|\bstore\b|catalou?g/i, 'Product Page'], [/landing|lead capture|campaign page|squeeze/i, 'Landing Page'],
    [/\bblogs?\b|\bnews\b|\barticles?\b|\bposts?\b/i, 'Blog Post'],
    [/\bguides?\b|how.?to|tutorial|comparison|compare|versus|\bvs\b|\bfaqs?\b|resource|checklist|listicle|round.?up|explainer|glossary/i, 'Guide'],
    [/\bservices?\b|solution|category|collection|offering/i, 'Service Page']];
  const of = (v, dflt) => {
    const t = String(v == null ? '' : v).trim();
    const fallback = TYPES.find(x => x.toLowerCase() === String(dflt || '').trim().toLowerCase()) || 'Service Page';
    if (!t) return fallback;
    const exact = TYPES.find(x => x.toLowerCase() === t.toLowerCase());
    if (exact) return exact;
    let best = null;
    for (const r of RULES) { const i = t.search(r[0]); if (i >= 0 && (!best || i < best.i)) best = { i: i, type: r[1] }; }
    return best ? best.type : fallback;
  };
  // the free text, kept for the brief; empty when it says nothing beyond the type itself (the form's own wording included)
  const SAME = ['pillar / hub page', 'pillar/hub page', 'hub page', 'local page (city or area)', 'case study page'];
  const notes = (v, type) => {
    const t = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    if (!t) return '';
    const bare = t.replace(/[.\s]+$/, '').toLowerCase();
    if (bare === String(type || '').toLowerCase() || TYPES.some(x => x.toLowerCase() === bare) || SAME.indexOf(bare) >= 0) return '';
    return t.slice(0, 300);
  };
  return { of: of, notes: notes, TYPES: TYPES };
})();
// 2026-10-12 (FIX_PLAN D10): the verdict answers in free text; the fixed option decides the length band, the schema and
// meta.json, and the sentence itself travels on as page_notes so the brief still hears what the verdict asked for.
const allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];
if (!allowed.includes(verdict.verdict)) verdict.verdict = 'GO_WITH_CHANGES';

// ---- a keyword the site already has a page for (P2-5, 2026-10-12; inlined into the v3 node *Parse Verdict* by build_v4.py section 39) ----
// Run 444 asked for a verdict on "uae e invoicing penalties" — a search the site's own /insights/…-uae-e-invoicing-penalties-… page has
// answered since 2026-08-21 — and the answer was "Build an informational penalty guide", recommended_page "Guide": the owner was told to
// create a second URL for a search their page already answers (the exact D11 harm). *Collect Client Pages* now sets `existing_page` from
// the page inventory (SM.matchPage) and `v5/prompts/verdict.txt` forbids a new page; this is the deterministic half of it.
// ---- R7 (2026-10-13, re-rating): no verdict may ask for FAQPage schema (G2 removed it from everything we write) ----
// Live: exec 486 `verdict_changes[3]` said "add … an FAQ with schema matching the People Also Ask questions" and the ladder's exec 495
// `what_must_change[3]` said "Add an FAQ section that mirrors the People Also Ask questions, with FAQ and Service schema". Google stopped
// showing FAQ rich results on 2026-05-07, so the owner would spend time on markup that shows nothing. The prompt now forbids it; this
// rewrites the schema part out of any line that still asks for it and keeps the FAQ *section*, which is what AI assistants quote.
const FAQ_SCHEMA_RE = /\b(?:faq\s*page|faqpage)\b(?:\s+(?:schema|markup|structured\s+data))?|\bfaq\b[^.;]{0,20}?\b(?:schema|markup|structured\s+data)\b|\b(?:schema|markup|structured\s+data)\b[^.;]{0,20}?\bfaq\b/gi;
const noFaqSchema = (line) => {
  let t = String(line == null ? '' : line);
  if (!FAQ_SCHEMA_RE.test(t)) return t;
  FAQ_SCHEMA_RE.lastIndex = 0;
  t = t.replace(/\b(an?\s+)?FAQ\s+with\s+(?:its\s+own\s+)?(?:schema|markup|structured data)\b/gi, '$1FAQ section (question headings answered directly)')
       .replace(/\bwith\s+FAQ\s+and\s+([A-Z][A-Za-z]*)\s+schema\b/g, 'with $1 schema')
       .replace(/\bFAQ\s+and\s+([A-Z][A-Za-z]*)\s+schema\b/g, '$1 schema')
       .replace(/\b(?:an?\s+)?FAQ\s*(?:page)?\s+(?:schema|markup|structured data)\b/gi, 'an FAQ section (question headings answered directly)')
       .replace(/\bFAQPage\b/gi, 'an FAQ section (question headings answered directly)')
       .replace(/\bwith\s+(?:FAQ|FAQPage)\s+(?:schema|markup|structured data)\b/gi, '')
       .replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').replace(/,\s*\./g, '.').trim();
  return t;
};
verdict.risks = (Array.isArray(verdict.risks) ? verdict.risks : []).map(noFaqSchema);
verdict.reasons = (Array.isArray(verdict.reasons) ? verdict.reasons : []).map(noFaqSchema);

const EXP = (prev.existing_page && prev.existing_page.url) ? prev.existing_page : null;
let verdict_changes = Array.isArray(verdict.what_must_change) ? verdict.what_must_change.map(x => noFaqSchema(x)).filter(Boolean) : [];   // R7: never FAQPage schema
let existing_page_action = null;
if (EXP) {
  existing_page_action = 'improve';
  // a line that explicitly asks for a SECOND URL is dropped; a line that asks for work ("Build an informational penalty guide of about
  // 1,800 words …", the live answer of run 444) is kept but addressed to the page that exists, so no advice and no word target is lost.
  const NEW_URL_RE = /\b(?:new|second|separate|dedicated|additional|another|standalone|stand-alone)\s+(?:page|url|post|article)\b|\b(?:publish|create|build|launch|spin up)\s+an?\s+(?:new\s+)?(?:page|url)\b/i;
  const CREATE_RE = /^(?:please\s+)?(?:build|create|write|publish|launch|produce|develop|make|add|set up)\b/i;
  const WORDS_RE = /\b(\d[\d,]{2,5})\s*words?\b/i;
  const dropped = verdict_changes.filter(c => NEW_URL_RE.test(c));
  verdict_changes = verdict_changes.filter(c => !NEW_URL_RE.test(c))
    .map(c => CREATE_RE.test(c) ? c.replace(CREATE_RE, (m) => 'On that page, ' + m.toLowerCase()) : c);
  // the length the verdict asked for is the brief's clamp (D10): never lose it with the line that happened to carry it
  const lostWords = dropped.map(c => (c.match(WORDS_RE) || [])[1]).filter(Boolean)[0];
  if (lostWords && !verdict_changes.some(c => WORDS_RE.test(c))) verdict_changes.push('Aim for about ' + lostWords + ' words on that page.');
  verdict_changes.unshift('Improve the page the site already has for this search (' + EXP.url + '): update and expand it, keep its URL, and do not publish a second page for this keyword.');
}

return [{
  json: {
    ...prev,
    verdict: verdict.verdict,
    verdict_score: verdict.score ?? null,
    verdict_reasons: verdict.reasons || [],
    verdict_risks: verdict.risks || [],
    recommended_page: PT.of(verdict.recommended_page || prev.page_type, prev.page_type),
    page_notes: PT.notes(verdict.recommended_page, PT.of(verdict.recommended_page || prev.page_type, prev.page_type)),
    secondary_keywords: verdict.secondary_keywords || [],
    verdict_changes,
    existing_page_action,
    expected_visits_top3: verdict.expected_monthly_visits_top3 ?? null,
    time_to_rank_months: verdict.time_to_rank_months ?? null
  }
}];