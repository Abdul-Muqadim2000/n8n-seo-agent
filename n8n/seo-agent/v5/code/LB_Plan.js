// Link Builder plan (v4.13, LINK_BUILDER_SPEC.md; Monday 11:00 after the Backlink Monitor and AI Growth, or on demand): per site with the Link
// Builder on, what to look for this week — journalist requests (weekly), resource pages, the listings checklist, our old URLs in the Wayback
// Machine, podcast shows that take guests on the site's topics (L5) and competitors' broken backlinks and most-linked pages (L6)
// (monthly: every ~25 days, kept in seo_cache linkbld:<site>), the prospects to qualify — and what
// the pitches need: topics, competitors, the business profile (signature), our pages with their position and links (which page to point to).
// On demand with free_only: no DataForSEO, no Claude ($0).
/*__MONITOR_SITES__*/
/*__COUNTRIES__*/
/*__LINK_KIT__*/
/*__SITE_MODEL__*/
const CONFIG = { max_sites_per_run: 15, sequences_per_week: 10, monthly_days: 25, qualify_per_week: 25 };
const { list, on_demand, want, total } = monitorSites('links');   // `trigger` comes from the shared snippet
if (!list.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'the Link Builder is switched off for every site' : 'no sites yet') } }];
const prospects = rowsOf('Load Link Prospects'), outreach = rowsOf('Load Link Outreach'), ladders = rowsOf('Load Ladders'), logs = rowsOf('Load Content Log'), snaps = rowsOf('Load Backlink Snapshots');
const profiles = rowsOf('Load Profiles'), cache = rowsOf('Load Cache (Links)'), targets = rowsOf('Load AI Targets'), ledger = rowsOf('Load Backlinks'), queries = rowsOf('Load Query History'), ranks = rowsOf('Load Rank History');
const now = new Date(); const iso = now.toISOString();
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
const countryOf = (code) => { const e = Object.entries(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(([, c]) => Number(c.code) === Number(code)); return e ? { name: e[0], iso: String(e[1].iso || '').toUpperCase() } : { name: '', iso: '' }; };
const STOP = /^(the|and|for|with|from|your|our|best|top|how|what|why|guide|services?|company|solutions?|in|of|to|a|an|uae|dubai|near|me)$/i;
const days = (d) => d ? (now.getTime() - new Date(d).getTime()) / 864e5 : 1e9;
const pathKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const free_only = on_demand && /^(true|1|yes|on)$/i.test(String(trigger.free_only ?? ''));
  const st = parse((cache.find(c => c.key === 'linkbld:' + s.site_id) || {}).value, {}) || {};
  const due = (k) => on_demand || days(st[k]) >= CONFIG.monthly_days;
  const lastFull = snaps.filter(x => x.site_id === s.site_id && x.mode === 'full').sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
  const kept = lastFull ? (parse(lastFull.competitors_json, []) || []).map(c => c.domain).filter(Boolean) : [];
  const competitors = (s.settings.competitors.length ? s.settings.competitors : kept).slice(0, 3);
  // R4 (2026-10-13): who the site actually competes with in the results, read from the rank checks of the last 90 days
  // (seo_rank_history.competitors_json, written by _rank_serp.js: `above` = the domains ahead of us, `competitors` = the top 10). Only the
  // qualification gate uses this list; the pitches still name the up-to-3 declared competitors.
  const serp_rivals = (() => {
    const cut = new Date(Date.now() - 90 * 864e5).toISOString(); const byDom = new Map();
    for (const h of ranks.filter(r => normD(r.domain) === s.domain && String(r.checked_at || '') >= cut)) {
      const c = parse(h.competitors_json, null) || {};
      for (const x of [...(c.above || []), ...(c.competitors || [])]) {
        const dom = String((x && (x.d || x.domain)) || '').toLowerCase().replace(/^www\./, '');
        const pos = Number(x && (x.p || x.position)) || 0;
        if (!dom || dom === s.domain || !/\./.test(dom)) continue;
        const was = byDom.get(dom);
        if (!was || (pos > 0 && (!was.position || pos < was.position))) byDom.set(dom, { domain: dom, position: pos || (was && was.position) || 0, keyword: String(h.keyword || '') });
      }
    }
    return [...byDom.values()].sort((a, b) => (a.position || 99) - (b.position || 99)).slice(0, 40);
  })();
  const pr = profiles.find(x => x.site_id === s.site_id) || {};
  const lad = ladders.filter(l => normD(l.domain) === s.domain);
  const topics = [...new Set([...lad.map(l => l.head_keyword || l.keyword), ...(s.keywords || []), pr.business_type].map(x => String(x || '').trim().toLowerCase()).filter(x => x && x.split(/\s+/).some(w => !STOP.test(w))))].slice(0, 4);
  const c = countryOf(s.location_code);
  // our pages: published ladder pages, AI answer pages, written pages, the top Search Console pages, the homepage
  const site_model = SM.stored(s) || { domain: s.domain, canonical_host: s.domain };   // D15: our page links are on the canonical host
  const home = SM.siteUrl(site_model, '/');
  // D13: the business name comes from the one site model (profile -> the homepage's og:site_name / Organization name -> what the app sent),
  // never from the domain label — pitches signed "techand" went out for Tech& (live 2026-10-11). With no name on file the pitches carry a
  // bracket for the owner instead of a guess.
  const bn = String(pr.business_name || '').trim();
  const modelName = SM.name(site_model);
  const named = (bn && bn.toLowerCase() !== 'home') ? bn : (modelName && SM.helpers.bare(modelName) !== site_model.domain ? modelName : '');
  const brand = named || s.domain; const brand_known = !!named;
  const services = SM.services(site_model); const accreditation = SM.facts(site_model).accreditation;
  // every URL of ours is served on the canonical host (D15): Search Console and the ladder rows mix www and the bare host
  const ourUrl = (u) => { const h = String((String(u || '').match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '').toLowerCase().replace(/^www\./, '');
    return h && h === s.domain ? SM.siteUrl(site_model, String(u).replace(/^https?:\/\/[^\/?#]*/i, '')) : u; };
  const myQ = queries.filter(q => q.site_id === s.site_id && q.page);
  const lastPeriod = myQ.map(q => String(q.period_end || '')).sort().pop() || '';
  const posOf = new Map(); const imp = new Map();
  for (const q of myQ.filter(q => String(q.period_end) === lastPeriod)) { const k = pathKey(q.page); const i = Number(q.impressions) || 0; const p = Number(q.position) || 0; if (!p) continue;
    imp.set(k, (imp.get(k) || 0) + i); posOf.set(k, (posOf.get(k) || 0) + p * Math.max(1, i)); }
  const posFor = (u, kw) => { const k = pathKey(u); if (imp.has(k)) return Math.round(10 * posOf.get(k) / Math.max(1, imp.get(k))) / 10;
    const r = ranks.filter(h => h.keyword === kw && Number(h.position) > 0).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0]; return r ? Number(r.position) : 0; };
  const myLedger0 = ledger.filter(l => l.site_id === s.site_id && l.status !== 'lost' && l.kind !== 'social');
  const farms = LK.footprints(myLedger0, { domain: s.domain, brands: [brand, ...(s.settings.brand_names || [])].filter(Boolean) });   // link-farm pages count as no link (D3), whatever an older ledger row says
  const myLedger = myLedger0.filter(l => l.link_type !== 'spam' && !farms.has(l.ref_domain));
  const rdsTo = (u) => { const k = pathKey(u); const set = new Set(); for (const l of myLedger) if (pathKey(l.to_url) === k) set.add(l.ref_domain + (l.rel === 'follow' ? '' : '~')); let n = 0; for (const x of set) n += x.endsWith('~') ? 0.5 : 1; return n; };
  const kwShare = (u) => { const k = pathKey(u); const mine = myLedger.filter(l => pathKey(l.to_url) === k && l.anchor_kind); return mine.length ? mine.filter(l => l.anchor_kind === 'money').length / mine.length : 0; };
  const month = iso.slice(0, 7);
  const pitched = (u) => outreach.filter(o => o.site_id === s.site_id && pathKey(o.target_url) === pathKey(u) && String(o.drafted_at || '').slice(0, 7) === month).length;
  const pages = [];
  const addPage = (url0, title, keyword, kind, page_type) => { const url = ourUrl(url0); if (!url || pages.some(p => pathKey(p.url) === pathKey(url))) return; pages.push({ url, title: String(title || '').slice(0, 140), keyword: String(keyword || '').slice(0, 100), kind, page_type: page_type || '',
    position: posFor(url, keyword), rds: rdsTo(url), kw_share: Math.round(100 * kwShare(url)) / 100, pitched: pitched(url) }); };
  addPage(home, brand, brand, 'home');
  for (const l of lad.filter(l => l.target_url && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true')).sort((a, b) => (Number(b.rung) || 0) - (Number(a.rung) || 0)))
    addPage(l.target_url, l.keyword, l.keyword, Number(l.rung) === 4 ? 'hub' : /service|product|landing|pricing/i.test(l.page_type || '') ? 'money' : 'guide', l.page_type);
  for (const t of targets.filter(t => t.site_id === s.site_id && t.page_url && ['won', 'writing', 'written', 'done'].includes(String(t.status || '')))) addPage(t.page_url, t.question, t.keyword || t.question, 'answer');
  for (const l of logs.filter(l => normD(l.domain) === s.domain && l.published_url)) addPage(l.published_url, l.keyword, l.keyword, /service|product|landing/i.test(l.page_type || '') ? 'money' : 'article', l.page_type);
  for (const [k, n] of [...imp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) { const q = myQ.find(x => pathKey(x.page) === k && String(x.period_end) === lastPeriod); addPage(q.page, q.query, q.query, 'page'); }
  const mineP = prospects.filter(p => p.site_id === s.site_id);
  const mineO = outreach.filter(o => o.site_id === s.site_id);
  return { json: { site_id: s.site_id, domain: s.domain, country: s.country || c.name || '', country_iso: c.iso, location_code: Number(s.location_code) || 2840, language_code: s.language_code || 'en',
    email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', on_demand, free_only, competitors, serp_rivals, topics, brand, brand_known, services, accreditation,
    brand_names: [...new Set([brand, named, ...s.settings.brand_names, s.domain.split('.')[0].length >= 5 ? s.domain.split('.')[0] : ''].filter(Boolean))],
    profile: { business_name: bn, business_type: pr.business_type || '', author_name: pr.author_name || '', author_job_title: pr.author_job_title || '', street_address: pr.street_address || '', city: pr.city || '', region: pr.region || '',
      postal_code: pr.postal_code || '', country_code: pr.country_code || c.iso || '', phone: pr.phone || '', public_email: pr.public_email || '', logo_url: pr.logo_url || '' },
    pages, home, canonical_host: site_model.canonical_host || s.domain, budget: CONFIG.sequences_per_week, qualify_max: CONFIG.qualify_per_week,
    due: { listings: due('listings_at'), resources: due('resources_at'), wayback: due('wayback_at'), broken: due('broken_at') && !free_only, press: true,
      podcasts: due('podcasts_at'), assets: due('assets_at') && !free_only },   // L5: podcast shows (free, monthly). L6: the asset ideas read from the competitors' most-linked pages (DataForSEO domain_pages, monthly, ~$0.02 a competitor)
    state: st, prospects_open: mineP.filter(p => (p.status || 'new') === 'new').length, outreach_rows: mineO.length, checked_at: iso } };
});
