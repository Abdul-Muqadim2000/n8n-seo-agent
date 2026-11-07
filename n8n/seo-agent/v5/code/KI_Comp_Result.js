// Comp Result (E2, DESIGN.md §2.5-§2.8, CONTRACTS.md §2 KI_COMP / §4): the competitor set of this site and market, scored, with reasons and the
// chosen competitors' profiles; the rows for seo_ki_competitors, the rows that leave it, the cache rows, and the callback's lists.
//   * classified by rules first, then by the homepage words read this run (untrusted DATA: only words are counted, nothing is followed);
//     a class with confidence under 0.6 is "needs your review"; search engines and text fragments are never stored (R3 #9);
//   * scored (direct and adjacent only) by KI.scoreCompetitors: results-page share weighted by the seed's demand, topic, geography, AI share;
//     the size is a TAG (peer / leader / smaller / out_of_reach), never a score input;
//   * stable: a domain keeps its row, `first_seen` / `last_seen`; a `user` status is never changed by a run; a candidate leaves only after
//     two runs without evidence (misses >= 2), a watched one never by itself; a run whose results pages could not be read counts no miss;
//   * a chosen competitor's profile: keywords, estimated visits (provider estimates, dated), referring domains, top pages (its ranked keywords
//     grouped by URL), brand share, publishing pace from its own sitemap (measured, or "not measured" with why).
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const pic = $('Comp SERP Picture').first().json || {};
const cc = $('Comp Candidates').first().json || {};
const all = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return []; } };
const now = p.now || new Date().toISOString();
const client = KIW.host(p.domain);
const cache = all('Load KI Cache').filter(r => r && r.key);
const ck = (what, ...x) => KIW.cacheKey(p.site_id, what, ...x);
const saveRows = [...(cc.cache_rows || [])];
const sections = [pic.section, ...(cc.sections || [])].filter(Boolean);
// ---- homepages read this run -> words (data), kept 14 days ----
const homes = { ...(cc.homes || {}) };
const homeReqs = all('Any Comp Homes?').filter(r => r && !r.skip && r.domain); const homeAns = all('Read Comp Homes');
let homeOk = 0;
homeReqs.forEach((q, i) => { const a = homeAns[i] || {}; const code = KIW.N(a.statusCode); const html = KIW.S(a.body != null ? a.body : a.data);
  const txt = html.slice(0, 400000).replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
  if (a.error || (code && code >= 400) || txt.length < 200) return;
  const v = { tokens: KIW.wordsOf(txt.slice(0, 6000), 120).join(' '), fetched_at: now, chars: Math.min(txt.length, 6000) }; homes[q.domain] = v; homeOk++; saveRows.push(KIW.cacheRow(p.site_id, ck('home', q.domain), v)); });
sections.push({ key: 'classification', state: homeReqs.length && homeOk < homeReqs.length ? 'partial' : 'ok', reason: homeReqs.length && homeOk < homeReqs.length ? (homeReqs.length - homeOk) + ' of ' + homeReqs.length + ' homepages could not be read: those businesses are placed by their results-page titles only' : '', rows: homeOk });
// ---- profiles of the chosen competitors (ranked keywords) and the client's own domain overlap ----
const profReqs = all('Any Comp Profiles?').filter(r => r && !r.skip && r.ki_call); const profAns = all('Run Comp Profiles Answers');
const pp = KIW.paired(profReqs, profAns);
const rk = {};
for (const x of pp.filter(x => /^rk:/.test(x.q.ki_call))) { if (!x.ok) continue; const r0 = KIW.result0(x.a);
  const v = { fetched_at: now, total: KIW.N(r0.total_count), etv: KIW.N((((r0.metrics || {}).organic) || {}).etv), items: KIW.itemsOf(x.a).map(it => { const k = KIW.kwRow(it); const se = ((it.ranked_serp_element || {}).serp_item) || {};
    return { k: k.keyword, v: k.volume, cpc: k.cpc, kd: k.kd, i: k.labs_intent, pos: KIW.N(se.rank_group), url: KIW.S(se.url), etv: KIW.N(se.etv) }; }).filter(r => r.k).slice(0, KIW.CAPS.rk_limit) };
  rk[KIW.host(x.q.target)] = v; saveRows.push(KIW.cacheRow(p.site_id, ck('rk', p.market, KIW.host(x.q.target)), v)); }
