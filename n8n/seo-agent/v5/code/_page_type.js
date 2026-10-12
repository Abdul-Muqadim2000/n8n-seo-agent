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
