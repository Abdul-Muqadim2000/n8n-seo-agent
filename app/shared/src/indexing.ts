// Index coverage (2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md): which of a website's pages Google left out of search,
// why, and what to do. The engine's daily index check (free, Google APIs only) writes `seo_index_pages` and its run, event and impact
// tables; this file is the one place the app reads their codes: what each cause means in plain words, what we do about it, what the
// client does, which steps become "Steps on your website", and the page's figures built from the rows (pure, so it is tested without
// a server). The engine's contract is DESIGN.md §2 / §4; a code the app does not know is shown as "Other", never dropped.
import type { GoogleEventRow, IndexPageRow, IndexRunRow, UpdateImpactRow } from './tables';

/** The engine's action classes (DESIGN §4) plus two the app derives for pages the engine files under `none` without being in search
 *  (fix wave 1, A3): `retry` (Google's inspection did not answer: never "in search", never "left out") and `review` (Google left the page
 *  out for a reason it does not document: the client reads Google's own words in Search Console). */
export const INDEX_ACTIONS = ['site_fix', 'quality', 'duplicate', 'links', 'review', 'wait', 'retry', 'leave_out', 'none'] as const;
export type IndexAction = (typeof INDEX_ACTIONS)[number];
export const INDEX_STATES = ['indexed', 'not_indexed', 'excluded', 'unknown', 'error'] as const;
export type IndexState = (typeof INDEX_STATES)[number];
export type IndexLane = 'new' | 'existing';

export const INDEX_CAUSES = [
  'indexed',
  'indexed_not_in_sitemap',
  'wait_new',
  'unknown_to_google',
  'not_in_sitemap',
  'discovered_not_crawled',
  'crawled_not_indexed',
  'noindex',
  'noindex_intended',
  'robots_blocked',
  'robots_intended',
  'canonical_elsewhere',
  'alternate',
  'google_chose_other',
  'duplicate_no_canonical',
  'not_found',
  'soft_404',
  'server_error',
  'access_denied',
  'redirect',
  // engine fix wave 1 (E9): Google could not follow the redirect (a loop, a chain too long, a redirect to a bad address)
  'redirect_error',
  'low_value',
  'not_checked',
  // engine addition (ENGINE_BUILD §7.1): Google gave a coverage reason the engine does not recognise
  'unclassified',
] as const;
export type IndexCause = (typeof INDEX_CAUSES)[number];

/** The causes only the client can fix on their own website: each becomes one "Steps on your website" task (`indexing:<cause>`). */
export const INDEX_SITE_FIX_CAUSES = [
  'noindex',
  'robots_blocked',
  'server_error',
  'access_denied',
  'not_found',
  'soft_404',
  'canonical_elsewhere',
  'redirect',
  'redirect_error',
  'not_in_sitemap',
  'indexed_not_in_sitemap',
] as const satisfies readonly IndexCause[];
export type IndexSiteFixCause = (typeof INDEX_SITE_FIX_CAUSES)[number];
export const isSiteFixCause = (c: string): c is IndexSiteFixCause => (INDEX_SITE_FIX_CAUSES as readonly string[]).includes(c);

/** Causes that stop Google reading pages at all: their step is shown as important. */
export const INDEX_BLOCKING_CAUSES: ReadonlySet<IndexCause> = new Set(['noindex', 'robots_blocked', 'server_error', 'access_denied', 'redirect_error']);

export interface IndexCauseInfo {
  /** short name of the problem, sentence case */
  label: string;
  /** what it means, in plain words */
  meaning: string;
  /** what Alaventra does about it */
  weDo: string;
  /** what the client does (empty sentence = nothing) */
  youDo: string;
  /** the usual action class (the engine's row decides per page) */
  action: IndexAction;
  /** the "Show me how" guide for a site fix */
  guide?: string;
  /** the step's title on "Steps on your website" */
  taskTitle?: string;
}

export const INDEX_CAUSE_INFO: Record<IndexCause, IndexCauseInfo> = {
  indexed: {
    label: 'In Google search',
    meaning: 'Google has this page and can show it in search.',
    weDo: 'We look again from time to time and tell you if it drops out.',
    youDo: 'Nothing.',
    action: 'none',
  },
  indexed_not_in_sitemap: {
    label: 'In search, but missing from your sitemap',
    meaning: 'Google found and kept these pages, but your sitemap does not list them. The sitemap is how you tell Google which pages matter, so new changes to them are noticed later than they could be.',
    weDo: 'We read your sitemap every day and tick this off once the pages are listed.',
    youDo: 'Add these pages to your sitemap.',
    action: 'site_fix',
    guide: 'index-add-to-sitemap',
    taskTitle: 'Add pages that are in search to your sitemap',
  },
  wait_new: {
    label: 'New, Google has not got to it yet',
    meaning: 'New pages usually take from a few days to a few weeks before Google looks at them. This is normal.',
    weDo: 'We check again 1, 3, 7, 14 and 28 days after the page appeared.',
    youDo: 'Nothing yet. A link to it from a page that is already in search helps Google find it sooner.',
    action: 'wait',
  },
  unknown_to_google: {
    label: 'Google has not found it yet',
    meaning: 'The page is in your sitemap, but Google has no record of it yet.',
    weDo: 'We suggest pages of yours that are already in search and should link to it, then check again.',
    youDo: 'Add a link to it from the suggested pages.',
    action: 'links',
  },
  not_in_sitemap: {
    label: 'Google has not found it, and your sitemap does not list it',
    meaning: 'Google has no record of these pages, and nothing tells Google they exist: your sitemap does not list them.',
    weDo: 'We read your sitemap every day and tick this off once the pages are listed.',
    youDo: 'Add these pages to your sitemap and link to them from a page that is already in search.',
    action: 'site_fix',
    guide: 'index-not-in-sitemap',
    taskTitle: 'List pages Google cannot find in your sitemap',
  },
  discovered_not_crawled: {
    label: 'Google knows it but has not read it yet',
    meaning: 'Google has seen a link to this page but has not visited it. Often it means Google does not see the page as important yet.',
    weDo: 'We suggest pages of yours that are already in search and should link to it.',
    youDo: 'Add links to it from the suggested pages.',
    action: 'links',
  },
  crawled_not_indexed: {
    label: 'Google read it and left it out',
    meaning: 'Google visited the page and decided not to show it in search for now. Google calls this a judgement on how useful the page is, not an error.',
    weDo: 'We suggest improving the page, one page at a time, and only when you approve it.',
    youDo: 'Review the page. If it is thin or repeats another page, improve it or merge it with the other one.',
    action: 'quality',
  },
  noindex: {
    label: 'Your page tells Google to leave it out',
    meaning: 'These pages carry a noindex instruction, in the page or in your server\'s answer, so Google leaves them out. They are in your sitemap or were in search before, so it looks like a mistake.',
    weDo: 'We open the pages every day and tick this off when the instruction is gone.',
    youDo: 'Remove the noindex instruction from these pages.',
    action: 'site_fix',
    guide: 'index-remove-noindex',
    taskTitle: 'Remove the noindex instruction from pages that should be in search',
  },
  noindex_intended: {
    label: 'Left out on purpose (noindex)',
    meaning: 'The page tells Google to leave it out, and nothing suggests it should be in search.',
    weDo: 'Nothing. We look again every 8 weeks.',
    youDo: 'Nothing, unless you want this page in search.',
    action: 'leave_out',
  },
  robots_blocked: {
    label: 'Your robots.txt stops Google reading it',
    meaning: 'A rule in your robots.txt tells Google not to read these pages, so Google cannot see what is on them.',
    weDo: 'We read your robots.txt every day and tick this off when Google may read the pages.',
    youDo: 'Remove or narrow the robots.txt rule that blocks these pages.',
    action: 'site_fix',
    guide: 'index-robots-blocked',
    taskTitle: 'Let Google read pages your robots.txt blocks',
  },
  robots_intended: {
    label: 'Blocked on purpose (robots.txt)',
    meaning: 'Your robots.txt keeps Google away from this page, and nothing suggests it should be in search.',
    weDo: 'Nothing. We look again every 8 weeks.',
    youDo: 'Nothing, unless you want this page in search.',
    action: 'leave_out',
  },
  canonical_elsewhere: {
    label: 'Your sitemap lists a copy, not the main page',
    meaning: 'These pages say another address is the main version (their canonical tag), yet your sitemap lists them. Google keeps the main version and leaves the copy out.',
    weDo: 'We open the pages and read your sitemap every day, and tick this off once they agree.',
    youDo: 'List the main address in your sitemap instead, or fix the canonical tag if this page is the main one.',
    action: 'site_fix',
    guide: 'index-canonical-sitemap',
    taskTitle: 'Make your sitemap list the main version of each page',
  },
  alternate: {
    label: 'A copy of another page (left out on purpose)',
    meaning: 'The page points to another address as its main version, and Google keeps that one. Nothing is wrong.',
    weDo: 'Nothing. We look again every 8 weeks.',
    youDo: 'Nothing.',
    action: 'leave_out',
  },
  google_chose_other: {
    label: 'Google picked another page as the main one',
    meaning: 'Google sees this page as a copy of another and chose a different address as the main version.',
    weDo: 'We show which page Google chose and suggest merging the two.',
    youDo: 'Merge the two pages, or point this page\'s canonical tag at the page Google chose.',
    action: 'duplicate',
  },
  duplicate_no_canonical: {
    label: 'A copy with no main version set',
    meaning: 'Google sees this page as a copy of another, and the page does not say which one is the main version.',
    weDo: 'We suggest which page to keep.',
    youDo: 'Add a canonical tag that points to the main version, or merge the pages.',
    action: 'duplicate',
  },
  not_found: {
    label: 'Page not found (404)',
    meaning: 'These addresses answer "not found", yet your sitemap lists them or people found them in search.',
    weDo: 'We open the addresses every day and tick this off when each one opens again or redirects permanently to a page of yours that opens. An address you remove from your sitemap is ticked off once Google\'s own reading no longer lists it.',
    youDo: 'Redirect each one to the page that replaced it, or remove it from your sitemap.',
    action: 'site_fix',
    guide: 'index-fix-not-found',
    taskTitle: 'Redirect or remove pages that answer "not found"',
  },
  soft_404: {
    label: 'Looks like an empty or error page',
    meaning: 'The page opens, but Google reads it as empty or as an error page.',
    weDo: 'We open the pages every day and tick this off when they have real content or answer "not found" properly.',
    youDo: 'Give each page real content, or make it answer 404 if it is gone.',
    action: 'site_fix',
    guide: 'index-fix-soft-404',
    taskTitle: 'Fix pages Google reads as empty',
  },
  server_error: {
    label: 'Your server answered with an error',
    meaning: 'Google got a server error (5xx) when it tried to read these pages.',
    weDo: 'We open the pages every day and tick this off when they answer normally (200).',
    youDo: 'Ask whoever runs your hosting to fix the error. Google slows down on a website that answers errors.',
    action: 'site_fix',
    guide: 'index-fix-server-error',
    taskTitle: 'Fix pages that answer with a server error',
  },
  access_denied: {
    label: 'Google was not let in',
    meaning: 'These pages ask for a login or refuse visitors (401 or 403), so Google cannot read them.',
    weDo: 'We open the pages every day and tick this off when they open for everyone.',
    youDo: 'Make the pages public if they should be in search. If they are private on purpose, remove them from your sitemap and skip this step.',
    action: 'site_fix',
    guide: 'index-fix-access-denied',
    taskTitle: 'Open pages that refuse visitors',
  },
  redirect: {
    label: 'Your sitemap lists an address that redirects',
    meaning: 'These addresses send visitors on to another page. Google keeps the page they land on and leaves the old address out.',
    weDo: 'We open the addresses and read your sitemap every day, and tick this off once the sitemap lists the final addresses.',
    youDo: 'List the final address in your sitemap instead of the old one.',
    action: 'site_fix',
    guide: 'index-sitemap-redirects',
    taskTitle: 'Replace redirecting addresses in your sitemap',
  },
  redirect_error: {
    label: 'Google could not follow the redirect',
    meaning: 'These addresses redirect in a way Google cannot follow: a loop, a chain of too many steps, or a redirect to an address that does not work. Google gives up and reads nothing.',
    weDo: 'We open the addresses every day and tick this off when each one ends on a page of yours that opens.',
    youDo: 'Make each redirect go straight to a working page, in one step. If the page is gone, let the address answer "not found" instead.',
    action: 'site_fix',
    guide: 'index-fix-redirect-error',
    taskTitle: 'Fix redirects Google cannot follow',
  },
  low_value: {
    label: 'Left out on purpose (archives, search and account pages)',
    meaning: 'Pages like tag archives, search results, carts and logins are normally kept out of search. Nothing is wrong.',
    weDo: 'Nothing. We look again every 8 weeks.',
    youDo: 'Nothing.',
    action: 'leave_out',
  },
  not_checked: {
    label: 'Could not be checked',
    meaning: 'Google\'s inspection tool did not answer for this page (its daily limit was reached, or access failed). It is not counted as in or out of search.',
    weDo: 'We try again on the next daily check.',
    youDo: 'Nothing.',
    action: 'retry',
  },
  unclassified: {
    label: 'Left out for a reason Google does not explain',
    meaning: 'Google left these pages out and gave a reason that is not one of the reasons it documents, so we cannot say what it means.',
    weDo: 'We check again on the usual schedule and tell you when Google gives a reason we know.',
    youDo: 'Open the address in Search Console (URL Inspection) to read Google\'s own words.',
    action: 'review',
    guide: 'index-request-indexing',
  },
};

/** Pages our own fetch shows fixed while Google still shows its older reading (`fix_seen_at`, FIX_CONTRACT): their own group. */
export const INDEX_FIXED_ON_SITE = {
  label: 'Fixed on your site, waiting for Google',
  meaning: 'We saw the change on your website. Google still shows its older reading until it reads the page again, usually within a few days.',
  weDo: 'Our daily index check looks up Google\'s reading of these pages again within a day or two, so the reason updates in days, not weeks.',
  youDo: 'Nothing. For an important page you can also ask Google to read it again in Search Console.',
} as const;

/** 2026-11-05: pages the client improved and published, that Google has not read since (`improveStateOf` = 'waiting'): their own group. */
export const INDEX_IMPROVED_WAITING = {
  label: 'Improved, waiting for Google',
  meaning: 'You published an improved version of these pages. Google still shows its older reading until it reads the page again, and only Google decides whether to add it.',
  weDo: 'Our daily index check looks up Google\'s reading of these pages again in the days after you publish, so the reason updates once Google has read the new version.',
  youDo: 'Nothing on these pages for now. For an important page you can ask Google to read it again in Search Console.',
} as const;

/** 2026-11-05 (production, devaicon.com): the improved version went live at another address and the old one still opens. */
export const INDEX_IMPROVED_ELSEWHERE = {
  label: 'Improved version published at another address',
  meaning: 'The improved version of each page went live at a new address, while the old address still opens the old page. Two pages for the same search compete with each other, and Google may keep showing the old one.',
  weDo: 'We open each old address every day and tick the step off once it redirects permanently to its improved version.',
  youDo: 'Redirect each old address to its improved version with a permanent (301) redirect. Or put the improved text back on the old address and remove the new one.',
} as const;

/**
 * 2026-11-05 (client report, devaicon.com): the shared rule with the engine (`_index_kit.js` IX.improveState / IX.improvementsOf). A page
 * Google read and left out (or treats as a copy) that the client improved, published at the same address and reported, is "improved,
 * waiting for Google" until Google's last crawl is newer than the improvement; then Google's reading decides (in search, or still left out
 * with "Google read your improved version"). We never call it indexed ourselves.
 */
export const INDEX_IMPROVABLE_CAUSES: ReadonlySet<string> = new Set(['crawled_not_indexed', 'google_chose_other', 'duplicate_no_canonical']);
const isoMs = (v: unknown): number => {
  const t = Date.parse(String(v ?? '').trim());
  return Number.isFinite(t) ? t : 0;
};
export type ImproveState = '' | 'moved' | 'waiting' | 'read';
/** 'moved' (production 2026-11-05): the improved version is live at ANOTHER address (`improved_to`) while this page still opens. */
export function improveStateOf(r: { url?: unknown; state?: unknown; cause?: unknown; improved_at?: unknown; improved_to?: unknown; last_crawl?: unknown }): ImproveState {
  if (String(r.state ?? '') === 'indexed' || !INDEX_IMPROVABLE_CAUSES.has(String(r.cause ?? ''))) return '';
  const at = isoMs(r.improved_at);
  if (!at) return '';
  const to = String(r.improved_to ?? '').trim();
  if (to && !samePageUrl(to, String(r.url ?? ''))) return 'moved';
  return isoMs(r.last_crawl) >= at ? 'read' : 'waiting';
}
export interface IndexImprovement {
  /** the page that was improved */
  url: string;
  /** where the improved version went live when that is ANOTHER address ('' = at the page itself) */
  to: string;
  at: string;
}
/** The content-log rows that improve a page (`existing_page_url`): at that very address, or confirmed at another one (the engine's
 *  improvementsOf). */