for (const d of (p.chosen || [])) if (!rk[d]) { const e = KIW.cacheRead(cache, ck('rk', p.market, d)); if (KIW.fresh(e, 'ranked', now, p.ki_force)) rk[d] = e; }
const cdClient = pp.find(x => x.q.ki_call === 'cd:' + client);
const extra = {};
if (cdClient && cdClient.ok) { const v = { fetched_at: now, total: KIW.N(KIW.result0(cdClient.a).total_count), items: KIW.itemsOf(cdClient.a).map(it => ({ d: KIW.host(it.domain), n: KIW.N(it.intersections) })).filter(it => it.d !== client && KIW.isBusinessHost(it.d, client)) };
  saveRows.push(KIW.cacheRow(p.site_id, ck('cd', p.market, client), v)); for (const it of v.items) extra[it.d] = it.n; }
const profFailed = pp.filter(x => !x.ok);
const profWait = Math.max(0, (p.chosen || []).filter(d => !rk[d]).length - profFailed.filter(x => /^rk:/.test(x.q.ki_call)).length);
sections.push({ key: 'profiles', state: !(p.chosen || []).length ? 'skipped' : (profFailed.length ? (Object.keys(rk).length ? 'partial' : 'missing') : (profWait ? 'partial' : 'ok')),
  reason: !(p.chosen || []).length ? 'no competitor is chosen yet: pick up to ' + p.max_chosen + ' and their profiles come with the next run'
    : profFailed.length ? 'could not be read: ' + profFailed.map(x => x.q.target + ' (' + x.why + ')').join('; ') : (profWait ? profWait + ' profile(s) wait for the next run: this run is held at the price quoted' : ''), rows: Object.keys(rk).length });
// ---- publishing pace (sitemap lastmod in the last 90 days) ----
const pace = {};
const smReqs = all('Any Comp Sitemaps?').filter(r => r && !r.skip && r.domain); const smAns = all('Read Comp Sitemaps');
smReqs.forEach((q, i) => { const a = smAns[i] || {}; const body = KIW.S(a.body != null ? a.body : a.data); const code = KIW.N(a.statusCode);
  let v; if (a.error || (code && code >= 400) || !/<(urlset|sitemapindex)\b/i.test(body)) v = { per_month: null, why: 'its sitemap could not be read (' + (code || 'no answer') + ')', fetched_at: now };
  else if (/<sitemapindex\b/i.test(body)) v = { per_month: null, why: 'its sitemap is an index of sitemaps (not read further)', fetched_at: now };
  else { const t0 = Date.parse(now) - 90 * 864e5; const dates = (body.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/gi) || []).map(x => Date.parse(x.replace(/<\/?lastmod>/gi, '').trim())).filter(Number.isFinite);
    v = dates.length ? { per_month: +(dates.filter(d => d >= t0).length / 3).toFixed(1), why: '', pages: dates.length, fetched_at: now } : { per_month: null, why: 'its sitemap gives no dates', fetched_at: now }; }
  pace[q.domain] = v; saveRows.push(KIW.cacheRow(p.site_id, ck('pace', q.domain), v)); });
for (const d of (p.chosen || [])) if (!pace[d]) { const e = KIW.cacheRead(cache, ck('pace', d)); if (KIW.fresh(e, 'homepage', now, p.ki_force)) pace[d] = e; }
// ---- classify (again, with the homepages read this run) and score: KI.scoreCompetitors (SERP share weighted by the seed's demand x stage,
// topic, geography, AI share; only direct / adjacent scored, and with 3+ seeds read a scored row needs 2 seeds seen) ----
const cands = (cc.candidates || []).slice();
for (const [d, n] of Object.entries(extra)) if (!cands.some(c => c.domain === d)) cands.push({ domain: d, positions: [], titles: [], labs: 0, cd: n, ai_hits: 0, sources: ['labs_overlap'] });
const sizeOf = (d) => ({ keywords: KIW.N(((cc.sizes || {})[d] || {}).keywords), etv: KIW.N(((cc.sizes || {})[d] || {}).etv), refdomains: KIW.N(((cc.refd || {})[d] || {}).refdomains) });
const me = sizeOf(client);
const aiMax = Math.max(0, ...cands.map(c => KIW.N(c.ai_hits) || 0));
const classed = cands.map(c => { const home = homes[c.domain] || null; const cls = KIW.classify(p, c, home);
  const text = (c.titles || []).join(' ') + ' ' + ((home && home.tokens) || '');
  return { ...c, cls, topic_sim: KIW.N(cls.topic_sim) != null ? KIW.N(cls.topic_sim) : (text.trim() ? KIW.topicSim(text, p.services) : null), geo_match: KIW.N(cls.geo_match) != null ? KIW.N(cls.geo_match) : KIW.geoMatch(c.domain, text, p.iso) }; })
  .filter(c => c.cls && c.cls.store && c.cls.class);
