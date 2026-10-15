// Fixtures for S61 (L5 / L6 / L7, FIX_PLAN): podcast shows and their feeds, journalist-digest prospects the web app wrote from a mailbox,
// the competitors' most-linked pages, and a writer answer with a second subject per sequence. The base rows (site, ladders, profile, ledger,
// Search Console) come from fixtures_lb413.js — this file only adds what the four items need.
const F = require('./fixtures_lb413');
const iso = F.iso;
const day = (d) => iso(d).slice(0, 10);
const utc = (d) => new Date(Date.now() - d * 864e5).toUTCString();

// ---- L5a: the free podcast directory (Apple's shape) and the Podcast Index shape, for one search ----
const podcastSearch = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, data: JSON.stringify({ resultCount: 4, results: [
  { collectionName: 'The Gulf Finance Podcast', trackName: 'The Gulf Finance Podcast', artistName: 'Layla Haddad', feedUrl: 'https://gulffinancepodcast.ae/feed.xml',
    collectionViewUrl: 'https://podcasts.apple.com/ae/podcast/the-gulf-finance-podcast/id1001', trackCount: 84, genres: ['Business', 'Management'], releaseDate: iso(6) },
  { collectionName: 'E-Invoicing Weekly', artistName: 'Nadia Fares', feedUrl: 'https://einvoicingweekly.com/rss',
    collectionViewUrl: 'https://podcasts.apple.com/ae/podcast/e-invoicing-weekly/id1002', trackCount: 40, genres: ['Business'], releaseDate: iso(9) },
  { collectionName: 'Desert Trail Running Show', artistName: 'Omar Sultan', feedUrl: 'https://deserttrailrunning.ae/rss',
    collectionViewUrl: 'https://podcasts.apple.com/ae/podcast/desert-trail/id1003', trackCount: 120, genres: ['Sports'], releaseDate: iso(4) },
  { collectionName: 'The VAT Hour', artistName: 'Finance Press', feedUrl: 'https://vathour.co.uk/feed',
    collectionViewUrl: 'https://podcasts.apple.com/gb/podcast/the-vat-hour/id1004', trackCount: 61, genres: ['Business'], releaseDate: iso(410) },
] }) });
const indexSearch = () => ({ feeds: [{ title: 'The Gulf Finance Podcast', author: 'Layla Haddad', url: 'https://gulffinancepodcast.ae/feed.xml', link: 'https://gulffinancepodcast.ae/',
  episodeCount: 84, categories: { 1: 'Business', 2: 'Investing' }, lastUpdateTime: Math.round((Date.now() - 6 * 864e5) / 1000) }] });

// ---- L5a: one RSS feed per show (the <link> is the only place that names the show's own website) ----
const feed = (o) => '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>'
  + '<title>' + o.title + '</title><link>' + (o.site || '') + '</link>'
  + '<description><![CDATA[' + o.description + ']]></description>'
  + '<itunes:author>' + (o.author || '') + '</itunes:author>'
  + (o.email ? '<itunes:owner><itunes:name>' + (o.author || '') + '</itunes:name><itunes:email>' + o.email + '</itunes:email></itunes:owner>' : '')
  + (o.episodes || []).map(e => '<item><title>' + e.title + '</title><pubDate>' + utc(e.daysAgo) + '</pubDate></item>').join('')
  + '</channel></rss>';
