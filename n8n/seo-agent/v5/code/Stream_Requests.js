// GA4 auto-detection, step 1: one dataStreams request per GA4 property the service account can see, so the property whose
// web stream URL matches the site can be found without the owner looking up the property id. Skipped when every site has an id.
const sites = $('Resolve Properties').all().map(i => i.json);
const need = sites.filter(s => !s.ga4_property_id);
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
let acct = {}; try { acct = ($('GA4 Accounts').first() || {}).json || {}; } catch (e) {}
const props = [];
for (const a of (acct.accountSummaries || [])) for (const p of (a.propertySummaries || [])) if (p.property && !props.some(x => x.property === p.property)) props.push({ property: p.property, displayName: p.displayName || '', account: a.displayName || '' });
if (!need.length || !props.length) return [{ json: { skip: true, reason: acct.error ? 'GA4 account list: ' + gErr(acct) : (!need.length ? 'every site has a GA4 property id' : 'the service account sees no GA4 property') } }];
return props.slice(0, 30).map(p => ({ json: { ...p, url: 'https://analyticsadmin.googleapis.com/v1beta/' + p.property + '/dataStreams' } }));
