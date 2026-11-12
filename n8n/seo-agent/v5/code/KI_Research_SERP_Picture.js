// Research SERP Picture (E2, DESIGN.md §3.4; QUEUE 2026-11-11): the top M results pages - from the day cache (cost 0, an exact reading only),
// the normal-priority queue (exact page addresses, collected by task id over up to __ROUNDS__ rounds) or, for what the queue did not return,
// a live read (its addresses are approximate: hosts are right, pages are not) - every organic item through SU (google.com/goto redirects,
// R5 §13 L-1) - and the Google Ads volumes for the candidates Labs knew nothing about. A page that could not be read at all is `missing`:
// its keyword is scored without a results page and says so (low confidence), never "no competition".
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const pic = $('Research Picture').first().json || {};
const all = (n) => { try { return $(n).all(0).map(i => (i && i.json) || {}); } catch (e) { return []; } };
const now = p.now || new Date().toISOString();
const m = { location_code: p.location_code, language_code: p.language_code };
const reqs = all('Any Research SERPs?').filter(r => r && !r.skip && r.ki_call);
const answers = all('Run Research SERPs Answers');
const pr = KIW.paired(reqs, answers);
const serpReqs = [], serpAns = [];
// the queue's answers, by keyword (the first round that returned it), then the live fallback for the rest
const got = new Set(); let queued = 0, failedQ = 0;
for (let n = 1; n <= __ROUNDS__; n++) { const r = KIW.collectRound(all('Wait For SERP Tasks (' + n + ')'), all('Get SERP Tasks (' + n + ')')); failedQ += r.failed.length;
  for (const x of r.ready) { if (!x.keyword || got.has(x.keyword)) continue; got.add(x.keyword); queued++; serpReqs.push({ ki_call: 'serp', keyword: x.keyword, ki_source: 'queue' }); serpAns.push(x.answer); } }
const liveReqs = all('Any Research SERPs Live?').filter(r => r && !r.skip && r.ki_call === 'serp');
const livePr = KIW.paired(liveReqs, all('Run Research SERPs Live Answers'));
let live = 0; for (const x of livePr) { const k = KIW.normKw(x.q.keyword); if (!k || got.has(k)) continue; got.add(k); if (x.ok) live++; serpReqs.push({ ...x.q, ki_source: 'live' }); serpAns.push(x.a); }
// a live reading asked in the first step (the shape before the queue, and the one a caller may still send) is read as live
for (const x of pr) { if (x.q.ki_call !== 'serp') continue; const k = KIW.normKw(x.q.keyword); if (!k || got.has(k)) continue; got.add(k); if (x.ok) live++; serpReqs.push({ ...x.q, ki_source: 'live' }); serpAns.push(x.a); }
const posted = pr.filter(x => x.q.ki_call === 'serp_post').length;
const R = KIW.serpReadings(pic.top_m || [], m, all('Load SERP Cache (KI Research)').filter(r => r && r.key), serpReqs, serpAns, p.site_id, now, { own_domain: p.domain, services: p.services, need_exact: true });
const exactN = Object.values(R.by).filter(r => r.source !== 'missing' && r.exact).length;
const ads = pr.find(x => x.q.ki_call === 'ads_volume');
const volMap = { ...(pic.vol_map || {}) }; let adsN = 0;
if (ads && ads.ok) for (const it of (KIW.task0(ads.a).result || [])) { if (!it || !it.keyword) continue; const kk = KIW.keyOf(it.keyword); adsN++;
  volMap[kk] = { ...(volMap[kk] || {}), ads_v: KIW.N(it.search_volume), ads_cpc: KIW.N(it.cpc), ads_at: now, at: (volMap[kk] || {}).at || now }; }
const sections = [{ key: 'results_pages', state: !R.read && (pic.top_m || []).length ? 'missing' : (R.missing ? 'partial' : 'ok'),
  reason: !R.read && (pic.top_m || []).length ? 'no results page could be read: ' + ((Object.values(R.by).find(r => r.source === 'missing') || {}).why || 'no answer') : (R.missing ? R.missing + ' of ' + (pic.top_m || []).length + ' results pages could not be read (those searches are scored without one, at low confidence)' : ''), rows: R.read },
  // QUEUE: how the pages were read; searches are grouped only on pages with exact addresses
  // a few pages without exact addresses do not make the run partial: under 90% exact it is, and none at all is missing (the count is always said)
  { key: 'results_pages_exact', state: !R.read ? 'skipped' : (exactN >= R.read * 0.9 ? 'ok' : (exactN ? 'partial' : 'missing')),
    reason: !R.read ? '' : (exactN >= R.read ? '' : (R.read - exactN) + ' of ' + R.read + ' results pages were read without exact page addresses (searches on them are scored but not grouped)'), rows: exactN }];
if (ads) sections.push({ key: 'ads_volume', ...KIW.callState([ads], 'the Google Ads volumes'), rows: adsN });
const volRow = adsN ? [KIW.cacheRow(p.site_id, KIW.cacheKey(p.site_id, 'vol', p.market), { fetched_at: now, map: volMap })] : [];
return [{ json: { by: R.by, read: R.read, missing: R.missing, live, queued, posted, queue_failed: failedQ, exact: exactN, serp_cache_rows: R.save, vol_map: volMap, sections, cache_rows: volRow } }];
