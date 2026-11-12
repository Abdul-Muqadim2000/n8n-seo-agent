// Client reports 2026-11-11 (devaicon.com: "I published the pages after fixing every issue the tool listed, but the card still shows the
// old score of the page instead of the updated one"). The grade on the Content card was the grade of the version WE delivered; the client
// rewrote the page before publishing it and nothing ever graded the page that is live. The engine's Page Finalize webhook grades a live page
// (build section 185): the usual finalize body of the page's newest version (final version if there is one, else the delivered one) with no
// answers, plus `grade_only: true` and `grade_live: { url, h1, title }`. It reads the live page itself, grades that text with the rules of a
// final version, never calls the editor (no cost) and answers the usual FinalizeResult plus `live_read: { ok, url, title, words }`; a page
// it cannot read is a 400 whose error starts "grade_live:". The app stores the grade on the page's review row (page_reviews.live_grade,
// live_graded_at) from a background job (server/src/services/liveGrade.ts) and the Content card shows it as the page's grade.
// This module is the contract between the job, the board and the card. Pure: no I/O, no clock unless passed.

import { normKeyword } from './pipeline-notices';
import { finalizeBody, plainWords, type DuplicateDecision, type FactAnswers, type FinalizeBody, type PageDeliveryStatus } from './page-review';

type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** How the grade of a live page is stored (page_reviews.live_grade). */
export interface PageLiveGrade {
  /** 0-100; null only when no live grade was ever made (a row that holds only a failed read) */
  score: number | null;
  status: PageDeliveryStatus | '';
  /** the engine's headline for the status, in plain words */
  label: string;
  /** what still stops the live page from being ready, in plain words (at most 10) */
  blocking: { code: string; text: string }[];
  advisory_count: number;
  /** the live address the engine read, its title and length */
  url: string;
  title: string;
  words: number;
  /** the publish check (report of stage `published`) this grade belongs to */
  published_report_id: string;
  /** when this grade was made ('' when there is none yet) */
  checked_at: string;
  /** the newest attempt could not read the live page; the grade above, if any, is from before it */
  read_failed?: { at: string; published_report_id: string; error: string; attempts?: number } | null;
}

/** Review M1 (2026-11-11): a failed read is tried again, at most LIVE_READ_ATTEMPTS times for one publish check, LIVE_READ_RETRY_MS apart (a
 *  page-reader outage must not leave every page "could not read" until the client re-checks); a refusal of the address itself is final. */
export const LIVE_READ_ATTEMPTS = 3;
export const LIVE_READ_RETRY_MS = 12 * 3_600_000;
export function liveReadSettled(g: PageLiveGrade | null | undefined, checkId: string): boolean {
  const rf = g?.read_failed; if (!rf || rf.published_report_id !== checkId) return true;
  return (rf.attempts ?? 1) >= LIVE_READ_ATTEMPTS || /must be a page of/i.test(rf.error || '');
}
/** A failed read of this check that may be tried again, but not yet (pure). */
export function liveReadWaiting(g: PageLiveGrade | null | undefined, checkId: string, now: number): boolean {
  const rf = g?.read_failed; if (!rf || rf.published_report_id !== checkId || liveReadSettled(g, checkId)) return false;
  const at = Date.parse(rf.at); return Number.isFinite(at) && now - at < LIVE_READ_RETRY_MS;
}

/** The live grade as the screens see it (PageReviewSummary.liveGrade). */
export interface PageLiveGradeView {
  score: number | null;
  status: PageDeliveryStatus | '';
  label: string;
  blocking: { code: string; text: string }[];
  advisoryCount: number;
  url: string;
  publishedReportId: string;
  /** when the grade shown was made (null: no grade yet, only a failed read) */
  checkedAt: string | null;
  /** the time of the publish check the newest attempt (graded or failed) covers: page_reviews.live_graded_at */
  attemptedAt: string | null;
  /** the newest attempt could not read the live page */
  readFailed: { at: string; publishedReportId: string; error: string } | null;
}

export const LIVE_GRADE_STATUS_LABEL: Record<PageDeliveryStatus, string> = {
  ready: 'ready to publish',
  ready_with_questions: 'ready to publish',
  needs_work: 'needs work',
  not_ready: 'not ready',
  unknown: '',
};

