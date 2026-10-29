// Index coverage (2026-10-29, docs/indexing-2026-10-29/DESIGN.md; fix wave 1, FIX_CONTRACT.md decision 1): what THIS execution does.
// One execution per website (X1 / E6): a run that held every site in one execution timed out past ~6 sites, saved nothing, and the catch-up
// replayed it, re-spending the cap. Three ways in:
//  * the DISPATCH (the daily schedule, the catch-up, or a Manual Run that names no website): the tracked websites whose index watch is on,
//    oldest checked first, minus the ones already checked today. It inspects nothing itself: it reads Google's news once and starts the
//    first website's own execution; each website's execution saves its rows and then starts the next one (`ix_chain`), so one website runs
//    at a time (plus the dispatch's few seconds: at most two at once) and each holds one run-guard slot.
//  * a CHAIN PART (`ix_chain` + `site_id` on the trigger): one website of today's chain, with the scheduled rules (Mondays, drop-outs, news).
//  * ON DEMAND (`domain` or `site_id`, no chain): one website now; its callback is always sent.
// The daily cap is the site's own (index_daily_cap, empty = 300, kept 20-1,200) minus what TODAY's runs of it already inspected or reserved
// (seo_index_runs: every run writes its reservation row BEFORE inspecting, so a crashed or replayed run counts what it may have spent).
// A run that hit Google's DAILY quota earlier today inspects nothing more today. Free: no paid API, no model.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) { trigger = {}; }
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const S = (v) => String(v == null ? '' : v).trim();
const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const now = Date.now(); const today = new Date(now).toISOString().slice(0, 10); const run_at = new Date(now).toISOString();
const sites = rowsOf('Load Sites (Index)').filter(r => r.site_id && r.domain);
const mons = rowsOf('Load Monitors (Index)');
const runs = rowsOf('Load Index Runs').filter(r => r.site_id);
const chain = trigger.ix_chain && typeof trigger.ix_chain === 'object' ? trigger.ix_chain : null;
const want = normD(trigger.domain) || S(trigger.site_id);
const on_demand = !!want && !chain;
const flag = (v, dflt) => (v === undefined || v === null || v === '') ? dflt : !(v === false || /^(false|0|no|off)$/i.test(String(v)));
const runsOf = (sid) => runs.filter(r => S(r.site_id) === sid).sort((a, b) => S(b.run_at).localeCompare(S(a.run_at)));
const json = (v) => { if (v && typeof v === 'object') return v; try { return JSON.parse(S(v) || '{}') || {}; } catch (e) { return {}; } };
const monOf = (s) => mons.find(x => S(x.site_id) === S(s.site_id)) || {};
const live = (s) => !/^(paused|deleted|inactive)$/i.test(S(s.status));

// ---- the dispatch: today's chain of websites ----
if (!want && !chain) {
  const seen = new Set(); const list = []; const served = [];
  for (const s of sites) {
    const d = normD(s.domain); if (!d || seen.has(d)) continue; seen.add(d);
    if (!live(s) || !flag(monOf(s).index_watch, true)) continue;
    const mine = runsOf(S(s.site_id));
    if (mine.some(r => S(r.run_at).slice(0, 10) === today)) { served.push(d); continue; }   // checked (or reserved) today already: a replay adds nothing
    list.push({ site_id: S(s.site_id), domain: d, last: S((mine[0] || {}).run_at) });
  }
  list.sort((a, b) => a.last.localeCompare(b.last) || a.domain.localeCompare(b.domain));   // oldest check first: a chain broken yesterday goes first today
  if (!list.length) return [{ json: { nothing_to_do: true, skip: true, reason: served.length ? 'every tracked website with the index watch on was already checked today (' + served.length + ')' : 'no tracked website has the index watch on', sites: sites.length } }];
  return [{ json: { dispatch: true, chain: list.map(x => x.site_id), domains: list.map(x => x.domain), served_today: served, run_at, trigger: S(trigger.trigger) } }];
}

// ---- one website: a chain part or an on-demand run ----
const s = sites.find(x => normD(x.domain) === want || S(x.site_id) === want) || null;
const why = !s ? 'no tracked website matches "' + want + '"' : (chain && !live(s)) ? normD(s.domain) + ' is paused' : (chain && !flag(monOf(s).index_watch, true)) ? 'the index watch of ' + normD(s.domain) + ' is off' : '';
if (why) return [{ json: { nothing_to_do: true, skip: true, reason: why, chain_part: chain ? (Number(chain.part) || 1) : 0 } }];
const m = monOf(s);
const sid = S(s.site_id);
const cap = IX.capOf(trigger.cap !== undefined && on_demand ? trigger.cap : m.index_daily_cap);
const mine = runsOf(sid);
const todays = mine.filter(r => S(r.run_at).slice(0, 10) === today);
const used_today = todays.reduce((t, r) => t + (Number(r.inspected) || 0), 0);
const quota_hit = todays.some(r => /daily URL Inspection quota/i.test(S(r.note)));
// E3: the run before this one, and whether it read the sitemap tree completely (a page first seen in a sitemap is `new` only after such a run)
const prev = mine.find(r => S(r.run_at) < run_at) || null;
const pj = prev ? json(prev.sitemaps_json) : {};
return [{ json: { site_id: sid, domain: normD(s.domain), canonical_host: S(s.canonical_host), gsc_property_hint: S(s.gsc_property),
  callback_url: S(trigger.callback_url) || S(s.callback_url), request_id: S(trigger.request_id) || S(s.request_id), cap, used_today, quota_hit, on_demand,
  index_watch: flag(m.index_watch, true), trigger: S(trigger.trigger), run_at,
  prev_complete: pj.complete === true, prev_complete_at: pj.complete === true ? S(prev.run_at) : '', home_host_prev: S(pj.home_host),
  chain_part: chain ? (Number(chain.part) || 1) : 0 } }];
