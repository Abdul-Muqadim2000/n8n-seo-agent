// CLACC (CT-ACC 2026-10-22): the labelled accuracy set for the content promise / claims check (accuracy/claims.json, scorer
// accuracy/score_claims.js): Content QA §9d (CL.business) and §9e (CL.commitments) must flag every statement a page makes in the
// business's name that nothing on file supports, and nothing else. Scored on two paths: the claims kit as inlined in the generated
// Content QA, and the generated Content QA node itself. The bar: precision >= 95% and recall >= 90% for unsupported claims, and false
// flags on true statements (supported_claim) <= 3%.
//
// The bar is a MEASURED gate that fails today. It is not lowered and no label is changed to pass it: every case the code gets wrong is
// listed in accuracy/CLAIMS_BASELINE.md, and this scenario RATCHETS on that list (the design of KWACC, scenarios_kw_accuracy.js) -
//   * a disagreement that is not in the baseline fails the build (a new miss or a new false flag);
//   * a baseline row the code now gets right fails the build too, until the row is removed (a fix is recorded, and can never silently
//     come back);
//   * the bars are hard assertions for a path once its baseline holds no row.
// Hold-out: claims.json marks a case `holdout` when the first byte of sha1(sentence + site) mod 10 is under 3; the split is checked here
// and the scorer prints dev and hold-out separately, so a fixer tunes on dev only and reports both.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
module.exports = async (ctx) => {
  const { H, guard, reset } = ctx;
  await guard('CLACC', async () => {
    reset();
    const check = (label, ok, detail) => { H.results.push({ scenario: 'CLACC', node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 1200), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 900))); };
    const note = (label) => { H.results.push({ scenario: 'CLACC', node: 'measured ' + label, ok: true, ms: 0, error: '', items: [] }); console.log('   meas ' + label); };
    console.log('\n=== CLACC business claims: a labelled set over techand.ai / peppol.org / azdan.com, the kit and the Content QA node, ratcheted on CLAIMS_BASELINE.md ===');
    const { scoreClaims, SET, line } = require('./accuracy/score_claims');
    const LABELS = Object.keys(SET.labels);

    // 1. the set itself
    const bad = SET.cases.filter(c => !LABELS.includes(c.label) || !SET.categories.includes(c.category) || !String(c.reason || '').trim() || !String(c.source || '').trim() || !String(c.sentence || '').trim() || !SET.sites.some(s => s.site === c.site));
    check('CLACC set: every case has a sentence, a known site, label and category, a reason and a source', !bad.length, bad.map(c => c.id).join(', '));
    check('CLACC set: at least 90 cases over the three sites, every label used', SET.cases.length >= 90 && ['techand.ai', 'peppol.org', 'azdan.com'].every(s => SET.cases.some(c => c.site === s)) && LABELS.every(l => SET.cases.some(c => c.label === l)), SET.cases.length);
    check('CLACC set: every site has its facts on file', SET.sites.every(s => String(s.facts || '').length > 200 && (s.names || []).length), SET.sites.map(s => s.site + ' ' + String(s.facts || '').length).join(', '));
    check('CLACC set: at least 8 Arabic sentences', SET.cases.filter(c => /[؀-ۿ]/.test(c.sentence)).length >= 8);
    const need = ['deliverable', 'process', 'billing', 'scope', 'guarantee', 'timeline', 'credential', 'partnership', 'experience', 'cta', 'advice', 'generic', 'source_quote'];
    check('CLACC set: every kind of statement is covered', need.every(k => SET.cases.some(c => c.category === k)), need.filter(k => !SET.cases.some(c => c.category === k)).join(', '));
    const promises = SET.cases.filter(c => /one of the 11 promises/.test(c.source));
    check('CLACC set: the 11 promises of the 2026-10-21 page are in it, labelled unsupported, read inside their real section', promises.length === 11 && promises.every(c => c.label === 'unsupported_claim' && c.section && c.section.includes(c.sentence)), promises.length);
    const ids = SET.cases.map(c => c.id);
    check('CLACC set: case ids are unique', new Set(ids).size === ids.length);
    // CT-FIX (2026-10-22): the independent review's synthetic cases (source "independent review ...") are hold-out as a group: they were
    // written by the reviewer before the fix and are never tuned on
    // CT-FIX2 (2026-10-22): the 20 sentences of the fresh live page (exec 159, source "live page 2026-10-22") are hold-out as a group too
    const wrongHold = SET.cases.filter(c => !!c.holdout !== (/^independent review|^live page 2026-10-22/.test(c.source) || crypto.createHash('sha1').update(c.sentence + c.site, 'utf8').digest()[0] % 10 < 3));
    check('CLACC set: the hold-out mark is sha1(sentence + site)[0] % 10 < 3 on every case, and every independent-review and live-page case is hold-out', !wrongHold.length, wrongHold.map(c => c.id).join(', '));
    const live = SET.cases.filter(c => /^live page 2026-10-22/.test(c.source));
    check('CLACC set (CT-FIX2): the live page group holds its 7 flagged, 3 missed and 10 other sentences, each read inside its real section or as a caption', live.length === 20
      && live.every(c => c.caption || (c.section && c.section.includes(c.sentence))) && live.filter(c => c.label === 'unsupported_claim').length === 7, live.length);

    const r = await scoreClaims(H, console.log);

    // 2. the ratchet
    const BASE = fs.readFileSync(path.join(__dirname, 'accuracy', 'CLAIMS_BASELINE.md'), 'utf8');
    const baseRows = [...BASE.matchAll(/^\| (kit|qa|model) \| (CL-[A-Z]\d+) \| (missed|false_flag) \|/gm)].map(m => m[1] + '|' + m[2] + '|' + m[3]);
    check('CLACC baseline: rows are unique', new Set(baseRows).size === baseRows.length);
    const baseline = new Set(baseRows);
    for (const p of ['kit', 'qa', 'model']) {   // CT-FIX2: `model` = the two-stage check, stage 2 replayed from the one real evaluation (claims_model_answers.json)
      const now = new Set(r[p].failures.map(f => p + '|' + f.id + '|' + f.fkind));
      const fresh = [...now].filter(k => !baseline.has(k));
      const fixed = [...baseline].filter(k => k.startsWith(p + '|') && !now.has(k));
      const desc = (k) => { const [, id, kind] = k.split('|'); const f = r[p].rows.find(x => x.id === id) || {};
        return id + ' "' + String(f.sentence || '').slice(0, 90) + '" (' + kind + ': label ' + f.label + ', ' + (f.flagged ? 'flagged ' + f.kind : 'not flagged') + ')'; };
      check('CLACC ' + p + ': no NEW disagreement with the labels (not in CLAIMS_BASELINE.md)', !fresh.length, fresh.map(desc).join(' | '));
      check('CLACC ' + p + ': no baseline row the code now gets right (remove it from CLAIMS_BASELINE.md)', !fixed.length, fixed.map(desc).join(' | '));
      // 3. the bars: hard once the path has no known failure, measured (and printed) until then
      const known = [...baseline].filter(k => k.startsWith(p + '|')).length;
      const bars = [['precision', r[p].precision, 95, 1], ['recall', r[p].recall, 90, 1], ['false flags on supported claims', r[p].false_flag_supported, 3, -1]];
      const below = bars.filter(([, v, bar, dir]) => v == null || (dir > 0 ? v < bar : v > bar));
      if (!known) check('CLACC ' + p + ': precision >= 95% and recall >= 90% for unsupported claims, false flags on supported claims <= 3%', !below.length, below.map(([n, v]) => n + ' ' + v + '%').join(', '));
      else note('CLACC ' + p + ': ' + line(r[p]) + ' | dev ' + r[p].dev.precision + '% / ' + r[p].dev.recall + '%, hold-out ' + r[p].holdout.precision + '% / ' + r[p].holdout.recall
        + '% | the bars are a measured gate that fails today: ' + known + ' known failures in CLAIMS_BASELINE.md, ratcheted');
    }
    note('CLACC: the kit and the Content QA node disagree on ' + r.path_disagreements.length + ' case(s)' + (r.path_disagreements.length ? ': ' + r.path_disagreements.join(' ') : ''));
    reset();
  });
};