const FEEDS = {
  'https://gulffinancepodcast.ae/feed.xml': feed({ title: 'The Gulf Finance Podcast', site: 'https://gulffinancepodcast.ae/', author: 'Layla Haddad', email: 'press@gulffinancepodcast.ae',
    description: 'Every week Layla Haddad interviews finance leaders in the Gulf about VAT, e-invoicing and the UAE Peppol deadline. If you would like to be a guest on the show, there is a short guest application on our site.',
    episodes: [{ title: 'Peppol in the UAE: what mid-sized ERP teams must do in 2027', daysAgo: 6 }, { title: 'In conversation with a Dubai CFO about e-invoicing software', daysAgo: 13 }] }),
  'https://einvoicingweekly.com/rss': feed({ title: 'E-Invoicing Weekly', site: 'https://einvoicingweekly.com/', author: 'Nadia Fares', email: 'einvoicingweekly@gmail.com',
    description: 'A weekly conversation about e-invoicing, VAT and Peppol in the UAE. We interview one practitioner every week and we welcome guest suggestions.',
    episodes: [{ title: 'Interview: choosing e-invoicing software in the UAE', daysAgo: 9 }, { title: 'My guest this week on Peppol access points', daysAgo: 16 }] }),
  'https://deserttrailrunning.ae/rss': feed({ title: 'Desert Trail Running Show', site: 'https://deserttrailrunning.ae/', author: 'Omar Sultan', email: 'hello@deserttrailrunning.ae',
    description: 'Ultra running in the UAE: training, shoes, heat and the desert race calendar. Want to be a guest on the show? Write to us.',
    episodes: [{ title: 'Interview: 100 km in Al Qudra', daysAgo: 4 }, { title: 'My guest this week on heat training', daysAgo: 11 }] }),
  'https://vathour.co.uk/feed': feed({ title: 'The VAT Hour', site: 'https://vathour.co.uk/', author: 'Finance Press', email: 'studio@vathour.co.uk',
    description: 'Interviews about VAT, e-invoicing and Peppol for finance teams. Be a guest on the show: write to the studio.',
    episodes: [{ title: 'Interview: e-invoicing in the Gulf', daysAgo: 410 }, { title: 'My guest on VAT groups', daysAgo: 430 }] }),
};
// ---- L5a: the shows' own websites (the only domain a contact may come from) ----
const page = (title, body, o = {}) => '<!doctype html><html lang="' + (o.lang || 'en') + '"><head><title>' + title + '</title></head><body><main>' + body + '</main></body></html>';
const SITES = {
  'https://gulffinancepodcast.ae/': page('The Gulf Finance Podcast — e-invoicing, VAT and Peppol in the Gulf',
    '<h1>The Gulf Finance Podcast</h1><p>Interviews with finance leaders about e-invoicing, VAT and the UAE Peppol deadline for ERP teams.</p>'
    + '<h2>Be a guest on the show</h2><p>We record one interview a week. Pitch a guest or yourself: <a href="mailto:press@gulffinancepodcast.ae">press@gulffinancepodcast.ae</a>.</p>'),
  'https://einvoicingweekly.com/': page('E-Invoicing Weekly — the podcast about e-invoicing, VAT and Peppol',
    '<h1>E-Invoicing Weekly</h1><p>A weekly interview about e-invoicing, VAT and Peppol in the UAE for finance and ERP teams.</p>'
    + '<h2>Want to be a guest on the show?</h2><p>Write to <a href="mailto:einvoicingweekly@gmail.com">einvoicingweekly@gmail.com</a> — we read everything.</p>'),
  'https://deserttrailrunning.ae/': page('Desert Trail Running Show',
    '<h1>Desert Trail Running Show</h1><p>Ultra running in the UAE: training in the heat, shoes, nutrition and the desert race calendar.</p>'
    + '<h2>Be a guest on the show</h2><p>Write to <a href="mailto:hello@deserttrailrunning.ae">hello@deserttrailrunning.ae</a>.</p>'),
  'https://vathour.co.uk/': page('The VAT Hour',
    '<h1>The VAT Hour</h1><p>Interviews about VAT, e-invoicing and Peppol for finance teams and their ERP systems.</p>'
    + '<h2>Be a guest</h2><p>Write to <a href="mailto:studio@vathour.co.uk">studio@vathour.co.uk</a>.</p>'),
};
/** the fetch answer for anything S61 adds; everything else falls through to fixtures_lb413 */
const fetchPage = (url) => {
  const u = String(url);
  if (FEEDS[u] !== undefined) return { statusCode: 200, headers: { 'content-type': 'application/rss+xml' }, data: FEEDS[u] };
  if (SITES[u] !== undefined) return { statusCode: 200, headers: { 'content-type': 'text/html' }, data: SITES[u] };
  if (/^https:\/\/(gulffinancepodcast\.ae|einvoicingweekly\.com|deserttrailrunning\.ae|vathour\.co\.uk)\/contact$/.test(u))
    return u.includes('gulffinancepodcast') ? { statusCode: 200, headers: { 'content-type': 'text/html' }, data: page('Contact — The Gulf Finance Podcast', '<p>Guest pitches: <a href="mailto:press@gulffinancepodcast.ae">press@gulffinancepodcast.ae</a>. Layla Haddad, host.</p>') }
      : { statusCode: 404, headers: {}, data: 'not found' };   // the other shows publish no address on their own domain
  return F.fetchPage(url);
};