/** One publish check as the board and the job read it (the `published` report of "I published a page" / Re-check page). */
export interface LiveGradeCheck {
  id: string;
  receivedAt: string;
  keyword: string;
  /** the content run the check was for (`content_request_id`) */
  requestId: string;
  url: string;
  /** false: the check could not open the live page */
  live: boolean;
  /** the check marked the page published (false: it was refused, e.g. another page than the one written) */
  recorded?: boolean;
  /** the live page's main heading and title as the check read them (verify_evidence), decoded */
  h1?: string;
  title?: string;
}

/** HTML entities in a heading or title as the check stored it ("Application &amp; Software" -> "Application & Software"). */
export function decodeEntities(t: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...' };
  return s(t)
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Math.min(Number(d), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, n: string) => named[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The publish check a live page is graded from: the newest check of the page (by the content run's request id, else by its keyword) that
 * opened the live page and marked it published. Null when there is none. `checks` in any order.
 */
export function liveGradeTarget(page: { requestIds: readonly string[]; keyword: string }, checks: readonly LiveGradeCheck[]): LiveGradeCheck | null {
  const ids = new Set(page.requestIds.map((x) => s(x).trim()).filter(Boolean));
  const kw = normKeyword(s(page.keyword));
  const mine = checks.filter((c) => c.live && c.recorded === true && /^https?:\/\//i.test(c.url) && ((c.requestId && ids.has(c.requestId.trim())) || (kw && normKeyword(c.keyword) === kw)));
  return mine.sort((a, b) => s(b.receivedAt).localeCompare(s(a.receivedAt)))[0] ?? null;
}

/** Whether the page waits for a live grade: a publish check newer than the newest attempt (or none yet). */
export function liveGradePending(attemptedAt: string | Date | null | undefined, target: Pick<LiveGradeCheck, 'receivedAt'> | null): boolean {
  if (!target) return false;
  if (!attemptedAt) return true;
  const a = new Date(attemptedAt).getTime();
  const t = new Date(target.receivedAt).getTime();
  return !Number.isFinite(a) || (Number.isFinite(t) && t > a);
}

/** The request the engine grades a live page from: the finalize body of the page's newest version with no answers, plus the live address. */
export interface LiveGradeBody extends FinalizeBody {
  grade_only: true;
  grade_live: { url: string; h1: string; title: string };
}

export function liveGradeBody(o: {
  requestId: string;
  domain: string;
  siteId: string;
  /** the newest version's payload (the final version when there is one, else the delivered page) */
  payload: P;
  /** the delivered page's payload (its page-run context travels to every grade) */
  original: P;
  businessFacts: string;
  facts: FactAnswers;
  duplicateDecision?: DuplicateDecision | null;
  check: Pick<LiveGradeCheck, 'url' | 'h1' | 'title'>;
}): LiveGradeBody {
  const p = o.payload ?? {};
  return {
    ...finalizeBody({
      requestId: o.requestId,
      domain: o.domain,
      siteId: o.siteId,
      payload: p,
      markdown: s(p.markdown),
      clientEdited: false,
      questions: [],
      answers: {},
      businessFacts: o.businessFacts,
      facts: o.facts,
      original: o.original,
      duplicateDecision: o.duplicateDecision ?? null,
    }),
    grade_only: true,
    grade_live: { url: o.check.url, h1: decodeEntities(s(o.check.h1)).slice(0, 300), title: decodeEntities(s(o.check.title)).slice(0, 300) },
  };
}

const items = (v: unknown, max: number) =>
  arr(v)
    .map(obj)
    .map((x) => ({ code: s(x.code).slice(0, 60), text: plainWords(s(x.text)).replace(/\s+/g, ' ').slice(0, 400) }))
    .filter((x) => x.text)
    .slice(0, max);

/**
 * The engine's answer to a live-grade request (pure): a grade to store, a live page it could not read (400 "grade_live: ..."), or nothing
 * to store (`skip`: the engine was not reachable, timed out, or does not grade live pages yet; `pause` = stop asking for a while).
 */
export type LiveGradeOutcome =
  | { kind: 'graded'; grade: Omit<PageLiveGrade, 'published_report_id' | 'checked_at' | 'read_failed'> }
  | { kind: 'read_failed'; error: string }
  | { kind: 'skip'; pause: 'page' | 'engine'; why: string };

export function interpretLiveGrade(res: { kind: 'answered' | 'unreachable' | 'timeout'; status: number; json: P }): LiveGradeOutcome {
  if (res.kind !== 'answered') return { kind: 'skip', pause: 'page', why: res.kind === 'timeout' ? 'the engine took too long' : 'the engine is not reachable' };
  const j = res.json ?? {};
  const err = s(j.error);
  if (res.status === 400 && /grade_live:/i.test(err)) {
    const why = err.slice(err.toLowerCase().indexOf('grade_live:') + 'grade_live:'.length).split(/;\s+/)[0]!.trim();
    return { kind: 'read_failed', error: plainWords(why).slice(0, 240) || 'the live page could not be read' };
  }
  if (res.status === 404) return { kind: 'skip', pause: 'engine', why: 'the engine has no page finalize webhook' };
  if (res.status === 400) return { kind: 'skip', pause: 'page', why: `the engine refused the request (${err.slice(0, 200)})` };
  if (res.status !== 200) return { kind: 'skip', pause: 'page', why: `the engine answered ${res.status}` };
  const read = obj(j.live_read);
  // an engine from before live grading makes a normal final version of the Markdown sent: never stored as the live page's grade
  if (read.ok !== true || j.grade_only !== true) return { kind: 'skip', pause: 'engine', why: 'the engine does not grade live pages yet' };
  const delivery = obj(j.delivery);
  const grade = obj(j.grade ?? delivery.grade);
  const score = num(grade.score) ?? num(j.content_score);
  const raw = s(j.delivery_status) || s(delivery.status);
  const status = (['ready', 'ready_with_questions', 'needs_work', 'not_ready'].includes(raw) ? raw : 'unknown') as PageDeliveryStatus;
  if (score == null) return { kind: 'skip', pause: 'page', why: 'the engine answered without a grade' };
  return {
    kind: 'graded',
    grade: {
      score: Math.max(0, Math.min(100, Math.round(score))),
      status,
      label: plainWords(s(delivery.label)).slice(0, 160),
      blocking: items(delivery.blocking, 10),
      advisory_count: arr(delivery.advisory).length,
      url: s(read.url),
      title: decodeEntities(s(read.title)).slice(0, 300),
      words: Math.max(0, Math.round(num(read.words) ?? 0)),
    },
  };
}

/** What is stored after an attempt (pure): a new grade replaces the old one; a failed read keeps the old grade and says so. */
export function nextLiveGrade(prev: PageLiveGrade | null | undefined, outcome: Extract<LiveGradeOutcome, { kind: 'graded' | 'read_failed' }>, ctx: { publishedReportId: string; url: string; at: string }): PageLiveGrade {
  if (outcome.kind === 'graded') return { ...outcome.grade, url: outcome.grade.url || ctx.url, published_report_id: ctx.publishedReportId, checked_at: ctx.at, read_failed: null };
  const base: PageLiveGrade = prev && prev.score != null
    ? prev
    : { score: null, status: '', label: '', blocking: [], advisory_count: 0, url: ctx.url, title: '', words: 0, published_report_id: ctx.publishedReportId, checked_at: '' };
  const attempts = (prev?.read_failed && prev.read_failed.published_report_id === ctx.publishedReportId ? (prev.read_failed.attempts ?? 1) : 0) + 1;
  return { ...base, read_failed: { at: ctx.at, published_report_id: ctx.publishedReportId, error: outcome.error, attempts } };
}

/** The stored grade as the screens see it. */
export function liveGradeView(g: PageLiveGrade | null | undefined, attemptedAt: Date | string | null | undefined): PageLiveGradeView | null {
  if (!g || typeof g !== 'object') return null;
  const at = attemptedAt ? new Date(attemptedAt).toISOString() : null;
  const rf = g.read_failed && typeof g.read_failed === 'object' ? g.read_failed : null;
  return {
    score: num(g.score),
    status: (s(g.status) as PageDeliveryStatus) || '',
    label: s(g.label),
    blocking: Array.isArray(g.blocking) ? g.blocking.slice(0, 10).map((b) => ({ code: s(b?.code), text: s(b?.text) })) : [],
    advisoryCount: num(g.advisory_count) ?? 0,
    url: s(g.url),
    publishedReportId: s(g.published_report_id),
    checkedAt: s(g.checked_at) || null,
    attemptedAt: at,
    readFailed: rf ? { at: s(rf.at), publishedReportId: s(rf.published_report_id), error: s(rf.error) } : null,
  };
}
