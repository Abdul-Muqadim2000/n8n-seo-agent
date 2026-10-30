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
  // R56 (2026-10-16): a listing page's impressions name the dedicated page behind it; the listing travels as context
  return m ? { url: SM.canonUrl(SITE_MODEL, m.url), title: m.title || '', match: m.score == null ? 1 : m.score, matched_by: m.matched_by, source: m.matched_by === 'query' ? 'search console' : 'page inventory',
    ...(m.listing ? { listing: m.listing } : {}) } : null; })();
const urls = []; const seen = new Set();
const add = (u, kind) => { u = String(u || '').trim(); if (!u || seen.has(u.replace(/\/$/, ''))) return; seen.add(u.replace(/\/$/, '')); urls.push({ url: u, kind }); };
// H2 (2026-10-27, R1 §2.4, exec 2575): a keyword-ladder page whose ladder planned a NEW page (a planned URL, no existing page handed in) is
// never turned into a refresh of another page here: the ladder already read the site and decided (Ladder Plan, target_guard). A page the
// sitemap or the inventory matches is still read, as a related page, and the run says it was left alone.
const ukeyC = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const ladderNew = !!(d.ladder_id && String(d.ladder_target_url || '').trim() && !String(d.existing_page_url || '').trim());
const existingCand = (d.existing_page && d.existing_page.url) ? d.existing_page.url : (matched ? matched.url : '');
// W05-B (2026-10-30, BEFORE_AFTER K1): a page the site already has for the search is now a hold the client sees ("Improve the existing page"
// or "Write it anyway"). "Write it anyway" (hold_ack) on a page this run FOUND (not one the client named) means a separate new page: the
// found page is read as a related page and left as it is. "Improve the existing page" names its address, so it never reaches this rule.
const ackNew = !!(d.hold_ack && typeof d.hold_ack === 'object') && !String(d.existing_page_url || '').trim() && !(d.existing_page && d.existing_page.source === 'provided');
const ignoredExisting = existingCand && ((ladderNew && ukeyC(existingCand) !== ukeyC(d.ladder_target_url)) || (!ladderNew && ackNew)) ? existingCand : '';
if (ignoredExisting) add(ignoredExisting, 'related');
else if (d.existing_page && d.existing_page.url) add(d.existing_page.url, 'existing');
else if (matched) add(matched.url, 'existing');
if (d.domain) add(siteUrlOf(d.domain, '/'), 'home');
const cand = (d.internal_link_candidates || []).find(c => c.path && c.path !== '/' && !seen.has(String(c.url).replace(/\/$/, '')));
if (cand) add(cand.url, 'related');
// H2 (2026-10-27, R1 §3.3): the site's own services page. The promise check held the page against the homepage and one or two other pages,
// so novaand-demo.com's phases (/whatwedo: Assess & Shape, Build & Implement, Run & Optimize, Global Rollouts, Managed Services) were known by
// their titles only and 4 of 11 true sentences were flagged. The hub that lists what the business does (/whatwedo, /services, /what-we-do,
// /solutions, /capabilities ...) is read on every page run when the site has one: one more free page read, at most 6,000 characters.
const HUB_RE = /^\/(?:what-?we-?do|services|our-services|solutions|capabilities|how-we-work|our-approach|approach|offerings)\/?$/i;
const pathOfC = (u) => String(u || '').replace(/^https?:\/\/[^\/?#]+/i, '').replace(/[?#].*$/, '') || '/';
const hubPool = [...(SITE_MODEL && Array.isArray(SITE_MODEL.nav_pages) ? SITE_MODEL.nav_pages : []), ...(SITE_MODEL ? SM.pages(SITE_MODEL) : []),
  ...(d.internal_link_candidates || []), ...(d.site_urls || []).map(u => ({ url: u }))].map(p => String((p && p.url) || '')).filter(Boolean);
const sameSite = (u) => { const h = (String(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || ''; return !!d.domain && h.toLowerCase().replace(/^www\./, '') === String(d.domain).toLowerCase().replace(/^www\./, ''); };
const hub = hubPool.filter(u => sameSite(u) && HUB_RE.test(pathOfC(u))).sort((a, b) => pathOfC(a).length - pathOfC(b).length)[0];
if (hub) add(SITE_MODEL && SM.canonUrl ? SM.canonUrl(SITE_MODEL, hub) : hub, 'services');
return urls.slice(0, 4).map((u, i) => ({ json: { ...u, ...(matched && !ignoredExisting && u.kind === 'existing' ? { existing_page: matched } : {}),
  ...(i === 0 && ignoredExisting ? { ignored_existing: ladderNew ? { url: ignoredExisting, planned_url: String(d.ladder_target_url), why: 'the keyword ladder planned a new page for this keyword, so this page is read as a related page and left as it is' }
    : { url: ignoredExisting, why: 'you chose "Write it anyway", so a separate new page is written and this page is read as a related page and left as it is' } } : {}) } }));
