// Plans for /pricing and the Home teaser. Every feature line maps to a real capability. A plan's price buys its monthly credits at the
// credit's list price ($0.05), and each plan's credits cover its own automatic work as measured (app/docs/CREDITS.md §5, 2026-10-19):
// Starter 231 of its 780 credits, Growth (3 websites, everything on, 3 pages a week) 5,254 of its 5,980. The services stay placeholders.
import type { FaqItem } from './features';

export interface PricingTier {
  id: 'starter' | 'growth' | 'enterprise';
  name: string;
  /** shown big; "Talk to us" for Enterprise */
  price: string;
  /** e.g. "per month", empty when the price is not a number */
  period: string;
  /** monthly price in USD when billed monthly; absent for a custom price (/pricing computes the annual price from it) */
  monthly?: number;
  /** credits the plan adds every month (monthly price ÷ the $0.05 list price of a credit); absent for a custom plan */
  monthlyCredits?: number;
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
    price: '$39',
    period: 'per month',
    monthly: 39, // keep equal to `price`
    monthlyCredits: 780, // = monthly price ÷ $0.05
    description: 'One website, the whole loop: research, a page a week for the keywords you choose, monthly audits and the weekly report.',
    // ?plan= is ignored by the sign-up page today; it records which plan the visitor came from
    cta: { label: 'Start free', to: '/signup?plan=starter' },
    features: [
      '1 website',
      'Keyword research, verdicts and difficulty for your site',
      'One active keyword ladder',
      'A page a week for the keywords you choose, written, checked and ready to publish',
      'Three autopilot levels, and "Coming up" two days before anything is written',
      'Monthly technical audit with a fix pack',
      'Search Console, GA4 and Trends tracking, with weekly rank checks',
      'A weekly report on your website\'s own weekday, alerts and share links',
      'Reports delivered by e-mail or webhook, on your schedule',
      'Alerts in Slack or Teams, and findings as Jira, Linear or Asana tickets',
      'A step-by-step guide for every setup task, and for choosing your keyword, the autopilot levels and the weekly plan',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$299',
    period: 'per month',
    monthly: 299, // keep equal to `price`
    monthlyCredits: 5980, // = monthly price ÷ $0.05
    description: 'Everything the engine does, on up to three websites, including AI answers and backlinks.',
    cta: { label: 'Start free', to: '/signup?plan=growth' },
    highlighted: true,
    includesPrevious: 'Everything in Starter, plus:',
    features: [
      'Up to 3 websites',
      'Up to three pages a week, with the autopilot pipeline and several ladders',
      'AI search visibility: 50 questions per website by topic, buyer role and market, and the daily AI Pulse (up to 500; a bigger panel uses extra credits, shown before you save)',
      'AI growth every week: new pages to Bing and IndexNow, AI-readiness checks, suggested answer pages and earned media',
      'Backlinks from every source, with Alaventra\'s own link checks',
      'Crawler analytics from your server logs: Google and the AI crawlers, each one checked',
      'Link building: prospects, contacts and pitches from your own mailbox',
      'Full SEO reports as PDF or Word',
      'Daily key-page check and the pre-release check for your build',
      'Signed webhook deliveries into your own systems',
      'Daily or weekly export to BigQuery or your storage, and a Looker Studio connector', // PLACEHOLDER, confirm the plan
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
      'Websites and companies to fit your portfolio', // PLACEHOLDER, confirm
      'Multi-company workspaces with roles and invitations',
      'Agency client portal: client workspaces, client logins and approvals, white-label on your own domain', // PLACEHOLDER, confirm the plan and any per-client price
      'Single sign-on (SAML 2.0 / OIDC) and SCIM provisioning',
      'Credits and credit limits per company',
      'Search Console alert watcher and monthly check-ins',
      'Onboarding with your team', // PLACEHOLDER, confirm
    ],
  },
];

