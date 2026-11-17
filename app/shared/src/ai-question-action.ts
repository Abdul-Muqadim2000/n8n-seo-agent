// Client report 2026-11-16 (devaicon.com, issue 1, F1 / F2 / F5 / F13): one answer to "write a page for this AI question", for every button
// that offers it (the AI visibility hero's next step, "Questions you lose", "Questions to win", the engine's actions in "What to do next",
// Recommendations and the Pipeline's Write now).
//
// What went wrong: three of those buttons sent the panel TOPIC ("ai automation services") as the page's keyword instead of the question's
// own search ("best ai automation services dubai"). The topic is, by construction, the search of a page the client already has, so the tool
// then treated the answer page as a second version of that service page (and said so on the form). Here:
//   * the keyword is always the question's own search: the stored target's, else the panel question's (seo_ai_prompts.keyword), never the
//     topic unless the question has no search of its own. An older report action that carries the topic is corrected through the stored
//     question (looked up by its id, its target id or its text);
//   * the page type is one the form accepts ("Comparison Page" and a service-page default become "Guide" for an answer page);
//   * the AI target always travels with the run (the brief, the exemption from the score hold, the content log's source);
//   * a question whose page is already written, being written, live or won gets no write button: "Report it published", "See the page" or a
//     sentence instead; a question a page of the website already owns (the same search, the same market) becomes "Improve <page> for this
//     question", never a second page (CONTRACT_ISSUE1.md §4, the engine's rule).
// Pure. Shared by the web page, the server's recommendations and the form notices (aiSearchOwner).

import { PAGE_TYPE_VALUES, type PageType } from './constants';
import { LRU } from './ladder-rules';
import { isoOfCountry, placesIn } from './markets';
import { aiDay, aiPagePath, type AiTargetState } from './ai-target-status';
import type { ContentLogRow, LadderRow } from './tables';

const S = (v: unknown) => (v == null ? '' : String(v));
const low = (v: unknown) => S(v).toLowerCase().replace(/\s+/g, ' ').trim();
/** a question's comparison key: case, spacing and the closing punctuation do not matter */
export const aiQuestionKey = (q: unknown): string => low(q).replace(/[?!.\s]+$/, '');

/** The AI target a page run carries (the keyword form's `aiTarget`, the schema's limits applied). */
export interface AiTargetInput {
  question: string;
  kind: 'answer' | 'refresh';
  targetId: string;
  fanout: string[];
  sources: { url: string; title: string }[];
  competitors: string[];
}

export interface AiPromptLike {
  promptId?: string;
  prompt: string;
  keyword?: string;
  topic?: string;
  kind?: string;
}
/** A stored question to win (AiTargetStat), with the state the server derived (ai-target-status.ts). */
export interface AiTargetForAction {
  targetId: string;
  promptId?: string;
  question: string;
  keyword: string;
  kind: string;
  pageUrl?: string;
  pageType?: string;
  fanout?: readonly string[];
  sources?: readonly { url: string; title: string }[];
  competitors?: readonly string[];
  status?: string;
  state?: AiTargetState;
  /** the page the state is about (the live page, the page to improve) */
  statePageUrl?: string;
  /** the plain sentence of its state (ai-target-status.ts), shown when no page is offered (not for this website, kept out) */
  reason?: string;
  /** the badge of its state ("Answered" when a live page answers it: aiAnsweredView) */
  badge?: string;
  /** when the engine last wrote the row (its weekly settle): a page published after it was not weighed by the engine yet */
  updatedAt?: string;
  /** listed nowhere as a question to win */
  hidden?: boolean;
}
/** A page the website has from us (the content log / ladder pages: PipelineData.written, or the content items). */
export interface AiWrittenPage {
  keyword: string;
  status: string;
  publishedUrl?: string;
  startedAt?: string;
  source?: string;
  /** the AI question the run that wrote it carried (the app's own runs), when known */
  aiTargetId?: string;
  aiQuestion?: string;
  /** the page of a keyword ladder's main keyword (the engine's coversHead rule applies to it) */
  ladderHead?: boolean;
  /** CR17 (Q3): when the page went live (the content log's published_at), '' when unknown */
  publishedAt?: string;
}
export interface AiQuestionInputs {
  prompts?: readonly AiPromptLike[];
  /** the AI report's question grid (the engine adds `keyword` to it) */
  questions?: readonly AiPromptLike[];
  targets?: readonly AiTargetForAction[];
  written?: readonly AiWrittenPage[];
  /** the website's market (a country name or ISO-2), for the same-search check */
  market?: string;
  /** the main keywords of the website's keyword ladders (their pages own every question that carries all their words) */
  ladderHeads?: readonly string[];
  /** CR17 (Q3): when AI answers are next checked for the website (ISO), '' or absent when not known */
  nextAiCheck?: string;
}

