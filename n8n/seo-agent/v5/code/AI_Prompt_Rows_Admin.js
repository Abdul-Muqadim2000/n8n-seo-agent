// Site Admin "ai_prompts": adds custom buyer questions (source custom, tracked weekly before the automatic ones) and switches questions off
// (by prompt id or exact text). Exact seo_ai_prompts columns (v4.9: stage, cluster, volume, origin, updated_at); upsert by prompt_id.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the owner's panel manager — add up to 500 at once (text or { prompt, persona, cluster, stage,
// market, pinned }: the app's CSV import), edit a stored question's persona / cluster / stage / market / pin in place, give it NEW WORDING
// (a new question: the old one is switched off so no trend compares two different questions), switch off, switch back on, pin, unpin.
// A pinned question is asked before every other and is never cut when the panel is made smaller. G6 columns: persona, market, pinned, fit_note.
// F2 (2026-10-23, ENGINE_AUDIT.md E2 / E15 / E9): the same question id and normal form as the Prompt Writer's path (AIP.promptId / AIP.normQ,
// _ai_panel.js 3b: every script, 64 bits, site-scoped; Set AI Prompts upserts on site_id + prompt_id), and a real search phrase: the owner's
// own `keyword` when given (keyword_source 'owner'), else the question's content words (AIP.keywordOf, 'derived') — never its first 5 words.
/*__AI_PANEL__*/
const a = $('Admin Action').first().json;
let rows = []; try { rows = $('Load AI Prompts (Admin)').all().map(i => i.json).filter(x => x && x.site_id === a.site_id); } catch (e) {}
const norm = AIP.normQ;
const kwOf = (x, prompt) => { const k = String((x && x.keyword) || '').trim(); return k ? { keyword: k.toLowerCase().slice(0, 120), keyword_source: 'owner' } : { keyword: AIP.keywordOf(prompt), keyword_source: 'derived' }; };
const STAGES = ['awareness', 'consideration', 'decision'];
const mkt = (x) => { const mm = String(x || '').trim().replace(/[_\s]+/g, '-').match(/^([A-Za-z]{2})(?:-([A-Za-z]{2,3}))?$/); return mm ? mm[1].toUpperCase() + '-' + (mm[2] || 'en').toLowerCase() : ''; };
const vol = (v) => v === undefined || v === '' || v == null ? null : v;
const pinOf = (v) => v === true || String(v) === 'true';
const COLS = (r) => ({ prompt_id: r.prompt_id, site_id: r.site_id, domain: r.domain || a.domain || '', prompt: r.prompt, kind: r.kind || 'custom', topic: r.topic || '', keyword: r.keyword || '', source: r.source || 'custom', status: r.status || 'active', created_at: r.created_at || a.updated_at,
  stage: r.stage || '', cluster: r.cluster || '', volume: vol(r.volume), origin: r.origin || '', updated_at: a.updated_at, persona: String(r.persona || ''), market: String(r.market || ''), pinned: pinOf(r.pinned), fit_note: String(r.fit_note || ''), keyword_source: AIP.KEYWORD_SOURCES.includes(r.keyword_source) ? r.keyword_source : '',
  // AI-FOCUS (2026-10-27): the focus fields as stored (a change by the owner keeps them), and a retirement's date and reason
  focus_topic: String(r.focus_topic || ''), focus_source: String(r.focus_source || ''), focus_state: String(r.focus_state || ''), focus_seen_at: String(r.focus_seen_at || ''), retired_at: String(r.retired_at || ''), retire_reason: String(r.retire_reason || '') });
