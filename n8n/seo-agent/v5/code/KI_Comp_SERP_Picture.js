// Comp SERP Picture (E2, DESIGN.md §2.2-§2.3): who ranks on the seeds' results pages, read from the day cache and this run's answers, every
// organic item through SU (live results now come back as google.com/goto redirects: the host is recovered from the breadcrumb, R5 §13 L-1).
// A seed whose page could not be read twice is `missing` with its reason, never "nobody ranks".
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
let cacheRows = []; try { cacheRows = $('Load SERP Cache (KI Comp)').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cacheRows = []; }
// IF-BRANCH (2026-11-09, first Trial run on production): this node hangs on the IF's FALSE output, so a bare .all() returned that empty
// branch inside n8n (it defaults to the connected output) and every answered search read as "nothing was asked". Branch 0 = the requests sent.
let reqItems = []; try { reqItems = $('Any Comp SERPs?').all(0).map(i => i.json).filter(r => r && !r.skip); } catch (e) { reqItems = []; }
let answers = []; try { answers = $('Run Comp SERPs Answers').all().map(i => i.json); } catch (e) { answers = []; }
const m = { location_code: p.location_code, language_code: p.language_code };
const R = KIW.serpReadings((p.seeds || []).map(s => s.keyword), m, cacheRows, reqItems, answers, p.site_id, p.now, { own_domain: p.domain, services: p.services });
const hosts = KIW.hostsOf(R.by, p.canonical_host || p.domain);
const st = KIW.callState(R.pairs, 'the results pages of your service searches');
const state = !R.read ? (R.pairs.length ? 'missing' : 'missing') : (R.missing ? 'partial' : 'ok');
const reason = !R.read ? (R.pairs.length ? st.reason : 'no results page could be read for any seed') : (R.missing ? R.missing + ' of ' + (R.read + R.missing) + ' results pages could not be read: ' + (Object.values(R.by).find(r => r.source === 'missing') || {}).why : '');
const unresolved = Object.values(R.by).reduce((s, r) => s + (r.top10 || []).filter(t => !t.host).length, 0);
return [{ json: { by: R.by, hosts, serp_cache_rows: R.save, read: R.read, missing: R.missing, live: R.pairs.length, unresolved,
  section: { key: 'serp', state, reason, rows: R.read }, __dfs_unavailable: !R.read } }];
