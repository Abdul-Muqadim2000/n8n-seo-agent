// Who Alaventra is for: /solutions and /solutions/<slug>, the Solutions menu and the footer. Outcomes are phrased as
// capabilities, never as invented results.
import { Briefcase, Building, Landmark, Layers, MapPin, type LucideIcon } from 'lucide-react';
import type { FaqItem } from './features';
import type { ImageKey } from './images';

export interface Solution {
  slug: string;
  name: string;
  shortName: string;
  /** one line: menus, cards */
  tagline: string;
  summary: string;
  icon: LucideIcon;
  image: ImageKey;
  /** what is hard today */
  pains: { title: string; body: string }[];
  /** how Alaventra helps, each tied to a capability (feature slug) */
  helps: { feature: string; title: string; body: string }[];
  /** what the team can do with Alaventra (capabilities, not promised numbers) */
  outcomes: string[];
  faqs: FaqItem[];
  /** optional "see it in Alaventra" band on /solutions/<slug>: the product visual of one capability (feature slug) with a short story */
  showcase?: { feature: string; title: string; body: string };
}

export const solutions: Solution[] = [
  {
    slug: 'agencies',
    name: 'Alaventra for agencies',
    shortName: 'Agencies',
    tagline: 'Run SEO for every client from one account, with verified access and costs you can bill.',
    summary:
      'Give every client their own workspace, website verification, team and budget. Alaventra runs the weekly loop for each website and turns the work into reports you can send as they are.',
    icon: Briefcase,
    image: 'loftTeam',
    pains: [
      { title: 'A tool stack per client', body: 'Rank trackers, crawlers, link tools and spreadsheets, each with its own logins and invoices.' },
      { title: 'Reporting eats the week', body: 'Hours go into copying numbers into decks instead of improving the sites.' },
      { title: 'Questions about AI search', body: 'Clients ask whether ChatGPT recommends them, and there is no clear way to answer.' },
    ],
    helps: [
      { feature: 'agency-portal', title: 'A portal for every client, under your name', body: 'A workspace per client, one table of every client website, client logins with approvals, and your brand on your own address.' },
      { feature: 'enterprise', title: 'One workspace per client', body: 'Each client company has its own websites, team, budget and data, with roles for your staff and theirs.' },
      { feature: 'reports', title: 'Reports ready to send', body: 'Full SEO reports as PDF or Word, and a Monday report for every website.' },
      { feature: 'integrations', title: 'Client data in your own BI', body: 'Every client’s rankings, traffic, audits and AI visibility exported to BigQuery or your storage, or charted in Looker Studio.' },
      { feature: 'ai-visibility', title: 'AI visibility per client', body: 'Mention rate and share of voice against each client’s own competitors, with ranges.' },
      { feature: 'autopilot', title: 'The same loop for every website', body: 'Weekly cadence per website, Auto where you trust it and Manual where the client signs off.' },
    ],
    outcomes: [
      'Every client website on the same weekly loop',
      'The cost of each run shown before it starts, per client',
      'Client-ready reports without rebuilding them each month',
      'Client access through roles, down to read-only viewers',
    ],
    faqs: [
      { q: 'Can clients see their own data?', a: 'Yes. Invite them to their client workspace as a viewer or an approver; they see their websites, reports and recommendations in a portal under your name, and nothing from other clients or from what the work costs you.' },
      { q: 'Can the portal carry our brand and domain?', a: 'Yes. Switch on white-label for your name, logo and colour, add your own address such as seo.youragency.com with two DNS records, and send client e-mails from your own mailbox once its SPF and DKIM check out.' },
      { q: 'How do I keep costs per client in check?', a: 'Every run shows its estimated cost first, and each company has its own budget and spend cap.' },
      { q: 'Do I need access to each client’s Search Console?', a: 'The client adds Alaventra’s service account as a user, and the website owner proves ownership once.' },
    ],
    showcase: {
      feature: 'agency-portal',
      title: 'Every client in a workspace of its own, under your name.',
      body: 'Switch between clients from one login and see every client website in one table. Clients sign in to a portal with your brand on your own address, follow their websites and approve what goes out.',
    },
  },
  {
    slug: 'in-house-teams',
    name: 'Alaventra for in-house marketing teams',
    shortName: 'In-house marketing teams',
    tagline: 'A small team with the output of a full SEO function, and every decision still yours.',
    summary:
      'Alaventra does the research, writing, audits and monitoring on a weekly schedule, and asks your team only for the decisions that need a person. Everyone sees the same dashboards and the same next steps.',
    icon: Building,
    image: 'teamAtDesks',
    pains: [
      { title: 'More channels than people', body: 'SEO competes with every other priority, so research and audits slip.' },
      { title: 'Content without a plan', body: 'Posts get written, but few of them build towards the keywords that matter.' },
      { title: 'Blind spots', body: 'Lost links, indexing problems and AI answers change without anyone noticing.' },
    ],
    helps: [
      { feature: 'autopilot', title: 'A weekly cadence that runs itself', body: 'Blog posts per week, picked in a fixed order and written with QA, with a “Needs you” queue for approvals.' },
      { feature: 'keyword-ladders', title: 'Content with a destination', body: 'Keyword ladders climb to the head terms your business needs, one supporting page at a time.' },
      { feature: 'technical-audits', title: 'Audits with a fix pack', body: 'Monthly audits show what changed, and the fix pack goes straight to your developers.' },
      { feature: 'site-tracking', title: 'One weekly view', body: 'Search Console, GA4 and Trends together, with striking-distance keywords called out.' },
      { feature: 'crawler-analytics', title: 'What the crawlers really did', body: 'Your server logs show which pages Google and the AI crawlers fetched, which they skipped and which “crawlers” were impostors.' },
      { feature: 'guided-setup', title: 'Nothing waits on a ticket', body: 'Every connection we ask for comes with its steps and your own values — and goes to IT or the agency as an e-mail when the job is theirs.' },
      { feature: 'report-delivery', title: 'The report reaches the people who decide', body: 'Each week’s report goes to the list you choose and into the channel your team already watches, with an expiring link for anyone outside it.' },
      { feature: 'integrations', title: 'Findings in your backlog', body: 'An audit finding becomes one Jira, Linear or Asana ticket with the evidence and the fix, and alerts land in your Slack or Teams channel.' },
    ],
    outcomes: [
      'A planned, steady publishing rhythm',
      'Approvals where you want them and automation everywhere else',
      'Technical issues found and packaged for developers each month',
      'Changes in rankings, links and AI answers reported every Monday',
    ],
    faqs: [
      { q: 'Do we need SEO expertise to use Alaventra?', a: 'No. Every verdict and recommendation explains itself in plain language, and the pipeline tells you what to do next.' },
      { q: 'Can our writers edit the pages?', a: 'Yes. Pages arrive as HTML and Markdown, or as drafts in your WordPress, Webflow or Contentful, so your team edits them before anything goes live.' },
      { q: 'Who on the team can start paid runs?', a: 'Members and above can start runs; viewers can only read. Owners set the budget.' },
    ],
    showcase: {
      feature: 'autopilot',
      title: 'One page that says what happens next.',
      body: 'This week’s posts, the decisions waiting for your team and every schedule with its next run, on one pipeline page per website.',
    },
  },
  {
    slug: 'b2b-saas',
    name: 'Alaventra for B2B and SaaS',
    shortName: 'B2B and SaaS',
    tagline: 'Win the long, considered searches your buyers make — in Google and in AI answers.',
    summary:
      'B2B buyers research for weeks and increasingly ask AI assistants for a shortlist. Alaventra tracks the questions they ask, builds the pages that answer them and shows the pipeline value AI referrals bring.',
    icon: Layers,
    image: 'colleaguesReview',
    pains: [
      { title: 'Shortlists made by AI', body: 'Buyers ask ChatGPT and Perplexity which tools to consider, and you cannot see the answer.' },
      { title: 'Hard head terms', body: 'The category keywords are dominated by established players and review sites.' },
      { title: 'Thin proof', body: 'Generic content does not show the expertise and experience buyers look for.' },
    ],
    helps: [
      { feature: 'ai-visibility', title: 'Visibility in AI answers', body: 'Up to 500 buyer questions by topic, buyer role and market across six AI engines (nine on request), with share of voice against named competitors and AI referral revenue from GA4.' },
      { feature: 'ai-growth', title: 'Onto the shortlist, week by week', body: 'The questions you lose become answer pages, new pages reach Bing the same week, and the review and list pages AI cites without you become pitches.' },
      { feature: 'keyword-ladders', title: 'A route to the head term', body: 'Supporting pages on easier, related keywords climb to the category term.' },
      { feature: 'content', title: 'Pages with real expertise', body: 'Author and reviewer, experience notes, case studies and schema on every page.' },
      { feature: 'backlinks', title: 'Links that count', body: 'Nine link sources, links checked by Alaventra itself and scored prospects.' },
      { feature: 'link-building', title: 'Listed where buyers compare', body: 'G2, Capterra, TrustRadius and the other directories worth being on, checked against your listing — and pitches to the lists that leave you out.' },
    ],
    outcomes: [
      'A measured view of how AI engines describe and cite you',
      'A plan for every category keyword that matters',
      'Case studies turned into pages that later content can cite',
      'AI referral visits and revenue reported next to search traffic',
    ],
    faqs: [
      { q: 'Which AI engines are covered?', a: 'ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews.' },
      { q: 'Can we track named competitors?', a: 'Yes. Add competitors to the website settings and Alaventra compares share of voice and links against them.' },
      { q: 'Does Alaventra write case studies?', a: 'Yes. Enter the facts of a customer project once; Alaventra writes the case study page and later pages can cite it.' },
    ],
    showcase: {
      feature: 'ai-visibility',
      title: 'See the shortlist AI gives your buyers.',
      body: 'Which brands ChatGPT, Gemini, Perplexity, Claude and Google’s AI name for your buyers’ questions, how often you are cited, and how that moves week by week.',
    },
  },
  {
    slug: 'local-businesses',
    name: 'Alaventra for local and multi-location businesses',
    shortName: 'Local and multi-location',
    tagline: 'Local pages with verified details for every area you serve.',
    summary:
      'Alaventra writes local pages for the cities and areas you serve, each with your verified name, address and phone, local schema and real proof — and checks that search engines and AI assistants recognise your business.',
    icon: MapPin,
    image: 'brightOffice',
    pains: [
      { title: 'Thin city pages', body: 'Area pages that swap one town name for another rarely rank and can hurt the site.' },
      { title: 'Inconsistent details', body: 'Different addresses and phone numbers across pages and listings confuse search engines.' },
      { title: 'Many locations, one team', body: 'Every location needs content, tracking and checks, and nobody has the time.' },
    ],
    helps: [
      { feature: 'content', title: 'Local pages that hold up', body: 'Local (city or area) pages with a verified name, address and phone block, LocalBusiness schema and the areas you serve.' },
      { feature: 'technical-audits', title: 'Brand and entity check', body: 'Audits confirm your business listing matches your website before it is trusted.' },
      { feature: 'site-tracking', title: 'Tracking per website', body: 'Search Console, GA4 and live rank checks for each website you run — including whether a local pack was on the page and whether your listing was in it.' },
      { feature: 'enterprise', title: 'One account for every brand', body: 'Separate companies for separate brands, with one team and one login.' },
      { feature: 'link-building', title: 'The local listings that matter', body: 'Google Business Profile, Bing Places, Apple Business and the directories in your country, checked for your listing, with a ready description to paste.' },
      { feature: 'guided-setup', title: 'Set up without an agency', body: 'Search Console, Analytics, the records on your domain: each one is a short guide with your own values, written for the provider you actually use.' },
      { feature: 'report-delivery', title: 'You do not have to remember to look', body: 'The Monday report arrives in your inbox with the numbers in the message — and nothing arrives that the analysis itself flagged as not ready.' },
    ],
    outcomes: [
      'Consistent business details on every local page',
      'Local schema and service areas set correctly',
      'Every location website tracked on the same weekly loop',
      'A brand and entity check with every audit',
    ],
    faqs: [
      { q: 'Where do the address and phone come from?', a: 'From your business profile in Alaventra. The same verified details appear on every local page.' },
      { q: 'Can I run several brands?', a: 'Yes. Each brand can be its own company in Alaventra with its own websites, team and budget.' },
      { q: 'Does Alaventra manage our Google Business Profile?', a: 'No. It checks that your profile and your website agree, as part of the brand and entity check.' },
    ],
    showcase: {
      feature: 'content',
      title: 'Local pages with details you have verified.',
      body: 'Each local page carries your verified name, address and phone, LocalBusiness schema and the areas you serve, and is checked again once it is live.',
    },
  },
  {
    slug: 'enterprise',
    name: 'Alaventra for enterprise teams',
    shortName: 'Enterprise teams',
    tagline: 'SEO that passes your security review and lands in the tools your company already runs.',
    summary:
      'Large teams need more than good analysis: sign-in through your identity provider, an audit trail, findings in the engineering backlog, numbers in the data warehouse and releases checked before they ship. Alaventra does the SEO work and fits into all of that.',
    icon: Landmark,
    image: 'openOffice',
    pains: [
      { title: 'A security review for every tool', body: 'Each new tool needs single sign-on, provisioning, an audit trail and answers to a questionnaire before anyone may use it.' },
      { title: 'Findings that never reach engineering', body: 'Audit reports sit in a folder while the backlog fills up with everything else.' },
      { title: 'Numbers in yet another dashboard', body: 'SEO data lives apart from the rest of the business, so it is hard to trust and rarely used.' },
    ],
    helps: [
      { feature: 'enterprise', title: 'Sign-in your IT team approves', body: 'SAML 2.0 or OIDC single sign-on on your verified domains, SCIM provisioning, two-step verification and an audit log nobody can edit.' },
      { feature: 'integrations', title: 'Findings in the backlog, data in the warehouse', body: 'One Jira, Linear or Asana ticket per finding, six tables to BigQuery or your storage, a Looker Studio connector, alerts in Slack or Teams and an API your assistants can use.' },
      { feature: 'technical-audits', title: 'Releases checked before they ship', body: 'Your build calls the pre-release check against staging and fails on a noindex, a lost canonical or a page robots.txt now blocks.' },
      { feature: 'crawler-analytics', title: 'What crawlers really do', body: 'Logs from Cloudflare, Fastly, Akamai, Vercel or your own servers, with every crawler checked against the addresses its company publishes.' },
      { feature: 'report-delivery', title: 'Reports to the people who decide', body: 'Weekly reports by e-mail or signed webhook on your schedule — and held back, with the reason, when the analysis marked them not ready.' },
    ],
    outcomes: [
      'Single sign-on and provisioning from your identity provider',
      'Every audit finding one ticket in the tracker your engineers use',
      'SEO data next to the rest of your numbers, in your own warehouse',
      'Releases checked for SEO breakage before they go live',
    ],
    faqs: [
      {
        q: 'Can you go through our security questionnaire?',
        a: 'Yes. Send it through the contact form with the topic “Security review or questionnaire” and a person on the team will go through it with you. The security page lists how sign-in, access, data isolation and secrets work today.',
      },
      {
        q: 'Can we keep passwords out of it entirely?',
        a: 'Yes. Once single sign-on is required for your domain, passwords stop working for everyone on it. Owners keep a way in, protected by two-step verification, in case your identity provider is down.',
      },
      {
        q: 'Can our scripts and AI assistants use it?',
        a: 'Yes, through the API and an MCP server, with keys your company creates. A key reads by default; starting analyses is a separate permission, and every start goes through the same budget and duplicate checks as the app.',
      },
      {
        q: 'Can several brands or business units share one account?',
        a: 'Yes. Each brand can be its own company with its own websites, team, budget and data, and the same people can switch between them.',
      },
    ],
    showcase: {
      feature: 'integrations',
      title: 'Findings where your engineers already work.',
      body: 'An audit finding becomes one ticket in Jira, Linear or Asana with the evidence and the fix, its state shown back beside the finding — and the same data lands in your warehouse every day or week.',
    },
  },
];

export const solutionBySlug = (slug: string | undefined): Solution | undefined => solutions.find((s) => s.slug === slug);
