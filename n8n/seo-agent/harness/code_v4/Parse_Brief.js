// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

const prev = $('Brief Context').first().json;   // Parse Verdict + business profile, proof, page role, hub pages, video (v4.4)
const brief = parseAgentJson($input.first().json.output);

// Word count check
const totalWords = (brief.outline || []).reduce((s, sec) => s + (Number(sec.target_words) || 0), 0);

return [{
  json: {
    ...prev,
    content_brief: brief,
    brief_outline_words: totalWords
  }
}];