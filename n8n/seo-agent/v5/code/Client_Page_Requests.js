// Read the client's own pages (existing page on the topic, homepage, one related service page) so the brief and the
// copy are grounded in real facts instead of placeholders. One item per URL for "Read Client Pages".
/*__SITE_MODEL__*/
const d = $input.first().json;
// D15 (system review 2026-10-11): every URL we emit uses the site model's canonical host (SITE_MODEL_SPEC.md §6) -- the bare domain
// 308-redirects on a www site. With no model (an older run) or another site's domain, the bare domain keeps today's behaviour.
let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
const siteUrlOf = (dom, path) => SM.siteUrl(SITE_MODEL && SITE_MODEL.domain && SITE_MODEL.domain === SM.helpers.bare(dom) ? SITE_MODEL : { domain: dom }, path);
// P2-5 (2026-10-12, Phase 2 live check §3): the page inventory (seo_pages, D11) reaches this path too. Run 444 asked for a verdict on
// "uae e invoicing penalties" — live since 2026-08-21 — and `existing_page` was null, because *Collect Site URLs* only matches the sitemap
// with Jaccard >= 0.5 (3 keyword words in a 9-word slug = 0.33). SM.matchPage finds it (75% of the meaningful words in the slug or title,
// or impressions for the exact query), so the page is read as the EXISTING page and the verdict improves that URL instead of asking for a
// second one. A page named by the request, or already found, still wins.
const matched = (() => { if (d.existing_page && d.existing_page.url) return null;
  const m = SITE_MODEL ? SM.matchPage(SITE_MODEL, d.keyword) : null;
  return m ? { url: m.url, title: m.title || '', match: m.score == null ? 1 : m.score, matched_by: m.matched_by, source: m.matched_by === 'query' ? 'search console' : 'page inventory' } : null; })();
const urls = []; const seen = new Set();
const add = (u, kind) => { u = String(u || '').trim(); if (!u || seen.has(u.replace(/\/$/, ''))) return; seen.add(u.replace(/\/$/, '')); urls.push({ url: u, kind }); };
if (d.existing_page && d.existing_page.url) add(d.existing_page.url, 'existing');
else if (matched) add(matched.url, 'existing');
if (d.domain) add(siteUrlOf(d.domain, '/'), 'home');
const cand = (d.internal_link_candidates || []).find(c => c.path && c.path !== '/' && !seen.has(String(c.url).replace(/\/$/, '')));
if (cand) add(cand.url, 'related');
return urls.slice(0, 3).map(u => ({ json: { ...u, ...(matched && u.kind === 'existing' ? { existing_page: matched } : {}) } }));
