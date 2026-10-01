// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

const prev = $('Clean Site Text').first().json;
const desc = parseAgentJson($input.first().json.output);

return [{
  json: {
    ...prev,
    site_text: undefined,   // lamba text aage nahi chahiye
    site_description: desc,
    business: prev.business || desc.business_description,
    audience: prev.audience || (desc.target_audience || []).join(', ')
  }
}];