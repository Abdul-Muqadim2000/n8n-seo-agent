// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

const prev = $('Merge Keyword Data').first().json;
const verdict = parseAgentJson($input.first().json.output);

const allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];
if (!allowed.includes(verdict.verdict)) verdict.verdict = 'GO_WITH_CHANGES';

return [{
  json: {
    ...prev,
    verdict: verdict.verdict,
    verdict_score: verdict.score ?? null,
    verdict_reasons: verdict.reasons || [],
    verdict_risks: verdict.risks || [],
    recommended_page: verdict.recommended_page || prev.page_type,
    secondary_keywords: verdict.secondary_keywords || [],
    verdict_changes: verdict.what_must_change || [],
    expected_visits_top3: verdict.expected_monthly_visits_top3 ?? null,
    time_to_rank_months: verdict.time_to_rank_months ?? null
  }
}];