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
import { aiPagePath, type AiTargetState } from './ai-target-status';

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
}
export interface AiQuestionInputs {
  prompts?: readonly AiPromptLike[];
  /** the AI report's question grid (the engine adds `keyword` to it) */
  questions?: readonly AiPromptLike[];
  targets?: readonly AiTargetForAction[];
  written?: readonly AiWrittenPage[];
  /** the website's market (a country name or ISO-2), for the same-search check */
  market?: string;
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

// ---------------- one search, one page (the engine's DUP rule, with the data the app has) ----------------

const toks = (t: string) => new Set(low(t).replace(/[^a-z0-9؀-ۿ]+/g, ' ').split(' ').filter((w) => w.length > 2));
const pathWords = (u: string) => S(u).replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/[?#].*$/, '').replace(/[-_/.]+/g, ' ');
/** the page names only places outside `iso` while the keyword names none outside it (the engine's DUP.otherMarket) */
function otherMarket(keyword: string, pageText: string, iso: string): boolean {
  if (!iso) return false;
  if (placesIn(keyword).some((p) => !p.iso.includes(iso))) return false;
  const pp = placesIn(pageText);
  return pp.length > 0 && !pp.some((p) => p.iso.includes(iso));
}

/**
 * The LIVE page of the website that already owns this search (CONTRACT_ISSUE1.md §4): a page whose keyword and address carry 75% or more of
 * the search's words of three letters or more (the engine's DUP share), in the same market. A page that names only another market's places
 * ("ai-automation-services-pakistan" for a UAE website) is advice, never the owner. Null when none.
 */
export function aiSearchOwner(keyword: string, pages: readonly AiWrittenPage[], market?: string): AiWrittenPage | null {
  const kw = toks(keyword);
  if (!kw.size) return null;
  const iso = isoOfCountry(market) || (/^[A-Za-z]{2}$/.test(S(market)) ? S(market).toUpperCase() : '');
  let best: { p: AiWrittenPage; share: number } | null = null;
  for (const p of pages) {
    const url = S(p.publishedUrl).trim();
    if (!url) continue;
    const text = `${p.keyword} ${pathWords(url)}`;
    const set = toks(text);
    let hit = 0;
    for (const w of kw) if (set.has(w)) hit++;
    const share = hit / kw.size;
    if (share < 0.75 && !LRU.sameSearch(low(p.keyword), low(keyword))) continue;
    if (otherMarket(keyword, text, iso)) continue;
    if (!best || share > best.share) best = { p, share };
  }
  return best?.p ?? null;
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

  const out = (step: AiQuestionStep, o: { note?: string; pageUrl?: string; refresh?: string } = {}): AiQuestionAction => {
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
    return { step, label, note: o.note ?? '', question, keyword, pageType, existingPageUrl: existing, pageUrl, targetId, aiTarget, source, run };
  };

  // 1. what the system already did for this question (the stored target's derived state)
  const st = target?.state ?? '';
  const stUrl = S(target?.statePageUrl || target?.pageUrl);
  if (st === 'won') return out('none', { note: 'AI now names you for this question.' });
  if (st === 'named') return out('none', { note: 'AI already names you for this question.' });
  if (st === 'live') return out('open', { note: `Your page ${aiPagePath(stUrl)} answers this question. AI answers usually take a few weeks to change.`, pageUrl: stUrl });
  if (st === 'writing') return out('none', { note: 'The page for this question is being written.' });
  if (st === 'written' || st === 'needs_fix') return out('publish', { note: st === 'needs_fix' ? 'The page for this question is written but needs a fix before it can be published.' : 'The page for this question is written and waiting to be published.' });
  if (st === 'held') return out('none', { note: 'The page for this question waits for your OK. Open its report to decide.' });

  // 2. a page written for this very question (by any run: the app's, the weekly pages, an older engine)
  const written = inputs.written ?? [];
  const own = written.filter((w) => forQuestion(w, targetId, q, keyword)).sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || S(b.startedAt).localeCompare(S(a.startedAt)))[0];
  if (own) {
    if (isLive(own)) return out('open', { note: `Your page ${aiPagePath(S(own.publishedUrl))} answers this question. AI answers usually take a few weeks to change.`, pageUrl: S(own.publishedUrl) });
    if (S(own.status) === 'writing' || (S(own.status) === 'started' && Date.now() - Date.parse(S(own.startedAt) || '1970-01-01') < 864e5))
      return out('none', { note: 'The page for this question is being written.' });
    return out('publish', { note: 'The page for this question is written and waiting to be published.' });
  }

  // 3. a planned refresh of a page of the website
  if (refreshUrl) return out('improve', { note: `We improve ${aiPagePath(refreshUrl)} so it answers this question.` });

  // 4. a live page of the website already owns the question's own search (same market): improve it, never a second page
  const owner = aiSearchOwner(keyword, written, inputs.market);
  if (owner) {
    refreshUrl = S(owner.publishedUrl);
    return out('improve', { note: `Your page ${aiPagePath(refreshUrl)} is already the page for this search. Improve it so it answers this question.`, refresh: refreshUrl });
  }
  // 5. a page for the same search is being written or waits to be published: no second page
  const pending = written.find((w) => !isLive(w) && keyword && LRU.sameSearch(low(w.keyword), keyword));
  if (pending) return out('none', { note: `A page for "${pending.keyword}" is already written or being written. Publish it first, then improve it for this question.` });
  return out('write');
}
