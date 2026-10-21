// CT-ACC (2026-10-22): the business claims scorer: runs the labelled set in claims.json through the real generated code and scores
// "flagged" (the page may not say it until the owner confirms it) against the human label. Offline: no network, no paid API.
//
// Each case is one sentence placed where it sits on a page: its H2 (`heading`), H3 (`h3`), the sentence before it in the same
// paragraph (`before`) or as a list item (`list`); a sentence of the exec 42 page is read inside its real H2 group (`section`). Facts = the site's text on file (claims.json sites[].facts). Two paths:
//   kit: the claims kit as the build inlined it into the generated Content QA (code_v4/Content_QA.js, `const CL = (() => {`), called the
//        way Content QA §9d / §9e call it: CL.business(draft, facts, { names }) then CL.commitments(draft, facts, { names, skip }).
//   qa : the generated Content QA node itself, one run per case, with Parse Brief carrying only this site's facts (business facts, the
//        business name in the profile and the site model, nothing else), so OWN_TEXT and the business names are built by the node.
//        Flagged = the sentence is in content_qa.business_claims or content_qa.business_promises.
// Scored per path: precision / recall for "flagged = unsupported_claim", false flags on supported_claim and on not_a_claim separately,
// the same per category, per language, and for the dev and hold-out halves (claims.json `holdout`). Failures: kind `missed` (an
// unsupported claim not flagged) or `false_flag` (a supported claim or a non-claim flagged). Used by scenario CLACC
// (scenarios_claims_accuracy.js), which ratchets on CLAIMS_BASELINE.md.
//
// Report mode (prints every case with its decision):
//   docker run --rm -v "$PWD/n8n/seo-agent/harness":/src:ro --entrypoint sh n8nio/n8n:2.41.4 -c \
//     'cp -r /src /tmp/h && cd /tmp/h && CODE_DIR=/tmp/h/code_v4 OUT_DIR=/tmp/h/out node accuracy/score_claims.js'
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'claims.json'), 'utf8'));

const draftOf = (c) => {
  if (c.caption) return '## ' + (c.heading || 'Overview') + '\n\nThe page section this image belongs to.\n';   // CT-FIX2: an image caption is read through the captions the brief planned
  if (c.section) return c.section;   // a sentence of the exec 42 page, read inside its real H2 group
  const L = ['## ' + (c.heading || 'Overview')];
  if (c.h3) L.push('', '### ' + c.h3);
  L.push('');
  if (c.list) { if (c.before) L.push(c.before, ''); L.push('- ' + c.sentence); }
  else L.push((c.before ? c.before + ' ' : '') + c.sentence);
  return L.join('\n') + '\n';
};
// sentence identity, markdown and link targets dropped, any script kept (Arabic included)
const key = (s) => String(s || '').replace(/\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/^[-*]\s+/, '').toLowerCase()
  .replace(/[^\p{L}\p{N}%$€£]+/gu, ' ').replace(/\s+/g, ' ').trim();
const hits = (c, flags) => { const k = key(c.sentence);
  return flags.some(f => { const fk = key(f); return fk && (fk === k || fk.includes(k.slice(0, 40)) || (fk.length >= 15 && k.includes(fk))); }); };

