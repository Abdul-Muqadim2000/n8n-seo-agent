// "Write a case study" (v4.4): the intake becomes one row of seo_case_studies — the proof library that every later page for the site may cite —
// and the case-study page itself is written as its own content run (Spawn Case Study Run -> API Entry), logged in seo_content_log.
const d = $('Normalize Input').first().json; const cs = d.case_study || {};
const site_id = 'site_' + String(d.domain || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const now = new Date().toISOString(); const s = (v) => String(v == null ? '' : v).trim();
const who = cs.client_public === false ? ('A ' + (s(cs.industry) ? s(cs.industry) + ' business' : 'client') + (s(cs.location) ? ' in ' + s(cs.location) : '')) : (s(cs.client_name) || 'Client');
return [{ json: { case_id: d.case_id, site_id, domain: d.domain, keyword: d.keyword, title: (who + ': ' + (s(cs.service) || d.keyword)).slice(0, 200), client_name: s(cs.client_name), client_public: cs.client_public !== false,
  industry: s(cs.industry), location: s(cs.location), service: s(cs.service), challenge: s(cs.challenge), solution: s(cs.solution), timeline: s(cs.timeline), results: s(cs.results), quote: s(cs.quote), quote_by: s(cs.quote_by),
  page_url: '', status: 'writing', created_at: now, request_id: d.request_id || $execution.id } }];
