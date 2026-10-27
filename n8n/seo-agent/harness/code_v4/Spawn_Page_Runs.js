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
// Starts one content run (mode "keyword") per page in write_now, as separate executions through API Entry.
// Each run delivers its own PDF/Word by e-mail and/or callback, tagged with the ladder id and rung.
const d = $input.first().json; const L = d.ladder || {};
const GOAL = { leads: 'Get leads and enquiries', sales: 'Sell online', traffic: 'Rank and educate (traffic)', brand: 'Build the brand' };
const n = Math.min(3, Math.max(1, Number(d.pages_now) || 1));
// keyword-first R-K7 (2026-10-19): a ladder started in Manual mode writes nothing at start (Ladder Plan holds its pages and empties write_now);
// a plan that says it held its pages starts no page run, whatever pages_now asked for
if ((L.limits || {}).manual_hold === true || (L.held && Array.isArray(L.held.pages) && L.held.pages.length)) return [];
// F-A1 / A-21 (2026-10-17): the main page's run reads the head keyword's results page again; it is told what THIS run measured, so it can
// say that it re-measured and why its number moved (Parse Verdict, v5/code/_remeasure.js) instead of printing a second score silently
const headKw = String((L.head || {}).keyword || d.keyword || '').toLowerCase().trim();
// the ladder report slims serp_features out of its item, so the reading is taken from *Ladder Plan*, which carries the run's own
const sfL = (() => { try { return ($('Ladder Plan').first().json || {}).serp_features || d.serp_features || {}; } catch (e) { return d.serp_features || {}; } })();
const measureOf = (p) => String(p.keyword || '').toLowerCase().trim() !== headKw || (L.feasibility || {}).scored === false ? null : {
  keyword: headKw, score: (L.feasibility || {}).score ?? d.verdict_score ?? null, checked_at: String(sfL.checked_at || ((sfL.ai_overview || {}).seen_at) || ''),
  ai_overview: ((sfL.ai_overview || {}).present) === true, ai_overview_read: ((sfL.ai_overview || {}).present) != null,   // F-SERP: a lighter reading did not ask for the AI Overview
  features: Array.isArray(sfL.features_present) ? sfL.features_present.slice(0, 12) : [] };
// P1 (2026-10-20): every page run carries the website's business facts and call to action, the request's (the app sends the website's own)
// or else the site model's (seo_sites / the cached model), so a ladder started without them in the request still writes with the stored ones
const SMF = (() => { try { return ($('Site Model').first().json || {}).site_model || {}; } catch (e) { return {}; } })();
const factsOf = String(d.business_facts || '').trim() || String(SMF.business_facts || '').trim();
const ctaOf = String(d.cta || '').trim() || String(SMF.cta || '').trim();
// H3 (2026-10-28, section 152): a page is ours when a content-log row of this website carries it as its published address (host-agnostic)
const ownKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const ownUrls = (() => { try { return new Set($('Load Content Log (Ladder)').all().map(i => i.json || {}).filter(r => String(r.domain || '').toLowerCase().replace(/^www\./, '') === String(d.domain || '').toLowerCase().replace(/^www\./, '') && String(r.published_url || '').trim()).map(r => ownKey(r.published_url))); } catch (e) { return new Set(); } })();
const kvOf = FA.kvIn(d.business_facts_kv), keysOf = FA.keysIn(d.stored_fact_keys);
return (L.write_now || []).slice(0, n).map(p => ({ json: { body: {
  mode: 'keyword', keyword: p.keyword, page_type: p.page_type || 'Service Page', country: d.country, domain: d.domain,
  business: d.business || '', customers: d.audience || '', business_facts: factsOf, business_facts_kv: kvOf, stored_fact_keys: keysOf, cta: ctaOf, tone: d.tone || '', goal: GOAL[d.goal] || d.goal || '',
  receive: ['Keyword Report', 'Page Content'], existing_page_url: p.exists ? p.target_url : '', existing_page_ours: !!(p.exists && p.target_url && ownUrls.has(ownKey(p.target_url))),
  email: d.email || '', callback_url: d.callback_url || '', request_id: d.request_id || '', client_ip: 'ladder:' + (L.ladder_id || ''),
  force_content: true, ladder_id: L.ladder_id || '', ladder_rung: p.rung, ladder_head: (L.head || {}).keyword || d.keyword, ladder_page_no: p.page_no,
  ladder_words: Number(p.target_words) || 0,   // P2-7: the verdict's own word target travels with the page run (Parse Brief clamps to it)
  ladder_target_url: p.target_url || '',       // R15: the URL this ladder planned for the page — the page keeps it as its slug
  ladder_links: (p.links_to || []).map(l => ({ url: l.url, path: String(l.url).replace(/^https?:\/\/[^\/]+/i, '') || '/', role: l.role, keyword: l.keyword, planned: true })),
  wordpress_url: d.wordpress_url || '',
  ladder_measure: measureOf(p)                 // A-21: what the ladder measured for this keyword, when this page IS the ladder's main keyword
} } }));
