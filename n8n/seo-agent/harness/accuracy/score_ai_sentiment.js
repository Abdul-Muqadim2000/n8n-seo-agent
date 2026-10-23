// W2-E2 (2026-10-23): scores the rule reader of v5/code/_ai_sentiment.js (SENT.rules) on the labelled set accuracy/ai_sentiment.json.
// Polarity: Cohen's kappa over the three classes, per split (tuning / holdout / real) and over all; aspects: kappa over (case x aspect)
// presence and polarity agreement where both found the aspect; objection: detection agreement. Used by harness W2E2-SENT and on its own:
//   node accuracy/score_ai_sentiment.js [--split tuning] [--show]
const fs = require('fs'); const path = require('path');
const load = (codeDir) => { const rd = (f) => { for (const d of [codeDir, path.join(__dirname, '..', '..', 'v5', 'code')].filter(Boolean)) { try { return fs.readFileSync(path.join(d, f), 'utf8'); } catch (e) {} } throw new Error('missing ' + f); };
  return new Function(rd('_ai_measure.js') + '\n' + rd('_ai_sentiment.js') + '\nreturn { AVX, SENT };')(); };
const score = (o) => { const opt = o || {}; const { SENT } = load(opt.codeDir); const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_sentiment.json'), 'utf8'));
  const cases = set.cases.filter(c => !opt.split || c.split === opt.split);
  const rows = cases.map(c => { const r = SENT.rules(c.text, c.business, c.rivals || []); return { c, r }; });
  const by = (f) => { const P = rows.filter(f); const pol = SENT.kappa(P.map(x => [x.c.polarity, x.r.polarity]));
    const asPairs = []; const polAgree = [0, 0]; for (const x of P) for (const a of SENT.ASPECTS) { const g = (x.c.aspects || []).find(y => y.aspect === a), m = x.r.aspects.find(y => y.aspect === a); asPairs.push([!!g, !!m]); if (g && m) { polAgree[1]++; if (g.polarity === m.polarity) polAgree[0]++; } }
    const obj = SENT.kappa(P.map(x => [!!String(x.c.objection || '').trim(), !!String(x.r.objection || '').trim()]));
    return { n: P.length, accuracy: P.length ? Math.round(1000 * P.filter(x => x.c.polarity === x.r.polarity).length / P.length) / 10 : null, kappa: pol, aspect_kappa: SENT.kappa(asPairs), aspect_polarity_agreement: polAgree[1] ? Math.round(1000 * polAgree[0] / polAgree[1]) / 10 : null, objection_kappa: obj }; };
  const splits = [...new Set(cases.map(c => c.split))];
  const out = { all: by(() => true) }; for (const s of splits) out[s] = by(x => x.c.split === s);
  out.misses = rows.filter(x => x.c.polarity !== x.r.polarity).map(x => ({ id: x.c.id, want: x.c.polarity, got: x.r.polarity, score: x.r.score, text: x.c.text.slice(0, 160) }));
  return out; };
module.exports = { score, load };
if (require.main === module) { const a = process.argv; const s = score({ split: a.includes('--split') ? a[a.indexOf('--split') + 1] : null }); const show = a.includes('--show'); const { misses, ...rest } = s; console.log(JSON.stringify(rest, null, 1)); if (show) console.log(misses.map(m => m.id + ' want ' + m.want + ' got ' + m.got + ' (' + m.score + '): ' + m.text).join('\n')); }
