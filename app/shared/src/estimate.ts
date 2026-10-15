import { MODES, type ModeId } from './constants';

// How long one run takes, from its form values.
//
// The **cost** of a run is deliberately not here any more. It moved to `cost.ts`, which is the one table the app keeps and the only
// place a per-mode price may be written down (B-R3 / B-B1): this file used to hold a second set of figures that drifted 1.3x-2.5x
// away from what runs really cost. Both are exported from the package barrel, so `estimateRunCost` is imported exactly as before.

type V = Record<string, unknown>;
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const pages = (v: V) => Math.min(3, Math.max(1, num(v.pagesNow, 1)));

export function estimateRunMinutes(mode: ModeId, v: V): number {
  if (mode === 'ladder') return MODES.ladder.etaMinutes + pages(v) * 10;
  if (mode === 'audit' && v.reportType === 'full') return 30;
  if (mode === 'keyword' && v.receiveContent === false) return 5;
  return MODES[mode].etaMinutes;
}
