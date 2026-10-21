/*__COMPETITORS__*/
/*__KW_INPUTS__*/
/*__DFS_RETRY__*/
/*__SERP_CACHE__*/
// B2-4 (2026-10-15, benchmark area 2, criterion K7): the rung candidates' results pages, read once, turned into clusters of searches
// Google answers with the SAME pages. Keyword Insights, whose convention this is, compares the TOP 7 at a 40% threshold - "the overlap
// setting was originally 1-10, it now runs from 1-7 because Google no longer reliably shows 10 traditional links" - which is B2-6, and
// which the owner approved on 2026-10-15; `KWI.serpClusters` takes both numbers as options so discovery keeps the shape it was measured
// on. This node also passes the pool item through unchanged, so everything downstream of it is untouched.
//   INVARIANTS rule 1: a keyword whose results page could not be read twice is `not_compared` WITH ITS REASON. It is not clustered, it
// is not scored on, and it is not dropped either - it keeps its own group in the plan, and the plan prints how many could not be
// compared. A cluster built from fewer keywords than were asked for says so (`compared` against `asked`).
const pool = $('Ladder Pool').first().json;
const reqs = (() => { try { return $('Ladder Cluster Requests').all().map(i => i.json); } catch (e) { return []; } })();
const asked = reqs.filter(r => r && r.cluster_check);
const plan0 = reqs[0] || {};
const first = (() => { try { return $('Run Ladder Cluster SERP').all().map(i => i.json); } catch (e) { return []; } })();
const retryItems = (() => { try { return $('Ladder Cluster Retry').all().map(i => i.json).filter(x => x && x.is_retry); } catch (e) { return []; } })();
const retryAnswers = (() => { try { return $('Run Ladder Cluster SERP (Retry)').all().map(i => i.json); } catch (e) { return []; } })();
// KW-SERP (RV-12, 2026-10-21): the keywords whose results page was read earlier today (by any path) were not sent; their reading is used
// as it is, at no cost. `sent` is what went to DataForSEO, in the order of its answers; without the split node every asked keyword was sent.
const lowQ = (q) => String((q || {}).keyword || '').toLowerCase().trim();
const sent = (() => { try { return $('Ladder SERP Cache Split').all().map(i => i.json).filter(r => r && r.cluster_check); } catch (e) { return asked; } })();
const sentAt = new Map(sent.map((q, i) => [lowQ(q), i]));
const cacheRows = (() => { try { return $('Load SERP Cache (Ladder)').all().map(i => i.json).filter(r => r && r.key); } catch (e) { return []; } })();
const hitOf = (q) => (sentAt.has(lowQ(q)) ? null : SC.lookup(cacheRows, { keyword: q.keyword, location_code: q.location_code, language_code: q.language_code || 'en', depth: 30, load_async_ai_overview: true }));

const out = { available: false, asked: asked.filter(r => !r.supporting_check).length, supporting_asked: asked.filter(r => r.supporting_check).length, compared: 0, failed: 0, retried: retryItems.length, retry_answered: 0,
  cap: plan0.cap ?? KWI.CFG.ladder_serp_checks, cap_basis: plan0.cap_basis || '', candidates: plan0.candidates || 0, on_topic: plan0.on_topic || 0,
  left_uncompared: plan0.left_uncompared || 0, price_usd: KWI.CFG.serp_check_usd, cost_usd: 0, cost_basis: '', top_n: 7, min_overlap_pct: 40,
  min_shared_urls: 3, clusters: [], of_keyword: {}, not_compared: [], skip_reason: String(plan0.skip_reason || ''), note: '', read_today: 0, read_today_note: '' };

