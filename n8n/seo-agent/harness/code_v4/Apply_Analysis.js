// Merges the Answer Analyst's reading into the answer rows (v4.9): the businesses named in order (so a competitor named without its website counts,
// and the business's place in the list is read, not guessed from text positions), the sentiment toward the business, and wrong claims about it.
// Answers the analyst did not read keep the parser's values. Output: the seo_ai_answers rows with exact columns (the answer text is dropped).
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
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
if (!rows.length) return [{ json: { skip: true } }];
let jobs = [], outs = []; try { jobs = $('Analyst Jobs').all().map(i => i.json).filter(j => !j.skip); outs = $('Answer Analyst').all().map(i => i.json || {}); } catch (e) {}
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const SENT = ['positive', 'neutral', 'negative'];
const read = new Map();
jobs.forEach((j, i) => { const o = outs[i] && !outs[i].error ? parse(outs[i].output) : null; if (!o || !Array.isArray(o.answers)) return;
  for (const a of o.answers) { const id = j.ids[(Number(a && a.n) || 0) - 1]; if (id) read.set(j.site_id + '|' + id, a); } });
return rows.map(r => {
  const a = read.get(r.site_id + '|' + r.prompt_id + '|' + r.engine); const out = {};
  for (const k of COLS) out[k] = r[k] === undefined ? '' : r[k];
  if (a && r.answered) {
    const p = plans.find(x => x.site_id === r.site_id) || { brand_names: [r.domain], domain: r.domain };
    const ours = (b) => { const d = normD(b.domain); const nm = String(b.name || '').toLowerCase(); return (d && (d === p.domain || d.endsWith('.' + p.domain))) || p.brand_names.some(x => String(x).toLowerCase() === nm || (nm && nm.includes(String(x).toLowerCase()) && String(x).length >= 5)); };
    const brands = (Array.isArray(a.brands) ? a.brands : []).filter(b => b && b.name).slice(0, 10);
    const at = brands.findIndex(ours);
    if (at >= 0) { out.mentioned = true; out.rank = at + 1; }
    else if (r.mentioned && !r.cited && String(a.sentiment) === 'not_mentioned') { out.mentioned = false; out.rank = 0; }   // the brand word matched something else (e.g. a common word or another company)
    const others = brands.filter(b => !ours(b)).map(b => normD(b.domain) && /\./.test(normD(b.domain)) ? normD(b.domain) : String(b.name).trim());
    out.competitors = [...mergeBrands([...others, ...String(r.competitors || '').split(/,\s*/).filter(Boolean)].map((k, i) => [k, i]), p.aliases).keys()].slice(0, 12).join(', ');   // names folded into their websites
    out.brands = brands.map(b => String(b.name).trim()).join(', ');
    out.sentiment = out.mentioned && SENT.includes(String(a.sentiment)) ? String(a.sentiment) : '';
    out.issues = (Array.isArray(a.wrong) ? a.wrong : []).filter(w => w && w.claim).map(w => String(w.claim).slice(0, 160) + (w.correct ? ' → ' + String(w.correct).slice(0, 120) : '')).join(' | ').slice(0, 600);
  }
  return { json: out };
});
