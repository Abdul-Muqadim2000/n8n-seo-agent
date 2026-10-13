// Where new opportunities come from this week (free): journalist requests on Bluesky (#journorequest — public API, weekly; matched to the
// site's topics later), and monthly: resource / "useful links" pages on the site's topics (web search, plain phrases: our SearXNG's site:
// searches return nothing since its Brave / DuckDuckGo engines are rate-limited — probe 2026-10-10), best-effort searches for the brand on
// the listing platforms, and our own old URLs in the Wayback Machine (CDX; those that now 404 get a redirect suggestion).
// L5 (2026-10-13): and monthly, podcast shows on the site's topics from a free podcast directory (PC.searchUrl; the Podcast Index key
// cannot be used from a node yet — see v5/code/_podcast.js). Journalist digests (HARO / Source of Sources) are not read here: they
// arrive in the customer's own mailbox, so the web app reads them and writes the requests as `digest` prospects.
// ---- the "links you can add yourself" checklist (v4.13, LINK_BUILDER_SPEC.md §4; inlined by the build) ----
// Research 2026-10-10 (fetched profiles, platform docs): most big directories block automated checks (G2 DataDome, Capterra, Clutch, TrustRadius,
// Product Hunt, Crunchbase → 403 / challenge), so detection uses what can be seen: the site's own and its competitors' links and sameAs to
// the platform, our link ledger and GA4 referrals, a guessed profile URL where the platform answers, and the platform's public page or list.
// A blocked check is "unknown", never "missing". Link kinds as seen on real profiles (they change: re-checked, never hard-coded in the UI):
// TrustRadius followed; Clutch / GoodFirms / SaaSHub nofollow; Product Hunt ugc; G2 no crawlable link; Capterra none on free profiles.
// Nothing is submitted for the customer (the platforms' terms forbid bots; Google names automated link creation as link spam).
// fields: id, name, host (link / referral matching), cat, kinds (saas | agency | local | any), countries (ISO-2 list, empty = all), topics
// (regex on the site's topics / business type, optional), integ (regex on the site's own pages: shown only for integrations it has),
// re (profile URL), guess (profile URL from { slug, domain }), fetchable (answers a plain fetch), list (a single public page that lists
// members: fetched and searched for the domain / name), link, ai (how much AI answers draw on it), prio (1 first), submit, why.
const LISTINGS = [
  { id: 'mof_asp', name: 'UAE Ministry of Finance — accredited e-invoicing providers', host: 'mof.gov.ae', cat: 'government', kinds: ['saas', 'agency', 'any'], countries: ['AE'], topics: /e-?invoic|peppol|einvoic/i,
    list: 'https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-providers/', link: 'followed', ai: 'high', prio: 1, submit: 'https://mof.gov.ae/en/about-us/initiatives/einvoicing/',
    why: 'Only accredited providers may offer e-invoicing in the UAE; each listed provider gets a followed link from the Ministry, and AI answers cite this page. Accreditation: Peppol-certified provider for 2 years, ISO 27001 + 22301, insurance — or appear through your accredited partner.' },
  { id: 'openpeppol', name: 'OpenPeppol certified service providers', host: 'peppol.org', cat: 'industry', kinds: ['saas', 'any'], countries: [], topics: /e-?invoic|peppol|einvoic/i,
    list: 'https://peppol.org/members/peppol-certified-service-providers/', link: 'none', ai: 'medium', prio: 2, submit: 'https://peppol.org/join/',
    why: 'The industry body\'s list of certified access points; a strong trust signal for buyers and AI, required for UAE accreditation.' },
  { id: 'g2', name: 'G2', host: 'g2.com', cat: 'reviews', kinds: ['saas'], re: /g2\.com\/products\/([a-z0-9-]+)/i, guess: (x) => 'https://www.g2.com/products/' + x.slug + '/reviews',
    link: 'none', ai: 'high', prio: 1, submit: 'https://sell.g2.com/', why: 'Buyers and AI assistants read G2 when comparing software; G2 also runs Capterra, GetApp and Software Advice.' },
  { id: 'capterra', name: 'Capterra / GetApp / Software Advice', host: 'capterra.com', cat: 'reviews', kinds: ['saas'], re: /capterra\.com\/p\/\d+\/[^\/"'\s]+/i,
    link: 'none', ai: 'high', prio: 1, submit: 'https://www.capterra.com/vendors/', why: 'One listing reaches three comparison sites that buyers and AI answers use for "best X software".' },
  { id: 'trustradius', name: 'TrustRadius', host: 'trustradius.com', cat: 'reviews', kinds: ['saas'], re: /trustradius\.com\/products\/([a-z0-9-]+)/i, guess: (x) => 'https://www.trustradius.com/products/' + x.slug + '/reviews',
    link: 'followed', ai: 'medium', prio: 1, submit: 'https://www.trustradius.com/vendors', why: 'The one big review site whose vendor button is a followed link.' },
  { id: 'saashub', name: 'SaaSHub', host: 'saashub.com', cat: 'directory', kinds: ['saas'], re: /saashub\.com\/([a-z0-9-]+)$/i, guess: (x) => 'https://www.saashub.com/' + x.slug, fetchable: true,
    link: 'nofollow', ai: 'low', prio: 3, submit: 'https://www.saashub.com/submit', why: 'Free listing with alternatives pages buyers browse.' },
  { id: 'alternativeto', name: 'AlternativeTo', host: 'alternativeto.net', cat: 'directory', kinds: ['saas'], re: /alternativeto\.net\/software\/([a-z0-9-]+)/i, guess: (x) => 'https://alternativeto.net/software/' + x.slug + '/about/',
    link: 'unknown', ai: 'low', prio: 3, submit: 'https://alternativeto.net/', why: 'Shown when people look for alternatives to your competitors.' },
  { id: 'producthunt', name: 'Product Hunt', host: 'producthunt.com', cat: 'launch', kinds: ['saas'], re: /producthunt\.com\/(products|posts)\/([a-z0-9-]+)/i, guess: (x) => 'https://www.producthunt.com/products/' + x.slug,
    link: 'ugc', ai: 'low', prio: 3, submit: 'https://www.producthunt.com/posts/new', why: 'A launch page and a burst of visitors; worth it with a real launch or new feature.' },
  { id: 'crunchbase', name: 'Crunchbase', host: 'crunchbase.com', cat: 'company', kinds: ['saas', 'agency', 'any'], re: /crunchbase\.com\/organization\/([a-z0-9-]+)/i, guess: (x) => 'https://www.crunchbase.com/organization/' + x.slug,
    link: 'nofollow', ai: 'medium', prio: 2, submit: 'https://www.crunchbase.com/', why: 'The company database journalists, investors and AI assistants use to describe a business.' },
  { id: 'linkedin', name: 'LinkedIn company page', host: 'linkedin.com', cat: 'social', kinds: ['saas', 'agency', 'local', 'any'], re: /linkedin\.com\/company\/([a-z0-9-]+)/i,
    link: 'nofollow', ai: 'high', prio: 1, submit: 'https://www.linkedin.com/company/setup/new/', why: 'AI answers on B2B topics cite LinkedIn; buyers check it before they reply.' },
  { id: 'youtube', name: 'YouTube channel', host: 'youtube.com', cat: 'social', kinds: ['saas', 'agency', 'local', 'any'], re: /youtube\.com\/(@[a-z0-9._-]+|channel\/[a-z0-9_-]+|c\/[a-z0-9_-]+)/i,
    link: 'nofollow', ai: 'high', prio: 2, submit: 'https://www.youtube.com/create_channel', why: 'YouTube mentions correlate with AI visibility more than any other signal (Ahrefs 2025); short explainers are enough.' },
  { id: 'trustpilot', name: 'Trustpilot', host: 'trustpilot.com', cat: 'reviews', kinds: ['local', 'any'], re: /trustpilot\.com\/review\/([a-z0-9.-]+)/i, guess: (x) => 'https://www.trustpilot.com/review/' + x.domain,
    link: 'nofollow', ai: 'medium', prio: 3, submit: 'https://business.trustpilot.com/', why: 'Reviews for small-business and consumer buyers.' },
  { id: 'clutch', name: 'Clutch', host: 'clutch.co', cat: 'reviews', kinds: ['agency'], re: /clutch\.co\/profile\/([a-z0-9-]+)/i, guess: (x) => 'https://clutch.co/profile/' + x.slug,
    link: 'nofollow', ai: 'medium', prio: 1, submit: 'https://clutch.co/get-listed', why: 'The review site buyers use to shortlist agencies and service firms.' },
  { id: 'goodfirms', name: 'GoodFirms', host: 'goodfirms.co', cat: 'reviews', kinds: ['agency', 'saas'], re: /goodfirms\.co\/(company|software)\/([a-z0-9-]+)/i, guess: (x) => 'https://www.goodfirms.co/company/' + x.slug,
    link: 'nofollow', ai: 'low', prio: 2, submit: 'https://www.goodfirms.co/get-listed', why: 'Agency and software directory with category rankings.' },
  { id: 'designrush', name: 'DesignRush', host: 'designrush.com', cat: 'directory', kinds: ['agency'], re: /designrush\.com\/agency\/profile\/([a-z0-9-]+)/i,
    link: 'unknown', ai: 'low', prio: 3, submit: 'https://www.designrush.com/agency/get-listed', why: 'Agency directory with "best agencies" lists.' },
  { id: 'google_business', name: 'Google Business Profile', host: 'google.com', cat: 'local', kinds: ['local'], re: /(google\.[a-z.]+\/maps\/place|g\.page|maps\.app\.goo\.gl)/i,
    link: 'website', ai: 'high', prio: 1, submit: 'https://business.google.com/', why: 'Maps and local results; only for a staffed office or a service area (online-only businesses are not eligible).' },
  { id: 'bing_places', name: 'Bing Places', host: 'bing.com', cat: 'local', kinds: ['local'], link: 'website', ai: 'medium', prio: 2, submit: 'https://www.bingplaces.com/', why: 'Bing Maps and Copilot; imports your Google profile in a few clicks.' },
  { id: 'apple_business', name: 'Apple Business', host: 'apple.com', cat: 'local', kinds: ['local'], link: 'website', ai: 'low', prio: 2, submit: 'https://business.apple.com/', why: 'Apple Maps and Siri.' },
  { id: 'facebook', name: 'Facebook page', host: 'facebook.com', cat: 'social', kinds: ['local'], re: /facebook\.com\/([a-z0-9.]+)\/?$/i, link: 'nofollow', ai: 'low', prio: 3, submit: 'https://www.facebook.com/pages/create', why: 'Local customers check it for hours and reviews.' },
  { id: 'yellowpages_uae', name: 'Yellow Pages UAE', host: 'yellowpages-uae.com', cat: 'directory', kinds: ['saas', 'agency', 'local', 'any'], countries: ['AE'], re: /yellowpages-uae\.com\/[^"'\s]+/i,
    link: 'unknown', ai: 'low', prio: 3, submit: 'https://www.yellowpages-uae.com/pages/list-your-business', why: 'Free UAE business listing with a link to your website.' },
  { id: 'dubai_chambers', name: 'Dubai Chambers commercial directory', host: 'dubaichambers.com', cat: 'chamber', kinds: ['saas', 'agency', 'local', 'any'], countries: ['AE'],
    link: 'unknown', ai: 'low', prio: 3, submit: 'https://www.dubaichambers.com/', why: 'For members: the chamber directory buyers and partners search.' },
  { id: 'appsource', name: 'Microsoft Marketplace (AppSource)', host: 'appsource.microsoft.com', cat: 'marketplace', kinds: ['saas'], integ: /microsoft dynamics|dynamics 365|business central|microsoft 365|azure/i,
    link: 'unknown', ai: 'medium', prio: 2, submit: 'https://partner.microsoft.com/', why: 'A "Contact me" listing has no technical requirements; Dynamics customers look for add-ons there.' },
  { id: 'zoho_marketplace', name: 'Zoho Marketplace', host: 'marketplace.zoho.com', cat: 'marketplace', kinds: ['saas'], integ: /\bzoho\b/i, link: 'unknown', ai: 'low', prio: 2, submit: 'https://marketplace.zoho.com/', why: 'Zoho Books / Invoice users find integrations there.' },
  { id: 'odoo_apps', name: 'Odoo Apps', host: 'apps.odoo.com', cat: 'marketplace', kinds: ['saas'], integ: /\bodoo\b/i, link: 'unknown', ai: 'low', prio: 2, submit: 'https://apps.odoo.com/', why: 'Odoo users install connectors from the app store.' },
  { id: 'sap_store', name: 'SAP Store', host: 'store.sap.com', cat: 'marketplace', kinds: ['saas'], integ: /\bsap\b/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://www.sap.com/partners.html', why: 'Through the SAP partner programme; for SAP integrations.' },
  { id: 'hubspot_marketplace', name: 'HubSpot App Marketplace', host: 'ecosystem.hubspot.com', cat: 'marketplace', kinds: ['saas'], integ: /\bhubspot\b/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://developers.hubspot.com/', why: 'Needs 3+ active installs; for a real HubSpot integration.' },
  { id: 'xero_apps', name: 'Xero App Store', host: 'apps.xero.com', cat: 'marketplace', kinds: ['saas'], integ: /\bxero\b/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://developer.xero.com/', why: 'For a Xero integration.' },
  { id: 'quickbooks_apps', name: 'QuickBooks App Store', host: 'apps.intuit.com', cat: 'marketplace', kinds: ['saas'], integ: /quickbooks/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://developer.intuit.com/', why: 'For a QuickBooks integration.' }];
const LISTING_HOSTS = LISTINGS.map(l => l.host);
// which entries apply to a site: its kind (from the business type and topics), country, topics, and the integrations its own pages name
function listingsFor(kinds, iso, topicText, siteText) {
  const K = Array.isArray(kinds) ? kinds : [kinds];
  return LISTINGS.filter(l => (K.some(k => l.kinds.includes(k)) || (l.kinds.includes('any') && !K.includes('local') && l.cat !== 'local')) && (!l.countries || !l.countries.length || l.countries.includes(String(iso || '').toUpperCase()))
    && (!l.topics || l.topics.test(topicText || '')) && (!l.integ || l.integ.test(siteText || '')));
}
// What a fetched listing page is allowed to claim (P34-2, live 2026-10-12): three listings came back "listed" when they were not —
// SaaSHub and the UAE Ministry of Finance list because the brand "Tech&" matched the plain word "tech" (neither page contains
// "techand"), AlternativeTo because a 403 bot wall was read as a profile found by search. A listing is claimed only on hard evidence:
// a link to our host (linked), or the page naming us distinctively (listed; OK.namesUs decides what counts as a name). A blocked or
// challenged page claims nothing — "unknown", never "listed" and never "missing" — and the caller keeps the last definite answer.
// o: { blocked, status, links_us, rel, named, as_list, guessed, gone, url }
function listingClaim(o) {
  const x = o || {}; const where = x.as_list ? 'list' : 'profile';
  if (x.blocked) return { status: 'unknown', evidence: 'the platform blocked this check' + (x.status ? ' (HTTP ' + x.status + ')' : '') + ': nothing can be read from it' };
  if (x.links_us) return { status: 'linked', evidence: 'the ' + where + ' links to you' };
  if (x.named) return { status: 'listed', evidence: 'the ' + where + ' names you ("' + String(x.named).slice(0, 40) + '") without a link' };
  if (x.gone) return x.guessed ? { status: 'missing', evidence: 'no profile at ' + String(x.url || '') } : { status: 'unknown', evidence: 'the page we found is gone: check the platform' };
  if (x.as_list) return { status: 'missing', evidence: 'the list does not name you' };
  return { status: 'unknown', evidence: 'the page at ' + String(x.url || '') + ' does not name you: it may belong to another product, or your profile may use a different name' };
}
function siteKind(businessType, topicText) {   // the checklists that apply: a consultancy that also sells software gets both
  const t = String(businessType || '') + ' ' + String(topicText || '');
  if (/restaurant|cafe|clinic|dental|salon|store|shop|hotel|gym|plumb|electric|lawyer|law firm|real estate|local ?business|medical|spa|bakery/i.test(t)) return ['local'];
  const agency = /agency|consult|marketing services|design studio|development services|professional ?service|accounting firm|audit firm/i.test(t);
  const software = /software|saas|platform|\bapp\b|cloud|e-?invoic|\berp\b|automation|\bapi\b/i.test(t);
  return agency && software ? ['agency', 'saas'] : agency ? ['agency'] : ['saas'];
}

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
  /** { ok, strength: 'invites' | 'interviews', quote } — with nothing of the sort, ok is false and the show is not pitched */
  function guestSignal(texts) {
    const list = (Array.isArray(texts) ? texts : [texts]).map(S).filter(Boolean);
    for (const t of list) { const m = t.match(INVITE); if (m) { const i = Math.max(0, m.index - 90); return { ok: true, strength: 'invites', quote: t.slice(i, m.index + 160).trim() }; } }
    const hits = list.flatMap(t => (t.match(new RegExp(INTERVIEW.source, 'gi')) || []));
    if (hits.length >= 2) { const t = list.find(x => INTERVIEW.test(x)) || ''; const m = t.match(INTERVIEW); return { ok: true, strength: 'interviews', quote: t.slice(Math.max(0, m.index - 90), m.index + 160).trim() }; }
    return { ok: false, strength: '', quote: '' };
  }
  // a show with no episode in the last half year is not worth a pitch (the feed is the only evidence either way)
  const STALE_DAYS = 200;
  const stale = (last, now) => { if (!last) return false; const d = (new Date(now || Date.now()).getTime() - new Date(last).getTime()) / 864e5; return d > STALE_DAYS ? Math.round(d) : 0; };
  return { searchUrl, shows, feed, guestSignal, stale, STALE_DAYS, APPLE, INDEX, strip };
})();
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const enc = encodeURIComponent; const out = [];
const add = (p, kind, url, extra = {}) => out.push({ json: { site_id: p ? p.site_id : '', kind, url, ...extra } });
add(null, 'press', 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=' + enc('#journorequest') + '&sort=latest&limit=100');
for (const p of plans) {
  for (const t of p.topics.slice(0, 3)) { const w = t.split(/\s+/).filter(x => x.length > 3).slice(0, 2).join(' '); if (w) add(p, 'press', 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=' + enc('journorequest ' + w) + '&sort=latest&limit=50', { topic: t }); }
  if (p.due.resources) for (const t of p.topics.slice(0, 2)) {
    add(p, 'resource_search', 'http://searxng:8080/search?format=json&q=' + enc('"' + t + '" "useful links"'), { topic: t });
    add(p, 'resource_search', 'http://searxng:8080/search?format=json&q=' + enc(t + (p.country && !t.includes(p.country.toLowerCase()) ? ' ' + p.country : '') + ' resources links'), { topic: t });
  }
  if (p.due.listings) { const kind = siteKind(p.profile.business_type, p.topics.join(' ')); for (const l of listingsFor(kind, p.country_iso, p.topics.join(' ') + ' ' + p.profile.business_type, '').filter(l => l.re && !l.list).slice(0, 8))
    add(p, 'listing_search', 'http://searxng:8080/search?format=json&q=' + enc('"' + p.brand + '" ' + l.name.split(/[\s(—/]/)[0]), { listing_id: l.id }); }
  if (p.due.podcasts) for (const t of p.topics.slice(0, 2)) add(p, 'podcast_search', PC.searchUrl(t, false), { topic: t });
  if (p.due.wayback) add(p, 'wayback', 'https://web.archive.org/cdx/search/cdx?url=' + enc(p.domain) + '&matchType=domain&output=json&fl=original,statuscode,timestamp&collapse=urlkey&filter=statuscode:200&limit=3000');
}
return out;
