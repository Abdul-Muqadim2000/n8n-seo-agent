// G19 (2026-10-12): which sites of this weekly run need their homepage read again to refresh the site model (SITE_MODEL_SPEC.md §4).
// A stored model younger than SM.FRESH_DAYS is kept as it stands, so a site is read at most once a week; the request is a plain GET that
// follows redirects, which is also how the canonical host is resolved. Nothing to read = one `skip` item, no request.
/*__SITE_MODEL__*/
const sites = $('Site Plan').all().map(i => i.json).filter(s => s && s.site_id && s.domain);
const rows = (() => { try { return $('Load Sites').all().map(i => i.json).filter(r => r && r.site_id); } catch (e) { return []; } })();
const out = [];
for (const s of sites) {
  const row = rows.find(r => r.site_id === s.site_id) || {};
  if (SM.isFresh(SM.stored(row))) continue;
  out.push({ json: { site_id: s.site_id, domain: s.domain, url: 'https://' + s.domain + '/', fetch: true } });
}
return out.length ? out : [{ json: { skip: true, reason: 'every site model is younger than ' + SM.FRESH_DAYS + ' days' } }];
