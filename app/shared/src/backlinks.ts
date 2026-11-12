// Client report 2026-11-11 (devaicon.com, N45): what each referring site in the link ledger IS, in the client's words.
//
// The ledger held 1,288 "referring sites" for devaicon.com; 1,280 of them were pages nobody made for devaicon: automatic "website report /
// SEO stats / traffic bot" pages on new cheap domains (bottraffic.site, organicseo.shop, sitereport.space ...) that DataForSEO lists for
// every site, and link-farm pages (/dir/quality-backlink-services-53866 on 488 sites). The farms were already labelled spam by the
// engine's footprint gate (LK.footprints) because they share a page path; the automatic report sites came from DataForSEO's referring
// domains list, which has no page address, no anchor and no title, so no footprint could see them, and LK.values scored their missing
// inputs as average: SEO value 50-52, so 775 of them were the client's "Best" links. This module sorts every row into one of five
// kinds, says what each means and what to do, and decides what the page counts as a link that matters (Best, Lost, the headline).
// The engine's mirror is proposed in docs/client-reports-2026-11-11 (N45): LK.isAutoReport in v5/code/_link_kit.js, so the scores and the
// report agree with the page; until it ships, this reading is the page's.
import type { BacklinkRef } from './data';

export type LinkKind = 'real' | 'listing' | 'auto' | 'farm' | 'unknown';

export const LINK_KIND_ORDER: readonly LinkKind[] = ['real', 'listing', 'unknown', 'auto', 'farm'];

/** What each kind means and what to do about it, in the client's words (no vendor or table names). */
export const LINK_KINDS: Record<LinkKind, { label: string; what: string; todo: string; counts: boolean }> = {
  real: {
    label: 'Real links',
    what: 'A link on a real website: an article, a partner, a resource page.',
    todo: 'Keep them. These are the links that help you in search.',
    counts: true,
  },
  listing: {
    label: 'Listings and profiles',
    what: 'Your company, job or member pages on directories and networks (for example Crunchbase, GitHub, LinkedIn).',
    todo: 'Keep them up to date. They pass little in search but help people and AI answers find you.',
    counts: true,
  },
  unknown: {
    label: 'Not identified yet',
    what: 'A site one source named without the page that links to you, so there is nothing to open yet.',
    todo: 'Nothing to do. It is sorted once a source gives the page.',
    counts: true,
  },
  auto: {
    label: 'Automatic report pages',
    what: 'Pages that tools make for every website on their own: site reports, SEO stats, traffic and "website worth" pages. Nobody chose to link to you.',
    todo: 'Nothing to do. Every website gets them and Google ignores them. They do not hurt you and you do not need to disavow them.',
    counts: false,
  },
  farm: {
    label: 'Link farms and spam',
    what: 'Pages that sell links or repeat the same page on hundreds of sites.',
    todo: 'Nothing to do. Google ignores these on its own. Use the disavow list only if Google sends you a manual action about links.',
    counts: false,
  },
};

// New cheap domain endings the automatic report networks are registered on (live 2026-11-11: .shop 219, .store 210, .website 205,
// .online 201, .site 197, .space 186 of devaicon.com's 1,290 rows). A real business on one of them is kept unless its name is also
// made of SEO-tool words AND only a link index has ever named it.
const CHEAP_TLD = new Set(['shop', 'store', 'site', 'online', 'website', 'space', 'xyz', 'top', 'icu', 'click', 'link', 'fun', 'buzz', 'monster', 'cfd', 'sbs', 'cyou', 'bond', 'quest', 'rest', 'lol', 'pw', 'cam', 'bar', 'mom', 'vip', 'win', 'bid', 'loan', 'work', 'party']);
// the words those networks build their names from (trafficyour, checkvisitorsite, domainanalytics, pageranking, sitereport ...)
const TOOL_WORD = /seo|traffic|backlink|rank|serp|visit|audit|analy[sz]|metric|stat|report|monitor|check|crawl|index|domain|url|page|site|web|link|organic|keyword|score|worth|value|bot|hits|click|track|insight|spy|lookup|search|position|authority|referr|views?|boost|signal|scan|tool|data|info|trend|rate|test|review|list|dir|catalog|submit/;
// site checkers and "website worth" / WHOIS pages on established domains (the engine's LK.isScraper list plus the trust checkers)
// review D11 (2026-11-11): whole name parts only (worthington.edu, informer.ae, valuationexperts.com are not report pages); same as the engine's LK
const REPORT_HOST = /(^|[.-])(whois|who\.is|siteprice|sitestats?|site-?info|hypestat|similarsites?|sitelike|sitesimilar|websiteoutlook|statshow|domaintools|robtex|builtwith|urlscan|siteindices|dnslytics|ipaddress|host\.io|domainbigdata|webstatsdomain|siteliner|rank2traffic|websiteinformer|traffic-?estimate|seo-?analy[sz]er|seositecheckup|sitechecker|domainstats|scamadviser|scam-?detector|trustscam|isitlegit|urlvoid|siteadvisor|scamdoc|gridinsoft)(?=[.-])/;
// directories, networks and job boards: the site's own profile or listing
const LISTING_HOST = /(^|\.)(github\.com|gitlab\.com|linkedin\.com|crunchbase\.com|bebee\.com|clutch\.co|goodfirms\.co|g2\.com|capterra\.com|trustpilot\.com|glassdoor\.[a-z.]+|indeed\.[a-z.]+|bayt\.com|rozee\.pk|wellfound\.com|f6s\.com|producthunt\.com|behance\.net|dribbble\.com|about\.me|yelp\.[a-z.]+|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com|pinterest\.[a-z.]+|reddit\.com|quora\.com|tiktok\.com|upwork\.com|fiverr\.com|freelancer\.com|designrush\.com|sortlist\.[a-z.]+|themanifest\.com|zoominfo\.com|tracxn\.com|apollo\.io|rocketreach\.co|dnb\.com|opencorporates\.com|yellowpages\.[a-z.]+|gulfleads\.ae|hotfrog\.[a-z.]+|cylex\.[a-z.]+)$/;
const LISTING_PATH = /\/(company|companies|organization|organisation|profile|profiles|user|users|member|members|in|jobs?|careers?|listing|listings|biz|business|people|author)\//i;
const LISTING_TYPES = new Set(['profile', 'directory', 'listing', 'forum', 'comment']);
const REAL_TYPES = new Set(['editorial', 'press', 'resource', 'partner', 'guest_post', 'sponsored']);

