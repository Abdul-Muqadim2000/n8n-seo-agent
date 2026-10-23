// W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §3; fixes/F3.md engine side #2): each question's asked state, written by
// the run's last part so the app shows what the engine did instead of mirroring its cut: the run that last asked it and when (a question with
// an answer row in this run, any engine), how many weekly runs and pulse mornings asked it in the last 28 days, and the run whose fit gate
// refused it. Only the rows whose state changed are written (Save Prompt State: an update by site + question id that touches these four
// columns only, so the owner's edits made meanwhile are never overwritten).
/*__AI_PANEL__*/
/*__AI_W2E3__*/
const rowsOf2 = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const plans = rowsOf2('AI Plan').filter(p => !p.nothing_to_do && !p.stop && (!p.chunk || p.chunk.final_expected));
const tb = (v) => v === true || String(v) === 'true';
// the run's answer rows read RAW: a request that failed carries its error and was still asked (rowsOf2 drops a row carrying `error`)
const raw = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && r.engine && r.prompt_id); } catch (e) { return []; } };
let rows = raw('Apply Analysis').filter(r => !r.skip); if (!rows.length) rows = raw('Parse AI Answers').filter(r => !r.skip);
rows = [...rows, ...raw('Load AI Run Answers').filter(r => r.run_id)];
const stored = rowsOf2('Load AI Prompts'), vis = rowsOf2('Load AI Visibility'), daily = rowsOf2('Load AI Daily');
const out = [];
const written = (() => { try { return $('Prompt Rows').all().map(i => i.json).filter(r => r && !r.skip && r.site_id && r.prompt_id); } catch (e) { return []; } })();   // R-E12: the questions stored by this execution (the run's first part)
for (const p of plans) out.push(...AIX.promptState({ plan: p, run_rows: rows, stored, written, vis_rows: vis, daily_rows: daily, now: new Date().toISOString() }));
return out.length ? out.map(r => ({ json: r })) : [{ json: { skip: true } }];
