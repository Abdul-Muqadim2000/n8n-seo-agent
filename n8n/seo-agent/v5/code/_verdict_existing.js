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
