// Restores the profile after the Data Table step and reports what it gives every page: the author box and Person schema (E-E-A-T),
// the LocalBusiness / NAP block for local pages, and what is still missing.
const r = $('Profile Row').first().json; const d = $('Normalize Input').first().json;
let stored = true, store_error = null;
try { const s = ($('Save Profile').first() || {}).json || {}; if (s.error) { stored = false; store_error = String(s.error.message || s.error.description || s.error).slice(0, 200); } } catch (e) { stored = false; store_error = 'Data Table step did not run: ' + String(e.message || e).slice(0, 160); }
let old = {}; try { old = $('Load Profile (Profile)').all().map(i => i.json).find(x => x && x.site_id === r.site_id) || {}; } catch (e) {}
const existed = !!old.site_id; const changed = Object.keys(r).filter(k => !['site_id', 'domain', 'updated_at', 'request_id'].includes(k) && String(r[k] || '') !== String(old[k] == null ? '' : old[k]));
const has = (k) => !!String(r[k] || '').trim();
const onSite = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); const h = m ? m[1].toLowerCase().replace(/^www\./, '') : ''; return !!h && (h === d.domain || h.endsWith('.' + d.domain)); };
const eeat = [
  { item: 'Author name', ok: has('author_name') },
  { item: 'Job title', ok: has('author_job_title') },
  { item: 'Credentials and experience', ok: has('author_credentials') },
  { item: 'Bio (2-3 sentences)', ok: String(r.author_bio || '').length >= 80 },
  { item: 'Author page on the site', ok: onSite(r.author_url), hint: 'an /about/ or /team/<name>/ page with the bio and the articles' },
  { item: 'Public profiles (LinkedIn)', ok: has('author_same_as') },
  { item: 'Author photo', ok: has('author_image_url') },
  { item: 'Topics of expertise', ok: has('author_knows_about') }
];
const local = [
  { item: 'Business name', ok: has('business_name') }, { item: 'Street address', ok: has('street_address') }, { item: 'City', ok: has('city') },
  { item: 'Phone', ok: has('phone') }, { item: 'Opening hours', ok: has('opening_hours') }, { item: 'Category', ok: has('business_type') }, { item: 'Areas served', ok: has('service_areas') }, { item: 'Map link', ok: has('map_url') }
];
const score = (l) => Math.round(100 * l.filter(x => x.ok).length / l.length);
const home = 'https://' + d.domain + '/';
const sameAs = String(r.author_same_as || '').split(/\s+/).filter(u => /^https?:\/\//.test(u));
const person = has('author_name') ? { '@context': 'https://schema.org', '@type': 'Person', '@id': home + '#author-' + String(r.author_name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name: r.author_name, ...(has('author_job_title') ? { jobTitle: r.author_job_title } : {}), ...(has('author_url') ? { url: r.author_url } : (sameAs[0] ? { url: sameAs[0] } : {})), ...(has('author_image_url') ? { image: r.author_image_url } : {}), ...(sameAs.length ? { sameAs } : {}), ...(has('author_knows_about') ? { knowsAbout: String(r.author_knows_about).split(/\s*,\s*/).filter(Boolean) } : {}), worksFor: { '@id': home + '#organization', name: r.business_name || d.domain } } : null;
const localBusiness = (has('street_address') || has('phone')) ? { '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': home + '#business', name: r.business_name || d.domain, url: home, ...(has('phone') ? { telephone: r.phone } : {}), address: { '@type': 'PostalAddress', ...(has('street_address') ? { streetAddress: r.street_address } : {}), ...(has('city') ? { addressLocality: r.city } : {}), ...(has('region') ? { addressRegion: r.region } : {}), ...(has('postal_code') ? { postalCode: r.postal_code } : {}), ...(has('country_code') ? { addressCountry: r.country_code } : {}) } } : null;
const missE = eeat.filter(x => !x.ok).map(x => x.item.toLowerCase() + (x.hint ? ' (' + x.hint + ')' : '')), missL = local.filter(x => !x.ok).map(x => x.item.toLowerCase());
const summary = (stored ? (existed ? 'Profile updated' : 'Profile saved') : 'Profile NOT saved (' + store_error + ')') + ' for ' + d.domain + '. Author / E-E-A-T ' + score(eeat) + '% complete, local details ' + score(local) + '% complete. Every new page for this site now carries ' + (has('author_name') ? 'the byline, author box and Person schema for ' + r.author_name : 'author placeholders (no author yet)') + (has('reviewer_name') ? ', reviewed by ' + r.reviewer_name : '') + (has('street_address') && has('phone') ? '; local pages get the verified address block and LocalBusiness schema' : '') + '.';
const plain = summary + (missE.length ? '\n\nStill missing for E-E-A-T: ' + missE.join('; ') + '.' : '') + (missL.length ? '\nStill missing for local pages: ' + missL.join('; ') + '.' : '') + '\n\nSend the form again to change anything (empty fields keep what is stored, "-" clears a field).';
return [{ json: { ...d, site_id: r.site_id, profile: Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'request_id')), changed, existed, eeat_checklist: eeat, local_checklist: local,
  eeat_score: score(eeat), local_score: score(local), schema_preview: { person, local_business: localBusiness }, stored, store_error, summary, plain, status: 'completed', stage: 'profile' } }];
