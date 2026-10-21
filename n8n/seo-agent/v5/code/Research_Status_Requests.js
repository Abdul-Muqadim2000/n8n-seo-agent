/*__SITE_MODEL__*/
/*__GONE__*/
// KWL-RES follow-up (2026-10-21 live keyword test, exec 111): at onboarding the research runs BEFORE the Site Tracker has read any page's
// status (every seo_pages row had http_status 0), so "already answered by a page you have: refresh it" pointed at 8 pages that answer 404.
// The research does not rely on that order: before Rank Keywords offers a page of the site as the answer to a search, it opens that page
// itself. Which pages: for the relevant keywords first, then by opportunity, the page Search Console credits for the keyword and the page
// the inventory matches (SM.matchPage), at most CAP distinct addresses. A page the site model already knows (gone, or answering 200 read
// within FRESH_DAYS) is not opened again. Free GETs of the client's own pages; one item per page, or one { status_check: false } item.
// N5 (KW recheck 2026-10-21, exec 149): a 404 insights page was left "not checked" by a cap of 10; opening one of the client's own pages costs
// nothing, so the cap is 25 (each read is a free GET, two at a time, 15 s at most)
const CAP = 25, FRESH_DAYS = 7;
const base = $('Collect Research').first().json;
const domain = String(base.domain || '').toLowerCase();
let model = null; try { const m = $('Site Model').first().json.site_model; if (m && typeof m === 'object') model = m; } catch (e) { model = null; }
const pm = SM.withPages(model || SM.from({ domain }, {}), (base.site_urls || []).map(u => ({ url: u, source: 'sitemap' })));
const own = SM.helpers.bare(domain);
const onSite = (u) => { const h = SM.helpers.bare(SM.helpers.hostOf(u) || ''); return !!h && !!own && (h === own || h.endsWith('.' + own)); };
const skip = (why) => [{ json: { status_check: false, skip_reason: why, asked: 0, cap: CAP } }];
if (!own) return skip('no website');
const known = new Map(SM.pages(pm).map(p => [GONE.keyOf(p.url), p]));
const freshLive = (p) => { const n = Number(p.http_status) || 0; const t = Date.parse(String(p.status_at || '')); return n >= 200 && n < 300 && Number.isFinite(t) && (Date.now() - t) / 864e5 < FRESH_DAYS; };
// the relevance screen's verdicts (this node's input), so the keywords that can reach the report are checked first
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const relOf = new Map();
for (const o of $input.all().map(i => i.json || {})) for (const it of ((parse(o.output).items) || [])) { const k = String((it && it.keyword) || '').toLowerCase().trim(); if (k) relOf.set(k, Number(it.relevance ?? 1)); }
const cands = (((base.research || {}).candidates) || []).filter(k => k && k.keyword)
  .map((k, i) => ({ k, i, rel: relOf.has(String(k.keyword).toLowerCase()) ? relOf.get(String(k.keyword).toLowerCase()) : 1 }))
  .filter(x => x.rel > 0).sort((a, b) => b.rel - a.rel || (Number(b.k.pre_score) || 0) - (Number(a.k.pre_score) || 0) || a.i - b.i).map(x => x.k);
const want = new Map(); let dropped = 0, knownSkip = 0;
const hasPages = SM.pages(pm).length > 0;
for (const k of cands) {
  const g = k.gsc && onSite(k.gsc.page) ? String(k.gsc.page) : '';
  const m = hasPages ? SM.matchPage(pm, k.keyword, g || undefined) : null;
  for (const u of [g, m && m.url].filter(Boolean)) {
    const key = GONE.keyOf(u); if (!key || want.has(key)) { if (want.has(key)) want.get(key).keywords.push(k.keyword); continue; }
    const p = known.get(key);
    if (p && (GONE.isGone(p.http_status) || freshLive(p))) { knownSkip++; continue; }
    if (want.size >= CAP) { dropped++; continue; }
    want.set(key, { url: SM.canonUrl(pm, u), key, keywords: [k.keyword] });
  }
}
if (!want.size) return skip(knownSkip ? 'every page the research could offer already has a recent status on file' : 'no page of the site answers any researched keyword');
const list = [...want.values()];
return list.map((w, i) => ({ json: { status_check: true, url: w.url, key: w.key, keywords: w.keywords.slice(0, 5), n: i + 1, of: list.length, cap: CAP, not_asked: dropped } }));
