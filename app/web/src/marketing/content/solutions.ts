// Who Ascentra is for: /solutions and /solutions/<slug>, the Solutions menu and the footer. Outcomes are phrased as
// capabilities, never as invented results.
import { Briefcase, Building, Layers, MapPin, type LucideIcon } from 'lucide-react';
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
  /** how Ascentra helps, each tied to a capability (feature slug) */
  helps: { feature: string; title: string; body: string }[];
  /** what the team can do with Ascentra (capabilities, not promised numbers) */
  outcomes: string[];
  faqs: FaqItem[];
}

export const solutions: Solution[] = [
  {
    slug: 'agencies',
    name: 'Ascentra for agencies',
    shortName: 'Agencies',
    tagline: 'Run SEO for every client from one account, with verified access and costs you can bill.',
    summary:
      'Give every client their own workspace, website verification, team and budget. Ascentra runs the weekly loop for each website and turns the work into reports you can send as they are.',
    icon: Briefcase,
    image: 'loftTeam',
    pains: [
      { title: 'A tool stack per client', body: 'Rank trackers, crawlers, link tools and spreadsheets, each with its own logins and invoices.' },
      { title: 'Reporting eats the week', body: 'Hours go into copying numbers into decks instead of improving the sites.' },
      { title: 'Questions about AI search', body: 'Clients ask whether ChatGPT recommends them, and there is no clear way to answer.' },
    ],
    helps: [
      { feature: 'enterprise', title: 'One workspace per client', body: 'Each client company has its own websites, team, budget and data, with roles for your staff and theirs.' },
      { feature: 'reports', title: 'Reports ready to send', body: 'Full SEO reports as PDF or Word, and a Monday report for every website.' },
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
      { q: 'Can clients see their own data?', a: 'Yes. Invite them to their company with the viewer role; they see their websites and reports, and nothing from other clients.' },
      { q: 'How do I keep costs per client in check?', a: 'Every run shows its estimated cost first, and each company has its own budget and spend cap.' },
      { q: 'Do I need access to each client’s Search Console?', a: 'The client adds Ascentra’s service account as a user, and the website owner proves ownership once.' },
    ],
  },
  {
    slug: 'in-house-teams',
    name: 'Ascentra for in-house marketing teams',
    shortName: 'In-house marketing teams',
    tagline: 'A small team with the output of a full SEO function, and every decision still yours.',
    summary:
      'Ascentra does the research, writing, audits and monitoring on a weekly schedule, and asks your team only for the decisions that need a person. Everyone sees the same dashboards and the same next steps.',
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
    ],
    outcomes: [
      'A planned, steady publishing rhythm',
      'Approvals where you want them and automation everywhere else',
      'Technical issues found and packaged for developers each month',
      'Changes in rankings, links and AI answers reported every Monday',
    ],
    faqs: [
      { q: 'Do we need SEO expertise to use Ascentra?', a: 'No. Every verdict and recommendation explains itself in plain language, and the pipeline tells you what to do next.' },
      { q: 'Can our writers edit the pages?', a: 'Yes. Pages arrive as HTML, Markdown or a WordPress draft, so your team edits them before publishing.' },
      { q: 'Who on the team can start paid runs?', a: 'Members and above can start runs; viewers can only read. Owners set the budget.' },
    ],
  },
  {
    slug: 'b2b-saas',
    name: 'Ascentra for B2B and SaaS',
    shortName: 'B2B and SaaS',
    tagline: 'Win the long, considered searches your buyers make — in Google and in AI answers.',
    summary:
      'B2B buyers research for weeks and increasingly ask AI assistants for a shortlist. Ascentra tracks the questions they ask, builds the pages that answer them and shows the pipeline value AI referrals bring.',
    icon: Layers,
    image: 'colleaguesReview',
    pains: [
      { title: 'Shortlists made by AI', body: 'Buyers ask ChatGPT and Perplexity which tools to consider, and you cannot see the answer.' },
      { title: 'Hard head terms', body: 'The category keywords are dominated by established players and review sites.' },
      { title: 'Thin proof', body: 'Generic content does not show the expertise and experience buyers look for.' },
    ],
    helps: [
      { feature: 'ai-visibility', title: 'Visibility in AI answers', body: 'Up to 50 buyer questions across six AI engines, with share of voice against named competitors and AI referral revenue from GA4.' },
      { feature: 'keyword-ladders', title: 'A route to the head term', body: 'Supporting pages on easier, related keywords climb to the category term.' },
      { feature: 'content', title: 'Pages with real expertise', body: 'Author and reviewer, experience notes, case studies and schema on every page.' },
      { feature: 'backlinks', title: 'Links that count', body: 'Nine link sources, links checked by Ascentra itself and scored prospects.' },
    ],
    outcomes: [
      'A measured view of how AI engines describe and cite you',
      'A plan for every category keyword that matters',
      'Case studies turned into pages that later content can cite',
      'AI referral visits and revenue reported next to search traffic',
    ],
    faqs: [
      { q: 'Which AI engines are covered?', a: 'ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews.' },
      { q: 'Can we track named competitors?', a: 'Yes. Add competitors to the website settings and Ascentra compares share of voice and links against them.' },
      { q: 'Does Ascentra write case studies?', a: 'Yes. Enter the facts of a customer project once; Ascentra writes the case study page and later pages can cite it.' },
    ],
  },
  {
    slug: 'local-businesses',
    name: 'Ascentra for local and multi-location businesses',
    shortName: 'Local and multi-location',
    tagline: 'Local pages with verified details for every area you serve.',
    summary:
      'Ascentra writes local pages for the cities and areas you serve, each with your verified name, address and phone, local schema and real proof — and checks that search engines and AI assistants recognise your business.',
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
      { feature: 'site-tracking', title: 'Tracking per website', body: 'Search Console, GA4 and live rank checks for each website you run.' },
      { feature: 'enterprise', title: 'One account for every brand', body: 'Separate companies for separate brands, with one team and one login.' },
    ],
    outcomes: [
      'Consistent business details on every local page',
      'Local schema and service areas set correctly',
      'Every location website tracked on the same weekly loop',
      'A brand and entity check with every audit',
    ],
    faqs: [
      { q: 'Where do the address and phone come from?', a: 'From your business profile in Ascentra. The same verified details appear on every local page.' },
      { q: 'Can I run several brands?', a: 'Yes. Each brand can be its own company in Ascentra with its own websites, team and budget.' },
      { q: 'Does Ascentra manage our Google Business Profile?', a: 'No. It checks that your profile and your website agree, as part of the brand and entity check.' },
    ],
  },
];

export const solutionBySlug = (slug: string | undefined): Solution | undefined => solutions.find((s) => s.slug === slug);
