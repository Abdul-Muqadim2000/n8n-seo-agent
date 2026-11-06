// AIR GOLDEN (W0, 2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §8): with every site OFF (ai_rank_mode empty / 'off'), the AI Growth
// workflow must do exactly what it did before AIR. The GENERATED workflow (workflows/SEO_Agent_AI_Growth.json) is run end to end by
// harness/air_graph_exec.js on the synthetic fixture (fixtures_air.js: nova-ai.example with no mode, acme-erp.example with 'off'), with a pinned
// clock and a seeded Math.random, and compared with the snapshot harness/air_golden/ai_growth_off.json, which was taken from the workflow
// BEFORE W0 (git HEAD 06842add). Checked:
//   AIRG1  the Growth Report output and the ai_growth callback (Callback Ledger output and the POSTed body) are byte-identical
//   AIRG2  the executed path: every node that ran before runs again the same number of times; the only new nodes allowed to run are
//          `AI Rank Gate` and `Any AI Rank?` (the AIR side branch's gate, package P4)
//   AIRG3  every Data Table write is identical, except that the AIR columns of seo_ai_targets (origin, action_id, live_at) may be present
//          and must be null; nothing is written to an AIR table (seo_ai_rank_*) or any table the snapshot did not write
//   AIRG4  the run ends with no node error, and the kill switch row (seo_cache air:kill) changes nothing either
// Regenerate the snapshot ONLY for a deliberate change of the AI Growth output for every site (not for an AIR change), with the reason in
// the commit: AIR_GOLDEN_WRITE=1 [AIR_GOLDEN_WF=<workflow json>] node scenarios_air_golden.js (runs on its own too).
const fs = require('fs'); const path = require('path');
const { exec } = require('./air_graph_exec');
const FX = require('./fixtures_air');
const SNAP = path.join(__dirname, 'air_golden', 'ai_growth_off.json');
const AIR_TARGET_COLS = ['origin', 'action_id', 'live_at'];
const ALLOWED_NEW = ['AI Rank Gate', 'Any AI Rank?'];

async function runGolden(wfFile, opts) {
  const o = opts || {};
  let wf = JSON.parse(fs.readFileSync(wfFile, 'utf8')); wf = Array.isArray(wf) ? wf[0] : wf;
  const F = FX.make({ seed: 'air-golden', modes: { nova: '', acme: 'off' } });
  const tables = JSON.parse(JSON.stringify(F.tables));
  if (o.kill) tables.seo_cache.push({ key: 'air:kill', kind: 'air', site_id: '', value: '1', updated_at: F.now });
  const hostOf = (u) => String(u).replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').toLowerCase().replace(/^www\./, '');
  const http = (node, req) => {
    const u = String(req.url || '');
    if (/api\.anthropic\.com\/v1\/messages\/count_tokens/.test(u)) return { input_tokens: 1000 };
    if (/api\.dataforseo\.com\/v3\/appendix\/user_data/.test(u)) return { status_code: 20000, tasks: [{ status_code: 20000, result: [{ money: { balance: 25 } }] }] };
    if (/bing\.com\/webmaster\/api\.svc/i.test(u)) {
      if (/GetUserSites/i.test(u)) return { d: F.bing.sites.map(s => ({ Url: s, IsVerified: true })) };
      if (/GetUrlSubmissionQuota/i.test(u)) return { d: { DailyQuota: 10, MonthlyQuota: 300 } };
      if (/GetUrlInfo/i.test(u)) { const m = u.match(/[?&]url=([^&]+)/i); const page = m ? decodeURIComponent(m[1]) : ''; const at = F.bing.crawled[page];
        return { d: { Url: page, HttpStatus: at ? 200 : 0, LastCrawledDate: '/Date(' + (at ? Date.parse(at) : -62135596800000) + ')/', DiscoveryDate: '/Date(' + (at ? Date.parse(at) : -62135596800000) + ')/' } }; }
      return { d: null }; }
    if (/wikidata\.org/.test(u)) return /wbsearchentities/.test(u) ? { search: [] } : { query: { search: [] } };
    if (/\/robots\.txt$/i.test(u)) { const t = F.robots[hostOf(u)]; return req.text ? { statusCode: t ? 200 : 404, headers: {}, data: t || '' } : {}; }
    const p = F.pages[u] || F.pages[u.replace(/\/$/, '')] || F.pages[u + '/'];
    if (p) return req.text ? { statusCode: p.status, headers: { 'content-type': 'text/html' }, data: p.html } : {};
    if (req.method === 'POST') return req.text ? { statusCode: 200, headers: {}, data: '' } : {};
    return req.text ? { statusCode: 404, headers: {}, data: '' } : {};
  };
  const agent = (node, item) => ({ drafts: ((item && item.jobs) || []).map(j => ({ n: j.n, subject: 'Synthetic subject ' + j.n, body: 'Synthetic draft for ' + String(j.url || '') + '. [Your name]' })) });
  const r = await exec({ wf, trigger: {}, tables, http, agent, now: F.nowMs, seed: 'air-golden', execId: 'air-golden-1' });
  const last = (n) => { const x = r.runs[n]; return x && x.length ? x[x.length - 1][0] || [] : null; };
  const counts = {}; for (const n of r.order) counts[n] = (counts[n] || 0) + 1;
  const writes = r.writes.map(w => ({ node: w.node, table: w.table, op: w.op, rows: w.rows.map(row => {
    if (w.table !== 'seo_ai_targets') return row; const c = { ...row }; for (const k of AIR_TARGET_COLS) if (c[k] === null) delete c[k]; return c; }) }));
  const airNonNull = r.writes.filter(w => w.table === 'seo_ai_targets').flatMap(w => w.rows).filter(row => AIR_TARGET_COLS.some(k => row[k] !== undefined && row[k] !== null));
  return { counts, report: last('Growth Report'), callback: last('Callback Ledger (Growth)'), posted: r.posts.filter(p => p.node === 'POST Growth Report').map(p => p.body),
    writes, errors: r.errors, airNonNull, order: r.order };
}

