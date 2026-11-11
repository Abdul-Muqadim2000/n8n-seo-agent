// W0-D (page-quality programme 2026-10-29, n8n/seo-agent/docs/page-quality-2026-10-29/PLAN.md Fix 4): a page the engine held for the
// client's OK before writing it. The engine's *Parse Verdict* holds a page run when its verdict scored the keyword under 50 or the website
// already has a page for the same search; the callback keeps stage `content` (the run completes, only the check is charged) and carries
// `hold: { score, threshold, kinds, reasons, alternatives, duplicates, rule, next, mode }`. A run the cadence or a ladder started is only
// checked in trial ("shadow") mode for now (owner decision D17): its page is written and the report carries `hold_shadow`.
// This file reads both for every screen (the report, Needs you, the summaries) and builds the three buttons' form values.
import { HOLD_CHECK_USD } from './cost';

export const HOLD_THRESHOLD = 50;
/** W05-B (2026-10-30): under this the score alone holds a page; from here to HOLD_THRESHOLD only with a second signal (little demand, or a page the website already has) */
export const HOLD_CLEAR = 40;
/** The rule as the forms say it (REVIEW_CODE M2: the score itself is shown only in the hold, the Keyword Check has no verdict score). */
export const HOLD_RULE =
  'Before writing, we check the keyword. A page waits for your OK when our verdict scores the keyword under 40 out of 100, or under 50 when few people search for it, or when your website already has a page for the same search. A held keyword uses only the check.';
/** What a hold costs, the check alone (owner decision D8), in US dollars of provider cost (credits through the billing settings). */
export const HOLD_COST_USD = HOLD_CHECK_USD;

/** `ladder_stop` (LADDER PACKAGE, engine build section 183): a page of a keyword ladder its own check advised against (AVOID) */
export type HoldKind = 'score' | 'duplicate' | 'ladder_stop';
/**
 * Client reports 2026-11-11 (techand.ai, "what is a crm company", runs b3af6cae / 8f0a4bc3): the held page is a page of a keyword ladder.
 * Its "Write it anyway" must write it AS that ladder page (the run keeps the ladder row, the planned address, the links to the ladder's main
 * page and the content log in step), not as a loose page: the run that wrote nothing on 2026-11-10 15:23 went out without these fields.
 * Read from the hold's `ladder_stop` and the callback's own `ladder_id` / `ladder_rung` / `ladder_head` (the engine echoes the request's).
 */
export interface HoldLadder {
  id: string;
  rung: number;
  head: string;
  /** the engine stopped this ladder page on its own check (AVOID); false: an ordinary hold of a page that belongs to a ladder */
  stopped: boolean;
}
/** the ladder fields the Write a page form takes (shared/src/schemas.ts keyword `ladder`) */
export interface HoldLadderInput {
  id: string;
  rung: number;
  head: string;
  pageNo: number;
}
export interface HoldAlternative {
  kind: 'improve' | 'retarget' | 'rung';
  label: string;
  keyword: string;
  url: string;
  pageType: string;
  ladderId: string;
  why: string;
}
export interface HoldInfo {
  /** true: nothing was written, the client decides; false: trial mode, the page was written and this only says what would have been asked */
  held: boolean;
  score: number | null;
  threshold: number;
  kinds: HoldKind[];
  reasons: string[];
  alternatives: HoldAlternative[];
  duplicates: { url: string; title: string }[];
  rule: string;
  next: string;
  /** the keyword ladder this page belongs to, or null */
  ladder: HoldLadder | null;
}

type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** what the form schema accepts for a ladder (id 3-64, rung a whole 0-10): anything else would only fail at submit */
const LADDER_ID_RE = /^[A-Za-z0-9_-]{3,64}$/;
const rungOf = (v: unknown): number | null => {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
};

/** The keyword ladder of a stored content payload (its hold's `ladder_stop`, else the callback's ladder fields), or null. */
export function holdLadderOf(payload: P | null | undefined, hold?: P): HoldLadder | null {
  const p = payload ?? {};
  const stop = obj((hold ?? obj(p.hold)).ladder_stop);
  const id = str(stop.ladder_id) || str(p.ladder_id);
  const rung = rungOf(stop.rung) ?? rungOf(p.ladder_rung);
  if (!LADDER_ID_RE.test(id) || id === '_site' || rung == null) return null;
  return { id, rung, head: str(p.ladder_head).slice(0, 120), stopped: Object.keys(stop).length > 0 };
}

/** The ladder fields of the run that wrote this report (its stored form input), when they are valid; else null. */
export function ladderInputOf(input: unknown): HoldLadderInput | null {
  const l = obj(obj(input).ladder);
  const id = str(l.id);
  const rung = rungOf(l.rung);
  if (!LADDER_ID_RE.test(id) || rung == null) return null;
  const pageNo = typeof l.pageNo === 'number' && Number.isInteger(l.pageNo) && l.pageNo >= 0 && l.pageNo <= 100 ? l.pageNo : 0;
  return { id, rung, head: str(l.head).slice(0, 120), pageNo };
}

/** "a page of your keyword ladder "crm service provider" (rung 2)" / "... (its main page)" */
export function holdLadderLine(l: Pick<HoldLadder, 'head' | 'rung'>): string {
  const where = l.rung >= 4 ? 'its main page' : `rung ${l.rung}`;
  return `a page of your keyword ladder${l.head ? ` "${l.head}"` : ''} (${where})`;
}

