// KWACC (KW-ACC 2026-10-21): the labelled accuracy set for the keyword business-fit decision (accuracy/keywords.json, scorer
// accuracy/score_keywords.js), scored on two paths: the generated fit-gate kit (research, ladder, cadence, AI growth, Keyword Check) and
// the full report's generated Analyze Keywords node. The bar is the audit's (S49): precision and recall >= 95% for refusals AND for kept
// keywords, and every refusal carries a reason the client can read.
//
// The bar is a MEASURED gate that fails today. It is not lowered and no label is changed to pass it: every case the code gets wrong is
// listed in accuracy/KEYWORDS_BASELINE.md, and this scenario RATCHETS on that list -
//   * a disagreement that is not in the baseline fails the build (a new leak or a new wrong refusal);
//   * a baseline row the code now gets right fails the build too, until the row is removed (a fix is recorded, and can never silently
//     come back);
//   * the 95% assertions are hard for a path whose baseline holds no decision rows (the gate becomes a plain gate once fixed).
// Reason-class rows (decision right, reason wrong) ratchet the same way. A refusal without a reason is never baselined.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, guard, reset } = ctx;
  await guard('KWACC', async () => {
    reset();
    const check = (label, ok, detail) => { H.results.push({ scenario: 'KWACC', node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 1200), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 900))); };
    const note = (label) => { H.results.push({ scenario: 'KWACC', node: 'measured ' + label, ok: true, ms: 0, error: '', items: [] }); console.log('   meas ' + label); };
    console.log('\n=== KWACC keyword business fit: a labelled set over techand.ai / peppol.org / azdan.com, the kit and the full report, ratcheted on KEYWORDS_BASELINE.md ===');
    const { scoreKeywords, SET } = require('./accuracy/score_keywords');
    const CLASSES = Object.keys(SET.classes);

    // 1. the set itself: enough real cases, every one labelled with a class, a reason and a source
    const bad = SET.cases.filter(c => !['in', 'out'].includes(c.label) || !CLASSES.includes(c.expect) || (c.label === 'in') !== (c.expect === 'in_topic') || !String(c.reason || '').trim() || !String(c.source || '').trim());
    check('KWACC set: every case has in/out, a known class that matches it, a reason and a source', !bad.length, bad.map(c => c.id).join(', '));
    check('KWACC set: at least 80 cases over the three sites', SET.cases.length >= 80 && ['techand.ai', 'peppol.org', 'azdan.com'].every(s => SET.cases.some(c => c.site === s)), SET.cases.length);
    check('KWACC set: at least 10 Arabic keywords for techand.ai', SET.cases.filter(c => c.site === 'techand.ai' && /[؀-ۿ]/.test(c.keyword)).length >= 10);
    check('KWACC set: every reason class is covered', CLASSES.every(k => SET.cases.some(c => c.expect === k)), CLASSES.filter(k => !SET.cases.some(c => c.expect === k)).join(', '));
    const ids = SET.cases.map(c => c.id);
    check('KWACC set: case ids are unique', new Set(ids).size === ids.length);

    const r = await scoreKeywords(H, console.log);

    // 2. the scorer measured what it claims: on the full report every keyword reached the node (refused, or listed)
    check('KWACC full: every case keyword reached Analyze Keywords (refused or listed)', !r.full.unreached.length, r.full.unreached.join(' | '));

    // 3. every refusal carries a reason the client can read (never baselined)
    for (const p of ['kit', 'full']) {
      const nr = r[p].rows.filter(x => x.got !== 'in_topic' && (!x.got || x.got === 'none' || !String(x.detail || '').trim()));
      check('KWACC ' + p + ': every refusal carries a reason and a sentence', !nr.length, nr.map(x => x.id + ' ' + x.keyword).join(' | '));
    }

    // 4. the ratchet
    const BASE = fs.readFileSync(path.join(__dirname, 'accuracy', 'KEYWORDS_BASELINE.md'), 'utf8');
    const baseRows = [...BASE.matchAll(/^\| (kit|full) \| (KW-[A-Z]\d+) \| (decision|reason) \|/gm)].map(m => m[1] + '|' + m[2] + '|' + m[3]);
    check('KWACC baseline: rows are unique', new Set(baseRows).size === baseRows.length);
    const baseline = new Set(baseRows);
    for (const p of ['kit', 'full']) {
      const now = new Set(r[p].failures.filter(f => f.kind !== 'no_reason').map(f => p + '|' + f.id + '|' + f.kind));
      const fresh = [...now].filter(k => !baseline.has(k));
      const fixed = [...baseline].filter(k => k.startsWith(p + '|') && !now.has(k));
      const desc = (k) => { const [, id, kind] = k.split('|'); const f = r[p].failures.find(x => x.id === id && x.kind === kind) || r[p].rows.find(x => x.id === id) || {};
        return id + ' "' + f.keyword + '" (' + kind + ': label ' + f.label + '/' + f.expect + ', got ' + f.got + ')'; };
      check('KWACC ' + p + ': no NEW disagreement with the labels (not in KEYWORDS_BASELINE.md)', !fresh.length, fresh.map(desc).join(' | '));
      check('KWACC ' + p + ': no baseline row the code now gets right (remove it from KEYWORDS_BASELINE.md)', !fixed.length, fixed.map(desc).join(' | '));
      // 5. the 95% bar: hard once the path has no known decision failure, measured (and printed) until then
      const known = [...baseline].filter(k => k.startsWith(p + '|') && k.endsWith('|decision')).length;
      const bars = [['out precision', r[p].out_precision], ['out recall', r[p].out_recall], ['in precision', r[p].in_precision], ['in recall', r[p].in_recall]];
      const below = bars.filter(([, v]) => v == null || v < 95);
      if (!known) check('KWACC ' + p + ': precision and recall >= 95% for refusals and for kept keywords', !below.length, below.map(([n, v]) => n + ' ' + v + '%').join(', '));
      else note('KWACC ' + p + ': ' + bars.map(([n, v]) => n + ' ' + v + '%').join(', ') + ' | reason agreement ' + r[p].reason_agreement + '% | the 95% bar is a measured gate that fails today: '
        + known + ' known decision failures in KEYWORDS_BASELINE.md, ratcheted');
    }
    note('KWACC: the same keyword gets a different answer on the kit and on the full report for ' + r.path_disagreements.length + ' case(s)' + (r.path_disagreements.length ? ': ' + r.path_disagreements.join(' | ') : ''));
    reset();
  });
};
