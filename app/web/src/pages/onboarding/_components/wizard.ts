import { createContext, useContext } from 'react';
import type { Me, Org, Site } from '@seo/shared';
import { trackFormSchema, type TrackFormOutput } from '@/components/site/TrackingForm';

// Onboarding steps (the server stores the last one reached in organizations.onboarding_step, same ids).

export const STEPS = [
  { id: 'company', label: 'Company', hint: 'Name and size' },
  { id: 'website', label: 'Website', hint: 'Address and market' },
  { id: 'verify', label: 'Verify ownership', hint: 'Search Console, DNS or meta tag' },
  { id: 'business', label: 'Business details', hint: 'Facts every page uses' },
  { id: 'profile', label: 'Author & profile', hint: 'E-E-A-T trust signals' },
  { id: 'tracking', label: 'Tracking', hint: 'Keywords and monitors' },
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

/** Steps that work on one website (they need ?site= or the company's website). */
export const SITE_STEPS: readonly StepId[] = ['verify', 'business', 'profile', 'tracking', 'launch'];

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
  } catch {
    /* ignore */
  }
}