type RefLike = Pick<BacklinkRef, 'refDomain' | 'kind' | 'fromUrl' | 'linkType' | 'verify' | 'sources' | 'spamScore' | 'visits'>;

const hostOf = (d: string) => String(d || '').toLowerCase().trim().replace(/^www\./, '').replace(/\.$/, '');
const onlyIndex = (r: RefLike) => r.sources.length > 0 && r.sources.every((s) => s === 'dfs');

/** An automatic report page: a site checker / WHOIS / worth page, or a name made of SEO-tool words on a new cheap ending that only a link
 *  index has named and our own check never found a link on. */
export function isAutoReportSite(r: RefLike): boolean {
  const d = hostOf(r.refDomain);
  if (!d) return false;
  if (r.visits > 0 || /\.(?:edu|gov|mil|ac\.[a-z]{2}|edu\.[a-z]{2}|gov\.[a-z]{2})$/.test(d)) return false;   // real people came, or a public body
  if (r.linkType === 'scraper' || REPORT_HOST.test(d)) return true;
  const dot = d.lastIndexOf('.');
  if (dot < 0) return false;
  const tld = d.slice(dot + 1);
  const label = d.slice(0, dot);
  return CHEAP_TLD.has(tld) && TOOL_WORD.test(label) && onlyIndex(r) && r.verify !== 'found' && !(r.visits > 0);
}

/** One kind per ledger row. Order: the engine's spam label, the analyst's real-link labels, automatic report pages, a page an index alone
 *  rates 60+ for spam (DataForSEO's own per-link score; never a row another source confirms: a client's own product site scored 64),
 *  listings and profiles, then a row with no page address (unknown), else a real link. */
export function linkKindOf(r: RefLike): LinkKind {
  if (r.linkType === 'spam') return 'farm';
  if (REAL_TYPES.has(r.linkType)) return 'real';
  if (isAutoReportSite(r)) return 'auto';
  if (onlyIndex(r) && r.spamScore >= 60 && r.verify !== 'found') return 'farm';
  const d = hostOf(r.refDomain);
  if (r.kind === 'social' || LISTING_TYPES.has(r.linkType) || LISTING_HOST.test(d) || LISTING_PATH.test(r.fromUrl || '')) return 'listing';
  if (!r.fromUrl) return 'unknown';
  return 'real';
}

/** true for the kinds that are links at all for the client (Best, Lost, the headline); automatic pages and farms are listed apart. */
export const linkCounts = (r: RefLike): boolean => LINK_KINDS[linkKindOf(r)].counts;

export interface LinkBreakdown {
  /** live and at-risk rows (not lost) by kind */
  counts: Record<LinkKind, number>;
  total: number;
  /** real + listings + not identified */
  counted: number;
  /** automatic report pages + farms */
  ignored: number;
}

export function linkBreakdown(refs: readonly (RefLike & { status?: string })[]): LinkBreakdown {
  const counts: Record<LinkKind, number> = { real: 0, listing: 0, unknown: 0, auto: 0, farm: 0 };
  for (const r of refs) if (r.status !== 'lost') counts[linkKindOf(r)] += 1;
  const total = LINK_KIND_ORDER.reduce((n, k) => n + counts[k], 0);
  const ignored = counts.auto + counts.farm;
  return { counts, total, counted: total - ignored, ignored };
}

