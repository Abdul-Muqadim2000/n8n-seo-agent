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
    date: '2026-10-15',
    title: 'Reports now come to you, and the ones that are not ready stay put',
    summary:
      'Every finished report used to wait in Ascentra until somebody logged in. You can now have each one sent as it arrives, or collected into a daily, weekly or monthly summary — by e-mail with its figures and files, or to a webhook your team already watches. The reports an analysis marked as not ready are deliberately held back, with the reason stated.',
    highlights: [
      'Four schedules: as each report arrives, or one summary a day, a week or a month, on the day and hour you choose',
      'E-mail with the report’s own figures in the message, its PDF and documents attached, and both links to open it',
      'A webhook that posts the report as JSON and also reads as a message in Slack, Teams and Discord, signed with your own secret',
      'Each delivery can carry the expiring, revocable share link, so a report reaches a client without an account',
      'A page that failed its quality check, a plan the engine refused or a verdict it could not check is never sent — it waits in Ascentra with the reason',
      'A delivery log showing what went out, what was held back and what failed',
      '“Send it now” on any report, which runs the same check before sending',
    ],
    features: ['report-delivery', 'reports'],
  },
  {
    date: '2026-10-15',
    title: 'One cost figure, and it is the engine’s',
    summary:
      'The app carried its own table of what an analysis costs, written in October 2026 and never corrected against the money. It read up to two and a half times high, which is the wrong direction for a budget: real work was refused that would have cost a fraction of what was held back. There is now one table, it matches the engine’s own calibrated figures, and the engine’s number replaces it the moment a run reports one.',
    highlights: [
      'A one-page keyword ladder, a technical audit, a written page and a full SEO report all cost less than the app used to claim',
      'Every run shows what it actually cost once it finishes, model calls included — the old figure counted only the search data',
      'Each figure says whether it is actual, the engine’s estimate or ours, with the reasoning behind it',
      'A finished run counts against your monthly budget at what it cost, not at what was reserved for it',
    ],
    features: ['enterprise', 'reports'],
  },
  {
    date: '2026-10-15',
    title: 'One to-do list, ranked by what each step is worth',
    summary:
      'Recommendations used to be ordered by a priority label and then by the part of the system that found them, so a small technical fix could sit above a search opportunity worth ten times the clicks. Now every website has one queue across audits, search, rankings, AI answers and links, ordered by impact, confidence and effort — and every step says which figure put it there.',
    highlights: [
      'One list across every area, not one list per area — group it by worth, by priority or by area, whichever you prefer',
      'Each step shows what it is worth, with the figure behind it: "340 impressions at 1.2% from position 7, against the page-one click-through benchmark"',
      'Confidence is separate from impact: a number measured on your own Search Console data outranks the same number modelled from an index',
      'Effort counts too, so a five-minute job beats a week-long one of the same size',
      'Setup steps that have to happen before anything can be measured come first, and say so',
      'A step with no measured figure behind it goes to the bottom with the reason — never a score nobody can defend',
    ],
    features: ['reports'],
  },
  {
    date: '2026-10-14',
    title: 'New plans, and three things we can do for you',
    summary:
      'Plans are simpler and cost less: Starter at $39 a month for one website and a page a week, Growth at $129 for the whole engine on up to three websites. And for teams with nobody to do the hands-on work, three done-for-you packages sit alongside them.',
    highlights: [
      'Starter $39 a month: one website, research, a page a week written and checked, monthly audits, tracking and the Monday report',
      'Growth $129 a month: up to three websites, the autopilot pipeline, AI search visibility with the daily pulse, backlinks and link building',
      'Setup done for you: we connect Search Console and Analytics, fill in your profile and style guide from one call, and run the first audit and ladder',
      'We publish your pages: WordPress, Shopify, Webflow, Squarespace, Ghost, a headless CMS — or a pull request for a React or Next.js codebase',
      'We fix what the audit found: the fix pack applied by a person, every change through your review, then a re-audit showing the score before and after',
      'Managed: the Growth plan and all three services for one monthly number',
      'A person does the service work, we only ask for access you can withdraw, and nothing goes live without your approval',
    ],
    features: ['guided-setup', 'content', 'technical-audits'],
    labels: ['Pricing'],
  },
  {
    date: '2026-10-14',
    title: 'Every setup step now comes with a guide',
    summary:
      'Wherever Ascentra asks you for something it cannot get itself — a Google permission, a DNS record, a file on your site, a mailbox, your business details — there is now a “Show me how” button beside the ask. It opens that one job as numbered steps, with your own values ready to copy.',
    highlights: [
      'Twenty-seven guides covering everything we ask for: Search Console and Analytics access, proving the domain is yours, the IndexNow file, the links export, letting the AI crawlers in, mailboxes and their SPF, DKIM and DMARC records, publishing a written page, applying a fix pack, your business profile and style guide',
      'Your real values, not examples: the DNS record for your domain, your key file, the address to add in Search Console — each in a copy box',
      'Tabs for the provider you actually use: Cloudflare, GoDaddy, Namecheap, cPanel; WordPress, Shopify, Wix, Squarespace, Webflow',
      'Tick the steps off as you go — close the panel, come back tomorrow and it opens where you stopped',
      'Send to a colleague puts the whole guide in an e-mail, values filled in, for whoever manages your DNS or your website',
      'Each guide ends with how to tell it worked and an “if it does not work” list, and the button that carries on in the app is right there',
      'A searchable list of all of them in the sidebar and in the setup wizard',
    ],
    features: ['guided-setup', 'site-tracking', 'backlinks', 'technical-audits', 'ai-visibility'],
  },
  {
    date: '2026-10-13',
    title: 'Connect your mailbox without handing over a password',
    summary:
      'Microsoft 365 and Gmail can now be connected on their own sign-in screen. You grant sending (and, with Microsoft 365, reading the replies to your own pitches); nothing but a renewable permission is stored, encrypted, and it is withdrawn the moment you disconnect the mailbox.',
    highlights: [
      'One click to connect Microsoft 365: pitches go out from your address and replies come back into the app',
      'One click to connect Gmail or Google Workspace for sending; Google treats inbox access as a restricted scope, so you read those replies in Gmail — the app says so before you connect',
      'No password is stored for either, and the permission renews itself before it expires',
      'Disconnecting withdraws our access; where a provider has no way to do that for us, the app tells you exactly where to remove it',
      'App passwords still work for any mail host, and Microsoft is retiring theirs — so the old way keeps working while it lasts',
    ],
    features: ['backlinks'],
  },
  {
    date: '2026-10-13',
    title: 'Tell it how you write, once',
    summary:
      'Your website profile now holds a style guide: exactly how your name is written, British or American spelling, the words you never want used and the tone. Every page is written to it, and the finished draft is read back against it.',
    highlights: [
      'Write your name once — Tech&, never “Tech and” or “techand” — and every page uses that form, including the title and the meta description',
      'Your own name written the wrong way is a real quality finding and is corrected before the page reaches you',
      '“tech and finance teams” in an ordinary sentence is not your name, and your name inside a link or a slug is not prose: neither is reported',
      'Choose British or American spelling and it wins over the country the page targets; leave it on “follow the market” and each page uses the spelling of its own country',
      'Words you ban are counted and listed; so are the exclamation marks, when your tone says no hype',
      'Spellings that mean two different things, or where both forms are correct, are never “corrected”',
      'The style notes are advice next to the page, never a reason to hold it back — and the report shows the rules on file beside what the draft did with them',
    ],
    features: ['content', 'autopilot', 'reports'],
  },
  {
    date: '2026-10-13',
    title: 'Check a release before it goes live, and alerts that only fire on a real change',
    summary:
      'Your build can now ask Ascentra to check a release candidate — a staging address or a list of URLs — and get a pass or fail it can act on. Traffic and position alerts are tested against your own numbers instead of a fixed percentage, so a small website is no longer told its traffic fell when a handful of searches moved. And a planned page for a search you should not target is set aside with the reason instead of being written.',
    highlights: [
      'A pre-release check your build pipeline can call: the same page checks — answers, redirect, noindex, robots.txt, canonical, title, H1 — against a staging address or a list of URLs',
      'It answers pass or fail with the URL and the check that failed, so a release can be stopped before it takes a page out of Google',
      'On a staging address a deliberate noindex or a blocking robots.txt is a warning that names the live page, not a failure',
      'The check only reads: it never changes anything in your account, and anything a staging address cannot answer is reported as not checked, with the reason',
      'Traffic alerts now say what was tested, over which periods and how sure the result is',
      'A position alert needs real impressions behind both periods: a five-place move measured on a dozen impressions is shown as something to watch, never as a drop',
      'A planned page for a search that names another company, a government portal or something you do not sell is set aside with the reason — including pages planned before this rule existed',
      'A page already written for such a search is kept and flagged instead, so you decide what happens to it',
    ],
    features: ['technical-audits', 'site-tracking', 'keyword-ladders'],
  },
  {
    date: '2026-10-13',
    title: 'Share a report with a link that expires, and a plan that tells you when to change course',
    summary:
      'You can now hand one report to a client or a colleague without giving them an account: a link that opens that report read-only and stops working on the day you choose. The weekly link-building result comes as a PDF with the same numbers and sources as the app. And every plan now shows your topic radius, while a keyword ladder that has stopped moving comes back with a concrete proposal.',
    highlights: [
      'A share link per report: no account needed, read-only, 14 days by default (1 to 90), and you can turn it off at any time',
      'The link shows that one report and its documents — nothing else of your data — and you can see when it was last opened',
      'The week’s link building arrives as a PDF: every opportunity with the reason it was kept or dropped, the contacts found on their own sites, the page and link text to ask for, each pitch as it would be sent, the listings to add yourself, the redirects to reclaim, and what your links did so far',
      'Your topic radius with every keyword research run and every ladder plan: which topics are within reach today, which are a stretch, and the evidence behind each verdict',
      'A topic that is easy to rank for but has nothing to do with what you sell is marked as a stretch, not as a quick win',
      'A ladder with no movement for weeks comes back with a proposal — improve the page you already have, write the easier keyword first, change the order, or stop — with the evidence behind it',
      'Proposals stay proposals: a plan you approved is never rewritten for you, and you choose how many weeks without movement count as stuck',
    ],
    features: ['reports', 'backlinks', 'keyword-ladders', 'keyword-research'],
  },
  {
    date: '2026-10-13',
    title: 'Charts that say what happened, and numbers that say where they came from',
    summary:
      'Every chart is now marked with the events behind its moves — the pages you published, the technical fixes you made, Google’s ranking updates and the week Google changed its own data. After a page goes live, its trend is compared with the rest of your website. And every number in a report or on a dashboard says its source, its period and its sample size.',
    highlights: [
      'Pages you published and technical fixes are marked on the search, overview and keyword-ladder charts, each with its date',
      'Google’s ranking updates are marked as context, never as a cause',
      'Mid-September 2025, when Google stopped serving a hundred results on one page, is marked as a break in its own data: figures either side are not comparable, and reports say so',
      'A page that changed is compared with the rest of your website over the same weeks, so the season and Google’s updates are taken out of the reading',
      'The verdict stays honest: “likely helped”, “possibly helped”, “no clear effect yet”, “too early to tell” or “can’t tell” — never “this caused that”',
      'The same reading that measured a won link now measures a page you published or rewrote',
      'Every figure carries its source, the period it covers and the sample behind it, with a “Where these numbers come from” table at the end of each report',
      'A number that was calculated rather than counted says “modelled, not measured”; if one ever arrives without its source it says “source not recorded”',
    ],
    features: ['site-tracking', 'reports', 'keyword-ladders', 'backlinks'],
  },
  {
    date: '2026-10-13',
    title: 'Keyword research starts from the searches you already appear for',
    summary:
      'Your own Search Console data now seeds the keyword research instead of only being reported afterwards, traffic estimates say whether they were measured on your site or modelled, and searches Google answers with the same pages are grouped so one page serves them all.',
    highlights: [
      'The searches you get impressions for but have no page for become new page ideas, with their real impressions, clicks and position',
      'The searches you rank between eighth and twentieth for become pages to strengthen, named with the page that already ranks',
      'Your own brand searches and queries typed by SEO tools are left out, and a search one of your pages already answers is named instead of seeded',
      'Traffic potential is calibrated against your measured impressions and clicks where you already rank, and marked “measured”; everywhere else it is marked “modelled”',
      'A search only your Search Console knows about is still a candidate — with no invented search volume',
      'Searches that share at least three of the same top-ten results are one group, named after its main keyword, so one page targets them all',
      'Twice as many keywords get a live results-page check for intent and page type, with the limit and its cost in the report',
    ],
    features: ['keyword-research', 'keyword-ladders', 'reports'],
  },
  {
    date: '2026-10-13',
    title: 'Pages that are yours: an originality check, three real images and a coverage target',
    summary:
      'Every finished page is now compared with the pages it was researched from and with your own pages, arrives with its three images already made, and is measured against the best page in the results instead of a silent ideal.',
    highlights: [
      'More than 15% of a page matching one competitor page, word for word, fails the quality check and goes back to the editor — with the page named and the passage shown',
      'The same check catches two of your own pages saying the same thing, so a new page never competes with one you already have',
      'Rewriting a page you already have is not copying: the page being improved is exempt, and its overlap is reported either way',
      'A page of yours aimed at the same search is flagged as a duplicate target before you publish a second one',
      'The three planned images are produced with the page — a title card and two cards built from its own sections — as WebP files under the planned names, with the alt text and the social image',
      'Swap any image for your own photo: the file name and the alt text stay',
      'The coverage target is read off the best page in the results, not an average, with the subtopics that page covers and your draft does not',
      'Coverage is reported as a figure with what it was measured against, in the report, the page files and the app',
    ],
    features: ['content', 'reports'],
  },
  {
    date: '2026-10-13',
    title: 'Your key pages checked every morning, and fixes verified in a day',
    summary:
      'A monthly audit cannot see a page that was set to noindex on the 3rd. Ascentra now checks your most important pages every day and tells you the same day when something that matters changes — and when you mark a fix done, that exact issue is re-checked the next morning instead of at the next audit.',
    highlights: [
      'Every morning your key pages are fetched and compared with yesterday: HTTP status, a redirect that appeared, the noindex tag, the canonical, the title — plus your robots.txt',
      'A page gone, set to noindex, newly blocked or re-canonicalised reaches you the same day, on the alerts page and in your alert channel',
      'An unchanged page says nothing, and a page that could not be read is reported as not checked — never as fine',
      'Mark an issue fixed and the next daily check judges that one issue on your key pages and shows the answer, usually within a day',
      'Issues that need the full crawl or Search Console data say so instead of guessing, and wait for the audit',
      'Google’s own view of every key page: indexed or not, the canonical Google chose against yours, the last crawl, mobile usability and rich results',
      'Those inspections rotate through all your key pages, oldest first, inside Google’s daily limit, and anything a run did not reach is listed as not checked',
    ],
    features: ['technical-audits', 'site-tracking', 'reports'],
  },
  {
    date: '2026-10-13',
    title: 'Shorter fix lists, honest best links, and a word even when your numbers are small',
    summary:
      'Three quality fixes measured against real sites: the tiniest audit findings are folded into one line so the list you read is the list to act on, a search-results page can no longer be called one of your best links, and a site with a handful of clicks a month still hears when they halve.',
    highlights: [
      'Audit findings of the lowest impact — a title one character too long, the link count of a navigation page, a cosmetic tag — are folded into one “minor items” line with the count',
      'Nothing is removed by the fold: the items still count in the score, stay with the audit and open with one click',
      'A search-results page on a site unrelated to your topics is written off like a link farm, so your best links are the ones that really pass value',
      'Such a page is not called spam either: it stays in the ledger with its reason and is never suggested for disavowal',
      'On a small site a large drop is reported as something to watch, with both periods’ counts named, instead of staying a quiet note',
      'A fall is still only called a fall when it is beyond normal week-to-week variation',
    ],
    features: ['technical-audits', 'backlinks', 'site-tracking', 'reports'],
  },
  {
    date: '2026-10-12',
    title: 'A rank check now reports the whole results page',
    summary:
      'A position on its own does not say much when an AI Overview sits above it. Every weekly check now records what the results page showed, who else was on it and how much of the attention is yours — from the same check, at no extra cost — and your main keywords are checked on a phone as well.',
    highlights: [
      'AI Overview, featured snippet, People Also Ask, local pack and video recorded per keyword, with whether the AI Overview cited your site',
      'The ten sites on page one with their positions, the competitors ranking above you and how many of your keywords they beat you for',
      'A share-of-voice estimate per keyword and per ladder, always labelled as an estimate of the clicks page one offers rather than measured clicks',
      'Your main keywords are checked on a phone as well as on a desktop, shown side by side',
      'The top ten results are kept with every check as a record of what the page looked like',
      'A check that could not be read says so and is retried — it never reports “no AI Overview” or a lost position',
    ],
    features: ['keyword-ladders', 'site-tracking', 'reports'],
  },
  {
    date: '2026-10-12',
    title: 'The speed your visitors feel, and a fix list in the right order',
    summary:
      'Technical audits now report Core Web Vitals from real Chrome visitors for each kind of page, on phone and desktop, and rank every finding by the traffic it puts at risk instead of by its label alone.',
    highlights: [
      'Core Web Vitals at the 75th percentile of real Chrome visitors — home page, a service page and a blog post, phone and desktop',
      'A page with too few visitors to report on its own shows the whole-site figures, marked as such; speed carries a deliberately low weight in the score',
      'When the speed data is unavailable the audit says so, with the step that turns it on — it never guesses',
      'Findings are ranked by severity × pages affected × the clicks and impressions those pages get: index blockers first, cosmetic items never at the top',
      'Every item says why it sits where it does, in the report and in the app, and the severity labels are unchanged',
      'Failure alerts now reach a second channel that does not depend on e-mail, and every alert is recorded even when both channels are down',
      'A check-in filed as a test can no longer pass as the month’s Search Console check-in — the reminder keeps asking',
    ],
    features: ['technical-audits', 'reports'],
  },
  {
    date: '2026-10-12',
    title: 'Numbers you can trust when a data source has a bad minute',
    summary:
      'Every request Ascentra makes to an outside service is now retried, and a provider error that arrives disguised as a success is sent again by itself. What still fails is named in the report instead of quietly lowering a number.',
    highlights: [
      'Every external request is retried three times, five seconds apart',
      'AI visibility rates count the answers that came back, and the report lists what failed and whether the retry worked',
      '“What AI gets wrong” says “not checked” until your business profile is filled in — never “nothing wrong”',
      'A heading an AI answer uses is no longer counted as a competitor, and one page cited under two addresses counts once',
      'A competitor’s own sister domains and sites off your topics stay out of your link prospects, with the reason shown',
      'Links we store and show no longer carry tracking parameters',
    ],
    features: ['ai-visibility', 'backlinks', 'reports'],
  },
  {
    date: '2026-10-12',
    title: 'Only pitches you would be happy to send',
    summary:
      'Outreach now refuses the people who could never link to you, and every draft passes an automatic check before it reaches your approval queue.',
    highlights: [
      'A competitor selling what you sell, a government portal, a bare homepage, a mailbox provider and a contact database are refused with the reason',
      'A list of accredited or approved providers is only pitched when your profile says you hold that accreditation',
      'Every draft is checked: nothing claimed that your profile does not carry, nothing left in brackets, the address on their own domain, something quoted from their page, one link to the page it offers, short, with one clear ask',
      'A draft that fails waits for your edit with the reasons, and automatic sending skips it',
      'Your business name comes from your profile or your own homepage, never from your web address',
      'Before the first e-mail, the recipient\'s domain is checked for a mail server; an address that cannot receive mail is set aside instead of written to',
    ],
    features: ['backlinks', 'ai-visibility'],
  },
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
