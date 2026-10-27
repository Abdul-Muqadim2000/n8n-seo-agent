// Prompt rows for seo_ai_prompts (upsert by prompt_id; exact table columns): the Prompt Writer's new questions (Claude), or template questions when
// the writer failed or did not run, plus the stored questions whose monthly AI search volume was looked up this run (v4.9). The wording of a stored
// question never changes, so the trend always compares the same questions.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): a site's new questions come from SEVERAL writer jobs (one per market x buyer role, at most 40 a
// job), each question carries its persona and market, and before any is stored:
//  * it is deduplicated BY MEANING against the stored panel and against the other new ones (AIP.dedupe: content-word stems, Jaccard >= 0.6,
//    within one market and buyer role) — a 500-question panel must not ask one thing ten times;
//  * it goes through the fit gate (FITR, _fit_gate.js — the same rule the read path runs): its search phrase AND its wording must not name
//    the website itself, another company, a government service or a portal task. A refused question is STORED with status `refused` and the
//    gate's sentence in `fit_note` — never asked, never scored, and shown in the app's panel manager with the reason (INVARIANTS rule 1:
//    a list shorter because a gate ran says so).
/*__AI_PANEL__*/
/*__FIT_GATE__*/
/*__AI_FOCUS__*/
/*__AI_ENTITIES__*/
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let jobs = []; try { jobs = $('Prompt Jobs').all().map(i => i.json).filter(j => !j.skip); } catch (e) {}
let outs = []; try { outs = $('Prompt Writer').all().map(i => i.json); } catch (e) {}
let cacheRows = []; try { cacheRows = $('Load Cache (AI)').all().map(i => i.json); } catch (e) {}   // F1a: entities learned in earlier runs
let storedAll = []; try { storedAll = $('Load AI Prompts').all().map(i => i.json).filter(r => r && r.site_id && r.prompt); } catch (e) {}
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery').all().map(i => i.json || {}); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
// F2 (2026-10-23, ENGINE_AUDIT.md E2 / E15): one normal form for every script and a 64-bit site-scoped id (AIP.normQ / AIP.promptId, _ai_panel.js
// 3b) — the old [a-z0-9] normaliser turned every Arabic question into '' (one id for all of them), and the 32-bit id was shared by every site.
// Save Prompts upserts on (site_id, prompt_id). A stored question keeps its stored id: only a question new to the site gets a new one.
const norm = AIP.normQ;
const now = new Date().toISOString(); const rows = [];
const KINDS = ['recommend', 'choose', 'cost', 'compare', 'problem', 'brand', 'shopping'], STAGES = ['awareness', 'consideration', 'decision', 'brand', 'shopping'],   /* W2-E1: shopping, for sites that sell products (Prompt Jobs asks for it only then) */ ORIGINS = ['market', 'search', 'writer', 'paa', 'competitor'];
const STAGE_OF = { recommend: 'decision', cost: 'decision', choose: 'consideration', compare: 'consideration', problem: 'awareness', brand: 'brand', custom: 'consideration', shopping: 'shopping' };
// monthly AI search volume per search phrase (AI Keyword Data), per site
const volumes = new Map();
dreq.forEach((q, i) => { if (q.kind !== 'volume') return; const t = ((dres[i] || {}).tasks || [])[0] || {}; if (t.status_code !== 20000) return;
  const m = volumes.get(q.site_id) || new Map(); for (const it of (((t.result || [])[0] || {}).items || [])) if (it && it.keyword) m.set(String(it.keyword).toLowerCase().trim(), Number(it.ai_search_volume) || 0); volumes.set(q.site_id, m); });
const COLS = (r) => ({ prompt_id: r.prompt_id, site_id: r.site_id, domain: r.domain, prompt: r.prompt, kind: r.kind, topic: r.topic, keyword: r.keyword, source: r.source, status: r.status || 'active', created_at: r.created_at,
  stage: r.stage || '', cluster: r.cluster || '', volume: r.volume == null || Number.isNaN(r.volume) ? null : Number(r.volume), origin: r.origin || '', updated_at: now,
  persona: String(r.persona || '').slice(0, 40), market: String(r.market || ''), pinned: r.pinned === true || String(r.pinned) === 'true', fit_note: String(r.fit_note || '').slice(0, 400),
  keyword_source: AIP.KEYWORD_SOURCES.includes(r.keyword_source) ? r.keyword_source : '',   // F2 (E9): where the search phrase came from
  // AI-FOCUS (2026-10-27): the topic the question measures (the reconcile's, carried on a re-store), and, for a retired question, when and why
  focus_topic: String(r.focus_topic || '').slice(0, 120), focus_source: String(r.focus_source || '').slice(0, 80), focus_state: String(r.focus_state || ''), focus_seen_at: String(r.focus_seen_at || ''),
  retired_at: String(r.retired_at || ''), retire_reason: String(r.retire_reason || '').slice(0, 300) });
