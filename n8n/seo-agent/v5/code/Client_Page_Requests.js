// Read the client's own pages (existing page on the topic, homepage, one related service page) so the brief and the
// copy are grounded in real facts instead of placeholders. One item per URL for "Read Client Pages".
const d = $input.first().json;
const urls = []; const seen = new Set();
const add = (u, kind) => { u = String(u || '').trim(); if (!u || seen.has(u.replace(/\/$/, ''))) return; seen.add(u.replace(/\/$/, '')); urls.push({ url: u, kind }); };
if (d.existing_page && d.existing_page.url) add(d.existing_page.url, 'existing');
if (d.domain) add('https://' + d.domain + '/', 'home');
const cand = (d.internal_link_candidates || []).find(c => c.path && c.path !== '/' && !seen.has(String(c.url).replace(/\/$/, '')));
if (cand) add(cand.url, 'related');
return urls.slice(0, 3).map(u => ({ json: u }));
