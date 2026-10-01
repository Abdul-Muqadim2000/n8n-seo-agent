// Starts one content run (mode "keyword") per page in write_now, as separate executions through API Entry.
// Each run delivers its own PDF/Word by e-mail and/or callback, tagged with the ladder id and rung.
const d = $input.first().json; const L = d.ladder || {};
const GOAL = { leads: 'Get leads and enquiries', sales: 'Sell online', traffic: 'Rank and educate (traffic)', brand: 'Build the brand' };
const n = Math.min(3, Math.max(1, Number(d.pages_now) || 1));
return (L.write_now || []).slice(0, n).map(p => ({ json: { body: {
  mode: 'keyword', keyword: p.keyword, page_type: p.page_type || 'Service Page', country: d.country, domain: d.domain,
  business: d.business || '', customers: d.audience || '', business_facts: d.business_facts || '', cta: d.cta || '', tone: d.tone || '', goal: GOAL[d.goal] || d.goal || '',
  receive: ['Keyword Report', 'Page Content'], existing_page_url: p.exists ? p.target_url : '',
  email: d.email || '', callback_url: d.callback_url || '', request_id: d.request_id || '', client_ip: 'ladder:' + (L.ladder_id || ''),
  force_content: true, ladder_id: L.ladder_id || '', ladder_rung: p.rung, ladder_head: (L.head || {}).keyword || d.keyword, ladder_page_no: p.page_no,
  ladder_links: (p.links_to || []).map(l => ({ url: l.url, path: String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/', role: l.role, keyword: l.keyword, planned: true })),
  wordpress_url: d.wordpress_url || ''
} } }));
