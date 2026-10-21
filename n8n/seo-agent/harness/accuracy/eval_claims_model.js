// CT-FIX2 (2026-10-22): the ONE real evaluation of the two-stage promise check. Every case of claims.json is read by the claims kit as
// the generated Content QA inlines it (stage 1: candidates, `collect`), cases are grouped per site into pages of up to 25 candidates,
// and each page is sent to Claude Haiku exactly as *Promise Judge* sends it (PJ.request: the candidates, their closest facts, a forced
// tool). The answers are recorded in claims_model_answers.json (the harness replays them offline: scorer path `model`), and the result
// is written to CLAIMS_MODEL_EVAL.md: rules only vs two stages, per group, with cost and latency per page.
// Network, paid: run once, by hand, with the key in ANTHROPIC_API_KEY (never printed). Spend cap: SPEND_CAP_USD (default 0.30).
//   docker run --rm -e ANTHROPIC_API_KEY -v "$PWD/n8n/seo-agent/harness":/h -w /h node:22-bookworm-slim node accuracy/eval_claims_model.js
const fs = require('fs');
const path = require('path');
const { SET, pagesOf, decidePage, score, PAGE_CANDS } = require('./score_claims');
const KEY = process.env.ANTHROPIC_API_KEY || '';
// REPLAY=<answers.json>: no network, no spend; the recorded answers are re-scored under the current decision policy (OUT=<md file>)
const REPLAY = process.env.REPLAY || '';
const CAP = Number(process.env.SPEND_CAP_USD || 0.30);
const PRICE = { in: 1, out: 5 };   // Claude Haiku 4.5, USD per million tokens (v5/code/_cost_cal.js)
const usd = (u) => ((u.input_tokens || 0) * PRICE.in + (u.output_tokens || 0) * PRICE.out) / 1e6;
(async () => {
  if (!KEY && !REPLAY) throw new Error('ANTHROPIC_API_KEY is not set');
  const REC = REPLAY ? JSON.parse(fs.readFileSync(REPLAY, 'utf8')) : null;
  const recorded = { model: null, recorded_at: new Date().toISOString(), page_candidates: PAGE_CANDS, pages: {} };
  const calls = []; let spent = 0; const cache = new Map(); const unjudged = []; let est = 0.012;
  const cases = [], rules = [], model = [];
  for (const site of SET.sites) {
    const sc = SET.cases.filter(c => c.site === site.site);
    for (const pg of pagesOf(site, sc)) {
      let resp = null, ms = 0;
      if (REC) { const r0 = (REC.pages || {})[pg.key]; resp = r0 ? r0.response : null; if (pg.cands.length && !resp) unjudged.push(pg.key);
        if (resp) calls.push({ site: site.site, key: pg.key, cases: pg.items.length, candidates: pg.cands.length, input_tokens: (resp.usage || {}).input_tokens, output_tokens: (resp.usage || {}).output_tokens, usd: usd(resp.usage || {}), ms: 0 });
        recorded.model = REC.model; recorded.recorded_at = REC.recorded_at; }
      else if (pg.cands.length && cache.has(pg.key)) resp = cache.get(pg.key);   // the same candidate list asked once
      else if (pg.cands.length && spent + est > CAP) { unjudged.push(pg.key); console.log('cap: page ' + pg.key + ' left to the rules'); }
      else if (pg.cands.length) {
        const t0 = Date.now();
        for (let a = 0; a < 3 && !resp; a++) {
          const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
            headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(pg.request) });
          const j = await r.json().catch(() => null);
          if (r.ok && j) resp = j; else { console.log('attempt ' + (a + 1) + ' failed: HTTP ' + r.status + ' ' + JSON.stringify((j && j.error) || '').slice(0, 160)); await new Promise(z => setTimeout(z, 5000)); }
        }
        ms = Date.now() - t0;
        if (!resp) throw new Error('page ' + pg.key + ' failed three times');
        recorded.model = resp.model || recorded.model;
        const c = usd(resp.usage || {}); spent += c; est = Math.max(est, c * 1.3); cache.set(pg.key, resp);
        calls.push({ site: site.site, key: pg.key, cases: pg.items.length, candidates: pg.cands.length, input_tokens: (resp.usage || {}).input_tokens, output_tokens: (resp.usage || {}).output_tokens, usd: c, ms });
        recorded.pages[pg.key] = { site: site.site, cases: pg.items.map(x => x.c.id), candidates: pg.cands.length, response: { model: resp.model, content: resp.content, usage: resp.usage, stop_reason: resp.stop_reason } };
        console.log(site.site + ' page ' + pg.key + ': ' + pg.items.length + ' cases, ' + pg.cands.length + ' candidates, ' + ms + ' ms, $' + c.toFixed(5) + ' (total $' + spent.toFixed(4) + ')');
      }
      cases.push(...pg.items.map(x => x.c)); rules.push(...decidePage(pg, null)); model.push(...decidePage(pg, resp));
    }
  }
  if (!REC) fs.writeFileSync(path.join(__dirname, 'claims_model_answers.json'), JSON.stringify(recorded, null, 1) + '\n');
  const R = score(cases, rules), M = score(cases, model);
  const live = (r) => r.site.endsWith('/live-2026-10-22');
  const grp = (S, f) => { const rows = S.rows.filter(f); const s = score(rows.map(r => cases.find(c => c.id === r.id)), rows.map(r => ({ flagged: r.flagged, kind: r.kind }))); return s; };
  const groups = [['all cases', () => true], ['dev', r => !r.holdout], ['hold-out (all)', r => r.holdout], ['hold-out without the live page', r => r.holdout && !live(r)], ['live page 2026-10-22', live], ['Arabic', r => r.arabic]];
  const f = (v) => (v == null ? 'n/a' : v + '%');
  const row = (name, S) => '| ' + name + ' | ' + S.cases + ' | ' + f(S.precision) + ' | ' + f(S.recall) + ' (' + S.tp + ' of ' + (S.tp + S.fn) + ') | ' + f(S.false_flag_supported) + ' (' + S.ff_supported + ' of ' + S.n_supported + ') | ' + f(S.false_flag_not_claim) + ' (' + S.ff_not_claim + ' of ' + S.n_not_claim + ') |';
  const tot = calls.reduce((a, c) => ({ i: a.i + (c.input_tokens || 0), o: a.o + (c.output_tokens || 0), u: a.u + c.usd, ms: a.ms + c.ms, k: a.k + c.candidates }), { i: 0, o: 0, u: 0, ms: 0, k: 0 });
  const perCand = tot.k ? tot.u / tot.k : 0;
  const L = [];
  L.push('# Promise check: rules only vs two stages (one real evaluation run)', '');
  L.push('Run ' + recorded.recorded_at.slice(0, 16).replace('T', ' ') + ' UTC by `harness/accuracy/eval_claims_model.js` (CT-FIX2), model `' + recorded.model + '`, on all ' + cases.length + ' cases of `claims.json` (' + SET.sites.length + ' fact sets).',
    'Stage 1 = the claims kit as the build inlines it into the generated Content QA (`collect`: every sentence the rules judge, plus the wide net: a section about the business, a phase or service on file as the subject, "we / our", image captions). Stage 2 = one Claude Haiku call per page exactly as *Promise Judge* sends it (`PJ.request`: candidates, their closest facts, a forced tool, temperature 0). Cases are judged in pages of up to ' + PAGE_CANDS + ' candidates per site, in file order. Rules only = the same candidates decided by the rules (the fallback when the call fails). The answers are recorded in `claims_model_answers.json`; the harness (CLACC, path `model`) replays them offline.', '');
  L.push('Flagged = the sentence is held for the owner (`business_claims` or `business_promises`); the targets: hold-out precision >= 95%, recall >= 90%, false flags on true sentences <= 3%.', '');
  for (const [nm, S] of [['Rules only', R], ['Two stages (rules + Haiku)', M]]) {
    L.push('## ' + nm, '', '| Group | Cases | Precision | Recall | False flags: true sentences | False flags: not a claim |', '|---|---|---|---|---|---|');
    for (const [g, fn] of groups) L.push(row(g, grp(S, fn)));
    L.push('');
  }
  L.push('## Cost and latency', '', '| | Value |', '|---|---|',
    '| Calls (pages) | ' + calls.length + (unjudged.length ? ' (' + unjudged.length + ' page(s) left to the rules by the spend cap)' : '') + ' |', '| Candidates judged | ' + tot.k + ' (' + (tot.k / Math.max(1, calls.length)).toFixed(1) + ' a page) |',
    '| Tokens | ' + tot.i + ' in, ' + tot.o + ' out |', '| Spend, this evaluation | $' + tot.u.toFixed(4) + ' (cap $' + CAP.toFixed(2) + ') |',
    '| Cost a page (mean) | $' + (tot.u / Math.max(1, calls.length)).toFixed(5) + ' |', '| Cost a candidate | $' + perCand.toFixed(6) + ' |',
    '| Latency a page (mean / max) | ' + Math.round(tot.ms / Math.max(1, calls.length)) + ' ms / ' + Math.max(0, ...calls.map(c => c.ms)) + ' ms |',
    '| A real page (40 candidates, the cap) | about $' + (perCand * 40 + 0.0015).toFixed(4) + ' a QA round (the facts are sent once a page), two rounds about $' + (2 * (perCand * 40 + 0.0015)).toFixed(4) + ' |', '');
  L.push('## Where the two stages still disagree with the labels', '');
  for (const x of M.failures) L.push('- ' + x.id + (x.holdout ? ' [hold-out]' : '') + ' ' + x.fkind + ' (label ' + x.label + ', ' + x.got + '): ' + x.sentence.slice(0, 140));
  if (!M.failures.length) L.push('- none');
  L.push('', '## What the second reader changed against the rules', '');
  const changed = M.rows.filter((r, i) => r.flagged !== R.rows[i].flagged);
  for (const r of changed) L.push('- ' + r.id + ': ' + (r.flagged ? 'now flagged' : 'no longer flagged') + ' (label ' + r.label + ') ' + r.sentence.slice(0, 120));
  fs.writeFileSync(process.env.OUT || path.join(__dirname, 'CLAIMS_MODEL_EVAL.md'), L.join('\n') + '\n');
  console.log('rules: ' + JSON.stringify({ p: R.precision, r: R.recall, ffs: R.false_flag_supported }) + ' | two stages: ' + JSON.stringify({ p: M.precision, r: M.recall, ffs: M.false_flag_supported }) + ' | spent $' + tot.u.toFixed(4));
})().catch(e => { console.error('EVAL FAILED: ' + e.message); process.exit(1); });
