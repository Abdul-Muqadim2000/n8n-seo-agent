// Content cadence: picks this week's pages per site (pages per week from seo_cadence, max 3), in this order: the keyword ladders' next
// planned pages (with each ladder's internal links), REFRESHES of pages the Site Tracker proved are losing traffic (v4.16 / B4-3, ranked by
// the clicks actually lost), striking-distance queries from Search Console (positions 4-20 with impressions:
// strengthen the page that already ranks), rising related searches from Google Trends. Skips keywords written in the last 90 days, pages already
// written or published, brand queries, and paused sites. Each pick becomes a content run (mode keyword, force_content) that delivers the blog package.
// v4.8 (Pipeline phase 2, PIPELINE_FEATURE_SPEC §6-7) — per ladder from seo_ladder_settings (no row = the site's default mode, else auto; active;
// priority by start date), per site from its '_site' row (defaults: max_active 2, max_waiting 3):
//   * only Auto ladders with status active / queued are written; the max_active highest-priority ones that still have planned pages are active,
//     the others wait (queued_ladders). Ladder 1's eligible pages come before ladder 2's; inside a ladder by rung, then page_no; plan_type
//     'direct' writes the main page (rung 4) first.
//   * main-page gate (not direct): the main page waits until half of the ladder's supporting pages are published (ladder row 'published' or a
//     content-log row with a published_url), or the main keyword's latest rank check is 1-30 (waiting_for_support lists ladders where that
//     main page is all that is left to write).
//   * won: the main keyword in the top 3 in each of the last 4 rank checks (failed checks skipped) -> no more pages (won_ladders).
//   * pile-up guard (v4.14, FIX_PLAN D5): max_waiting or more distinct keywords written but not published -> nothing is written for the
//     site (paused_reason 'pileup'; waiting_keywords names them); an on-demand run may bypass it only with force: true. A keyword waits
//     when a content-log row of the last 120 days says `written` (R1: `started` is a run that never finished), or a ladder row is still 'writing',
//     its keyword has a `written` content-log row and no
//     published page (ladder pages reach the content log only from v4.14 on).
//   * Manual ladders are never written: each one's next eligible page is listed in awaiting_approval.
// ---- KEYWORD-FIRST AUTOPILOT (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.1 / §5.5 / §14; the contract is app/shared/src/cycles.ts) ----
// On 2026-10-19 this node wrote "dynamics 365 finance operations partner uae" (an AI refresh) for a CRM-only client who had chosen no keyword:
// the AI quota defaulted to 2 a month, a site with 0 posts a week still ran for AI pages, `opportunities` defaulted to auto and the AI target
// passed no topic gate. The rules now, per website (`autopilot_level` on its `_site` row of seo_ladder_settings; empty or invalid = 2):
//   * R-K1: ladder pages are written only for ladders the client chose (`chosen_by` client_typed / client_picked / empty = legacy or API);
//     a `system_announced` ladder is written at level 3 only; anything else is never written on its own (listed for approval instead).
//   * R-K2: at levels 1 and 2 NOTHING is written until the site has at least one client-chosen ladder (any status except archived): the
//     site gets a report-only status "Waiting for your first keyword" (`waiting_for_keyword: true`). Level 3 needs no ladder.
//   * R-K3: what runs on its own depends on the level (AUTO_SOURCES, the same table as cycles.ts): 1 = ladder pages only; 2 = also refreshes
//     of the client's EXISTING pages (decay, striking distance with a page, AI refresh), each only when the keyword is IN TOPIC (positive
//     evidence: its own words match the site's ladder heads, rungs and services); 3 = also new topics (rising trends, AI answer pages, striking
//     distance without a page). Everything else is a SUGGESTION (max 5) with its price — never written. The old `opportunities` setting no
//     longer decides anything (a stored `auto` is read as "suggest").
//   * R-K4: the fit gate (own brand, other brands, government, portal, off topic, too broad — the site's own domain, its competitors, the brand
//     names AI uses for other companies, the ladder heads and services protected, as the rung gate does) runs on EVERY non-ladder candidate
//     and every suggestion at every level. A refusal is listed with its reason (`set_aside`, `refused`) and is never suggested.
//   * `pages_per_week` bounds everything automatic, and 0 means nothing at any level (the old "skip only when there are no pages AND no AI quota" let a site set
//     to 0 posts get AI pages). At level 3 the AI page still comes on top, by `ai_pages_month`. At levels 1 and 2 an AI ANSWER page (a new
//     page) is only ever a suggestion; an AI refresh of an existing page in topic is a level-2 refresh like the others and takes a slot of
//     `pages_per_week` (cycles.ts AUTO_SOURCES[2] lists ai_refresh).
//   * R-K7, one cycle one budget: pages a ladder start wrote in this cycle, and pages an earlier run of this cycle's cadence started, count
//     against `pages_per_week`. The cycle starts at the cycle run's `scheduled_for`; a run outside a cycle counts the last 6 days.
//   * skips (seo_skips, written by the app): `skip` (scope `always`, or `cycle` for this cycle's key) -> not written, not suggested;
//     `approve` for this cycle -> a needs-OK item is written in this cycle, within `pages_per_week`, after the ladder pages and before the
//     other automatic items. item_key = cycleNorm(keyword), the same normalisation as cycles.ts. An approval is the CLIENT's choice, so it is
//     written even while the site waits for its first keyword at levels 1-2 (2026-10-19, agent E4): R-K2 stops what the system would choose,
//     not what the client asked for. Skips still beat approvals, the budget still applies, and the pile-up guard still holds everything.
//   * `trigger: 'cycle'` (the Cycle Dispatcher, plan §14.2): one site, scheduled semantics (pauses and an `off` cadence honoured, no `pages`
//     override, no `force`), request ids dated by the cycle. `preview: true` (the dispatcher's `preview` job, 48 h before a cycle) plans exactly
//     what that cycle would write and WRITES NOTHING: one item per site (`preview: true`, `dry_run: true`) that the Cadence Preview node turns
//     into the `cycle_preview` callback (shape CyclePreview in cycles.ts).
// ---- F-KW (2026-10-20, production-safety review of keyword-first; replays in harness/scenarios_keyword_first.js KF11-KF20) ----
// The review proved the default level still wrote the Techand page once ANY keyword was chosen: "in topic" read the services the site crawl
// inferred (Techand IS a Dynamics 365 partner), so the D365 refresh was "in topic" for a client who chose CRM. The owner's rule: levels 1-2
// never write a topic the client did not choose. Now:
//   * IN TOPIC = what the CLIENT chose: the heads and kept rungs of the client's own ladders and the services they declared (`chosenTopics`).
//     The crawl's services still PROTECT words in the gate (no refusal of the site's own services), but never make a page "in topic" at
//     levels 1-2. Level 3 (full autopilot, the client's choice) adds the crawl's services, and needs that evidence for EVERY automatic item,
//     new topics included; no evidence = a suggestion (fitEvidence, v5/code/_fit_gate.js: a site listing two services no longer passes all).
//   * the website's root and its main menu pages (`nav_pages_json`) are never rewritten on their own, at any level: a suggestion at most.
//   * a preview (any `preview: true`) plans the cycle AS OF its due time (`scheduled_for`): the month of the AI allowance, "an AI page this
//     week", the 90-day recent rule, the decay and refresh windows, the pile-up window and in-flight runs are all read at that time.
//   * a ladder planned more than 60 days ago (cycles.ts QUEUED_RECHECK_DAYS) that has never had a page written waits for the app's fresh
//     Keyword Check (`rechecked_at` on its seo_ladder_settings row, written by the app) before its first page: listed for the client
//     ("checking this keyword again before writing", `recheck: true`) and in `recheck_ladders`, never written on a plan that old.
//   * R-K7 for ladder starts at ANY point of the cycle: a page a ladder start wrote counts against the first cadence run after it, so a
//     Saturday start counts against the next Wednesday (the previous cadence run's time comes from seo_cycle_jobs, else the previous due time).
//   * who chose a ladder: its seo_ladder_settings row, else its own seo_ladders rows (the ladder run writes `chosen_by` on both, rows first),
//     so a failed settings save can no longer make an announced keyword read as the client's; '' on both = a ladder from before the column.
//   * an approval matches the item's source and ladder when the app recorded them; a keyword-only approval that fits two items writes none.
//   * every keyword and item key is normalised in every script (Unicode letters, marks and digits), identically in app/shared/src/cycles.ts.
// Sites without a pick but with something to say (paused, waiting for a keyword, awaiting approval, suggestions, a main page waiting for
// support, refusals) get one report_only item (nothing_to_do: true) for the Cadence Status note; dry_run only plans.
/*__SITE_MODEL__*/
/*__WAITING__*/
// R16 (2026-10-13, FIX_PLAN §3.11): the fit gate also reads the rows that were STORED before it existed, so a competitor's brand or a
// government portal planned as a rung is set aside here instead of being written (`set_aside`, with the reason; the Ladder Marks node
// writes `status: set_aside` back on the row, so the app and the next run see the same thing).
/*__FIT_GATE__*/
/*__SERP_OBS__*/
/*__RANK_SERP__*/
/*__COST_CAL__*/
const CONFIG = { default_pages_per_week: 1, max_pages_per_week: 3, skip_recent_days: 90, striking_min_impressions: 30, striking_min_position: 4, striking_max_position: 20, publish_reminder_days: 7, upcoming: 4,
  max_active: 2, max_waiting: 3, waiting_days: 120, gate_head_position: 30, won_checks: 4, won_position: 3, suggestions: 5,
  // B4-3 (2026-10-15, benchmark area 4): at most this many refreshes of decaying pages offered in one week, and the days a page
  // is left alone after any refresh before it can be queued again (Semrush's own content-audit guide says to wait at least two
  // months before judging a refresh: https://www.semrush.com/blog/content-audit/)
  decay_per_week: 2, decay_refresh_days: 60,
  // R-K7: a run outside a cycle (on demand, the old weekly schedule) counts the pages started in the last 6 days as this week's
  cycle_window_days: 6, in_flight_hours: 2,
  // F-KW: a ladder planned longer ago than this is checked again before its first page (cycles.ts QUEUED_RECHECK_DAYS); a cycle is 7 days
  recheck_days: 60, cycle_days: 7 };
