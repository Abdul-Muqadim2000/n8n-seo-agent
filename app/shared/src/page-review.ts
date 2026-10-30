// Page review (H3, 2026-10-28, docs/content-quality-2026-10-27): what the client does with a written page after the engine delivered it.
// The engine (H1, v5/code/_page_fix.js PF.deliver / PF.questions) says, for the page it delivers: ready | ready_with_questions | not_ready,
// the grade OF THE DELIVERED PAGE, and every client question (one per statement nothing on file supports, plus what would make the page
// stronger), ranked by impact, prefilled where the client's own pages say something close. Owner decisions (final, 2026-10-28):
//   - no cap on questions; ranked; the top 3 highlighted, the rest optional; unanswered never blocks;
//   - a statement nothing supports is asked as Yes (keep the specific sentence) / Edit it / Remove it; until then the page keeps the
//     neutral wording; "Leave it general" keeps the neutral wording and is recorded, so it is never asked again;
//   - answers are saved ONCE to the website's business details (keyed by fact_key) and reused: later pages never ask a stored fact;
//   - after answering, "Make the final version" rewrites only the affected sections (engine mode `finalize`, a small charged run);
//   - the client may also edit the page in the app (sanitised; compared with the delivered version; the final check runs on it);
//   - one-click approve, then publish (CMS or "I published it", with the live check).
// This module is the one contract between the engine's callback, the server and the screens. Pure: no I/O, no clock unless passed.

import { cleanMetaDescription, usableMetaDescription } from './meta-description';

