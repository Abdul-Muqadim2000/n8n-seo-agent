// AIR integrations: the planner (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2.I / §6.6, CONTRACTS.md §4-§6, package P5). For each website
// the gate let through, what AIR reads from outside this week and what it reuses. It reads stored data only and calls nothing.
//   ONLY a website in mode `on` (AIRF.mayPay) gets a plan: a site in shadow or off reads nothing from outside, paid, keyed or free, so the
//   shadow golden (harness AP3) stays byte-identical. Each read has its own switch on top of `on`:
//     * LLM Mentions (DataForSEO top_mentioned_pages + target_metrics): `ai_rank_mentions`; once a calendar month per site (the marker
//       AIRF.mentionsKey(site, 'yyyy-mm') in seo_cache; a later run of the same month reuses what it stored, $0);
//     * fan-out results pages (DataForSEO SERP, Google and Bing, depth 10): `ai_rank_fanout_n` > 0 is the most paid reads a site makes in an
//       ISO week (both engines together). A Google reading of the last 7 days in the shared SERP cache, or a reading stored this week, costs
//       nothing. Bing is read only for a site that asks Copilot, and only for a search Bing Webmaster gives no position for (decided after the
//       Bing stats in *AI Rank SERP Requests*);
//     * Brave Search (the Claude retrieval proxy): `ai_rank_brave` AND the key SEO_BRAVE_API_KEY at build time (BRAVE_ON below); no key or
//       the flag off = no request, the node never runs. At most AIRC.brave_week_max searches a site a week;
//     * Bing Webmaster stats (free, the existing key; BING_ON below): only for a site in this account's Bing list, once a week (at most
//       AIRC.bing_calls_week_max calls), reused from this week's marker on a second run;
//     * Common Crawl CDX (free, public): is the site in the latest crawl, and how many captures; every AIRC.cc_every_days days.
//   The searches read are the fan-out queries of the site's treated core questions (ARD.fanoutOf over the stored evidence and 28 days of
//   answers), plus each question's own keyword, most frequent first. The market of the reads is the site's own (seo_sites location / language);
//   a site with none falls back to the dominant market of its questions, and a site with neither gets no SERP read (never a guessed country).
// out: one item per paying site { site_id, domain, run_id, mode, loc, engines, week_key, month_key, queries, google, bing_serp, mentions, bing,
//      cc, brave, week, why } or [{ skip: true, reason }]. The call nodes (AI_Rank_Calls.js) and AI Rank Fetched read it by name.
/*__AI_RANK_FLAGS__*/
/*__AI_RANK_DIAG__*/
/*__SERP_CACHE__*/
/*__COUNTRIES__*/
const AIRC = { API: 'https://api.dataforseo.com/v3/', serp_depth: 10, serp_fresh_days: 2,   /* FX-B RB-12: the AI visibility run prunes every serp: row older than 2 days (F-85), so an older reading is never there to reuse */ queries_max: 50, brave_week_max: 10, bing_query_pages: 3, bing_calls_week_max: 10,
  mentions_keywords: 5, cc_every_days: 28,
  // planning prices (USD) only: the ledger settles what each DataForSEO task reports, counted once by its task id (AI Rank Fetched)
  price: { serp: 0.002, mentions_pages: 0.15, mentions_metrics: 0.101, brave: 0.005 }, site_usd_max: 0.6 };