const seedsIn = (p.seeds || []).map(s => ({ keyword: s.keyword, top10: (((pic.by || {})[s.keyword] || {}).top10) || [], demand: s.weight }));
const scoredRows = KI.scoreCompetitors(classed.map(c => ({ domain: c.domain, class: c.cls.class, class_basis: c.cls.basis, class_confidence: c.cls.confidence, topic_sim: c.topic_sim, geo_match: c.geo_match,
  ai_share: cc.ai_rows_read ? (aiMax > 0 ? KIW.r4((KIW.N(c.ai_hits) || 0) / aiMax) : 0) : null, declared: (p.declared || []).includes(c.domain), keywords: sizeOf(c.domain).keywords, refdomains: sizeOf(c.domain).refdomains })),
  seedsIn, { ctx: { own_domain: client, services: p.services, declared: p.declared, market: p.iso }, client: me, market_name: p.country });
const classOf = {}; for (const c of classed) { const R = KI.reg(c.domain) || c.domain; if (!classOf[R]) classOf[R] = c; }
const stored = all('Load KI Competitors').filter(r => r && KIW.S(r.market) === p.market && r.comp_domain);
const storedBy = {}; for (const r of stored) storedBy[KIW.host(r.comp_domain)] = r;
const readAny = (pic.read || 0) > 0;
const seedsTotal = (p.seeds || []).length;
const brandOf = (d) => KIW.host(d).split('.')[0].replace(/[^a-z0-9]/g, '');
const profile = (d) => { const r = rk[d]; const sz = sizeOf(d); if (!r && sz.keywords == null && sz.refdomains == null) return null;
  const pages = {}; for (const it of ((r && r.items) || [])) { if (!it.url) continue; const pg = pages[it.url] || (pages[it.url] = { url: it.url, etv: 0, keywords: 0 }); pg.etv += KIW.N(it.etv) || 0; pg.keywords++; }
  const top_pages = Object.values(pages).sort((a, b) => b.etv - a.etv || a.url.localeCompare(b.url)).slice(0, 10).map(x => ({ url: x.url, etv: KIW.r4(x.etv), keywords: x.keywords, page_type: KI.pageType({ domain: d, url: x.url, title: x.url }) }));
  const b = brandOf(d); const items = (r && r.items) || [];
  const pc = pace[d] || {};
  return { etv: sz.etv != null ? sz.etv : (r ? r.etv : null), keywords: sz.keywords != null ? sz.keywords : (r ? r.total : null), refdomains: sz.refdomains, top_pages,
    brand_share: items.length && b.length >= 4 ? KIW.r4(items.filter(it => KIW.S(it.k).replace(/\s+/g, '').includes(b)).length / items.length) : null,
    pace_per_month: pc.per_month == null ? null : pc.per_month, pace_note: pc.why || '',
    basis: { etv: 'provider_estimate', keywords: 'provider_estimate', refdomains: 'provider_estimate', top_pages: 'provider_estimate', brand_share: 'modelled', pace_per_month: pc.per_month == null ? 'not_available' : 'measured' },
    fetched_at: (r && r.fetched_at) || now, source: 'DataForSEO Labs (ranked keywords, bulk traffic estimation) and Backlinks (referring domains)' }; };
const reasonsOf = (c, sc) => { const out = [...((sc && sc.reasons) || [])];
  if (c.labs) out.push('the data provider\'s stored results show it on ' + c.labs + ' of these searches');
  if (c.cd) out.push('it shares ' + c.cd + ' ranked searches with a business that competes for yours');
  if (c.ai_hits) out.push('AI answers to your buyers\' questions name or cite it (' + Math.round(c.ai_hits) + 'x)');
  return KIW.uniq(out).slice(0, 8); };
