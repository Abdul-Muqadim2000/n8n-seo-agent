// Merges the Answer Analyst's reading into the answer rows (v4.9): the businesses named in order (so a competitor named without its website counts,
// and the business's place in the list is read, not guessed from text positions), the sentiment toward the business, and wrong claims about it.
// Answers the analyst did not read keep the parser's values. Output: the seo_ai_answers rows with exact columns (the answer text is dropped).
// F1a (2026-10-23, ENGINE_AUDIT E3 / E16): the analyst now gives each business a ROLE (competitor / platform / source). It is merged into the
// parser's entities (_ai_entities.js) instead of over them: a business the parser found and the analyst did not list keeps the parser's role,
// a business the analyst calls a platform or a source stops being a competitor, the owner's configured competitors stay competitors, and the
// client's position is recounted among the client and its competitors only. Parser competitors are no longer merged back blindly (E3: that
// put every cited site back into the list). E16: a wrong claim that says, in other words, what last week's report (or an earlier answer
// of this run) already said is stored in THAT wording, so AI Metrics keys it as the same issue and the High alert does not fire again.
/*__AI_STATS__*/
/*__AI_ENTITIES__*/
/*__AI_ANSWER_DATA__*/
const COLS = __AI_ANSWERS_COLS__;   // W2-E1: the seo_ai_answers columns, written in by build_monitors.py (was a copy that missed every new column)
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
let jobs = [], outs = []; try { jobs = $('Analyst Jobs').all().map(i => i.json).filter(j => !j.skip); outs = $('Answer Analyst').all().map(i => i.json || {}); } catch (e) {}
// W2-E1 (2026-10-23, F2's open item): in a run's last part the analyst also read answers an earlier part stored and never analysed (that part
// died before its analysis); they are read back from Load AI Run Answers with their full text and written back like this part's own
{ const have = new Set(rows.map(r => r.site_id + '|' + r.prompt_id + '|' + r.engine)); const want = new Set(); for (const j of jobs) for (const id of (j.stored_ids || [])) want.add(j.site_id + '|' + id);
  if (want.size) { let st = []; try { st = $('Load AI Run Answers').all().map(i => i.json).filter(r => r && r.run_id && r.engine); } catch (e) {}
    const plans0 = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
    for (const r of st) { const k = r.site_id + '|' + r.prompt_id + '|' + r.engine; if (!want.has(k) || have.has(k) || !plans0.some(p => p.site_id === r.site_id && p.run_id === r.run_id)) continue; have.add(k); rows.push(AAD.fromStored(r)); } } }
