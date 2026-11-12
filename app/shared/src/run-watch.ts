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

/**
 * Writing slots (P1, 2026-11-12, prod review S1-01): the engine writes at most two pages at the same time. A page run that finds both slots
 * taken waits in line and tells the app with a progress callback of stage `page_slot` (`slot: 'waiting'` with how many pages are ahead and
 * an estimate, then `slot: 'started'` once it writes). That callback is not a report: the app only moves the run's stage and its expected
 * time, so a run that waits is never taken for an overdue one (runOverdueMinutes) or expired.
 */
export const PAGE_SLOT_STAGE = 'page_slot';
/** the run's lastStage while its page waits for a writing slot */
export const PAGE_WAITING = 'page_waiting';
/** the run's lastStage once its page took a slot after waiting */
export const PAGE_WRITING = 'page_writing';
/** what the run page says while a page waits for its slot */
export const PAGE_WAITING_NOTE = 'Pages are written two at a time; yours starts as soon as one finishes. Nothing is charged while it waits.';
/**
 * Prod review 2026-11-12 (S1-05): how long a page run may be on its way. A page run runs at most 2 hours (the engine's executionTimeout
 * 7200, AIR-PAGETIME); one more hour of margin for a slow callback. A content-log row still `started` after this never finished: it is no
 * page, never a page waiting to be published, and it never counts towards the pile-up limit. The writing-slot gate (plan P1, branch
 * fix/page-slots, not deployed) lets a page wait up to 6 hours before it runs and raises this to 8 together with Cadence_Plan.js.
 */
export const PAGE_IN_FLIGHT_HOURS = 3;
/** the engine's Cadence_Plan.js `in_flight_hours` (the cadence's "already started this week" window); 8 with plan P1 */
export const CADENCE_IN_FLIGHT_HOURS = 2;
