// F2 (2026-10-23, ENGINE_AUDIT.md E11): what the Answer Analyst changed, written back over the rows *Save AI Answers* already stored. Only
// the rows that differ in any column from the parser's reading are sent (exact seo_ai_answers columns; *Update AI Answers* upserts on
// run_id + prompt_id + engine), so a part writes each answer once and the few the analyst read twice.
const COLS = ["site_id", "domain", "run_id", "checked_at", "prompt_id", "prompt", "kind", "topic", "engine", "answered", "mentioned", "cited", "rank", "our_urls", "competitors", "sources", "excerpt", "cost", "error", "run_kind", "sentiment", "brands", "issues", "fanout", "cited_urls", "named", "position", "entities_json"];   // the seo_ai_answers columns, written in by build_monitors.py from ladder_common.AI_ANSWERS_COLS
let raw = []; try { raw = $('AI Answer Rows').all().map(i => i.json).filter(r => r && !r.skip && r.engine); } catch (e) {}
let done = []; try { done = $('Apply Analysis').all().map(i => i.json).filter(r => r && !r.skip && r.engine); } catch (e) {}
const key = (r) => r.run_id + '|' + r.prompt_id + '|' + r.engine;
const before = new Map(raw.map(r => [key(r), r]));
const out = [];
for (const r of done) {
  const b = before.get(key(r));
  if (b && COLS.every(c => String(b[c] == null ? '' : b[c]) === String(r[c] == null ? '' : r[c]))) continue;
  const o = {}; for (const k of COLS) o[k] = r[k] === undefined ? '' : r[k]; out.push({ json: o });
}
return out.length ? out : [{ json: { skip: true, reason: 'the analyst changed no stored answer in this part' } }];
