// Is the website ready for its first written page? The app's copy of the engine's rule (n8n/seo-agent/v5/code/_readiness.js, READY.of),
// word for word: the same fields, the same minimum, the same labels. Its vitest suite reads the engine kit and compares.
//
// Real-credit rehearsal 2026-10-20 (n8n/seo-agent/docs/REHEARSAL_2026-10-20.md §4 item 1): a new client's first page was written with no
// author profile and no business facts, and the quality check refused it as "not ready to publish" (11 bracketed author fields, claims nothing
// on file supports) after the client paid for it. The owner's decision: no page is written on its own until both are on file. The engine
// holds the ladder start's page and everything the weekly cycle would write; the app shows why, names what is missing, and warns before a
// manual "Write it now".

import type { ProfileLike } from './profile';

/** Business facts shorter than this (whitespace collapsed) are not facts a page can use. */
export const FACTS_MIN_CHARS = 30;

export type ReadinessKey = 'author_name' | 'author_job_title' | 'author_bio' | 'business_facts';

/** The part, in customer words (the engine's labels). */
export const READINESS_LABELS: Record<ReadinessKey, string> = {
  author_name: "your author's name",
  author_job_title: "your author's job title",
  author_bio: 'a short author bio',
  business_facts: 'your business facts',
};

/** The engine's own reason, the words a held page carries. */
export const READINESS_REASON = 'waiting for your author profile and business facts';

export interface ContentReadiness {
  ready: boolean;
  profileReady: boolean;
  factsReady: boolean;
  /** what is missing, in the engine's order */
  missing: ReadinessKey[];
  /** "your author's name, your author's job title, a short author bio and your business facts" */
  missingText: string;
}

const S = (v: unknown) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const listText = (a: string[]) => (a.length <= 1 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

/** The engine's seo_profiles row or the app's ProfileFields: both name the author's fields. */
export type ReadinessProfile = ProfileLike | { author_name?: unknown; author_job_title?: unknown; author_bio?: unknown } | null | undefined;

function authorOf(p: ReadinessProfile): { name: string; jobTitle: string; bio: string } {
  if (!p) return { name: '', jobTitle: '', bio: '' };
  const row = p as { author_name?: unknown; author_job_title?: unknown; author_bio?: unknown };
  const a = (p as ProfileLike).author;
  return { name: S(a?.name ?? row.author_name), jobTitle: S(a?.jobTitle ?? row.author_job_title), bio: S(a?.bio ?? row.author_bio) };
}

/** READY.of({ profile, facts }) in the engine. */
export function contentReadiness(o: { profile: ReadinessProfile; businessFacts: string | null | undefined }): ContentReadiness {
  const a = authorOf(o.profile);
  const missingProfile: ReadinessKey[] = [...(a.name ? [] : ['author_name' as const]), ...(a.jobTitle ? [] : ['author_job_title' as const]), ...(a.bio ? [] : ['author_bio' as const])];
  const factsReady = S(o.businessFacts).length >= FACTS_MIN_CHARS;
  const missing: ReadinessKey[] = [...missingProfile, ...(factsReady ? [] : ['business_facts' as const])];
  return { ready: !missing.length, profileReady: !missingProfile.length, factsReady, missing, missingText: listText(missing.map((k) => READINESS_LABELS[k])) };
}

/** Where the client fills each part in: the author in "Author & profile", the facts in "Business details" (Website settings). */
export function readinessPage(r: Pick<ContentReadiness, 'profileReady' | 'factsReady'>): 'settings/profile' | 'settings/business' {
  return !r.profileReady ? 'settings/profile' : 'settings/business';
}
