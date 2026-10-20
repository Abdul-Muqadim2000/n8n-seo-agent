import { contentReadiness, readinessPage, type ContentReadiness, type NeedsYouItem, type ProfileRow, type QueueItem } from '@seo/shared';
import type { SiteRow } from '../db/schema';
import { siteRows } from '../n8n/client';
import type { CadenceItem, CadencePlan } from './cadence';

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

/**
 * The Needs-you items of readiness (pure). While the author profile or the business facts are missing and the website has a keyword ladder
 * to write for: one warning naming exactly what is missing, linking to the tab where it is filled in (its guide: the business profile, or
 * the business facts when only those are missing). Once both are on file and the website has never had a page written: the first page,
 * offered at once with its credits ("Write it now"), or written in the next weekly run.
 */
export function profileNeedsYou(o: {
  readiness: ContentReadiness | null;
  plan: Pick<CadencePlan, 'heldForProfile' | 'picks' | 'candidates' | 'ladders'>;
  /** the website already has a page written (any content-log row) */
  anyWritten: boolean;
  priced: (q: CadenceItem) => QueueItem;
}): NeedsYouItem[] {
  const r = o.readiness;
  if (!r) return [];
  const ladderLeft = o.plan.ladders.some((l) => ['active', 'queued', 'manual', 'not_chosen'].includes(l.role) && l.remaining.length > 0);
  if (!r.ready) {
    if (!ladderLeft && !o.plan.heldForProfile.length) return [];
    const first = o.plan.heldForProfile.find((h) => h.source === 'ladder') ?? o.plan.heldForProfile[0];
    return [
      {
        id: r.profileReady ? 'profile:facts' : 'profile:author',
        kind: 'profile',
        severity: 'warning',
        title: o.anyWritten ? 'Add your author profile and business facts so we can keep writing your pages' : 'Add your author profile and business facts so we can write your first page',
        detail: `Still missing: ${r.missingText}. Until then no page is written or charged, so it never arrives as a draft with blanks to fill. Your plan is kept${first ? `, and "${first.keyword}" is written first once they are on file` : ''}.`,
        action: { label: r.profileReady ? 'Add your business facts' : 'Add your author profile', page: readinessPage(r) },
      },
    ];
  }
  if (o.anyWritten) return [];
  const pick = o.plan.picks.find((p) => p.source === 'ladder') ?? o.plan.candidates.find((c) => c.source === 'ladder' && c.auto);
  if (!pick) return [];
  const q = o.priced(pick);
  return [
    {
      id: 'profile:write-first',
      kind: 'profile',
      severity: 'info',
      title: `Your first page is ready to write: "${pick.keyword}"`,
      detail: `Your author profile and business facts are on file. Write it now${q.credits ? ` (about ${q.credits} credits)` : ''}, or it is written in your next weekly run.`,
      action: { label: 'Write it now' },
      ...(pick.ladder ? { ladderId: pick.ladder.id } : {}),
      writeNow: q,
    },
  ];
}
