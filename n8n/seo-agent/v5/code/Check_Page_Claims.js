// R38 / R48 (2026-10-16): the analyzer's claims about the CLIENT'S OWN page are checked against what was measured on that page before the
// verdict, the brief and the report read them. The analyzer now sees the page's facts (Collect Client Pages: dates in the text, tables,
// byline, publication date, call to action from the page's own HTML), so it should not make a false absence claim any more; this node is the
// deterministic half - a gap the digest contradicts, or that the digest says could not be checked, is removed and recorded, never repeated
// to the customer as a fact. Also: an ASP "accredited by the FTA" becomes the Ministry of Finance's accreditation (R48).
/*__PAGE_CLAIMS__*/
const item = $input.first().json || {};
const analysis = item.competitor_analysis && typeof item.competitor_analysis === 'object' ? item.competitor_analysis : null;
if (!analysis) return [{ json: item }];
const digest = item.existing_page_digest || null;
let dropped = [];
const out = { ...analysis };
if (digest && Array.isArray(analysis.existing_page_gaps)) {
  const r = PC.filterLines(analysis.existing_page_gaps, digest, { scoped: true });
  out.existing_page_gaps = r.lines;
  dropped = r.dropped;
}
const deep = (x) => typeof x === 'string' ? PC.fta(x) : Array.isArray(x) ? x.map(deep) : (x && typeof x === 'object') ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, deep(v)])) : x;
return [{ json: { ...item, competitor_analysis: deep(out), page_claims_dropped: dropped } }];