export function indexImprovementsOf(logs: readonly { status?: unknown; existing_page_url?: unknown; published_url?: unknown; published_at?: unknown }[]): IndexImprovement[] {
  return logs
    .filter((l) => /^published$/i.test(String(l.status ?? '').trim()) && String(l.published_at ?? '').trim() && String(l.existing_page_url ?? '').trim() && String(l.published_url ?? '').trim())
    .map((l) => {
      const from = String(l.existing_page_url).trim(), pub = String(l.published_url).trim(), at = String(l.published_at).trim();
      return samePageUrl(from, pub) ? { url: pub, to: '', at } : { url: from, to: pub, at };
    });
}
/**
 * The engine records an improvement on its next daily run; the app shows it at once: each row takes the newest of its own `improved_at` and
 * the content log's improvement of the same page. Pure; rows are copied only when they change.
 */
export function withImprovements<R extends Partial<IndexPageRow>>(rows: readonly R[], improvements: readonly { url: string; at: string; to?: string }[]): R[] {
  if (!improvements.length) return [...rows];
  return rows.map((r) => {
    const had = String(r.improved_at ?? '').trim();
    let best: { at: string; to: string } | null = null;
    for (const i of improvements) if (samePageUrl(String(r.url ?? ''), i.url) && isoMs(i.at) > isoMs(best ? best.at : had)) best = { at: i.at, to: i.to ?? '' };
    return best ? { ...r, improved_at: best.at, improved_to: best.to } : r;
  });
}

export const INDEX_ACTION_INFO: Record<IndexAction, { label: string; summary: string }> = {
  site_fix: { label: 'Fix on your website', summary: 'Changes only you can make. Each one is a step on your Pipeline that we check every day.' },
  quality: { label: 'Improve the page', summary: 'Google read these pages and left them out. Improve them one at a time, when you choose.' },
  duplicate: { label: 'Choose the main version', summary: 'Google sees these pages as copies of others.' },
  links: { label: 'Help Google find it', summary: 'Links from your pages that are already in search help Google find and choose these pages.' },
  wait: { label: 'Give it time', summary: 'Pages Google has not got to yet, or will read again soon. Nothing to do on these pages now.' },
  leave_out: { label: 'Left out, and that is fine', summary: 'Pages that are normally kept out of search, or that you keep out on purpose.' },
  review: { label: 'Check in Search Console', summary: 'Google left these pages out for a reason it does not document. Search Console shows its own words.' },
  retry: { label: 'Could not check, we try again', summary: 'Google\'s inspection did not answer for these pages. They are counted neither as in search nor as left out.' },
  none: { label: 'In search', summary: 'Pages Google can show in search.' },
};

/** The order groups are shown in: what needs the client first. */
export const INDEX_ACTION_ORDER: readonly IndexAction[] = ['site_fix', 'quality', 'duplicate', 'links', 'review', 'wait', 'retry', 'leave_out', 'none'];
/** Actions that ask something of the client ("Z need you"). */
export const INDEX_ACTIONS_NEED_YOU: ReadonlySet<IndexAction> = new Set(['site_fix', 'quality', 'duplicate', 'links', 'review']);

/** The settings of the daily index check (seo_monitors `index_watch` / `index_daily_cap`, DESIGN §2.6). */
export const INDEX_DAILY_CAP = { min: 20, max: 1200, default: 300 } as const;
export const INDEX_DAILY_CAP_OPTIONS = [20, 50, 100, 200, 300, 500, 800, 1200] as const;
export const clampIndexDailyCap = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(INDEX_DAILY_CAP.max, Math.max(INDEX_DAILY_CAP.min, n)) : INDEX_DAILY_CAP.default;
};
/** `index_watch` as stored: empty = on (DESIGN §2.6). */
export const indexWatchOn = (v: unknown): boolean => !(v === false || v === 'false' || v === 0 || v === '0');
/** wave 2 (DESIGN_WAVE2 §2.5): `index_sitemap_submit` as stored: empty = OFF (we write to the client's Search Console only when they say so). */
export const indexSitemapSubmitOn = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';

// ---------------------------------------------------------------- utility pages (DESIGN_WAVE2 §2.4)

/**
 * The ONE list of policy and utility pages, a mirror of the engine's `IX.UTILITY` (DESIGN_WAVE2 §2.4, `n8n/seo-agent/v5/code/_index_kit.js`;
 * `indexing.utility-parity.test.ts` compares the two). Wave 2 review W3 (engine W3): a page is a utility page only when its FIRST path segment
 * is one of these words (whole segment, any case, `.html` / `.php` / `.asp` dropped), or it is /legal or /policies or under them; `security` only
 * as the whole path /security. `/industries/legal`, `/features/search` or `/blog/thanks` are content pages. A utility page does not need to
 * be in Google: never "Improve this page", never a page to ask Google about, never a page we suggest a link from, shown under "Policy and
 * utility pages: fine to leave out". Job postings are NOT utility pages (a job page may want to be found): they are only never asked about
 * and never a link source.
 */
export const INDEX_UTILITY_SEGMENTS = [
  'privacy', 'privacy-policy', 'cookies', 'cookie-policy', 'terms', 'terms-of-service', 'terms-and-conditions', 'legal', 'imprint', 'impressum',
  'disclaimer', 'accessibility', 'sitemap', 'login', 'signin', 'sign-in', 'register', 'signup', 'account', 'cart', 'checkout', 'search',
  'thank-you', 'thanks',
] as const;
/** Segments that count only as the whole path (`/security`, never `/services/security`). */
export const INDEX_UTILITY_TOP_ONLY = ['security'] as const;
/** Directories whose pages are all policy pages (`/policies`, `/legal/terms`, `/policies/refund`): the engine's `IX.UTILITY.dirs`. */
export const INDEX_UTILITY_DIRS = ['legal', 'policies'] as const;
/** Job postings: a page under one of these with a further segment (the listing page `/careers` itself is a normal page). */
export const INDEX_JOB_PARENTS = ['careers', 'jobs'] as const;