/** Discount for annual billing, as a fraction of the monthly price. */
export const annualDiscount = 0; // no annual discount: a credit costs the same whichever way a plan is paid (the Annual switch is hidden at 0)

/** Monthly-equivalent price when billed annually, rounded to whole dollars. */
export const annualMonthly = (monthly: number): number => Math.round(monthly * (1 - annualDiscount));

/** one line under the plans: the work is paid in credits */
export const pricingUsageNote =
  'The work itself is paid in credits. Each plan adds its credits on the 1st of every month, and you can buy a pack whenever you need more. Every analysis shows its price in credits before it starts and never uses more.';

/**
 * Credits (app/docs/CREDITS.md). Customer words only: a credit, its list price, what uses credits and the rules around them.
 * Never name what a run costs Alaventra, a markup or a margin on this page.
 */
export const creditListPriceUsd = 0.05;

export interface CreditPackOffer {
  credits: number;
  /** shown as is */
  price: string;
}

/** The packs a company can ask for on its Credits page, list price with no discount (DEFAULT_CREDIT_PACKS in shared/src/billing.ts). */
export const creditPacks: CreditPackOffer[] = [
  { credits: 500, price: '$25' },
  { credits: 2000, price: '$100' },
  { credits: 5000, price: '$250' },
  { credits: 20000, price: '$1,000' },
];

/** how long a pack's credits last */
export const creditPackValidity = '12 months';

/** one line under the packs: buying is a request today, confirmed and invoiced by the team (no card checkout yet) */
export const creditPacksNote =
  'Ask for a pack on the Credits page in the app. The Alaventra team sends the payment details; once the payment is confirmed the credits are added to your company and the invoice is e-mailed to your owners and admins as a PDF. New companies start with 200 welcome credits, valid for 90 days.';

/** "How credits work" on /pricing: each line is how the product works today (app/docs/CREDITS.md §1). */
export const creditRules: { title: string; body: string }[] = [
  {
    title: 'One balance for everything',
    body: 'The weekly work Alaventra does on its own for each website and the analyses you start yourself both use credits from your company\'s balance.',
  },
  {
    title: 'The price before it starts',
    body: 'Every analysis shows its price in credits before you press start. Those credits are held while it runs, so two analyses can never spend the same ones.',
  },
  {
    title: 'Never more than the price shown',
    body: 'An analysis is charged the credits it really used, never more than the price you saw. If it fails, it is free.',
  },
  {
    title: 'Limits you set',
    body: 'Owners can set a monthly limit for the analyses people start, another for the automatic work, and keep enough credits aside for each website\'s automatic work this month.',
  },
  {
    title: 'When credits run out',
    body: 'New analyses are refused and each website\'s automatic work pauses, and picks up again by itself as soon as credits are added. Owners and admins are told before it happens.',
  },
  {
    title: 'Soonest-expiring first',
    body: 'Packs last 12 months. A plan\'s monthly credits roll over for one month. Credits are always used soonest-expiring first, so none are wasted.',
  },
];

/**
 * Typical usage, in credits, computed from the shipped figures in app/docs/CREDITS.md §5 (2026-10-19), always shown as "about".
 * Re-check when the engine's calibrated figures move.
 */
export const creditExamples: { label: string; credits: string }[] = [
  { label: 'A keyword verdict', credits: 'about 12 credits' },
  { label: 'A written page, checked and ready to publish', credits: 'about 51 credits' },
  { label: 'One website with every monitor on, including the daily AI Pulse, for a month', credits: 'about 1,530 credits' },
];

/**
 * "Done for you", the work a person on our team does, on top of any plan. The software does not do these: somebody has to be given
 * access, open the CMS and review a change. PRICES AND DELIVERY ARE PLACEHOLDERS: confirm what the team can actually commit to
 * (capacity, turnaround, which stacks, what happens when a job runs long) before this goes live.
 */