// ---- the contract (app/shared/src/cycles.ts): levels, the sources each level writes on its own, the item key ----
const LEVELS = [1, 2, 3], DEFAULT_LEVEL = 2;
const AUTO_SOURCES = { 1: ['ladder'], 2: ['ladder', 'decay', 'striking', 'ai_refresh'], 3: ['ladder', 'decay', 'striking', 'ai_refresh', 'trend', 'ai_answer'] };
const CLIENT_CHOSEN = new Set(['', 'client_typed', 'client_picked']);   // '' = neither the settings row nor the ladder's own rows name a chooser: a ladder from before chosen_by existed (chooserOf)
const cycleNorm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();   // cycles.ts cycleNorm / itemKey, character for character
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = cycleNorm;
const lc = (v) => String(v == null ? '' : v).toLowerCase().trim();
const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), cad = rowsOf('Load Cadence').filter(r => r.site_id), ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.keyword), qh = rowsOf('Load Query History'), trends = rowsOf('Load Trends'), logs = rowsOf('Load Content Log').filter(r => r.keyword);
const settings = rowsOf('Load Ladder Settings').filter(r => r.ladder_id);
// R16 (2026-10-13): the node loads the ranks of EVERY rung now (it was rung 4 only). The won / gate rules still read the main keyword's
// own rows (headRanks); every rung's rows carry the results page the Rank Tracker stored for that keyword, which the fit gate reads.
const allRanks = rowsOf('Load Main Keyword Ranks').filter(r => r.ladder_id && r.keyword);
const headRanks = allRanks.filter(r => Number(r.rung) === 4 || r.rung === '' || r.rung == null);
// 2026-10-12 (FIX_PLAN D11): the site's page inventory (seo_pages, filled weekly by the Site Tracker). A candidate whose search a live page
// already answers is not written as a new post: a ladder page becomes a refresh of that page, an opportunity post is dropped and named.
const pageRows = rowsOf('Load Pages (Cadence)').filter(r => r.site_id && r.url);
// v4.12 (AI_GROWTH_SPEC.md): the AI targets the AI Growth loop queued (questions AI answers without the business) and each site's AI pages a month
const aiTargets = rowsOf('Load AI Targets (Cadence)').filter(r => r.target_id && r.status === 'queued'), monitors = rowsOf('Load Monitors (Cadence)');
// R90 (2026-10-16): the names AI uses for other companies (seo_cache ai_brands:<site>), for the fit gate of the stored rungs
const aiBrandRows = rowsOf('Load AI Brands (Cadence)').filter(r => r.key);
// keyword-first: the client's decisions on the "Coming up" plan (seo_skips, written by the app) and the engine's own cost calibration
const skipRows = rowsOf('Load Skips (Cadence)').filter(r => r.site_id && r.item_key != null && String(r.item_key) !== '' && r.decision);
// F-KW (R-K7): the content-cadence jobs of earlier cycles (seo_cycle_jobs, written by the dispatcher): when the previous cadence really ran
const cycleJobRows = rowsOf('Load Cycle Jobs (Cadence)').filter(r => r.site_id && String(r.job || '') === 'content_cadence');
const cal = CC.readCal(rowsOf('Load Cost (Cadence)').filter(r => r.key));
const CONTENT_REQ = { mode: 'keyword', include_content: true };   // what every pick is: a content run (Rate Limit prices it the same way)
const estAi = CC.pick('ai', CONTENT_REQ, cal), estDfs = CC.pick('dfs', CONTENT_REQ, cal);
const EST_PAGE_USD = +(estAi.usd + estDfs.usd).toFixed(4);
const est_basis = 'a content run: Claude ' + estAi.basis + '; DataForSEO ' + estDfs.basis;
const aiQuotaOf = (siteId) => { const m = monitors.find(x => x.site_id === siteId) || {}; const on = (v) => !(v === false || /^(false|0|no|off)$/i.test(String(v == null ? '' : v))); if (!on(m.ai_visibility) || !on(m.ai_growth)) return 0; return m.ai_pages_month === '' || m.ai_pages_month == null || !Number.isFinite(Number(m.ai_pages_month)) ? 2 : Math.min(8, Math.max(0, Math.round(Number(m.ai_pages_month)))); };
const cadOf = new Map(cad.map(c => [c.site_id, c]));
// ---- who is asking: the Cycle Dispatcher (trigger 'cycle', one site, scheduled semantics), an on-demand caller (one site), or the batch ----
const isCycle = lc(trigger.trigger) === 'cycle';
// F-KW (finding 9): ANY `preview: true` is a preview and writes nothing, with or without `trigger: 'cycle'` (it used to run for real without it)
const preview = trigger.preview === true || lc(trigger.preview) === 'true' || (isCycle && lc(trigger.job) === 'preview');
const want = normD(trigger.domain) || String(trigger.site_id || '').trim(); const scoped = !!want; const on_demand = scoped && !isCycle;
const dry_run = !!trigger.dry_run || preview;   // a preview writes nothing: every writer downstream drops a dry-run item as well
const force = on_demand && !preview && (trigger.force === true || lc(trigger.force) === 'true');
const cycle_key = isCycle ? String(trigger.cycle_key || '').trim() : '';
const cycle_date = (cycle_key.match(/(\d{4}-\d{2}-\d{2})$/) || [])[1] || '';
const scheduled_for = isCycle ? String(trigger.scheduled_for || '') : '';
// the cycle run's own request id (plan §14.2: cyc_<site>_<YYYYMMDD>_<job>, from the dispatcher): the id of this run's note / status / preview
// callback, so the app files it under the cycle. The pages it starts keep their own cad_ ids (each is a run of its own; R-K7 counts them by it).
// The fields read from the Manual Run input for a cycle: trigger, domain | site_id, cycle_key, scheduled_for, preview | job, request_id.
const cycle_request_id = isCycle ? String(trigger.request_id || '').trim().slice(0, 120) : '';
const now = new Date(); const nowIso = now.toISOString(); const week = cycle_date || nowIso.slice(0, 10);
const schedT = Date.parse(scheduled_for);
// F-KW (finding 3a): the clock the plan is judged at. A preview runs 48 h before the cycle and must show what the cycle will write THEN: every
// time window below (the month of the AI allowance, an AI page this week, recent keywords, the decay / refresh windows, the pile-up window,
// in-flight runs) is read at the cycle's due time. A real run reads the wall clock.
const at = preview && Number.isFinite(schedT) ? new Date(schedT) : now; const atIso = at.toISOString();
// R-K7: where this cycle's budget starts — the cycle run's own due time, or (outside a cycle) the last six days
const windowStart = isCycle && Number.isFinite(schedT) ? schedT : Number(now) - CONFIG.cycle_window_days * 864e5;
const trigger_kind = isCycle ? 'cycle' : on_demand ? 'on_demand' : 'schedule';
const byDomain = new Map(); for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d }); }
for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
let list = [...byDomain.values()];
if (scoped) list = list.filter(s => s.domain === want || s.site_id === want);
// a paused site: the batch leaves it out; a cycle run of it is refused with the reason (its preview still tells the app why); on demand it runs
const pausedSites = isCycle ? list.filter(s => String(s.status || 'active') === 'paused') : [];
if (!on_demand) list = list.filter(s => String(s.status || 'active') !== 'paused');
const byRung = (a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0) || (Number(a.page_no) || 0) - (Number(b.page_no) || 0);
const isTop = (l) => Number(l.rung) === 4;
const posInt = (v, d, max) => { const n = Number(v); return (v !== '' && v != null && Number.isFinite(n) && n >= 1) ? Math.min(max, Math.floor(n)) : d; };
const levelOf = (row) => { const n = Number((row || {}).autopilot_level); return LEVELS.includes(n) ? n : DEFAULT_LEVEL; };
const settingOf = new Map(settings.filter(r => String(r.ladder_id) !== '_site').map(r => [String(r.ladder_id), r]));
const STATUSES = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'];
const out = [];
// the one shape a "Coming up" item and a suggestion take (CyclePreviewItem in cycles.ts)
const itemOf = (p, auto) => ({ item_key: cycleNorm(p.keyword), keyword: p.keyword, source: p.source, page_type: p.page_type || '', existing_page_url: p.existing_page_url || '',
  ladder_id: p.ladder_id || '', rung: Number(p.rung) || 0, why: p.why || '', auto: !!auto, est_usd: EST_PAGE_USD, ai_target: p.ai_target || null,
  ...(p.target_id ? { target_id: p.target_id } : {}), ...(p.approved ? { approved: true } : {}), ...(p.chosen_by != null && p.source === 'ladder' ? { chosen_by: p.chosen_by } : {}) });