const pathSegments = (url: string): string[] =>
  String(url ?? '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/[?#].*$/, '')
    .split('/')
    .filter(Boolean)
    .map((x) => {
      let y = x;
      try {
        y = decodeURIComponent(x);
      } catch {
        y = x;
      }
      // the engine's rule (IX.UTILITY): `privacy.html` is `privacy`
      return y.toLowerCase().replace(/\.(?:html?|php|aspx?)$/, '');
    });
/** A policy or utility page (DESIGN_WAVE2 §2.4). */
export function isUtilityPage(url: string): boolean {
  const seg = pathSegments(url);
  if (!seg.length) return false;
  if (seg.length === 1 && (INDEX_UTILITY_TOP_ONLY as readonly string[]).includes(seg[0])) return true;
  // W3 (the engine's `rule: 'first_segment'`): the FIRST segment only (a segment deeper down is a content page's subject: /industries/legal)
  return (INDEX_UTILITY_DIRS as readonly string[]).includes(seg[0]) || (INDEX_UTILITY_SEGMENTS as readonly string[]).includes(seg[0]);
}
/** A job posting (DESIGN_WAVE2 §2.4): never a page to ask Google about. */
export function isJobPosting(url: string): boolean {
  const seg = pathSegments(url);
  return seg.length >= 2 && (INDEX_JOB_PARENTS as readonly string[]).includes(seg[0]);
}

// ---------------------------------------------------------------- what the app sends to the page

export interface IndexLinkSuggestion {
  url: string;
  title: string;
}

export interface IndexPage {
  url: string;
  path: string;
  title: string;
  lane: IndexLane;
  state: IndexState;
  cause: IndexCause | 'other';
  action: IndexAction;
  inSitemap: boolean;
  impressions28d: number;
  clicks28d: number;
  lastImpressionAt: string;
  /** our last inspection or fetch (the later), '' = never checked */
  checkedAt: string;
  evidence: string;
  coverage: string;
  httpStatus: number;
  noindex: string;
  pageCanonical: string;
  googleCanonical: string;
  finalUrl: string;
  lastCrawl: string;
  words: number;
  droppedAt: string;
  indexedSince: string;
  checks: number;
  nextCheckAt: string;
  needsPerson: boolean;
  linkFrom: IndexLinkSuggestion[];
  mergeInto: string;
  note: string;
  publishedAt: string;
  /** Google's last inspection of the page ('' = none) */
  inspectedAt: string;
  /** our own last fetch ('' = none) */
  fetchedAt: string;
  /** FIX_CONTRACT `fix_seen_at`: our fetch saw the site-fix cause gone and Google has not confirmed it yet ('' = not fixed). Set and cleared
   *  by the engine only; while set the page waits for Google, whatever the order of the inspection and the sighting (N4). */
  fixSeenAt: string;
  /** fix wave 2 (N3, R1): Google crawled the page after a fix we saw and still sees the same cause ('' = no). Such a page is `site_fix`
   *  again, never "fixed on your site", and the app's own fetch cannot close its step: Google is shown something our fetch is not. */
  fixFailedAt: string;
  /** FIX_CONTRACT `ask_google`: a manual "Request indexing" in Search Console is the right next step (at most 5 a site a week) */
  askGoogle: boolean;
  /** wave 2 (`linked_by`): pages of the website that link to this one today (up to 3); empty = none found, or not read (`linkedRead`) */
  linkedBy: string[];
  /** false when the engine could not read the home page, or (wave 2 review W5) this page's parent page, this run, or the parent was past its
   *  10-page cap (`linked_by` = 'unread'): nothing is concluded about links */
  linkedRead: boolean;
  /** wave 2: when the client said they asked Google to read it again ('' = never), and when Google read it after that ('' = not yet) */
  askedGoogleAt: string;
  googleReadAfterAskAt: string;
  /** ENGINE_BUILD wave 2 contract 6: the client said "I asked Google" (the app's audit log) but the page's row does not hold it (an engine
   *  run that overlapped the write put the old value back): the time they said it, '' = nothing lost. They can press again. */
  askNotRecorded: string;
  /** a policy or utility page (DESIGN_WAVE2 §2.4): fine to leave out of search */
  utility: boolean;
  /** 2026-11-05: when the client last published an improved version of this page Google left out ('' = never, or not a reason an
   *  improvement answers, or in search). See `improveStateOf`. */
  improvedAt: string;
  /** the improved version is live and Google has not read the page since: waiting for Google (action `wait`, no "Improve this page") */
  improvedWaiting: boolean;
  /** Google read the page after the improvement and still leaves it out: the date of that crawl ('' = not yet / no improvement) */
  improvedReadAt: string;
  /** 2026-11-05: the improved version went live at ANOTHER address while this one still opens ('' = no): the step is a permanent
   *  redirect to it (site task `indexing:merge`); never "Improve this page" again */
  improvedTo: string;
  /** wave 3 (DESIGN_WAVE3 §2.7): the engine's rank among the pages that should be in Google and are not (0 = not ranked) */
  priority: number;
  /** wave 3: one of the first INDEX_DO_FIRST of that ranking ("Do first") */
  doFirst: boolean;
  /** wave 3 (§2.2): Google has not visited the page in the 3 weeks we watched it ('' = no); its likely reasons in order */
  escalatedAt: string;
  escalateWhy: IndexEscalateWhy[];
  /** wave 3 (§2.4): the client's own mark ('' = the rules decide) */
  typeOverride: IndexPageType;
  /** wave 3 (§3.4): the client changed the mark and the daily check has not filed the page again yet (shown as waiting for our check) */
  typePending: boolean;
  /** wave 3 (§1): our robots.txt reading ('' = not read), where the page is linked from (1 = home page, 2 = a page the home page links to,
   *  0 = not known) and how many pages link to it, when we sent it to Bing (IndexNow, '' = never) */
  robotsOk: 'yes' | 'no' | '';
  linkDepth: number;
  linkedN: number;
  indexnowAt: string;
  /** whether the row says anything about the sitemap at all (an empty `in_sitemap` is "not checked", never "not listed", in the check line) */
  inSitemapRead: boolean;
}

/** wave 3 (DESIGN_WAVE3 §2.2): the engine's reasons a page Google has not visited in 3 weeks is still waiting, in the engine's order. */
export const INDEX_ESCALATE_WHY = ['not_asked', 'asked_no_visit', 'weak_links', 'short_page', 'not_in_sitemap', 'sitemap_no_dates'] as const;
export type IndexEscalateWhy = (typeof INDEX_ESCALATE_WHY)[number];
/** wave 3 (§2.4): the client's own mark on a page (written by the app only; '' = the rules decide). */
export const INDEX_PAGE_TYPES = ['important', 'utility', ''] as const;
export type IndexPageType = (typeof INDEX_PAGE_TYPES)[number];
export const isIndexPageType = (v: unknown): v is IndexPageType => typeof v === 'string' && (INDEX_PAGE_TYPES as readonly string[]).includes(v);
/** wave 3 (§2.7): the first pages of the engine's ranking are "Do first". */
export const INDEX_DO_FIRST = 5;
/** wave 3 (§2.2): days without a Google visit before a page needs the client. */
export const INDEX_ESCALATE_DAYS = 21;
/** wave 3 (§2.4): the engine's note on a page the client marked as fine to leave out (its first words; the app writes the same at once). */
export const INDEX_MARKED_UTILITY_NOTE = 'You marked this page as fine to leave out of Google.';

/** What a group is about: a cause, a code the app does not know, or pages fixed on the site that Google has not read again yet. */
export type IndexGroupCause = IndexCause | 'other' | 'fixed_on_site' | 'improved_waiting' | 'improved_elsewhere' | 'linked_waiting' | 'canonical_parent' | 'utility' | 'marked_utility' | 'type_pending';

export interface IndexGroup {
  /** `<lane>:<action>:<cause>` */
  id: string;
  lane: IndexLane;
  action: IndexAction;
  cause: IndexGroupCause;
  count: number;
  label: string;
  meaning: string;
  weDo: string;
  youDo: string;
  guide: string | null;
  /** the "Steps on your website" task for a site fix */
  taskKey: string | null;
  /** the first pages of the group (the rest page in through …/data/indexing/pages) */
  pages: IndexPage[];
  /** wave 3 (DESIGN_WAVE3 §3.1): the "Google has not visited these yet" group's to-do (absent on every other group) */
  todo?: IndexWaitTodo;
}

export interface IndexLaneSummary {
  known: number;
  indexed: number;
  /** pages that should be in search, among the pages Google has read for us (A9): checked minus those left out on purpose. Pages not
   *  checked yet are not in it (they are `unknown`), so a first week never reads as "most of your pages are missing". */
  shouldBe: number;
  needYou: number;
  /** pages Google has given a reading of (in search, left out, excluded); a failed check is not one (A25) */
  checked: number;
  unknown: number;
  errors: number;
}

/** The one sentence for "how many of your pages are in Google" (A9: the page and the report say the same thing from the same counts). */
export function indexInSearchLine(c: { indexed: number; shouldBe: number; known: number; notChecked: number }, domain = 'your website'): string {
  const pg = (x: number) => `${x.toLocaleString('en-US')} page${x === 1 ? '' : 's'}`;
  const tail = c.notChecked > 0 ? ` (${c.notChecked.toLocaleString('en-US')} not checked yet)` : '';
  if (c.shouldBe > 0) return `Google has ${c.indexed.toLocaleString('en-US')} of the ${pg(c.shouldBe)} we checked that should be in search${tail}`;
  return `We know ${pg(c.known)} of ${domain}${tail}`;
}

export interface IndexRun {
  runAt: string;
  known: number;
  indexed: number;
  notIndexed: number;
  excluded: number;
  unknown: number;
  errors: number;
  newPages: number;
  newIndexed: number;
  inspected: number;
  reused: number;
  fetched: number;
  quotaCap: number;
  backlogLeft: number;
  byCause: Record<string, number>;
  byAction: Record<string, number>;
  dropped: { url: string; at: string; cause: string }[];
  freeze: boolean;
  freezeReason: string;
  note: string;
  /** the run read nothing (no Search Console access, an error before any page): its figures are not a reading (A4) */
  failed: boolean;
  /** Search Console refused access to the property */
  accessLost: boolean;
  /** contract change 2: what Search Console lists as submitted and whether our own read of the sitemap tree was complete (null: not sent) */
  sitemaps: IndexRunSitemaps | null;
  /** engine fix wave 1: the row a run writes BEFORE inspecting; the run's final row replaces it, a crashed run leaves it. Never a reading. */
  reservation: boolean;
}

export interface IndexRunSitemaps {
  /** sitemaps submitted in Search Console (null: the list could not be read) */
  submitted: number | null;
  /** errors Search Console reports in them (null: not read) */
  submittedErrors: number | null;
  /** sitemaps our run read */
  read: number;
  /** the tree was not read completely (a sitemap failed, or a cap was hit): no "add it to / remove it from the sitemap" conclusion */
  partial: boolean;
  /** engine fix wave 1: false = the website was not checked in this run (its figures are carried from the last check); null: not sent */
  checked: boolean | null;
  reservation: boolean;
  /** wave 2 (DESIGN_WAVE2 §2.5): the access Search Console reports for us (`siteOwner`, `siteFullUser`, `siteRestrictedUser` ...; '' = not sent) */
  permission: string;
  /** the engine's own verdict (ENGINE_BUILD wave 2, contract 8): Full access AND no refusal holding (null: not sent) */
  permissionFull: boolean | null;
  /** wave 2: the sitemaps this run submitted for the client (only with the switch on and Full access) */
  submissions: IndexSitemapSubmissionRow[];
  /** wave 2: Search Console's own list of the website's sitemaps as this run read it (the dates Google gives) */
  listed: { path: string; lastSubmitted: string; lastDownloaded: string }[];
  /** wave 2 review W1: the engine says it WILL submit a sitemap on its next run (`submit.will_submit`; false when not sent: an older row) */
  willSubmit: boolean;
  /** wave 2 review W1: why the engine will not submit (`submit.blocked`, one of SITEMAP_BLOCKED; '' = nothing blocks, or not sent / unknown) */
  blocked: SitemapBlocked | '';
  /** wave 3 (DESIGN_WAVE3 §2.5): the addresses this run's sitemap read listed, how many carry a date (`<lastmod>`) and how many distinct days
   *  (null: not sent, an older row) */
  dates: IndexSitemapDates | null;
}

/** wave 3 (§2.5): a sitemap's date counts. */
export interface IndexSitemapDates {
  urls: number;
  withLastmod: number;
  distinct: number;
}
/** wave 3 (§2.5, the engine's rule): "no usable dates" = at least 5 addresses and (under half carry a date, or 10 or more share one day). */
export const sitemapDatesMissing = (d: IndexSitemapDates): boolean => d.urls >= 5 && (d.withLastmod < d.urls * 0.5 || (d.urls >= 10 && d.distinct <= 1));
/** wave 3 (§3.3, the app's own check): done when at least 90% of the addresses carry a date and the dates differ (a sitemap under 10 addresses
 *  may share one day). An empty read is never done. */
export const sitemapDatesGood = (d: IndexSitemapDates): boolean => d.urls > 0 && d.withLastmod >= d.urls * 0.9 && (d.urls < 10 || d.distinct > 1);

/** One sitemap submission the engine made (`sitemaps_json.submissions[]`: path, at, status, reason). */
export interface IndexSitemapSubmissionRow {
  path: string;
  at: string;
  /** the engine's: submitted | confirmed | read | denied (403) | refused (other 4xx) | failed */
  status: string;
  /** the engine's code for why it submitted: not_listed | errors_changed | changed */
  reason: string;
  confirmedAt: string;
  readAt: string;
}

export interface GoogleEvent {
  id: string;
  source: string;
  kind: 'core' | 'spam' | 'policy_doc' | 'other';
  title: string;
  startedAt: string;
  endedAt: string;
  status: 'rolling_out' | 'complete' | 'changed' | 'other';
  url: string;
}

export interface UpdateImpactPage {
  url: string;
  path: string;
  beforeClicks: number;
  afterClicks: number;
  beforeImpressions: number;
  afterImpressions: number;
  beforePosition: number | null;
  afterPosition: number | null;
  /** the engine's comparison: `dropped` | `stable` | `gained` (A12: the segment, not the page's index state) */
  segment: 'dropped' | 'stable' | 'gained' | 'other';
  state: string;
  cause: string;
}

export interface UpdateImpact {
  eventId: string;
  eventTitle: string;
  comparedAt: string;
  before: { from: string; to: string };
  after: { from: string; to: string };
  pages: number;
  dropped: number;
  stable: number;
  gained: number;
  rows: UpdateImpactPage[];
  note: string;
}

export interface IndexingData {
  /** 'ok': read; 'empty': nothing checked yet; 'failed': every run so far could not read Search Console and no page is known (A4);
   *  'unreadable': the engine's data could not be read (the page says so, nothing else breaks) */
  status: 'ok' | 'empty' | 'failed' | 'unreadable';
  error: string | null;
  settings: { on: boolean; dailyCap: number };
  /** the newest run that read the website (a run that read nothing is not a check, A4), else the newest page row */
  checkedAt: string | null;
  /** what the newest run says about itself: a run that could not read Search Console, a quota stop, a sitemap that could not be read
   *  (the engine's own sentence), shown above the figures; null when it read everything */
  notice: { tone: 'warning' | 'info'; title: string; text: string; failed: boolean; accessLost: boolean; at: string } | null;
  /** the newest run that read the sitemap tree read it only in part: no sitemap step is ticked off from it (FIX_CONTRACT decision 2) */
  sitemapPartial: boolean;
  /** pages where a manual "Request indexing" in Search Console is the right next step (the engine marks at most 5), most important first */
  askGoogle: IndexPage[];
  /** wave 2: pages the client said they asked Google about (last 45 days) that are no longer in `askGoogle`, newest first */
  askedGoogle: IndexPage[];
  /** wave 2: the sitemap switch, the access Google reports for us and the submissions we made */
  sitemap: IndexSitemapState;
  totals: IndexLaneSummary & { backlogLeft: number; daysToFinish: number | null };
  lanes: Record<IndexLane, IndexLaneSummary>;
  groups: IndexGroup[];
  dropped: IndexPage[];
  runs: IndexRun[];
  events: GoogleEvent[];
  rollingOut: GoogleEvent | null;
  freeze: { on: boolean; reason: string };
  impacts: UpdateImpact[];
  /** more page rows exist than the app reads at once */
  capped: boolean;
  pagesRead: number;
  /** wave 3 (DESIGN_WAVE3 §3.2): pages Google has not visited in the 3 weeks we watched them, with their reasons (both lanes, by priority) */
  escalated: IndexPage[];
  /** wave 3 (§2.5): the newest sitemap date reading (null: no run sent one) */
  sitemapDates: (IndexSitemapDates & { at: string; missing: boolean }) | null;
}

/** One page of a group's URLs (…/data/indexing/pages). */
export interface IndexPagesPage {
  items: IndexPage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IndexHistoryEntry {
  at: string;
  state: string;
  cause: string;
  label: string;
  evidence: string;
  coverage: string;
}

// ---------------------------------------------------------------- reading the rows

type P = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? '' : String(v));
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const b = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';
const json = <T,>(v: unknown, fallback: T): T => {
  if (v && typeof v === 'object') return v as T;
  try {
    const x = typeof v === 'string' && v.trim() ? JSON.parse(v) : null;
    return x == null ? fallback : (x as T);
  } catch {
    return fallback;
  }
};

export const indexPath = (url: string): string => s(url).replace(/^https?:\/\/[^/]+/i, '') || '/';
const isCause = (c: string): c is IndexCause => (INDEX_CAUSES as readonly string[]).includes(c);
const isAction = (a: string): a is IndexAction => (INDEX_ACTIONS as readonly string[]).includes(a);
const isState = (x: string): x is IndexState => (INDEX_STATES as readonly string[]).includes(x);

/** The action a page is shown under. The engine files `not_checked` (state `error`) and `unclassified` under `none`; the app never shows
 *  them as "In search" (A3): a failed check is `retry`, any other page that is not in search with no action is `review`. */
function displayAction(raw: string, c: IndexCause | 'other', st: IndexState): IndexAction {
  if (st === 'error' || c === 'not_checked') return 'retry';
  const a: IndexAction = isAction(raw) && raw !== 'review' && raw !== 'retry' ? raw : c !== 'other' ? INDEX_CAUSE_INFO[c].action : 'none';
  if (a === 'none' && (st === 'not_indexed' || st === 'excluded')) return 'review';
  return a;
}

/** wave 2: `linked_by` as the engine stores it (a JSON list, '' = none found, 'unread' = not read this run). */
function linkedByOf(v: unknown): { urls: string[]; read: boolean } {
  const raw = s(v).trim();
  if (raw.toLowerCase() === 'unread') return { urls: [], read: false };
  const xs = json<unknown[]>(raw, []);
  return { urls: (Array.isArray(xs) ? xs : []).map((x) => s(x && typeof x === 'object' ? (x as P).url : x)).filter((u) => /^https?:\/\//i.test(u)).slice(0, 3), read: true };
}

/**
 * Fix wave 2 (N4 / N-app-1, the shared rule with the engine): a non-empty `fix_seen_at` means "fixed on your site, waiting for Google",
 * whatever the order of `inspect_at` and `fix_seen_at`. The engine re-inspects such a page within a day or two while it keeps the first
 * sighting, so Google's newer inspection is the normal case, not a sign the fix is gone. Only the engine sets and clears it: it clears it
 * when Google reports the cause gone, or when Google crawled after the fix and still reports the cause (the row is then `site_fix` again).
 */
const fixSeen = (fix: string): string => fix.trim();
/** The sentence of the engine's 14-day "asked Google" note that is wrong for a page that needs the client (W9). */
const NOTHING_MORE_TO_DO = /\s*There is nothing more to do on your side for now\.?/;

/** 2026-11-05: the engine writes the improvement into its note on its next run; until then (the app's overlay) the app says it. */
const IMPROVED_NOTE = /improved version/i;
function improvedNote(imp: ImproveState, at: string, crawl: string, to: string, note: string): string {
  if (!imp || IMPROVED_NOTE.test(note)) return note;
  if (imp === 'moved') {
    const p = indexPath(to);
    return `An improved version of this page went live at ${p} on ${at.slice(0, 10)}, and this address still opens the old page, so the two compete for the same search. Redirect this address to ${p} with a permanent (301) redirect, or put the improved text back on this address and remove ${p}, so Google treats them as one page. We check the redirect for you every day.`;
  }
  if (imp === 'waiting')
    return `You published an improved version on ${at.slice(0, 10)}. Google has not read the new version yet, so it still shows its older reading. We look up Google's reading again in the days after; asking Google to read it again in Search Console can help, and Google still decides.`;
  return `Google read your improved version on ${crawl.slice(0, 10)} and still left it out for now. ${note}`.trim();
}

export function indexPageOf(r: Partial<IndexPageRow>): IndexPage {
  const cause = s(r.cause);
  const state = s(r.state);
  const st: IndexState = isState(state) ? state : 'unknown';
  const c: IndexCause | 'other' = isCause(cause) ? cause : cause ? 'other' : state === 'indexed' ? 'indexed' : 'other';
  const linkFrom = json<P[]>(r.link_from, []);
  // R1: a fix Google did not take (`fix_failed_at`) wins over a sighting of the fix that is not newer than it (the engine clears
  // `fix_failed_at` before it records a new sighting, so a newer `fix_seen_at` is a later fix, waiting for Google again)
  const seen = st === 'indexed' ? '' : fixSeen(s(r.fix_seen_at));
  const failedAt = st === 'indexed' ? '' : s(r.fix_failed_at).trim();
  const fixFailedAt = failedAt && (!seen || failedAt >= seen) ? failedAt : '';
  const fixSeenAt = fixFailedAt ? '' : seen;
  const utility = isUtilityPage(s(r.url));
  // wave 2 (DESIGN_WAVE2 §2.4): the engine files policy and utility pages under `leave_out` (low_value); the app keeps the engine's action
  // (its counts are the page's), and only never offers "Improve this page", "ask Google" or a link from such a page
  const raw = displayAction(s(r.action), c, st);
  const linked = linkedByOf(r.linked_by);
  const action = fixFailedAt && raw === 'wait' && isCause(c) && INDEX_CAUSE_INFO[c].action === 'site_fix' ? 'site_fix' : raw;
  // 2026-11-05 (improveStateOf, the engine's rule): an improved version Google has not read yet waits for Google; once Google read it, the
  // page's own action is back (the engine's `wait` of the day before, or a row the app overlaid before the engine ran, are read the same way)
  const imp = improveStateOf(r);
  const improvedAt = imp ? s(r.improved_at).trim() : '';
  // 'moved': a step on the website (a permanent redirect to the improved version), whatever the engine's row of the day before said
  const shownRaw = imp === 'moved' ? 'site_fix' : imp === 'waiting' ? 'wait' : imp === 'read' && (action === 'wait' || action === 'site_fix') && isCause(c) ? INDEX_CAUSE_INFO[c].action : fixSeenAt && action === 'site_fix' ? 'wait' : action;
  // wave 3 (DESIGN_WAVE3 §2.4 / §3.4): the client's own mark, shown at once (the engine files the page the same way on its next run)
  const ov = typeOverrideOf(r.type_override);
  const out = st !== 'indexed';
  const markedUtility = ov === 'utility' && out;
  const engineNote = s(r.note).trim();
  // marked important on a policy page the engine still files as left out on purpose, or a mark undone on a page the engine left out because
  // of that mark: waiting for our next check, which files it again (never "fine to leave out" for a page the client says matters)
  const pendingImportant = ov === 'important' && out && c === 'low_value' && shownRaw === 'leave_out' && isUtilityPage(s(r.url));
  const pendingUndo = ov === '' && out && c === 'low_value' && shownRaw === 'leave_out' && engineNote.includes(INDEX_MARKED_UTILITY_PREFIX);
  const typePending = pendingImportant || pendingUndo;
  const shown: IndexAction = markedUtility ? 'leave_out' : typePending ? 'wait' : shownRaw;
  const utilityShown = ov === 'important' ? false : utility;
  const escalatedAt = !markedUtility && !typePending && out && (shown === 'wait' || shown === 'links') ? s(r.escalated_at).trim() : '';
  const priority = markedUtility || !out ? 0 : Math.max(0, Math.round(n(r.priority)));
  const depth = Math.max(0, Math.round(n(r.link_depth)));
  const robots = s(r.robots_ok).trim().toLowerCase();
  const pageNote = markedUtility
    ? INDEX_MARKED_UTILITY_NOTE
    : pendingImportant
      ? 'You marked this page as important. Our next daily check reads it again as a normal page and says what it needs.'
      : pendingUndo
        ? 'You undid your mark. Our next daily check reads this page again and files it where it belongs.'
        : '';
  return {
    url: s(r.url),
    path: indexPath(s(r.url)),
    title: s(r.title).slice(0, 200),
    lane: s(r.lane) === 'new' ? 'new' : 'existing',
    state: st,
    cause: markedUtility ? 'low_value' : c,
    action: shown,
    inSitemap: b(r.in_sitemap),
    impressions28d: n(r.impressions_28d),
    clicks28d: n(r.clicks_28d),
    lastImpressionAt: s(r.last_impression_at),
    checkedAt: [s(r.inspect_at), s(r.fetch_at)].filter(Boolean).sort().pop() ?? '',
    evidence: s(r.evidence),
    coverage: s(r.coverage),
    httpStatus: n(r.http_status),
    noindex: s(r.noindex),
    pageCanonical: s(r.page_canonical),
    googleCanonical: s(r.google_canonical),
    finalUrl: s(r.final_url),
    lastCrawl: s(r.last_crawl),
    words: n(r.words),
    droppedAt: s(r.dropped_at),
    indexedSince: s(r.indexed_since),
    checks: n(r.checks),
    nextCheckAt: s(r.next_check_at),
    needsPerson: b(r.needs_person),
    linkFrom: (Array.isArray(linkFrom) ? linkFrom : [])
      .map((x) => ({ url: s(x?.url), title: s(x?.title).slice(0, 200) }))
      .filter((x) => /^https?:\/\//i.test(x.url))
      // wave 2: a policy or utility page is never suggested as a page to link from (an older row's "/cookies")
      .filter((x) => !isUtilityPage(x.url) && !isJobPosting(x.url))
      .slice(0, 5),
    mergeInto: s(r.merge_into),
    // wave 2 review W9: the engine's 14-day "asked Google" note replaced the whole note, whatever the action; a page that now needs the client
    // (a fix on the website, a link...) never reads "nothing more to do on your side"
    note: (pageNote || improvedNote(imp, improvedAt, s(r.last_crawl), s(r.improved_to), (INDEX_ACTIONS_NEED_YOU.has(shown) ? s(r.note).replace(NOTHING_MORE_TO_DO, '').trim() : s(r.note)))).slice(0, 500),
    publishedAt: s(r.published_at),
    inspectedAt: s(r.inspect_at),
    fetchedAt: s(r.fetch_at),
    fixSeenAt,
    fixFailedAt,
    // wave 3 (§2.6): the engine now offers job postings last; a page the client marked as fine to leave out is never asked about
    askGoogle: b(r.ask_google) && st !== 'indexed' && !utilityShown && !markedUtility && !typePending,
    linkedBy: linked.urls,
    linkedRead: linked.read,
    askedGoogleAt: s(r.asked_google_at).trim(),
    googleReadAfterAskAt: s(r.google_read_after_ask_at).trim(),
    askNotRecorded: '',
    utility: utilityShown,
    improvedAt,
    improvedWaiting: imp === 'waiting',
    improvedReadAt: imp === 'read' ? s(r.last_crawl) : '',
    improvedTo: imp === 'moved' ? s(r.improved_to).trim() : '',
    priority,
    doFirst: priority >= 1 && priority <= INDEX_DO_FIRST,
    escalatedAt,
    escalateWhy: escalatedAt ? escalateWhyOf(r.escalate_why) : [],
    typeOverride: ov,
    typePending,
    robotsOk: robots === 'yes' || robots === 'no' ? robots : '',
    linkDepth: depth,
    linkedN: Math.max(0, Math.round(n(r.linked_n))),
    indexnowAt: s(r.indexnow_at).trim(),
    inSitemapRead: r.in_sitemap != null && s(r.in_sitemap) !== '',
  };
}

/** wave 3: the engine's note on a page the client marked as fine to leave out starts with this (case aside). */
const INDEX_MARKED_UTILITY_PREFIX = 'You marked this page as fine to leave out';
const typeOverrideOf = (v: unknown): IndexPageType => {
  const x = s(v).trim().toLowerCase();
  return x === 'important' || x === 'utility' ? x : '';
};
/** wave 3 (§2.2): the reasons in the engine's order, unknown codes dropped, each once. */
function escalateWhyOf(v: unknown): IndexEscalateWhy[] {
  const xs = new Set(s(v).split(',').map((x) => x.trim().toLowerCase()));
  return INDEX_ESCALATE_WHY.filter((c) => xs.has(c));
}

export function indexRunOf(r: Partial<IndexRunRow>): IndexRun {
  const sm = runSitemapsOf(r.sitemaps_json);
  const dropped = json<P[]>(r.dropped_json, []);
  const counts = (v: unknown) => Object.fromEntries(Object.entries(json<P>(v, {})).map(([k, x]) => [k, n(x)]).filter(([, x]) => (x as number) > 0));
  return {
    runAt: s(r.run_at),
    known: n(r.known),
    indexed: n(r.indexed),
    notIndexed: n(r.not_indexed),
    excluded: n(r.excluded),
    unknown: n(r.unknown),
    errors: n(r.errors),
    newPages: n(r.new_pages),
    newIndexed: n(r.new_indexed),
    inspected: n(r.inspected),
    reused: n(r.reused),
    fetched: n(r.fetched),
    quotaCap: n(r.quota_cap),
    backlogLeft: n(r.backlog_left),
    byCause: counts(r.by_cause_json),
    byAction: counts(r.by_action_json),
    dropped: (Array.isArray(dropped) ? dropped : []).map((x) => ({ url: s(x?.url), at: s(x?.at), cause: s(x?.cause) })).filter((x) => x.url).slice(0, 20),
    freeze: b(r.freeze),
    freezeReason: s(r.freeze_reason),
    note: s(r.note).slice(0, 1500),
    // the engine writes a run row for a website it could not check at all: no page, no inspection, and a note that says why (fix wave 1:
    // or `checked: false`, its figures carried from the last check)
    failed: sm?.checked === false || (n(r.known) === 0 && n(r.inspected) === 0 && n(r.reused) === 0 && !!s(r.note).trim()),
    accessLost: /refused access|no access|not part of this property|permission/i.test(s(r.note)),
    sitemaps: sm,
    reservation: !!sm?.reservation,
  };
}

function runSitemapsOf(v: unknown): IndexRunSitemaps | null {
  if (v == null || v === '') return null;
  const x = json<P | null>(v, null);
  if (!x || typeof x !== 'object') return null;
  const num = (k: string): number | null => (x[k] == null || x[k] === '' || !Number.isFinite(Number(x[k])) ? null : Number(x[k]));
  const errors = Array.isArray(x.errors) ? x.errors.length : n(x.errors);
  // an explicit flag from a newer engine wins; otherwise a failed sitemap or a cap means the tree was read only in part
  const partial = x.complete === false || x.partial === true ? true : x.complete === true ? false : b(x.capped) || errors > 0;
  const subs = Array.isArray(x.submissions) ? (x.submissions as P[]) : [];
  const list = [x.list, x.listed, x.sitemaps].find(Array.isArray) as P[] | undefined;
  return {
    submitted: num('submitted'),
    submittedErrors: num('submitted_errors'),
    read: n(x.read),
    partial,
    checked: x.checked === true ? true : x.checked === false ? false : null,
    reservation: b(x.reservation),
    permission: s(x.permission).trim().slice(0, 40),
    permissionFull: x.permission_full === true || x.permission_full === 'true' ? true : x.permission_full === false || x.permission_full === 'false' ? false : null,
    submissions: subs
      .map((y) => ({ path: s(y?.path).slice(0, 500), at: s(y?.at), status: s(y?.status).slice(0, 40), reason: s(y?.reason).slice(0, 300), confirmedAt: s(y?.confirmed_at), readAt: s(y?.read_at) }))
      .filter((y) => y.path && y.at)
      .slice(0, 10),
    listed: (list ?? [])
      .filter((y) => y && typeof y === 'object')
      .map((y) => ({ path: s(y.path).slice(0, 500), lastSubmitted: s(y.lastSubmitted ?? y.last_submitted), lastDownloaded: s(y.lastDownloaded ?? y.last_downloaded) }))
      .filter((y) => y.path)
      .slice(0, 20),
    // W1: only an explicit true from the engine is "we will submit" (an older row without the field never promises a submission)
    willSubmit: x.submit && typeof x.submit === 'object' ? (x.submit as P).will_submit === true : false,
    blocked: x.submit && typeof x.submit === 'object' ? sitemapBlockedOf((x.submit as P).blocked, (x.submit as P).gate) : '',
    dates: sitemapDatesOf(x.dates),
  };
}

/** wave 3 (§2.5): `sitemaps_json.dates` = `{ urls, with_lastmod, distinct }` (null when absent or not numbers). */
function sitemapDatesOf(v: unknown): IndexSitemapDates | null {
  const x = json<P | null>(v, null);
  if (!x || typeof x !== 'object') return null;
  const k = (a: unknown) => (a == null || a === '' || !Number.isFinite(Number(a)) ? null : Math.max(0, Math.round(Number(a))));
  const urls = k(x.urls);
  const withLastmod = k(x.with_lastmod ?? x.withLastmod);
  const distinct = k(x.distinct);
  // review M2: a reading of a sitemap the engine could not read (in full) decides nothing
  if (x.read === false || urls === 0) return null;
  return urls == null || withLastmod == null || distinct == null ? null : { urls, withLastmod: Math.min(withLastmod, urls), distinct };
}

/**
 * Wave 2 review W1: the engine's reason it will not submit the website's sitemap on its next run (`sitemaps_json.submit.blocked`). An unknown
 * code reads as '' (no reason shown, and still no promise: only `will_submit === true` promises a submission).
 */
export const SITEMAP_BLOCKED = ['switch_off', 'not_full_access', 'paused', 'no_sitemap', 'outside_property', 'unchanged', 'too_soon', 'refused', 'not_set_up', 'not_read'] as const;
/** The engine's codes, plus the app's `not_read`: `blocked` '' while `submit.gate` is `not_checked` (Google's access level not read today) or
 *  `list_not_read` (Search Console's sitemap list not read today): nothing is concluded, and the client is told we could not read it. */
export type SitemapBlocked = (typeof SITEMAP_BLOCKED)[number];
const sitemapBlockedOf = (v: unknown, gate: unknown): SitemapBlocked | '' => {
  const x = s(v).trim();
  if (x && x !== 'not_read') return (SITEMAP_BLOCKED as readonly string[]).includes(x) ? (x as SitemapBlocked) : '';
  return /^(not_checked|list_not_read)$/.test(s(gate).trim()) ? 'not_read' : '';
};
/**
 * The plain reason we will not submit the sitemap, for a client who switched sitemap submission on ('' for `switch_off` and unknown codes:
 * the switch line says it is off). Never a promise about Google, never "we ask Google".
 */
export function sitemapBlockedText(code: SitemapBlocked | '' | undefined): string {
  switch (code) {
    case 'not_full_access':
      return 'Google gives us read-only access to your Search Console, so we cannot submit your sitemap. Give us Full access in Search Console, or submit it yourself.';
    case 'paused':
      return 'Sitemap submission is paused on our side for now, so we will not submit it. You can submit it yourself in Search Console.';
    case 'no_sitemap':
      return 'We could not read a sitemap on your website (robots.txt names none, and /sitemap.xml is not one), so there is nothing we can submit. Name your sitemap in robots.txt, or submit it yourself in Search Console.';
    case 'outside_property':
      return 'Your sitemap is outside the Search Console property we can read (for example on www. while the property is for the address without it), so we cannot submit it there. Submit it yourself in the property that covers it.';
    case 'unchanged':
      return 'Your sitemap has not changed since it was last submitted, so there is nothing to submit.';
    case 'too_soon':
      return 'We submitted your sitemap in the last 7 days. We submit it at most once a week.';
    case 'refused':
      return 'Google refused our last submission of your sitemap, so we are not trying again for now. You can submit it yourself in Search Console.';
    case 'not_set_up':
      return 'Sitemap submission is not set up on our side yet, so we will not submit it for now. You can submit it yourself in Search Console.';
    case 'not_read':
      return 'We could not read your Search Console today, so we do not know yet whether your sitemap needs submitting. We look again on the next daily check.';
    default:
      return '';
  }
}

/** wave 2: Full access in Search Console (the only access that can submit a sitemap). */
export const SITEMAP_FULL_ACCESS: ReadonlySet<string> = new Set(['siteOwner', 'siteFullUser']);
/** full: we can submit; restricted: Google gives us read-only access; refused (W7): Google reports Full access but refused our submission */
export type IndexSitemapAccess = 'full' | 'restricted' | 'refused' | 'unknown';

/** One sitemap submission as the Indexing page shows it. */
export interface IndexSitemapSubmission {
  path: string;
  at: string;
  /** ok: Google accepted it; refused: Google answered that we may not; pending (wave 2 review W13): our attempt, recorded before Google's
   *  answer, with no answer kept (never shown as done); error: anything else (`failed`, `not_set_up`: nothing reached Google) */
  status: 'ok' | 'refused' | 'pending' | 'error';
  /** why we submitted it, in words ('' when the engine gave no reason we know) */
  reason: string;
  /** Search Console's list shows it submitted on or after `at` ('' = not seen yet) */
  listedAt: string;
  /** Google read (downloaded) the sitemap after `at` ('' = not yet) */
  readAt: string;
}

export interface IndexSitemapState {
  /** the client's switch (seo_monitors `index_sitemap_submit`, empty = off) */
  submitOn: boolean;
  /** the access Google reports for us, from the newest run that read it ('unknown': no run read it yet) */
  access: IndexSitemapAccess;
  permission: string;
  accessAt: string | null;
  /** newest first, at most 10 */
  submissions: IndexSitemapSubmission[];
  /** sitemaps Search Console lists and the errors it reports in them, from the newest run that read the list (null: not read) */
  submitted: number | null;
  errors: number | null;
  /** W1: the newest daily check says it will submit a sitemap on its next run (only then does the app say "we will submit it") */
  willSubmit: boolean;
  /** W1: why it will not ('' = nothing blocks, or the newest check did not say) */
  blocked: SitemapBlocked | '';
}

const submissionStatus = (v: string): IndexSitemapSubmission['status'] =>
  /^(ok|done|success|submitted|confirmed|read|accepted|2\d\d)$/i.test(v.trim())
    ? 'ok'
    : /^pending$/i.test(v.trim())
      ? 'pending'
      : /forbidden|refused|denied|permission|^4\d\d$/i.test(v)
        ? 'refused'
        : 'error';
/** The engine's reason codes in words (an unknown code is not shown). */
const SUBMISSION_REASON: Record<string, string> = {
  not_listed: 'Search Console did not list your sitemap',
  errors_changed: 'Search Console reported errors and your sitemap has changed since',
  changed: 'your sitemap changed (pages added or removed)',
};

/** The sitemap card's facts from the runs (newest first or not; reservations are skipped). Pure. */
export function indexSitemapState(runs: readonly IndexRun[], submitOn: boolean): IndexSitemapState {
  const xs = [...runs].filter((r) => r.runAt && !r.reservation && r.sitemaps).sort((a, b) => (b.runAt > a.runAt ? 1 : -1));
  const withAccess = xs.find((r) => r.sitemaps!.permission);
  const permission = withAccess?.sitemaps?.permission ?? '';
  const listed = xs.find((r) => r.sitemaps!.listed.length)?.sitemaps?.listed ?? [];
  const seen = new Set<string>();
  const submissions: IndexSitemapSubmission[] = [];
  for (const r of xs)
    for (const sub of r.sitemaps!.submissions) {
      const k = `${sub.path}|${sub.at}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const l = listed.find((y) => samePageUrl(y.path, sub.path));
      submissions.push({
        path: sub.path,
        at: sub.at,
        status: submissionStatus(sub.status),
        reason: SUBMISSION_REASON[sub.reason] ?? '',
        listedAt: sub.confirmedAt || (l && l.lastSubmitted && l.lastSubmitted >= sub.at ? l.lastSubmitted : ''),
        readAt: sub.readAt || (l && l.lastDownloaded && l.lastDownloaded > sub.at ? l.lastDownloaded : ''),
      });
    }
  submissions.sort((a, b) => b.at.localeCompare(a.at));
  const list = xs.find((r) => !r.failed && r.sitemaps!.submitted != null)?.sitemaps ?? null;
  // W1: the newest check's own word on its next run (an older row without the fields: no promise)
  const newest = xs[0]?.sitemaps ?? null;
  const willSubmit = submitOn && !!newest?.willSubmit;
  const blocked = willSubmit ? '' : (newest?.blocked ?? '');
  // W7: Google reports a Full level, but a refusal of our submission still holds (the engine's `permission_full` false, or `blocked`
  // refused): Google refused the submission, which is not read-only access
  const fullLevel = SITEMAP_FULL_ACCESS.has(permission);
  const refusedNow = fullLevel && (withAccess?.sitemaps?.permissionFull === false || blocked === 'refused');
  return {
    submitOn,
    access: !permission ? 'unknown' : !fullLevel ? (withAccess?.sitemaps?.permissionFull === true ? 'full' : 'restricted') : refusedNow ? 'refused' : 'full',
    permission,
    accessAt: withAccess?.runAt ?? null,
    submissions: submissions.slice(0, 10),
    submitted: list?.submitted ?? null,
    errors: list?.submittedErrors ?? null,
    willSubmit,
    blocked,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Final browser check (2026-10-30): a run's day in the words the page uses elsewhere ("29 Oct", "29 Oct, 08:40 UTC"), never an ISO
 *  string in a client's sentence. UTC, so the server and every browser say the same day. */
export function indexDayText(iso: string, withTime = false): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'an earlier day';
  const d = new Date(t);
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withTime ? `${day}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC` : day;
}

/** The engine's sentence about a run that failed, in words a client can act on (an internal error message is never shown). */
function runNoticeText(r: IndexRun): string {
  return indexingNoteText(r.note);
}
/** R5: the sentences the engine writes after a failed run's reason (the screen says where its figures come from, once) */
const INDEX_ENGINE_TAIL = String.raw`(?:The figures are from the last check|Nothing has been checked yet)\.?`;
const INDEX_INTERNAL_ERROR = new RegExp(String.raw`\b(?:inventory|diagnosis|sitemap reading) failed:[\s\S]*?(?=\s*${INDEX_ENGINE_TAIL}|$)`, 'gi');
const INDEX_ENGINE_FIGURES = new RegExp(String.raw`\s*${INDEX_ENGINE_TAIL}`, 'gi');
/** N-app-6: the engine's note about a check (a run row's or a report's), internal error text replaced; '' stays the default sentence. */
export function indexingNoteText(note: unknown): string {
  const t = s(note)
    .slice(0, 1500)
    // R5: an internal error message can hold dots of its own (`TypeError x.y`), so the whole of it is replaced: up to the sentence the
    // engine writes after it, or to the end of the note
    .replace(INDEX_INTERNAL_ERROR, 'Something went wrong on our side while reading this website; we try again on the next daily check.')
    // R5: the engine's own "from the last check" sentence is left to the screen, which says where the figures come from once
    .replace(INDEX_ENGINE_FIGURES, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t || 'This website could not be checked today.';
}
/** N-app-6 / N12: the index_coverage callback's summary says the run could not check the website (`failed: true` or `checked: false`). */
export const indexingReportFailed = (summary: unknown): boolean => {
  const m = summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : {};
  return m.failed === true || m.failed === 'true' || m.checked === false || m.checked === 'false';
};

export function googleEventOf(r: Partial<GoogleEventRow>): GoogleEvent {
  const kind = s(r.kind);
  const status = s(r.status);
  return {
    id: s(r.event_id),
    source: s(r.source),
    kind: kind === 'core' || kind === 'spam' || kind === 'policy_doc' ? kind : 'other',
    title: s(r.title).slice(0, 200),
    startedAt: s(r.started_at),
    endedAt: s(r.ended_at),
    status: status === 'rolling_out' || status === 'complete' || status === 'changed' ? status : 'other',
    url: /^https:\/\//i.test(s(r.url)) ? s(r.url) : '',
  };
}

const segmentOf = (v: string): UpdateImpactPage['segment'] => (v === 'dropped' || v === 'stable' || v === 'gained' ? v : 'other');

export function updateImpactOf(r: Partial<UpdateImpactRow>): UpdateImpact {
  const rows = json<P[]>(r.pages_json, []);
  const pos = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) || Number(v) <= 0 ? null : Number(v));
  return {
    eventId: s(r.event_id),
    eventTitle: s(r.event_title).slice(0, 200),
    comparedAt: s(r.compared_at),
    before: { from: s(r.before_from), to: s(r.before_to) },
    after: { from: s(r.after_from), to: s(r.after_to) },
    pages: n(r.pages),
    dropped: n(r.dropped),
    stable: n(r.stable),
    gained: n(r.gained),
    rows: (Array.isArray(rows) ? rows : [])
      .map((x) => ({
        url: s(x?.url),
        path: indexPath(s(x?.url)),
        beforeClicks: n(x?.before_clicks),
        afterClicks: n(x?.after_clicks),
        beforeImpressions: n(x?.before_impr),
        afterImpressions: n(x?.after_impr),
        beforePosition: pos(x?.before_pos),
        afterPosition: pos(x?.after_pos),
        segment: segmentOf(s(x?.segment) || s(x?.state)),
        state: s(x?.state),
        cause: s(x?.cause),
      }))
      .filter((x) => x.url)
      .slice(0, 30),
    note: s(r.note).slice(0, 500),
  };
}

/** The Google update rolling out now (a core or spam update), newest first; null when none. */
export function rollingOutEvent(events: readonly GoogleEvent[]): GoogleEvent | null {
  return [...events].filter((e) => e.status === 'rolling_out' && (e.kind === 'core' || e.kind === 'spam')).sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1))[0] ?? null;
}

/** wave 2 (DESIGN_WAVE2 §3.1): pages Google has not visited although the website already links to them (the engine's `wait` on
 *  `unknown_to_google` / `discovered_not_crawled`). No suggestions and no step: adding more links from the same website is not the answer. */
export const INDEX_LINKED_WAITING = {
  label: 'Google has not visited these yet',
  meaning: 'Your website already links to these pages, so Google can find them. Google has not visited them yet, which is common for a young website: Google visits a new website slowly at first.',
  weDo: 'We look up Google\'s reading of them again on the usual schedule, tell Bing about them, and tell you when they are in search. After 3 weeks without a visit from Google a page moves to Needs you, with what to do.',
  // wave 3 (DESIGN_WAVE3 §3.1): a to-do, never "nothing on these pages"
  youDo: 'Work through the to-do above, the pages marked Do first before the others. What also helps: links from other websites to yours.',
} as const;

/** wave 3 (§3.2): pages Google has not visited in the 3 weeks we watched them. */
export const INDEX_ESCALATED = {
  label: 'Needs you: Google has not visited after 3 weeks',
  meaning: 'Google has not visited these pages in the 3 weeks we have watched them. Each page lists what is most likely holding it back, most likely first.',
  weDo: 'We keep looking up Google\'s reading of them, tell Bing about them, and move a page back once Google has visited it.',
  youDo: 'Do the steps under each page, in order. Google still decides when it visits.',
} as const;

/** wave 3 (§3.4): pages the client marked as fine to leave out. */
export const INDEX_MARKED_UTILITY_GROUP = {
  label: 'Pages you marked as fine to leave out',
  meaning: 'You told us these pages do not need to be in Google. We no longer count them as missing and do not suggest asking Google about them.',
  weDo: 'We still look at them now and then and keep them here.',
  youDo: 'Nothing. Press Undo on a page if it should be in Google after all.',
} as const;

/** wave 3 (§3.4): pages whose mark the client changed, until the next daily check files them again. */
export const INDEX_TYPE_PENDING_GROUP = {
  label: 'Waiting for our next check',
  meaning: 'You changed how these pages should be treated. Until our next daily check reads them again, they wait here.',
  weDo: 'Our next daily check reads them again and files each one where it belongs, usually the next morning.',
  youDo: 'Nothing for now.',
} as const;

/** wave 2 (§2.2): pages with a title of their own whose canonical tag names another page (`canonical_elsewhere` outside the sitemap, or with
 *  the engine's note "This page tells Google it is a copy of ..."; the engine stores no flag for it, ENGINE_BUILD wave 2 contract 3). */
export const INDEX_CANONICAL_PARENT = {
  label: 'Pages that say they are a copy of another page',
  meaning: 'These pages have a title of their own, but their canonical tag names another page as the main version, so Google shows that page instead.',
  weDo: 'We open the pages every day and tick the step off once each one names itself as the main version.',
  youDo: 'If a page should be found on its own, point its canonical tag to the page itself, and add it to your sitemap if it is not there. If it really is a copy of the other page, skip the step.',
  taskTitle: 'Let pages with a title of their own name themselves as the main version',
} as const;

/** wave 2 (§2.4): policy and utility pages left out of search. */
export const INDEX_UTILITY_GROUP = {
  label: 'Policy and utility pages: fine to leave out',
  meaning: 'Privacy, cookie and terms pages, logins, carts and search pages do not need to be in Google. Nothing is wrong.',
  weDo: 'Nothing. We look again every 8 weeks.',
  // wave 3 (DESIGN_WAVE3 §3.4): the optional tip
  youDo: 'Nothing. You may also leave them out of your sitemap; it is optional.',
} as const;

const groupLabel = (c: IndexGroupCause): Pick<IndexCauseInfo, 'label' | 'meaning' | 'weDo' | 'youDo'> =>
  c === 'fixed_on_site'
    ? INDEX_FIXED_ON_SITE
    : c === 'improved_waiting'
      ? INDEX_IMPROVED_WAITING
    : c === 'improved_elsewhere'
      ? INDEX_IMPROVED_ELSEWHERE
    : c === 'linked_waiting'
      ? INDEX_LINKED_WAITING
      : c === 'canonical_parent'
        ? INDEX_CANONICAL_PARENT
        : c === 'utility'
          ? INDEX_UTILITY_GROUP
          : c === 'marked_utility'
            ? INDEX_MARKED_UTILITY_GROUP
            : c === 'type_pending'
              ? INDEX_TYPE_PENDING_GROUP
          : c === 'other'
      ? { label: 'Other', meaning: 'A reading we do not have words for yet.', weDo: 'We keep checking.', youDo: 'Open the address in Search Console (URL Inspection) to read Google\'s own words.' }
      : INDEX_CAUSE_INFO[c];

const groupGuide = (c: IndexGroupCause): string | null =>
  c === 'improved_elsewhere'
    ? 'index-merge-improved'
    : c === 'fixed_on_site' || c === 'improved_waiting' || c === 'linked_waiting' || c === 'other'
    ? 'index-request-indexing'
    : c === 'canonical_parent'
      ? 'index-canonical-sitemap'
      : c === 'utility' || c === 'marked_utility' || c === 'type_pending'
        ? null
        : c === 'unknown_to_google' || c === 'discovered_not_crawled'
          ? 'index-add-internal-links'
          : (INDEX_CAUSE_INFO[c].guide ?? null);

/** How many pages a group carries in the summary; the rest page in. */
export const INDEX_GROUP_PREVIEW = 25;

/** The group a page is shown in (pages fixed on the site have their own), and whether it is in one at all. One rule for the summary and
 *  the paged lists (A19): pages in search with nothing to do, and pages not checked yet that the engine did not file, are in none. */
export const indexGroupCauseOf = (p: IndexPage): IndexGroupCause => {
  // wave 3 (§3.4): the client's own mark first (shown at once, before the engine files the page again)
  if (p.typePending) return 'type_pending';
  if (p.typeOverride === 'utility' && p.action === 'leave_out') return 'marked_utility';
  if (p.fixSeenAt) return 'fixed_on_site';
  if (p.improvedWaiting) return 'improved_waiting';
  if (p.improvedTo) return 'improved_elsewhere';
  // wave 2 (DESIGN_WAVE2 §3.1): the engine's `wait` on a page it found already linked, apart from the pages that need a link
  if (p.action === 'wait' && (p.cause === 'unknown_to_google' || p.cause === 'discovered_not_crawled')) return 'linked_waiting';
  if (p.cause === 'canonical_elsewhere' && p.action === 'site_fix' && canonicalOwnTitle(p)) return 'canonical_parent';
  if (p.utility && p.action === 'leave_out') return 'utility';
  return p.cause;
};

/** The engine's note on an own-title canonical (ENGINE_BUILD wave 2, contract 3). */
export const INDEX_OWN_TITLE_NOTE = 'This page tells Google it is a copy of';
/** wave 2: a `canonical_elsewhere` page with a title of its own: not in the sitemap, or the engine's note says so. Its fix is ONLY a
 *  canonical tag that names the page itself (never "the sitemap no longer lists it"). */
export const canonicalOwnTitle = (p: Pick<IndexPage, 'inSitemap' | 'note'>): boolean => !p.inSitemap || p.note.trim().startsWith(INDEX_OWN_TITLE_NOTE);

// ---------------------------------------------------------------- "I asked Google" (DESIGN_WAVE2 §2.3 / §3.2)

/** After this many days with no newer crawl the page says so (the engine's 14-day note); it may be offered again after 28. */
export const INDEX_ASK_QUIET_DAYS = 14;
/** How long a page the client asked about stays in the "you asked Google" list once it left the engine's list. */
export const INDEX_ASKED_SHOWN_DAYS = 45;

/** What happened after the client said they asked Google to read a page again. */
export function askGoogleStatus(p: Pick<IndexPage, 'askedGoogleAt' | 'googleReadAfterAskAt'> & { askNotRecorded?: string; action?: IndexAction }, now = Date.now()): { state: 'none' | 'waiting' | 'read' | 'quiet' | 'lost'; text: string } {
  if (p.askNotRecorded)
    return { state: 'lost', text: `You told us on ${indexDayText(p.askNotRecorded)} that you asked Google, but the daily index check did not keep it. Press I asked Google again.` };
  const asked = Date.parse(p.askedGoogleAt);
  if (!p.askedGoogleAt || !Number.isFinite(asked)) return { state: 'none', text: '' };
  if (p.googleReadAfterAskAt && p.googleReadAfterAskAt >= p.askedGoogleAt) return { state: 'read', text: `Google read it again on ${indexDayText(p.googleReadAfterAskAt)}.` };
  if (now - asked >= INDEX_ASK_QUIET_DAYS * 864e5)
    return {
      state: 'quiet',
      // wave 2 review W9: a page that now needs something from the client (a fix on the website, a link...) is never told "nothing more to do"
      text: p.action && INDEX_ACTIONS_NEED_YOU.has(p.action)
        ? `You asked Google on ${indexDayText(p.askedGoogleAt)}; Google has not read it again yet. Asking again will not help for now: this page has something to fix first, shown with it.`
        : `You asked Google on ${indexDayText(p.askedGoogleAt)}; Google has not read it again yet. There is nothing more to do on your side for now.`,
    };
  return { state: 'waiting', text: `Waiting for Google to read it again (you asked on ${indexDayText(p.askedGoogleAt)}).` };
}
/** wave 3 (§3.2): an escalated page is shown once, under "Needs you: Google has not visited after 3 weeks" (`IndexingData.escalated`), never
 *  also in a group. */
export const isEscalated = (p: IndexPage): boolean => !!p.escalatedAt;
export const inIndexGroup = (p: IndexPage): boolean => p.action !== 'none' && !(p.state === 'unknown' && p.cause === 'other') && !isEscalated(p);
const byImportance = (a: IndexPage, b: IndexPage) => b.impressions28d - a.impressions28d || b.clicks28d - a.clicks28d || a.path.localeCompare(b.path);
/** wave 3 (§2.7): the engine's ranking first (pages it ranked, 1 first), then the importance order as before (rows without a rank). */
const rankOf = (p: IndexPage) => (p.priority > 0 ? p.priority : Number.MAX_SAFE_INTEGER);
const byPriority = (a: IndexPage, b: IndexPage) => rankOf(a) - rankOf(b) || byImportance(a, b);

/**
 * The page's figures from the engine's rows (pure). `rows`: the website's page rows (capped by the caller); `runs` newest first.
 * X15: the server may leave out the pages that are in search with nothing to do (most rows of a healthy website) and pass their counts
 * from the newest run that read the website as `indexedCounts`; every figure is then the same as from the whole table.
 */
export function buildIndexingData(input: {
  rows: readonly Partial<IndexPageRow>[];
  runs: readonly Partial<IndexRunRow>[];
  events: readonly Partial<GoogleEventRow>[];
  impacts: readonly Partial<UpdateImpactRow>[];
  settings: { on: boolean; dailyCap: number };
  capped?: boolean;
  /** task keys that exist on "Steps on your website" (a group links to its step only when one exists) */
  taskKeys?: ReadonlySet<string>;
  /** the in-search pages left out of `rows`, per lane (from the newest run that read the website) */
  indexedCounts?: { all: number; newLane: number };
  /** wave 2: the client's sitemap switch (seo_monitors `index_sitemap_submit`, empty = off) */
  sitemapSubmit?: boolean;
  /** wave 2: the newest "I asked Google" per page from the app's own audit log (address -> ISO), to tell a write the engine lost */
  askedByApp?: Readonly<Record<string, string>>;
  /** for tests: the time "now" is (the 14-day note, the asked list) */
  now?: number;
}): IndexingData {
  const pages = input.rows.map(indexPageOf).filter((p) => p.url);
  // ENGINE_BUILD wave 2 contract 6: a page the client said they asked about whose row does not hold it (or holds an older ask, by more than
  // a minute), and that is not in search: the write was lost to an overlapping engine run
  for (const p of pages) {
    const app = input.askedByApp?.[p.url];
    if (!app || p.state === 'indexed') continue;
    const row = Date.parse(p.askedGoogleAt);
    if (!Number.isFinite(row) || Date.parse(app) - row > 60_000) p.askNotRecorded = app;
  }
  const allRuns = [...input.runs].map(indexRunOf).filter((r) => r.runAt).sort((a, b) => (b.runAt > a.runAt ? 1 : -1));
  // engine fix wave 1: a reservation row is a run that had not finished (or crashed): never a reading, never the latest figures
  const unfinished = allRuns[0]?.reservation ? allRuns[0] : null;
  const runs = allRuns.filter((r) => !r.reservation).slice(0, 12);
  const events = [...input.events].map(googleEventOf).filter((e) => e.id).sort((a, b) => ((b.startedAt || '') > (a.startedAt || '') ? 1 : -1)).slice(0, 12);
  const impacts = [...input.impacts].map(updateImpactOf).filter((i) => i.eventId).sort((a, b) => (b.comparedAt > a.comparedAt ? 1 : -1)).slice(0, 3);
  const rolling = rollingOutEvent(events);
  const latest = runs[0];
  // the newest run that read the website: a run that read nothing (no Search Console access) is not a check (A4)
  const good = runs.find((r) => !r.failed);
  // A11: one freeze rule, the engine's: its newest run says whether suggestions to rewrite are held (it stops after 30 days); the events
  // only give the banner its words
  const freeze = latest?.freeze ? { on: true, reason: latest.freezeReason || (rolling ? `Google's ${rolling.title} is rolling out.` : 'A Google update is rolling out.') } : { on: false, reason: '' };

  const extra = (which: IndexLane | null): number => {
    if (!input.indexedCounts) return 0;
    const want = which === 'new' ? input.indexedCounts.newLane : which === 'existing' ? input.indexedCounts.all - input.indexedCounts.newLane : input.indexedCounts.all;
    const present = pages.filter((p) => p.state === 'indexed' && (!which || p.lane === which)).length;
    return Math.max(0, want - present);
  };
  const lane = (which: IndexLane | null): IndexLaneSummary => {
    const xs = which ? pages.filter((p) => p.lane === which) : pages;
    const more = extra(which);
    const checked = xs.filter((p) => p.state === 'indexed' || p.state === 'not_indexed' || p.state === 'excluded');
    return {
      known: xs.length + more,
      indexed: xs.filter((p) => p.state === 'indexed').length + more,
      shouldBe: checked.filter((p) => p.action !== 'leave_out').length + more,
      // wave 3 (§3.2): a page Google has not visited after 3 weeks needs the client, whatever its action
      needYou: xs.filter((p) => INDEX_ACTIONS_NEED_YOU.has(p.action) || isEscalated(p)).length,
      checked: checked.length + more,
      unknown: xs.filter((p) => p.state === 'unknown').length,
      errors: xs.filter((p) => p.state === 'error').length,
    };
  };
  const all = lane(null);
  const existing = lane('existing');
  // A10: the existing pages still to check (the hero says "existing pages checked"), at the configured daily checks (a run that hit the
  // quota after two probes, or a second run of the day, is not the pace)
  const backlogLeft = input.capped && good ? good.backlogLeft : existing.unknown;
  const perDay = Math.max(1, clampIndexDailyCap(input.settings.dailyCap));
  const daysToFinish = backlogLeft > 0 ? Math.ceil(backlogLeft / perDay) : pages.length ? 0 : null;

  // wave 3 (§2.5): the newest run that sent a sitemap date reading
  const datesRun = runs.find((r) => !r.failed && r.sitemaps?.dates);
  const sitemapDates = datesRun?.sitemaps?.dates ? { ...datesRun.sitemaps.dates, at: datesRun.runAt, missing: sitemapDatesMissing(datesRun.sitemaps.dates) } : null;
  const byGroup = new Map<string, IndexPage[]>();
  for (const p of pages) {
    if (!inIndexGroup(p)) continue;
    const id = `${p.lane}:${p.action}:${indexGroupCauseOf(p)}`;
    const g = byGroup.get(id);
    if (g) g.push(p);
    else byGroup.set(id, [p]);
  }
  const groups: IndexGroup[] = [...byGroup.entries()].map(([id, xs]) => {
    const [ln, action, cause] = id.split(':') as [IndexLane, IndexAction, IndexGroupCause];
    const info = groupLabel(cause);
    // wave 2: the canonical pages outside the sitemap are part of the `indexing:canonical_elsewhere` step; the pages that need a link have
    // one step of their own (`indexing:links`)
    const taskKey = action === 'site_fix' && cause === 'improved_elsewhere' ? INDEXING_MERGE_KEY : action === 'site_fix' && cause === 'canonical_parent' ? indexingTaskKey('canonical_elsewhere') : action === 'site_fix' && isSiteFixCause(cause) ? indexingTaskKey(cause) : action === 'links' ? INDEXING_LINKS_KEY : null;
    return {
      id,
      lane: ln,
      action,
      cause,
      count: xs.length,
      label: info.label,
      meaning: info.meaning,
      weDo: info.weDo,
      youDo: info.youDo,
      guide: groupGuide(cause),
      taskKey: taskKey && (!input.taskKeys || input.taskKeys.has(taskKey)) ? taskKey : null,
      pages: [...xs].sort(byPriority).slice(0, INDEX_GROUP_PREVIEW),
      // wave 3 (§3.4): the policy card names the pages it holds
      ...(cause === 'utility' ? { meaning: indexUtilityCardText(xs) } : {}),
      // wave 3 (§3.1): the waiting group is a to-do
      ...(cause === 'linked_waiting' ? { todo: indexWaitingTodo(xs, { sitemapNoDates: !!sitemapDates?.missing }) } : {}),
    };
  });
  groups.sort((a, b) => INDEX_ACTION_ORDER.indexOf(a.action) - INDEX_ACTION_ORDER.indexOf(b.action) || b.count - a.count || a.id.localeCompare(b.id));

  const dropped = pages
    .filter((p) => p.droppedAt && p.state !== 'indexed')
    .sort((a, b) => (b.droppedAt > a.droppedAt ? 1 : -1))
    .slice(0, 50);
  // FIX_CONTRACT (X8): never a page left out on purpose, never a rewrite while an update rolls out
  const askGoogle = pages.filter((p) => p.askGoogle && p.action !== 'leave_out' && !(freeze.on && p.action === 'quality')).sort(byPriority).slice(0, 5);
  // wave 2 (§3.2): pages the client said they asked Google about that left the engine's list, with what happened since (newest first)
  const askedSince = (input.now ?? Date.now()) - INDEX_ASKED_SHOWN_DAYS * 864e5;
  const askedAt = (p: IndexPage) => p.askNotRecorded || p.askedGoogleAt;
  const askedGoogle = pages
    .filter((p) => askedAt(p) && Date.parse(askedAt(p)) >= askedSince && !askGoogle.some((x) => x.url === p.url))
    .sort((a, b) => askedAt(b).localeCompare(askedAt(a)))
    .slice(0, 10);
  const checkedAt = good?.runAt || pages.map((p) => p.checkedAt).filter(Boolean).sort().pop() || null;
  const notice: IndexingData['notice'] = unfinished && !latest?.failed
    ? { tone: 'info', title: 'The latest check had not finished', text: `The check that started ${indexDayText(unfinished.runAt, true)} had not finished when this page was read, so the figures are from the check before.`, failed: false, accessLost: false, at: unfinished.runAt }
    : latest?.failed
    ? {
        tone: 'warning',
        title: latest.accessLost ? 'Our last check could not read Search Console' : latest.sitemaps?.checked === false ? 'The last check did not read this website' : 'Our last check could not read this website',
        text: `${runNoticeText(latest)}${good ? ` The figures below are from the check of ${indexDayText(good.runAt)}.` : ''}`,
        failed: true,
        accessLost: latest.accessLost,
        at: latest.runAt,
      }
    : latest?.note
      ? { tone: /quota|refused|could not|errors? in a submitted|no sitemap/i.test(latest.note) ? 'warning' : 'info', title: 'What the last check could not read', text: runNoticeText(latest), failed: false, accessLost: latest.accessLost, at: latest.runAt }
      : null;
  const sm = runs.find((r) => !r.failed && r.sitemaps)?.sitemaps ?? null;
  return {
    status: pages.length || (good && runs.length) ? 'ok' : runs.length ? 'failed' : 'empty',
    error: null,
    settings: input.settings,
    checkedAt,
    notice,
    sitemapPartial: !!sm?.partial,
    askGoogle,
    askedGoogle,
    sitemap: indexSitemapState(runs, !!input.sitemapSubmit),
    totals: { ...all, backlogLeft, daysToFinish },
    lanes: { new: lane('new'), existing },
    groups,
    dropped,
    runs,
    events,
    rollingOut: rolling,
    freeze,
    impacts,
    capped: !!input.capped,
    pagesRead: pages.length,
    escalated: pages.filter(isEscalated).sort(byPriority).slice(0, 50),
    sitemapDates,
  };
}

/** A group's pages, paged (…/data/indexing/pages): the same groups and the same sort as the summary (A19). */
export function indexPagesPage(rows: readonly Partial<IndexPageRow>[], q: { lane?: string; action?: string; cause?: string; dropped?: boolean; page?: number; pageSize?: number }): IndexPagesPage {
  const pageSize = Math.min(100, Math.max(5, Math.round(Number(q.pageSize) || 25)));
  const page = Math.max(1, Math.round(Number(q.page) || 1));
  const all = rows
    .map(indexPageOf)
    .filter((p) => p.url)
    .filter((p) =>
      q.dropped
        ? !!p.droppedAt && p.state !== 'indexed'
        : inIndexGroup(p) && (!q.lane || p.lane === q.lane) && (!q.action || p.action === q.action) && (!q.cause || indexGroupCauseOf(p) === q.cause),
    )
    .sort(byPriority);
  return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
}

export function indexHistoryLabel(state: string, cause: string): string {
  if (isCause(cause)) return INDEX_CAUSE_INFO[cause].label;
  if (state === 'indexed') return INDEX_CAUSE_INFO.indexed.label;
  if (state === 'unknown') return 'Not checked yet';
  return state ? state.replace(/_/g, ' ') : 'Unknown';
}

// ---------------------------------------------------------------- wave 3: a to-do for every page Google left out (DESIGN_WAVE3 §3)

/** ok: passed; fail / warn: shown in the warning colour; unknown: we could not read it ("not checked", never shown as passed). */
export type IndexCheckStatus = 'ok' | 'fail' | 'warn' | 'unknown';
export interface IndexPageCheck {
  key: 'opens' | 'indexable' | 'robots' | 'sitemap' | 'links' | 'words' | 'bing';
  status: IndexCheckStatus;
  text: string;
}
/** A page under this many words is short (the engine's `short_page`), job postings aside. */
export const INDEX_SHORT_PAGE_WORDS = 300;

/** wave 3 (§3.1): "What we checked" for one page, from its row only. A value the engine did not read is "not checked", never a pass. */
export function indexPageChecks(p: IndexPage): IndexPageCheck[] {
  const out: IndexPageCheck[] = [];
  out.push(!p.httpStatus ? { key: 'opens', status: 'unknown', text: 'Opens: not checked' } : p.httpStatus === 200 ? { key: 'opens', status: 'ok', text: 'Opens (200)' } : { key: 'opens', status: 'fail', text: `Answers ${p.httpStatus}` });
  out.push(
    p.noindex
      ? { key: 'indexable', status: 'fail', text: `Says noindex in the ${p.noindex === 'header' ? 'server answer' : 'page'}` }
      : p.httpStatus === 200
        ? { key: 'indexable', status: 'ok', text: 'Can be indexed (no noindex)' }
        : { key: 'indexable', status: 'unknown', text: 'Can be indexed: not checked' },
  );
  out.push(p.robotsOk === 'yes' ? { key: 'robots', status: 'ok', text: 'robots.txt allows it' } : p.robotsOk === 'no' ? { key: 'robots', status: 'fail', text: 'robots.txt blocks it' } : { key: 'robots', status: 'unknown', text: 'robots.txt: not checked' });
  out.push(!p.inSitemapRead ? { key: 'sitemap', status: 'unknown', text: 'Sitemap: not checked' } : p.inSitemap ? { key: 'sitemap', status: 'ok', text: 'In your sitemap' } : { key: 'sitemap', status: 'fail', text: 'Not in your sitemap' });
  const linkedN = Math.max(p.linkedN, p.linkedBy.length);
  if (!p.linkedRead) out.push({ key: 'links', status: 'unknown', text: 'Links to it: not checked' });
  else if (p.linkDepth === 1 || p.linkedBy.some(isSiteRoot)) out.push({ key: 'links', status: 'ok', text: `Linked from your home page${linkedN > 1 ? ` (${linkedN} pages)` : ''}` });
  else if (!linkedN) out.push({ key: 'links', status: 'fail', text: 'No page of yours links to it that we found' });
  else
    out.push({
      key: 'links',
      status: linkedN <= 1 ? 'warn' : 'ok',
      text: p.linkedBy.length ? `Linked from ${indexPath(p.linkedBy[0])}${linkedN > 1 ? ` (${linkedN} pages)` : ''}` : `Linked from ${linkedN} page${linkedN === 1 ? '' : 's'} of yours`,
    });
  out.push(!p.words ? { key: 'words', status: 'unknown', text: 'Length: not checked' } : { key: 'words', status: p.words < INDEX_SHORT_PAGE_WORDS && !isJobPosting(p.url) ? 'warn' : 'ok', text: `${p.words.toLocaleString('en-US')} words` });
  if (p.indexnowAt) out.push({ key: 'bing', status: 'ok', text: `Sent to Bing ${indexDayText(p.indexnowAt)}` });
  return out;
}

/** One step for a page Google has not visited after 3 weeks (§3.2), in the engine's order. */
export interface IndexEscalationStep {
  code: IndexEscalateWhy;
  text: string;
  /** the "Show me how" guide (null: none) */
  guide: string | null;
  /** the step is to improve the page ("Improve this page"); never while a Google update rolls out */
  improve: boolean;
}
/** wave 3 (§3.2): the first sentence of every escalated page. */
export const INDEX_ESCALATED_LEAD = 'Google has not visited this page in the 3 weeks we have watched it.';
export function indexEscalationSteps(p: Pick<IndexPage, 'escalateWhy' | 'linkedN' | 'linkedBy' | 'words' | 'url'> & { linkDepth?: number }, opts: { freeze: boolean }): IndexEscalationStep[] {
  return p.escalateWhy.map((code): IndexEscalationStep => {
    switch (code) {
      case 'not_asked':
        return { code, text: 'Ask Google to read it in Search Console, then press I asked Google here.', guide: 'index-request-indexing', improve: false };
      case 'asked_no_visit':
        return { code, text: 'Google did not come even after you asked, so it does not see the page as important yet: link it from your home page or main menu, and get a link from another website.', guide: 'index-add-internal-links', improve: false };
      case 'weak_links': {
        // review M1: the same three wordings as the engine's note (a page the home page links is never called weakly linked by the engine)
        const k = Math.max(p.linkedN, p.linkedBy.length);
        return {
          code,
          text: p.linkDepth === 1 || p.linkedBy.some(isSiteRoot)
            ? 'Only your home page links here: also link it from related pages.'
            : k ? `Only ${k} page${k === 1 ? '' : 's'} link${k === 1 ? 's' : ''} here and your home page does not: link it from your home page or main menu.` : 'We found no page of yours that links here: link it from your home page or main menu.',
          guide: 'index-add-internal-links',
          improve: false,
        };
      }
      case 'short_page': {
        const w = p.words ? ` (${p.words.toLocaleString('en-US')} words)` : '';
        return opts.freeze
          ? { code, text: `The page is short${w}: add what a buyer needs to know, after Google's update finishes.`, guide: null, improve: false }
          : { code, text: `The page is short${w}: add what a buyer needs to know.`, guide: null, improve: !isJobPosting(p.url) };
      }
      case 'not_in_sitemap':
        return { code, text: 'Add it to your sitemap.', guide: 'index-not-in-sitemap', improve: false };
      case 'sitemap_no_dates':
        return { code, text: 'Add the date each page last changed to your sitemap.', guide: 'index-sitemap-dates', improve: false };
      default: {
        const never: never = code;
        return { code: never, text: '', guide: null, improve: false };
      }
    }
  });
}

/** wave 3 (§3.1): the to-do of the "Google has not visited these yet" group. */
export interface IndexWaitTodo {
  total: number;
  /** pages marked Do first (the engine's top 5) in this group */
  matterMost: number;
  /** pages to ask Google about today (marked by the engine, not asked about lately) */
  askToday: number;
  /** pages linked from your website, but not from the home page (where we know it) */
  notFromHome: number;
  /** the website's sitemap has no usable dates */
  sitemapDates: boolean;
  /** the summary sentence, only the parts that apply */
  text: string;
}
const pg = (x: number) => `${x.toLocaleString('en-US')} page${x === 1 ? '' : 's'}`;
export function indexWaitingTodo(pages: readonly IndexPage[], opts: { sitemapNoDates: boolean; now?: number }): IndexWaitTodo {
  const total = pages.length;
  const matterMost = pages.filter((p) => p.doFirst).length;
  const askToday = pages.filter((p) => p.askGoogle && ['none', 'quiet', 'lost'].includes(askGoogleStatus(p, opts.now).state)).length;
  const notFromHome = pages.filter((p) => p.linkDepth >= 2).length;
  const parts = [
    askToday ? `ask Google to read ${pg(askToday)} today` : '',
    opts.sitemapNoDates ? 'add dates to your sitemap' : '',
    notFromHome ? `link ${pg(notFromHome)} from your home page or menu` : '',
  ].filter(Boolean);
  const head = `Google has not visited ${pg(total)}.${matterMost ? ` ${matterMost.toLocaleString('en-US')} matter${matterMost === 1 ? 's' : ''} most.` : ''}`;
  const tail = parts.length
    ? ` Do ${parts.length === 1 ? 'this' : `these ${parts.length} things`}: ${parts.join('; ')}.`
    : ' There is nothing to do on them today: we look them up again every day and tell Bing about them.';
  return { total, matterMost, askToday, notFromHome, sitemapDates: opts.sitemapNoDates, text: `${head}${tail}` };
}

/** wave 3 (§3.4): the policy card's sentence, naming the pages it holds. */
export function indexUtilityCardText(pages: readonly Pick<IndexPage, 'path'>[]): string {
  const names = [...new Set(pages.map((p) => (p.path.split(/[/?#]/).filter(Boolean).pop() ?? '').replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').toLowerCase()).filter(Boolean))];
  const shown = names.length ? ` (${names.slice(0, 3).join(', ')}${names.length > 3 ? ' and others' : ''})` : '';
  const one = pages.length === 1;
  return `${one ? '1 page looks like a policy page' : `${pages.length.toLocaleString('en-US')} pages look like policy pages`}${shown}. ${one ? 'It does' : 'They do'} not need to be in Google. If ${one ? 'it' : 'one of them'} should rank, press This is an important page.`;
}

/** wave 3 (§3.4): the mark a page's row offers (null: none). `type` is what the button writes. */
export function indexPageTypeAction(p: Pick<IndexPage, 'typeOverride' | 'typePending' | 'state' | 'utility' | 'action'>): { type: IndexPageType; label: string; text: string } | null {
  if (p.typeOverride)
    return { type: '', label: 'Undo', text: p.typeOverride === 'utility' ? INDEX_MARKED_UTILITY_NOTE : 'You marked this page as important.' };
  if (p.typePending || p.state === 'indexed') return null;
  if (p.utility && p.action === 'leave_out') return { type: 'important', label: 'This is an important page', text: '' };
  if ((p.state === 'not_indexed' || p.state === 'excluded') && p.action !== 'leave_out' && p.action !== 'none') return { type: 'utility', label: 'Fine to leave out', text: '' };
  return null;
}

/** wave 3 (§3.3): each `<url>` of a sitemap with its `<lastmod>` day (YYYY-MM-DD, '' = none). An index's `<sitemap>` entries are not counted. */
export function sitemapDateEntries(xml: string): { loc: string; day: string }[] {
  const out: { loc: string; day: string }[] = [];
  for (const m of s(xml).matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const loc = m[1].match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i)?.[1];
    if (!loc) continue;
    const lm = m[1].match(/<lastmod>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i)?.[1] ?? '';
    out.push({ loc: loc.replace(/&amp;/g, '&'), day: /^\d{4}-\d{2}-\d{2}/.test(lm) ? lm.slice(0, 10) : '' });
  }
  return out;
}

// ---------------------------------------------------------------- steps on the client's website

export const INDEXING_TASK_PREFIX = 'indexing:';
export const indexingTaskKey = (cause: IndexSiteFixCause): string => `${INDEXING_TASK_PREFIX}${cause}`;
export function indexingCauseOfKey(key: string): IndexSiteFixCause | null {
  if (!key.startsWith(INDEXING_TASK_PREFIX)) return null;
  const c = key.slice(INDEXING_TASK_PREFIX.length);
  return isSiteFixCause(c) ? c : null;
}
/** wave 2 (DESIGN_WAVE2 §3.2): the one step for the pages that need a link from another page of the website (kind `index_links`). */
export const INDEXING_LINKS_KEY = 'indexing:links';
/** 2026-11-05: the one step for the pages whose improved version went live at another address (kind `index_merge`): redirect each old
 *  address permanently to its improved version. Built from the content log (the confirmed publish), checked by our own fetch. */
export const INDEXING_MERGE_KEY = 'indexing:merge';
/** The (old address, improved version) pairs that step lists and our own check opens at most. */
export const INDEXING_MERGE_MAX_PAIRS = 10;
export interface IndexMergePair {
  from: string;
  to: string;
  at: string;
}
/** The home page of a website (path "/" or none, a query or fragment aside): never the old address of a merge, never asked to redirect. */
export const isSiteRoot = (url: string): boolean => /^https?:\/\/[^/?#]+\/?(?:[?#].*)?$/i.test(s(url).trim());
/** The pairs of that step from the content log's improvements (the newest per old address, most recent first). An old address whose
 *  newest improvement went live at the address itself has no pair. */
export function indexMergePairs(improvements: readonly IndexImprovement[]): IndexMergePair[] {
  const by = new Map<string, IndexMergePair>();
  for (const i of improvements) {
    // prod 2026-11-10 (devaicon.com): a page planned as an update of the home page and published as a page of its own is no merge: the client
    // is never asked to redirect their home page (that step could never be done)
    if (isSiteRoot(i.url)) continue;
    const k = i.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    const had = by.get(k);
    if (!had || isoMs(i.at) > isoMs(had.at)) by.set(k, { from: i.url, to: i.to, at: i.at });
  }
  return [...by.values()].filter((p) => p.to).sort((a, b) => isoMs(b.at) - isoMs(a.at)).slice(0, INDEXING_MERGE_MAX_PAIRS);
}
/**
 * The check of one pair (pure; the server fetches). Done when the old address answers a PERMANENT redirect (301 / 308) that ends on the
 * improved version and that page opens, or (the other way to make one page of two) the old address opens and the new one is gone (404 /
 * 410) or redirects permanently back to it. A temporary redirect is "almost". `first`: the old address's own answer (no redirect
 * followed); `end`: where its redirect ends (followed); `other`: the new address's own answer (asked only when the old one opens).
 */
export function indexMergeVerdict(
  pair: { from: string; to: string },
  first: { status: number; location?: string | null } | null,
  end: { status: number; finalUrl: string } | null,
  other: { status: number; location?: string | null } | null,
): { done: boolean; reached: boolean; message: string } {
  const from = indexPath(pair.from), to = indexPath(pair.to);
  if (!first) return { done: false, reached: false, message: `${from} did not answer.` };
  if (first.status >= 300 && first.status < 400) {
    if (first.status !== 301 && first.status !== 308) return { done: false, reached: true, message: `${from} redirects with a temporary ${first.status}. Make it a permanent 301.` };
    if (!end) return { done: false, reached: false, message: `${from} redirects, but where it leads did not answer.` };
    if (!samePageUrl(end.finalUrl, pair.to)) return { done: false, reached: true, message: `${from} redirects to ${indexPath(end.finalUrl)}, not to ${to}.` };
    if (end.status !== 200) return { done: false, reached: true, message: `${from} redirects to ${to}, but that page answers ${end.status}.` };
    return { done: true, reached: true, message: `${from} redirects permanently to ${to}, which opens.` };
  }
  if (first.status >= 200 && first.status < 300) {
    if (!other) return { done: false, reached: false, message: `${from} still opens, and ${to} did not answer.` };
    if (other.status === 404 || other.status === 410) return { done: true, reached: true, message: `${from} opens and ${to} is gone, so they are one page again.` };
    if ((other.status === 301 || other.status === 308) && other.location && samePageUrl(other.location, pair.from)) return { done: true, reached: true, message: `${to} redirects permanently back to ${from}.` };
    return { done: false, reached: true, message: `${from} still opens its old page, and ${to} opens too.` };
  }
  return { done: false, reached: true, message: `${from} answers ${first.status}.` };
}
/** The (page to link to, page to add the link on) pairs that step lists, and our own check opens (the source pages) at most. */
export const INDEXING_LINKS_MAX_PAIRS = 10;

/** How many addresses a step lists (and the app's own check opens at most INDEXING_CHECK_MAX of them). */
export const INDEXING_TASK_MAX_URLS = 25;
export const INDEXING_CHECK_MAX_URLS = 10;

/** How many of a cause's open pages a reading carries (a step lists 25; a few more so pages that are already another step's ask can be
 *  left out and the list still holds 25, A7). */
export const INDEXING_READING_URLS = 50;

/** One cause's pages for a step, as the engine's newest rows have them. */
export interface IndexingCauseReading {
  cause: IndexSiteFixCause;
  /** pages Google still reads with this cause and that we have not seen fixed (at least this many when `complete` is false) */
  total: number;
  /** those pages, most important first (impressions, clicks), at most INDEXING_READING_URLS */
  urls: string[];
  /** A5: the newest time GOOGLE read one of those pages with this cause (its inspection; our own fetch only for a page Google never
   *  inspected). The engine's weekly re-fetch does not move it, so a stale reading of Google's never reopens a step we saw fixed. */
  readAt: string;
  /** FIX_CONTRACT `fix_seen_at`: pages our fetch saw fixed after Google's last reading, waiting for Google to read them again */
  pending: number;
  /** the newest of those sightings */
  pendingAt: string;
  /** false: the read of this cause hit its cap, so "none any more" or "all fixed" can never be concluded from it (A6) */
  complete: boolean;
  /** R1: of the open pages, how many Google read again AFTER a fix we saw and still sees the problem (`fix_failed_at`); while any does,
   *  the app's own fetch cannot close the step (absent: none) */
  googleStillSees?: number;
  /** the newest of those Google readings */
  googleStillSeesAt?: string;
  /** wave 2 (DESIGN_WAVE2 §2.2, `canonical_elsewhere` only): the listed pages with a title of their own that name another page as their main
   *  version (not in the sitemap, or the engine's own-title note). For them only a canonical tag that names the page itself is the fix, never
   *  "the sitemap no longer lists it" (absent: none) */
  ownTitle?: string[];
}

/**
 * The engine's rows of the site-fix causes grouped by cause (the input of the indexing steps). Rows of other actions are ignored.
 * `read`: the causes the caller read (N-app-2): each gets a reading even when its rows hold no open or pending page, so a cause whose read
 * hit the cap is an INCOMPLETE reading (never "none any more") rather than no reading at all, which a stored step would read as done.
 */
export function indexingCauseReadings(rows: readonly Partial<IndexPageRow>[], opts: { capped?: ReadonlySet<string>; read?: readonly IndexSiteFixCause[] } = {}): IndexingCauseReading[] {
  const by = new Map<IndexSiteFixCause, { open: IndexPage[]; pending: IndexPage[] }>();
  const ownTitle = new Set<string>();
  for (const c of opts.read ?? []) if (isSiteFixCause(c)) by.set(c, { open: [], pending: [] });
  // only an explicit `false` is "not in the sitemap" (an empty value says nothing); or the engine's own-title note
  for (const r of rows)
    if (r.url && (r.in_sitemap === false || (r.in_sitemap as unknown) === 'false' || (r.in_sitemap as unknown) === 0 || s(r.note).trim().startsWith(INDEX_OWN_TITLE_NOTE))) ownTitle.add(s(r.url));
  for (const p of rows.map(indexPageOf)) {
    if (!isSiteFixCause(p.cause) || !p.url) continue;
    const isPending = !!p.fixSeenAt && p.action === 'wait';
    if (p.action !== 'site_fix' && !isPending) continue;
    const g = by.get(p.cause) ?? { open: [], pending: [] };
    (isPending ? g.pending : g.open).push(p);
    by.set(p.cause, g);
  }
  return [...by.entries()].map(([cause, g]) => {
    const failed = g.open.filter((p) => p.fixFailedAt);
    const sorted = [...g.open].sort((a, b) => b.impressions28d - a.impressions28d || b.clicks28d - a.clicks28d || a.url.localeCompare(b.url));
    const own = cause === 'canonical_elsewhere' ? sorted.slice(0, INDEXING_READING_URLS).map((p) => p.url).filter((u) => ownTitle.has(u)) : [];
    return {
      cause,
      total: g.open.length,
      urls: sorted.slice(0, INDEXING_READING_URLS).map((p) => p.url),
      readAt: g.open.map((p) => p.inspectedAt || p.fetchedAt).filter(Boolean).sort().pop() ?? '',
      pending: g.pending.length,
      pendingAt: g.pending.map((p) => p.fixSeenAt).sort().pop() ?? '',
      complete: !opts.capped?.has(cause),
      ...(failed.length ? { googleStillSees: failed.length, googleStillSeesAt: failed.map((p) => p.fixFailedAt).sort().pop() ?? '' } : {}),
      ...(own.length ? { ownTitle: own } : {}),
    };
  });
}

/** One page that needs a link from another page of the website (the engine's `links` rows), with the pages it suggests. */
export interface IndexingLinksTarget {
  url: string;
  title: string;
  /** suggested pages to add the link on (indexed, on topic, never a utility page), best first; empty: none we could suggest */
  sources: string[];
}
/** The engine's `links` pages of one website, as the `indexing:links` step needs them (DESIGN_WAVE2 §3.2). */
export interface IndexingLinksReading {
  /** the run the reading comes from */
  runAt: string;
  /** false: the read hit its cap, so "no page needs a link any more" is never concluded from it */
  complete: boolean;
  /** most important first */
  targets: IndexingLinksTarget[];
}
/** The pages that need a link, from the engine's rows (rows of other actions, utility pages and pages already linked are left out). */
export function indexingLinksReading(rows: readonly Partial<IndexPageRow>[], opts: { runAt: string; capped?: boolean }): IndexingLinksReading {
  const targets = rows
    .map(indexPageOf)
    .filter((p) => p.url && p.action === 'links' && !p.utility && p.state !== 'indexed' && !p.linkedBy.length)
    .sort(byImportance)
    .map((p) => ({ url: p.url, title: p.title, sources: p.linkFrom.map((l) => l.url).filter((u) => !samePageUrl(u, p.url)).slice(0, 3) }));
  return { runAt: opts.runAt, complete: !opts.capped, targets };
}

/**
 * Whether a page's HTML holds an `<a href>` to the target page (DESIGN_WAVE2 §3.2): resolved against the page's address (or its `<base href>`,
 * wave 2 review W14), compared without the host's www., the scheme, a fragment or a trailing slash; a query counts only when the target has
 * one. Comments and the insides of `<script>` / `<style>` are skipped (an `<a href>` in a script string is not a link), and so is a link
 * marked `rel="nofollow"` (W14: Google is told not to follow it, so it does not help Google find the page).
 */
export function pageLinksTo(html: string, pageUrl: string, targetUrl: string): boolean {
  const wantQuery = s(targetUrl).includes('?');
  const body = s(html)
    .slice(0, 1_000_000)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*$/i, ' ');
  // W14: the first <base href> sets the address relative links resolve against (itself resolved against the page's address)
  let base = s(pageUrl);
  const baseHref = body.match(/<base\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i);
  if (baseHref) {
    try {
      const b = new URL((baseHref[1] ?? baseHref[2] ?? baseHref[3] ?? '').trim().replace(/&amp;/g, '&'), base);
      if (b.protocol === 'https:' || b.protocol === 'http:') base = b.href;
    } catch {
      // an unreadable <base href> is ignored, as browsers do
    }
  }
  for (const m of body.matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))[^>]*>/gi)) {
    const rel = m[0].match(/\srel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i);
    if (rel && /(^|\s)nofollow(\s|$)/i.test((rel[1] ?? rel[2] ?? rel[3] ?? '').trim())) continue;
    const href = (m[1] ?? m[2] ?? m[3] ?? '').trim().replace(/&amp;/g, '&');
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    if (abs.protocol !== 'https:' && abs.protocol !== 'http:') continue;
    abs.hash = '';
    if (!wantQuery) abs.search = '';
    if (samePageUrl(abs.href, targetUrl)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- the app's own check of a step (pure parts)

/** `<meta name="robots|googlebot" content="…noindex…">` in a page's HTML. */
export function metaNoindex(html: string): boolean {
  const head = s(html).slice(0, 200_000);
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const name = tag.match(/\bname\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
    if (name !== 'robots' && name !== 'googlebot') continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? tag.match(/\bcontent\s*=\s*([^\s>]+)/i)?.[1] ?? '';
    if (/\b(noindex|none)\b/i.test(content)) return true;
  }
  return false;
}

/** Robots directives that take a value after a colon (`max-snippet: -1`), so their name is never read as a crawler's name (N-app-8). */
const ROBOTS_VALUE_DIRECTIVES: ReadonlySet<string> = new Set(['max-snippet', 'max-image-preview', 'max-video-preview', 'unavailable_after']);

/**
 * An `X-Robots-Tag` header value that keeps Google out: `noindex` or `none` for every crawler, or for googlebot (N-app-8). A comma list is
 * read left to right: `name: rule` starts a crawler's rules when `name` is not a directive (`max-snippet: -1, noindex` is two directives
 * for every crawler; `otherbot: noindex` applies to otherbot only, and a header for another crawler alone is not a noindex). Each header
 * line is read on its own.
 */
export function headerNoindex(value: string | string[] | undefined): boolean {
  const vals = Array.isArray(value) ? value : value ? [value] : [];
  return vals.some((v) => {
    let agent: string | null = null;
    for (const raw of s(v).split(',')) {
      let part = raw.trim();
      const m = part.match(/^([a-z0-9_.-]+)\s*:\s*(.*)$/i);
      if (m && !ROBOTS_VALUE_DIRECTIVES.has(m[1].toLowerCase())) {
        agent = m[1].toLowerCase();
        part = m[2].trim();
      }
      if (/^(noindex|none)$/i.test(part) && (agent === null || agent === 'googlebot')) return true;
    }
    return false;
  });
}

/** The page's `<link rel="canonical" href="…">`, resolved against the page address ('' when none). */
export function pageCanonicalOf(html: string, pageUrl: string): string {
  for (const m of s(html).slice(0, 200_000).matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?canonical["'\s>]/i.test(tag)) continue;
    // R9: `href=""` (or `href=''`) is no canonical at all, never the page's own address or a path made of the quotes
    const href = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1] ?? tag.match(/\bhref\s*=\s*([^\s>"']+)/i)?.[1] ?? '';
    if (!href.trim()) return '';
    // N-app-12: a relative (`a`, `../a`, `?q`) or protocol-relative (`//host/a`) canonical is resolved against the page's address
    try {
      return new URL(href.trim().replace(/&amp;/g, '&'), s(pageUrl)).href;
    } catch {
      return /^https?:\/\//i.test(href) ? href.trim() : '';
    }
  }
  return '';
}

/** Two addresses of the same page: host without www., no trailing slash, no fragment, scheme ignored. */
export function samePageUrl(a: string, b: string): boolean {
  const norm = (u: string) => {
    const x = s(u).trim().replace(/#.*$/, '');
    const m = x.match(/^https?:\/\/(?:www\.)?([^/?#]+)(\/[^?#]*)?(\?[^#]*)?$/i);
    if (!m) return x.toLowerCase();
    let path = m[2] ?? '/';
    while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return `${m[1].toLowerCase()}${path}${m[3] ?? ''}`;
  };
  return !!a && !!b && norm(a) === norm(b);
}

/** Words of a page's visible text (scripts, styles, navigation and markup removed): a rough measure for "empty page". */
export function visibleWords(html: string): number {
  const text = s(html)
    .slice(0, 500_000)
    .replace(/<(script|style|noscript|nav|header|footer|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** `<loc>` addresses in a sitemap (or a sitemap index). */
export function sitemapLocs(xml: string): string[] {
  return [...s(xml).matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
}
export const isSitemapIndex = (xml: string): boolean => /<sitemapindex\b/i.test(s(xml).slice(0, 2000));

/** What one fetched page says about one cause: fixed or not, in a sentence. Pure; the server feeds it what it fetched. */
export interface IndexingFetch {
  url: string;
  /** null: no answer */
  status: number | null;
  /** where redirects ended */
  finalUrl: string;
  /** the first hop's status when it was a redirect (301 / 302 ...), 0 when the page answered directly */
  redirectStatus: number;
  text: string;
  xRobotsTag?: string | string[];
  /** the final answer's Content-Type ('' / absent: not known) */
  contentType?: string;
}

/** One page's verdict for one step: fixed, not fixed, or `unknown` (we could not tell: a firewall answered us, the page went to another
 *  website, the sitemap could not be read in full). An unknown is never a fix and never a miss (FIX_CONTRACT decision 3). */
export interface IndexingPageVerdict {
  fixed: boolean;
  unknown?: boolean;
  why: string;
}

const hostOfUrl = (u: string) => (s(u).match(/^https?:\/\/(?:www\.)?([^/?#:]+)/i)?.[1] ?? '').toLowerCase();

/** A firewall's or bot check's page rather than the website's own (Cloudflare, Incapsula, PerimeterX and the like). */
export function challengePage(f: Pick<IndexingFetch, 'status' | 'text'>): boolean {
  const head = s(f.text).slice(0, 20_000);
  if (/cf-chl-|challenge-platform|_Incapsula_Resource|px-captcha|cf_chl_opt|ddos-guard/i.test(head)) return true;
  return /<title[^>]*>[^<]*(just a moment|attention required|access denied|are you a robot|security check|checking your browser|verify you are human)[^<]*<\/title>/i.test(head);
}

/** The website's real page: a 200 HTML answer with a document head or body, not a challenge page. */
export function realPage(f: IndexingFetch): boolean {
  if (f.status !== 200) return false;
  if (f.contentType && !/html/i.test(f.contentType)) return false;
  return /<(head|title|body)\b/i.test(s(f.text).slice(0, 200_000)) && !challengePage(f);
}

/** The answers that tell us about our own access, not about the page (FIX_CONTRACT decision 3): a login or firewall wall, a rate limit,
 *  a 503 or a challenge page. `own403`: for a step about a refused page a 401 / 403 is the problem itself, not a wall. */
const wall = (f: IndexingFetch, own403 = false): boolean =>
  (!own403 && (f.status === 401 || f.status === 403)) || f.status === 429 || (f.status === 503 && (!f.text || challengePage(f))) || challengePage(f);

/**
 * prod 2026-11-10: `canonical_elsewhere` fixed by merging. The page's own first answer is a permanent redirect (301 / 308) to ANOTHER page of
 * the same website (host compared without www.), that page opens (200, a readable page) and its canonical names itself or nothing. Then the
 * address it named as the main version is where it now sends everyone and Google: fixed. Anything else is left to the cause's own rule.
 */
export function canonicalMergedByRedirect(f: IndexingFetch): IndexingPageVerdict | null {
  if (f.redirectStatus !== 301 && f.redirectStatus !== 308) return null;
  if (!f.finalUrl || hostOfUrl(f.finalUrl) !== hostOfUrl(f.url) || samePageUrl(f.finalUrl, f.url)) return null;
  if ((f.status ?? 0) !== 200 || wall(f) || !realPage(f)) return null;
  const canon = pageCanonicalOf(f.text, f.finalUrl);
  if (canon && !samePageUrl(canon, f.finalUrl)) return null;
  return { fixed: true, why: `${indexPath(f.url)} now redirects permanently to ${indexPath(f.finalUrl)}, the main version, so the two are one page.` };
}

export function indexingPageFixed(cause: IndexSiteFixCause, f: IndexingFetch, inSitemap: boolean | null, opts: { ownTitle?: boolean } = {}): IndexingPageVerdict {
  const p = indexPath(f.url);
  const status = f.status ?? 0;
  const unknown = (why: string): IndexingPageVerdict => ({ fixed: false, unknown: true, why });
  const walled = () => unknown(`${p} answered ${status || 'nothing'} to us (often a firewall that lets Google in but not other visitors), so we could not tell.`);
  const offSite = !!f.finalUrl && hostOfUrl(f.finalUrl) !== hostOfUrl(f.url);
  const notListed = 'we could not read your whole sitemap, so we could not tell whether it is still listed';
  switch (cause) {
    case 'noindex': {
      if (wall(f)) return walled();
      if (offSite) return unknown(`${p} sent us on to another website, so we could not read the page.`);
      if (f.redirectStatus) return { fixed: false, why: `${p} now redirects to ${indexPath(f.finalUrl)} instead of opening.` };
      if (status !== 200) return { fixed: false, why: `${p} answers ${status}.` };
      if (!realPage(f)) return unknown(`${p} did not send us a readable page, so we could not tell.`);
      const where = headerNoindex(f.xRobotsTag) ? 'in the server\'s X-Robots-Tag header' : metaNoindex(f.text) ? 'in a robots meta tag' : '';
      return where ? { fixed: false, why: `${p} still carries noindex ${where}.` } : { fixed: true, why: `${p} opens without a noindex instruction in the page or in the server's answer.` };
    }
    case 'server_error':
      if (wall(f)) return walled();
      if (status >= 500) return { fixed: false, why: `${p} still answers ${status}.` };
      if (status === 200 && !f.redirectStatus) return { fixed: true, why: `${p} answers normally (200).` };
      return { fixed: false, why: `${p} answers ${f.redirectStatus ? `${f.redirectStatus}, then ${status}` : status}.` };
    case 'access_denied':
      if (status === 401 || status === 403) return challengePage(f) ? walled() : { fixed: false, why: `${p} still answers ${status}.` };
      if (wall(f, true)) return walled();
      if (offSite) return unknown(`${p} sent us on to another website, so we could not tell.`);
      if (status === 200 && !f.redirectStatus) return { fixed: true, why: `${p} opens for everyone (200).` };
      return { fixed: false, why: `${p} answers ${f.redirectStatus ? `${f.redirectStatus}, then ${status}` : status}.` };
    case 'not_found':
      if (wall(f)) return walled();
      if (status === 200 && !f.redirectStatus) return realPage(f) ? { fixed: true, why: `${p} opens again.` } : unknown(`${p} did not send us a readable page, so we could not tell.`);
      if (status === 200 && offSite) return { fixed: false, why: `${p} redirects to another website (${hostOfUrl(f.finalUrl)}). Point it at a page of your own website.` };
      if (status === 200 && (f.redirectStatus === 301 || f.redirectStatus === 308)) return { fixed: true, why: `${p} redirects permanently to ${indexPath(f.finalUrl)}, which opens.` };
      if (status === 200) return { fixed: false, why: `${p} redirects with a temporary ${f.redirectStatus}. Make it a permanent 301.` };
      return { fixed: false, why: `${p} still answers ${status}.` };
    case 'soft_404':
      if (status === 404 || status === 410) return { fixed: true, why: `${p} now answers ${status}, as a page that is gone should.` };
      if (wall(f)) return walled();
      if (realPage(f) && visibleWords(f.text) >= 150) return { fixed: true, why: `${p} has real content now.` };
      return { fixed: false, why: status === 200 ? `${p} still has almost no content.` : `${p} answers ${status}.` };
    case 'redirect':
      if (inSitemap === false) return { fixed: true, why: `${p} is no longer in your sitemap.` };
      if (wall(f)) return walled();
      if (!f.redirectStatus && realPage(f)) return { fixed: true, why: `${p} opens directly and no longer redirects.` };
      if (inSitemap === null) return unknown(`${p} still redirects, and ${notListed}.`);
      return { fixed: false, why: `${p} is still in your sitemap and redirects to ${indexPath(f.finalUrl)}.` };
    case 'canonical_elsewhere': {
      // prod 2026-11-10 (devaicon.com /industries/bfsi): the address now answers a PERMANENT redirect (301 / 308, its own first answer) to a
      // page of the same website that opens and names itself (or nothing else) as the main version: the two are one page, which is the fix
      const merged = canonicalMergedByRedirect(f);
      if (merged) return merged;
      // wave 2: a page with a title of its own that names another page as its main version: its absence from the sitemap is never the fix
      // (it may never have been there); only a canonical tag that names the page itself is
      if (opts.ownTitle) {
        if (wall(f)) return walled();
        if (offSite) return unknown(`${p} sent us on to another website, so we could not read the page.`);
        if (!realPage(f)) return status === 200 ? unknown(`${p} did not send us a readable page, so we could not tell.`) : { fixed: false, why: `${p} answers ${status}.` };
        const own = pageCanonicalOf(f.text, f.finalUrl || f.url);
        if (own && samePageUrl(own, f.url)) return { fixed: true, why: `${p} names itself as the main version.` };
        return { fixed: false, why: own ? `${p} still names ${indexPath(own)} as the main version.` : `${p} names no main version yet. Set its canonical tag to its own address.` };
      }
      if (inSitemap === false) return { fixed: true, why: `${p} is no longer in your sitemap.` };
      if (wall(f)) return walled();
      if (offSite) return unknown(`${p} sent us on to another website, so we could not read the page.`);
      if (!realPage(f)) return status === 200 ? unknown(`${p} did not send us a readable page, so we could not tell.`) : { fixed: false, why: `${p} answers ${status}.` };
      const canon = pageCanonicalOf(f.text, f.finalUrl || f.url);
      if (canon && samePageUrl(canon, f.url)) return { fixed: true, why: `${p} names itself as the main version.` };
      if (inSitemap === null) return unknown(`${p} ${canon ? `names ${indexPath(canon)} as the main version` : 'names no main version'}, and ${notListed}.`);
      return { fixed: false, why: canon ? `${p} is in your sitemap but names ${indexPath(canon)} as the main version.` : `${p} is in your sitemap but names no main version. Set its canonical tag to its own address.` };
    }
    case 'not_in_sitemap':
    case 'indexed_not_in_sitemap':
      if (inSitemap === true) return { fixed: true, why: `${p} is in your sitemap.` };
      if (inSitemap === null) return unknown(`${p} was not in the part of your sitemap we could read; ${notListed}.`);
      return { fixed: false, why: `${p} is not in your sitemap yet.` };
    case 'redirect_error':
      // the engine's rule (`_index_kit.js`): the address ends on a page that opens; our fetcher follows at most 4 redirects, so a loop or a
      // long chain reaches the server as "no answer" (could not tell, never a fix)
      if (wall(f)) return walled();
      if (offSite) return { fixed: false, why: `${p} redirects to another website (${hostOfUrl(f.finalUrl)}). Point it at a page of your own website.` };
      if (realPage(f)) return { fixed: true, why: f.redirectStatus ? `${p} now redirects to ${indexPath(f.finalUrl)}, which opens.` : `${p} opens directly.` };
      return { fixed: false, why: `${p} ends on an answer ${status}.` };
    case 'robots_blocked':
      // robots.txt is read once for every page by the server (it is not a property of one page's answer)
      return { fixed: true, why: `${p} opens.` };
    default: {
      const never: never = cause;
      return { fixed: false, why: `Unknown step ${String(never)}.` };
    }
  }
}

/** What a robots.txt answer is, for the app's check of a robots.txt step (FIX_CONTRACT decision 3: only a real file, or a 404, counts). */
export function robotsFileState(status: number, text: string, contentType = ''): 'rules' | 'none' | 'server_error' | 'unreadable' {
  if (status === 404 || status === 410) return 'none';
  if (status === 200) return /html/i.test(contentType) || /<(html|head|body)\b/i.test(s(text).slice(0, 2000)) ? 'unreadable' : 'rules';
  if (status === 500 || status === 502 || status === 504) return 'server_error';
  return 'unreadable';
}

/** Whether a cause's check needs the website's sitemap (read once per check). */
export const INDEXING_NEEDS_SITEMAP: ReadonlySet<IndexSiteFixCause> = new Set(['not_in_sitemap', 'indexed_not_in_sitemap', 'canonical_elsewhere', 'redirect']);
/** Whether a cause's check opens the pages themselves (the sitemap causes only read the sitemap). */
export const INDEXING_FETCHES_PAGES: ReadonlySet<IndexSiteFixCause> = new Set(['noindex', 'server_error', 'access_denied', 'not_found', 'soft_404', 'redirect', 'redirect_error', 'canonical_elsewhere']);

// ---------------------------------------------------------------- recommendations

/** The keyword the "Improve this page" form starts from: the page's own title without the site name after a separator, else its slug.
 *  The form opens with it filled in and the person can change it before starting (the click on Start is the approval). */
export function improveKeywordOf(title: string, url: string): string {
  const t = s(title).split(/\s[|\-:\u2013\u2014]\s/)[0].trim();
  if (t.length >= 3) return t.slice(0, 120);
  const slug = indexPath(url).split('/').filter(Boolean).pop() ?? '';
  return slug.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 120);
}

/** What the recommendations need from the index check: the newest run's counts, the open steps, and the pages to improve. */
export interface IndexingForRecs {
  on: boolean;
  runAt: string | null;
  freeze: { on: boolean; reason: string };
  /** site-fix causes with their page count (from the engine's rows) */
  siteFix: { cause: IndexSiteFixCause; total: number }[];
  /** counts per `<action>:<cause>` of the other actions (links, duplicate, quality) */
  other: { action: 'links' | 'duplicate' | 'quality'; cause: IndexCause; total: number }[];
  /** quality pages to improve, most important first (one recommendation each, at most 3) */
  quality: { url: string; title: string; impressions28d: number }[];
  /** FIX_CONTRACT `ask_google`: pages where a manual "Request indexing" in Search Console is the right next step (at most 5) */
  askGoogle: { url: string; title: string }[];
}

// ---------------------------------------------------------------- the sitemap step (X5, A14)

/** The step for a sitemap Search Console does not have, or reports errors in (`seo_index_runs.sitemaps_json`, contract change 2). Read
 *  by the daily index check only: Search Console's list of sitemaps is Google's, so the app's own check cannot tick it off. */
export const INDEXING_SITEMAP_KEY = 'indexing:sitemap';
/** wave 3 (DESIGN_WAVE3 §3.3): the step for a sitemap without usable dates (a site-level step like `indexing:sitemap`, kind `indexing`). */
export const INDEXING_SITEMAP_DATES_KEY = 'indexing:sitemap_dates';
export interface IndexingSitemapDatesReading extends IndexSitemapDates {
  at: string;
  /** the engine's rule: no usable dates */
  missing: boolean;
}
/** The newest run's sitemap date reading (null: no run that read the website sent one). */
export function indexingSitemapDatesReading(runs: readonly Partial<IndexRunRow>[]): IndexingSitemapDatesReading | null {
  const r = [...runs].map(indexRunOf).filter((x) => x.runAt && !x.failed && !x.reservation && x.sitemaps?.dates).sort((a, b) => (b.runAt > a.runAt ? 1 : -1))[0];
  const d = r?.sitemaps?.dates;
  return r && d ? { ...d, at: r.runAt, missing: sitemapDatesMissing(d) } : null;
}
export interface IndexingSitemapReading {
  /** the run that read Search Console's sitemap list */
  at: string;
  submitted: number;
  errors: number;
}
/** The sitemap reading of the newest run that read Search Console's list (null: no such run, or the list could not be read). */
export function indexingSitemapReading(runs: readonly Partial<IndexRunRow>[]): IndexingSitemapReading | null {
  const r = [...runs].map(indexRunOf).filter((x) => x.runAt && !x.failed && !x.reservation && x.sitemaps && x.sitemaps.submitted != null).sort((a, b) => (b.runAt > a.runAt ? 1 : -1))[0];
  return r && r.sitemaps && !r.reservation ? { at: r.runAt, submitted: r.sitemaps.submitted ?? 0, errors: r.sitemaps.submittedErrors ?? 0 } : null;
}

/**
 * A24: an audit finding that already asks for the SAME fix (so the client is not asked twice). Matched on the finding's key (category and
 * title, as the engine stores it: `Finding_Rows.js` keyOf), and every pattern of the cause must match: "Fix redirect chains" is not
 * "replace redirecting addresses in your sitemap", and a finding that merely mentions a sitemap does not stand in for a noindex step.
 */
export const INDEX_CAUSE_FINDING_RULES: Record<IndexSiteFixCause, readonly RegExp[]> = {
  noindex: [/noindex/i],
  robots_blocked: [/robots\.?txt|blocked by robots/i, /block|disallow/i],
  server_error: [/\b5\d\d\b|5xx|server error/i],
  access_denied: [/\b40[13]\b|access denied|forbidden/i],
  not_found: [/\b404\b|not found|broken page/i, /^(?!.*broken link)/i],
  soft_404: [/soft[ -]?404/i],
  canonical_elsewhere: [/canonical/i, /sitemap/i],
  redirect: [/redirect/i, /sitemap/i],
  redirect_error: [/redirect (loop|chain)|too many redirects/i],
  not_in_sitemap: [/(not|missing) (in|from) (the |your )?(xml )?sitemap|absent from (the |your )?sitemap/i],
  indexed_not_in_sitemap: [/(not|missing) (in|from) (the |your )?(xml )?sitemap|absent from (the |your )?sitemap/i],
};
export const findingAsksSameFix = (cause: IndexSiteFixCause, findingKey: string): boolean => INDEX_CAUSE_FINDING_RULES[cause].every((r) => r.test(findingKey));
