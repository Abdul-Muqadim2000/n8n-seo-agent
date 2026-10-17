/*__SITE_MODEL__*/
/*__FIT_GATE__*/
/*__OWN_COVER__*/
// A-5 / A-23 (2026-10-17, re-rating execs 760 / 765): what the site already holds on this keyword's topic, read ONCE before the verdict.
// The keyword report "erp system dubai" told the owner to build a Dynamics 365 Business Central / Finance & Operations service page beside
// the two live pages for exactly that, and the verdict "e invoicing software uae" folded five planned pages of the site's own ladder into
// the page it said to improve - the keyword path had never loaded the site's ladders or drafts. This node does, after *Prepare Keyword
// Run*: the ladders (read back through the fit gate, archived ladders and set-aside rungs out, each with the ladder's own status), the
// content log's unpublished drafts and the inventory pages on the topic (SM.pageScore), and hands them on as `own_coverage` (Parse Verdict
// checks the advice against it) and `own_coverage_text` (the Verdict Agent reads it). It never stops the run: a load that failed is "not
// read" and the advice is then unchecked, which the verdict says.
const item = $('Prepare Keyword Run').first().json;
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return null; } };
const ladRows = rowsOf('Load Ladders (Run)'), setRows = rowsOf('Load Ladder Settings (Run)'), logRows = rowsOf('Load Drafts (Run)');
const kw = String(item.keyword || '');
const fitCtx = { own_domain: item.domain || '', competitors: (Array.isArray(item.competitors) ? item.competitors : []).map(String), protect: [kw, String(item.ladder_head || '')] };
// INVARIANTS rule 2: a stored rung is read back through the gate it was written through (a competitor brand stays out of "your ladder")
const ladders = OWN.ladders((ladRows || []).filter(r => fitStored(r, { ...fitCtx, protect: [...fitCtx.protect, String(r.head_keyword || '')] }).ok), setRows || [], { domain: item.domain || '' });
const drafts = OWN.drafts(logRows || [], { domain: item.domain || '' });
const model = item.site_model && typeof item.site_model === 'object' ? item.site_model : null;
const pages = !model || !kw ? [] : SM.pages(model).filter(p => !SM.isListing(p.url)).map(p => ({ url: SM.canonUrl(model, p.url), title: String(p.title || p.h1 || '').replace(/\s*[|–—-]\s*[^|–—-]{1,24}$/, '').trim(), score: SM.pageScore(p, kw) }))
  .filter(p => p.score != null && p.score >= 0.5).sort((a, b) => b.score - a.score).slice(0, 8);
const own_coverage = { read: { ladders: ladRows !== null, drafts: logRows !== null, pages: !!model }, ladders, drafts, pages,
  self: { ladder_id: String(item.ladder_id || ''), keyword: kw, target_url: String(item.ladder_target_url || '') } };
return [{ json: { ...item, own_coverage, own_coverage_text: OWN.text(own_coverage, kw) } }];
