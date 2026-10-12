/*__PAGE_TYPE__*/
// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

const prev = $('Collect Facts').first().json;
const analysis = parseAgentJson($input.first().json.output);
// Length discipline: commercial pages convert better short; guides may run longer. Never above 3,000 words.
// 2026-10-12 (FIX_PLAN D10): the page type can arrive as a whole sentence ("Service Page (…) with built-in comparison, cost and compliance
// sections"), which picked the band by accident; the fixed option decides it.
const pt = PT.of(prev.page_type).toLowerCase();
const isGuide = /blog|guide|article/.test(pt);
const lo = isGuide ? 1200 : 900, hi = isGuide ? 3000 : 2400;
const rec = Number(analysis.recommended_word_count) || 1400;
analysis.recommended_word_count = Math.min(hi, Math.max(lo, Math.round(rec / 100) * 100));

return [{
  json: {
    ...prev,
    competitor_digest: undefined,
    competitor_analysis: analysis
  }
}];