// AI Pulse, per site (v4.9): today's answers on the fast engines become one small seo_ai_daily row (counts per engine, per question, competitors and
// sources; no answer text) that the weekly report adds to its figures, plus the answer rows (short excerpts, kept 35 days). Alerts only when
// something really changed: today's mention rate below the past week's beyond sampling noise (z-test, 99%), a business suddenly named in many
// answers, or a question where the business was named first for three days and is now missing. Quiet days send nothing.
/*__AI_STATS__*/
const COLS = ['site_id', 'domain', 'run_id', 'checked_at', 'prompt_id', 'prompt', 'kind', 'topic', 'engine', 'answered', 'mentioned', 'cited', 'rank', 'our_urls', 'competitors', 'sources', 'excerpt', 'cost', 'error', 'run_kind', 'sentiment', 'brands', 'issues', 'fanout'];
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
const ENG = { chatgpt: 'ChatGPT', gemini: 'Gemini', ai_mode: 'Google AI Mode', perplexity: 'Perplexity', claude: 'Claude', ai_overview: 'Google AI Overview' };
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
const list = (s) => String(s || '').split(/,\s*/).filter(Boolean);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
return plans.map(p => {
  const R = rows.filter(r => r.site_id === p.site_id); const A = R.filter(r => r.answered);
  const n = A.length, m = A.filter(r => r.mentioned).length, c = A.filter(r => r.cited).length;
  const engines = {}; for (const e of p.pulse_engines) { const ea = A.filter(r => r.engine === e); engines[e] = { asked: R.filter(r => r.engine === e).length, answered: ea.length, mentioned: ea.filter(r => r.mentioned).length, cited: ea.filter(r => r.cited).length, errors: R.filter(r => r.engine === e && r.error).length }; }
  const code = (r) => !r.answered ? (r.error ? 'e' : 'n') : r.cited ? (Number(r.rank) === 1 ? 'C' : 'c') : r.mentioned ? (Number(r.rank) === 1 ? 'M' : 'm') : 'a';   // upper case = named first
  const prompts = {}; for (const r of R) { prompts[r.prompt_id] = prompts[r.prompt_id] || {}; prompts[r.prompt_id][r.engine] = code(r); }
  const competitors = {}; for (const r of A) for (const d of list(r.competitors)) competitors[d] = (competitors[d] || 0) + 1;
  const sources = {}; for (const r of A) for (const h of list(r.sources)) if (h !== p.domain && !h.endsWith('.' + p.domain)) sources[h] = (sources[h] || 0) + 1;
  const topN = (o, k) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k));
  const vol = new Map(p.prompts.map(q => [q.prompt_id, Number(q.volume) || 0]));
  const visibility = visibilityScore(A, (a) => vol.get(a.prompt_id) || 0);
  const B = p.baseline || []; const bn = B.reduce((s, d) => s + d.samples, 0), bm = B.reduce((s, d) => s + d.mentioned, 0);
  const alerts = [];
  if (n >= 20 && bn >= 40 && Math.abs(zTest(m, n, bm, bn)) >= 2.58 && pct(m, n) < pct(bm, bn) - 10) alerts.push({ level: 'high', text: 'Named in ' + pct(m, n) + '% of today\'s AI answers vs ' + pct(bm, bn) + '% over the past ' + B.length + ' days (' + n + ' answers today; a real drop, not sampling noise).' });
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
    '<p style="font-size:13px;color:#475569;margin:0 0 8px">' + n + ' answers from ' + p.pulse_engines.map(e => ENG[e]).join(', ') + ' to your ' + p.prompts.length + ' tracked questions. Named in ' + pct(m, n) + '% (95% range ' + lo + '-' + hi + '%), your pages cited in ' + pct(c, n) + '%.</p>' +
    '<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:8px 12px">' + alerts.map(a => '<div style="font-size:13px;margin:2px 0">⚠ ' + esc(a.text) + '</div>').join('') + '</div>' +
    '<p style="font-size:12px;color:#64748b">The weekly AI visibility report (Monday) adds these daily answers to its figures. Answers vary from one ask to the next; an alert is sent only when a change is beyond that noise.</p></div>';
  return { json: { site_id: p.site_id, domain: p.domain, date: p.date, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, alerts, daily_row, answer_rows, subject, html,
    samples: n, mention_rate: pct(m, n), mention_ci: [lo, hi], citation_rate: pct(c, n), visibility_score: visibility, engines, status: 'progress', stage: 'ai_pulse', checked_at: p.checked_at } };
});
