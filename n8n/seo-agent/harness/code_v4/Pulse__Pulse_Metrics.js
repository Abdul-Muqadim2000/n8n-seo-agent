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
// ---- D19 (2026-10-11 system review): what counts as a brand, and one page one URL ----
// A brand must be a business, not a heading or a category: ChatGPT's own brand list gave the heading "Tax technology and e-invoicing
// software" and it was counted as a competitor (exec 362 / 363). A name without a website counts only when it reads like one: at most
// 4 words, every word starting with a capital or a digit (or an inner capital: eBay), no joining word (and / or / for / in / vs: a
// phrase, not a name), no sentence punctuation, and not a plain category ("Software Solutions"). A name that maps to a domain (an
// alias learned by the Answer Analyst, a configured competitor, a link in the answer) always counts, whatever its shape.
const BRAND_CATEGORY = /^(software|solutions?|services?|providers?|vendors?|tools?|platforms?|systems?|companies|company|consultants?|consultancies|agencies|agency|partners?|suppliers?|products?|apps?|options?|alternatives?|experts?|specialists?|firms?|list|guide|guides|comparison|reviews?|pricing|features?|top|best)$/i;
const BRAND_JOIN = /(^|\s)(and|or|for|with|in|on|of|the|a|an|to|at|by|vs|versus|&)(\s|$)/i;
const brandish = (name) => {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (n.length < 3 || n.length > 40 || /[:;,|/\\?!]|\.{2}/.test(n) || BRAND_JOIN.test(n)) return false;
  const w = n.split(' '); if (w.length > 4) return false;
  const letters = (x) => x.replace(/[^A-Za-z]/g, '');
  if (w.every(x => BRAND_CATEGORY.test(letters(x)))) return false;
  return w.every(x => /^[A-Z0-9]/.test(x) || /^[a-z]+[A-Z]/.test(x));
};
// one page, one URL: the host without "www.", no fragment (ChatGPT links carry "#:~:text=" highlights) and no tracking parameters
// (every ChatGPT link carries utm_source=chatgpt.com), so the bare host and the www host of the same page are counted once. The scheme
// and the real query are kept: this is the page we may ask to be named on, not only a key.
const CITE_TRACK = /^(utm_[a-z_]*|srsltid|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|ref|ref_src|referrer|_hsenc|_hsmi|hsa_[a-z]+|spm|at_[a-z_]+)$/i;
const cleanCiteUrl = (u) => {
  const s = String(u || '').trim();
  const m = s.match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
  if (!m) return s.replace(/#.*$/, '');
  const host = m[2].toLowerCase().replace(/^www\./, '').replace(/:(?:80|443)$/, '');
  const q = (m[4] || '').replace(/^\?/, '').split('&').filter(kv => kv && !CITE_TRACK.test(kv.split('=')[0])).join('&');
  return m[1].toLowerCase() + '://' + host + (m[3] || '/') + (q ? '?' + q : '');
};
// a source chip sometimes shows only a fragment of the title ("E", "Best e" live on 2026-10-11, G22): too short to be a title, so it is
// dropped and the page's own <title> is read later (AI Growth fetches the cited pages). A real title is never cut here.
const citeTitle = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length >= 8 ? s.slice(0, 160) : ''; };
// one business, one key: a brand name the engines write ("Azentio Software", "ClearTax") joins the website it belongs to — a learned name
// (Answer Analyst) or a name matching the domain's label (cleartax.com, azentio.com, edicomgroup.com); other names stay names
const labelOf = (d) => String(d).toLowerCase().replace(/^www\./, '').split('.')[0].replace(/-/g, '');
const brandKey = (name, domains, aliases) => { const n = String(name || '').trim(); if (!n || /\./.test(n)) return n.toLowerCase();
  const al = aliases ? Object.entries(aliases).find(([k]) => k.toLowerCase() === n.toLowerCase()) : null; if (al && /\./.test(al[1])) return al[1];
  const compact = n.toLowerCase().replace(/[^a-z0-9]+/g, ''); const first = (n.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0]) || '';
  const hit = (domains || []).find(d => { const l = labelOf(d); return (l.length >= 4 && l === compact) || (first.length >= 5 && l === first) || (first.length >= 6 && l.startsWith(first)) || (l.length >= 6 && compact.startsWith(l)); });
  return hit || n; };