// ---- L5b: the journalist digests the web app read in the customer's mailbox and wrote as `digest` prospects ----
const digests = () => [
  { site_id: F.SITE, domain: F.DOMAIN, prospect_domain: 'gulfbusiness.com', type: 'digest', rank: 0, spam_score: 0,
    detail: 'Gulf Business: looking for a UAE-based e-invoicing specialist to explain what the Peppol five-corner model means for mid-sized companies and their ERP systems. Please include your name, title and company.',
    source_url: 'https://www.sourceofsources.com/', target_url: '', status: 'new', first_seen: iso(1), last_seen: iso(1), won_at: '', outreach_subject: '', outreach_body: '',
    note: 'Source of Sources digest · Gulf Business · deadline ' + day(-7), score: 0, origin: 'digest', contact_email: 'query-8f21@email.sosresponse.com', contact_url: 'https://www.sourceofsources.com/',
    contacted_at: '', followup_step: 0, followup_subject: '', followup_body: '', verified_at: '', drafted_at: '' },
  { site_id: F.SITE, domain: F.DOMAIN, prospect_domain: 'petfoodweekly.com', type: 'digest', rank: 0, spam_score: 0,
    detail: 'Pet Food Weekly: seeking dog nutritionists to comment on grain-free diets for a feature on puppy feeding.',
    source_url: 'https://www.sourceofsources.com/', target_url: '', status: 'new', first_seen: iso(1), last_seen: iso(1), won_at: '', outreach_subject: '', outreach_body: '',
    note: 'Source of Sources digest · Pet Food Weekly · deadline ' + day(-5), score: 0, origin: 'digest', contact_email: 'query-9a01@email.sosresponse.com', contact_url: 'https://www.sourceofsources.com/',
    contacted_at: '', followup_step: 0, followup_subject: '', followup_body: '', verified_at: '', drafted_at: '' },
];
const anonDigest = () => ({ site_id: F.SITE, domain: F.DOMAIN, prospect_domain: 'sos/7c44', type: 'digest', rank: 0, spam_score: 0,
  detail: 'Finance Middle East: need a UAE e-invoicing practitioner to say what Peppol access points cost a mid-sized ERP team in the first year.',
  source_url: '', target_url: '', status: 'new', first_seen: iso(1), last_seen: iso(1), won_at: '', outreach_subject: '', outreach_body: '',
  note: 'Source of Sources digest \u00b7 Finance Middle East \u00b7 deadline ' + day(-4), score: 0, origin: 'digest', contact_email: 'query-7c44@email.sosresponse.com', contact_url: '',
  contacted_at: '', followup_step: 0, followup_subject: '', followup_body: '', verified_at: '', drafted_at: '' });
const DIGEST_SAMPLE = [
  'SOURCE OF SOURCES — Daily digest, ' + day(0),
  '',
  '1) Summary: UAE e-invoicing specialist for Peppol feature',
  'Name: Gulf Business',
  'Category: Business and Finance',
  'Email: query-8f21@email.sosresponse.com',
  'Media Outlet: Gulf Business',
  'Deadline: ' + day(-7) + ' 5:00 PM GST',
  'Query: Looking for a UAE-based e-invoicing specialist to explain what the Peppol five-corner model means for mid-sized companies and their ERP systems. Please include your name, title and company.',
  'Requirements: UAE-based practitioners only.',
  '',
  '2) Summary: Dog nutritionists on grain-free diets',
  'Name: Pet Food Weekly',
  'Email: query-9a01@email.sosresponse.com',
  'Media Outlet: Pet Food Weekly',
  'Deadline: ' + day(-5) + ' 12:00 PM ET',
  'Query: Seeking dog nutritionists to comment on grain-free diets for a feature on puppy feeding.',
  '',
  'To stop receiving these e-mails, unsubscribe here.',
].join('\n');

