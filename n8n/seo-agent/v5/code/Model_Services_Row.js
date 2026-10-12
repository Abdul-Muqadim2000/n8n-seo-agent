// P2-2 (2026-10-12, Phase 2 live check §3): the site model is built BEFORE the Site Describer runs, so a describe run stored a model whose
// `services` was empty — `seo_sites.services_json` stayed "[]" on every site and the AI brief's facts said `services: []` although the
// describer had just found nine. This node re-saves the model with the description's services (SITE_MODEL_SPEC.md §4: the cache row
// `model:<site_id>`), so the next run on this site, and the Site Tracker through the stored description, carry the real service list.
// A reused model is refreshed too (its stored services were written before this change); a run with no model, no site or no service list
// writes nothing ({ skip: true } -> the IF "New Model Services?").
/*__SITE_MODEL__*/
const req = (() => { try { return $('Restore Description').first().json; } catch (e) { return $input.first().json || {}; } })();
const model = (() => { try { const m = $('Site Model').first().json.site_model; return (m && typeof m === 'object') ? m : null; } catch (e) { return null; } })();
const desc = req.site_description || {};
const services = [...(desc.products_or_services || []), ...(desc.services || [])].map(s => String(s == null ? '' : s).trim()).filter(Boolean);
if (!model || !model.site_id || !model.canonical_host || !services.length) return [{ json: { skip: true, reason: !model ? 'no site model' : !services.length ? 'the description names no service' : 'no site id or canonical host' } }];
const full = SM.from(SM.toRow(model), { site_id: model.site_id, domain: model.domain, services, description: desc, pages: model.pages || [],
  nav_pages: model.nav_pages || [], updated_at: model.model_updated_at || new Date().toISOString() });
// exactly the seo_cache columns: the upsert node maps every field it is given to a column
return [{ json: { key: 'model:' + full.site_id, kind: 'model', site_id: full.site_id, value: JSON.stringify(SM.toRow(full)), updated_at: full.model_updated_at || new Date().toISOString() } }];