export interface ServicePackage {
  id: 'setup' | 'publishing' | 'fixes' | 'managed';
  name: string;
  /** shown big */
  price: string;
  /** "one-off", "per month", ... */
  period: string;
  /** one line: what you get out of it */
  description: string;
  includes: string[];
  /** when it is done by */
  turnaround: string;
  /** what we need from you */
  needs: string;
  cta: { label: string; to: string };
  highlighted?: boolean;
}

export const servicePackages: ServicePackage[] = [
  {
    id: 'setup',
    name: 'Setup, done for you',
    price: '$199', // PLACEHOLDER, confirm
    period: 'one-off',
    description: 'We do the connecting and the first run, so your first weekly report is a real one.',
    includes: [
      'Ownership proved and Search Console and GA4 connected',
      'Your business profile, author and style guide filled in from one 30-minute call',
      'Tracking, keywords, competitors and the monitors you want switched on',
      'The IndexNow file and your outreach mailbox set up',
      'Your first keyword chosen with you, and your first technical audit and keyword ladder explained on a call',
    ],
    turnaround: 'Within five working days of getting access', // PLACEHOLDER, confirm
    needs: 'An admin seat in your Alaventra company, plus whoever can edit DNS or your website for one of the steps.',
    cta: { label: 'Ask about setup', to: '/contact?topic=sales' },
  },
  {
    id: 'publishing',
    name: 'We publish your pages',
    price: '$99', // PLACEHOLDER, confirm
    period: 'per month, up to 4 pages',
    description: 'The finished pages go live on your site, whatever your site is built with.',
    includes: [
      'WordPress, Shopify, Webflow, Squarespace, Ghost or a headless CMS',
      'A React, Next.js or other codebase: the page arrives as a pull request for your developers to merge',
      'Title, meta description, images, internal links and structured data all in place',
      'The live publish check run afterwards, so you see what the CMS changed',
      'Extra pages beyond four: $29 each', // PLACEHOLDER, confirm
    ],
    turnaround: 'Each page live within three working days of approval', // PLACEHOLDER, confirm
    needs: 'An editor login, or a repository you can give us a branch in. Nothing goes live without your yes.',
    cta: { label: 'Ask about publishing', to: '/contact?topic=sales' },
  },
  {
    id: 'fixes',
    name: 'We fix what the audit found',
    price: '$399', // PLACEHOLDER, confirm
    period: 'per website, one-off',
    description: 'The fix pack applied to your site by a person, then audited again so you can see the difference.',
    includes: [
      'robots.txt, llms.txt, redirects, structured data and the internal links from the fix pack',
      'The critical and high findings that can be fixed without redesigning anything',
      'Every change through your review: a pull request, a staging link or a written list',
      'A re-audit afterwards, with the health score before and after',
      'Ongoing technical care afterwards: $149 a month', // PLACEHOLDER, confirm
    ],
    turnaround: 'Within ten working days of the audit', // PLACEHOLDER, confirm
    needs: 'Access to the site or its repository, and someone who can approve a change.',
    cta: { label: 'Ask about fixes', to: '/contact?topic=sales' },
  },
  {
    id: 'managed',
    name: 'Managed',
    price: '$699', // PLACEHOLDER, confirm
    period: 'per month',
    description: 'One number for the whole thing: the Growth plan and all three services, running every month.',
    includes: [
      'The Growth plan for your website',
      'Setup included, with a quarterly review of the plan',
      'Four pages published for you every month',
      'Audit findings fixed every month, with the score tracked',
      'One person who knows your site, and a monthly call',
    ],
    turnaround: 'Starts the week you sign up', // PLACEHOLDER, confirm
    needs: 'The same access as the services above, and someone on your side to approve what goes live.',
    cta: { label: 'Talk to us', to: '/contact?topic=sales' },
    highlighted: true,
  },
];

/** one line under the service cards */
export const servicesNote =
  'A person does this work, not a script. We only ask for access you can withdraw at any time, every change goes through your review, and nothing is published or sent without your approval.'; // PLACEHOLDER, confirm the delivery promise

