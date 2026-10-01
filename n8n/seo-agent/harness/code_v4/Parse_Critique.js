// Accepts an object (from the Structured Output Parser) or a string; attaches the critique to the draft for Content QA.
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  return null;
};
const prev = $('Parse Brief').first().json;
const draft = $('Copywriter').first().json.output;
let cr = parseAgentJson($input.first().json.output);
if (!cr || typeof cr !== 'object') cr = { score: null, verdict: 'unknown', problems: [], revision_instructions: '', strengths: [], banned_phrases_found: [], unsupported_claims: [], missing_brief_items: [], parse_failed: true };
cr.problems = Array.isArray(cr.problems) ? cr.problems.slice(0, 12) : [];
return [{ json: { ...prev, output: draft, critique: cr } }];
