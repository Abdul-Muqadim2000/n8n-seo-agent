// Facts for /security ("Where your data lives"), /subprocessors and /data-retention. Every line is checked against the code or the
// deployment scripts on the date in TRUST_FACTS_AS_OF (sources in the comments); anything that cannot be checked there stays out.
// Vendor locations the code cannot prove say "See the vendor's DPA" instead of a guess. Not legal text: the Privacy policy, the Terms
// and a DPA are counsel's (legal.ts). Re-check every line and move the date when anything here changes; a test fails once the date is
// more than 120 days old, so the page is never stale for long.

/** the day every fact on these three pages was last checked against the code (ISO) */
export const TRUST_FACTS_AS_OF = '2026-11-17';

export interface Subprocessor {
  name: string;
  /** what it does for Alaventra */
  purpose: string;
  /** the customer data it receives */
  data: string;
  /** where it processes data, only when the code proves it; otherwise "See the vendor's DPA" */
  location: string;
}

export const VENDOR_DPA = "See the vendor's DPA";

/** Companies that process customer data for Alaventra (verified 2026-11-17 in app/, n8n/seo-agent/workflows, deploy/gcp and DNS). */
export const subprocessors: Subprocessor[] = [
  {
    // deploy/gcp/bootstrap.sh: REGION me-central1, ZONE me-central1-a (VM, data disk, backup bucket, snapshot schedule)
    name: 'Google Cloud',
    purpose: 'Hosts the app server, the database, the automation engine and the backups',
    data: 'Everything in your account',
    location: 'Google Cloud region me-central1 (Doha, Qatar)',
  },
  {
    // app/vercel.json, app/middleware.ts (the edge proxy for /api)
    name: 'Vercel',
    purpose: 'Serves this website and the app\'s pages, and passes the app\'s requests on to our servers',
    data: 'Requests on their way to our servers, and visitors\' IP addresses',
    location: VENDOR_DPA,
  },
  {
    // anthropicApi credential in the engine workflows (writing, checking, grading, reply reading)
    name: 'Anthropic',
    purpose: 'AI models that write, check and grade pages, and read replies to link-building e-mails',
    data: 'Website text, the business profile you enter, keywords, e-mail drafts and the replies to them',
    location: VENDOR_DPA,
  },
  {
    // SEOcredDataForSE (api.dataforseo.com)
    name: 'DataForSEO',
    purpose: 'Search results, keyword data, backlink data and answers from AI assistants',
    data: 'Domains, keywords, questions and brand names',
    location: VENDOR_DPA,
  },
  {
    // v5/code/_reader.js (r.jina.ai)
    name: 'Jina AI',
    purpose: 'Reads public web pages',
    data: 'Addresses of public pages',
    location: VENDOR_DPA,
  },
  {
    // alaventra.com DNS: Brevo domain code, DKIM brevo1._domainkey, DMARC reports to Brevo (app account e-mails over SMTP)
    name: 'Brevo',
    purpose: 'Sends account e-mails: confirmations, password resets, invitations and invoices',
    data: 'Names, e-mail addresses and invoices',
    location: VENDOR_DPA,
  },
  {
    // SEOcredGoogleSvc (Search Console, GA4), PageSpeed key, app/server/src/auth/google.ts, SEOcredSmtpGmail (alerts to our team)
    name: 'Google',
    purpose: 'Search Console and GA4 for the properties you share with us, Google sign-in, page speed data, and alert e-mails to our team',
    data: 'Your Search Console and GA4 data (read only, unless you switch on sitemap submission), your sign-in identity, page addresses',
    location: VENDOR_DPA,
  },
  {
    // SEOcredBraveApi1 (v5/code/AI_Rank_Calls.js)
    name: 'Brave Search',
    purpose: 'Web search for the AI search ranking checks',
    data: 'Search queries made of your keywords and brand names',
    location: VENDOR_DPA,
  },
  {
    // SEOcredBingWebm, Growth_IndexNow_Submit.js
    name: 'Microsoft Bing Webmaster Tools and IndexNow',
    purpose: 'Sends your page addresses to Bing and reads how Bing crawls your website',
    data: 'Your page addresses',
    location: VENDOR_DPA,
  },
  {
    // SEOcredAhrefsDR (v5/code/DR_Requests.js)
    name: 'Ahrefs',
    purpose: 'Domain rating of the websites that link to you',
    data: 'Domain names',
    location: VENDOR_DPA,
  },
  {
    // app/middleware.ts YOUTUBE_FRAMES: the privacy-enhanced player, loaded only when someone presses play
    name: 'YouTube',
    purpose: 'Plays the tutorial films on this website, loaded only when you press play',
    data: 'The viewer\'s IP address while a film plays',
    location: VENDOR_DPA,
  },
];

