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
    price: '$39', // PLACEHOLDER — confirm
    period: 'per month', // PLACEHOLDER — confirm
    monthly: 39, // PLACEHOLDER — confirm (keep equal to `price`)
    description: 'One website, the whole loop: research, a page a week, monthly audits and the Monday report.',
    // ?plan= is ignored by the sign-up page today; it records which plan the visitor came from
    cta: { label: 'Start free', to: '/signup?plan=starter' },
    features: [
      '1 website', // PLACEHOLDER — confirm
      'Keyword research, verdicts and difficulty for your site',
      'One active keyword ladder', // PLACEHOLDER — confirm
      'A page a week, written, checked and ready to publish', // PLACEHOLDER — confirm
      'Monthly technical audit with a fix pack',
      'Search Console, GA4 and Trends tracking, with weekly rank checks',
      'Monday report, alerts and share links',
      'Reports delivered by e-mail or webhook, on your schedule',
      'A step-by-step guide for every setup task',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$129', // PLACEHOLDER — confirm
    period: 'per month', // PLACEHOLDER — confirm
    monthly: 129, // PLACEHOLDER — confirm (keep equal to `price`)
    description: 'Everything the engine does, on up to three websites — including AI answers and backlinks.',
    cta: { label: 'Start free', to: '/signup?plan=growth' },
    highlighted: true,
    includesPrevious: 'Everything in Starter, plus:',
    features: [
      'Up to 3 websites', // PLACEHOLDER — confirm
      'Up to three pages a week, with the autopilot pipeline and several ladders', // PLACEHOLDER — confirm
      'AI search visibility: up to 50 questions and the daily AI Pulse',
      'Backlinks from every source, with Ascentra’s own link checks',
      'Crawler analytics from your server logs: Google and the AI crawlers, each one checked',
      'Link building: prospects, contacts and pitches from your own mailbox',
      'Full SEO reports as PDF or Word',
      'Daily key-page check and the pre-release check for your build',
      'Signed webhook deliveries into your own systems',
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
      'Agency client portal: client workspaces, client logins and approvals, white-label on your own domain', // PLACEHOLDER — confirm the plan and any per-client price
      'Single sign-on (SAML 2.0 / OIDC) and SCIM provisioning',
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
  'Your plan covers the pages and the checks listed above. Anything extra you start by hand shows its cost before it runs and is capped by the budget you set, so the bill cannot run away.'; // PLACEHOLDER — confirm the billing model (plan-included usage vs usage on top)

/**
 * "Done for you" — the work a person on our team does, on top of any plan. The software does not do these: somebody has to be given
 * access, open the CMS and review a change. PRICES AND DELIVERY ARE PLACEHOLDERS: confirm what the team can actually commit to
 * (capacity, turnaround, which stacks, what happens when a job runs long) before this goes live.
 */
export interface ServicePackage {
  id: 'setup' | 'publishing' | 'fixes' | 'managed';
  name: string;
  /** shown big */
  price: string;
  /** "one-off", "per month", … */
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
    price: '$199', // PLACEHOLDER — confirm
    period: 'one-off',
    description: 'We do the connecting and the first run, so your first Monday report is a real one.',
    includes: [
      'Ownership proved and Search Console and GA4 connected',
      'Your business profile, author and style guide filled in from one 30-minute call',
      'Tracking, keywords, competitors and the monitors you want switched on',
      'The IndexNow file and your outreach mailbox set up',
      'Your first technical audit and your first keyword ladder, explained on a call',
    ],
    turnaround: 'Within five working days of getting access', // PLACEHOLDER — confirm
    needs: 'An admin seat in your Ascentra company, plus whoever can edit DNS or your website for one of the steps.',
    cta: { label: 'Ask about setup', to: '/contact?topic=sales' },
  },
  {
    id: 'publishing',
    name: 'We publish your pages',
    price: '$99', // PLACEHOLDER — confirm
    period: 'per month, up to 4 pages',
    description: 'The finished pages go live on your site — whatever your site is built with.',
    includes: [
      'WordPress, Shopify, Webflow, Squarespace, Ghost or a headless CMS',
      'A React, Next.js or other codebase: the page arrives as a pull request for your developers to merge',
      'Title, meta description, images, internal links and structured data all in place',
      'The live publish check run afterwards, so you see what the CMS changed',
      'Extra pages beyond four: $29 each', // PLACEHOLDER — confirm
    ],
    turnaround: 'Each page live within three working days of approval', // PLACEHOLDER — confirm
    needs: 'An editor login, or a repository you can give us a branch in. Nothing goes live without your yes.',
    cta: { label: 'Ask about publishing', to: '/contact?topic=sales' },
  },
  {
    id: 'fixes',
    name: 'We fix what the audit found',
    price: '$399', // PLACEHOLDER — confirm
    period: 'per website, one-off',
    description: 'The fix pack applied to your site by a person, then audited again so you can see the difference.',
    includes: [
      'robots.txt, llms.txt, redirects, structured data and the internal links from the fix pack',
      'The critical and high findings that can be fixed without redesigning anything',
      'Every change through your review: a pull request, a staging link or a written list',
      'A re-audit afterwards, with the health score before and after',
      'Ongoing technical care afterwards: $149 a month', // PLACEHOLDER — confirm
    ],
    turnaround: 'Within ten working days of the audit', // PLACEHOLDER — confirm
    needs: 'Access to the site or its repository, and someone who can approve a change.',
    cta: { label: 'Ask about fixes', to: '/contact?topic=sales' },
  },
  {
    id: 'managed',
    name: 'Managed',
    price: '$699', // PLACEHOLDER — confirm
    period: 'per month',
    description: 'One number for the whole thing: the Growth plan and all three services, running every month.',
    includes: [
      'The Growth plan for your website',
      'Setup included, with a quarterly review of the plan',
      'Four pages published for you every month',
      'Audit findings fixed every month, with the score tracked',
      'One person who knows your site, and a monthly call',
    ],
    turnaround: 'Starts the week you sign up', // PLACEHOLDER — confirm
    needs: 'The same access as the services above, and someone on your side to approve what goes live.',
    cta: { label: 'Talk to us', to: '/contact?topic=sales' },
    highlighted: true,
  },
];

/** one line under the service cards */
export const servicesNote =
  'A person does this work, not a script. We only ask for access you can withdraw at any time, every change goes through your review, and nothing is published or sent without your approval.'; // PLACEHOLDER — confirm the delivery promise

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
      { label: 'Keyword ladders', values: ['1 active', 'Several', 'Several'] }, // PLACEHOLDER — confirm
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
      { label: 'Blog package and CMS publishing', hint: 'HTML, Markdown, meta.json and the images — or sent to WordPress, Webflow, Contentful or a signed webhook, as drafts by default', values: [true, true, true] },
      { label: 'Your house style, applied and checked', hint: 'How your name is written, British or American spelling, words to avoid and the tone', values: [true, true, true] },
      { label: 'Refreshes instead of duplicates', hint: 'A search one of your live pages already answers is queued as a refresh of that page', values: [true, true, true] },
      { label: 'Live publish check', hint: 'Verifies the page once it is live', values: [true, true, true] },
      { label: 'Check any page before you publish', hint: 'Paste a page or send it from your build: the same quality verdict, every reason named, free', values: [true, true, true] },
    ],
  },
  {
    group: 'Automation',
    rows: [
      { label: 'Weekly content cadence', hint: 'Pages written, checked and ready to publish', values: ['1 a week', 'Up to 3 a week', 'Custom'] }, // PLACEHOLDER — confirm
      { label: 'Autopilot pipeline (Auto / Manual)', hint: 'Several ladders, “Needs you” queue, 4-week calendar', values: [false, true, true] }, // PLACEHOLDER — confirm
    ],
  },
  {
    group: 'Monitoring',
    rows: [
      { label: 'Technical audits with fix pack', values: ['Monthly', 'Monthly', 'Monthly'] },
      { label: 'Crawl depth', hint: 'JavaScript rendering included', values: ['200 pages', '500 pages', '1,000 pages'] }, // PLACEHOLDER — confirm
      { label: 'Daily key-page check and pre-release check', hint: 'Your build asks whether a release candidate is safe to publish', values: [true, true, true] },
      { label: 'What only appears after JavaScript', hint: 'Key pages read twice, so content a crawler cannot see is flagged', values: [true, true, true] },
      { label: 'Search Console, GA4 and Trends', values: [true, true, true] },
      { label: 'AI search visibility', hint: 'ChatGPT, Gemini, Perplexity, Claude, AI Mode, AI Overviews', values: [false, 'Up to 50 questions', 'Up to 50 questions'] }, // PLACEHOLDER — confirm
      { label: 'Daily AI Pulse', hint: 'Alerts only on statistically real changes', values: [false, true, true] },
      { label: 'AI growth, every week', hint: 'New pages sent to Bing and IndexNow, key pages scored for AI readiness, the questions to win queued', values: [false, true, true] },
      { label: 'Earned media', hint: 'The exact pages AI cites without naming you, with a draft for each', values: [false, true, true] },
      { label: 'Crawler analytics from your server logs', hint: 'Googlebot and the AI crawlers, each checked against its company’s addresses; impostors apart', values: [false, true, true] }, // PLACEHOLDER — confirm
      { label: 'Backlinks from every source', hint: 'Nine sources, every link checked by Ascentra', values: [false, true, true] }, // PLACEHOLDER — confirm
      { label: 'Prospects, contacts and outreach drafts from your own mailbox', values: [false, true, true] },
      { label: 'Mailbox connected without a password', hint: 'Microsoft 365 or Gmail on their own sign-in screen; an app password works for any other host', values: [false, true, true] },
      { label: 'Listings you can add yourself', hint: 'Directories and marketplaces worth being on, checked and kept up to date', values: [false, true, true] },
      { label: 'Journalist requests, podcasts and broken-link reclaim', hint: 'Free sources read every week, matched to your topics', values: [false, true, true] },
      { label: 'Replies read and answered', hint: 'Each reply classed and summarised with a suggested answer, and your link checked', values: [false, true, true] },
      { label: 'What each won link did', hint: 'The page compared with your other pages over the same weeks — likely helped, never “caused”', values: [false, true, true] },
    ],
  },
  {
    group: 'Reports and alerts',
    rows: [
      { label: 'Monday report', values: [true, true, true] },
      { label: 'Charts marked with what happened', hint: 'Pages you published, technical fixes, Google updates and breaks in Google’s own data', values: [true, true, true] },
      { label: 'Where every figure came from', hint: 'Each number names its source, its period and when it was read', values: [true, true, true] },
      { label: 'Alerts only when a change is real', hint: 'A fall is called a fall once it is beyond normal week-to-week variation', values: [true, true, true] },
      { label: 'Full SEO report (PDF / Word)', values: [false, true, true] }, // PLACEHOLDER — confirm
      { label: 'Share a report by link', hint: 'Read-only, no account needed, expires on the day you choose and can be turned off at any time', values: [true, true, true] },
      { label: 'Reports delivered to you', hint: 'As each one arrives, or a daily, weekly or monthly summary — by e-mail with the figures and files, and to a webhook', values: [true, true, true] },
      { label: 'Reports that are not ready are held back', hint: 'A page that failed its quality check or a verdict the analysis could not make is never sent, and the reason is stated', values: [true, true, true] },
      { label: 'Signed webhook deliveries', hint: 'Every body signed with your own secret, so your systems can tell the message is ours', values: [false, true, true] },
      { label: 'Search Console alert watcher and monthly check-ins', values: [false, false, true] }, // PLACEHOLDER — confirm
    ],
  },
  {
    group: 'Platform and control',
    rows: [
      { label: 'Websites', values: ['1', 'Up to 3', 'Custom'] }, // PLACEHOLDER — confirm
      { label: 'Roles and invitations', hint: 'Owner, admin, member and viewer', values: [true, true, true] },
      { label: 'Two-step verification', hint: 'Authenticator app, passkeys or a security key, and recovery codes; a company can require it for everyone', values: [true, true, true] },
      { label: 'Signed-in devices and idle sign-out', hint: 'Sign a device out; end idle sessions after the time your company sets', values: [true, true, true] },
      { label: 'Audit log', hint: 'Sign-ins, team, settings, keys and sharing — who, when and from where; CSV export', values: [true, true, true] }, // PLACEHOLDER — confirm the plans
      { label: 'Single sign-on (SAML 2.0 and OIDC)', hint: 'Okta, Microsoft Entra ID, Google Workspace or any standard provider, on your verified e-mail domains; can be required', values: [false, false, true] }, // PLACEHOLDER — confirm the plans
      { label: 'SCIM provisioning', hint: 'People created, updated and switched off from your identity provider; groups mapped to roles', values: [false, false, true] }, // PLACEHOLDER — confirm the plans
      { label: 'Verified website ownership', values: [true, true, true] },
      { label: 'Step-by-step guides for every setup task', hint: 'Your own values, instructions for the provider you use, and a copy you can e-mail to a colleague', values: [true, true, true] },
      { label: 'Cost estimate before every run', hint: 'The analysis engine’s own figure, corrected against what runs really cost, and replaced with the actual cost when the work finishes', values: [true, true, true] },
      { label: 'Spend caps per company', values: [true, true, true] },
      { label: 'Read-only API and MCP access', hint: 'Websites, audits and findings, runs and reports, with revocable keys per company', values: [true, true, true] }, // PLACEHOLDER — confirm the plans
      { label: 'Multi-company workspaces', values: [false, false, true] }, // PLACEHOLDER — confirm
      { label: 'Agency client workspaces and client logins', hint: 'A workspace per client, viewer and approver logins, approvals, one table of every client website', values: [false, false, true] }, // PLACEHOLDER — confirm the plans and any per-client price
      { label: 'White-label portal on your own domain', hint: 'Your name, logo and colour on the portal, reports, documents and e-mails; your own address and sender', values: [false, false, true] }, // PLACEHOLDER — confirm the plans
      { label: 'Onboarding with your team', values: [false, false, true] }, // PLACEHOLDER — confirm
    ],
  },
  {
    group: 'Done for you (optional)',
    rows: [
      { label: 'Setup, done for you', hint: 'Access connected, profile and style guide filled in, first audit and first ladder', values: ['$199 add-on', '$199 add-on', 'Included'] }, // PLACEHOLDER — confirm
      { label: 'We publish your pages', hint: 'Any CMS, or a pull request for a React / Next.js codebase', values: ['$99 a month', '$99 a month', 'Custom'] }, // PLACEHOLDER — confirm
      { label: 'We fix what the audit found', hint: 'The fix pack applied by a person, then audited again', values: ['$399 per site', '$399 per site', 'Custom'] }, // PLACEHOLDER — confirm
      { label: 'Everything managed for you', hint: 'The Growth plan plus all three services, every month', values: [false, '$699 a month', 'Custom'] }, // PLACEHOLDER — confirm
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
    q: 'Can you set it up for us?',
    a: 'Yes, as a paid service. A person connects Search Console and Analytics, proves the domain is yours, fills in your business profile and style guide from one call, switches on the tracking and monitors you want, and runs the first audit and the first keyword ladder. Everything in it is also something you can do yourself: the app has a step-by-step guide beside every ask.', // PLACEHOLDER — confirm the service
  },
  {
    q: 'Do you publish the pages to our site?',
    a: 'The software sends pages to WordPress, Webflow, Contentful or your own endpoint as drafts, and an owner or admin publishes them live with one click — a page that failed its checks is never sent. For any other setup our publishing service does it, as a paid add-on — WordPress, Shopify, Webflow, Squarespace, Ghost or a headless CMS, and for a React or Next.js codebase the page arrives as a pull request your developers merge. Nothing goes live without your approval.', // PLACEHOLDER — confirm the service
  },
  {
    q: 'Can you fix what the audit finds?',
    a: 'Yes, as a paid service: the fix pack applied to your site — robots.txt, llms.txt, redirects, structured data and internal links — plus the critical and high findings that do not need a redesign, every change through your review, then a re-audit showing the score before and after.', // PLACEHOLDER — confirm the service
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
