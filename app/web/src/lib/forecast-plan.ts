import type { AutopilotLevel, PipelineData, Site } from '@seo/shared';

/**
 * The plan behind a website's monthly forecast, read from the Pipeline's data the way the server's forecast reads the engine
 * (server/src/services/billing.ts `siteAutopilotRows`): the autopilot level, whether a keyword the client chose still has pages to write,
 * and whether there is a keyword ladder to rank-check. Pre-launch run 2026-10-21 (B4): the settings screens forecast without the ladders'
 * rank check while the Pipeline counted it, so one website read 567 and 573 credits a month on two screens.
 */
export function forecastPlanOf(d: Pick<PipelineData, 'ladderCards' | 'autopilot' | 'automation'> | null | undefined, site?: Pick<Site, 'autopilotLevel'> | null): { level: AutopilotLevel; writing: boolean; ranking: boolean } {
  const raw = d?.autopilot?.level ?? d?.automation?.autopilotLevel ?? site?.autopilotLevel ?? 2;
  const level: AutopilotLevel = raw === 1 || raw === 3 ? raw : 2;
  const cards = d?.ladderCards ?? [];
  const notChosen = d?.autopilot?.notChosen ?? [];
  // a keyword the client chose (Auto, not won or paused) still has pages to write: the forecast counts the weekly pages
  const writing = cards.some((c) => c.mode !== 'manual' && c.status !== 'won' && c.status !== 'paused' && c.counts.planned > 0 && !notChosen.includes(c.id));
  return { level, writing, ranking: cards.length > 0 };
}
