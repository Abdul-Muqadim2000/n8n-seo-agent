// H3 (2026-10-28): the screens' own pure helpers for the review of a written page (questions, the editor, the comparison). The rules that
// the server shares (delivery status, answers, facts, safe Markdown) live in @seo/shared page-review.ts; these only shape what a screen shows.
import { allowedDecisions, diffBlocks, parseBlocks, personLabel, TOP_QUESTIONS,type AnswerDecision, type BlockKind, type PageAnswer, type PageBlock, type PageReviewView } from '@seo/shared';

export type ReviewQuestion = PageReviewView['questions'][number];

/** The questions as the panel lists them: the top ones to answer first, the optional rest, and those the business details already answer. */
export function groupQuestions(questions: readonly ReviewQuestion[]): { top: ReviewQuestion[]; optional: ReviewQuestion[]; stored: ReviewQuestion[] } {
  const open = questions.filter((q) => !q.stored).slice().sort((a, b) => a.rank - b.rank);
  return { top: open.slice(0, TOP_QUESTIONS), optional: open.slice(TOP_QUESTIONS), stored: questions.filter((q) => !!q.stored) };
}

/** How many of the open questions have an answer (skip is not an answer). */
export function answeredCount(view: Pick<PageReviewView, 'questions' | 'answers'>): { answered: number; total: number } {
  const open = view.questions.filter((q) => !q.stored);
  return { answered: open.filter((q) => view.answers[q.id] && view.answers[q.id]!.decision !== 'skip').length, total: open.length };
}

/** What the page says about a statement now, in words: the specific sentence and its stand-in. */
export function contextLines(q: Pick<ReviewQuestion, 'original' | 'neutral' | 'in_page'>): { specific: string; now: string; nowLabel: string } {
  const now = q.in_page === 'left_out' || !q.neutral ? '' : q.neutral;
  return {
    specific: q.original,
    now,
    nowLabel: q.in_page === 'cta' ? 'The page now ends with a simple invitation instead' : now ? 'The page says this instead for now' : 'The page leaves this out for now',
  };
}

/** The choices a question offers, in the order the panel shows them ("Leave it general" always visible). */
export function choicesFor(q: Pick<ReviewQuestion, 'answer_type'>): AnswerDecision[] {
  const all = allowedDecisions(q);
  const order: AnswerDecision[] = ['yes', 'answer', 'edit', 'general', 'remove', 'skip'];
  return order.filter((d) => all.includes(d));
}

/** The decision a question shows as chosen, and the text in its field. */
export function currentChoice(q: ReviewQuestion, a: PageAnswer | undefined): { decision: AnswerDecision | null; text: string } {
  if (!a) return { decision: null, text: q.answer_type === 'text' ? q.prefill : '' };
  return { decision: a.decision, text: a.decision === 'edit' || a.decision === 'answer' ? a.text : '' };
}

// ---------- the editor ----------

export const KIND_LABEL: Record<BlockKind, string> = {
  meta: 'Page setting',
  heading: 'Heading',
  paragraph: 'Paragraph',
  list: 'List',
  table: 'Table',
  quote: 'Quote',
  image: 'Image',
  blank: 'Space',
};

/** A new block's starting text, by kind. */
export const NEW_BLOCK: Record<'heading' | 'paragraph' | 'list' | 'table' | 'quote', string> = {
  heading: '## New section',
  paragraph: 'New paragraph.',
  list: '- First point\n- Second point',
  table: '| Column | Column |\n| --- | --- |\n| Value | Value |',
  quote: '> A short quote.',
};

/** The blocks the editor shows (blank lines are kept between blocks when the page is put back together). */
export const editableBlocks = (md: string): PageBlock[] => parseBlocks(md).filter((b) => b.kind !== 'blank');
/** The page from its blocks, one blank line between blocks. */
export const blocksToMarkdown = (blocks: readonly Pick<PageBlock, 'text'>[]): string =>
  blocks
    .map((b) => b.text.replace(/\s+$/, ''))
    .filter((t) => t.trim())
    .join('\n\n')
    .concat('\n');

/** A heading's text at another level (1-4). */
export function setHeadingLevel(text: string, level: number): string {
  const l = Math.min(4, Math.max(1, Math.round(level)));
  return `${'#'.repeat(l)} ${text.replace(/^\s*#{1,6}\s*/, '')}`;
}

export function moveBlock<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list.slice();
  const out = list.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x!);
  return out;
}

/** Undo history: a bounded stack of earlier texts. */
export interface History {
  past: string[];
  present: string;
}
export const historyStart = (md: string): History => ({ past: [], present: md });
export function historyPush(h: History, md: string, limit = 50): History {
  if (md === h.present) return h;
  return { past: [...h.past, h.present].slice(-limit), present: md };
}
export function historyUndo(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]! };
}

/** The comparison in counts, for its heading ("3 changed, 1 added, 0 removed"). */
export function diffCounts(beforeMd: string, afterMd: string): { changed: number; added: number; removed: number; same: number } {
  const d = diffBlocks(beforeMd, afterMd);
  return {
    changed: d.filter((x) => x.kind === 'changed').length,
    added: d.filter((x) => x.kind === 'added').length,
    removed: d.filter((x) => x.kind === 'removed').length,
    same: d.filter((x) => x.kind === 'same').length,
  };
}

/** " by <name>" for a person a review names (approved, saved), or an empty string when nobody is recorded. A name or e-mail, never an id. */
export function byPerson(view: Pick<PageReviewView, 'people'>, id: string | null | undefined): string {
  const who = personLabel(view.people, id);
  return who ? ` by ${who}` : '';
}
