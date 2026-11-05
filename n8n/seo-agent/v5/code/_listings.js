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
  { id: 'quickbooks_apps', name: 'QuickBooks App Store', host: 'apps.intuit.com', cat: 'marketplace', kinds: ['saas'], integ: /quickbooks/i, link: 'unknown', ai: 'low', prio: 3, submit: 'https://developer.intuit.com/', why: 'For a QuickBooks integration.' },
  // ---- AIR (2026-11-06, docs/ai-ranking-2026-11-05 DESIGN 2.F lever L09, package P6): the directories of B2B service firms that AI answers to
  // "which firm should I hire for X" draw on (R2 / R4: list- and directory-dominated recommendation answers). `air: true` = offered ONLY to a
  // website whose AI ranking is `on` (listingsFor's opts.air); every other website gets exactly the checklist it had. Clutch, GoodFirms and
  // DesignRush above already serve agencies; these add the rest of the set. Nothing is submitted for the client.
  { id: 'themanifest', name: 'The Manifest', host: 'themanifest.com', cat: 'reviews', kinds: ['agency'], air: true, re: /themanifest\.com\/company\/([a-z0-9-]+)/i,
    link: 'unknown', ai: 'medium', prio: 2, submit: 'https://themanifest.com/', why: 'A sister site of Clutch with shortlists of service firms by service and city; AI answers to "which firm should I hire" cite such lists.' },
  { id: 'sortlist', name: 'Sortlist', host: 'sortlist.com', cat: 'directory', kinds: ['agency'], air: true, re: /sortlist\.[a-z.]+\/agency\/([a-z0-9-]+)/i,
    link: 'unknown', ai: 'medium', prio: 2, submit: 'https://www.sortlist.com/', why: 'A marketplace where buyers brief and shortlist agencies and development firms; its agency pages are read by AI answers about providers.' },
  { id: 'ms_partner_dir', name: 'Microsoft partner directory', host: 'appsource.microsoft.com', cat: 'partner', kinds: ['agency', 'saas'], air: true, re: /appsource\.microsoft\.com\/[a-z-]+\/marketplace\/partner-dir\/[^"'\s]+/i, integ: /microsoft|dynamics 365|business central|power bi|power platform|azure|microsoft 365|sharepoint/i,
    link: 'unknown', ai: 'medium', prio: 1, submit: 'https://partner.microsoft.com/', why: 'For a Microsoft partner: the official directory buyers search for implementation partners; a listing needs a partner account and a published profile.' },
  { id: 'pasha', name: 'P@SHA member directory (Pakistan Software Houses Association)', host: 'pasha.org.pk', cat: 'industry', kinds: ['agency', 'saas'], countries: ['PK'], air: true,
    link: 'unknown', ai: 'low', prio: 2, submit: 'https://www.pasha.org.pk/', why: 'For software firms in Pakistan: the industry association\'s member list, a trust signal buyers and AI answers read.' }];
const LISTING_HOSTS = LISTINGS.map(l => l.host);
// which entries apply to a site: its kind (from the business type and topics), country, topics, and the integrations its own pages name
// opts.air (AIR P6): true only for a website whose AI ranking is `on`; without it the entries marked `air` are never offered (today's checklist)
function listingsFor(kinds, iso, topicText, siteText, opts) {
  const K = Array.isArray(kinds) ? kinds : [kinds]; const air = !!(opts && opts.air === true);
  return LISTINGS.filter(l => (!l.air || air) && (K.some(k => l.kinds.includes(k)) || (l.kinds.includes('any') && !K.includes('local') && l.cat !== 'local')) && (!l.countries || !l.countries.length || l.countries.includes(String(iso || '').toUpperCase()))
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
function siteKind(businessType, topicText, opts) {   // the checklists that apply: a consultancy that also sells software gets both
  const t = String(businessType || '') + ' ' + String(topicText || '');
  // AIR P6 (opts.air, on websites only): a firm that builds or implements software FOR clients is a service firm and a software seller, so it gets
  // both checklists (the service-firm directories are where AI answers about providers look); every other website is judged as before
  if (opts && opts.air === true && !/restaurant|cafe|clinic|dental|salon|store|shop|hotel|gym|plumb|electric|lawyer|law firm|real estate|local ?business|medical|spa|bakery/i.test(t)
    && /software (development|house|company|agency|firm)|custom software|development (company|firm|agency|partner)|app development|web development|it services|implementation (partner|services)|systems? integrat|consultanc|consulting|outsourc|dedicated (team|developers)/i.test(t)) return ['agency', 'saas'];
  if (/restaurant|cafe|clinic|dental|salon|store|shop|hotel|gym|plumb|electric|lawyer|law firm|real estate|local ?business|medical|spa|bakery/i.test(t)) return ['local'];
  const agency = /agency|consult|marketing services|design studio|development services|professional ?service|accounting firm|audit firm/i.test(t);
  const software = /software|saas|platform|\bapp\b|cloud|e-?invoic|\berp\b|automation|\bapi\b/i.test(t);
  return agency && software ? ['agency', 'saas'] : agency ? ['agency'] : ['saas'];
}
