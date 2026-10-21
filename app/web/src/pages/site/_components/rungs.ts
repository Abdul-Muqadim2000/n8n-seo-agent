// B6 (pre-launch run 2026-10-21): what a keyword-ladder page is, in words, on the Rankings page. The browser pass found the engine's
// raw status (`not_ready`) shown as a badge, "Write page" offered on a draft the quality check had refused and on pages waiting for the
// author profile, and the rungs numbered 4, 2, 1 where the ladder page says "Rung 1, Rung 2, Main page". One reading, shared by the rows,
// the hero's next step and the ladder card.

/** The engine's rung numbers: 1-3 climb, 4 is the head term's own page (the ladder page calls it "Main page"). */
export const MAIN_RUNG = 4;
export const rungName = (rung: number): string => (rung >= MAIN_RUNG ? 'Main page' : `Rung ${rung}`);

export type RungState = 'live' | 'written' | 'fix' | 'held' | 'set_aside' | 'planned';

export interface RungView {
  state: RungState;
  label: string;
  /** the one thing to do: see the live page, report it published, edit the draft by hand (its ladder page opens the report), finish the
   *  profile, or write it. Never a re-run of a draft (E-QA 2026-10-21: a new run is a new, charged page and loses the edits). */
  action: 'view' | 'report' | 'edit' | 'profile' | 'write' | null;
}

const WRITTEN = new Set(['writing', 'started', 'written']);

/**
 * A ladder page's state from the ladder row's status and the website's readiness for a written page (author profile + business facts,
 * shared/src/readiness.ts). Unknown statuses read as planned, never as their raw code.
 */
export function rungView(status: string, ready = true): RungView {
  const s = String(status || '').toLowerCase();
  if (s === 'published') return { state: 'live', label: 'Published', action: 'view' };
  if (WRITTEN.has(s)) return { state: 'written', label: 'Written, not live', action: 'report' };
  if (s === 'not_ready') return { state: 'fix', label: 'Needs your edits', action: 'edit' };
  if (s === 'set_aside') return { state: 'set_aside', label: 'Set aside', action: null };
  if (!ready) return { state: 'held', label: 'Waits for your profile', action: 'profile' };
  return { state: 'planned', label: 'Planned', action: 'write' };
}

/** "4 pages: the main page and 2 rungs" (the ladder page's words) */
export function ladderShape(pages: number, rungs: readonly number[]): string {
  const set = [...new Set(rungs)];
  const main = set.some((r) => r >= MAIN_RUNG);
  const climb = set.filter((r) => r < MAIN_RUNG).length;
  const parts = [main ? 'the main page' : '', climb ? `${climb} ${climb === 1 ? 'rung' : 'rungs'}` : ''].filter(Boolean);
  return `${pages} ${pages === 1 ? 'page' : 'pages'}${parts.length ? `: ${parts.join(' and ')}` : ''}`;
}