module.exports = async (ctx) => {
  const { H, guard, begin } = ctx;
  await guard('air golden', async () => {
    const SN = 'AIR GOLDEN (W0 2026-11-06): every site off -> AI Growth output and the ai_growth callback byte-identical to before AIR';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const wfFile = process.env.AIR_GOLDEN_WF || path.join(__dirname, '..', 'workflows', 'SEO_Agent_AI_Growth.json');
    const g = await runGolden(wfFile);
    if (process.env.AIR_GOLDEN_WRITE === '1') { fs.mkdirSync(path.dirname(SNAP), { recursive: true });
      fs.writeFileSync(SNAP, JSON.stringify({ note: 'AIR golden snapshot (W0): AI Growth on fixtures_air.js seed air-golden, every site off. Regenerate only for a deliberate change of AI Growth for every site.', source: path.basename(wfFile),
        counts: g.counts, report: g.report, callback: g.callback, posted: g.posted, writes: g.writes }) + '\n'); console.log('   wrote ' + SNAP); }
    if (!fs.existsSync(SNAP)) { check('AIRG0 the snapshot exists (harness/air_golden/ai_growth_off.json)', false, 'missing: run with AIR_GOLDEN_WRITE=1 on the pre-change workflow'); return; }
    const S = JSON.parse(fs.readFileSync(SNAP, 'utf8')); const J = (x) => String(JSON.stringify(x));
    const firstDiff = (a, b, p = '') => { if (J(a) === J(b)) return ''; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], p + '.' + k); if (d) return d; } }
      return p + ': ' + J(a).slice(0, 200) + ' vs ' + J(b).slice(0, 200); };
    check('AIRG0 the run reached the report and the callback, both sites planned', Array.isArray(g.report) && g.report.length === 2 && Array.isArray(g.callback) && g.callback.length >= 1 && g.posted.length >= 1,
      J({ report: g.report && g.report.length, callback: g.callback && g.callback.length, posted: g.posted.length, order: g.order.slice(-12) }));
    check('AIRG1 Growth Report output byte-identical to the pre-AIR snapshot', J(g.report) === J(S.report), firstDiff(g.report, S.report));
    check('AIRG1 the ai_growth callback (Callback Ledger output and the POSTed body) byte-identical', J(g.callback) === J(S.callback) && J(g.posted) === J(S.posted), firstDiff({ c: g.callback, p: g.posted }, { c: S.callback, p: S.posted }));
    const extra = Object.keys(g.counts).filter(n => !(n in S.counts)); const missing = Object.keys(S.counts).filter(n => !(n in g.counts));
    const changed = Object.keys(S.counts).filter(n => n in g.counts && g.counts[n] !== S.counts[n]);
    check('AIRG2 the executed path: every pre-AIR node runs as often as before; only the AIR gate (' + ALLOWED_NEW.join(', ') + ') may be new',
      !missing.length && !changed.length && extra.every(n => ALLOWED_NEW.includes(n)), J({ missing, changed, extra }));
    check('AIRG3 every Data Table write identical (the AIR target columns present only as null), nothing written to an AIR table',
      J(g.writes) === J(S.writes) && !g.airNonNull.length && !g.writes.some(w => /^seo_ai_rank_/.test(w.table)), firstDiff(g.writes, S.writes) || J(g.airNonNull).slice(0, 300));
    check('AIRG4 no node error in the run', !g.errors.length, J(g.errors));
    const k = await runGolden(wfFile, { kill: true });
    check('AIRG4 the kill switch row (seo_cache air:kill = 1) changes nothing while every site is off', J(k.report) === J(S.report) && J(k.callback) === J(S.callback) && J(k.writes) === J(S.writes),
      firstDiff({ r: k.report, c: k.callback, w: k.writes }, { r: S.report, c: S.callback, w: S.writes }));
  });
};
module.exports.runGolden = runGolden;
if (require.main === module) {
  const H = { results: [] }; const guard = async (n, f) => { try { await f(); } catch (e) { H.results.push({ ok: false, node: n, error: String(e && e.stack || e) }); console.log('FAIL ' + n + ' ' + (e && e.stack || e)); } };
  module.exports({ H, guard, begin: (n) => console.log('## ' + n) }).then(() => { const f = H.results.filter(r => !r.ok).length; console.log((H.results.length - f) + ' passed, ' + f + ' failed'); process.exitCode = f ? 1 : 0; });
}