/** what runs on our own servers (deploy/gcp/compose.prod.yml), so it is not a subprocessor */
export const selfHosted = ['The database', 'The automation engine', 'The PDF maker for reports', 'The search proxy, which passes search queries on to public search engines'];

/** public sources we read with a domain or a search only, never with personal data */
export const publicSources = ['Common Crawl', 'the Internet Archive (Wayback Machine)', 'Wikidata', 'Wikipedia', 'Hacker News', 'GDELT news', 'Bluesky', 'domain registration records (RDAP)'];

/** services a customer chooses to connect: the customer's own accounts, used only as the customer sets them up */
export const servicesYouConnect = [
  'Your mailbox (Microsoft 365, Gmail or any SMTP and IMAP host), for link-building e-mails you approve',
  'Slack and Microsoft Teams, for alerts',
  'Jira, Linear and Asana, for tasks',
  'Amazon S3 and BigQuery, for exports',
  'WordPress, Webflow and Contentful, for drafts of written pages',
  'Looker Studio, for reports',
];

export interface RetentionRow {
  data: string;
  kept: string;
}

/** How long each kind of data is kept (app/server, app/shared and deploy/gcp; see the comments). Written as it is after the
 *  2026-11-17 release, which also deletes a website's history in the automation engine with the website and adds "Delete my
 *  account" (package B of that release; the rows marked CR17-B below are what it ships). */