/** a cell in the comparison table: true = included, false = not included, text = included with this limit */
export type MatrixValue = boolean | string;

/** comparison table for /pricing: true / false / text per tier (starter, growth, enterprise) */
export const pricingMatrix: { group: string; rows: { label: string; hint?: string; values: [MatrixValue, MatrixValue, MatrixValue] }[] }[] = [
  {
    group: 'Research and planning',
    rows: [
      { label: 'Keyword research and verdicts', hint: 'A verdict per keyword, with its topic fit', values: [true, true, true] },
      { label: 'Difficulty for your site', hint: 'Reach, with a Direct, Short or Full plan', values: [true, true, true] },
      { label: 'Your own searches as the starting point', hint: 'Search Console searches with no page of yours, and the ones just off page one', values: [true, true, true] },
      { label: 'Traffic estimates marked measured or modelled', hint: 'Calibrated against your own impressions and clicks where you rank', values: [true, true, true] },
      { label: 'Searches grouped by shared results page', hint: 'One page for every search Google answers with the same results', values: [true, true, true] },
      { label: 'Keyword ladders', values: ['1 active', 'Several', 'Several'] }, // PLACEHOLDER, confirm
      { label: 'Weekly rank tracking', hint: 'Every rung and the head term, desktop and phone', values: [true, true, true] },
      { label: 'Search features per keyword', hint: 'AI Overview, snippet, People Also Ask, local pack, video', values: [true, true, true] },
      { label: 'Competitor positions and share of voice', hint: 'The sites above you on page one, per keyword', values: [true, true, true] },
      { label: 'Topic radius and re-plan proposals', hint: 'A ladder that has stalled gets a proposal; it is never applied for you', values: [true, true, true] },
    ],
  },
  {
    group: 'Content',
    rows: [
      { label: 'Content engine with SEO QA', hint: 'Written, critiqued and edited, then checked', values: [true, true, true] },
      { label: 'Author byline, author box and expert reviewer', values: [true, true, true] },
      { label: 'Hub, case study, local and video pages', values: [true, true, true] },
      { label: 'Originality check on every page', hint: 'Against the competitor pages researched and your own pages', values: [true, true, true] },
      { label: 'Coverage target from the best competitor', hint: 'With the subtopics that page covers', values: [true, true, true] },
      { label: 'Three images made with every page', hint: 'WebP, with the alt text and file names', values: [true, true, true] },
      { label: 'Blog package and CMS publishing', hint: 'HTML, Markdown, meta.json and the images, or sent to WordPress, Webflow, Contentful or a signed webhook, as drafts by default', values: [true, true, true] },
      { label: 'Your house style, applied and checked', hint: 'How your name is written, British or American spelling, words to avoid and the tone', values: [true, true, true] },
      { label: 'Refreshes instead of duplicates', hint: 'A search one of your live pages already answers is queued as a refresh of that page', values: [true, true, true] },
      { label: 'Live publish check', hint: 'Verifies the page once it is live', values: [true, true, true] },
      { label: 'Check any page before you publish', hint: 'Paste a page or send it from your build: the same quality verdict, every reason named, free', values: [true, true, true] },
    ],
  },
  {
    group: 'Automation',
    rows: [
      { label: 'Weekly content cadence', hint: 'Pages for the keywords you choose, written, checked and ready to publish', values: ['1 a week', 'Up to 3 a week', 'Custom'] },
      { label: 'Pages only for keywords you choose', hint: 'Typed by you or picked from suggestions with your chances, searches a month and credits a page; nothing is written until you choose', values: [true, true, true] },
      { label: 'Three autopilot levels', hint: 'Only my keywords; My keywords and keep my pages healthy; Full autopilot', values: [true, true, true] },
      { label: '"Coming up" before every week', hint: 'Two days ahead: every page that will be written, why and its credits, with Skip or Approve; in the app and by e-mail', values: [true, true, true] },
      { label: 'New keywords announced two days ahead', hint: 'On Full autopilot; change or skip a keyword before it starts', values: [true, true, true] },
      { label: 'Your own weekly cycle', hint: 'Starts the day you sign up, then every 7 days on that weekday in your time zone; you can move the weekday', values: [true, true, true] },
      { label: 'Autopilot pipeline (Auto / Manual)', hint: 'Several ladders, "Needs you" queue, 4-week calendar', values: [false, true, true] }, // PLACEHOLDER, confirm
    ],
  },
  {
    group: 'Monitoring',
    rows: [
      { label: 'Technical audits with fix pack', values: ['Monthly', 'Monthly', 'Monthly'] },
      { label: 'Crawl depth', hint: 'JavaScript rendering included', values: ['200 pages', '500 pages', '1,000 pages'] }, // PLACEHOLDER, confirm
      { label: 'Daily key-page check and pre-release check', hint: 'Your build asks whether a release candidate is safe to publish', values: [true, true, true] },
      { label: 'What only appears after JavaScript', hint: 'Key pages read twice, so content a crawler cannot see is flagged', values: [true, true, true] },
      { label: 'Search Console, GA4 and Trends', values: [true, true, true] },
      { label: 'AI search visibility', hint: 'ChatGPT, Gemini, Perplexity, Claude, AI Mode, AI Overviews; Copilot and the ChatGPT and Gemini APIs on request', values: [false, '50 a website included, up to 500', 'Up to 500 questions'] }, // a bigger panel uses extra credits, shown before saving
      { label: 'Questions by buyer role and market', hint: 'Rates per topic, buyer role and market with 95% ranges; import your own list as CSV', values: [false, true, true] }, // PLACEHOLDER, confirm
      { label: 'Daily AI Pulse', hint: 'Alerts only on statistically real changes', values: [false, true, true] },
      { label: 'AI growth, every week', hint: 'New pages sent to Bing and IndexNow, key pages scored for AI readiness, the questions to win suggested', values: [false, true, true] },
      { label: 'Earned media', hint: 'The exact pages AI cites without naming you, with a draft for each', values: [false, true, true] },
      { label: 'Crawler analytics from your server logs', hint: 'Googlebot and the AI crawlers, each checked against its company\'s addresses; impostors apart', values: [false, true, true] }, // PLACEHOLDER, confirm
      { label: 'Backlinks from every source', hint: 'Nine sources, every link checked by Alaventra', values: [false, true, true] }, // PLACEHOLDER, confirm
      { label: 'Prospects, contacts and outreach drafts from your own mailbox', hint: 'You approve each sequence; sent on weekdays, starting slowly, with your postal address and an opt-out in every e-mail and consent asked where the law expects it', values: [false, true, true] },
      { label: 'Mailbox connected without a password', hint: 'Microsoft 365 or Gmail on their own sign-in screen; an app password works for any other host', values: [false, true, true] },
      { label: 'Listings you can add yourself', hint: 'Directories and marketplaces worth being on, checked and kept up to date', values: [false, true, true] },
      { label: 'Journalist requests, podcasts and broken-link reclaim', hint: 'Free sources read every week, matched to your topics', values: [false, true, true] },
      { label: 'Replies read and answered', hint: 'Each reply classed and summarised with a suggested answer, and your link checked', values: [false, true, true] },
      { label: 'What each won link did', hint: 'The page compared with your other pages over the same weeks; the verdict reads "likely helped", never "caused"', values: [false, true, true] },
    ],
  },
  {
    group: 'Reports and alerts',
    rows: [
      { label: 'Weekly report', hint: 'On your website\'s own weekday, after that week\'s checks', values: [true, true, true] },
      { label: 'Charts marked with what happened', hint: 'Pages you published, technical fixes, Google updates and breaks in Google\'s own data', values: [true, true, true] },
      { label: 'Where every figure came from', hint: 'Each number names its source, its period and when it was read', values: [true, true, true] },
      { label: 'Alerts only when a change is real', hint: 'A fall is called a fall once it is beyond normal week-to-week variation', values: [true, true, true] },
      { label: 'Full SEO report (PDF / Word)', values: [false, true, true] }, // PLACEHOLDER, confirm
      { label: 'Share a report by link', hint: 'Read-only, no account needed, expires on the day you choose and can be turned off at any time', values: [true, true, true] },
      { label: 'Reports delivered to you', hint: 'As each one arrives, or a daily, weekly or monthly summary, by e-mail with the figures and files, and to a webhook', values: [true, true, true] },
      { label: 'Reports that are not ready are held back', hint: 'A page that failed its quality check or a verdict the analysis could not make is never sent, and the reason is stated', values: [true, true, true] },
      { label: 'Signed webhook deliveries', hint: 'Every body signed with your own secret, so your systems can tell the message is ours', values: [false, true, true] },
      { label: 'Alerts and events in Slack or Microsoft Teams', hint: 'Alerts, finished and failed runs, new audit findings and ranking moves, routed per channel', values: [true, true, true] }, // PLACEHOLDER, confirm the plans
      { label: 'Findings as Jira, Linear or Asana tickets', hint: 'One ticket per finding, with the evidence and the fix; its state shown back', values: [true, true, true] }, // PLACEHOLDER, confirm the plans
      { label: 'Search Console alert watcher and monthly check-ins', values: [false, false, true] }, // PLACEHOLDER, confirm
    ],
  },
  {
    group: 'Platform and control',
    rows: [
      { label: 'Websites', values: ['1', 'Up to 3', 'Custom'] },
      { label: 'Credits included every month', hint: 'Added on the 1st; unused ones roll over one month. Packs of extra credits last 12 months', values: ['780', '5,980', 'Custom'] },
      { label: 'Roles and invitations', hint: 'Owner, admin, member and viewer', values: [true, true, true] },
      { label: 'Two-step verification', hint: 'Authenticator app, passkeys or a security key, and recovery codes; a company can require it for everyone', values: [true, true, true] },
      { label: 'Signed-in devices and idle sign-out', hint: 'Sign a device out; end idle sessions after the time your company sets', values: [true, true, true] },
      { label: 'Audit log', hint: 'Sign-ins, team, settings, keys and sharing: who, when and from where; CSV export', values: [true, true, true] }, // PLACEHOLDER, confirm the plans
      { label: 'Single sign-on (SAML 2.0 and OIDC)', hint: 'Okta, Microsoft Entra ID, Google Workspace or any standard provider, on your verified e-mail domains; can be required', values: [false, false, true] }, // PLACEHOLDER, confirm the plans
      { label: 'SCIM provisioning', hint: 'People created, updated and switched off from your identity provider; groups mapped to roles', values: [false, false, true] }, // PLACEHOLDER, confirm the plans
      { label: 'Verified website ownership', values: [true, true, true] },
      { label: 'Step-by-step guides for every setup task', hint: 'Your own values, instructions for the provider you use, and a copy you can e-mail to a colleague; plus what happens when, from setup to a keyword won', values: [true, true, true] },
      { label: 'Price in credits before every analysis', hint: 'Held while it runs, charged what it really used and never more; an analysis that fails is free', values: [true, true, true] },
      { label: 'Credit limits per company', hint: 'A monthly limit for analyses people start, one for automatic work, and credits kept for each website\'s automatic work', values: [true, true, true] },
      { label: 'Missed schedules caught up', hint: 'A scheduled run that did not fire starts once the system is back, and its report says it ran late', values: [true, true, true] },
      { label: 'API and MCP access', hint: 'Read websites, audits, runs, reports and the export tables; start analyses with a key you allow to, using your company\'s credits', values: [true, true, true] }, // PLACEHOLDER, confirm the plans
      { label: 'Warehouse export and Looker Studio', hint: 'Six tables to BigQuery, Amazon S3, Google Cloud Storage or Cloudflare R2, daily or weekly; a Looker Studio connector', values: [false, true, true] }, // PLACEHOLDER, confirm the plans
      { label: 'Multi-company workspaces', values: [false, false, true] }, // PLACEHOLDER, confirm
      { label: 'Agency client workspaces and client logins', hint: 'A workspace per client, viewer and approver logins, approvals, one table of every client website', values: [false, false, true] }, // PLACEHOLDER, confirm the plans and any per-client price
      { label: 'White-label portal on your own domain', hint: 'Your name, logo and colour on the portal, reports, documents and e-mails; your own address and sender', values: [false, false, true] }, // PLACEHOLDER, confirm the plans
      { label: 'Onboarding with your team', values: [false, false, true] }, // PLACEHOLDER, confirm
    ],
  },
  {
    group: 'Done for you (optional)',
    rows: [
      { label: 'Setup, done for you', hint: 'Access connected, profile and style guide filled in, first audit and first ladder', values: ['$199 add-on', '$199 add-on', 'Included'] }, // PLACEHOLDER, confirm
      { label: 'We publish your pages', hint: 'Any CMS, or a pull request for a React / Next.js codebase', values: ['$99 a month', '$99 a month', 'Custom'] }, // PLACEHOLDER, confirm
      { label: 'We fix what the audit found', hint: 'The fix pack applied by a person, then audited again', values: ['$399 per site', '$399 per site', 'Custom'] }, // PLACEHOLDER, confirm
      { label: 'Everything managed for you', hint: 'The Growth plan plus all three services, every month', values: [false, '$699 a month', 'Custom'] }, // PLACEHOLDER, confirm
    ],
  },
];

