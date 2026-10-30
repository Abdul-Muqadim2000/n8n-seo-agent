// Index coverage: the Search Console property of each website, the way the Site Tracker resolves it (Resolve_Properties.js): the property named
// on the site row first, then the domain property (sc-domain:), then a URL-prefix property of the host, https first. A website the service
// account cannot read keeps its item with `gsc_connected: false` and the reason; it is reported, never inspected and never "not indexed".
// Other customers' properties are never named (this text reaches reports).
const plan = (() => { try { return $('Index Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do && !p.skip && p.site_id); } catch (e) { return []; } })();
const res = ($input.first() || {}).json || {};
const S = (v) => String(v == null ? '' : v).trim();
const gErr = (r) => { const e = r && r.error; if (!e) return ''; if (typeof e === 'string') return e.slice(0, 200); return S(e.message || e.status || JSON.stringify(e)).slice(0, 200); };
const err = res.error ? gErr(res) : (Array.isArray(res.siteEntry) ? '' : 'no answer from the Search Console API (credential missing or no access)');
const entries = Array.isArray(res.siteEntry) ? res.siteEntry : [];
const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
if (!plan.length) return [{ json: { skip: true, reason: 'no website to check' } }];
return plan.map(p => {
  const d = p.domain;
  const ok = entries.filter(e => e.siteUrl && e.permissionLevel !== 'siteUnverifiedUser');
  const hinted = p.gsc_property_hint ? ok.find(e => e.siteUrl === p.gsc_property_hint) : null;
  const dom = ok.find(e => e.siteUrl === 'sc-domain:' + d);
  const pref = ok.filter(e => /^https?:\/\//.test(e.siteUrl) && hostOf(e.siteUrl) === d).sort((a, b) => (a.siteUrl.startsWith('https') ? 0 : 1) - (b.siteUrl.startsWith('https') ? 0 : 1))[0];
  const pick = hinted || dom || pref || null;
  // R5 (fix wave 3): Google's own error text is kept in gsc_error_detail (ops); the client reads a plain sentence
  return { json: { ...p, gsc_property: pick ? pick.siteUrl : '', gsc_connected: !!pick, gsc_permission: pick ? pick.permissionLevel : '',
    gsc_error: pick ? '' : (res.error ? 'Search Console did not answer our request for this website' : (err || ('the service account has no access to a Search Console property for ' + d))),
    gsc_error_detail: pick ? '' : (err || '') } };
});