// KW-COMP (2026-10-21, RV-6): who this ladder competes with, from the results pages the run already bought (the main keyword's own page
// and every rung keyword's page read below): a business that ranks on several of them, weighted by position, the declared ones first;
// job boards, directories, authorities, help subdomains and the rest are passed over with their kind (CMP). Nothing new is bought.
const cmpSerps = [];
const headSerp = (pool.competitors_summary || []).filter(c => c && (c.domain || c.url)).map(c => ({ type: 'organic', domain: c.domain, url: c.url, title: c.title, description: c.snippet, rank_group: Number(c.rank) || null }));
if (headSerp.length) cmpSerps.push({ keyword: String(pool.keyword || ''), items: headSerp });
const ladderCompetitors = () => { const r = CMP.select({ serps: cmpSerps, declared: pool.competitors || ((pool.site_model || {}).competitors) || [], own_domain: pool.domain, n: 5 });
  return { picked: r.picked, excluded: r.excluded.slice(0, 12), too_few: r.too_few.slice(0, 5), serps_read: r.serps_read, min_serps: r.min_serps, note: r.note }; };
if (!asked.length) {
  out.competitors = ladderCompetitors();
  out.cost_basis = 'no results page was bought on this run, so nothing was spent on comparing the rungs';
  out.note = out.skip_reason ? 'The rung keywords were not compared on their results pages: ' + out.skip_reason + '.' : '';
  return [{ json: { ...pool, serp_clusters: out } }];
}

// the two attempts, judged by the one shared rule (R18): a task error inside an HTTP 200 is a failure, whatever its number
const stats = RT.stats(first, {}, retryItems, retryAnswers);
const answers = stats.answers || [];
out.failed = stats.failed; out.retry_answered = stats.retry_answered;

// R28: a task's cost counts once, by its own id - the figure the plan prints is money that moved, never the price it was quoted
const seen = new Set(); let spent = 0; let noId = 0;
for (const a of [...first, ...retryAnswers]) {
  for (const t of (Array.isArray((a || {}).tasks) ? a.tasks : [])) {
    const c = Number((t || {}).cost || 0); if (!c) continue;
    const id = String((t || {}).id || '');
    if (!id) { noId++; spent += c; continue; }
    if (seen.has(id)) continue;
    seen.add(id); spent += c;
  }
}
out.cost_usd = +spent.toFixed(4);
out.tasks = seen.size + noId;
const hits = asked.map(q => hitOf(q)).filter(h => h && h.hit);
out.read_today = hits.length;
out.read_today_note = hits.length ? hits.length + ' results page(s) were ' + hits[0].text + ' and used again at no cost' : '';
out.cost_basis = 'measured: ' + out.tasks + ' results-page call(s) at what each task reported, counted once by task id'
  + (noId ? ' (' + noId + ' with no task id of their own)' : '') + '; the cap for this run was ' + out.cap + ' keyword(s)'
  + (out.cap_basis ? ' - ' + out.cap_basis : '') + (out.read_today ? '; ' + out.read_today_note : '') + '.';

const organicItems = (res) => { try {
  const items = ((((res || {}).tasks || [])[0] || {}).result || [])[0].items || [];
  return items.filter(x => x && x.type === 'organic' && (x.url || x.domain)).sort((a, b) => (Number(a.rank_group) || 99) - (Number(b.rank_group) || 99)).slice(0, 10);
} catch (e) { return []; } };
const organic = (res) => organicItems(res).map(x => String(x.url || x.domain || '')).filter(Boolean);   // the item's own URL; a bare domain is left bare (KWI.urlKey normalises either)

