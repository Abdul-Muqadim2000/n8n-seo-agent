// Verified facts: statistics from a second live search ("<keyword> statistics <year>"), kept only with their source URL,
// so the writer can cite real numbers instead of inventing them or hiding behind [Statistic].
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
  facts.push({ claim: snippet.slice(0, 300), source: dom, url: it.url, title: String(it.title || '').slice(0, 120), authority: (AUTH.test(dom) || AUTH.test(it.url || '')) ? 'high' : 'medium', year: (snippet.match(/\b(20[12]\d)\b/) || [])[1] || null });
}
facts.sort((a, b) => (b.authority === 'high') - (a.authority === 'high') || (b.year || 0) - (a.year || 0));
const known = new Set((prev.serp_features || {}).people_also_ask || []);
return [{ json: { ...prev, facts: facts.slice(0, 10), facts_found: facts.length,
  facts_note: 'Search snippets with their source URL. A figure may be quoted only as written and only with its source link.',
  extra_questions: paa.filter(q => !known.has(q)).slice(0, 8) } }];
