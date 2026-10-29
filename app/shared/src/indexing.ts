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
  'not_in_sitemap',
  'indexed_not_in_sitemap',
] as const satisfies readonly IndexCause[];
export type IndexSiteFixCause = (typeof INDEX_SITE_FIX_CAUSES)[number];
export const isSiteFixCause = (c: string): c is IndexSiteFixCause => (INDEX_SITE_FIX_CAUSES as readonly string[]).includes(c);

/** Causes that stop Google reading pages at all: their step is shown as important. */
export const INDEX_BLOCKING_CAUSES: ReadonlySet<IndexCause> = new Set(['noindex', 'robots_blocked', 'server_error', 'access_denied']);

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
  weDo: 'We ask Google about these pages again within a day or two, so the reason updates in days, not weeks.',
  youDo: 'Nothing. For an important page you can also ask Google to read it again in Search Console.',
} as const;

export const INDEX_ACTION_INFO: Record<IndexAction, { label: string; summary: string }> = {
  site_fix: { label: 'Fix on your website', summary: 'Changes only you can make. Each one is a step on your Pipeline that we check every day.' },
  quality: { label: 'Improve the page', summary: 'Google read these pages and left them out. Improve them one at a time, when you choose.' },
  duplicate: { label: 'Choose the main version', summary: 'Google sees these pages as copies of others.' },
  links: { label: 'Help Google find it', summary: 'Links from your pages that are already in search help Google find and choose these pages.' },
  wait: { label: 'Give it time', summary: 'New pages Google has not got to yet. This is normal for the first weeks.' },
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
  /** FIX_CONTRACT `fix_seen_at`: our fetch saw the site-fix cause gone after Google's last inspection ('' = not fixed / not newer) */
  fixSeenAt: string;
  /** FIX_CONTRACT `ask_google`: a manual "Request indexing" in Search Console is the right next step (at most 5 a site a week) */
  askGoogle: boolean;
}

/** What a group is about: a cause, a code the app does not know, or pages fixed on the site that Google has not read again yet. */
export type IndexGroupCause = IndexCause | 'other' | 'fixed_on_site';

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

/** Our fetch saw the fix after Google's last reading (the engine clears `fix_seen_at` when the problem is seen again). */
const fixSeen = (fix: string, inspected: string): string => (fix && (!inspected || fix > inspected) ? fix : '');

export function indexPageOf(r: Partial<IndexPageRow>): IndexPage {
  const cause = s(r.cause);
  const state = s(r.state);
  const st: IndexState = isState(state) ? state : 'unknown';
  const c: IndexCause | 'other' = isCause(cause) ? cause : cause ? 'other' : state === 'indexed' ? 'indexed' : 'other';
  const linkFrom = json<P[]>(r.link_from, []);
  const fixSeenAt = st === 'indexed' ? '' : fixSeen(s(r.fix_seen_at), s(r.inspect_at));
  const action = displayAction(s(r.action), c, st);
  return {
    url: s(r.url),
    path: indexPath(s(r.url)),
    title: s(r.title).slice(0, 200),
    lane: s(r.lane) === 'new' ? 'new' : 'existing',
    state: st,
    cause: c,
    // the engine sets `wait` with `fix_seen_at`; an older engine row is read the same way
    action: fixSeenAt && action === 'site_fix' ? 'wait' : action,
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
      .slice(0, 5),
    mergeInto: s(r.merge_into),
    note: s(r.note).slice(0, 500),
    publishedAt: s(r.published_at),
    inspectedAt: s(r.inspect_at),
    fetchedAt: s(r.fetch_at),
    fixSeenAt,
    askGoogle: b(r.ask_google) && st !== 'indexed',
  };
}

export function indexRunOf(r: Partial<IndexRunRow>): IndexRun {
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
    // the engine writes a run row for a website it could not check at all: no page, no inspection, and a note that says why
    failed: n(r.known) === 0 && n(r.inspected) === 0 && n(r.reused) === 0 && !!s(r.note).trim(),
    accessLost: /refused access|no access|not part of this property|permission/i.test(s(r.note)),
    sitemaps: runSitemapsOf(r.sitemaps_json),
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
  return { submitted: num('submitted'), submittedErrors: num('submitted_errors'), read: n(x.read), partial };
}

/** The engine's sentence about a run that failed, in words a client can act on (an internal error message is never shown). */
function runNoticeText(r: IndexRun): string {
  const t = r.note.replace(/\b(inventory|diagnosis|sitemap reading) failed:[^.]*\.?/gi, 'Something went wrong on our side while reading this website; we try again on the next daily check.').trim();
  return t || 'This website could not be checked today.';
}

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

