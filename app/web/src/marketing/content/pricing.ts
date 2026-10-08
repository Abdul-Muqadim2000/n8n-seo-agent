// Plans for /pricing and the Home teaser. Every feature line maps to a real capability; prices and limits are not decided yet.
import type { FaqItem } from './features';

export interface PricingTier {
  id: 'starter' | 'growth' | 'enterprise';
  name: string;
  /** shown big; "Talk to us" for Enterprise */
  price: string;
  /** e.g. "per month" — empty when the price is not a number */
  period: string;
  /** monthly price in USD when billed monthly; absent for a custom price (/pricing computes the annual price from it) */
  monthly?: number;
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
    monthly: 149, // PLACEHOLDER — confirm (keep equal to `price`)
    description: 'For one website that needs research, audits and a steady weekly rhythm.',
    // ?plan= is ignored by the sign-up page today; it records which plan the visitor came from
    cta: { label: 'Start free', to: '/signup?plan=starter' },
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
    monthly: 449, // PLACEHOLDER — confirm (keep equal to `price`)
    description: 'For teams that want the full loop, AI search visibility and backlinks.',
    cta: { label: 'Start free', to: '/signup?plan=growth' },
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
    cta: { label: 'Talk to sales', to: '/contact?topic=sales' },
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

/** Discount for annual billing, as a fraction of the monthly price. */
export const annualDiscount = 0.2; // PLACEHOLDER — confirm

/** Monthly-equivalent price when billed annually, rounded to whole dollars. */
export const annualMonthly = (monthly: number): number => Math.round(monthly * (1 - annualDiscount));

/** one line under the plans: AI and data usage is shown before every run */
export const pricingUsageNote =
  'AI and data usage is estimated before every run and checked against your budget, so there are no surprises on the bill.'; // PLACEHOLDER — confirm billing model

/** a cell in the comparison table: true = included, false = not included, text = included with this limit */
export type MatrixValue = boolean | string;

/** comparison table for /pricing: true / false / text per tier (starter, growth, enterprise) */
export const pricingMatrix: { group: string; rows: { label: string; hint?: string; values: [MatrixValue, MatrixValue, MatrixValue] }[] }[] = [
  {
    group: 'Research and planning',
    rows: [
      { label: 'Keyword research and verdicts', hint: 'A verdict per keyword, with its topic fit', values: [true, true, true] },
      { label: 'Difficulty for your site', hint: 'Reach, with a Direct, Short or Full plan', values: [true, true, true] },
      { label: 'Keyword ladders', values: ['1 active', 'Several', 'Several'] }, // PLACEHOLDER — confirm
      { label: 'Weekly rank tracking', hint: 'Every rung and the head term', values: [true, true, true] },
    ],
  },
  {
    group: 'Content',
    rows: [
      { label: 'Content engine with SEO QA', hint: 'Written, critiqued and edited, then checked', values: [true, true, true] },
      { label: 'Author byline, author box and expert reviewer', values: [true, true, true] },
      { label: 'Hub, case study, local and video pages', values: [true, true, true] },
      { label: 'Blog package and WordPress drafts', hint: 'HTML, Markdown and meta.json', values: [true, true, true] },
      { label: 'Live publish check', hint: 'Verifies the page once it is live', values: [true, true, true] },
    ],
  },
  {
    group: 'Automation',
    rows: [
      { label: 'Weekly content cadence', values: [true, true, true] },
      { label: 'Autopilot pipeline (Auto / Manual)', hint: 'Several ladders, “Needs you” queue, 4-week calendar', values: [false, true, true] }, // PLACEHOLDER — confirm
    ],
  },
  {
    group: 'Monitoring',
    rows: [
      { label: 'Technical audits with fix pack', values: ['Monthly', 'Monthly', 'Monthly'] },
      { label: 'Crawl depth', hint: 'JavaScript rendering included', values: ['200 pages', '500 pages', '1,000 pages'] }, // PLACEHOLDER — confirm
      { label: 'Search Console, GA4 and Trends', values: [true, true, true] },
      { label: 'AI search visibility', hint: 'ChatGPT, Gemini, Perplexity, Claude, AI Mode, AI Overviews', values: [false, 'Up to 50 questions', 'Up to 50 questions'] }, // PLACEHOLDER — confirm
      { label: 'Daily AI Pulse', hint: 'Alerts only on statistically real changes', values: [false, true, true] },
      { label: 'Backlinks from every source', hint: 'Nine sources, every link checked by Ascentra', values: [false, true, true] }, // PLACEHOLDER — confirm
      { label: 'Prospects, contacts and outreach drafts', values: [false, true, true] },
    ],
  },
  {
    group: 'Reports and alerts',
    rows: [
      { label: 'Monday report', values: [true, true, true] },
      { label: 'Full SEO report (PDF / Word)', values: [false, true, true] }, // PLACEHOLDER — confirm
      { label: 'Search Console alert watcher and monthly check-ins', values: [false, false, true] }, // PLACEHOLDER — confirm
    ],
  },
  {
    group: 'Platform and control',
    rows: [
      { label: 'Websites', values: ['1', 'Up to 5', 'Custom'] }, // PLACEHOLDER — confirm
      { label: 'Roles and invitations', hint: 'Owner, admin, member and viewer', values: [true, true, true] },
      { label: 'Verified website ownership', values: [true, true, true] },
      { label: 'Cost estimate before every run', values: [true, true, true] },
      { label: 'Spend caps per company', values: [true, true, true] },
      { label: 'Multi-company workspaces', values: [false, false, true] }, // PLACEHOLDER — confirm
      { label: 'Onboarding with your team', values: [false, false, true] }, // PLACEHOLDER — confirm
    ],
  },
];

/** "Transparent costs" on /pricing — each line is how the product works today. */
export const costControls: { title: string; body: string }[] = [
  {
    title: 'A cost estimate before every run',
    body: 'Every analysis shows what it will cost and how long it takes before you press start.',
  },
  {
    title: 'Budget caps per company',
    body: 'Owners set the budget. Runs are checked against it before any paid work begins, so a cap holds even when several people start runs at once.',
  },
  {
    title: 'Spend limits',
    body: 'A platform-wide daily spend limit sits above every company budget, and the AI question panel shows its cost per website so you can size it.',
  },
  {
    title: 'No repeated paid work',
    body: 'Results that cannot have changed are reused: an audit is skipped when the sitemap is unchanged, with a full audit at least every 60 days.',
  },
  {
    title: 'A $0 mode for backlinks',
    body: 'Run backlink checks from the free sources only — Bing Webmaster Tools, Search Console links, GA4 referrals, Common Crawl and more.',
  },
];

export const pricingFaqs: FaqItem[] = [
  {
    q: 'What does “Start free” include?',
    a: 'Creating an account, setting up your company, adding websites and verifying them costs nothing. Paid work starts only when an analysis runs, and every run shows its cost first.', // PLACEHOLDER — confirm
  },
  {
    q: 'How are AI and data costs handled?',
    a: 'Each run estimates its AI and data usage before it starts and is checked against your company’s budget. Owners set the budget and can lower or raise it at any time.', // PLACEHOLDER — confirm billing model
  },
  {
    q: 'What counts as a website?',
    a: 'One domain your company has verified it owns — through Search Console, a DNS TXT record or a meta tag — with its own tracking, audits and pipeline.',
  },
  {
    q: 'How much is annual billing?',
    a: 'Annual billing is priced below twelve monthly payments; the toggle above shows the monthly equivalent for each plan.', // PLACEHOLDER — confirm
  },
  {
    q: 'What is the free-sources backlink mode?',
    a: 'A backlink check that uses only the free sources — Bing Webmaster Tools, Search Console links, GA4 referrals, the Common Crawl web graph, Wikipedia, Hacker News, news and web search — and Ascentra’s own link check. It leaves out the paid link index, so it costs nothing to run.',
  },
  {
    q: 'Can we change plans later?',
    a: 'Yes. Talk to us and we will move your company to the plan that fits; your websites, history and settings stay as they are.', // PLACEHOLDER — confirm
  },
];
