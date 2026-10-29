// Which guide answers which ask, kept apart from the catalogue (guides.ts) so a page can link the right guide without loading every
// guide's text: only the GuideId type comes from there. guides.ts re-exports all of it.
import type { NeedsYouItem } from './data';
import type { GuideId } from './guides';

/**
 * The guide of each kind of Needs-you item on the Pipeline (server: services/pipeline.ts, ladders.ts, autopilot.ts). A Record over the
 * kind, so a new kind does not compile until it has a guide; `guideForNeedsYou` then refines a few kinds by the item's id.
 */
export const GUIDE_FOR_NEEDS_YOU_KIND: Record<NeedsYouItem['kind'], GuideId> = {
  keyword: 'choose-first-keyword',
  proposal: 'choose-first-keyword',
  recheck: 'keyword-not-planned',
  level: 'autopilot-levels',
  failed: 'your-journey',
  publish: 'publish-page',
  pileup: 'publish-page',
  approve: 'coming-up-plan',
  overlap: 'keyword-not-planned',
  duplicate: 'keyword-not-planned',
  connection: 'your-weekly-cycle',
  profile: 'business-profile',   // P1: the author profile and the business facts the first page waits for
  ai_panel: 'ai-panel-focus',   // AI-FOCUS (2026-10-27): the AI questions follow the keywords you work on
  questions: 'page-questions',   // H3 (2026-10-28): questions on a written page; each answer is kept in the business details
  site_task: 'indexnow-key-file',   // site tasks (2026-10-28): refined by the item's id below
};

/** Index coverage: the guide of each indexing step (the same ids as INDEX_CAUSE_INFO in indexing.ts; a test holds the two together). */
export const INDEXING_GUIDE: Record<string, GuideId> = {
  noindex: 'index-remove-noindex',
  robots_blocked: 'index-robots-blocked',
  indexed_not_in_sitemap: 'index-add-to-sitemap',
  not_in_sitemap: 'index-not-in-sitemap',
  canonical_elsewhere: 'index-canonical-sitemap',
  not_found: 'index-fix-not-found',
  soft_404: 'index-fix-soft-404',
  server_error: 'index-fix-server-error',
  access_denied: 'index-fix-access-denied',
  redirect: 'index-sitemap-redirects',
  redirect_error: 'index-fix-redirect-error',
  sitemap: 'index-submit-sitemap',
};

/** The guide that answers one Needs-you item: its kind's, refined by what the id says (a refused plan, a draft to fix, an announcement). */
export function guideForNeedsYou(item: Pick<NeedsYouItem, 'id' | 'kind' | 'severity'>): GuideId {
  const id = item.id;
  if (id.startsWith('refused:')) return 'keyword-not-planned';
  if (id.startsWith('fix:')) return 'page-not-ready';
  if (id === 'profile:facts') return 'business-facts';   // P1: only the business facts are missing
  if (id === 'profile:write-first') return 'coming-up-plan';
  if (id === 'connection:gsc') return 'search-console-access';
  if (id === 'connection:tracking') return 'your-journey';
  // site tasks: one guide per kind of step on the website (ids task:indexnow, task:ai_crawlers, task:redirect:<address>)
  if (id === 'task:ai_crawlers') return 'ai-crawler-access';
  if (id.startsWith('task:redirect:')) return 'redirect-broken-page';
  // Index coverage (2026-10-29): one guide per cause only the client can fix (task:indexing:<cause>)
  if (id.startsWith('task:indexing:')) return INDEXING_GUIDE[id.slice('task:indexing:'.length)] ?? 'index-coverage';
  // a level-3 announcement is a warning (it starts on its own); a suggestion at levels 1-2 waits and is info
  if (item.kind === 'proposal' && item.severity === 'warning') return 'keyword-announcements';
  return GUIDE_FOR_NEEDS_YOU_KIND[item.kind] ?? 'your-journey';
}

/**
 * The guide each keyword-first screen offers beside its choice (web: onboarding, the Pipeline, Website settings > Autopilot, the
 * written page's report). One list, so a test can hold every screen to having one.
 */
export const AUTOPILOT_SCREEN_GUIDES = {
  onboardingKeyword: 'choose-first-keyword',
  onboardingLevel: 'autopilot-levels',
  launch: 'your-journey',
  pipeline: 'your-journey',
  comingUp: 'coming-up-plan',
  proposals: 'keyword-announcements',
  suggestions: 'autopilot-levels',
  yourWeek: 'your-weekly-cycle',
  autopilotSettings: 'autopilot-levels',
  newLadder: 'choose-first-keyword',
  pageNotReady: 'page-not-ready',
  notWhatIWanted: 'not-what-i-wanted',
} as const satisfies Record<string, GuideId>;
