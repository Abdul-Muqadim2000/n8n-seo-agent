// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

// D22 (2026-10-11): the description is written from the homepage AND the menu pages that were read (Site Pages). What those pages say stays
// with it — the pages read, the site's own menu links and the headings the critic may not call invented — and goes into the 30-day seo_cache
// row, where `pages_read` also marks the description as written by this version (an older, homepage-only row is read again).
let prev; try { prev = $('Site Pages').first().json; } catch (e) { prev = $('Clean Site Text').first().json; }
const desc = parseAgentJson($input.first().json.output);
const homeUrl = 'https://' + String(prev.domain || '').replace(/^https?:\/\//, '');
desc.pages_read = (prev.site_pages && prev.site_pages.length ? prev.site_pages : [{ url: homeUrl, title: prev.page_title || '', kind: 'homepage' }])
  .map(p => ({ url: p.url, title: String(p.title || '').slice(0, 120), kind: p.kind || 'page' })).slice(0, 8);
desc.nav_pages = (prev.nav_pages || []).slice(0, 12).map(p => ({ url: p.url, text: String(p.text || '').slice(0, 80) }));
desc.site_facts = [...new Set([...(desc.products_or_services || []), ...(desc.unique_selling_points || []), ...(prev.site_facts || [])]
  .map(x => String(x == null ? '' : x).trim()).filter(x => x.length >= 3))].slice(0, 50).map(x => x.slice(0, 120));

return [{
  json: {
    ...prev,
    site_text: undefined,   // lamba text aage nahi chahiye
    pages_text: undefined, site_pages: undefined, site_facts: undefined, nav_pages: undefined,   // D22: kept inside site_description
    site_description: desc,
    business: prev.business || desc.business_description,
    audience: prev.audience || (desc.target_audience || []).join(', ')
  }
}];