// AI-FOCUS (2026-10-27, n8n/seo-agent/docs/ai-panel-focus-2026-10-27/RESEARCH_AND_DESIGN.md): the AI question panel follows the client's focus.
//
// The rule itself is the engine's kit (n8n/seo-agent/v5/code/_ai_focus.js), written unchanged to ai-focus.generated.js by build_v4.py
// (ai_focus_app.py); ai-focus.parity.test.ts fails while it is stale. This module re-exports it with types and adds what the app does with it:
//   * aiPanelFocus(ctx)  the website's focus topics and what the weekly run would do with its stored questions (the panel manager's topic view);
//   * two checks of the one warning registry (consistency.ts CONSISTENCY_CHECKS), with Accept / Continue anyway:
//       ai.panel_off_focus      most of the questions are about something the website no longer works on (Accept: retire them, the next weekly
//                               check writes questions about the focus in their place);
//       ai.ladder_not_measured  a keyword ladder the panel has no room for (Accept: a bigger panel, with its price a month).
//     The market side (questions about other places, a changed country) stays with M7 (ai.question_place) and is not repeated here.

import { AIF } from './ai-focus.generated.js';
import type { AiFocus, AiFocusQuestion, AiFocusReconcile, AiFocusTopic } from './ai-focus.generated.js';
import type { ConsistencyCheck, ConsistencyCtx, Warning } from './consistency';
import type { NeedsYouItem } from './data';

export { AIF };
export type { AiFocus, AiFocusQuestion, AiFocusReconcile, AiFocusTopic, AiFocusState } from './ai-focus.generated.js';

/** What the server reads about a website for its AI panel's focus (each part optional: a part it could not read is simply not judged). */
export interface AiFocusContext {
  /** the panel size the client pays for (questions, the brand question included) */
  panelSize: number;
  /** the website's own country, ISO-2 */
  iso: string;
  /** the market its questions are asked in, e.g. 'PK-en' */
  ownMarket?: string;
  /** extra markets the owner set */
  markets?: readonly string[];
  /** the website's keyword ladders with their status (seo_ladder_settings) */
  ladders: readonly { id: string; head: string; status?: string; chosenBy?: string; createdAt?: string; rungs?: readonly string[] }[];
  /** pages written / published (content log) */
  pages?: readonly { keyword: string; status: string; at?: string }[];
  /** the services the client declared (never the crawl's guesses) */
  services: readonly string[];
  /** the keywords it tracks */
  keywords: readonly string[];
  /** the stored questions (every status) */
  questions: readonly AiFocusQuestion[];
  /** 'off' = the panel never moves by itself (no off-focus warning then) */
  focusMode?: 'auto' | 'off';
  /** the price a month of `raiseTo` questions over the current panel, in the customer's words (e.g. "about 40 credits a month") */
  raisePrice?: (raiseTo: number) => string;
}

/** The website's focus and the weekly run's reconcile of its stored panel, as the engine computes them. */
export function aiPanelFocus(c: AiFocusContext, now = new Date().toISOString()): { focus: AiFocus; rec: AiFocusReconcile } {
  const focus = AIF.focusOf({
    ladders: c.ladders.flatMap((l) => [{ ladder_id: l.id, head_keyword: l.head, rung: 4, keyword: l.head }, ...(l.rungs ?? []).map((k) => ({ ladder_id: l.id, head_keyword: l.head, rung: 2, keyword: k }))]),
    settings: c.ladders.map((l) => ({ ladder_id: l.id, status: l.status ?? 'active', chosen_by: l.chosenBy ?? '', created_at: l.createdAt ?? '' })),
    content_log: (c.pages ?? []).map((p) => ({ keyword: p.keyword, status: p.status, published_at: p.at ?? '' })),
    keywords: c.keywords,
    services: c.services,
    iso: c.iso,
    now,
  });
  const rec = AIF.reconcile({ stored: c.questions, focus, N: c.panelSize, now, full: true, weeks: 99, own_market: c.ownMarket ?? '', markets: c.markets ?? [], ladder_ids: c.ladders.map((l) => l.id) });
  return { focus, rec };
}

/** The topic label of each live question (for grouping in the panel manager); '' = none of the website's focus topics. */
export function questionTopics(c: AiFocusContext): Map<string, { topic: string; state: string }> {
  const { rec } = aiPanelFocus(c);
  return new Map(rec.topic_of.map((t) => [t.prompt_id, { topic: t.topic, state: t.state }]));
}

