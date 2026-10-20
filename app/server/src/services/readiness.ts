import { contentReadiness, type ContentReadiness, type ProfileRow } from '@seo/shared';
import type { SiteRow } from '../db/schema';
import { siteRows } from '../n8n/client';

// P1 (2026-10-20, rehearsal n8n/seo-agent/docs/REHEARSAL_2026-10-20.md §4 item 1): is this website ready for a written page? The author
// profile lives in the engine (seo_profiles, written by the profile form's run) and the business facts in the app (sites.businessFacts,
// sent to the engine with "Track my site" and Site Admin `facts`). One reading of both, the engine's rule (shared/src/readiness.ts).

/** The website's readiness; null when the engine's profile table could not be read (then nothing is decided on it). */
export async function siteReadiness(site: Pick<SiteRow, 'domain' | 'businessFacts'>): Promise<ContentReadiness | null> {
  try {
    const rows = await siteRows<ProfileRow>('profiles', site.domain, { max: 5 });
    return contentReadiness({ profile: rows[0] ?? null, businessFacts: site.businessFacts });
  } catch {
    return null;
  }
}
