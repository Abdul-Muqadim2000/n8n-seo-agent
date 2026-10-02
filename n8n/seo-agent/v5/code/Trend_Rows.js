// Rows for the Data Table "seo_trends" (the Content Cadence reads the rising related searches from here).
let t = []; try { t = $('Parse Trends').all().map(i => i.json).filter(x => x && !x.skip && !x.error && x.keyword); } catch (e) {}
const sites = $('Resolve Properties').all().map(i => i.json);
const rows = t.map(x => { const s = sites[x.site_idx] || {}; return { json: { site_id: x.site_id, domain: s.domain || '', keyword: x.keyword, checked_at: s.checked_at || new Date().toISOString(), period_end: ((s.ranges || {}).current || {}).end || '', direction: x.direction || 'unknown', change_pct: x.change_pct == null ? 0 : Number(x.change_pct), peak_date: x.peak_date || '', latest: Number(x.latest) || 0, average: Number(x.average) || 0,
  rising: (x.rising || []).map(r => r.query + ' (' + r.value + ')').join(', '), top: (x.top || []).map(r => r.query).join(', ') } }; });
return rows.length ? rows : [{ json: { skip: true } }];
