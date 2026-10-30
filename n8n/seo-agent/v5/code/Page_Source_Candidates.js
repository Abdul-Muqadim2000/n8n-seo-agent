/*__SOURCES__*/
/*__PAGE_FIX__*/
// H1 (2026-10-27): the pages worth fetching for each research task of *Page Source Plan*, read from the search answers (*Search Page
// Sources*, one SearXNG answer per task, in the same order). Never the client's own site (a fact about the world is not sourced from the
// business), never a competitor that ranks for this search, never a social or forum page. An official, research, press or vendor
// documentation page first (SRC.tier); a weak page only when a task has nothing better, and then one. At most 3 pages a task, 12 a round.
const tasks = $('Page Source Plan').all().map(i => i.json || {}).filter(t => !t.skip);
const resps = $input.all().map(i => i.json || {});
const prev = $('Parse Brief').first().json || {};
const own = String(prev.domain || '').toLowerCase().replace(/^www\./, '');
const rivals = new Set((prev.competitors || []).map(c => (c && PF.hostOf(c.url)) || String((c && c.domain) || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]).filter(Boolean));
const SOCIAL = /(^|\.)(linkedin|facebook|instagram|twitter|x|youtube|tiktok|reddit|quora|pinterest|medium|slideshare|scribd)\.com$/i;
const out = []; const seen = new Set();
tasks.forEach((t, i) => {
  const r = resps[i] || {};
  const results = Array.isArray(r.results) ? r.results : [];
  const ok = results.map(x => ({ url: SRC.clean(String((x && x.url) || '')), title: String((x && x.title) || ''), snippet: String((x && x.content) || '') }))   // FU-SV: a redirect is read as its target
    .filter(x => /^https?:\/\//i.test(x.url) && !SRC.isRedirect(x.url)).map(x => ({ ...x, host: PF.hostOf(x.url), tier: SRC.tier(x.url) }))
    .filter(x => x.host && !(own && (x.host === own || x.host.endsWith('.' + own))) && !rivals.has(x.host) && !SOCIAL.test(x.host) && !/\.pdf($|\?)/i.test(x.url));
  const strong = ok.filter(x => x.tier !== 'weak'); const pick = (strong.length ? strong : ok.slice(0, 1)).slice(0, 3);
  for (const x of pick) { const k = PF.keyOf(x.url); if (seen.has(k) || out.length >= 12) continue; seen.add(k);
    out.push({ task_id: t.id, round: t.round, url: SRC.clean(x.url), host: x.host, tier: x.tier, title: x.title.slice(0, 160), snippet: x.snippet.slice(0, 300) }); }
});
if (!out.length) return [{ json: { skip: true, round: tasks.length ? tasks[0].round : null, reason: 'the searches found no page worth reading' } }];
return out.map(x => ({ json: x }));
