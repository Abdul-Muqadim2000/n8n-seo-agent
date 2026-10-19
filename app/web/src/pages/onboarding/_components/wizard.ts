import { createContext, useContext } from 'react';
import { DEFAULT_AUTOPILOT_LEVEL, type AutopilotLevel, type DifficultyForYou, type Me, type Org, type PlanChoice, type Site } from '@seo/shared';
import { trackFormSchema, type TrackFormOutput } from '@/components/site/TrackingForm';

// Onboarding steps (the server stores the last one reached in organizations.onboarding_step, same ids).

export const STEPS = [
  { id: 'company', label: 'Company', hint: 'Name and size' },
  { id: 'website', label: 'Website', hint: 'Address and market' },
  { id: 'verify', label: 'Verify ownership', hint: 'Prove you own the site' },
  { id: 'business', label: 'Business details', hint: 'Facts every page uses' },
  { id: 'profile', label: 'Author & profile', hint: 'E-E-A-T trust signals' },
  { id: 'keyword', label: 'Your first keyword', hint: 'What you want to be found for' },
  { id: 'tracking', label: 'Tracking', hint: 'What we check each week' },
  { id: 'launch', label: 'Launch', hint: 'Review and start' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export const isStep = (s: unknown): s is StepId => STEPS.some((x) => x.id === s);

/** Position of a stored step; "done" is past the last one. */
export function stepIndex(s: string | null | undefined): number {
  if (s === 'done') return STEPS.length;
  const i = STEPS.findIndex((x) => x.id === s);
  return i < 0 ? 0 : i;
}

/**
 * The step the server stores for a step of the wizard. The server keeps the steps it knows (organizations.onboarding_step); until it
 * knows "keyword" too, that step is recorded as the step before it, so the wizard resumes at the profile step and walks into it.
 */
const SERVER_STEPS = new Set(['company', 'website', 'verify', 'business', 'profile', 'tracking', 'launch', 'done']);
export const serverStep = (s: StepId): StepId => (SERVER_STEPS.has(s) ? s : (STEPS[Math.max(0, stepIndex(s) - 1)].id as StepId));

/** Steps that work on one website (they need ?site= or the company's website). */
export const SITE_STEPS: readonly StepId[] = ['verify', 'business', 'profile', 'keyword', 'tracking', 'launch'];

export interface WizardValue {
  me: Me;
  org: Org | null;
  sites: Site[];
  site: Site | null;
  step: StepId;
  /** go to a step (keeps the chosen website in the URL) */
  go: (step: StepId, siteId?: string | null) => void;
}

export const WizardContext = createContext<WizardValue | null>(null);

export function useWizard(): WizardValue {
  const v = useContext(WizardContext);
  if (!v) throw new Error('useWizard outside the onboarding wizard');
  return v;
}

/** For steps that only render once the company and the website exist. */
export function useWizardSite(): WizardValue & { org: Org; site: Site } {
  const v = useWizard();
  if (!v.org || !v.site) throw new Error('This onboarding step needs a company and a website');
  return v as WizardValue & { org: Org; site: Site };
}

// ---------- tracking choices between the "tracking" and "launch" steps (per browser, per website) ----------
// Keywords, GA4, competitors and brand names are also saved on the website; blog posts per week and monitors only take effect when
// tracking starts, so the draft keeps them until then.

const draftKey = (siteId: string) => `onboarding:tracking:${siteId}`;

export function readTrackingDraft(siteId: string): TrackFormOutput | null {
  try {
    const raw = localStorage.getItem(draftKey(siteId));
    if (!raw) return null;
    const r = trackFormSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function writeTrackingDraft(siteId: string, values: unknown) {
  try {
    localStorage.setItem(draftKey(siteId), JSON.stringify(values));
  } catch {
    /* storage blocked: the step falls back to the website's saved values */
  }
}

export function clearTrackingDraft(siteId: string) {
  try {
    localStorage.removeItem(draftKey(siteId));
    localStorage.removeItem(keywordKey(siteId));
  } catch {
    /* ignore */
  }
}

// ---------- the "Your first keyword" choices, kept until launch (per browser, per website) ----------

/** One keyword the owner chose in onboarding: started as a keyword ladder at launch. */
export interface KeywordPick {
  keyword: string;
  /** typed and checked by the owner, or picked from our suggestions */
  chosenBy: 'client_typed' | 'client_picked';
  /** "Write a page each week" (auto) or "Ask me before each page" (manual) */
  mode: 'auto' | 'manual';
  volume: number | null;
  difficultyForYou: DifficultyForYou | null;
  planType: PlanChoice | null;
  months: string;
  why: string;
}

export interface KeywordDraft {
  picks: KeywordPick[];
  /** "I'll choose later": nothing is written until a keyword is chosen (level 3: we choose and tell you first) */
  later: boolean;
  level: AutopilotLevel;
}

/** At most this many keywords are chosen in onboarding (the ladders written at the same time, `max_active`). */
export const MAX_PICKS = 2;

const keywordKey = (siteId: string) => `onboarding:keyword:${siteId}`;
const LEVELS: readonly number[] = [1, 2, 3];

export function readKeywordDraft(siteId: string): KeywordDraft | null {
  try {
    const raw = localStorage.getItem(keywordKey(siteId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<KeywordDraft>;
    const picks = (Array.isArray(v.picks) ? v.picks : [])
      .filter((p): p is KeywordPick => !!p && typeof p.keyword === 'string' && p.keyword.trim().length >= 2)
      .map((p) => ({ ...p, chosenBy: p.chosenBy === 'client_picked' ? ('client_picked' as const) : ('client_typed' as const), mode: p.mode === 'manual' ? ('manual' as const) : ('auto' as const) }))
      .slice(0, MAX_PICKS);
    return { picks, later: v.later === true && !picks.length, level: LEVELS.includes(Number(v.level)) ? (Number(v.level) as AutopilotLevel) : DEFAULT_AUTOPILOT_LEVEL };
  } catch {
    return null;
  }
}

export function writeKeywordDraft(siteId: string, draft: KeywordDraft) {
  try {
    localStorage.setItem(keywordKey(siteId), JSON.stringify(draft));
  } catch {
    /* storage blocked: the launch step then starts no ladder, and the Pipeline asks for the keyword */
  }
}
