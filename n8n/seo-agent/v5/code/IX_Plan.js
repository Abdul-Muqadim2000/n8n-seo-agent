// Index coverage (2026-10-29, docs/indexing-2026-10-29/DESIGN.md): the websites this run checks. Every tracked website (seo_sites) whose index
// watch is not switched off (seo_monitors.index_watch: empty = on) gets one item; Search Console access is resolved after the Google events step
// (Index Sites). The daily cap is the site's own (index_daily_cap, empty = 300, kept 20-1,200) minus what earlier runs of TODAY already
// inspected (seo_index_runs), so a second run the same day (on demand, or a catch-up) never spends more than the day's share. A run that hit
// Google's quota earlier today inspects nothing more today. Free: no paid API, no model.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) { trigger = {}; }
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const S = (v) => String(v == null ? '' : v).trim();
const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const now = Date.now(); const today = new Date(now).toISOString().slice(0, 10);
const sites = rowsOf('Load Sites (Index)').filter(r => r.site_id && r.domain);
const mons = rowsOf('Load Monitors (Index)');
const runs = rowsOf('Load Index Runs').filter(r => r.site_id);
const want = normD(trigger.domain) || S(trigger.site_id);
const on_demand = !!want;
const flag = (v, dflt) => (v === undefined || v === null || v === '') ? dflt : !(v === false || /^(false|0|no|off)$/i.test(String(v)));
const seen = new Set(); const out = [];
for (const s of sites) {
  const d = normD(s.domain); if (!d || seen.has(d)) continue;
  if (want && d !== want && S(s.site_id) !== want) continue;
  if (!want && /^(paused|deleted|inactive)$/i.test(S(s.status))) continue;
  const m = mons.find(x => S(x.site_id) === S(s.site_id)) || {};
  if (!flag(m.index_watch, true) && !on_demand) continue;
  seen.add(d);
  const cap = IX.capOf(trigger.cap !== undefined && on_demand ? trigger.cap : m.index_daily_cap);
  const mine = runs.filter(r => S(r.site_id) === S(s.site_id) && S(r.run_at).slice(0, 10) === today);
  const used_today = mine.reduce((t, r) => t + (Number(r.inspected) || 0), 0);
  const quota_hit = mine.some(r => /quota/i.test(S(r.note)));
  out.push({ json: { site_id: S(s.site_id), domain: d, canonical_host: S(s.canonical_host), gsc_property_hint: S(s.gsc_property), callback_url: S(trigger.callback_url) || S(s.callback_url),
    request_id: S(trigger.request_id) || S(s.request_id), cap, used_today, quota_hit, on_demand, index_watch: flag(m.index_watch, true), trigger: S(trigger.trigger) } });
}
if (!out.length) return [{ json: { nothing_to_do: true, skip: true, reason: want ? 'no tracked website matches "' + want + '"' : 'no tracked website has the index watch on', sites: sites.length } }];
return out;
