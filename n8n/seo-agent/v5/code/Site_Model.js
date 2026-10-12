// G19 (2026-10-12): the on-demand resolver, step 2 (SITE_MODEL_SPEC.md §4) — the site model for this run, attached to the request as
// `site_model` so every later node reads the same facts ($('Site Model').first().json.site_model). Reused when the stored model is
// younger than SM.FRESH_DAYS, otherwise rebuilt from the homepage just read, the business profile and the business facts / call to
// action the request carries. The request item itself is passed on unchanged (the Data Table nodes above replaced the item).
/*__SITE_MODEL__*/
const req = $('Use Cached Description').first().json;
const plan = $('Site Model Plan').first().json;
const rowsOf = (nm) => { try { return $(nm).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const row = plan.site_id ? (rowsOf('Load Site Row (Model)').find(r => r.site_id === plan.site_id) || {}) : {};
const cached = (() => { const c = rowsOf('Load Site Cache').find(r => r.key === 'model:' + plan.site_id); if (!c) return null;
  try { const v = JSON.parse(c.value || 'null'); return (v && typeof v === 'object') ? { ...v, model_updated_at: c.updated_at || v.model_updated_at } : null; } catch (e) { return null; } })();   // the cache row's own timestamp decides the age, not the value's
const profile = plan.site_id ? (rowsOf('Load Profile (Model)').find(r => r.site_id === plan.site_id) || {}) : {};
const res = (() => { try { return $('Fetch Homepage (Model)').first().json || {}; } catch (e) { return {}; } })();
const status = Number(res.statusCode) || 0;
const html = (!plan.skip && status >= 200 && status < 400) ? String(res.body != null ? res.body : (res.data || '')) : '';
const desc = req.site_description || {};
const extras = { site_id: plan.site_id, domain: plan.domain || req.domain, profile, request: req,
  services: [...(desc.services || []), ...(desc.main_services || [])], description: desc,
  competitors: req.competitors || [], brand_names: req.brand_names || [] };
const base = SM.stored(row) || SM.stored(cached || {});
const model = html
  ? SM.from({ ...(base ? SM.toRow(base) : {}), ...row }, { ...extras, html, updated_at: new Date().toISOString() })
  : (base ? { ...base, business_facts: extras.request.business_facts || base.business_facts, cta: extras.request.cta || base.cta } : SM.from(row, extras));
return [{ json: { ...req, site_model: model, site_model_reused: !html, site_model_source: html ? 'homepage' : (base ? 'stored' : 'request') } }];