// ---- R14 (2026-10-13, re-rating §3.11): a market-index row matched by NAME is not evidence about this website ----
// The market-wide table printed `"Tech&" by name (you) | 19,579 answers | 16,421,600 AI searches` as its first row, directly under the
// headline "Market-wide share 0% — 0 AI answers cite you", while the run's own 54 samples named the business 0 times and the next row was
// microsoft.com with 1,897: the index had matched the 4-letter name inside the whole "tech" family — P34-2's collapse again. The owner's own
// row must come from a DOMAIN match. A name-only row is dropped (never "you", never in the share arithmetic) when the name is shorter than
// the brand-token bar P34-2 set (NAME_MIN_TOKEN = 5 alphanumeric characters) or when it claims orders of magnitude more answers than this
// run measured and than any domain in the same table; a distinctive name that is in reach of the measurement is kept and labelled.
const NAME_MIN_TOKEN = 5;        // the same whole-brand-token bar as OK.namesUs (P34-2)
const NAME_PEER_RATIO = 10;      // "orders of magnitude": more than 10x the biggest domain row while our own samples never named us
const indexNameRow = (name, mentions, o) => {
  const opts = o || {};
  const token = String(name || '').replace(/[^A-Za-z0-9]+/g, '');
  const m = Math.max(0, Number(mentions) || 0);
  const peak = Math.max(0, Number(opts.peer_max) || 0);
  const measured = Math.max(0, Number(opts.measured_mentions) || 0);
  if (!token) return { ok: false, why: 'the index row carries no name to match on' };
  if (token.length < NAME_MIN_TOKEN) return { ok: false, why: '"' + String(name).trim() + '" is too short a name (' + token.length + ' characters) to match on its own: the index counts it inside other companies\' names' };
  if (!measured && peak && m > peak * NAME_PEER_RATIO) return { ok: false, why: '"' + String(name).trim() + '" by name claims ' + m + ' answers against ' + peak + ' for the biggest website in the same table, while this run\'s own samples named the business ' + measured + ' times' };
  return { ok: true, why: 'not matched to your website: the index counted this name, so the row has no share of yours in it' };
};
const mergeBrands = (entries, aliases) => { const doms = entries.map(([k]) => k).filter(k => /\./.test(k)); const out = new Map();   // [[key, value]] -> Map with names folded into domains (min for positions, sum for counts via the caller)
  for (const [k, v] of entries) { const key = brandKey(k, doms, aliases); out.set(key, out.has(key) ? [...out.get(key), v] : [v]); } return out; };

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
    '<p style="font-size:13px;color:#475569;margin:0 0 8px">' + n + ' answers from ' + p.pulse_engines.map(e => ENG[e]).join(', ') + ' to your ' + p.prompts.length + ' tracked questions. Named in ' + pct(m, n) + '% (95% range ' + lo + '-' + hi + '%), your pages cited in ' + pct(c, n) + '%.' + (errors ? ' ' + errors + ' of ' + R.length + ' requests failed (' + error_list.map(e => e.engine + ': ' + e.message).join('; ') + ')' + (retry.asked ? ', ' + retry.answered + ' of ' + retry.asked + ' answered when sent again' : '') + '; today\'s figures count the ' + n + ' answers that came back.' : '') + '</p>' +
    '<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:8px 12px">' + alerts.map(a => '<div style="font-size:13px;margin:2px 0">⚠ ' + esc(a.text) + '</div>').join('') + '</div>' +
    // B-G1 (2026-10-15, INVARIANTS rule 1 + 2): a panel question the read-path fit gate set aside was not asked today and is in none of
    // the figures above — the mail says so with the reason instead of leaving a smaller panel unexplained.
    ((p.set_aside || []).filter(x => x.dropped).length ? '<p style="font-size:12px;color:#b45309;margin:6px 0"><b>Not asked</b> (set aside by the keyword rule): '
      + p.set_aside.filter(x => x.dropped).map(x => esc(x.note || (x.keyword + ' — ' + x.detail))).join(' | ') + '</p>' : '') +
    '<p style="font-size:12px;color:#64748b">The weekly AI visibility report (Monday) adds these daily answers to its figures. Answers vary from one ask to the next; an alert is sent only when a change is beyond that noise.</p></div>';
  return { json: { site_id: p.site_id, domain: p.domain, date: p.date, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, alerts, daily_row, answer_rows, subject, html,
    set_aside: p.set_aside || [], set_aside_note: p.set_aside_note || '',   // B-G2 / B-G1: the refusals travel to the app and the callback too
    samples: n, mention_rate: pct(m, n), mention_ci: [lo, hi], citation_rate: pct(c, n), visibility_score: visibility, engines, errors, error_rate, errors_list: error_list, retried: retry.asked, retry_answered: retry.answered, status: 'progress', stage: 'ai_pulse', checked_at: p.checked_at } };
});
