#!/usr/bin/env node
// AIR offline replay (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §7.2 stage 1, package P4): runs the GENERATED AI Growth workflow
// (workflows/SEO_Agent_AI_Growth.json, the exact code production would run) on a dump of the Data Tables, with every website switched to
// `shadow`, for the last few recorded weeks, and writes what AIR would have done next to what the current logic did. $0 and read-only:
//   * no network: every outside request a node makes is answered locally (an empty page / an empty API answer) and counted; Node's own
//     http / https / fetch are blocked for the whole replay, and `network` in the result is the number of attempts (it must be 0);
//   * no write anywhere but OUT_DIR: the tables are copies in memory; the output folder may not be inside the repository (client data
//     stays private; the repository is public);
//   * it prints counts and file names only, never a row, a URL, a question or a key.
// Usage (outputs go to the PRIVATE folder):
//   IN_DIR=~/seo-agent-secrets/ai-ranking-2026-11-05/data OUT_DIR=~/seo-agent-secrets/ai-ranking-2026-11-05/replay node harness/ai_rank_replay.js
//   options (env): WEEKS=3 (the last N weeks with a stored AI Growth row; else N Mondays back), AT=2026-10-26T10:00:00Z,... (explicit dates),
//                  SITES=site_a,site_b (default every site in seo_sites), WF=<workflow json> (default the generated AI Growth workflow)
// Input: one `<table>.json` per Data Table in IN_DIR (an array of rows, or { data: [...] }). Output in OUT_DIR: replay_<site>_<yyyymmdd>.json
// (the AIR rows of that site and week, the old logic's choice of the replayed run and of the stored production run), summary.json, replay.html.
const fs = require('fs'); const path = require('path');
const { exec } = require('./air_graph_exec');
const DAY = 864e5;
const REPO = path.resolve(__dirname, '..');
const DATE_COLS = ['checked_at', 'created_at', 'first_seen', 'date', 'updated_at', 'period_end', 'started_at'];
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const P = (s, d) => { if (s && typeof s === 'object') return s; try { const v = JSON.parse(String(s || '')); return v == null ? d : v; } catch (e) { return d; } };
const inside = (p, root) => { const a = path.resolve(p) + path.sep, b = root + path.sep; return a.startsWith(b); };

