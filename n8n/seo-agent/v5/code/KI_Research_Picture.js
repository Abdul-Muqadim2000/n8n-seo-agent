// Research Picture (E2, DESIGN.md §3.3-§3.4): the candidates with their enrichment (Labs keyword overview + search intent, then the stored
// 30-day values), re-scored, and the top M chosen for a results-page read. A value is labelled with its basis and source: Search Console
// impressions are `measured`; Labs volume, CPC and KD are `provider_estimate` (DataForSEO Labs, dated); a keyword with no measured volume but
// two independent sources stays as "evidenced, volume not measured" (R1 #3), never deleted.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const c = $('Research Candidates').first().json || {};
const all = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return []; } };
const now = p.now || new Date().toISOString();
const pairs = KIW.paired(all('Any Research Enrich?').filter(r => r && !r.skip && r.ki_call), all('Run Research Enrich Answers'));
const volMap = { ...(c.vol_map || {}) };
const sections = [];
const ov = pairs.find(x => x.q.ki_call === 'labs_overview'), si = pairs.find(x => x.q.ki_call === 'labs_intent');
if (ov && ov.ok) for (const it of KIW.itemsOf(ov.a)) { const k = KIW.kwRow(it); if (!k.keyword) continue; const kk = KIW.keyOf(k.keyword);
  volMap[kk] = { ...(volMap[kk] || {}), v: k.volume, cpc: k.cpc, kd: k.kd, trend: k.trend, li: k.labs_intent, src: 'labs', at: now }; }
if (si && si.ok) for (const it of KIW.itemsOf(si.a)) { const kk = KIW.keyOf(it.keyword); const ki = it.keyword_intent || {};
  volMap[kk] = { ...(volMap[kk] || {}), intent: KIW.S(ki.label), intent_p: KIW.N(ki.probability), at: (volMap[kk] || {}).at || now, intent_at: now }; }
sections.push({ key: 'volume', ...(ov ? KIW.callState([ov], 'the search volumes') : { state: 'ok', reason: '' }), rows: ov && ov.ok ? KIW.itemsOf(ov.a).length : 0 });
sections.push({ key: 'intent', ...(si ? KIW.callState([si], 'the search intents') : { state: 'ok', reason: '' }), rows: si && si.ok ? KIW.itemsOf(si.a).length : 0 });
const rows = (c.rows || []).map(r => { const v = volMap[r.kw_key] || {};
  const volume = r.volume != null ? r.volume : (v.v != null ? v.v : null);
  const o = { ...r, volume, volume_source: r.volume != null ? (r.volume_source || 'labs') : (v.v != null ? (v.src || 'labs') : ''), cpc: r.cpc != null ? r.cpc : (v.cpc != null ? v.cpc : null), kd: r.kd != null ? r.kd : (v.kd != null ? v.kd : null),
    trend: r.trend || v.trend || null, labs_intent: r.labs_intent || v.li || '', intent_label: v.intent || '', intent_p: v.intent_p != null ? v.intent_p : null };
  o.prescore = KI.prescore(o, KI.CONFIG); return o; }).sort((a, b) => b.prescore - a.prescore || a.kw_key.localeCompare(b.kw_key));
const volRow = KIW.cacheRow(p.site_id, KIW.cacheKey(p.site_id, 'vol', p.market), { fetched_at: now, map: Object.fromEntries(Object.entries(volMap).filter(([, v]) => v && Date.parse(now) - Date.parse(v.at || 0) < KIW.ttlOf('volume') * 864e5).slice(0, 2000)) });
const changed = (ov && ov.ok) || (si && si.ok);
return [{ json: { rows, top_m: rows.slice(0, KIW.CAPS.top_m).map(r => r.keyword), vol_map: volMap, sections, cache_rows: changed ? [volRow] : [] } }];
