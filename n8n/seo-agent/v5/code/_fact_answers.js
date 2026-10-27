// ---- FA: the client's answers to the questions on written pages, kept once per website (H3, 2026-10-28; inlined through the FACT_ANSWERS marker) ----
// The page pipeline (H1, v5/code/_page_fix.js PF.questions) asks the client about every statement nothing on file supports, keyed by a
// business-fact key (`fact_key`, e.g. "credential.microsoft_partner"). The app stores each answer ONCE on the website (app: sites.fact_answers;
// engine: seo_sites.fact_answers_json, written by Site Admin `facts`) and every later page run carries:
//   business_facts_kv   fact_key -> the text the client confirmed or wrote (decisions yes / edit / answer): the claim check reads it as on file
//   stored_fact_keys    every key the client decided, including remove and general: PF.questions never asks it again
// The same rule as the app's factsForEngine (app/shared/src/page-review.ts): the two must change together.
// Pure: no clock, no network, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const FA = (() => {
  const KEY = /^[\p{L}\p{N}_.&-]{1,80}$/u;
  const DECISIONS = ['yes', 'edit', 'answer', 'remove', 'general'];
  const TEXT_MAX = 600, KV_MAX = 200, KEYS_MAX = 400;
  const S = (v) => String(v == null ? '' : v);
  const clean = (t) => S(t).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  const asObj = (raw) => { let o = raw; if (typeof o === 'string') { try { o = JSON.parse(o || '{}'); } catch (e) { o = null; } }
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null; };
  // { key: { decision, text } } from the stored JSON (or an object); entries with a bad key or decision are dropped and counted
  const parse = (raw) => { const o = asObj(raw); const answers = {}; let dropped = 0; if (!o) return { answers, dropped };
    for (const [k, v] of Object.entries(o).slice(0, KEYS_MAX)) {
      const decision = v && typeof v === 'object' ? S(v.decision).toLowerCase() : 'yes';
      const text = clean(v && typeof v === 'object' ? v.text : v).slice(0, TEXT_MAX);
      if (!KEY.test(k) || !DECISIONS.includes(decision) || ((decision === 'yes' || decision === 'edit' || decision === 'answer') && !text)) { dropped++; continue; }
      answers[k] = { decision, text: decision === 'remove' || decision === 'general' ? '' : text }; }
    return { answers, dropped }; };
  // the facts a page may state, and every decided key
  const kv = (answers) => { const out = {}; for (const [k, v] of Object.entries(answers || {})) if (v && v.text && (v.decision === 'yes' || v.decision === 'edit' || v.decision === 'answer')) out[k] = v.text; return out; };
  const keys = (answers) => Object.keys(answers || {}).filter(k => KEY.test(k)).sort().slice(0, KEYS_MAX);
  // what a request carries (Normalize Input): validated and capped; a malformed value is an empty one, never an error for the whole run
  const kvIn = (raw) => { const o = asObj(raw); const out = {}; if (!o) return out; let n = 0;
    for (const [k, v] of Object.entries(o)) { if (n >= KV_MAX) break; const t = clean(v).slice(0, TEXT_MAX); if (!KEY.test(k) || !t || typeof v === 'object') continue; out[k] = t; n++; }
    return out; };
  const keysIn = (raw) => { const a = Array.isArray(raw) ? raw : typeof raw === 'string' && raw.trim() ? raw.split(/[,\n]/) : [];
    return [...new Set(a.map(x => clean(x)).filter(k => KEY.test(k)))].slice(0, KEYS_MAX); };
  // the two fields a page run spawned from a stored website row carries
  const forRun = (siteRow) => { const a = parse(siteRow && siteRow.fact_answers_json).answers; return { business_facts_kv: kv(a), stored_fact_keys: keys(a) }; };
  // the stored facts as text, one per line, for the claim corpus
  const text = (kvObj) => Object.values(kvObj || {}).map(clean).filter(Boolean).join('\n');
  return { KEY, DECISIONS, TEXT_MAX, parse, kv, keys, kvIn, keysIn, forRun, text, clean };
})();
