// G23, the self-correcting half (2026-10-13; FIX_PLAN "Also from the completion runs"): the guard's per-mode estimates had drifted up to
// 13x away from the money — `ai_visibility` reserved $0.06 and cost $0.79, backlinks $0.04 for $0.37, while the written page reserved $1.23
// and cost about $0.46 — and nothing moved them, so five customer runs were refused over figures nobody had checked since they were typed.
// When a run settles, the mode's rolling figure in seo_cache (`cost:ai:<mode>` / `cost:dfs:<mode>`, kind `cost`) moves toward what this run
// cost, keeps the last CC.KEEP amounts, and the estimate the guard then reserves is max(rolling x CC.HEADROOM, the recent maximum): it can
// fall as a mode gets cheaper but can never sit below what the mode has actually cost. The shipped tables stay the fallback for a mode with
// no history, and CC.CAP stops one freak run from locking the guard.
/*__COST_CAL__*/
const s = (() => { try { return $('Run Ledger Settle').first().json || {}; } catch (e) { return {}; } })();
let rows = []; try { rows = $('Load Cost Calibration').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { rows = []; }
const cal = CC.readCal(rows);
const parts = String(s.cost_mode || '').split('|');
const aiMode = String(parts[0] || ''), dfsMode = String(parts[1] || '');
const out = [];
// Claude: this run's own figure, priced from its characters. It is an estimate until the monthly reconciliation corrects the prices
// (reconcile_claude_cost.py writes the per-model factors into `cost:factor:claude`), and the row records that it is one.
if (aiMode && Number(s.ai_calls) > 0) out.push({ json: CC.calRow('ai', aiMode, Number(s.ai_usd) || 0, cal, !!s.ai_measured) });
// DataForSEO: only a MEASURED amount teaches the estimate anything. A run that merely repeated its own reservation would otherwise
// confirm itself for ever.
if (dfsMode && s.dfs_measured) out.push({ json: CC.calRow('dfs', dfsMode, Number(s.dfs_usd) || 0, cal, true) });
// and what the month has spent per model family, which is the only thing reconcile_claude_cost.py can compare the owner's Anthropic
// Console export with (the ledger rows carry one Claude figure, not a split). The figure resets when the month turns.
const month = new Date().toISOString().slice(0, 7);
for (const fam of Object.keys((s.ai_models || {}))) {
  const usd = Number(s.ai_models[fam]) || 0;
  if (usd > 0) out.push({ json: CC.monthRow(fam, usd, cal.models[fam], month) });
}
return out.length ? out : [{ json: { skip: true,
  reason: !aiMode && !dfsMode ? 'this run has no cost mode on its ledger row' : 'nothing measurable to learn from: no model call and no reported DataForSEO cost' } }];
