// Merges the Answer Analyst's reading into the answer rows (v4.9): the businesses named in order (so a competitor named without its website counts,
// and the business's place in the list is read, not guessed from text positions), the sentiment toward the business, and wrong claims about it.
// Answers the analyst did not read keep the parser's values. Output: the seo_ai_answers rows with exact columns (the answer text is dropped).
/*__AI_STATS__*/
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
