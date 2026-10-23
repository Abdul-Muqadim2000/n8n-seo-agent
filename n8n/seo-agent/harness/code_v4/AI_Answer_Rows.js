// F2 (2026-10-23, ENGINE_AUDIT.md E11): the answers are stored the moment they are read, BEFORE the Answer Analyst. The analyst (up to 12
// Claude jobs a site, one after another) used to sit between the paid requests and *Save AI Answers*, so a part that ran out of time in it
// lost every answer it had paid for — and the resume paid for them again. Now *Save AI Answers* inserts these rows (the parser's reading,
// exact seo_ai_answers columns, the answer text dropped) right after *Parse AI Answers*; *Apply Analysis* refines them and *Update AI Answers*
// writes back only the rows the analyst changed (AI Analysed Rows). A part that dies in the analyst leaves its answers stored, and the next
// part says they keep the parser's reading. Nothing is scored here: an answer the in-200 gate marked unavailable (it could not be read,
// even when sent again) is stored with its `error`, exactly as Parse AI Answers read it, so it counts as asked and is never re-paid.
const COLS = ["site_id", "domain", "run_id", "checked_at", "prompt_id", "prompt", "kind", "topic", "engine", "answered", "mentioned", "cited", "rank", "our_urls", "competitors", "sources", "excerpt", "cost", "error", "run_kind", "sentiment", "brands", "issues", "fanout", "cited_urls", "named", "position", "entities_json"];   // the seo_ai_answers columns, written in by build_monitors.py from ladder_common.AI_ANSWERS_COLS
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => r && !r.skip && r.engine && r.run_id && r.prompt_id); } catch (e) {}
if (!rows.length) return [{ json: { skip: true, reason: 'no answer rows in this part' } }];
// an answer the gate could not get is stored as exactly that: its error, and nothing that reads like a measured 'not named'
return rows.map(r => { const o = {}; for (const k of COLS) o[k] = r[k] === undefined ? '' : r[k];
  const unavailable = !!r.error || !!(r.__dfs && r.__dfs.unavailable);
  if (unavailable) { o.error = String((r.error && (r.error.message || r.error)) || 'could not be read').slice(0, 200); o.answered = false; o.mentioned = false; o.cited = false; o.rank = 0; }
  return { json: o }; });
