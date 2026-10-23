// W2-E2 (2026-10-23): what the repeat pilot tells its caller - the price and the plan when it was only priced (stage ai_pilot_quote), or the
// asks per question each engine needs (stage ai_pilot), in plain words with the sample under every figure. One item per start.
/*__REPORT_KIT__*/
/*__LINEAGE__*/
const P = $('AI Plan').first().json; let R = null; try { R = $('Pilot Metrics').first().json; } catch (e) { R = null; }
const x = R && R.pilot_result ? R : P; const PR = x.pilot_result || null; const Q = x.quote || {};
let html = '<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;max-width:900px">' + '<h2 style="margin:0 0 4px;font-size:20px">AI answer repeat pilot: ' + esc(x.domain || '') + '</h2>';
if (!PR) html += p_(esc(x.reason || 'nothing was asked')) + (Q.note ? p_(esc(Q.note), true) : '') + (Q.engines ? table(['Engine', 'Requests', 'Cost'], Q.engines.map(e => [esc(e), n(Q.questions * Q.repeats), '$' + Number((Q.per_engine_usd || {})[e] || 0).toFixed(2)])) : '');
else { html += p_(esc(PR.note));
  html += table(['Engine', 'Named in', 'Between questions', 'Within a question', 'Asks per question a week', 'Answers'], Object.entries(PR.by_engine).map(([e, v]) => [esc(e), v.rate == null ? '—' : v.rate + '%',
    v.sigma2_between == null ? '—' : String(v.sigma2_between), v.sigma2_within == null ? '—' : String(v.sigma2_within) + (v.icc != null ? '<br><span style="color:#64748b;font-size:11px">ICC ' + v.icc + '</span>' : ''),
    v.repeats == null ? '<b>more questions instead</b>' : '<b>' + v.repeats + '</b>', n(v.answers) + '<br><span style="color:#64748b;font-size:11px">' + esc(v.why || '') + '</span>']));
  html += p_('A one-off measurement on ' + PR.questions + ' questions: the advice is as good as that sample, and an engine whose answers change a lot from one ask to the next needs more asks, not more questions.', true); }
// G29 / INVARIANTS rule 1: every figure group with its source, period and sample
const lineage = PR ? [LN.of('Named in, and the variance between and within questions, per engine', 'ai_engines', { basis: 'measured', period: LN.asOf(x.checked_at), sample: LN.sample(PR.answers, 'answers to ' + PR.questions + ' questions asked ' + (Q.repeats || 10) + ' times each') }),
  LN.of('Asks per question a week', 'ai_engines', { basis: 'modelled', period: LN.asOf(x.checked_at), sample: LN.sample(PR.answers, 'pilot answers'), note: 'from the measured variances, for +/-5 points on a ' + PR.panel + '-question panel' })]
  : [LN.unknown('The repeat pilot', x.reason || 'nothing was asked')];
html += LN.block(lineage) + '</div>';
const stage = PR ? 'ai_pilot' : 'ai_pilot_quote';
return [{ json: { stage, site_id: x.site_id, domain: x.domain, run_id: x.run_id, request_id: x.request_id || '', email: x.email || '', callback_url: x.callback_url || '', quote: Q, pilot: PR, lineage, cost_usd: R ? R.cost_usd : 0,
  subject: PR ? 'AI answer repeat pilot: ' + x.domain : 'AI answer repeat pilot (priced, not run): ' + x.domain, html } }];
