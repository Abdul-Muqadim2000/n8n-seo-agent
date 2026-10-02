// Content cadence: picks this week's blog topics per site (pages per week from seo_cadence, max 3), in this order: the keyword ladder's next
// planned pages (rung order, with the ladder's internal links), striking-distance queries from Search Console (positions 4-20 with impressions:
// strengthen the page that already ranks), rising related searches from Google Trends. Skips keywords written in the last 90 days, pages already
// written or published, brand queries, and paused sites. Each pick becomes a content run (mode keyword, force_content) that delivers the blog package.
const CONFIG = { default_pages_per_week: 1, max_pages_per_week: 3, skip_recent_days: 90, striking_min_impressions: 30, striking_min_position: 4, striking_max_position: 20, publish_reminder_days: 7, upcoming: 4 };
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), cad = rowsOf('Load Cadence').filter(r => r.site_id), ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.keyword), qh = rowsOf('Load Query History'), trends = rowsOf('Load Trends'), logs = rowsOf('Load Content Log').filter(r => r.keyword);
const cadOf = new Map(cad.map(c => [c.site_id, c]));
const want = normD(trigger.domain) || String(trigger.site_id || '').trim(); const on_demand = !!want; const dry_run = !!trigger.dry_run;
const now = new Date(); const nowIso = now.toISOString(); const week = nowIso.slice(0, 10);
const byDomain = new Map(); for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d }); }
for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
let list = [...byDomain.values()];
if (on_demand) list = list.filter(s => s.domain === want || s.site_id === want); else list = list.filter(s => String(s.status || 'active') !== 'paused');
const byRung = (a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0) || (Number(a.page_no) || 0) - (Number(b.page_no) || 0);
const out = [];
for (const s of list) {
  const c = cadOf.get(s.site_id);
  let pages = (on_demand && trigger.pages != null && trigger.pages !== '') ? Number(trigger.pages) : (c ? (String(c.status || 'active') === 'off' ? 0 : Number(c.pages_per_week)) : (on_demand ? CONFIG.default_pages_per_week : 0));
  pages = Math.min(CONFIG.max_pages_per_week, Math.max(0, pages || 0));
  if (!pages) continue;
  const slog = logs.filter(l => normD(l.domain) === s.domain);
  const recent = new Set(slog.filter(l => l.status === 'published' || (now - new Date(l.started_at || 0)) < CONFIG.skip_recent_days * 864e5).map(l => norm(l.keyword)));
  const lrows = ladders.filter(l => normD(l.domain) === s.domain).sort(byRung);
  const ladderKw = new Set(lrows.map(l => norm(l.keyword)));
  for (const l of lrows) if (l.status === 'writing' || l.status === 'published') recent.add(norm(l.keyword));
  const cands = [];
  const top = lrows.find(l => Number(l.rung) === 4);
  for (const l of lrows) {
    if (String(l.status || 'planned') !== 'planned' || recent.has(norm(l.keyword))) continue;
    const links = [];
    if (Number(l.rung) === 4) { for (const r of lrows.filter(x => Number(x.rung) !== 4 && x.target_url).slice(0, 12)) links.push({ url: r.target_url, role: 'down', keyword: r.keyword }); }   // the top page is the hub: it lists the whole cluster (12, was 6; v4.4)
    else { if (top && top.target_url && top.keyword !== l.keyword) links.push({ url: top.target_url, role: 'top', keyword: top.keyword }); const sib = lrows.find(x => Number(x.rung) === Number(l.rung) && x.keyword !== l.keyword && x.target_url); if (sib) links.push({ url: sib.target_url, role: 'sibling', keyword: sib.keyword }); }
    cands.push({ keyword: l.keyword, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '', source: 'ladder', ladder_id: l.ladder_id, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, head: l.head_keyword || '', links, why: 'keyword ladder, rung ' + (Number(l.rung) === 4 ? 'top' : l.rung) + ' towards "' + (l.head_keyword || '') + '"' });
  }
  const sq = qh.filter(q => normD(q.domain) === s.domain && q.query); const latest = sq.reduce((m, q) => String(q.period_end) > m ? String(q.period_end) : m, '');
  const brand = s.domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const strikes = sq.filter(q => String(q.period_end) === latest && Number(q.position) >= CONFIG.striking_min_position && Number(q.position) <= CONFIG.striking_max_position && Number(q.impressions) >= CONFIG.striking_min_impressions && !(brand.length >= 4 && norm(q.query).replace(/\s/g, '').includes(brand)) && !recent.has(norm(q.query)) && !ladderKw.has(norm(q.query))).sort((a, b) => Number(b.impressions) - Number(a.impressions));
  for (const q of strikes) cands.push({ keyword: q.query, page_type: (q.page && !/\/(blog|news|insights|articles)\//i.test(q.page)) ? 'Service Page' : 'Guide', existing_page_url: q.page || '', source: 'striking', why: 'ranks #' + Math.round(Number(q.position)) + ' with ' + q.impressions + ' impressions in 28 days (Search Console): one push from the top 3' });
  const st = trends.filter(t => normD(t.domain) === s.domain && t.direction === 'rising' && t.rising); const latestT = st.reduce((m, t) => String(t.checked_at) > m ? String(t.checked_at) : m, '');
  for (const t of st.filter(t => String(t.checked_at) === latestT)) for (const rq of String(t.rising).split(',').map(x => x.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()).filter(Boolean)) {
    if (recent.has(norm(rq)) || ladderKw.has(norm(rq)) || cands.some(x => norm(x.keyword) === norm(rq))) continue;
    cands.push({ keyword: rq, page_type: 'Guide', existing_page_url: '', source: 'trend', why: 'rising related search for "' + t.keyword + '" (Google Trends, ' + (t.change_pct > 0 ? '+' : '') + t.change_pct + '% vs the 12-month average)' }); }
  const seen = new Set(); const uniq = cands.filter(x => { const k = norm(x.keyword); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  const picks = uniq.slice(0, pages), upcoming = uniq.slice(pages, pages + CONFIG.upcoming).map(x => ({ keyword: x.keyword, source: x.source, why: x.why }));
  const pending = slog.filter(l => l.status === 'started' && !l.published_url).map(l => ({ keyword: l.keyword, started_at: l.started_at, days: Math.round((now - new Date(l.started_at || nowIso)) / 864e5) })).filter(p => p.days >= CONFIG.publish_reminder_days);
  picks.forEach((p, i) => { const request_id = 'cad_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_' + (i + 1);
    out.push({ json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', source: p.source, keyword: p.keyword, page_type: p.page_type, existing_page_url: p.existing_page_url || '', ladder_id: p.ladder_id || '', rung: p.rung || 0, page_no: p.page_no || 0, why: p.why, request_id, pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week,
      body: { mode: 'keyword', keyword: p.keyword, page_type: p.page_type, country: s.country || '', domain: s.domain, receive: ['Keyword Report', 'Page Content'], existing_page_url: p.existing_page_url || '', email: s.email || '', callback_url: s.callback_url || '', request_id, client_ip: 'cadence:' + s.site_id, force_content: true,
        ...(p.source === 'ladder' ? { ladder_id: p.ladder_id, ladder_rung: p.rung, ladder_head: p.head, ladder_page_no: p.page_no, ladder_links: (p.links || []).map(l => ({ url: l.url, path: String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/', role: l.role, keyword: l.keyword, planned: true })) } : {}) } } }); });
}
if (!out.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'nothing to write for "' + want + '" (no cadence set, nothing planned, or everything written recently)' : 'no site has a content cadence this week', sites: list.length, dry_run } }];
return out;
