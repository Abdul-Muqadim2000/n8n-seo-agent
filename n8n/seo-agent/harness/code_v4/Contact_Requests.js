// Who to write to (v4.10, free): for each prospect getting a first draft, the page that mentions or would link (author boxes carry mailto
// links) and the site's contact and about pages are fetched; Outreach Input / Prospect Rows read the e-mail addresses on them (mailto first,
// then schema.org, then text; the prospect's own domain and editorial addresses preferred). WHOIS is no help: since GDPR most registrant
// contacts are redacted. Up to 8 prospects per site, 3 pages each.
const jobs = $('Outreach Jobs').all().map(i => i.json).filter(j => !j.skip);
let existing = []; try { existing = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
const out = [];
for (const j of jobs) for (const p of j.prospects) {
  if (p.type === 'followup') continue;
  const e = existing.find(x => x.site_id === j.site_id && x.prospect_domain === p.prospect_domain && x.contact_email); if (e) continue;
  const urls = [p.source_url, 'https://' + p.prospect_domain + '/contact', 'https://' + p.prospect_domain + '/about'].filter(u => /^https?:\/\//.test(u || ''));
  for (const url of [...new Set(urls)].slice(0, 3)) out.push({ json: { site_id: j.site_id, prospect_domain: p.prospect_domain, url } });
}
return out.length ? out : [{ json: { skip: true } }];
