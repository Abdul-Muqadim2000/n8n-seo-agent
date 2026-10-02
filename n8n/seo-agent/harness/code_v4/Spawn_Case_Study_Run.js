// Starts the case-study page as a content run (mode keyword, page type Case Study, force_content) in its own execution through API Entry:
// a form completion page ends the execution it is in, and the run takes 10-15 minutes. Internal key "casestudy:" = not charged to the owner's daily runs.
const d = $('Normalize Input').first().json; const r = $('Case Study Row').first().json;
const GOAL = { leads: 'Get leads and enquiries', sales: 'Sell online', traffic: 'Rank and educate (traffic)', brand: 'Build the brand' };
return [{ json: { body: { mode: 'keyword', keyword: r.keyword, page_type: 'Case Study', country: d.country, domain: d.domain, business: d.business || '', customers: d.audience || '', business_facts: d.business_facts || '',
  cta: d.cta || '', tone: d.tone || '', goal: GOAL[d.goal] || '', receive: ['Keyword Report', 'Page Content'], email: d.email || '', callback_url: d.callback_url || '', request_id: r.request_id,
  client_ip: 'casestudy:' + r.site_id, force_content: true, case_id: r.case_id, case_study: d.case_study || {}, wordpress_url: d.wordpress_url || '' } } }];