const groupLabel = (c: IndexGroupCause): Pick<IndexCauseInfo, 'label' | 'meaning' | 'weDo' | 'youDo'> =>
  c === 'fixed_on_site'
    ? INDEX_FIXED_ON_SITE
    : c === 'other'
      ? { label: 'Other', meaning: 'A reading we do not have words for yet.', weDo: 'We keep checking.', youDo: 'Open the address in Search Console (URL Inspection) to read Google\'s own words.' }
      : INDEX_CAUSE_INFO[c];

/** How many pages a group carries in the summary; the rest page in. */
export const INDEX_GROUP_PREVIEW = 25;

/** The group a page is shown in (pages fixed on the site have their own), and whether it is in one at all. One rule for the summary and
 *  the paged lists (A19): pages in search with nothing to do, and pages not checked yet that the engine did not file, are in none. */
export const indexGroupCauseOf = (p: IndexPage): IndexGroupCause => (p.fixSeenAt ? 'fixed_on_site' : p.cause);
export const inIndexGroup = (p: IndexPage): boolean => p.action !== 'none' && !(p.state === 'unknown' && p.cause === 'other');
const byImportance = (a: IndexPage, b: IndexPage) => b.impressions28d - a.impressions28d || b.clicks28d - a.clicks28d || a.path.localeCompare(b.path);

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
}): IndexingData {
  const pages = input.rows.map(indexPageOf).filter((p) => p.url);
  const runs = [...input.runs].map(indexRunOf).filter((r) => r.runAt).sort((a, b) => (b.runAt > a.runAt ? 1 : -1)).slice(0, 12);
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
      needYou: xs.filter((p) => INDEX_ACTIONS_NEED_YOU.has(p.action)).length,
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
    const taskKey = action === 'site_fix' && isSiteFixCause(cause) ? indexingTaskKey(cause) : null;
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
      guide: cause === 'fixed_on_site' ? 'index-request-indexing' : cause !== 'other' ? (INDEX_CAUSE_INFO[cause].guide ?? null) : 'index-request-indexing',
      taskKey: taskKey && (!input.taskKeys || input.taskKeys.has(taskKey)) ? taskKey : null,
      pages: [...xs].sort(byImportance).slice(0, INDEX_GROUP_PREVIEW),
    };
  });
  groups.sort((a, b) => INDEX_ACTION_ORDER.indexOf(a.action) - INDEX_ACTION_ORDER.indexOf(b.action) || b.count - a.count || a.id.localeCompare(b.id));

  const dropped = pages
    .filter((p) => p.droppedAt && p.state !== 'indexed')
    .sort((a, b) => (b.droppedAt > a.droppedAt ? 1 : -1))
    .slice(0, 50);
  // FIX_CONTRACT (X8): never a page left out on purpose, never a rewrite while an update rolls out
  const askGoogle = pages.filter((p) => p.askGoogle && p.action !== 'leave_out' && !(freeze.on && p.action === 'quality')).sort(byImportance).slice(0, 5);
  const checkedAt = good?.runAt || pages.map((p) => p.checkedAt).filter(Boolean).sort().pop() || null;
  const notice: IndexingData['notice'] = latest?.failed
    ? {
        tone: 'warning',
        title: latest.accessLost ? 'Our last check could not read Search Console' : 'Our last check could not read this website',
        text: `${runNoticeText(latest)}${good ? ` The figures below are from the check of ${good.runAt.slice(0, 10)}.` : ''}`,
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
    .sort(byImportance);
  return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
}

export function indexHistoryLabel(state: string, cause: string): string {
  if (isCause(cause)) return INDEX_CAUSE_INFO[cause].label;
  if (state === 'indexed') return INDEX_CAUSE_INFO.indexed.label;
  if (state === 'unknown') return 'Not checked yet';
  return state ? state.replace(/_/g, ' ') : 'Unknown';
}

// ---------------------------------------------------------------- steps on the client's website

export const INDEXING_TASK_PREFIX = 'indexing:';
export const indexingTaskKey = (cause: IndexSiteFixCause): string => `${INDEXING_TASK_PREFIX}${cause}`;
export function indexingCauseOfKey(key: string): IndexSiteFixCause | null {
  if (!key.startsWith(INDEXING_TASK_PREFIX)) return null;
  const c = key.slice(INDEXING_TASK_PREFIX.length);
  return isSiteFixCause(c) ? c : null;
}
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
}

