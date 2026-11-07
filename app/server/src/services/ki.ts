// KI: keyword intelligence (docs/keyword-intel-2026-11-08/CONTRACTS.md §1, §7). W0 holds the one rule the run path needs now: a Competitors
// or Keyword research run starts only when the website's engine setting (seo_monitors.ki_mode) is On, or Trial and the person is a platform
// admin. The engine refuses on its own as well (SEOagentKIntel1), so this is the guard that keeps a refusal from ever being quoted or charged.
// The routes, data reads and CSV are the next package (A1).

import { isKiRunMode, kiMayRun, kiModeOf, type KiMode, type MonitorsRow, type RunInput } from '@seo/shared';
import { isPlatformAdmin } from '../auth/access';
import type { SiteRow, UserRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { siteRows } from '../n8n/client';

/** The website's KI mode as the engine stores it; null when the engine cannot be read (the run is then not started). */
export async function kiModeFor(domain: string, read: (d: string) => Promise<MonitorsRow[]> = (d) => siteRows<MonitorsRow>('monitors', d, { max: 5 })): Promise<KiMode | null> {
  try {
    const rows = await read(domain);
    return kiModeOf(rows[0]?.ki_mode);
  } catch {
    return null;
  }
}

/**
 * Throws unless this person may start this KI run on this website: 409 `ki_mode_unknown` when the setting cannot be read, 403
 * `ki_not_available` when the website is Off, or in Trial and the person is not a platform admin. Any other mode passes untouched.
 */
export async function assertKiRunAllowed(input: Pick<RunInput, 'mode'>, site: Pick<SiteRow, 'domain'> | null, user: UserRow, read?: (d: string) => Promise<MonitorsRow[]>): Promise<void> {
  if (!isKiRunMode(input.mode)) return;
  if (!site) throw new HttpError(400, 'Choose a website', 'bad_request', { siteId: 'Required' });
  const mode = await kiModeFor(site.domain, read);
  if (mode === null) throw new HttpError(409, 'We could not confirm that this analysis is switched on for this website. Please try again in a minute. Nothing was charged.', 'ki_mode_unknown');
  if (!kiMayRun(mode, isPlatformAdmin(user)))
    throw new HttpError(403, 'This analysis is not available for this website yet. Ask us if you would like it switched on.', 'ki_not_available');
}
