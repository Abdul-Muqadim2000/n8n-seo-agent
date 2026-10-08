// Plans for /pricing and the Home teaser. Every feature line maps to a real capability; prices and limits are not decided yet.

export interface PricingTier {
  id: 'starter' | 'growth' | 'enterprise';
  name: string;
  /** shown big; "Talk to us" for Enterprise */
  price: string;
  /** e.g. "per month" — empty when the price is not a number */
  period: string;
  description: string;
  cta: { label: string; to: string };
  highlighted?: boolean;
  /** "Everything in Starter, plus:" */
  includesPrevious?: string;
  features: string[];
}

export const pricingTiers: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$149', // PLACEHOLDER — confirm
    period: 'per month', // PLACEHOLDER — confirm
    description: 'For one website that needs research, audits and a steady weekly rhythm.',
    cta: { label: 'Start free', to: '/signup' },
    features: [
      '1 website', // PLACEHOLDER — confirm
      'Keyword research and verdicts',
      'One active keyword ladder', // PLACEHOLDER — confirm
      'Content engine with SEO QA and the blog package',
      'Monthly technical audits with a fix pack',
      'Search Console, GA4 and Trends tracking',
      'Monday report',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$449', // PLACEHOLDER — confirm
    period: 'per month', // PLACEHOLDER — confirm
    description: 'For teams that want the full loop, AI search visibility and backlinks.',
    cta: { label: 'Start free', to: '/signup' },
    highlighted: true,
    includesPrevious: 'Everything in Starter, plus:',
    features: [
      'Up to 5 websites', // PLACEHOLDER — confirm
      'Autopilot pipeline with several keyword ladders',
      'AI search visibility: up to 50 questions and the daily AI Pulse',
      'Backlinks from every source with Ascentra’s own link checks',
      'Prospects, contacts and outreach drafts',
      'Full SEO reports as PDF or Word',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Talk to us',
    period: '',
    description: 'For agencies and groups running many companies and websites.',
    cta: { label: 'Talk to sales', to: '/contact' },
    includesPrevious: 'Everything in Growth, plus:',
    features: [
      'Websites and companies to fit your portfolio', // PLACEHOLDER — confirm
      'Multi-company workspaces with roles and invitations',
      'Spend caps and budgets per company',
      'Search Console alert watcher and monthly check-ins',
      'Onboarding with your team', // PLACEHOLDER — confirm
    ],
  },
];

/** one line under the plans: AI and data usage is shown before every run */
export const pricingUsageNote =
  'AI and data usage is estimated before every run and checked against your budget, so there are no surprises on the bill.'; // PLACEHOLDER — confirm billing model

/** comparison table for /pricing: true / false / text per tier (starter, growth, enterprise) */
export const pricingMatrix: { group: string; rows: { label: string; values: [boolean | string, boolean | string, boolean | string] }[] }[] = [
  {
    group: 'Research and content',
    rows: [
      { label: 'Keyword research and verdicts', values: [true, true, true] },
      { label: 'Keyword ladders', values: ['1 active', 'Several', 'Several'] }, // PLACEHOLDER — confirm
      { label: 'Content engine with SEO QA', values: [true, true, true] },
      { label: 'Hub, case study, local and video pages', values: [true, true, true] },
      { label: 'Autopilot pipeline (Auto / Manual)', values: [false, true, true] },
    ],
  },
  {
    group: 'Monitoring',
    rows: [
      { label: 'Technical audits with fix pack', values: ['Monthly', 'Monthly', 'Monthly'] },
      { label: 'Search Console, GA4 and Trends', values: [true, true, true] },
      { label: 'AI search visibility', values: [false, 'Up to 50 questions', 'Up to 50 questions'] },
      { label: 'Daily AI Pulse', values: [false, true, true] },
      { label: 'Backlinks from every source', values: [false, true, true] },
    ],
  },
  {
    group: 'Platform',
    rows: [
      { label: 'Websites', values: ['1', 'Up to 5', 'Custom'] }, // PLACEHOLDER — confirm
      { label: 'Roles and invitations', values: [true, true, true] },
      { label: 'Multi-company workspaces', values: [false, false, true] }, // PLACEHOLDER — confirm
      { label: 'Spend caps per company', values: [true, true, true] },
      { label: 'Full SEO report (PDF / Word)', values: [false, true, true] },
    ],
  },
];
