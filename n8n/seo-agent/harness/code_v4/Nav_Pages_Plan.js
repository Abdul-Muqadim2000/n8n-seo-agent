// D22 (2026-10-11, system review FIX_PLAN): the site description was written from the homepage alone, so most of what a business sells was
// never seen (live: techand.ai's describe listed 8 services and left out Business Central, CRM and Power Platform — all of them on /whatwedo/;
// the Keyword Check then scored "business central partner uae" at fit 1 and the critic called the site's real process stages "invented").
// This node picks up to CONFIG.max_pages of the homepage's OWN menu links (the site model's nav_pages from the raw HTML, then Clean Site
// Text's markdown links: same host, max 12 each, with link text)
// to be read beside the homepage: service and section pages first, never the blog, legal, contact, careers or a language copy. One request
// each, no retry — a page that fails is simply skipped (Site Pages). With nothing worth reading the item is { skip: true } and the IF
// "Nav Pages To Read?" sends it straight to Site Pages.
const CONFIG = { max_pages: 5, max_depth: 3, max_text: 60 };
const d = $input.first().json;
// P2-1 (2026-10-12, Phase 2 live check): the menu comes from the SITE MODEL, which reads the raw homepage HTML (<nav> / <header> links,
// SITE_MODEL_SPEC.md §2), not from Clean Site Text's markdown links. On techand.ai the markdown held one /insights/ article link (rightly
// skipped below, so the describer read the homepage alone and "business central partner uae" stayed fit 1), while the model held the real
// 12-entry menu: /capabilities/business-applications, /capabilities/cloud-services, /capabilities/data, /industries#..., /insights.
// Clean Site Text's list is still merged in behind it (a run without a model, or a menu the raw HTML does not expose).
const navOf = (list, inHeader) => (Array.isArray(list) ? list : []).map(p => ({
  url: String((p && p.url) || '').replace(/#.*$/, ''),                      // /industries#bfsi and /industries#retail are one page to read
  text: String((p && (p.text || p.title)) || ''),
  path: String((p && p.path) || String((p && p.url) || '').replace(/^https?:\/\/[^\/?#]*/i, '') || '/').replace(/#.*$/, '') || '/',
  in_header: p && p.in_header != null ? !!p.in_header : inHeader })).filter(p => p.url);
const navModel = (() => { try { const m = $('Site Model').first().json.site_model; return navOf((m || {}).nav_pages, true); } catch (e) { return []; } })();
const navSeenK = new Set();
const navMerged = [...navModel, ...navOf(d.nav_pages, false)].filter(p => {
  const k = p.path.replace(/\/+$/, '').toLowerCase() || '/';
  if (k === '/' || navSeenK.has(k)) return false;
  navSeenK.add(k); return true;
}).slice(0, 24);
// what a service / section page looks like, and what is never one
const SERVICE = /(service|services|what[-_ ]?we[-_ ]?do|whatwedo|solution|solutions|product|products|offering|offerings|expertise|capabilit|industr|platform|technolog|consult|software|module|erp|crm|training|support|pricing|plans)/i;
const ABOUT = /(about|company|who[-_ ]?we[-_ ]?are|our[-_ ]?story|team|approach|method|process|how[-_ ]?we[-_ ]?work)/i;
const SKIP_PATH = /^\/(ar|fr|de|es|ru|zh|hi|ur|tr|it|pt|ja|ko|nl|pl|fa)(\/|$)|(blog|news|insight|article|stor(y|ies)|event|webinar|press|media|career|job|vacanc|privacy|terms|cookie|legal|disclaimer|sitemap|login|sign[-_]?in|sign[-_]?up|register|account|cart|checkout|basket|search|wishlist|\/tag\/|\/category\/|\/author\/|contact|book[-_ ]?a[-_ ]?(demo|call)|download|brochure)/i;
const SKIP_TEXT = /^(blog|news|insights?|careers?|jobs|contact( us)?|privacy|terms|cookies?|login|log in|sign in|sign up|register|search|cart|menu|home|english|arabic|العربية)$/i;
const depth = (p) => String(p || '').split('/').filter(Boolean).length;
const pages = navMerged.filter(p => p && p.url && !SKIP_PATH.test(String(p.path || '')) && !SKIP_TEXT.test(String(p.text || '').trim()) && depth(p.path) <= CONFIG.max_depth);
// a page the menu calls a service beats one the path only hints at; a header link beats a link further down; a shallow path beats a deep one
const score = (p) => (SERVICE.test(String(p.path)) ? 4 : 0) + (SERVICE.test(String(p.text)) ? 3 : 0) + (p.in_header ? 2 : 0)
  + (ABOUT.test(String(p.path)) || ABOUT.test(String(p.text)) ? 1 : 0) - depth(p.path) * 0.1;
const picked = pages.map(p => ({ ...p, score: score(p) })).filter(p => p.score > 0)
  .sort((a, b) => b.score - a.score || depth(a.path) - depth(b.path)).slice(0, CONFIG.max_pages);
return picked.length
  ? picked.map(p => ({ json: { url: p.url, text: String(p.text || '').slice(0, CONFIG.max_text), path: p.path, in_header: !!p.in_header, score: +p.score.toFixed(2), domain: d.domain, nav_source: navModel.length ? 'site model' : 'homepage markdown' } }))
  : [{ json: { skip: true, domain: d.domain, nav_pages_seen: navMerged.length, nav_source: navModel.length ? 'site model' : 'homepage markdown',
      reason: navMerged.length ? 'no service or section page in the menu' : 'no menu links found on the homepage' } }];
