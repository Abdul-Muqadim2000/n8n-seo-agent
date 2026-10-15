// The pages to read this run (free): every new prospect to qualify (best score first; also the Backlink Monitor's and AI Growth's), resource
// pages found by search, pages that link to a competitor's dead page (DataForSEO), evidence for the listings checklist (our own home / about
// pages and the competitors' homepages: links and sameAs to the platforms; member lists like the UAE Ministry of Finance's; guessed profile
// URLs on platforms that answer a plain fetch), and our old URLs from the Wayback Machine (does each still answer?).
/*__LINK_KIT__*/
/*__OUTREACH_KIT__*/
/*__LISTINGS__*/
/*__PODCAST__*/
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const rows = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && Object.keys(r).length && !r.error); } catch (e) { return []; } };
const prospects = rows('Load Link Prospects'), outreach = rows('Load Link Outreach'), ledger = rows('Load Backlinks');
let sreqs = [], sresps = []; try { sreqs = $('LB Source Requests').all().map(i => i.json); sresps = $('Fetch LB Sources').all().map(i => i.json || {}); } catch (e) {}
let dreqs = [], dresps = []; try { dreqs = $('LB DFS Requests').all().map(i => i.json).filter(r => !r.skip); dresps = $('Run LB DFS').all().map(i => i.json || {}); } catch (e) {}
const body = (r) => { if (!r) return null; if (r.body && typeof r.body === 'object') return r.body; if (r.posts || r.results || Array.isArray(r)) return r; try { return JSON.parse(String(r.body ?? r.data ?? '')); } catch (e) { return null; } };
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|bing|yahoo|duckduckgo)\.[a-z.]+$/i;
const DOC = /\.(pdf|docx?|xlsx?|pptx?|zip|csv|xml|json|txt|mp4|mp3)(\?|$)/i;
const ASSET = /\.(css|js|mjs|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|xml|json|txt|pdf|map|webmanifest)(\?|$)/i;
const LB_WON_MAX = 12;   // B11-2: won links re-read a run (free GETs; the rest wait a week, oldest reading first)
const out = [];
for (const p of plans) {
  const add = (kind, url, extra = {}) => { if (!/^https?:\/\//i.test(url || '') || out.some(o => o.json.site_id === p.site_id && o.json.url === url && o.json.kind === kind)) return; /* one fetch per purpose */ out.push({ json: { site_id: p.site_id, kind, url: String(url).slice(0, 500), ...extra } }); };
  const linking = new Set(ledger.filter(l => l.site_id === p.site_id && l.status !== 'lost').map(l => l.ref_domain));
  const known = new Set([...outreach.filter(o => o.site_id === p.site_id).map(o => o.prospect_domain + '|' + o.type)]);
  const comp = new Set(p.competitors.map(c => LK.regDomain(c)));
  const skipD = (d) => !d || LK.sameSite(d, p.domain) || comp.has(LK.regDomain(d)) || BIG.test(d) || LK.isWire(d) || !!OK.badHost(d) || linking.has(LK.refKey(d));   // D13: badHost covers infrastructure, statistics pages, mailbox providers and contact databases (outlook.com, zoominfo.com were read and pitched live)
  // 1. prospects to qualify: new, not yet qualified, best score first (reclaims are fixed on our own site)
  const todo = prospects.filter(x => x.site_id === p.site_id && (x.status || 'new') === 'new' && !['reclaim', 'digest'].includes(x.type) && !known.has(x.prospect_domain + '|' + x.type) && !skipD(x.prospect_domain))
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)).slice(0, p.qualify_max);
  for (const x of todo) add('prospect', (x.source_url && !DOC.test(x.source_url)) ? x.source_url : 'https://' + x.prospect_domain + '/', { prospect_domain: x.prospect_domain, type: x.type });
  // 1b. B11-2 (2026-10-15, benchmark area 11): the links we have already won, read again on their own page.
  // A link won through outreach was proven ONCE — the Reply Reader fetched the page named in the reply and found the link — and then
  // nothing ever looked at it again. If no crawler indexes that page (which is the normal case for a small site's first links) the
  // link is in no backlink index either, so the Backlink Monitor's weekly re-check never reaches it: the one link the customer worked
  // hardest for was the one link nobody verified twice. Criterion 4C.7 is "confirmed live by our own check, THEN monitored", and
  // Pitchbox re-checks only its top 100 links while Linkody re-checks every monitored link every 24 hours.
  // Only the links the ledger does NOT carry are queued here: the ones it does carry are already re-fetched by the Backlink Monitor,
  // and two workflows fetching the same page every Monday is a cost to them, not to us. Oldest reading first, a row already missing
  // once always first, at most LB_WON_MAX a run — all free GETs.
  const wonQueue = [];
  for (const x of prospects.filter(y => y.site_id === p.site_id && String(y.status || '') === 'won')) {
    const key = LK.refKey(x.prospect_domain);
    if (!key || linking.has(key)) continue;   // in the ledger: the Backlink Monitor reads that page itself
    const row = outreach.find(o => o.site_id === p.site_id && o.prospect_domain === x.prospect_domain && o.type === x.type) || {};
    let ck = {}; try { ck = JSON.parse(row.checks_json || '{}') || {}; } catch (e) { ck = {}; }
    const w = ck.won || {};
    const url = /^https?:\/\//i.test(w.url || '') ? w.url
      : (/^https?:\/\//i.test(x.source_url || '') && !DOC.test(x.source_url)) ? x.source_url : 'https://' + x.prospect_domain + '/';
    const at = Date.parse(w.at || '');
    wonQueue.push({ x, url, age: Number.isFinite(at) ? (Date.now() - at) / 864e5 : 9999, misses: Number(w.misses) || 0 });
  }
  wonQueue.sort((a, b) => (b.misses - a.misses) || (b.age - a.age));
  for (const w of wonQueue.slice(0, LB_WON_MAX)) add('won', w.url, { prospect_domain: w.x.prospect_domain, type: w.x.type, won_at: String(w.x.won_at || ''), url_source: /^https?:\/\//i.test(String(w.x.source_url || '')) && w.age > 9000 ? 'the page we pitched' : 'where the link was last found' });
  // 2. resource pages found by search (monthly)
  let nRes = 0;
  sreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.kind !== 'resource_search') return; const j = body(sresps[i]) || {};
    for (const it of (j.results || [])) { const d = LK.hostOf(it.url); if (nRes >= 8 || skipD(d) || DOC.test(it.url) || known.has(LK.refKey(d) + '|resource') || out.some(o => o.json.prospect_domain === LK.refKey(d))) continue;
      nRes++; add('prospect', it.url, { prospect_domain: LK.refKey(d), type: 'resource', topic: r.topic, title: String(it.title || '').slice(0, 160) }); } });
  // 3. pages linking to a competitor's dead page (DataForSEO, monthly)
  let nBr = 0;
  dreqs.forEach((r, i) => { if (r.site_id !== p.site_id || (r.kind || 'broken') !== 'broken') return; const res = (((dresps[i] || {}).tasks || [])[0] || {}).result || []; const items = (res[0] || {}).items || [];
    for (const it of items) { const d = LK.refKey(it.domain_from); if (nBr >= 10 || skipD(d) || known.has(d + '|broken') || out.some(o => o.json.prospect_domain === d)) continue; nBr++;
      add('prospect', it.url_from, { prospect_domain: d, type: 'broken', dead_url: it.url_to || '', dead_anchor: String(it.anchor || '').slice(0, 120), competitor: r.competitor, rank: Number(it.domain_from_rank) || 0 }); } });
  // 4. listings evidence (monthly)
  if (p.due.listings) {
    add('self', p.home); add('self', p.home.replace(/\/$/, '') + '/about'); add('self', p.home.replace(/\/$/, '') + '/about-us');
    for (const c of p.competitors.slice(0, 3)) add('comp_home', 'https://' + c + '/', { competitor: c });
    const kind = siteKind(p.profile.business_type, p.topics.join(' '));
    const slug = String(p.brand || p.domain.split('.')[0]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    for (const l of listingsFor(kind, p.country_iso, p.topics.join(' ') + ' ' + p.profile.business_type, '')) {
      if (l.list) add('listing_list', l.list, { listing_id: l.id });
      else if (l.fetchable && l.guess) add('listing_profile', l.guess({ slug, domain: p.domain }), { listing_id: l.id, guessed: true });
    }
    sreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.kind !== 'listing_search') return; const l = LISTINGS.find(x => x.id === r.listing_id); const j = body(sresps[i]) || {};
      const hit = (j.results || []).find(it => l && l.re && l.re.test(it.url || '')); if (hit) add('listing_profile', hit.url, { listing_id: l.id }); });
  }
  // 4b. L5: podcast shows on our topics (monthly, free) — the feed says what the show is about and which website is its own
  if (p.due.podcasts) { let nPod = 0; const seenFeed = new Set();
    sreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.kind !== 'podcast_search') return;
      for (const sh of PC.shows(body(sresps[i]) || {})) { if (nPod >= 6) break;
        const fh = LK.hostOf(sh.feed), sh2 = sh.site ? LK.hostOf(sh.site) : '';
        if (!fh || seenFeed.has(LK.normUrl(sh.feed))) continue;
        if (sh2 && (LK.sameSite(sh2, p.domain) || comp.has(LK.regDomain(sh2)) || known.has(LK.refKey(sh2) + '|podcast') || linking.has(LK.refKey(sh2)))) continue;   // our own show, a competitor's, one already pitched or already linking
        seenFeed.add(LK.normUrl(sh.feed)); nPod++;
        add('podcast_feed', sh.feed, { topic: r.topic || '', show_title: sh.title.slice(0, 160), show_author: sh.author.slice(0, 120), platform_url: sh.platform_url, episodes: sh.episodes, feed_site: sh.site, provider: sh.provider }); } }); }
  // 5. our old URLs (Wayback CDX, monthly): does each still answer? (a 404 with history = a redirect to add)
  sreqs.forEach((r, i) => { if (r.site_id !== p.site_id || r.kind !== 'wayback') return; const j = body(sresps[i]); const list = Array.isArray(j) ? j.slice(1) : [];
    const seen = new Set(); let n = 0;
    for (const row of list) { const u = String(row[0] || ''); const h = LK.hostOf(u); if (!LK.sameSite(h, p.domain) || ASSET.test(u) || /[?#]/.test(u) || /\/(wp-json|wp-admin|feed|cdn-cgi|_next|static)\b/i.test(u)) continue;
      const k = LK.normUrl(u); if (seen.has(k) || n >= 60) continue; seen.add(k); n++;
      add('wayback_check', u.replace(/^http:/i, 'https:'), { archived_at: String(row[2] || '').slice(0, 8) }); } });
}
return out.length ? out : [{ json: { skip: true } }];