const q = (s: string) => `"${s}"`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
function fp(parts: readonly string[]): string {
  let h = 2166136261;
  for (const ch of [...parts].sort().join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
}
const live = (p: AiFocusQuestion) => !p.status || p.status === 'active';

/** AI-FOCUS: most of the panel asks about something none of the website's ladders, pages, services or keywords cover. */
export const AI_PANEL_OFF_FOCUS: ConsistencyCheck = {
  code: 'ai.panel_off_focus',
  severity: 'data',
  on: ['site_standing'],
  run: (_a, _i, ctx: ConsistencyCtx) => {
    const c = ctx.aiFocus;
    if (!c || c.focusMode === 'off') return [];
    const { focus, rec } = aiPanelFocus(c);
    const active = focus.topics.filter((t) => t.state === 'active').sort((a, b) => b.weight - a.weight);
    if (!active.length) return [];
    const qs = c.questions.filter((p) => live(p) && p.kind !== 'brand');
    if (qs.length < 3) return [];
    const of = new Map(rec.topic_of.map((t) => [t.prompt_id, t]));
    const off = qs.filter((p) => { const t = of.get(p.prompt_id); return !t || !t.topic || t.state === 'out' || t.state === 'watch'; });
    if (off.length * 2 <= qs.length) return [];
    const autoOff = off.filter((p) => !AIF.ownerQ(p));
    const about = (() => { const m = new Map<string, number>(); for (const p of off) { const k = String(p.focus_topic || p.cluster || p.keyword || p.topic || '').trim().toLowerCase(); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other subjects'; })();
    const focusLabel = active[0].label;
    const w: Warning = {
      id: `ai.panel_off_focus:${fp(off.map((p) => p.prompt_id))}:${focusLabel}`,
      code: 'ai.panel_off_focus',
      severity: 'data',
      tone: 'warning',
      title: `Most of your AI questions are about ${q(about)}, but your keywords are about ${q(focusLabel)}`,
      body: `${plural(off.length, 'of your ' + qs.length + ' AI question')} measure something you no longer work on, so your AI visibility does not show how you do on ${q(focusLabel)}. Ask about ${q(focusLabel)} instead: the questions are retired (their history is kept) and the next weekly AI check writes new ones, at the same price.${autoOff.length < off.length ? ` Questions you added yourself are kept.` : ''}`,
      short: `${plural(off.length, 'question')} off your keywords`,
      confirm: 'Keep these questions',
      message: '',
      ...(ctx.siteApi && autoOff.length
        ? { accept: { label: `Ask about ${q(focusLabel)} instead`, change: { kind: 'call' as const, method: 'POST' as const, path: `${ctx.siteApi}/admin`, body: { action: 'ai_prompts', retire: autoOff.map((p) => p.prompt_id) } } } }
        : {}),
    };
    w.message = `${w.title}. ${w.body}`;
    return [w];
  },
};

/** AI-FOCUS: a keyword ladder the panel has no room for (each topic needs at least 2 questions to be a readable trend). */
export const AI_LADDER_NOT_MEASURED: ConsistencyCheck = {
  code: 'ai.ladder_not_measured',
  severity: 'money',
  on: ['site_standing'],
  run: (_a, _i, ctx: ConsistencyCtx) => {
    const c = ctx.aiFocus;
    if (!c || c.focusMode === 'off') return [];
    const { rec } = aiPanelFocus(c);
    if (!rec.not_measured.length || !rec.raise_to) return [];
    const names = rec.not_measured.map((t) => q(t.label));
    const n = rec.raise_to - c.panelSize;
    const price = c.raisePrice ? c.raisePrice(rec.raise_to) : '';
    const w: Warning = {
      id: `ai.ladder_not_measured:${fp(rec.not_measured.map((t) => t.id))}:${c.panelSize}`,
      code: 'ai.ladder_not_measured',
      severity: 'money',
      tone: 'info',
      title: `Your AI questions do not cover ${names.slice(0, 2).join(' and ')}${names.length > 2 ? ` and ${names.length - 2} more` : ''} yet`,
      body: `Your panel holds ${c.panelSize} questions and every topic needs at least 2 to show a trend. ${rec.raise_to} questions would cover ${names.length === 1 ? 'it' : 'them'} too${price ? ` (${price})` : ''}.`,
      short: `${plural(rec.not_measured.length, 'keyword')} not measured in AI answers`,
      message: '',
      ...(ctx.siteApi
        ? { accept: { label: `Add ${plural(n, 'question')}${price ? ` (${price})` : ''}`, change: { kind: 'call' as const, method: 'POST' as const, path: `${ctx.siteApi}/admin`, body: { action: 'monitors', monitors: { aiPromptsMax: rec.raise_to } } } } }
        : {}),
    };
    w.message = `${w.title}. ${w.body}`;
    return [w];
  },
};

/** AI-FOCUS: the two panel warnings as "Needs you" items on the Pipeline (the website's banner carries Accept and "Keep these questions"). */
export function aiPanelNeedsYou(warnings: readonly Warning[]): NeedsYouItem[] {
  return warnings
    .filter((w) => w.code === 'ai.panel_off_focus' || w.code === 'ai.ladder_not_measured')
    .map((w) => ({
      id: `ai_panel:${w.id}`,
      kind: 'ai_panel' as const,
      severity: w.tone === 'warning' ? ('warning' as const) : ('info' as const),
      title: w.title,
      detail: w.body,
      action: { label: w.code === 'ai.panel_off_focus' ? 'Review your AI questions' : 'See your AI questions', page: 'ai' },
    }));
}
