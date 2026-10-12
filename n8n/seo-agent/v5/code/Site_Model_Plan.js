// G19 (2026-10-12): the on-demand resolver, step 1 (SITE_MODEL_SPEC.md §4) — is there a site model younger than SM.FRESH_DAYS for this
// domain? The weekly Site Tracker writes it to seo_sites; a run that rebuilt it keeps a copy in seo_cache ('model:<site_id>'). Fresh =
// nothing to do; stale or missing = read the homepage once (plain GET, redirects followed) for the canonical host, the Organization /
// LocalBusiness schema and the nav pages.
/*__SITE_MODEL__*/
const req = $('Use Cached Description').first().json;
const rowsOf = (nm) => { try { return $(nm).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const domain = String(req.domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const site_id = 'site_' + domain.replace(/[^a-z0-9]+/g, '-');
if (!domain) return [{ json: { skip: true, reason: 'no website in this request', site_id: '', domain: '' } }];
const row = rowsOf('Load Site Row (Model)').find(r => r.site_id === site_id) || {};
const cached = (() => { const c = rowsOf('Load Site Cache').find(r => r.key === 'model:' + site_id); if (!c) return null;
  try { const v = JSON.parse(c.value || 'null'); return (v && typeof v === 'object') ? { ...v, model_updated_at: c.updated_at || v.model_updated_at } : null; } catch (e) { return null; } })();   // the cache row's own timestamp decides the age, not the value's
const stored = SM.stored(row) || SM.stored(cached || {});
if (SM.isFresh(stored)) return [{ json: { skip: true, reason: 'site model is ' + Math.round(SM.ageDays(stored)) + ' days old', site_id, domain, reused: true } }];
return [{ json: { skip: false, site_id, domain, url: 'https://' + domain + '/', reused: false } }];
