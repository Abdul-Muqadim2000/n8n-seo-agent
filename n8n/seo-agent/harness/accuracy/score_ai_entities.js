// F1a (2026-10-23): scores the generated *Parse AI Answers* node (weekly and pulse copies) on accuracy/ai_entities.json - who an AI answer
// names. Runnable on its own (`node accuracy/score_ai_entities.js` from harness/ with CODE_DIR set) to print every case.
//   competitors: precision / recall over (case, business) pairs; two predicted ids for one labelled business = one hit + one false positive
//   self: named, cited and position exact, per case
//   roles: a labelled platform / source must not be read as a competitor (and should carry its label)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_entities.json'), 'utf8'));
const FX = path.join(__dirname, '..', 'fixtures_live');
const A10 = (() => { try { return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(FX, 'r_a10_aivis623.json.gz'))).toString('utf8')); } catch (e) { return null; } })();

const planFor = (c, i) => {
  const s = SET.sites[c.site]; let p;
  if (s.from_fixture) { const P = A10.plan; p = { site_id: P.site_id || 'site_techand-ai', domain: P.domain, business_name: P.business_name, brand_names: P.brand_names, competitors: P.competitors, configured_competitors: P.configured_competitors, aliases: P.aliases, services: P.services, topics: P.topics }; }
  else p = { site_id: 'site_' + c.site.replace(/[^a-z0-9]+/g, '-'), ...JSON.parse(JSON.stringify(s)) };
  if (c.configured_extra) { p.configured_competitors = [...p.configured_competitors, ...c.configured_extra]; p.competitors = [...p.competitors, ...c.configured_extra]; }
  return { ...p, run_id: 'acc_' + c.id + '_' + i, prompts: [], engines: [c.engine] };
};
const responseFor = (c) => {
  if (c.fixture) return JSON.parse(fs.readFileSync(path.join(FX, c.fixture), 'utf8'));
  const cites = (c.cites || []).map(x => ({ url: x.url, title: x.title || '' }));
  let res;
  if (c.engine === 'chatgpt') res = { markdown: c.text, sources: cites, brand_entities: (c.entities || []).map(t => ({ title: t })), items: [] };
  else if (c.engine === 'ai_overview' || c.engine === 'ai_mode') res = { items: [{ type: 'ai_overview', markdown: c.text, references: cites }] };
  else res = { items: [{ sections: [{ text: c.text, annotations: cites }] }] };
  return { tasks: [{ status_code: 20000, cost: 0, result: [res] }] };
};
const alts = (x) => String(x).toLowerCase().split('|');

async function scoreEntities(H, log, opts) {
  const o = opts || {}; const code = o.code || 'Parse_AI_Answers'; const out = { tune: null, holdout: null, rows: [] };
  for (const [i, c] of SET.cases.entries()) {
    const plan = planFor(c, i);
    H.mock('AI Plan', [{ json: plan }]);
    H.mock('Load Cache (AI)', [{ json: {} }]);
    H.mock('AI Requests', [{ json: { site_id: plan.site_id, domain: plan.domain, run_id: plan.run_id, engine: c.engine, prompt_id: 'p_' + c.id, prompt: 'q', kind: 'recommend', topic: '', run_kind: o.run_kind || 'weekly' } }]);
    const r = (await H.run('Parse AI Answers', [{ json: responseFor(c) }], { code }))[0].json;
    // the code before F1a had no entities: its competitor list, and rank > 0 for "named" (for the before / after figures in fixes/F1a.md)
    if (!Array.isArray(r.entities)) { r.entities = String(r.competitors || '').split(/,\s*/).filter(Boolean).map(id => ({ id, role: 'competitor' })); r.named = Number(r.rank) > 0; r.position = Number(r.rank) > 0 ? Number(r.rank) : null; }
    const ents = r.entities || [];
    const comps = ents.filter(e => e.role === 'competitor').map(e => String(e.id).toLowerCase());
    const want = c.expect.competitors || [];
    const used = new Set(); let tp = 0, fp = 0;
    const fps = [];
    for (const id of comps) { const k = want.findIndex((w, j) => !used.has(j) && alts(w).includes(id)); if (k >= 0) { used.add(k); tp++; } else { fp++; fps.push(id); } }
    const fns = want.filter((w, j) => !used.has(j));
    const roleErr = [];
    for (const [id, role] of Object.entries(c.expect.roles || {})) { const e = ents.find(x => alts(id).includes(String(x.id).toLowerCase()));
      const ok = e ? e.role === role : (role === 'source' || role === 'other'); if (!ok) roleErr.push(id + ' ' + role + '/' + (e ? e.role : 'absent')); }
    const row = { id: c.id, split: c.split, tp, fp, fn: fns.length, fps, fns, named: r.named === c.expect.named, cited: r.cited === c.expect.cited,
      position: (r.position == null ? null : r.position) === c.expect.position, got: { named: r.named, cited: r.cited, position: r.position, competitors: comps }, roleErr, roles: Object.keys(c.expect.roles || {}).length };
    out.rows.push(row);
    if (log && !(o.hide_holdout && c.split === 'holdout') && (o.verbose || row.fp || row.fn || !row.named || !row.cited || !row.position || roleErr.length))
      log('   ' + c.id + ' ' + (row.fp || row.fn || !row.named || !row.cited || !row.position || roleErr.length ? 'MISS ' : 'ok   ') + JSON.stringify({ fp: fps, fn: fns, named: [r.named, c.expect.named], cited: [r.cited, c.expect.cited], position: [r.position, c.expect.position], roles: roleErr }));
  }
  for (const sp of ['tune', 'holdout', 'all']) {
    const R = out.rows.filter(x => sp === 'all' || x.split === sp);
    const tp = R.reduce((s, x) => s + x.tp, 0), fp = R.reduce((s, x) => s + x.fp, 0), fn = R.reduce((s, x) => s + x.fn, 0);
    const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 100;
    out[sp] = { cases: R.length, tp, fp, fn, precision: pct(tp, tp + fp), recall: pct(tp, tp + fn), self_named: pct(R.filter(x => x.named).length, R.length), self_cited: pct(R.filter(x => x.cited).length, R.length),
      position: pct(R.filter(x => x.position).length, R.length), roles: pct(R.reduce((s, x) => s + x.roles - x.roleErr.length, 0), R.reduce((s, x) => s + x.roles, 0)) };
  }
  return out;
}
module.exports = { scoreEntities, SET };
if (require.main === module) {
  const H = require(path.join(__dirname, '..', 'harness.js'));
  (async () => { const hide = process.argv.includes('--hide-holdout'); const r = await scoreEntities(H, console.log, { verbose: !process.argv.includes('--quiet'), hide_holdout: hide }); console.log(JSON.stringify(hide ? { tune: r.tune } : { tune: r.tune, holdout: r.holdout, all: r.all }, null, 1)); })();
}
