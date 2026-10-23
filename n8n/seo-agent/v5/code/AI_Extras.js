// W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §2): what the owner's coverage options found, one item per site whose run
// ends in this execution: the fan-out ranking gap (fanout_gap_json), the persona effect on API answers (notes_json.persona), demand with the
// monthly market trend (demand_json; the free proxies were written with the row by AI Vis Rows, this adds the trend when it was read), the
// money they cost (`cost_usd`: every task once by its own id across both attempts, read by the run's ledger settle), the update of the stored
// visibility row, and the results pages read now (seo_cache `serp:`, so every other path reads them for nothing today).
/*__AI_PANEL__*/
/*__SERP_CACHE__*/
/*__AI_ENTITIES__*/
/*__AI_W2E3__*/
const rowsOf2 = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const plans = $('AI Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do && !p.stop && (!p.chunk || p.chunk.final_expected));
const metrics = (() => { try { return $('AI Metrics').all().map(i => i.json).filter(m => m && m.site_id && !m.skip); } catch (e) { return []; } })();
let reqItems = []; try { reqItems = $('AI Extra Requests').all().map(i => i.json || {}); } catch (e) { reqItems = []; }
const extras_plan = (reqItems[0] || {}).extras_plan || {};
const reqs = reqItems.filter(r => r && !r.skip && r.kind);
let answers = []; try { answers = $('Run AI Extra Requests').all().map(i => i.json || {}); } catch (e) { answers = []; }
const pairs = reqs.map((q, i) => ({ q, r: answers.length === reqs.length ? answers[i] : null }));
// R-E1: the options are paid only after their keys are recorded in the run's state row (*Extras Asking State* -> *AI Extras Go*); when that record
// could not be saved nothing was asked, and the notes say so
const notRecorded = (() => { try { const g = $('AI Extras Go').all().map(i => i.json || {}); return g.length === 1 && g[0].skip && g[0].not_recorded ? String(g[0].reason || '') : ''; } catch (e) { return ''; } })();
const serpRows = rowsOf2('Load SERP Cache (AI)'), queries = rowsOf2('Load Query History'), pages = rowsOf2('Load Pages (AI)'), cache = rowsOf2('Load Cache (AI)'), vis = rowsOf2('Load AI Visibility');
const now = new Date().toISOString();
// a task's money counts once by its own id (the in-200 gate's per-item figure covers both attempts)
const costOf = (r) => { const v = Number((r || {}).__dfs_cost_usd); if (Number.isFinite(v)) return v; return ((r || {}).tasks || []).reduce((t, x) => t + (Number((x || {}).cost) || 0), 0); };
const parseJ = (t, d) => { try { const v = typeof t === 'string' ? JSON.parse(t || 'null') : t; return v == null ? d : v; } catch (e) { return d; } };
const out = [];
for (const p of plans) {
  const m = metrics.find(x => x.site_id === p.site_id); if (!m) continue;
  const xp = extras_plan[p.site_id] || {}; const o = xp.options || p.options || {};
  const mine = pairs.filter(x => x.q.site_id === p.site_id);
  const cost_usd = +mine.reduce((t, x) => t + costOf(x.r), 0).toFixed(4);
  // 1. the fan-out ranking gap: this run's readings, and the ones of today it reused
  let fanout_gap = null; const cache_rows = [];
  if (xp.top && xp.top.top && xp.top.top.length) {
    const ans = {};
    for (const q of xp.top.top) { const lk = SC.lookup(serpRows, AIX.serpBody(p, q.query), { now }); if (lk.hit) ans[q.key] = lk.response; }
    const fanCost = +mine.filter(x => x.q.kind === 'fanout').reduce((t, x) => t + costOf(x.r), 0).toFixed(4);
    for (const x of mine.filter(y => y.q.kind === 'fanout')) { if (x.r) ans[x.q.key] = x.r; const row = x.r ? SC.rowFor(x.r, x.q.body[0], p.site_id, { now, path: 'ai fan-out check' }) : null; if (row) cache_rows.push(row); }
    fanout_gap = AIX.fanoutGap({ plan: p, top: xp.top, answers: ans, queries, pages, setting: o.fanout_check, cost_usd: fanCost, now });
  }
  // 2. the persona effect (API answers), pooled with the stored runs of the last 28 days
  let persona = null; const pp = mine.filter(x => x.q.kind === 'persona');
  if (pp.length) {
    const D = AIE.dir({ ...p, brand_names: AIE.ownNames(p) }, AIE.bookOf(cache, p.site_id));
    const prev = vis.filter(v => v.site_id === p.site_id && v.run_id !== p.run_id).map(v => ({ checked_at: v.checked_at, persona: (parseJ(v.notes_json, {}) || {}).persona || null })).filter(v => v.persona);
    persona = AIX.personaEffect({ pairs: pp, previous: prev, now: p.checked_at || now, read: (text, cites) => { const X = AIE.read({ text, cites, entities: [] }, D); return { named: !!X.named, cited: !!X.cited }; } });
  }
  // 3. the monthly market trend, when it was read this run
  const dm = mine.filter(x => x.q.kind === 'demand');
  const market = dm.length ? AIX.marketOf(p, dm, now) : null;
  // the stored row: the free part of demand_json and the notes were written with it (AI Vis Rows); the trend, the persona effect and the fan-out
  // gap are added here, and the run's money grows by what the options cost
  const vrow = m.vis_row || {};
  const vrowNow = (() => { try { return $('AI Vis Rows').all().map(i => i.json).find(r => r && r.site_id === p.site_id && r.run_id === p.run_id) || vrow; } catch (e) { return vrow; } })();
  const notesNow = { ...(parseJ(vrowNow.notes_json, {}) || {}), ...(persona ? { persona } : {}), ...(xp.ceiling_note ? { ceiling_note: xp.ceiling_note } : {}),
    ...(xp.resend_note ? { resend_note: xp.resend_note } : {}), ...(notRecorded ? { extras_note: notRecorded } : {}) };   // R-E1
  const demandNow = parseJ(vrowNow.demand_json, null);
  const demand_json = market && demandNow ? JSON.stringify({ ...demandNow, market, market_carried: false }) : '';
  const vis_update = { site_id: p.site_id, run_id: p.run_id, notes_json: JSON.stringify(notesNow), cost_usd: +((Number(vrowNow.cost_usd) || Number(vrow.cost_usd) || 0) + cost_usd).toFixed(4),
    ...(fanout_gap ? { fanout_gap_json: JSON.stringify(fanout_gap) } : {}), ...(demand_json ? { demand_json } : {}),
    ...(persona ? { persona_effect_json: JSON.stringify(AIX.personaEffectRows(persona)) } : {}) };   // W2-A's contract addition: the persona effect in its own column
  out.push({ json: { site_id: p.site_id, run_id: p.run_id, domain: p.domain, fanout_gap, persona, market, demand: market && demandNow ? { ...demandNow, market, market_carried: false } : demandNow,
    notes: notesNow, ceiling_note: xp.ceiling_note || '', sent: xp.sent || {}, cost_usd, vis_update, cache_rows } });
}
return out.length ? out : [{ json: { skip: true, cost_usd: 0, reason: 'no site finishes its run here' } }];
