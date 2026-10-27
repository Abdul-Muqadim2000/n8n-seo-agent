// Steps on your website (app/docs/SITE_TASKS.md, 2026-10-28): the things only the client can change on their own website, each with a
// check the app runs itself. This file is the one rule for what a task is and whether it is done; the server stores the app's checks
// (services/siteTasks.ts, table site_tasks) and the engine's weekly / monthly readings arrive through the site's data. Done or to do is
// decided by the NEWEST reading, whoever made it, so a file removed after it was confirmed reopens the task instead of staying ticked.
import { AI_ANSWER_BOTS } from './robots';

export type SiteTaskKind = 'indexnow' | 'ai_crawlers' | 'redirect';
export type SiteTaskState = 'todo' | 'done' | 'skipped';
/** who made a reading: the client's own "check now", the app's daily check, or the engine's weekly / monthly run */
export type SiteTaskCheckBy = 'you' | 'daily' | 'weekly' | 'monthly';

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
  const u = String(url || '').trim().replace(/[?#].*$/, '');
  const m = u.match(/^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/i);
  const path = (m?.[2] ?? '/').replace(/\/+$/, '') || '/';
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

const fmtBots = (bots: { bot: string; owner: string }[]) => bots.map((b) => (b.owner && b.owner !== b.bot ? `${b.bot}, used by ${b.owner}` : b.bot)).join('; ');

function present(d: Draft, domain: string): Pick<SiteTask, 'title' | 'detail' | 'values' | 'guide' | 'guideVars'> {
  const p = d.payload;
  if (d.kind === 'indexnow') {
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
  if (d.kind === 'ai_crawlers') {
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
  const drafts = [indexnowDraft(inputs.indexnow, byKey.get('indexnow')), crawlerDraft(inputs.access, byKey.get('ai_crawlers')), ...redirectDrafts(inputs.reclaim, stored)].filter(
    (d): d is Draft => !!d,
  );
  const out: SiteTask[] = drafts.map((d) => {
    const s = byKey.get(d.key);
    // a redirect's engine reading comes from a backlink index that lags by weeks; our own fetch of the address is the truth, so an index
    // "still broken" only wins over a reading of ours that is more than a week older than it
    const own = s?.lastCheck && s.lastCheck.by !== 'weekly' && s.lastCheck.by !== 'monthly' ? s.lastCheck : null;
    const indexStale = d.kind === 'redirect' && !!own && !!d.engine && !d.engine.ok && Date.parse(d.engine.at) - Date.parse(own.at) < 7 * 864e5;
    const decided = indexStale ? own : newest([d.engine, s?.lastCheck]);
    const lastDone = [s?.doneAt ?? null, d.engine?.ok ? d.engine.at : null, s?.lastCheck?.ok ? s.lastCheck.at : null].filter((x): x is string => !!x).sort().pop() ?? null;
    const done = !!decided?.ok;
    const reopened = !done && !!lastDone && !!decided && lastDone < decided.at;
    const state: SiteTaskState = s?.skippedAt ? 'skipped' : done ? 'done' : 'todo';
    const shown = present(d, inputs.domain);
    const searchBlocked = d.kind === 'ai_crawlers' && ((d.payload.bots as { bot: string }[]) ?? []).some((b) => /^(googlebot|bingbot)$/i.test(b.bot));
    return {
      key: d.key,
      kind: d.kind,
      state,
      reopened: state === 'todo' && reopened,
      doneAt: lastDone,
      lastCheck: decided,
      severity: state === 'todo' && (reopened || searchBlocked) ? 'warning' : 'info',
      ...shown,
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
  const d =
    key === 'indexnow'
      ? indexnowDraft(inputs.indexnow, byKey.get(key))
      : key === 'ai_crawlers'
        ? crawlerDraft(inputs.access, byKey.get(key))
        : redirectDrafts(inputs.reclaim, stored).find((x) => x.key === key) ?? null;
  return d ? { kind: d.kind, payload: d.payload } : null;
}

/** "Checked 28 Oct by you", "Confirmed by the weekly AI growth run on 25 Oct": who read it and when, in words. */
export function siteTaskCheckLine(c: SiteTaskCheck, fmtDate: (iso: string) => string): string {
  const when = fmtDate(c.at);
  if (c.by === 'you') return `Checked on ${when}${c.who ? ` by ${c.who}` : ''}`;
  if (c.by === 'daily') return `Checked automatically on ${when}`;
  return `${c.by === 'weekly' ? 'Weekly' : 'Monthly'} check on ${when}`;
}
