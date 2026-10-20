import { GOALS, TONES, type AutopilotLevel, type Site } from '@seo/shared';
import type { TrackFormOutput } from '@/components/site/TrackingForm';
import type { KeywordPick } from './wizard';

// What "Start" in the onboarding launch step sends (SCHEDULING_KEYWORDS_PLAN.md §5.2 item 4), as data: "Track my site" with the owner's
// time zone and what the website sells, the autopilot level, and one keyword ladder per chosen keyword. No separate audit or AI
// visibility run: the website's first weekly cycle starts at once and does both.

export interface LaunchRequests {
  track: Record<string, unknown>;
  automation: { autopilotLevel: AutopilotLevel };
  ladders: Record<string, unknown>[];
}

export function launchRequests(o: { site: Site; plan: TrackFormOutput; picks: KeywordPick[]; level: AutopilotLevel; timezone: string }): LaunchRequests {
  const { site, plan, picks, level } = o;
  const country = plan.country;
  return {
    track: {
      mode: 'track',
      siteId: site.id,
      country,
      keywords: plan.keywords,
      ga4PropertyId: plan.ga4PropertyId,
      blogsPerWeek: plan.blogsPerWeek,
      competitors: plan.competitors,
      monitors: plan.monitors,
      // keyword-first: the owner's own time zone (the website's weekly day and 06:00 are in it) and what the website sells
      timezone: o.timezone || site.timezone || '',
      ...(site.services?.length ? { services: site.services } : {}),
      emailCopy: true,
    },
    automation: { autopilotLevel: level },
    // "Ask me before each page" writes nothing at start (the server's rule for a Manual ladder); its plan is still made
    ladders: picks.map((p) => ({
      mode: 'ladder',
      siteId: site.id,
      keyword: p.keyword,
      country,
      business: '',
      customers: '',
      businessFacts: '',
      cta: '',
      goal: GOALS.some((g) => g.value === site.goal) ? site.goal : 'leads',
      tone: TONES.find((t) => t === site.tone) ?? TONES[0],
      pagesNow: 1,
      chosenBy: p.chosenBy,
      ladderMode: p.mode,
      ladderPrefs: { mode: p.mode },
      emailCopy: false,
    })),
  };
}
