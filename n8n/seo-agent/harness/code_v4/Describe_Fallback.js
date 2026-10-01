// The homepage could not be read (blocked, timeout, empty). Do not call the LLM with nothing; carry on with what the user typed.
const prev = $input.first().json;
const nc = 'Not clear from website';
return [{ json: {
  ...prev,
  site_text: undefined,
  site_read_failed: true,
  site_description: {
    business_name: prev.domain, one_line_summary: 'The website could not be read automatically', business_description: prev.business || nc,
    industry: nc, products_or_services: [], target_audience: prev.audience ? [prev.audience] : [], unique_selling_points: [], location_served: prev.country || nc,
    tone_of_brand: nc, suggested_meta_title: '', suggested_meta_description: '', seed_keywords: []
  },
  business: prev.business || '',
  audience: prev.audience || ''
} }];