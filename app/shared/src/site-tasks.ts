// Steps on your website (app/docs/SITE_TASKS.md, 2026-10-28): the things only the client can change on their own website, each with a
// check the app runs itself. This file is the one rule for what a task is and whether it is done; the server stores the app's checks
// (services/siteTasks.ts, table site_tasks) and the engine's weekly / monthly readings arrive through the site's data. Done or to do is
// decided by the NEWEST reading, whoever made it, so a file removed after it was confirmed reopens the task instead of staying ticked.
import { AI_ANSWER_BOTS } from './robots';
import {
  INDEX_BLOCKING_CAUSES,
  INDEX_CAUSE_INFO,
  INDEXING_SITEMAP_KEY,
  INDEXING_TASK_MAX_URLS,
  indexingCauseOfKey,
  indexingTaskKey,
  indexPath,
  type IndexingCauseReading,
  type IndexingSitemapReading,
  type IndexSiteFixCause,
} from './indexing';

export type SiteTaskKind = 'indexnow' | 'ai_crawlers' | 'redirect' | 'indexing';
export const SITE_TASK_KINDS: readonly SiteTaskKind[] = ['indexnow', 'ai_crawlers', 'redirect', 'indexing'];
export type SiteTaskState = 'todo' | 'done' | 'skipped';
/** who made a reading: the client's own "check now", the app's daily check, the engine's weekly / monthly run, or the engine's daily
 *  index check (Index coverage, 2026-10-29: Google's own inspection of the pages, read by the engine every day) */
export type SiteTaskCheckBy = 'you' | 'daily' | 'weekly' | 'monthly' | 'index';
/** a reading made by the engine (not by the app's own check) */
const engineBy = (by: SiteTaskCheckBy) => by === 'weekly' || by === 'monthly' || by === 'index';

export interface SiteTaskCheck {
  at: string;
  ok: boolean;
  message: string;
  by: SiteTaskCheckBy;
  /** the person who pressed "check now" (by 'you' only) */
  who?: string;
}

export interface SiteTask {
  key: string;
  kind: SiteTaskKind;
  state: SiteTaskState;
  /** to do again after it was done once (the reading that found it missing is `lastCheck`) */
  reopened: boolean;
  /** the last time a reading found it done */
  doneAt: string | null;
  /** the reading that decided the state (null: nothing has read it yet) */
  lastCheck: SiteTaskCheck | null;
  severity: 'warning' | 'info';
  title: string;
  detail: string;
  /** what to copy (file names, addresses, the robots.txt rule to remove) */
  values: { label: string; value: string }[];
  /** the "Show me how" guide and this website's values for it */
  guide: string;
  guideVars: Record<string, string>;
  skipped: { at: string; who: string } | null;
}

/** The engine's readings of one website, as the app's data layer already has them. */
export interface SiteTaskInputs {
  domain: string;
  /** the latest AI growth run: the IndexNow key it made and whether it found the file */
  indexnow: { keyUrl: string; key: string; verified: boolean; checkedAt: string } | null;
  /** the latest AI visibility run's crawler access (answer crawlers only matter) */
  access: { checkedAt: string; bots: { bot: string; owner: string; group: 'answer' | 'training'; allowed: boolean; rule: string; blockedPaths: string[] }[] } | null;
  /** the latest FULL backlink report's broken pages that other sites link to (the weekly light watch does not look for broken pages,
   *  so its silence says nothing; the server passes only a full report) */
  reclaim: { receivedAt: string; items: { brokenUrl: string; redirectTo: string; links: number; domains: string[] }[] } | null;
  /** Index coverage (2026-10-29): the engine's daily index check, its pages grouped by the cause only the client can fix (absent or null:
   *  the check has not run for this website, or could not be read; a step already stored keeps its last state then) */
  indexing?: { runAt: string; causes: IndexingCauseReading[]; sitemap?: IndexingSitemapReading | null } | null;
}

