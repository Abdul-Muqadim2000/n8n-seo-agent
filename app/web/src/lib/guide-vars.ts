import { AUTOPILOT_LEVELS, DEFAULT_AUTOPILOT_LEVEL, localDateOf, type AutopilotLevel, type Site, type SiteCycleView } from '@seo/shared';
import { browserTimezone, siteTimezone, siteWeekdayName, todayWeekdayName } from './cycle-day';
import { PRICES } from './prices';

// The website's own values for the weekly-autopilot guides (`@seo/shared/guides`, area 'autopilot'): its weekday, its zone, its monthly
// date, its level and the credits of a page, a plan and a check. Each one falls back to what the website would get if it started today
// (onboarding, before its cycle exists), and a guide opened from the catalogue without any of them reads its own examples.

type GuideSite = Pick<Site, 'domain' | 'trackingStartedAt'> & Partial<Pick<Site, 'timezone' | 'cycleWeekday' | 'autopilotLevel'>>;

/** "level 2 (My keywords and keep my pages healthy)" */
export const levelWords = (l: AutopilotLevel | null | undefined): string => {
  const level = l ?? DEFAULT_AUTOPILOT_LEVEL;
  return `level ${level} (${AUTOPILOT_LEVELS.find((x) => x.level === level)?.label ?? ''})`;
};

/** "day 20 of the month": the monthly date (the day the week started, days after 28 count as 28). */
export const monthlyDateWords = (day: number | null | undefined): string | null => (day != null && day >= 1 ? `day ${Math.min(28, day)} of the month` : null);

export function autopilotGuideVars(site: GuideSite | null | undefined, o: { cycle?: SiteCycleView | null; level?: AutopilotLevel; now?: number } = {}): Record<string, string> {
  const now = o.now ?? Date.now();
  const c = o.cycle?.known ? o.cycle : null;
  const started = !!site?.trackingStartedAt;
  // before tracking starts the week would begin today, in the browser's zone (the zone onboarding sends)
  const tz = c?.timezone || (site?.timezone ? siteTimezone(site) : '') || browserTimezone() || siteTimezone(site);
  const anchor = site?.trackingStartedAt ? Date.parse(site.trackingStartedAt) : now;
  const monthly = c?.monthlyDay ?? (Number.isFinite(anchor) ? localDateOf(tz, anchor).day : null);
  const out: Record<string, string> = {
    weekday: c?.weekdayName ?? siteWeekdayName(site) ?? (started ? '' : todayWeekdayName(now)),
    timezone: tz,
    monthlyDate: monthlyDateWords(monthly) ?? '',
    level: levelWords(o.level ?? site?.autopilotLevel),
    pageCredits: `about ${PRICES.page()}`,
    planCredits: `about ${PRICES.plan()}`,
    checkCredits: `about ${PRICES.check()}`,
  };
  if (site?.domain) out.domain = site.domain;
  return out;
}
