// The outreach jobs again for the writer (its prompt reads the job), with the contact found for each prospect.
/*__LINK_KIT__*/
const jobs = $('Outreach Jobs').all().map(i => i.json);
let creqs = [], cresps = []; try { creqs = $('Contact Requests').all().map(i => i.json).filter(r => !r.skip); cresps = $('Fetch Contacts').all().map(i => i.json || {}); } catch (e) {}
const contacts = new Map();
creqs.forEach((r, i) => { const x = cresps[i] || {}; const html = String(x.body ?? x.data ?? ''); if (!html || Number(x.statusCode) >= 400) return; const em = LK.emailsIn(html, r.prospect_domain); if (!em.length) return;
  const k = r.site_id + '|' + r.prospect_domain; const have = contacts.get(k); if (!have || (!LK.sameSite(have.email.split('@')[1], r.prospect_domain) && LK.sameSite(em[0].split('@')[1], r.prospect_domain))) contacts.set(k, { email: em[0], url: r.url }); });
return jobs.map(j => j.skip ? { json: j } : { json: { ...j, prospects: j.prospects.map(p => { const c = contacts.get(j.site_id + '|' + p.prospect_domain); return c ? { ...p, contact_email: c.email, contact_url: c.url } : p; }) } });