type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Customer wording: no em / en dashes, curly quotes or the ellipsis character (owner rule, 2026-10-19). */
export const plainWords = (t: string): string =>
  s(t)
    .replace(/\s*[\u2014\u2013]\s*/g, ': ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/:\s*:/g, ':')
    .trim();

// ---------------------------------------------------------------------------------------------------------------------------------
// 1. The delivered status
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * W0-C (2026-10-29, page-quality PLAN Fix 3): `needs_work` = no blocking point, but a part of the grade (structure, coverage, readability,
 * specificity, plain language, sources, fit with the search) is under half its points. Never "Ready to publish"; nothing stops the client
 * from approving and publishing it (only `not_ready` does).
 */
export type PageDeliveryStatus = 'ready' | 'ready_with_questions' | 'needs_work' | 'not_ready' | 'unknown';
const DELIVERY_STATUSES: readonly string[] = ['ready', 'ready_with_questions', 'needs_work', 'not_ready'];
/** A delivered status a client may approve and publish (no blocking point). */
export const publishableStatus = (st: PageDeliveryStatus): boolean => st === 'ready' || st === 'ready_with_questions' || st === 'needs_work';
/** W0-C: the grade as shown: "95+" from 95 (we never claim a perfect page), the number below it. */
export function gradeDisplay(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '';
  const n = Math.round(score);
  return n >= 95 ? '95+' : String(n);
}
export interface PageDeliveryItem {
  code: string;
  text: string;
  /** what the client does about it (blocking items) */
  action?: string;
}
export interface PageDelivery {
  status: PageDeliveryStatus;
  /** the headline in plain words ("Ready to publish, waiting for your OK", ...) */
  headline: string;
  /** one sentence under it: what we did, what the client does */
  detail: string;
  /** the content grade of the DELIVERED page (0-100), never the first draft's */
  grade: number | null;
  /** W0-C: the grade as shown ("95+" from 95; '' when there is none) */
  gradeLabel: string;
  /** W0-C: the parts under half their points (status `needs_work`), each with what to do; [] otherwise */
  needsWork: PageDeliveryItem[];
  /** the reviewer's score of the first draft, kept apart (it does not describe the delivered page) */
  firstDraftReview: number | null;
  blocking: PageDeliveryItem[];
  advisory: PageDeliveryItem[];
  questionCount: number;
  /** the engine's next step for a not-ready page ('' otherwise) */
  nextStep: string;
  /** which draft the client received ("copywriter draft", "edit 2", "final version") */
  deliveredFrom: string;
}

/** What we do and what the client does about a blocking item, by the engine's code (PF.ACTION). */
const WE_DO: Record<string, string> = {
  cut_off: 'We keep the complete draft whenever there is one; this time there was none.',
  copied: 'We rewrote what we could; some passages still repeat another page.',
  duplicate_page: 'We kept the text as it is.',
  brand: 'We corrected the forms we know; one is still unclear.',
  author_profile: 'We left the author box empty rather than invent it.',
  weak_figure: 'We asked for the sentence to be rewritten without the number; this one is still there.',
  review: 'A second read of the finished page quoted these words; we did not change them on our own.',
};
const YOU_DO: Record<string, string> = {
  cut_off: 'Ask us to write the page again: a new run is needed.',
  copied: 'Rewrite the passages listed below in your own words, in the editor here.',
  duplicate_page: 'Publish it as an update of your existing page for this search, or tell us how the new page differs.',
  brand: 'Write the business name the way you write it, in the editor here.',
  author_profile: "Add the author's name, job title and a short bio once in Website settings > Business details.",
  claim: 'Answer the question about it below, or remove the sentence in the editor.',
  figure: 'Take out the figure in the editor, or cite the page that states it.',
  statistic: 'Take out the number in the editor, or cite the page that states it.',
  bracket: 'Fill in or delete the bracket in the editor.',
  dead_link: 'Replace or remove the link in the editor.',
  off_topic: 'Delete the section in the editor.',
  guarantee: 'Delete the guarantee in the editor.',
  testimonial: 'Delete the testimonial in the editor.',
  weak_figure: 'Rewrite the sentence without the number in the editor, or cite an official body, a research house or major press that states it.',
  review: 'Check the quoted words against a source you trust, then correct or remove them in the editor.',
};

export function deliveryHeadline(status: PageDeliveryStatus, questions: number, firstBlocking?: PageDeliveryItem | null, needsWork?: PageDeliveryItem[]): { headline: string; detail: string } {
  const qs = `${questions} ${questions === 1 ? 'question' : 'questions'}`;
  if (status === 'needs_work') {
    const parts = (needsWork ?? []).map((x) => x.text.replace(/ scored .*$/, '').toLowerCase()).filter(Boolean);
    return {
      headline: `Needs work${parts.length ? `: ${parts.join(', ')}` : ''}`,
      detail: 'Nothing stops you publishing it, but part of the page scored under half marks. Improve it in the editor and make the final version, or approve it as it is.',
    };
  }
  if (status === 'ready')
    return { headline: 'Ready to publish, waiting for your OK', detail: 'Every check passed on the page you receive. Read it, change anything you like, then approve it.' };
  if (status === 'ready_with_questions')
    return {
      headline: `Ready, and stronger with your input (${qs})`,
      detail: 'You can publish it as it is: where we could not check a detail, the page says it in general words. Your answers make it more specific.',
    };
  if (status === 'not_ready') {
    const b = firstBlocking;
    const reason = b ? plainWords(b.text).replace(/\.$/, '') : 'a problem the checks could not fix';
    const we = b ? WE_DO[b.code] ?? 'We fixed everything we could on our own.' : 'We fixed everything we could on our own.';
    const you = b ? YOU_DO[b.code] ?? plainWords(b.action ?? '') : '';
    return { headline: `Not ready: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`, detail: [we, you ? `What you do: ${you.replace(/^./, (c) => c.toLowerCase())}` : ''].filter(Boolean).join(' ') };
  }
  return { headline: 'Written. The quality check result is not available for this page', detail: 'Read it before you publish it.' };
}

const items = (v: unknown): PageDeliveryItem[] =>
  arr(v)
    .map((x) => (typeof x === 'string' ? { code: 'other', text: x } : obj(x)))
    .map((x) => ({ code: s(x.code) || 'other', text: plainWords(s(x.text)), ...(s(x.action) ? { action: plainWords(s(x.action)) } : {}) }))
    .filter((x) => x.text);

/** W0-C: the parts of the grade under half their points (the engine's grade.floors.failing), each with what to do. */
export function needsWorkOf(grade: unknown): PageDeliveryItem[] {
  const fl = obj(obj(grade).floors);
  return arr(fl.failing)
    .map(obj)
    .map((x) => {
      const label = plainWords(s(x.label) || s(x.dim).replace(/_/g, ' '));
      const pts = num(x.points), max = num(x.max);
      const text = label ? `${label.charAt(0).toUpperCase()}${label.slice(1)} scored ${pts ?? 0} of ${max ?? 0}, under half its points` : '';
      return { code: 'needs_work', text, ...(s(x.fix) ? { action: plainWords(s(x.fix)) } : {}) };
    })
    .filter((x) => x.text)
    .slice(0, 7);
}

/** The delivered status of a page report (the content callback), with fallbacks for reports written before H1. */
export function deliveryOf(payload: P | null | undefined): PageDelivery {
  const p = payload ?? {};
  const meta = obj(p.meta);
  const quality = obj(p.qa_quality ?? meta.quality);
  const del = obj(quality.delivery ?? obj(p.content_qa).delivery);
  const raw = s(p.qa_delivery_status) || s(meta.delivery_status) || s(quality.delivery_status) || s(del.status);
  const questions = questionsOf(p);
  let status: PageDeliveryStatus =
    DELIVERY_STATUSES.includes(raw)
      ? (raw as PageDeliveryStatus)
      : p.qa_not_ready === true || quality.not_ready === true
        ? 'not_ready'
        : p.qa_publishable === true || meta.publishable === true || quality.publishable === true
          ? 'ready'
          : 'unknown';
  if (status === 'ready' && questions.length) status = 'ready_with_questions';
  let blocking = items(p.qa_blocking ?? quality.blocking ?? del.blocking);
  if (status === 'not_ready' && !blocking.length) blocking = items(p.qa_reasons ?? quality.reasons).map((b) => ({ ...b, code: 'other' }));
  const advisory = items(p.qa_advisory ?? quality.advisory ?? del.advisory);
  const g = obj(p.qa_grade ?? meta.grade ?? quality.grade ?? del.grade);
  const grade = num(g.score) ?? (raw ? null : num(meta.content_score));
  const needsWork = status === 'needs_work' ? needsWorkOf(g) : [];
  const h = deliveryHeadline(status, questions.length, blocking[0] ?? null, needsWork);
  return {
    status,
    headline: h.headline,
    detail: h.detail,
    grade: grade == null ? null : Math.round(grade),
    gradeLabel: gradeDisplay(grade),
    needsWork,
    firstDraftReview: num(g.first_draft_review),
    blocking,
    advisory,
    questionCount: questions.length,
    nextStep: status === 'not_ready' || status === 'needs_work' ? plainWords(s(p.qa_next_step) || s(quality.next_step) || s(del.next_step)) : '',
    deliveredFrom: plainWords(s(del.delivered_from)),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 2. The client questions
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ClientQuestion {
  id: string;
  rank: number;
  impact: number;
  kind: string;
  /** proof | experience | credential | guarantee | service | pricing | timeline | detail */
  category: string;
  /** the business-fact key the answer fills (stored once, reused by later pages) */
  fact_key: string;
  /** claim: a statement nothing on file supports; brief: what would make the page stronger; bracket: what the writer needed */
  source: 'claim' | 'brief' | 'bracket';
  question: string;
  why: string;
  /** the specific sentence (claims) */
  original: string;
  /** the wording the page carries until the client answers ('' when the sentence was left out) */
  neutral: string;
  in_page: 'neutral' | 'cta' | 'left_out';
  section: string;
  /** W0-E: where the answer belongs in the page (cta | credential | proof | pricing | timeline | named; '' on older reports) */
  slot: string;
  /** W0-E: for a statement the page run removed, where it stood, so a "yes" puts it back there (null on older reports) */
  anchor: QuestionAnchor | null;
  answer_type: 'choice' | 'text';
  prefill: string;
  prefill_source: string;
  use_for_future_pages: boolean;
}

/** W0-E (page-quality PLAN Fix 5.3): the sentence before / after a removed statement on its line, else the line above it, in its section. */
export interface QuestionAnchor {
  section: string;
  before: string;
  after: string;
  line_before: string;
}
const SLOTS = ['cta', 'credential', 'proof', 'pricing', 'timeline', 'named'];
const anchorOf = (v: unknown): QuestionAnchor | null => {
  const a = obj(v);
  const x: QuestionAnchor = { section: s(a.section).slice(0, 300), before: s(a.before).slice(0, 400), after: s(a.after).slice(0, 400), line_before: s(a.line_before).slice(0, 400) };
  return x.before || x.after || x.line_before ? x : null;
};

export const TOP_QUESTIONS = 3;

/** The questions of a page report, ranked (rank 1 first). */
export function questionsOf(payload: P | null | undefined): ClientQuestion[] {
  const p = payload ?? {};
  const meta = obj(p.meta);
  const quality = obj(p.qa_quality ?? meta.quality);
  const raw = arr(p.qa_client_questions).length ? arr(p.qa_client_questions) : arr(meta.client_questions).length ? arr(meta.client_questions) : arr(quality.client_questions);
  const seen = new Set<string>();
  return raw
    .map(obj)
    .map((q, i): ClientQuestion => {
      const source = s(q.source) === 'brief' || s(q.source) === 'bracket' ? (s(q.source) as 'brief' | 'bracket') : 'claim';
      const inPage = s(q.in_page);
      return {
        id: s(q.id) || `q${i + 1}`,
        rank: num(q.rank) ?? i + 1,
        impact: Math.max(0, Math.min(1, num(q.impact) ?? 0.5)),
        kind: s(q.kind),
        category: s(q.category) || 'detail',
        fact_key: s(q.fact_key) || `detail.q${i + 1}`,
        source,
        question: plainWords(s(q.question)),
        why: plainWords(s(q.why)),
        original: plainWords(s(q.original)),
        neutral: plainWords(s(q.neutral)),
        in_page: inPage === 'neutral' || inPage === 'cta' ? inPage : 'left_out',
        section: plainWords(s(q.section)),
        slot: SLOTS.includes(s(q.slot)) ? s(q.slot) : '',
        anchor: anchorOf(q.anchor),
        answer_type: source === 'claim' ? 'choice' : 'text',
        prefill: plainWords(s(q.prefill)),
        prefill_source: plainWords(s(q.prefill_source)),
        use_for_future_pages: q.use_for_future_pages !== false,
      };
    })
    .filter((q) => q.question && !seen.has(q.id) && (seen.add(q.id), true))
    .sort((a, b) => a.rank - b.rank || b.impact - a.impact);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 3. Answers and the business facts they fill
// ---------------------------------------------------------------------------------------------------------------------------------

/** yes: keep the specific sentence; edit: the client's wording; remove: the sentence goes; general: keep the neutral wording (recorded);
 *  answer: the client's answer to a text question; skip: not now (nothing stored, asked again on a later page). */
export const ANSWER_DECISIONS = ['yes', 'edit', 'remove', 'general', 'answer', 'skip'] as const;
export type AnswerDecision = (typeof ANSWER_DECISIONS)[number];
export const ANSWER_TEXT_MAX = 600;

export interface PageAnswer {
  questionId: string;
  factKey: string;
  decision: AnswerDecision;
  /** the client's wording (edit / answer); the original sentence for yes; '' otherwise */
  text: string;
  at: string;
  by: string | null;
  /** accepted from the prefill in one click */
  fromPrefill?: boolean;
}

/** One business fact the client confirmed, wrote or declined, stored on the website once and reused by every later page. */
export interface FactAnswer {
  decision: Exclude<AnswerDecision, 'skip'>;
  /** the fact as it may be published ('' for remove / general: a decision, not a fact) */
  text: string;
  question: string;
  category: string;
  at: string;
  by: string | null;
  /** the page report it was answered on */
  reportId: string | null;
}
export type FactAnswers = Record<string, FactAnswer>;

/** The choices a question offers (the server refuses any other). */
export const allowedDecisions = (q: Pick<ClientQuestion, 'answer_type'>): AnswerDecision[] => (q.answer_type === 'choice' ? ['yes', 'edit', 'remove', 'general', 'skip'] : ['answer', 'general', 'skip']);

/** Customer labels of the choices. */
export const DECISION_LABEL: Record<AnswerDecision, string> = {
  yes: 'Yes, keep it',
  edit: 'Edit it',
  remove: 'Remove it',
  general: 'Leave it general',
  answer: 'Answer',
  skip: 'Not now',
};

/** Why an answer is refused ('' when it is fine). */
export function answerProblem(q: Pick<ClientQuestion, 'answer_type'>, decision: AnswerDecision, text: string): string {
  if (!allowedDecisions(q).includes(decision)) return 'This choice is not available for this question.';
  const t = plainWords(text);
  if ((decision === 'edit' || decision === 'answer') && !t) return 'Write your wording first, or choose another option.';
  if (t.length > ANSWER_TEXT_MAX) return `Keep it under ${ANSWER_TEXT_MAX} characters.`;
  if (/[<>]/.test(t)) return 'Plain text only, please (no < or > characters).';
  return '';
}

/** The text an answer puts in the page and in the business facts. */
export function answerText(q: Pick<ClientQuestion, 'original'>, decision: AnswerDecision, text: string): string {
  if (decision === 'yes') return plainWords(q.original);
  if (decision === 'edit' || decision === 'answer') return plainWords(text).slice(0, ANSWER_TEXT_MAX);
  return '';
}

/**
 * The answer a one-click "Accept all suggestions" gives a question (null: nothing to accept). W0-E (2026-10-29, page-quality PLAN Fix 5.5):
 * only a yes / no question about a statement is confirmed in one click; a question that needs the client's own words (proof, a credential,
 * how an engagement starts) is never answered with a suggestion, because one click stored a homepage slogan as proof of projects (3299).
 */
export function prefilledAnswer(q: ClientQuestion): { decision: AnswerDecision; text: string } | null {
  if (!q.prefill || q.answer_type !== 'choice') return null;
  return { decision: 'yes', text: '' };
}

/** The business fact an answer stores (null: skip, or the question is for this page only). */
export function factOf(q: ClientQuestion, a: Pick<PageAnswer, 'decision' | 'text' | 'at' | 'by'>, reportId: string | null): FactAnswer | null {
  if (a.decision === 'skip' || !q.use_for_future_pages) return null;
  return { decision: a.decision, text: answerText(q, a.decision, a.text), question: q.question, category: q.category, at: a.at, by: a.by, reportId };
}

/** What every page run carries: the stored facts as key -> text, and every key decided (so no page asks it again). */
export function factsForEngine(facts: FactAnswers | null | undefined): { business_facts_kv: Record<string, string>; stored_fact_keys: string[] } {
  const f = facts ?? {};
  const keys = Object.keys(f).filter((k) => /^[\p{L}\p{N}_.&-]{1,80}$/u.test(k)).sort();
  const kv: Record<string, string> = {};
  for (const k of keys) {
    const t = plainWords(f[k]!.text);
    if (t && (f[k]!.decision === 'yes' || f[k]!.decision === 'edit' || f[k]!.decision === 'answer')) kv[k] = t.slice(0, ANSWER_TEXT_MAX);
  }
  return { business_facts_kv: kv, stored_fact_keys: keys.slice(0, 400) };
}

/** A question whose fact the website already has: answered from the business details, never asked again. */
export const storedFactFor = (q: Pick<ClientQuestion, 'fact_key'>, facts: FactAnswers | null | undefined): FactAnswer | null => (facts ?? {})[q.fact_key] ?? null;

/** Customer words for a stored fact's decision (Website settings > Business details). */
export const FACT_DECISION_LABEL: Record<FactAnswer['decision'], string> = {
  yes: 'Confirmed',
  edit: 'Your wording',
  answer: 'Your answer',
  remove: 'Never say this',
  general: 'Keep it general',
};

/** True when the answers (or the client's own edits) change the page, so a final version is worth making. */
export function finalizeNeeded(answers: readonly Pick<PageAnswer, 'decision'>[], clientEdited: boolean): boolean {
  return clientEdited || answers.some((a) => a.decision === 'yes' || a.decision === 'edit' || a.decision === 'remove' || a.decision === 'answer');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 4. The engine's finalize request (mode `finalize`, POST /webhook/seo-page-finalize, synchronous)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface FinalizeAnswer {
  id: string;
  fact_key: string;
  source: ClientQuestion['source'];
  decision: AnswerDecision;
  /** the text to put in the page (yes: the original sentence; edit / answer: the client's wording) */
  text: string;
  question: string;
  original: string;
  neutral: string;
  in_page: ClientQuestion['in_page'];
  section: string;
  /** W0-E: the question's category and slot, so the engine works the answer into the sentence it changes */
  category: string;
  slot: string;
  /** W0-E: where a removed statement stood (a "yes" goes back there and nowhere else); null when unknown */
  anchor: QuestionAnchor | null;
}

/**
 * W0-B (2026-10-29, page-quality PLAN Fix 2, REVIEW_CODE H2, owner decision D2; n8n/seo-agent/harness/README.md "PRC contract"): the
 * page-run context of a delivered page, sent with every finalize so the final version keeps the page run's blockers and is judged with
 * its research. Finalize 3336 graded the final version of page 3299 against itself and dropped "this website already has a page for the
 * same search": it said Ready at 100.
 * Gating fields come from the ORIGINAL report (never the final version, whose blocking list is its own); reports delivered before the
 * blocking list existed (2026-10-28) are read from what they carry: the gate the page passed or failed and the originality check's
 * duplicate pages and copied passages. `missing` names a gating field the stored report does not have: without the blocking list or the
 * duplicate check nothing can say the page is ready. Grading fields come from the callback's `page_run` (page runs from W0-B on); a
 * missing one is advice "not checked" in the engine, never a block.
 */
export interface PageRunContext {
  qa_blocking: PageDeliveryItem[] | null;
  duplicate_targets: { url: string; title: string; keyword_words_shared_pct: number | null }[] | null;
  verdict: string | null;
  score: number | null;
  score_withheld: boolean;
  page_type: string;
  verdict_acknowledged: boolean;
  /** the passages the first check found repeated from another page (the copied-text blocker stays until none is left) */
  copied_passages: string[];
  /** the length points (of 15) the page run measured against the pages that rank, for reports without a length band */
  length_points: number | null;
  /** gating fields the stored report does not have */
  missing: string[];
  content_request_id: string;
  [grading: string]: unknown;
}

// `second_read` (wave 0.5, 2026-10-30): the second read's advice on the delivered page (severity, kind, the quoted words); the final version
// keeps its grade deduction while those words are still on the page
const PRC_GRADING = ['length_band', 'coverage_target', 'terms', 'facts', 'sources_cited', 'style_guide', 'site_urls', 'serp_shapes', 'regulatory_facts', 'regulatory_topics', 'second_read'] as const;

/** The page-run context of a stored content payload (the original report; a final version keeps its own copy in `page_run_context`). */
export function pageRunOf(payload: P | null | undefined): PageRunContext {
  const p = payload ?? {};
  const kept = obj(p.page_run_context);
  if (Object.keys(kept).length && Array.isArray(kept.missing)) return kept as PageRunContext;
  const meta = obj(p.meta);
  const quality = obj(p.qa_quality ?? meta.quality);
  const orig = meta.originality && typeof meta.originality === 'object' ? obj(meta.originality) : null;
  const missing: string[] = [];
  const dups = orig && Array.isArray(orig.duplicate_targets)
    ? arr(orig.duplicate_targets)
        .map(obj)
        .map((d) => ({ url: s(d.url), title: s(d.title), keyword_words_shared_pct: num(d.keyword_words_shared_pct) }))
        .filter((d) => /^https?:\/\//i.test(d.url))
        .slice(0, 10)
    : null;
  if (!dups) missing.push('duplicate_targets');
  // the passages a failing originality check found (the source it failed on, else every overlap over the threshold)
  const threshold = num(orig?.threshold_pct) ?? 15;
  const failing = obj(orig?.failing ?? orig?.worst);
  const overlaps = arr(orig?.top_overlaps).map(obj);
  const failingPages = orig?.passed === false ? (Object.keys(failing).length ? [failing] : overlaps.filter((o) => (num(o.overlap_pct) ?? 0) >= threshold)) : [];
  const copied_passages = [...new Set(failingPages.flatMap((o) => arr(o.passages).map((x) => s(obj(x).text) || s(x)).filter((t) => t.split(/\s+/).length >= 6)))].slice(0, 20);
  // the page run's blocking list; a report from before it existed (2026-10-28) is read from the gate it passed or failed and its
  // originality check: the duplicate page and copied text are the blockers a final check cannot see again, everything else it measures again
  const listed = Array.isArray(p.qa_blocking) ? p.qa_blocking : Array.isArray(quality.blocking) ? quality.blocking : null;
  let qa_blocking: PageDeliveryItem[] | null = listed ? items(listed) : null;
  const gated = typeof p.qa_not_ready === 'boolean' || typeof p.qa_publishable === 'boolean' || typeof quality.not_ready === 'boolean' || typeof meta.publishable === 'boolean';
  if (!qa_blocking && gated && orig) {
    qa_blocking = [];
    if (dups && dups.length)
      qa_blocking.push({ code: 'duplicate_page', text: `This website already has a page for the same search: ${dups.slice(0, 2).map((d) => d.url).join(', ')}. Publish this text as an update of that page, or tell us how the new page differs` });
    if (orig.passed === false) qa_blocking.push({ code: 'copied', text: 'Part of the text repeats another page word for word' });
  }
  if (!qa_blocking) missing.push('qa_blocking');
  const pr = obj(p.page_run);
  const grading: P = {};
  for (const k of PRC_GRADING) if (pr[k] !== undefined && pr[k] !== null) grading[k] = pr[k];
  const g = obj(p.qa_grade ?? quality.grade ?? meta.grade);
  return {
    qa_blocking,
    duplicate_targets: dups,
    verdict: s(p.verdict) || null,
    score: num(p.score),
    score_withheld: p.score_withheld === true,
    page_type: s(meta.page_type) || s(p.recommended_page),
    verdict_acknowledged: p.verdict_acknowledged === true,
    copied_passages,
    length_points: num(obj(g.breakdown).length),
    missing,
    content_request_id: s(pr.content_request_id) || s(p.request_id),
    ...grading,
  };
}

/** The client's answer to "this website already has a page for the same search" (owner decision D2), sent with the finalize. */
export interface DuplicateDecision {
  choice: 'update' | 'differs';
  /** update: the address of the page this text replaces (one the first check named) */
  url?: string;
  /** differs: how this page differs, in the client's words (recorded and shown; the fit limit stays in the grade) */
  reason?: string;
}
/** Where the decision is kept on the review row (with the answers, under a key no question id can take). */
export const DUPLICATE_DECISION_KEY = '@duplicate_page';
export const DUPLICATE_REASON_MIN = 20;
export const DUPLICATE_REASON_MAX = 600;
/** '' when the reason can be sent, else what is wrong with it (the engine refuses the same). */
export function duplicateReasonProblem(reason: string): string {
  const t = plainWords(reason).replace(/\s+/g, ' ').trim();
  if (t.length < DUPLICATE_REASON_MIN) return `Say in at least ${DUPLICATE_REASON_MIN} characters how this page differs from the one your website has.`;
  if (t.length > DUPLICATE_REASON_MAX) return `Keep it under ${DUPLICATE_REASON_MAX} characters.`;
  if (/[<>]/.test(t)) return 'Use plain text (no < or >).';
  return '';
}

/** The website's page(s) a delivered page duplicates, while that blocker is open on it (the original's list, else the version's own). */
export function duplicatePagesOf(payload: P | null | undefined): { url: string; title: string }[] {
  const pr = pageRunOf(payload);
  const open = (pr.qa_blocking ?? []).some((b) => b.code === 'duplicate_page');
  if (!open) return [];
  const fromTargets = (pr.duplicate_targets ?? []).map((d) => ({ url: d.url, title: d.title }));
  if (fromTargets.length) return fromTargets.slice(0, 3);
  const text = (pr.qa_blocking ?? []).find((b) => b.code === 'duplicate_page')?.text ?? '';
  return [...new Set(text.match(/https?:\/\/[^\s,]+[^\s,.]/g) ?? [])].slice(0, 3).map((url) => ({ url, title: '' }));
}

export interface FinalizeBody {
  mode: 'finalize';
  request_id: string;
  domain: string;
  site_id: string;
  keyword: string;
  country: string;
  page_type: string;
  /** the version to finalise: the client's edited version, else the delivered one (article Markdown) */
  markdown: string;
  /** the delivered version: what the client changed is the client's own wording, never rewritten by the engine */
  delivered_markdown: string;
  client_edited: boolean;
  meta: { title: string; meta_description: string; slug: string; h1: string };
  answers: FinalizeAnswer[];
  business_facts: string;
  business_facts_kv: Record<string, string>;
  stored_fact_keys: string[];
  /** the report the page came from (for the engine's log only) */
  content_request_id: string;
  /** W0-B: the page-run context of the ORIGINAL report (its blockers travel to the final version) */
  page_run: PageRunContext;
  /** W0-B (D2): the client's answer to a duplicate-page blocker, when given */
  duplicate_decision?: DuplicateDecision;
}

export function finalizeBody(o: {
  requestId: string;
  domain: string;
  siteId: string;
  payload: P;
  markdown: string;
  clientEdited: boolean;
  questions: ClientQuestion[];
  answers: Record<string, PageAnswer>;
  businessFacts: string;
  facts: FactAnswers;
  /** W0-B: the ORIGINAL report's payload (the page run's blockers and research); the base payload when this is the original */
  original?: P;
  /** W0-B (D2): the client's decision on a duplicate-page blocker */
  duplicateDecision?: DuplicateDecision | null;
}): FinalizeBody {
  const p = o.payload ?? {};
  const meta = obj(p.meta);
  const ans: FinalizeAnswer[] = [];
  for (const q of o.questions) {
    const a = o.answers[q.id];
    if (!a || a.decision === 'skip') continue;
    ans.push({ id: q.id, fact_key: q.fact_key, source: q.source, decision: a.decision, text: answerText(q, a.decision, a.text), question: q.question, original: q.original, neutral: q.neutral, in_page: q.in_page, section: q.section,
      category: q.category, slot: q.slot, anchor: q.anchor });
  }
  const f = factsForEngine(o.facts);
  return {
    mode: 'finalize',
    request_id: o.requestId,
    domain: o.domain,
    site_id: o.siteId,
    keyword: s(p.keyword) || s(meta.primary_keyword),
    country: s(p.country) || s(meta.country),
    page_type: s(meta.page_type) || s(p.recommended_page),
    markdown: o.markdown,
    delivered_markdown: s(p.markdown),
    client_edited: o.clientEdited,
    // W0-A (2026-10-29): a stored description that is a field label ("Slug: ..."), on two lines or under 70 characters is not sent back:
    // the engine writes one from the page (PF.meta in the finalize's Parse Brief)
    meta: { title: s(meta.title), meta_description: usableMetaDescription(meta.meta_description), slug: s(meta.slug), h1: s(meta.h1) },
    answers: ans,
    business_facts: o.businessFacts.slice(0, 2000),
    business_facts_kv: f.business_facts_kv,
    stored_fact_keys: f.stored_fact_keys,
    content_request_id: s(obj(o.original ?? p).request_id) || s(p.request_id),
    page_run: pageRunOf(o.original ?? p),
    ...(o.duplicateDecision ? { duplicate_decision: o.duplicateDecision } : {}),
  };
}

/** The engine's answer (200). 400 answers { ok: false, error }. */
export interface FinalizeResult {
  ok: boolean;
  request_id: string;
  /** the final article Markdown */
  markdown: string;
  /** per answer: kept_original | client_wording | removed | woven | left_general | not_found */
  applied: { id: string; how: string; section: string }[];
  /** the sections the editor rewrote (s0 = introduction) */
  sections_rewritten: string[];
  changes: { section: string; what: string; before: string; after: string }[];
  delivery_status: PageDeliveryStatus;
  delivery: { status: PageDeliveryStatus; label: string; blocking: PageDeliveryItem[]; advisory: PageDeliveryItem[]; next_step: string; grade: P };
  /** questions still open after these answers (never one whose fact is stored) */
  client_questions: P[];
  grade: P;
  cost: { claude_usd: number; dfs_usd: number; estimated: boolean; model_calls: number };
  /** W0-A (2026-10-29): the meta lines of the final version as the engine checked them (a broken description rebuilt); absent from older engines */
  meta?: { title?: string; meta_description?: string; slug?: string; target_url?: string };
  /** W0-B (D2): the client's decision on a duplicate-page blocker, as the engine applied it (null when there was none) */
  decision?: { code: string; choice: 'update' | 'differs'; url: string; reason: string; pages: string[] } | null;
  /** W0-B: what the final check knew of the page run (missing fields, blockers kept open, blockers resolved) */
  page_run?: { received: boolean; gating_missing: string[]; grading_missing: string[]; kept_open: string[]; resolved: string[] };
  error?: string;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 5. The review as the screens see it (server <-> web)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface PageCheck {
  status: PageDeliveryStatus;
  blocking: PageDeliveryItem[];
  advisory: PageDeliveryItem[];
  checkedAt: string;
  /** false: the free check could not run (the engine did not answer); `note` says so */
  ran: boolean;
  note: string;
}

/** Where a page stands, for the report and the content board. */
export type ReviewStage = 'not_ready' | 'needs_work' | 'questions' | 'ready' | 'finalising' | 'final_ready' | 'approved' | 'sent_draft' | 'published' | 'live_verified';
export const REVIEW_STAGE_LABEL: Record<ReviewStage, string> = {
  not_ready: 'Not ready',
  needs_work: 'Needs work, you can still publish it',
  questions: 'Ready, stronger with your input',
  ready: 'Ready, waiting for your OK',
  finalising: 'Making the final version',
  final_ready: 'Final version, waiting for your OK',
  approved: 'Approved',
  sent_draft: 'Sent to your website as a draft',
  published: 'Published',
  live_verified: 'Live, checked',
};
export const REVIEW_STAGE_TONE: Record<ReviewStage, 'critical' | 'warning' | 'info' | 'good'> = {
  not_ready: 'critical',
  needs_work: 'warning',
  questions: 'info',
  ready: 'info',
  finalising: 'info',
  final_ready: 'info',
  approved: 'good',
  sent_draft: 'good',
  published: 'good',
  live_verified: 'good',
};

export interface PageReviewSummary {
  reportId: string;
  stage: ReviewStage;
  label: string;
  questions: number;
  answered: number;
  grade: number | null;
}

export interface PageReviewView {
  reportId: string;
  siteId: string | null;
  keyword: string;
  delivery: PageDelivery;
  /** every question, ranked; `stored` = the website already has this fact (answered there, not asked again) */
  questions: (ClientQuestion & { stored: FactAnswer | null })[];
  answers: Record<string, PageAnswer>;
  /** metaDescriptionNote: W0-A (2026-10-29), set when the stored description cannot be used ("Slug: ...", too short): what the client is told */
  delivered: { markdown: string; title: string; metaDescription: string; metaDescriptionNote: string; slug: string };
  clientVersion: { markdown: string; savedAt: string; savedBy: string | null; check: PageCheck | null } | null;
  finalize: {
    status: 'none' | 'running' | 'done' | 'failed';
    runId: string | null;
    reportId: string | null;
    error: string | null;
    startedAt: string | null;
    /** the price shown before starting */
    quote: { credits: number; usd: number };
    needed: boolean;
    /** why the button is off ('' when it is on) */
    reason: string;
  };
  approval: { approvedAt: string; approvedBy: string | null; reportId: string } | null;
  publish: { status: 'not_published' | 'sent_draft' | 'published' | 'live_verified'; url: string | null; at: string | null };
  stage: ReviewStage;
  /** this report is itself a final version of `finalOf` */
  isFinal: boolean;
  finalOf: string | null;
  /**
   * W0-B (owner decision D2): the website already has a page for the same search (the delivered page's open blocker). The page is published
   * only as an update of that page (`rewrite`: the Write a page form's values for a page run that improves it at its own address) or with
   * the client's reason (`decision`, sent with the next final version and shown on it). Null when there is no such page. Optional: older
   * servers do not send it.
   */
  duplicate?: {
    pages: { url: string; title: string }[];
    decision: { choice: 'differs'; reason: string; at: string; by: string | null } | null;
    rewrite: { keyword: string; pageType: string; country: string };
  } | null;
  /**
   * who did what, by name: every user id this view carries (`approval.approvedBy`, `clientVersion.savedBy`, each answer's and stored
   * fact's `by`) mapped to the person's name, else their e-mail, else "a team member". The UI prints names through `personLabel`,
   * never a raw id.
   */
  people: Record<string, string>;
}

export const UNKNOWN_PERSON = 'a team member';

/** The label for a user: the name, else the e-mail, else "a team member" (also for a deleted user). Never the id. */
export function personDisplayName(u: { name?: string | null; email?: string | null } | null | undefined): string {
  const name = (u?.name ?? '').trim();
  if (name) return name;
  const email = (u?.email ?? '').trim();
  return email || UNKNOWN_PERSON;
}

/** The name to print for a user id of a review view; '' when there is no id (the caller then leaves "by …" out). */
export function personLabel(people: Record<string, string> | null | undefined, id: string | null | undefined): string {
  if (!id) return '';
  return people?.[id] || UNKNOWN_PERSON;
}

/** Every user id a review view refers to (approved, saved, answered, stored facts), deduplicated. */
export function reviewPersonIds(v: Pick<PageReviewView, 'approval' | 'clientVersion' | 'answers' | 'questions'> & Partial<Pick<PageReviewView, 'duplicate'>>): string[] {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (typeof id === 'string' && id) ids.add(id);
  };
  add(v.approval?.approvedBy);
  add(v.clientVersion?.savedBy);
  add(v.duplicate?.decision?.by);
  for (const a of Object.values(v.answers ?? {})) add(a?.by);
  for (const q of v.questions ?? []) add(q.stored?.by);
  return [...ids];
}

/** The one rule for where a page stands. */
export function reviewStage(o: {
  delivery: Pick<PageDelivery, 'status'>;
  openQuestions: number;
  finalize: Pick<PageReviewView['finalize'], 'status'>;
  isFinal: boolean;
  approved: boolean;
  publish: PageReviewView['publish']['status'];
}): ReviewStage {
  if (o.publish === 'live_verified') return 'live_verified';
  if (o.publish === 'published') return 'published';
  if (o.publish === 'sent_draft') return 'sent_draft';
  if (o.approved) return 'approved';
  if (o.finalize.status === 'running') return 'finalising';
  if (o.delivery.status === 'not_ready') return 'not_ready';
  if (o.delivery.status === 'needs_work') return 'needs_work';   // W0-C: a part under half its points; approving it is still allowed
  if (o.isFinal || o.finalize.status === 'done') return 'final_ready';
  return o.openQuestions > 0 ? 'questions' : 'ready';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 6. The in-app editor: Markdown in, sanitised; safe HTML out; blocks and a comparison
// ---------------------------------------------------------------------------------------------------------------------------------

export const PAGE_MARKDOWN_MAX = 200_000;

/**
 * The client's version as it may be stored: plain Markdown. Raw HTML tags are removed (their text kept), script / style / iframe blocks go
 * whole, links and images keep only http(s), relative, anchor and mailto targets (any other target keeps its words), control characters go.
 */
export function sanitizeMarkdown(md: string): string {
  let t = s(md).replace(/\r\n?/g, '\n').slice(0, PAGE_MARKDOWN_MAX);
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  t = t.replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '');
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/<\/?[a-zA-Z][^<>]*>/g, '');
  t = t.replace(/(!?)\[([^\[\]\n]*)\]\(\s*((?:[^()\s]|\([^()\s]*\))*)((?:\s+"[^"\n]*")?)\s*\)/g, (m0, bang: string, text: string, url: string, title: string) => (safeUrl(url) ? `${bang}[${text}](${url}${title})` : text));
  return t;
}

/** A link target the page may carry. */
export function safeUrl(u: string): boolean {
  const x = s(u).trim();
  if (!x) return false;
  if (/^(https?:\/\/|mailto:)/i.test(x)) return !/[\s<>"']/.test(x);
  if (/^[a-z][a-z0-9+.-]*:/i.test(x)) return false;
  return /^(\/|#|\.{0,2}\/?[\w-])/.test(x) && !/[\s<>"']/.test(x);
}

const esc = (t: string) => s(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** An image the in-app preview may load: an absolute https address only (the preview frame's policy allows https images, nothing else). */
export const previewableImage = (u: string): boolean => /^https:\/\/[^\s<>"'/]+/i.test(s(u).trim());

/**
 * How the in-app preview shows an image it may not load: a planned image not uploaded yet (a relative path such as "images/hero.webp",
 * which inside the preview frame would resolve against the app's own address and be refused) or a plain-http one. A labelled box with
 * the file name, the same as the delivered article's preview, never a broken image or a blocked request.
 */
function imagePlaceholder(url: string, alt: string): string {
  const name = s(url).split(/[?#]/)[0]!.split('/').filter(Boolean).pop() || 'image';
  const label = /^http:\/\//i.test(url) ? 'Image not shown (not a secure https address)' : 'Image to upload';
  return `<span class="img-ph" role="img" aria-label="${esc(`${label}: ${alt || name}`)}"><span class="img-ph-label">${esc(label)}</span><span class="img-ph-name">${esc(name)}</span></span>`;
}

function inlineMd(t: string, preview = false): string {
  // links and images first (escaped pieces), then bold / italic / code on the escaped rest
  const parts: string[] = [];
  let rest = s(t);
  const re = /(!?)\[([^\[\]\n]*)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+"([^"\n]*)")?\s*\)/;
  for (let guard = 0; guard < 400; guard++) {
    const m = rest.match(re);
    if (!m || m.index == null) break;
    parts.push(fmt(esc(rest.slice(0, m.index))));
    const [, bang, text, url, title] = m;
    if (!safeUrl(url!)) parts.push(fmt(esc(text!)));
    else if (bang && preview && !previewableImage(url!)) parts.push(imagePlaceholder(url!, text!));
    else if (bang) parts.push(`<img src="${esc(url!)}" alt="${esc(text!)}"${title ? ` title="${esc(title)}"` : ''} loading="lazy">`);
    else parts.push(`<a href="${esc(url!)}"${/^https?:\/\//i.test(url!) ? ' rel="noopener noreferrer"' : ''}>${fmt(esc(text!))}</a>`);
    rest = rest.slice(m.index + m[0].length);
  }
  parts.push(fmt(esc(rest)));
  return parts.join('');
}
const fmt = (t: string) =>
  t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');

const META_LINE = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;

/**
 * Safe HTML of a page's Markdown (the editor preview and the final version's HTML). Everything is escaped; only our own tags come out.
 * `preview`: for the in-app preview frame, images load only from https addresses; any other image is a labelled box (imagePlaceholder).
 * The final version's HTML keeps the page's own image paths.
 */
export function renderMarkdown(md: string, opts: { skipMeta?: boolean; preview?: boolean } = {}): string {
  const preview = opts.preview === true;
  const inline = (t: string) => inlineMd(t, preview);
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let table = false;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const closeTable = () => {
    if (table) out.push('</tbody></table>');
    table = false;
  };
  for (const raw of sanitizeMarkdown(md).split('\n')) {
    const l = raw.trim();
    if (opts.skipMeta !== false && META_LINE.test(l)) continue;
    if (l.startsWith('|')) {
      flushPara();
      closeList();
      if (/^\|[\s:|-]+\|?$/.test(l)) continue;
      const cells = l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (!table) {
        out.push(`<table><thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`);
        table = true;
      } else out.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
      continue;
    }
    closeTable();
    if (!l) {
      flushPara();
      closeList();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(#{1,4})\s+(.+)$/))) {
      flushPara();
      closeList();
      out.push(`<h${m[1]!.length}>${inline(m[2]!)}</h${m[1]!.length}>`);
      continue;
    }
    if ((m = l.match(/^>\s?(.*)$/))) {
      flushPara();
      closeList();
      out.push(`<blockquote><p>${inline(m[1]!)}</p></blockquote>`);
      continue;
    }
    if ((m = l.match(/^[-*+]\s+(.+)$/)) || (m = l.match(/^\d{1,3}[.)]\s+(.+)$/))) {
      flushPara();
      const kind = /^\d/.test(l) ? 'ol' : 'ul';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline(m[1]!)}</li>`);
      continue;
    }
    closeList();
    para.push(l);
  }
  flushPara();
  closeList();
  closeTable();
  return out.join('\n');
}

/** The final version's HTML: the article and its JSON-LD blocks (a `</` inside JSON can never close the script). */
export function renderArticleHtml(md: string, schemaBlocks: unknown[] = []): string {
  const ld = arr(schemaBlocks)
    .map(obj)
    .map((b) => obj(b.json ?? b))
    .filter((b) => Object.keys(b).length)
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`);
  return `<article>\n${renderMarkdown(md)}${ld.length ? `\n${ld.join('\n')}` : ''}\n</article>`;
}

export type BlockKind = 'meta' | 'heading' | 'paragraph' | 'list' | 'table' | 'quote' | 'image' | 'blank';
export interface PageBlock {
  id: string;
  kind: BlockKind;
  /** 1-4 for headings */
  level?: number;
  /** the block's Markdown, exactly as in the page */
  text: string;
}

/** The page as blocks the editor shows one by one; `joinBlocks(parseBlocks(md)) === md` for Markdown with \n line ends. */
export function parseBlocks(md: string): PageBlock[] {
  const lines = s(md).replace(/\r\n?/g, '\n').split('\n');
  const blocks: PageBlock[] = [];
  const kindOf = (l: string): BlockKind => {
    const t = l.trim();
    if (!t) return 'blank';
    if (META_LINE.test(t)) return 'meta';
    if (/^#{1,6}\s/.test(t)) return 'heading';
    if (t.startsWith('|')) return 'table';
    if (/^>/.test(t)) return 'quote';
    if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(t)) return 'image';
    if (/^([-*+]|\d{1,3}[.)])\s+/.test(t)) return 'list';
    return 'paragraph';
  };
  let cur: { kind: BlockKind; lines: string[] } | null = null;
  const push = () => {
    if (!cur) return;
    const text = cur.lines.join('\n');
    const lvl = cur.kind === 'heading' ? (text.trim().match(/^(#{1,6})/)?.[1]?.length ?? 2) : undefined;
    blocks.push({ id: `b${blocks.length + 1}`, kind: cur.kind, ...(lvl ? { level: Math.min(4, lvl) } : {}), text });
    cur = null;
  };
  for (const l of lines) {
    const k = kindOf(l);
    // a paragraph, list, table or quote continues over its own kind; every heading, meta line, image and blank line stands alone
    const joins = cur && cur.kind === k && (k === 'paragraph' || k === 'list' || k === 'table' || k === 'quote' || k === 'blank');
    const listCont = cur && cur.kind === 'list' && k === 'paragraph' && /^\s{2,}\S/.test(l);
    if (joins || listCont) cur!.lines.push(l);
    else {
      push();
      cur = { kind: k, lines: [l] };
    }
  }
  push();
  return blocks;
}
export const joinBlocks = (blocks: readonly Pick<PageBlock, 'text'>[]): string => blocks.map((b) => b.text).join('\n');

export interface BlockDiff {
  kind: 'same' | 'changed' | 'added' | 'removed';
  before: string;
  after: string;
}
/** The client's version against the delivered one, block by block (blank lines ignored). */
export function diffBlocks(beforeMd: string, afterMd: string): BlockDiff[] {
  const A = parseBlocks(beforeMd).filter((b) => b.kind !== 'blank').map((b) => b.text.trim());
  const B = parseBlocks(afterMd).filter((b) => b.kind !== 'blank').map((b) => b.text.trim());
  const n = A.length, m = B.length;
  if (n * m > 4_000_000) return [{ kind: 'changed', before: A.join('\n\n'), after: B.join('\n\n') }];
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = A[i] === B[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const raw: BlockDiff[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      raw.push({ kind: 'same', before: A[i]!, after: B[j]! });
      i++;
      j++;
    } else if (L[i + 1]![j]! >= L[i]![j + 1]!) raw.push({ kind: 'removed', before: A[i++]!, after: '' });
    else raw.push({ kind: 'added', before: '', after: B[j++]! });
  }
  while (i < n) raw.push({ kind: 'removed', before: A[i++]!, after: '' });
  while (j < m) raw.push({ kind: 'added', before: '', after: B[j++]! });
  // a run of removed blocks followed by a run of added ones: paired in order as changed blocks, the rest stay removed / added
  const out: BlockDiff[] = [];
  for (let k = 0; k < raw.length; ) {
    if (raw[k]!.kind !== 'removed' && raw[k]!.kind !== 'added') {
      out.push(raw[k++]!);
      continue;
    }
    const rem: BlockDiff[] = [], add: BlockDiff[] = [];
    while (k < raw.length && raw[k]!.kind === 'removed') rem.push(raw[k++]!);
    while (k < raw.length && raw[k]!.kind === 'added') add.push(raw[k++]!);
    const pairs = Math.min(rem.length, add.length);
    for (let p = 0; p < pairs; p++) out.push({ kind: 'changed', before: rem[p]!.before, after: add[p]!.after });
    out.push(...rem.slice(pairs), ...add.slice(pairs));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 7. Server helpers (pure): open questions, the free check's answer, the final version's report payload
// ---------------------------------------------------------------------------------------------------------------------------------

/** A finalize run older than this with no answer is treated as failed (the server restarted while it waited). */
export const FINALIZE_STALE_MINUTES = 15;
/** At most this many "questions" items on the Pipeline's Needs you. */
export const NEEDS_YOU_QUESTION_PAGES = 5;

/** The questions still open: not answered on this page (skip counts as not answered) and not stored on the website. */
export function openQuestions(questions: readonly ClientQuestion[], answers: Record<string, Pick<PageAnswer, 'decision'>> | null | undefined, facts: FactAnswers | null | undefined): ClientQuestion[] {
  const a = answers ?? {};
  return questions.filter((q) => !storedFactFor(q, facts) && (!a[q.id] || a[q.id]!.decision === 'skip'));
}

/**
 * The questions the FINAL version carries: those of the delivered page still open after this finalize (not answered in it, fact not
 * stored; the page keeps their neutral wording) and the ones the engine raised on the new text, re-ranked by impact. The engine answers
 * only the new ones (ids f1, f2, ...), so without this an unanswered question of the delivered page would vanish from the final version.
 */
export function carryOpenQuestions(base: readonly ClientQuestion[], fresh: readonly unknown[], answeredIds: readonly string[], storedKeys: readonly string[]): P[] {
  const done = new Set(answeredIds.map(s));
  const stored = new Set(storedKeys.map(s));
  const carried: P[] = base.filter((q) => !done.has(q.id) && !stored.has(q.fact_key)).map((q) => ({ ...q }));
  const seen = new Set(carried.map((q) => s(q.fact_key)));
  const added = arr(fresh).map(obj).filter((q) => !stored.has(s(q.fact_key)) && !seen.has(s(q.fact_key)));
  return [...carried, ...added]
    .sort((a, b) => (num(b.impact) ?? 0) - (num(a.impact) ?? 0))
    .map((q, i) => ({ ...q, rank: i + 1 }));
}

/** The engine's Markdown for the page checks: the meta lines the checks read, then the article. */
export function pageMarkdownWithMeta(md: string, meta: { title?: string; meta_description?: string; slug?: string }): string {
  const body = s(md);
  if (META_LINE.test(body.trimStart().split('\n')[0] ?? '')) return body;
  const lines = [meta.title ? `Title: ${s(meta.title)}` : '', meta.meta_description ? `Meta Description: ${s(meta.meta_description)}` : '', meta.slug ? `Slug: ${s(meta.slug)}` : ''].filter(Boolean);
  return lines.length ? `${lines.join('\n')}\n\n${body}` : body;
}

/** The free Publish Check's answer (POST /webhook/seo-publish-check) as the review's check of the client's version. */
export function pageCheckOf(res: { ran: boolean; json?: P | null; note?: string }, openCount: number, at: string): PageCheck {
  if (!res.ran || !res.json || typeof res.json.publishable !== 'boolean')
    return { status: 'unknown', blocking: [], advisory: [], checkedAt: at, ran: false, note: plainWords(res.note || 'The check could not run right now. Your version is saved, and the final version is checked again in full.') };
  const j = res.json;
  const blocking = arr(j.reasons).map((r) => ({ code: 'other', text: plainWords(s(r)) })).filter((x) => x.text).slice(0, 12);
  const advisory = [...arr(j.advice), ...arr(j.warnings)].map((r) => ({ code: 'advice', text: plainWords(s(r)) })).filter((x) => x.text).slice(0, 12);
  const status: PageDeliveryStatus = j.publishable === true ? (openCount ? 'ready_with_questions' : 'ready') : 'not_ready';
  return {
    status,
    blocking: status === 'not_ready' ? (blocking.length ? blocking : [{ code: 'other', text: plainWords(s(j.label) || 'The check found a problem to fix before publishing') }]) : [],
    advisory,
    checkedAt: at,
    ran: true,
    note: '',
  };
}

/** The cost a finalize answer reports, in US dollars (never negative, never absurd). */
export function finalizeCostUsd(r: Pick<FinalizeResult, 'cost'> | null | undefined): { total: number; claude: number; dfs: number; estimated: boolean } {
  const c = obj(r?.cost);
  const claude = Math.max(0, Math.min(5, num(c.claude_usd) ?? 0));
  const dfs = Math.max(0, Math.min(5, num(c.dfs_usd) ?? 0));
  return { total: Math.round((claude + dfs) * 10000) / 10000, claude, dfs, estimated: c.estimated !== false };
}

/** the original run's own cost and delivery fields: never copied onto the final version (they belong to that run) */
const RUN_ONLY_KEYS = ['cost_usd', 'run_ledger', 'run_cost_estimate_usd', 'run_cost_basis', 'execution_id', 'credits_used', 'credits_state', 'emailed_to', 'finalized_from', 'finalize_changes', 'finalize_applied'];

/**
 * The final version's report payload: the delivered page's payload with the final Markdown, its safe HTML, the engine's delivered status,
 * grade and remaining questions, and its own cost.
 */
export function finalReportPayload(
  original: P,
  result: Pick<FinalizeResult, 'markdown' | 'delivery_status' | 'delivery' | 'client_questions' | 'grade' | 'changes' | 'applied' | 'cost' | 'meta' | 'decision'>,
  o: { originalReportId: string; requestId: string; pageRun?: PageRunContext | null },
): P {
  const base: P = {};
  for (const [k, v] of Object.entries(original ?? {})) if (!RUN_ONLY_KEYS.includes(k)) base[k] = v;
  const meta = obj(original?.meta);
  const md = s(result.markdown);
  const del = obj(result.delivery);
  const statusRaw = s(result.delivery_status) || s(del.status);
  const status: PageDeliveryStatus = DELIVERY_STATUSES.includes(statusRaw) ? (statusRaw as PageDeliveryStatus) : 'unknown';
  const questions = arr(result.client_questions);
  const ready = publishableStatus(status);   // W0-C: "needs work" blocks nothing, so it is publishable like "ready"
  const blocking = items(del.blocking);
  // W0-E (2026-10-29, page-quality PLAN Fix 5.2): an answer the engine could not work into a sentence is never appended to the page; the
  // client is told it was not placed, so they can say where it belongs
  const asked = new Map(questionsOf(original).map((q) => [q.id, q.question]));
  const notPlaced: PageDeliveryItem[] = arr(result.applied)
    .map(obj)
    .filter((a) => s(a.how) === 'not_placed')
    .slice(0, 10)
    .map((a) => ({ code: 'not_placed', text: plainWords(`Not placed: your answer to "${(asked.get(s(a.id)) ?? 'a question').slice(0, 160)}" did not fit a sentence of the page${s(a.section) ? ` (${s(a.section).slice(0, 120)})` : ''}. Tell us where it belongs, then make the final version again`) }));
  const advisory = [...items(del.advisory), ...notPlaced];
  const grade = obj(result.grade ?? del.grade);
  const label = plainWords(s(del.label)) || deliveryHeadline(status, questions.length, blocking[0] ?? null).headline;
  const reasons = ready ? [] : blocking.map((b) => b.text).slice(0, 8);
  const quality = { ...obj(original?.qa_quality ?? meta.quality), passed: ready, publishable: ready, not_ready: !ready, label, reasons, delivery_status: status, client_questions: questions, blocking, advisory, grade, next_step: ready && status !== 'needs_work' ? '' : s(del.next_step) };
  const words = md.replace(/\|/g, ' ').replace(/[#>*_`]/g, '').split(/\s+/).filter(Boolean).length;
  const c = finalizeCostUsd(result);
  const score = num(grade.score);
  // W0-A (2026-10-29): the final version's description is the one the engine checked (rebuilt when the stored one was broken); a stored
  // description that cannot be used is never carried onto the final version
  const finalDesc = usableMetaDescription(obj(result.meta).meta_description) || cleanMetaDescription(meta.meta_description);
  const descFields = finalDesc !== s(meta.meta_description) ? { meta_description: finalDesc, meta_description_length: finalDesc.length } : {};
  // W0-B (D2): published as an update of the website's page for the same search: that page's address and slug
  const target = s(obj(result.meta).target_url);
  const targetFields = /^https?:\/\//i.test(target) ? { target_url: target, suggested_url: target, ...(s(obj(result.meta).slug) ? { slug: s(obj(result.meta).slug) } : {}) } : {};
  return {
    ...base,
    request_id: o.requestId,
    markdown: md,
    html: renderArticleHtml(md, arr(meta.schema_blocks)),
    qa_delivery_status: status,
    qa_client_questions: questions,
    qa_grade: grade,
    qa_blocking: blocking,
    qa_advisory: advisory,
    qa_next_step: ready && status !== 'needs_work' ? '' : plainWords(s(del.next_step)),   // W0-C: what to improve on a page that needs work
    qa_publishable: ready,
    qa_not_ready: !ready,
    qa_passed: ready,
    qa_label: label,
    qa_reasons: reasons,
    qa_owner_edits: [],
    qa_quality: quality,
    meta: { ...meta, ...descFields, ...targetFields, word_count: words, publishable: ready, delivery_status: status, client_questions: questions, grade, quality, ...(score != null ? { content_score: score } : {}) },
    finalized_from: o.originalReportId,
    // W0-B: the page-run context travels with the final version, so a second finalize (or one whose original is gone) keeps its blockers
    page_run_context: o.pageRun ?? pageRunOf(original),
    ...(result.decision ? { finalize_decision: result.decision } : {}),
    finalize_changes: arr(result.changes).slice(0, 60),
    finalize_applied: arr(result.applied).slice(0, 200),
    run_ledger: { dataforseo_usd: c.dfs, ai_usd: c.claude, ai_cost_estimated: c.estimated },
  };
}

/** A page address compared without scheme, www, query, fragment or trailing slash. */
export const pageUrlKey = (u: string): string =>
  s(u)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:www\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');

/**
 * H1 open item: a refresh of a page the system itself wrote and the client published must not count that page's own words as support
 * for its claims (`existing_page_ours`). True when the address is a published page of the engine's content log.
 */
export function isOwnWrittenPage(log: readonly { published_url?: unknown; status?: unknown }[], url: string): boolean {
  const k = pageUrlKey(url);
  return !!k && log.some((r) => s(r.published_url) && pageUrlKey(s(r.published_url)) === k);
}

/** The content board's summary of a page's review. */
export function reviewSummaryOf(
  reportId: string,
  payload: P,
  o: { answers?: Record<string, Pick<PageAnswer, 'decision'>> | null; facts?: FactAnswers | null; finalize?: PageReviewView['finalize']['status']; isFinal?: boolean; approved?: boolean; publish?: PageReviewView['publish']['status'] } = {},
): PageReviewSummary {
  const d = deliveryOf(payload);
  const qs = questionsOf(payload);
  const open = openQuestions(qs, o.answers, o.facts);
  const stage = reviewStage({ delivery: d, openQuestions: open.length, finalize: { status: o.finalize ?? 'none' }, isFinal: !!o.isFinal, approved: !!o.approved, publish: o.publish ?? 'not_published' });
  return { reportId, stage, label: REVIEW_STAGE_LABEL[stage], questions: qs.length, answered: qs.length - open.length, grade: d.grade };
}