/** The engine's rows of the site-fix causes grouped by cause (the input of the indexing steps). Rows of other actions are ignored. */
export function indexingCauseReadings(rows: readonly Partial<IndexPageRow>[], opts: { capped?: ReadonlySet<string> } = {}): IndexingCauseReading[] {
  const by = new Map<IndexSiteFixCause, { open: IndexPage[]; pending: IndexPage[] }>();
  for (const p of rows.map(indexPageOf)) {
    if (!isSiteFixCause(p.cause) || !p.url) continue;
    const isPending = !!p.fixSeenAt && p.action === 'wait';
    if (p.action !== 'site_fix' && !isPending) continue;
    const g = by.get(p.cause) ?? { open: [], pending: [] };
    (isPending ? g.pending : g.open).push(p);
    by.set(p.cause, g);
  }
  return [...by.entries()].map(([cause, g]) => {
    const sorted = [...g.open].sort((a, b) => b.impressions28d - a.impressions28d || b.clicks28d - a.clicks28d || a.url.localeCompare(b.url));
    return {
      cause,
      total: g.open.length,
      urls: sorted.slice(0, INDEXING_READING_URLS).map((p) => p.url),
      readAt: g.open.map((p) => p.inspectedAt || p.fetchedAt).filter(Boolean).sort().pop() ?? '',
      pending: g.pending.length,
      pendingAt: g.pending.map((p) => p.fixSeenAt).sort().pop() ?? '',
      complete: !opts.capped?.has(cause),
    };
  });
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

/** An `X-Robots-Tag` header value that keeps Google out (all agents, or googlebot). */
export function headerNoindex(value: string | string[] | undefined): boolean {
  const vals = Array.isArray(value) ? value : value ? [value] : [];
  return vals.some((v) =>
    s(v)
      .split(',')
      .map((x) => x.trim())
      .some((part, i, all) => {
        if (!/\b(noindex|none)\b/i.test(part)) return false;
        // "otherbot: noindex" applies to another crawler only
        const agent = part.match(/^([a-z0-9_-]+)\s*:/i)?.[1]?.toLowerCase() ?? (i > 0 ? all.slice(0, i).reverse().map((x) => x.match(/^([a-z0-9_-]+)\s*:/i)?.[1]?.toLowerCase()).find(Boolean) : undefined);
        return !agent || agent === 'googlebot' || agent === 'noindex' || agent === 'none';
      }),
  );
}

/** The page's `<link rel="canonical" href="…">`, resolved against the page address ('' when none). */
export function pageCanonicalOf(html: string, pageUrl: string): string {
  for (const m of s(html).slice(0, 200_000).matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?canonical["'\s>]/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? tag.match(/\bhref\s*=\s*([^\s>]+)/i)?.[1] ?? '';
    if (!href) return '';
    if (/^https?:\/\//i.test(href)) return href.trim();
    const origin = s(pageUrl).match(/^https?:\/\/[^/]+/i)?.[0] ?? '';
    return href.startsWith('/') ? origin + href.trim() : href.trim();
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

export function indexingPageFixed(cause: IndexSiteFixCause, f: IndexingFetch, inSitemap: boolean | null): IndexingPageVerdict {
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
export const INDEXING_FETCHES_PAGES: ReadonlySet<IndexSiteFixCause> = new Set(['noindex', 'server_error', 'access_denied', 'not_found', 'soft_404', 'redirect', 'canonical_elsewhere']);

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
export interface IndexingSitemapReading {
  /** the run that read Search Console's sitemap list */
  at: string;
  submitted: number;
  errors: number;
}
/** The sitemap reading of the newest run that read Search Console's list (null: no such run, or the list could not be read). */
export function indexingSitemapReading(runs: readonly Partial<IndexRunRow>[]): IndexingSitemapReading | null {
  const r = [...runs].map(indexRunOf).filter((x) => x.runAt && !x.failed && x.sitemaps && x.sitemaps.submitted != null).sort((a, b) => (b.runAt > a.runAt ? 1 : -1))[0];
  return r && r.sitemaps ? { at: r.runAt, submitted: r.sitemaps.submitted ?? 0, errors: r.sitemaps.submittedErrors ?? 0 } : null;
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
  not_in_sitemap: [/(not|missing) (in|from) (the |your )?(xml )?sitemap|absent from (the |your )?sitemap/i],
  indexed_not_in_sitemap: [/(not|missing) (in|from) (the |your )?(xml )?sitemap|absent from (the |your )?sitemap/i],
};
export const findingAsksSameFix = (cause: IndexSiteFixCause, findingKey: string): boolean => INDEX_CAUSE_FINDING_RULES[cause].every((r) => r.test(findingKey));
