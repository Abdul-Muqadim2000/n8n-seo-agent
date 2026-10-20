// Step-by-step guides for everything the app asks a person to do outside it: connect Search Console, prove the domain is yours,
// put a file on the site, connect a mailbox, fill the business profile. Every "ask" in the UI carries a "Show me how" button that
// opens the matching guide (web/src/components/guide), so nobody has to leave and search for the answer.
//
// The guides are data, not components: the same text renders in the panel, copies to the clipboard and goes into an e-mail to the
// colleague who actually manages the DNS. Bodies use a tiny inline markup, **bold** for what to click, `code` for values to type,
// [label](https://url) for links, and {{placeholders}} for the real values of the site (its domain, the record to add, the key
// file). Rendering is in web/src/components/guide/rich.tsx; the plain-text form is `guideText` below.

import { CYCLE_SPACING_DAYS } from './cycle-clock';
import { AUTOPILOT_LEVELS, CHANCE_WORDS, CYCLE_LOCAL_TIME, NUDGE_AFTER_PAGES, PREVIEW_HOURS_BEFORE, PROPOSAL_WAIT_HOURS, QUEUED_RECHECK_DAYS, REJECT_LIMIT, REJECT_WINDOW } from './cycles';

export type GuideArea = 'autopilot' | 'google' | 'ownership' | 'website' | 'mailbox' | 'business' | 'company' | 'security' | 'integrations' | 'agency';

export interface GuideVar {
  key: string;
  label: string;
  /** shown when the caller has no real value yet, so a guide always reads sensibly */
  example: string;
}

export interface GuideLink {
  label: string;
  href: string;
}

export interface GuideCopy {
  label: string;
  /** may contain {{placeholders}} */
  value: string;
  /** what to paste it into */
  hint?: string;
}

/** One alternative path through a step: the provider, CMS or mail host the person actually uses. */
export interface GuideChoice {
  label: string;
  body: string;
  link?: GuideLink;
  note?: string;
}

export interface GuideStep {
  title: string;
  body: string;
  copy?: readonly GuideCopy[];
  link?: GuideLink;
  /** a helpful aside */
  note?: string;
  /** something that goes wrong if ignored */
  warn?: string;
  choices?: readonly GuideChoice[];
}

export interface Guide {
  id: string;
  area: GuideArea;
  title: string;
  /** one line: what this unlocks, in the customer's terms */
  why: string;
  /** where the work happens, e.g. "Google Search Console" */
  where?: string;
  /** who in the company can do it, when it is not the person reading */
  who?: string;
  /** realistic minutes, used for the "about N minutes" chip */
  minutes: number;
  vars?: readonly GuideVar[];
  steps: readonly GuideStep[];
  /** how to tell it worked */
  done?: string;
  trouble?: readonly { q: string; a: string }[];
  related?: readonly string[];
  /** extra words that should find this guide in the search box */
  keywords?: readonly string[];
  /** D-9: a guide for something only some installations offer (Google sign-in); not offered where it is off */
  requires?: 'google_signin';
}

/** What this installation offers, for the guides that depend on it (`/api/auth/providers`). */
export interface GuideAvailability {
  googleSignIn: boolean;
}

/**
 * D-9 (re-rating 2026-10-17): the DNS guide's "Next, or instead" offered "Prove the website is yours with your Google account" on an
 * installation with no Google sign-in (the verify step there shows DNS and the meta tag only). A guide is offered only when what it
 * walks through exists here.
 */
export const guideAvailable = (g: Pick<Guide, 'requires'> | undefined, a: GuideAvailability): boolean =>
  !!g && (g.requires !== 'google_signin' || a.googleSignIn);

export const GUIDE_AREAS: { id: GuideArea; label: string; description: string }[] = [
  { id: 'autopilot', label: 'Your weekly autopilot', description: 'What happens when, and the choices that steer it: your keyword, the level, the weekly plan' },
  { id: 'google', label: 'Google data', description: 'Search Console and Analytics: the data behind every report' },
  { id: 'ownership', label: 'Proving the website is yours', description: 'One of the ways this app offers, before any data is shown' },
  { id: 'website', label: 'Changes on your website', description: 'Files, pages and tools that live on your side' },
  { id: 'mailbox', label: 'Your mailbox', description: 'Link-building pitches go out from your own address' },
  { id: 'business', label: 'About your business', description: 'What every page is written from and checked against' },
  { id: 'company', label: 'Your company in Alaventra', description: 'Budget, team and who may do what' },
  { id: 'security', label: 'Sign-in and security', description: 'Two-step verification, single sign-on and provisioning' },
  { id: 'integrations', label: 'Connecting your tools', description: 'Slack and Teams, Jira / Linear / Asana, your warehouse, Looker Studio and AI assistants' },
  { id: 'agency', label: 'Your agency portal', description: 'Your brand, your domain and your clients\' access' },
];

/** Whole days, for the sentences that say "2 days before" (the constants are in hours). */
const PREVIEW_DAYS = PREVIEW_HOURS_BEFORE / 24;
const PROPOSAL_WAIT_DAYS = PROPOSAL_WAIT_HOURS / 24;

const V = {
  domain: { key: 'domain', label: 'Your website', example: 'your-domain.com' },
  serviceAccount: { key: 'serviceAccount', label: 'The address that reads your Google data', example: 'reader@alaventra-seo.iam.gserviceaccount.com' },
  dnsHost: { key: 'dnsHost', label: 'Host / name of the record', example: 'your-domain.com' },
  dnsValue: { key: 'dnsValue', label: 'Value of the record', example: 'seo-agent-verification=abc123def456' },
  metaTag: { key: 'metaTag', label: 'The meta tag', example: '<meta name="seo-agent-verification" content="abc123def456" />' },
  indexNowKey: { key: 'indexNowKey', label: 'Your IndexNow key', example: 'e474f67e21841570c3de6d7624391652' },
  indexNowFile: { key: 'indexNowFile', label: 'The file name', example: 'e474f67e21841570c3de6d7624391652.txt' },
  indexNowUrl: { key: 'indexNowUrl', label: 'Where the file goes', example: 'https://your-domain.com/e474f67e21841570c3de6d7624391652.txt' },
  // the weekly autopilot: each example reads as a sentence on its own, because the searchable catalogue opens a guide with no values
  weekday: { key: 'weekday', label: 'Your weekday', example: 'the weekday you finished setup' },
  timezone: { key: 'timezone', label: 'Your time zone', example: "your website's time zone" },
  monthlyDate: { key: 'monthlyDate', label: 'Your monthly date', example: 'the day of the month you finished setup' },
  level: { key: 'level', label: 'Your autopilot level', example: 'the level you chose' },
  pageCredits: { key: 'pageCredits', label: 'A written page', example: 'the credits shown before it starts' },
  planCredits: { key: 'planCredits', label: 'A keyword plan', example: 'the credits shown before you start it' },
  checkCredits: { key: 'checkCredits', label: 'A keyword check', example: 'the few credits shown beside the box' },
} as const;

