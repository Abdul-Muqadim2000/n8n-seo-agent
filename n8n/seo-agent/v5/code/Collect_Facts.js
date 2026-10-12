/*__SOURCES__*/
// Verified facts: statistics from a second live search ("<keyword> statistics <year>"), kept only with their source URL,
// so the writer can cite real numbers instead of inventing them or hiding behind [Statistic].
// 2026-10-11 (FIX_PLAN G4): the URL is stored without its tracking parameters (a Statista link kept `?srsltid=` live), the source's
// quality is recorded (primary / research / press / vendor documentation / weak), and `text` keeps everything we actually read from the
// source — the snippet plus its title — because Content QA later looks up every figure of the draft in exactly that text.
const prev = $('Clean Competitor Pages').first().json;
const res = $input.first().json || {};
const items = res.tasks?.[0]?.result?.[0]?.items || [];
const AUTH = /\.(gov|edu|int|mil)(\.|$)|\b(statista|gartner|forrester|idc\.com|mckinsey|deloitte|pwc|kpmg|ey\.com|accenture|bcg\.com|bain\.com|hbr\.org|forbes|reuters|bloomberg|bbc|nytimes|economist|ft\.com|who\.int|oecd|worldbank|imf\.org|un\.org|europa\.eu|ibisworld|grandviewresearch|marketsandmarkets|mordorintelligence|techtarget|g2\.com|capterra|clutch\.co|semrush|ahrefs|hubspot|salesforce|microsoft|google|adobe|zendesk|shopify|stripe|nielsen|pewresearch|census|gov\.uk|nhs\.uk)\b/i;
const facts = [], paa = [];
for (const it of items) {
  if (it.type === 'people_also_ask') { (it.items || []).forEach(q => { const t = q.title || q.question; if (t) paa.push(t); }); continue; }
  if (it.type !== 'organic') continue;
  const snippet = String(it.description || '').replace(/\s+/g, ' ').trim();
  if (!/\d/.test(snippet) || snippet.length < 40) continue;
  const dom = String(it.domain || '').replace(/^www\./, '');
  if (/(^|\.)(youtube|linkedin|facebook|reddit|quora|medium|pinterest|tiktok|instagram|x|twitter|slideshare|scribd|coursera|udemy)\.(com|org|net)$/.test(dom)) continue;   // social/video: not citable sources
  const url = SRC.clean(String(it.url || ''));
  const title = String(it.title || '').slice(0, 120);
  facts.push({ claim: snippet.slice(0, 300), text: (title + ' — ' + snippet).slice(0, 700), source: dom, url, title,
    authority: (AUTH.test(dom) || AUTH.test(url)) ? 'high' : 'medium', tier: SRC.tier(url), year: (snippet.match(/\b(20[12]\d)\b/) || [])[1] || null });
}
facts.sort((a, b) => (b.authority === 'high') - (a.authority === 'high') || (b.year || 0) - (a.year || 0));
// at most one weak source per domain reaches the writer: a vendor or agency blog cited three times was the live defect (exec 365)
const weakSeen = new Set();
const kept = facts.filter(f => { if (f.tier !== 'weak') return true; if (weakSeen.has(f.source)) return false; weakSeen.add(f.source); return true; });
const known = new Set((prev.serp_features || {}).people_also_ask || []);
return [{ json: { ...prev, facts: kept.slice(0, 10), facts_found: facts.length,
  facts_note: 'Search snippets with their source URL. A figure may be quoted only as written and only with its source link: every figure in the draft is looked up in this text, and one that is not here is marked [Confirm: …] for review.',
  extra_questions: paa.filter(q => !known.has(q)).slice(0, 8) } }];
