// Brand & entity consistency (category AI Search Readiness): the same name, phone and website on the Google Business Profile, the site's own
// schema and the business profile; Organization schema with sameAs links; a claimed listing. AI assistants and Google's local results rely on
// one consistent entity. Findings are appended to the Search Console step's extra_findings so Build Site Issues scores them.
const prev = $('GSC Audit Findings').first().json;
const g = $('GBP Request').first().json;
let rs = []; try { rs = $('Fetch GBP').all().map(i => i.json || {}); } catch (e) {}
const hostOf0 = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const found = rs.flatMap(r => (((((r.tasks || [])[0] || {}).result || [])[0] || {}).items || [])).filter(x => x && (x.type === 'google_business_info' || x.title));
const task = ((rs.find(r => (((r.tasks || [])[0] || {}).status_code) === 20000) || rs[0] || {}).tasks || [])[0] || {};
// a listing counts only when it provably belongs to this business: its website is this domain, or its phone is one of the site's / profile's phones
// (live finding 2026-10-02: "techand Dubai" matched an unrelated construction company; it must never become a finding or a sameAs link)
const dig8 = (s) => String(s || '').replace(/\D/g, '').slice(-8);
const P0 = g.profile || {}, O0 = g.homepage_org || {};
const knownPhones = new Set([P0.phone, O0.telephone, ...(g.homepage_phones || [])].map(dig8).filter(d => d.length >= 7));
const owns = (x) => { const h = hostOf0(x.url || '') || String(x.domain || '').replace(/^www\./, ''); return (!!h && (h === g.domain || h.endsWith('.' + g.domain))) || (dig8(x.phone).length >= 7 && knownPhones.has(dig8(x.phone))); };
const gbp = found.find(owns) || null;
const otherListings = found.filter(x => !owns(x)).map(x => x.title).slice(0, 3);
const digits = (s) => String(s || '').replace(/\D/g, '').slice(-8);
const host = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : String(u || '').toLowerCase().replace(/^www\./, ''); };
const toks = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 1 && !['llc', 'fzco', 'fze', 'ltd', 'inc', 'the', 'and', 'co'].includes(t)));
const findings = [], works = [];
const F = (sev, title, evidence, why, fix, scoring) => findings.push({ category: 'AI Search Readiness', severity: sev, title, evidence, why, fix, affected_count: null, affected_pct: 100, sample_urls: [], scope: 'site', ...(scoring === false ? { scoring: false } : {}) });
const P = g.profile || {}; const O = g.homepage_org;
const sitePhones = [P.phone, O && O.telephone, ...(g.homepage_phones || [])].filter(Boolean);
const local = !!(P.street_address || P.city || (O && O.address));
if (!g.business_name) F('Info', 'Brand entity not checked', 'No business name in the business profile or the homepage schema', 'Without a name the Google Business Profile cannot be compared.', 'Set up the business profile (form "Set up my business profile").', false);
else if (g.skip === false && !gbp) { if (task.status_code && task.status_code !== 20000 && task.status_code !== 40102) F('Info', 'Google Business Profile not checked', 'Business Data API: ' + (task.status_message || task.status_code), 'The lookup failed.', 'It is retried in the next audit.', false);
  else if (local) F('Low', 'No Google Business Profile found', 'No listing for "' + g.business_name + (g.city ? ' ' + g.city : '') + '"', 'Local results and AI answers about local providers draw on Google Business Profiles.', 'Create or claim the profile with exactly the name, address and phone on your site.'); }
if (gbp) {
  const gp = digits(gbp.phone), gh = host(gbp.url || gbp.domain || '');
  if (gh && gh !== g.domain && !gh.endsWith('.' + g.domain)) F('Medium', 'Google Business Profile links to another website', 'Listing "' + gbp.title + '" points to ' + gh, 'The profile, the site and AI answers stop reinforcing each other.', 'Set the profile\'s website to https://' + g.domain + '/.');
  if (gp && sitePhones.length && !sitePhones.some(p => digits(p) === gp)) F('Medium', 'Phone number differs between Google Business Profile and the site', 'Profile: ' + gbp.phone + ' · site: ' + sitePhones.slice(0, 2).join(', '), 'Inconsistent name / address / phone weakens local rankings and confuses assistants.', 'Use one phone number everywhere: site footer, schema, business profile and Google Business Profile.');
  const a = toks(gbp.title), b = toks(g.business_name); const overlap = [...a].filter(t => b.has(t)).length;
  if (a.size && b.size && overlap === 0) F('Low', 'Business name differs on Google Business Profile', 'Profile: "' + gbp.title + '" · site: "' + g.business_name + '"', 'Different names make it harder to connect the listing with the site.', 'Use the same business name on both.');
  if (gbp.is_claimed === false) F('Low', 'Google Business Profile is not claimed', 'Listing "' + gbp.title + '" is unclaimed', 'Anyone can suggest edits to an unclaimed listing.', 'Claim it at business.google.com and verify it.');
  if (!findings.some(f => /differs|another website/.test(f.title))) works.push('Name, phone and website match the Google Business Profile' + (gbp.rating && gbp.rating.value ? ' (' + gbp.rating.value + '★, ' + (gbp.rating.votes_count || 0) + ' reviews)' : ''));
}
if (P.phone && O && O.telephone && digits(P.phone) !== digits(O.telephone)) F('Medium', 'Phone in the homepage schema differs from the business profile', 'Schema: ' + O.telephone + ' · profile: ' + P.phone, 'Two phone numbers for one business split its signals.', 'Update the schema or the profile so both carry the same number.');
const isFull = !!(prev.html_analysis || prev.competitor_benchmark);
if (!O && !isFull) F('Medium', 'No Organization schema on the homepage', 'No Organization / LocalBusiness JSON-LD found on the homepage', 'Organization schema tells Google and AI assistants who the business is, its logo, contact details and official profiles.', 'Add the organization.jsonld from the fix pack to the homepage.');
if (O && !(O.sameAs || []).length) F('Low', 'Organization schema has no sameAs links', 'The homepage Organization schema lists no official profiles', 'sameAs connects the brand to its LinkedIn page, Google Business Profile and other profiles: the main way assistants recognise an entity.', 'Add sameAs with the LinkedIn company page, the Google Business Profile URL and other official profiles (fix pack: organization.jsonld).');
if (O && (O.sameAs || []).length) works.push('Organization schema lists ' + O.sameAs.length + ' official profile(s) (sameAs)');
const entity = { business_name: g.business_name, city: g.city, profile_set: !!g.profile, homepage_org: O, homepage_phones: g.homepage_phones, homepage_social: g.homepage_social,
  other_listings: otherListings, gbp: gbp ? { title: gbp.title, phone: gbp.phone || '', address: gbp.address || '', website: gbp.url || '', category: gbp.category || '', rating: gbp.rating ? gbp.rating.value : null, reviews: gbp.rating ? gbp.rating.votes_count : null, claimed: gbp.is_claimed !== false, cid: gbp.cid || '', place_id: gbp.place_id || '' } : null, checked: !!g.business_name && g.skip === false };
return [{ json: { ...prev, extra_findings: [...(prev.extra_findings || []), ...findings], extra_works: [...(prev.extra_works || []), ...works], entity } }];
