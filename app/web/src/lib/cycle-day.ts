import { useContext } from 'react';
import { ENGINE_TIMEZONE, isValidTimezone, localDateOf, WEEKDAY_NAMES, type Site } from '@seo/shared';
import { SiteContext } from './context';

// Keyword-first (SCHEDULING_KEYWORDS_PLAN.md §4.2): every website has its own weekly cycle, on the weekday its tracking started (or the
// weekday the owner chose). Screens name that day ("every Wednesday") instead of a fixed Monday, and say "each week" when the day is not
// known yet (tracking not started, or a screen outside one website).

type CycleSite = Pick<Site, 'trackingStartedAt'> & Partial<Pick<Site, 'cycleWeekday' | 'timezone'>>;

/** The browser's IANA time zone ('' when the browser does not say or names one the platform does not know). */
export function browserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    return isValidTimezone(tz) ? tz : '';
  } catch {
    return '';
  }
}

/** The website's zone: its own, else the engine's. */
export const siteTimezone = (site: Partial<Pick<Site, 'timezone'>> | null | undefined): string => (site?.timezone && isValidTimezone(site.timezone) ? site.timezone : ENGINE_TIMEZONE);

/**
 * The weekday (0 Sunday - 6) of the website's weekly cycle: the one the owner chose, else the weekday tracking started on in the
 * website's zone; null before tracking starts.
 */
export function siteWeekday(site: CycleSite | null | undefined): number | null {
  if (!site) return null;
  if (site.cycleWeekday != null && site.cycleWeekday >= 0 && site.cycleWeekday <= 6) return site.cycleWeekday;
  const t = site.trackingStartedAt ? Date.parse(site.trackingStartedAt) : NaN;
  if (!Number.isFinite(t)) return null;
  return localDateOf(siteTimezone(site), t).weekday;
}

/** "Wednesday", or null when the website has no cycle yet. */
export const siteWeekdayName = (site: CycleSite | null | undefined): string | null => {
  const wd = siteWeekday(site);
  return wd == null ? null : WEEKDAY_NAMES[wd];
};

/** The weekday a website that starts tracking now would get: today in the browser's zone (onboarding, before the cycle exists). */
export function todayWeekdayName(now = Date.now()): string {
  const tz = browserTimezone() || ENGINE_TIMEZONE;
  return WEEKDAY_NAMES[localDateOf(tz, now).weekday];
}

/** "every Wednesday", or "each week" when the day is not known. */
export const everyCycleDay = (site: CycleSite | null | undefined): string => {
  const n = siteWeekdayName(site);
  return n ? `every ${n}` : 'each week';
};

/** "on Wednesday", or "in the next weekly run" when the day is not known. */
export const onCycleDay = (site: CycleSite | null | undefined): string => {
  const n = siteWeekdayName(site);
  return n ? `on ${n}` : 'in the next weekly run';
};

/** The website of the page, when the screen is inside one website (null elsewhere, e.g. a report opened from the runs list). */
export function useMaybeSite(): Site | null {
  return useContext(SiteContext)?.site ?? null;
}

/** The current website's cycle day in words: `{ name: 'Wednesday' | null, every: 'every Wednesday' | 'each week', on: 'on Wednesday' | ... }`. */
export function useCycleDay(site?: CycleSite | null) {
  const ctx = useMaybeSite();
  const s = site === undefined ? ctx : site;
  return { name: siteWeekdayName(s), every: everyCycleDay(s), on: onCycleDay(s) };
}
