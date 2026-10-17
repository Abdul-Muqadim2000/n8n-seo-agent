// Starts one content run (mode "keyword") per page in write_now, as separate executions through API Entry.
// Each run delivers its own PDF/Word by e-mail and/or callback, tagged with the ladder id and rung.
const d = $input.first().json; const L = d.ladder || {};
const GOAL = { leads: 'Get leads and enquiries', sales: 'Sell online', traffic: 'Rank and educate (traffic)', brand: 'Build the brand' };
const n = Math.min(3, Math.max(1, Number(d.pages_now) || 1));
// F-A1 / A-21 (2026-10-17): the main page's run reads the head keyword's results page again; it is told what THIS run measured, so it can
// say that it re-measured and why its number moved (Parse Verdict, v5/code/_remeasure.js) instead of printing a second score silently
const headKw = String((L.head || {}).keyword || d.keyword || '').toLowerCase().trim();
// the ladder report slims serp_features out of its item, so the reading is taken from *Ladder Plan*, which carries the run's own
const sfL = (() => { try { return ($('Ladder Plan').first().json || {}).serp_features || d.serp_features || {}; } catch (e) { return d.serp_features || {}; } })();
const measureOf = (p) => String(p.keyword || '').toLowerCase().trim() !== headKw || (L.feasibility || {}).scored === false ? null : {
  keyword: headKw, score: (L.feasibility || {}).score ?? d.verdict_score ?? null, checked_at: String(sfL.checked_at || ((sfL.ai_overview || {}).seen_at) || ''),
  ai_overview: ((sfL.ai_overview || {}).present) === true, features: Array.isArray(sfL.features_present) ? sfL.features_present.slice(0, 12) : [] };
return (L.write_now || []).slice(0, n).map(p => ({ json: { body: {
  mode: 'keyword', keyword: p.keyword, page_type: p.page_type || 'Service Page', country: d.country, domain: d.domain,
  business: d.business || '', customers: d.audience || '', business_facts: d.business_facts || '', cta: d.cta || '', tone: d.tone || '', goal: GOAL[d.goal] || d.goal || '',
  receive: ['Keyword Report', 'Page Content'], existing_page_url: p.exists ? p.target_url : '',
  email: d.email || '', callback_url: d.callback_url || '', request_id: d.request_id || '', client_ip: 'ladder:' + (L.ladder_id || ''),
  force_content: true, ladder_id: L.ladder_id || '', ladder_rung: p.rung, ladder_head: (L.head || {}).keyword || d.keyword, ladder_page_no: p.page_no,
  ladder_words: Number(p.target_words) || 0,   // P2-7: the verdict's own word target travels with the page run (Parse Brief clamps to it)
  ladder_target_url: p.target_url || '',       // R15: the URL this ladder planned for the page — the page keeps it as its slug
  ladder_links: (p.links_to || []).map(l => ({ url: l.url, path: String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/', role: l.role, keyword: l.keyword, planned: true })),
  wordpress_url: d.wordpress_url || '',
  ladder_measure: measureOf(p)                 // A-21: what the ladder measured for this keyword, when this page IS the ladder's main keyword
} } }));
