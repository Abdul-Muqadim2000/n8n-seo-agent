// W0-D (page-quality programme 2026-10-29, n8n/seo-agent/docs/page-quality-2026-10-29/PLAN.md Fix 4): a page the engine held for the
// client's OK before writing it. The engine's *Parse Verdict* holds a page run when its verdict scored the keyword under 50 or the website
// already has a page for the same search; the callback keeps stage `content` (the run completes, only the check is charged) and carries
// `hold: { score, threshold, kinds, reasons, alternatives, duplicates, rule, next, mode }`. A run the cadence or a ladder started is only
// checked in trial ("shadow") mode for now (owner decision D17): its page is written and the report carries `hold_shadow`.
// This file reads both for every screen (the report, Needs you, the summaries) and builds the three buttons' form values.
import { HOLD_CHECK_USD } from './cost';

export const HOLD_THRESHOLD = 50;
/** The rule as the forms say it (REVIEW_CODE M2: the score itself is shown only in the hold, the Keyword Check has no verdict score). */
export const HOLD_RULE =
  'Before writing, we check the keyword. A page waits for your OK when our verdict scores the keyword under 50 out of 100, or when your website already has a page for the same search. A held keyword uses only the check.';
/** What a hold costs, the check alone (owner decision D8), in US dollars of provider cost (credits through the billing settings). */
export const HOLD_COST_USD = HOLD_CHECK_USD;

export type HoldKind = 'score' | 'duplicate';
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
}

type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The hold of a stored content payload: `hold` (held, the client decides) or `hold_shadow` (trial mode); null when there is none. */
export function holdOf(payload: P | null | undefined): HoldInfo | null {
  const p = payload ?? {};
  const held = obj(p.hold);
  const shadow = obj(p.hold_shadow);
  const h = Object.keys(held).length ? held : Object.keys(shadow).length ? shadow : null;
  if (!h) return null;
  const kinds = arr(h.kinds).map(String).filter((k): k is HoldKind => k === 'score' || k === 'duplicate');
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
  };
}

/** "Needs your OK: "ms 365 erp" scored 42" / "... your website already has a page for it". */
export function holdTitle(keyword: string, h: Pick<HoldInfo, 'score' | 'kinds'>): string {
  const k = keyword ? `"${keyword}"` : 'this keyword';
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
 */
export function holdButtons(h: HoldInfo, base: { keyword: string; pageType?: string; country?: string }): HoldButton[] {
  const common = (pageType?: string) => ({ ...(base.country ? { country: base.country } : {}), ...(pageType ? { pageType } : {}) });
  const out: HoldButton[] = [];
  for (const a of h.alternatives) {
    if (a.kind === 'improve')
      out.push({ id: 'improve', label: 'Improve the existing page', why: a.why, prefill: { keyword: base.keyword, existingPageUrl: a.url, ...common(base.pageType) } });
    else if (a.kind === 'retarget')
      out.push({ id: 'retarget', label: 'Use the recommended target', why: a.why, prefill: { keyword: a.keyword, ...common(a.pageType || base.pageType) } });
    else out.push({ id: 'rung', label: 'Write the planned page', why: a.why, prefill: { keyword: a.keyword, ...common(base.pageType) } });
  }
  out.push({
    id: 'write_anyway',
    label: 'Write it anyway',
    why: h.kinds.includes('duplicate') ? 'a second page for the same search competes with the one you have; it is your call' : 'you know this keyword is worth a page',
    prefill: { keyword: base.keyword, ...common(base.pageType), holdAck: { score: h.score } },
  });
  return out;
}
