// W2-E2 (2026-10-23): the repeat pilot's answers -> per engine, the variance between questions and within one question asked again (one-way
// ANOVA on "named or not"), and the asks per question a week each engine needs for +/-5 points on the website's panel (AVX.pilot). The money is
// what the requests cost (DataForSEO's own figure per task), for the run's ledger.
/*__AI_STATS__*/
/*__AI_MEASURE__*/
const p = $('AI Plan').first().json;
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => r && !r.skip && r.engine && r.site_id === p.site_id); } catch (e) {}
const units = rows.filter(r => AVM.tb(r.answered)).map(r => ({ prompt_id: String(r.prompt_id).replace(/#r\d+$/, ''), engine: r.engine, named: AVM.named(r) }));
const failed = rows.filter(r => !AVM.tb(r.answered)).length;
let panel = 50; try { const m = $('Load Monitors').all().map(i => i.json).find(x => x && x.site_id === p.site_id); if (m && Number(m.ai_prompts_max) > 0) panel = Number(m.ai_prompts_max); } catch (e) {}
const by_engine = AVX.pilot(units, { panel, half_width: 5 });
const cost_usd = +rows.reduce((s, r) => s + (Number(r.cost) || 0), 0).toFixed(4);
return [{ json: { ...p, pilot_result: { panel, half_width: 5, answers: units.length, failed, questions: (p.panel || []).length, by_engine,
  note: 'Asked ' + (p.panel || []).length + ' questions ' + ((p.quote || {}).repeats || 10) + ' times each: ' + units.length + ' answers came back' + (failed ? ' (' + failed + ' failed and are not counted)' : '') + '. For each engine, the share of the variation that comes from the questions themselves (ICC) and the asks per question a week that give +/-5 points on your ' + panel + '-question panel.' },
  cost_usd } }];