/** One stored row (services/siteTasks.ts), in the shape this rule reads. */
export interface StoredSiteTask {
  key: string;
  kind: SiteTaskKind;
  payload: Record<string, unknown>;
  lastCheck: SiteTaskCheck | null;
  doneAt: string | null;
  skippedAt: string | null;
  skippedBy: string | null;
  createdAt: string;
}

/** How many redirect tasks one website shows at most (the latest report's broken pages with the most links first). */
export const SITE_TASK_MAX_REDIRECTS = 5;

/** A broken page's address as a task key: lower-case host, no www., no query, no fragment, no trailing slash. */
export function redirectTaskKey(url: string): string {
  // cut by index, not by regex (the address comes from other sites' links)
  const raw = String(url || '').trim();
  const cut = raw.search(/[?#]/);
  const u = cut >= 0 ? raw.slice(0, cut) : raw;
  const m = u.match(/^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/i);
  let path = m?.[2] ?? '/';
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return `redirect:${(m?.[1] ?? u).toLowerCase()}${path}`;
}

export const pathOfUrl = (url: string): string => String(url || '').replace(/^https?:\/\/[^/]+/i, '') || '/';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const newest = (xs: (SiteTaskCheck | null | undefined)[]): SiteTaskCheck | null =>
  xs.filter((x): x is SiteTaskCheck => !!x).reduce<SiteTaskCheck | null>((a, b) => (!a || b.at > a.at || (b.at === a.at && b.by === 'you') ? b : a), null);

/** One kind's facts for the rule: the engine's reading of it (null: the engine has not read it) and what the client sees. */
interface Draft {
  key: string;
  kind: SiteTaskKind;
  engine: SiteTaskCheck | null;
  payload: Record<string, unknown>;
  /** indexing: done because our fetch saw every page fixed and Google has not read them again yet (FIX_CONTRACT `fix_seen_at`) */
  pendingGoogle?: boolean;
}

function indexnowDraft(i: SiteTaskInputs['indexnow'], stored: StoredSiteTask | undefined): Draft | null {
  const keyUrl = i?.keyUrl || str(stored?.payload.keyUrl);
  const key = (keyUrl.match(/\/([a-f0-9]{32})\.txt$/) || [])[1] || '';
  if (!key) return null;
  const engine: SiteTaskCheck | null = i?.keyUrl
    ? { at: i.checkedAt, ok: i.verified, by: 'weekly', message: i.verified ? 'The file was found.' : 'The file was not found.' }
    : null;
  return { key: 'indexnow', kind: 'indexnow', engine, payload: { keyUrl, key } };
}

function crawlerDraft(a: SiteTaskInputs['access'], stored: StoredSiteTask | undefined): Draft | null {
  const answer = new Set(AI_ANSWER_BOTS.map((b) => b.bot.toLowerCase()));
  const blocked = (a?.bots ?? []).filter((b) => b.group === 'answer' && answer.has(b.bot.toLowerCase()) && (!b.allowed || b.blockedPaths.length));
  if (!blocked.length && !stored) return null;
  // the bots to check: the ones blocked now, else the ones the task was opened for (kept so a done task still says what was fixed)
  const bots = blocked.length
    ? blocked.map((b) => ({ bot: b.bot, owner: b.owner, rule: b.rule, paths: b.allowed ? b.blockedPaths : ['/', ...b.blockedPaths] }))
    : (Array.isArray(stored?.payload.bots) ? (stored!.payload.bots as Record<string, unknown>[]) : []).map((b) => ({ bot: str(b.bot), owner: str(b.owner), rule: str(b.rule), paths: strs(b.paths) }));
  if (!bots.length) return null;
  const engine: SiteTaskCheck | null = a?.checkedAt
    ? blocked.length
      ? { at: a.checkedAt, ok: false, by: 'weekly', message: `robots.txt blocked ${blocked.map((b) => b.bot).join(', ')}.` }
      : { at: a.checkedAt, ok: true, by: 'weekly', message: 'Every AI search crawler was allowed.' }
    : null;
  // a reading older than the task itself says nothing about the fix
  return { key: 'ai_crawlers', kind: 'ai_crawlers', engine: engine && stored && engine.ok && engine.at < stored.createdAt ? null : engine, payload: { bots } };
}

function redirectDrafts(r: SiteTaskInputs['reclaim'], stored: StoredSiteTask[]): Draft[] {
  const out: Draft[] = [];
  const items = [...(r?.items ?? [])].filter((x) => x.brokenUrl).sort((a, b) => b.links - a.links);
  // every page the report still lists, capped or not: a stored step whose page fell below the cap is still broken, not fixed
  const listed = new Map<string, (typeof items)[number]>();
  for (const it of items) if (!listed.has(redirectTaskKey(it.brokenUrl))) listed.set(redirectTaskKey(it.brokenUrl), it);
  const storedKeys = new Set(stored.filter((s) => s.kind === 'redirect').map((s) => s.key));
  const live = new Set<string>();
  let fresh = 0;
  for (const [key, it] of listed) {
    // a new step only for the pages with the most links; one already stored keeps being read
    if (!storedKeys.has(key) && fresh >= SITE_TASK_MAX_REDIRECTS) continue;
    if (!storedKeys.has(key)) fresh++;
    live.add(key);
    out.push({
      key,
      kind: 'redirect',
      engine: { at: r!.receivedAt, ok: false, by: 'monthly', message: 'The page was still broken.' },
      payload: { brokenUrl: it.brokenUrl, redirectTo: it.redirectTo, links: it.links, domains: it.domains.slice(0, 5) },
    });
  }
  // a stored redirect task the latest report no longer lists: that report (if it came after the task) reads it as fixed
  for (const s of stored.filter((s) => s.kind === 'redirect' && !live.has(s.key))) {
    const later = r && r.receivedAt > s.createdAt;
    out.push({
      key: s.key,
      kind: 'redirect',
      engine: later ? { at: r!.receivedAt, ok: true, by: 'monthly', message: 'The page was no longer listed as broken.' } : null,
      payload: s.payload,
    });
  }
  return out;
}

/**
 * Index coverage (2026-10-29, fix wave 1): one step per cause only the client can fix (`indexing:<cause>`), listing up to 25 of its pages
 * (most impressions first) and how many there are, plus the sitemap step (`indexing:sitemap`) when Search Console has no sitemap or
 * reports errors in one. The rules:
 * - The engine's reading of a cause is the newest time GOOGLE read one of its pages with that cause (A5), so the engine's weekly re-fetch of
 *   a page never reopens a step our own check found fixed.
 * - A page our fetch saw fixed after Google's last reading (`fix_seen_at`) is waiting for Google: when every page of a cause is, the step
 *   is done ("fixed on your site, waiting for Google") and is never reopened by Google's older reading.
 * - A cause read only in part (its read hit the cap, A6) never reads as done; a stored step keeps its last state.
 * - One page, one ask: a page that is already a `redirect:` step is left out of the list; a cause whose pages are ALL such steps has no
 *   step at all, never a "done" (A7).
 * - A stored step whose cause the newest run lists nowhere any more is done by that run, if the run came after the step was stored.
 */
function indexingDrafts(ix: SiteTaskInputs['indexing'], stored: StoredSiteTask[], skipUrls: ReadonlySet<string>): Draft[] {
  const out: Draft[] = [];
  const handled = new Set<string>();
  for (const c of ix?.causes ?? []) {
    const key = indexingTaskKey(c.cause);
    const st = stored.find((x) => x.key === key);
    const urls = c.urls.filter((u) => !skipUrls.has(redirectTaskKey(u)));
    const hidden = c.urls.length - urls.length;
    const total = Math.max(0, c.total - hidden);
    handled.add(key);
    if (total > 0) {
      out.push({
        key,
        kind: 'indexing',
        engine: { at: c.readAt || ix!.runAt, ok: false, by: 'index', message: `Google's newest reading still lists ${total} page${total === 1 ? '' : 's'} with this problem.` },
        payload: { cause: c.cause, urls: urls.slice(0, INDEXING_TASK_MAX_URLS), total, ...(c.pending ? { pending: c.pending } : {}) },
      });
      continue;
    }
    // every listed page is already another step's ask: no step of its own, and never a "done" (A7)
    if (hidden > 0 && !c.pending) continue;
    // read only in part: nothing is concluded (A6)
    if (!c.complete) {
      if (st) out.push({ key, kind: 'indexing', engine: null, payload: st.payload });
      continue;
    }
    if (c.pending > 0) {
      out.push({
        key,
        kind: 'indexing',
        engine: { at: c.pendingAt || ix!.runAt, ok: true, by: 'index', message: `Fixed on your site: we saw the change on ${c.pending === 1 ? 'the page' : `all ${c.pending} pages`}. Waiting for Google to read ${c.pending === 1 ? 'it' : 'them'} again.` },
        payload: st?.payload ?? { cause: c.cause, urls: [], total: c.pending },
        pendingGoogle: true,
      });
    } else if (st) {
      out.push(storedDone(st, ix!.runAt));
    }
  }
  // the sitemap step (X5): Search Console has no sitemap, or reports errors in one
  const sm = ix?.sitemap ?? null;
  const smStored = stored.find((x) => x.key === INDEXING_SITEMAP_KEY);
  if (sm && (sm.submitted === 0 || sm.errors > 0)) {
    handled.add(INDEXING_SITEMAP_KEY);
    out.push({
      key: INDEXING_SITEMAP_KEY,
      kind: 'indexing',
      engine: { at: sm.at, ok: false, by: 'index', message: sm.submitted === 0 ? 'Search Console lists no sitemap for this website.' : `Search Console reports ${sm.errors} error${sm.errors === 1 ? '' : 's'} in your sitemap.` },
      payload: { cause: 'sitemap', submitted: sm.submitted, errors: sm.errors },
    });
  } else if (smStored) {
    handled.add(INDEXING_SITEMAP_KEY);
    const later = !!sm && sm.at > smStored.createdAt;
    out.push({ key: INDEXING_SITEMAP_KEY, kind: 'indexing', engine: later ? { at: sm!.at, ok: true, by: 'index', message: 'Search Console lists your sitemap and reports no errors in it.' } : null, payload: smStored.payload });
  }
  for (const st of stored.filter((x) => x.kind === 'indexing' && !handled.has(x.key))) {
    if (!indexingCauseOfKey(st.key)) continue;
    out.push(ix ? storedDone(st, ix.runAt) : { key: st.key, kind: 'indexing', engine: null, payload: st.payload });
  }
  return out;
}

/** A stored step whose cause the newest run lists nowhere any more: done by that run, if it came after the step was stored. */
function storedDone(st: StoredSiteTask, runAt: string): Draft {
  const later = runAt > st.createdAt;
  return { key: st.key, kind: 'indexing', engine: later ? { at: runAt, ok: true, by: 'index', message: 'Google\'s newest reading lists none of these pages with this problem any more.' } : null, payload: st.payload };
}

const isSitemapStep = (p: Record<string, unknown>) => str(p.cause) === 'sitemap';
const indexingCauseOf = (p: Record<string, unknown>): IndexSiteFixCause => (indexingCauseOfKey(`indexing:${str(p.cause)}`) ?? 'noindex');

/** A8: what a done indexing step says is true now, cause by cause (what we checked, never a promise about Google). */
const INDEXING_DONE: Record<IndexSiteFixCause, string> = {
  noindex: 'These pages open without a noindex instruction, in the page or in your server\'s answer.',
  robots_blocked: 'Your robots.txt lets Google read these pages.',
  server_error: 'These pages answer normally (200).',
  access_denied: 'These pages open for everyone (200).',
  not_found: 'Each address opens a page again, or redirects permanently to a page of yours that opens.',
  soft_404: 'These pages have real content now, or answer 404 as a page that is gone should.',
  canonical_elsewhere: 'Your sitemap and these pages agree on the main version.',
  redirect: 'Your sitemap no longer lists addresses that redirect.',
  not_in_sitemap: 'Your sitemap lists these pages.',
  indexed_not_in_sitemap: 'Your sitemap lists these pages.',
};

const fmtBots = (bots: { bot: string; owner: string }[]) => bots.map((b) => (b.owner && b.owner !== b.bot ? `${b.bot}, used by ${b.owner}` : b.bot)).join('; ');

/** What a done step says: what is true now, never the problem it was (2026-10-28, seen while filming the tutorial). */
function doneDetail(d: Draft, domain: string): string {
  const p = d.payload;
  switch (d.kind) {
    case 'indexnow':
      return `The file is in place on ${domain}. New and updated pages are announced to Bing, Copilot and the other IndexNow search engines the same week.`;
    case 'ai_crawlers': {
      const bots = ((p.bots as { bot: string }[]) ?? []).map((b) => b.bot);
      return `Your robots.txt lets ${bots.join(', ')} read your pages, so AI assistants can name and cite them.`;
    }
    case 'redirect': {
      const links = Number(p.links) || 0;
      return `${pathOfUrl(str(p.brokenUrl))} now leads to a page that opens, so the ${links} link${links === 1 ? '' : 's'} from other websites keep${links === 1 ? 's' : ''} their value.`;
    }
    case 'indexing': {
      if (isSitemapStep(p)) return 'Search Console lists your sitemap and reports no errors in it. The daily index check keeps reading it.';
      const what = INDEXING_DONE[indexingCauseOf(p)];
      if (d.pendingGoogle) return `${what} We saw the change on your website; Google shows its older reading until it reads the pages again, usually within a few days, and the daily index check asks it soon.`;
      if (d.engine?.ok && d.engine.by === 'index') return `Google's newest reading lists none of these pages with this problem any more. The daily index check keeps watching them.`;
      return `${what} The daily index check keeps watching them.`;
    }
    default: {
      const never: never = d.kind;
      return String(never);
    }
  }
}

function present(d: Draft, domain: string): Pick<SiteTask, 'title' | 'detail' | 'values' | 'guide' | 'guideVars'> {
  switch (d.kind) {
    case 'indexnow':
      return presentIndexnow(d.payload, domain);
    case 'ai_crawlers':
      return presentCrawlers(d.payload, domain);
    case 'redirect':
      return presentRedirect(d.payload);
    case 'indexing':
      return presentIndexing(d.payload, domain);
    default: {
      const never: never = d.kind;
      throw new Error(`Unknown step kind ${String(never)}`);
    }
  }
}

function presentIndexing(p: Record<string, unknown>, domain: string): Pick<SiteTask, 'title' | 'detail' | 'values' | 'guide' | 'guideVars'> {
  if (isSitemapStep(p)) {
    const errors = Number(p.errors) || 0;
    const none = Number(p.submitted) === 0;
    return {
      title: none ? 'Submit your sitemap in Search Console' : 'Fix the errors Search Console reports in your sitemap',
      detail: none
        ? 'Search Console lists no sitemap for this website. Submitting it there is how Google learns which pages you want found, and Search Console then reports on it. Only someone with access to your Search Console can do it; the daily index check sees it the day after.'
        : `Search Console reports ${errors} error${errors === 1 ? '' : 's'} in a sitemap you submitted, so Google may skip some of the pages in it. Search Console names each error; the daily index check sees the fix the day after it is resubmitted.`,
      values: [{ label: 'Your sitemap', value: `https://${domain}/sitemap.xml` }],
      guide: 'index-submit-sitemap',
      guideVars: {},
    };
  }
  const cause = indexingCauseOf(p);
  const info = INDEX_CAUSE_INFO[cause];
  const urls = (Array.isArray(p.urls) ? p.urls : []).map(str).filter(Boolean);
  const total = Math.max(Number(p.total) || 0, urls.length);
  const shown = urls.slice(0, 5);
  const more = total - shown.length;
  const pending = Number(p.pending) || 0;
  return {
    title: info.taskTitle ?? info.label,
    detail: `${info.meaning} ${info.youDo} ${total} page${total === 1 ? '' : 's'}${more > 0 ? `; the first ${shown.length} are below, every one is on the Indexing page` : ''}.${pending ? ` We already saw ${pending} more fixed on your site; ${pending === 1 ? 'it waits' : 'they wait'} for Google to read ${pending === 1 ? 'it' : 'them'} again.` : ''}`,
    values: shown.map((u, i) => ({ label: `Page ${i + 1}`, value: u })),
    guide: info.guide ?? 'index-coverage',
    guideVars: { pageUrl: shown[0] ?? '', pagePath: shown[0] ? indexPath(shown[0]) : '' },
  };
}

function presentIndexnow(p: Record<string, unknown>, domain: string): Pick<SiteTask, 'title' | 'detail' | 'values' | 'guide' | 'guideVars'> {
  const key = str(p.key);
  const keyUrl = str(p.keyUrl);
  return {
    title: 'Add the IndexNow file to your website',
    detail: `One small text file at the root of ${domain}. Once it is there, every new or updated page is announced to Bing, Copilot and the other IndexNow search engines the same week.`,
    values: [
      { label: 'File name', value: `${key}.txt` },
      { label: 'The only line inside it', value: key },
      { label: 'Where it must answer', value: keyUrl },
    ],
    guide: 'indexnow-key-file',
    guideVars: { indexNowKey: key, indexNowFile: `${key}.txt`, indexNowUrl: keyUrl },
  };
}

function presentCrawlers(p: Record<string, unknown>, domain: string): Pick<SiteTask, 'title' | 'detail' | 'values' | 'guide' | 'guideVars'> {
  const bots = (p.bots as { bot: string; owner: string; rule: string; paths: string[] }[]) ?? [];
  return {
    title: 'Let AI search crawlers read your website',
    detail: `Your robots.txt turns away ${fmtBots(bots)}. An assistant cannot name or cite a page its crawler may not read.`,
    values: [
      { label: 'The file to edit', value: `https://${domain}/robots.txt` },
      ...bots.slice(0, 4).map((b) => ({ label: `Rule that blocks ${b.bot}`, value: b.rule || 'Disallow: /' })),
    ],
    guide: 'ai-crawler-access',
    guideVars: {},
  };
}

function presentRedirect(p: Record<string, unknown>): Pick<SiteTask, 'title' | 'detail' | 'values' | 'guide' | 'guideVars'> {
  const broken = str(p.brokenUrl);
  const to = str(p.redirectTo);
  const links = Number(p.links) || 0;
  return {
    title: `Redirect ${pathOfUrl(broken)}`,
    detail: `${links} link${links === 1 ? '' : 's'} from other websites point to this address, and it no longer opens. A permanent (301) redirect to ${pathOfUrl(to)} keeps what those links are worth.`,
    values: [
      { label: 'Old address', value: broken },
      { label: 'Redirect it to', value: to },
    ],
    guide: 'redirect-broken-page',
    guideVars: { brokenUrl: broken, redirectTo: to },
  };
}

/**
 * Every site task of one website with its state: the engine's readings, the stored rows (the app's own checks, a skip) and the newest
 * reading decides. A task nobody needs any more and nobody stored is not listed; a stored one stays, so a done step stays visibly done.
 */
export function deriveSiteTasks(inputs: SiteTaskInputs, stored: StoredSiteTask[]): SiteTask[] {
  const byKey = new Map(stored.map((s) => [s.key, s]));
  const redirects = redirectDrafts(inputs.reclaim, stored);
  const drafts = [indexnowDraft(inputs.indexnow, byKey.get('indexnow')), crawlerDraft(inputs.access, byKey.get('ai_crawlers')), ...redirects, ...indexingDrafts(inputs.indexing, stored, new Set(redirects.map((r) => r.key)))].filter(
    (d): d is Draft => !!d,
  );
  const out: SiteTask[] = drafts.map((d) => {
    const s = byKey.get(d.key);
    // a redirect's engine reading comes from a backlink index that lags by weeks; our own fetch of the address is the truth, so an index
    // "still broken" only wins over a reading of ours that is more than a week older than it
    const own = s?.lastCheck && !engineBy(s.lastCheck.by) ? s.lastCheck : null;
    const indexStale = d.kind === 'redirect' && !!own && !!d.engine && !d.engine.ok && Date.parse(d.engine.at) - Date.parse(own.at) < 7 * 864e5;
    const decided = indexStale ? own : newest([d.engine, s?.lastCheck]);
    const lastDone = [s?.doneAt ?? null, d.engine?.ok ? d.engine.at : null, s?.lastCheck?.ok ? s.lastCheck.at : null].filter((x): x is string => !!x).sort().pop() ?? null;
    const done = !!decided?.ok;
    const reopened = !done && !!lastDone && !!decided && lastDone < decided.at;
    const state: SiteTaskState = s?.skippedAt ? 'skipped' : done ? 'done' : 'todo';
    const shown = present(d, inputs.domain);
    const searchBlocked =
      (d.kind === 'ai_crawlers' && ((d.payload.bots as { bot: string }[]) ?? []).some((b) => /^(googlebot|bingbot)$/i.test(b.bot))) ||
      // Index coverage: a step that keeps Google out of pages altogether (noindex, robots.txt, errors, a login) is important
      (d.kind === 'indexing' && !isSitemapStep(d.payload) && INDEX_BLOCKING_CAUSES.has(indexingCauseOf(d.payload)));
    return {
      key: d.key,
      kind: d.kind,
      state,
      reopened: state === 'todo' && reopened,
      doneAt: lastDone,
      lastCheck: decided,
      severity: state === 'todo' && (reopened || searchBlocked) ? 'warning' : 'info',
      ...shown,
      detail: state === 'done' ? doneDetail(d, inputs.domain) : shown.detail,
      guideVars: { domain: inputs.domain, ...shown.guideVars },
      skipped: s?.skippedAt ? { at: s.skippedAt, who: s.skippedBy ?? '' } : null,
    };
  });
  const rank = (t: SiteTask) => (t.state === 'todo' ? (t.severity === 'warning' ? 0 : 1) : t.state === 'done' ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b));
}

/** The payload a stored row keeps for one task (what its check needs), from the derived task. */
export function siteTaskPayload(inputs: SiteTaskInputs, stored: StoredSiteTask[], key: string): { kind: SiteTaskKind; payload: Record<string, unknown> } | null {
  const byKey = new Map(stored.map((s) => [s.key, s]));
  const kind = siteTaskKindOfKey(key);
  if (!kind) return null;
  let d: Draft | null;
  switch (kind) {
    case 'indexnow':
      d = indexnowDraft(inputs.indexnow, byKey.get(key));
      break;
    case 'ai_crawlers':
      d = crawlerDraft(inputs.access, byKey.get(key));
      break;
    case 'redirect':
      d = redirectDrafts(inputs.reclaim, stored).find((x) => x.key === key) ?? null;
      break;
    case 'indexing': {
      const skip = new Set(redirectDrafts(inputs.reclaim, stored).map((r) => r.key));
      d = indexingDrafts(inputs.indexing, stored, skip).find((x) => x.key === key) ?? null;
      break;
    }
    default: {
      const never: never = kind;
      return never;
    }
  }
  return d ? { kind: d.kind, payload: d.payload } : null;
}

/** The kind a task key names (null: a key no kind makes, which is never treated as some other kind's step). */
export function siteTaskKindOfKey(key: string): SiteTaskKind | null {
  if (key === 'indexnow') return 'indexnow';
  if (key === 'ai_crawlers') return 'ai_crawlers';
  if (key.startsWith('redirect:')) return 'redirect';
  if (indexingCauseOfKey(key) || key === INDEXING_SITEMAP_KEY) return 'indexing';
  return null;
}

/** "Checked 28 Oct by you", "Confirmed by the weekly AI growth run on 25 Oct": who read it and when, in words. */
export function siteTaskCheckLine(c: SiteTaskCheck, fmtDate: (iso: string) => string): string {
  const when = fmtDate(c.at);
  if (c.by === 'you') return `Checked on ${when}${c.who ? ` by ${c.who}` : ''}`;
  if (c.by === 'daily') return `Checked automatically on ${when}`;
  if (c.by === 'index') return `Daily index check on ${when}`;
  return `${c.by === 'weekly' ? 'Weekly' : 'Monthly'} check on ${when}`;
}
