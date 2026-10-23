// W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §2 / §4): the paid requests of the owner's coverage options, asked once
// per run in its LAST part, after the week is measured and stored (Save AI Visibility, and the run's `done` state in Save AI Cache): a part that
// dies here can never make the run ask its questions again, and the week's figures are already safe. Nothing here runs unless its option is on:
//  * the fan-out check (`ai_fanout_check` N): Google's top 10 for the N most frequent searches the engines ran this run; a results page read
//    earlier today (any path, seo_cache `serp:`, the shared SC kit) is reused for nothing;
//  * the persona test (`ai_persona_context`): the same questions asked of the ChatGPT API with each buyer role as the asker's context, and
//    once without (one control for every role);
//  * the monthly market trend (`ai_demand_market`, the month's full run only): 3 LLM Mentions tasks.
// The run's money ceiling (F2) holds: the options are added in that order (trend, fan-out, persona) only while the run's measured DataForSEO
// money plus their estimate stays under it; what does not fit is named in the run's notes, never asked.
/*__AI_PANEL__*/
/*__SERP_CACHE__*/
/*__AI_W2E3__*/
const plans = $('AI Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do && !p.stop && (!p.chunk || p.chunk.final_expected));
const metrics = (() => { try { return $('AI Metrics').all().map(i => i.json).filter(m => m && m.site_id && !m.skip); } catch (e) { return []; } })();
const rowsOf2 = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const serpRows = rowsOf2('Load SERP Cache (AI)');
// the run's answers: this part's (analysed, else parsed) and the ones its earlier parts stored, exactly as AI Metrics reads them
const tb = (v) => v === true || String(v) === 'true';
let rows = rowsOf2('Apply Analysis').filter(r => !r.skip && r.engine); if (!rows.length) rows = rowsOf2('Parse AI Answers').filter(r => !r.skip && r.engine);
{ const seen = new Set(rows.map(r => r.site_id + '|' + r.run_id + '|' + r.prompt_id + '|' + r.engine));
  for (const r of rowsOf2('Load AI Run Answers')) { if (!r.run_id || !r.engine || !r.prompt_id) continue; const k = r.site_id + '|' + r.run_id + '|' + r.prompt_id + '|' + r.engine; if (seen.has(k)) continue; seen.add(k); rows.push({ ...r, answered: tb(r.answered) }); } }
const now = new Date().toISOString();
const out = []; const extras_plan = {};
for (const p of plans) {
  const m = metrics.find(x => x.site_id === p.site_id); if (!m) continue;
  const o = p.options || AIX.optionsOf({});
  const settings = { persona_context: o.persona_context, personas: p.persona_roles || [], demand_market: o.demand_market };
  const mine = rows.filter(r => r.site_id === p.site_id && r.run_id === p.run_id && r.kind !== 'brand');
  const top = o.fanout_check > 0 ? AIX.fanoutTop(mine, o.fanout_check) : null;
  const fan = top ? AIX.fanoutRequests(p, top.top, serpRows, now) : { requests: [], hits: {} };
  const demandReqs = AIX.demandRequests(p, settings, now);
  const personaReqs = AIX.personaRequests(p, settings);
  // F2's money ceiling: the run's measured DataForSEO money (every part, AI Metrics' vis_row) plus each option's estimate
  const ceiling = Number(p.ceiling_dfs_usd) || 0; let spent = Number((m.vis_row || {}).cost_usd) || 0; const left = []; const sent = { demand: 0, fanout: 0, persona: 0 };
  for (const [kind, reqs] of [['demand', demandReqs], ['fanout', fan.requests], ['persona', personaReqs]]) {
    const est = reqs.reduce((t, r) => t + (Number(r.est_cost) || 0), 0);
    if (!reqs.length) continue;
    if (ceiling > 0 && spent + est > ceiling + 1e-9) { left.push(kind + ' (' + reqs.length + ' request(s), about $' + est.toFixed(2) + ')'); continue; }
    spent += est; sent[kind] = reqs.length; for (const r of reqs) out.push({ json: { ...r, run_id: p.run_id } }); }
  extras_plan[p.site_id] = { run_id: p.run_id, top, fanout_from_reading_today: Object.keys(fan.hits).length, sent, options: o,
    ceiling_note: left.length ? 'Not asked this run, to stay under the run\'s DataForSEO ceiling of $' + ceiling.toFixed(2) + ': ' + left.join('; ') + '.' : '' };
}
if (!out.length) return [{ json: { skip: true, extras_plan, reason: Object.keys(extras_plan).length ? 'no option asks a paid request this run (or every fan-out search was read earlier today)' : 'no site finishes its run here' } }];
out[0].json.extras_plan = extras_plan;
return out;