/** What the resolver reads from the AI page's data (`GET .../data/ai`), plus the report's own question grid when there is one. */
export function aiQuestionInputsOf(
  d: {
    prompts?: readonly AiPromptLike[];
    report?: { questions?: readonly AiPromptLike[] } | null;
    growth?: { targets?: readonly AiTargetForAction[] } | null;
    pagesWritten?: readonly AiWrittenPage[];
    ladderHeads?: readonly string[];
    nextAiCheck?: string | null;
  } | null | undefined,
  market: string,
  extraQuestions: readonly AiPromptLike[] = [],
): AiQuestionInputs {
  return {
    prompts: d?.prompts ?? [],
    questions: [...extraQuestions, ...(d?.report?.questions ?? [])],
    targets: d?.growth?.targets ?? [],
    written: d?.pagesWritten ?? [],
    market,
    ladderHeads: d?.ladderHeads ?? [],
    nextAiCheck: d?.nextAiCheck ?? '',
  };
}
/** What the button is about: a question (by id or text), a stored target, or a report action's API body. */
export interface AiQuestionRef {
  promptId?: string;
  question?: string;
  targetId?: string;
  /** the question's own search when the caller already has it (a gap row of a newer engine) */
  keyword?: string;
  topic?: string;
  /** the panel question's kind ('compare', ...) */
  kind?: string;
  /** the engine action's run (snake_case, as stored in the report) */
  apiBody?: Record<string, unknown> | null;
  fanout?: readonly string[];
  sources?: readonly unknown[];
  competitors?: readonly string[];
}

export type AiQuestionStep = 'write' | 'improve' | 'publish' | 'open' | 'none';
/** CR17 (Q3): what decided the action, for the form notice and the tests: the stored target, a live page that answers the question
 *  (written for it, or the page that owns its search), the brand question, or nothing yet */
export type AiQuestionBasis = 'target' | 'answered' | 'written_for' | 'owner' | 'pending' | 'brand' | '';
export interface AiQuestionAction {
  step: AiQuestionStep;
  /** the button's label ('' for none) */
  label: string;
  /** one plain sentence when there is no page to write ('' otherwise) */
  note: string;
  question: string;
  /** the question's own search (the page's keyword) */
  keyword: string;
  pageType: PageType;
  existingPageUrl: string;
  /** the page the note is about (live page, page to improve) */
  pageUrl: string;
  targetId: string;
  aiTarget: AiTargetInput | null;
  /** the content log's source for this page */
  source: 'ai_answer' | 'ai_refresh';
  /** the tool form this button opens, with its prefill ('open' and 'none' open no form) */
  run: { mode: 'keyword' | 'published'; prefill: Record<string, unknown> } | null;
  /** CR17 (Q3): what decided it (see AiQuestionBasis) */
  basis: AiQuestionBasis;
  /** CR17 (Q3): when the page in `pageUrl` went live, '' when unknown */
  since: string;
}

// ---------------- the page type the form accepts ----------------

const VALID = new Set<string>(PAGE_TYPE_VALUES);
const BLOG_DIRS = /\/(blog|blogs|insights?|guides?|resources?|news|articles?|learn|knowledge|knowledge-base|faq|faqs)\//i;

/**
 * The form's page type for an AI page (F13). An answer page: a guide (a comparison or "best X" answer, the engine's "Comparison Page", an
 * empty type, and the old "Service Page" default all become "Guide"); a blog post, pillar or local page keeps its type. A refresh keeps the
 * page's own type: a guide or blog address stays a guide, any other page is the service page it is.
 */
