// KI Plan (E2, 2026-11-08, DESIGN.md §2.1 / §3.1 / §7): what this run will ask, and what it may cost. ONE item, read by the run ledger
// (Monitor_Ledger_Row: `est_dfs_usd` is this run's own estimate, held at or under the quote the app charged) and by every later node by name.
//   * seeds (both runs): the confirmed services x the market ("{service} uae", "{service} company dubai", "best {service} dubai", "{product}
//     partner uae"), the request's own seeds, non-brand Search Console queries with impressions (the newest 28-day reading, top 50), the
//     tracked keywords and the ladder heads - every one through the fit gate (other brands, government, jobs, other markets), cap 20;
//   * stored ladder heads are read back through FITR.rungs (INVARIANTS rule 2): a head stored before a gate existed is set aside with its reason;
//   * the competitor set: the stored rows of this market (a `user` status is the client's), the declared competitors (start chosen), and how
//     many the client may choose (seo_monitors.ki_max_competitors, 1-5, empty = 5);
//   * the estimate assumes every results page is a miss of the day cache (it can only fall) and drops what would take it over the quote:
//     a competitor profile that does not fit waits for the next run, and says so.
/*__KI_KITS__*/
const g = $('KI Gate').first().json || {};
const rowsOf = (n) => { try { return $(n).all().map(i => (i && i.json) || {}).filter(r => r && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const S = KIW.S, N = KIW.N;
const now = new Date().toISOString();
const site = g.site || {}; const mon = g.monitors || {};
const m = { market: g.market, iso: g.iso, location_code: g.location_code, language_code: g.language_code, country: g.country_name };
const cache = rowsOf('Load KI Cache');
const compRows = rowsOf('Load KI Competitors').filter(r => S(r.market) === g.market);
const services = KIW.services(site, g);
const products = KIW.productsOf(services);
const brandWords = [S(site.business_name), ...S(site.brand_names || mon.brand_names).split(',')].map(x => KIW.normKw(x)).filter(x => x.length >= 3);
const declared = KIW.uniq([...(g.competitors || []), ...S(mon.competitors || site.competitors).split(/[\s,;]+/)].map(KIW.host).filter(h => KIW.isBusinessHost(h, g.domain))).slice(0, 10);
const maxChosen = Math.min(KIW.CAPS.chosen_max, Math.max(1, N(mon.ki_max_competitors) || KIW.CAPS.chosen_max));
const userChosen = compRows.filter(r => S(r.status) === 'chosen').map(r => KIW.host(r.comp_domain));
const dismissed = compRows.filter(r => S(r.status) === 'dismissed' && S(r.status_by) === 'user').map(r => KIW.host(r.comp_domain));
const chosen = KIW.uniq([...userChosen, ...declared.filter(d => !dismissed.includes(d))]).slice(0, maxChosen);
// ---- the fit gate (written once, used on every seed and every candidate keyword) ----
const fitCtx = { own_domain: g.domain, competitors: declared, protect: [...services, ...(g.seeds || []), ...products], topics: services.length ? services : null, market: g.iso };
const gate = (kw, extra) => fitGate(kw, { ...fitCtx, ...(extra || {}) });
// ---- Search Console: the newest 28-day reading, queries with impressions, the brand left out ----
const qh = rowsOf('Load Query History (KI)');
const lastPeriod = qh.map(r => S(r.period_end)).sort().pop() || '';
const gscAll = qh.filter(r => S(r.period_end) === lastPeriod && N(r.impressions) > 0 && S(r.query));
const isBrand = (q) => brandWords.some(b => KIW.normKw(q).includes(b)) || KIW.normKw(q).includes(S(g.domain).split('.')[0]);
const gsc = gscAll.filter(r => !isBrand(r.query)).sort((a, b) => N(b.impressions) - N(a.impressions) || S(a.query).localeCompare(S(b.query)))
  .map(r => ({ query: KIW.normKw(r.query), impressions: N(r.impressions) || 0, clicks: N(r.clicks) || 0, position: N(r.position) || null, page: S(r.page) }));
const siteImpr = gscAll.reduce((s, r) => s + (N(r.impressions) || 0), 0);
// ---- the ladder heads, read back through the gate they were written through (FITR, INVARIANTS rule 2) ----
const ladderRows = rowsOf('Load Ladders (KI)');
const heads = KIW.uniq(ladderRows.map(r => KIW.normKw(r.head_keyword)));
const fr = FITR.rungs(heads.map(h => ({ keyword: h })), FITR.ctx({ own_domain: g.domain, services, competitors: declared, topics: services }), { where: 'KI Plan' });
const ladders = fr.keep.map(r => r.keyword);
const tracked = KIW.uniq(S(site.keywords).split(',').map(KIW.normKw)).slice(0, 20);
const sd = KIW.compSeeds({ iso: g.iso, country: g.country_name, city: (KIW.J(site.nap_json, {}) || {}).city, services, products, seeds: g.seeds || [],
  gsc: gsc.slice(0, KIW.CAPS.gsc_seeds), tracked, ladders, gate: (kw) => gate(kw, { protect: [...fitCtx.protect, ...(g.seeds || []).includes(kw) ? [kw] : []] }) });
// ---- what it may cost: every request priced, cache hits free, held under the quote ----
const quote = N(KIW.QUOTE[g.kind]) || 0;
const has = (k, kind) => KIW.fresh(KIW.cacheRead(cache, k), kind, now, g.ki_force);
const ck = (what, ...p) => KIW.cacheKey(g.site_id, what, ...p);
const rkCost = KIW.PRICE.labs + KIW.CAPS.rk_limit * KIW.PRICE.labs_row;
const seedKws = sd.seeds.map(s => s.keyword);
let base = 0, profileCap = 0, compRkCap = 0;
const notes = [];
if (g.kind === 'competitors') {
  base += seedKws.length * KIW.PRICE.serp10;
  if (!has(ck('sc', g.market, KIW.hash(seedKws.join('|'))), 'ranked')) base += KIW.PRICE.labs + KIW.CAPS.sc_limit * KIW.PRICE.labs_row;
  base += KIW.PRICE.labs + (KIW.CAPS.size_targets + 1) * KIW.PRICE.labs_row;   // sizes (bulk traffic estimation)
  base += KIW.PRICE.bl + (KIW.CAPS.size_targets + 1) * KIW.PRICE.bl_row;       // referring domains
  base += (1 + KIW.CAPS.cd_rivals) * (KIW.PRICE.labs + KIW.CAPS.cd_limit * KIW.PRICE.labs_row);
  const need = chosen.filter(d => !has(ck('rk', g.market, d), 'ranked')).length;
  profileCap = Math.max(0, Math.min(need, Math.floor((quote - base + 1e-9) / rkCost)));
  if (need > profileCap) notes.push((need - profileCap) + ' competitor profile(s) wait for the next run: this run is held at the price quoted');
} else {
  base += KIW.CAPS.autocomplete * KIW.PRICE.ac;
  if (!has(ck('disc', g.market, KIW.hash(seedKws.join('|'))), 'discovery')) base += (KIW.PRICE.labs + KIW.CAPS.ideas_limit * KIW.PRICE.labs_row) + KIW.CAPS.sugg_n * (KIW.PRICE.labs + KIW.CAPS.sugg_limit * KIW.PRICE.labs_row) + KIW.CAPS.related_n * (KIW.PRICE.labs + KIW.CAPS.related_limit * KIW.PRICE.labs_row);
  if (chosen.length && !has(ck('pi', g.market, KIW.hash(chosen.slice().sort().join('|'))), 'ranked')) base += KIW.PRICE.labs + KIW.CAPS.pi_limit * KIW.PRICE.labs_row;
  base += 2 * (KIW.PRICE.labs + KIW.CAPS.top_n * KIW.PRICE.labs_row) + KIW.PRICE.ads;   // overview + intent for the top N, Google Ads for what Labs does not know
  base += KIW.CAPS.top_m * KIW.PRICE.serp10 + (KIW.PRICE.labs + KIW.CAPS.tp_urls * KIW.PRICE.labs_row);
  const need = chosen.filter(d => !has(ck('rk', g.market, d), 'ranked')).length;
  compRkCap = Math.max(0, Math.min(need, Math.floor((quote - base + 1e-9) / rkCost)));
  if (need > compRkCap) notes.push((need - compRkCap) + ' competitor keyword list(s) wait for the next run: this run is held at the price quoted');
  if (!chosen.length) notes.push('no competitor is chosen yet: the competitor and gap sections are skipped (run Competitors and pick up to ' + maxChosen + ')');
}
const est = KIW.r6(Math.min(quote || Infinity, base + (g.kind === 'competitors' ? profileCap : compRkCap) * rkCost));
return [{ json: { kind: g.kind, stage: g.stage, site_id: g.site_id, domain: g.domain, canonical_host: S(site.canonical_host) || g.domain, ...m, client_key: g.client_key || '',
  request_id: g.request_id, run_id: g.run_id, callback_url: g.callback_url, ki_mode: g.ki_mode, ki_force: !!g.ki_force, started_at: g.started_at || now, now,
  services, products, brand_words: brandWords, declared, chosen, dismissed, max_chosen: maxChosen, seeds: sd.seeds, seeds_refused: sd.refused, seeds_dropped: sd.dropped,
  gsc: gsc.slice(0, 500), gsc_period_end: lastPeriod, site_impressions: siteImpr, tracked, ladders, ladders_set_aside: fr.set_aside, fit_ctx: fitCtx,
  profile_cap: profileCap, comp_rk_cap: compRkCap, quote, notes, business: g.business || '',
  est_dfs_usd: est, est_ai_usd: 0,
  est_basis: 'modelled before the run from the price of every request it may send ($' + est.toFixed(4) + ', every results page counted as not read today; the quote is $' + quote.toFixed(2) + ')' } }];
