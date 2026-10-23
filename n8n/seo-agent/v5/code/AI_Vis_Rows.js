// The seo_ai_visibility rows (one per site per run; exact columns).
// W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §2): plus the free columns of this wave, written with the row so a part
// that dies in the paid options never leaves them out: the owner's uploaded AI reports for the period (imports_json), the n8n execution ids
// of the run's parts (exec_ids), the run's notes (notes_json: lost / unanalysed answers, questions asked outside their market) and demand as a
// range from the proxies already held (demand_json; the monthly market trend is carried from the last row that read it, with its date, and
// AI Extras replaces it when this run reads it). The fan-out gap and the persona effect are added by AI Extras.
/*__AI_PANEL__*/
/*__AI_W2E3__*/
const __rows2 = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const __plans = __rows2('AI Plan').filter(p => !p.nothing_to_do);
const __imports = __rows2('Load AI Imports'), __queries = __rows2('Load Query History'), __stored = __rows2('Load AI Prompts'), __fresh = __rows2('Prompt Rows').filter(r => !r.skip && r.prompt_id), __vis = __rows2('Load AI Visibility');
// the AI-answer database's question items this execution read (discovery on the run's first part, "questions citing you" on its last)
const __pairs = (reqN, resN) => { let q = [], r = []; try { q = $(reqN).all().map(i => i.json || {}); r = $(resN).all().map(i => i.json || {}); } catch (e) { return []; } return q.map((x, i) => ({ q: x, r: r[i] })); };
const __disc = __pairs('Discovery Requests', 'Run Discovery').filter(x => x.q.kind === 'discover');
const __idx = (() => { const ps = __pairs('AI Requests', 'Run AI Requests'); let mg = []; try { mg = $('Merge AI Answers').all().map(i => i.json || {}); } catch (e) {} if (mg.length === ps.length) ps.forEach((x, i) => { x.r = mg[i]; }); return ps.filter(x => x.q.engine === 'index_you'); })();
return $('AI Metrics').all().map(i => { const v = i.json.vis_row; const p = __plans.find(x => x.site_id === v.site_id) || null; if (!p) return { json: v };
  const now = String(v.checked_at || new Date().toISOString());
  const carried = (() => { for (const r of __vis.filter(x => x.site_id === v.site_id && x.run_id !== v.run_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))) {
    try { const d = JSON.parse(r.demand_json || 'null'); if (d && d.market) return d.market; } catch (e) {} } return null; })();
  const imports = AIX.imports(__imports, p, new Date().toISOString());
  const demand = AIX.demand({ plan: p, stored: __stored, fresh: __fresh, queries: __queries, imports: __imports, mentions: AIX.mentionItems([...__disc.filter(x => x.q.site_id === v.site_id), ...__idx.filter(x => x.q.site_id === v.site_id)], now), market: carried, market_carried: !!carried, now });
  return { json: { ...v, imports_json: imports ? JSON.stringify(imports) : '', exec_ids: AIX.execIds(p, $execution.id), notes_json: JSON.stringify(AIX.notes(p)),
    demand_json: (demand.questions.length || demand.market) ? JSON.stringify(demand) : '' } }; });