export function aiFormPageType(raw: unknown, o: { kind?: string; pageUrl?: string } = {}): PageType {
  const t = S(raw).trim();
  if (o.kind === 'refresh') {
    if (VALID.has(t) && t !== 'Service Page') return t as PageType;
    return BLOG_DIRS.test(S(o.pageUrl)) ? 'Guide' : 'Service Page';
  }
  if (t === 'Blog Post' || t === 'Pillar Page' || t === 'Local Page' || t === 'Guide') return t;
  if (/pillar|hub/i.test(t)) return 'Pillar Page';
  if (/blog/i.test(t)) return 'Blog Post';
  return 'Guide';
}

// ---------------- the AI target, within the schema's limits ----------------

const urlOk = (u: string) => /^https?:\/\/\S+$/i.test(u) && u.length <= 300;
/** Any AI target shape (camelCase, the engine's snake case with { u, t } sources) -> the form's `aiTarget`, or null when it has no question. */
export function aiTargetInput(v: unknown, over: Partial<AiTargetInput> = {}): AiTargetInput | null {
  const t = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const question = S(over.question ?? t.question).replace(/\s+/g, ' ').trim().slice(0, 300);
  if (question.length < 8) return null;
  const list = (x: unknown) => (Array.isArray(x) ? x : typeof x === 'string' ? x.split(/\s*\|\s*/) : []);
  const fanout = (over.fanout ?? list(t.fanout).map((x) => S(x).trim()))
    .filter((x) => x.length >= 1)
    .map((x) => x.slice(0, 200))
    .slice(0, 8);
  const sources = (over.sources ?? list(t.sources).map((x) => {
    const s = (x && typeof x === 'object' ? x : { url: x }) as Record<string, unknown>;
    return { url: S(s.url ?? s.u).trim(), title: S(s.title ?? s.t).trim() };
  }))
    .filter((x) => urlOk(x.url))
    .map((x) => ({ url: x.url, title: x.title.slice(0, 140) }))
    .slice(0, 6);
  const competitors = (over.competitors ?? list(t.competitors).map((x) => S(x).trim()))
    .filter((x) => x.length >= 1)
    .map((x) => x.slice(0, 80))
    .slice(0, 8);
  const kind = (over.kind ?? (S(t.kind) === 'refresh' ? 'refresh' : 'answer')) as AiTargetInput['kind'];
  return { question, kind, targetId: S(over.targetId ?? t.targetId ?? t.target_id).slice(0, 120), fanout, sources, competitors };
}

/** A keyword the form takes: lower case, one space, at most 120 characters (cut at a word). */
export function aiKeyword(v: unknown): string {
  let k = low(v);
  if (k.length > 120) k = k.slice(0, 120).replace(/\s+\S*$/, '');
  return k;
}

// ---------------- one search, one page (the engine's own rule, with the data the app has) ----------------

