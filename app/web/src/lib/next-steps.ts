import { CYCLE_LOCAL_TIME, ENGINE_TIMEZONE, isValidTimezone, PREVIEW_HOURS_BEFORE, upcomingCycles, type CycleOccurrence, type SiteCycleView } from '@seo/shared';
import type { GuideId } from '@seo/shared/guides';

// "What happens next" (the Pipeline and the end of onboarding): the website's next real dates as a short line of steps, each with the
// guide that explains it. Built from the website's cycle (GET .../cycle: nextDueAt, nextPreviewAt, monthlyDay, upcoming) or, before the
// cycle exists, from the week a website that starts now would get (cycle-clock.ts, the engine's own chain). Pure: the clock is passed in.

export type FirstPage =
  /** the first page of the chosen keyword is written today (or in the first week) */
  | 'writing'
  /** only the keyword's plan is made today (Ask me before each page) */
  | 'plan'
  /** the first page waits for the author profile and the business facts (owner decision 2026-10-20) */
  | 'waiting'
  /** no keyword chosen yet: nothing is written */
  | 'no_keyword'
  /** nothing to say about the first page (it was written, or level 3 chooses the keyword) */
  | 'none';

export interface NextStep {
  key: 'today' | 'keyword' | 'first_page' | 'coming_up' | 'weekly' | 'monthly' | 'paused' | 'start';
  /** "Today", "Sun 25 Oct", "Tue 27 Oct 06:00", "24 Nov" */
  when: string;
  text: string;
  guide: GuideId;
  /** the step's instant (ISO), when it has one */
  at?: string;
}

export interface NextStepsInput {
  cycle?: SiteCycleView | null;
  now: number;
  firstPage: FirstPage;
  /** before the cycle exists: project the week of a website that starts now, in this zone (onboarding's launch step) */
  projectFrom?: { tz: string } | null;
}

const fmt = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: tz }).format(new Date(iso));
/** "Sun 25 Oct" in the website's zone */
export const dayLabel = (iso: string, tz: string) => fmt(iso, tz, { weekday: 'short', day: 'numeric', month: 'short' });
/** "24 Nov" */
const dateLabel = (iso: string, tz: string) => fmt(iso, tz, { day: 'numeric', month: 'short' });
const valid = (s: string | null | undefined): s is string => !!s && Number.isFinite(Date.parse(s));

function firstPageStep(firstPage: FirstPage): NextStep | null {
  if (firstPage === 'waiting') return { key: 'first_page', when: 'Your first page', text: 'waiting for your author profile and business facts', guide: 'business-profile' };
  if (firstPage === 'no_keyword') return { key: 'keyword', when: 'Your keyword', text: 'choose one: nothing is written until you do', guide: 'choose-first-keyword' };
  return null;
}

function todayText(firstPage: FirstPage): string {
  if (firstPage === 'writing') return 'first checks and your first page';
  if (firstPage === 'plan' || firstPage === 'waiting') return 'first checks and the plan for your keyword';
  return 'your first checks';
}

