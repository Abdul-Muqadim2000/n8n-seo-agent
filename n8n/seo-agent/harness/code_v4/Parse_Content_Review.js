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
  // B-10 (re-rating 2026-10-17): a "no pricing" finding over a site whose own pages carry pricing / cost sections is not what the run saw
  const CS = base.content_sections || { read: [], outline: [] };
  const PRICE_H = /\b(pric(?:e|es|ing)|costs?|fees?|budget|quote)\b/i, TIME_H = /\b(timelines?|duration|how long)\b/i;
  const pricePages = [...(CS.read || []), ...(CS.outline || [])].filter(x => (x.headings || []).some(h => PRICE_H.test(h)));
  const timePages = [...(CS.read || []), ...(CS.outline || [])].filter(x => (x.headings || []).some(h => TIME_H.test(h)));
  const figuresSeen = (CS.read || []).some(x => x.figures);
  const claimsNoPrice = (f) => /\b(no|missing|without|lacks?|lacking|absent|not (?:shown|listed|stated|given))\b[^.;]{0,80}\b(pric(?:e|es|ing)|costs?|fees?)\b|\b(pric(?:e|es|ing)|costs?)\b[^.;]{0,40}\b(missing|absent|not (?:shown|listed|stated|given))\b/i.test(String(f.title || '') + ' ' + String(f.evidence || ''));
  const pathOf10 = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/i, '') || '/';
  const pricedFinding = (f) => {
    const list = pricePages.slice(0, 4).map(x => pathOf10(x.url) + ' ("' + (x.headings || []).filter(h => PRICE_H.test(h))[0] + '")').join(', ');
    const asksTime = /\b(timelines?|durations?|how long)\b/i.test(String(f.title || '') + ' ' + String(f.evidence || ''));
    return { ...f, severity: 'Low', title: 'Pricing sections explain what drives the cost' + (figuresSeen ? '' : ' but give no price ranges'),
      evidence: pricePages.length + ' page(s) carry pricing / cost sections: ' + list + (pricePages.length > 4 ? ' and ' + (pricePages.length - 4) + ' more' : '')
        + (asksTime ? (timePages.length ? '; ' + timePages.length + ' page(s) have a timeline section' : '; no timeline section was seen on the pages read or in the crawl\'s headings') : '')
        + '. The review read ' + (base.content_pages_read || 0) + ' page(s); the original finding said: ' + String(f.title || '').slice(0, 120),
      fix: 'Add indicative ranges or worked sizing examples to those pricing sections' + (asksTime && !timePages.length ? ', and typical timelines per engagement' : '') + '.',
      url: pricePages[0].url, b10_rewritten: true }; };
  for (const f0 of (cr.findings || [])) {
    const f = (pricePages.length && claimsNoPrice(f0)) ? pricedFinding(f0) : f0;
    let sev = ['Critical', 'High', 'Medium', 'Low'].includes(f.severity) ? f.severity : 'Medium';
    if (sev === 'Critical') sev = 'High';                       // AI review never outranks measured technical issues
    findings.push({
      category: 'Content', severity: sev, title: f.title || 'Content issue',
      evidence: f.evidence || '', why: f.why || '', fix: f.fix || '',
      sample_urls: f.url ? [f.url] : [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false, source: 'ai_review'
    });
  }
  (cr.strengths || []).forEach(s => works.push(s));
  if (pricePages.length && cr.eeat_signals && cr.eeat_signals.pricing_transparency === 'no') cr.eeat_signals.pricing_transparency = 'partial';   // B-10
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