/** The Check column for a row our crawler did not read: say why, instead of "Not checked yet" for ever. */
export function checkNote(r: RefLike): string {
  if (r.verify && r.verify !== 'unchecked') return '';
  const k = linkKindOf(r);
  if (k === 'auto' || k === 'farm') return 'Not checked: Google ignores these';
  if (!r.fromUrl) return 'No page to open yet';
  return 'Checked on a coming run';
}

/** How to read the link index's spam score next to what the links are. The score is DataForSEO's "total spam score of all backlinks
 *  pointing to the target" (docs.dataforseo.com/v3/backlinks/summary/live): it rates the pages that link to the site, not the site. */
export function spamScoreReading(score: number, b: LinkBreakdown | null): { tone: 'good' | 'warning' | 'serious'; badge: string; text: string } {
  const share = b && b.total ? Math.round((100 * b.ignored) / b.total) : 0;
  if (score < 30) return { tone: 'good', badge: 'Low', text: 'Rates the pages that link to you, not your website.' };
  if (b && b.ignored > 0 && share >= 50)
    return {
      tone: 'warning',
      badge: 'Caused by automatic pages',
      text: `It rates the pages that link to you, not your website. ${share}% of the sites linking to you are automatic report pages or link farms that every website gets; Google ignores them, so nothing needs doing.`,
    };
  return score >= 50
    ? { tone: 'serious', badge: 'High', text: 'It rates the pages that link to you, not your website. Look at the Link farms and spam group below: Google ignores most of them.' }
    : { tone: 'warning', badge: 'Elevated', text: 'It rates the pages that link to you, not your website.' };
}

/** Sources per referring site from the ledger itself (every source that ever reported it), so a light weekly check that reads only the new
 *  links does not print "DataForSEO finds 0%" beside a ledger it built. Google's own sample is the Search Console upload. */
export function sourcesFromLedger(refs: readonly (RefLike & { status?: string })[]) {
  const live = refs.filter((r) => r.status !== 'lost' && r.kind === 'web');
  const perSource: Record<string, number> = {};
  const onlyIn: Record<string, number> = {};
  for (const r of live) {
    for (const s of r.sources) perSource[s] = (perSource[s] ?? 0) + 1;
    if (r.sources.length === 1) onlyIn[r.sources[0]!] = (onlyIn[r.sources[0]!] ?? 0) + 1;
  }
  const google = live.filter((r) => r.sources.includes('gsc'));
  const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);
  return {
    union: live.length,
    perSource,
    onlyIn,
    dfsShare: pct(perSource.dfs ?? 0, live.length),
    googleSample: google.length,
    dfsSeesGoogle: google.length ? pct(google.filter((r) => r.sources.includes('dfs')).length, google.length) : null,
    allSeeGoogle: google.length ? pct(google.filter((r) => r.sources.length > 1).length, google.length) : null,
  };
}

/** The live Bing Webmaster check the app runs on "Check Bing now" (POST .../backlinks/bing/check). */
export interface BingCheck {
  /** the server has a Bing Webmaster key at all */
  configured: boolean;
  /** the website is listed in the Bing account we read */
  inAccount: boolean;
  verified: boolean;
  /** the e-mail address of the Bing account we read, to add as a user (empty when the owner has not set one) */
  shareWith: string;
  checkedAt: string;
  message: string;
}

/** The Sources card's Bing line, from the latest engine check or a fresh "Check Bing now". */
export function bingSourceText(
  st: { enabled: boolean; connected: boolean; inAccount: boolean | null; error: string; links: number } | null,
  live: BingCheck | null,
  shareWith = '',
): { ok: boolean | null; text: string } {
  const who = (live?.shareWith || shareWith).trim();
  const share = who
    ? `In Bing Webmaster Tools open Settings, then User management, choose Add user, enter ${who} and pick Read only.`
    : 'In Bing Webmaster Tools open Settings, then User management, and add the Alaventra reading account as a Read only user (ask us for the address).';
  if (live) {
    if (!live.configured) return { ok: null, text: 'Bing is not set up on this server yet.' };
    if (live.inAccount && live.verified) return { ok: true, text: `We can read your site in Bing now (checked ${live.checkedAt.slice(0, 10)}). The next backlink check reads its links.` };
    if (live.inAccount) return { ok: false, text: 'Bing lists your site for us but not as verified yet. Verification can take a day after you add us.' };
    return { ok: false, text: `Not readable yet. Adding the site to your own Bing account is the first half; we read Bing through our own account, so it needs your permission too. ${share}` };
  }
  if (!st) return { ok: null, text: 'After the next full check' };
  if (!st.enabled) return { ok: null, text: 'Not set up on this server yet' };
  if (st.connected) return { ok: true, text: st.links > 0 ? `${st.links} links read` : 'Connected. Bing reports no links to your site yet (new sites take a few weeks).' };
  if (st.inAccount === false) return { ok: false, text: `Not readable yet. Adding the site to your own Bing account is the first half; we read Bing through our own account, so it needs your permission too. ${share}` };
  return { ok: false, text: st.error || 'Not connected' };
}
