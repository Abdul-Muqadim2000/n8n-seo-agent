// G7 (2026-10-12, system review FIX_PLAN.md; CRITERIA_technical… 1.5): Core Web Vitals from the Chrome UX Report — the p75 of real Chrome
// users, per **template** (homepage, a service page, a blog post) on phone and desktop, with the whole-site (origin) figures as the fallback
// for a page with too little traffic. Until now the audit measured speed on the homepage only, in a Lighthouse lab run (PageSpeed, full
// reports only), which is not what Google's page-experience signal uses (T1/T2: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the p75 of 28 days
// of field data). The requests are free: the CrUX API has no cost, only a rate limit — but it must be **enabled** in the Google Cloud project
// that owns the PageSpeed key, so *Analyze CrUX* reports "not available" instead of failing the audit when it is not.
/*__SITE_MODEL__*/
const CRUX = {
  endpoint: 'https://chromeuxreport.googleapis.com/v1/records:queryRecord',
  metrics: ['largest_contentful_paint', 'interaction_to_next_paint', 'cumulative_layout_shift'],
  form_factors: [['PHONE', 'phone'], ['DESKTOP', 'desktop']]
};

const base = $('Check Crawl').first().json;
let crawled = [];
try { crawled = ($('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.url); } catch (e) {}
let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
let prev = {}; try { prev = $input.first().json || {}; } catch (e) {}
const model = SITE_MODEL && SITE_MODEL.domain && SITE_MODEL.domain === SM.helpers.bare(base.domain) ? SITE_MODEL : { domain: base.domain };
const home = SM.siteUrl(model, '/');
const origin = String(home).replace(/^(https?:\/\/[^\/]+).*$/, '$1');

const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '') || '/';
const titleOf = (p) => String((p.meta && p.meta.title) || p.title || '');
// which template a crawled URL stands for; the first rule that matches the path wins (a /blog/ URL is a blog post, whatever else it says)
const BLOG = /\/(blog|insights|news|articles?|posts?|stories|resources?|guides?|knowledge|learn)(\/|$)/i;
const SERVICE = /\/(services?|solutions?|products?|software|platform|what-we-do|offerings?|capabilities|industries)(\/|$)/i;
const templateOf = (p) => {
  const path = pathOf(p.url);
  if (path === '/') return 'homepage';
  if (BLOG.test(path)) return 'blog_post';
  if (SERVICE.test(path)) return 'service_page';
  return '';
};
// a page worth measuring: live, not a redirect, and a real page of its template — /blog/ itself is a hub, not a post, so a blog post needs
// a second path segment
const segments = (u) => pathOf(u).replace(/^\/|\/$/g, '').split('/').filter(Boolean).length;
const usable = (p) => {
  const c = p.checks || {};
  if (c.is_broken || c.is_4xx_code || c.is_5xx_code || c.is_redirect) return false;
  if (p.status_code && Number(p.status_code) >= 300) return false;
  return segments(p.url) >= (BLOG.test(pathOf(p.url)) ? 2 : 1);
};
// Search Console clicks per page, when the audit has them: the busiest page of a template is the one its visitors feel
const clicksBy = new Map();
for (const row of (((prev.search_console || {}).top_pages) || [])) {
  const u = pathOf(row.page || row.url);
  if (u) clicksBy.set(u, (clicksBy.get(u) || 0) + (Number(row.clicks) || 0) * 100 + (Number(row.impressions) || 0));
}
const score = (p) => (clicksBy.get(pathOf(p.url)) || 0) * 1000 + Math.max(0, 200 - pathOf(p.url).length) + (Number((p.meta || {}).internal_links_count) || 0);

const picked = [];
const TEMPLATES = [['homepage', 'Homepage'], ['service_page', 'Service page'], ['blog_post', 'Blog post']];
for (const [key, label] of TEMPLATES) {
  let url = '';
  if (key === 'homepage') {
    const hit = crawled.find(p => pathOf(p.url) === '/');
    url = hit ? hit.url : home;
  } else {
    const cands = crawled.filter(p => templateOf(p) === key && usable(p)).sort((a, b) => score(b) - score(a));
    if (cands.length) url = cands[0].url;
  }
  if (url) picked.push({ template: key, label, url, title: titleOf(crawled.find(p => p.url === url) || {}) });
}

const out = [];
const want = (t, ff, ffKey, level, url) => out.push({ json: {
  endpoint: CRUX.endpoint, body: level === 'origin' ? { origin, formFactor: ff, metrics: CRUX.metrics } : { url, formFactor: ff, metrics: CRUX.metrics },
  template: t.template, label: t.label, page_url: url, page_title: t.title || '', form_factor: ffKey, level
} });
for (const t of picked) for (const [ff, ffKey] of CRUX.form_factors) want(t, ff, ffKey, 'url', t.url);
// the whole-site figures: the fallback for every template with too little traffic of its own, and the headline number for a small site
for (const [ff, ffKey] of CRUX.form_factors) want({ template: 'origin', label: 'Whole site', title: '' }, ff, ffKey, 'origin', origin);

const plan = { origin, templates: picked.map(p => ({ template: p.template, label: p.label, url: p.url })),
  missing: TEMPLATES.filter(([k]) => !picked.some(p => p.template === k)).map(([, l]) => l), requests: out.length };
if (!out.length) return [{ json: { ...prev, skip: true, crux_plan: plan, crux_reason: 'no page of the site could be identified for the speed check' } }];
return out.map(o => ({ json: { ...o.json, crux_plan: plan } }));