export function nextSteps({ cycle, now, firstPage, projectFrom }: NextStepsInput): NextStep[] {
  const known = !!cycle && cycle.status !== 'not_started' && (cycle.known || (cycle.upcoming?.length ?? 0) > 0 || valid(cycle.nextDueAt));
  if (cycle?.status === 'paused')
    return [{ key: 'paused', when: 'Paused', text: 'nothing runs until you resume; the missed week then runs once', guide: 'your-weekly-cycle' }];

  let tz = ENGINE_TIMEZONE;
  let localTime = CYCLE_LOCAL_TIME;
  let occ: CycleOccurrence[] = [];
  if (known && cycle) {
    tz = isValidTimezone(cycle.timezone) ? cycle.timezone : ENGINE_TIMEZONE;
    localTime = cycle.localTime || CYCLE_LOCAL_TIME;
    occ = [...(cycle.upcoming ?? [])].filter((o) => valid(o.at)).sort((a, b) => a.at.localeCompare(b.at));
    // a cycle row without its coming list: the next run and its plan alone
    if (!occ.length && valid(cycle.nextDueAt))
      occ = [{ date: '', at: cycle.nextDueAt, cycle0: false, monthly: false, previewAt: valid(cycle.nextPreviewAt) ? cycle.nextPreviewAt : new Date(Date.parse(cycle.nextDueAt) - PREVIEW_HOURS_BEFORE * 3_600_000).toISOString() }];
  } else if (projectFrom) {
    tz = isValidTimezone(projectFrom.tz) ? projectFrom.tz : ENGINE_TIMEZONE;
    occ = upcomingCycles({ anchorAt: new Date(now).toISOString(), tz }, now, 6);
  } else {
    // no week yet and nothing to project: the shape of it, without dates
    return [
      { key: 'start', when: 'When tracking starts', text: 'your first week runs at once', guide: 'your-journey' },
      { key: 'coming_up', when: 'Two days before each week', text: 'Coming up: the plan, to skip or approve', guide: 'coming-up-plan' },
      { key: 'weekly', when: 'Every week', text: `your weekly run, from ${CYCLE_LOCAL_TIME}`, guide: 'your-weekly-cycle' },
      { key: 'monthly', when: 'Once a month', text: 'the bigger checks', guide: 'your-weekly-cycle' },
    ];
  }

  const out: NextStep[] = [];
  // the first week: due now (not opened yet), or running now
  const zeroDue = occ[0]?.cycle0;
  const zeroRunning = !!cycle?.current?.cycle0 && cycle.current.status === 'running';
  if (zeroDue || zeroRunning) out.push({ key: 'today', when: 'Today', text: todayText(firstPage), guide: 'your-journey', at: zeroDue ? occ[0].at : undefined });
  const fp = firstPageStep(firstPage);
  if (fp) out.push(fp);

  const next = occ.find((o) => !o.cycle0 && Date.parse(o.at) > now) ?? occ.find((o) => !o.cycle0);
  if (next) {
    if (valid(next.previewAt)) {
      const ready = Date.parse(next.previewAt) <= now;
      out.push(
        ready
          ? { key: 'coming_up', when: 'Now', text: `Coming up is ready: decide before ${dayLabel(next.at, tz)}`, guide: 'coming-up-plan', at: next.previewAt }
          : { key: 'coming_up', when: dayLabel(next.previewAt, tz), text: 'Coming up: the plan of your next week', guide: 'coming-up-plan', at: next.previewAt },
      );
    }
    out.push({ key: 'weekly', when: `${dayLabel(next.at, tz)} ${localTime}`, text: next.monthly ? 'your weekly run, with the monthly checks' : 'your weekly run', guide: 'your-weekly-cycle', at: next.at });
    const monthly = occ.find((o) => o.monthly && !o.cycle0 && Date.parse(o.at) > Date.parse(next.at));
    if (!next.monthly && monthly) out.push({ key: 'monthly', when: dateLabel(monthly.at, tz), text: 'monthly checks', guide: 'your-weekly-cycle', at: monthly.at });
  }
  return out;
}

/**
 * Where the website's first page stands, from what the app already reads (owner decision 2026-10-20: the first page of a keyword waits
 * for the author profile and the business facts). `ready` is the author's name on the profile and business facts written down; when the
 * server exposes its own readiness of the first page, pass that instead.
 */
export function firstPageOf(o: {
  needsKeyword: boolean;
  ladders: { mode: 'auto' | 'manual'; counts: { published: number; waiting: number; writing: number } }[];
  ready: boolean;
}): FirstPage {
  if (o.needsKeyword) return 'no_keyword';
  if (!o.ladders.length) return 'none';
  if (o.ladders.some((l) => l.counts.published + l.counts.waiting + l.counts.writing > 0)) return 'none';
  if (!o.ready) return 'waiting';
  return o.ladders.some((l) => l.mode === 'auto') ? 'writing' : 'plan';
}

/** The author's name and the business facts, the two things the first page waits for. */
export const firstPageReady = (profile: { author?: { name?: string | null } | null } | null | undefined, businessFacts: string | null | undefined): boolean =>
  !!profile?.author?.name?.trim() && !!businessFacts?.trim();

/** The step line as plain text ("Today: first checks and your first page · Sun 25 Oct: Coming up ..."), for screen readers and tests. */
export const nextStepsText = (steps: NextStep[]) => steps.map((s) => `${s.when}: ${s.text}`).join(' · ');
