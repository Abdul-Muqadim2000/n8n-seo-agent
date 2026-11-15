// Client report 2026-11-16 (devaicon.com, issue 1, F8 / F11): a question to win in AI answers, in plain words.
//
// The engine stores each question it plans a page for in seo_ai_targets (status queued / writing / written / won / skipped / set_aside) with
// a `reason` written for the team ("a page run (cad_...) was started ... this row moves to written only against a seo_content_log row",
// "AI ranking (L06): ... expected gain 0.0119 over $9.63 ..."). The AI visibility page printed that text and the raw status as it was. Here
// the state is DERIVED, with the page the content log holds for the question (a target still `writing` whose page went live days ago is
// shown live), and every sentence comes from a fixed table: no request id, table name, lever id, money figure or model name ever reaches
// the client. The engine's own reason stays available to platform admins only (`adminReason`).
//
// The engine adds `reason_code` + `reason_args` (CONTRACT_ISSUE1.md §3). Rows written before it carry only `reason`: their code is read from
// the old sentence. An unknown code falls back to the status alone. Pure, shared by the server (data.ts toGrowth) and the tests.

import { LRU } from './ladder-rules';

export type AiTargetState =
  | 'queued'
  | 'writing'
  | 'written'
  | 'needs_fix'
  | 'held'
  | 'live'
  | 'won'
  | 'retry'
  | 'covered'
  | 'later'
  | 'not_for_site'
  | 'kept_out'
  | 'named';

export type AiTargetTone = 'neutral' | 'accent' | 'good' | 'warning';

/** The reason codes the engine writes (CONTRACT_ISSUE1.md §3) and the ones read from older sentences. */
export const AI_TARGET_REASON_CODES = [
  'new_page',
  'refresh_page',
  'writing',
  'written',
  'live',
  'won',
  'lower_value',
  'fresh_page',
  'no_longer_lost',
  'off_topic',
  'other_market',
  'same_search_page',
  'run_failed',
  'ai_rank',
  // read from older sentences (and accepted if the engine writes them)
  'ladder',
  'kept',
  'other_brand',
  'own_brand',
  'government',
  'job',
  'navigational',
  'needs_fix',
] as const;
export type AiTargetReasonCode = (typeof AI_TARGET_REASON_CODES)[number];

/** A stored target as the app reads it (seo_ai_targets, camelCase). Every field may be empty on an older row. */
export interface AiTargetLike {
  status: string;
  kind?: string;
  keyword?: string;
  question?: string;
  pageUrl?: string;
  reason?: string;
  reasonCode?: string;
  /** JSON text or an object: { page_url, keyword, date, score, value_rank, market } */
  reasonArgs?: unknown;
  origin?: string | null;
  requestId?: string;
  writtenAt?: string;
  wonAt?: string;
  updatedAt?: string;
  liveAt?: string | null;
}

/** A content-log row (seo_content_log) in either spelling. */
export interface AiLogLike {
  keyword?: string;
  request_id?: string;
  requestId?: string;
  status?: string;
  published_url?: string;
  publishedUrl?: string;
  published_at?: string;
  publishedAt?: string;
  started_at?: string;
  startedAt?: string;
  source?: string;
}

export interface AiTargetView {
  state: AiTargetState;
  /** the badge, two or three words */
  badge: string;
  tone: AiTargetTone;
  /** one plain sentence for the client */
  sentence: string;
  /** the page that answers (or will answer) the question, '' when none */
  pageUrl: string;
  /** the day that goes with the state (started, published, won), ISO, '' when unknown */
  date: string;
  /** a question AI already names the client for: not listed as a question to win */
  hidden: boolean;
  /** answered by a page of a keyword ladder (one search, one page) */
  viaLadder: boolean;
  /** the code the view was built from (the engine's, or read from the old sentence) */
  code: AiTargetReasonCode | '';
}