export const retention: RetentionRow[] = [
  // app/server/src/auth/session.ts SESSION_DAYS 30, refreshed while in use; only a hash is stored
  { data: 'Sign-in sessions', kept: 'Up to 30 days, renewed while you use the app. Only a hash of each session is stored.' },
  // app/shared/src/api-v1.ts defaultExpiryDays 90, choices 30 / 90 / 365 / never
  { data: 'API keys', kept: 'Until the key expires (90 days unless you choose otherwise) or you revoke it. Only a hash is stored.' },
  // app/shared/src/share.ts defaultDays 14, 1 to 90
  { data: 'Report share links', kept: '14 days unless you choose between 1 and 90 days, or until you turn the link off.' },
  // app/shared/src/identity.ts auditRetentionDays 365, AUDIT_RETENTION_CHOICES 30 days to 7 years
  { data: 'Audit log', kept: '365 days unless your company chooses another period, from 30 days to 7 years. Then deleted.' },
  // app/shared/src/integrations.ts logDays 30; webhook_deliveries purged after 30 days
  { data: 'Webhook and integration delivery log', kept: '30 days.' },
  // app/shared/src/crawlers.ts defaultRetentionDays 30 (7 / 30 / 90), rollupDays 400; the uploaded file is deleted once read
  { data: 'Server logs you send for crawler analytics', kept: 'Crawler requests for 30 days unless you choose 7 or 90; daily totals for 400 days. Visits by people are dropped as the file is read, and the file is deleted once read.' },
  // deploy/gcp/compose.prod.yml EXECUTIONS_DATA_MAX_AGE 336 hours
  { data: 'Records of each automated run', kept: '14 days.' },
  // deploy/gcp/compose.prod.yml logging max-size 10m, max-file 3
  { data: 'Server logs', kept: 'Three files of 10 MB per service, overwritten as new lines arrive.' },
  // deploy/gcp/backup.sh nightly pg_dump; bootstrap.sh bucket lifecycle 14 days + 7 days for replaced copies; snapshots 7 days
  { data: 'Backups', kept: 'Database backups every night, kept 14 days and then removed within 7 more days. Disk snapshots every day, kept 7 days.' },
  // app/server/src/db/schema.ts: cascade on company delete; reports and runs keep site_id null when only the website is deleted
  { data: 'Websites, runs, reports, files and settings', kept: 'Until you delete the company. Reports and runs of a deleted website stay in the company until then.' },
  // CR17-B (2026-11-17 release, build section 200): one purge list in n8n/seo-agent/ladder_common.py SITE_PURGE, run by Site Admin's delete
  // and app/server/src/services/enginePurge.ts on website and company delete
  { data: 'The history our SEO engine keeps for a website: rankings, Search Console and Analytics data, AI answers, link prospects and the contacts found for them, audits, page checks and keyword research', kept: 'Until you delete the website or the company: it is deleted at the same time.' },
  // app/server/src/lib/secretBox.ts AES-256-GCM; rows cascade with the company
  { data: 'Mailbox passwords and sign-in grants, CMS and tracker tokens, and webhook secrets', kept: 'Encrypted, until you remove the connection or delete the company.' },
  // app/server/src/services/companyDelete.ts: credit entries and invoices keep org_id null; ladder_common.py SITE_KEEP keeps seo_run_ledger
  { data: 'Credit history, records of what runs cost, and invoices', kept: 'Kept after a website or company is deleted, as accounting records. They show the date, the kind of run and the amount.' },
  // CR17-B (2026-11-17 release): DELETE /api/me ("Delete my account" on the Account page, app/server/src/services/accountDelete.ts)
  { data: 'Your user account', kept: 'Until you delete it yourself on your Account page with Delete my account, or your company\'s sign-in provider removes it. A company that only you belong to is deleted with it.' },
  // CR17-B: users.terms_version / terms_accepted_at (app/shared/src/legal.ts LEGAL_VERSION)
  { data: 'Your agreement to the Terms and the Privacy Policy', kept: 'The version you agreed to and when, for as long as your account exists.' },
  // CR17-B: admin_audit user.self_deleted
  { data: 'A record that an account was deleted', kept: 'Our administrators\' log keeps the e-mail address, the time and the companies deleted with it.' },
];

/** /security "Where your data lives": only what deploy/gcp and app/vercel.json show */
export const dataLocation: string[] = [
  // bootstrap.sh REGION / ZONE; compose.prod.yml (app, postgres, n8n on one VM with a data disk)
  'The app server, the database and the automation engine run on Google Cloud in region me-central1 (Doha, Qatar)',
  // bootstrap.sh bucket --location=$REGION, snapshot schedule --storage-location=$REGION; backup.sh 01:30 UTC
  'Database backups every night, stored in the same region and kept 14 days; disk snapshots every day, kept 7 days',
  // compose.prod.yml EXECUTIONS_DATA_MAX_AGE 336
  'Records of each automated run are kept 14 days',
  // app/vercel.json + middleware.ts
  'The website and the app\'s pages are served by Vercel, which passes the app\'s requests on to our servers',
  // the subprocessor list
  'Some services we use process data outside this region: each one is on the subprocessors list',
  // app/vercel.json, app/server/src/app.ts, deploy/gcp/caddy/Caddyfile
  'HTTPS only, with HSTS on every address',
];

/** /security "Not yet": what an enterprise reviewer asks for that does not exist today */
export const notYet: string[] = [
  'No SOC 2 or ISO 27001 report yet',
  'No penetration test by a third party yet',
  'No public status page yet',
];
