/**
 * When a run that has not answered counts as overdue (prod 2026-11-04, devaicon.com: a one-minute publish check sat at "Queued in the
 * SEO engine" for over an hour, because the engine's host was cut off after it had accepted the run).
 *
 * Past this point the server stops waiting for the result by itself: it asks the engine whether anything is still working on the run and
 * closes the run when nothing is (app/server/src/services/engineFailures.ts). The run page shows the same moment, so what it says matches
 * what the server does. Before it, the run is left to the engine: slow AI models and large sites are normal, an hour of silence on a
 * one-minute check is not.
 */
export const RUN_OVERDUE_MIN_MINUTES = 10;

/** Minutes after acceptance at which a run with no result is overdue: three times its expected time, never under 10 minutes. */
export function runOverdueMinutes(etaMinutes: number | null | undefined): number {
  const eta = Number.isFinite(etaMinutes as number) ? Math.max(0, etaMinutes as number) : 0;
  return Math.max(RUN_OVERDUE_MIN_MINUTES, 3 * eta);
}

/** Minutes a result may take to arrive after the engine's last execution of the run ended, before it counts as lost on the way. */
export const RUN_RESULT_GRACE_MINUTES = 10;