const S = (v: unknown) => (v == null ? '' : String(v));
const reqOf = (l: AiLogLike) => S(l.request_id ?? l.requestId);
const urlOfLog = (l: AiLogLike) => S(l.published_url ?? l.publishedUrl).trim();
const startedOf = (l: AiLogLike) => S(l.started_at ?? l.startedAt);
const publishedOf = (l: AiLogLike) => S(l.published_at ?? l.publishedAt);
const low = (v: unknown) => S(v).toLowerCase().replace(/\s+/g, ' ').trim();
const sameKw = (a: unknown, b: unknown) => !!low(a) && !!low(b) && (low(a) === low(b) || LRU.sameSearch(low(a), low(b)));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "13 Nov 2026" (UTC), '' for no date */
export function aiDay(iso: string): string {
  const t = Date.parse(S(iso));
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** "/services/x" for a page of the website, "your page" when there is no address */
export function aiPagePath(url: string): string {
  const u = S(url).trim();
  if (!u) return 'your page';
  const p = u.replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/[?#].*$/, '');
  return p && p !== '/' ? p : u.replace(/^[a-z]+:\/\/(www\.)?/i, '').replace(/\/+$/, '');
}

const argsOf = (v: unknown): Record<string, unknown> => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  const s = S(v).trim();
  if (!s) return {};
  try {
    const x = JSON.parse(s);
    return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** The code of a stored target: the engine's `reason_code` when it is one we know, else read from the older sentence ('' = none). */
export function aiTargetCode(t: Pick<AiTargetLike, 'reason' | 'reasonCode' | 'origin' | 'kind' | 'status'>): AiTargetReasonCode | '' {
  const c = low(t.reasonCode);
  if ((AI_TARGET_REASON_CODES as readonly string[]).includes(c)) return c as AiTargetReasonCode;
  const r = low(t.reason);
  if (/kept by you/.test(r)) return 'kept';
  if (/\((off topic|too broad)\)/.test(r)) return 'off_topic';
  if (/\(other brand\)/.test(r)) return 'other_brand';
  if (/\(own brand\)/.test(r)) return 'own_brand';
  if (/\((government|portal)\)/.test(r)) return 'government';
  if (/\(job search\)/.test(r)) return 'job';
  if (/\((other market|market)\)/.test(r)) return 'other_market';
  if (/\(navigational\)/.test(r)) return 'navigational';
  if (/did not pass the quality check/.test(r)) return 'needs_fix';
  if (/never produced a page|queued again/.test(r)) return 'run_failed';
  if (/^written as the keyword ladder page|written as the keyword ladder page/.test(r)) return 'ladder';
  if (/lower value than/.test(r)) return 'lower_value';
  if (/no longer lost|^ai names you for this question/.test(r)) return 'no_longer_lost';
  if (/the page is fresh|was published on .*ai readiness is checked/.test(r)) return 'fresh_page';
  if (S(t.origin) === 'ai_rank' || /^ai ranking \(/.test(r)) return 'ai_rank';
  if (/^refresh /.test(r) || (S(t.kind) === 'refresh' && /refresh/.test(r))) return 'refresh_page';
  if (/no page answers it yet/.test(r)) return 'new_page';
  return '';
}

/** The plain sentence for a question this website does not target (set aside), by class. */
const NOT_FOR_SITE: Partial<Record<AiTargetReasonCode, string>> = {
  off_topic: 'This question is not about what you sell (we look at your services, your keywords and your pages). If you do sell it, add it to your services.',
  other_brand: 'It asks about another company, so no page is written for it.',
  own_brand: 'It asks for your own business by name, so no new page is needed for it.',
  government: 'It is about a government service, not something you sell.',
  job: 'It is about jobs or careers, not something you sell.',
  other_market: 'It is about another country than the one you sell in.',
  navigational: 'People asking it look for one particular website, so a page of yours would not be the answer.',
};

const V = (state: AiTargetState, badge: string, tone: AiTargetTone, sentence: string, extra: Partial<AiTargetView> = {}): AiTargetView => ({
  state,
  badge,
  tone,
  sentence,
  pageUrl: '',
  date: '',
  hidden: false,
  viaLadder: false,
  code: '',
  ...extra,
});

/** The page the content log holds for this question: the run's own row (by request id), else a row for the question's own search. */
export function aiTargetLog(t: AiTargetLike, logs: readonly AiLogLike[] = []): AiLogLike | null {
  const req = S(t.requestId).trim();
  if (req) {
    const own = logs.find((l) => reqOf(l) === req);
    // the engine's own link, unless it points at a page for ANOTHER search (a question folded into an unrelated ladder page, F7)
    if (own && (/^ai_/.test(S(own.source)) || sameKw(own.keyword, t.keyword) || S(t.kind) === 'refresh')) return own;
  }
  const kw = S(t.keyword);
  if (!kw) return null;
  const st = S(t.status);
  const rows = logs
    .filter((l) => sameKw(l.keyword, kw))
    // a queued / skipped question counts only a page written FOR an AI question of that search (a refresh of a page is planned, not done)
    .filter((l) => ['writing', 'written'].includes(st) || (/^ai_/.test(S(l.source)) && S(t.kind) !== 'refresh'))
    .sort((a, b) => startedOf(b).localeCompare(startedOf(a)));
  return rows[0] ?? null;
}

/**
 * A stored target -> what the client sees: badge, tone and one plain sentence. `logs`: the website's content-log rows (any order).
 * The state follows the page when the content log knows it (published wins over a stale `writing`), else the stored status and its code.
 */
export function aiTargetView(t: AiTargetLike, logs: readonly AiLogLike[] = []): AiTargetView {
  const status = S(t.status);
  const code = aiTargetCode(t);
  const args = argsOf(t.reasonArgs);
  const pageUrl = S(args.page_url) || S(t.pageUrl);
  const path = aiPagePath(pageUrl);
  const ladderKw = S(args.keyword);
  if (status === 'won') return V('won', 'Won', 'good', 'AI now names you for this question.', { date: S(t.wonAt), code });

  // a question this website does not target: never derived from a page (the engine keeps a question whose page exists, F-37)
  if (status === 'set_aside') {
    const sentence = (code && NOT_FOR_SITE[code]) || NOT_FOR_SITE.off_topic!;
    return V('not_for_site', 'Not for this website', 'neutral', sentence, { code });
  }
  if (code === 'kept') return V('kept_out', 'Kept out by you', 'neutral', 'You chose not to write a page for it.', { code });

  const log = aiTargetLog(t, logs);
  if (log) {
    const ls = S(log.status);
    const url = urlOfLog(log);
    const lp = aiPagePath(url || pageUrl);
    if (ls === 'published' || url) {
      const day = aiDay(publishedOf(log) || S(t.liveAt));
      return V('live', 'Published', 'good', `Your page ${lp} answers it${day ? `, published ${day}` : ''}. AI answers usually take a few weeks to change.`, { pageUrl: url || pageUrl, date: publishedOf(log), code });
    }
    if (ls === 'written') return V('written', 'Written', 'accent', 'The page is written and waiting to be published.', { date: startedOf(log), code });
    if (ls === 'not_ready') return V('needs_fix', 'Needs a fix', 'warning', 'The page is written but needs a fix before it can be published. Open it on the Content page.', { date: startedOf(log), code });
    if (ls === 'held') return V('held', 'Waiting for you', 'warning', 'The page waits for your OK before it is written. Open its report to decide.', { date: startedOf(log), code });
    if (ls === 'failed') return V('retry', 'Will be tried again', 'neutral', 'The page could not be finished. It will be written again.', { code });
    if (ls === 'started' && (status === 'writing' || status === 'written' || /^ai_/.test(S(log.source)))) {
      const day = aiDay(startedOf(log));
      return V('writing', 'Being written', 'accent', `The page is being written${day ? ` (started ${day})` : ''}.`, { date: startedOf(log), code });
    }
  }

  // the engine linked the question to a page run that wrote a page for ANOTHER search (folded into an unrelated ladder page, F7)
  const req = S(t.requestId).trim();
  const foreign = !log && !!req && (status === 'writing' || status === 'written') ? logs.find((l) => reqOf(l) === req) : undefined;
  if (foreign && !sameKw(foreign.keyword, t.keyword))
    return V('queued', 'Queued', 'accent', 'The page written then covers another search, so a page for this question is still planned.', { code });

  if (status === 'writing') {
    if (code === 'run_failed') return V('retry', 'Will be tried again', 'neutral', 'The page could not be finished. It will be written again.', { code });
    const day = aiDay(S(t.updatedAt) || S(t.writtenAt));
    return V('writing', 'Being written', 'accent', `The page is being written${day ? ` (started ${day})` : ''}.`, { code });
  }
  if (status === 'written') return V('written', 'Written', 'accent', 'The page is written and waiting to be published.', { date: S(t.writtenAt), code });

  if (status === 'skipped') {
    if (code === 'no_longer_lost') return V('named', 'Named', 'good', 'AI already names you here.', { hidden: true, code });
    if (code === 'fresh_page') return V('covered', 'Covered', 'good', `Your page ${path} already answers it and is up to date.`, { pageUrl, code });
    if (code === 'needs_fix') return V('needs_fix', 'Needs a fix', 'warning', 'The page written for it needs a fix before it can be published. Open it on the Content page.', { code });
    if (code === 'ladder') return V('queued', 'Via the ladder', 'accent', `Your keyword ladder page${ladderKw ? ` for "${ladderKw}"` : ''} is written to answer it.`, { viaLadder: true, code });
    return V('later', 'Later', 'neutral', 'Other questions are worth more this week. It is checked again next week.', { code });
  }

  // queued (and any status we do not know: the client is told what we plan, never the raw value)
  if (code === 'lower_value') return V('later', 'Later', 'neutral', 'Other questions are worth more this week. It is checked again next week.', { code });
  if (code === 'run_failed') return V('retry', 'Will be tried again', 'neutral', 'The page could not be finished. It will be written again.', { code });
  if (code === 'needs_fix') return V('needs_fix', 'Needs a fix', 'warning', 'The page written for it needs a fix before it can be published. Open it on the Content page.', { code });
  if (code === 'ladder') return V('queued', 'Via the ladder', 'accent', `Your keyword ladder page${ladderKw ? ` for "${ladderKw}"` : ''} is written to answer it.`, { viaLadder: true, code });
  if (code === 'same_search_page')
    return V('queued', 'Queued', 'accent', `Your page ${path} already owns this search, so we improve it for this question instead of writing a second page.`, { pageUrl, code });
  const refresh = S(t.kind) === 'refresh' && !!pageUrl;
  if (code === 'ai_rank' || S(t.origin) === 'ai_rank')
    return V(
      'queued',
      'Queued',
      'accent',
      refresh ? `Chosen by AI ranking: improving ${path} is the step most likely to get you named here.` : 'Chosen by AI ranking: a page that answers this question is the step most likely to get you named here.',
      { pageUrl: refresh ? pageUrl : '', code },
    );
  if (refresh) return V('queued', 'Queued', 'accent', `We plan to improve ${path} so it answers this question.`, { pageUrl, code });
  return V('queued', 'Queued', 'accent', 'We plan a new answer page for this question in a coming week.', { code });
}

/** Words the client must never read on the AI page (ids, table names, lever ids, money, internal statuses, em dashes). For the tests. */
export const AI_CLIENT_TEXT_BANNED = [/cad_/i, /\bait_/i, /\bapp-\d/i, /seo_[a-z]/i, /\bL\d{2}\b/, /\$/, /—|–/, /…|\.\.\./, /[‘’“”]/, /\bset_aside\b/, /\bcell\(s\)/i, /expected gain/i, /\(25% is the bar\)/];
