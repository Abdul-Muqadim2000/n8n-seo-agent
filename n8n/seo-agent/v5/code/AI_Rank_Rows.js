// AIR row builder (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §2 / §4 / §5, package P4): one builder per table, the same source for every
// one (ai_rank_wiring.py bakes WHICH and the table's exact columns into each node). It reads `AI Rank Plan` EXPLICITLY (never $json: the node
// before it is a Data Table save, which answers with the row it wrote) and returns exactly the table's columns, or [{ skip: true }].
//   runs / questions / actions / sources / priors   the five seo_ai_rank_* tables: shadow and on
//   targets / prospects / proposed / core / cache / growth   the existing tables AIR may write: ONLY for a site in `on` (AIRF.writesSinks);
//                                                   a site in shadow, or a plan that failed, writes none of them
/*__AI_RANK_FLAGS__*/
// @@AIR_SINK_GATE@@
const WHICH = '__AIR_WHICH__';
const COLS = __AIR_COLS__;
const SINKS = ['targets', 'prospects', 'proposed', 'core', 'cache', 'growth'];
const JSON_MAX = 60000;
const plans = (() => { try { return $('AI Rank Plan').all().map(i => i.json || {}); } catch (e) { return []; } })().filter(p => p && p.site_id && !p.skip);
const exact = (r) => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]]));
const J = (x) => { try { return x == null ? '' : JSON.stringify(x); } catch (e) { return ''; } };
let execId = ''; try { execId = String($execution.id || ''); } catch (e) {}
// FX-B RB-5 (2026-11-06, REVIEW_B_SAFETY.md): the target sink read only the plan, whose stored targets are the start-of-run snapshot, and skipped only
// live work and wins. A question the client kept out ("kept by you"), or one the fit gate set aside (this run's AI Growth row, else the stored one),
// was queued again by AIR. Those are left alone now, and the sink keyword passes the fit gate (inlined in this builder only, at the AIR_SINK_GATE mark:
// brand, government, portal and job refusals; the topic bar judges nothing without topics, the Growth Plan's own verdict covers it).
const S1 = (v) => (v == null ? '' : String(v)).trim();
const rowsOf = (n) => { try { return $(n).all().map(i => i.json || {}).filter(r => r && r.target_id); } catch (e) { return []; } };
const tNow = WHICH === 'targets' ? rowsOf('AI Target Rows') : [], tStored = WHICH === 'targets' ? rowsOf('Load AI Targets') : [];
const listOf = (v) => { if (Array.isArray(v)) return v.map(S1).filter(Boolean); const t = S1(v); if (!t) return []; try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(S1).filter(Boolean); } catch (e) {} return t.split(/[,\n;|]+/).map(S1).filter(Boolean); };
const gateCtx = (p) => { if (typeof FITR !== 'object') return null; const by = (n) => { try { return $(n).all().map(i => i.json || {}).find(r => r && S1(r.site_id) === S1(p.site_id)) || {}; } catch (e) { return {}; } };
  const m = by('Load Monitors'), st = by('Load Sites');
  return FITR.ctx({ own_domain: p.domain, competitors: [...listOf(m.competitors), ...listOf(st.competitors)], services: [...listOf(st.declared_services), ...listOf(st.services)] }); };
const leaveAlone = (p, r) => { const t = tNow.find(x => S1(x.target_id) === S1(r.target_id)) || tStored.find(x => S1(x.target_id) === S1(r.target_id)) || {}; const st = S1(t.status);
  if (['writing', 'written', 'won'].includes(st)) return 'live work or a win';
  if (st === 'set_aside') return 'set aside by the fit gate';
  if (st === 'skipped' && /kept by you/i.test(S1(t.reason))) return 'kept by you';
  if (typeof fitGate === 'function' && S1(r.keyword)) { const c = gateCtx(p); const g = c ? fitGate(S1(r.keyword), c) : { ok: true }; if (g && g.ok === false) return 'the fit gate refuses it (' + S1(g.reason) + ')'; }
  return ''; };
const rows = [];
for (const p of plans) {
  const ok = !p.error && p.air && typeof p.air === 'object';
  if (SINKS.includes(WHICH)) {   // the sinks: `on` sites only, never a failed plan
    if (!ok || !AIRF.writesSinks({ mode: p.mode }, false)) continue;
    const sk = p.air.sinks || {};
    if (WHICH === 'growth') { if (sk.growth && sk.growth.run_id) rows.push(sk.growth); continue; }
    for (const r of (sk[WHICH] || [])) { if (WHICH === 'targets' && leaveAlone(p, r)) continue; rows.push(r); }
    continue;
  }
  if (WHICH === 'runs') {   // one row per site and run, also for a plan that failed (the run row is AIR's log)
    const a = ok ? p.air : {};
    const kits = (a.kits_missing || []);
    const row = { site_id: p.site_id, domain: p.domain || '', run_id: p.run_id || AIRF.runId(p.site_id, Date.now()), checked_at: a.checked_at || new Date().toISOString(), mode: p.mode || '', rule_version: AIRF.RULE_VERSION,
      panel_json: J(a.panel), diag_json: J(a.diag || []), sources_json: J((a.sources || []).slice(0, 60)), candidates_json: J((a.candidates || []).slice(0, 60)), chosen_json: J(a.chosen || []),
      old_json: J(a.old), compare_json: J(a.compare), memo_json: J(a.memo), cost_json: J(a.cost), learn_json: J({ outcomes: a.outcomes || [], learned: a.learn || [], fdr: a.fdr || null, deferred: (a.deferred || []).slice(0, 30), refused: (a.refused || []).slice(0, 30), set_aside: (a.set_aside || []).slice(0, 20) }),
      exec_id: execId, error: !ok ? String(p.error || 'the plan gave no result') : kits.length ? 'kit not built: ' + kits.join(', ') : '' };
    // FX-A RA-9: the compact stages (about 25 characters a question x engine) are what next week's memo and every action's start read; never trimmed
    if (COLS.includes('stages_json')) row.stages_json = J(a.stages || null);
    // at most 60 KB a row: the diagnosis goes first (it is rebuilt every week; stages_json keeps its stages), then the candidates, then the sources
    for (const k of ['diag_json', 'candidates_json', 'sources_json', 'learn_json']) { const size = COLS.reduce((n, c) => n + String(row[c] == null ? '' : row[c]).length, 0); if (size <= JSON_MAX) break; row[k] = J({ trimmed: true, chars: String(row[k]).length }); }
    rows.push(row); continue;
  }
  if (!ok) continue;
  for (const r of ((p.air.rows || {})[WHICH] || [])) rows.push(r);
}
return rows.length ? rows.map(r => ({ json: exact(r) })) : [{ json: { skip: true } }];