if (!rows.length) return [{ json: { skip: true } }];
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let stored = []; try { stored = $('Load AI Run Answers').all().map(i => i.json).filter(r => r && r.issues); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const SENT = ['positive', 'neutral', 'negative'];
const ROLES = ['competitor', 'platform', 'source'];
const read = new Map();
jobs.forEach((j, i) => { const o = outs[i] && !outs[i].error ? parse(outs[i].output) : null; if (!o || !Array.isArray(o.answers)) return;
  for (const a of o.answers) { const id = j.ids[(Number(a && a.n) || 0) - 1]; if (id) read.set(j.site_id + '|' + id, { ...a, facts_ok: j.facts_ok !== false }); } });   // G10: facts_ok says whether a wrong claim could be judged at all
// E16: the wordings already on record per site - last week's issues, then this run's (stored parts and the answers below), first wording wins
const known = new Map();
for (const p of plans) known.set(p.site_id, (((p.previous || {}).perception || {}).issues || []).map(x => String((x && x.text) || '')).filter(Boolean));
for (const r of stored) { const k = known.get(r.site_id); if (k) for (const t of String(r.issues).split(' | ').filter(Boolean)) if (!k.some(x => AIE.sameClaim(x, t))) k.push(t); }
const canonClaim = (site, t) => { const k = known.get(site) || []; known.set(site, k); const hit = k.find(x => AIE.sameClaim(x, t)); if (hit) return hit; k.push(t); return t; };
return rows.map(r => {
  const a = read.get(r.site_id + '|' + r.prompt_id + '|' + r.engine); const out = {};
  for (const k of COLS) out[k] = r[k] === undefined ? '' : r[k];
  if (out.position === '') out.position = null;
  if (r._stored) out._stored = true;   // W2-E1: AI Metrics counts its money once (an earlier part paid for it)
  if (a && r.answered) {
    out.detail_json = AAD.markAnalysed(out.detail_json);   // W2-E1: the analyst read this answer (a later part never reads it again)
    const p = plans.find(x => x.site_id === r.site_id) || { brand_names: [r.domain], domain: r.domain, competitors: [], configured_competitors: [] };
    const ours = (b) => { const d = normD(b.domain); const nm = String(b.name || '').toLowerCase(); return (d && (d === p.domain || d.endsWith('.' + p.domain))) || (p.brand_names || []).some(x => String(x).toLowerCase() === nm || (nm && nm.includes(String(x).toLowerCase()) && String(x).length >= 5)); };
    // D19 (2026-10-11): a brand must map to a website or read like a business name - headings ("Tax technology and e-invoicing software") are not
    const brands = (Array.isArray(a.brands) ? a.brands : []).filter(b => b && b.name)
      .filter(b => ours(b) || /\./.test(normD(b.domain)) || brandish(b.name)).slice(0, 10);
    const ents = AIE.entitiesOf(r).map(e => ({ ...e }));
    const text = String(r._text || '');
    const conf = (Array.isArray(p.configured_competitors) ? p.configured_competitors : (p.competitors || [])).map(AIE.regD);
    const atOf = (name) => { const re = AIE.nameRe(name); if (!re) return -1; re.lastIndex = 0; const m = re.exec(AIE.visible(text)); return m ? m.index : -1; };
    let self = ents.find(e => e.role === 'self');
    brands.forEach((b, i) => {
      const dom = /\./.test(normD(b.domain)) ? AIE.regD(normD(b.domain)) : '';
      const role0 = ROLES.includes(String(b.role || '').toLowerCase()) ? String(b.role).toLowerCase() : 'competitor';
      if (ours(b)) { if (!self) { self = { id: p.domain, name: String(b.name).trim(), role: 'self', position: null, cited: !!r.cited }; ents.push(self); } self._named = true; self._ai = i; return; }
      const e = ents.find(x => x.role !== 'self' && ((dom && AIE.sameEntity(x.id, dom)) || String(x.name || '').toLowerCase() === String(b.name).toLowerCase().trim() || AIE.sameEntity(x.id, String(b.name).trim())));
      const isConf = (dom && conf.some(c => AIE.sameEntity(c, dom))) || (e && conf.some(c => AIE.sameEntity(c, e.id)));
      const hard = e && (e.role === 'source' && AIE.kindOfDomain(e.id) !== 'site');   // a government body, a directory or a news site stays a source
      const role = isConf ? 'competitor' : hard ? 'source' : role0;
      if (e) { e.role = e.role === 'self' ? 'self' : role; e._ai = i; if (e._at == null) e._at = atOf(e.name); return; }
      ents.push({ id: dom || String(b.name).trim().slice(0, 60), name: String(b.name).trim().slice(0, 60), role, position: null, cited: false, _ai: i, _at: atOf(b.name) });
    });
    // the client: named by the analyst, or a brand word that matched something else (the analyst says the business is not mentioned)
    let named = !!out.named;
    if (self && self._named) named = true;
    else if (named && String(a.sentiment) === 'not_mentioned') named = false;   // the brand word matched something else (a common word, another company)
    // positions: the client and its competitors in the ANALYST's order (it read the answer: "the business's place in the list is read, not
    // guessed from text positions"); a competitor only the parser found joins that order where the text puts it, before the first business
    // the analyst listed after it in the text
    for (const e of ents) if (e._at == null) e._at = atOf(e.name);
    const offered = ents.filter(e => (e.role === 'competitor' && (e._at >= 0 || e._ai != null)) || (e.role === 'self' && named));
    const spine = offered.filter(e => e._ai != null).sort((x, y) => x._ai - y._ai);
    const key = (e) => { if (e._ai != null) return spine.indexOf(e); const t = e._at >= 0 ? e._at : 1e9; const k2 = spine.findIndex(x => x._at >= 0 && x._at > t);
      return (k2 >= 0 ? k2 : spine.length) - 0.5 + (t / 1e10); };
    offered.sort((x, y) => key(x) - key(y));
    for (const e of ents) e.position = null; offered.forEach((e, i) => { e.position = i + 1; });
    out.named = named;
    out.mentioned = named || !!out.cited;
    out.position = named && self ? self.position : null;
    out.rank = out.position || 0;
    const C = AIE.compact(ents.sort((x, y) => (x.position == null ? 1e9 : x.position) - (y.position == null ? 1e9 : y.position)));
    out.entities_json = C.length ? JSON.stringify(C) : '';
    out.competitors = C.filter(e => e.role === 'competitor').map(e => e.id).slice(0, 12).join(', ');
    out.brands = C.filter(e => e.role === 'self' || e.role === 'competitor' || e.role === 'platform').map(e => e.name).join(', ');
    out.sentiment = out.mentioned && SENT.includes(String(a.sentiment)) ? String(a.sentiment) : '';
    // G10: with no fact sheet on file nothing can contradict it — the run reports "not checked", so a claim the model volunteered anyway is dropped
    out.issues = a.facts_ok === false ? '' : [...new Set((Array.isArray(a.wrong) ? a.wrong : []).filter(w => w && w.claim)
      .map(w => canonClaim(r.site_id, String(w.claim).slice(0, 160) + (w.correct ? ' → ' + String(w.correct).slice(0, 120) : ''))))].join(' | ').slice(0, 600);
  }
  return { json: out };
});
