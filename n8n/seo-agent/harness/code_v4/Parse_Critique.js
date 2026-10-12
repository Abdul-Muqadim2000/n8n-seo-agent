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

// ---- D22 (2026-10-11, system review FIX_PLAN): a claim found on the client's own website is not "invented" ----
// Live (exec 365) the critic called Tech&'s real delivery stages ("Assess & Envision", "Run & Optimise") invented, because only the homepage
// was ever read. The site facts (services, sections and headings of every page the describer read, kept in site_description by Parse
// Description) are checked here as well as in the prompt: a claim that quotes something the website itself says is dropped from
// unsupported_claims and from the problems, and everything the critic still calls invented is renamed "unverified" — the honest word for a
// statement nobody has checked.
const sd = prev.site_description || {};
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const facts = [...(sd.site_facts || []), ...(sd.products_or_services || []), ...(sd.unique_selling_points || []), sd.business_description, sd.one_line_summary,
  ...(prev.content_brief && prev.content_brief.client_facts || []), prev.business_facts, prev.case_facts_text, prev.business]
  .map(norm).filter(f => f.length >= 4);
const factBlob = ' ' + facts.join(' || ') + ' ';
const figures = (s) => (String(s == null ? '' : s).match(/\d[\d,.]*/g) || []).map(x => x.replace(/[,.]+$/, ''));
const onSite = (q) => {
  const t = norm(q); if (t.length < 4) return false;
  if (figures(q).some(f => !factBlob.includes(f))) return false;                            // a figure the website never states is not "on the site", whatever words surround it
  if (factBlob.includes(' ' + t + ' ')) return true;                                        // the claim is one of the facts
  return facts.some(f => f.split(' ').length >= 2 && (t.includes(f) || (t.split(' ').length >= 2 && f.includes(t))));   // a 2+ word fact inside the claim, or the other way round
};
const unverified = (s) => String(s == null ? '' : s).replace(/\binvent(ed|s|ing)?\b/gi, 'unverified').replace(/\bmade[- ]up\b/gi, 'unverified').replace(/\bfabricat(ed|es|ing|ion)\b/gi, 'unverified');
const claims = Array.isArray(cr.unsupported_claims) ? cr.unsupported_claims.map(c => (c && typeof c === 'object' ? JSON.stringify(c) : String(c))) : [];
cr.claims_on_site = claims.filter(onSite);
cr.unsupported_claims = claims.filter(c => !onSite(c));
const INVENTION = /\binvent|made[- ]up|fabricat|unsupported|no source|not supported|unsubstantiated\b/i;
cr.problems = cr.problems.filter(p => !(p && typeof p === 'object' && INVENTION.test(String(p.issue || '')) && (onSite(p.location) || onSite(p.issue))))
  .map(p => (p && typeof p === 'object' ? { ...p, issue: unverified(p.issue), fix: unverified(p.fix) } : p));
cr.revision_instructions = unverified(cr.revision_instructions);
cr.site_facts_checked = facts.length;
cr.site_pages_read = (sd.pages_read || []).length;

return [{ json: { ...prev, output: draft, critique: cr } }];