const out = new Map();   // one row per prompt id (the last change wins)
// a stored row that IS this question keeps its id (a legacy p_ id included); only a question new to the site gets AIP.promptId
const idFor = (prompt) => { const old = AIP.findStored(rows, a.site_id, prompt) || [...out.values()].find(r => norm(r.prompt) === norm(prompt)); return old ? old.prompt_id : AIP.promptId(a.site_id, prompt); };
const put = (r) => out.set(r.prompt_id, COLS(r));
const find = (x) => rows.filter(r => r.prompt_id === x || norm(r.prompt) === norm(x));
const cur = (r) => out.get(r.prompt_id) || r;
for (const q0 of (a.add_prompts || [])) { const q = typeof q0 === 'object' ? q0 : { prompt: String(q0) };
  if (!norm(q.prompt)) continue;
  const id = idFor(q.prompt); const old = rows.find(r => r.prompt_id === id) || {};
  const kw = q.keyword ? kwOf(q, q.prompt) : (old.keyword && old.keyword_source !== 'derived' ? { keyword: old.keyword, keyword_source: old.keyword_source || 'writer' } : kwOf(null, q.prompt));
  put({ ...old, prompt_id: id, site_id: a.site_id, domain: a.domain || old.domain || '', prompt: q.prompt, kind: 'custom', topic: q.cluster || old.topic || '', keyword: kw.keyword, keyword_source: kw.keyword_source, source: 'custom', status: 'active',
    created_at: old.created_at || a.updated_at, stage: STAGES.includes(q.stage) ? q.stage : (old.stage || 'consideration'), cluster: q.cluster || old.cluster || '', origin: 'custom', persona: q.persona || old.persona || '', market: mkt(q.market) || old.market || '', pinned: q.pinned || pinOf(old.pinned), fit_note: '' }); }
for (const e of (a.edit_prompts || [])) for (const r0 of find(e.prompt_id)) { const r = cur(r0);
  const patch = { persona: e.persona || r.persona, cluster: e.cluster || r.cluster, stage: STAGES.includes(e.stage) ? e.stage : r.stage, market: mkt(e.market) || r.market, pinned: e.pinned === undefined ? pinOf(r.pinned) : e.pinned,
    ...(e.keyword ? kwOf(e, r.prompt) : {}) };
  if (e.prompt && norm(e.prompt) !== norm(r.prompt)) {   // new wording = a new question; the old one stays in the history, switched off
    put({ ...r, status: 'off' });
    const id = idFor(e.prompt); const kw = kwOf(e, e.prompt);
    put({ ...r, ...patch, prompt_id: id, prompt: e.prompt, source: 'custom', kind: r.kind === 'brand' ? 'brand' : 'custom', origin: 'custom', status: 'active', created_at: a.updated_at, keyword: kw.keyword, keyword_source: kw.keyword_source, volume: null, fit_note: '' });
  } else put({ ...r, ...patch }); }
for (const x of (a.off_prompts || [])) for (const r of find(x)) put({ ...cur(r), status: 'off' });
// a question the keyword rule refused and the owner switches on becomes the owner's own (source custom): the read path then keeps it and only flags it
for (const x of (a.on_prompts || [])) for (const r of find(x)) { const c = cur(r); const was = String(c.status) === 'refused';
  put({ ...c, status: 'active', source: was ? 'custom' : c.source, fit_note: was ? 'switched on by the owner over the keyword rule: ' + String(c.fit_note || '') : c.fit_note }); }
for (const x of (a.pin_prompts || [])) for (const r of find(x)) put({ ...cur(r), pinned: true });
// AI-FOCUS: Accept = a proposed question starts being asked (it stays the engine's: its topic and source are kept); Retire = kept with its history, never asked
for (const x of (a.accept_prompts || [])) for (const r of find(x)) { const c = cur(r); if (['proposed', 'off', 'retired'].includes(String(c.status))) put({ ...c, status: 'active', retired_at: '', retire_reason: '' }); }
for (const x of (a.retire_prompts || [])) for (const r of find(x)) put({ ...cur(r), status: 'retired', retired_at: a.updated_at, retire_reason: 'retired by you', focus_state: 'out' });
for (const x of (a.unpin_prompts || [])) for (const r of find(x)) put({ ...cur(r), pinned: false });
return out.size ? [...out.values()].map(r => ({ json: r })) : [{ json: { skip: true } }];