const BRAVE_ON = __AIR_BRAVE_ON__;   // baked by ai_rank_requests_wiring.py: true only when SEO_BRAVE_API_KEY is set in n8n/.env
const BING_ON = __BING_ENABLED__;    // baked by build_monitors.py: true only when SEO_BING_WEBMASTER_API_KEY is set
const nowMs = Date.now(); const nowIso = new Date(nowMs).toISOString(); const DAY = 864e5;
const S0 = (v) => (v == null ? '' : String(v)).trim();
const P = (s, d) => { if (s && typeof s === 'object') return s; try { const v = JSON.parse(String(s || '')); return v == null ? d : v; } catch (e) { return d; } };
const tryAll = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return []; } };
const normD = (d) => S0(d).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '').replace(/\.$/, '');
const bySite = (rows, sid, dom) => rows.filter(r => r && (S0(r.site_id) === sid || (!S0(r.site_id) && normD(r.domain) === dom)));
const listOf = (v) => { const j = P(v, null); if (Array.isArray(j)) return j.map(S0).filter(Boolean); return S0(v).split(/[,|;\s]+/).map(S0).filter(Boolean); };
const rawHost = (u) => { const m = S0(u).match(/^https?:\/\/([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
// ISO week (Monday first): the budget of the paid and keyed reads is per site and per ISO week
const isoWeek = (ms) => { const d = new Date(ms); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); const th = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY + 3 * DAY;
  const y = new Date(th).getUTCFullYear(); return y + '-W' + String(1 + Math.floor((th - Date.UTC(y, 0, 1)) / (7 * DAY))).padStart(2, '0'); };
const weekKey = (sid, wk) => 'air:week:' + sid + ':' + wk;
const ccKey = (sid) => 'air:cc:' + sid;
const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];   // as _monitor_sites.js (copilot is opt-in)

const sites = tryAll('AI Rank Live').filter(x => x && x.site_id && !x.skip && !x.error);
const cacheAir = tryAll('Load AI Rank Cache');
// FX-B RB-4: the re-check fails closed too: a kill row read by its key, or a load that errored or never ran, means no paid or keyed read
const killAir = tryAll('Load AI Rank Kill');
const killNow = AIRF.killed(cacheAir) || AIRF.killed(killAir) || !cacheAir.length || !killAir.length || cacheAir.some(r => r && r.error) || killAir.some(r => r && r.error);
const pay = sites.filter(g => AIRF.mayPay(g.rank || AIRF.settingsOf({}), killNow));
if (!pay.length) return [{ json: { skip: true, reason: sites.length ? 'no website in mode on: AIR reads nothing from outside in shadow' : 'no website to read for' } }];

const serpRows = tryAll('Load SERP Cache (Rank)');
const qRows = tryAll('Load AI Rank Questions'), answersAll = tryAll('Load AI Answers (Rank)'), promptsAll = tryAll('Load AI Prompts');
const siteRows = tryAll('Load Sites'), monRows = tryAll('Load Monitors'), plans = tryAll('Growth Plan').filter(p => p && p.site_id && !p.nothing_to_do);
// Bing's list of the sites this account manages (read by AI Growth this run); null = not read (Bing off or the call failed)
const bingList = (() => { if (!BING_ON) return null; try { const r = $('Fetch Bing Sites (Growth)').first(); const j0 = r && r.json; if (!j0 || typeof j0 !== 'object' || j0.error) return null;
  let j = j0; if (j0.d === undefined) { const b = j0.body ?? j0.data; if (b && typeof b === 'object') j = b; else { try { j = JSON.parse(b || '{}'); } catch (e) { j = {}; } } }
  return Array.isArray(j.d) ? j.d.filter(x => x && x.Url) : null; } catch (e) { return null; } })();
const byIso = {}; for (const c of Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {})) if (c && c.iso) byIso[String(c.iso).toUpperCase()] = c;
const cacheOf = (key) => cacheAir.find(r => r && S0(r.key) === key) || null;

const out = [];
for (const g of pay) {
  const sid = g.site_id; const rank = g.rank || AIRF.settingsOf({}); const why = [];
  const gp = plans.find(p => p.site_id === sid) || {}; const dom = normD(gp.domain || g.domain); const host = S0(gp.site_host).toLowerCase() || dom;
  const siteRow = siteRows.find(r => S0(r.site_id) === sid) || siteRows.find(r => normD(r.domain) === dom) || {};
  const mon = monRows.find(m => S0(m.site_id) === sid) || {};
  const engines = (() => { const e = listOf(mon.ai_engines).map(x => x.toLowerCase()).filter(x => AIRF.usable(x)); return e.length ? [...new Set(e)] : DEFAULT_ENGINES.slice(); })();
  const prompts = bySite(promptsAll, sid, dom);
  // ---- the market of the reads: the site's own, else its questions' dominant market, else none (nothing is read in a guessed country) ----
  const loc = (() => { const lc = Number(siteRow.location_code) || 0;
    const iso = S0(((typeof COUNTRIES === 'object' ? COUNTRIES : {})[S0(siteRow.country)] || {}).iso || Object.values(byIso).find(c => Number(c.code) === lc)?.iso).toUpperCase();
    if (lc) return { location_code: lc, language_code: S0(siteRow.language_code || 'en').toLowerCase() || 'en', country_iso: iso, basis: 'the website\'s own market (seo_sites)' };
    const cnt = {}; for (const p of prompts) { const m = S0(p.market).match(/^([A-Za-z]{2})-([A-Za-z]{2})/); if (m) { const k = m[1].toUpperCase() + '-' + m[2].toLowerCase(); cnt[k] = (cnt[k] || 0) + 1; } }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (top) { const [cc, lang] = top[0].split('-'); const c = byIso[cc]; if (c && c.code) return { location_code: Number(c.code), language_code: lang, country_iso: cc, basis: 'the dominant market of its questions (' + top[0] + ')' }; }
    return null; })();
  if (!loc) why.push('no market on file for this website (seo_sites has no location and its questions name none): no results page is read');
  // ---- the questions whose searches matter: treated core questions, else core, else every stored AIR question, else the active panel ----
  const stored = bySite(qRows, sid, dom);
  const isCore = (r) => r.core === true || /^true$/i.test(S0(r.core));
  let qs = stored.filter(r => isCore(r) && S0(r.arm) === 'treated'); let qBasis = 'treated core questions';
  if (!qs.length) { qs = stored.filter(isCore); qBasis = 'core questions (no arms assigned yet)'; }
  if (!qs.length) { qs = stored; qBasis = 'every question AIR has diagnosed'; }
  if (!qs.length) { qs = prompts.filter(p => !['off', 'refused', 'retired', 'proposed'].includes(S0(p.status || 'active').toLowerCase()) && !S0(p.retired_at) && S0(p.kind) !== 'brand')
    .map(p => ({ prompt_id: p.prompt_id, evidence_json: '' })); qBasis = 'the active question panel (AIR has stored no question yet)'; }
  const promptById = new Map(prompts.map(p => [S0(p.prompt_id), p]));
  const answers = bySite(answersAll, sid, dom).filter(a => AIRF.usable(a.engine));
  const agg = new Map();   // normalised query -> { query, key, n, questions }
  const addQ = (query, n, pid) => { const k = SC.normKw(query); if (!k || k.length < 3 || k.length > 200) return; const x = agg.get(k) || { query: k, key: k, n: 0, questions: [] };
    x.n += Number(n) || 0; if (pid && !x.questions.includes(pid)) x.questions.push(pid); agg.set(k, x); };
  for (const r of qs) { const pid = S0(r.prompt_id); if (!pid) continue;
    let fan = []; try { fan = ARD.fanoutOf({ prompt_id: pid, answers8: answers, evidence: S0(r.evidence_json), now: nowMs }) || []; } catch (e) { fan = []; }
    for (const f of fan) addQ(f.query, f.n, pid);
    const kw = S0((promptById.get(pid) || {}).keyword || r.keyword); if (kw) addQ(kw, 1, pid); }
  const queries = [...agg.values()].sort((a, b) => b.n - a.n || b.questions.length - a.questions.length || a.key.localeCompare(b.key)).slice(0, AIRC.queries_max);
  // ---- what this week already read (a second run of the same week reuses it and spends nothing again) ----
  const wk = isoWeek(nowMs); const wkRow = cacheOf(weekKey(sid, wk)); const week = wkRow ? P(wkRow.value, null) : null;
  const usedOf = (k) => Number(((week || {}).reads || {})[k]) || 0;
  const readOf = (e, key) => ((week && Array.isArray(week.readings)) ? week.readings : []).find(x => x && x.e === e && x.k === key) || null;
  // ---- Google results pages for the fan-out searches ----
  const askCopilot = engines.includes('copilot');
  const serpLeft = Math.max(0, rank.fanout_n - usedOf('google') - usedOf('bing'));
  const gBudget = askCopilot ? Math.ceil(serpLeft / 2) : serpLeft;
  const google = { read: [], cached: [], budget: gBudget, basis: rank.fanout_n > 0 ? 'ai_rank_fanout_n = ' + rank.fanout_n + ' paid reads a week (both engines); ' + (usedOf('google') + usedOf('bing')) + ' already made this week' : 'ai_rank_fanout_n is 0: no fan-out results page is read' };
  const bodyOf = (q) => ({ keyword: q.slice(0, 700), location_code: loc.location_code, language_code: loc.language_code, depth: AIRC.serp_depth });
  if (rank.fanout_n > 0 && loc) for (const q of queries) {
    const body = bodyOf(q.query); const row = serpRows.find(r => r && S0(r.key) === SC.key(body)); const v = row ? P(row.value, null) : null;
    const fresh = v && v.at && !SU.poisoned(v) && nowMs - Date.parse(v.at) <= AIRC.serp_fresh_days * DAY && (v.empty || Number(v.depth) >= AIRC.serp_depth);   // SERP-GOTO: a reading with unresolved Google redirect links is read again
    if (fresh) { google.cached.push({ query: q.query, key: q.key, source: 'serp cache', read_at: S0(v.at), location_code: loc.location_code,
      results: v.empty ? [] : (v.items || []).filter(x => x && x.type === 'organic' && x.url).map(x => ({ url: x.url, pos: Number(x.rank_group || x.rank_absolute) || null })) }); continue; }
    const st = readOf('google', q.key); if (st) { google.cached.push({ query: q.query, key: q.key, source: 'this week', read_at: S0(st.at), location_code: Number(st.loc) || loc.location_code, results: st.ours || [], results_scope: 'ours' }); continue; }
    if (google.read.length >= gBudget) continue;
    google.read.push({ query: q.query, key: q.key, body }); }
  // ---- Bing results pages: candidates only; *AI Rank SERP Requests* drops the searches Bing Webmaster already ranks the site for ----
  const bing_serp = { candidates: [], cached: [], budget: Math.max(0, serpLeft - google.read.length), basis: !askCopilot ? 'the website does not ask Copilot: no Bing results page is read' : '' };
  if (askCopilot && rank.fanout_n > 0 && loc) for (const q of queries) { const st = readOf('bing', q.key);
    if (st) { bing_serp.cached.push({ query: q.query, key: q.key, source: 'this week', read_at: S0(st.at), location_code: Number(st.loc) || loc.location_code, results: st.ours || [], results_scope: 'ours' }); continue; }
    bing_serp.candidates.push({ query: q.query, key: q.key, body: bodyOf(q.query) }); }
  // ---- LLM Mentions, once a month ----
  const ym = nowIso.slice(0, 7); const mKey = AIRF.mentionsKey(sid, ym); const mRow = cacheOf(mKey);
  const kws = []; for (const r of qs) { const kw = S0((promptById.get(S0(r.prompt_id)) || {}).keyword).toLowerCase(); if (kw && !kws.includes(kw)) kws.push(kw); }
  for (const k of listOf(siteRow.keywords)) { const kw = k.toLowerCase(); if (kw && !kws.includes(kw)) kws.push(kw); }
  const mentions = { key: mKey, month: ym, due: false, stored: mRow ? P(mRow.value, null) : null, keywords: kws.slice(0, AIRC.mentions_keywords), why: '' };
  if (!rank.mentions) mentions.why = 'ai_rank_mentions is off';
  else if (mentions.stored) mentions.why = 'read this month already (' + S0((mentions.stored || {}).at).slice(0, 10) + '): reused, $0';
  else if (!loc) mentions.why = 'no market on file';
  else if (!mentions.keywords.length) mentions.why = 'no keyword on file to ask the AI-answer database about';
  else mentions.due = true;
  // ---- Bing Webmaster stats, once a week ----
  const site = bingList ? (bingList.find(s => rawHost(s.Url) === host) || bingList.find(s => rawHost(s.Url).replace(/^www\./, '') === dom)) : null;
  const bing = { due: false, site_url: site ? S0(site.Url) : '', stored: week && week.bing_stats ? week.bing_stats : null, query_pages: queries.slice(0, AIRC.bing_query_pages).map(q => q.query), why: '' };
  if (!BING_ON) bing.why = 'no Bing Webmaster key (SEO_BING_WEBMASTER_API_KEY)';
  else if (!bingList) bing.why = 'Bing\'s site list was not read this run';
  else if (!site) bing.why = 'the website is not in this Bing Webmaster account';
  else if (usedOf('bing_calls') >= 1 || bing.stored) bing.why = 'read this week already: reused';
  else bing.due = true;
  // ---- Common Crawl, every 28 days ----
  const ccRow = cacheOf(ccKey(sid)); const ccStored = ccRow ? P(ccRow.value, null) : null;
  const cc = { key: ccKey(sid), due: !(ccStored && ccStored.at && nowMs - Date.parse(ccStored.at) < AIRC.cc_every_days * DAY), stored: ccStored, domain: dom };
  // ---- Brave, with the key and the flag only ----
  const brave = { read: [], cached: [], why: '' };
  if (!BRAVE_ON) brave.why = 'no Brave Search key (SEO_BRAVE_API_KEY): Brave is never called';
  else if (!rank.brave) brave.why = 'ai_rank_brave is off';
  else { const left = Math.max(0, AIRC.brave_week_max - usedOf('brave'));
    for (const q of queries) { const st = readOf('brave', q.key); if (st) { brave.cached.push({ query: q.query, key: q.key, read_at: S0(st.at), results: st.ours || [], results_scope: 'ours' }); continue; }
      if (brave.read.length < left) brave.read.push({ query: q.query, key: q.key }); } }
  // the per-site ceiling of one run: the planned paid reads never pass it (the Bing results pages are counted at their whole budget)
  const est = google.read.length * AIRC.price.serp + bing_serp.budget * AIRC.price.serp + (mentions.due ? AIRC.price.mentions_pages + AIRC.price.mentions_metrics : 0);
  if (est > AIRC.site_usd_max) { const keep = Math.max(0, Math.floor((AIRC.site_usd_max - (mentions.due ? AIRC.price.mentions_pages + AIRC.price.mentions_metrics : 0)) / AIRC.price.serp));
    google.read = google.read.slice(0, keep); bing_serp.budget = Math.max(0, Math.min(bing_serp.budget, keep - google.read.length)); why.push('capped at $' + AIRC.site_usd_max + ' of planned paid reads for this run'); }
  out.push({ json: { site_id: sid, domain: dom, site_host: host, run_id: S0(g.run_id), mode: rank.mode, loc, engines, week_key: weekKey(sid, wk), week: week, month_key: mKey,
    queries: queries.map(q => ({ query: q.query, key: q.key, n: q.n, questions: q.questions.slice(0, 5) })), queries_basis: qBasis, google, bing_serp, mentions, bing, cc, brave,
    our_hosts: [...new Set([dom, 'www.' + dom, host].filter(Boolean))], why } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website to read for' } }];
