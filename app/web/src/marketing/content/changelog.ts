// The release history, in product language (newest first). /changelog and the About page render it by version only: no date is shown
// anywhere on the site. `date` is the real date of the newest change in the release, kept for ordering and internal use; never backdate
// it. Add a release (or extend the newest one) with every shipped change: real capabilities only, in customer words.

export interface ChangelogEntry {
  /** ISO date of the newest change in the release (internal: ordering only, never rendered) */
  date: string;
  /** semantic version shown to readers, e.g. "4.2" */
  version?: string;
  title: string;
  summary: string;
  highlights: string[];
  /** feature slugs this release touched (links to /platform/<slug>) */
  features: string[];
  /** extra categories for releases that are not about one capability (e.g. "Security", "Billing"); shown and filtered like features */
  labels?: string[];
  /** a milestone release: rendered as a featured block on /changelog and listed in the milestones strip */
  major?: boolean;
  /** one line under a major release's title */
  tagline?: string;
  /** a major release's highlights under 2-4 short sub-headings (its `highlights` are these items, in order) */
  sections?: ChangelogSection[];
}

export interface ChangelogSection {
  heading: string;
  items: string[];
}

/** a major release lists its highlights once, in sections; the flat list (About page, plain readers) is derived from them */
function grouped(sections: ChangelogSection[]): Pick<ChangelogEntry, 'sections' | 'highlights'> {
  return { sections, highlights: sections.flatMap((s) => s.items) };
}