for (const s of pausedSites) {
  if (preview) out.push({ json: { preview: true, dry_run: true, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '',
    request_id: cycle_request_id || 'prev_' + (cycle_date || week).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), cycle_key, cycle_date, scheduled_for, trigger: trigger_kind,
    level: levelOf(settings.find(r => String(r.ladder_id) === '_site' && (r.site_id === s.site_id || normD(r.domain) === s.domain))), pages_per_week: 0, waiting_for_keyword: false,
    paused_reason: 'site_paused', reason: 'the website is paused, so its next cycle writes nothing', items: [], suggestions: [], est_ai_usd: 0, est_dfs_usd: 0, est_page_usd: EST_PAGE_USD, est_basis, week } });
  else out.push({ json: { nothing_to_do: true, site_id: s.site_id, domain: s.domain, reason: 'the website ' + s.domain + ' is paused: its cycle writes nothing (resume it through Site Admin)', paused_reason: 'site_paused', cycle_key, dry_run } });
}
for (const s of list) {
  const c = cadOf.get(s.site_id);
  // pages a week: the cadence row (0-3; `off` = 0); an on-demand caller may name its own number; a cycle run never overrides the client's
  let pages = (on_demand && trigger.pages != null && trigger.pages !== '') ? Number(trigger.pages) : (c ? (String(c.status || 'active') === 'off' ? 0 : Number(c.pages_per_week)) : (on_demand ? CONFIG.default_pages_per_week : 0));
  pages = Math.min(CONFIG.max_pages_per_week, Math.max(0, pages || 0));
  const aiQuota = aiQuotaOf(s.site_id);   // AI answer / refresh pages a month: on top of the pages a week at level 3, at most one a week
  // pages_per_week bounds everything automatic: a site set to 0 gets nothing written at any level. The batch leaves it out (as before, minus
  // the AI pages it used to get); a run for this one site still reports its status, because that is what the caller asked for.
  if (!pages && !scoped) continue;
  // website defaults ('_site' row)
  const siteRow = settings.find(r => String(r.ladder_id) === '_site' && (r.site_id === s.site_id || normD(r.domain) === s.domain)) || {};
  const level = levelOf(siteRow);
  // `opportunities` is read only to report what was stored: it decides nothing any more (a stored `auto` means "suggest", plan §5.1 R-K3)
  const cfg = { mode: lc(siteRow.mode) === 'manual' ? 'manual' : 'auto', opportunities: lc(siteRow.opportunities) === 'manual' ? 'manual' : 'auto', max_active: posInt(siteRow.max_active, CONFIG.max_active, 20), max_waiting: posInt(siteRow.max_waiting, CONFIG.max_waiting, 100) };
  const slog = logs.filter(l => normD(l.domain) === s.domain);
  const recent = new Set(slog.filter(l => l.status === 'published' || (at - new Date(l.started_at || 0)) < CONFIG.skip_recent_days * 864e5).map(l => norm(l.keyword)));
  const publishedKw = new Set(slog.filter(l => l.published_url).map(l => norm(l.keyword)));
  const lrows = ladders.filter(l => normD(l.domain) === s.domain).sort(byRung);
  const ladderKw = new Set(lrows.map(l => norm(l.keyword)));
  for (const l of lrows) if (WAITING.LADDER_WRITTEN.has(l.status) || l.status === 'published') recent.add(norm(l.keyword));   // A-20: writing, written, not_ready
  // R16: every stored rung goes through the fit gate before it can be written. Context: the website's own domain, the competitors it
  // declared (seo_monitors / the site model) and, PROTECTED so that the ladder's own topic can never look like a brand, the ladder head
  // terms and the site's services. A rung whose page is already written or published is kept (fitStored) and only flagged.
  const monRow = monitors.find(m => m.site_id === s.site_id || normD(m.domain) === s.domain) || {};
  const fitModel = (() => { try { return SM.from(s, { monitors: monRow }); } catch (e) { return null; } })();
  const services = fitModel ? fitModel.services : [];   // the site model's services: what the Site Tracker read AND what the client declared (declared_services)
  // F-KW (finding 1): what the CLIENT said they sell, kept apart from what a crawl inferred: only these make a keyword "in topic" at levels 1-2
  const declared = fitModel && Array.isArray(fitModel.declared_services) ? fitModel.declared_services : [];
  const fitCtx = { own_domain: s.domain, brands: fitLearnedBrands(aiBrandRows.filter(r => String(r.key || '') === 'ai_brands:' + s.site_id)),
    competitors: fitModel ? fitModel.competitors : String(monRow.competitors || '').split(',').map(x => normD(x)).filter(Boolean),
    protect: [...new Set([...lrows.map(l => String(l.head_keyword || '')), ...services].filter(Boolean))] };
  // the results page the Rank Tracker stored for this very keyword (G6 `competitors_json` / `snapshot_json`, written two hours earlier on
  // the same Monday): the domains that really rank for it, in rank order — the evidence that makes "facts erp" a brand query
  // R87 / R90 (2026-10-16, re-rating 2026-10-15): ONE stored reading — the newest desktop reading of the keyword for this site within 60
  // days, whichever workflow bought it — read one entry per position (RS.serpHosts, the same rule as the Rank Tracker). The old reader merged
  // every reading the keyword ever had into one list of best positions: an October page and a September page judged as one.
  const serpFor = (kw) => { const h = RS.prevReading(allRanks, { keyword: kw, domain: s.domain, before: atIso, withSnapshot: true });
    return (h && (at - new Date(h.checked_at)) <= 60 * 864e5) ? RS.serpHosts(h, 10) : []; };
  // R90: every stored rung of a ladder is also judged against the domains of its LADDER's stored results pages (the head's above all):
  // "facts erp" has no reading of its own, but facts.ae stands on its head's page ("erp software uae", #6 on 2026-10-14)
  const ladderDoms = new Map();
  for (const l of lrows) { const d0 = ladderDoms.get(l.ladder_id) || new Set(); for (const h of serpFor(l.keyword)) d0.add(h); ladderDoms.set(l.ladder_id, d0); }
  const fitOf = new Map(); const set_aside = [];
  for (const l of lrows) {
    const serp = serpFor(l.keyword);
    const g = fitStored(l, { ...fitCtx, serp, serp_domains: [...new Set([...serp, ...(ladderDoms.get(l.ladder_id) || [])])].filter(h => normD(h) !== s.domain) }); fitOf.set(l, g);
    if (!g.flagged) continue;
    set_aside.push({ ladder_id: l.ladder_id, keyword: l.keyword, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, head: l.head_keyword || '',
      reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok });
  }
  const fitOk = (l) => (fitOf.get(l) || { ok: true }).ok;
  // ---- F-KW (finding 9): who chose each ladder. The seo_ladder_settings row says it (the app and the ladder run write it); when it is empty
  // (a settings save that failed, or a row the ladder run back-filled), the ladder's OWN rows say it: the ladder run writes `chosen_by` on
  // every seo_ladders row before the settings row, so an announced keyword can no longer read as the client's when the second write fails.
  // Empty on both = a ladder started before the column existed (all of them were started by the client or its API), read as client_typed. ----
  const chooserOf = (id) => { const st0 = settingOf.get(String(id)); const sv = lc(st0 && st0.chosen_by); if (sv) return sv;
    return lrows.filter(l => String(l.ladder_id) === String(id)).map(l => lc(l.chosen_by)).find(Boolean) || ''; };
  const statusOfL = (id) => { const st0 = settingOf.get(String(id)); return st0 && STATUSES.includes(lc(st0.status)) ? lc(st0.status) : 'active'; };
  const ladderIds = [...new Set(lrows.map(l => String(l.ladder_id)))];
  const clientIds = new Set(ladderIds.filter(id => CLIENT_CHOSEN.has(chooserOf(id)) && statusOfL(id) !== 'archived'));
  const okIds = new Set(ladderIds.filter(id => { const c = chooserOf(id); return CLIENT_CHOSEN.has(c) || (c === 'system_announced' && level === 3); }));
  // the ladders whose subject may make a page "in topic": chosen, and not paused or archived (a paused ladder is the client saying "not now";
  // R-K2 still counts it as a choice, so the site does not fall back to "waiting for your first keyword")
  const liveTopic = (id) => !['paused', 'archived'].includes(statusOfL(id));
  const ladderTopics = (ids) => lrows.filter(l => ids.has(String(l.ladder_id)) && liveTopic(String(l.ladder_id))).flatMap(l => [String(l.head_keyword || ''), ...(isTop(l) || fitOk(l) ? [String(l.keyword || '')] : [])]);
  const cleanT = (a) => [...new Set(a.map(x => String(x || '').trim()).filter(Boolean))];
  // finding 1: levels 1-2 judge "in topic" against what the client chose; level 3 (full autopilot) also against what the site sells
  const chosenTopics = cleanT([...ladderTopics(clientIds), ...declared]);
  const fullTopics = cleanT([...chosenTopics, ...ladderTopics(okIds), ...services]);
  const evidenceTopics = level === 3 ? fullTopics : chosenTopics;
  // ---- R-K4: the gate every candidate that is NOT a ladder page passes, at every level. Topics = what the client's ladders are about (heads
  // and the rungs the gate kept) and what the site sells (the model's services, declared ones included), so "off topic" / "too broad" are
  // judged against the client's own subject. The serp is the keyword's own stored results page when the Rank Tracker read one. ----
  const topics = [...new Set([...lrows.map(l => String(l.head_keyword || '')), ...lrows.filter(fitOk).map(l => String(l.keyword || '')), ...services].map(x => String(x || '').trim()).filter(Boolean))];
  const gateCtx = { ...fitCtx, topics: topics.length ? topics : null, topic_label: 'what this website sells and the keywords you chose' };
  const refused = [];
  const gateOf = (o) => { const serp = serpFor(o.keyword);
    return fitGate(o.keyword, { ...gateCtx, serp, serp_domains: serp.filter(h => normD(h) !== s.domain) }); };
  const refuse = (o, g) => { const note = '"' + o.keyword + '" (' + o.source + ') is not a search this website should target: ' + g.detail + ' (' + g.reason + '), so it is not written and not suggested';
    const x = { ladder_id: '', keyword: o.keyword, source: o.source, reason: g.reason, detail: g.detail, note, written: false, dropped: true, ...(o.target_id ? { target_id: o.target_id } : {}) };
    set_aside.push(x); refused.push({ keyword: o.keyword, source: o.source, reason: g.reason, detail: g.detail, note, ...(o.target_id ? { target_id: o.target_id } : {}) }); };
  // "in topic": POSITIVE evidence that the keyword is about the client's own subject. F-KW (findings 1 and 2): levels 1-2 read only what the
  // client chose (their ladders and their declared services, never the crawl's services); level 3 also the crawl's services. With too few
  // topic words on file the gate above judges nothing (its "no evidence, no refusal" rule); here no evidence means no automatic page: it stays
  // a suggestion, at every level.
  const evidenceOf = (kw) => fitEvidence(kw, evidenceTopics, { topic_label: level === 3 ? 'what this website sells and the keywords you chose' : 'the keywords and services you chose' });
  const inTopic = (kw) => evidenceOf(kw).verdict === 'in';
  // finding 4: the website's root and its main menu pages are never rewritten on their own, at any level (a suggestion at most)
  const navKeys = new Set(((fitModel && fitModel.nav_pages) || []).map(p => String(p.url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '')).filter(Boolean));
  const mainPage = (u) => { const k = String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, ''); if (!k) return false;
    return !/\//.test(k) || navKeys.has(k); };
  const MAIN_WHY = '; it is your homepage or a main menu page, so it is only suggested and never rewritten on its own';
  // ---- skips and approvals (seo_skips): the client's word on the "Coming up" plan ----
  const mySkips = skipRows.filter(r => r.site_id === s.site_id);
  const skipAlways = new Set(mySkips.filter(r => lc(r.decision) === 'skip' && lc(r.scope) === 'always').map(r => cycleNorm(r.item_key)));
  const skipCycle = new Set(cycle_key ? mySkips.filter(r => lc(r.decision) === 'skip' && lc(r.scope) !== 'always' && String(r.cycle_key || '') === cycle_key).map(r => cycleNorm(r.item_key)) : []);
  const approveRows = cycle_key ? mySkips.filter(r => lc(r.decision) === 'approve' && String(r.cycle_key || '') === cycle_key) : [];
  const approvedKeys = new Set(approveRows.map(r => cycleNorm(r.item_key)));
  // F-KW (finding 9): an approval is for ONE item. When the app recorded the item's source (and ladder), only that item matches; an older
  // keyword-only row matches only when one item alone has that keyword (approvalFor below), never two different pages that share it.
  const rowFits = (r, o) => cycleNorm(r.item_key) === cycleNorm(o.keyword) && (!String(r.source || '').trim() || lc(r.source) === lc(o.source))
    && (!String(r.ladder_id || '').trim() || String(r.ladder_id) === String(o.ladder_id || ''));
  const skipped = [];
  const isSkipped = (kw) => skipAlways.has(cycleNorm(kw)) || skipCycle.has(cycleNorm(kw));
  const noteSkip = (o) => { const k = cycleNorm(o.keyword); if (skipped.some(x => x.item_key === k)) return; skipped.push({ item_key: k, keyword: o.keyword, source: o.source, scope: skipAlways.has(k) ? 'always' : 'cycle' }); };
  const open = (l) => String(l.status || 'planned') === 'planned' && !recent.has(norm(l.keyword)) && fitOk(l);
  // one entry per ladder: settings, main-keyword ranks, gate, won, eligible pages in writing order
  const groups = new Map(); for (const l of lrows) { if (!groups.has(l.ladder_id)) groups.set(l.ladder_id, []); groups.get(l.ladder_id).push(l); }
  const info = [...groups.entries()].map(([id, rows]) => {
    const st = settingOf.get(String(id)) || null;
    const top = rows.find(isTop) || null;
    const head = (top && top.keyword) || rows[0].head_keyword || '';
    const mode = st && ['auto', 'manual'].includes(lc(st.mode)) ? lc(st.mode) : cfg.mode;
    const status = st && STATUSES.includes(lc(st.status)) ? lc(st.status) : 'active';
    const plan_type = st && ['direct', 'short', 'full'].includes(lc(st.plan_type)) ? lc(st.plan_type) : '';
    const priority = st && Number(st.priority) >= 1 ? Number(st.priority) : Infinity;
    const start = rows.map(r => String(r.start_date || '')).filter(Boolean).sort()[0] || String((st && st.created_at) || '');
    const chosen_by = chooserOf(id);   // R-K1 / F-KW: the settings row, else the ladder's own rows; '' = a ladder from before the column
    const chosen_ok = okIds.has(String(id));
    const hist = headRanks.filter(h => String(h.ladder_id) === String(id) && norm(h.keyword) === norm(head) && String(h.position) !== '' && h.position != null && Number.isFinite(Number(h.position)) && Number(h.position) >= 0)
      .sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));   // failed checks (-1) are "check again", not a position
    const head_position = hist.length ? Number(hist[0].position) : null;
    const lastN = hist.slice(0, CONFIG.won_checks);
    const won = lastN.length >= CONFIG.won_checks && lastN.every(h => Number(h.position) >= 1 && Number(h.position) <= CONFIG.won_position);
    const support = rows.filter(r => !isTop(r));
    const published = support.filter(r => r.status === 'published' || publishedKw.has(norm(r.keyword))).length;
    const gate_open = plan_type === 'direct' || !support.length || published * 2 >= support.length || (head_position != null && head_position >= 1 && head_position <= CONFIG.gate_head_position);
    const ordered = plan_type === 'direct' ? [...rows.filter(isTop), ...rows.filter(r => !isTop(r))] : rows;
    const remaining = ordered.filter(open);
    const eligible = remaining.filter(r => !isTop(r) || gate_open);
    // F-KW (finding 3b, plan §5.6): a ladder planned more than 60 days ago that has never had a page written is not written on that old plan:
    // it waits until the app's fresh Keyword Check passed (`rechecked_at` on its settings row, no older than the plan it checks and itself
    // within 60 days). A check that fell pauses the ladder (the app writes `status: paused`), so it is never written at all.
    const planned_at = Date.parse(start);
    const everWritten = rows.some(r => WAITING.LADDER_WRITTEN.has(String(r.status || '')) || (String(r.status || '') === 'published' && !(r.page_exists === true || r.page_exists === 'true')))
      || slog.some(l => String(l.ladder_id || '') === String(id) || rows.some(r => norm(r.keyword) === norm(l.keyword)));
    const recheckedT = Date.parse(String((st && st.rechecked_at) || ''));
    const recheck_due = Number.isFinite(planned_at) && (at - planned_at) > CONFIG.recheck_days * 864e5 && !everWritten
      && !(Number.isFinite(recheckedT) && recheckedT >= planned_at && (at - recheckedT) <= CONFIG.recheck_days * 864e5);
    const main_waiting = !gate_open && remaining.some(isTop) && !eligible.length;   // blocked on publishing: the gated main page is all that is left
    // R87 (2026-10-16): a ladder whose MAIN keyword is set aside — its row says `set_aside` (the Rank Tracker and *Ladder Marks* write it
    // back with the reason), or the gate refuses it now on its stored results page — is paused. Its rungs exist to climb towards that
    // keyword, so none of them is written or queued (exec 638 queued four rungs of a ladder whose head the Rank Tracker had just set aside).
    const hf = top ? fitOf.get(top) : null;
    const head_aside = top && (String(top.status || '') === 'set_aside' || (hf && hf.flagged && !hf.ok))
      ? { keyword: top.keyword, reason: String(top.status || '') === 'set_aside' ? String(top.status_note || 'its main keyword was set aside') : (hf.detail + ' (' + hf.reason + ')') } : null;
    if (head_aside) return { id, rows, top, head, mode, status, plan_type, priority, start, chosen_by, chosen_ok, head_position, won, won_checks: lastN.length, support: support.length, published, gate_open, main_waiting: false, remaining: [], eligible: [], head_aside, recheck_due: false };
    return { id, rows, top, head, mode, status, plan_type, priority, start, chosen_by, chosen_ok, head_position, won, won_checks: lastN.length, support: support.length, published, gate_open, main_waiting, remaining, eligible, recheck_due };
  }).sort((a, b) => a.priority - b.priority || String(a.start).localeCompare(String(b.start)) || String(a.id).localeCompare(String(b.id)));
  // R-K2: the ladders the client chose (any status except archived: a won ladder still tells us their topics)
  const clientLadders = info.filter(x => clientIds.has(String(x.id)));
  const waiting_for_keyword = level < 3 && !clientLadders.length;
  const writable = info.filter(x => ['active', 'queued'].includes(x.status) && !x.won);
  const autoL = writable.filter(x => x.mode === 'auto' && x.remaining.length && x.chosen_ok);
  const active = autoL.slice(0, cfg.max_active), queued = autoL.slice(cfg.max_active);
  const manualL = writable.filter(x => x.mode === 'manual');
  // R-K1: an Auto ladder whose keyword the client did not choose (system_announced below level 3, or an unknown chooser) is never written on
  // its own: its next page waits for the client's OK like a Manual ladder's, and the list says why
  const unchosenL = writable.filter(x => x.mode === 'auto' && !x.chosen_ok);
  const ladderCand = (x, l) => {
    const rows = x.rows, top = x.top; const links = [];
    if (isTop(l)) { for (const r of rows.filter(r => !isTop(r) && r.target_url).slice(0, 12)) links.push({ url: r.target_url, role: 'down', keyword: r.keyword }); }   // the top page is the hub: it lists the whole cluster (12, was 6; v4.4)
    else { if (top && top.target_url && top.keyword !== l.keyword) links.push({ url: top.target_url, role: 'top', keyword: top.keyword }); const sib = rows.find(r => Number(r.rung) === Number(l.rung) && r.keyword !== l.keyword && r.target_url); if (sib) links.push({ url: sib.target_url, role: 'sibling', keyword: sib.keyword }); }
    // R15 (2026-10-13): `target_url` is the URL this ladder planned for the page — the run keeps it as the page's slug, so the ladder's
    // link map, the other rung pages' links and the rank tracking never point at a URL that will not exist
    return { keyword: l.keyword, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '', target_url: l.target_url || '', source: 'ladder', ladder_id: l.ladder_id, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, head: l.head_keyword || '', links, chosen_by: x.chosen_by, why: 'keyword ladder, rung ' + (isTop(l) ? 'top' : l.rung) + ' towards "' + (l.head_keyword || '') + '"' };
  };
  const cands = [];
  // F-KW (finding 3b): an active ladder waiting for its fresh check keeps its place (the next ladder does not jump the queue) and writes nothing
  const recheckL = active.filter(x => x.recheck_due);
  for (const x of active) { if (x.recheck_due) continue; for (const l of x.eligible) { if (isSkipped(l.keyword)) { noteSkip({ keyword: l.keyword, source: 'ladder' }); continue; } cands.push(ladderCand(x, l)); } }
  const opps = [];
  // ---- B4-3 (2026-10-15, benchmark area 4): A PAGE THAT IS LOSING TRAFFIC IS WORK, NOT A LINE IN AN E-MAIL ----
  // Until today the decay verdict lived for the length of one Site Tracker run and died in a weekly e-mail as a priority-3
  // "Refresh this page"; nothing in the system ever wrote that refresh. The leaders all close this loop — Clearscope generates a
  // Draft straight from its Content Decay view (https://www.clearscope.io/support/content-decay), Siteimprove.ai Content Strategy
  // sells "a prioritized plan of what to create, refresh, or optimize" (https://www.siteimprove.com/marketmuse/).
  // The Site Tracker now stores its judgement on the seo_pages row (B4-1 / B4-2), so the cadence reads it and queues the refresh
  // AHEAD of striking distance and rising trends: recovering clicks a page already earned beats guessing at new ones, and a
  // decaying page is measured fact where a rising trend is a forecast. Ladder rungs still come first — they are the plan the
  // owner chose. Only `decaying` qualifies: `seasonal`, `watch` and `too_small` are never written, so nothing is rewritten
  // because of a quiet month. A page refreshed in the last `decay_refresh_days` is left to settle before being touched again.
  // Keyword-first (2026-10-19): written on its own from level 2 when in topic, else a suggestion.
  const decayRows = pageRows.filter(r => r.site_id === s.site_id && String(r.decay_state || '') === 'decaying' && r.url);
  const ukeyD = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const touchedRecently = new Set(slog.filter(l => l.existing_page_url && (at - new Date(l.started_at || 0)) < CONFIG.decay_refresh_days * 864e5).map(l => ukeyD(l.existing_page_url)));
  const topQueryRow = (r) => { let best = null; try { const qs = JSON.parse(r.queries_json || '[]');
      for (const q of (Array.isArray(qs) ? qs : [])) { const k = String(q.query || '').trim(); if (!k) continue;
        if (!best || (Number(q.impressions) || 0) > (Number(best.impressions) || 0)) best = q; } } catch (e) {}
    return best; };
  const decayCands = decayRows.map(r => ({ row: r, q: topQueryRow(r), lost: Number(r.decay_lost) || 0 }))
    // a refresh needs a search to be refreshed FOR; a page Search Console names no query for is reported, never written blind
    .filter(x => x.q && !touchedRecently.has(ukeyD(x.row.url)) && !recent.has(norm(x.q.query)) && !ladderKw.has(norm(x.q.query)))
    .sort((a, b) => b.lost - a.lost).slice(0, CONFIG.decay_per_week);
  const decay_skipped = decayRows.length - decayCands.length;
  for (const x of decayCands) opps.push({ keyword: x.q.query, page_type: 'Guide', existing_page_url: x.row.url, source: 'decay', decay_lost: x.lost,
    why: 'this page is losing traffic: ' + x.lost + ' clicks lost in 28 days (from ' + (Number(x.row.prev_clicks) || 0) + ' to ' + (Number(x.row.clicks) || 0) + ')'
      + (String(x.row.decay_kind || '') === 'clickthrough' ? ', and it is still shown as often, so the title and description come first' : '')
      + '. It is refreshed, not written again. ' + String(x.row.decay_basis || '').replace(/\s*->\s*/g, ' to ') });
  const sq = qh.filter(q => normD(q.domain) === s.domain && q.query); const latest = sq.reduce((m, q) => String(q.period_end) > m ? String(q.period_end) : m, '');
  // F-KW (finding 5): a brand query names the site's DISTINCTIVE label (fitOwnLabels): on an exact-match domain ("erp-software.ae") the client's
  // own subject ("erp software uae") is not a brand query
  const protectT = [...new Set((fitCtx.protect || []).flatMap(x => fitTokens(x)))];
  const brandQuery = (q) => { const t = fitTokens(q); const sq0 = t.join(''); return fitOwnLabels(s.domain, t, protectT).some(l => t.includes(l) || sq0.includes(l)); };
  const strikes = sq.filter(q => String(q.period_end) === latest && Number(q.position) >= CONFIG.striking_min_position && Number(q.position) <= CONFIG.striking_max_position && Number(q.impressions) >= CONFIG.striking_min_impressions && !brandQuery(q.query) && !recent.has(norm(q.query)) && !ladderKw.has(norm(q.query))).sort((a, b) => Number(b.impressions) - Number(a.impressions));
  // B4-3: a page already queued as a refresh is not queued a second time for one of its other queries — one page, one piece of work
  const decayUrls = new Set(decayCands.map(x => ukeyD(x.row.url)));
  for (const q of strikes) { if (q.page && decayUrls.has(ukeyD(q.page))) continue;
    opps.push({ keyword: q.query, page_type: (q.page && !/\/(blog|news|insights|articles)\//i.test(q.page)) ? 'Service Page' : 'Guide', existing_page_url: q.page || '', source: 'striking', why: 'ranks #' + Math.round(Number(q.position)) + ' with ' + q.impressions + ' impressions in 28 days (Search Console): one push from the top 3' }); }
  const st = trends.filter(t => normD(t.domain) === s.domain && t.direction === 'rising' && t.rising); const latestT = st.reduce((m, t) => String(t.checked_at) > m ? String(t.checked_at) : m, '');
  for (const t of st.filter(t => String(t.checked_at) === latestT)) for (const rq of String(t.rising).split(',').map(x => x.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()).filter(Boolean)) {
    if (recent.has(norm(rq)) || ladderKw.has(norm(rq)) || cands.some(x => norm(x.keyword) === norm(rq)) || opps.some(x => norm(x.keyword) === norm(rq))) continue;
    opps.push({ keyword: rq, page_type: 'Guide', existing_page_url: '', source: 'trend', why: 'rising related search for "' + t.keyword + '" (Google Trends, ' + (t.change_pct > 0 ? '+' : '') + t.change_pct + '% vs the 12-month average)' }); }
  // R-K3: which of these runs on its own at this level. Level 2 needs an existing page AND positive topic evidence; level 3 takes every source
  // the gate let through; level 1 none.
  // F-KW (findings 1, 2, 4): every automatic item needs positive topic evidence (against what the client chose; at level 3 also what the site
  // sells), level 2 also an existing page, and never the homepage or a main menu page
  const autoFor = (o) => AUTO_SOURCES[level].includes(o.source) && o.in_topic === true && !o.main_page && (level === 3 || !!o.existing_page_url);
  const markTopic = (o) => { const ev = evidenceOf(o.keyword); o.in_topic = ev.verdict === 'in'; o.topic_evidence = ev.verdict;
    o.main_page = !!o.existing_page_url && mainPage(o.existing_page_url); if (o.main_page) o.why += MAIN_WHY; return o; };
  const okOpps = [];
  for (const o of opps) { const g = gateOf(o); if (!g.ok) { refuse(o, g); continue; } if (isSkipped(o.keyword)) { noteSkip(o); continue; } okOpps.push(markTopic(o)); }
  // ---- the AI page (v4.12): the most valuable queued AI target the gate lets through, within the month's allowance, one a week ----
  const isAi = (l) => l.source === 'ai_answer' || l.source === 'ai_refresh';
  const aiUsed = slog.filter(l => isAi(l) && String(l.started_at || '').slice(0, 7) === atIso.slice(0, 7)).length;
  const aiThisWeek = slog.some(l => isAi(l) && (at - new Date(l.started_at || 0)) < 6 * 864e5);
  const keyOfU = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const refreshedRecently = new Set(slog.filter(l => l.existing_page_url && (at - new Date(l.started_at || 0)) < 60 * 864e5).map(l => keyOfU(l.existing_page_url)));
  // one search, one page: an AI question that a keyword-ladder page already targets is written AS that ladder page (with the AI target), never twice.
  // Words of the site's ladder heads ("e invoicing in uae") appear everywhere and do not count.
  const STOPW = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best', 'top', 'list', 'guide']);
  const headWords = new Set(lrows.flatMap(l => norm(l.head_keyword).split(' ')).filter(Boolean));
  const kwTok = (k) => [...new Set(norm(k).replace(/\b(e)\b/g, ' ').split(' ').filter(w => w.length > 2 && !STOPW.has(w) && !headWords.has(w)))];
  const sameSearch = (a, b) => { const A = kwTok(a), B = new Set(kwTok(b)); if (!A.length || !B.size) return false; return A.filter(w => B.has(w)).length / A.length >= 0.6; };
  const ladderFor = (t) => lrows.find(l => sameSearch(t.keyword, l.keyword) || sameSearch(l.keyword, t.keyword)) || null;
  const aiTargetOf = (t) => { const parseS = (v) => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }; return { question: t.question, kind: t.kind, target_id: t.target_id, fanout: String(t.fanout || '').split(' | ').filter(Boolean), sources: parseS(t.sources_json), competitors: String(t.competitors || '').split(', ').filter(Boolean) }; };
  const aiCandOf = (t) => ({ keyword: t.keyword, page_type: t.kind === 'refresh' ? 'Service Page' : (t.page_type || 'Guide'), existing_page_url: t.kind === 'refresh' ? t.page_url : '', source: t.kind === 'refresh' ? 'ai_refresh' : 'ai_answer', target_id: t.target_id,
    why: 'AI answers "' + t.question + '" without you' + (t.competitors ? ' (it names ' + String(t.competitors).split(', ').slice(0, 3).join(', ') + ')' : '') + (t.kind === 'refresh' ? ': refresh ' + t.page_url : ': a new answer page'),
    ai_target: aiTargetOf(t) });
  const aiQueue = [];
  for (const t of aiTargets.filter(t => t.site_id === s.site_id && t.keyword && !(t.kind !== 'refresh' && ladderFor(t)) && (t.kind === 'refresh' ? !!t.page_url && !refreshedRecently.has(keyOfU(t.page_url)) : !recent.has(norm(t.keyword)) && !ladderKw.has(norm(t.keyword))))
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))) {
    const o = aiCandOf(t); const g = gateOf(o);   // R-K4: the AI target's keyword passes the same gate (the Techand D365 refresh did not)
    if (!g.ok) { refuse(o, g); continue; }
    if (isSkipped(o.keyword)) { noteSkip(o); continue; }
    aiQueue.push(markTopic(o));
  }
  // F-KW: the client's own subject first (stable: by value inside each group), so the AI page of the week, or the one AI suggestion, is on it
  aiQueue.sort((a, b) => (b.in_topic === true ? 1 : 0) - (a.in_topic === true ? 1 : 0));
  const aiDue = aiQuota > aiUsed && !aiThisWeek;
  // ---- what is written: the ladder pages, then what the client approved for this cycle, then the level's own automatic items ----
  const aiCand0 = aiQueue[0] || null;
  // level 2: an AI refresh of an existing page in topic is one of the level's refreshes (a slot of pages_per_week); level 3: the AI page on top
  const aiAuto2 = level === 2 && aiCand0 && aiDue && aiCand0.source === 'ai_refresh' && !!aiCand0.existing_page_url && aiCand0.in_topic === true && !aiCand0.main_page ? aiCand0 : null;
  const autoOpps = [...okOpps.filter(autoFor), ...(aiAuto2 ? [aiAuto2] : [])];
  // the needs-OK candidates the client may approve: the other opportunities, the AI targets, and the next pages of Manual / not-chosen ladders
  const aiTop3 = level === 3 && aiCand0 && aiCand0.in_topic === true && !aiCand0.main_page ? aiCand0 : null;   // F-KW: the level-3 AI page needs evidence too
  const needOk = [...okOpps.filter(o => !autoFor(o)), ...aiQueue.filter(o => o !== aiAuto2 && o !== aiTop3)];
  // while the site waits for its first keyword the level's automatic items are shown as suggestions (sugPool below), so the client may
  // approve them too: they are approvable then (E4, 2026-10-19)
  const approvable = [...needOk, ...(waiting_for_keyword ? autoOpps : []), ...[...manualL, ...unchosenL].flatMap(x => x.eligible.filter(l => !isSkipped(l.keyword)).map(l => ladderCand(x, l)))];
  const approvedSeen = new Set(); const approval_ambiguous = [];
  // F-KW (finding 9): the approval row that names this item (source / ladder), or a keyword-only row when no other item shares the keyword
  const approvalFor = (o) => { const k = cycleNorm(o.keyword); const rows0 = approveRows.filter(r => cycleNorm(r.item_key) === k); if (!rows0.length) return false;
    if (rows0.some(r => String(r.source || '').trim() && rowFits(r, o))) return true;
    if (!rows0.some(r => !String(r.source || '').trim() && rowFits(r, o))) return false;
    const same = approvable.filter(x => cycleNorm(x.keyword) === k); const kinds = new Set(same.map(x => lc(x.source) + '|' + String(x.ladder_id || '') + '|' + String(x.existing_page_url || '')));
    if (kinds.size > 1) { if (!approval_ambiguous.some(a => a.item_key === k)) approval_ambiguous.push({ item_key: k, keyword: o.keyword, sources: same.map(x => x.source) }); return false; }
    return true; };
  const approved = approvable.filter(o => { const k = cycleNorm(o.keyword); if (approvedSeen.has(k) || !approvalFor(o)) return false; approvedSeen.add(k); return true; })
    .map(o => ({ ...o, approved: true, why: o.why + '; approved by you for this cycle' }));
  cands.push(...approved, ...autoOpps.filter(o => !approvedSeen.has(cycleNorm(o.keyword))));
  // D11: one search, one page — a candidate a live page of the site already answers is written as a refresh of that page (ladder) or left out
  const invRows = pageRows.filter(r => r.site_id === s.site_id);
  const invModel = invRows.length ? SM.from({ site_id: s.site_id, domain: s.domain }, { pages: invRows }) : null;
  const ukeyP = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const covered = [];
  const coverOf = (x) => { if (!invModel || x.existing_page_url) return null; const m = SM.matchPage(invModel, x.keyword); return (m && ukeyP(m.url) !== ukeyP(x.existing_page_url)) ? m : null; };
  const seen = new Set(); const uniq = cands.filter(x => { const k = norm(x.keyword); if (!k || seen.has(k)) return false; seen.add(k);
    const c = coverOf(x); if (!c) return true;
    covered.push({ keyword: x.keyword, source: x.source, url: c.url, matched_by: c.matched_by });
    if (x.source !== 'ladder') return false;   // an opportunity post would be a second page for the same search
    x.existing_page_url = c.url; x.covered_by = c.url; x.why += '; ' + c.url + ' already answers this search, so it is refreshed, not written again';
    return true; });
  // pile-up guard (v4.14, FIX_PLAN D5): every page written and not published counts, each keyword once — the content log rows that say
  // `written` (in the last 120 days) AND the ladder rows still 'writing' whose keyword has such a row and no published page.
  // R1 / R111 / A-20: the rule itself lives in v5/code/_waiting.js (WAITING.waiting), so the ladder mode counts the same pages
  const WAITS = WAITING.WAITS;   // R111: const WAITS = new Set(['written', 'not_ready']); - a failed draft still waits, labelled "needs a fix"
  const W = WAITING.waiting({ log: slog, ladders: lrows, now: Number(at), days: CONFIG.waiting_days });
  const waiting = W.list;
  const waitingKw = W.keys;
  const pileup = waitingKw.size >= cfg.max_waiting;
  const paused_reason = pileup && !force ? 'pileup' : '';
  // ---- R-K7: one cycle, one budget. A ladder start writes its first page(s) at once (Spawn Page Runs); those, and the pages an earlier run
  // of this cycle's cadence started (a retry after a crash), count against pages_per_week. Evidence, not a guess (R1's rule): a page counts
  // when the content log says it exists (written / not ready / published) in the window, or while its run is IN FLIGHT - a content-log row
  // that says `started`, or a ladder row the start marked `writing` with no log row yet, younger than `in_flight_hours` (a page run takes
  // 10-15 minutes). An older `started` row is a run that never finished: it wrote nothing, so it spends nothing.
  const inWin = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && v >= windowStart; };
  const inFlight = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && (Number(at) - v) < CONFIG.in_flight_hours * 36e5; };
  // F-KW (finding 6): a page a LADDER START wrote counts against the first cadence run after it, wherever in the cycle it happened. Inside a
  // cycle that is every start since the previous cycle's cadence ran (seo_cycle_jobs started_at of the newest earlier content_cadence job,
  // else that cycle's due time, else this cycle's due time minus 7 days): a start before that run was counted by it, one after it (a mid-cycle
  // start by the client, or a level-3 announcement) is this cycle's. Outside a cycle: the last six days, as before.
  const prevJob = isCycle && Number.isFinite(schedT) ? cycleJobRows.filter(r => r.site_id === s.site_id && String(r.cycle_key || '') !== cycle_key
    && Number.isFinite(Date.parse(String(r.due_at || r.started_at || ''))) && Date.parse(String(r.due_at || r.started_at || '')) < schedT)
    .sort((a, b) => String(b.due_at || b.started_at || '').localeCompare(String(a.due_at || a.started_at || '')))[0] || null : null;
  const prevRan = prevJob ? (Date.parse(String(prevJob.started_at || '')) || Date.parse(String(prevJob.due_at || ''))) : NaN;
  const startWindow = isCycle && Number.isFinite(schedT) ? Math.min(schedT, Number.isFinite(prevRan) ? prevRan : schedT - CONFIG.cycle_days * 864e5) : windowStart;
  const inStartWin = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && v >= startWindow && v <= Number(at); };
  const EXISTS = new Set(['written', 'not_ready', 'published']);
  const spentKeys = new Map();
  const spend = (kw, how) => { const k = norm(kw); if (k && !spentKeys.has(k)) spentKeys.set(k, how); };
  for (const l of slog) { const rid = String(l.request_id || ''); const own = /^cad_/.test(rid);
    if (own ? !inWin(l.started_at) : !inStartWin(l.started_at)) continue;   // F-KW: this cycle's cadence runs from its due time; ladder starts since the last cadence run
    if (!own && String(l.source || '') !== 'ladder') continue;   // the app's "Write it" is a page the client asked for on top: not the autopilot's budget
    const st = String(l.status || '');
    if (EXISTS.has(st) || String(l.published_url || '').trim() || (st === 'started' && inFlight(l.started_at))) spend(l.keyword, own ? 'this cycle\'s cadence' : 'ladder start'); }
  for (const l of lrows) if (WAITING.LADDER_WRITTEN.has(l.status) && inStartWin(l.start_date) && inFlight(l.start_date) && !/^cad_/.test(String(l.request_id || ''))
    && !slog.some(g => norm(g.keyword) === norm(l.keyword) && inStartWin(g.started_at))) spend(l.keyword, 'ladder start (being written)');
  const spent = spentKeys.size;
  const room = Math.max(0, pages - spent);
  const budget = { pages_per_week: pages, spent, room, window_start: new Date(windowStart).toISOString(), ladder_start_window: new Date(startWindow).toISOString(),
    window: isCycle && Number.isFinite(schedT) ? 'this cycle (from its due time; ladder starts since the previous cadence run)' : 'the last ' + CONFIG.cycle_window_days + ' days',
    spent_keywords: [...spentKeys.entries()].slice(0, 10).map(([k, how]) => ({ keyword: k, how })) };
  const blocked = !!paused_reason || waiting_for_keyword;   // R-K2: at levels 1 and 2 nothing the SYSTEM chooses is written before the first chosen keyword
  // ... but an item the client approved for this cycle is the client's own choice: it is written while the site waits for its first keyword,
  // within the budget (pages_per_week), skips first (an approved item that is also skipped never reached `approved`). The pile-up guard holds it.
  const pickable = paused_reason ? [] : waiting_for_keyword ? uniq.filter(x => x.approved) : uniq;
  const picks = pickable.slice(0, room);
  // v4.12: the AI page of the week ON TOP of the pages a week — level 3 only, within the month's allowance, one a week, never while the
  // pile-up guard holds, and never for a site set to 0 pages a week
  for (const p of picks) if (p.source === 'ladder' && !p.ai_target) { const t = aiTargets.find(x => x.site_id === s.site_id && x.status === 'queued' && x.kind !== 'refresh' && (sameSearch(x.keyword, p.keyword) || sameSearch(p.keyword, x.keyword))); if (t) { p.ai_target = aiTargetOf(t); p.target_id = t.target_id; p.why += '; written to answer "' + t.question + '" in AI answers'; } }
  const aiCand = aiCand0 && !picks.some(x => norm(x.keyword) === norm(aiCand0.keyword)) ? aiCand0 : null;
  const aiPick = level === 3 && pages > 0 && aiCand && aiCand === aiTop3 && aiDue && !blocked ? aiCand : null;
  if (aiPick) picks.push(aiPick);
  // ---- suggestions: every needs-OK candidate the gate let through, not skipped, not written this run — with its price (max 5, AI first) ----
  const pickedK = new Set(picks.map(p => norm(p.keyword)));
  const sugSeen = new Set();
  const sugPool = [...(aiCand && aiDue && aiCand !== aiPick && aiCand !== aiAuto2 ? [aiCand] : []), ...needOk.filter(o => !isAi(o)), ...autoOpps.filter(o => !pickedK.has(norm(o.keyword)) && blocked)];
  const suggestions = sugPool.filter(o => { const k = norm(o.keyword); if (!k || sugSeen.has(k) || pickedK.has(k) || approvedSeen.has(k)) return false; sugSeen.add(k);   // an approved item is upcoming, not a suggestion
      if (coverOf(o)) { if (!covered.some(c => norm(c.keyword) === k)) { const c = coverOf(o); covered.push({ keyword: o.keyword, source: o.source, url: c.url, matched_by: c.matched_by }); } return false; }   // D11: never suggest a second page for a search a live page answers
      return true; })
    .slice(0, CONFIG.suggestions).map(o => itemOf(o, false));
  const pickedU = new Set(picks.map(p => norm(p.keyword)));   // the AI page (v4.12) is not one of uniq
  const upcoming = uniq.filter(x => !pickedU.has(norm(x.keyword))).slice(0, CONFIG.upcoming).map(x => ({ keyword: x.keyword, source: x.source, why: x.why }));
  const pending = waiting.filter(w => !w.needs_fix).map(w => ({ keyword: w.keyword, started_at: w.written_at, days: Math.round((at - new Date(w.written_at || atIso)) / 864e5) })).filter(p => p.days >= CONFIG.publish_reminder_days);   // D5: ladder pages are in `waiting` too; R111: a failed draft is never a publish reminder
  const needs_fix = waiting.filter(w => w.needs_fix).map(w => ({ keyword: w.keyword, written_at: w.written_at, reasons: w.reasons || [] }));   // R111
  const awaitOf = (x, why) => { const l = x.eligible.find(r => !isSkipped(r.keyword) && !approvedSeen.has(cycleNorm(r.keyword))); if (!l) return null;
    return { ladder_id: x.id, head: x.head, keyword: l.keyword, rung: Number(l.rung) || 0, page_no: Number(l.page_no) || 0, page_type: l.page_type || 'Service Page', existing_page_url: l.page_exists ? (l.target_url || '') : '',
      item_key: cycleNorm(l.keyword), est_usd: EST_PAGE_USD, chosen_by: x.chosen_by, ...(why ? { why } : {}) }; };
  const RECHECK_WHY = 'checking this keyword again before writing: it was planned more than ' + CONFIG.recheck_days + ' days ago';
  const awaiting_approval = [...manualL.map(x => awaitOf(x, '')), ...unchosenL.map(x => awaitOf(x, x.chosen_by === 'system_announced'
      ? 'a keyword we announced: its pages are written on their own only at full autopilot (level 3)' : 'a ladder whose keyword you did not choose (' + (x.chosen_by || 'unknown') + '): its pages wait for your OK')),
    ...recheckL.map(x => { const a = awaitOf(x, RECHECK_WHY); return a ? { ...a, recheck: true } : null; })].filter(Boolean);
  // F-KW (finding 3b): the ladders that wait for the app's fresh Keyword Check (the app checks the head keyword and writes rechecked_at, or pauses it)
  const recheck_ladders = recheckL.map(x => ({ ladder_id: x.id, head: x.head, planned_at: x.start, reason: RECHECK_WHY }));
  // an approval that is not written this cycle, with the reason: the pile-up guard, the budget, or a live page already answering its search
  const approved_not_written = approved.filter(o => !pickedU.has(norm(o.keyword))).map(o => ({ keyword: o.keyword, source: o.source,
    reason: paused_reason || (covered.some(c => norm(c.keyword) === norm(o.keyword)) ? 'covered_by_live_page' : 'budget') }))
    .concat(approval_ambiguous.map(a => ({ keyword: a.keyword, source: '', reason: 'ambiguous', detail: 'your approval names only the keyword, and ' + a.sources.length + ' different pages share it (' + a.sources.join(', ') + '): approve the one you want again' })));
  const facts = { set_aside, refused, covered_by_live_pages: covered.slice(0, 10), paused_reason, waiting_publish: waitingKw.size,
    needs_fix, needs_fix_keywords: needs_fix.map(w => w.keyword),   // R111: of the waiting pages, the drafts that failed their quality check
    paused_ladders: info.filter(x => x.head_aside).map(x => ({ ladder_id: x.id, head: x.head, reason: x.head_aside.reason })),   // R87
    // B4-3: what the week knows about pages losing traffic, whether or not one was picked — `decaying` is how many the Site
    // Tracker's test confirmed, `skipped` how many of those were left alone (refreshed recently, or no search to refresh for)
    decay: { decaying: decayRows.length, queued: decayCands.length, skipped: decay_skipped,
      pages: decayCands.map(x => ({ url: x.row.url, keyword: x.q.query, lost: x.lost, kind: String(x.row.decay_kind || ''), basis: String(x.row.decay_basis || '') })) }, waiting_keywords: waiting.map(w => w.keyword).slice(0, 20), max_waiting: cfg.max_waiting, pileup_forced: pileup && force, opportunities: cfg.opportunities, awaiting_approval, suggestions,
    // keyword-first (2026-10-19): the level, whether the site still waits for its first keyword, the cycle, the budget, the client's decisions
    cycle_request_id, level, auto_sources: AUTO_SOURCES[level], waiting_for_keyword, client_ladders: clientLadders.length, cycle_key, cycle_date, scheduled_for, trigger: trigger_kind, budget,
    skipped, approved_items: approved.map(o => ({ keyword: o.keyword, source: o.source, item_key: cycleNorm(o.keyword) })), approved_not_written, est_page_usd: EST_PAGE_USD, est_basis,
    not_chosen_ladders: unchosenL.map(x => ({ ladder_id: x.id, head: x.head, chosen_by: x.chosen_by })), recheck_ladders,
    ai_pages: { per_month: aiQuota, used_this_month: aiUsed, this_week: !!aiPick, next: aiCand ? { keyword: aiCand.keyword, source: aiCand.source, target_id: aiCand.target_id, why: aiCand.why } : null, queued: aiQueue.length, on_top: level === 3 },
    queued_ladders: queued.map(x => ({ ladder_id: x.id, head: x.head, priority: Number.isFinite(x.priority) ? x.priority : null, reason: 'max_active' })),
    won_ladders: info.filter(x => x.won || x.status === 'won').map(x => ({ ladder_id: x.id, head: x.head, position: x.head_position, checks: x.won_checks })),
    waiting_for_support: info.filter(x => x.main_waiting && ['active', 'queued'].includes(x.status) && !x.won).map(x => ({ ladder_id: x.id, head: x.head, published: x.published, supporting: x.support, needed: Math.ceil(x.support / 2), head_position: x.head_position })) };
  const ridOf = (i) => 'cad_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_' + i;
  // ---- preview: ONE item per site, what the cycle would write — nothing is started, logged or marked ----
  if (preview) {
    const items = [...picks.map(p => itemOf(p, true)), ...awaiting_approval.map(a => itemOf({ ...a, source: 'ladder', why: a.why || 'the next page of your ladder "' + a.head + '": it waits for your OK' }, false))];
    const reasonP = waiting_for_keyword ? 'waiting for your first keyword: choose the keyword you want to be found for' + (picks.length ? '; until then only what you approved is written' : ', nothing is written until then')
      : paused_reason ? waitingKw.size + ' written pages are waiting to be published (limit ' + cfg.max_waiting + '): nothing new is written until they are'
      : !pages ? 'no pages a week are set for this website' : !picks.length ? 'nothing to write automatically in this cycle' : '';
    out.push({ json: { preview: true, dry_run: true, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '',
      request_id: cycle_request_id || 'prev_' + week.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), pages_per_week: pages, items, reason: reasonP, upcoming, pending_publish: pending, candidates: uniq.length, week,
      est_ai_usd: 0, est_dfs_usd: 0, ...facts } });   // a preview spends nothing: the run ledger reserves 0 for it
    continue;
  }
  picks.forEach((p, i) => { const request_id = ridOf(spent + i + 1);
    out.push({ json: { site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', source: p.source, keyword: p.keyword, page_type: p.page_type, existing_page_url: p.existing_page_url || '', ladder_id: p.ladder_id || '', rung: p.rung || 0, page_no: p.page_no || 0, target_id: p.target_id || '', why: p.why, request_id, pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, item_key: cycleNorm(p.keyword), auto: !p.approved, approved: !!p.approved, est_usd: EST_PAGE_USD, ...facts,
      body: { mode: 'keyword', keyword: p.keyword, page_type: p.page_type, country: s.country || '', domain: s.domain, receive: ['Keyword Report', 'Page Content'], existing_page_url: p.existing_page_url || '', email: s.email || '', callback_url: s.callback_url || '', request_id, client_ip: 'cadence:' + s.site_id, force_content: true,
        ...(p.ai_target ? { ai_target: p.ai_target } : {}),
        ...(p.source === 'ladder' ? { ladder_id: p.ladder_id, ladder_rung: p.rung, ladder_head: p.head, ladder_page_no: p.page_no, ladder_target_url: p.target_url || '', ladder_links: (p.links || []).map(l => ({ url: l.url, path: String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/', role: l.role, keyword: l.keyword, planned: true })) } : {}) } } }); });
  const dropped = set_aside.filter(x => x.dropped);   // R16: a rung nobody should write is a reason to report, not to go quiet
  if (!picks.length && (isCycle || paused_reason || waiting_for_keyword || awaiting_approval.length || suggestions.length || facts.waiting_for_support.length || dropped.length || facts.paused_ladders.length)) {
    const fixK = new Set(needs_fix.map(w => norm(w.keyword)));
    const reason = waiting_for_keyword ? 'waiting for your first keyword: choose the keyword you want to be found for, nothing is written until you do'
        + (suggestions.length ? ' (' + suggestions.length + ' suggestion' + (suggestions.length === 1 ? '' : 's') + ' wait for your OK)' : '')
      : paused_reason ? waitingKw.size + ' written pages waiting for publication (pile-up guard, limit ' + cfg.max_waiting + '): ' + facts.waiting_keywords.slice(0, 6).map(k => '"' + k + '"' + (fixK.has(norm(k)) ? (() => { const cv = coverOf({ keyword: k }); return cv ? ' (not needed: ' + SM.pageStep({ keyword: k, covered_url: cv.url, not_ready: true }).text + ')' : ' (needs a fix: it did not pass the quality check)'; })() : '')).join(', ')
        + (needs_fix.length ? '. Publish the ones that passed, and fix the ' + needs_fix.length + ' that need a fix and run them again, to continue' : '. Publish them to continue')
      : !pages ? 'no pages a week are set for this website, so nothing is written at any autopilot level'
      : (pages && !room && spent) ? 'this cycle\'s ' + pages + ' page' + (pages === 1 ? '' : 's') + ' a week ' + (spent === 1 ? 'is' : 'are') + ' already used: ' + budget.spent_keywords.map(x => '"' + x.keyword + '" (' + x.how + ')').join(', ')
      : dropped.length ? 'nothing to write automatically this week; ' + dropped.length + ' planned page(s) set aside: ' + dropped.slice(0, 3).map(x => x.note).join(' | ')
      : 'nothing to write automatically this week';
    out.push({ json: { nothing_to_do: true, report_only: true, reason, site_id: s.site_id, domain: s.domain, email: s.email || '', callback_url: s.callback_url || '', country: s.country || '', request_id: cycle_request_id || ridOf(0),
      pages_per_week: pages, upcoming, pending_publish: pending, candidates: uniq.length, dry_run, week, ...facts } });
  }
}
if (!out.length) return [{ json: { nothing_to_do: true, reason: scoped ? 'nothing to write for "' + want + '" (not a tracked website, or no cadence set, nothing planned, or everything written recently)' : 'no site has a content cadence this week', sites: list.length, dry_run, ...(preview ? { cycle_key } : {}) } }];
return out;
