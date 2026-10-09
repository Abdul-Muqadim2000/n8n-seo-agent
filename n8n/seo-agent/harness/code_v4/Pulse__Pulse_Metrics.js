// AI Pulse, per site (v4.9): today's answers on the fast engines become one small seo_ai_daily row (counts per engine, per question, competitors and
// sources; no answer text) that the weekly report adds to its figures, plus the answer rows (short excerpts, kept 35 days). Alerts only when
// something really changed: today's mention rate below the past week's beyond sampling noise (z-test, 99%), a business suddenly named in many
// answers, or a question where the business was named first for three days and is now missing. Quiet days send nothing.
// ---- shared by the AI Visibility Tracker and the AI Pulse (inlined by the build; v4.9): sampling statistics and the visibility score ----
// AI answers vary from one ask to the next, so a rate is reported with its 95% interval (Wilson) and a change only counts when it is
// statistically real (two-proportion z-test) — a single unlucky sample must not raise an alert.
const wilson = (k, n, z = 1.96) => { if (!n) return [0, 0]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, Math.round(1000 * (c - m) / d) / 10), Math.min(100, Math.round(1000 * (c + m) / d) / 10)]; };
const zTest = (k1, n1, k2, n2) => { if (!n1 || !n2) return 0; const p = (k1 + k2) / (n1 + n2); const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); return se ? (k1 / n1 - k2 / n2) / se : 0; };
const significant = (k1, n1, k2, n2, minPts = 5) => Math.abs(zTest(k1, n1, k2, n2)) >= 1.96 && Math.abs(100 * (k1 / n1 - k2 / n2)) >= minPts;
// one answer's worth (0-1): named first and linked = 1; lower in the list counts less; a citation without the name still helps a little
const posWeight = (rank) => rank === 1 ? 1 : rank === 2 ? 0.8 : rank === 3 ? 0.65 : rank > 3 && rank <= 5 ? 0.5 : rank > 5 ? 0.35 : 0.6;   // rank 0 = named, not in a list
const answerScore = (a) => !a.answered ? null : a.mentioned ? posWeight(Number(a.rank) || 0) * (a.cited ? 1 : 0.85) : (a.cited ? 0.4 : 0);
// questions people ask more often weigh more, but no single question dominates (log scale; unknown volume = weight 1)
const volWeight = (v) => 1 + Math.log10(1 + Math.max(0, Number(v) || 0)) / 2;
const visibilityScore = (answers, volumeOf) => { let s = 0, w = 0; for (const a of answers) { const x = answerScore(a); if (x === null) continue; const wt = volWeight(volumeOf ? volumeOf(a) : 0); s += x * wt; w += wt; } return w ? Math.round(1000 * s / w) / 10 : 0; };
// one business, one key: a brand name the engines write ("Azentio Software", "ClearTax") joins the website it belongs to — a learned name
// (Answer Analyst) or a name matching the domain's label (cleartax.com, azentio.com, edicomgroup.com); other names stay names
const labelOf = (d) => String(d).toLowerCase().replace(/^www\./, '').split('.')[0].replace(/-/g, '');
const brandKey = (name, domains, aliases) => { const n = String(name || '').trim(); if (!n || /\./.test(n)) return n.toLowerCase();
  const al = aliases ? Object.entries(aliases).find(([k]) => k.toLowerCase() === n.toLowerCase()) : null; if (al && /\./.test(al[1])) return al[1];
  const compact = n.toLowerCase().replace(/[^a-z0-9]+/g, ''); const first = (n.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0]) || '';
  const hit = (domains || []).find(d => { const l = labelOf(d); return (l.length >= 4 && l === compact) || (first.length >= 5 && l === first) || (first.length >= 6 && l.startsWith(first)) || (l.length >= 6 && compact.startsWith(l)); });
  return hit || n; };
const mergeBrands = (entries, aliases) => { const doms = entries.map(([k]) => k).filter(k => /\./.test(k)); const out = new Map();   // [[key, value]] -> Map with names folded into domains (min for positions, sum for counts via the caller)
  for (const [k, v] of entries) { const key = brandKey(k, doms, aliases); out.set(key, out.has(key) ? [...out.get(key), v] : [v]); } return out; };

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
