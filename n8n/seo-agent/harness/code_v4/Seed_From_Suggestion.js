// Discover mode: the user also asked for a keyword report and/or page content.
// Take the best recommended keyword and run the full keyword pipeline for it.
const d = $input.first().json;
const ks = d.keyword_suggestions || {};
const pick = (ks.recommended || [])[0] || (ks.easy_wins || [])[0] || null;
if (!pick || !pick.keyword) throw new Error('No keyword with search volume was found to build content for.');

const intent = pick.intent || 'commercial';
const page_type = pick.page_type || (intent === 'informational' ? 'Blog Post' : 'Service Page');

return [{
  json: {
    ...d,
    keyword: pick.keyword,
    page_type,
    pipeline_source: 'discover',
    chosen_keyword_reason: pick.why || ('Highest-scoring ' + intent + ' keyword from the research'),
    result_html: undefined,
    file_name: undefined
  }
}];
