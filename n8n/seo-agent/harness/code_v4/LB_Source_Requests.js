// Where new opportunities come from this week (free): journalist requests on Bluesky (#journorequest — public API, weekly; matched to the
// site's topics later), and monthly: resource / "useful links" pages on the site's topics (web search, plain phrases: our SearXNG's site:
// searches return nothing since its Brave / DuckDuckGo engines are rate-limited — probe 2026-10-10), best-effort searches for the brand on
// the listing platforms, and our own old URLs in the Wayback Machine (CDX; those that now 404 get a redirect suggestion).
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
function siteKind(businessType, topicText) {   // the checklists that apply: a consultancy that also sells software gets both
  const t = String(businessType || '') + ' ' + String(topicText || '');
  if (/restaurant|cafe|clinic|dental|salon|store|shop|hotel|gym|plumb|electric|lawyer|law firm|real estate|local ?business|medical|spa|bakery/i.test(t)) return ['local'];
  const agency = /agency|consult|marketing services|design studio|development services|professional ?service|accounting firm|audit firm/i.test(t);
  const software = /software|saas|platform|\bapp\b|cloud|e-?invoic|\berp\b|automation|\bapi\b/i.test(t);
  return agency && software ? ['agency', 'saas'] : agency ? ['agency'] : ['saas'];
}

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
  if (p.due.wayback) add(p, 'wayback', 'https://web.archive.org/cdx/search/cdx?url=' + enc(p.domain) + '&matchType=domain&output=json&fl=original,statuscode,timestamp&collapse=urlkey&filter=statuscode:200&limit=3000');
}
return out;