/** The hold of a stored content payload: `hold` (held, the client decides) or `hold_shadow` (trial mode); null when there is none. */
export function holdOf(payload: P | null | undefined): HoldInfo | null {
  const p = payload ?? {};
  const held = obj(p.hold);
  const shadow = obj(p.hold_shadow);
  const h = Object.keys(held).length ? held : Object.keys(shadow).length ? shadow : null;
  if (!h) return null;
  const kinds = arr(h.kinds).map(String).filter((k): k is HoldKind => k === 'score' || k === 'duplicate' || k === 'ladder_stop');
  return {
    held: h === held,
    score: numOrNull(h.score),
    threshold: numOrNull(h.threshold) ?? HOLD_THRESHOLD,
    kinds,
    reasons: arr(h.reasons).map(str).filter(Boolean).slice(0, 4),
    alternatives: arr(h.alternatives)
      .map(obj)
      .filter((a) => a.kind === 'improve' || a.kind === 'retarget' || a.kind === 'rung')
      .map((a) => ({
        kind: a.kind as HoldAlternative['kind'],
        label: str(a.label),
        keyword: str(a.keyword),
        url: /^https?:\/\//i.test(str(a.url)) ? str(a.url) : '',
        pageType: str(a.page_type),
        ladderId: str(a.ladder_id),
        why: str(a.why),
      }))
      .filter((a) => (a.kind === 'improve' ? !!a.url : !!a.keyword))
      .slice(0, 3),
    duplicates: arr(h.duplicates).map(obj).map((d) => ({ url: str(d.url), title: str(d.title) })).filter((d) => /^https?:\/\//i.test(d.url)).slice(0, 3),
    rule: str(h.rule) || HOLD_RULE,
    next: str(h.next),
    ladder: holdLadderOf(p, h),
  };
}

/** "Needs your OK: "ms 365 erp" scored 42" / "... your website already has a page for it". */
export function holdTitle(keyword: string, h: Pick<HoldInfo, 'score' | 'kinds'> & { ladder?: HoldLadder | null }): string {
  const k = keyword ? `"${keyword}"` : 'this keyword';
  // a ladder page its own check advised against: say whose page it is (the score is in the reason)
  if (h.kinds.includes('ladder_stop')) return `Needs your OK: ${k}, ${holdLadderLine(h.ladder ?? { head: '', rung: 0 })}${h.score != null ? `, scored ${h.score}` : ''}`;
  if (h.kinds.includes('score') && h.score != null) return `Needs your OK: ${k} scored ${h.score}`;
  if (h.kinds.includes('duplicate')) return `Needs your OK: your website already has a page for ${k}`;
  return `Needs your OK: ${k}`;
}

export interface HoldButton {
  id: 'write_anyway' | 'improve' | 'retarget' | 'rung';
  label: string;
  why: string;
  /** the Write a page form's values (app/web tools/forms/research.tsx KeywordForm) */
  prefill: Record<string, unknown>;
}

/**
 * The buttons of a held page, in order: the alternatives the engine proposed (improve the existing page first), then "Write it anyway",
 * which re-sends the same page with `holdAck` (the engine writes it and says it was acknowledged; the fit limit stays in its grade).
 * A page of a keyword ladder is re-sent WITH its ladder (`base.ladder`, the original run's own fields when the app has them, else the
 * ladder the report names with page number 0): the run then carries force_content and the ladder fields (payload.ts), the server adds the
 * planned address and the links (runs.ts ladderPageContext) and the ladder row and content log follow the page.
 */
export function holdButtons(h: HoldInfo, base: { keyword: string; pageType?: string; country?: string; ladder?: HoldLadderInput | null }): HoldButton[] {
  const common = (pageType?: string) => ({ ...(base.country ? { country: base.country } : {}), ...(pageType ? { pageType } : {}) });
  const out: HoldButton[] = [];
  for (const a of h.alternatives) {
    if (a.kind === 'improve')
      // W05-B: the engine may offer the page Google shows for the search beside the page the website has for it, each with its own label
      out.push({ id: 'improve', label: a.label || 'Improve the existing page', why: a.why, prefill: { keyword: base.keyword, existingPageUrl: a.url, ...common(base.pageType) } });
    else if (a.kind === 'retarget')
      out.push({ id: 'retarget', label: 'Use the recommended target', why: a.why, prefill: { keyword: a.keyword, ...common(a.pageType || base.pageType) } });
    else out.push({ id: 'rung', label: 'Write the planned page', why: a.why, prefill: { keyword: a.keyword, ...common(base.pageType) } });
  }
  const own = base.ladder && h.ladder && base.ladder.id === h.ladder.id ? base.ladder : null;
  const ladder: HoldLadderInput | null = own ?? (h.ladder ? { id: h.ladder.id, rung: h.ladder.rung, head: h.ladder.head, pageNo: 0 } : base.ladder ?? null);
  out.push({
    id: 'write_anyway',
    label: 'Write it anyway',
    why: ladder
      ? `it is written as ${holdLadderLine(ladder)}, at the address the ladder planned for it and linked to ${ladder.rung >= 4 ? "the ladder's other pages" : "the ladder's main page"}; you know this keyword is worth a page`
      : h.kinds.includes('duplicate')
        ? 'a separate new page is written at a new address of its own and your existing page stays as it is; two pages for the same search compete with each other, so it is your call'
        : 'you know this keyword is worth a page',
    prefill: { keyword: base.keyword, ...common(base.pageType), ...(ladder ? { ladder: { ...ladder, head: ladder.head || h.ladder?.head || '' } } : {}), holdAck: { score: h.score } },
  });
  return out;
}