function loadDump(dir) {
  const t = {};
  for (const f of fs.readdirSync(dir).filter(f => /^seo_[a-z0-9_]+\.json$/.test(f))) {
    let v = null; try { v = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
    const rows = Array.isArray(v) ? v : (v && Array.isArray(v.data) ? v.data : null); if (rows) t[f.replace(/\.json$/, '')] = rows;
  }
  return t;
}
// the tables as they stood at `at`: a row dated after it did not exist yet (rows with no date column are kept)
function asOf(tables, at) {
  const out = {};
  for (const [name, rows] of Object.entries(tables)) out[name] = rows.filter(r => { const c = DATE_COLS.find(k => r && r[k]); if (!c) return true; const x = Date.parse(String(r[c]).replace(' ', 'T')); return !Number.isFinite(x) || x <= at; })
    .map(r => { const { id, createdAt, updatedAt, ...rest } = r || {}; return rest; });
  return out;
}
function datesOf(tables, sites, o) {
  if (o.AT) return String(o.AT).split(',').map(s => Date.parse(s.trim())).filter(Number.isFinite).sort((a, b) => a - b);
  const n = Math.max(1, Math.min(12, Number(o.WEEKS) || 3));
  const g = (tables.seo_ai_growth || []).filter(r => !sites.length || sites.includes(r.site_id)).map(r => Date.parse(r.checked_at)).filter(Number.isFinite);
  const days = [...new Set(g.map(x => new Date(x).toISOString().slice(0, 10)))].sort().slice(-n).map(d => Date.parse(d + 'T12:00:00Z'));
  if (days.length >= n) return days;
  const last = days.length ? days[days.length - 1] : Date.parse(new Date().toISOString().slice(0, 10) + 'T12:00:00Z');
  const out = days.slice(); for (let k = 1; out.length < n; k++) out.unshift(last - 7 * k * DAY);
  return out.sort((a, b) => a - b);
}
// every outside request is answered here: nothing leaves the machine
function offline(counter) {
  return (node, req) => { counter.n++; counter.by[node] = (counter.by[node] || 0) + 1;
    const u = String(req.url || '');
    if (/api\.anthropic\.com\/v1\/messages\/count_tokens/.test(u)) return { input_tokens: 0 };
    if (/api\.dataforseo\.com\/v3\/appendix\/user_data/.test(u)) return { status_code: 20000, tasks: [{ status_code: 20000, result: [{ money: { balance: 0 } }] }] };
    if (/bing\.com\/webmaster/i.test(u)) return { d: null };
    if (req.method === 'POST') return req.text ? { statusCode: 204, headers: {}, data: '' } : {};
    return req.text ? { statusCode: 404, headers: {}, data: '' } : {}; };
}
function blockNetwork() {
  const http = require('http'), https = require('https'); const saved = { hr: http.request, hg: http.get, sr: https.request, sg: https.get, f: globalThis.fetch }; const attempts = { n: 0 };
  const no = () => { attempts.n++; throw new Error('ai_rank_replay: the network is blocked during a replay'); };
  http.request = no; http.get = no; https.request = no; https.get = no; if (saved.f) globalThis.fetch = async () => no();
  return { attempts, restore: () => { http.request = saved.hr; http.get = saved.hg; https.request = saved.sr; https.get = saved.sg; if (saved.f) globalThis.fetch = saved.f; } };
}
const memoHtml = (m) => !m ? '<p class="muted">No memo: the decision kit is not built yet.</p>'
  : (m.parts || []).map(p => '<h4>' + esc(p.title) + '</h4>' + ((p.lines || []).length ? '<ul>' + p.lines.map(l => '<li>' + esc(l.text) + ((l.figures || []).length ? ' <span class="muted">(' + l.figures.map(f => esc(f.name) + ' ' + esc(f.value) + ' ' + esc(f.basis)).join('; ') + ')</span>' : '') + '</li>').join('') + '</ul>' : '<p class="muted">nothing</p>')).join('');
const actList = (xs, f) => (xs || []).length ? '<ol>' + xs.slice(0, 12).map(x => '<li>' + f(x) + '</li>').join('') + '</ol>' : '<p class="muted">none</p>';

async function main(opts) {
  const o = Object.assign({}, process.env, opts || {}); const log = typeof o.log === 'function' ? o.log : (s) => console.log(s);
  if (!o.IN_DIR || !o.OUT_DIR) throw new Error('ai_rank_replay: IN_DIR (the private dump) and OUT_DIR (a private folder) are required');
  if (inside(o.OUT_DIR, REPO)) throw new Error('ai_rank_replay: OUT_DIR is inside the repository; client data stays in the private folder');
  const wfFile = o.WF || path.join(REPO, 'workflows', 'SEO_Agent_AI_Growth.json');
  let wf = JSON.parse(fs.readFileSync(wfFile, 'utf8')); wf = Array.isArray(wf) ? wf[0] : wf;
  const dump = loadDump(o.IN_DIR);
  const sites = (o.SITES ? String(o.SITES).split(',').map(s => s.trim()).filter(Boolean) : (dump.seo_sites || []).map(s => s.site_id)).filter(Boolean);
  if (!sites.length) throw new Error('ai_rank_replay: no website in seo_sites.json (or SITES)');
  const dates = datesOf(dump, sites, o);
  fs.mkdirSync(o.OUT_DIR, { recursive: true });
  const net = blockNetwork(); const counter = { n: 0, by: {} }; const summary = []; let html = '';
  try {
    for (const at of dates) {
      const t = asOf(dump, at);
      // every website in shadow for the replay (its stored row otherwise kept); a site with no row gets one
      t.seo_monitors = t.seo_monitors || [];
      for (const sid of sites) { const m = t.seo_monitors.find(r => r.site_id === sid); if (m) m.ai_rank_mode = 'shadow'; else t.seo_monitors.push({ site_id: sid, domain: ((t.seo_sites || []).find(s => s.site_id === sid) || {}).domain || '', ai_rank_mode: 'shadow' }); }
      t.seo_cache = (t.seo_cache || []).filter(r => r.key !== 'air:kill');
      for (const sid of sites) {
        const r = await exec({ wf, trigger: { site_id: sid }, tables: t, http: offline(counter), agent: () => ({ drafts: [] }), now: at, seed: 'air-replay', execId: 'replay-' + sid + '-' + new Date(at).toISOString().slice(0, 10) });
        const plan = ((r.runs['AI Rank Plan'] || []).slice(-1)[0] || [[]])[0].map(i => i.json).find(p => p.site_id === sid) || null;
        const w = (tbl) => r.writes.filter(x => x.table === tbl && x.op !== 'deleteRows').flatMap(x => x.rows).filter(x => x.site_id === sid);
        const runRow = w('seo_ai_rank_runs')[0] || null;
        const prod = (dump.seo_ai_growth || []).filter(g => g.site_id === sid && Date.parse(g.checked_at) <= at + DAY).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
        const outside = r.writes.filter(x => !/^seo_ai_rank_/.test(x.table) && /^(Save AI Rank|Set Core Until|Patch AI Growth)/.test(x.node)).length;
        const rec = { site_id: sid, at: new Date(at).toISOString(), mode: plan ? plan.mode : '', error: runRow ? runRow.error : (plan ? plan.error : 'AIR did not run (the site was not planned by AI Growth this week)'),
          kits_missing: plan && plan.air ? plan.air.kits_missing : [], ran: !!r.order.includes('AI Rank Plan'), report_runs: r.order.filter(n => n === 'Growth Report').length, node_errors: r.errors,
          air_rows: { runs: w('seo_ai_rank_runs').length, questions: w('seo_ai_rank_questions').length, actions: w('seo_ai_rank_actions').length, sources: w('seo_ai_rank_sources').length, priors: r.writes.filter(x => x.table === 'seo_ai_rank_priors').flatMap(x => x.rows).length },
          writes_outside_air: outside, air: plan ? plan.air : null, run_row: runRow,
          old_replayed: plan && plan.air ? plan.air.old : (runRow ? P(runRow.old_json, null) : null),
          old_production: prod ? { checked_at: prod.checked_at, actions: P(prod.actions_json, []), earned: P(prod.earned_json, []), targets: P(prod.targets_json, {}) } : null,
          questions: w('seo_ai_rank_questions'), actions: w('seo_ai_rank_actions'), sources: w('seo_ai_rank_sources') };
        const file = 'replay_' + sid + '_' + new Date(at).toISOString().slice(0, 10).replace(/-/g, '') + '.json';
        fs.writeFileSync(path.join(o.OUT_DIR, file), JSON.stringify(rec, null, 1));
        summary.push({ site_id: sid, at: rec.at, file, ran: rec.ran, error: rec.error, kits_missing: rec.kits_missing, air_rows: rec.air_rows, writes_outside_air: outside, report_runs: rec.report_runs, node_errors: r.errors.length });
        const a = rec.air || {};
        html += '<section><h2>' + esc(sid) + ' <span class="muted">as of ' + esc(rec.at.slice(0, 10)) + '</span></h2>'
          + '<p>' + (rec.error ? '<b>' + esc(rec.error) + '</b>' : 'AIR ran with every kit built.') + ' AIR rows: ' + Object.entries(rec.air_rows).map(([k, v]) => esc(k) + ' ' + v).join(', ')
          + '. Rows written outside the AIR tables: <b>' + outside + '</b>. Growth Report ran ' + rec.report_runs + ' time(s).</p>'
          + '<div class="cols"><div><h3>AIR\'s plan</h3>' + actList(a.chosen, (x) => esc(x.lever) + ' ' + esc(x.executor || '') + ' &rarr; ' + esc(x.sink || '') + ' ' + esc(JSON.stringify(x.ref || {}))) + '</div>'
          + '<div><h3>The current logic (this replay)</h3>' + actList(((rec.old_replayed || {}).actions || []), (x) => esc(x.type) + ': ' + esc(x.action)) + '</div>'
          + '<div><h3>The current logic (production, ' + esc(rec.old_production ? String(rec.old_production.checked_at).slice(0, 10) : 'no row') + ')</h3>' + actList(((rec.old_production || {}).actions || []), (x) => esc(x.type) + ': ' + esc(x.action)) + '</div></div>'
          + '<h3>This plan and the current one</h3>' + (a.compare ? '<p>' + esc(JSON.stringify(a.compare)) + '</p>' : '<p class="muted">Not compared: the decision kit is not built yet.</p>')
          + '<h3>Memo</h3>' + memoHtml(a.memo) + '</section>';
      }
    }
  } finally { net.restore(); }
  const result = { weeks: dates.length, sites: sites.length, runs: summary.length, network: net.attempts.n, answered_offline: counter.n, outside_writes: summary.reduce((n, s) => n + s.writes_outside_air, 0),
    errors: summary.filter(s => s.error && !/^kit not built/.test(s.error)).length, kit_missing_runs: summary.filter(s => /^kit not built/.test(s.error || '')).length };
  fs.writeFileSync(path.join(o.OUT_DIR, 'summary.json'), JSON.stringify({ ...result, generated_at: new Date().toISOString(), workflow: path.basename(wfFile), rows: summary }, null, 1));
  fs.writeFileSync(path.join(o.OUT_DIR, 'replay.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AIR shadow replay</title>'
    + '<style>:root{--bg:#fff;--fg:#14171f;--mu:#5b6270;--ln:#e3e6ec}@media (prefers-color-scheme: dark){:root{--bg:#12141a;--fg:#e8eaf0;--mu:#9aa1ad;--ln:#2a2e38}}body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px}'
    + 'section{border-top:1px solid var(--ln);padding:12px 0}.muted{color:var(--mu)}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}h2{font-size:18px}h3{font-size:15px;margin:10px 0 4px}h4{font-size:13px;margin:8px 0 2px}</style></head><body>'
    + '<h1>AIR shadow replay</h1><p class="muted">Offline replay of the generated AI Growth workflow on a private table dump, every website in shadow. ' + result.runs + ' run(s), ' + result.weeks + ' week(s), '
    + result.answered_offline + ' outside request(s) answered locally, ' + result.network + ' network attempt(s), ' + result.outside_writes + ' write(s) outside the AIR tables.</p>' + html + '</body></html>');
  log('ai_rank_replay: ' + result.runs + ' run(s) over ' + result.weeks + ' week(s) and ' + result.sites + ' site(s); ' + result.kit_missing_runs + ' with a kit not built yet, ' + result.errors + ' with another error; '
    + result.outside_writes + ' write(s) outside the AIR tables; ' + result.answered_offline + ' outside request(s) answered locally, ' + result.network + ' network attempt(s)');
  log('ai_rank_replay: wrote ' + path.join(o.OUT_DIR, 'replay.html') + ', summary.json and ' + summary.length + ' replay_<site>_<date>.json file(s)');
  return result;
}
module.exports = { main, asOf, datesOf, loadDump };
if (require.main === module) main().then((r) => { process.exitCode = r.network || r.outside_writes ? 1 : 0; }, (e) => { console.error(String(e && e.message || e)); process.exitCode = 2; });
