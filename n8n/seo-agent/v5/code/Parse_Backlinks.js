// Per site: link profile now vs the last check, links lost (important ones = alert), new links (spammy ones flagged), links pointing to broken
// pages on the site (reclaim with a redirect), 12 months of history, unlinked brand mentions, the link gap (domains linking to competitors, not
// to you), alerts and the prospect candidates. Rank and spam score are DataForSEO's 0-1000 and 0-100 scales.
// v4.10 (BACKLINKS_SPEC.md): the ledger — every referring site from every source, with the result of our own link check:
// - a link is LOST only after two misses in a row (or one miss of a link DataForSEO also reports lost), with the reason: link removed, page
//   gone (404 / 410 / domain gone), or not seen by any source for 120 days; a bot challenge or a JavaScript-only page is "not checked", never lost;
//   a link that turns nofollow or whose page turns noindex is flagged, not lost;
// - three values per link (SEO / referral / brand, LK.values) and the "best links" (SEO value 50+);
// - coverage: how many referring sites each source sees, how many only one source sees, and the share of Google's own sample (the uploaded
//   Search Console export) that DataForSEO and all sources together see;
// - mentions checked on the page (named without a link = the warmest outreach), "best X" list pages that name competitors and not you,
//   sites that just linked to a competitor (DataForSEO, since the last full run) and the Common Crawl gap;
// - prospects scored value x likelihood (an unlinked mention converts far more often than a cold gap site).
/*__LINK_KIT__*/
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (e) { return []; } };
const reqs = all('BL Requests'), resps = all('Run BL Requests');
const greqs = all('Gap Requests'), gresps = all('Run Gap Requests');
const areqs = all('Authority Requests'), aresps = all('Run Authority');
const dreqs = all('DR Requests'), dresps = all('Fetch DR');
const merged = all('Link Merge').filter(m => !m.skip);
const ver = all('Verify Links').filter(v => !v.skip);
const ljobs = all('Link Analyst Jobs').filter(j => !j.skip), louts = all('Link Analyst');
const SPAM_WORDS = /\b(pbn|buy (?:cheap )?backlinks?|backlinks? (?:service|package)|link ?farm|casino|betting|slots?|porn|xxx|viagra|cialis|payday|escort|essay writing)\b/i;
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|blogspot|wordpress|tumblr)\.[a-z.]+$/i;
const result = (rs, i) => { const t = ((rs[i] || {}).tasks || [])[0] || {}; return { ok: t.status_code === 20000, res: (t.result || [])[0] || null, cost: Number(t.cost) || 0, error: t.status_code && t.status_code !== 20000 ? t.status_message : ((rs[i] || {}).error ? String((rs[i].error.message || rs[i].error)).slice(0, 160) : null) }; };
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/i, '') || '/';
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 2);
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const clamp = (x) => Math.max(0, Math.min(1, x));
const authOf = (x) => Math.max(x.authority > 0 ? clamp((Number(x.authority) - 40) / 520) : 0, x.dr > 0 ? clamp(Number(x.dr) / 90) : 0, x.cc_rank > 0 ? clamp(1 - Math.log10(Number(x.cc_rank)) / 7.2) : 0);
const LIKELY = { reclaim: 1, mention: 0.9, lost: 0.7, comp_new: 0.55, list: 0.5, gap: 0.4, ai_source: 0.35 };
// household names (Common Crawl top 5,000, rank 700+, DR 85+) rarely link to a small business: their value is real, the chance is not
// (live finding 2026-10-08: stripe.com outranked mof.gov.ae, which links to both competitors)
const effortOf = (x) => (Number(x.cc_rank) > 0 && Number(x.cc_rank) < 5000) || Number(x.authority) >= 700 || Number(x.dr) >= 85 ? 0.7 : 1;
const scoreOf = (type, x, extra = 1) => Math.round(100 * clamp((LIKELY[type] || 0.3) * extra) * (0.35 + 0.65 * authOf(x)) * (type === 'reclaim' || type === 'lost' ? 1 : effortOf(x)));
return plans.map(p => {
  const get = (kind) => { const out = []; reqs.forEach((r, i) => { if (r.site_id === p.site_id && r.kind === kind) out.push({ ...result(resps, i), req: r }); }); return out; };
  const one = (kind) => get(kind)[0] || { ok: false, res: null, cost: 0, error: 'not requested' };
  const costOf = (rq, rs) => rq.reduce((s, r, i) => s + (r.site_id === p.site_id ? result(rs, i).cost : 0), 0);
  const cost = costOf(reqs, resps) + costOf(greqs, gresps) + costOf(areqs, aresps);
  const m = merged.find(x => x.site_id === p.site_id) || { entries: [], mention_pages: [], list_pages: [], cc_gap: [], sources: {} };
  const now = p.checked_at; const today = now.slice(0, 10);
  // ---------------- DataForSEO view (as before) ----------------
  const S = one('summary'); const sm = S.res || {};
  const summary = { rank: Number(sm.rank) || 0, backlinks: Number(sm.backlinks) || 0, referring_domains: Number(sm.referring_domains) || 0, referring_domains_nofollow: Number(sm.referring_domains_nofollow) || 0, spam_score: Number(sm.backlinks_spam_score) || 0, broken_backlinks: Number(sm.broken_backlinks) || 0, broken_pages: Number(sm.broken_pages) || 0, available: S.ok, error: S.error };
  const spamOf = (x) => Number(x.backlink_spam_score) >= 50 || SPAM_WORDS.test(String(x.anchor || '') + ' ' + String(x.page_from_title || ''));
  const link = (x) => ({ from_domain: String(x.domain_from || '').replace(/^www\./, ''), from_url: x.url_from || '', to_url: x.url_to || '', anchor: String(x.anchor || '').slice(0, 120), dofollow: !!x.dofollow, domain_rank: Number(x.domain_from_rank) || 0, page_rank: Number(x.page_from_rank) || 0, spam: Number(x.backlink_spam_score) || 0, first_seen: String(x.first_seen || '').slice(0, 10), last_seen: String(x.last_seen || '').slice(0, 10), title: String(x.page_from_title || '').slice(0, 120) });
  const dfsLost = ((one('lost').res || {}).items || []).map(link);
  const news = ((one('new').res || {}).items || []).map(x => ({ ...link(x), spammy: spamOf(x) }));
  const spammy = news.filter(x => x.spammy);
  const live = [...p.assets.map(a => a.url), 'https://' + p.domain + '/'];
  const suggest = (u) => { const t = new Set(toks(pathOf(u))); let best = live[live.length - 1], score = 0; for (const c of live) { const s = toks(pathOf(c)).filter(x => t.has(x)).length; if (s > score) { score = s; best = c; } } return best; };
  const tsNew = ((one('timeseries').res || {}).items || []).map(x => ({ month: String(x.date || '').slice(0, 7), backlinks: Number(x.backlinks) || 0, referring_domains: Number(x.referring_domains) || 0, rank: Number(x.rank) || 0 }));
  const tsMap = new Map((p.stored_timeseries || []).filter(x => x && x.month).map(x => [x.month, x])); for (const x of tsNew) tsMap.set(x.month, x);
  const ts = [...tsMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-13);
  // ---------------- authority from this run (bulk ranks / spam, Ahrefs DR) and the Link Analyst's labels ----------------
  const rankOf = new Map(), spamOfD = new Map(), drOf = new Map();
  areqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.skip) return; const res = result(aresps, i).res; for (const it of ((res || {}).items || [])) { const d = LK.refKey(LK.hostOf('//' + String(it.target || '').replace(/^https?:\/\//, ''))); if (!d) continue; if (r.kind === 'ranks') rankOf.set(d, Number(it.rank) || 0); if (r.kind === 'spam') spamOfD.set(d, Number(it.spam_score) || 0); } });
  let dr_error = ''; dreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.skip) return; const x = dresps[i] || {}; const j = (x.body && typeof x.body === 'object') ? x.body : (x.domain_rating ? x : parseJ(x.data));
    if (!j || !j.domain_rating) { dr_error = String((x.error && (x.error.message || x.error)) || (j && (j.error || j.message)) || 'no answer').slice(0, 160); return; } for (const t of (j.domain_rating.targets || [])) drOf.set(LK.refKey(String(t.target || '').toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '')), Number(t.domain_rating) || 0); });   // Ahrefs answers 'techand.ai/' (trailing slash, live 2026-10-08)
  const labels = new Map(); ljobs.forEach((j, k) => { if (j.site_id !== p.site_id) return; const o = louts[k] || {}; const parsed = o.error ? null : parseJ(o.output); for (const a of ((parsed || {}).links || [])) { const d = j.ids[Number(a.n) - 1]; if (d) labels.set(d, { link_type: String(a.type || 'other').toLowerCase(), relevance: Math.max(0, Math.min(3, Number(a.relevance) || 0)) / 3, note: String(a.note || '').slice(0, 140) }); } });
  // ---------------- the link check results ----------------
  const vLink = new Map(), vMention = [], vList = [], vTarget = [];
  for (const v of ver) { if (v.site_id !== p.site_id) continue; if (v.purpose === 'link') vLink.set(v.ref_domain, v); else if (v.purpose === 'mention') vMention.push(v); else if (v.purpose === 'list') vList.push(v); else if (v.purpose === 'target') vTarget.push(v); }
  // mention pages that link: they join the entries as a new referrer (source news / web)
  const entries = [...m.entries];
  for (const v of vMention) if (v.verify === 'found' && v.ref_domain && !entries.some(e => e.ref_domain === v.ref_domain)) { entries.push({ ref_domain: v.ref_domain, kind: 'web', sources: [v.source === 'news' ? 'news' : 'web'], from_url: v.url, to_url: v.to_url || '', anchor: v.anchor || '', first_seen: today, last_seen: today, authority: 0, visits: 0, visits_28d: 0, key_events: 0, pages: [{ url: v.url }], prev: null, ai_cited: false }); vLink.set(v.ref_domain, v); }
  // ---------------- the ledger ----------------
  const brands = (p.brand_names || []).filter(b => !String(b).includes('.'));
  const ledger = [], lostNow = [], atRisk = [], relChanged = [], wins = [];
  for (const e of entries) {
    const pv = e.prev || {}; const v = vLink.get(e.ref_domain); const lab = labels.get(e.ref_domain) || {};
    const prevStatus = pv.status || ''; const freshEvidence = e.sources.some(s => ['dfs', 'bing', 'gsc', 'import', 'cc'].includes(s)) && !e.dfs_lost || (e.visits_28d || 0) > 0;
    let status = prevStatus || 'live', miss = Number(pv.miss_count) || 0, lost_reason = pv.lost_reason || '', lost_at = pv.lost_at || '', verify = pv.verify || 'unchecked', verified_at = pv.verified_at || '';
    let from_url = e.from_url || pv.from_url || '', to_url = e.to_url || pv.to_url || '', anchor = e.anchor || pv.anchor || '', rel = e.rel || pv.rel || '', placement = e.placement || pv.placement || '';
    let noindex = pv.noindex === true || pv.noindex === 'true', canon = pv.canonical_elsewhere === true || pv.canonical_elsewhere === 'true', outbound = Number(e.outbound || pv.outbound) || 0, title = pv.page_title || '', context = pv.context || '';
    if (v) {
      verify = v.verify;
      if (v.verify === 'found') {
        if (prevStatus === 'lost') wins.push({ ref_domain: e.ref_domain, url: v.url, why: 'restored' });
        if (pv.verify === 'found' && (pv.rel || 'follow') === 'follow' && v.rel !== 'follow' && Number(pv.seo_value) >= 25) relChanged.push({ ref_domain: e.ref_domain, url: v.url, rel: v.rel, was: 'follow' });
        if (pv.verify === 'found' && !noindex && v.noindex && Number(pv.seo_value) >= 25) relChanged.push({ ref_domain: e.ref_domain, url: v.url, rel: 'noindex', was: 'indexed' });
        status = 'live'; miss = 0; lost_reason = ''; lost_at = ''; verified_at = now; from_url = v.url; to_url = v.to_url || to_url; anchor = v.anchor || anchor; rel = v.rel; placement = v.placement; noindex = !!v.noindex; canon = !!v.canonical_elsewhere; outbound = v.outbound_domains || outbound; title = v.title || title; context = String(v.context || '').slice(0, 400);
      } else if (v.verify === 'missing' || v.verify === 'gone') {
        miss += 1; verified_at = now;
        const confirmed = miss >= 2 || !!e.dfs_lost;
        if (confirmed && !(freshEvidence && v.verify === 'missing' && e.pages.some(x => x.url !== v.url))) { if (prevStatus !== 'lost') { lost_at = now; lostNow.push({ e, v, reason: v.verify === 'gone' ? 'page_gone' : 'link_removed' }); } status = 'lost'; lost_reason = v.verify === 'gone' ? (/ENOTFOUND/i.test(v.error || '') ? 'domain_gone' : 'page_gone') : 'link_removed'; }
        else if (confirmed) { status = 'live'; miss = 0; const other = e.pages.find(x => x.url !== v.url); from_url = other ? other.url : from_url; }   // the link moved to another page of the same site: check that one next time
        else { status = 'at_risk'; atRisk.push({ e, v }); }
      }
    } else if (e.dfs_lost && prevStatus !== 'lost') { status = 'at_risk'; atRisk.push({ e, v: { url: e.dfs_lost.url, verify: 'unchecked' } }); }
    else if (!e.sources.length && prevStatus !== 'lost' && String(pv.last_seen || '') && (Date.now() - new Date(pv.last_seen).getTime()) / 864e5 > 120 && !(pv.verify === 'found' && (Date.now() - new Date(pv.verified_at || 0).getTime()) / 864e5 < 60)) { status = 'lost'; lost_reason = 'not_seen'; lost_at = now; }
    else if (e.sources.length && prevStatus === 'lost' && !['link_removed', 'page_gone', 'domain_gone'].includes(pv.lost_reason)) { status = 'live'; lost_reason = ''; lost_at = ''; }
    const sources = [...new Set([...String(pv.sources || '').split(',').filter(Boolean), ...e.sources])];
    const authority = Math.max(Number(e.authority) || 0, rankOf.get(e.ref_domain) || 0, (rankOf.has(e.ref_domain) || e.authority > 0) ? 0 : Number(pv.authority) || 0);
    const dr = drOf.has(e.ref_domain) ? drOf.get(e.ref_domain) : Number(pv.dr) || 0;
    const cc_rank = Number(e.cc_rank) || Number(pv.cc_rank) || 0;
    const spam = Math.max(Number(e.spam) || 0, spamOfD.get(e.ref_domain) || 0, e.spam ? 0 : Number(pv.spam_score) || 0);
    const link_type = lab.link_type || e.link_type || pv.link_type || ''; const relevance = lab.relevance != null ? lab.relevance : (pv.relevance !== '' && pv.relevance != null ? Number(pv.relevance) : null);
    const anchor_kind = LK.anchorKind(anchor, p.domain, brands);
    const row = { site_id: p.site_id, domain: p.domain, ref_domain: e.ref_domain, kind: e.kind || 'web', from_url: String(from_url).slice(0, 500), to_url: String(to_url).slice(0, 500), anchor: String(anchor).slice(0, 160), anchor_kind,
      rel: rel || (sources.every(s => s === 'ga4' || s === 'cc' || s === 'gsc' || s === 'bing') ? '' : 'follow'), placement: placement || '', link_type, relevance: relevance == null ? '' : +Number(relevance).toFixed(2), note: lab.note || pv.note || '',
      sources: sources.join(','), source_count: e.sources.length, first_seen: [e.first_seen, String(pv.first_seen || '').slice(0, 10)].filter(Boolean).sort()[0] || today, last_seen: [e.last_seen, String(pv.last_seen || '').slice(0, 10), v && v.verify === 'found' ? today : ''].filter(Boolean).sort().pop() || today,
      status, lost_at, lost_reason, miss_count: miss, verify, verified_at, noindex, canonical_elsewhere: canon, outbound, page_title: String(title).slice(0, 160), context: String(context).slice(0, 400),
      authority, dr, cc_rank, page_keywords: Number(e.page_keywords) || Number(pv.page_keywords) || 0, spam_score: spam, original: e.original === false ? false : (e.original === true ? true : (pv.original === false || pv.original === 'false' ? false : true)), sitewide: Number(e.sitewide) || Number(pv.sitewide) || 0, links: Number(e.links) || Number(pv.links) || 0,
      visits: Number(e.visits) || (e.sources.includes('ga4') ? 0 : Number(pv.visits) || 0), key_events: Number(e.key_events) || 0, ai_cited: !!e.ai_cited, updated_at: now };
    const val = LK.values({ ...row, spam: row.spam_score, relevance: row.relevance === '' ? null : row.relevance });
    row.seo_value = val.seo; row.referral_value = val.referral; row.brand_value = val.brand; row.visits_28d = e.visits_28d || 0; row._new = !e.prev; row._dfs_new = !!e.dfs_new; row._sources_now = e.sources;
    ledger.push(row);
    if (v && v.verify === 'found' && !e.prev && (val.seo >= 50 || ['editorial', 'press', 'listing', 'resource'].includes(link_type))) wins.push({ ref_domain: e.ref_domain, url: v.url, why: 'new', seo: val.seo, link_type });
  }
  const liveRows = ledger.filter(r => r.status !== 'lost' && r.kind === 'web');
  const importantOf = (r) => Number(r.spam_score || r.spam) < 40 && !['spam', 'scraper'].includes(r.link_type) && (Number(r.seo_value) >= 35 || r.authority >= 150 || r.dr >= 40 || Number(r.visits) >= 5 || ['editorial', 'press'].includes(r.link_type));   // spam links are never "important", whatever their authority
  const lostRows = lostNow.map(({ e, v, reason }) => { const r = ledger.find(x => x.ref_domain === e.ref_domain) || {}; const pv = e.prev || {};
    return { from_domain: e.ref_domain, from_url: v.url || r.from_url, to_url: r.to_url, anchor: r.anchor, dofollow: (pv.rel || r.rel || 'follow') === 'follow', domain_rank: r.authority, dr: r.dr, spam: r.spam_score, last_seen: String(pv.last_seen || '').slice(0, 10) || (e.dfs_lost || {}).last_seen || '', reason: r.lost_reason || reason,
      seo_value: Number(pv.seo_value) || r.seo_value, visits: r.visits, title: pv.page_title || '', important: importantOf({ ...r, seo_value: Number(pv.seo_value) || r.seo_value }) }; });
  const important_lost = lostRows.filter(l => l.important);
  // the DataForSEO-reported losses still unconfirmed are listed as "reported lost — checking"
  const lost = [...lostRows, ...dfsLost.filter(l => !lostRows.some(x => x.from_domain === LK.refKey(l.from_domain))).map(l => ({ ...l, reason: 'reported_lost', pending: true }))];
  // ---------------- reclaim: links pointing to own pages that no longer load (DataForSEO + our own status check of the most-linked pages) ----------------
  const reclaimMap = new Map();
  for (const x of ((one('broken').res || {}).items || [])) { const b = { ...link(x), status: Number(x.url_to_status_code) || null }; const r = reclaimMap.get(b.to_url) || { broken_url: b.to_url, status: b.status, links: 0, domains: new Set(), redirect_to: suggest(b.to_url) }; r.links++; r.domains.add(b.from_domain); reclaimMap.set(b.to_url, r); }
  for (const t of vTarget.filter(t => t.broken)) { const r = reclaimMap.get(t.url) || { broken_url: t.url, status: t.status || null, links: 0, domains: new Set(), redirect_to: suggest(t.url) }; r.links = Math.max(r.links, t.referring || 1); for (const l of ledger.filter(l => l.to_url === t.url)) r.domains.add(l.ref_domain); reclaimMap.set(t.url, r); }
  const reclaim = [...reclaimMap.values()].map(r => ({ ...r, domains: [...r.domains].slice(0, 8) })).sort((a, b) => b.links - a.links).slice(0, 20);
  // ---------------- mentions (checked on the page), list pages, competitor new links, the gap ----------------
  const linking = new Set(liveRows.map(r => r.ref_domain));
  const mentions = [];
  for (const v of vMention) { if (!v.named || v.verify === 'found' || linking.has(v.ref_domain) || mentions.some(x => x.domain === v.ref_domain)) continue; mentions.push({ domain: v.ref_domain, url: v.url, title: String(v.title || '').slice(0, 140), source: v.source, date: v.date || '', context: String(v.context || '').slice(0, 300), verified: true, domain_rank: rankOf.get(v.ref_domain) || 0, dr: drOf.get(v.ref_domain) || 0 }); }
  const fetchedMention = new Set(vMention.map(v => v.url));
  for (const mp of (m.mention_pages || []).filter(x => x.source === 'dfs_mention' && !fetchedMention.has(x.url))) { if (linking.has(mp.domain) || mentions.some(x => x.domain === mp.domain)) continue; mentions.push({ domain: mp.domain, url: mp.url, title: mp.title, source: mp.source, verified: false, domain_rank: mp.authority || rankOf.get(mp.domain) || 0, dr: drOf.get(mp.domain) || 0 }); }
  mentions.sort((a, b) => (b.verified - a.verified) || ((b.dr || 0) - (a.dr || 0)) || ((b.domain_rank || 0) - (a.domain_rank || 0)));   // checked on the page first, then by authority
  const lists = vList.filter(v => v.verify !== 'gone' && v.verify !== 'error').map(v => ({ domain: v.ref_domain, url: v.url, title: v.title, topic: v.topic, competitors: v.competitors_named || [], named: !!v.named, linked: !!v.linked, domain_rank: rankOf.get(v.ref_domain) || 0, dr: drOf.get(v.ref_domain) || 0 }));
  const compLabels = (p.competitors || []).map(c => String(c).split('.')[0]).filter(l => l.length >= 4);
  const sibling = (d) => compLabels.includes(String(d || '').split('.')[0]);   // cleartax.in is ClearTax too (live finding 2026-10-08)
  const compNew = []; for (const c of get('comp_new')) for (const x of ((c.res || {}).items || [])) { const d = LK.refKey(x.domain_from); if (!d || linking.has(d) || BIG.test(d) || LK.isInfra(d) || LK.isWire(d) || sibling(d) || Number(x.backlink_spam_score) >= 30 || compNew.some(y => y.domain === d)) continue;
    compNew.push({ domain: d, competitor: c.req.competitor, url: x.url_from || '', first_seen: String(x.first_seen || '').slice(0, 10), domain_rank: Number(x.domain_from_rank) || 0, dr: drOf.get(d) || 0, anchor: String(x.anchor || '').slice(0, 100), title: String(x.page_from_title || '').slice(0, 120) }); }
  compNew.sort((a, b) => b.domain_rank - a.domain_rank);
  const ccTld = ({ GB: 'uk' })[p.country_iso] || String(p.country_iso || '').toLowerCase();
  const localOf = (d) => ccTld.length === 2 && ccTld !== 'us' && String(d || '').toLowerCase().endsWith('.' + ccTld) ? 1.25 : 1;   // .ae for a UAE site: a local site is a likelier, more relevant link
  const gi = greqs.findIndex(g => g.site_id === p.site_id && !g.skip); const G = gi >= 0 ? result(gresps, gi) : null; const competitors = gi >= 0 ? greqs[gi].competitors : p.competitors;
  const freshGap = ((G && G.res && G.res.items) || []).map(it => { const vals = Object.entries(it.domain_intersection || {}); const f = (vals[0] || [])[1] || {};
    return { domain: LK.refKey(String(f.target || '').replace(/^www\./, '')), rank: Number(f.rank) || 0, spam: Number(f.backlinks_spam_score) || 0, links_to: vals.map(([k]) => competitors[Number(k) - 1]).filter(Boolean), backlinks: vals.reduce((s, [, v]) => s + (Number(v.backlinks) || 0), 0), source: 'dfs' }; })
    .filter(g => g.domain && g.spam < 30 && !BIG.test(g.domain) && !LK.isInfra(g.domain) && !LK.isWire(g.domain) && !sibling(g.domain) && !linking.has(g.domain) && g.domain !== p.domain).sort((a, b) => (b.links_to.length - a.links_to.length) || (b.rank - a.rank)).slice(0, 30);
  const ccGap = (m.cc_gap || []).filter(g => !linking.has(g.domain) && !BIG.test(g.domain) && !LK.isInfra(g.domain) && !LK.isWire(g.domain) && !sibling(g.domain) && (spamOfD.get(g.domain) || 0) < 30).map(g => ({ domain: g.domain, rank: rankOf.get(g.domain) || 0, spam: spamOfD.get(g.domain) || 0, links_to: g.links_to, backlinks: 0, cc_rank: g.cc_rank, source: 'cc' }));
  const gapBase = gi >= 0 ? freshGap : (p.stored_gap || []).filter(g => !linking.has(g.domain) && !LK.isWire(g.domain)).map(g => ({ ...g, source: 'dfs' }));
  const gap = [...gapBase]; for (const g of ccGap) { const x = gap.find(y => y.domain === g.domain); if (x) { x.source = 'both'; x.cc_rank = g.cc_rank; x.links_to = [...new Set([...x.links_to, ...g.links_to])]; } else gap.push(g); }
  gap.sort((a, b) => (b.links_to.length - a.links_to.length) || ((b.source === 'both') - (a.source === 'both')) || (b.rank - a.rank) || ((a.cc_rank || 9e9) - (b.cc_rank || 9e9)));
  // ---------------- coverage: who sees what ----------------
  const srcNow = (r) => r._sources_now || [];
  const per = {}, only = {}; for (const r of liveRows) { const s = srcNow(r); for (const x of s) per[x] = (per[x] || 0) + 1; if (s.length === 1) only[s[0]] = (only[s[0]] || 0) + 1; }
  const gscSet = new Set(liveRows.filter(r => srcNow(r).includes('gsc')).map(r => r.ref_domain));
  const dfsSet = new Set(liveRows.filter(r => srcNow(r).includes('dfs')).map(r => r.ref_domain));
  const coverage = { union: liveRows.length, social: ledger.filter(r => r.status !== 'lost' && r.kind === 'social').length, per_source: per, only_in: only, dfs_share: liveRows.length ? Math.round(100 * dfsSet.size / liveRows.length) : 0,
    gsc_sample: gscSet.size, dfs_sees_google: gscSet.size ? Math.round(100 * [...gscSet].filter(d => dfsSet.has(d)).length / gscSet.size) : null, all_see_google: gscSet.size ? Math.round(100 * [...gscSet].filter(d => srcNow(liveRows.find(r => r.ref_domain === d)).length > 1).length / gscSet.size) : null,
    verified: liveRows.filter(r => r.verify === 'found').length, checked_now: [...vLink.values()].length, blocked: [...vLink.values()].filter(v => v.verify === 'blocked' || v.verify === 'js').length, status: m.sources || {} };
  // ---------------- anchors, pages, values ----------------
  const kinds = {}; for (const r of liveRows) kinds[r.anchor_kind] = (kinds[r.anchor_kind] || 0) + 1;
  const anchors = { kinds, top: ((one('anchors').res || {}).items || []).slice(0, 15).map(a => ({ anchor: String(a.anchor || '').slice(0, 80), referring_domains: Number(a.referring_domains) || 0, backlinks: Number(a.backlinks) || 0, kind: LK.anchorKind(a.anchor, p.domain, brands) })) };
  const pages = ((one('pages').res || {}).items || []).slice(0, 15).map(x => ({ url: x.page, referring_domains: Number((x.page_summary || {}).referring_domains) || 0, backlinks: Number((x.page_summary || {}).backlinks) || 0, status: (vTarget.find(t => t.url === x.page) || {}).status || Number(x.status_code) || null }));
  const by = (k) => [...liveRows].sort((a, b) => b[k] - a[k]).filter(r => r[k] > 0).slice(0, 10).map(r => ({ ref_domain: r.ref_domain, from_url: r.from_url, value: r[k], link_type: r.link_type, visits: r.visits }));
  const values = { best_seo: by('seo_value'), best_referral: by('referral_value'), best_brand: by('brand_value') };
  const best_links = liveRows.filter(r => r.seo_value >= 50).length;
  const referral = { visits: liveRows.reduce((s, r) => s + (Number(r.visits) || 0), 0), visits_28d: liveRows.reduce((s, r) => s + (Number(r.visits_28d) || 0), 0), key_events: liveRows.reduce((s, r) => s + (Number(r.key_events) || 0), 0) };
  // ---------------- alerts ----------------
  const prev = p.previous; const alerts = [];
  const REASON = { link_removed: 'link removed', page_gone: 'page gone', domain_gone: 'site gone', not_seen: 'not seen for 4 months' };
  const actionable = important_lost.filter(l => l.reason !== 'domain_gone'), siteGone = important_lost.filter(l => l.reason === 'domain_gone');
  if (actionable.length) alerts.push({ level: 'high', text: actionable.length + ' important link(s) lost (checked twice): ' + actionable.slice(0, 3).map(l => l.from_domain + ' (' + (REASON[l.reason] || l.reason) + ')').join(', ') + '.' });
  if (siteGone.length) alerts.push({ level: 'low', text: siteGone.length + ' linking site(s) no longer exist (' + siteGone.slice(0, 3).map(l => l.from_domain).join(', ') + '): those links cannot be won back.' });
  if (relChanged.length) alerts.push({ level: 'medium', text: relChanged.length + ' valuable link(s) changed: ' + relChanged.slice(0, 3).map(r => r.ref_domain + ' is now ' + r.rel).join(', ') + '.' });
  if (spammy.length >= 3) alerts.push({ level: 'medium', text: spammy.length + ' new spammy links (PBN / link-farm pages) since ' + p.since.slice(0, 10) + '. Google ignores most of them; nothing to do unless you get a manual action.' });
  const newMoney = ledger.filter(r => r._new && r.anchor_kind === 'money' && (r.spam_score >= 30 || (r.relevance !== '' && r.relevance < 0.34)));
  if (newMoney.length >= 10) alerts.push({ level: 'medium', text: newMoney.length + ' new off-topic links with keyword anchors at once — a possible negative-SEO pattern. Keep watching; disavow only if a manual action follows.' });
  if (prev && summary.available && prev.spam_score && summary.spam_score - prev.spam_score >= 15) alerts.push({ level: 'medium', text: 'Link spam score rose from ' + prev.spam_score + ' to ' + summary.spam_score + '.' });
  if (prev && prev.union_domains >= 10 && liveRows.length < prev.union_domains * 0.9) alerts.push({ level: 'medium', text: 'Referring sites (all sources) fell from ' + prev.union_domains + ' to ' + liveRows.length + '.' });
  else if (prev && !prev.union_domains && summary.available && prev.referring_domains >= 10 && summary.referring_domains < prev.referring_domains * 0.9) alerts.push({ level: 'medium', text: 'Referring domains fell from ' + prev.referring_domains + ' to ' + summary.referring_domains + '.' });
  const riskImportant = atRisk.filter(({ e }) => importantOf(e.prev || { authority: e.authority, visits: e.visits, spam_score: e.spam }));
  if (riskImportant.length) alerts.push({ level: 'low', text: riskImportant.length + ' valuable link(s) not found on their page this week (' + riskImportant.slice(0, 3).map(x => x.e.ref_domain).join(', ') + '); checked again next week before calling them lost.' });
  if (reclaim.length) alerts.push({ level: 'low', text: reclaim.reduce((s, r) => s + r.links, 0) + ' link(s) point to ' + reclaim.length + ' broken page(s): redirect them to keep the value.' });
  const deliver = p.mode === 'full' || p.on_demand || alerts.some(a => a.level === 'high' || a.level === 'medium');
  // disavow candidates (review only: Google ignores most spam; disavow only for a manual action or a paid-link pattern you did not create)
  const disavow = [...new Set([...spammy.filter(x => x.spam >= 60 || SPAM_WORDS.test(x.anchor + ' ' + x.title)).map(x => x.from_domain), ...ledger.filter(r => r.link_type === 'spam' && r.status !== 'lost').map(r => r.ref_domain)])];
  const disavow_text = disavow.length ? '# Disavow candidates for ' + p.domain + ' (' + today + ')\n# Review before uploading at https://search.google.com/search-console/disavow-links — Google ignores most spam links on its own;\n# disavow only for a manual action or a clear paid-link pattern you did not create.\n' + disavow.map(d => 'domain:' + d).join('\n') + '\n' : '';
  // ---------------- prospects: value x likelihood ----------------
  const target0 = (p.assets[0] || {}).url || 'https://' + p.domain + '/';
  const candidates = [
    ...important_lost.map(l => ({ prospect_domain: l.from_domain, type: 'lost', origin: 'check', rank: l.domain_rank, spam_score: l.spam, score: scoreOf('lost', { authority: l.domain_rank, dr: l.dr }), detail: (REASON[l.reason] || 'lost') + ': linked to ' + pathOf(l.to_url) + ' from ' + l.from_url + (l.last_seen ? ' until ' + l.last_seen : ''), source_url: l.from_url, target_url: l.to_url })),
    ...reclaim.flatMap(r => r.domains.slice(0, 3).map(d => ({ prospect_domain: d, type: 'reclaim', origin: 'check', rank: 0, spam_score: 0, score: scoreOf('reclaim', ledger.find(x => x.ref_domain === d) || {}), detail: 'Links to ' + pathOf(r.broken_url) + ' (HTTP ' + (r.status || 'error') + '): 301-redirect it to ' + pathOf(r.redirect_to), source_url: '', target_url: r.redirect_to }))),
    ...mentions.slice(0, 12).map(x => ({ prospect_domain: x.domain, type: 'mention', origin: x.source, rank: x.domain_rank, spam_score: 0, score: scoreOf('mention', { authority: x.domain_rank, dr: x.dr }, x.verified ? 1 : 0.8), detail: 'Mentions you without a link' + (x.verified ? ' (checked on the page)' : '') + ': ' + x.title, source_url: x.url, target_url: 'https://' + p.domain + '/' })),
    ...lists.filter(l => !l.named && l.competitors.length).slice(0, 8).map(l => ({ prospect_domain: l.domain, type: 'list', origin: 'web', rank: l.domain_rank, spam_score: 0, score: scoreOf('list', { authority: l.domain_rank, dr: l.dr }, (1 + 0.15 * (l.competitors.length - 1)) * localOf(l.domain)), detail: '"' + String(l.title).slice(0, 90) + '" lists ' + l.competitors.join(', ') + ', not you', source_url: l.url, target_url: target0 })),
    ...lists.filter(l => l.named && !l.linked).slice(0, 4).map(l => ({ prospect_domain: l.domain, type: 'mention', origin: 'web', rank: l.domain_rank, spam_score: 0, score: scoreOf('mention', { authority: l.domain_rank, dr: l.dr }), detail: 'Lists you without a link: ' + String(l.title).slice(0, 100), source_url: l.url, target_url: 'https://' + p.domain + '/' })),
    ...compNew.slice(0, 10).map(c => ({ prospect_domain: c.domain, type: 'comp_new', origin: 'dfs', rank: c.domain_rank, spam_score: 0, score: scoreOf('comp_new', { authority: c.domain_rank, dr: c.dr }, localOf(c.domain)), detail: 'Linked to ' + c.competitor + ' on ' + c.first_seen + (c.title ? ': ' + c.title : ''), source_url: c.url, target_url: target0 })),
    ...gap.filter(g => g.source !== 'cc' ? gi >= 0 : true).slice(0, 25).map(g => ({ prospect_domain: g.domain, type: 'gap', origin: g.source, rank: g.rank, spam_score: g.spam, score: scoreOf('gap', { authority: g.rank, dr: drOf.get(g.domain) || 0, cc_rank: g.cc_rank }, (1 + 0.6 * (g.links_to.length - 1)) * localOf(g.domain)),   /* links to several competitors: the strongest intent signal; on the market's own domain ending: more relevant */ detail: 'Links to ' + g.links_to.join(', ') + (g.backlinks ? ' (' + g.backlinks + ' links)' : '') + ', not to you' + (g.source === 'cc' ? ' (Common Crawl)' : ''), source_url: '', target_url: target0 }))];
  const ledger_rows = ledger.map(({ visits_28d, _new, _dfs_new, _sources_now, ...r }) => r);
  const new_links = [...news.map(n => ({ ...n, verified: (vLink.get(LK.refKey(n.from_domain)) || {}).verify || '' })),
    ...ledger.filter(r => r._new && !r._dfs_new && r.kind === 'web' && r.status !== 'lost').map(r => ({ from_domain: r.ref_domain, from_url: r.from_url, to_url: r.to_url, anchor: r.anchor, dofollow: r.rel === 'follow', domain_rank: r.authority, dr: r.dr, page_rank: 0, spam: r.spam_score, first_seen: r.first_seen, last_seen: r.last_seen, title: r.page_title, spammy: r.link_type === 'spam', sources: r.sources, verified: r.verify }))]
    .filter((x, i, a) => a.findIndex(y => LK.refKey(y.from_domain) === LK.refKey(x.from_domain)) === i);
  return { json: { ...p, competitors, summary, lost, important_lost, new_links, spammy, reclaim, refdomains: [...linking].slice(0, 2000), timeseries: ts, mentions, gap, gap_stored: gi < 0 && gapBase.length > 0, gap_checked: gi < 0 ? ((p.stored_gap || [])[0] || {}).last_seen || '' : p.checked_at.slice(0, 10),
    lists, comp_new: compNew.slice(0, 20), coverage, anchors, pages, values, best_links, referral, wins, at_risk: atRisk.map(({ e, v }) => ({ ref_domain: e.ref_domain, url: v.url, verify: v.verify })), rel_changed: relChanged, dr_enabled: drOf.size > 0, dr_error,
    ledger_rows, alerts, deliver, disavow_text, candidates, gap_error: G && !G.ok ? G.error : null, cost_usd: +cost.toFixed(4) } };
});
