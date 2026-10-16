// AI Pulse, per site (v4.9): today's answers on the fast engines become one small seo_ai_daily row (counts per engine, per question, competitors and
// sources; no answer text) that the weekly report adds to its figures, plus the answer rows (short excerpts, kept 35 days). Alerts only when
// something really changed: today's mention rate below the past week's beyond sampling noise (z-test, 99%), a business suddenly named in many
// answers, or a question where the business was named first for three days and is now missing. Quiet days send nothing.
/*__AI_STATS__*/
const COLS = ['site_id', 'domain', 'run_id', 'checked_at', 'prompt_id', 'prompt', 'kind', 'topic', 'engine', 'answered', 'mentioned', 'cited', 'rank', 'our_urls', 'competitors', 'sources', 'excerpt', 'cost', 'error', 'run_kind', 'sentiment', 'brands', 'issues', 'fanout', 'cited_urls'];
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
const ENG = { chatgpt: 'ChatGPT', gemini: 'Gemini', ai_mode: 'Google AI Mode', perplexity: 'Perplexity', claude: 'Claude', ai_overview: 'Google AI Overview', copilot: 'Copilot' };
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
const list = (s) => String(s || '').split(/,\s*/).filter(Boolean);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
return plans.map(p => {
  const R = rows.filter(r => r.site_id === p.site_id); const A = R.filter(r => r.answered);
  const n = A.length, m = A.filter(r => r.mentioned).length, c = A.filter(r => r.cited).length;
  const engines = {}; for (const e of p.pulse_engines) { const ea = A.filter(r => r.engine === e); engines[e] = { asked: R.filter(r => r.engine === e).length, answered: ea.length, mentioned: ea.filter(r => r.mentioned).length, cited: ea.filter(r => r.cited).length, errors: R.filter(r => r.engine === e && r.error).length }; }
  // D19 (2026-10-11): today's rates count answered requests only, and the failures are named (a DataForSEO task error inside an
  // HTTP 200 was invisible before; the retry gate has already re-sent each failed request once)
  const errMap = new Map();
  for (const r of R.filter(x => x.error)) { const k = r.engine + '|' + String(r.error).slice(0, 80); const x = errMap.get(k) || { engine: ENG[r.engine] || r.engine, message: String(r.error).slice(0, 160), count: 0 }; x.count++; errMap.set(k, x); }
  const error_list = [...errMap.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  const errors = R.filter(x => x.error).length, error_rate = pct(errors, R.length);
  const retry = (() => { try { const mg = $('Merge AI Answers').first().json || {}; return { asked: Number(mg.retry_asked) || 0, answered: Number(mg.retry_answered) || 0 }; } catch (e) { return { asked: 0, answered: 0 }; } })();
  const code = (r) => !r.answered ? (r.error ? 'e' : 'n') : r.cited ? (Number(r.rank) === 1 ? 'C' : 'c') : r.mentioned ? (Number(r.rank) === 1 ? 'M' : 'm') : 'a';   // upper case = named first
  const prompts = {}; for (const r of R) { prompts[r.prompt_id] = prompts[r.prompt_id] || {}; prompts[r.prompt_id][r.engine] = code(r); }
  const competitors = {}; for (const r of A) for (const d of list(r.competitors)) competitors[d] = (competitors[d] || 0) + 1;
  const sources = {}; for (const r of A) for (const h of list(r.sources)) if (h !== p.domain && !h.endsWith('.' + p.domain)) sources[h] = (sources[h] || 0) + 1;
  const topN = (o, k) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k));
  const vol = new Map(p.prompts.map(q => [q.prompt_id, Number(q.volume) || 0]));
  const visibility = visibilityScore(A, (a) => vol.get(a.prompt_id) || 0);
  // ---- B8-3 (2026-10-15, benchmark area 8, INVARIANTS rule 1 + 3): what could not be read today. The in-200 retry gate has already
  // re-sent every failed request once (D19); what is left is evidence nobody has. An engine that returned nothing changes the mix
  // today's rate is measured on, and under the rate floor there is no rate to draw a conclusion from at all.
  const dead = p.pulse_engines.filter(e => (Number(engines[e].asked) || 0) > 0 && !(Number(engines[e].answered) || 0)).map(e => ENG[e] || e);
  const todayRate = rateOf(m, n, { min: MIN_RATE_SAMPLES });
  const readable = { what: 'today\'s AI answers', asked: R.length, checked: n, failed: errors, retried: retry.asked, retry_answered: retry.answered,
    unavailable: !R.length || n === 0, partial: n > 0 && (errors > 0 || dead.length > 0), engines_silent: dead, enough: todayRate.enough,
    note: !n ? 'No answer came back at all today (' + R.length + ' request(s), ' + errors + ' could not be read), so today has no figures.'
      : dead.length ? dead.join(', ') + ' returned nothing today, so today\'s rate is measured on ' + (p.pulse_engines.length - dead.length) + ' of ' + p.pulse_engines.length + ' engines and is not the same measurement as a full day.'
      : errors ? errors + ' of ' + R.length + ' requests could not be read, so today\'s rate is measured on the ' + n + ' answers that came back.'
      : todayRate.enough ? '' : todayRate.why + '.' };
  // ---- B8-2 (2026-10-15, benchmark area 8, INVARIANTS rule 1): the daily z-test pooled SEVEN days of baseline with no check that
  // they measured the same thing. B-L4 put exactly this guard on the weekly tracker the same day and left the pulse without it — so
  // raising the panel from 8 questions to 20, or switching an engine on, moved the pooled rate and fired a 99% "a real drop, not
  // sampling noise" at an owner whose visibility had not moved at all. A day is pooled only when the same engines answered it and
  // it was measured on a comparable number of answers; every day left out is named with its reason.
  const nowBasis = { engines: p.pulse_engines.filter(e => (Number(engines[e].answered) || 0) > 0).sort(), size: n };
  const judged = (p.baseline || []).map(d => ({ d, v: sameBasis({ engines: d.engines, size: d.samples, panel: d.panel }, nowBasis) }));
  const B = judged.filter(x => x.v.ok).map(x => x.d);
  const baseline_set_aside = judged.filter(x => !x.v.ok).map(x => ({ date: x.d.date, samples: x.d.samples, why: x.v.why }));
  const bn = B.reduce((s, d) => s + d.samples, 0), bm = B.reduce((s, d) => s + d.mentioned, 0);
  const baseline_note = !judged.length ? 'There is no earlier pulse day to compare today with.'
    : !B.length ? 'Today is not compared with any earlier day: ' + baseline_set_aside.slice(0, 3).map(x => x.date + ' — ' + x.why).join('; ') + '.'
    : baseline_set_aside.length ? new Set(B.map(x => x.date)).size + ' of the past ' + new Set(judged.map(x => x.d.date)).size + ' days are comparable (readings: ' + B.length + ' of ' + judged.length + '); ' + baseline_set_aside.length + ' left out (' + baseline_set_aside.slice(0, 3).map(x => x.date + ' — ' + x.why).join('; ') + ').' : '';
  const alerts = [];
  // a drop is only called one from a day we could read, on a baseline measured the same way
  if (!readable.unavailable && todayRate.enough && n >= 20 && bn >= 40 && Math.abs(zTest(m, n, bm, bn)) >= 2.58 && pct(m, n) < pct(bm, bn) - 10) alerts.push({ level: 'high', text: 'Named in ' + pct(m, n) + '% of today\'s AI answers vs ' + pct(bm, bn) + '% over ' + B.length + ' comparable day(s) (' + n + ' answers today; a real drop, not sampling noise).' });
  // B8-3 (INVARIANTS rule 3): a morning that could not be read used to send nothing at all — a quiet day and a broken one looked
  // identical from the outside. A failure that reaches no human is not handled, so it is the one thing that always goes out.
  if (readable.unavailable) alerts.push({ level: 'high', text: readable.note + ' ' + (error_list.length ? error_list.map(e => e.engine + ' — ' + e.message).slice(0, 3).join('; ') : 'No engine answered.') });
  else if (dead.length) alerts.push({ level: 'medium', text: readable.note });
  const seen = new Set(B.flatMap(d => Object.keys(d.competitors || {})));
  for (const [d, k] of Object.entries(competitors).filter(([d0, k0]) => B.length >= 3 && !seen.has(d0) && n >= 20 && k0 >= Math.max(3, n * 0.3)).sort((a, b) => b[1] - a[1]).slice(0, 3)) alerts.push({ level: 'medium', text: d + ' appears in ' + k + ' of today\'s ' + n + ' AI answers and was not named in the past ' + B.length + ' days.' });
  for (const q of p.prompts) for (const e of p.pulse_engines) { const now = (prompts[q.prompt_id] || {})[e]; if (!now || now === 'n' || now === 'e') continue;
    const last3 = B.slice(0, 3).map(d => ((d.prompts || {})[q.prompt_id] || {})[e]); if (last3.length === 3 && last3.every(v => v === 'M' || v === 'C') && now === 'a') alerts.push({ level: 'medium', text: ENG[e] + ' no longer names you for "' + q.prompt + '" (named first on each of the past 3 days).' }); }
  const daily_row = { site_id: p.site_id, domain: p.domain, date: p.date, checked_at: p.checked_at, run_id: p.run_id, samples: n, mentioned: m, cited: c, mention_rate: pct(m, n), citation_rate: pct(c, n),
    share_of_voice: (() => { const tot = Object.values(topN(competitors, 8)).reduce((s, x) => s + x, 0); return pct(m, m + tot); })(), visibility_score: visibility, engines_json: JSON.stringify(engines), prompts_json: JSON.stringify(prompts),
    competitors_json: JSON.stringify(topN(competitors, 25)), sources_json: JSON.stringify(topN(sources, 25)), alerts: alerts.map(a => a.level + ': ' + a.text).join(' | '), cost_usd: +R.reduce((s, r) => s + (Number(r.cost) || 0), 0).toFixed(4) };
  const answer_rows = R.map(r => { const o = {}; for (const k of COLS) o[k] = r[k] === undefined ? '' : r[k]; return o; });
  const [lo, hi] = wilson(m, n);
  const subject = '[AI pulse] ' + p.domain + ' — ' + alerts.length + ' change(s) in today\'s AI answers';
  const html = '<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;max-width:760px"><h2 style="margin:0 0 4px;font-size:18px">AI pulse: ' + esc(p.domain) + ' · ' + esc(p.date) + '</h2>' +
    '<p style="font-size:13px;color:#475569;margin:0 0 8px">' + n + ' answers from ' + p.pulse_engines.map(e => ENG[e]).join(', ') + ' to your ' + p.prompts.length + ' tracked questions. Named in ' + pct(m, n) + '% (95% range ' + lo + '-' + hi + '%), your pages cited in ' + pct(c, n) + '%.' + (errors ? ' ' + errors + ' of ' + R.length + ' requests failed (' + error_list.map(e => e.engine + ': ' + e.message).join('; ') + ')' + (retry.asked ? ', ' + retry.answered + ' of ' + retry.asked + ' answered when sent again' : '') + '; today\'s figures count the ' + n + ' answers that came back.' : '') + '</p>' +
    '<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:8px 12px">' + alerts.map(a => '<div style="font-size:13px;margin:2px 0">⚠ ' + esc(a.text) + '</div>').join('') + '</div>' +
    // B-G1 (2026-10-15, INVARIANTS rule 1 + 2): a panel question the read-path fit gate set aside was not asked today and is in none of
    // the figures above — the mail says so with the reason instead of leaving a smaller panel unexplained.
    ((p.set_aside || []).filter(x => x.dropped).length ? '<p style="font-size:12px;color:#b45309;margin:6px 0"><b>Not asked</b> (set aside by the keyword rule): '
      + p.set_aside.filter(x => x.dropped).map(x => esc(x.note || (x.keyword + ' — ' + x.detail))).join(' | ') + '</p>' : '') +
    // B8-2 / B8-3: what today was measured on, and which earlier days it could honestly be compared with
    ((readable.note || baseline_note) ? '<p style="font-size:12px;color:#b45309;margin:6px 0">' + (readable.note ? '<b>' + esc(readable.note) + '</b>' : '') + (readable.note && baseline_note ? ' ' : '') + esc(baseline_note) + '</p>' : '') +
    '<p style="font-size:12px;color:#64748b">The weekly AI visibility report (Monday) adds these daily answers to its figures. Answers vary from one ask to the next; an alert is sent only when a change is beyond that noise, measured against earlier days that asked the same questions of the same engines.</p></div>';
  return { json: { site_id: p.site_id, domain: p.domain, date: p.date, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, alerts, daily_row, answer_rows, subject, html,
    set_aside: p.set_aside || [], set_aside_note: p.set_aside_note || '',   // B-G2 / B-G1: the refusals travel to the app and the callback too
    samples: n, mention_rate: pct(m, n), mention_ci: [lo, hi], citation_rate: pct(c, n), visibility_score: visibility, engines, errors, error_rate, errors_list: error_list, retried: retry.asked, retry_answered: retry.answered,
    // B8-2 / B8-3: what today could be read, and which earlier days it is honestly comparable with — both travel to the app and the callback
    readable, today_rate: todayRate, baseline_days: B.length, baseline_of: judged.length, baseline_set_aside, baseline_note,
    status: 'progress', stage: 'ai_pulse', checked_at: p.checked_at } };
});