let CLKIT = null, PJKIT = null;
const kitSrc = () => fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, '..', 'code_v4'), 'Content_QA.js'), 'utf8');
const grabKit = (src, start, name) => { const a = src.indexOf(start); if (a < 0) throw new Error(name + ' kit not found in the generated Content QA');
  const b = src.indexOf('\n})();', a); if (b < 0) throw new Error('end of the ' + name + ' kit not found in the generated Content QA');
  return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
const kit = () => { if (!CLKIT) CLKIT = grabKit(kitSrc(), 'const CL = (() => {', 'CL'); return CLKIT; };
const pjKit = () => { if (!PJKIT) PJKIT = grabKit(kitSrc(), 'const PJ = (() => {', 'PJ'); return PJKIT; };
const capsOf = (c) => (c.caption ? [c.sentence] : []);
async function kitPath(H, site, cases) {
  const CL = kit();
  return cases.map(c => {
    const md = draftOf(c);
    const BC = CL.business(md, site.facts, { names: site.names });
    const BP = CL.commitments(md, site.facts, { names: site.names, skip: BC.flags.map(f => f.sentence), captions: capsOf(c) });
    const flags = [...BC.flags.map(f => ({ s: f.sentence, k: 'terms:' + f.kind })), ...BP.flags.map(f => ({ s: f.sentence, k: 'promise:' + f.kind }))];
    const own = flags.filter(f => hits(c, [f.s]));
    return { flagged: own.length > 0, kind: own.map(f => f.k).join(',') };
  });
}

// CT-FIX2 (2026-10-22): the two-stage check. Stage 1 = the kit's candidates for each case (collect), stage 2 = the second reader's
// verdicts. Offline the verdicts are the RECORDED answers of the one real evaluation run (claims_model_answers.json, written by
// eval_claims_model.js): cases are judged in pages of up to 25 candidates per site, in file order, exactly as recorded; a page whose
// candidate list changed since the recording has no answer and is decided by the rules (counted as `unjudged`).
const PAGE_CANDS = 25;
function pagesOf(site, cases) {
  const CL = kit(); const PJ = pjKit(); const per = [];
  for (const c of cases) { const md = draftOf(c);
    const BC = CL.business(md, site.facts, { names: site.names });
    const BP = CL.commitments(md, site.facts, { names: site.names, skip: BC.flags.map(f => f.sentence), collect: true, captions: capsOf(c) });
    per.push({ c, BC, BP, cands: (BP.candidates || []) }); }
  const pages = []; let cur = [];
  for (const x of per) { if (cur.length && cur.reduce((n, y) => n + y.cands.length, 0) + x.cands.length > PAGE_CANDS) { pages.push(cur); cur = []; } cur.push(x); }
  if (cur.length) pages.push(cur);
  return pages.map(pg => { const seen = new Set(); const cands = [];
    for (const x of pg) for (const c of x.cands) { const k = PJ.k(c.sentence); if (!seen.has(k)) { seen.add(k); cands.push(c); } }
    return { items: pg, cands, key: PJ.keyOf(cands), request: PJ.request(cands, { business: site.business_name, domain: site.domain || site.site }) }; });
}
function decidePage(pg, resp) {
  const PJ = pjKit(); const J = resp ? PJ.read(resp, pg.cands) : null;
  return pg.items.map(x => { const flags = x.BC.flags.map(f => ({ s: f.sentence, k: 'terms:' + f.kind }));
    const ck = new Set(x.cands.map(c => PJ.k(c.sentence)));
    for (const c of x.cands) { const d = PJ.decide(c, J, kit().backs); if (d.flagged) flags.push({ s: c.sentence, k: 'promise:' + c.kind + (d.by === 'model' ? '+model' : '') }); }
    for (const f of x.BP.flags) if (!ck.has(PJ.k(f.sentence))) flags.push({ s: f.sentence, k: 'promise:' + f.kind });
    const own = flags.filter(f => hits(x.c, [f.s]));
    return { flagged: own.length > 0, kind: own.map(f => f.k).join(','), judged: !!(J && J.ok) }; });
}
let ANSWERS = null;
const answers = () => { if (ANSWERS) return ANSWERS; try { ANSWERS = JSON.parse(fs.readFileSync(path.join(__dirname, 'claims_model_answers.json'), 'utf8')); } catch (e) { ANSWERS = { pages: {} }; } return ANSWERS; };
async function modelPath(H, site, cases) {
  const out = [];
  for (const pg of pagesOf(site, cases)) { const rec = (answers().pages || {})[pg.key]; out.push(...decidePage(pg, rec ? rec.response : null)); }
  return out;
}

let FX = null;
async function qaPath(H, site, cases) {
  FX = FX || JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '..', 'fixtures_eqa_42.json.gz'))).toString());
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const dom = site.domain || site.site;
  const host = 'www.' + dom;
  const SMODEL = { domain: dom, canonical_host: host, business_name: site.business_name, home_url: 'https://' + host + '/' };
  const brief = { ...clone(FX.parse_brief), domain: dom, business: '', business_facts: site.facts, case_facts_text: '', client_pages: [], client_pages_read: [],
    existing_page_text: '', existing_page_facts_text: '', existing_page: null, client_signals: null, proof_context: '', proof_library: [],
    site_profile: { business_name: site.business_name }, author: {}, reviewer: {}, site_model: SMODEL, facts: [], pricing_facts: '', timeline_facts: '',
    coverage_target: { ...clone(FX.parse_brief.coverage_target), subtopics: [] } };
  const out = [];
  for (const c of cases) {
    const cb = c.caption ? { ...clone(brief), content_brief: { ...clone(brief.content_brief || {}), image_suggestions: [{ caption: c.sentence }] } } : brief;
    H.mock('Parse Brief', [{ json: clone(cb) }]);
    H.mock('Analyze Competitor Pages', [{ json: { competitors: [] } }]);
    H.mock('Site Model', [{ json: { site_model: clone(SMODEL) } }]);
    const r = await H.run('Content QA', [{ json: { output: 'Title: ' + (c.heading || 'Overview') + '\n\n' + draftOf(c), critique: null } }], { runIndex: 1 });
    const Q = r[0].json.content_qa || {};
    const flags = [...(Q.business_claims || []).map(b => ({ s: b.sentence, k: 'terms:' + b.kind })), ...(Q.business_promises || []).map(b => ({ s: b.sentence, k: 'promise:' + b.kind }))];
    const own = flags.filter(f => hits(c, [f.s]));
    out.push({ flagged: own.length > 0, kind: own.map(f => f.k).join(',') });
  }
  return out;
}

