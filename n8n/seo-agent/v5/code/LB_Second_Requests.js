// Second round (free): who to write to — the author's page, /contact and /about of every prospect whose page answered and does not sell links
// (up to 15 a site) — and the outbound links of resource and list pages, each checked once (broken link building: a dead link on a page
// about our topic is the easiest pitch there is — "one of your links is dead, here is a current page on the same subject").
// L5 (2026-10-13): and the website of every podcast show whose feed answered — the feed's <link> is the show's own domain, which is the
// only domain we will take a contact from; its /contact page is read in the same round.
/*__LINK_KIT__*/
/*__OUTREACH_KIT__*/
/*__PODCAST__*/
let reqs = [], resps = []; try { reqs = $('LB Page Requests').all().map(i => i.json).filter(r => !r.skip); resps = $('Fetch LB Pages').all().map(i => i.json || {}); } catch (e) {}
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|bing|yahoo|wa\.me|whatsapp|t\.me|cloudflare|gstatic|w3\.org|schema\.org)\.[a-z.]+$/i;
const SKIPU = /\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|pdf|zip)(\?|$)|^mailto:|^tel:|^javascript:|#/i;
const out = [];
for (const p of plans) {
  let nContact = 0, nOut = 0;
  reqs.forEach((r, i) => {
    if (r.site_id !== p.site_id || r.kind !== 'prospect') return;
    const x = resps[i] || {}; const html = String(x.body ?? x.data ?? ''); const status = Number(x.statusCode) || 0;
    if (!html || status >= 400 || LK.challenge(status, html)) return;
    const facts = LK.pageFacts(html, x.headers, r.url);
    if (OK.sellSignals(html, facts).length || OK.isGov(r.prospect_domain)) return;
    const lang = String(facts.lang || '').slice(0, 2).toLowerCase(), L = String(p.language_code || 'en').slice(0, 2).toLowerCase();
    if (lang && lang !== L && !(lang === 'ar' && /^(AE|SA|QA|KW|BH|OM|EG|JO)$/.test(p.country_iso || ''))) return;
    // contacts: the author's page, /contact, /about (the prospect page itself is read again in LB Assemble) — not for off-topic pages
    const quick = OK.fit(facts.title + ' ' + LK.text(html).slice(0, 4000), (p.topics || []).join(' ') + ' ' + ((p.profile || {}).business_type || ''));
    if (nContact < 15 && !(['gap', 'comp_new', 'resource'].includes(r.type) && quick < OK.OFF_TOPIC)) { nContact++;
      const base = String(r.url).replace(/^(https?:\/\/[^\/?#]+).*$/i, '$1');   // the page's own host (www kept)
      const urls = [OK.authorUrl(html, r.url), base + '/contact', base + '/contact-us', base + '/about'].filter(u => u && u !== r.url);
      for (const u of [...new Set(urls)].slice(0, 3)) out.push({ json: { site_id: p.site_id, kind: 'contact', url: u, prospect_domain: r.prospect_domain, type: r.type } }); }
    // outbound links of resource / list pages: dead ones are broken-link openings
    if (['resource', 'list', 'gap', 'comp_new'].includes(r.type) && nOut < 40) {
      const seen = new Set(); const place = LK.anchorPlacements(html);   // every link's placement in one walk
      for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
        const href = LK.attr(m[1], 'href') || ''; if (!/^https?:\/\//i.test(href) || SKIPU.test(href)) continue;
        const h = LK.hostOf(href); if (!h || LK.sameSite(h, LK.hostOf(r.url)) || LK.sameSite(h, p.domain) || BIG.test(h) || LK.isInfra(h)) continue;
        if (/(^|\/\/|\.)(app|login|portal|my|account|admin|secure|auth)\.|\/(login|signin|sign-in|account|cart|checkout|auth)\b|privatelogin/i.test(href) || place.get(m.index) !== 'content') continue;   // real azdan.com: a login portal is not a dead resource
        const k = LK.normUrl(href); if (seen.has(k)) continue; seen.add(k); if (nOut >= 40 || seen.size > 12) break; nOut++;
        out.push({ json: { site_id: p.site_id, kind: 'outbound', url: href.slice(0, 500), on_page: r.url, prospect_domain: r.prospect_domain, type: r.type, anchor: LK.text(m[2]).slice(0, 120) } });
      }
    }
  });
  // L5: the podcast shows — their own website and its contact page (the feed named the site; a show hosted only on a platform has none)
  reqs.forEach((r, i) => {
    if (r.site_id !== p.site_id || r.kind !== 'podcast_feed') return;
    const x = resps[i] || {}; const xml = String(x.body ?? x.data ?? ''); const status = Number(x.statusCode) || 0;
    if (!xml || status >= 400) return;
    const f = PC.feed(xml); const site = f.site || r.feed_site || '';
    const host = LK.hostOf(site); if (!host || BIG.test(host) || LK.isInfra(host) || LK.sameSite(host, p.domain)) return;   // a show that only lives on a hosting platform has no page of its own to add a link to
    const pd = LK.refKey(host); const base = String(site).replace(/^(https?:\/\/[^\/?#]+).*$/i, '$1');
    const g = PC.guestSignal([f.description, ...(f.episode_titles || [])]);
    const show = { prospect_domain: pd, type: 'podcast', topic: r.topic || '', feed_url: r.url, platform_url: r.platform_url || '',
      show_title: (f.title || r.show_title || '').slice(0, 160), show_author: (f.author || r.show_author || '').slice(0, 120),
      summary: String(f.description || '').slice(0, 600), owner_email: f.owner_email || '', episodes: Math.max(Number(r.episodes) || 0, f.episodes || 0),
      last_episode: f.last_episode || '', guest_strength: g.strength, guest_quote: String(g.quote || '').slice(0, 300) };
    out.push({ json: { site_id: p.site_id, kind: 'podcast_site', url: base + '/', ...show } });
    out.push({ json: { site_id: p.site_id, kind: 'contact', url: base + '/contact', prospect_domain: pd, type: 'podcast' } });
  });
}
return out.length ? out : [{ json: { skip: true } }];
