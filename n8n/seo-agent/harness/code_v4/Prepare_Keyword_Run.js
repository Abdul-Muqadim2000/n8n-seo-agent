// Single entry point for the keyword pipeline (SERP -> competitors -> brief -> content).
// Reached from Route Mode (keyword mode) or from the Discover fork (top suggested keyword).
const d = $input.first().json;
const keyword = String(d.keyword || '').trim().toLowerCase().replace(/\s+/g, ' ');
if (!keyword) throw new Error('No keyword available for the content pipeline.');
if (!d.location_code) throw new Error('No target country available for the content pipeline.');

return [{
  json: {
    ...d,
    keyword,
    page_type: d.page_type || 'Service Page',
    pipeline_source: d.pipeline_source || (d.mode === 'discover' ? 'discover' : d.mode === 'ladder' ? 'ladder' : (d.ladder_id ? 'ladder_page' : 'form')),
    site_text: undefined,
    competitor_digest: undefined
  }
}];
