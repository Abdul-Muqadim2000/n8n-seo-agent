// What shipped, in product language (newest first). /changelog renders this; add an entry with every release.

export interface ChangelogEntry {
  /** ISO date */
  date: string;
  title: string;
  summary: string;
  highlights: string[];
  /** feature slugs this release touched (links to /platform/<slug>) */
  features: string[];
  /** extra categories for releases that are not about one capability (e.g. "Brand", "Website"); shown and filtered like features */
  labels?: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    date: '2026-10-12',
    title: 'Ascentra knows the pages you already have',
    summary:
      'Every week Ascentra lists the pages your website has. When a search is already answered by one of them, it says to refresh that page instead of publishing a second one that would compete with it.',
    highlights: [
      'A weekly page list per website, built from your sitemap, your Search Console pages and the pages Ascentra already checks — no extra connection and no extra cost',
      'A keyword ladder points a rung at the page you already have, with its real address, instead of planning a new one',
      'Keyword research marks the keywords a live page of yours already answers and names that page',
      'The weekly posts and the rank-tracking e-mail stop saying “publish it” when a live page already answers the search',
      'Two pages for one search split the signals and neither ranks — Ascentra now avoids creating that by itself',
    ],
    features: ['keyword-research', 'keyword-ladders', 'content', 'autopilot', 'site-tracking'],
  },
  {
    date: '2026-10-12',
    title: 'Every written page counts before the next one is written',
    summary:
      'The pile-up guard now sees every page waiting to be published, keyword-ladder pages included, and tells you which ones they are.',
    highlights: [
      'Every page Ascentra writes — a ladder page, one you asked for, or a weekly post — is recorded the moment it is written',
      'The guard counts each waiting keyword once, whether it came from a ladder or from the weekly posts',
      'When writing pauses, the note and the app name the pages that are waiting',
    ],
    features: ['autopilot'],
  },
  {
    date: '2026-10-12',
    title: 'Pages that only link to real pages, and figures checked against their source',
    summary: 'A new page never links to a page you have not published yet, every number in it is looked up in the source it cites, and the markup follows what search engines still show.',
    highlights: [
      'Links point only to pages that are live: the ones still to come are listed in the page package as "links to add when published", and the weekly ladder e-mail reminds you the week one goes live',
      'Link text now reads like a title — "Best ERP Software in Dubai", not "best erp software in dubai" — with acronyms kept',
      'Every percentage, amount, count and year is looked up in the source the page links to; one that is not there is handed to you as "[Confirm: …]" instead of being published',
      'A source without independent authority (a vendor or agency blog, a listicle) can be cited once per page; official, standards, research and major-press sources come first',
      'Tracking parameters (utm_*, srsltid, gclid, fbclid) are stripped from every outgoing link, in the page and in its structured data',
      'FAQ markup is no longer written — Google stopped showing FAQ rich results in May 2026; pages keep question headings with short, direct answers, which is what AI assistants quote',
    ],
    features: ['content', 'keyword-ladders'],
  },
  {
    date: '2026-10-11',
    title: 'Link farms set aside, replies that stick to the facts',
    summary: 'The backlink check now recognises link-farm networks as a whole, and suggested answers to outreach replies never state anything about your business that you did not put on file.',
    highlights: [
      'Pages sold on many domains (the same path or anchor on three or more sites, link-selling or gambling wording, gambling hosts) count as spam together: no value, no alert, no impact tracking, all on the disavow candidates for your review',
      'Suggested answers to replies carry only what is on file; any accreditation, partnership, number or price not on file is handed to you in square brackets',
      'Your business profile (author, reviewer, address) is read with every reply',
    ],
    features: ['backlinks'],
  },
  {
    date: '2026-10-08',
    title: 'Business site and Ascentra brand',
    summary: 'SEO Agent is now Ascentra — enterprise-grade autonomous SEO. Same product, a new look across the app, and a public website that explains every capability.',
    highlights: [
      'New name, logo, colours and type across the app',
      'Clearer hover, focus and loading states, with motion that respects reduced-motion settings',
      'A public website: the platform, every capability, solutions, pricing, security and this changelog',
      'Light and dark themes throughout',
    ],
    features: [],
    labels: ['Brand', 'Website'],
  },
  {
    date: '2026-10-08',
    title: 'Backlinks from every source',
    summary: 'One link ledger from nine sources, and every link checked by Ascentra itself before it counts as lost.',
    highlights: [
      'Bing Webmaster Tools, Search Console links, GA4 referrals, the Common Crawl web graph, Wikipedia, Hacker News, news and web search next to the commercial index',
      'Own link check: rel, placement, noindex and canonical; lost only after two misses, with the reason',
      'SEO, referral and brand value for every link',
      'Scored prospects with contacts and follow-ups after 7 and 14 days',
      'Upload link exports from Search Console or other tools',
      'A free-sources mode that costs nothing to run',
    ],
    features: ['backlinks'],
  },
  {
    date: '2026-10-08',
    title: 'AI search visibility, measured properly',
    summary: 'More questions, asked more often, tied to revenue.',
    highlights: [
      'A panel of up to 50 buyer questions, built from real AI-answer data and Search Console queries',
      'Daily AI Pulse that alerts only on statistically real changes',
      'Mention and citation rates with 95% ranges, share of voice and a visibility score',
      'Visits, key events and revenue from AI referrals in GA4',
      'Answer Analyst: sentiment and wrong claims about your business',
      'Weekly AI crawler access check and llms.txt',
    ],
    features: ['ai-visibility'],
  },
  {
    date: '2026-10-03',
    title: 'A pipeline with several keyword ladders',
    summary: 'Run more than one ladder at a time, each on Auto or Manual, in the order you choose.',
    highlights: [
      'Pipeline home: this week, “Needs you”, a card per ladder and the 4-week calendar',
      'Auto or Manual, pause and priority order per ladder',
      'Difficulty for your site with Direct, Short and Full plans',
      'No keyword overlap between ladders and a pile-up guard',
      'Notices when you publish a planned page',
    ],
    features: ['autopilot', 'keyword-ladders', 'keyword-research'],
  },
  {
    date: '2026-10-03',
    title: 'The web app',
    summary: 'Every analysis, dashboard and report in one web app for your whole company.',
    highlights: [
      'Companies with roles — owner, admin, member and viewer — and invitations',
      'Sign up with e-mail or Google',
      'A seven-step onboarding with website ownership verification',
      'Dashboards per website: overview, search, rankings, content, technical health, AI visibility, backlinks and alerts',
      'The cost of every run shown before it starts',
    ],
    features: ['enterprise', 'reports'],
  },
  {
    date: '2026-10-02',
    title: 'No repeated paid work',
    summary: 'Results that cannot have changed are reused, with a safety net wherever a change could be missed.',
    highlights: [
      'Monthly audits skip the crawl when the sitemap has not changed, with a full audit at least every 60 days',
      'Rank checks, trends and AI answers reused where nothing changed',
      'Domain ages and homepage descriptions cached',
    ],
    features: ['technical-audits', 'enterprise'],
  },
  {
    date: '2026-10-02',
    title: 'AI visibility tracker, backlink monitor and scheduled audits',
    summary: 'Three monitors that watch your growth between reports.',
    highlights: [
      'Weekly buyer questions across AI engines, with mention rate, citation rate and share of voice',
      'Weekly lost-link watch and a monthly backlink report with prospects and outreach drafts',
      'Monthly audits with a brand and entity check and what changed since the last audit',
      'A fix pack with every audit: robots.txt, llms.txt, redirects, schema and internal links',
    ],
    features: ['ai-visibility', 'backlinks', 'technical-audits'],
  },
  {
    date: '2026-10-02',
    title: 'Author profiles and new page types',
    summary: 'Pages that show real expertise, and the page types that need it most.',
    highlights: [
      'Business profile with author, expert reviewer and business details',
      'Byline, author box and Person schema on every page',
      'Hub pages, case studies, local (city) pages and video pages',
      'A proof library: case studies that later pages can cite',
    ],
    features: ['content'],
  },
  {
    date: '2026-10-02',
    title: 'Site tracking and a weekly content cadence',
    summary: 'Search Console, GA4 and Google Trends every week, and blog posts on a schedule.',
    highlights: [
      'Weekly Search Console, GA4, Trends and live rank checks per website',
      'Blog posts per week, picked from ladder rungs, striking-distance keywords and rising trends',
      'A blog package with every article: HTML, Markdown and meta.json',
      'A three-image plan with alt text for every article',
      'Search Console alerts and a monthly check-in',
    ],
    features: ['site-tracking', 'autopilot', 'content', 'reports'],
  },
  {
    date: '2026-10-01',
    title: 'Keyword ladders',
    summary: 'Rank your site for a hard keyword by climbing to it one supporting page at a time.',
    highlights: [
      'A plan of supporting pages that links up to the head term',
      'Weekly rank tracking for every rung',
      'WordPress drafts for each page',
    ],
    features: ['keyword-ladders'],
  },
  {
    date: '2026-09-30',
    title: 'The core engine',
    summary: 'Research, writing, audits and reports as one system, each step checked before it moves on.',
    highlights: [
      'Keyword research with a verdict per keyword',
      'Long-form articles written, critiqued and edited by AI, then checked by SEO QA',
      'Technical site audits with page speed and site structure',
      'A full SEO report as PDF or Word',
    ],
    features: ['keyword-research', 'content', 'technical-audits', 'reports'],
  },
];