export const GUIDES = [
  // ---------------------------------------------------------------- Google
  {
    id: 'search-console-property',
    area: 'google',
    title: 'Set up Search Console for your website',
    why: 'Search Console is Google\'s own record of your site: the searches you appear for, what is indexed and what Google could not read. Almost every report here is better with it.',
    where: 'Google Search Console',
    who: 'Anyone with a Google account, plus someone who can edit DNS for the best kind of property',
    minutes: 10,
    vars: [V.domain],
    steps: [
      {
        title: 'Sign in to Search Console',
        body: 'Open **Search Console** and sign in with a Google account your company controls. Prefer a shared company account over a personal one: whoever owns the property keeps the history.',
        link: { label: 'Open Search Console', href: 'https://search.google.com/search-console' },
      },
      {
        title: 'Add a property for {{domain}}',
        body: 'Click the property switcher at the top left, then **Add property**. Choose **Domain** if you can edit DNS: one property then covers http, https, www and every subdomain. Choose **URL prefix** only when you cannot touch DNS.',
        note: 'A Domain property is worth the extra step: with a URL-prefix property, https://{{domain}} and https://www.{{domain}} are two separate properties with two separate histories.',
      },
      {
        title: 'Prove the domain is yours to Google',
        body: 'For a **Domain** property Google gives you one TXT record to add at your DNS provider. For a **URL prefix** property you can instead upload an HTML file, add a meta tag or use an existing Google Analytics tag.',
        note: 'This is Google\'s own check and separate from proving ownership inside Alaventra, but the work is the same kind (the guide for the DNS record walks through the providers).',
      },
      {
        title: 'Give it a few days, then come back',
        body: 'A brand-new property starts empty and fills over the next two or three days. Everything else in Alaventra works meanwhile.',
      },
    ],
    done: 'The property for {{domain}} appears in the property switcher, and **Performance** shows rows within a few days.',
    trouble: [
      { q: 'Someone set this up years ago and I cannot get in', a: 'Ask them to open **Settings > Users and permissions > Add user** and add you as an **Owner**. If nobody can get in at all, add a new Domain property yourself: a domain can have several owners.' },
      { q: 'Verification keeps failing', a: 'The record is almost always right but not yet live. Wait, then press Google\'s **Verify** again. Records usually appear within minutes but can take a couple of hours.' },
    ],
    related: ['search-console-access', 'dns-txt-record'],
    keywords: ['gsc', 'google search console', 'property', 'webmaster'],
  },
  {
    id: 'search-console-access',
    area: 'google',
    title: 'Let Alaventra read your Search Console',
    why: 'This is where clicks, impressions, the searches you already rank for, your sitemaps and index coverage come from. Without it the weekly report, the audits and half the recommendations run blind.',
    where: 'Google Search Console',
    who: 'An owner of the Search Console property',
    minutes: 3,
    vars: [V.domain, V.serviceAccount],
    steps: [
      {
        title: 'Open the property for {{domain}}',
        body: 'Open **Search Console** and pick the property for {{domain}} in the switcher at the top left. No property yet? Set one up first; there is a guide for that.',
        link: { label: 'Open Search Console', href: 'https://search.google.com/search-console' },
      },
      { title: 'Go to Users and permissions', body: 'Click **Settings** in the left menu, then **Users and permissions**.' },
      {
        title: 'Add our reading address as a user',
        body: 'Click **Add user** and paste this address into **Email address**:',
        copy: [{ label: 'Address to add', value: '{{serviceAccount}}', hint: 'Paste into Search Console\'s "Email address" box' }],
        note: 'It is a service account, not a person: it has no inbox, so it never gets or sends mail. It reads your property and nothing else.',
      },
      {
        title: 'Set the permission to Full, then Add',
        body: 'Choose **Full** and click **Add**. Full is what lets us read sitemaps and whether your pages are indexed; **Restricted** hides both. Nothing is ever changed, submitted or removed in your account.',
        warn: 'Pick **Full**, not **Owner**: ownership is yours, and we never need it.',
      },
      { title: 'Come back and press "Check again"', body: 'Alaventra re-reads the connection straight away and shows the property name and permission it found.' },
    ],
    done: 'The Google data card shows **Connected**, your property and permission **Full**.',
    trouble: [
      { q: 'The Add user button is greyed out', a: 'Only an **owner** of the property can add users. Search Console shows who the owners are on the same page. Ask one of them, or send them this guide.' },
      { q: 'Alaventra says the access is restricted', a: 'Open the same screen, click the three dots next to our address and change the permission from **Restricted** to **Full**.' },
      { q: 'We have several properties for the same site', a: 'The **Domain** property (no https:// in front of the name) is the one to use: it covers www, the bare domain and every subdomain.' },
    ],
    related: ['search-console-property', 'ga4-access'],
    keywords: ['gsc', 'service account', 'permission', 'connect google'],
  },
  {
    id: 'search-console-owner',
    area: 'ownership',
    requires: 'google_signin',
    title: 'Prove the website is yours with your Google account',
    why: 'The fastest of the three ways to prove ownership: if your own Google account is already a verified owner in Search Console, there is nothing to add anywhere.',
    where: 'Alaventra, then Google\'s sign-in screen',
    who: 'Whoever is a verified owner in Search Console',
    minutes: 1,
    vars: [V.domain],
    steps: [
      { title: 'Press "Verify with Google"', body: 'You go to Google\'s own sign-in screen. Choose the account that is an **owner** of {{domain}} in Search Console.' },
      {
        title: 'Allow the read-only check',
        body: 'Google asks whether Alaventra may see your Search Console properties. That permission is read-only: we check that your account owns {{domain}} and read nothing else at this point.',
      },
      { title: 'You come back verified', body: 'The website is usable straight away. The next step is connecting the data itself, which is a separate, equally short job.' },
    ],
    done: '{{domain}} shows as verified, with "Google (Search Console owner)" as the method.',
    trouble: [
      {
        q: 'Google says my account is not an owner',
        a: 'Being able to *see* a property is not the same as owning it. Ask a current owner to open **Settings > Users and permissions > Add user** and add you as **Owner**, or use the DNS record or the meta tag instead, which prove the same thing without Google.',
      },
      { q: 'Another company already verified this website', a: 'A website belongs to one company here. Ask the owner of that company to invite you, or contact your platform administrator.' },
    ],
    related: ['dns-txt-record', 'meta-tag', 'search-console-access'],
    keywords: ['verify', 'ownership', 'google sign in'],
  },
  {
    id: 'ga4-access',
    area: 'google',
    title: 'Let Alaventra read your Google Analytics',
    why: 'Analytics turns rankings into money: visits from search, which pages they land on, and the sign-ups, leads or sales that follow. It is optional: everything else works without it.',
    where: 'Google Analytics (GA4)',
    who: 'An administrator of the GA4 property',
    minutes: 3,
    vars: [V.domain, V.serviceAccount],
    steps: [
      {
        title: 'Open Analytics and go to Admin',
        body: 'Open **Google Analytics** and click **Admin** (the gear at the bottom left). Make sure the property shown is the one that measures {{domain}}.',
        link: { label: 'Open Google Analytics', href: 'https://analytics.google.com/' },
      },
      { title: 'Open Property access management', body: 'In the **Property** column, click **Property access management**.' },
      {
        title: 'Add our reading address as a Viewer',
        body: 'Click **+** at the top right, then **Add users**, and paste this address:',
        copy: [{ label: 'Address to add', value: '{{serviceAccount}}', hint: 'Paste into Analytics\' "Email addresses" box' }],
        note: 'Untick **Notify new users by email**: a service account has no inbox.',
      },
      {
        title: 'Choose the Viewer role and click Add',
        body: 'Viewer can read reports and nothing else: it cannot change settings, edit events or delete anything.',
      },
      { title: 'Come back and press "Check again"', body: 'Alaventra lists the properties it can now read. Pick the one that measures {{domain}}. The one whose web stream points at your domain is marked and listed first.' },
    ],
    done: 'The Google data card shows **Connected** with your property name under Google Analytics 4.',
    trouble: [
      { q: 'I cannot see Property access management', a: 'You need the **Administrator** role on that property. The person who set Analytics up has it, and the same screen lists them.' },
      { q: 'Several properties look alike', a: 'Open **Admin > Data streams** and check which one has a web stream for {{domain}}. You can also paste the property ID here by hand.' },
      { q: 'We use Universal Analytics', a: 'Universal Analytics stopped collecting data in 2023 and cannot be read. You need a GA4 property with its own tag on the site.' },
    ],
    related: ['ga4-property-id', 'search-console-access'],
    keywords: ['ga4', 'analytics', 'viewer', 'traffic'],
  },
  {
    id: 'ga4-property-id',
    area: 'google',
    title: 'Find your GA4 property ID',
    why: 'When several Analytics properties look alike, the ID removes the doubt about which one measures this website.',
    where: 'Google Analytics (GA4)',
    minutes: 2,
    vars: [V.domain],
    steps: [
      { title: 'Open Admin > Property details', body: 'In **Google Analytics**, click **Admin** (the gear, bottom left), then **Property details** in the Property column.', link: { label: 'Open Google Analytics', href: 'https://analytics.google.com/' } },
      {
        title: 'Copy the number at the top right',
        body: 'The **PROPERTY ID** is nine or ten digits, for example `123456789`. Paste it here.',
        warn: 'It is not the `G-XXXXXXX` measurement ID: that one sits on your website and cannot be used to read reports.',
      },
      { title: 'Check it is the right property', body: 'In **Data streams**, the stream of that property should show {{domain}} as its website URL.' },
    ],
    done: 'The ID is saved on the website and the weekly report starts showing visits and key events from search.',
    related: ['ga4-access'],
    keywords: ['property id', 'ga4', 'measurement id'],
  },
  {
    id: 'search-console-links-export',
    area: 'google',
    title: 'Export the links Google knows about',
    why: 'Google sees links no public index has, but its API will not hand them over. The export is the one way to add Google\'s own view to your link ledger, and it shows how much of it the other sources already cover.',
    where: 'Google Search Console',
    minutes: 3,
    vars: [V.domain],
    steps: [
      { title: 'Open Links in Search Console', body: 'Open **Search Console**, pick the property for {{domain}} and click **Links** at the bottom of the left menu.', link: { label: 'Open Search Console > Links', href: 'https://search.google.com/search-console/links' } },
      {
        title: 'Export the external links',
        body: 'Click **Export external links** at the top right and choose **Latest links** (the most recent links Google found, with the date it crawled each one).',
        note: '**More sample links** works too, and so does a backlink CSV from any other tool. Ahrefs Webmaster Tools is free for a site you have verified.',
      },
      { title: 'Download the CSV', body: 'Choose **Download CSV**. If you pick Google Sheets instead, open the sheet and use **File > Download > Comma-separated values**.' },
      { title: 'Upload it here', body: 'Press **Add Search Console links** and choose the file. A new upload of the same kind replaces the old one, so you can refresh it whenever you like.' },
      { title: 'Repeat every few months', body: 'Links come and go. An upload every quarter keeps Google\'s view of your links fresh in the ledger.' },
    ],
    done: 'The source list shows the row count and the date of your upload, and the next full backlink check includes those links.',
    trouble: [
      { q: 'The file is bigger than 15 MB', a: 'Export **Latest links** on its own rather than the whole links report: the top-linking-sites table is far smaller than every page.' },
      { q: 'I only see "Top linking sites"', a: 'That table works as well. It gives domains rather than pages, which is enough for the ledger to find links no other source had.' },
    ],
    related: ['search-console-access', 'bing-webmaster'],
    keywords: ['backlinks', 'csv', 'export links', 'latest links'],
  },
  {
    id: 'search-console-checkin',
    area: 'google',
    title: 'The monthly Search Console check-in',
    why: 'Three things in Search Console are invisible to any API: a manual penalty, a security problem, and Google\'s reasons for leaving pages out of the index. Two minutes a month catches the rare thing that would otherwise undo a year of work.',
    where: 'Google Search Console',
    minutes: 5,
    vars: [V.domain],
    steps: [
      { title: 'Open Manual actions', body: 'In **Search Console**, with {{domain}} selected, open **Security & Manual Actions > Manual actions**. "No issues detected" is what you want to see.', link: { label: 'Open Search Console', href: 'https://search.google.com/search-console' } },
      { title: 'Open Security issues', body: 'Same menu, **Security issues**. Hacked content and malware warnings show here first, usually before anything is visible on the site.' },
      {
        title: 'Look at the Pages report',
        body: 'Open **Indexing > Pages**. The lower half lists why pages are not indexed. Big numbers under "Crawled, currently not indexed" or "Discovered, currently not indexed" are worth reporting.',
      },
      { title: 'Answer the two questions here', body: 'Come back, open the check-in and say what you saw. Anything you report is carried into the audit and the weekly report, so the advice accounts for it.' },
    ],
    done: 'The check-in is recorded for the month and the reminder stops until the next one.',
    related: ['search-console-access'],
    keywords: ['manual action', 'penalty', 'security', 'indexing', 'coverage'],
  },

  // ---------------------------------------------------------------- Proving ownership
  {
    id: 'dns-txt-record',
    area: 'ownership',
    title: 'Add the DNS record that proves the domain is yours',
    why: 'Nothing about a website is shown here until the company proves it owns it. A TXT record is the strongest proof and needs no change to the website itself.',
    where: 'Your domain registrar or DNS provider',
    who: 'Whoever manages DNS, often not the same person who edits the website',
    minutes: 10,
    vars: [V.domain, V.dnsHost, V.dnsValue],
    steps: [
      {
        title: 'Find where your DNS is managed',
        body: 'That is the registrar you bought {{domain}} from, or wherever you pointed it since (Cloudflare, your hosting panel, your agency).',
        note: 'Not sure? Look the domain up on [ICANN Lookup](https://lookup.icann.org). It names the registrar, and the "Name Servers" line tells you who actually serves the DNS.',
      },
      {
        title: 'Open the DNS records for {{domain}}',
        body: 'Every provider calls this screen something slightly different.',
        choices: [
          { label: 'Cloudflare', body: 'Pick the domain, then **DNS > Records > Add record**.' },
          { label: 'GoDaddy', body: 'Open **Domain portfolio**, click the domain, then **DNS > Add New Record**.' },
          { label: 'Namecheap', body: 'Open **Domain List > Manage > Advanced DNS > Add New Record**.' },
          { label: 'Squarespace', body: 'Open **Domains**, click the domain, then **DNS > DNS settings > Add record** (domains bought from Google Domains moved here).' },
          { label: 'cPanel / Plesk', body: 'Open the **Zone Editor** (cPanel) or **DNS Settings** (Plesk) for the domain and add a record.' },
          { label: 'Somewhere else', body: 'Look for **DNS**, **Zone editor**, **Name servers** or **Advanced DNS**. Every provider has one, and the three values below are all you need.' },
        ],
      },
      {
        title: 'Add this record',
        body: 'Create a new record with exactly these values and leave TTL at whatever the provider suggests.',
        copy: [
          { label: 'Type', value: 'TXT' },
          { label: 'Host / name', value: '{{dnsHost}}', hint: 'Many providers want `@` or an empty box for the domain itself' },
          { label: 'Value / content', value: '{{dnsValue}}', hint: 'Paste it whole, without quotes' },
        ],
        warn: 'Most providers add the domain to whatever you type in the host box. If the saved record ends up reading `{{domain}}.{{domain}}`, put `@` in that box instead.',
      },
      {
        title: 'Save it, then press "Check now" here',
        body: 'New records are usually live within minutes, sometimes after an hour or two. You can close this and come back; nothing is lost.',
      },
      { title: 'Leave the record in place', body: 'It stays as the standing proof of ownership. Deleting it later can unverify the website.' },
    ],
    done: '{{domain}} shows as verified and the dashboards, tracking and site checks open up.',
    trouble: [
      {
        q: 'It still says the record was not found',
        a: 'Check it from outside your own network with [DNS Checker](https://dnschecker.org) (choose TXT), or run `dig TXT {{domain}} +short` in a terminal. If the value does not show there yet, it is propagation. Wait and press Check now again.',
      },
      { q: 'There is already a TXT record on the domain', a: 'Add a second one. A domain can have any number of TXT records; they do not replace each other. Do not paste our value into the existing record.' },
      { q: 'My provider only offers a "value" box with quotes', a: 'Paste the value without the quotes. Providers that need quotes add them themselves when they save.' },
    ],
    related: ['meta-tag', 'search-console-owner'],
    keywords: ['dns', 'txt', 'verify', 'ownership', 'registrar', 'cloudflare', 'godaddy'],
  },
  {
    id: 'meta-tag',
    area: 'ownership',
    title: 'Add the verification tag to your homepage',
    why: 'The way to prove ownership when you can edit the website but not its DNS. One line in the homepage, and it can come out again once the website is verified, though leaving it costs nothing.',
    where: 'Your website\'s homepage',
    who: 'Whoever can edit the site or its theme',
    minutes: 10,
    vars: [V.domain, V.metaTag],
    steps: [
      {
        title: 'Copy the tag',
        body: 'This exact line, nothing changed:',
        copy: [{ label: 'Meta tag', value: '{{metaTag}}', hint: 'Goes inside the <head> of your homepage' }],
      },
      {
        title: 'Paste it into the <head> of https://{{domain}}/',
        body: 'It has to be in the homepage\'s own HTML, before the closing `</head>`.',
        choices: [
          { label: 'WordPress', body: 'Your SEO plugin has a box for exactly this: **Yoast > Settings > Site features > Webmaster tools**, or **Rank Math > General Settings > Webmaster Tools**. Otherwise use a header-scripts plugin or your theme\'s "header code" setting.' },
          { label: 'Shopify', body: 'Open **Online Store > Themes > ... > Edit code** and paste it into `theme.liquid`, just below the opening `<head>` tag.' },
          { label: 'Wix', body: 'Open **Settings > Custom code > Add custom code**, paste the tag, place it in the **Head**, and apply it to all pages.' },
          { label: 'Squarespace', body: 'Open **Settings > Developer tools > Code injection** and paste it into the **Header** box.' },
          { label: 'Webflow', body: 'Open **Site settings > Custom code** and paste it into **Head code**, then publish.' },
          { label: 'Hand-coded site', body: 'Paste it into the `<head>` of your `index.html` or the layout template the homepage uses, and deploy.' },
        ],
      },
      { title: 'Publish, and clear any cache', body: 'Caching plugins and CDNs happily serve the old homepage for a while. Purge the cache if you have one.' },
      { title: 'Press "Check now" here', body: 'We read https://{{domain}}/ and https://www.{{domain}}/ and look for the tag.' },
    ],
    done: '{{domain}} shows as verified. The tag can stay: it is invisible to visitors.',
    trouble: [
      {
        q: 'The check does not find it, but I can see it on the page',
        a: 'Open the page source (**Ctrl+U** / **⌘+⌥+U**) rather than the inspector and search for the tag. If it is not in the source, it is being inserted by JavaScript (a tag manager, for instance), and our check reads the raw HTML. Put it in the page itself.',
      },
      { q: 'My homepage redirects somewhere else', a: 'Put the tag on the page the redirect lands on too. If https://{{domain}}/ sends visitors to /en/ or to www, both need it.' },
    ],
    related: ['dns-txt-record', 'search-console-owner'],
    keywords: ['meta tag', 'head', 'verify', 'wordpress', 'shopify'],
  },

  // ---------------------------------------------------------------- Your website
  {
    id: 'indexnow-key-file',
    area: 'website',
    title: 'Add the IndexNow key file to your site',
    why: 'One small text file, once. After it, every new or changed page is announced to Bing (and so to Copilot and ChatGPT search), plus Yandex, Naver and Seznam, the same week instead of whenever a crawler happens by.',
    where: 'Your website\'s files',
    who: 'Whoever can put a file at the root of the site',
    minutes: 10,
    vars: [V.domain, V.indexNowKey, V.indexNowFile, V.indexNowUrl],
    steps: [
      {
        title: 'Make the file',
        body: 'A plain text file named after the key, containing that key and nothing else: no quotes, no line about what it is.',
        copy: [
          { label: 'File name', value: '{{indexNowFile}}' },
          { label: 'The only line inside it', value: '{{indexNowKey}}' },
        ],
      },
      {
        title: 'Put it at the root of {{domain}}',
        body: 'It has to answer at exactly this address:',
        copy: [{ label: 'Where it must live', value: '{{indexNowUrl}}' }],
        choices: [
          { label: 'WordPress', body: 'Upload it to the folder that holds `wp-config.php` with your host\'s file manager or FTP, **not** the media library, which puts files under `/wp-content/uploads/`. An IndexNow plugin can also host the file for you.' },
          { label: 'Next.js / Nuxt / Astro', body: 'Drop it in the `public/` folder and deploy. It is then served from the root.' },
          { label: 'Apache / nginx / plain hosting', body: 'Put it in the web root (the folder that holds `index.html`) with FTP, SFTP or the host\'s file manager.' },
          { label: 'Webflow', body: 'Webflow cannot serve a file at the root. Skip this: your pages still reach Bing through the sitemap, a little more slowly.' },
          { label: 'Shopify / Wix / Squarespace', body: 'These platforms do not let you add a file at the root either. Skip it; nothing else about the weekly run changes.' },
        ],
      },
      {
        title: 'Open the address in a browser',
        body: 'You should see the key as plain text, over https, with no redirect and no page design around it.',
        warn: 'A "404 not found", a login screen or your site\'s styled 404 page all mean the file is not at the root yet.',
      },
      { title: 'Press "Check the file" here', body: 'We fetch it and compare it with the key. From then on the weekly AI growth run submits your new and updated pages automatically.' },
    ],
    done: 'The panel says IndexNow is ready, and the next weekly run reports how many pages it sent.',
    trouble: [
      { q: 'The browser downloads the file instead of showing it', a: 'That is fine: the content is what matters, not how the browser chooses to show it.' },
      { q: 'I get my site\'s 404 page', a: 'The file is in a subfolder. The address must have nothing between the domain and the file name.' },
    ],
    related: ['bing-webmaster', 'publish-page'],
    keywords: ['indexnow', 'bing', 'key file', 'crawl', 'ai search'],
  },
  {
    id: 'ai-crawler-access',
    area: 'website',
    title: 'Let the AI assistants read your site',
    why: 'An assistant can only name a page its crawler is allowed to fetch. A crawler turned away at the door is the one problem no amount of good content fixes, and most sites block one by accident.',
    where: 'Your robots.txt and your CDN or firewall',
    who: 'Whoever can edit the site files and the CDN rules',
    minutes: 15,
    vars: [V.domain],
    steps: [
      {
        title: 'Open your robots.txt',
        body: 'It is a plain text file at the root of the site. If it answers 404, nothing is blocked by it, but it is worth adding one anyway.',
        copy: [{ label: 'The address to open', value: 'https://{{domain}}/robots.txt' }],
      },
      {
        title: 'Decide which crawlers you want',
        body: 'They fall into two groups, and the table above says which ones can reach you today. **Answer crawlers** fetch a page because someone asked a question right now; those are the ones that get you cited. **Training crawlers** collect pages to train a model, which is a separate decision and costs you nothing in visibility if you refuse.',
        note: 'Refusing the training crawlers while allowing the answer crawlers is a perfectly normal position, and the report never pushes you either way.',
      },
      {
        title: 'Allow the ones you want, by name',
        body: 'Add a block per crawler. A rule naming a crawler wins over the catch-all `User-agent: *`, so this is enough even when the catch-all is restrictive.',
        copy: [{ label: 'For example', value: 'User-agent: OAI-SearchBot\nAllow: /', hint: 'One block per crawler, with a blank line between blocks' }],
        warn: 'Check the catch-all while you are there: a `User-agent: *` block with `Disallow: /` takes the whole site out of every search engine, not only the AI ones.',
      },
      {
        title: 'Check the firewall or CDN too',
        body: 'This is the one people miss: robots.txt can say yes while Cloudflare, a WAF or a bot-protection rule turns the crawler away. The homepage test above is exactly that check: a crawler marked "turned away" with a status like 403 is being blocked by your edge, not by robots.txt.',
        choices: [
          { label: 'Cloudflare', body: 'Open **Security > Bots** and let verified bots through, then check **Security > WAF** for a rule that matches the user agent. Super Bot Fight Mode blocks most AI crawlers by default.' },
          { label: 'Another CDN or WAF', body: 'Look for bot management, rate limiting or a user-agent rule, and allow the crawlers you chose. Your host can usually see which rule produced the 403.' },
          { label: 'No CDN', body: 'Then robots.txt is the only gate, and there is nothing else to change.' },
        ],
      },
      {
        title: 'Optional: add an llms.txt',
        body: 'A plain-text file at the root listing your best pages with one line each about what they answer. It is not a standard the engines promise to follow, and it is minutes of work: a clean map of your site for anything that reads it.',
      },
      { title: 'Check it again', body: 'The weekly run re-checks every crawler, robots.txt and the homepage test, so the next report tells you whether the door is open.' },
    ],
    done: 'Every crawler you chose shows as allowed, and the homepage test returns 200 for each of them.',
    trouble: [
      { q: 'We have no robots.txt at all', a: 'Then nothing is blocked by it. Adding one is still worth it: it is where your sitemap is announced and where these rules will live when you need them.' },
      { q: 'A crawler is allowed but still turned away', a: 'That is the CDN or firewall, not robots.txt. The status in the homepage test (403, 429 or a challenge page) tells your host which rule to look for.' },
    ],
    related: ['indexnow-key-file', 'fix-pack'],
    keywords: ['robots.txt', 'llms.txt', 'gptbot', 'crawler', 'blocked', 'cloudflare', 'ai'],
  },
  {
    id: 'publish-page',
    area: 'website',
    title: 'Publish a page Alaventra wrote',
    why: 'A written page earns nothing until it is live. Publishing it as planned (same slug, same links, same images) is what lets the rest of the plan and the rank tracking follow it.',
    where: 'Your CMS',
    minutes: 20,
    vars: [V.domain],
    steps: [
      {
        title: 'Download the package',
        body: 'Every finished page comes with the article as **HTML** and as **Markdown**, plus a `meta.json` holding the title, the meta description, the planned slug, the image plan and the structured data.',
      },
      {
        title: 'Create the page at the planned slug',
        body: 'The slug in `meta.json` is the one the plan, the internal links and the rank tracking expect. Keep it.',
        warn: 'Changing the slug after publishing costs the page whatever ranking it has built. If you must, add a redirect from the old address to the new one.',
      },
      {
        title: 'Paste the body in',
        body: 'Use the HTML in a code or raw block, or the Markdown if your CMS speaks it. Keep the headings as they are: they answer the searches the page targets, and the quality check reads them.',
        choices: [
          { label: 'WordPress', body: 'Add a new post, switch the editor to **Code editor** (the three dots, top right) and paste the HTML. Switch back to see it laid out.' },
          { label: 'Webflow / Ghost / Hubspot', body: 'Create the post, then paste the HTML into a raw-HTML or source block so the headings and links survive.' },
          { label: 'Markdown-based site', body: 'Commit the Markdown file, keeping the front matter your site expects, and copy the title and description from `meta.json`.' },
        ],
      },
      {
        title: 'Set the title, the description and the images',
        body: 'Copy the SEO title and the meta description from `meta.json` into your SEO plugin\'s fields. The image plan names each image, where it goes and its alt text. Add them before publishing, not after.',
      },
      {
        title: 'Publish, then tell Alaventra',
        body: 'Use **I published a page** and paste its address on {{domain}}. We read the live page (title, description, structured data, images, internal links), report anything the CMS dropped, and start tracking its position.',
      },
    ],
    done: 'The page shows as published in the content list, and the rank tracker begins reporting its position from the next weekly check.',
    trouble: [
      { q: 'My editor strips the HTML', a: 'Paste into a code / raw block rather than the visual editor. Visual editors routinely drop headings, link attributes and structured data.' },
      { q: 'The check says images are missing', a: 'The names in the package are a plan, not uploaded files. Add your own images, keep the alt text, and run the check again.' },
    ],
    related: ['wordpress-application-password', 'webflow-api-token', 'contentful-cma-token', 'cms-webhook', 'indexnow-key-file', 'business-facts'],
    keywords: ['publish', 'cms', 'wordpress', 'article', 'slug'],
  },
  // ---------------------------------------------------------------- G2: publishing to your CMS from Alaventra
  {
    id: 'wordpress-application-password',
    area: 'website',
    title: 'Connect WordPress with an application password',
    why: 'With it Alaventra puts a written page into WordPress for you, as a draft by default, with its slug, excerpt, featured image and SEO fields, and updates the same post when you send it again.',
    where: 'Your WordPress admin',
    who: 'A WordPress user with the Editor or Administrator role (Administrator if the pages should keep their structured data)',
    minutes: 5,
    vars: [V.domain],
    steps: [
      {
        title: 'Sign in as the user Alaventra should post as',
        body: 'Open your WordPress admin and sign in as an **Editor** or **Administrator**. Posts are created under this user. A dedicated user such as `alaventra` keeps the history clear.',
        note: 'Only Administrators may save structured data (JSON-LD) inside a post on a normal WordPress site. With an Editor, Alaventra leaves it out and tells you to add it through your SEO plugin.',
      },
      {
        title: 'Create an application password',
        body: 'Go to **Users > Profile** (or **Users > All users > the user > Edit**), scroll to **Application Passwords**, type `Alaventra` as the name and click **Add New Application Password**.',
        link: { label: 'How application passwords work (WordPress.org)', href: 'https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/' },
        warn: 'WordPress shows the password once. Copy it now. If you lose it, revoke it and create another.',
      },
      {
        title: 'Fill in the connection in Alaventra',
        body: 'In **Website settings > Publishing > Connect a CMS > WordPress**, enter the site address (for example `https://{{domain}}`, not the /wp-admin address), the **user name** (not the e-mail) and the application password. Choose posts or pages, and the categories and tags new posts should get.',
      },
      {
        title: 'Test the connection',
        body: 'Click **Test connection**. Alaventra signs in, checks the user may create and publish posts, and looks for Yoast SEO or Rank Math fields it can fill.',
        choices: [
          { label: 'Yoast SEO', body: 'The SEO title and meta description go straight into Yoast when the site exposes its fields to the REST API. If it does not, the description goes into the excerpt and Alaventra tells you to paste the title into Yoast.' },
          { label: 'Rank Math', body: 'The same: Rank Math\'s fields are filled when they are open to the REST API (Rank Math > General Settings > Others > Headless CMS Support), otherwise the excerpt carries the description.' },
          { label: 'No SEO plugin', body: 'The meta description goes into the excerpt, which most themes print as the description.' },
        ],
      },
    ],
    done: 'The connection shows **Connected** with the user\'s name. On a written page, **Send to CMS as draft** creates a draft you can open in WordPress.',
    trouble: [
      { q: 'The test says no WordPress REST API answered', a: 'Use the site\'s own address. A security plugin (Wordfence, iThemes) or the host can block `/wp-json`: allow it for signed-in requests.' },
      { q: 'The test says the password was refused', a: 'Application passwords need HTTPS and WordPress 5.6 or newer. Some hosts strip the Authorization header. Ask them to pass it through, or add the rule they give you to .htaccess.' },
      { q: 'Publishing live fails but drafts work', a: 'The user may create but not publish. Make it an Editor or Administrator.' },
    ],
    related: ['publish-page', 'cms-webhook'],
    keywords: ['wordpress', 'application password', 'rest api', 'yoast', 'rank math', 'publish', 'cms'],
  },
  {
    id: 'webflow-api-token',
    area: 'website',
    title: 'Connect Webflow: an API token and the collection id',
    why: 'With them Alaventra creates the page as an item of your blog collection (a draft by default) and publishes it only when an owner or admin chooses to.',
    where: 'Webflow site settings and the Designer',
    who: 'A Webflow workspace member who can manage the site\'s integrations',
    minutes: 5,
    vars: [V.domain],
    steps: [
      {
        title: 'Create a site API token',
        body: 'Open the site\'s **Site settings > Apps & integrations > API access > Generate API token**. Name it `Alaventra` and give it **CMS: read and write**. Copy the token.',
        link: { label: 'Webflow: site tokens', href: 'https://developers.webflow.com/data/reference/authentication/site-token' },
        warn: 'Webflow shows the token once. Anyone with it can change your CMS, so paste it only into Alaventra.',
      },
      {
        title: 'Find the collection id',
        body: 'In the Designer open **CMS**, choose the collection your articles live in (for example **Blog Posts**) and open its **settings**: the **Collection ID** is a 24-character code.',
      },
      {
        title: 'Connect and test',
        body: 'In **Website settings > Publishing > Connect a CMS > Webflow**, paste the token and the collection id, then **Test connection**. Alaventra reads the collection\'s fields.',
      },
      {
        title: 'Map the fields once',
        body: 'Choose the **rich-text** field that holds the article, and the plain-text fields for the meta description, the SEO title, the excerpt and the author if your collection has them. The name and the slug are filled for you.',
        note: 'Images are not uploaded to Webflow: add the featured image in the item. The file and its alt text are in the page\'s downloads.',
      },
      {
        title: 'Tell Alaventra the address pattern',
        body: 'Pages of a collection live under its own path, for example `https://{{domain}}/blog/{slug}`. Enter that pattern so Alaventra can check the live page and track it.',
      },
    ],
    done: 'The connection shows **Connected** with the collection name, and a page sent as a draft appears in the collection as a draft item.',
    trouble: [
      { q: 'The test says no collection with this id', a: 'The token belongs to another site, or the id was copied from another collection. Copy both from the same site.' },
      { q: 'Publishing fails with a domain error', a: 'Webflow publishes items only on a site that has been published at least once. Publish the site in the Designer first.' },
    ],
    related: ['publish-page', 'cms-webhook'],
    keywords: ['webflow', 'api token', 'collection', 'cms', 'publish'],
  },
  {
    id: 'contentful-cma-token',
    area: 'website',
    title: 'Connect Contentful: a content management token',
    why: 'With it Alaventra creates the page as an entry of your article content type, a draft by default, and publishes the entry only when an owner or admin chooses to.',
    where: 'Contentful web app',
    who: 'A Contentful user with access to the space and its environment',
    minutes: 8,
    vars: [V.domain],
    steps: [
      {
        title: 'Create a content management token',
        body: 'In Contentful open **Settings > CMA tokens > Create personal access token**, name it `Alaventra` and copy it. It must be a management token, not a Content Delivery API key.',
        link: { label: 'Contentful: authentication', href: 'https://www.contentful.com/developers/docs/references/authentication/' },
        warn: 'Contentful shows the token once, and it acts with your own permissions. A dedicated user with access to one space only is safer.',
      },
      {
        title: 'Note the three ids',
        body: 'The **space id** is in **Settings > General settings**. The **environment** is usually `master`. The **content type id** is shown in **Content model > your article type** (for example `blogPost`).',
      },
      {
        title: 'Connect and test',
        body: 'In **Website settings > Publishing > Connect a CMS > Contentful**, paste the token and the ids, then **Test connection**. Alaventra reads the content type\'s fields and your default locale.',
      },
      {
        title: 'Map the fields once',
        body: 'Choose the fields for the **title**, the **slug** and the **article**. The article goes into a **Long text** field as Markdown; the meta description, SEO title and the date into fields of their own if you have them.',
        note: 'A Rich Text field is refused on purpose: it is a document model, not HTML, and converting into it would quietly drop tables and links. Add a Long text field for the article.',
      },
      {
        title: 'Tell Alaventra the address pattern',
        body: 'Your front end builds the address of an entry, for example `https://{{domain}}/insights/{slug}`. Enter that pattern so Alaventra can check the live page and track it.',
      },
    ],
    done: 'The connection shows **Connected** with the content type, and a page sent as a draft appears in Contentful as a draft entry.',
    trouble: [
      { q: 'The test says no such space, environment or content type', a: 'One of the three ids is wrong, or the token\'s user has no access to that space or environment.' },
      { q: 'Publishing fails with a validation error', a: 'A required field of the content type is not mapped. Map a field to it, or make it optional in the content model.' },
    ],
    related: ['publish-page', 'cms-webhook'],
    keywords: ['contentful', 'cma', 'management token', 'headless', 'cms', 'publish'],
  },
  {
    id: 'cms-webhook',
    area: 'website',
    title: 'Receive pages through a signed webhook',
    why: 'For any stack Alaventra does not connect to directly (another headless CMS, a static site, a bot that opens a pull request), the whole page arrives as signed JSON at an address of yours.',
    where: 'Your own endpoint',
    who: 'A developer who can deploy a small endpoint',
    minutes: 30,
    vars: [V.domain],
    steps: [
      {
        title: 'Deploy an https endpoint',
        body: 'It receives a `POST` with a JSON body: the title, the slug, the meta description, the article as HTML and Markdown, the structured data, the images (as base64 when small enough) and whether to keep it a draft or publish it (`mode`).',
      },
      {
        title: 'Connect it in Alaventra and copy the secret',
        body: 'In **Website settings > Publishing > Connect a CMS > Webhook**, enter the address. Alaventra shows a signing secret starting `whsec_` **once**. Store it with your endpoint.',
      },
      {
        title: 'Check the signature on every request',
        body: 'Compute HMAC-SHA256 with the secret over the timestamp header, a dot and the raw body, and compare it with the signature header in constant time. Refuse anything older than five minutes.',
        copy: [
          { label: 'Signature header', value: 'X-Alaventra-Signature: sha256=<hex>' },
          { label: 'Timestamp header', value: 'X-Alaventra-Timestamp: <milliseconds>' },
          { label: 'Signed text', value: '<timestamp>.<raw body>' },
        ],
      },
      {
        title: 'Use the idempotency key',
        body: 'The `Idempotency-Key` header is the same for every send of the same page. Update the item you made the first time instead of creating a second one.',
      },
      {
        title: 'Answer with what you did',
        body: 'Answer `2xx`, ideally with JSON `{"id": "...", "url": "...", "status": "draft"}` (or `"published"`). Alaventra keeps the id and the address and shows them on the page.',
        note: 'Pages on {{domain}} that you publish are checked live and tracked once you, or this answer, say they are live.',
      },
    ],
    done: 'Test connection sends a signed `cms.test` event and your endpoint answers 2xx.',
    trouble: [
      { q: 'The signature never matches', a: 'Sign the raw body exactly as received, before any JSON parsing or re-serialisation, and use the timestamp header\'s value as it is.' },
      { q: 'The secret is lost', a: 'Remove the connection and add it again: a new secret is made and shown once.' },
    ],
    related: ['publish-page'],
    keywords: ['webhook', 'hmac', 'signature', 'headless', 'pull request', 'git', 'api', 'cms'],
  },
  {
    id: 'bing-webmaster',
    area: 'website',
    title: 'Add your site to Bing Webmaster Tools',
    why: 'Free, and it pays twice: Bing shares link data that costs money elsewhere, and Microsoft Copilot answers from Bing\'s index, so being in it is part of being in AI answers.',
    where: 'Bing Webmaster Tools',
    minutes: 5,
    vars: [V.domain],
    steps: [
      { title: 'Sign in to Bing Webmaster Tools', body: 'Any Microsoft, Google or Facebook account works.', link: { label: 'Open Bing Webmaster Tools', href: 'https://www.bing.com/webmasters' } },
      {
        title: 'Import from Search Console',
        body: 'Choose **Import your sites from Google Search Console**. It carries the verification across, so there is nothing to add to your DNS or your site.',
        note: 'Prefer not to connect the two? Add {{domain}} by hand instead and verify it the same way as in Search Console (a DNS record or a meta tag).',
      },
      { title: 'Submit your sitemap', body: 'Open **Sitemaps** and add `https://{{domain}}/sitemap.xml` if it is not already listed.' },
      { title: 'Give it a few days', body: 'Bing\'s link data starts arriving within a week or two, and the backlink check picks it up on its own from then on.' },
    ],
    done: '{{domain}} is listed in Bing Webmaster Tools, and the backlink source list stops saying Bing has nothing.',
    related: ['indexnow-key-file', 'search-console-links-export'],
    keywords: ['bing', 'webmaster', 'copilot', 'import'],
  },
  {
    id: 'fix-pack',
    area: 'website',
    title: 'Apply the fix pack from an audit',
    why: 'An audit lists what is wrong; the fix pack is the work already done (the files to upload and the snippets to paste), so the fixing is minutes rather than an afternoon.',
    where: 'Your website\'s files and CMS',
    minutes: 30,
    vars: [V.domain],
    steps: [
      { title: 'Download the fix pack', body: 'It is attached to the audit report as a zip: `robots.txt`, `llms.txt`, a list of redirects, structured-data snippets and `internal-links.csv`.' },
      {
        title: 'Upload robots.txt and llms.txt',
        body: 'Both belong at the root of {{domain}}. Compare `robots.txt` with the one you already have before replacing it: the pack keeps your rules and adds what was missing.',
        warn: 'Never upload a `robots.txt` you have not read. One wrong `Disallow:` line can take a site out of Google.',
      },
      { title: 'Add the redirects', body: 'Each line is an address that answers 404 and the page it should go to instead. Add them wherever your redirects live (the CMS, a plugin, your server config).' },
      { title: 'Paste the structured data', body: 'Each snippet is a `<script type="application/ld+json">` block for one page. Paste it into that page\'s head or your SEO plugin\'s schema field.' },
      { title: 'Add the internal links', body: '`internal-links.csv` names, per page, the link to add and the text to use. These are the cheapest ranking gains in the pack: existing pages pointing at the pages you want to rank.' },
      { title: 'Re-run the audit', body: 'The next audit compares itself with the last one and shows exactly what you fixed.' },
    ],
    done: 'The next audit\'s health score rises and the findings you fixed appear under "fixed since the last audit".',
    related: ['publish-page'],
    keywords: ['robots.txt', 'llms.txt', 'redirects', 'schema', 'internal links', 'audit'],
  },

  // ---------------------------------------------------------------- Your mailbox
  {
    id: 'mailbox-connect',
    area: 'mailbox',
    title: 'Connect the mailbox your pitches go out from',
    why: 'Link building is asking real people for a link. Those asks have to come from your own address so the replies reach you and the thread looks like what it is: a message from your company, not from a tool.',
    where: 'Company settings > Mailboxes',
    who: 'An admin of the company, using a real mailbox someone reads',
    minutes: 5,
    steps: [
      {
        title: 'Pick the mailbox',
        body: 'Use an address a person actually reads, on your own domain (`name@your-company.com`), not `info@` and not a free Gmail address. Replies, out-of-office notices and bounces all come back to it.',
      },
      {
        title: 'Choose how to connect it',
        body: 'Microsoft 365 and Gmail connect on their own sign-in screen with no password to store. Any other host connects with an app password.',
        choices: [
          { label: 'Microsoft 365', body: 'One click. You grant sending and reading the replies to your own pitches; nothing but a renewable permission is stored, and disconnecting withdraws it.' },
          { label: 'Gmail / Workspace', body: 'One click for sending. Google treats inbox access as a restricted scope, so replies are read by you in Gmail rather than shown here; the app says so before you connect.' },
          { label: 'Anything else', body: 'An app password plus your host\'s SMTP and IMAP servers. There is a guide for finding those.' },
        ],
      },
      {
        title: 'Fill in the signature and the postal address',
        body: 'Your name, job title, company and a real postal address. The address is not decoration: mail that asks a stranger for something needs an identifiable sender and a way to opt out.',
      },
      {
        title: 'Let it warm up',
        body: 'A new mailbox starts at five pitches a day and climbs to ten, then your limit. Sending is weekday-only, inside the window you set, four to nine minutes apart.',
        note: 'Every pitch waits for your approval unless you turn that off. Nothing is ever sent from an address we own.',
      },
    ],
    done: 'The mailbox shows as connected and tested, and drafted pitches can be approved and sent.',
    trouble: [
      { q: 'The test fails on connecting', a: 'Nine times out of ten the host wants an app password rather than the normal one, or the port is wrong. The guide for your provider has both.' },
      { q: 'Should I use a separate domain for outreach?', a: 'No. Pitches from a lookalike domain get ignored, and the whole point is that the person can see who you are.' },
    ],
    related: ['gmail-app-password', 'microsoft-app-password', 'smtp-imap-settings', 'email-authentication'],
    keywords: ['mailbox', 'outreach', 'smtp', 'imap', 'oauth'],
  },
  {
    id: 'gmail-app-password',
    area: 'mailbox',
    title: 'Create a Gmail app password',
    why: 'Gmail refuses a normal password from any outside program. An app password is a one-purpose password you can withdraw at any time without changing your own.',
    where: 'Your Google account',
    minutes: 5,
    steps: [
      {
        title: 'Turn on 2-Step Verification',
        body: 'App passwords only exist once 2-Step Verification is on. Open **Security** in your Google account and switch it on if it is not already.',
        link: { label: 'Open Google security settings', href: 'https://myaccount.google.com/security' },
      },
      {
        title: 'Create the app password',
        body: 'Open the app passwords page, name it `Alaventra` and create it.',
        link: { label: 'Open app passwords', href: 'https://myaccount.google.com/apppasswords' },
      },
      {
        title: 'Copy the 16 characters',
        body: 'Google shows it once. Copy it straight into the password box here; the spaces do not matter.',
        warn: 'If you lose it, you cannot look it up: delete that app password and make another.',
      },
      {
        title: 'Use Google\'s servers',
        body: 'The form fills these in for you; this is what they should say.',
        copy: [
          { label: 'SMTP (sending)', value: 'smtp.gmail.com' },
          { label: 'SMTP port', value: '465' },
          { label: 'IMAP (replies)', value: 'imap.gmail.com' },
          { label: 'IMAP port', value: '993' },
        ],
      },
    ],
    done: 'The mailbox saves with a green test: Alaventra signed in to both sending and reading.',
    trouble: [
      { q: 'The app passwords page says it is not available', a: 'Either 2-Step Verification is off, or a Workspace administrator has switched app passwords off for the organisation. In a Workspace, connecting Gmail with one click avoids the problem entirely.' },
      { q: 'Sign-in fails although the password is right', a: 'Check the address: an app password belongs to one Google account, and it must be the account whose mailbox you are connecting.' },
    ],
    related: ['mailbox-connect', 'email-authentication'],
    keywords: ['gmail', 'app password', '2fa', 'workspace'],
  },
  {
    id: 'microsoft-app-password',
    area: 'mailbox',
    title: 'Connect a Microsoft 365 or Outlook mailbox with a password',
    why: 'Microsoft turns password-based sending off for new mailboxes, so this one needs two things to be true: the mailbox is allowed to send with a password, and you have an app password for it.',
    where: 'Microsoft 365',
    who: 'You, plus a Microsoft 365 administrator for the first step',
    minutes: 10,
    steps: [
      {
        title: 'Let the mailbox send with a password',
        body: 'An administrator opens the **Microsoft 365 admin center > Users > Active users**, picks the person, then **Mail > Manage email apps**, and ticks **Authenticated SMTP**.',
        link: { label: 'Open the Microsoft 365 admin center', href: 'https://admin.microsoft.com' },
        warn: 'Microsoft is retiring password-based SMTP. The dates have moved before and may move again. The one-click Microsoft 365 connection does not depend on it.',
      },
      {
        title: 'Create an app password',
        body: 'With multi-factor sign-in on the account, open **Security info** and add an **App password**. Copy it: it is shown once.',
        link: { label: 'Open Microsoft security info', href: 'https://mysignins.microsoft.com/security-info' },
        note: 'No **App password** option means the administrator has disabled them. Connect with one click instead.',
      },
      {
        title: 'Use Microsoft\'s servers',
        body: 'Port 587 with STARTTLS for sending, tick nothing for "SSL from the start".',
        copy: [
          { label: 'SMTP (sending)', value: 'smtp.office365.com' },
          { label: 'SMTP port', value: '587' },
          { label: 'IMAP (replies)', value: 'outlook.office365.com' },
          { label: 'IMAP port', value: '993' },
        ],
      },
    ],
    done: 'The mailbox saves with a green test, and the sender starts at five pitches a day.',
    trouble: [
      { q: 'The test says authentication is unsuccessful', a: 'Authenticated SMTP is still off for that mailbox, or the change has not reached the server yet (it can take up to an hour). Ask your administrator to confirm the tick.' },
      { q: 'Our policy forbids app passwords', a: 'Then use the one-click Microsoft 365 connection: it stores a permission instead of a password and can be withdrawn at any time.' },
    ],
    related: ['mailbox-connect', 'email-authentication'],
    keywords: ['microsoft', 'office 365', 'outlook', 'smtp auth', 'app password'],
  },
  {
    id: 'smtp-imap-settings',
    area: 'mailbox',
    title: 'Find the SMTP and IMAP settings for any mail host',
    why: 'Sending needs SMTP, reading the replies needs IMAP. Every host publishes both; they are rarely where you expect.',
    where: 'Your mail host',
    minutes: 10,
    steps: [
      {
        title: 'Look them up',
        body: 'Search for your host\'s name plus `SMTP IMAP settings`, or open your webmail\'s settings and look for **POP/IMAP**, **External access** or **Mail clients**. Your hosting panel usually shows them next to the mailbox.',
      },
      {
        title: 'Note the four values',
        body: 'The sending server and its port, the reading server and its port. Common pairs: `smtp.your-host.com` on **465** with SSL from the start, or on **587** with STARTTLS; `imap.your-host.com` on **993**.',
        note: 'Port 465 means "SSL from the start", so tick it. Port 587 means STARTTLS, leave it unticked.',
      },
      {
        title: 'Check the user name',
        body: 'Most hosts want the whole address as the user name. Some want only the part before the @. The form has a separate box for this when they differ.',
      },
      {
        title: 'Use an app password where the host offers one',
        body: 'Anywhere with two-factor sign-in (Zoho, Fastmail, Yahoo, iCloud), a normal password is refused. Create an app password in the account\'s security settings.',
      },
    ],
    done: 'The connection test passes for both sending and reading.',
    trouble: [
      { q: 'Sending works, reading does not', a: 'IMAP is often switched off by default. Turn it on in the mailbox\'s settings. Without it, replies cannot stop a sequence.' },
      { q: 'The host blocks outside programs entirely', a: 'Some providers only allow their own apps. You will need a mailbox elsewhere on the same domain.' },
    ],
    related: ['mailbox-connect', 'email-authentication'],
    keywords: ['smtp', 'imap', 'port', 'ssl', 'starttls'],
  },
  {
    id: 'email-authentication',
    area: 'mailbox',
    title: 'Check your domain is allowed to send mail (SPF, DKIM, DMARC)',
    why: 'Three DNS records decide whether a stranger\'s mail server believes your message is really from you. Without them, good pitches quietly land in spam and you never know.',
    where: 'Your DNS provider',
    who: 'Whoever manages DNS',
    minutes: 20,
    vars: [V.domain],
    steps: [
      {
        title: 'See what you have',
        body: 'Alaventra checks all three when a mailbox is connected and shows what it found. To check yourself, look up {{domain}} on [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) with `spf:{{domain}}`, `dmarc:{{domain}}` and the DKIM selector your host gives you.',
      },
      {
        title: 'SPF: who may send for you',
        body: 'One TXT record on {{domain}} listing your mail host, for example `v=spf1 include:_spf.google.com ~all` for Workspace or `include:spf.protection.outlook.com` for Microsoft 365.',
        warn: 'A domain must have exactly one SPF record. If one exists, add the new `include:` to it, never add a second record.',
      },
      {
        title: 'DKIM: the signature',
        body: 'Your mail host generates it and tells you which records to add. In Google Workspace it is **Apps > Google Workspace > Gmail > Authenticate email**; in Microsoft 365 it is **Defender > Policies > Email authentication > DKIM**.',
      },
      {
        title: 'DMARC: what to do with the rest',
        body: 'A TXT record at `_dmarc.{{domain}}`. Start gently with `v=DMARC1; p=none; rua=mailto:you@{{domain}}`, read the reports for a few weeks, then tighten it.',
        note: 'Already on `p=reject`? Good. Just make sure the mailbox you connect sends through a host your SPF and DKIM cover.',
      },
    ],
    done: 'The mailbox panel shows SPF, DKIM and DMARC as found, and pitches stop landing in spam.',
    trouble: [
      { q: 'We send from several tools', a: 'They all belong in the one SPF record, as separate `include:` entries. Ten is the hard limit on lookups.' },
      { q: 'Changes do not show up', a: 'DNS caches. Wait an hour and check again, and clear the lookup tool\'s cache if it has one.' },
    ],
    related: ['mailbox-connect', 'dns-txt-record'],
    keywords: ['spf', 'dkim', 'dmarc', 'spam', 'deliverability'],
  },

  // ---------------------------------------------------------------- About your business
  {
    id: 'business-profile',
    area: 'business',
    title: 'Fill in your business profile',
    why: 'Google and the AI assistants both ask the same question about a page: who wrote this, and why should anyone believe them. The profile answers it once (a real byline, an author box, an expert reviewer, your address and schema) on every page that follows.',
    where: 'Website settings > Business profile',
    who: 'Someone who knows who at your company should be the public expert',
    minutes: 20,
    steps: [
      {
        title: 'Choose a real author',
        body: 'One person at your company who genuinely knows the subject, and who is willing to have their name on it. A founder, the head of the practice, a senior consultant. Not "the team", not a made-up persona.',
        warn: 'Inventing an author is the one thing in here that can actively hurt you. Google\'s guidance and every AI fact check look for a person who exists elsewhere on the web.',
      },
      {
        title: 'Write the credentials, not the adjectives',
        body: 'The credentials box is for checkable experience: "12 years in VAT compliance, led 40 ERP rollouts, chartered accountant". The pages draw on it when they explain why an answer is trustworthy.',
      },
      {
        title: 'Point the byline at a real page',
        body: 'An author page on your own site, plus a LinkedIn profile under profile links. That pairing is what lets Google connect the byline to a person it already knows about.',
        note: 'No author page yet? A short page with the same bio, photo and links is an hour of work and lifts every article you publish afterwards.',
      },
      {
        title: 'Add an expert reviewer where it matters',
        body: 'In regulated or technical subjects (tax, law, health, finance, security), a named reviewer carries real weight. Each page then says who checked it, in words and in its structured data.',
      },
      {
        title: 'Get the address exactly right',
        body: 'Name, address and phone must match your website, your Google Business Profile and your invoices, character for character. Mismatched details are a classic reason a local business does not rank where it should.',
      },
      {
        title: 'Watch the readiness score',
        body: 'The panel next to the form lists every trust signal and what it is used for. Over 70% is a profile that carries a page on its own.',
      },
    ],
    done: 'Readiness is comfortably above 70%, and the next page written carries a byline, an author box and the right schema instead of placeholders.',
    trouble: [
      { q: 'We would rather not name anyone', a: 'Then pages are published under the company alone. It works, but it is measurably weaker on exactly the subjects where trust decides the ranking, and AI fact checks have nothing to confirm.' },
      { q: 'Different people write about different things', a: 'Fill in the one who covers most of what you publish. Several authors per website is on the roadmap; until then the byline can be changed per page when you publish.' },
    ],
    related: ['business-facts', 'style-guide'],
    keywords: ['eeat', 'author', 'byline', 'reviewer', 'nap', 'schema', 'profile'],
  },
  {
    id: 'business-facts',
    area: 'business',
    title: 'Write business facts a page can actually cite',
    why: 'Every number in a published page has to come from somewhere. These facts are that somewhere, and anything a page cannot source gets marked for you to confirm instead of being quietly invented.',
    where: 'Website settings > Business',
    minutes: 15,
    steps: [
      {
        title: 'List what is checkably true',
        body: 'Years in business, number of clients, certifications and accreditations, published prices, guarantees, offices, languages, awards, named integrations. One short line each.',
      },
      {
        title: 'Keep each one verifiable',
        body: 'A fact that is on your website, in a contract or on a certificate is usable. "Market-leading" is not a fact and will never appear in a page.',
      },
      {
        title: 'Include the numbers you want quoted',
        body: 'If you want "trusted by 120 finance teams in the UAE" to appear, write it here. If it is not here, the page says something vaguer or nothing at all.',
        note: 'Prices and legal thresholds are treated carefully: an amount the facts do not carry is published as "[Confirm: ...]" rather than as a number.',
      },
      {
        title: 'Keep it current',
        body: 'Revisit it when a certification renews or a client count changes. Pages written afterwards use the new version; the old pages keep what was true when they were written.',
      },
    ],
    done: 'The next draft quotes your own facts with no bracketed placeholders left in the body.',
    related: ['business-profile', 'style-guide'],
    keywords: ['facts', 'claims', 'proof', 'numbers', 'citations'],
  },
  {
    id: 'style-guide',
    area: 'business',
    title: 'Set your style guide',
    why: 'It is the difference between pages that read like your company and pages that read like software. Written once, applied to every draft and checked again before you see it.',
    where: 'Website settings > Business profile',
    minutes: 10,
    steps: [
      {
        title: 'Write your name exactly as it is written',
        body: 'Capitals, ampersands, spacing: `Northwind & Co`, not "Northwind and Co" and not "northwindco". Titles, meta descriptions and body text all follow it, and a draft that gets your own name wrong is a real quality finding.',
      },
      {
        title: 'Add the wrong spellings you keep seeing',
        body: 'The forms other people use for you. They are caught and corrected before the draft reaches you.',
        note: 'Your name inside a link, a slug or an e-mail address is left alone, and an ordinary sentence that happens to contain the same words is not treated as your name.',
      },
      { title: 'Choose British or American spelling', body: 'Your choice wins over the country a page targets. Leave it on "follow the market" and each page uses the spelling of the country it is written for.' },
      {
        title: 'Ban the words you never want to read',
        body: 'Hype words, a competitor\'s trademark, internal jargon. They are counted and listed in the quality check rather than silently rewritten.',
      },
      { title: 'Say how you want to sound', body: 'One line such as "plain, direct, no hype; we explain the rule before the product" does more than a page of adjectives. Exclamation marks are counted when your tone says no hype.' },
    ],
    done: 'The quality check on the next page reports the style check as passed, or names exactly what it changed.',
    related: ['business-profile', 'business-facts'],
    keywords: ['style', 'tone', 'brand name', 'spelling', 'voice'],
  },
  {
    id: 'competitors',
    area: 'business',
    title: 'Choose the right competitors',
    why: 'Competitors decide the link gap, the share of voice in AI answers and half of what a full report compares you against. The wrong three make all of it useless.',
    where: 'Website settings',
    minutes: 10,
    vars: [V.domain],
    steps: [
      {
        title: 'Search the way your buyer searches',
        body: 'Type two or three of the searches you want {{domain}} to win into Google, from your own country, and write down who keeps coming back on page one. That list beats any list from memory.',
      },
      {
        title: 'Keep the ones that are genuinely like you',
        body: 'They sell what you sell, to the people you sell to, in the same country or language, at roughly your size. Those are the sites whose links you can realistically win too.',
      },
      {
        title: 'Leave out the ones that only look like competitors',
        body: 'Marketplaces, directories, review sites and Wikipedia rank for everything and compete with nobody. A giant twenty times your size makes every gap look hopeless and hides the real ones.',
        warn: 'Use the bare domain, `competitor.com`, not a long URL with https:// and a path.',
      },
      { title: 'Stay at three', body: 'Three is what the reports compare. More dilutes every number and uses more credits to check.' },
    ],
    done: 'The link gap and the AI share of voice start naming sites you recognise as rivals.',
    related: ['brand-names', 'keywords-to-track'],
    keywords: ['competitors', 'share of voice', 'link gap', 'benchmark'],
  },
  {
    id: 'brand-names',
    area: 'business',
    title: 'Tell the AI monitor what your company is called',
    why: 'The monitor reads AI answers looking for you. A short name is the problem: "northwind" matches a dozen unrelated companies, and the result is either credit you did not earn or a miss nobody notices.',
    where: 'Website settings > Monitors',
    minutes: 5,
    vars: [V.domain],
    steps: [
      {
        title: 'Write the full legal and trading names',
        body: 'The way an AI assistant would write them in a sentence ("Acme Tax Technologies", "Acme Tax LLC"), rather than the label in front of {{domain}} on its own.',
      },
      { title: 'Add the forms people really use', body: 'Abbreviations, the old name after a rebrand, the name with and without the legal suffix, the product name if it is better known than the company.' },
      {
        title: 'Leave out anything generic',
        body: 'A word that could describe any company in your market will match answers that are not about you, and your visibility score will be wrong in the flattering direction.',
      },
      { title: 'Check the next AI report', body: 'Each answer shows which names matched. A name that keeps matching the wrong company belongs out of the list.' },
    ],
    done: 'Mentions in the AI reports are yours, and the share of voice stops jumping between runs.',
    related: ['competitors'],
    keywords: ['brand', 'mentions', 'ai visibility', 'name'],
  },
  // G6 (2026-10-18): the AI question panel at scale, who asks, where, and a question list you already have
  {
    id: 'ai-buyer-roles',
    area: 'business',
    title: 'Choose the buyer roles your AI questions speak for',
    why: 'A CFO and an IT manager ask an assistant different questions about the same product, and AI names different companies to each. Writing the panel per role shows where you are visible to the people who decide, and where you are not.',
    where: 'Website settings > Tracking & monitors > AI visibility',
    minutes: 10,
    vars: [V.domain],
    steps: [
      { title: 'List who signs off a purchase', body: 'The two to four people involved when a company buys what {{domain}} sells: the one who pays (**CFO**, **Finance manager**), the one who runs it (**IT manager**, **Operations lead**), the one who decides (**Founder**, **Managing director**).' },
      { title: 'Use the words they use for themselves', body: 'Job titles as they appear on LinkedIn in your market, one to three words each (`CFO`, `Finance manager`, `IT manager`). At most six.' },
      { title: 'Type them under Buyer roles', body: 'One per entry. The next weekly run writes its new questions for each role in turn; questions you already track keep the role they have (edit them in **Your question panel** on the AI visibility page).' },
      { title: 'Read the result by role', body: 'After the run, the AI visibility page groups the answers **By buyer role**, each with its range. A role with too few answers for a rate needs more questions: raise the panel size.' },
    ],
    done: 'The AI visibility page shows a row per buyer role, and the question panel can be filtered by role.',
    related: ['ai-markets', 'ai-panel-import', 'brand-names'],
    keywords: ['persona', 'buyer', 'role', 'ai visibility', 'questions', 'panel'],
  },
  {
    id: 'ai-markets',
    area: 'business',
    title: 'Ask the AI questions in your other markets',
    why: 'AI answers depend on where the buyer is: the same question asked from Riyadh and from Dubai names different companies. Each market you add is asked from that country, in its language.',
    where: 'Website settings > Tracking & monitors > AI visibility',
    minutes: 5,
    steps: [
      { title: 'Write each market as a country and a language', body: 'The two-letter country code, a dash, the two-letter language: `SA-en` (Saudi Arabia, English), `AE-ar` (the UAE, Arabic), `GB-en` (the United Kingdom). Your own market is always included.' },
      { title: 'Add at most five', body: 'Type them under **Other markets**. Every market gets its share of the panel, so more markets with the same panel size means fewer questions per market, so raise the panel size with them.' },
      { title: 'Check the questions it writes', body: 'The next weekly run writes questions for each market in that language. Find them in **Your question panel** with the Market filter, and switch off any that do not fit.' },
    ],
    done: 'The AI visibility page shows a row per market, and the market filter of the question panel lists them.',
    trouble: [{ q: 'A market is not accepted', a: 'Use the form country-language with two letters each (e.g. `QA-en`); a city or a region is not a market.' }],
    related: ['ai-buyer-roles', 'ai-panel-import'],
    keywords: ['market', 'country', 'language', 'locale', 'ai visibility', 'international'],
  },
  {
    id: 'ai-panel-import',
    area: 'business',
    title: 'Import your own AI question list',
    why: 'If your team already knows what buyers ask (from sales calls, support tickets or another tool), import the list instead of typing it. Every question is asked weekly on every engine you track.',
    where: 'AI visibility > Your question panel > Import a question list',
    minutes: 10,
    steps: [
      { title: 'Put one question per row in a spreadsheet', body: 'Write each one the way a buyer would ask an assistant, 10 to 300 characters. Up to 500 rows a file.' },
      { title: 'Add the columns you want', body: 'The first row names the columns, in any order: **question** (required), **buyer role**, **cluster** (the topic), **stage** (`awareness`, `consideration` or `decision`), **market** (`SA-en`), **pinned** (`yes` to ask it first and keep it when the panel is made smaller).', copy: [{ label: 'The header row', value: 'question,buyer role,cluster,stage,market,pinned', hint: 'Paste into the first row of the sheet' }] },
      { title: 'Save it as CSV', body: 'In Excel or Google Sheets: **File > Download / Save as > CSV**. A semicolon or tab separated file works too.' },
      { title: 'Import it', body: 'On the AI visibility page, **Choose a file**. The app shows how many questions are ready and names every line with a problem before anything is saved; then **Import**.' },
    ],
    done: 'The imported questions appear in the panel marked "You", and the next weekly run asks them.',
    trouble: [
      { q: 'Some lines were refused', a: 'Each refused line says why (too short, a stage that is not one of the three, a market not written as country-language). Fix those cells and import the file again: questions already imported are not duplicated.' },
      { q: 'The panel did not grow', a: 'The panel size in Website settings is the most questions tracked. Raise it, or switch off questions you no longer need.' },
    ],
    related: ['ai-buyer-roles', 'ai-markets'],
    keywords: ['csv', 'import', 'questions', 'prompts', 'upload', 'spreadsheet', 'ai visibility'],
  },
  {
    id: 'keywords-to-track',
    area: 'business',
    title: 'Choose the keywords to track',
    why: 'These are the searches whose positions are checked every week. Picking the ones that lead to money, rather than the ones with the biggest numbers, is what makes the rank report worth reading.',
    where: 'Website settings > Tracking',
    minutes: 15,
    vars: [V.domain],
    steps: [
      {
        title: 'Start with what you sell',
        body: 'Write down what someone types when they want exactly what you offer, in their words rather than yours. Five to twenty of those is a good start.',
      },
      {
        title: 'Add the searches you nearly win',
        body: 'Search Console shows searches where you sit at positions 11 to 20 (one page from the first). Those move fastest and are already in the dashboard once tracking runs.',
      },
      {
        title: 'Mix short and long',
        body: 'Two or three head terms for the market you are in, and longer, more specific phrases for the pages that actually convert. Long phrases are cheaper to win and bring better visitors.',
      },
      {
        title: 'One country per website',
        body: 'Positions are checked in the country set for {{domain}}. If you sell in two countries properly, they belong in two websites.',
      },
      { title: 'Review it each quarter', body: 'Drop what you have held at number one for months, add what the content has started to earn impressions for.' },
    ],
    done: 'The rankings page fills with searches you would actually like to win, and the weekly report shows their movement.',
    related: ['competitors'],
    keywords: ['keywords', 'tracking', 'rank', 'striking distance'],
  },

  // ---------------------------------------------------------------- Your company here
  {
    id: 'budget',
    area: 'company',
    title: 'Credits: see them, limit them, top them up',
    why: 'Everything Alaventra does is paid in credits from one balance: the automatic work each website gets every week and the analyses your team starts. Knowing where they go, and setting limits, means the work never stops by surprise.',
    where: 'Company settings > Credits',
    who: 'Anyone can look; the owner sets the limits; an owner or admin buys packs',
    minutes: 5,
    steps: [
      {
        title: 'See what you have and where it goes',
        body: 'The **Credits** page shows the balance, what running analyses are holding, how long the credits will last at your pace, and this month\'s use split between **autopilot** (the websites\' schedules) and **on-demand** (analyses people start). Each website shows what its automatic work will use a month.',
      },
      {
        title: 'Know how an analysis is charged',
        body: 'Every form shows its price in credits before you start. That price is held while it runs; when it finishes it is charged what it really used, **never more**. An analysis that fails is free.',
      },
      {
        title: 'Set your limits',
        body: 'Under **Limits**, set a monthly limit for **on-demand** analyses and another for **autopilot**. Leave **Keep credits for autopilot** on so a busy week of analyses cannot use the credits the websites\' schedules need for the rest of the month.',
      },
      {
        title: 'Buy a pack before you run low',
        body: 'Press **Buy credits** and pick a pack. The Alaventra team confirms the request and sends the invoice; the credits are added for 12 months. You can cancel a request while it is waiting.',
        note: 'Credits are used soonest-expiring first: welcome credits, then a plan\'s monthly credits (they roll over one month), then packs.',
      },
      {
        title: 'Know what happens at zero',
        body: 'New analyses are refused with the reason, and each website\'s automatic work pauses. It resumes by itself as soon as credits are added or a new month starts. Owners and admins get an e-mail when credits run low, run out and when the work resumes.',
      },
    ],
    done: 'The Credits page shows a runway that covers the month, with your limits set and the autopilot forecast for every website fitting inside them.',
    trouble: [
      {
        q: 'An analysis was refused although there are credits left',
        a: 'Part of the balance is kept for the websites\' automatic work this month, or the on-demand limit is reached. The message names which; raise the limit, add credits or switch **Keep credits for autopilot** off.',
      },
    ],
    related: ['invite-team'],
    keywords: ['credits', 'balance', 'budget', 'cost', 'price', 'spend', 'usage', 'limit', 'pack', 'top up', 'buy'],
  },
  {
    id: 'invite-team',
    area: 'company',
    title: 'Invite your team',
    why: 'Most of the setup needs someone else: the person with DNS, the person who edits the website, the expert whose name goes on the pages. Inviting them beats forwarding screenshots.',
    where: 'Company settings > Team',
    who: 'An admin or the owner',
    minutes: 3,
    steps: [
      {
        title: 'Pick the right role',
        body: '**Viewer** reads dashboards and reports. **Member** can also start analyses. **Admin** manages websites, settings and the team. **Owner** additionally sets the credit limits and can delete the company.',
      },
      { title: 'Send the invitation', body: 'Enter the address and the role. They get a link that joins them straight to this company.' },
      {
        title: 'Or send them a single guide',
        body: 'For a one-off job (adding a DNS record, say), every guide here has **Send to a colleague**, which puts the whole thing in an e-mail with your values already filled in. No account needed.',
      },
    ],
    done: 'The team list shows them as a member, and work that needed them stops waiting.',
    related: ['budget'],
    keywords: ['team', 'invite', 'roles', 'permissions', 'colleague'],
  },
  // ---------------------------------------------------------------- Integrations (G4, app/docs/INTEGRATIONS.md)
  {
    id: 'slack-webhook',
    area: 'integrations',
    title: 'Send alerts to a Slack channel',
    why: 'Alerts, failed analyses and finished reports land in the channel your team already reads, instead of waiting for someone to open Alaventra. One address per channel, so alerts and wins can go to different places.',
    where: 'Slack (api.slack.com) and Company settings > Integrations',
    who: 'Someone allowed to add apps to your Slack workspace',
    minutes: 5,
    steps: [
      {
        title: 'Create a small Slack app',
        body: 'Open **Your Apps**, press **Create New App** > **From scratch**, name it `Alaventra` and pick your workspace. It needs no other setting.',
        link: { label: 'Open Slack apps', href: 'https://api.slack.com/apps' },
      },
      {
        title: 'Switch on incoming webhooks',
        body: 'In the app, open **Incoming Webhooks**, turn **Activate Incoming Webhooks** on, then press **Add New Webhook to Workspace** and choose the channel, e.g. `#seo-alerts`.',
        note: 'Repeat this step for a second channel (e.g. `#seo-wins`): each channel gets its own address.',
      },
      {
        title: 'Copy the address',
        body: 'Slack shows an address starting with `https://hooks.slack.com/services/`. Copy it. Treat it like a password: anyone with it can post in that channel.',
      },
      {
        title: 'Add it in Alaventra',
        body: 'In **Company settings > Integrations > Alerts and events**, press **Add an endpoint**, choose **Slack channel**, paste the address, pick the events, and press **Test**.',
      },
    ],
    done: 'The test message appears in the channel within a few seconds.',
    trouble: [
      { q: 'The test says 404 no_service or 410', a: 'The webhook was removed or the app uninstalled. Add a new webhook to the channel and paste the new address.' },
      { q: 'Nothing arrives, no error', a: 'Check the channel the webhook was created for: Slack posts only there, whatever the message says.' },
    ],
    related: ['teams-workflow-webhook', 'webhook-signature'],
    keywords: ['slack', 'alerts', 'channel', 'notifications', 'incoming webhook'],
  },
  {
    id: 'teams-workflow-webhook',
    area: 'integrations',
    title: 'Send alerts to a Microsoft Teams channel',
    why: 'Alerts, failed analyses and finished reports appear as cards in a Teams channel. Microsoft retired the old Office 365 connectors in favour of Workflows; this sets up the Workflows way.',
    where: 'Microsoft Teams (Workflows) and Company settings > Integrations',
    who: 'A member of the Teams channel who may create workflows',
    minutes: 6,
    steps: [
      {
        title: 'Open Workflows on the channel',
        body: 'In Teams, open the channel, press the **...** next to its name and choose **Workflows**.',
      },
      {
        title: 'Use the webhook template',
        body: 'Pick **Post to a channel when a webhook request is received**, give it a name such as `Alaventra`, confirm the team and channel, and press **Add workflow**.',
        link: { label: 'Microsoft\'s instructions', href: 'https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498' },
      },
      {
        title: 'Copy the address',
        body: 'Teams shows an address ending in `logic.azure.com` or `powerplatform.com`. Copy it and keep it private: it lets anyone post in the channel.',
      },
      {
        title: 'Add it in Alaventra',
        body: 'In **Company settings > Integrations > Alerts and events**, press **Add an endpoint**, choose **Microsoft Teams channel**, paste the address, pick the events, and press **Test**.',
      },
    ],
    done: 'A card titled "Test event" appears in the channel.',
    trouble: [{ q: 'The test is refused as not a Teams address', a: 'Older connector addresses (webhook.office.com) still work; anything else must be the Workflows address Teams showed you.' }],
    related: ['slack-webhook'],
    keywords: ['teams', 'microsoft', 'workflows', 'power automate', 'alerts'],
  },
  {
    id: 'webhook-signature',
    area: 'integrations',
    title: 'Receive events in your own system',
    why: 'A signed JSON message for every event (finished runs, alerts, new audit findings, ranking moves), so your own tools (Zapier, Make or n8n) can act on it. The signature proves the message came from Alaventra.',
    where: 'Your own system, then Company settings > Integrations',
    who: 'A developer, or whoever runs your automation tool',
    minutes: 15,
    steps: [
      {
        title: 'Get an https address that accepts a POST',
        body: 'Your own endpoint, or a catch hook in Zapier, Make or n8n. It must be https and reachable from the internet.',
      },
      {
        title: 'Add it as Signed JSON',
        body: 'In **Company settings > Integrations > Alerts and events**, add an endpoint with **Signed JSON**. Copy the `whsec_` secret it shows: it is shown once.',
      },
      {
        title: 'Check the signature',
        body: 'Compute HMAC-SHA256 with the secret over the timestamp header, a dot, and the raw body, and compare it with the signature header. Refuse anything older than five minutes.',
        copy: [
          { label: 'Headers to read', value: 'X-Alaventra-Signature, X-Alaventra-Timestamp, X-Alaventra-Event, X-Alaventra-Delivery' },
          { label: 'What is signed', value: '<X-Alaventra-Timestamp>.<raw body>', hint: 'sha256=<hex> in X-Alaventra-Signature' },
        ],
      },
      {
        title: 'Answer quickly, de-duplicate on the delivery id',
        body: 'Answer with any 2xx within 10 seconds and do the work afterwards. A retried event keeps its `X-Alaventra-Delivery` id, so you can ignore one you have already handled.',
      },
    ],
    done: '**Test** shows "delivered" and your system logged one message with a valid signature.',
    related: ['slack-webhook', 'mcp-assistant'],
    keywords: ['webhook', 'hmac', 'signature', 'zapier', 'make', 'n8n', 'json', 'events'],
  },
  {
    id: 'jira-api-token',
    area: 'integrations',
    title: 'Connect Jira Cloud',
    why: 'Each audit finding or recommendation can become one Jira ticket, with the evidence, the example pages and the fix written in, and its state shows back beside the finding.',
    where: 'Atlassian account settings and Company settings > Integrations',
    who: 'A Jira user who can create issues in the project',
    minutes: 5,
    steps: [
      {
        title: 'Create an API token',
        body: 'Signed in as the person tickets should be created by, open **API tokens**, press **Create API token**, name it `Alaventra` and copy it.',
        link: { label: 'Open Atlassian API tokens', href: 'https://id.atlassian.com/manage-profile/security/api-tokens' },
        warn: 'The token acts as that person. Use an account that should be the reporter of SEO tickets, not a personal admin account.',
      },
      {
        title: 'Find the project key and issue type',
        body: 'The project key is the letters before every ticket number (e.g. `SEO` in SEO-12). The issue type is how the project names its work items: `Task`, `Bug` or `Story`.',
      },
      {
        title: 'Connect it in Alaventra',
        body: 'In **Company settings > Integrations > Issue trackers**, press **Connect** beside Jira Cloud and fill in your Jira address (like `https://your-company.atlassian.net`), the account e-mail, the token, the key and the type.',
      },
      {
        title: 'Create a first ticket',
        body: 'Open the **Technical** page of a website and press **Create ticket** beside a finding. The ticket key appears there with its status.',
      },
    ],
    done: 'Jira Cloud shows "Connected", and the first ticket opens in Jira with the evidence and the fix.',
    trouble: [
      { q: 'It says the project has no such issue type', a: 'The message lists the types the project has. Type one of them exactly.' },
      { q: 'It says the token was refused', a: 'Tokens can expire or be revoked. Create a new one and use **Replace**.' },
    ],
    related: ['linear-api-key', 'asana-pat'],
    keywords: ['jira', 'atlassian', 'ticket', 'issue', 'api token'],
  },
  {
    id: 'linear-api-key',
    area: 'integrations',
    title: 'Connect Linear',
    why: 'Each audit finding or recommendation can become one Linear issue in your team, written in Markdown with the evidence and the fix, and its state shows back in Alaventra.',
    where: 'Linear settings and Company settings > Integrations',
    who: 'A member of the Linear team',
    minutes: 3,
    steps: [
      {
        title: 'Create a personal API key',
        body: 'In Linear open **Settings > Account > Security & access**, then **Personal API keys** > **New API key**, name it `Alaventra` and copy it. It starts with `lin_api_`.',
        link: { label: 'Open Linear settings', href: 'https://linear.app/settings/account/security' },
      },
      {
        title: 'Note the team key',
        body: 'The letters before every issue number in the team, e.g. `WEB` in WEB-7.',
      },
      {
        title: 'Connect it in Alaventra',
        body: 'In **Company settings > Integrations > Issue trackers**, press **Connect** beside Linear, paste the key and the team key.',
      },
    ],
    done: 'Linear shows "Connected" with the team\'s name.',
    related: ['jira-api-token', 'asana-pat'],
    keywords: ['linear', 'issue', 'ticket', 'api key'],
  },
  {
    id: 'asana-pat',
    area: 'integrations',
    title: 'Connect Asana',
    why: 'Each audit finding or recommendation can become one Asana task in a project, with the evidence and the fix in its description, and its completion shows back in Alaventra.',
    where: 'Asana developer console and Company settings > Integrations',
    who: 'A member of the Asana project',
    minutes: 4,
    steps: [
      {
        title: 'Create a personal access token',
        body: 'Open the **Developer console**, press **Create new token**, name it `Alaventra`, accept the terms and copy the token.',
        link: { label: 'Open the Asana developer console', href: 'https://app.asana.com/0/my-apps' },
      },
      {
        title: 'Find the project id',
        body: 'Open the project in Asana: its address looks like `app.asana.com/0/1201234567890123/list`. The long number is the project id.',
      },
      {
        title: 'Connect it in Alaventra',
        body: 'In **Company settings > Integrations > Issue trackers**, press **Connect** beside Asana and paste the token and the project id.',
      },
    ],
    done: 'Asana shows "Connected" with the project\'s name.',
    related: ['jira-api-token', 'linear-api-key'],
    keywords: ['asana', 'task', 'pat', 'personal access token'],
  },
  {
    id: 's3-access-keys',
    area: 'integrations',
    title: 'Export to S3, Google Cloud Storage or Cloudflare R2',
    why: 'Your rankings, Search Console and GA4 figures, audit findings, AI visibility, backlinks and analyses land as files in your own bucket every day or week, ready for Snowflake, Redshift, Databricks or any BI tool.',
    where: 'Your cloud console and Company settings > Integrations',
    who: 'Someone who manages your cloud storage',
    minutes: 15,
    steps: [
      {
        title: 'Create a bucket (or pick one)',
        body: 'A private bucket used only for these exports is simplest. Alaventra writes under one folder and never reads or deletes anything.',
      },
      {
        title: 'Create keys that can only write there',
        body: 'Alaventra needs permission to put objects in that bucket and nothing else.',
        choices: [
          {
            label: 'Amazon S3',
            body: 'In IAM create a user with an access key and a policy allowing `s3:PutObject` on `arn:aws:s3:::<bucket>/*` only. Copy the access key id and the secret access key.',
            link: { label: 'AWS: create an access key', href: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html' },
          },
          {
            label: 'Google Cloud Storage',
            body: 'Give a service account **Storage Object Creator** on the bucket, then under **Cloud Storage > Settings > Interoperability** create an **HMAC key** for it. Copy the access key and the secret.',
            link: { label: 'Google: HMAC keys', href: 'https://cloud.google.com/storage/docs/authentication/managing-hmackeys' },
          },
          {
            label: 'Cloudflare R2',
            body: 'In **R2 > Manage API tokens** create a token with **Object Read & Write** limited to the bucket. Copy the access key id, the secret access key and your account id.',
            link: { label: 'Cloudflare: R2 API tokens', href: 'https://developers.cloudflare.com/r2/api/tokens/' },
          },
        ],
      },
      {
        title: 'Add the destination in Alaventra',
        body: 'In **Company settings > Integrations > Data export**, press **Add a destination**, choose the storage, the bucket, a folder, NDJSON or CSV, the tables and the schedule, and paste the keys. Alaventra writes one small test file before saving.',
      },
      {
        title: 'Read the newest folder',
        body: 'Files arrive as `<folder>/<table>/dt=<date>/<table>-<run>.ndjson`. Each run is a full copy, so your queries read the newest `dt` folder.',
      },
    ],
    done: '**Run now** shows "Done" with the rows of each table, and the files are in the bucket.',
    trouble: [{ q: 'It says AccessDenied', a: 'The key may not write to that bucket or folder. Check the policy names the bucket and allows putting objects.' }],
    related: ['bigquery-service-account', 'looker-studio-connector'],
    keywords: ['s3', 'aws', 'gcs', 'google cloud storage', 'r2', 'cloudflare', 'export', 'warehouse', 'snowflake', 'redshift'],
  },
  {
    id: 'bigquery-service-account',
    area: 'integrations',
    title: 'Export to BigQuery',
    why: 'Six tables (rankings, weekly Search Console and GA4 figures, audit findings, AI visibility, backlinks and the analyses you ran) are loaded into your own BigQuery dataset on a schedule, with a documented schema.',
    where: 'Google Cloud console and Company settings > Integrations',
    who: 'Someone with IAM rights in your Google Cloud project',
    minutes: 15,
    steps: [
      {
        title: 'Create a dataset',
        body: 'In BigQuery, create a dataset such as `seo` in the location you want (US or EU). Alaventra creates its tables inside it.',
        link: { label: 'Open BigQuery', href: 'https://console.cloud.google.com/bigquery' },
      },
      {
        title: 'Create a service account for Alaventra',
        body: 'In **IAM & Admin > Service accounts**, create one named `alaventra-export`. Give it **BigQuery Job User** on the project and **BigQuery Data Editor** on the dataset only.',
        link: { label: 'Open service accounts', href: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },
      },
      {
        title: 'Download its JSON key',
        body: 'Open the service account > **Keys > Add key > Create new key > JSON**. A file downloads. Keep it private; you will paste it once.',
        warn: 'If your organisation blocks key creation, ask an administrator for an exception for this one account, or use the S3-compatible export to Google Cloud Storage instead.',
      },
      {
        title: 'Add the destination in Alaventra',
        body: 'In **Company settings > Integrations > Data export**, press **Add a destination**, choose **BigQuery**, fill in the project id and dataset, paste the whole JSON key and choose the tables and schedule. Alaventra checks it can see the dataset before saving.',
      },
    ],
    done: '**Run now** shows "Done", and tables named like `alaventra_rank_history` appear in the dataset.',
    trouble: [{ q: 'It says the dataset does not exist', a: 'Check the project id and dataset id, and that the service account was given access to that dataset.' }],
    related: ['s3-access-keys', 'looker-studio-connector'],
    keywords: ['bigquery', 'google cloud', 'service account', 'warehouse', 'export', 'json key'],
  },
  {
    id: 'looker-studio-connector',
    area: 'integrations',
    title: 'Add Alaventra to Looker Studio',
    why: 'Chart your rankings, Search Console and GA4 figures, audit findings, AI visibility and backlinks in Looker Studio, beside the rest of your company\'s reporting, refreshed from Alaventra.',
    where: 'Alaventra, Google Apps Script and Looker Studio',
    who: 'Whoever builds your Looker Studio reports (the first step needs an Alaventra owner or admin)',
    minutes: 15,
    vars: [{ key: 'appUrl', label: 'Your Alaventra address', example: 'https://app.alaventra.com' }],
    steps: [
      {
        title: 'Create a read-only API key',
        body: 'In **Company settings > API access**, create a key named `Looker Studio` with only **Read** ticked. Copy it.',
      },
      {
        title: 'Install the connector',
        body: 'Alaventra\'s connector is a small Google Apps Script. Create a new project at script.google.com, paste the files from Alaventra\'s `integrations/looker-studio` folder, then **Deploy > New deployment > Add-on / Looker Studio connector**, as its README describes.',
        link: { label: 'Open Apps Script', href: 'https://script.google.com/home' },
      },
      {
        title: 'Add it as a data source',
        body: 'In Looker Studio, **Create > Data source**, search for your deployed connector, paste the API key when asked, and fill in your Alaventra address, the website and the table.',
        copy: [{ label: 'Alaventra address', value: '{{appUrl}}' }],
      },
      {
        title: 'Build the report',
        body: 'Each table becomes one data source with typed fields, e.g. `rank_history` with keyword, position and checked_at. Add one data source per table you want to chart.',
      },
    ],
    done: 'The data source shows its fields and a table of your rows.',
    related: ['bigquery-service-account', 'mcp-assistant'],
    keywords: ['looker', 'data studio', 'dashboard', 'bi', 'connector'],
  },
  {
    id: 'mcp-assistant',
    area: 'integrations',
    title: 'Connect Claude or ChatGPT to your SEO data',
    why: 'Ask an AI assistant about your websites, audits, rankings and reports and, if you allow it, let it start analyses for you, using your company\'s credits and with the same checks as the app.',
    where: 'Company settings > API access, and your assistant\'s settings',
    who: 'An owner or admin (for the key); anyone for the assistant',
    minutes: 5,
    vars: [{ key: 'appUrl', label: 'Your Alaventra address', example: 'https://app.alaventra.com' }],
    steps: [
      {
        title: 'Create a key for the assistant',
        body: 'In **Company settings > API access**, create a key. Tick only **Read** for questions; tick **Start analyses** as well if the assistant may start runs.',
        warn: 'A key with **Start analyses** uses your company\'s credits. The assistant is told to show you the price in credits first and never to accept a duplicate warning you have not seen.',
      },
      {
        title: 'Add Alaventra to the assistant',
        body: 'The address is your Alaventra address followed by `/api/v1/mcp`, with the key sent as a Bearer token.',
        copy: [{ label: 'MCP address', value: '{{appUrl}}/api/v1/mcp' }],
        choices: [
          { label: 'Claude Code', body: 'Run `claude mcp add --transport http alaventra <the MCP address> --header "Authorization: Bearer <your key>"`.' },
          { label: 'Claude Desktop', body: 'Add a server to **claude_desktop_config.json** that runs `npx -y mcp-remote <the MCP address> --header Authorization:<Bearer your key>`; the snippet on the Integrations page is ready to copy.' },
          { label: 'OpenAI API', body: 'Add a tool of type `mcp` with the address and an `Authorization` header to your Responses API call. ChatGPT\'s own app connectors accept only OAuth, so a key cannot be pasted there yet.' },
        ],
      },
      {
        title: 'Ask something',
        body: 'Try "Which high-severity findings are new on my site since the last audit?" or, with a run key, "Preview a technical audit of my site".',
      },
    ],
    done: 'The assistant lists your websites when asked.',
    related: ['webhook-signature', 'looker-studio-connector'],
    keywords: ['mcp', 'claude', 'chatgpt', 'openai', 'assistant', 'agent', 'api'],
  },
  // ---------------------------------------------------------------- sign-in and security (G1)
  {
    id: 'two-step-verification',
    area: 'security',
    title: 'Turn on two-step verification',
    why: 'A password alone is one leak away from someone else reading your company\'s reports and starting paid runs. With a second step, a stolen password is not enough.',
    where: 'Your account > Two-step verification',
    who: 'Everyone, for their own account',
    minutes: 4,
    steps: [
      {
        title: 'Choose how you will confirm it is you',
        body: 'An **authenticator app** on your phone shows a new 6-digit code every 30 seconds. A **passkey** uses your laptop\'s fingerprint or face unlock, your phone, or a security key. You can set up both; either works at sign-in.',
        choices: [
          { label: 'Authenticator app', body: 'Install one if you have none: **Google Authenticator**, **Microsoft Authenticator**, **1Password** or **Authy** all work. Company phones often have one already.' },
          { label: 'Passkey', body: 'Nothing to install on a recent Mac, Windows PC, iPhone or Android phone. A hardware key (YubiKey or similar) works too.' },
        ],
      },
      {
        title: 'Set it up',
        body: 'Open **Your account**, find **Two-step verification** and press **Set up an authenticator app** (scan the QR code, then type the code the app shows) or **Add a passkey** (follow your browser\'s prompt).',
        note: 'If you cannot scan the code, type the key shown under it into the app as a "time-based" account.',
      },
      {
        title: 'Save your recovery codes',
        body: 'You get ten one-time codes. **Download** them or put them in your password manager. Each works once, in place of a code, if you lose your phone.',
        warn: 'Without the codes and without your phone, only a company owner (by removing and re-inviting you) can get you back in.',
      },
    ],
    done: 'Your account shows **Two-step verification: On**, and the next sign-in asks for a code after your password.',
    trouble: [
      { q: 'The code is always rejected', a: 'The phone\'s clock is off. Set date and time to **automatic** on the phone, then use the newest code. A code works once and only for about a minute.' },
      { q: 'I lost my phone', a: 'Sign in with a recovery code, then remove the old app and set up the new phone. Out of codes: ask your company owner.' },
    ],
    related: ['require-two-step'],
    keywords: ['2fa', 'mfa', 'totp', 'authenticator', 'passkey', 'security key', 'two factor', 'recovery codes'],
  },
  {
    id: 'require-two-step',
    area: 'security',
    title: 'Require two-step verification for your whole company',
    why: 'One member with a reused password is enough for someone to read every report. Requiring a second step closes that for everyone at once.',
    where: 'Company settings > Security',
    who: 'An owner or admin (who already uses two-step verification)',
    minutes: 5,
    steps: [
      { title: 'Turn it on for yourself first', body: 'The switch stays locked until your own account has two-step verification; otherwise it would lock you out on the next click.' },
      {
        title: 'Tell the team before you switch it on',
        body: 'Members without a second step see a page asking them to set one up the next time they open the company. Nothing is lost; they just cannot see anything until they do. **Send to a colleague** sends them the setup guide.',
      },
      {
        title: 'Decide what counts',
        body: '**Sign-ins through your own identity provider** (single sign-on) count by default, because your IdP enforces its own MFA. **Google sign-ins** do not count by default: we cannot see whether a Google account has 2-Step Verification on. Turn that on only if your Google Workspace admin enforces it.',
      },
      { title: 'Switch on "Require two-step verification"', body: 'The members list then shows who has it. Follow up with anyone marked **Off**.' },
    ],
    done: 'Every member in the list shows two-step verification **On**.',
    related: ['two-step-verification'],
    keywords: ['enforce mfa', 'require 2fa', 'policy', 'security policy'],
  },
  {
    id: 'sso-domain',
    area: 'security',
    title: 'Prove your e-mail domain for single sign-on',
    why: 'Single sign-on and provisioning only ever act on addresses at domains your company has proven it controls, so no other company can claim your colleagues.',
    where: 'Your DNS provider',
    who: 'Whoever manages DNS for your domain (often IT)',
    minutes: 10,
    vars: [V.domain, { key: 'dnsValue', label: 'Value of the record', example: 'alaventra-sso=abc123def456' }],
    steps: [
      { title: 'Add the domain in Alaventra', body: 'Company settings > **Single sign-on** > **Add a domain**: type `{{domain}}` (the part after @ in your colleagues\' addresses). Public mail providers such as gmail.com cannot be claimed.' },
      {
        title: 'Add a TXT record at your DNS provider',
        body: 'Create a record of type **TXT** at the domain itself (host `@`, or `{{domain}}`), with this value. Leave any other TXT records (SPF, Google, Microsoft) as they are.',
        copy: [{ label: 'TXT value', value: '{{dnsValue}}', hint: 'Value / Content / Text' }],
        choices: [
          { label: 'Cloudflare', body: '**DNS > Records > Add record**, type TXT, name `@`, paste the value, **Save**.' },
          { label: 'GoDaddy', body: '**My Products > DNS > Add New Record**, type TXT, name `@`, paste the value, **Save**.' },
          { label: 'Route 53', body: '**Hosted zones > {{domain}} > Create record**, type TXT, leave the name empty, paste the value in quotes, **Create records**.' },
          { label: 'Azure DNS', body: '**DNS zones > {{domain}} > + Record set**, type TXT, name `@`, paste the value, **OK**.' },
        ],
      },
      { title: 'Check it', body: 'Back in Alaventra press **Check now**. Records usually appear within minutes; some providers take up to an hour.' },
    ],
    done: 'The domain shows **Verified**.',
    trouble: [{ q: 'Another company has verified it', a: 'One domain belongs to one company here. If it is really yours, contact us with proof and we will look into it.' }],
    related: ['sso-identity-provider', 'dns-txt-record'],
    keywords: ['sso', 'domain', 'verify domain', 'txt record'],
  },
  {
    id: 'scim-provisioning',
    area: 'security',
    title: 'Provision people automatically (SCIM)',
    why: 'Joiners get access without an invitation, and a leaver switched off in your identity provider loses access here at once, so no one has to remember to remove them.',
    where: 'Company settings > Single sign-on, then your identity provider',
    who: 'An administrator of your identity provider, with an owner or admin of your company in Alaventra',
    minutes: 15,
    vars: [{ key: 'scimUrl', label: 'SCIM base URL', example: 'https://app.alaventra.com/api/scim/v2' }],
    steps: [
      { title: 'Verify your e-mail domain first', body: 'Provisioning only creates people whose addresses are on your verified domains (see **Prove your e-mail domain**).' },
      { title: 'Create a provisioning token', body: 'Company settings > **Single sign-on** > Provisioning: name it after your provider and **Create token**. Copy it at once: it is shown only once.' },
      {
        title: 'Point your identity provider at Alaventra',
        body: 'Give it the base URL and the token (as a Bearer / HTTP header token).',
        copy: [{ label: 'SCIM base URL', value: '{{scimUrl}}' }],
        choices: [
          { label: 'Okta', body: 'In the Alaventra app: **General > App Settings > Provisioning: SCIM**, then **Provisioning > Integration**: SCIM connector base URL = the URL above, unique identifier `userName`, actions Push New Users / Push Profile Updates / Push Groups, authentication **HTTP Header** with the token. Then **To App**: enable Create, Update and Deactivate.' },
          { label: 'Microsoft Entra ID', body: 'Enterprise application > **Provisioning > Get started > Automatic**: Tenant URL = the URL above, Secret token = the token, **Test Connection**, **Save**, then **Start provisioning**.' },
        ],
      },
      { title: 'Map groups to roles', body: 'Push the groups you use (for example "Alaventra Admins"). They appear under **Groups and roles**: choose the role each gives. A person gets the highest role of their groups; owners are never changed.' },
    ],
    done: 'People you assign in your provider appear in the Team list marked **SCIM**, and switching one off shows them as **Deactivated**.',
    trouble: [
      { q: 'Users are refused with "not on one of this company\'s verified domains"', a: 'Verify that domain first, or assign only people with addresses on your verified domains.' },
      { q: 'Okta says the user already exists', a: 'They are already a member (invited earlier). Okta matches them by userName and updates them from then on.' },
    ],
    related: ['sso-identity-provider', 'sso-domain'],
    keywords: ['scim', 'provisioning', 'deprovisioning', 'okta', 'entra', 'joiners leavers', 'groups'],
  },
  {
    id: 'sso-identity-provider',
    area: 'security',
    title: 'Connect your identity provider (single sign-on)',
    why: 'Your people sign in with the account your IT team already manages, with its MFA and its leaver process, so nobody keeps a separate password for Alaventra.',
    where: 'Your identity provider\'s admin console, then Company settings > Single sign-on',
    who: 'An administrator of your identity provider, with an owner or admin of your company in Alaventra',
    minutes: 20,
    vars: [
      { key: 'redirectUri', label: 'Sign-in redirect URI (OIDC)', example: 'https://app.alaventra.com/api/sso/oidc/callback' },
      { key: 'acsUrl', label: 'ACS URL (SAML)', example: 'https://app.alaventra.com/api/sso/saml/<id>/acs' },
      { key: 'entityId', label: 'Entity ID / audience (SAML)', example: 'https://app.alaventra.com/api/sso/saml/<id>' },
      { key: 'metadataUrl', label: 'SP metadata URL (SAML)', example: 'https://app.alaventra.com/api/sso/saml/<id>/metadata' },
    ],
    steps: [
      { title: 'Choose OIDC or SAML', body: '**OpenID Connect** is quicker (a client ID and secret). Choose **SAML 2.0** if your IT standard asks for it. Both are equally secure here.' },
      {
        title: 'Create the app in your identity provider',
        body: 'Create a web application for Alaventra and give it the values below. Assign the people or groups who should use Alaventra.',
        copy: [
          { label: 'OIDC sign-in redirect URI', value: '{{redirectUri}}' },
          { label: 'SAML ACS URL', value: '{{acsUrl}}' },
          { label: 'SAML entity ID / audience', value: '{{entityId}}' },
        ],
        choices: [
          { label: 'Okta (OIDC)', body: '**Applications > Create App Integration > OIDC > Web Application**. Sign-in redirect URI: the value above. Grant type: Authorization Code. Copy the **Client ID**, **Client secret** and your Okta domain (issuer `https://<you>.okta.com`).' },
          { label: 'Okta (SAML)', body: '**Applications > Create App Integration > SAML 2.0**. Single sign-on URL: the ACS URL; Audience URI: the entity ID; Name ID format **EmailAddress**; attribute `email` = user.email. Then **View SAML setup instructions**: copy the IdP SSO URL, the issuer and the certificate.' },
          { label: 'Microsoft Entra ID (OIDC)', body: '**App registrations > New registration**, redirect URI (Web) = the value above. **Certificates & secrets > New client secret**. Issuer: `https://login.microsoftonline.com/<tenant id>/v2.0`. Under **Token configuration** add the optional claim **email**.' },
          { label: 'Microsoft Entra ID (SAML)', body: '**Enterprise applications > New application > Create your own > non-gallery**, then **Single sign-on > SAML**: Identifier = the entity ID, Reply URL = the ACS URL. Download **Certificate (Base64)**; copy **Login URL** and **Microsoft Entra Identifier**.' },
          { label: 'Google Workspace (SAML)', body: 'Admin console > **Apps > Web and mobile apps > Add custom SAML app**. Copy the **SSO URL**, **Entity ID** and **Certificate**; ACS URL and Entity ID = the values above; Name ID **Basic Information > Primary email**.' },
        ],
        note: 'For SAML you can also point your IdP at the metadata URL: {{metadataUrl}}',
      },
      { title: 'Enter the IdP\'s values in Alaventra', body: 'Company settings > **Single sign-on** > Identity provider: paste the issuer, client ID and secret (OIDC) or the entity ID, SSO URL and certificate (SAML), choose whether first sign-ins create accounts and with which role, and **Save**.' },
      { title: 'Run a test sign-in', body: 'Press **Test sign-in** and sign in at your provider with an account on your verified domain. Nothing is created; the result appears under **Last test**.' },
      { title: 'Switch it on, then require it when ready', body: 'Turn on **Single sign-on is on**. Once everyone has tried it, an owner can turn on **Require single sign-on**: passwords then stop working on your domains (owners keep theirs as the way in if the provider is down).' },
    ],
    done: 'The last test is green, single sign-on is on, and colleagues reach Alaventra through **Sign in with SSO**.',
    trouble: [
      { q: 'The test says no e-mail address was sent', a: 'Add the **email** claim (OIDC) or an `email` attribute / EmailAddress Name ID (SAML) in your provider.' },
      { q: '"audience mismatch" or "Recipient"', a: 'The entity ID or ACS URL in your provider differs from ours by a character. Copy them again from this page.' },
      { q: '"Invalid signature"', a: 'The certificate pasted here is not the one your provider signs with (often after a rotation). Paste the current one.' },
    ],
    related: ['sso-domain', 'scim-provisioning'],
    keywords: ['sso', 'saml', 'oidc', 'okta', 'entra', 'azure ad', 'google workspace', 'identity provider', 'single sign-on'],
  },
  // ---------------------------------------------------------------- Server logs (gap #6, app/docs/LOG_ANALYTICS.md)
  {
    id: 'crawler-logs-upload',
    area: 'website',
    title: 'Upload your server\'s access log',
    why: 'Your access log is the only record of what Googlebot and the AI crawlers really fetched on {{domain}} (which pages, how often, and what your server answered). One file is enough to start.',
    where: 'Your web server or hosting panel',
    who: 'Whoever can download files from the server or the hosting panel',
    minutes: 10,
    vars: [V.domain],
    steps: [
      {
        title: 'Find the log',
        body: 'Pick the access log, not the error log. Older days are usually kept next to it as `.1`, `.2.gz` and so on.',
        choices: [
          { label: 'Nginx', body: 'On the server: `/var/log/nginx/access.log` and the rotated `access.log.*.gz` beside it.' },
          { label: 'Apache', body: '`/var/log/apache2/access.log` (Debian, Ubuntu) or `/var/log/httpd/access_log` (Red Hat, CentOS), plus the rotated files.' },
          { label: 'IIS (Windows)', body: '`C:\\inetpub\\logs\\LogFiles\\W3SVC1\\`, one `u_ex*.log` file per day. The W3C format is read as it is.' },
          { label: 'cPanel', body: 'Open **Metrics > Raw Access**, then download the archive for {{domain}}. It is already gzip.' },
          { label: 'Plesk', body: 'Open **Websites & Domains > Logs**, filter on access logs and download them.' },
          { label: 'Managed WordPress hosts', body: 'Kinsta, WP Engine and similar hosts keep access logs but show only the last lines in their panel. Ask their support for the raw access logs of the last 30 days.' },
          { label: 'Amazon CloudFront', body: 'Standard logs land in the S3 bucket you chose. Download the `.gz` files of the days you want and upload them as they are.' },
        ],
      },
      {
        title: 'Keep the visitor address in the log',
        body: 'Crawlers are proved by their address, so the log must hold the visitor\'s address, not your CDN\'s or load balancer\'s.',
        warn: 'Behind Cloudflare or a load balancer the default log shows the proxy. Log `CF-Connecting-IP` or `X-Forwarded-For` (Nginx: the `realip` module; Apache: `mod_remoteip`), or send Cloudflare\'s own logs with Logpush instead.',
      },
      {
        title: 'Upload it on the Crawlers page',
        body: 'Press **Upload a log** and choose the file. Plain text or gzip, up to 1 GB a file. Several days in one file is fine: zip the rotated files together first, for example `zcat access.log.*.gz | gzip > last-month.log.gz`.',
        note: 'The same file uploaded twice is read once, and lines two files share are counted once.',
      },
      { title: 'Wait for it to be read', body: 'A million lines take well under a minute. The page shows the file as read with how many lines were crawler requests, people, and unreadable.' },
    ],
    done: 'The Crawlers page shows requests per crawler, with how many were proved to be the real crawler.',
    trouble: [
      { q: 'Every Googlebot request shows as "unchecked"', a: 'The log holds your proxy\'s address. See step 2, or use Cloudflare Logpush.' },
      { q: 'Lines were counted as unreadable', a: 'We read Apache and Nginx combined or common logs, IIS / W3C extended logs and JSON lines. A custom format with the date first or no quotes around the request is not read; switch the log back to combined for the days you upload.' },
      { q: 'What happens to the addresses of people', a: 'Requests from people are counted and dropped. The file itself is deleted as soon as it has been read.' },
    ],
    related: ['crawler-logs-cloudflare', 'crawler-logs-drain', 'ai-crawler-access'],
    keywords: ['server log', 'access log', 'log file', 'googlebot', 'gptbot', 'crawl budget', 'bots', 'nginx', 'apache', 'iis'],
  },
  {
    id: 'crawler-logs-cloudflare',
    area: 'website',
    title: 'Send Cloudflare\'s logs automatically (Logpush)',
    why: 'With Logpush Cloudflare sends every request for {{domain}} to Alaventra within minutes, with the visitor\'s real address, so the Crawlers page stays current without anyone uploading files.',
    where: 'Cloudflare dashboard',
    who: 'A Cloudflare account member who may edit Logpush jobs (Logs Write)',
    minutes: 10,
    vars: [V.domain, { key: 'logEndpoint', label: 'Where the logs go', example: 'https://app.alaventra.com/api/ingest/logs/your-website-id' }, { key: 'logHeader', label: 'The header that carries the key', example: 'X-Alaventra-Log-Key' }],
    steps: [
      {
        title: 'Create a push key here',
        body: 'On the Crawlers page press **Create push key** and copy it. It is shown once; a new key replaces the old one at once.',
        warn: 'Logpush of HTTP requests is a Cloudflare Enterprise feature. On other plans, upload your server\'s access log instead.',
      },
      {
        title: 'Start a Logpush job in Cloudflare',
        body: 'Open your domain in Cloudflare, then **Analytics & Logs > Logpush > Create a Logpush job**. Choose the **HTTP destination**.',
        link: { label: 'Cloudflare: HTTP destination', href: 'https://developers.cloudflare.com/logs/logpush/logpush-job/enable-destinations/http/' },
      },
      {
        title: 'Paste the destination with the key in it',
        body: 'Cloudflare turns every `header_` part of the address into a request header. Put your key after the equals sign.',
        copy: [{ label: 'HTTP endpoint', value: '{{logEndpoint}}?header_{{logHeader}}=PASTE-YOUR-KEY-HERE', hint: 'Replace PASTE-YOUR-KEY-HERE with the key you copied' }],
      },
      {
        title: 'Choose the dataset and the fields',
        body: 'Dataset **HTTP requests**. Fields: `ClientIP`, `ClientRequestHost`, `ClientRequestMethod`, `ClientRequestURI`, `ClientRequestUserAgent`, `EdgeStartTimestamp`, `EdgeResponseStatus`, `EdgeResponseBytes`, `OriginResponseDurationMs`, `RayID`. Timestamp format **RFC3339**.',
        note: 'Set the maximum upload size to 100 MB or less. Requests from people are counted and dropped on arrival.',
      },
      { title: 'Save', body: 'Cloudflare sends a small test file first; Alaventra accepts it, and the job turns on. The Crawlers page shows the time of the last push.' },
    ],
    done: 'The Crawlers page shows "Last push" a few minutes old and the request counts start to grow.',
    trouble: [
      { q: 'Cloudflare says "error validating destination"', a: 'The key in the address is wrong or was replaced. Create a new key here and paste it again.' },
      { q: 'Requests stopped arriving', a: 'Check the job is enabled in Cloudflare and that nobody created a new key here since.' },
    ],
    related: ['crawler-logs-upload', 'crawler-logs-drain'],
    keywords: ['cloudflare', 'logpush', 'cdn logs', 'http requests', 'server log', 'bots'],
  },
  {
    id: 'crawler-logs-drain',
    area: 'website',
    title: 'Send logs from Vercel, Fastly or Akamai',
    why: 'A log drain sends every request for {{domain}} to Alaventra as it happens, so the Crawlers page stays current without uploads.',
    where: 'Your CDN or hosting dashboard',
    who: 'Whoever manages the CDN or hosting account',
    minutes: 15,
    vars: [V.domain, { key: 'logEndpoint', label: 'Where the logs go', example: 'https://app.alaventra.com/api/ingest/logs/your-website-id' }, { key: 'logHeader', label: 'The header that carries the key', example: 'X-Alaventra-Log-Key' }],
    steps: [
      { title: 'Create a push key here', body: 'On the Crawlers page press **Create push key** and copy it. It is shown once.' },
      {
        title: 'Add the drain',
        body: 'Every drain needs the same three things: the address, a custom header with the key, and JSON (one request per line, or a JSON array).',
        copy: [
          { label: 'Endpoint', value: '{{logEndpoint}}' },
          { label: 'Header name', value: '{{logHeader}}' },
        ],
        choices: [
          { label: 'Vercel', body: '**Team Settings > Drains > Add Drain**, data type **Logs**, sources static, lambda and edge, destination **Custom endpoint**. Format NDJSON or JSON, and under **Custom headers** add `{{logHeader}}: your key`.', link: { label: 'Vercel: drains', href: 'https://vercel.com/docs/drains/using-drains' } },
          { label: 'Fastly', body: 'Add an **HTTPS** logging endpoint with the URL above, a custom header named `{{logHeader}}` with your key, JSON log line format and content type `application/x-ndjson`. Use the log format below.', link: { label: 'Fastly: HTTPS logging', href: 'https://www.fastly.com/documentation/guides/integrations/logging-endpoints/log-streaming-https/' } },
          { label: 'Akamai DataStream 2', body: 'Create a stream with a **Custom HTTPS** destination, JSON format, and a custom header `{{logHeader}}` with your key. Include client IP, request time, host, method, path, query string, status code, total bytes, user agent and turnaround time.', link: { label: 'Akamai: custom HTTPS endpoint', href: 'https://techdocs.akamai.com/datastream2/docs/stream-custom-https' } },
          { label: 'Anything else', body: 'Any service that can POST JSON lines with a custom header works. Each line needs a time, the client address, the path, the status and the user agent; we recognise the usual names (`timestamp`, `client_ip`, `path`, `status`, `user_agent` and many others).' },
        ],
      },
      {
        title: 'Fastly only: the log format',
        body: 'Paste this as the log format so every line carries what we read.',
        copy: [{ label: 'Fastly log format', value: '{"timestamp":"%{strftime(\\{"%Y-%m-%dT%H:%M:%SZ"\\}, time.start)}V","client_ip":"%{req.http.Fastly-Client-IP}V","host":"%{json.escape(req.http.Host)}V","method":"%{json.escape(req.method)}V","url":"%{json.escape(req.url)}V","status":%{resp.status}V,"response_body_size":%{resp.body_bytes_written}V,"user_agent":"%{json.escape(req.http.User-Agent)}V","time_elapsed":%{time.elapsed.usec}V}' }],
      },
      { title: 'Save and test', body: 'Most services send a test request when you save. The Crawlers page shows the time of the last push.' },
    ],
    done: 'The Crawlers page shows "Last push" a few minutes old.',
    trouble: [{ q: 'The test fails with 401', a: 'The header name or the key is wrong. The header must be exactly `{{logHeader}}`, the value the key and nothing else.' }],
    related: ['crawler-logs-upload', 'crawler-logs-cloudflare'],
    keywords: ['vercel', 'fastly', 'akamai', 'log drain', 'datastream', 'server log', 'bots'],
  },
  // ---------------------------------------------------------------- G5: the agency's client portal
  {
    id: 'portal-domain',
    area: 'agency',
    title: 'Put your client portal on your own domain',
    why: 'Your clients sign in at an address with your name in it, such as seo.youragency.com, and never see ours.',
    where: 'Your DNS provider, then Company settings > Portal address',
    who: 'Whoever manages DNS for your agency\'s domain',
    minutes: 15,
    vars: [
      { key: 'host', label: 'Your portal address', example: 'seo.youragency.com' },
      { key: 'txtName', label: 'Name of the TXT record', example: '_portal-verification.seo.youragency.com' },
      { key: 'txtValue', label: 'Value of the TXT record', example: 'portal-verification=a1b2c3d4e5f6' },
      { key: 'cnameTarget', label: 'Where the CNAME points', example: 'portals.example-platform.com' },
    ],
    steps: [
      { title: 'Choose the address', body: 'Pick a sub-domain of your own website, for example `{{host}}`, and add it under **Portal address**. Each claim gets its own record value: an old value proves nothing.' },
      {
        title: 'Prove it is yours with a TXT record',
        body: 'At your DNS provider create a record of type **TXT** with this name and value. It proves your agency controls the address.',
        copy: [
          { label: 'Name / host', value: '{{txtName}}', hint: 'Some providers want only the part before your domain' },
          { label: 'Value', value: '{{txtValue}}', hint: 'Value / Content / Text' },
        ],
        choices: [
          { label: 'Cloudflare', body: '**DNS > Records > Add record**, type TXT, paste the name and the value, **Save**.' },
          { label: 'GoDaddy', body: '**My Products > DNS > Add New Record**, type TXT, name = the part before your domain, paste the value, **Save**.' },
          { label: 'Namecheap', body: '**Domain List > Manage > Advanced DNS > Add New Record**, TXT Record, host = the part before your domain, paste the value, tick to save.' },
          { label: 'Route 53', body: '**Hosted zones > your domain > Create record**, type TXT, record name = the part before your domain, the value in quotes, **Create records**.' },
        ],
      },
      {
        title: 'Point the address at the portal with a CNAME',
        body: 'Create a record of type **CNAME** for the address itself, pointing at the platform. With Cloudflare, leave the proxy **off** (grey cloud) so the certificate can be issued for your address.',
        copy: [
          { label: 'CNAME name', value: '{{host}}' },
          { label: 'Points to', value: '{{cnameTarget}}' },
        ],
        warn: 'Do not delete the TXT record later: the address is checked again every few hours and stops being served when the proof is gone.',
      },
      { title: 'Check it', body: 'Back in Alaventra press **Check now**. When both records are found the address shows **Verified** and your clients can open it; the certificate is issued on the first visit.' },
    ],
    done: 'The address shows **Verified**, and opening it shows your sign-in page with your logo.',
    trouble: [
      { q: 'It says the TXT value is different', a: 'You claimed the address again and got a new value. Replace the old TXT record with the value shown now.' },
      { q: 'It says the address points somewhere else', a: 'Another CNAME or A record exists for that name. Remove it and keep only the CNAME above.' },
      { q: 'The browser warns about the certificate', a: 'Wait a minute and reload: the certificate is requested on the first visit after verification. With Cloudflare, switch the proxy off.' },
      { q: 'It says the address is in use', a: 'Another company on this platform verified it. If it is yours, they must release it first; contact us if they cannot be reached.' },
    ],
    related: ['portal-email-auth', 'dns-txt-record'],
    keywords: ['white label', 'custom domain', 'portal', 'cname', 'agency', 'client portal'],
  },
  {
    id: 'portal-email-auth',
    area: 'agency',
    title: 'Send client e-mails from your own address',
    why: 'Report e-mails and invitations to your clients come from your agency\'s address, and only once your domain tells mail servers it allows it, so they land in the inbox and not in spam.',
    where: 'Your mail provider and DNS, then Company settings > Client e-mail',
    who: 'Whoever manages your mail domain\'s DNS',
    minutes: 20,
    vars: [{ key: 'domain', label: 'Your mail domain', example: 'youragency.com' }],
    steps: [
      { title: 'Connect the mailbox', body: 'Company settings > **Mailboxes**: connect the address you want clients to see, for example `reports@{{domain}}`.' },
      {
        title: 'Publish SPF',
        body: 'Your domain needs one TXT record starting with `v=spf1` that names your mail provider and ends in `~all` or `-all` (never `+all`).',
        choices: [
          { label: 'Google Workspace', body: 'TXT at `@`: `v=spf1 include:_spf.google.com ~all`', link: { label: 'Google\'s SPF help', href: 'https://support.google.com/a/answer/33786' } },
          { label: 'Microsoft 365', body: 'TXT at `@`: `v=spf1 include:spf.protection.outlook.com -all`', link: { label: 'Microsoft\'s SPF help', href: 'https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure' } },
        ],
      },
      {
        title: 'Turn on DKIM signing',
        body: 'Your mail provider gives you a DKIM record (a TXT or CNAME under `<selector>._domainkey.{{domain}}`). Add it, then switch signing on in the provider.',
        note: 'If your provider uses a selector that is not one of the common ones, type it in **DKIM selector** so we look in the right place.',
      },
      { title: 'Choose it as the sender', body: 'Company settings > **Client e-mail**: pick the mailbox and **Save**. We check SPF and DKIM; until both pass, e-mails go out from our address under your agency\'s name.' },
    ],
    done: 'Client e-mail shows **Verified** beside the mailbox, and the next invitation comes from your address.',
    trouble: [
      { q: 'SPF says "weak"', a: 'Your record ends in `+all` or `?all`, which lets anyone send as you. Change it to `~all` or `-all`.' },
      { q: 'DKIM is not found', a: 'Signing may still be off in your provider, or it uses another selector: enter the selector shown in its DKIM settings.' },
    ],
    related: ['email-authentication', 'mailbox-connect'],
    keywords: ['spf', 'dkim', 'custom from', 'sender', 'white label email', 'agency'],
  },
  {
    id: 'portal-branding',
    area: 'agency',
    title: 'Brand the portal as your own',
    why: 'Your clients see your name, your logo and your colour on every page, report and e-mail: the work is presented as yours.',
    where: 'Company settings > Branding',
    minutes: 5,
    steps: [
      { title: 'Host your logo', body: 'Put an SVG or PNG of your logo on your own website or CDN at an **https** address. A transparent background works best; add a second one drawn for dark backgrounds if you have it.' },
      { title: 'Fill in the brand', body: 'Product name (what clients call the portal), logo address(es), one colour, a support address and a footer line. The colour is adjusted where needed so every text on it stays readable in light and dark mode.' },
      { title: 'Switch white-label on', body: 'Turn on **White-label** and **Save**. The portal, report pages, shared reports, documents and e-mails your clients get carry your brand from then on.' },
    ],
    done: 'A client logging in sees your name and colour, and no mention of ours.',
    related: ['portal-domain', 'invite-clients'],
    keywords: ['white label', 'logo', 'colour', 'color', 'brand', 'agency'],
  },
  {
    id: 'invite-clients',
    area: 'agency',
    title: 'Give a client access to their portal',
    why: 'Your client follows their own websites, dashboards, reports and recommendations, and approves pages and outreach before they go out, without seeing your other clients or your credits.',
    where: 'The client\'s workspace > Company settings > Team',
    minutes: 3,
    steps: [
      { title: 'Open the client\'s workspace', body: 'From **Clients**, open the client and go to **Company settings > Team > Invite people**.' },
      { title: 'Pick the role', body: '**Client viewer** reads everything in the portal. **Client approver** also approves pages and outreach. Your own team is added from the agency\'s Clients page, not here.' },
      { title: 'Send the link', body: 'They get an e-mail from your agency (or you copy the link). It opens on your portal address when you have one.' },
    ],
    done: 'They appear in the Team list with their client role.',
    related: ['portal-branding', 'portal-domain'],
    keywords: ['client login', 'client access', 'approver', 'viewer', 'agency'],
  },
  // ---------------------------------------------------------------- Your weekly autopilot (SCHEDULING_KEYWORDS_PLAN.md §4-§5)
  // The numbers in these texts come from cycles.ts / cycle-clock.ts (the engine mirrors them), never typed in; the website's own values
  // (its weekday, zone, monthly date, level, the credits of a page) arrive through {{vars}} from web/src/lib/guide-vars.ts.
  {
    id: 'your-journey',
    area: 'autopilot',
    title: 'What happens when',
    why: 'The whole path from setup to a keyword won, stage by stage: what you do, what we do, and what each step leads to. Read it once and every message from Alaventra will make sense.',
    where: 'Alaventra: the Pipeline page of your website',
    minutes: 6,
    vars: [V.domain, V.weekday, V.timezone, V.monthlyDate, V.level],
    steps: [
      {
        title: 'Setup: your answers, your keyword, your level',
        body: '**You:** say what you sell, choose the keyword you want to be found for (or let us suggest one), pick how much we do on our own, and fill in your **author profile** and your **business facts**. **We:** start a free keyword research while you answer, and check every keyword you type. **It leads to:** a plan for {{domain}} that only writes for keywords you chose, at {{level}}.',
        note: 'The author profile and the business facts are what let your first page be published as it is, instead of arriving as a draft with blanks to fill. Until both exist, the plan for your keyword is still made, but its pages wait and use no credits.',
      },
      {
        title: 'Day 1: the first week starts at once',
        body: '**We:** start your first week within minutes of finishing setup: the checks run one after another (it is also your first monthly week, so it includes the full AI check, the full backlink report and the audit), and the plan for your keyword is made. When your author profile and business facts are in, the first page of your keyword is written the same day. **You:** nothing, unless something shows under **Needs you**. **It leads to:** your first reports within the hour, and a first page to publish.',
        note: 'The first page counts as that week\'s page, so the next one is written in your next weekly run.',
      },
      {
        title: 'Every week on your day: the weekly run',
        body: '**We:** on {{weekday}} at ' + CYCLE_LOCAL_TIME + ' in {{timezone}}, check how AI assistants answer your buyers, your backlinks, where your keyword\'s pages rank, your Search Console and Analytics figures, your pages\' readiness for AI answers, then write the week\'s pages and look for sites that might link to you. Each step starts when the one before it is done. **You:** read the reports when they arrive. **It leads to:** a page or more a week for your keyword, and reports that show what moved.',
      },
      {
        title: PREVIEW_DAYS + ' days before: Coming up',
        body: '**We:** make the plan of the next weekly run: each page it will write, why, and its credits, on the Pipeline and by e-mail to the owners and admins. **You:** **Skip** what you do not want, **Approve** what waits for your OK, or do nothing. **It leads to:** a weekly run that writes exactly that plan. Doing nothing is fine: automatic pages are written, the others are not.',
      },
      {
        title: 'Once a month on your monthly date: the bigger checks',
        body: '**We:** in the first weekly run on or after {{monthlyDate}}, add the full AI visibility check, the full backlink report, a check of your entry in Wikidata and the technical audit of your whole site (when audits are on). **You:** look at the audit\'s fixes when you have time. **It leads to:** a monthly picture of your site\'s health, compared with the month before.',
      },
      {
        title: 'Pages arrive as drafts for you to publish',
        body: '**We:** research, write, edit and check every page, then deliver it as a report with the page ready to copy (HTML and Markdown). **You:** check it, fill in anything in [brackets], put it on your website, then press **I published it** with its address. **It leads to:** we check the page live and start tracking its position.',
        warn: 'A page marked **Not ready to publish** did not pass the quality check. Finish it first: the guide for that page explains each reason.',
      },
      {
        title: 'Your keyword climbs',
        body: '**We:** write the easier supporting pages first, each linking to your main page, then the main page itself, and check every page on Google each week. **You:** keep publishing what we write. **It leads to:** easier pages reaching page one first, then the main keyword. The keyword is **won** when it stays in the top 3 for 4 weekly checks in a row. Expect months, not weeks.',
      },
      {
        title: 'After a win: your next keyword',
        body: '**We:** start the next keyword in your queue. With none queued, at levels 1 and 2 we suggest one with **Start this ladder**, **Show me others** and **Not now**; at level 3 we announce one that starts ' + PROPOSAL_WAIT_DAYS + ' days later unless you change it. **You:** start it, swap it or skip it. **It leads to:** a new keyword with its own plan.',
      },
      {
        title: 'When something stops',
        body: 'Each of these shows under **Needs you** on the Pipeline with the one thing to do: no keyword chosen yet (nothing is written); author profile or business facts missing (the first page waits); a keyword that was **not planned** (the reason is on it); pages **waiting to be published** (writing pauses until you publish); credits run out (the weekly work pauses and resumes by itself when credits are added); a keyword **checked again** before its first page; and the level lowered to 1 after pages were marked **Not what I wanted**.',
      },
    ],
    done: 'The **What happens next** line on the Pipeline shows your next dates, and **Needs you** is empty or holds only things you have decided to leave for later.',
    trouble: [
      { q: 'Nothing has been written yet', a: 'Look at **Needs you**: either no keyword is chosen, your author profile or business facts are missing, or pages wait to be published. Levels 1 and 2 never write before you choose a keyword.' },
      { q: 'A weekly run did not happen', a: 'A paused website or empty credits stop the week. When it resumes, the missed week runs once and your weekday carries on. Missed weeks never pile up.' },
    ],
    related: ['choose-first-keyword', 'autopilot-levels', 'your-weekly-cycle', 'coming-up-plan', 'page-not-ready'],
    keywords: ['journey', 'timeline', 'what next', 'start', 'onboarding', 'stages', 'how it works', 'autopilot', 'week'],
  },
  {
    id: 'choose-first-keyword',
    area: 'autopilot',
    title: 'Choose the keyword you want to be found for',
    why: 'Pages are written automatically only for keywords you chose. One good keyword, close to what you sell and within reach, is the start of everything else.',
    where: 'Setup step "Your first keyword", or Pipeline > New keyword ladder',
    minutes: 5,
    vars: [V.weekday, V.checkCredits, V.planCredits, V.pageCredits],
    steps: [
      {
        title: 'Type your own idea, or take a suggestion',
        body: 'Under **What would a customer type into Google**, type what a buyer would search to find a business like yours, and press **Check it**. Each check takes 5 to 20 seconds and uses {{checkCredits}} (free if the same keyword was checked in the last 7 days). Or pick from **Suggest keywords for me**: our research of your website and market, judged against what you sell.',
        note: 'Suggestions that do not match the services you listed come last, with a note. If a good one is missing, add the service under **What do you sell?** in the business details.',
      },
      {
        title: 'Read your chances in plain words',
        body: 'Each card says how many people search it a month and your chances: **' + CHANCE_WORDS.easy + '** (your website already wins searches this hard), **' + CHANCE_WORDS.reachable + '** (within reach with a short plan) or **' + CHANCE_WORDS.hard + '** (a long climb of easier pages first). It also says why we suggest it and how many pages the plan has.',
        warn: 'A keyword that is someone else\'s brand, that people use to find one particular website, or that sits outside what you sell is not started. The card offers closer keywords instead.',
      },
      {
        title: 'Pick one to start',
        body: 'One keyword is enough, and two is the most we start at once. A plan is several pages over months; two keywords at the same time already share your weekly pages. You can add more later from the Pipeline, and they wait in a queue.',
      },
      {
        title: 'Say how pages are written for it',
        body: '**Write a page each week** (recommended): choosing the keyword is your OK, and the next page is written on {{weekday}}, easy pages first. **Ask me before each page**: the plan is made, and each page waits for your OK under **Needs you** and in **Coming up**.',
      },
      {
        title: 'Know what happens right after',
        body: 'When you start, we make the plan (about 5 to 10 minutes) and, with **Write a page each week**, write its first page the same day. The first page waits until your **author profile** and **business facts** are filled in, so it can be published as it is rather than as a draft with blanks: the plan still runs, the pages wait and use no credits, and **Needs you** says what is missing. Once both are in, the next weekly run writes it, or press **Write it now**.',
      },
      {
        title: 'Know what it costs',
        body: 'The plan uses {{planCredits}}. Each page uses {{pageCredits}}, shown again before anything starts. The weekly pages count in the monthly estimate beside your autopilot level.',
      },
    ],
    done: 'Your keyword shows as a card on the Pipeline with its plan, and **Coming up** lists its next page.',
    trouble: [
      { q: 'No suggestions appear', a: 'The research takes about 2 minutes after the business step and fills in on its own. Meanwhile type your own idea, or press **I\'ll choose later**: the checks run and nothing is written until you choose.' },
      { q: 'My keyword says it does not fit', a: 'It looks outside what you sell, or people use it to find one particular company. If it is truly what you sell, add that service under **What do you sell?** and check it again, or take one of the closer keywords offered.' },
      { q: 'I chose a keyword and nothing was written', a: 'Look at **Needs you**: the first page waits for your author profile and business facts, and **Ask me before each page** waits for your OK.' },
    ],
    related: ['your-journey', 'autopilot-levels', 'keyword-not-planned', 'business-profile', 'business-facts'],
    keywords: ['keyword', 'first keyword', 'ladder', 'suggestions', 'research', 'chance', 'difficulty', 'manual', 'auto'],
  },
  {
    id: 'autopilot-levels',
    area: 'autopilot',
    title: 'Choose how much we do on our own',
    why: 'Three levels decide what is written without asking. Whatever the level, nothing is written that you could not see first in Coming up, and nothing outside your business is ever written.',
    where: 'Website settings > Autopilot',
    who: 'An owner or admin changes the level',
    minutes: 4,
    vars: [V.level],
    steps: [
      {
        title: 'Level 1: ' + AUTOPILOT_LEVELS[0].label,
        body: 'Written on its own: only the pages of keywords you chose. Everything else waits for your OK in **Coming up**. Example: you chose "payroll software uae"; we write its pages each week and suggest, but never write, a refresh of your pricing page that is losing visitors.',
      },
      {
        title: 'Level 2: ' + AUTOPILOT_LEVELS[1].label + ' (the default)',
        body: 'Also written on its own: refreshes of your **existing** pages on your topics when they lose visitors or sit at positions 4 to 20, and refreshes that help them appear in AI answers. Example: your page on payroll for small companies drops from position 6 to 14; we refresh it in your next weekly run. New topics still wait for your OK, and your home page and main menu pages are only ever suggested.',
        note: '"On your topics" means the keywords you chose and the services you listed, nothing we guessed from your website.',
      },
      {
        title: 'Level 3: ' + AUTOPILOT_LEVELS[2].label,
        body: 'Also written on its own: new topics that fit your business (rising searches, answer pages for questions you lose in AI answers), and new keywords from your research, each announced ' + PROPOSAL_WAIT_DAYS + ' days before it starts. Example: searches for "wps payroll deadline" rise; a page on it appears in **Coming up** as automatic, and you can still skip it.',
      },
      {
        title: 'Know what does not change',
        body: 'At levels 1 and 2 nothing is written until you have chosen a keyword, except a page you approve yourself. **Pages a week** caps what is written on its own at every level: at 0 nothing is written on its own. The topic check always runs: other companies\' brands, government sites and topics outside what you sell are never written.',
      },
      {
        title: 'Change the level',
        body: 'Open **Website settings > Autopilot**, pick a level and press **Save level**. Your website is at {{level}}. The next weekly run uses the new level, and **Coming up** shows what it means before anything is written.',
      },
      {
        title: 'Know when it lowers itself',
        body: 'If you mark ' + REJECT_LIMIT + ' of the last ' + REJECT_WINDOW + ' pages we chose on our own as **Not what I wanted**, the level drops to 1, the owners and admins get an e-mail, and **Needs you** says why. Raise it again whenever you like.',
      },
      {
        title: 'The suggestion to go up, never a switch',
        body: 'At level 1, after ' + NUDGE_AFTER_PAGES + ' pages published or approved, **Needs you** offers level 2. We never raise it for you.',
      },
      {
        title: 'Credits',
        body: 'Each level shows about how many credits a month it uses with your settings. The company\'s monthly autopilot limit (Company settings > Credits > Limits) still caps the month, whatever the level.',
      },
    ],
    done: 'Website settings > Autopilot shows the level you chose, and the next **Coming up** plan marks as automatic only what that level writes on its own.',
    trouble: [
      { q: 'The level went down on its own', a: 'Pages chosen by us were marked **Not what I wanted** too often. Press **Back to level 2** (or 3) in Website settings > Autopilot when you are ready.' },
      { q: 'A page I did not want is in Coming up', a: 'Press **Skip**, then **Never suggest it again**. Skips always beat the level.' },
    ],
    related: ['coming-up-plan', 'not-what-i-wanted', 'keyword-announcements', 'budget'],
    keywords: ['autopilot', 'level', 'automatic', 'only my keywords', 'healthy', 'full autopilot', 'settings'],
  },
  {
    id: 'your-weekly-cycle',
    area: 'autopilot',
    title: 'Your week: when the work runs',
    why: 'Each website has its own week. Knowing its day, its order and its monthly date tells you when to expect each report and when to decide on the plan.',
    where: 'Pipeline > Your week',
    who: 'Anyone can look; an owner or admin moves the weekday',
    minutes: 4,
    vars: [V.weekday, V.timezone, V.monthlyDate],
    steps: [
      {
        title: 'Your day and time',
        body: 'Your week started the day you finished setup and repeats every 7 days on that weekday: {{weekday}}, from ' + CYCLE_LOCAL_TIME + ' in {{timezone}}.',
      },
      {
        title: 'The order of the week',
        body: 'Each step starts when the one before it is done or skipped: 1 how AI assistants answer your buyers; 2 your backlinks; 3 the rank check of your keyword\'s pages; 4 your site report from Search Console and Analytics; 5 your pages\' readiness for AI answers and sending new pages to Bing; 6 writing the week\'s pages; 7 finding sites that might link to you; 8 the technical audit, in the monthly week only. A step that is switched off is skipped with the reason.',
        note: 'A step that fails 3 times does not hold up the rest. **Your week** and the report say which one did not run and why, and the next week tries again.',
      },
      {
        title: 'What you receive, and when',
        body: '**' + PREVIEW_DAYS + ' days before:** the **Coming up** plan, on the Pipeline and by e-mail to owners and admins. **On the day:** each report lands under **Reports** as its step finishes, the written pages included. If your company set up report delivery, they also arrive by e-mail or webhook.',
      },
      {
        title: 'Your monthly date',
        body: 'Once a month, in the first weekly run on or after {{monthlyDate}}, the week also runs the full AI visibility check, the full backlink report, a check of your entry in Wikidata and the technical audit (when audits are on). Your first week was a monthly week too.',
      },
      {
        title: 'Move your week to another day',
        body: 'Under **Your week**, choose a day in **Move your week to** and press **Change weekday**. The next run moves to that weekday, at least ' + CYCLE_SPACING_DAYS + ' days after the last one started, so two runs never come days apart. You can move it once the first weekly run has started.',
      },
      {
        title: 'Paused, or out of credits',
        body: 'While the website is paused (the **Pause** button on the Pipeline) or the credits are used up, nothing runs. When it resumes, the missed week runs once and your weekday carries on. Missed weeks never pile up. Credits resume the work by themselves when they are added or a new month starts.',
      },
    ],
    done: '**Your week** shows your weekday, the next weekly run and the date of the next **Coming up** plan.',
    trouble: [
      { q: 'The run is marked Late', a: 'It runs as soon as the system is back, once, and the next week is on your usual day.' },
      { q: 'I cannot change the weekday', a: 'Only owners and admins can, and only after the first weekly run has started.' },
    ],
    related: ['coming-up-plan', 'your-journey', 'budget'],
    keywords: ['week', 'weekday', 'cycle', 'schedule', 'monthly', 'time zone', 'calendar', 'when'],
  },
  {
    id: 'coming-up-plan',
    area: 'autopilot',
    title: 'Decide on the Coming up plan',
    why: 'Before each weekly run you see exactly what it will write, with the credits. A minute here is how you steer the autopilot without changing any setting.',
    where: 'Pipeline > Coming up, or the weekly e-mail',
    who: 'Owners, admins and members can decide',
    minutes: 3,
    vars: [V.weekday, V.pageCredits],
    steps: [
      {
        title: 'When it arrives',
        body: PREVIEW_HOURS_BEFORE + ' hours before every weekly run. Your run is on {{weekday}}, so the plan comes ' + PREVIEW_DAYS + ' days earlier. Owners and admins also get it by e-mail. There is none before your very first week: that one starts at setup.',
      },
      {
        title: 'Read the two groups',
        body: '**Written on its own:** pages your level writes automatically; they are written unless you skip them. **Waits for your OK:** suggestions and the pages of a keyword set to **Ask me before each page**; they are written only if you approve them. Each item says why it was chosen and its credits (a page uses {{pageCredits}}).',
      },
      {
        title: 'Skip what you do not want',
        body: 'Press **Skip**, then **This week only** (it can come back in a later plan) or **Never suggest it again** (it never comes back).',
      },
      {
        title: 'Approve what you do want',
        body: '**Approve** puts a waiting page into this week\'s run. Some suggestions offer **Write it now** instead, which writes the page at once as an analysis you start.',
        note: 'Approved pages still respect your pages a week and the pause for pages waiting to be published. One that does not fit is listed under **not used in this run** with the reason.',
      },
      {
        title: 'Or do nothing',
        body: 'That is a valid answer: the automatic pages are written, the waiting ones are not, and nothing else happens.',
      },
      {
        title: 'Know when it closes',
        body: 'When the weekly run starts, its plan closes and can no longer change. Decide on the next plan when it arrives.',
      },
    ],
    done: 'Each item you decided on shows **Approved**, **Skipped this week** or **Never suggested again**.',
    trouble: [
      { q: 'An item says "Checking this keyword again"', a: 'Its plan is more than ' + QUEUED_RECHECK_DAYS + ' days old, so the keyword is checked again before its first page. If it still fits, it is written; if not, the keyword pauses and **Needs you** asks you.' },
      { q: 'An approval was "not used in this run"', a: 'The reason is beside it: your pages a week were already used, pages wait to be published, a page already on your website covers it, or two different pages share the keyword (approve the exact item again).' },
      { q: 'It says nothing is written until I choose a keyword', a: 'At levels 1 and 2 nothing is written on its own before you choose a keyword. You can still approve a suggestion to have it written this week.' },
      { q: 'My decision was refused', a: 'The weekly run had already started. Decide on the next plan.' },
    ],
    related: ['your-weekly-cycle', 'autopilot-levels', 'choose-first-keyword'],
    keywords: ['coming up', 'plan', 'preview', 'approve', 'skip', 'suggestions', 'week'],
  },
  {
    id: 'keyword-announcements',
    area: 'autopilot',
    title: 'A new keyword we announced',
    why: 'At level 3 (full autopilot) we choose your next keyword ourselves, but never silently: it is announced ' + PROPOSAL_WAIT_DAYS + ' days before it starts, and you can stop or change it.',
    where: 'Pipeline > Your next keyword starts soon, and the e-mail',
    who: 'Owners, admins and members can decide',
    minutes: 2,
    vars: [V.pageCredits],
    steps: [
      {
        title: 'Why it was announced',
        body: 'Your website had room for another keyword (a keyword was won, its plan ran out of pages, or none was chosen yet), and you are at level 3. We picked the best keyword from your research that fits what you sell and that no other keyword of yours covers.',
      },
      {
        title: 'Read the card',
        body: 'It shows the keyword, its searches a month, your chances in plain words, why we chose it, the plan, when it starts, and the credits of each page ({{pageCredits}}). Owners and admins also get it by e-mail.',
      },
      {
        title: 'Approve now',
        body: 'It starts at once instead of waiting: the plan arrives in about 5 to 10 minutes, then its first page (once your author profile and business facts are filled in).',
      },
      {
        title: 'Or pick a different one',
        body: 'Choose another suggestion, or type your own keyword. A typed keyword is checked first (5 to 20 seconds) and starts only if it fits your website.',
      },
      {
        title: 'Or skip it',
        body: 'It is never proposed again for this website, and the next one is announced.',
      },
      {
        title: 'Or do nothing',
        body: PROPOSAL_WAIT_HOURS + ' hours after the announcement it starts on its own, from your autopilot credits.',
      },
    ],
    done: 'The card is gone from the Pipeline and the keyword shows as a ladder card (or the next announcement replaced it).',
    trouble: [
      { q: 'I do not want keywords chosen for me', a: 'Lower the level to 1 or 2 in Website settings > Autopilot. A waiting announcement then becomes a suggestion that starts only when you press **Start this ladder**.' },
      { q: 'It did not start', a: 'The card says why, for example not enough credits. Nothing was charged for a start that did not happen.' },
    ],
    related: ['autopilot-levels', 'choose-first-keyword', 'your-journey'],
    keywords: ['announcement', 'proposal', 'next keyword', 'full autopilot', 'level 3', 'approve', 'skip'],
  },
  {
    id: 'keyword-not-planned',
    area: 'autopilot',
    title: 'A keyword that was not planned',
    why: 'Sometimes a keyword comes back with no plan and no pages. It is always for a stated reason, and each reason has a clear next step.',
    where: 'Pipeline > Needs you, and the plan report',
    minutes: 3,
    steps: [
      {
        title: 'Google\'s results could not be read',
        body: 'Our search data provider did not answer, even after several tries. It says nothing about your keyword, nothing was written and **nothing is charged**. Start it again in an hour or so.',
      },
      {
        title: 'Too little data',
        body: 'The research found fewer than 3 related searches, or no search volume at all for the keyword itself. Check the spelling, try a broader wording, or try a keyword closer to what people really search.',
      },
      {
        title: 'Someone else\'s brand, or one particular website',
        body: 'People searching it want one particular company or website, so a page of yours would not be what they look for. The plan report lists easier keywords: start one of those instead.',
      },
      {
        title: 'Outside what you sell',
        body: 'The check found the keyword far from your business. Google rewards websites that stay on their topic. If it is truly yours, add it under **What do you sell?** in the business details and check it again.',
      },
      {
        title: 'You already have a keyword for this search',
        body: 'One search needs one page, so no second plan was made. Continue the existing one from the Pipeline.',
      },
      {
        title: 'Checked again and paused',
        body: 'A keyword that waited in the queue for more than ' + QUEUED_RECHECK_DAYS + ' days is checked again before its first page. If it no longer fits, it is paused and **Needs you** asks you: choose another keyword, or resume it if you still want it.',
      },
    ],
    done: 'The keyword shows as a planned ladder card, or you chose another one in its place.',
    trouble: [
      { q: 'Two of my keywords overlap', a: 'They share searches, and two pages for one search compete in Google. Open the one lower in your list and pause or delete it, or keep each search in one keyword only.' },
    ],
    related: ['choose-first-keyword', 'your-journey'],
    keywords: ['not planned', 'refused', 'no plan', 'failed', 'brand', 'off topic', 'recheck', 'duplicate', 'overlap'],
  },
  {
    id: 'page-not-ready',
    area: 'autopilot',
    title: 'Finish a page that is not ready to publish',
    why: 'A page that did not pass the quality check arrives as a draft to finish, never as a page to publish as it is. Each reason on it tells you exactly what to fill in or fix.',
    where: 'The page\'s report, and Pipeline > Needs you',
    minutes: 15,
    vars: [V.domain],
    steps: [
      {
        title: 'Read the reasons on the report',
        body: 'The red box at the top of the page\'s report lists what the check found, from its last round of editing.',
      },
      {
        title: 'Brackets and masked figures',
        body: 'Text such as **[Price]**, **[Statistic]** or **[name, role]** is a blank for you: a figure we could not source, or a detail only you know. Fill each one in, or rewrite the sentence so it does not need it. **[Confirm: ...]** marks a claim to check before it goes live.',
      },
      {
        title: 'Author details',
        body: 'Bracketed fields in the byline and the author box mean your author profile is not filled in. Fill it in once and every later page carries a real byline.',
      },
      {
        title: 'Sources, subtopics and length',
        body: 'A reason may ask for a source behind a figure, name subtopics the best page for this search covers and this one does not, or give the length against its target. Add the missing parts, or trim.',
      },
      {
        title: 'Prevent it next time',
        body: 'Most of these come from what we do not know about you. A filled **author profile** and **business facts** let pages be published as they are, which is why the first page of a keyword waits for both.',
      },
      {
        title: 'Finish it, then publish it',
        body: 'Edit the copy yourself and put it on {{domain}}, or press **Run it again** under **Needs you** once your profile and facts are in (a new page run uses credits). Then press **I published it** with the address, so we check it live and start tracking.',
        warn: 'Sending a page that is not ready to your website from Alaventra is refused: finish it first.',
      },
    ],
    done: 'The page is live on {{domain}} with no brackets left, and its report shows it as published.',
    trouble: [
      { q: 'I filled everything in and it is still not ready', a: 'The check judges the copy it delivered, not your later edits. Fix the copy by hand, or press **Run it again** for a fresh page written with your new details.' },
      { q: 'The topic itself is wrong', a: 'Press **Not what I wanted** on the report instead, and skip the keyword in the next **Coming up** plan.' },
    ],
    related: ['business-profile', 'business-facts', 'publish-page', 'not-what-i-wanted'],
    keywords: ['not ready', 'quality check', 'draft', 'placeholders', 'brackets', 'confirm', 'author', 'facts'],
  },
  {
    id: 'not-what-i-wanted',
    area: 'autopilot',
    title: 'Mark a page as not what you wanted',
    why: 'It tells us a page missed, so we choose better, and it is the brake on the autopilot: if pages we chose ourselves keep missing, we stop choosing on our own.',
    where: 'The page\'s report: Not what I wanted',
    who: 'Owners, admins and members',
    minutes: 1,
    vars: [V.level],
    steps: [
      {
        title: 'Press Not what I wanted',
        body: 'On the report of a written page, press **Not what I wanted**, add a reason if you like (the topic is not ours, the facts are off, the tone is wrong), and press **Mark it**. You can mark a page once.',
      },
      {
        title: 'Know what it counts towards',
        body: 'Only pages we chose on our own count: refreshes and new topics your level wrote without asking. Pages of keywords you chose, and pages you approved, never lower the level.',
      },
      {
        title: 'Know when it lowers the level',
        body: 'When ' + REJECT_LIMIT + ' of the last ' + REJECT_WINDOW + ' pages we chose on our own are marked, the website goes from {{level}} to level 1, ' + AUTOPILOT_LEVELS[0].label + '. Owners and admins get an e-mail and **Needs you** says why.',
      },
      {
        title: 'Raise it again when you are ready',
        body: 'Open **Website settings > Autopilot** and press **Back to level 2** (or pick another level). Nothing else changes.',
      },
    ],
    done: 'The button reads **Marked as not what you wanted**.',
    trouble: [
      { q: 'I marked a page by mistake', a: 'A mark stays. The level drops only at ' + REJECT_LIMIT + ' marks among the last ' + REJECT_WINDOW + ' pages we chose on our own; if it did, raise it again in Website settings > Autopilot.' },
      { q: 'The button is not there', a: 'It shows on written pages only, for owners, admins and members.' },
    ],
    related: ['autopilot-levels', 'coming-up-plan'],
    keywords: ['reject', 'not what i wanted', 'feedback', 'thumbs down', 'auto pause', 'level'],
  },
] as const satisfies readonly Guide[];

export type GuideId = (typeof GUIDES)[number]['id'];

// built on first use: a top-level Map would keep the whole catalogue in every bundle that imports anything from this file
let byId: Map<string, Guide> | null = null;

export function guideById(id: string | null | undefined): Guide | undefined {
  if (!id) return undefined;
  byId ??= new Map<string, Guide>((GUIDES as unknown as Guide[]).map((g) => [g.id, g]));
  return byId.get(id);
}

export function guidesByArea(area: GuideArea): Guide[] {
  return GUIDES.filter((g) => g.area === area) as unknown as Guide[];
}

/** Values the panel substitutes into a guide: the real domain, record, key file, service account of this website. */
export type GuideVars = Record<string, string | null | undefined>;

export interface FilledCopy extends GuideCopy {
  /** the value still holds an example because the caller had no real one */
  example?: boolean;
}
export interface FilledStep extends Omit<GuideStep, 'copy'> {
  copy?: FilledCopy[];
}
export interface FilledGuide extends Omit<Guide, 'steps'> {
  steps: FilledStep[];
  /** var keys that fell back to their example */
  missing: string[];
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** Replaces {{placeholders}} with the caller's values, falling back to the example declared on the guide. */
export function fillText(text: string, guide: Guide, vars: GuideVars = {}): string {
  return text.replace(PLACEHOLDER, (whole, key: string) => {
    const given = vars[key];
    if (typeof given === 'string' && given.trim()) return given.trim();
    const declared = guide.vars?.find((v) => v.key === key);
    return declared ? declared.example : whole;
  });
}

function usesExample(text: string, guide: Guide, vars: GuideVars): boolean {
  let example = false;
  text.replace(PLACEHOLDER, (whole, key: string) => {
    const given = vars[key];
    if (!(typeof given === 'string' && given.trim()) && guide.vars?.some((v) => v.key === key)) example = true;
    return whole;
  });
  return example;
}

/** A guide with every placeholder resolved, ready to render or to copy. */
export function fillGuide(guide: Guide, vars: GuideVars = {}): FilledGuide {
  const f = (t: string) => fillText(t, guide, vars);
  const missing = (guide.vars ?? [])
    .map((v) => v.key)
    .filter((k) => !(typeof vars[k] === 'string' && (vars[k] as string).trim()));
  return {
    ...guide,
    title: f(guide.title),
    why: f(guide.why),
    done: guide.done ? f(guide.done) : undefined,
    steps: guide.steps.map((s) => ({
      ...s,
      title: f(s.title),
      body: f(s.body),
      note: s.note ? f(s.note) : undefined,
      warn: s.warn ? f(s.warn) : undefined,
      link: s.link,
      choices: s.choices?.map((c) => ({ ...c, body: f(c.body), note: c.note ? f(c.note) : undefined })),
      copy: s.copy?.map((c) => ({ ...c, value: f(c.value), hint: c.hint ? f(c.hint) : undefined, example: usesExample(c.value, guide, vars) || undefined })),
    })),
    trouble: guide.trouble?.map((t) => ({ q: f(t.q), a: f(t.a) })),
    missing,
  };
}

/** Drops the inline markup: **bold** and `code` lose their markers, [label](url) becomes "label (url)". */
export function plainText(markup: string): string {
  return markup
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/** The whole guide as plain text, for the clipboard and for the e-mail to the colleague who has to do it. */
export function guideText(guide: Guide, vars: GuideVars = {}): string {
  const g = fillGuide(guide, vars);
  const out: string[] = [g.title, '', plainText(g.why), ''];
  if (g.where) out.push(`Where: ${g.where}`);
  if (g.who) out.push(`Who can do it: ${g.who}`);
  out.push(`Takes about ${g.minutes} minutes.`, '');
  g.steps.forEach((s, i) => {
    out.push(`${i + 1}. ${plainText(s.title)}`, `   ${plainText(s.body)}`);
    for (const c of s.copy ?? []) out.push(`   ${c.label}: ${c.value}`);
    if (s.link) out.push(`   ${s.link.label}: ${s.link.href}`);
    for (const c of s.choices ?? []) out.push(`   ${c.label}: ${plainText(c.body)}`);
    if (s.note) out.push(`   Note: ${plainText(s.note)}`);
    if (s.warn) out.push(`   Careful: ${plainText(s.warn)}`);
    out.push('');
  });
  if (g.done) out.push(`You know it worked when: ${plainText(g.done)}`, '');
  if (g.trouble?.length) {
    out.push('If it does not work');
    for (const t of g.trouble) out.push(`- ${plainText(t.q)}${/[?.!]$/.test(plainText(t.q)) ? '' : ':'} ${plainText(t.a)}`);
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Guides matching a search box query, best first. Every word has to match the start of a word somewhere in the guide, a search for
 * "app password" must not return the fix pack because its text happens to contain "happens".
 */
export function searchGuides(query: string): Guide[] {
  const q = query.trim().toLowerCase();
  if (!q) return GUIDES as unknown as Guide[];
  const words = q.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]+/gu, '')).filter(Boolean);
  if (!words.length) return GUIDES as unknown as Guide[];
  const hits = (text: string, w: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${w}`, 'iu').test(text);
  const scored = (GUIDES as unknown as Guide[])
    .map((g) => {
      const title = g.title.toLowerCase();
      const keywords = (g.keywords ?? []).join(' ').toLowerCase();
      const rest = `${g.why} ${g.where ?? ''} ${g.who ?? ''} ${g.steps.map((s) => s.title).join(' ')}`.toLowerCase();
      const score = words.reduce((n, w) => n + (hits(title, w) ? 4 : hits(keywords, w) ? 3 : hits(rest, w) ? 1 : -99), 0);
      return { g, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.g);
}

/**
 * Which guide answers a recommendation: the rows on the Recommendations page that ask the person to do something outside the app
 * carry the guide that shows how. Keyed by the recommendation ids built in the server's recommendations service.
 */
export const GUIDE_FOR_RECOMMENDATION: Record<string, GuideId> = {
  'setup:gsc': 'search-console-access',
  'setup:ga4': 'ga4-access',
  'setup:profile': 'business-profile',
  'setup:checkin': 'search-console-checkin',
  'ai:indexnow': 'indexnow-key-file',
  'links:mailbox': 'mailbox-connect',
  'bl:gsc-import': 'search-console-links-export',
  // keyword-first (SCHEDULING_KEYWORDS_PLAN.md §5.3)
  'keyword:research': 'choose-first-keyword',
  'keyword:first': 'choose-first-keyword',
  'content:cadence': 'your-weekly-cycle',
};

/** Recommendations whose id carries the keyword after a fixed prefix (`content:fix:<keyword>`). */
const GUIDE_FOR_RECOMMENDATION_PREFIX: [prefix: string, id: GuideId][] = [
  ['content:fix:', 'page-not-ready'],
  ['content:publish:', 'publish-page'],
];

/** The guide of a recommendation, by its exact id or its prefix; undefined when it asks for nothing outside the app. */
export function guideForRecommendation(id: string): GuideId | undefined {
  return GUIDE_FOR_RECOMMENDATION[id] ?? GUIDE_FOR_RECOMMENDATION_PREFIX.find(([p]) => id.startsWith(p))?.[1];
}

export * from './guide-links';
