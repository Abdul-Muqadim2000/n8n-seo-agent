// The capabilities registry: the single source the marketing pages render from (Home grid, Platform mega-menu, /platform,
// /platform/<slug>, footer). Add every new product functionality here (CLAUDE.md). Copy rules: customer language, plain and
// specific, capability facts only — no invented customers, ratings or results.
import {
  Building2,
  ChartLine,
  ChartNoAxesColumnIncreasing,
  FileText,
  Link2,
  PenLine,
  ScanSearch,
  Search,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { ImageKey } from './images';

/** product mockups and diagrams drawn in code (see `marketing/components/FeatureVisual.tsx`) */
export type VisualKey =
  | 'dashboard'
  | 'ai-visibility'
  | 'ladder'
  | 'backlinks'
  | 'keyword-verdict'
  | 'content'
  | 'audit'
  | 'workspace'
  | 'growth-loop'
  | 'link-sources'
  | 'ai-engines';

export interface Fact {
  /** a number counts up when it scrolls into view; a string is shown as is */
  value: number | string;
  prefix?: string;
  suffix?: string;
  label: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Step {
  title: string;
  body: string;
}

export interface Feature {
  slug: string;
  name: string;
  shortName: string;
  /** one line: mega-menu, cards */
  tagline: string;
  /** two or three sentences: feature page lead */
  summary: string;
  icon: LucideIcon;
  /** 4–6 bullets */
  benefits: string[];
  /** 3–4 steps */
  steps: Step[];
  /** 3 capability facts */
  facts: Fact[];
  /** 3–4 questions */
  faqs: FaqItem[];
  related: string[];
  image: ImageKey;
  /** main product visual */
  visual: VisualKey;
  /** optional second visual (diagram) */
  diagram?: VisualKey;
}

export const features: Feature[] = [
  {
    slug: 'autopilot',
    name: 'Autopilot pipeline',
    shortName: 'Autopilot',
    tagline: 'A weekly growth loop that plans, writes and checks. You approve what matters.',
    summary:
      'Ascentra runs your SEO as a weekly loop. Each Monday it picks the next posts — a ladder rung first, then keywords close to page one, then rising trends — writes them, notices what you published and puts every decision that needs a person in one queue. Each step runs on Auto or waits for you.',
    icon: Workflow,
    benefits: [
      'Blog posts per week set per website, picked in a fixed order: ladder rung, striking distance, rising trend',
      'Auto or Manual for every step, per ladder and per website',
      'A “Needs you” queue for briefs, pages and decisions waiting on a person',
      'A 4-week calendar and every schedule with its next and last run',
      'Notices when a planned page goes live and moves the plan on',
      'A pile-up guard: no new pages while too many wait to be published',
    ],
    steps: [
      { title: 'Set the pace', body: 'Choose blog posts per week, the default mode — Auto or Manual — and how many ladders are written at once.' },
      { title: 'Ascentra picks the work', body: 'Every Monday the next ladder rung comes first, then keywords just off page one, then rising trends.' },
      { title: 'Write, check, queue', body: 'Pages are written and checked. Anything set to Manual waits in “Needs you” until someone approves it.' },
      { title: 'Publish and learn', body: 'When a planned page goes live, Ascentra notices, tracks its rank and plans the next step.' },
    ],
    facts: [
      { value: 'Weekly', label: 'cadence, planned every Monday' },
      { value: 4, suffix: '-week', label: 'calendar of upcoming work' },
      { value: 2, label: 'ladders written at once by default' },
    ],
    faqs: [
      { q: 'What happens on Auto?', a: 'Ascentra writes and prepares the work on schedule without waiting. Every page still shows in the pipeline, and you can pause a ladder at any time.' },
      { q: 'What happens on Manual?', a: 'The step waits in “Needs you” until someone on your team approves it. Nothing is written before that.' },
      {
        q: 'Does Ascentra publish to my site by itself?',
        a: 'No. It prepares a publish-ready package — HTML, Markdown and meta data — and can create WordPress drafts. Your team publishes; Ascentra then checks the live page.',
      },
      { q: 'Can I change the pace later?', a: 'Yes. Posts per week, the default mode and the ladder limits are website settings you can change at any time.' },
    ],
    related: ['keyword-ladders', 'content', 'site-tracking'],
    image: 'teamPlanning',
    visual: 'growth-loop',
  },
  {
    slug: 'keyword-research',
    name: 'Keyword research and verdicts',
    shortName: 'Keyword research',
    tagline: 'Find the keywords worth your time, with a clear verdict for each one.',
    summary:
      'Ascentra discovers keywords from your site, your competitors and real search data, then gives each one a verdict. It weighs difficulty for your site — not a generic score — along with topic fit and the plan it takes to rank: Direct, Short or Full.',
    icon: Search,
    benefits: [
      'Keyword discovery from your pages, your competitors and search data',
      'A verdict for every keyword, with the reasons behind it',
      'Difficulty for your site: reach measured against your own domain',
      'A plan type per keyword: Direct page, Short ladder or Full ladder',
      'Topic fit, so you only chase keywords your business can own',
      'A quick keyword check before you commit to a plan',
    ],
    steps: [
      { title: 'Describe the business', body: 'Your website, market and goals set the context for every keyword Ascentra looks at.' },
      { title: 'Discover', body: 'Candidates come from your pages, your competitors, search volumes and trends in your market.' },
      { title: 'Judge', body: 'Each keyword gets reach for your site, topic fit, search intent and a plan type.' },
      { title: 'Act', body: 'Start a ladder, write a single page or keep the keyword for later.' },
    ],
    facts: [
      { value: 3, label: 'plan types: Direct, Short and Full' },
      { value: 1, label: 'verdict per keyword, with its reasons' },
      { value: 0, label: 'overlapping keywords between ladders' },
    ],
    faqs: [
      {
        q: 'What does “difficulty for your site” mean?',
        a: 'Generic difficulty scores ignore who is trying to rank. Ascentra compares the competition for a keyword with your own site and tells you whether it is within reach now or only after supporting pages.',
      },
      {
        q: 'What are Direct, Short and Full plans?',
        a: 'Direct: one strong page can rank. Short: a few supporting pages come first. Full: a complete ladder of supporting pages that climbs to the keyword.',
      },
      { q: 'Can I bring my own keywords?', a: 'Yes. Type a keyword and Ascentra checks it, or let it recommend keywords from discovery.' },
      { q: 'Which markets are covered?', a: 'You choose the country for each run; volumes and results come from that market.' },
    ],
    related: ['keyword-ladders', 'content', 'site-tracking'],
    image: 'notesLaptop',
    visual: 'keyword-verdict',
  },
  {
    slug: 'keyword-ladders',
    name: 'Keyword ladders',
    shortName: 'Keyword ladders',
    tagline: 'Rank for a hard keyword by climbing to it, one supporting page at a time.',
    summary:
      'Tell Ascentra the keyword you want to rank for. It builds a ladder of easier, related pages that earn relevance first, each linking up to the page for the head term. It writes the rungs in order, tracks every position weekly and keeps ladders from competing with each other.',
    icon: ChartNoAxesColumnIncreasing,
    benefits: [
      'A plan of supporting pages that climbs to your head term',
      'Pages written in order, each linking up the ladder',
      'Weekly rank tracking for every rung and for the head term',
      'Auto or Manual per ladder, with a priority order',
      'Two active ladders at a time by default, so effort is not spread thin',
      'No keyword overlap between ladders, so your own pages never compete',
    ],
    steps: [
      { title: 'Choose the keyword', body: 'Pick a recommended keyword or type your own. Ascentra shows the reach for your site and the plan type.' },
      { title: 'Get the plan', body: 'See the rungs, the order they are written in and how they link to each other.' },
      { title: 'Climb', body: 'Rungs are written and published one by one, and every position is checked weekly.' },
      { title: 'Reach the top', body: 'When the head term ranks, the ladder is marked as won and the next one moves up.' },
    ],
    facts: [
      { value: 2, label: 'active ladders at a time by default' },
      { value: 'Weekly', label: 'rank checks for every rung' },
      { value: 0, label: 'keyword overlap between ladders' },
    ],
    faqs: [
      {
        q: 'Why not write the main page first?',
        a: 'For a hard keyword, a new page rarely ranks on its own. Supporting pages on related, easier keywords build relevance and internal links first. If you need the main page now, choose “Write it first”.',
      },
      {
        q: 'What is the pile-up guard?',
        a: 'If too many written pages are waiting to be published, Ascentra pauses new writing until you catch up, so drafts do not pile up.',
      },
      { q: 'How many ladders can I run?', a: 'As many as you plan. By default two are written at once, in your priority order, and you can change the limit.' },
      { q: 'What does Auto or Manual change?', a: 'On Auto, rungs are written on schedule. On Manual, each rung waits for approval in “Needs you”.' },
    ],
    related: ['keyword-research', 'autopilot', 'content'],
    image: 'growthChartPaper',
    visual: 'ladder',
  },
  {
    slug: 'content',
    name: 'Content engine',
    shortName: 'Content',
    tagline: 'Long-form pages written, critiqued and edited by AI, with SEO QA before you see them.',
    summary:
      'Every page goes through a writer, a critic and an editor, then an SEO check. Pages carry real expertise signals — an author byline, an expert reviewer, your experience notes and schema — and arrive as a publish-ready package with a three-image plan.',
    icon: PenLine,
    benefits: [
      'Writer, critic and editor passes, then an SEO quality check',
      'E-E-A-T built in: author byline and box, expert reviewer, experience notes and schema',
      'Page types for hub and pillar pages, case studies, local (city) pages and video pages',
      'A three-image plan with alt text, file names and the social image',
      'A blog package as HTML, Markdown and meta.json, or a WordPress draft',
      'A live check of the published page: schema, images, links and metadata',
    ],
    steps: [
      { title: 'Brief', body: 'Keyword, intent and outline, with facts from your business profile and your case studies.' },
      { title: 'Write and critique', body: 'A draft, a critic’s review and an editor’s pass that acts on it.' },
      { title: 'Check', body: 'SEO checks on every page. Figures that cannot be verified are marked for you to confirm.' },
      { title: 'Publish and verify', body: 'Take the package or a WordPress draft; Ascentra checks the page once it is live.' },
    ],
    facts: [
      { value: 3, label: 'passes: writer, critic and editor' },
      { value: 4, label: 'special page types' },
      { value: 3, label: 'images planned per article' },
    ],
    faqs: [
      {
        q: 'Will the pages read like generic AI text?',
        a: 'Each page is written from a brief built on your business profile, your experience notes and your case studies, then reviewed by a critic and an editor. Figures that cannot be verified are marked for you to confirm instead of being made up.',
      },
      { q: 'Who is shown as the author?', a: 'The author and expert reviewer from your business profile, with a byline, an author box and Person schema.' },
      { q: 'Can Ascentra publish to WordPress?', a: 'It creates WordPress drafts for your team to review. Publishing stays with you.' },
      { q: 'What is the blog package?', a: 'The article as HTML and Markdown, plus a meta.json file with the title, description, slug, schema and image plan — ready for any CMS.' },
    ],
    related: ['keyword-ladders', 'autopilot', 'technical-audits'],
    image: 'colleaguesReview',
    visual: 'content',
  },
  {
    slug: 'technical-audits',
    name: 'Technical audits',
    shortName: 'Technical audits',
    tagline: 'Crawl the site, read Search Console and get a fix pack, not just a list of problems.',
    summary:
      'Ascentra crawls up to 1,000 pages, JavaScript included, and combines what it finds with Search Console index coverage and sitemaps, page speed and a brand and entity check. Every audit ends with a fix pack your developers can apply, and monthly audits show what changed since the last one.',
    icon: ScanSearch,
    benefits: [
      'Crawls of 200, 500 or 1,000 pages, with JavaScript rendering',
      'Search Console index coverage, submitted sitemaps and site structure',
      'Page speed and a brand and entity check',
      'A fix pack: robots.txt, llms.txt, redirects, schema and an internal-links CSV',
      'Monthly scheduled audits with what changed since the last audit',
      'Skipped automatically when nothing on the site has changed',
    ],
    steps: [
      { title: 'Crawl', body: 'Up to 1,000 pages, rendered with JavaScript where the content needs it.' },
      { title: 'Combine', body: 'Crawl findings meet Search Console coverage, sitemaps, page speed and entity data.' },
      { title: 'Prioritise', body: 'Issues are grouped by impact, with what changed since the last audit.' },
      { title: 'Fix', body: 'Download the fix pack and hand it to your developers.' },
    ],
    facts: [
      { value: 1000, label: 'pages per crawl, JavaScript included' },
      { value: 5, label: 'files in every fix pack' },
      { value: 3, label: 'crawl depths: 200, 500 and 1,000' },
    ],
    faqs: [
      {
        q: 'Do monthly audits cost money when nothing changed?',
        a: 'No. Ascentra compares your sitemap with the last audit and skips the crawl when nothing changed, with a full audit at least every 60 days.',
      },
      { q: 'What is in the fix pack?', a: 'A robots.txt, an llms.txt, a redirect list, schema snippets and an internal-links CSV, zipped together.' },
      { q: 'Does it need access to my server?', a: 'No. Ascentra crawls the public site and reads Search Console through a service account you add as a user.' },
      { q: 'Does it handle JavaScript sites?', a: 'Yes. Pages can be rendered with JavaScript, so content that loads in the browser is audited too.' },
    ],
    related: ['site-tracking', 'content', 'reports'],
    image: 'analyticsMonitor',
    visual: 'audit',
  },
  {
    slug: 'site-tracking',
    name: 'Site tracking',
    shortName: 'Site tracking',
    tagline: 'Search Console, GA4 and Google Trends in one weekly view, with what to do next.',
    summary:
      'Connect Search Console and GA4 once. Every week Ascentra pulls clicks, impressions, positions and conversions, follows Google Trends for your topics and checks live rankings, then points at striking-distance keywords — the ones close to page one.',
    icon: ChartLine,
    benefits: [
      'Google Search Console and GA4, connected through a service account',
      'Google Trends for your topics and live rank checks',
      'Striking-distance keywords: close to page one and worth a push',
      'A weekly report every Monday with the changes that matter',
      'Notices when you publish a page from the plan',
      'Dashboards per website for search, traffic, rankings and content',
    ],
    steps: [
      { title: 'Connect', body: 'Add Ascentra’s service account to Search Console and choose your GA4 property.' },
      { title: 'Collect', body: 'Search, traffic, trends and live rankings are gathered every week.' },
      { title: 'Compare', body: 'Week over week, with striking-distance keywords called out.' },
      { title: 'Act', body: 'Recommendations and posts flow straight into the pipeline.' },
    ],
    facts: [
      { value: 3, label: 'Google sources: Search Console, GA4 and Trends' },
      { value: 'Weekly', label: 'report, every Monday' },
      { value: 'Live', label: 'rank checks where Search Console has no data' },
    ],
    faqs: [
      { q: 'What access does Ascentra need?', a: 'You add Ascentra’s service account as a user in Search Console and GA4. It reads your data; it does not change your settings.' },
      {
        q: 'What is a striking-distance keyword?',
        a: 'A keyword where your page already ranks just below the top results. Small improvements there tend to pay off fastest, so the pipeline picks them early.',
      },
      { q: 'How often is the data refreshed?', a: 'Every week, with live rank checks for keywords Search Console does not report.' },
    ],
    related: ['reports', 'keyword-ladders', 'technical-audits'],
    image: 'analyticsLaptop',
    visual: 'dashboard',
  },
  {
    slug: 'ai-visibility',
    name: 'AI search visibility',
    shortName: 'AI visibility',
    tagline: 'See how often ChatGPT, Gemini, Perplexity, Claude and Google’s AI name and cite you.',
    summary:
      'Ascentra asks a panel of up to 50 real buyer questions to six AI engines and records who is named and cited. A daily AI Pulse watches for changes and alerts only when they are statistically real, and GA4 shows the visits and revenue AI answers send you.',
    icon: Sparkles,
    benefits: [
      'A panel of up to 50 buyer questions, built from real AI-answer data and your Search Console queries',
      'ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews',
      'Mention rate, citation rate and share of voice against competitors, with 95% ranges',
      'A daily AI Pulse that alerts only on statistically real changes',
      'Visits, key events and revenue from AI referrals in GA4',
      'Answer Analyst for sentiment and wrong claims, plus AI crawler access and llms.txt',
    ],
    steps: [
      { title: 'Build the panel', body: 'Up to 50 questions your buyers ask, grouped by stage and topic.' },
      { title: 'Ask every engine', body: 'ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews, on a schedule.' },
      { title: 'Measure', body: 'Mentions, citations and share of voice, each with a 95% range so noise is not news.' },
      { title: 'Act', body: 'Value-ranked actions, the sources AI engines trust and the claims to correct.' },
    ],
    facts: [
      { value: 50, label: 'buyer questions per panel' },
      { value: 6, label: 'AI engines and answer surfaces' },
      { value: 95, suffix: '%', label: 'ranges on every rate' },
    ],
    faqs: [
      {
        q: 'Why ranges instead of one number?',
        a: 'AI answers vary from one ask to the next. Ascentra asks repeatedly and shows each rate with a 95% range, so you can tell a real change from noise.',
      },
      { q: 'What does the daily AI Pulse cost?', a: 'It can be switched on or off per website, and the cost is shown in the settings before you turn it on.' },
      {
        q: 'Can it tell me what AI gets wrong about us?',
        a: 'Yes. The Answer Analyst compares answers with your business profile and lists wrong claims, sentiment and the order brands are named in.',
      },
      { q: 'Can AI crawlers reach my site?', a: 'Every week Ascentra checks robots.txt for each AI crawler, your llms.txt file and whether your CDN blocks them.' },
    ],
    related: ['backlinks', 'content', 'reports'],
    image: 'meetingGesture',
    visual: 'ai-visibility',
    diagram: 'ai-engines',
  },
  {
    slug: 'backlinks',
    name: 'Backlinks from every source',
    shortName: 'Backlinks',
    tagline: 'One link ledger from nine sources, with every link checked by Ascentra itself.',
    summary:
      'Link indexes miss links and sometimes report live ones as lost. Ascentra merges nine sources into one ledger and checks every link itself: a link counts as lost only after two misses, and you see why. Prospects are scored, contacts found and follow-ups scheduled.',
    icon: Link2,
    benefits: [
      'Nine sources: a commercial index, Bing Webmaster Tools, Search Console links, GA4 referrals, the Common Crawl web graph, Wikipedia, Hacker News, news and web search',
      'Every link checked by Ascentra: rel, placement, noindex and canonical',
      'Lost only after two misses, with the reason',
      'SEO, referral and brand value for every link',
      'Scored prospects with contacts, outreach drafts and follow-ups after 7 and 14 days',
      'A free-sources mode that costs nothing to run',
    ],
    steps: [
      { title: 'Merge', body: 'Nine sources flow into one ledger, one row per referring site.' },
      { title: 'Check', body: 'Ascentra visits each linking page and reads the link the way a search engine would.' },
      { title: 'Value', body: 'Every link gets an SEO, referral and brand value.' },
      { title: 'Grow', body: 'Scored prospects, contacts, outreach drafts and follow-up reminders.' },
    ],
    facts: [
      { value: 9, label: 'link sources in one ledger' },
      { value: 2, label: 'misses before a link counts as lost' },
      { value: 0, prefix: '$', label: 'to run the free-sources mode' },
    ],
    faqs: [
      {
        q: 'Why check links yourself?',
        a: 'Indexes refresh on their own schedule and can report a live, followed link as lost. Ascentra visits the page and confirms before it raises an alert.',
      },
      { q: 'Can I import links from other tools?', a: 'Yes. Upload the Search Console links export or a backlink CSV from another tool, and Ascentra merges it into the ledger.' },
      {
        q: 'What does the free-sources mode include?',
        a: 'Everything except the commercial index: Bing Webmaster Tools, Search Console and GA4 data, the Common Crawl graph, Wikipedia, Hacker News, news and web search.',
      },
      { q: 'Does Ascentra send outreach e-mails?', a: 'It drafts outreach and reminds you to follow up after 7 and 14 days. Sending stays with your team.' },
    ],
    related: ['ai-visibility', 'technical-audits', 'reports'],
    image: 'teamTable',
    visual: 'backlinks',
    diagram: 'link-sources',
  },
  {
    slug: 'reports',
    name: 'Reports and alerts',
    shortName: 'Reports',
    tagline: 'A full SEO report on demand, a Monday report every week and alerts that matter.',
    summary:
      'Get a full SEO report as PDF or Word whenever you need one, a Monday report with what changed, Search Console alerts as soon as Google sends them and a monthly check-in for what the API cannot see. Every finding comes with a prioritised recommendation.',
    icon: FileText,
    benefits: [
      'A full SEO report as PDF or Word',
      'A Monday report: rankings, traffic, AI visibility and links in one read',
      'A Search Console alert watcher for Google’s notification e-mails',
      'A monthly check-in for manual actions and security issues',
      'Prioritised recommendations you can start with one click',
      'Every run kept with its report and files',
    ],
    steps: [
      { title: 'Collect', body: 'Search, traffic, AI answers, links and audits feed one picture of each website.' },
      { title: 'Explain', body: 'What changed, why it matters and how sure Ascentra is.' },
      { title: 'Recommend', body: 'A prioritised list of next steps, each one ready to run.' },
    ],
    facts: [
      { value: 2, label: 'report formats: PDF and Word' },
      { value: 'Monday', label: 'report, every week' },
      { value: 'Monthly', label: 'check-in for what the API cannot see' },
    ],
    faqs: [
      { q: 'Can I share reports with clients?', a: 'Yes. Full reports export as PDF or Word, ready to send.' },
      { q: 'What does the Search Console alert watcher do?', a: 'It reads Google’s Search Console notification e-mails for your websites and turns them into alerts in Ascentra.' },
      { q: 'What is the monthly check-in?', a: 'A short checklist for what Google does not expose through its API, such as manual actions and security issues.' },
    ],
    related: ['site-tracking', 'technical-audits', 'enterprise'],
    image: 'meetingPresenter',
    visual: 'dashboard',
  },
  {
    slug: 'enterprise',
    name: 'Enterprise platform',
    shortName: 'Enterprise',
    tagline: 'Workspaces, roles, verified ownership and spend caps for every company you run.',
    summary:
      'Run every company and website from one account. Invite your team with roles, prove you own each website before its data is shown, see the cost of every run before it starts and cap spend per company. Each company’s data is kept apart from every other.',
    icon: Building2,
    benefits: [
      'Multi-company workspaces with four roles: owner, admin, member and viewer',
      'Invitations and Google sign-in',
      'Website ownership verified through Search Console, a DNS TXT record or a meta tag',
      'A cost estimate before every run, budget guards and spend caps',
      'Data isolation per company',
      'No repeated paid work: results are reused where nothing changed',
    ],
    steps: [
      { title: 'Create a workspace', body: 'One company per brand or client, each with its own websites and data.' },
      { title: 'Verify your websites', body: 'Prove ownership through Search Console, DNS or a meta tag.' },
      { title: 'Invite the team', body: 'Give each person the role they need, from viewer to owner.' },
      { title: 'Set the budget', body: 'See costs before every run and cap spend per company.' },
    ],
    facts: [
      { value: 4, label: 'roles: owner, admin, member and viewer' },
      { value: 3, label: 'ways to verify website ownership' },
      { value: 1, label: 'verified owner per domain' },
    ],
    faqs: [
      { q: 'Can one person manage several companies?', a: 'Yes. Agencies and groups switch between companies; each has its own websites, team, budget and data.' },
      { q: 'How is website ownership verified?', a: 'Through Search Console ownership, a DNS TXT record or a meta tag. Each domain has one verified owner.' },
      {
        q: 'How are costs kept under control?',
        a: 'Every run shows its estimated cost before it starts, budgets are checked before work begins and owners set spend caps. Results that cannot have changed are reused instead of paid for again.',
      },
      { q: 'Is our data visible to other companies?', a: 'No. Each company’s websites, runs and reports are isolated, and access depends on your role in that company.' },
    ],
    related: ['reports', 'autopilot', 'site-tracking'],
    image: 'brightOffice',
    visual: 'workspace',
  },
];

export const featureBySlug = (slug: string | undefined): Feature | undefined => features.find((f) => f.slug === slug);

/** related features in registry order, skipping unknown slugs */
export const relatedFeatures = (f: Feature): Feature[] => f.related.map((s) => featureBySlug(s)).filter((x): x is Feature => !!x);