const rows = [], drops = [];
const seen = new Set();
for (const sc of scoredRows) {
  const d = sc.comp_domain; const c = classOf[d] || { domain: d, cls: { class: sc.class, basis: sc.class_basis, confidence: sc.class_confidence, needs_review: false } };
  const st = storedBy[d] || storedBy[c.domain] || null; const declared = !!sc.declared;
  // evidence THIS run: a seed's results page, the provider's stored results, a rival's overlap, AI answers, or the client's own word; a stored
  // row with none of them is not seen (it counts a miss below), and a domain with none of them is not a candidate at all
  const evid = (KIW.N(sc.seeds_seen) || 0) > 0 || !!c.labs || !!c.cd || !!c.ai_hits || declared;
  if (!evid) continue;
  const userSt = st && KIW.S(st.status_by) === 'user';
  const status = userSt ? KIW.S(st.status) : (declared ? 'chosen' : (st && ['watch', 'chosen'].includes(KIW.S(st.status)) ? KIW.S(st.status) : 'candidate'));
  const status_by = userSt ? 'user' : (declared ? 'declared' : (st ? KIW.S(st.status_by) || 'auto' : 'auto'));
  rows.push({ site_id: p.site_id, domain: p.domain, market: p.market, comp_domain: d, class: sc.class, class_basis: userSt && st.class_basis === 'user' ? 'user' : sc.class_basis, class_confidence: sc.class_confidence,
    scored: !!sc.scored, score: sc.score, score_low: sc.score_low, score_high: sc.score_high, serp_share: sc.serp_share, topic_sim: sc.topic_sim, geo_match: sc.geo_match, ai_share: sc.ai_share,
    size_tag: sc.size_tag, seeds_seen: sc.seeds_seen, seeds_total: sc.seeds_total, reasons_json: reasonsOf(c, sc), evidence_json: sc.evidence || [],
    declared, status, status_by, first_seen: (st && st.first_seen) || now, last_seen: now, misses: 0,
    profile_json: status === 'chosen' ? profile(d) : null, run_id: p.run_id, updated_at: now, _needs_review: !!(c.cls && c.cls.needs_review) });
  seen.add(d);
}
// stored rows this run did not see: a miss each (only when this run read results pages at all), out after two, the client's own never
for (const st of stored) { const d = KIW.host(st.comp_domain); if (seen.has(d) || seen.has(KI.reg(d))) continue;
  const misses = (KIW.N(st.misses) || 0) + (readAny ? 1 : 0); const user = KIW.S(st.status_by) === 'user';
  if (!user && KIW.S(st.status) === 'candidate' && misses >= (KI.CONFIG.comp_leave_after_misses || 2)) { drops.push({ site_id: p.site_id, market: p.market, comp_domain: d, reason: 'no evidence in two runs' }); continue; }
  const keep = {}; for (const c of KIW.COLS.KI_COMP) keep[c] = st[c] === undefined ? null : st[c];
  rows.push({ ...keep, misses, run_id: p.run_id, updated_at: now, _kept: true }); }
// the set: scored first (by score, then by evidence), then lists / directories / platforms; the client's own choices always stay
const rank = (r) => (r.status === 'chosen' ? 1e6 : 0) + (r.scored ? 1000 + (KIW.N(r.score) || 0) : 0) + (KIW.N(r.seeds_seen) || 0);
rows.sort((a, b) => rank(b) - rank(a) || KIW.S(a.comp_domain).localeCompare(KIW.S(b.comp_domain)));
const keepRows = rows.filter((r, i) => r.status_by === 'user' || r.status === 'chosen' || r._kept || (r.scored ? rows.filter(x => x.scored).indexOf(r) < 20 : rows.filter(x => !x.scored && !x._kept).indexOf(r) < 15));
const out = (r) => { const o = {}; for (const c of KIW.COLS.KI_COMP) o[c] = r[c] === undefined ? null : r[c];
  const parsed = { ...o, reasons: KIW.J(o.reasons_json, []), evidence: KIW.J(o.evidence_json, []), profile: KIW.J(o.profile_json, null) }; delete parsed.reasons_json; delete parsed.evidence_json; delete parsed.profile_json; delete parsed.id; return parsed; };
const scoredList = keepRows.filter(r => r.scored || r.status === 'chosen');
const listings = keepRows.filter(r => r.class === 'directory' || r.class === 'publisher_list');
const platforms = keepRows.filter(r => r.class === 'platform');
const status = !readAny && !Object.keys(rk).length ? 'failed' : sections.some(s => s.state === 'missing' || s.state === 'partial') ? 'partial' : 'ok';
const reason = status === 'failed' ? 'no results page could be read for your service searches, so no competitor is named (nothing was guessed)' : '';
const summary = { seeds: seedsTotal, results_pages_read: pic.read || 0, results_pages_missing: pic.missing || 0, results_pages_bought: pic.live || 0, hosts_unresolved: pic.unresolved || 0,
  candidates: keepRows.length, scored: scoredList.filter(r => r.scored).length, chosen: keepRows.filter(r => r.status === 'chosen').length, needs_review: keepRows.filter(r => r._needs_review).length,
  listings: listings.length, platforms: platforms.length, profiles: Object.keys(rk).length, left_the_set: drops.length, seeds_refused: (p.seeds_refused || []).length };
return [{ json: { kind: 'competitors', status, reason, sections, summary, notes: p.notes || [],
  comp_rows: keepRows.map(r => KIW.shape('KI_COMP', r)), comp_drops: drops, cache_rows: saveRows, serp_cache_rows: pic.serp_cache_rows || [],
  lists: { competitors: scoredList.slice(0, 20).map(out), listings: listings.slice(0, 20).map(out), platforms: platforms.slice(0, 20).map(out) } } }];