// ---- L6: the competitors' most-linked pages (DataForSEO backlinks/domain_pages) ----
const dfsPages = (competitor) => ({ tasks: [{ status_code: 20000, status_message: 'Ok.', cost: 0.0202, result: [{ total_count: 5, items_count: 5, items: [
  { url: 'https://' + competitor + '/', meta: { title: competitor + ' — e-invoicing software' }, referring_domains: 310, backlinks: 2100 },
  { url: 'https://' + competitor + '/blog/uae-e-invoicing-statistics-2026', meta: { title: 'UAE e-invoicing statistics 2026: a survey of 400 finance teams' }, referring_domains: 41, backlinks: 180 },
  { url: 'https://' + competitor + '/tools/vat-penalty-calculator', meta: { title: 'VAT penalty calculator for the UAE' }, referring_domains: 18, backlinks: 54 },
  { url: 'https://' + competitor + '/guides/peppol-explained', meta: { title: 'Peppol explained: the complete guide for finance teams' }, referring_domains: 12, backlinks: 26 },
  { url: 'https://' + competitor + '/blog/we-are-hiring', meta: { title: 'We are hiring' }, referring_domains: 1, backlinks: 2 },
] }] }] });

// ---- L7: the writer's answer, now with a second subject per sequence (one of them unusable on purpose) ----
const writer = (jobs) => ({ output: { sequences: jobs.map((j, i) => ({
  n: j.n,
  subject_b: j.prospect_domain === 'azdan.com' ? 'Add our UAE e-invoicing guide to your backlink list and we will return the favour with a dofollow link' : 'Add a UAE e-invoicing guide to your list?',
  steps: (['press', 'digest'].includes(j.type)
    ? [{ step: 0, subject: 'Re: ' + String(j.page_title || 'your request').slice(0, 40), body: 'Hello, answering your request: the Peppol five-corner model means a UAE company sends invoices through an accredited access point rather than by e-mail, so the ERP has to be connected once and tested. Mid-sized finance teams need about eight weeks for that, and the order matters: master data first, then the access point, then the tax codes. Happy to look at a draft if that helps. Our homepage is ' + j.target_url + '. Sara Khan, Head of Finance Systems, Techand Systems' }, { step: 1, body: 'One more detail for your piece: the deadline applies per company size band, which is where most teams get the timing wrong. Sara Khan, Techand Systems' }]
    : j.type === 'podcast'
      // R27 (2026-10-14): the evidence the writer is given is now the show's OWN description (its website is quoted only when the feed says
      // nothing), so the first e-mail quotes that — exactly what the draft gate checks it against
      ? [{ step: 0, subject: 'A guest on UAE e-invoicing for your show', body: 'Hello, your show description says there is a short guest application on our site and that you interview finance leaders in the Gulf. I work on e-invoicing projects in the UAE and could talk about what the Peppol deadline means for ERP teams, what goes wrong in testing, and how finance teams plan the eight weeks around it. Your listeners would get the practical order of work, not a product pitch. Would an episode on that suit your listeners? More about us: ' + j.target_url + '. Sara Khan, Head of Finance Systems, Techand Systems' }, { step: 1, body: 'One more idea for the episode: the three mistakes that delay an access-point test by weeks. Happy to send them as notes first. Sara Khan, Techand Systems' }, { step: 2, body: 'Who books your guests? If it is not a fit, no problem — I will not write again. Sara Khan, Techand Systems' }]
      : [{ step: 0, subject: 'A note on your e-invoicing page', body: 'Hello, I read "' + String(j.page_title || 'your page') + '" this morning. Our page on the same subject is here: ' + j.target_url + '. Would you like me to send a one-line description for it? Sara Khan, Head of Finance Systems, Techand Systems' }, { step: 1, body: 'One more detail: the page lists each provider with the standard it supports. Happy to send it as plain text.' }, { step: 2, body: 'Who would be the right person for this? If it is not a fit, no problem — I will not write again.' }]),
})), skip: [] } });

module.exports = { podcastSearch, indexSearch, feed, FEEDS, SITES, fetchPage, digests, anonDigest, DIGEST_SAMPLE, dfsPages, writer, page, day };