export const changelog: ChangelogEntry[] = [
  {
    date: '2026-10-22',
    version: '4.2',
    title: 'Accuracy and reliability',
    summary:
      'Every part of the product now gives the same answer for the same keyword on the same day, keyword plans build on the pages you already have, and drafts never promise anything your business facts do not support.',
    highlights: [
      'One answer per keyword: research, the quick keyword check, keyword plans and the full SEO report read the same search results and the same rules, Arabic included',
      'Keyword plans read your existing pages first: they improve the page you already have instead of planning a new one, put searches Google answers with the same pages on one page, and never plan a second page for a search another plan covers',
      'Keyword suggestions start from the services you listed; a short service name counts, and searches for jobs, courses, other companies or other industries are left out with the reason',
      'Competitors are businesses that rank for several of your keywords, never job boards, directories, marketplaces, news sites or government bodies, and each one comes with the reason it was chosen',
      'A draft never promises something about your business that your facts do not say; such a sentence is marked for you to confirm or delete, and a page that is not ready names exactly what to fill in, without charging for a new page',
      'Pages Google still shows that no longer open are one clear finding at the top of your reports, with a suggested new address for each and ready redirect files in the fix pack',
      'Reliability and billing accuracy: saving one setting no longer resets the others, starting tracking uses no credits, and a retried search request is no longer charged twice',
      'Search Console shows the same status on every screen: once we can read your property, the overview, recommendations and pipeline stop asking you to connect it, and proving you own the website is labelled apart from connecting its Google data',
    ],
    features: ['keyword-research', 'keyword-ladders', 'content', 'technical-audits', 'site-tracking', 'autopilot'],
    labels: ['Reliability', 'Billing'],
  },
  {
    date: '2026-10-20',
    version: '4.1',
    title: 'Credits, invoicing and keyword-first autopilot',
    summary:
      'All work is now priced in credits from one company balance, with invoices by e-mail, and the weekly autopilot writes only for the keywords you choose, on a weekly cycle that starts the day you finish setup.',
    highlights: [
      'Credits: every analysis shows its price before it starts, holds it while it runs and is charged what it really used, never more and nothing if it fails; the Credits page shows the balance, holds, a forecast per website, expiry dates and all activity with CSV export',
      'Spending controls: separate monthly limits for the analyses people start and for automatic work, "Keep credits for autopilot", and e-mails to owners and admins when credits run low, run out and when work resumes',
      'Plans include the credits their own automatic work uses: Starter at $39 a month with 780 credits, Growth at $299 a month with 5,980 credits; packs from 500 credits for $25 to 20,000 for $1,000 at the same price per credit, valid 12 months',
      'Invoices: a numbered PDF invoice e-mailed to every owner and admin when a payment is confirmed, and every invoice kept on the Credits page to download again',
      'Keyword-first autopilot: pages are written automatically only for the keywords you choose, and three levels set how much else runs on its own: Only my keywords, My keywords and keep my pages healthy (the default), or Full autopilot',
      'A weekly cycle of your own, from the day you finish setup, with a "Coming up" plan two days before each week\'s work: every page, why it is planned and its credits, with Approve and Skip',
      'The first page waits for your author profile and business facts so it arrives ready to publish, and a plain guide sits beside every choice the autopilot asks of you',
    ],
    features: ['autopilot', 'keyword-research', 'keyword-ladders', 'content', 'guided-setup'],
    labels: ['Billing'],
  },
  {
    date: '2026-10-18',
    version: '4.0',
    major: true,
    title: 'Enterprise platform',
    tagline: 'Security, integrations, agency workspaces, CMS publishing and AI visibility at scale for larger teams.',
    summary:
      'Single sign-on and an audit log for your security review, integrations with the tools your team already uses, a white-label portal for agencies, publishing to your CMS, crawler analytics, and an AI question panel that scales to 500 questions.',
    ...grouped([
      {
        heading: 'Security and identity',
        items: [
          'Single sign-on with SAML 2.0 or OIDC (Okta, Microsoft Entra ID, Google Workspace) on e-mail domains you prove with a DNS record: test a sign-in, switch it on, then require it',
          'SCIM 2.0 provisioning: your identity provider creates, updates and switches off people, and its groups set their roles',
          'Two-step verification with an authenticator app, passkeys or a security key, recovery codes, and a company setting that requires it for everyone',
          'An audit log nobody can edit, covering sign-ins, team and roles, websites, settings, API keys and sharing, with CSV export and the retention you choose; signed-in devices you can sign out one by one or all at once',
        ],
      },
      {
        heading: 'Integrations and API',
        items: [
          'Alerts and finished work to the Slack or Microsoft Teams channels you pick, or to your own systems as signed JSON, retried and logged',
          'One ticket per audit finding or recommendation in Jira, Linear or Asana, with the evidence, example pages and the fix',
          'Daily or weekly export to BigQuery, Amazon S3, Google Cloud Storage or Cloudflare R2 in one documented schema, with a Looker Studio connector',
          'API keys that can start analyses, with the same validation, budget, duplicate warnings and limits as the app, and AI assistants connected over MCP',
        ],
      },
      {
        heading: 'Agencies and publishing',
        items: [
          'Agency portal: a workspace per client, one table of every client website, client logins as viewer or approver, and sign-off before a page is published or an e-mail is sent',
          'White-label: your name, logo and colour on the portal, reports, documents and e-mails, on your own verified address and mailbox',
          'CMS publishing to WordPress, Webflow or Contentful, or to any stack through a signed webhook, as drafts by default; only an owner or admin can publish live',
          'Before a page is offered, every outbound link is opened and anything left for you to fill in is counted and named; a page that still holds one waits in the app',
        ],
      },
      {
        heading: 'Crawlers and AI visibility',
        items: [
          'Crawler analytics: upload a server log or connect Cloudflare, Vercel, Fastly or Akamai to see what Googlebot and the AI crawlers actually requested, each crawler verified against its company\'s published addresses, with impostors counted apart',
          'Up to 500 buyer questions per website, written for each buyer role and market, with rates per topic, role, market and engine and their 95% ranges',
          'Microsoft Copilot, the ChatGPT API and the Gemini API as optional engines, and the cost and precision of a panel shown before you save',
        ],
      },
    ]),
    features: ['enterprise', 'integrations', 'agency-portal', 'content', 'crawler-analytics', 'ai-visibility'],
    labels: ['Security', 'Platform', 'API'],
  },
  {
    date: '2026-10-17',
    version: '3.3',
    title: 'Data API, publish checks and schedule recovery',
    summary:
      'Read your data from scripts, BI tools and AI assistants, check any page before you publish it, and count on scheduled work running even after downtime.',
    highlights: [
      'A read-only API over your websites, audits and findings with their evidence, runs and reports, plus an MCP endpoint for AI assistants; keys per company, shown once, with an expiry and revocable at any time',
      'Check any page before you publish it, written here or elsewhere: the same verdict our own pages must pass, every reason named, in the app or from your build',
      'Missed schedules still run: weekly, writing and monthly work that was due during downtime starts once the system is back, and its report opens with "Ran late" so a late figure is never taken for an on-time one',
      'Audits add hreflang checks, a before-and-after-JavaScript comparison across the crawl, and GA4 key events in the order of the fix list',
      'Rank tracking flags pages competing for one search, names who outranked you and separates your own moves from page-wide reshuffles',
      'Site tracking adds Discover, Google News, content groups and your notes as chart marks; AI visibility adds a change test per assistant with one multiple-comparison correction per report',
      'AI growth turns wrong AI claims about your business into correction drafts and checks key pages as the AI fetchers see them',
    ],
    features: ['enterprise', 'content', 'technical-audits', 'keyword-ladders', 'site-tracking', 'ai-visibility', 'ai-growth', 'autopilot'],
    labels: ['API', 'Reliability'],
  },
  {
    date: '2026-10-15',
    version: '3.2',
    title: 'Guided setup, report delivery and a ranked to-do list',
    summary:
      'A step-by-step guide beside everything we ask you for, reports delivered to your inbox or your team\'s channels, and one list of next steps ordered by what each is worth.',
    highlights: [
      'Guided setup: a "Show me how" guide beside every ask (Search Console and Analytics access, proving your domain, mailboxes and their SPF, DKIM and DMARC records, publishing a page), with your own values ready to copy, tabs for your provider and "Send to a colleague"',
      'Report delivery: each report as it arrives, or a daily, weekly or monthly summary, by e-mail with its PDF or to a signed webhook that reads in Slack, Teams and Discord; a report marked not ready is held back with the reason, and a delivery log shows what went out',
      'Shared reports carry your business name and logo, and a report the run marked unfinished says so before the first figure',
      'One to-do list across audits, search, rankings, AI answers and links, ordered by impact, confidence and effort, each step showing the figure that put it there',
      'Pages losing traffic get a refresh written for them, but only when the fall is beyond normal variation and worse than the same weeks a year earlier; a seasonal dip is named and left alone',
      'Rank tracking follows every keyword you named, not only keyword ladder pages, and keyword ladders put searches that share Google\'s top results on one page',
      'Billing accuracy: cost estimates now match what runs really cost, and a finished run counts against your budget at its actual cost, not at what was reserved for it',
    ],
    features: ['guided-setup', 'report-delivery', 'reports', 'autopilot', 'site-tracking', 'keyword-ladders', 'content'],
    labels: ['Billing'],
  },
  {
    date: '2026-10-13',
    version: '3.1',
    title: 'Daily page monitoring, original content and shareable reports',
    summary:
      'Your key pages are checked every morning, every page is tested for originality before it reaches you, keyword research starts from your own Search Console data, and a report can be shared with a link that expires.',
    highlights: [
      'Daily checks of your key pages (status, redirects, noindex, canonical, title and robots.txt) with same-day alerts, and a fix you mark done is re-checked the next morning',
      'Originality check: a page that matches more than 15% of one competitor page word for word goes back to the editor, and two of your own pages saying the same thing are flagged',
      'Every page arrives with its three images made, and with a coverage target read from the best page in the results, listing the subtopics your draft still misses',
      'Keyword research seeded from the searches you already appear for, with traffic marked measured or modelled, searches that share the same results grouped onto one page, and your topic radius in every plan',
      'Share links: one report, read-only, no account needed, expiring on the day you choose and revocable at any time; and a pre-release check your build can call to stop a release that would take a page out of Google',
      'Charts marked with the pages you published, your fixes and Google\'s updates, and every figure labelled with its source, period and sample size',
      'A style guide for your brand name, spelling and banned words, applied to every page, and Microsoft 365 or Gmail connected for outreach without storing a password',
    ],
    features: ['technical-audits', 'content', 'keyword-research', 'site-tracking', 'reports', 'link-building'],
  },
  {
    date: '2026-10-12',
    version: '3.0',
    major: true,
    title: 'Accuracy release',
    tagline: 'Pages, rank checks, audits and outreach checked against the live web before they reach you.',
    summary:
      'Pages, rank checks, audits and outreach are now checked against the live web before they reach you, and a data source that fails is named in the report instead of quietly lowering a number.',
    ...grouped([
      {
        heading: 'Content',
        items: [
          'A weekly list of the pages your website already has, so a search one of them answers gets a refresh instead of a competing second page',
          'Every figure in a written page is looked up in the source it cites, and links point only to pages that are live; anything unverified is handed to you to confirm',
          'The pile-up guard counts every page waiting to be published, keyword ladder pages included, and names them when writing pauses',
        ],
      },
      {
        heading: 'Rankings and audits',
        items: [
          'Rank checks record the whole results page: AI Overviews and whether they cite you, featured snippets, the sites on page one, share of voice, and your main keywords on a phone as well as a desktop',
          'Audits report Core Web Vitals from real Chrome visitors per page type, on phone and desktop, and rank every finding by the traffic it puts at risk',
        ],
      },
      {
        heading: 'Outreach and reliability',
        items: [
          'Outreach refuses prospects that could never link to you and checks every draft before it reaches your approval queue: no unsupported claims, nothing left in brackets, one clear ask',
          'Every outside request is retried, a provider error disguised as a success is sent again, what still fails is named in the report, and failure alerts reach a second channel that does not depend on e-mail',
        ],
      },
    ]),
    features: ['content', 'keyword-ladders', 'keyword-research', 'site-tracking', 'technical-audits', 'link-building', 'ai-visibility', 'autopilot'],
    labels: ['Reliability'],
  },
  {
    date: '2026-10-11',
    version: '2.2',
    title: 'AI growth and link building',
    summary:
      'Two weekly loops that act on what the monitors find: AI growth works to get you named in AI answers, and link building turns openings into pitches sent from your own mailbox once you approve them.',
    highlights: [
      'New and updated pages sent to Bing Webmaster Tools every week, and through IndexNow once your key file is up',
      'An AI-readiness score for your key pages, and every question you lose in AI answers turned into one action: a new answer page, a refresh, or the keyword ladder page for the same search',
      'The exact pages AI cites without naming you, the competitors they name and a drafted pitch for each, plus a monthly Wikidata check',
      'New link openings every week: journalist requests, resource pages, broken links, your own old addresses that now fail, and a checklist of the directories worth being on',
      'Up to three contacts per prospect on its own domain, the page of yours to point to and the link text to ask for, with a first e-mail and two follow-ups sent on weekdays from your mailbox after approval',
      'Replies read for you: the sequence stops, an out-of-office moves the next step, a "no" is honoured for good, and a suggested answer states only what is on file',
      'Link farms recognised as networks and set aside together as spam, with no alerts and every one listed for your disavow review',
    ],
    features: ['ai-growth', 'ai-visibility', 'link-building', 'backlinks'],
  },
  {
    date: '2026-10-08',
    version: '2.1',
    title: 'AI search visibility and backlinks from every source',
    summary:
      'AI visibility measured with sound statistics and tied to revenue, and one backlink ledger built from many sources, with every link checked by us before it counts as lost.',
    highlights: [
      'A panel of up to 50 buyer questions built from real AI-answer data and your Search Console queries, with mention and citation rates, 95% ranges, share of voice and a visibility score',
      'A daily AI Pulse that alerts only on statistically real changes',
      'Visits, key events and revenue from AI referrals in GA4, and the sentiment and wrong claims about your business in AI answers',
      'A weekly check that the AI crawlers can reach your site, including llms.txt',
      'One link ledger from nine sources, including Bing Webmaster Tools, Search Console links, GA4 referrals, the Common Crawl web graph and a commercial link index',
      'Our own check of every link (rel, placement, noindex and canonical); a link counts as lost only after two misses, with the reason',
      'SEO, referral and brand value per link, scored prospects with follow-ups, uploads of link exports from other tools, and a free-sources mode that costs nothing to run',
    ],
    features: ['ai-visibility', 'backlinks'],
  },
  {
    date: '2026-10-03',
    version: '2.0',
    major: true,
    title: 'Web app and multi-ladder pipeline',
    tagline: 'One web app for your whole company, and a pipeline that runs several keyword ladders at once.',
    summary:
      'Every analysis, dashboard and report in one web app for your whole company, with a pipeline that runs several keyword ladders at once.',
    ...grouped([
      {
        heading: 'Workspace',
        items: [
          'Companies with owner, admin, member and viewer roles, and invitations',
          'Sign-up with e-mail or Google, and a seven-step onboarding with website ownership verification',
          'The cost of every run shown before it starts',
        ],
      },
      {
        heading: 'Dashboards',
        items: ['Dashboards per website: overview, search, rankings, content, technical health, AI visibility, backlinks and alerts'],
      },
      {
        heading: 'Pipeline',
        items: [
          'Several keyword ladders at once, each on Auto or Manual, paused or reordered as you choose, with a four-week calendar and a "Needs you" list',
          'Difficulty for your site with Direct, Short and Full plans, no keyword overlap between ladders, and a guard against unpublished pages piling up',
        ],
      },
    ]),
    features: ['enterprise', 'reports', 'autopilot', 'keyword-ladders', 'keyword-research'],
    labels: ['Platform'],
  },
  {
    date: '2026-10-02',
    version: '1.2',
    title: 'Site tracking, content cadence and growth monitors',
    summary:
      'Weekly tracking of search and traffic, blog posts on a schedule, author profiles that show real expertise, and monitors that watch AI visibility, backlinks and site health between reports.',
    highlights: [
      'Weekly Search Console, GA4, Google Trends and rank checks per website, with Search Console alerts and a monthly check-in',
      'Blog posts on a weekly schedule, picked from ladder pages, striking-distance keywords and rising trends, each delivered as HTML, Markdown and metadata with a three-image plan',
      'A business profile with author, expert reviewer and business details, shown as a byline, an author box and Person schema on every page',
      'Hub pages, case studies, local pages and video pages, with a proof library of case studies that later pages can cite',
      'Weekly buyer questions across AI engines with mention rate, citation rate and share of voice, and a weekly lost-link watch with a monthly backlink report',
      'Monthly audits with a brand and entity check, what changed since the last audit, and a fix pack: robots.txt, llms.txt, redirects, schema and internal links',
      'No repeated paid work: results that cannot have changed are reused, with a full audit at least every 60 days',
    ],
    features: ['site-tracking', 'autopilot', 'content', 'ai-visibility', 'backlinks', 'technical-audits', 'reports'],
  },
  {
    date: '2026-10-01',
    version: '1.1',
    title: 'Keyword ladders',
    summary: 'Rank for a hard keyword by climbing to it one supporting page at a time.',
    highlights: [
      'A plan of supporting pages that link up to the head term',
      'Weekly rank tracking for every rung',
      'WordPress drafts for each page',
    ],
    features: ['keyword-ladders'],
  },
  {
    date: '2026-09-30',
    version: '1.0',
    major: true,
    title: 'Core SEO engine',
    tagline: 'Research, writing, audits and reports as one system.',
    summary: 'Research, writing, audits and reports as one system, each step checked before it moves on.',
    ...grouped([
      {
        heading: 'Research and writing',
        items: ['Keyword research with a verdict per keyword', 'Long-form articles written, critiqued and edited by AI, then checked by SEO quality assurance'],
      },
      {
        heading: 'Audits and reports',
        items: ['Technical site audits with page speed and site structure', 'A full SEO report as PDF or Word'],
      },
    ]),
    features: ['keyword-research', 'content', 'technical-audits', 'reports'],
  },
];