const entries = [];
// F-A1 / A-10: the main page's supporting keywords (asked with `supporting_check`) are read, never clustered with the rungs - they are
// compared with the main keyword's own results page in Ladder Plan, by the same rule (urls_of carries every list at the compared depth)
const supportingEntries = []; out.supporting_not_compared = [];
// F-A1 / A-11: what KIND of page Google ranks for each rung keyword, from the titles and addresses this call already bought (KWI.serpPageTypes)
out.types_of = {}; out.titles_of = {};
asked.forEach((q) => {
  const h = hitOf(q); const i = sentAt.has(lowQ(q)) ? sentAt.get(lowQ(q)) : -1;
  const a = h && h.hit ? h.response : (i >= 0 ? answers[i] : undefined);
  const v = RT.check(a, {});
  const miss = { push: (x) => { if (q.supporting_check) out.supporting_not_compared.push(x); else out.not_compared.push(x); } };
  if (!v.ok) { miss.push({ keyword: q.keyword, reason: v.why || 'no answer', retried: retryItems.some(r => Number(r.retry_of) === i) }); return; }
  const urls = organic(a);
  if (urls.length < KWI.CFG.min_urls) { miss.push({ keyword: q.keyword, reason: 'its results page carried only ' + urls.length + ' ordinary result(s), too few to compare', retried: false }); return; }
  const its = organicItems(a);
  out.types_of[String(q.keyword).toLowerCase()] = (({ read, dominant, dominant_count, dominant_share, counts }) => ({ read, dominant, dominant_count, dominant_share, counts }))(KWI.serpPageTypes(its.slice(0, out.top_n).map(x => ({ url: x.url || x.domain, title: x.title || '' })), {}));
  out.titles_of[String(q.keyword).toLowerCase()] = its.slice(0, 4).map(x => String(x.title || '').replace(/\s+/g, ' ').trim().slice(0, 90)).filter(Boolean);
  (q.supporting_check ? supportingEntries : entries).push({ keyword: q.keyword, urls, weight: Number(q.weight) || 0, volume: q.volume });
  if (String(q.keyword || '').toLowerCase() !== String(pool.keyword || '').toLowerCase()) cmpSerps.push({ keyword: q.keyword, items: its });
});
out.compared = entries.length;
out.competitors = ladderCompetitors();
out.supporting_compared = supportingEntries.length;

const overlap = KWI.serpClusters(entries, { top_n: out.top_n, min_overlap: out.min_overlap_pct / 100 });
out.min_shared_urls = overlap.min_shared_urls;
out.clusters = overlap.clusters;
out.clustered = overlap.clustered;
out.compared_keywords = overlap.compared_keywords || entries.map(e => String(e.keyword).toLowerCase());   // R40: compared BY NAME, so the plan never assumes it
out.urls_of = { ...(overlap.urls_of || {}) };
for (const e of supportingEntries) out.urls_of[String(e.keyword).toLowerCase()] = [...new Set(e.urls.map(KWI.urlKey).filter(Boolean))].slice(0, out.top_n);
for (const cl of overlap.clusters) for (const m of (cl.keywords || []))
  out.of_keyword[m.keyword] = { head_keyword: cl.head_keyword, shared_urls: m.shared_urls, keyword_count: cl.keyword_count, urls_compared: cl.urls_compared,
    ...(m.via ? { via: m.via, shared_with_head: m.shared_with_head } : {}) };
out.available = out.compared >= 2;
out.partial = out.compared > 0 && out.compared < out.asked;
out.note = !out.available
  ? out.compared + ' of the ' + out.asked + ' rung keyword(s) could have their results page read, which is too few to compare, so the rungs are grouped by topic instead.'
  : 'The results pages of ' + out.compared + ' of the ' + out.asked + ' rung keyword(s) were read and compared: searches sharing '
    + out.min_shared_urls + ' of their top ' + out.top_n + ' pages (' + out.min_overlap_pct + '%) are one page, not two'
    + (out.clusters.length ? ' - ' + out.clusters.length + ' group(s) covering ' + out.clustered + ' keyword(s)' : ' - no two of them share one')
    + '. ' + out.cost_basis;
if (out.supporting_compared || out.supporting_not_compared.length) out.note += ' ' + out.supporting_compared + ' supporting keyword(s) the verdict proposed for the main page were read as well'
  + (out.supporting_not_compared.length ? ' (' + out.supporting_not_compared.length + ' could not be)' : '') + ', so each one is kept on the main page only if Google answers it with the main keyword\'s own pages.';
if (out.not_compared.length) out.note += ' ' + out.not_compared.length + ' keyword(s) could not be compared and were left in their own group: '
  + out.not_compared.slice(0, 5).map(x => '"' + x.keyword + '" (' + x.reason + ')').join(', ') + (out.not_compared.length > 5 ? ' …' : '') + '.';
return [{ json: { ...pool, serp_clusters: out } }];
