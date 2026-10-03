// Publish detection (v4.8, PIPELINE_FEATURE_SPEC §6.5), step 1: per tracked site, the pages written but not published yet — seo_content_log
// rows "started" without a publish link from the last 120 days, plus seo_ladders rows "writing" (one candidate per keyword) — and the sitemap
// to read. A site without such pages makes no request at all. A page that improves an EXISTING URL (striking-distance rewrite, ladder page
// that already existed) cannot be told apart by its URL, so it is matched only when the sitemap says that URL changed after the page was written.
const CONFIG = { max_age_days: 120, max_candidates_per_site: 40 };
const plan = $('Site Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do && p.domain);
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();   // the keyword key of Publish Check
const isTrue = (v) => v === true || v === 'true';
const logs = rowsOf('Load Content Log').filter(r => r.keyword && r.domain);
const ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.domain && r.keyword);
const cutoff = Date.now() - CONFIG.max_age_days * 864e5;
const out = [];
plan.forEach((s, idx) => {
  const d = s.domain;
  const L = logs.filter(r => normD(r.domain) === d), LD = ladders.filter(r => normD(r.domain) === d);
  const published = new Set(L.filter(r => r.status === 'published' || String(r.published_url || '').trim()).map(r => norm(r.keyword)));
  const ladderOf = (kw) => LD.find(l => norm(l.keyword) === kw) || null;   // as Publish Check: the domain's ladder row for this keyword
  const cands = new Map();
  for (const r of L) {
    if (r.status !== 'started' || String(r.published_url || '').trim()) continue;
    const t = Date.parse(r.started_at); if (!(t >= cutoff)) continue;
    const kw = norm(r.keyword); if (!kw || cands.has(kw) || published.has(kw)) continue;
    const ladder = ladderOf(kw); if (ladder && ladder.status === 'published') continue;   // already recorded through the ladder
    cands.set(kw, { key: kw, keyword: r.keyword, source: 'content_log', log: r, ladder, written_at: String(r.started_at || '') });
  }
  for (const l of LD) {
    if (l.status !== 'writing') continue;
    const kw = norm(l.keyword); if (!kw || cands.has(kw) || published.has(kw)) continue;
    const log = L.filter(r => norm(r.keyword) === kw).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;   // an older log row of the same page (kept in the rows)
    cands.set(kw, { key: kw, keyword: l.keyword, source: 'ladder', log, ladder: l, written_at: String((log && log.started_at) || l.start_date || '') });
  }
  if (!cands.size) return;
  const list = [...cands.values()].map(c => {
    const existing = String((c.log && c.log.existing_page_url) || '').trim() || (c.ladder && isTrue(c.ladder.page_exists) ? String(c.ladder.target_url || '').trim() : '');
    const planned = c.ladder && !isTrue(c.ladder.page_exists) ? String(c.ladder.target_url || '').trim() : '';
    return { ...c, existing_url: /^https?:\/\//i.test(existing) ? existing : '', planned_url: /^https?:\/\//i.test(planned) ? planned : '', ladder_id: (c.log && c.log.ladder_id) || (c.ladder && c.ladder.ladder_id) || '' };
  }).sort((a, b) => String(b.written_at).localeCompare(String(a.written_at))).slice(0, CONFIG.max_candidates_per_site);
  // URLs that already belong to other pages of the site (published pages, pages that existed before) are never claimed by a new page
  const known = [...new Set([...L.flatMap(r => [r.published_url, r.existing_page_url]), ...LD.filter(l => l.status === 'published' || isTrue(l.page_exists)).map(l => l.target_url)].map(u => String(u || '').trim()).filter(u => /^https?:\/\//i.test(u)))];
  out.push({ json: { site_idx: idx, site_id: s.site_id, domain: d, sitemap_url: 'https://' + d + '/sitemap.xml', candidates: list, known } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no written page is waiting for publication', sites: plan.length } }];
