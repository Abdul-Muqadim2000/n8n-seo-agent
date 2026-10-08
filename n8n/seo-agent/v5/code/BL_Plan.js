// Backlink monitor plan (weekly Monday 07:30; the first run of each month is the FULL run, the others are LIGHT): per site the window since the
// last check, the competitors (configured, else found once through DataForSEO Labs and kept), the brand names for mention search, the pages
// worth pitching (ladder top / published pages, case studies) and the existing prospects. Light runs only watch for lost and spammy links
// and stay quiet unless something important happened.
// v4.10 (BACKLINKS_SPEC.md): DataForSEO is one source among several. The plan also carries what the free sources need — the GA4 property
// (referral visits = links that send people), the uploaded Search Console link exports, Bing Webmaster Tools (when its key is set), the brand
// query for news / web mentions, the topics for "best X" list pages and the Link Analyst — and the ledger of links already known.
// On demand with free_only (API): the free sources and the link check only — no DataForSEO, no Claude, $0.
/*__MONITOR_SITES__*/
/*__COUNTRIES__*/
const CONFIG = { max_sites_per_run: 15, first_lookback_days: 30, gap_every_days: 85, bing: __BING_ENABLED__ };   // v4.6: the link gap changes slowly: refreshed quarterly; bing: set at build time when SEO_BING_WEBMASTER_API_KEY is in n8n/.env
const { list, on_demand, want, total } = monitorSites('backlinks');   // `trigger` comes from the shared snippet
if (!list.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'the backlink monitor is switched off for every site' : 'no sites yet (register one through "Track my site" or plan a keyword ladder)') } }];
const snaps = rowsOf('Load Backlink Snapshots'), prospects = rowsOf('Load Link Prospects'), ladders = rowsOf('Load Ladders'), logs = rowsOf('Load Content Log'), cases = rowsOf('Load Case Studies');
const ledger = rowsOf('Load Backlinks'), imports = rowsOf('Load Link Imports');
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const dfs = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' +00:00';
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
const countryOf = (code) => { const e = Object.entries(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(([, c]) => Number(c.code) === Number(code)); return e ? { name: e[0], iso: String(e[1].iso || '').toUpperCase() } : { name: '', iso: '' }; };
const STOP = /^(the|and|for|with|from|your|our|best|top|how|what|why|guide|services?|company|solutions?|in|of|to|a|an|uae|dubai|near|me)$/i;
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const mine = snaps.filter(x => x.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const free_only = on_demand && /^(true|1|yes|on)$/i.test(String(trigger.free_only ?? ''));
  // a free check reads no DataForSEO: it must not move "changes since" (the next paid run would skip DataForSEO's new / lost links in between),
  // and counts compare like with like — DataForSEO figures with the last DataForSEO run, all-source counts with the last run of the same kind
  const last = mine.find(x => x.mode !== 'free') || null, lastFull = mine.find(x => x.mode === 'full') || null, lastSame = mine.find(x => (x.mode === 'free') === free_only) || null;
  const mode = on_demand ? (trigger.light ? 'light' : 'full') : ((!lastFull || String(lastFull.checked_at).slice(0, 7) !== month) ? 'full' : 'light');
  const since = last ? dfs(last.checked_at) : dfs(now.getTime() - CONFIG.first_lookback_days * 864e5);
  const since_full = lastFull ? dfs(lastFull.checked_at) : dfs(now.getTime() - CONFIG.first_lookback_days * 864e5);
  const kept = lastFull ? (parse(lastFull.competitors_json, []) || []).map(c => c.domain).filter(Boolean) : [];
  const competitors = (s.settings.competitors.length ? s.settings.competitors : kept).slice(0, 3);
  const lad = ladders.filter(l => normD(l.domain) === s.domain && l.target_url && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true'));
  const assets = [...lad.sort((a, b) => (Number(b.rung) || 0) - (Number(a.rung) || 0)).map(l => ({ url: l.target_url, title: l.keyword, kind: Number(l.rung) === 4 ? 'hub page' : 'guide' })),
    ...cases.filter(c => c.site_id === s.site_id && c.page_url).map(c => ({ url: c.page_url, title: c.title, kind: 'case study' })),
    ...logs.filter(l => normD(l.domain) === s.domain && l.published_url).map(l => ({ url: l.published_url, title: l.keyword, kind: 'article' }))].filter((a, i, arr) => arr.findIndex(b => b.url === a.url) === i).slice(0, 8);
  const stored_timeseries = lastFull ? (parse(lastFull.timeseries_json, []) || []) : [];   // the history is extended with the new months, not downloaded again
  const gapRows = prospects.filter(x => x.site_id === s.site_id && x.type === 'gap');
  const gapAge = gapRows.length ? Math.min(...gapRows.map(x => (now.getTime() - new Date(x.last_seen || x.first_seen || 0).getTime()) / 864e5)) : 1e9;
  const gap_due = on_demand || gapAge >= CONFIG.gap_every_days;
  const stored_gap = gap_due ? [] : gapRows.filter(x => !['won', 'rejected', 'ignored'].includes(x.status)).sort((a, b) => (Number(b.rank) || 0) - (Number(a.rank) || 0)).slice(0, 30).map(x => ({ domain: x.prospect_domain, rank: Number(x.rank) || 0, spam: Number(x.spam_score) || 0, links_to: ((String(x.detail || '').match(/Links to ([^(]+)/) || [])[1] || '').split(/,\s*/).map(z => z.trim()).filter(Boolean), backlinks: 0, stored: true, last_seen: String(x.last_seen || '').slice(0, 10), status: x.status || 'new' }));
  const brand = [...new Set([s.domain, s.profile.business_name, ...s.settings.brand_names].filter(b => b && (b.includes('.') || b.split(/\s+/).length >= 2 || b.length >= 8)))];
  // v4.10: the free sources
  const bn = String(s.profile.business_name || '').trim(); const label = s.domain.split('.')[0];
  const distinctive = bn && (bn.split(/\s+/).length >= 2 || bn.length >= 8) && bn.toLowerCase() !== 'home';
  const brand_query = distinctive ? bn : s.domain;   // news / web mention search: a short label like "techand" matches other companies (CLAUDE.md), the domain does not
  const brand_res = [...new Set([s.domain, ...(distinctive ? [bn] : []), ...s.settings.brand_names.filter(b => String(b).length >= 5)])].map(b => String(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  const topics = [...new Set([...lad.map(l => l.head_keyword || l.keyword), ...ladders.filter(l => normD(l.domain) === s.domain && Number(l.rung) === 4).map(l => l.keyword), ...(s.keywords || []), s.profile.business_type].map(x => String(x || '').trim().toLowerCase()).filter(x => x && x.split(/\s+/).some(w => !STOP.test(w))))].slice(0, 8);
  const c = countryOf(s.location_code);
  const myImports = imports.filter(x => x.site_id === s.site_id);
  const import_info = [...new Set(myImports.map(x => x.source))].map(src => { const rows = myImports.filter(x => x.source === src); const at = rows.map(x => String(x.imported_at || '')).sort().pop() || '';
    return { source: src, rows: rows.filter(x => String(x.imported_at || '') === at).length, imported_at: at, age_days: at ? Math.round((now.getTime() - new Date(at).getTime()) / 864e5) : null }; });
  const myLedger = ledger.filter(x => x.site_id === s.site_id);
  return { json: { site_id: s.site_id, domain: s.domain, country: s.country || c.name || '', country_name: c.name || s.country || '', country_iso: c.iso, location_code: Number(s.location_code) || 2840, language_code: s.language_code || 'en', email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '',
    on_demand, adhoc: !!s.adhoc, free_only, mode, since, since_full, stored_timeseries, gap_due, stored_gap, competitors, need_competitors: mode === 'full' && !competitors.length && !/^(true|1|yes|on)$/i.test(String(trigger.free_only ?? '')), business_name: s.profile.business_name || '', brand_names: brand, assets,
    brand_query, brand_res, label, topics, ga4_property_id: String(s.ga4_property_id || '').replace(/^properties\//, ''), gsc_property: s.gsc_property || '', bing: CONFIG.bing, import_info,
    ledger_size: myLedger.length, ledger_live: myLedger.filter(x => x.status !== 'lost').length,
    previous: last ? { checked_at: last.checked_at, mode: last.mode, rank: Number(last.rank) || 0, backlinks: Number(last.backlinks) || 0, referring_domains: Number(last.referring_domains) || 0, spam_score: Number(last.spam_score) || 0, broken_backlinks: Number(last.broken_backlinks) || 0,
      union_domains: lastSame ? Number(lastSame.union_domains) || 0 : 0, best_links: lastSame ? Number(lastSame.best_links) || 0 : 0, referral_visits: lastSame ? Number(lastSame.referral_visits) || 0 : 0 } : (lastSame ? { checked_at: lastSame.checked_at, mode: lastSame.mode, rank: 0, backlinks: 0, referring_domains: 0, spam_score: 0, broken_backlinks: 0, union_domains: Number(lastSame.union_domains) || 0, best_links: Number(lastSame.best_links) || 0, referral_visits: Number(lastSame.referral_visits) || 0 } : null),
    existing_prospects: prospects.filter(p => p.site_id === s.site_id).length, checked_at: iso } };
});