let dupes = 0;
for (const p of plans) {
  const vol = volumes.get(p.site_id) || new Map();
  // stored questions: new volume (and a stage / cluster for questions written before v4.9)
  for (const q of p.prompts) { const k = String(q.keyword || '').toLowerCase().trim(); const v = vol.has(k) ? vol.get(k) : null;
    if (v === null && q.stage && q.cluster && !q.focus_moved) continue;   // AI-FOCUS: a question whose topic moved is stored again
    if (v === null && q.kind === 'brand' && q.stage) continue;
    // F2 (E20): a re-upsert of a stored question keeps what the row says — its fit_note ("switched on by the owner over the keyword rule"),
    // the market it was stored with (not the plan's normalised one) and where its search phrase came from
    rows.push(COLS({ ...q, site_id: p.site_id, domain: p.domain, status: 'active', volume: v !== null ? v : q.volume, stage: q.stage || STAGE_OF[q.kind] || 'consideration', cluster: q.cluster || q.topic || '',
      market: q.market_stored != null ? q.market_stored : q.market, fit_note: q.fit_note || '', keyword_source: q.keyword_source || '' })); }
  // AI-FOCUS: the questions the reconcile retired (the topic left the client's focus, another market on a panel with no trend yet, or room for a
  // new ladder): stored with status `retired`, the date and the reason - their answers and history stay, and they are never written again
  for (const r of ((p.focus || {}).retire || [])) { const st = storedAll.find(x => x.site_id === p.site_id && x.prompt_id === r.prompt_id); if (!st) continue;
    rows.push(COLS({ ...st, status: 'retired', retired_at: now, retire_reason: r.reason || '', focus_state: 'out', volume: st.volume === '' ? null : st.volume })); }
  if (!p.need_prompts) continue;
  // every job of this site (G6: several — one per market x buyer role), each with its writer's answer
  const mine = jobs.map((j, i) => ({ j, o: outs[i] })).filter(x => x.j.site_id === p.site_id);
  let qs = [];
  for (const { j, o } of mine) {
    const got = o && !o.error ? parse(o.output) : null;
    // AI-FOCUS: the topic a written question belongs to: the job's topic its cluster (or search phrase) names, else the one with the most left to write
    const ft = (j.focus_topics || []).map(t => ({ ...t, left: Number(t.count) || 0 }));
    const topicFor = (q) => { if (!ft.length) return null; const c = String(q.cluster || q.topic || '').toLowerCase().trim(), k = String(q.keyword || '').toLowerCase();
      const hit = ft.find(t => t.label === c) || ft.find(t => AIF.sameTopic(t.label, c)) || ft.find(t => AIF.carries(AIF.words(c + ' ' + k), t.label) > 0) || ft.slice().sort((a, b) => b.left - a.left)[0];
      hit.left--; return hit; };
    for (const q of (got && Array.isArray(got.prompts) ? got.prompts : [])) {
      if (!q || !q.prompt || String(q.prompt).length < 12) continue;
      const kind = KINDS.includes(String(q.kind).toLowerCase()) ? String(q.kind).toLowerCase() : 'recommend';
      qs.push({ prompt: String(q.prompt).trim().slice(0, 300), kind, topic: String(q.cluster || q.topic || '').slice(0, 120), keyword: String(q.keyword || q.cluster || q.topic || '').toLowerCase().slice(0, 120) || AIP.keywordOf(q.prompt), keyword_source: (q.keyword || q.cluster || q.topic) ? 'writer' : 'derived', source: 'auto',
        stage: STAGES.includes(String(q.stage).toLowerCase()) ? String(q.stage).toLowerCase() : STAGE_OF[kind], cluster: String(q.cluster || q.topic || '').toLowerCase().slice(0, 60),
        origin: ORIGINS.includes(String(q.origin).toLowerCase()) ? String(q.origin).toLowerCase() : 'writer', persona: String(j.persona || q.persona || '').trim().slice(0, 40), market: j.market || p.own_market || '',
        // AI-FOCUS: the job's topic is the question's topic and its cluster (one segment per focus topic), and a proposal waits for the owner
        ...(() => { if (String(q.kind).toLowerCase() === 'brand') return {}; const t = topicFor(q); return t ? { focus_topic: t.label, focus_source: t.source || '', focus_state: t.state || '', cluster: String(t.label).toLowerCase().slice(0, 60), topic: String(q.cluster || q.topic || t.label).slice(0, 120), propose: !!j.propose } : {}; })() });
    }
  }
  if (!qs.length) {   // template fallback: the same buyer journey, less natural wording
    const where = p.country ? ' in ' + (p.city || p.country) : '';
    const fw0 = ((p.focus || {}).write || []);   // AI-FOCUS: the template questions are written per focus topic, with the topic stamped
    if (fw0.length) for (const w of fw0) for (let i = 0; i < Number(w.count); i++) { const t = w.label;
      qs.push(i % 2 === 0 ? { prompt: 'Which companies offer ' + t + where + '? Recommend the best options with their websites.' + (i > 1 ? ' (' + (i + 1) + ')' : ''), kind: 'recommend', topic: t, keyword: t, source: 'template', stage: 'decision', cluster: t, origin: 'template', market: p.own_market || '', focus_topic: t, focus_source: w.source || '', focus_state: w.state || '' }
        : { prompt: 'How do I choose a provider for ' + t + where + ', and what should it cost?' + (i > 2 ? ' (' + (i + 1) + ')' : ''), kind: 'choose', topic: t, keyword: t + ' cost', source: 'template', stage: 'consideration', cluster: t, origin: 'template', market: p.own_market || '', focus_topic: t, focus_source: w.source || '', focus_state: w.state || '' }); }
    else for (const t of (p.topics.length ? p.topics : [p.domain.split('.')[0]]).slice(0, 4)) qs.push({ prompt: 'Which companies offer ' + t + where + '? Recommend the best options with their websites.', kind: 'recommend', topic: t, keyword: t, source: 'template', stage: 'decision', cluster: t, origin: 'template', market: p.own_market || '' }, { prompt: 'How do I choose a provider for ' + t + where + ', and what should it cost?', kind: 'choose', topic: t, keyword: t + ' cost', source: 'template', stage: 'consideration', cluster: t, origin: 'template', market: p.own_market || '' });
    if (!p.prompts.some(x => x.kind === 'brand')) qs.unshift({ prompt: 'What is ' + (p.business_name || p.domain) + ' (' + p.domain + ') and what does it offer?', kind: 'brand', topic: 'brand', keyword: p.business_name || p.domain.split('.')[0], source: 'template', stage: 'brand', cluster: 'brand', origin: 'template', market: p.own_market || '' });
  }
  // G6: the same question in other words is one question — against the stored panel and against the other new ones
  const brandQ = qs.filter(q => q.kind === 'brand'); const buyerQ = qs.filter(q => q.kind !== 'brand');
  const dd = AIP.dedupe(buyerQ, p.prompts.filter(q => q.kind !== 'brand').map(q => ({ prompt: q.prompt, persona: q.persona, market: q.market || p.own_market })));
  // G6: the fit gate, on the search phrase AND on the wording (the brand question is about the site itself and is never judged here)
  const ctx = FITR.ctx(p.fit_input || { own_domain: p.domain, competitors: p.competitors || [], brands: p.aliases || {} });
  // F1a (ENGINE_AUDIT E10): a question that NAMES another vendor ("Zoho Books vs QuickBooks for VAT filing", "Is SAP Business One worth it")
  // measures that vendor, not this business: the client is structurally absent from the answer and the gap list would ask for a page about
  // a rival's product. Refused with the vendor named - the owner's competitors at any name length, the businesses AI names for these topics
  // (learned names, the AI-answer database's brands for the discovered questions), the big platforms - unless it is the client's own
  // platform (its services name it). The owner's own questions do not pass through here: they are kept, whatever they name.
  const vendorsSeen = [...new Set(mine.flatMap(x => (x.j.market_questions || []).flatMap(m => { const g = String(m).match(/AI names ([^)]+)\)\s*$/); return g ? g[1].split(/,\s*/) : []; })))].filter(n => AIE.nameLike(n));
  const vctx = { site_id: p.site_id, domain: p.domain, business_name: p.business_name, brand_names: p.brand_names || [], competitors: p.competitors || [], configured_competitors: p.configured_competitors,
    aliases: p.aliases || {}, services: p.services || [], topics: p.topics || [], business_facts: p.business_facts || '', book: AIE.bookOf(cacheRows, p.site_id), vendors: vendorsSeen };
  const judge = (q) => { const v = AIE.vendorIn(q.prompt, vctx); if (v) return { ok: false, reason: 'other brand', detail: 'it names ' + v.name + ' (' + v.why + '), so the answer measures that company and not this business' };
    const a = fitGate(q.keyword || '', ctx); if (!a.ok) return a; const b = fitGate(q.prompt, { ...ctx, topics: null }); return b.ok ? { ok: true } : b; };
  // F2: every stored question of the site counts, whatever its status — a question the owner switched off or the gate refused is not
  // written again under a new id (and never switched back on by a writer)
  const have = new Set([...p.prompts.map(x => norm(x.prompt)), ...storedAll.filter(r => r.site_id === p.site_id).map(r => norm(r.prompt))].filter(Boolean)); let added = 0;
  // AI-FOCUS: each topic gets what the reconcile asked for, no more (one topic must not fill another's room)
  const left = new Map(((p.focus || {}).write || []).map(w => [String(w.label), Number(w.count) || 0]));
  const iso = String((p.focus || {}).country_iso || p.country_iso || '');
  for (const q of [...brandQ, ...dd.keep]) { if (added >= p.prompts_needed) break; if (have.has(norm(q.prompt))) continue;
    if (q.kind !== 'brand' && q.focus_topic && left.has(q.focus_topic)) { if (left.get(q.focus_topic) <= 0) continue; }
    have.add(norm(q.prompt));
    let v = q.kind === 'brand' ? { ok: true } : judge(q);
    // AI-FOCUS (§4.5, the M7 rule on the writer's output): a question naming a place outside the website's market is refused with the place named
    if (v.ok && q.kind !== 'brand' && iso) { const outside = AIF.placesOutside(q.prompt, iso); if (outside.length) v = { ok: false, reason: 'other market', detail: 'it names ' + outside.join(', ') + ', outside ' + ((p.focus || {}).own_market || iso) }; }
    const base = { prompt_id: AIP.promptId(p.site_id, q.prompt), keyword_source: q.keyword_source || (q.source === 'template' ? 'template' : 'writer'), site_id: p.site_id, domain: p.domain, prompt: q.prompt, kind: q.kind, topic: q.topic, keyword: q.keyword || q.topic, source: q.source, created_at: now,
      stage: q.stage, cluster: q.cluster, volume: vol.has(String(q.keyword || '').toLowerCase().trim()) ? vol.get(String(q.keyword || '').toLowerCase().trim()) : null, origin: q.origin, persona: q.persona || '', market: q.market || p.own_market || '', fresh: true,
      focus_topic: q.kind === 'brand' ? 'brand' : (q.focus_topic || ''), focus_source: q.kind === 'brand' ? 'brand' : (q.focus_source || ''), focus_state: q.kind === 'brand' ? 'core' : (q.focus_state || ''), focus_seen_at: q.focus_topic || q.kind === 'brand' ? now : '' };
    if (!v.ok) { rows.push(COLS({ ...base, status: 'refused', fit_note: '"' + q.prompt + '" was not added: ' + (v.detail || v.reason) + ' (' + v.reason + ')' })); continue; }
    added++; if (q.kind !== 'brand' && q.focus_topic && left.has(q.focus_topic)) left.set(q.focus_topic, left.get(q.focus_topic) - 1);
    rows.push(COLS({ ...base, status: q.propose ? 'proposed' : 'active' })); }
  // a question dropped as a repeat is not stored (it IS on the panel, in its first wording); the report counts them
  dupes += dd.dup.length;
}
// exact table columns only: the Save Prompts node maps every field it is given. AI Metrics reads the refused rows (status, fit_note) back.
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, duplicates_dropped: dupes } }];
