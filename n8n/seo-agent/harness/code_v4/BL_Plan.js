// Backlink monitor plan (weekly Monday 07:30; the first run of each month is the FULL run, the others are LIGHT): per site the window since the
// last check, the competitors (configured, else found once through DataForSEO Labs and kept), the brand names for mention search, the pages
// worth pitching (ladder top / published pages, case studies) and the existing prospects. Light runs only watch for lost and spammy links
// and stay quiet unless something important happened.
// ---- shared by the monitors (AI Visibility Tracker, Backlink Monitor, Audit Scheduler; inlined by the build): which sites, with which settings ----
// Sites = the Data Table seo_sites ("Track my site") + every domain with a keyword ladder; settings per site from seo_monitors (defaults: everything on).
// On demand (Manual Run with { domain | site_id }) one site runs even when its weekly / monthly monitor is off; an untracked domain is checked ad hoc
// with the trigger's country, e-mail and callback.
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const siteIdFor = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const flag = (v, dflt) => (v === undefined || v === null || v === '') ? dflt : !(v === false || /^(false|0|no|off)$/i.test(String(v)));
const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];
function monitorSites(kind) {   // kind: 'ai' | 'backlinks' | 'audit'
  const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), ladders = rowsOf('Load Ladders').filter(r => r.domain), mons = rowsOf('Load Monitors'), profiles = rowsOf('Load Profiles');
  const byDomain = new Map();
  for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d, keywords: listOf(s.keywords).map(k => k.toLowerCase()), virtual: false }); }
  for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: siteIdFor(d), domain: d, country: l.country || '', location_code: Number(l.location_code) || 0, language_code: l.language_code || 'en', email: l.email || '', callback_url: l.callback_url || '', keywords: [], status: 'active', source: 'ladder', virtual: true }); }
  for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
  const want = normD(trigger.domain) || String(trigger.site_id || '').trim();
  let list = [...byDomain.values()];
  if (want) {
    list = list.filter(s => s.domain === want || s.site_id === want);
    if (!list.length && normD(trigger.domain)) list = [{ site_id: siteIdFor(normD(trigger.domain)), domain: normD(trigger.domain), country: trigger.country || '', location_code: Number(trigger.location_code) || 0, language_code: trigger.language_code || 'en', email: '', callback_url: '', keywords: [], status: 'active', source: 'adhoc', virtual: true, adhoc: true }];
  } else list = list.filter(s => String(s.status || 'active') !== 'paused');
  const out = list.map(s => {
    const m = mons.find(x => x.site_id === s.site_id) || {};
    const p = profiles.find(x => x.site_id === s.site_id) || {};
    const engines = listOf(m.ai_engines).map(e => e.toLowerCase()).filter(e => DEFAULT_ENGINES.includes(e));
    const settings = { ai_visibility: flag(m.ai_visibility, true), backlinks: flag(m.backlinks, true), audit_monthly: flag(m.audit_monthly, true), engines: engines.length ? engines : DEFAULT_ENGINES,
      prompts_max: Math.min(15, Math.max(3, Number(m.ai_prompts_max) || 8)), audit_pages: Math.min(1000, Math.max(50, Number(m.audit_pages) || 200)), audit_js: flag(m.audit_js, false),
      competitors: [...new Set([...listOf(m.competitors), ...listOf(trigger.competitors)].map(normD).filter(d => d && d !== s.domain))].slice(0, 5),
      brand_names: [...new Set([...listOf(m.brand_names), ...listOf(trigger.brand_names), p.business_name || ''].map(x => String(x).trim()).filter(Boolean))], stored: !!m.site_id };
    const o = { ...s, settings, profile: { business_name: p.business_name || '', business_type: p.business_type || '', city: p.city || '', phone: p.phone || '', street_address: p.street_address || '', author_name: p.author_name || '' } };
    if (want) { if (trigger.email) o.email = trigger.email; if (trigger.callback_url) o.callback_url = trigger.callback_url; if (trigger.country) o.country = trigger.country; if (Number(trigger.location_code)) o.location_code = Number(trigger.location_code); if (trigger.language_code) o.language_code = trigger.language_code; }
    o.request_id = String(trigger.request_id || s.request_id || '');
    return o;
  });
  const flagOf = { ai: 'ai_visibility', backlinks: 'backlinks', audit: 'audit_monthly' }[kind];
  return { list: want ? out : out.filter(s => s.settings[flagOf]), on_demand: !!want, want, trigger, total: byDomain.size };
}

const CONFIG = { max_sites_per_run: 15, first_lookback_days: 30 };
const { list, on_demand, want, total } = monitorSites('backlinks');   // `trigger` comes from the shared snippet
if (!list.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'the backlink monitor is switched off for every site' : 'no sites yet (register one through "Track my site" or plan a keyword ladder)') } }];
const snaps = rowsOf('Load Backlink Snapshots'), prospects = rowsOf('Load Link Prospects'), ladders = rowsOf('Load Ladders'), logs = rowsOf('Load Content Log'), cases = rowsOf('Load Case Studies');
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const dfs = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' +00:00';
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const mine = snaps.filter(x => x.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const last = mine[0] || null, lastFull = mine.find(x => x.mode === 'full') || null;
  const mode = on_demand ? (trigger.light ? 'light' : 'full') : ((!lastFull || String(lastFull.checked_at).slice(0, 7) !== month) ? 'full' : 'light');
  const since = last ? dfs(last.checked_at) : dfs(now.getTime() - CONFIG.first_lookback_days * 864e5);
  const kept = lastFull ? (parse(lastFull.competitors_json, []) || []).map(c => c.domain).filter(Boolean) : [];
  const competitors = (s.settings.competitors.length ? s.settings.competitors : kept).slice(0, 3);
  const lad = ladders.filter(l => normD(l.domain) === s.domain && l.target_url && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true'));
  const assets = [...lad.sort((a, b) => (Number(b.rung) || 0) - (Number(a.rung) || 0)).map(l => ({ url: l.target_url, title: l.keyword, kind: Number(l.rung) === 4 ? 'hub page' : 'guide' })),
    ...cases.filter(c => c.site_id === s.site_id && c.page_url).map(c => ({ url: c.page_url, title: c.title, kind: 'case study' })),
    ...logs.filter(l => normD(l.domain) === s.domain && l.published_url).map(l => ({ url: l.published_url, title: l.keyword, kind: 'article' }))].filter((a, i, arr) => arr.findIndex(b => b.url === a.url) === i).slice(0, 8);
  const brand = [...new Set([s.domain, s.profile.business_name].filter(b => b && (b.includes('.') || b.split(/\s+/).length >= 2 || b.length >= 8)))];
  return { json: { site_id: s.site_id, domain: s.domain, country: s.country || '', location_code: Number(s.location_code) || 2840, language_code: s.language_code || 'en', email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '',
    on_demand, adhoc: !!s.adhoc, mode, since, competitors, need_competitors: mode === 'full' && !competitors.length, business_name: s.profile.business_name || '', brand_names: brand, assets,
    previous: last ? { checked_at: last.checked_at, mode: last.mode, rank: Number(last.rank) || 0, backlinks: Number(last.backlinks) || 0, referring_domains: Number(last.referring_domains) || 0, spam_score: Number(last.spam_score) || 0, broken_backlinks: Number(last.broken_backlinks) || 0 } : null,
    existing_prospects: prospects.filter(p => p.site_id === s.site_id).length, checked_at: iso } };
});
