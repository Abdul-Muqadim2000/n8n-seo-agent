// ---- results-page observations (2026-10-11, FIX_PLAN D26): an AI Overview (and every other SERP feature) is what ONE Google query showed at
// ONE moment — live, the ladder plan said "no AI Overview" and the page run minutes later "cites 11 domains". Inlined by the build
// (the SERP_OBS placeholder) into Analyze Competitor Pages (the digest the verdict reads), Build Keyword Strategy (stored vs live checks) and Build
// Ladder Report; the keyword report's row is patched by build_v4.py. Every text says WHEN it was seen ("seen in the check at 15:58 UTC on
// 2026-10-11") or "seen in N of M checks", and that AI Overviews vary between searches — never "there is no AI Overview".
// the time of a DataForSEO SERP answer (result datetime "2026-10-11 15:58:12 +00:00", else the task time, else now) as ISO
const serpSeenAt = (res) => {
  try {
    const t0 = ((res || {}).tasks || [])[0] || {}; const r0 = (t0.result || [])[0] || {};
    const raw = String(r0.datetime || t0.time || r0.check_url_time || '');
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(?:Z|([+-]\d{2}):?(\d{2}))?/);
    if (m) { const d = new Date(m[1] + 'T' + m[2] + ':' + (m[3] || '00') + (m[4] ? m[4] + ':' + m[5] : 'Z')); if (!isNaN(d.getTime())) return d.toISOString(); }
  } catch (e) {}
  return new Date().toISOString();
};
// "15:58 UTC on 2026-10-11"
const obsClock = (iso) => { const d = iso ? new Date(iso) : null; if (!d || isNaN(d.getTime())) return 'an unknown time'; const z = d.toISOString(); return z.slice(11, 16) + ' UTC on ' + z.slice(0, 10); };
// obs: [{ seen: true | false | null, at: iso, source }] -> { count, seen, text }; null = that check could not read the results page (not counted)
const aioObserved = (obs) => {
  const known = (obs || []).filter(o => o && o.seen != null);
  if (!known.length) return { count: 0, seen: 0, text: 'unknown — the results page could not be read' };
  const seen = known.filter(o => o.seen);
  const one = (o) => (o.seen ? 'seen' : 'not seen') + ' in the check at ' + obsClock(o.at) + (o.source ? ' (' + o.source + ')' : '');
  if (known.length === 1) return { count: 1, seen: seen.length, text: one(known[0]) + ' — AI Overviews vary between searches, so this is one observation, not a fixed feature of the query' };
  return { count: known.length, seen: seen.length, text: 'seen in ' + seen.length + ' of ' + known.length + ' checks (' + known.map(one).join('; ') + ') — AI Overviews vary between searches' };
};
// ---- what one rank check's results page showed (G6, 2026-10-12, system review FIX_PLAN) ----
// Every rank check already pays for one SERP call. Until now we kept three things from it: our position, our ranking URL and a
// comma-joined list of item types. The leaders (Semrush Position Tracking, Ahrefs Rank Tracker, AccuRanker, SE Ranking) keep the
// whole page: the AI Overview (shown, and whether it cites us), the featured snippet, People Also Ask, the local pack, video and
// shopping blocks, the other domains on page 1 with their positions, a share of voice, and a stored snapshot as proof of the reading
// (criteria 2.2, 2.5, 2.6, 2.13 of CRITERIA_technical_tracking_reporting_ai_links.md). This kit reads all of it from the answer we
// already have, so the depth-50 check costs exactly what it cost before.
// Rules it keeps:
//   * a call that failed is never turned into a fact: `unavailable` is set and every flag is null — "check again", like position -1,
//     never "no AI Overview" / "does not rank" (the live lesson of 2026-10-09 and D26);
//   * an AI Overview Google loads asynchronously comes back without its sources unless we pay extra for them, so "cites us" is then
//     null (unknown), never false;
//   * the share of voice is a MODEL built on a published CTR curve, not measured clicks, and says so in `method`.
// Needs serpSeenAt / aioObserved from _serp_obs.js, which the build inlines above it.
const RS = (() => {
  // the same CTR-by-position curve the Search Console report uses (v5/code/Parse_GSC.js EXPECTED_CTR): industry averages, a model
  const CTR = [0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.035, 0.03, 0.025];
  const SUM_CTR = CTR.reduce((s, x) => s + x, 0);
  // B6-1 (2026-10-15, benchmark area 6 — docs/system-review-2026-10-14/BENCH_AREA6_rank_tracking.md): the AI Overview factor here
  // was 0.65, a flat 35% loss, taken from Ahrefs' MARCH 2025 study. The current study — same publisher, 300,000 keywords, December
  // 2025 data, published 2026-02-04 (https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) — measures the loss POSITION BY
  // POSITION, and it is both larger and very uneven: 58.0% of the clicks gone at #1, 50.8% at #2, 46.4% at #3 … 19.4% at #10. A
  // flat factor is wrong twice over: it understated the loss by about half, and because it hit every position equally it almost
  // cancelled out of a share, so an AI Overview cost the top of page 1 nothing in our numbers. The same correction was made to the
  // keyword research's click-loss model on 2026-10-15 (B1-3, `_kw_inputs.js`) and this is the other place the old figure lived.
  // AIO_KEEP[p - 1] = the share of its clicks position p KEEPS when an AI Overview is on the page (1 - the measured loss).
  const AIO_KEEP = [0.420, 0.492, 0.536, 0.612, 0.674, 0.695, 0.703, 0.712, 0.703, 0.806];
  const AIO_SOURCE = 'Ahrefs, 300,000 keywords, December 2025 data (published 2026-02-04)';
  const keepAt = (p, aio) => { if (!aio) return 1; const i = Math.max(1, Number(p) || 1) - 1; return AIO_KEEP[i] == null ? AIO_KEEP[AIO_KEEP.length - 1] : AIO_KEEP[i]; };
  const SNIPPET_BONUS = 0.10;
  const METHOD = 'modelled: clicks by position from a published CTR curve (28/15/11/8/7/5/4/3.5/3/2.5%); when an AI Overview is shown each position keeps only what was measured for it (58.0% of the clicks gone at #1, 50.8% at #2, 46.4% at #3, 19.4% at #10 — ' + AIO_SOURCE + ', https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) and what the overview takes is shared between the pages it cites; +0.10 for the featured snippet, which is a stated rule with no measurement behind it. Not measured clicks.';
  const S = (v) => String(v == null ? '' : v).trim();
  const bare = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
  const hostOf = (u) => bare((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');   // the n8n Code sandbox has no URL constructor
  const isOurs = (d, our) => !!d && !!our && (d === our || d.endsWith('.' + our));
  const listOf = (v) => [...new Set((Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(x => bare(x)).filter(Boolean))];
  const weight = (p) => (p >= 1 && p <= CTR.length) ? CTR[p - 1] : 0;
  const r1 = (x) => Math.round(x * 10) / 10;

  // one SERP answer -> { ok, error, seen_at, items, results_count }. A DataForSEO task error inside an HTTP 200 counts as failed.
  const read = (res) => {
    const r = res || {}; const t0 = (Array.isArray(r.tasks) ? r.tasks[0] : null) || {};
    let error = '';
    if (r.error || Number(r.status_code) >= 40000 || !Array.isArray(r.tasks) || Number(t0.status_code) >= 40000)
      error = S((r.error && (r.error.message || r.error)) || t0.status_message || r.status_message || 'no answer').slice(0, 120);
    const result = (t0.result || [])[0] || {};
    return { ok: !error, error, seen_at: serpSeenAt(r), items: Array.isArray(result.items) ? result.items : [],
      results_count: result.se_results_count == null ? null : Number(result.se_results_count) };
  };

  const unknownFeatures = (a) => ({ unavailable: true, error: (a && a.error) || 'no answer', checked_at: null, types: [], results_count: null,
    ai_overview: { shown: null, cites_us: null, content_loaded: false, cited_domains: [], seen_at: null },
    featured_snippet: { shown: null, ours: null, domain: '' }, people_also_ask: { shown: null, count: 0, questions: [] },
    local_pack: { shown: null, ours: null }, video: { shown: null }, shopping: { shown: null } });

  // the features the page showed, from the same answer
  const features = (a, ourDomain) => {
    if (!a || !a.ok) return unknownFeatures(a);
    const our = bare(ourDomain);
    const types = [...new Set(a.items.map(x => S(x && x.type)))].filter(Boolean);
    const has = (...t) => t.some(x => types.includes(x));
    const aioItem = a.items.find(x => x && x.type === 'ai_overview') || null;
    let refs = []; let texts = 0;
    if (aioItem) {
      ((aioItem.references) || []).forEach(r => refs.push(bare(r && r.domain) || hostOf(r && r.url)));
      ((aioItem.items) || []).forEach(x => {
        if (x && (x.text || x.title || x.markdown)) texts++;
        (((x || {}).references) || []).forEach(r => refs.push(bare(r && r.domain) || hostOf(r && r.url)));
        (((x || {}).links) || []).forEach(l => refs.push(hostOf(l && l.url)));
      });
      refs = [...new Set(refs.filter(Boolean))];
    }
    // Google loads some AI Overviews asynchronously: the item is there, its sources are not (loading them costs extra, so we do not).
    const sourcesUnknown = !!aioItem && (aioItem.asynchronous_ai_overview === true || (!refs.length && !texts));
    const fs = a.items.find(x => x && x.type === 'featured_snippet') || null;
    const fsDom = fs ? (bare(fs.domain) || hostOf(fs.url)) : '';
    const paaItem = a.items.find(x => x && x.type === 'people_also_ask') || null;
    const paa = paaItem ? ((paaItem.items) || []).map(q => S(q && (q.title || q.question))).filter(Boolean) : [];
    const lp = a.items.find(x => x && (x.type === 'local_pack' || x.type === 'map')) || null;
    const lpOurs = lp ? [...((lp.items) || []), lp].some(x => isOurs(bare(x && x.domain) || hostOf(x && x.url), our)) : null;
    return { unavailable: false, error: '', checked_at: a.seen_at, types, results_count: a.results_count,
      ai_overview: { shown: !!aioItem, content_loaded: !!aioItem && !sourcesUnknown,
        cites_us: !aioItem ? false : (sourcesUnknown ? null : refs.some(d => isOurs(d, our))),
        cited_domains: refs.slice(0, 12), seen_at: a.seen_at },
      featured_snippet: { shown: !!fs, ours: fs ? isOurs(fsDom, our) : false, domain: fsDom },
      people_also_ask: { shown: !!paaItem, count: paa.length, questions: paa.slice(0, 6) },
      local_pack: { shown: !!lp, ours: lpOurs }, video: { shown: has('video', 'short_videos') },
      shopping: { shown: has('shopping', 'popular_products') } };
  };

  // the comma list the serp_features column has always held (kept so nothing that reads it changes)
  const typeList = (a) => (!a || !a.ok) ? '' : [...new Set(a.items.map(x => S(x && x.type)))].filter(t => t && t !== 'organic').join(',');

  // our position over the whole depth that was bought (0 = not in it, so the caller can tell it from "the check failed")
  const ourRank = (a, ourDomain) => {
    if (!a || !a.ok) return { position: -1, url: '' };
    const our = bare(ourDomain);
    const mine = a.items.filter(x => x && x.type === 'organic').find(o => isOurs(bare(o.domain) || hostOf(o.url), our));
    return mine ? { position: Number(mine.rank_group) || 0, url: S(mine.url) } : { position: 0, url: '' };
  };

  // page 1: one row per domain (the best position it holds), plus every tracked competitor's best position over the whole answer
  const landscape = (a, ourDomain, competitorList, ourPosition) => {
    const our = bare(ourDomain);
    const comps = listOf(competitorList).filter(d => d && !isOurs(d, our));
    if (!a || !a.ok) return { unavailable: true, top: [], above: [], own: [], competitors: comps.map(domain => ({ domain, position: null, tracked: true })), tracked: comps };
    const organic = a.items.filter(x => x && x.type === 'organic').map((o, i) => ({
      position: Number(o.rank_group) || i + 1, domain: bare(o.domain) || hostOf(o.url), url: S(o.url), title: S(o.title).slice(0, 110) }))
      .filter(o => o.domain);
    const best = new Map();
    for (const o of organic) { const prev = best.get(o.domain); if (!prev || o.position < prev.position) best.set(o.domain, o); }
    const top = [...best.values()].filter(o => o.position >= 1 && o.position <= 10).sort((x, y) => x.position - y.position)
      .map(o => ({ ...o, ours: isOurs(o.domain, our) }));
    const mine = Number(ourPosition) > 0 ? Number(ourPosition) : null;
    const above = top.filter(t => !t.ours && (mine == null || t.position < mine)).map(t => ({ domain: t.domain, position: t.position, url: t.url, tracked: comps.includes(t.domain) }));
    const competitors = comps.map(domain => { const hit = best.get(domain) || [...best.entries()].filter(([d]) => d.endsWith('.' + domain)).map(([, v]) => v)[0];
      return { domain, position: hit ? hit.position : null, url: hit ? hit.url : '', tracked: true }; });
    // domains on page 1 that nobody named as a competitor but outrank us every week are worth naming too
    for (const t of top) if (!t.ours && !comps.includes(t.domain) && competitors.length < 20) competitors.push({ domain: t.domain, position: t.position, url: t.url, tracked: false });
    // B6-6 (2026-10-16, benchmark area 6): EVERY result of ours over the whole depth bought, not only the best one. `top` keeps one row
    // per domain (the best position it holds), so a second page of the site on the same results page was thrown away before it was
    // stored, and cannibalisation (two of our own URLs answering one search) could never be seen in the snapshot we keep.
    const own = organic.filter(o => isOurs(o.domain, our)).sort((x, y) => x.position - y.position).map(o => ({ position: o.position, url: o.url }))
      .filter((o, i, arr) => arr.findIndex(x => urlKey(x.url) === urlKey(o.url)) === i);
    return { unavailable: false, top, above, own, competitors, tracked: comps };
  };

  // CTR- and feature-weighted share of voice over page 1 (a model: see METHOD)
  const voice = (land, feats, ourDomain, ourPosition) => {
    const our = bare(ourDomain);
    if (!land || land.unavailable || !feats || feats.unavailable) return { ours: null, shares: [], method: METHOD, unavailable: true, aio_sources_unknown: false };
    const aio = feats.ai_overview.shown === true;
    const sourcesUnknown = aio && !feats.ai_overview.content_loaded;
    const cited = aio && !sourcesUnknown ? (feats.ai_overview.cited_domains || []) : [];
    const snipDom = feats.featured_snippet.shown ? feats.featured_snippet.domain : '';
    const w = new Map();
    const add = (d, v) => { if (!d || !(v > 0)) return; w.set(d, (w.get(d) || 0) + v); };
    // B6-1: every position keeps what was measured FOR THAT POSITION, and what it loses is what the overview took
    for (const t of land.top) add(t.domain, weight(t.position) * keepAt(t.position, aio));
    let aioPool = 0;
    if (aio) for (let p = 1; p <= CTR.length; p++) aioPool += CTR[p - 1] * (1 - keepAt(p, true));
    if (snipDom) { const k = keepAt(1, aio); add(snipDom, SNIPPET_BONUS * k); aioPool += SNIPPET_BONUS * (1 - k); }
    if (cited.length) { const each = aioPool / cited.length; for (const d of cited) add(d, each); }
    // the clicks the AI Overview keeps when we do not know which pages it cites belong to nobody on the page: they stay in the
    // denominator, so everyone's share drops (without this the loss would cancel out and an AI Overview would cost nothing)
    const unattributed = (aio && !cited.length) ? aioPool : 0;
    const total = [...w.values()].reduce((s, x) => s + x, 0) + unattributed;
    if (!(total > 0)) return { ours: 0, shares: [], method: METHOD, unavailable: false, aio_sources_unknown: sourcesUnknown };
    const shares = [...w.entries()].map(([domain, v]) => ({ domain, pct: r1(v / total * 100), ours: isOurs(domain, our) })).sort((x, y) => y.pct - x.pct);
    const mineRow = shares.find(x => x.ours);
    return { ours: mineRow ? mineRow.pct : 0, shares: shares.slice(0, 12), method: METHOD, unavailable: false,
      aio_sources_unknown: sourcesUnknown, our_position: Number(ourPosition) > 0 ? Number(ourPosition) : null };
  };

  // the proof we keep of the reading: the top 10 with their URLs and trimmed titles, the features seen, and when
  const snapshot = (a, land, feats, device) => ({ at: (a && a.seen_at) || null, device: device || 'desktop',
    results: (a && a.results_count) || null, unavailable: !a || !a.ok, error: a && a.ok ? '' : ((a && a.error) || 'no answer'),
    features: feats && !feats.unavailable ? (feats.types || []).filter(t => t !== 'organic').slice(0, 12) : [],
    top: ((land && land.top) || []).map(t => ({ p: t.position, u: S(t.url).slice(0, 180), t: S(t.title).slice(0, 80) })),
    // B6-6: how many of OUR pages the answer held (any depth), and, only when there are two or more, which ones. `own_n` missing = a
    // reading stored before this was kept, which can say nothing about a second page either way.
    ...(land && !land.unavailable && Array.isArray(land.own) ? { own_n: land.own.length } : {}),
    ...(land && !land.unavailable && Array.isArray(land.own) && land.own.length >= 2 ? { own: land.own.slice(0, 3).map(o => ({ p: o.position, u: S(o.url).slice(0, 140) })) } : {}) });

  // a JSON string that stays small: titles go first, then the tail of the list (a snapshot is proof, not an archive)
  const pack = (obj, max) => {
    const limit = Number(max) || 1800;
    let s = JSON.stringify(obj || null);
    if (s.length <= limit) return s;
    const o = JSON.parse(s);
    if (Array.isArray(o.top)) { o.top = o.top.map(t => ({ p: t.p, u: t.u })); o.trimmed = 'titles'; }
    s = JSON.stringify(o);
    if (s.length > limit && Array.isArray(o.own) && o.own.length > 2) { o.own = o.own.slice(0, 2); o.trimmed = (o.trimmed ? o.trimmed + '+' : '') + 'own'; s = JSON.stringify(o); }   // B6-6: two pages are enough to show cannibalisation
    while (s.length > limit && Array.isArray(o.top) && o.top.length > 1) { o.top.pop(); o.trimmed = 'titles+tail'; s = JSON.stringify(o); }
    // B6-7 (2026-10-15, benchmark area 6): found while giving the customer's own keywords the same depth a rung gets. A column with
    // no `top` to trim was cut mid-string — `competitors_json` on any results page with a full top ten and a long method sentence —
    // and a sliced JSON string is not JSON, so RS.unpack handed back the default and the WHOLE reading vanished: the "Above you"
    // column was empty, and nothing anywhere said a thing had been dropped (INVARIANTS rule 1). Nothing is sliced now. The method
    // sentence goes first (it is a constant every reader already falls back to), then the tails of the lists, longest first, and the
    // last resort is a small VALID object that says the reading was too long to store.
    const cut = new Set(String(o.trimmed || '').split('+').filter(Boolean));
    if (s.length > limit && typeof o.method === 'string') { delete o.method; cut.add('method'); o.trimmed = [...cut].join('+'); s = JSON.stringify(o); }
    const lists = Object.keys(o).filter(k => k !== 'top' && Array.isArray(o[k]));
    while (s.length > limit && lists.some(k => o[k].length)) {
      const k = lists.filter(x => o[x].length).sort((a, b) => o[b].length - o[a].length)[0];
      o[k].pop(); cut.add('lists'); o.trimmed = [...cut].join('+'); s = JSON.stringify(o);
    }
    return s.length <= limit ? s : JSON.stringify({ trimmed: 'overflow', note: 'this reading was too long to store in one column' });
  };
  const unpack = (v, dflt) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? dflt : o; } catch (e) { return dflt; } };

  // one line a person can read, in the observation form D26 asks for (an AI Overview is what one search showed at one moment)
  const featureLine = (feats, obs) => {
    if (!feats || feats.unavailable) return 'Results page: could not be read in this check (' + ((feats && feats.error) || 'no answer') + ') — nothing about the page is claimed.';
    const parts = ['AI Overview ' + aioObserved(obs && obs.length ? obs : [{ seen: feats.ai_overview.shown, at: feats.ai_overview.seen_at, source: 'rank check' }]).text];
    if (feats.ai_overview.shown) parts.push(feats.ai_overview.cites_us === null ? 'whether it cites you was not loaded (loading an AI Overview\'s sources costs extra, so we do not buy it)'
      : feats.ai_overview.cites_us ? 'it cited your site in that check' : 'it did not cite your site in that check'
        + (feats.ai_overview.cited_domains.length ? ' (it cited ' + feats.ai_overview.cited_domains.slice(0, 5).join(', ') + ')' : ''));
    if (feats.featured_snippet.shown) parts.push(feats.featured_snippet.ours ? 'you hold the featured snippet' : 'featured snippet held by ' + (feats.featured_snippet.domain || 'another site'));
    if (feats.people_also_ask.shown) parts.push('People Also Ask with ' + feats.people_also_ask.count + ' question' + (feats.people_also_ask.count === 1 ? '' : 's'));
    if (feats.local_pack.shown) parts.push(feats.local_pack.ours ? 'local pack, your listing in it' : 'local pack');
    if (feats.video.shown) parts.push('video results');
    if (feats.shopping.shown) parts.push('shopping results');
    return parts.join('; ') + '.';
  };
  // the short labels the e-mail and the app show
  const featureChips = (feats) => {
    if (!feats || feats.unavailable) return ['not read'];
    const c = [];
    if (feats.ai_overview.shown) c.push('AI Overview' + (feats.ai_overview.cites_us === true ? ' (cites you)' : feats.ai_overview.cites_us === null ? ' (sources not loaded)' : ''));
    if (feats.featured_snippet.shown) c.push('Snippet' + (feats.featured_snippet.ours ? ' (yours)' : ''));
    if (feats.people_also_ask.shown) c.push('PAA');
    if (feats.local_pack.shown) c.push('Local pack' + (feats.local_pack.ours ? ' (yours)' : ''));
    if (feats.video.shown) c.push('Video');
    if (feats.shopping.shown) c.push('Shopping');
    return c;
  };

  // ---- B6-2 (2026-10-15, benchmark area 6): HOW MUCH THE RESULTS PAGE ITSELF MOVED, AND WHAT A DROP THEREFORE MEANS ----
  // The question the rank trackers are judged on is what they do on a volatile day. The leaders answer it with a MARKET-WIDE index
  // computed on somebody else's keywords — Semrush's Sensor is "SERP volatility on a scale of 0-10" over a fixed keyword set
  // (https://www.semrush.com/kb/652-sensor), AccuRanker's Google Grump "calculates the average number of rank changes across the top
  // 30 results for ~1,000,000 high-volume keywords" (https://accuranker.com/grump). Neither tells the owner whether THEIR results
  // page moved, and ours said nothing at all: a fall of seven places read exactly the same whether our page had slipped or the whole
  // page had been rewritten under it.
  // We already store the proof we need: `snapshot_json` keeps the top 10 with their URLs for every reading (criterion 2.2). Comparing
  // this reading with the previous one for the SAME keyword and the SAME device is a measurement of the page's own movement, free,
  // and specific to the keyword instead of to a market. What is measured: how many places changed occupant, how many URLs left and
  // entered, and how far the URLs present in both readings moved. What is NOT measured is the three labels (still / some / high):
  // nobody publishes a per-keyword threshold, so they are a STATED RULE and say so.
  // Rules it keeps: a missing or unreadable snapshot gives `available: false` with the reason — never a quiet 0, which would read as
  // "the page did not move"; two readings on different devices are not comparable; `RS.pack` can trim a long snapshot's tail, so the
  // comparison only runs over the depth BOTH readings kept and reports that depth.
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const CHURN = { still_pct: 20, high_pct: 50, min_depth: 5, stale_days: 10,
    labels_basis: 'the still / some / high labels are a stated rule, not a measurement: no tool publishes a per-keyword threshold' };
  const churnNone = (reason) => ({ available: false, reason: S(reason) || 'not available', basis: 'not available', measured: false,
    depth: 0, changed: null, changed_pct: null, entered: null, gone: null, moved: null, mean_move: null, mean_move_others: null, depth_others: 0, changed_others: null, changed_others_pct: null, band_others: null, band: null,
    from: null, to: null, device: '', labels_basis: CHURN.labels_basis });
  const snapOf = (v) => { const x = (v && typeof v === 'object' && !Array.isArray(v)) ? v : unpack(v, null);
    if (!x || x.unavailable) return null;
    const top = (Array.isArray(x.top) ? x.top : []).map(e => ({ p: Number(e && e.p) || 0, k: urlKey(e && e.u) })).filter(e => e.p > 0 && e.k);
    return top.length ? { top, at: x.at || null, device: S(x.device) || 'desktop', trimmed: S(x.trimmed) } : null; };
  // prev / cur: a stored snapshot (the packed string or the object). o: { min_depth }
  const churn = (prev, cur, o) => {
    const c = { ...CHURN, ...(o || {}) };
    const A = snapOf(prev), B = snapOf(cur);
    if (!B) return churnNone('this check could not read the results page, so nothing can be compared');
    if (!A) return churnNone('no earlier reading of this results page is stored, so how much it moved cannot be told yet');
    if (A.device !== B.device) return churnNone('the two readings are of different devices (' + A.device + ' and ' + B.device + ')');
    const depth = Math.min(A.top.length, B.top.length, CTR.length);
    if (depth < c.min_depth) return churnNone('only ' + depth + ' result' + (depth === 1 ? '' : 's') + ' were kept in both readings, too few to compare');
    const a = A.top.filter(e => e.p <= depth), b = B.top.filter(e => e.p <= depth);
    const aAt = new Map(a.map(e => [e.p, e.k])), bAt = new Map(b.map(e => [e.p, e.k]));
    const aPos = new Map(a.map(e => [e.k, e.p]));
    let changed = 0;
    for (let p = 1; p <= depth; p++) if ((aAt.get(p) || '') !== (bAt.get(p) || '')) changed++;
    const gone = a.filter(e => !b.some(x => x.k === e.k)).length;
    const entered = b.filter(e => !aPos.has(e.k)).length;
    const moves = b.filter(e => aPos.has(e.k)).map(e => Math.abs(e.p - aPos.get(e.k)));
    // B6-8: the page WITHOUT us. Our own fall of five places inside the top ten shifts five other results by one place each, so `changed`
    // above counts our move as the page's churn (six of ten places, "high", every time). With `o.own` the other results are re-ranked
    // among themselves in both readings and compared: how many of their places changed, and how far they moved relative to each other.
    const ownD = bare(c.own || '');
    const notOurs = (e) => !(ownD && isOurs(bare(e.k.split('/')[0]), ownD));
    const aO = a.filter(notOurs).map((e, i) => ({ k: e.k, p: i + 1 })), bO = b.filter(notOurs).map((e, i) => ({ k: e.k, p: i + 1 }));
    const depthO = Math.min(aO.length, bO.length);
    const aOPos = new Map(aO.map(e => [e.k, e.p]));
    let changedO = 0; for (let p = 1; p <= depthO; p++) if (aO[p - 1].k !== bO[p - 1].k) changedO++;
    const movesO = bO.filter(e => aOPos.has(e.k)).map(e => Math.abs(e.p - aOPos.get(e.k)));
    const changedOPct = depthO ? Math.round(changedO / depthO * 100) : null;
    const changed_pct = Math.round(changed / depth * 100);
    return { available: true, reason: '', basis: 'measured', measured: true, depth,
      changed, changed_pct, entered, gone, moved: moves.filter(m => m > 0).length,
      mean_move: moves.length ? r1(moves.reduce((s, x) => s + x, 0) / moves.length) : 0,
      mean_move_others: movesO.length ? r1(movesO.reduce((s, x) => s + x, 0) / movesO.length) : 0,
      depth_others: depthO, changed_others: changedO, changed_others_pct: changedOPct,
      band_others: changedOPct == null ? null : changedOPct >= c.high_pct ? 'high' : changedOPct >= c.still_pct ? 'some' : 'still',
      band: changed_pct >= c.high_pct ? 'high' : changed_pct >= c.still_pct ? 'some' : 'still',
      from: A.at, to: B.at, device: B.device, trimmed: !!(A.trimmed || B.trimmed), labels_basis: c.labels_basis };
  };
  // "7 of 10 places on the results page changed since 2026-10-07" — the measured sentence, with its basis
  const churnText = (ch) => {
    if (!ch || !ch.available) return 'How much the results page itself moved: not available — ' + ((ch && ch.reason) || 'no comparison was possible') + '.';
    const when = ch.from ? ' since the reading of ' + String(ch.from).slice(0, 10) : ' since the previous reading';
    const band = ch.band === 'noise' ? 'the results page changed no more than two readings of the same moment do' : ch.band === 'high' ? 'the whole results page moved' : ch.band === 'some' ? 'part of the results page moved' : 'the results page barely moved';
    return band + ': ' + ch.changed + ' of the top ' + ch.depth + ' places changed' + when
      + (ch.entered ? ', ' + ch.entered + ' new page' + (ch.entered === 1 ? '' : 's') + ' came in' : '')
      + (ch.mean_move ? ', and the pages present in both readings moved ' + ch.mean_move + ' place' + (ch.mean_move === 1 ? '' : 's') + ' on average' : '')
      + ' (measured by comparing the two stored readings; ' + ch.labels_basis + (ch.noise ? '; ' + ch.noise.text : '') + ').';
  };
  // the clause that goes beside a gain or a drop, so a move is never reported without the context that decides what it means
  const moveNote = (delta, ch) => {
    if (delta == null) return '';
    if (!ch || !ch.available) return 'whether the results page itself moved cannot be told — ' + ((ch && ch.reason) || 'no earlier reading stored');
    if (ch.band === 'noise') return 'the results page changed no more than two readings of the same moment do (' + ch.changed + ' of the top ' + ch.depth + ' places; ' + ((ch.noise || {}).text || '') + '), so this is one reading against one reading, not movement';
    if (ch.band === 'high') return 'the whole results page moved that week (' + ch.changed + ' of the top ' + ch.depth + ' places changed), so this is not necessarily about your page';
    if (ch.band === 'some') return 'part of the results page moved too (' + ch.changed + ' of the top ' + ch.depth + ' places changed)';
    return 'the rest of the results page barely moved (' + ch.changed + ' of the top ' + ch.depth + ' places changed), so this move is your page';
  };
  // ---- R87 / R90 / R88 (2026-10-16, re-rating 2026-10-15): one reading of a stored results page, read the same way everywhere ----
  // serpHosts: the hosts of ONE stored reading in rank order, one entry per position — the snapshot's own top ten (a domain holding
  // three positions appears three times, which the fit gate's "holds 3 of the top 5" rule needs), else the `above` list. Never the
  // `above` list AND the competitor list of the same answer together: the Rank Tracker report did that, so tax.gov.ae (#1) and
  // mof.gov.ae (#2) were each counted twice and "e invoicing in uae" — two government sites in its top five, the rule asks for three —
  // was set aside as a government query (exec 632).
  const serpHosts = (row, depth) => {
    const r = row || {}; const n = depth || 10;
    const snap = unpack(r.snapshot_json, null);
    const top = (snap && !snap.unavailable && Array.isArray(snap.top) ? snap.top : []).map(e => ({ p: Number(e && e.p) || 0, h: bare(hostOf(S(e && e.u))) }))
      .filter(e => e.p > 0 && e.h).sort((a, b) => a.p - b.p);
    if (top.length) return top.filter(e => e.p <= n).map(e => e.h);
    const c = unpack(r.competitors_json, null);
    return ((c && Array.isArray(c.above)) ? c.above : []).map(x => ({ p: Number(x && x.p) || 0, h: bare(S(x && x.d)) })).filter(e => e.p > 0 && e.p <= n && e.h)
      .sort((a, b) => a.p - b.p).map(e => e.h);
  };
  const isDesk = (h) => S((h || {}).device || 'desktop') !== 'mobile';
  const kwKey = (k) => S(k).toLowerCase().replace(/\s+/g, ' ').trim();
  // the newest stored DESKTOP reading of one keyword for one site, taken before `before` — whichever workflow bought it (a ladder, the
  // weekly site check, the tracker's own list). R88: the ladder report used its own ladder's rows only and the tracked-keyword report
  // any reading of the site, so one keyword in one run got "3 of top 8 changed" and "5 of top 8 changed". o: { keyword, domain, before,
  // valid (default: a real position, 0 = not in the top 50; -1 = a failed check is never a baseline), withSnapshot (a stored page: snapshot or competitor list) }
  const prevReading = (rows, o) => {
    const q = o || {}; const kw = kwKey(q.keyword), dom = bare(q.domain); const before = S(q.before || '9999');
    return (rows || []).filter(h => h && isDesk(h) && kwKey(h.keyword) === kw && (!dom || bare(h.domain) === dom) && S(h.checked_at) && S(h.checked_at) < before
      && h.position !== '' && h.position != null && Number(h.position) >= 0 && (!q.withSnapshot || !!unpack(h.snapshot_json, null) || !!unpack(h.competitors_json, null)))
      .sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))[0] || null;
  };
  // how much two readings of the SAME results page differ when nothing can have changed: stored desktop readings of the keyword for the
  // site taken within `minutes` of each other (the Rank Tracker and the weekly site check often read the same page minutes apart). Exec
  // 632 / 634 read "erp implementation dubai" 32 seconds apart and led with different pages. The largest such difference is the noise a
  // single reading against a single reading carries; a change no larger than it is not called movement. null when no such pair exists.
  const noise = (rows, o) => {
    const q = o || {}; const kw = kwKey(q.keyword), dom = bare(q.domain); const win = (Number(q.minutes) || 15) * 60e3;
    const rs = (rows || []).filter(h => h && isDesk(h) && kwKey(h.keyword) === kw && (!dom || bare(h.domain) === dom) && unpack(h.snapshot_json, null))
      .sort((a, b) => S(a.checked_at).localeCompare(S(b.checked_at)));
    let best = null;
    for (let i = 1; i < rs.length; i++) {
      const gap = Date.parse(S(rs[i].checked_at)) - Date.parse(S(rs[i - 1].checked_at));
      if (!(gap >= 0 && gap <= win)) continue;
      const ch = churn(rs[i - 1].snapshot_json, rs[i].snapshot_json, {});
      if (!ch.available) continue;
      if (!best || ch.changed > best.changed) best = { changed: ch.changed, depth: ch.depth, minutes: Math.round(gap / 6e4 * 10) / 10, at: S(rs[i].checked_at) };
    }
    if (!best) return null;
    return { ...best, text: 'two readings of this results page taken ' + best.minutes + ' minutes apart (' + best.at.slice(0, 10) + ') already differed in ' + best.changed + ' of the top ' + best.depth + ' places' };
  };
  // a measured change, judged against that noise: no larger than it = 'noise', and every severity word is withheld
  const withNoise = (ch, nz) => {
    if (!ch || !ch.available || !nz) return ch;
    const out = { ...ch, noise: nz };
    if (ch.changed <= nz.changed) { out.band = 'noise'; out.within_noise = true; }
    return out;
  };
  // ---- B6-8 (2026-10-16, benchmark area 6): A MOVE IS THE SITE'S OWN ONLY WHEN IT BEATS THE PAGE'S OWN CHURN ----
  // Since v4.2 a move of five places was "a drop" whatever the results page around it did; B6-2 put the measurement beside it, and the
  // label stayed the same. Now the label follows the measurement: the page's own move when the page around it held (fewer than half of
  // the top places changed occupant) AND the move is more than twice what the other pages present in both readings moved on average
  // (and more than two places); "the results page moving" when it did not; "one reading against one reading" when the page's change is
  // no larger than two readings of one moment show (R88); and "not compared", no verdict at all, when the earlier reading cannot be
  // compared. The size of a listed move stays five places. These are stated rules: no tool publishes a per-keyword threshold.
  const MOVE = { min_places: 5, others_factor: 2, others_floor: 2,
    rule: 'a move is called your page\'s own only when the other results on the page held (fewer than half of them changed place among themselves) and the move is more than twice the average move of the other pages present in both readings, and more than 2 places; a stated rule, not a measurement' };
  const moveKind = (delta, ch) => {
    if (delta == null || !Number(delta)) return null;
    const size = Math.abs(Number(delta)) >= 100 ? null : Math.abs(Number(delta));   // +-100 = came into / fell out of the depth checked
    const sizeText = size == null ? (Number(delta) > 0 ? 'came into the top 50' : 'fell out of the top 50') : 'moved ' + size + ' place' + (size === 1 ? '' : 's');
    if (!ch || !ch.available) return { kind: 'not_compared', own: false, text: 'not compared: ' + ((ch && ch.reason) || 'no earlier reading of the results page is stored') + ', so whether this is your page or the page around it is not said' };
    if (ch.band === 'noise') return { kind: 'within_noise', own: false, text: 'the results page changed no more than two readings of the same moment do (' + ch.changed + ' of the top ' + ch.depth + ' places), so this is one reading against one reading, not a move' };
    // the page without us decides (band_others, from churn's `own` option); a reading compared without it falls back to the whole page
    const band = ch.band_others || ch.band;
    const chg = ch.band_others ? ch.changed_others + ' of the other ' + ch.depth_others + ' results changed place' : ch.changed + ' of the top ' + ch.depth + ' places changed occupant';
    if (band === 'high') return { kind: 'with_page', own: false, text: 'the results page moving: ' + chg + ', so this is not necessarily about your page' };
    const others = ch.mean_move_others != null ? Number(ch.mean_move_others) : (Number(ch.mean_move) || 0);
    const ref = Math.max(MOVE.others_floor, MOVE.others_factor * others);
    if (size != null && size <= ref) return { kind: 'with_page', own: false, ref, text: 'the results page moving: your page ' + sizeText + ' and the other pages present in both readings moved ' + others + ' on average, so this move is no larger than the page\'s own churn' };
    return { kind: 'own', own: true, ref, text: 'your page\'s own move: it ' + sizeText + ' while ' + chg + ' and the other pages moved ' + others + ' place' + (others === 1 ? '' : 's') + ' on average' };
  };

  // ---- B6-6 (2026-10-16, benchmark area 6, criterion 2.10): TWO OF THE SITE'S OWN PAGES ON ONE RESULTS PAGE ----
  // Semrush has a cannibalisation tab. We had nothing, and the stored snapshot could not have shown it: it kept one URL per site. The
  // snapshot now keeps how many of our pages the answer held and which. Silent when there is one; "not checked" (never "none") for a
  // reading stored before the count was kept. "Preferred" = the page Google placed higher in THIS reading; if the previous reading ranked
  // a different page of ours, that is said too.
  const cannibal = (cur, o) => {
    const q = o || {}; const x = unpack(cur, null);
    if (!x || x.unavailable) return { checked: false, found: false, count: null, pages: [], reason: 'this check could not read the results page' };
    if (x.own_n == null) return { checked: false, found: false, count: null, pages: [], reason: 'this reading was stored before a second page of the site was kept' };
    const n = Number(x.own_n) || 0;
    const pages = (Array.isArray(x.own) ? x.own : []).map(e => ({ position: Number(e && e.p) || 0, url: S(e && e.u) })).filter(e => e.position > 0 && e.url).sort((a, b) => a.position - b.position);
    if (n < 2 || pages.length < 2) return { checked: true, found: false, count: n, pages: [] };
    const preferred = pages[0];
    const prevUrl = S(q.previous_url);
    const switched = !!prevUrl && urlKey(prevUrl) !== urlKey(preferred.url);
    const kw = S(q.keyword);
    const text = (n === 2 ? 'Two' : String(n)) + ' of your pages appear on the results page' + (kw ? ' for "' + kw + '"' : '') + ' (top ' + (Number(q.depth) || 50) + ' of this check): '
      + pages.map(p => p.url + ' at #' + p.position).join(' and ') + (n > pages.length ? ' (and ' + (n - pages.length) + ' more)' : '')
      + '. Google prefers ' + preferred.url + ' today: it is the higher of them in this reading.'
      + (switched ? ' In the previous reading' + (q.previous_at ? ' (' + S(q.previous_at).slice(0, 10) + ')' : '') + ' it ranked ' + prevUrl + ' instead, so Google is changing which of your pages it shows.' : '')
      + ' Pages that compete for one search split its signals: choose one page for it and make the other point to it (merge it, redirect it, or link to it with this search\'s words).';
    return { checked: true, found: true, count: n, pages, preferred, previous_url: prevUrl || null, switched, text, basis: 'observed: the URLs of this site in the stored reading of this check' };
  };

  // ---- B6-10 (2026-10-16, benchmark area 6, Ahrefs parity): WHO TOOK THE PLACE ----
  // Ahrefs warns when a target URL is outranked. Our report said the number fell; the two stored snapshots name everybody above us in both
  // readings, so the domains above the target now that were not above it then are named, with where they were. Refuses (with the
  // reason) when either reading cannot be read, when we were not ranking before, or when we were below the depth the previous reading kept.
  const outranked = (prev, cur, o) => {
    const q = o || {}; const our = bare(q.domain);
    const none = (reason) => ({ available: false, reason, domains: [], text: '' });
    const P = unpack(prev, null), C = unpack(cur, null);
    if (!C || C.unavailable || !Array.isArray(C.top) || !C.top.length) return none('this check could not read the results page');
    if (!P || P.unavailable || !Array.isArray(P.top) || !P.top.length) return none('no earlier stored reading of this results page to compare with');
    if (S(P.device || 'desktop') !== S(C.device || 'desktop')) return none('the two readings are of different devices');
    const pp = Number(q.previous_position), cp = Number(q.position);
    if (!(pp > 0)) return none(pp === 0 ? 'your page was not in the top 50 in the previous reading, so nobody moved above it' : 'the previous position could not be read');
    if (!Number.isFinite(cp) || cp < 0) return none('this check could not read your position');
    const rows = (s) => s.top.map(e => ({ p: Number(e && e.p) || 0, h: hostOf(S(e && e.u)) })).filter(e => e.p > 0 && e.h);
    const pDepth = Math.max(0, ...P.top.map(e => Number(e && e.p) || 0));
    if (pp > pDepth) return none('your page was at #' + pp + ' in the previous reading and that reading kept the top ' + pDepth + ' only, so who was above it then is not fully known');
    const bestP = new Map(); for (const e of rows(P)) if (!isOurs(e.h, our) && (!bestP.has(e.h) || e.p < bestP.get(e.h))) bestP.set(e.h, e.p);
    const domains = [];
    for (const e of rows(C).sort((a, b) => a.p - b.p)) {
      if (isOurs(e.h, our) || (cp > 0 && e.p >= cp) || domains.some(d => d.domain === e.h)) continue;
      const b = bestP.has(e.h) ? bestP.get(e.h) : null;
      if (b != null && b < pp) continue;   // it was above us then too
      domains.push({ domain: e.h, position: e.p, previous: b });
    }
    const target = S(q.target_url) || 'your page';
    const text = domains.length ? 'Outranked since the reading of ' + (S(q.previous_at).slice(0, 10) || 'the previous check') + ': '
      + domains.slice(0, 4).map(d => d.domain + ' (now #' + d.position + ', ' + (d.previous == null ? 'not in the top ' + pDepth + ' then' : 'was #' + d.previous + ', below your page then') + ')').join(', ')
      + (domains.length > 4 ? ' and ' + (domains.length - 4) + ' more' : '') + ' moved above ' + target + ' (#' + pp + ' then, ' + (cp > 0 ? '#' + cp : 'not in the top 50') + ' now).' : '';
    return { available: true, reason: '', domains, text, previous_position: pp, position: cp, target_url: S(q.target_url) || null, basis: 'measured: the two stored top-ten readings' };
  };

  // ---- B6-14 (2026-10-16, benchmark area 6, gap G6-6): ONE SHARE OF VOICE OVER MANY KEYWORDS, WEIGHTED BY WHAT THEY ARE WORTH TO THE SITE ----
  // The summary averaged the per-keyword shares unweighted, so 40% of a search nobody makes counted as much as 4% of the head term (Ahrefs
  // and AccuRanker weight by volume). The weight here is the site's OWN Search Console impressions per query (seo_query_history, the
  // newest stored 28-day period only: the table only grows), first-party and free. Impressions count only searches in which Google showed
  // the site, so a keyword it does not appear for yet weighs nothing; fewer than two keywords with impressions is not a weighting, and the
  // figure falls back to the unweighted mean, labelled so.
  const WEIGHT = { min_keywords: 2,
    basis: 'weighted by your own Search Console impressions for each keyword (the newest stored 28-day period); impressions count only searches in which Google showed your site, so a keyword you do not appear for yet weighs nothing' };
  const weightedVoice = (items, rows, o) => {
    const q = o || {}; const dom = bare(q.domain);
    const its = (items || []).filter(x => x && x.share_of_voice != null && Number.isFinite(Number(x.share_of_voice)));
    const unweighted = its.length ? r1(its.reduce((s, x) => s + Number(x.share_of_voice), 0) / its.length) : null;
    if (!its.length) return { value: null, unweighted: null, weight: 'none', keywords: 0, weighted_keywords: 0, period_end: null, note: 'no results page was read, so no share of voice can be modelled' };
    const mine = (rows || []).filter(r => r && !r.error && S(r.query) && (!dom || bare(r.domain) === dom));
    const period = mine.reduce((m, r) => S(r.period_end) > m ? S(r.period_end) : m, '');
    const imp = new Map();
    for (const r of mine.filter(r => S(r.period_end) === period).sort((a, b) => S(a.checked_at).localeCompare(S(b.checked_at)))) imp.set(kwKey(r.query), Math.max(0, Number(r.impressions) || 0));
    const w = its.map(x => ({ keyword: S(x.keyword), share_of_voice: Number(x.share_of_voice), impressions: imp.has(kwKey(x.keyword)) ? imp.get(kwKey(x.keyword)) : null }));
    const withW = w.filter(x => x.impressions > 0);
    const total = withW.reduce((s, x) => s + x.impressions, 0);
    const base = { unweighted, keywords: its.length, weighted_keywords: withW.length, period_end: period || null, per_keyword: w.slice(0, 30) };
    if (!mine.length) return { ...base, value: unweighted, weight: 'none', note: 'unweighted: no Search Console data is stored for this site, so every keyword counts the same' };
    if (withW.length < WEIGHT.min_keywords) return { ...base, value: unweighted, weight: 'none', note: 'unweighted: ' + (withW.length ? 'only one' : 'none') + ' of these ' + its.length + ' keywords had Search Console impressions in the 28 days to ' + period + ', too few to weight by, so every keyword counts the same' };
    const value = r1(withW.reduce((s, x) => s + x.share_of_voice * x.impressions, 0) / total);
    const left = its.length - withW.length;
    return { ...base, value, weight: 'impressions', impressions: total,
      note: 'weighted by your Search Console impressions: ' + total + ' impressions over ' + withW.length + ' of the ' + its.length + ' keywords, 28 days to ' + period
        + (left ? '; ' + left + (left === 1 ? ' keyword with no impressions weighs nothing' : ' keywords with no impressions weigh nothing') : '') + '; the unweighted average is ' + unweighted + '%' };
  };
  return { MOVE, moveKind, cannibal, outranked, WEIGHT, weightedVoice, CTR, SUM_CTR, METHOD, AIO_KEEP, AIO_SOURCE, keepAt, CHURN, read, features, typeList, ourRank, landscape, voice, snapshot, pack, unpack,
    featureLine, featureChips, churn, churnNone, churnText, moveNote, bare, hostOf, isOurs, listOf, weight, urlKey, serpHosts, prevReading, noise, withNoise };
})();
// Locates the site in each SERP (top 50): one seo_rank_history row per keyword (ladder_id = site id, rung 0). position 0 = not in the top 50, -1 = check failed.
// G6 (2026-10-12 system review): the row carries the whole results page of the same call, like the Rank Tracker's rows — the features it
// showed (AI Overview and whether it cites us, snippet, People Also Ask, local pack, video), the top-10 domains with their positions,
// the competitors' positions, the modelled share of voice and a compact snapshot as proof. Every writer of the table writes every column.
// These checks are desktop (the mobile check is the ladder's main keywords, in the Rank Tracker).
const reqs = $('Site SERP Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const now = new Date().toISOString();
return reqs.filter(q => !q.skip).map((r, i) => {
  const a = RS.read(res[i]);
  const mine = RS.ourRank(a, r.domain);
  const feats = RS.features(a, r.domain);
  const land = RS.landscape(a, r.domain, r.competitors || [], mine.position);
  const sov = RS.voice(land, feats, r.domain, mine.position);
  return { json: {
    ladder_id: String(r.site_id), keyword: String(r.keyword), checked_at: now, position: mine.position, url: mine.url,
    serp_features: RS.typeList(a), domain: String(r.domain || ''), rung: 0, device: 'desktop',
    features_json: RS.pack(feats, 1600),
    competitors_json: RS.pack({ our_position: mine.position > 0 ? mine.position : null, above: land.above.map(x => ({ d: x.domain, p: x.position, t: x.tracked })),
      competitors: land.competitors.map(x => ({ d: x.domain, p: x.position, t: x.tracked })), shares: sov.shares, tracked: land.tracked, method: sov.method }, 1800),
    snapshot_json: RS.pack(RS.snapshot(a, land, feats, 'desktop'), 1800),
    share_of_voice: a.ok ? (sov.ours == null ? 0 : sov.ours) : -1 } };
});
