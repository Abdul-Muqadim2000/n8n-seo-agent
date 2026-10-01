// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

const base = $('Build Content Prompt').first().json;
let cr = null;
try { cr = parseAgentJson($input.first().json.output); } catch (e) { cr = null; }

const findings = [];
const works = [];
const skipped = base.content_skip || (cr && cr.skipped);

if (skipped) {
  findings.push({ category: 'Content', severity: 'Info', title: 'Content review skipped: page text could not be read',
    evidence: 'Readable text was collected from ' + (base.content_pages_read || 0) + ' pages',
    why: 'Content and E-E-A-T could not be assessed in this run, so no content findings were reported.',
    fix: 'Re-run the report; if this repeats, the pages may block automated readers.',
    sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
  cr = null;
} else if (cr) {
  for (const f of (cr.findings || [])) {
    let sev = ['Critical', 'High', 'Medium', 'Low'].includes(f.severity) ? f.severity : 'Medium';
    if (sev === 'Critical') sev = 'High';                       // AI review never outranks measured technical issues
    findings.push({
      category: 'Content', severity: sev, title: f.title || 'Content issue',
      evidence: f.evidence || '', why: f.why || '', fix: f.fix || '',
      sample_urls: f.url ? [f.url] : [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false, source: 'ai_review'
    });
  }
  (cr.strengths || []).forEach(s => works.push(s));
} else {
  findings.push({ category: 'Content', severity: 'Info', title: 'Content review could not be completed', evidence: 'AI response was not valid JSON', why: '', fix: 'Re-run the report.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
}

const clean = { ...base };
delete clean.content_prompt_our;
delete clean.content_prompt_comp;

return [{
  json: {
    ...clean,
    content_review: cr,
    extra_findings: [...(base.extra_findings || []), ...findings],
    extra_works: [...(base.extra_works || []), ...works]
  }
}];