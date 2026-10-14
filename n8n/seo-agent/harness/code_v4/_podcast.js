// harness shim (written by build_v4.py section 58, R27; it replaces section 52's): the podcast kit — a search answer (Apple or
// Podcast Index), an RSS feed, the guest signal with the quote it may show, the choice between the feed and the website, and the
// staleness and topic rules
// ---- podcast kit (L5, LINK_BUILDER_SPEC.md §2: podcast guest opportunities; inlined after the link kit) ----
// A guest appearance on a show in the site's topics earns an editorial link from the show's own page, and the owner has to say yes to it —
// so the shows are found for free, qualified like any other prospect and pitched only when there is a contact on the show's OWN domain.
// Where the list comes from: Apple's podcast directory (`itunes.apple.com/search`) needs no key at all. The **Podcast Index API**
// (`SEO_PODCASTINDEX_API_KEY` / `SEO_PODCASTINDEX_API_SECRET`) signs every request with sha1(key + secret + unix time); an n8n credential
// cannot compute that per request and a node may not hold the secret ($env is blocked in nodes on this instance), so the signed path waits
// for the owner's key **and** a signing step — `shows()` already reads both answers, so only the URL changes when it arrives.
// Regex only (the n8n Code sandbox has no URL and no DOM).
const PC = (() => {
  const S = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };
  const APPLE = 'https://itunes.apple.com/search?media=podcast&entity=podcast&limit=25&term=';
  const INDEX = 'https://api.podcastindex.org/api/1.0/search/byterm?max=25&clean&fulltext&q=';
  /** one search URL for a topic; `signed` only when the Podcast Index key and a signing step are in place (see the note above) */
  const searchUrl = (topic, signed) => (signed ? INDEX : APPLE) + encodeURIComponent(S(topic).slice(0, 80));
  const KEEP_TITLE = /[a-z]/i;
  /** the shows in a search answer, from either shape (Apple `results`, Podcast Index `feeds`), newest-looking first, deduplicated by feed */
  function shows(j) {
    const out = []; const seen = new Set();
    const add = (o) => { const k = (o.feed || o.title).toLowerCase(); if (!o.feed || !KEEP_TITLE.test(o.title) || seen.has(k)) return; seen.add(k); out.push(o); };
    for (const r of ((j || {}).results || [])) add({ provider: 'apple', title: S(r.collectionName || r.trackName), author: S(r.artistName), feed: S(r.feedUrl),
      platform_url: S(r.collectionViewUrl || r.trackViewUrl), site: '', episodes: num(r.trackCount), genres: (Array.isArray(r.genres) ? r.genres : []).map(S).filter(Boolean), updated: S(r.releaseDate).slice(0, 10) });
    for (const r of ((j || {}).feeds || [])) add({ provider: 'podcastindex', title: S(r.title), author: S(r.author || r.ownerName), feed: S(r.url || r.originalUrl),
      platform_url: '', site: S(r.link), episodes: num(r.episodeCount), genres: Object.values((r.categories && typeof r.categories === 'object') ? r.categories : {}).map(S).filter(Boolean),
      updated: r.lastUpdateTime ? new Date(Number(r.lastUpdateTime) * 1000).toISOString().slice(0, 10) : '' });
    return out;
  }
  const tag = (xml, name) => { const m = String(xml || '').match(new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '>', 'i')); return m ? m[1] : ''; };
  const strip = (t) => S(String(t || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
  /** what an RSS feed says about the show: its own website, its description, the owner's address, how many episodes and how fresh it is */
  function feed(xml) {
    const x = String(xml || '');
    const chan = (x.match(/<channel\b[\s\S]*?(?:<item\b|<\/channel>)/i) || [x])[0];
    const link = strip(tag(chan, 'link')) || (chan.match(/<atom:link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || [])[1] || '';
    const owner = tag(chan, 'itunes:owner');
    const mail = strip(tag(owner, 'itunes:email')) || (owner.match(EMAIL) || [])[0] || (strip(tag(chan, 'managingEditor')).match(EMAIL) || [])[0] || '';
    const dates = [...x.matchAll(/<pubDate>([^<]{6,60})<\/pubDate>/gi)].map(m => Date.parse(m[1])).filter(t => Number.isFinite(t)).sort((a, b) => b - a);
    return { site: /^https?:\/\//i.test(link) ? link.slice(0, 300) : '', title: strip(tag(chan, 'title')).slice(0, 160),
      description: strip(tag(chan, 'description') || tag(chan, 'itunes:summary')).slice(0, 2000), owner_email: S(mail).toLowerCase(),
      author: strip(tag(chan, 'itunes:author')).slice(0, 120), episodes: (x.match(/<item\b/gi) || []).length,
      last_episode: dates.length ? new Date(dates[0]).toISOString().slice(0, 10) : '', episode_titles: [...x.matchAll(/<item\b[\s\S]*?<title>([\s\S]*?)<\/title>/gi)].slice(0, 12).map(m => strip(m[1]).slice(0, 160)).filter(Boolean) };
  }
  // does the show take guests? Said in its own words — a page that invites guests, or a run of episodes that are interviews.
  const INVITE = /(be (?:a|our|my) guest|guest application|apply to (?:be|come on)[^.]{0,30}guest|pitch (?:a|us a|your)[^.]{0,20}(?:guest|story|topic|idea)|(?:suggest|nominate|recommend) a guest|guest form|want to be (?:on|a guest on) the (?:show|podcast)|submit (?:a |your )?guest|guest inquir|guest request|appear on the (?:show|podcast)|come on the (?:show|podcast))/i;
  const INTERVIEW = /\b(interview[sd]?|in conversation with|we (?:talk|speak) (?:to|with)|joins? (?:me|us) (?:on|to)|my guest|our guest|guest[s]?:)\b/i;
  // R27 (2026-10-14, the second re-rating): the week's report offered "Alchemy Uncensored" with the evidence
  // `They say: "b-0"> Efficient Hiring Process We respect your time by managing streamlined, back-to-back interview schedule…` — a
  // leftover HTML attribute from an unrelated page of the show's site, quoted at the owner. A stripper that cuts at the first ">"
  // leaves the rest of an attribute behind whenever a ">" sits inside one, so the text we quote from is cleaned of attribute
  // remains first, and every quote is cut at word and sentence boundaries. A quote that is still not prose is dropped: an
  // opportunity with no quote is honest, a quote of markup is not.
  const ATTR = /(?:^|[\s"'])[a-z-]{1,24}\s*=\s*["'][^"']{0,200}["']/gi;
  const FRAGMENT = /(^|\s)[^\s]{0,40}["']\s*>/g;                       // `b-0">` and friends: the tail of an attribute the stripper cut
  const prose = (t) => S(String(t || '').replace(ATTR, ' ').replace(FRAGMENT, ' ').replace(/[{}<>]|\/?>/g, ' ').replace(/&[a-z#0-9]{2,8};/gi, ' '));
  const PROSE_OK = /^[A-Za-z0-9À-ɏ"'(]/;
  /** a quote a person can read: no markup, starting and ending on a whole word, nothing left of an attribute */
  function cleanQuote(q, max) {
    let x = prose(q).replace(/^[^A-Za-z0-9À-ɏ"'(]+/, '').trim();
    if (!x) return '';
    const limit = Number(max) || 220;
    if (x.length > limit) { const cut = x.slice(0, limit); const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' ')); x = (at > 40 ? cut.slice(0, at) : cut).trim() + '…'; }
    const letters = (x.match(/[A-Za-zÀ-ɏ]/g) || []).length;
    return (x.length >= 24 && letters >= x.length * 0.55 && PROSE_OK.test(x)) ? x : '';
  }
  /** { ok, strength: 'invites' | 'interviews', quote } — with nothing of the sort, ok is false and the show is not pitched */
  function guestSignal(texts) {
    const list = (Array.isArray(texts) ? texts : [texts]).map(t => prose(t)).filter(Boolean);
    for (const t of list) { const m = t.match(INVITE); if (m) { const i = Math.max(0, m.index - 90); return { ok: true, strength: 'invites', quote: cleanQuote(t.slice(i, m.index + 160)) }; } }
    const hits = list.flatMap(t => (t.match(new RegExp(INTERVIEW.source, 'gi')) || []));
    if (hits.length >= 2) { const t = list.find(x => INTERVIEW.test(x)) || ''; const m = t.match(INTERVIEW); return { ok: true, strength: 'interviews', quote: cleanQuote(t.slice(Math.max(0, m.index - 90), m.index + 160)) }; }
    return { ok: false, strength: '', quote: '' };
  }
  /** the show's own description wins over its website, and a stronger signal wins over a weaker one (R27) */
  const RANK = { invites: 2, interviews: 1 };
  function pickSignal(fromFeed, fromSite) {
    const a = fromFeed && fromFeed.ok ? fromFeed : null, b = fromSite && fromSite.ok ? fromSite : null;
    if (a && b) return (RANK[b.strength] || 0) > (RANK[a.strength] || 0) ? b : a;   // the feed is the show's own voice: it only loses to a stronger signal
    return a || b || { ok: false, strength: '', quote: '' };
  }
  // a show with no episode in the last half year is not worth a pitch (the feed is the only evidence either way)
  const STALE_DAYS = 200;
  const stale = (last, now) => { if (!last) return false; const d = (new Date(now || Date.now()).getTime() - new Date(last).getTime()) / 864e5; return d > STALE_DAYS ? Math.round(d) : 0; };
  // R27: a guest appearance costs the owner an hour of their own time, so a show has to be further inside our topics than the 25% that
  // qualifies a page for a link (OK.OFF_TOPIC). 29% is not a show worth an hour.
  const MIN_FIT = 0.4;
  return { searchUrl, shows, feed, guestSignal, pickSignal, cleanQuote, prose, stale, STALE_DAYS, MIN_FIT, APPLE, INDEX, strip };
})();

return $input.all().map(i => { const j = i.json || {};
  return { json: { shows: j.search ? PC.shows(j.search) : [], feed: j.xml ? PC.feed(j.xml) : null, guest: j.texts ? PC.guestSignal(j.texts) : null,
    picked: j.feed_signal || j.site_signal ? PC.pickSignal(j.feed_signal, j.site_signal) : null,
    quote: j.quote === undefined ? null : PC.cleanQuote(j.quote, j.max), prose: j.html_text === undefined ? null : PC.prose(j.html_text),
    stale: j.last === undefined ? null : PC.stale(j.last, j.now), url: PC.searchUrl(j.topic || 'e invoicing uae', !!j.signed),
    stale_days: PC.STALE_DAYS, min_fit: PC.MIN_FIT } }; });
