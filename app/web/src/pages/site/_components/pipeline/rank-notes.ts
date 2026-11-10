// prod 2026-11-10 (devaicon.com, "Main keyword: not in the top 50, but Google shows it on page one"): the plain lines beside a ladder's
// positions and traffic. Our check is one search in one place; Search Console counts every search and place; a check taken before a page
// went live is kept on the chart and never counted.
import { compactNumber, type LadderDetail, type PageSearchConsole } from '@seo/shared';

/** Where the 28-day totals come from (a page Google reports no single search for counts with its own figures). */
export function trafficHint(l: Pick<LadderDetail, 'traffic'>): string {
  const shown = `${compactNumber(l.traffic?.impressions28d ?? 0)} times shown on Google (impressions)`;
  return l.traffic?.basis === 'pages' || l.traffic?.basis === 'mixed' ? `${shown}, Search Console, all searches and places, last 28 days` : `${shown}, from Search Console`;
}

/** A chart that holds checks from before a page went live says so (they are kept, never counted). */
export const BEFORE_PUBLISH_NOTE = 'Checks taken before a page went live stay on the chart but do not count in its position or its change.';

/** A live page's own Search Console figures, in one line ('' when Search Console has not measured it). */
export function pageGscText(g: PageSearchConsole | null | undefined): string {
  if (!g) return '';
  const shown = `${compactNumber(g.impressions)} ${g.impressions === 1 ? 'time' : 'times'} shown`;
  const clicks = `${compactNumber(g.clicks)} ${g.clicks === 1 ? 'click' : 'clicks'}`;
  const pos = g.position != null ? `, about #${g.position} on average` : '';
  return `${shown}, ${clicks}${pos} (Search Console, all searches and places, last 28 days)`;
}
