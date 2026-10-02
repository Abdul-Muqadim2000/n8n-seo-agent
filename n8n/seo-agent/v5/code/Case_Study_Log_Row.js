// The content-log row for the case-study page (status started), so "I published a page" finds it by keyword or request id.
const r = $('Case Study Row').first().json;
return [{ json: { site_id: r.site_id, domain: r.domain, keyword: r.keyword, source: 'case_study', page_type: 'Case Study', existing_page_url: '', rung: 0, ladder_id: '', request_id: r.request_id,
  started_at: r.created_at, status: 'started', published_url: '', published_at: '', week: r.created_at.slice(0, 10) } }];