/** "Credits well spent" on /pricing: each line is how the product works today. */
export const costControls: { title: string; body: string }[] = [
  {
    title: 'The price and the time first',
    body: 'Every analysis shows its price in credits and how long it takes before you press start.',
  },
  {
    title: 'Limits that hold',
    body: 'Owners set the company\'s credit limits. Analyses are checked against them before any work begins, so a limit holds even when several people start analyses at once.',
  },
  {
    title: 'Sized before you save',
    body: 'The AI question panel and every automatic job show what they use in credits a month for each website, so you can size them.',
  },
  {
    title: 'No repeated work',
    body: 'Results that cannot have changed are reused: an audit is skipped when the sitemap is unchanged, with a full audit at least every 60 days.',
  },
  {
    title: 'A free mode for backlinks',
    body: 'Run backlink checks from the free sources only (Bing Webmaster Tools, Search Console links, GA4 referrals, Common Crawl and more), for no credits at all.',
  },
];

export const pricingFaqs: FaqItem[] = [
  {
    q: 'What does "Start free" include?',
    a: 'Creating an account, setting up your company, adding websites and verifying them costs nothing, and a new company gets 200 welcome credits to try the work itself. Credits are used only when an analysis or an automatic job runs, and every analysis shows its price first.', // PLACEHOLDER, confirm
  },
  {
    q: 'What is a credit?',
    a: 'The unit everything in Alaventra is priced in. Research, writing, audits, AI answer checks and backlink checks each use credits; a credit lists at $0.05 in a pack. As a guide, a keyword verdict uses about 12 credits and a written page about 51.', // PLACEHOLDER, confirm the list price
  },
  {
    q: 'What uses credits?',
    a: 'Two things, from the same balance: the automatic work for each website (the weekly report, AI visibility and the daily AI Pulse, AI growth, backlinks, link building, the monthly audit and the pages written for the keywords you chose), and the analyses you or your team start in the app, through the API or from an AI assistant. Each website shows what its automatic work will use a month, and the Credits page splits what was used between the two.',
  },
  {
    q: 'Will pages be written that I did not ask for?',
    a: 'No. Pages are written automatically only for keywords you chose, and the level you pick decides what else may be done on its own: Only my keywords, My keywords and keep my pages healthy (refreshes of your existing pages on your topics), or Full autopilot. Two days before each week\'s work, "Coming up" lists every page with its credits, and you can skip any of them.',
  },
  {
    q: 'Will I be charged more than the price shown?',
    a: 'No. An analysis shows its price in credits before it starts and holds that price while it runs. When it finishes it is charged the credits it really used, sometimes fewer, never more.',
  },
  {
    q: 'What if an analysis fails?',
    a: 'It is free. Any credits it had used are given back.',
  },
  {
    q: 'What happens when credits run out?',
    a: 'New analyses are refused with the reason, and each website\'s automatic work pauses. Nothing is lost: it picks up again by itself as soon as credits are added or a new month starts. Owners and admins get an e-mail when credits are running low, again when they run out, and when the work resumes.',
  },
  {
    q: 'Do credits expire?',
    a: 'Packs last 12 months. A plan\'s monthly credits roll over for one month, then expire. Welcome credits last 90 days. Credits are always used soonest-expiring first, and the Credits page lists every lot with its expiry date.', // PLACEHOLDER, confirm the expiry periods
  },
  {
    q: 'Can I limit what we spend?',
    a: 'Yes. Owners can set a monthly limit for the analyses people start and a separate one for the automatic work, and can keep enough credits aside for each website\'s automatic work this month so a busy week of analyses never pauses it.',
  },
  {
    q: 'How do I buy more credits?',
    a: 'Choose a pack on the Credits page in the app: 500, 2,000, 5,000 or 20,000 credits. The Alaventra team confirms the request and sends the invoice, and the credits are added to your company for 12 months. You can cancel a request while it is waiting.', // PLACEHOLDER, confirm the packs and the invoicing
  },
  {
    q: 'Can you set it up for us?',
    a: 'Yes, as a paid service. A person connects Search Console and Analytics, proves the domain is yours, fills in your business profile and style guide from one call, switches on the tracking and monitors you want, and runs the first audit and the first keyword ladder. Everything in it is also something you can do yourself: the app has a step-by-step guide beside every ask.', // PLACEHOLDER, confirm the service
  },
  {
    q: 'Do you publish the pages to our site?',
    a: 'The software sends pages to WordPress, Webflow, Contentful or your own endpoint as drafts, and an owner or admin publishes them live with one click; a page that failed its checks is never sent. For any other setup our publishing service does it as a paid add-on: WordPress, Shopify, Webflow, Squarespace, Ghost or a headless CMS, and for a React or Next.js codebase the page arrives as a pull request your developers merge. Nothing goes live without your approval.', // PLACEHOLDER, confirm the service
  },
  {
    q: 'Can you fix what the audit finds?',
    a: 'Yes, as a paid service: the fix pack applied to your site (robots.txt, llms.txt, redirects, structured data and internal links), plus the critical and high findings that do not need a redesign, every change through your review, then a re-audit showing the score before and after.', // PLACEHOLDER, confirm the service
  },
  {
    q: 'What counts as a website?',
    a: 'One domain your company has verified it owns, through Search Console, a DNS TXT record or a meta tag, with its own tracking, audits and pipeline.',
  },
  {
    q: 'How much is annual billing?',
    a: 'The same as twelve monthly payments: a plan\'s credits cost the same per credit whether you pay monthly or for the year, and they arrive on the 1st of every month either way.',
  },
  {
    q: 'What is the free-sources backlink mode?',
    a: 'A backlink check that uses only the free sources: Bing Webmaster Tools, Search Console links, GA4 referrals, the Common Crawl web graph, Wikipedia, Hacker News, news and web search, and Alaventra\'s own link check. It leaves out the paid link index, so it uses no credits.',
  },
  {
    q: 'Can we change plans later?',
    a: 'Yes. Talk to us and we will move your company to the plan that fits; your websites, history and settings stay as they are.', // PLACEHOLDER, confirm
  },
];
