import { AUTOMATIONS, nextScheduledRun, type AutomationStatus, type CycleIntent } from '@seo/shared';
import type { SiteRow } from '../db/schema';

/**
 * CR17 review R5 L7: ONE "next AI check" for every screen. The AI visibility page and the Pipeline's write form used to show two dates
 * (the page added a day or a week to the last run, the form read the schedule). Both now read the schedule the Pipeline works out: the
 * next run of the daily pulse while it is on, else of the weekly AI visibility check in the website's cycle; '' when neither runs.
 * Pure; no import of pipeline.ts or data.ts (both use it).
 */

export type TrackingState = 'active' | 'paused' | 'not_started';

/** The website's weekly tracking by one rule (the Pipeline's status and the AI page's schedule): a pause in the app or the engine wins. */
export function trackingStateOf(site: Pick<SiteRow, 'trackingStatus'>, engine: { tracked: boolean; status: string | null }): TrackingState {
  const engineTracked = engine.tracked && engine.status !== 'paused';
  if (site.trackingStatus === 'paused' || engine.status === 'paused') return 'paused';
  return site.trackingStatus === 'active' || engineTracked ? 'active' : 'not_started';
}

/** The next AI check from the automations as the Pipeline lists them: the pulse when it is on, else the weekly check. */
export function nextAiCheckOf(list: readonly Pick<AutomationStatus, 'id' | 'state' | 'nextRunAt'>[]): string {
  const pick = list.find((a) => a.id === 'ai_pulse' && a.state === 'on') ?? list.find((a) => a.id === 'ai_visibility' && a.state === 'on');
  return pick?.nextRunAt ?? '';
}

/** The same date for a screen that has not built the Pipeline's automation list (the AI visibility page): the same states, the same
 *  schedule function (nextScheduledRun), the same zone and cycle. */
export function aiScheduleNextCheck(o: {
  verified: boolean;
  tracking: TrackingState;
  /** monitor settings; undefined = the default (on), as the Pipeline reads them */
  aiVisibility?: boolean;
  aiPulse?: boolean;
  tz: string;
  intent: CycleIntent | null;
  now?: number;
}): string {
  const now = o.now ?? Date.now();
  const tracked = o.verified && o.tracking === 'active';
  const visibility = tracked && (o.aiVisibility ?? true);
  const pulse = visibility && (o.aiPulse ?? true);
  const nextOf = (id: 'ai_pulse' | 'ai_visibility', on: boolean): string | null => {
    if (!on) return null;
    const info = AUTOMATIONS.find((a) => a.id === id);
    return info ? (nextScheduledRun(info.schedule, o.tz, new Date(now), o.intent)?.toISOString() ?? null) : null;
  };
  return nextAiCheckOf([
    { id: 'ai_pulse', state: pulse ? 'on' : 'off', nextRunAt: nextOf('ai_pulse', pulse) },
    { id: 'ai_visibility', state: visibility ? 'on' : 'off', nextRunAt: nextOf('ai_visibility', visibility) },
  ]);
}
