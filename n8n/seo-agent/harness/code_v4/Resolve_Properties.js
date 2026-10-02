// Matches each site to a Search Console property the service account can read: "sc-domain:" (domain property) first,
// then a URL-prefix property for the host (https preferred), or the property named at registration.
const plan = $('Site Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do);
const res = ($input.first() || {}).json || {};
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
const err = res.error ? gErr(res) : (Array.isArray(res.siteEntry) ? null : 'no answer from the Search Console API (credential missing or no access)');
const entries = Array.isArray(res.siteEntry) ? res.siteEntry : [];
const hostOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n Code sandbox (live finding 2026-10-02)
return plan.map(p => {
  const d = p.domain;
  const ok = entries.filter(e => e.siteUrl && e.permissionLevel !== 'siteUnverifiedUser');
  const hinted = p.gsc_property_hint ? ok.find(e => e.siteUrl === p.gsc_property_hint) : null;
  const dom = ok.find(e => e.siteUrl === 'sc-domain:' + d);
  const pref = ok.filter(e => /^https?:\/\//.test(e.siteUrl) && (hostOf(e.siteUrl) === d || hostOf(e.siteUrl).endsWith('.' + d))).sort((a, b) => (a.siteUrl.startsWith('https') ? 0 : 1) - (b.siteUrl.startsWith('https') ? 0 : 1))[0];
  const pick = hinted || dom || pref || null;
  return { json: { ...p, gsc_property: pick ? pick.siteUrl : '', gsc_connected: !!pick, gsc_permission: pick ? pick.permissionLevel : '',
    gsc_error: pick ? null : (err || ('the service account has no access to a Search Console property for ' + d + (entries.length ? ' (it can see: ' + entries.map(e => e.siteUrl).slice(0, 5).join(', ') + ')' : ' (it sees no property at all)'))) } };
});