const pct = (n, d) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
function tally(rows) {
  const t = { cases: rows.length, tp: 0, fp: 0, fn: 0, tn: 0, ff_supported: 0, n_supported: 0, ff_not_claim: 0, n_not_claim: 0 };
  for (const r of rows) {
    if (r.label === 'unsupported_claim') { if (r.flagged) t.tp++; else t.fn++; }
    else { if (r.flagged) t.fp++; else t.tn++; }
    if (r.label === 'supported_claim') { t.n_supported++; if (r.flagged) t.ff_supported++; }
    if (r.label === 'not_a_claim') { t.n_not_claim++; if (r.flagged) t.ff_not_claim++; }
  }
  return { ...t, precision: pct(t.tp, t.tp + t.fp), recall: pct(t.tp, t.tp + t.fn), false_flag_supported: pct(t.ff_supported, t.n_supported), false_flag_not_claim: pct(t.ff_not_claim, t.n_not_claim) };
}
const isArabic = (s) => /[؀-ۿ]/.test(s);
function score(cases, decisions) {
  const rows = cases.map((c, i) => ({ id: c.id, site: c.site, sentence: c.sentence, label: c.label, category: c.category, holdout: !!c.holdout, arabic: isArabic(c.sentence), flagged: decisions[i].flagged, kind: decisions[i].kind }));
  const failures = rows.filter(r => (r.label === 'unsupported_claim') !== r.flagged)
    .map(r => ({ ...r, fkind: r.label === 'unsupported_claim' ? 'missed' : 'false_flag', got: r.flagged ? 'flagged (' + r.kind + ')' : 'not flagged' }));
  const by = (f) => { const m = {}; for (const r of rows) { const k = f(r); (m[k] = m[k] || []).push(r); } return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, tally(v)])); };
  return { ...tally(rows), rows, failures, per_category: by(r => r.category), per_language: by(r => (r.arabic ? 'arabic' : 'english')),
    dev: tally(rows.filter(r => !r.holdout)), holdout: tally(rows.filter(r => r.holdout)) };
}
const line = (t) => 'precision ' + t.precision + '% recall ' + t.recall + '% (' + t.tp + ' of ' + (t.tp + t.fn) + ' unsupported flagged) | false flags: supported ' + t.false_flag_supported + '% (' + t.ff_supported + ' of ' + t.n_supported + '), not a claim ' + t.false_flag_not_claim + '% (' + t.ff_not_claim + ' of ' + t.n_not_claim + ')';

async function scoreClaims(H, log) {
  const res = {};
  for (const [name, fn] of [['kit', kitPath], ['qa', qaPath], ['model', modelPath]]) {
    const cases = [], decisions = [];
    for (const site of SET.sites) {
      const sc = SET.cases.filter(c => c.site === site.site);
      cases.push(...sc); decisions.push(...await fn(H, site, sc));
    }
    res[name] = score(cases, decisions);
    const r = res[name];
    if (log) {
      log('   ' + name + ': ' + r.cases + ' cases | ' + line(r) + ' | ' + r.failures.length + ' disagreements');
      log('   ' + name + ' dev (' + r.dev.cases + '): ' + line(r.dev));
      log('   ' + name + ' hold-out (' + r.holdout.cases + '): ' + line(r.holdout));
    }
  }
  const k = res.kit.rows, q = res.qa.rows;
  res.path_disagreements = k.filter((r, i) => r.flagged !== q[i].flagged).map(r => r.id);
  return res;
}

module.exports = { scoreClaims, SET, draftOf, key, line, pagesOf, decidePage, score, PAGE_CANDS };

if (require.main === module || process.env.CLAIMS_REPORT) {
  (async () => {
    const H = require('../harness');
    const r = await scoreClaims(H, console.log);
    for (const p of ['kit', 'qa', 'model']) {
      for (const [cat, t] of Object.entries(r[p].per_category)) console.log(p.padEnd(4) + ' ' + cat.padEnd(17) + line(t));
      for (const [lang, t] of Object.entries(r[p].per_language)) console.log(p.padEnd(4) + ' ' + lang.padEnd(17) + line(t));
      for (const row of r[p].rows) console.log(p.padEnd(4) + (((row.label === 'unsupported_claim') === row.flagged) ? ' ok  ' : ' BAD ') + row.id + (row.holdout ? ' [H]' : '    ') + ' ' + row.label.padEnd(18) + (row.flagged ? 'flagged ' + row.kind : 'not flagged') + ' | ' + row.sentence.slice(0, 90));
    }
    console.log('path disagreements: ' + r.path_disagreements.join(' '));
  })();
}
