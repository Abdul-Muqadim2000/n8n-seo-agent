/*__CRITIC_REREAD__*/
// W0-H (2026-10-29, page-quality PLAN Fix 3b; build section 158): the request for the blind second read of the page the client receives
// (RR.plan, v5/code/_critic_reread.js), or why there is none. Runs once, after Page Candidates delivered the page (Finalize Page? said
// "deliver"); the delivered item passes through unchanged with `second_read` added. What the reader gets: the page, the keyword, the
// website's own live pages, the facts on file, the sources this run verified and the regulatory digest. Never the first-draft review,
// the edit history or our grade.
const it = $input.first().json || {};
let prev = {}; try { prev = $('Parse Brief').first().json || {}; } catch (e) { prev = {}; }
let ip = ''; try { ip = String(($('Normalize Input').first().json || {}).client_ip || ''); } catch (e) { ip = ''; }
let reg = ''; try { const r = $('Collect Regulatory Facts').first().json.regulatory; if (r && typeof r.digest === 'string') reg = r.digest; } catch (e) { reg = ''; }
if (!reg) reg = String(((prev.regulatory || {}).digest) || '');
const second_read = RR.plan(it, { ...prev, client_ip: prev.client_ip || ip }, { regulatory_digest: reg });
return [{ json: { ...it, second_read } }];
