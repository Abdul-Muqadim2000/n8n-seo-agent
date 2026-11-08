// Research SERP Picture (E2, DESIGN.md §3.4): the top M results pages - from the day cache (cost 0) or this run's answers, every organic item
// through SU (google.com/goto redirects, R5 §13 L-1) - and the Google Ads volumes for the candidates Labs knew nothing about. A page that
// could not be read twice is `missing`: its keyword is scored without a results page and says so (low confidence), never "no competition".
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const pic = $('Research Picture').first().json || {};
const all = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return []; } };
const now = p.now || new Date().toISOString();
const m = { location_code: p.location_code, language_code: p.language_code };
const reqs = all('Any Research SERPs?').filter(r => r && !r.skip && r.ki_call);
const answers = all('Run Research SERPs Answers');
const pr = KIW.paired(reqs, answers);
const serpReqs = [], serpAns = [];
pr.forEach(x => { if (x.q.ki_call === 'serp') { serpReqs.push(x.q); serpAns.push(x.a); } });
const R = KIW.serpReadings(pic.top_m || [], m, all('Load SERP Cache (KI Research)').filter(r => r && r.key), serpReqs, serpAns, p.site_id, now, { own_domain: p.domain, services: p.services });
const ads = pr.find(x => x.q.ki_call === 'ads_volume');
const volMap = { ...(pic.vol_map || {}) }; let adsN = 0;
if (ads && ads.ok) for (const it of (KIW.task0(ads.a).result || [])) { if (!it || !it.keyword) continue; const kk = KIW.keyOf(it.keyword); adsN++;
  volMap[kk] = { ...(volMap[kk] || {}), ads_v: KIW.N(it.search_volume), ads_cpc: KIW.N(it.cpc), ads_at: now, at: (volMap[kk] || {}).at || now }; }
const sections = [{ key: 'results_pages', state: !R.read && (pic.top_m || []).length ? 'missing' : (R.missing ? 'partial' : 'ok'),
  reason: !R.read && (pic.top_m || []).length ? 'no results page could be read: ' + ((Object.values(R.by).find(r => r.source === 'missing') || {}).why || 'no answer') : (R.missing ? R.missing + ' of ' + (pic.top_m || []).length + ' results pages could not be read (those searches are scored without one, at low confidence)' : ''), rows: R.read }];
if (ads) sections.push({ key: 'ads_volume', ...KIW.callState([ads], 'the Google Ads volumes'), rows: adsN });
const volRow = adsN ? [KIW.cacheRow(p.site_id, KIW.cacheKey(p.site_id, 'vol', p.market), { fetched_at: now, map: volMap })] : [];
return [{ json: { by: R.by, read: R.read, missing: R.missing, live: serpReqs.length, serp_cache_rows: R.save, vol_map: volMap, sections, cache_rows: volRow } }];
