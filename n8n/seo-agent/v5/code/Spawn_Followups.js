// Discover mode: the extras the user ticked (keyword report / page content for the chosen keyword, site audit or full
// report) run as SEPARATE executions through API Entry. A form completion page ends the execution it is in, so the
// download page can only be the last step; API callers still get one callback per stage with the same request_id.
const d = $input.first().json;
const GOAL = { leads: 'Get leads and enquiries', sales: 'Sell online', traffic: 'Rank and educate (traffic)', brand: 'Build the brand' };
const common = { country: d.country, domain: d.domain || '', business: d.business || '', customers: d.audience || '', business_facts: d.business_facts || '', cta: d.cta || '', tone: d.tone || '',
  goal: GOAL[d.goal] || d.goal || '', email: d.email || '', callback_url: d.callback_url || '', request_id: d.request_id || $execution.id, client_ip: 'discover:' + $execution.id };
const out = [];
if (d.include_content || d.include_seo_report) {
  const ks = d.keyword_suggestions || {};
  const pick = (ks.recommended || [])[0] || (ks.easy_wins || [])[0] || null;
  if (pick && pick.keyword) {
    const intent = pick.intent || 'commercial';
    const receive = []; if (d.include_seo_report) receive.push('Keyword Report'); if (d.include_content) receive.push('Page Content');
    out.push({ json: { body: { mode: 'keyword', keyword: pick.keyword, page_type: pick.page_type || (intent === 'informational' ? 'Blog Post' : 'Service Page'), ...common, receive,
      chosen_keyword_reason: pick.why || pick.reason || ('Highest-scoring ' + intent + ' keyword from the research'), chosen_by: d.chosen_by || 'system', pipeline_source: 'discover' } } });
  }
}
if (d.include_audit) out.push({ json: { body: { mode: 'audit', report_type: d.include_full_report ? 'Full SEO Report' : 'Site Audit (technical issues only)', competitors: (d.competitors || []).join(', '), ...common } } });
return out;