const pathWords = (u: string) => S(u).replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/[?#].*$/, '').replace(/[-_/.]+/g, ' ');
/** the page names only places outside `iso` while the keyword names none outside it (the engine's DUP.otherMarket) */
function otherMarket(keyword: string, pageText: string, iso: string): boolean {
  if (!iso) return false;
  if (placesIn(keyword).some((p) => !p.iso.includes(iso))) return false;
  const pp = placesIn(pageText);
  return pp.length > 0 && !pp.some((p) => p.iso.includes(iso));
}

/**
 * The LIVE page of the website that already owns this question's search (CONTRACT_ISSUE1.md §4), by the engine's own rule for AI pages
 * (Parse_Verdict.js / Growth_Plan.js, the generated kit `LRU`): the page's keyword IS the question's search (`LRU.sameQuestion`: the
 * question's scaffolding such as "best" and "which" out, plurals folded, places read as their market, "ai" counted), or the page is a keyword
 * ladder's main page and the question carries every word of its main keyword (`LRU.coversHead`). Words of the page's ADDRESS never make an
 * owner (review 2026-11-16 M2: "/services/automation-testing" is not the page for "ai automation services"). A page that names only another
 * market's places ("ai-automation-services-pakistan" for a UAE website) is never the owner. Null when none.
 */
export function aiSearchOwner(keyword: string, pages: readonly AiWrittenPage[], market?: string, ladderHeads: readonly string[] = []): AiWrittenPage | null {
  if (!low(keyword)) return null;
  const iso = isoOfCountry(market) || (/^[A-Za-z]{2}$/.test(S(market)) ? S(market).toUpperCase() : '');
  const heads = new Set(ladderHeads.map((h) => low(h)).filter(Boolean));
  for (const p of pages) {
    const url = S(p.publishedUrl).trim();
    if (!url) continue;
    const head = !!p.ladderHead || heads.has(low(p.keyword));
    if (!(LRU.sameQuestion(keyword, S(p.keyword)) || (head && LRU.coversHead(keyword, S(p.keyword), iso)))) continue;
    if (otherMarket(keyword, `${p.keyword} ${pathWords(url)}`, iso)) continue;
    return p;
  }
  return null;
}

// ---------------- CR17 (client report 2026-11-17, Q3): one page list, one answering page, one sentence ----------------

const urlKeyQ = (u: unknown) => LRU.urlKey(S(u));
type LogLike = Partial<Pick<ContentLogRow, 'keyword' | 'status' | 'published_url' | 'published_at' | 'started_at' | 'source' | 'rung' | 'request_id' | 'ladder_id'>>;
type LadderLike = Partial<Pick<LadderRow, 'keyword' | 'status' | 'target_url' | 'rung' | 'head_keyword' | 'ladder_id'>>;

/**
 * The website's pages for every AI-question decision, built ONCE by the server and handed to the AI visibility page, Recommendations and the
 * write form (CR17 Q3: the AI page read the content log only, the form the content log plus the ladder rows, so the two disagreed):
 *  - every content-log row that wrote or is writing a page (a failed or held row is no page; a `started` row of a failed run, or one older than
 *    `inFlightHours` that never finished, is no page either), with the AI question the app's run carried and the day it went live;
 *  - every ladder row whose page is live or being written, the main page marked (`ladderHead`: the engine's coversHead rule applies to it);
 *  - addresses the client moved with a permanent redirect followed to where the page is now (`moves`).
 * One entry per search and address: a content-log row (it knows dates) wins over the ladder row of the same page.
 */
export function aiQuestionPages(o: {
  logs: readonly LogLike[];
  ladders?: readonly LadderLike[];
  aiRuns?: ReadonlyMap<string, { targetId: string; question: string }>;
  failed?: ReadonlySet<string>;
  moves?: readonly { from: string; to: string }[];
  now?: number;
  inFlightHours?: number;
}): AiWrittenPage[] {
  const now = o.now ?? Date.now();
  const hours = o.inFlightHours ?? 6;
  const moved = new Map<string, string>();
  for (const m of o.moves ?? []) if (urlKeyQ(m.from) && urlKeyQ(m.to) && urlKeyQ(m.from) !== urlKeyQ(m.to)) moved.set(urlKeyQ(m.from), S(m.to));
  const follow = (u: string) => (u && moved.get(urlKeyQ(u))) || u;
  const failed = o.failed ?? new Set<string>();
  const stopped = (l: LogLike) => S(l.status) === 'started' && (failed.has(S(l.request_id)) || !(now - Date.parse(S(l.started_at) || '1970-01-01') < hours * 3600_000));
  const out: AiWrittenPage[] = [];
  const seen = new Set<string>();
  const add = (w: AiWrittenPage) => {
    const k = `${LRU.wordsKey(low(w.keyword))}|${urlKeyQ(w.publishedUrl)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(w);
  };
  for (const l of o.logs) {
    if (!S(l.keyword) || ['failed', 'held', ''].includes(S(l.status)) || stopped(l)) continue;
    const q = o.aiRuns?.get(S(l.request_id));
    add({
      keyword: S(l.keyword), status: S(l.status), publishedUrl: follow(S(l.published_url)), startedAt: S(l.started_at), source: S(l.source),
      ...(S(l.published_at) ? { publishedAt: S(l.published_at) } : {}),
      ...(S(l.source) === 'ladder' && Number(l.rung) === 4 ? { ladderHead: true } : {}),
      ...(q ? { aiTargetId: q.targetId, aiQuestion: q.question } : {}),
    });
  }
  for (const r of o.ladders ?? []) {
    const st = S(r.status);
    if (!S(r.keyword) || !['published', 'writing', 'written', 'not_ready'].includes(st)) continue;
    const url = st === 'published' ? follow(S(r.target_url)) : '';
    // the content log already holds this page (same search, same address, or the same search still on its way)
    if (out.some((w) => LRU.sameSearch(low(w.keyword), low(r.keyword)) && (!url || !S(w.publishedUrl) || urlKeyQ(w.publishedUrl) === urlKeyQ(url)))) continue;
    add({ keyword: S(r.keyword), status: st === 'published' ? 'published' : st === 'writing' ? 'writing' : st, publishedUrl: url, startedAt: '', source: 'ladder', ...(LRU.isHeadRow(r) ? { ladderHead: true } : {}) });
  }
  return out.slice(0, 600);
}

/** The client's own permanent redirects (seo_page_watch rows answering 301 / 308 with a Location on the same website, never to the home page)
 *  as { from, to } with absolute addresses, for aiQuestionPages' `moves`. */
export function aiPermanentMoves(rows: readonly { url?: unknown; status?: unknown; location?: unknown }[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (const r of rows) {
    const from = S(r.url).trim();
    const st = Number(r.status);
    const loc = S(r.location).trim();
    if (!from || !loc || (st !== 301 && st !== 308)) continue;
    const origin = (from.match(/^https?:\/\/[^/?#]+/i) || [''])[0];
    const to = /^https?:\/\//i.test(loc) ? loc : loc.startsWith('/') && origin ? origin + loc : '';
    const host = (u: string) => LRU.urlKey(u).split('/')[0];
    if (!to || host(to) !== host(from) || !LRU.pathOf(to) || LRU.pathOf(to) === LRU.pathOf(from)) continue;
    out.push({ from, to });
  }
  return out;
}

/** When AI answers are next checked (ISO): the day after the last check when the daily check is on, else a week after the last weekly
 *  check, never in the past; '' when the website has never been checked. */
export function aiNextCheck(o: { lastWeekly?: string; lastDaily?: string; daily?: boolean; now?: number }): string {
  const now = o.now ?? Date.now();
  const step = (o.daily ? 1 : 7) * 864e5;
  const last = Math.max(Date.parse(S(o.lastWeekly)) || 0, o.daily ? Date.parse(S(o.lastDaily)) || 0 : 0);
  if (!last) return '';
  let next = last + step;
  if (next < now) next += Math.ceil((now - next) / step) * step;
  return new Date(next).toISOString();
}

const isLivePage = (w: AiWrittenPage) => !!S(w.publishedUrl).trim();
const sameQ = (keyword: string, w: AiWrittenPage) => !!keyword && (LRU.sameQuestion(keyword, S(w.keyword)) || LRU.sameSearch(low(w.keyword), keyword));

/**
 * The LIVE page that answers an AI question now, by one rule for every screen: (1) a page written FOR this question that is its own search,
 * (2) the page that owns the question's search (the engine's rule: the same search, or a keyword ladder's main page it fully covers, in the
 * website's market: aiSearchOwner), (3) a page written for this question under another search (the weekly pages put its section on a ladder
 * page: that page was meant to answer it, Q2). Null when no live page answers it.
 */
export function aiAnswerPage(
  ref: { targetId?: string; question?: string; keyword: string },
  pages: readonly AiWrittenPage[],
  market?: string,
  ladderHeads: readonly string[] = [],
): { page: AiWrittenPage; how: 'written_for' | 'owner' } | null {
  const q = aiQuestionKey(ref.question);
  const kw = low(ref.keyword);
  const live = pages.filter(isLivePage);
  const mine = live.filter((w) => forQuestion(w, S(ref.targetId), q, kw)).sort((a, b) => S(b.publishedAt || b.startedAt).localeCompare(S(a.publishedAt || a.startedAt)));
  const own = mine.find((w) => sameQ(kw, w));
  if (own) return { page: own, how: 'written_for' };
  const owner = aiSearchOwner(kw, live, market, ladderHeads);
  if (owner) return { page: owner, how: 'owner' };
  return mine[0] ? { page: mine[0], how: 'written_for' } : null;
}

/** "Answered by /services/x, live since 13 Nov 2026. The next AI check is on 18 Nov 2026; AI answers usually take a few weeks to change." */
export function aiAnsweredSentence(url: string, since?: string, nextCheck?: string): string {
  const day = aiDay(S(since));
  const next = aiDay(S(nextCheck));
  return `Answered by ${aiPagePath(url)}${day ? `, live since ${day}` : ''}. ${next ? `The next AI check is on ${next}; AI answers usually take a few weeks to change.` : 'AI answers usually take a few weeks to change.'}`;
}

/** states the engine may have decided before a page went live: a live page that answers the question since then overrides them */
const OVERRIDABLE = new Set<AiTargetState | ''>(['queued', 'later', 'retry']);

/**
 * CR17 (Q3): a stored question to win whose decision a live page has overtaken. The engine re-judges its targets once a week (and, since
 * CR17, when a page is published), so between two settles a target can still say "we plan a new page" for a question a page answers now
 * (devaicon.com's question 37: settled on 13 Nov at 01:23, its ladder's main page live at 09:30 the same day). A target that is queued, later
 * or to be retried, with a live page that answers it -> "Answered by <page>, live since <day>": always for a page written for the question,
 * and for the page that owns its search only when that page went live after the engine's last settle (a page the engine already weighed
 * keeps the engine's decision, review 2026-11-16 M2). Null when the stored state stands. Used by the server for the badge and by the
 * resolver for the button, so the two never name two different pages.
 */
export function aiAnsweredView(
  t: Pick<AiTargetForAction, 'targetId' | 'question' | 'keyword' | 'state' | 'updatedAt' | 'hidden'>,
  inputs: Pick<AiQuestionInputs, 'written' | 'market' | 'ladderHeads' | 'nextAiCheck'>,
): { state: 'live'; badge: string; tone: 'good'; sentence: string; pageUrl: string; date: string; how: 'written_for' | 'owner' } | null {
  if (!OVERRIDABLE.has(t.state ?? '') || t.hidden) return null;
  const a = aiAnswerPage({ targetId: t.targetId, question: t.question, keyword: S(t.keyword) || t.question }, inputs.written ?? [], inputs.market, inputs.ladderHeads ?? []);
  if (!a) return null;
  if (a.how === 'owner') {
    const pub = Date.parse(S(a.page.publishedAt));
    const settled = Date.parse(S(t.updatedAt));
    if (!Number.isFinite(pub) || !Number.isFinite(settled) || pub <= settled) return null;
  }
  const url = S(a.page.publishedUrl);
  return { state: 'live', badge: 'Answered', tone: 'good', sentence: aiAnsweredSentence(url, a.page.publishedAt, inputs.nextAiCheck), pageUrl: url, date: S(a.page.publishedAt), how: a.how };
}

// ---------------- the resolver ----------------

const pick = <T extends { promptId?: string; prompt?: string; question?: string }>(list: readonly T[] | undefined, id: string, q: string): T | undefined =>
  (list ?? []).find((x) => (id && x.promptId === id) || (!!q && aiQuestionKey(x.prompt ?? x.question) === q));

/** Was this page written for this very question (the run carried its target, or its question, or it is an AI page of the same search)? */
const forQuestion = (w: AiWrittenPage, targetId: string, q: string, keyword: string) =>
  (!!targetId && w.aiTargetId === targetId) || (!!q && !!w.aiQuestion && aiQuestionKey(w.aiQuestion) === q) || (/^ai_/.test(S(w.source)) && !!keyword && LRU.sameSearch(low(w.keyword), keyword));
const isLive = (w: AiWrittenPage) => S(w.status) === 'published' || !!S(w.publishedUrl).trim();

export function aiQuestionAction(ref: AiQuestionRef, inputs: AiQuestionInputs = {}): AiQuestionAction {
  const body = (ref.apiBody ?? {}) as Record<string, unknown>;
  const bodyTarget = (body.ai_target ?? body.aiTarget ?? null) as Record<string, unknown> | null;
  const question0 = S(ref.question || bodyTarget?.question).replace(/\s+/g, ' ').trim();
  const qKey = aiQuestionKey(question0);
  const targetId0 = S(ref.targetId || bodyTarget?.target_id || bodyTarget?.targetId);
  const target =
    (inputs.targets ?? []).find((t) => targetId0 && t.targetId === targetId0) ??
    (inputs.targets ?? []).find((t) => (ref.promptId && t.promptId === ref.promptId) || (!!qKey && aiQuestionKey(t.question) === qKey));
  const promptId = S(ref.promptId || target?.promptId);
  const prompt = pick(inputs.prompts, promptId, qKey || aiQuestionKey(target?.question));
  const asked = pick(inputs.questions, promptId, qKey || aiQuestionKey(target?.question));
  const question = question0 || S(target?.question) || S(prompt?.prompt) || S(asked?.prompt);
  const q = aiQuestionKey(question);
  const topic = low(ref.topic || asked?.topic || prompt?.topic);
  // the question's own search; an older action's keyword is used only when it is not the panel topic (F1)
  const bodyKw = low(body.keyword);
  const keyword = aiKeyword(S(target?.keyword) || S(ref.keyword) || S(prompt?.keyword) || S(asked?.keyword) || (bodyKw && bodyKw !== topic ? bodyKw : '') || topic || bodyKw || question);
  const targetId = S(target?.targetId || targetId0);
  const kindQ = low(ref.kind || asked?.kind || prompt?.kind);

  // the target says refresh (a page of the website answers it), or the engine's action names a page to improve
  const bodyPage = S(body.existing_page_url ?? body.existingPageUrl).trim();
  let refreshUrl = S(target?.kind) === 'refresh' && S(target?.pageUrl) ? S(target?.pageUrl) : bodyPage;

  const out = (step: AiQuestionStep, o: { note?: string; pageUrl?: string; refresh?: string; basis?: AiQuestionBasis; since?: string } = {}): AiQuestionAction => {
    const existing = step === 'improve' ? (o.refresh ?? refreshUrl) : '';
    const kind: AiTargetInput['kind'] = existing ? 'refresh' : 'answer';
    const pageType = aiFormPageType(existing ? (target?.kind === 'refresh' ? target?.pageType : '') : S(target?.pageType) || S(body.page_type) || (kindQ === 'compare' ? 'Comparison Page' : ''), { kind, pageUrl: existing });
    const aiTarget = aiTargetInput(target ?? bodyTarget ?? {}, {
      question,
      kind,
      targetId,
      ...(target?.fanout?.length ? {} : ref.fanout?.length ? { fanout: [...ref.fanout] } : {}),
      ...(target?.competitors?.length || (bodyTarget && Array.isArray(bodyTarget.competitors)) ? {} : ref.competitors?.length ? { competitors: [...ref.competitors] } : {}),
    });
    const source = kind === 'refresh' ? 'ai_refresh' : 'ai_answer';
    const pageUrl = o.pageUrl ?? existing;
    let run: AiQuestionAction['run'] = null;
    if ((step === 'write' || step === 'improve') && keyword)
      run = {
        mode: 'keyword',
        prefill: { keyword, pageType, ...(existing ? { existingPageUrl: existing } : {}), receiveReport: true, receiveContent: true, ...(aiTarget ? { aiTarget } : {}) },
      };
    if (step === 'publish' && keyword) run = { mode: 'published', prefill: { keyword } };
    const label = step === 'write' ? 'Write the page' : step === 'improve' ? 'Improve the page' : step === 'publish' ? 'Report it published' : step === 'open' ? 'See the page' : '';
    return { step, label, note: o.note ?? '', question, keyword, pageType, existingPageUrl: existing, pageUrl, targetId, aiTarget, source, run, basis: o.basis ?? '', since: o.since ?? '' };
  };

  // 0. CR17 (Q3): the question that asks for the business by name is answered by the website itself (its home and About pages): never
  // "Write the page" (the engine never plans one for it either)
  if (kindQ === 'brand') return out('none', { note: 'This question asks about your business by name. Your home page and About page answer it, so no new page is written for it.', basis: 'brand' });

  // 1. what the system already did for this question (the stored target's derived state), unless a live page answers it since the engine
  // last weighed it (CR17 Q3, aiAnsweredView: the same rule the server applies to the badge)
  const answered = target ? aiAnsweredView(target, inputs) : null;
  const st = answered ? 'live' : target?.state ?? '';
  const stUrl = answered ? answered.pageUrl : S(target?.statePageUrl || target?.pageUrl);
  if (st === 'won') return out('none', { note: 'AI now names you for this question.', basis: 'target' });
  if (st === 'named') return out('none', { note: 'AI already names you for this question.', basis: 'target' });
  if (st === 'live') {
    const page = (inputs.written ?? []).find((w) => urlKeyQ(w.publishedUrl) === urlKeyQ(stUrl));
    const since = answered?.date || S(page?.publishedAt);
    const note = answered ? answered.sentence : S(target?.badge) === 'Answered' && S(target?.reason) ? S(target?.reason) : `Your page ${aiPagePath(stUrl)} answers this question. AI answers usually take a few weeks to change.`;
    return out('open', { note, pageUrl: stUrl, basis: answered || S(target?.badge) === 'Answered' ? 'answered' : 'target', since });
  }
  // CR17 (Q3): "Covered" is a page that already answers the question and is up to date: the page, never "Improve the page" beside it
  if (st === 'covered') return out(stUrl ? 'open' : 'none', { note: S(target?.reason) || `Your page ${aiPagePath(stUrl)} already answers it and is up to date.`, pageUrl: stUrl, basis: 'target' });
  // "Later" means not this week: its plain reason, no button that contradicts it
  if (st === 'later') return out('none', { note: S(target?.reason) || 'Other questions are worth more this week. It is checked again next week.', basis: 'target' });
  if (st === 'writing') return out('none', { note: 'The page for this question is being written.', basis: 'target' });
  if (st === 'written' || st === 'needs_fix') return out('publish', { note: st === 'needs_fix' ? 'The page for this question is written but needs a fix before it can be published.' : 'The page for this question is written and waiting to be published.' });
  if (st === 'held') return out('none', { note: 'The page for this question waits for your OK. Open its report to decide.', basis: 'target' });
  // review 2026-11-16 L4: a question this website does not target, or one the client kept out, gets no page (the plain reason instead)
  if (st === 'not_for_site') return out('none', { note: S(target?.reason) || 'This question is not about what you sell, so no page is written for it.' });
  if (st === 'kept_out') return out('none', { note: S(target?.reason) || 'You chose not to write a page for it.' });

  // 2. a page written for this very question (by any run: the app's, the weekly pages, an older engine)
  const written = inputs.written ?? [];
  const own = written.filter((w) => forQuestion(w, targetId, q, keyword)).sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || S(b.startedAt).localeCompare(S(a.startedAt)))[0];
  if (own) {
    if (isLive(own)) {
      // CR17 (Q3): the one answering page (a page written for the question under another search yields to the page that owns its search)
      const a = aiAnswerPage({ targetId, question, keyword }, written, inputs.market, inputs.ladderHeads ?? []) ?? { page: own, how: 'written_for' as const };
      const url = S(a.page.publishedUrl) || S(own.publishedUrl);
      return out('open', { note: aiAnsweredSentence(url, a.page.publishedAt, inputs.nextAiCheck), pageUrl: url, basis: a.how, since: S(a.page.publishedAt) });
    }
    if (S(own.status) === 'writing' || (S(own.status) === 'started' && Date.now() - Date.parse(S(own.startedAt) || '1970-01-01') < 864e5))
      return out('none', { note: 'The page for this question is being written.' });
    if (S(own.status) === 'not_ready') return out('publish', { note: 'The page for this question is written but needs a fix before it can be published.' });
    if (S(own.status) === 'started') return out('write');   // a run that started more than a day ago and never wrote a page
    return out('publish', { note: 'The page for this question is written and waiting to be published.' });
  }

  // 3. a planned refresh of a page of the website
  if (refreshUrl) return out('improve', { note: `We improve ${aiPagePath(refreshUrl)} so it answers this question.`, basis: target ? 'target' : '' });

  // 4. a live page of the website already owns the question's own search (same market): improve it, never a second page. The engine's
  // stored decision comes first (review M2): a question AI Growth already planned (a stored target, "new page" or "improve") is never re-judged here
  const owner = target ? null : aiSearchOwner(keyword, written, inputs.market, inputs.ladderHeads);
  if (owner) {
    refreshUrl = S(owner.publishedUrl);
    return out('improve', { note: `Your page ${aiPagePath(refreshUrl)} is already the page for this search. Improve it so it answers this question.`, refresh: refreshUrl, basis: 'owner', since: S(owner.publishedAt) });
  }
  // 5. a page for the same search is being written or waits to be published: no second page
  // (a `started` row older than a day is a run that stopped without a page, never a page on its way)
  const stale = (w: AiWrittenPage) => S(w.status) === 'started' && Date.now() - Date.parse(S(w.startedAt) || '1970-01-01') >= 864e5;
  const pending = written.find((w) => !isLive(w) && !stale(w) && keyword && LRU.sameSearch(low(w.keyword), keyword));
  if (pending) return out('none', { note: `A page for "${pending.keyword}" is already written or being written. Publish it first, then improve it for this question.`, basis: 'pending' });
  return out('write', { basis: target ? 'target' : '' });
}
