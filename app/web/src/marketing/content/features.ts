// The capabilities registry: the single source the marketing pages render from (Home grid, Platform mega-menu, /platform,
// /platform/<slug>, footer). Add every new product functionality here (CLAUDE.md). Copy rules: customer language, plain and
// specific, capability facts only: no invented customers, ratings or results.
import {
  Briefcase,
  Building2,
  ChartLine,
  ChartNoAxesColumnIncreasing,
  FileText,
  Handshake,
  LifeBuoy,
  Plug,
  Rocket,
  Send,
  Link2,
  PenLine,
  Radar,
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
  | 'guided-setup'
  | 'report-delivery'
  | 'integrations'
  | 'growth-loop'
  | 'link-sources'
  | 'ai-engines'
  | 'crawlers'
  | 'agency-portal'
  | 'ai-growth'
  | 'outreach';

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

/** product screens drawn only by the platform pages (see `marketing/components/platform/CapabilityScreen.tsx`) */
export type ScreenKey = 'pipeline' | 'report';

/** "why it matters": the short story told next to the photo or diagram on /platform/<slug> */
export interface Story {
  eyebrow?: string;
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
  /** 4-6 bullets */
  benefits: string[];
  /** 3-4 steps */
  steps: Step[];
  /** 3 capability facts */
  facts: Fact[];
  /** 3-4 questions */
  faqs: FaqItem[];
  related: string[];
  image: ImageKey;
  /** main product visual */
  visual: VisualKey;
  /** optional second visual (diagram) */
  diagram?: VisualKey;
  /** optional product screen that the platform pages show instead of `visual` (other pages keep `visual`) */
  screen?: ScreenKey;
  /** optional "why it matters" story for the feature page */
  story?: Story;
}

export const features: Feature[] = [
  {
    slug: 'autopilot',
    name: 'Autopilot pipeline',
    shortName: 'Autopilot',
    tagline: 'A weekly loop that writes for the keywords you choose. You see the plan before anything is written.',
    summary:
      'Alaventra runs your SEO as a weekly loop that starts the day you sign up. It writes pages only for the keywords you chose, at the level of autopilot you pick, and two days before each week\'s work it shows you the plan in "Coming up", so you can skip or approve every item. It notices what you published and puts every decision that needs a person in one queue.',
    icon: Workflow,
    benefits: [
      'We write only for keywords you choose: type your own, or pick from suggestions that show your chances, the searches a month, why we suggest it and the credits a page. Until you choose, the checks run and nothing is written',
      'Three levels for "How much should we do on our own?": Only my keywords; My keywords and keep my pages healthy (the default, which also refreshes your existing pages on your topics that lose visitors or sit close to page one); Full autopilot (also new topics and new keywords)',
      '"Coming up" two days before every weekly cycle: each page that will be written, why and about how many credits. Skip anything automatic, approve or skip anything waiting for your OK. In the app and by e-mail',
      'On full autopilot, a new keyword is announced two days before it starts, and you can change it or skip it',
      'No page is written until your author profile and business facts are in, so every page arrives with a real byline and facts about your business, never as a draft with blanks to fill',
      '"Not what I wanted" on every written page: if two of the last five pages the autopilot chose on its own are turned down, it drops back to Only my keywords and tells you',
      'Your week starts the day you sign up: the first checks run when setup is finished, then every 7 days on that weekday in your time zone. You can move the weekday',
      'Pages a week for your keywords, from 0 to 3, with the credits a month shown before you save, and Auto or Manual per ladder and per website',
      'A "Needs you" queue for keywords to choose, pages and decisions waiting on a person',
      'A 4-week calendar and every schedule with its next and last run',
      'Notices when a planned page goes live and moves the plan on',
      'A pile-up guard: no new pages while too many wait to be published. Every written page counts, ladder pages included, and they are named',
      'The plan never offers a page you already have: a search one of your live pages answers becomes a refresh of that page',
      'A scheduled run that did not fire (the server was down, say) still runs once it is back, and its report says it ran late',
    ],
    steps: [
      { title: 'Choose your keywords', body: 'Answer "What would a customer type into Google to find a business like yours?", or pick from suggestions with your chances, searches a month and the credits a page.' },
      { title: 'Pick a level', body: 'Only my keywords, My keywords and keep my pages healthy, or Full autopilot. Change it at any time in the website\'s settings.' },
      { title: 'See it coming', body: 'Two days before each weekly cycle, "Coming up" lists every page that will be written, why and its credits. Skip or approve each one.' },
      { title: 'Write, check and learn', body: 'Pages are written and checked on your weekday. When a planned page goes live, Alaventra notices, tracks its rank and plans the next step.' },
    ],
    facts: [
      { value: 3, label: 'autopilot levels, from only your keywords to full autopilot' },
      { value: 2, suffix: ' days', label: 'notice in "Coming up" before each week\'s writing' },
      { value: 'Day 1', label: 'is the day you sign up, then every 7 days' },
    ],
    faqs: [
      {
        q: 'Will Alaventra write about topics I did not choose?',
        a: 'Only if you ask it to. On Only my keywords, it writes pages for the keywords you chose and nothing else; everything else is a suggestion with a price and a "Write it" button. On My keywords and keep my pages healthy, it also refreshes pages you already have, on your topics, when they lose visitors or sit close to page one. Only Full autopilot adds new topics and new keywords, and even then each one shows in "Coming up" first and a new keyword is announced two days before it starts.',
      },
      {
        q: 'What if I have not chosen a keyword yet?',
        a: 'Nothing is written. Tracking, AI visibility, backlinks and the audit still run, and "Needs you" asks for your first keyword with fresh suggestions. You can choose during setup or any time later.',
      },
      {
        q: 'What is "Coming up"?',
        a: 'Two days before each weekly cycle, the plan of what will be written: each page with the reason it was chosen and about how many credits it uses. Automatic items have Skip; items that wait for your OK have Approve and Skip. It is on the pipeline page and arrives by e-mail once a week.',
      },
      { q: 'What happens on Auto or Manual?', a: 'On Auto, a ladder\'s pages are written on your weekday without waiting. On Manual, each page waits in "Needs you" until someone on your team approves it. Nothing is written before that.' },
      {
        q: 'Which day does the work run?',
        a: 'Your week starts the day you finish setting up a website: the first checks run then, and every 7 days after that on the same weekday, from 06:00 in your website\'s time zone. You can move the weekday in the website\'s settings. Monthly work, like the technical audit, runs in the first weekly cycle on or after the day of the month the website started.',
      },
      {
        q: 'Does Alaventra publish to my site by itself?',
        a: 'Not by itself. It sends written pages to your WordPress, Webflow or Contentful (or any other stack through a signed webhook) as drafts, and an owner or admin chooses when one goes live. A page that failed its quality check, or still has text left for you to fill in, is never sent. Alaventra then checks the live page and tracks it. If you would rather not, publishing is one of the done-for-you services on the pricing page.',
      },
      {
        q: 'What if a scheduled run is missed?',
        a: 'It still happens. Alaventra keeps looking for runs that were due and did not start, and starts each one once, so a weekly cycle missed on its day still runs later that week. Its report opens by saying it ran late and when it was due, so a late figure is never mistaken for an on-time one.',
      },
    ],
    related: ['keyword-ladders', 'content', 'site-tracking'],
    image: 'teamPlanning',
    visual: 'growth-loop',
    diagram: 'growth-loop',
    screen: 'pipeline',
    story: {
      eyebrow: 'The weekly loop',
      title: 'Your keywords, your level, no surprises.',
      body: 'Research, plan, write, publish, track and learn run in the same order for every website, on the weekday it started. Pages are written for the keywords you chose, the level you picked decides what else may be done on its own, and the plan arrives two days early so nothing is written you could not see first.',
    },
  },
  {
    slug: 'keyword-research',
    name: 'Keyword research and verdicts',
    shortName: 'Keyword research',
    tagline: 'Find the keywords worth your time, with a clear verdict for each one.',
    summary:
      'Alaventra discovers keywords from your site, your competitors and real search data, then gives each one a verdict. It weighs difficulty for your site (not a generic score) along with topic fit and the plan it takes to rank: Direct, Short or Full.',
    icon: Search,
    benefits: [
      'Keyword discovery from your pages, your competitors and search data',
      'A verdict for every keyword, with the reasons behind it',
      'Difficulty for your site: reach measured against your own domain',
      'A plan type per keyword: Direct page, Short ladder or Full ladder',
      'Topic fit, so you only chase keywords your business can own',
      'A quick keyword check before you commit to a plan',
      'Keywords one of your live pages already answers are marked with that page, so you refresh it instead of writing a second one',
      'The searches you already appear for seed the research: the ones no page of yours answers, and the ones you rank just off page one',
      'Every traffic estimate says whether it was measured on your own site or modelled from provider volume',
      'Searches Google answers with the same pages are grouped, so one page targets the whole group',
      'A topic radius with every research run: the topics within reach for your site, the ones that are a stretch and the evidence behind each verdict',
      'Suggestions in plain words when you set up a website: "Good chance", "Takes a few months" or "Hard for your website now", with the searches a month, why we suggest it, the plan and about how many credits a page',
      'The research behind your first suggestions is free, once per website, at setup: it starts in the background while you fill in the rest',
    ],
    steps: [
      { title: 'Describe the business', body: 'Your website, market and goals set the context for every keyword Alaventra looks at.' },
      { title: 'Discover', body: 'Candidates come from your own Search Console searches, your pages, your competitors, search volumes and trends in your market.' },
      { title: 'Judge', body: 'Each keyword gets reach for your site, topic fit, search intent and a plan type.' },
      { title: 'Act', body: 'Start a ladder, write a single page or keep the keyword for later.' },
    ],
    facts: [
      { value: 3, label: 'plan types: Direct, Short and Full' },
      { value: 1, label: 'verdict per keyword, with its reasons' },
      { value: 4, label: 'signals per keyword: reach, topic fit, intent and plan' },
    ],
    faqs: [
      {
        q: 'What does "difficulty for your site" mean?',
        a: 'Generic difficulty scores ignore who is trying to rank. Alaventra compares the competition for a keyword with your own site and tells you whether it is within reach now or only after supporting pages.',
      },
      {
        q: 'What are Direct, Short and Full plans?',
        a: 'Direct: one strong page can rank. Short: a few supporting pages come first. Full: a complete ladder of supporting pages that climbs to the keyword.',
      },
      { q: 'Can I bring my own keywords?', a: 'Yes. Type a keyword and Alaventra checks it in a few seconds, or pick from the keywords it suggests. Pages are written automatically only for keywords you choose.' },
      {
        q: 'What do I see when I set up a website?',
        a: 'One question: "What would a customer type into Google to find a business like yours?" Type up to three ideas and each is checked, or take our suggestions. Each one shows your chances in plain words ("Good chance", "Takes a few months" or "Hard for your website now"), about how many people search it a month, why we suggest it, the plan (how many pages over how many months) and about how many credits a page. Pick one, or choose later: until you do, the checks run and nothing is written.',
      },
      { q: 'Which markets are covered?', a: 'Your website\'s main country sets the market for every run and every weekly check, and volumes and results come from that market. A run for another country, or a keyword about another place, is flagged first: accept the correction or continue anyway.' },
      {
        q: 'How does my own Search Console data change the research?',
        a: 'Once your website is connected, the searches it already gets impressions for are the starting point: the ones no page of yours answers become new page ideas, and the ones you rank between eighth and twentieth for become pages to strengthen. Where a search is already measured on your site, the traffic estimate is calibrated against your real impressions and clicks and labelled as measured; everywhere else it is labelled as modelled.',
      },
      {
        q: 'Why are some keywords grouped together?',
        a: 'When Google answers two searches with the same pages, they want one page, not two. Alaventra compares the results pages it reads and groups searches that share at least three of the same top-ten results, naming the group after its main keyword.',
      },
    ],
    related: ['keyword-ladders', 'content', 'site-tracking'],
    image: 'notesLaptop',
    visual: 'keyword-verdict',
    story: {
      title: 'A call you can act on, not another list.',
      body: 'Most keyword tools hand you thousands of rows and a generic difficulty score. Alaventra makes a call on each keyword, explains it and measures it against your own site, so the next decision is clear: write one page, build a ladder or leave it for later.',
    },
  },
  {
    slug: 'keyword-ladders',
    name: 'Keyword ladders',
    shortName: 'Keyword ladders',
    tagline: 'Rank for a hard keyword by climbing to it, one supporting page at a time.',
    summary:
      'Tell Alaventra the keyword you want to rank for. It builds a ladder of easier, related pages that earn relevance first, each linking up to the page for the head term. It writes the rungs in order, tracks every position weekly and keeps ladders from competing with each other.',
    icon: ChartNoAxesColumnIncreasing,
    benefits: [
      'A plan of supporting pages that climbs to your head term',
      'Pages written in order, each linking up the ladder, only to rungs that are already live',
      'Weekly rank tracking for every rung and for the head term, with a reminder the week a rung goes live and its link can be added',
      'The keywords you named when you set tracking up are tracked too, in their own weekly report with the same depth, and a keyword that is also a rung is checked once, with the ladder',
      'Every check records the whole results page: AI Overview (and whether it cites you), featured snippet, People Also Ask, local pack and video',
      'The other sites on page one with their positions, the competitors ranking above you and a share-of-voice estimate per keyword',
      'Your main keywords are checked on a phone as well as on a desktop, because the two rarely match',
      'The top ten results are kept with every check, so you can see what the page looked like when the position was read',
      'Two of your pages competing for one search are flagged, with both named and the one Google shows today',
      'Your page\'s own drop is told apart from a reshuffle of the whole results page, and the site that took your place is named',
      'Share of voice across your keywords weighted by your real Search Console impressions',
      'Choosing the keyword is the go-ahead for its ladder: "Write a page each week" (Auto) or "Ask me before each page" (Manual), with your weekday named',
      'Ladders start only on keywords you chose. On Full autopilot, a keyword Alaventra picks is announced two days before its ladder starts, and you can change it or skip it',
      'Auto or Manual per ladder, with a priority order',
      'Two active ladders at a time by default, so effort is not spread thin',
      'No keyword overlap between ladders, so your own pages never compete',
      'A rung you already have a page for is planned as an improvement of that page, with its real address, never as a second page',
      'Searches Google answers with the same pages become one page, not two: before planning, Alaventra reads the results page for each supporting keyword and groups the ones that share them',
      'A keyword whose results page could not be read is named in the plan and left in its own group, and is never merged or quietly dropped',
      'How many different websites own the results page for your head term is counted and stated, and a page owned by a few of them is reflected in how realistic the plan says it is',
      'Your topic radius with every plan: which topics are within reach for your site today, which are a stretch and why (the difficulty against the level you already win, a position you already hold, a page you already have, a service you sell)',
      'A ladder that has not moved for weeks comes back with a proposal: improve the page you already have, write the easier keyword first, change the order, or stop, with the evidence behind it. It is a suggestion; your plan is never rewritten for you',
    ],
    steps: [
      { title: 'Choose the keyword', body: 'Pick a recommended keyword or type your own. Alaventra shows the reach for your site and the plan type.' },
      { title: 'Get the plan', body: 'See the rungs, the order they are written in and how they link to each other.' },
      { title: 'Climb', body: 'Rungs are written and published one by one, and every position is checked weekly.' },
      { title: 'Reach the top', body: 'When the head term ranks, the ladder is marked as won and your next queued ladder starts. With none queued, you get fresh suggestions for your next keyword.' },
    ],
    facts: [
      { value: 2, label: 'active ladders at a time by default' },
      { value: 'Weekly', label: 'rank checks for every rung' },
      { value: 'Desktop + phone', label: 'checks for your main keywords' },
      { value: 0, label: 'keyword overlap between ladders' },
    ],
    faqs: [
      {
        q: 'Why not write the main page first?',
        a: 'For a hard keyword, a new page rarely ranks on its own. Supporting pages on related, easier keywords build relevance and internal links first. If you need the main page now, choose "Write it first".',
      },
      {
        q: 'What is the pile-up guard?',
        a: 'If too many written pages are waiting to be published, Alaventra pauses new writing until you catch up, so drafts do not pile up.',
      },
      { q: 'How many ladders can I run?', a: 'As many as you plan. By default two are written at once, in your priority order, and you can change the limit. A queued ladder planned more than two months ago gets a fresh keyword check before it starts, so it is never written on stale results.' },
      {
        q: 'Can Alaventra choose the keyword for me?',
        a: 'It suggests keywords at every level, each with your chances, the searches a month and the credits a page, and you start the ladder. Only on Full autopilot does it start one itself: the keyword is announced two days before, with Approve now, Pick a different one and Skip.',
      },
      { q: 'What does Auto or Manual change?', a: 'On Auto, rungs are written on your website\'s weekday, and each one shows in "Coming up" two days before. On Manual, each rung waits for approval in "Needs you".' },
      {
        q: 'Do you track AI Overviews?',
        a: 'Yes. Every rank check records whether an AI Overview was on the page and whether it cited your site, with the time it was seen. AI Overviews vary between searches, so Alaventra reports what the check saw rather than claiming the search always looks that way.',
      },
      {
        q: 'What is share of voice?',
        a: 'An estimate of how much of the attention page one offers goes to your site, weighted by position and by the features on the page. It is a model built on published click-through rates, not measured clicks, and it is always labelled that way.',
      },
      {
        q: 'Why check on a phone too?',
        a: 'Mobile and desktop results differ for most searches, so a desktop-only position can be one your visitors never see. Alaventra checks your main keywords on both and shows the two side by side.',
      },
    ],
    related: ['keyword-research', 'autopilot', 'content'],
    image: 'growthChartPaper',
    visual: 'ladder',
    story: {
      title: 'Hard keywords are won with structure, not one page.',
      body: 'Search engines trust sites that cover a topic in depth. A ladder builds that depth in a deliberate order (easier pages first, each linking up) so the page for your head term arrives with relevance and internal links already behind it.',
    },
  },
  {
    slug: 'content',
    name: 'Content engine',
    shortName: 'Content',
    tagline: 'Long-form pages written, critiqued and edited by AI, with SEO QA before you see them.',
    summary:
      'Every page goes through a writer, a critic and an editor, then an SEO check that measures it against the best page in the results and compares it, word for word, with the pages it was researched from and with your own. Pages carry real expertise signals (an author byline, an expert reviewer, your experience notes and schema) and arrive as a publish-ready package with their three images already made.',
    icon: PenLine,
    benefits: [
      'Writer, critic and editor passes, then an SEO quality check',
      'E-E-A-T built in: author byline and box, expert reviewer, experience notes and schema',
      'Your house style, stored once and followed: how your name is written, British or American spelling, words to avoid and the tone. Your own name written the wrong way is corrected before delivery',
      'Page types for hub and pillar pages, case studies, local (city) pages and video pages',
      'Three images produced with every page: a title card and two section cards made from the page itself, with the alt text, file names and the social image',
      'An originality check against every competitor page the research read and against your own pages: more than 15% of a page matching one of them comes back for a rewrite, with the passage shown',
      'A coverage target taken from the best page in the results, not an average, with the subtopics it covers and yours still missing',
      'A blog package as HTML, Markdown and meta.json, or sent straight to your CMS: WordPress, Webflow, Contentful, or any other stack through a signed webhook',
      'Drafts by default: only an owner or admin publishes a page live, after confirming it; sending again updates the same post, never a second one',
      'A page that did not pass its quality check, or still holds a bracket left for you, cannot be sent to your CMS; the gaps are listed instead',
      'Links only to pages that are already live, with link text that reads like a title; pages still to come are listed as links to add later',
      'Every figure looked up in the source the page cites, and a source without independent authority cited at most once',
      'A live check of the published page: schema, images, links and metadata',
      'One search, one page: a search a live page of yours already answers is written as a refresh of that page',
      'Check any page before you publish: paste a page (or send it from your build) and get the same quality verdict our own pages must pass (placeholders, invented prices, unsourced figures, coverage, readability, a direct answer first), with every reason named and what could not be checked. Free, and nothing is stored',
      'Refreshed pages re-check their facts: the cited sources are read again, and figures a source no longer states are flagged',
      'Readability measured against the pages that rank for your search, not against a fixed score',
      'Each page says plainly where it stands: ready to publish and waiting for your OK, ready and stronger with your input, or not ready and why, with the grade of the page you actually receive',
      'Questions only you can answer, ranked by how much they matter: the top three first, the rest optional, most of them filled in from your own website so one click answers them',
      'Nothing waits on you: a page is publishable without your answers, because anything we could not check is said in general words until you confirm it, edit it or remove it',
      'Every answer is kept in your business details and used on every later page, so you are never asked the same thing twice',
      'Your final version made for you: after you answer, only the parts your answers change are rewritten and the whole page is checked again',
      'Edit the page yourself in the app, headings, paragraphs, lists, tables and links, with a preview, a comparison with the version we delivered, undo and a check before you publish',
      'One click to approve, then send it to your website or publish it yourself and we check it live',
    ],
    steps: [
      { title: 'Brief', body: 'Keyword, intent and outline, with facts from your business profile, your case studies and your style guide.' },
      { title: 'Write and critique', body: 'A draft, a critic\'s review and an editor\'s pass that acts on it.' },
      { title: 'Check', body: 'SEO checks on every page, against a coverage target read off the best page in the results. Every figure is looked up in the source it cites, and anything that is not there is marked for you to confirm. A page that repeats a competitor or one of your own pages goes back for a rewrite.' },
      { title: 'Answer and approve', body: 'Answer the few questions only you can answer (most are one click), change anything you like in the editor, and we make the final version. Then approve it in one click.' },
      { title: 'Publish and verify', body: 'Send the page to your CMS as a draft (or publish it live if you are an owner or admin), or take the package. Alaventra checks the page once it is live and starts tracking it.' },
    ],
    facts: [
      { value: 3, label: 'passes: writer, critic and editor' },
      { value: 4, label: 'special page types' },
      { value: 3, label: 'images produced per article' },
    ],
    faqs: [
      {
        q: 'Will the pages read like generic AI text?',
        a: 'Each page is written from a brief built on your business profile, your experience notes and your case studies, then reviewed by a critic and an editor. Figures that cannot be verified are marked for you to confirm instead of being made up.',
      },
      {
        q: 'What if a page says something about us that you could not check?',
        a: 'It never claims it. The page uses general words instead and you get a question: keep the specific sentence, change it or remove it, or leave it general. You can publish without answering. Your answer is kept in your business details, so later pages use it and never ask again.',
      },
      { q: 'Who is shown as the author?', a: 'The author and expert reviewer from your business profile, with a byline, an author box and Person schema.' },
      {
        q: 'Can I tell it how we write?',
        a: 'Yes. Your profile holds a style guide: exactly how your name is written (Tech&, never "Tech and" or "techand"), British or American spelling, the words you never want used and the tone. Every page is written to it, and the quality check reads the finished draft against it. Your own name written the wrong way is a real finding and is corrected before you see the page; the spelling variant, the banned words and the tone are reported beside the page as advice, and never hold a page back on their own.',
      },
      {
        q: 'Which spelling do the pages use?',
        a: 'The spelling of the country each page targets, unless your style guide names one; then that wins everywhere. The report says which rule was used.',
      },
      {
        q: 'Can Alaventra publish to our CMS?',
        a: 'Yes, to WordPress (with Yoast SEO or Rank Math fields when your site exposes them), Webflow and Contentful, and to anything else through a signed webhook. Pages go as drafts by default; only an owner or admin can publish one live, and only after ticking a confirmation. Pages that did not pass the quality check, or still have text to fill in, are refused with the reasons.',
      },
      { q: 'What is the blog package?', a: 'The article as HTML and Markdown, the three images as WebP files, plus a meta.json file with the title, description, slug, schema and the image list, ready for any CMS.' },
      {
        q: 'How do you know the page is not copied?',
        a: 'Every finished draft is compared with the competitor pages the research read and with your own pages, in runs of eight words. More than 15% matching a single page fails the quality check and the page is rewritten; the report tells you which page, by how much and which passage.',
      },
      {
        q: 'Where do the images come from?',
        a: 'They are generated from the page itself (a title card with your business name and two cards that lay out the points of a section), at the planned sizes and file names, with the alt text. Swap any of them for a photo of your own; the file name and alt text stay.',
      },
    ],
    related: ['keyword-ladders', 'autopilot', 'technical-audits'],
    image: 'colleaguesReview',
    visual: 'content',
    story: {
      title: 'Pages that show real expertise.',
      body: 'Readers and search engines look for experience, expertise and trust. Alaventra writes from your business profile, names a real author and reviewer, cites your own case studies, marks every figure it cannot verify for you to confirm, and checks that the finished page is not a rewording of the pages it researched or of a page you already have.',
    },
  },
  {
    slug: 'technical-audits',
    name: 'Technical audits',
    shortName: 'Technical audits',
    tagline: 'Crawl the site, read Search Console and get a fix pack with the files to change.',
    summary:
      'Alaventra crawls up to 1,000 pages, JavaScript included, and combines what it finds with Search Console index coverage and sitemaps, the Core Web Vitals your real visitors measured and a brand and entity check. The fix list is ordered by the traffic each issue puts at risk, every audit ends with a fix pack your developers can apply, and monthly audits show what changed since the last one.',
    icon: ScanSearch,
    benefits: [
      'Crawls of 200, 500 or 1,000 pages, with JavaScript rendering',
      'Search Console index coverage, submitted sitemaps and site structure',
      'Core Web Vitals from real Chrome visitors, per template, on phone and desktop',
      'A daily check of your key pages: you hear the same day when one disappears, is set to noindex, starts redirecting or changes its canonical, title or robots.txt',
      'A pre-release check your build can call: the same page checks run against a staging address or a list of URLs and answer pass or fail, so a release never takes a page out of Google',
      'Mark a fix done and that one issue is re-checked the next morning, not at the next monthly audit',
      'The fix pack comes with a guide for putting each file where it belongs: robots.txt, llms.txt, redirects, schema and the internal links',
      'Google\'s own view of every key page: indexed or not, the canonical Google chose, its last crawl, mobile usability and rich results',
      'What crawlers see before JavaScript runs: your key pages read twice, so anything only a browser can see is named',
      'The same before-and-after comparison runs across the crawl, on up to 25 pages, not only on your key pages',
      'Hreflang checks for the language versions of your pages',
      'With GA4 connected, the fix list can weigh each problem by the key events of the pages it affects, and says which weight it used',
      'The pre-release check takes a severity threshold and a list of the changes you meant to make, and fails only on what is left, with a ready recipe for your build pipeline',
      'Every audit and finding (severity, evidence, the pages checked, new or fixed since the last audit), readable from your own scripts, BI tool or AI assistant through a read-only API',
      'A fix list ordered by the traffic each issue puts at risk, with the reason shown',
      'The smallest items folded into one "minor items" line, so the list you read is the list to act on',
      'A brand and entity check',
      'A fix pack: robots.txt, llms.txt, redirects, schema and an internal-links CSV',
      'Monthly scheduled audits with what changed since the last audit',
      'Skipped automatically when nothing on the site has changed',
    ],
    steps: [
      { title: 'Crawl', body: 'Up to 1,000 pages, rendered with JavaScript where the content needs it.' },
      { title: 'Combine', body: 'Crawl findings meet Search Console coverage, sitemaps, the speed your real visitors measured and entity data.' },
      { title: 'Prioritise', body: 'Issues are ranked by the traffic they put at risk (index blockers first, cosmetics never), and each one says why it ranks there.' },
      { title: 'Fix', body: 'Download the fix pack and hand it to your developers.' },
      { title: 'Watch', body: 'Your key pages are checked every morning, and marking a fix done has it re-checked within a day.' },
      { title: 'Check before you ship', body: 'Your build calls the pre-release check on the staging address and gets a pass or fail before the release goes out.' },
    ],
    facts: [
      { value: 1000, label: 'pages per crawl, JavaScript included' },
      { value: 5, label: 'files in every fix pack' },
      { value: 1, label: 'check of your key pages every day' },
    ],
    faqs: [
      {
        q: 'Do monthly audits use credits when nothing changed?',
        a: 'No. Alaventra compares your sitemap with the last audit and skips the crawl when nothing changed, with a full audit at least every 60 days.',
      },
      { q: 'What is in the fix pack?', a: 'A robots.txt, an llms.txt, a redirect list, schema snippets and an internal-links CSV, zipped together.' },
      { q: 'Does it need access to my server?', a: 'No. Alaventra crawls the public site and reads Search Console through a service account you add as a user.' },
      { q: 'Does it handle JavaScript sites?', a: 'Yes. Pages can be rendered with JavaScript, so content that loads in the browser is audited too.' },
      {
        q: 'Would I know if my pages only work with JavaScript?',
        a: 'Yes. Your key pages are read twice in every audit: once exactly as a crawler receives them, before any script runs, and once after. The report puts the title, main heading, canonical link, robots rule, link count and text length of both readings side by side and says which reading each number came from, so anything only a browser can see is named, because it is invisible to the AI crawlers behind ChatGPT, Perplexity and Claude, which do not run JavaScript. A page we could not read both ways is reported as not checked, with the reason, never as fine.',
      },
      {
        q: 'Where do the speed figures come from?',
        a: 'From the Chrome User Experience Report: what real Chrome visitors measured over the last 28 days, at the 75th percentile, for your home page, a service page and a blog post on phone and desktop. A page with too few visits to report on its own shows the whole-site figures, marked as such. Speed carries a deliberately low weight in the health score.',
      },
      {
        q: 'What does the daily check of my key pages look at?',
        a: 'Every morning Alaventra fetches your most important pages (the home page, the pages in your menu, the pages Search Console brings impressions for and the pages your keyword ladders own) and compares the HTTP status, a redirect that appeared, the noindex tag, the canonical and the title with yesterday\'s reading, plus your robots.txt. A change that matters becomes an alert the same day; an unchanged page says nothing. A page it could not read is reported as not checked, never as fine.',
      },
      {
        q: 'Can we check a release before it goes live?',
        a: 'Yes. Your build can call the pre-release check with a staging address or a list of URLs, and it answers pass or fail in a form a build pipeline can read: which URL failed and which check (the page not answering, a redirect that appeared, a noindex tag, robots.txt blocking it, a missing or wrong canonical, no title or no H1). On a staging address a deliberate noindex or a blocking robots.txt is reported as a warning that names the live page instead of a failure. The check only reads: it never changes anything in your account, and whatever a staging address cannot answer (whether Google has indexed a URL it has never seen, the speed real visitors measure, positions) is reported as not checked, with the reason.',
      },
      {
        q: 'I fixed something. Do I have to wait for the next audit?',
        a: 'No. Mark it fixed in the dashboard and the next daily check judges that exact issue on your key pages, usually within a day, and shows you the result. Issues that need the full crawl, Search Console or speed data say so instead of guessing, and those wait for the next audit.',
      },
      {
        q: 'How do you know whether Google has indexed a page?',
        a: 'Alaventra asks Search Console\'s URL Inspection about your key pages: whether the page is in the index and why not, which canonical Google chose against the one your page names, when Google last crawled it, mobile usability and the rich results it detected. Google allows 2,000 of these a day per property, so the pages rotate with the oldest inspection first, and whatever a run did not reach is shown as not checked rather than assumed fine.',
      },
      {
        q: 'How is the fix list ordered?',
        a: 'By likely impact: the severity of the issue, the share of pages it affects, and the clicks and impressions those pages get in Search Console. Issues that stop Google indexing a page come first, cosmetic items are never at the top, and every item says why it sits where it does.',
      },
      {
        q: 'What happens to the tiny issues?',
        a: 'They are folded into one "minor items" line with the count: a title one character too long, the link count of a navigation page, a cosmetic tag. Nothing is removed: they still count in the score, they are stored with the audit, and they open with one click in the app and sit in that one line in the report.',
      },
    ],
    related: ['site-tracking', 'content', 'reports'],
    image: 'analyticsMonitor',
    visual: 'audit',
    story: {
      title: 'Findings your developers can apply the same day.',
      body: 'An audit only helps once it is fixed, and only if you fix the right thing first. Issues are ranked by the traffic they put at risk, every audit delivers the files developers need, and the next audit shows what changed, so progress is visible, not assumed.',
    },
  },
  {
    slug: 'site-tracking',
    name: 'Site tracking',
    shortName: 'Site tracking',
    tagline: 'Search Console, GA4 and Google Trends in one weekly view, with what to do next.',
    summary:
      'Connect Search Console and GA4 once. Every week Alaventra pulls clicks, impressions, positions and conversions, follows Google Trends for your topics and checks live rankings, then points at striking-distance keywords, the ones close to page one.',
    icon: ChartLine,
    benefits: [
      'Google Search Console and GA4, connected through a service account',
      'Google Trends for your topics and live rank checks that also record the search features on the page and who ranks above you',
      'Striking-distance keywords: close to page one and worth a push',
      'Your own keyword list gets a weekly ranking report of its own: the ten whose reading is oldest are checked live, the rest are read from the check already taken, and every keyword the week\'s limit did not reach is listed with the date it was last read',
      'A weekly report with the changes that matter, on your website\'s own weekday',
      'Notices when you publish a page from the plan',
      'A weekly list of the pages your site has, so the advice says "refresh this page" instead of "publish another one"',
      'Pages losing traffic are tested, not guessed: a fall counts only when it is beyond chance and the page is not simply quieter at this time of year than it was last year',
      'Every chart marked with what happened: pages you published, technical fixes, Google updates and breaks in Google\'s own data',
      'After a page goes live, its trend is compared with the rest of your website, so you hear whether the change likely helped',
      'Discover and Google News traffic shown where your site has it',
      'Group your pages (blog, services, product) and see how each group does, judged on the same statistical bar as every alert',
      'Brand demand in one place: branded searches, direct visits and visits from AI assistants side by side, each with its source',
      'The latest days on their own line, marked as still being collected',
      'Your own dated notes as marks on the charts',
      'Dashboards per website for search, traffic, rankings and content',
      'Every connection has a guide: Search Console, Analytics and the property ID, step by step, with your own values ready to copy',
    ],
    steps: [
      { title: 'Connect', body: 'Add Alaventra\'s service account to Search Console and choose your GA4 property.' },
      { title: 'Collect', body: 'Search, traffic, trends and live rankings are gathered every week.' },
      { title: 'Compare', body: 'Week over week, with striking-distance keywords called out.' },
      { title: 'Act', body: 'Recommendations flow into the pipeline, each with its credits, and pages for your keywords are planned from them.' },
    ],
    facts: [
      { value: 3, label: 'Google sources: Search Console, GA4 and Trends' },
      { value: 'Weekly', label: 'report, on your website\'s weekday' },
      { value: 'Live', label: 'rank checks where Search Console has no data' },
    ],
    faqs: [
      { q: 'What access does Alaventra need?', a: 'You add Alaventra\'s service account as a user in Search Console and GA4. It reads your data; it does not change your settings.' },
      {
        q: 'What if nobody here has done this before?',
        a: 'Every ask in Alaventra has a "Show me how" button next to it. It opens the job as numbered steps you tick off, with your own values in copy boxes, the page to open, and tabs for the provider or CMS you actually use. If the person who can do it is someone else (whoever manages your DNS, usually), one button sends them the whole thing by e-mail, values filled in, no account needed.',
      },
      {
        q: 'What is a striking-distance keyword?',
        a: 'A keyword where your page already ranks just below the top results. Small improvements there tend to pay off fastest, so they are suggested early. On the level that keeps your pages healthy, a page of yours on your topics that sits close to page one is strengthened in the weekly cycle, after it has appeared in "Coming up".',
      },
      { q: 'How often is the data refreshed?', a: 'Every week, with live rank checks for keywords Search Console does not report.' },
      {
        q: 'When does a drop become an alert?',
        a: 'When the change is real: a fall is only called a fall once it is beyond normal week-to-week variation. On a small site, where a big percentage can be chance, you still get the alert, worded as something to watch, with both weeks\' counts named so you can see how small the numbers are.',
      },
      {
        q: 'How does Alaventra know I published a planned page?',
        a: 'Each week it looks for the page in your sitemap by its slug and title. Once found, the page is checked live and its ranking is tracked from then on.',
      },
      {
        q: 'Why is my chart marked in mid-September 2025?',
        a: 'That is when Google stopped serving a hundred results on one page, which removed most SEO tools from the counts. Impressions fell and average positions improved on nearly every website without anything changing on the site, so figures either side of that week are not comparable. Charts mark it, along with Google\'s ranking updates, the pages you published and the technical fixes you made.',
      },
      {
        q: 'Can Alaventra tell me whether a change worked?',
        a: 'It compares the page you changed with the rest of your website over the same weeks, which removes the part of the move that was the season or a Google update, and reports "likely helped", "possibly helped", "no clear effect yet" or "can\'t tell". It never claims a change caused a move: a comparison like this narrows the alternatives, it does not prove a cause.',
      },
    ],
    related: ['reports', 'keyword-ladders', 'technical-audits'],
    image: 'analyticsLaptop',
    visual: 'dashboard',
    story: {
      title: 'One weekly view instead of four dashboards.',
      body: 'Search Console, GA4 and Google Trends each answer a different question. Alaventra reads them together every week, checks live rankings where Search Console is silent and points at the keywords closest to page one.',
    },
  },
  {
    slug: 'ai-visibility',
    name: 'AI search visibility',
    shortName: 'AI visibility',
    tagline: 'See how often ChatGPT, Gemini, Perplexity, Claude and Google\'s AI name and cite you.',
    summary:
      'Alaventra asks a panel of up to 500 real buyer questions (by topic, buyer role and market) to six AI engines (nine with Copilot and the ChatGPT and Gemini APIs) and records who is named and cited. A daily AI Pulse watches for changes and alerts only when they are statistically real, and GA4 shows the visits and revenue AI answers send you.',
    icon: Sparkles,
    benefits: [
      'A panel of up to 500 buyer questions, written for each buyer role and market from real AI-answer data, Google\'s "People also ask", your Search Console queries and your competitors\' topics, every one checked so it never names another company or a government service',
      'Rates per topic, buyer role, market and engine, each with its 95% range, and "too few answers" where a group has not been asked enough to say',
      'Import your own question list as CSV, pin the questions that matter, edit, re-word or switch any question off',
      'Your questions follow the keywords you work on: a new keyword gets its questions the week it starts, topics you left are retired with their history kept, your own questions are never changed, and a bigger panel is always your choice',
      'ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews, with Microsoft Copilot and the ChatGPT and Gemini APIs on request',
      'A big panel is asked in full every week and as a rotating sample every morning, so every topic and buyer role is in every daily reading, and the credits it uses a month and the precision it buys are shown before you save',
      'Mention rate, citation rate and share of voice against competitors, with 95% ranges',
      'A daily AI Pulse that alerts only on statistically real changes',
      'Visits, key events and revenue from AI referrals in GA4',
      'Answer Analyst for sentiment and wrong claims, plus AI crawler access and llms.txt',
      'Every rate counts the answers that came back, and the report names any request that failed and was sent again',
      'Wrong claims are checked against your business facts. With no profile on file, the report says "not checked", never "nothing wrong"',
      'The one file that gets new pages to Bing (and so to Copilot) comes with a guide for whichever platform your site runs on',
      'Every alert is a tested change: a drop in one assistant is judged on that assistant\'s own answers, all of one week\'s alerts are corrected together so a quiet week stays quiet, and every rate shows its range (each buyer question\'s and brand recognition included)',
      'See how precise your AI visibility figures will be for each number of questions, with or without the daily check, before you choose',
      'When AI gets a fact about your business wrong, you see the wrong claim, the true answer from your profile and the pages that carry it, with a correction drafted for you to review. Nothing is sent without you, and with no true fact on file we ask you for it instead of guessing',
      'Every key page is also checked the way ChatGPT, Perplexity and Claude\'s fetchers see it, so a firewall rule that quietly turns AI assistants away is flagged as a high-priority fix',
      'Upload Bing\'s AI Performance export for your real Copilot citations, and Search Console\'s AI figures, from the AI visibility page: they are shown as your own exports, with their dates, and never blended into the rates we measure. A file whose pages belong to another website is refused',
      'Open any answer to read what the assistant said: the whole answer, the brands in the order it named them with yours marked, every source it cited in order, the pages it read but did not cite and the searches it ran first',
      'Open any question to see every assistant\'s answer side by side, and how often it has named you across your past checks, with the range',
      'One filter for the whole page: engine, topic, buyer role, market, stage and dates, kept in the link so a filtered view can be shared',
      'Each assistant and each competitor over time, with the range; a line stops where a check asked different questions or other assistants, and the break says why',
      'Download the answers, the question panel, the sources, competitors over time and your pages as CSV, for the same filter',
      'Select many questions at once to switch them off or on, pin them, give them a topic or delete them; import a keyword with each question',
      'Your own alert rules, for example "ChatGPT names us 5 points less often", with a preview of how often each would have fired on your past checks. A rule fires only on a like-for-like check and only when the change is beyond normal variation',
      'The same figures and answers through the API and to AI assistants over MCP',
      'Ranges that allow for the answers to one question moving together, so a small panel never looks more precise than it is',
      'Share of voice against a fixed set of brands you choose, with every other brand counted as "others", so a new rival cannot quietly shrink your share',
      'Rates per topic, buyer role and market over the last 28 days, so a small group has enough answers to read',
      'Did it work: for a page you published or a question you targeted, how often AI named you in the 28 days before and after, compared with similar questions nothing touched, with a range. It says "likely helped", "likely hurt" or "can\'t tell", never that it caused the change',
      'Optional checks, each priced in credits before you switch it on: Claude every week, more assistants in the daily check, and whether you rank on Google for the searches assistants run before they answer',
      'A one-off repeat test measures how much each assistant\'s answer changes when the same question is asked again, and how many asks a week each question needs. It is priced first and runs only when you confirm',
      'A check you start yourself is quoted for your whole question panel with the options you switched on, and that quote is what your credits are checked against',
    ],
    steps: [
      { title: 'Build the panel', body: 'Up to 500 questions your buyers ask, by topic, buyer role, market and stage.' },
      { title: 'Ask every engine', body: 'ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews (plus Copilot and the ChatGPT and Gemini APIs if you want them) on a schedule.' },
      { title: 'Measure', body: 'Mentions, citations and share of voice, each with a 95% range so noise is not news.' },
      { title: 'Act', body: 'Value-ranked actions, the sources AI engines trust and the claims to correct.' },
    ],
    facts: [
      { value: 500, label: 'buyer questions per panel' },
      { value: 9, label: 'AI engines and answer surfaces' },
      { value: 95, suffix: '%', label: 'ranges on every rate' },
    ],
    faqs: [
      {
        q: 'Is this what people call GEO or AEO?',
        a: 'Yes, the measuring half of both. GEO (generative engine optimization) is being named and cited by ChatGPT, Gemini, Perplexity, Claude and Copilot; AEO (answer engine optimization) is being the answer in Google\'s AI Overviews and AI Mode. AI visibility measures both on the same questions, and AI growth does the work that moves them.',
      },
      {
        q: 'Why ranges instead of one number?',
        a: 'AI answers vary from one ask to the next. Alaventra asks repeatedly and shows each rate with a 95% range, so you can tell a real change from noise.',
      },
      { q: 'What does the daily AI Pulse use?', a: 'It can be switched on or off per website, and the credits it uses a month are shown in the settings before you turn it on.' },
      {
        q: 'Can it tell me what AI gets wrong about us?',
        a: 'Yes. The Answer Analyst compares answers with your business profile and lists wrong claims, sentiment and the order brands are named in.',
      },
      { q: 'Can AI crawlers reach my site?', a: 'Every week Alaventra checks robots.txt for each AI crawler, your llms.txt file and whether your CDN blocks them.' },
      {
        q: 'Can I see the actual answers?',
        a: 'Yes. Every answer opens with what the assistant said, the brands it named in order, the sources it cited and the searches it ran. Answers load a page at a time and can be downloaded as CSV.',
      },
      {
        q: 'Does it do anything about what it finds?',
        a: 'Yes, that is AI growth. Every week, after the visibility run, the questions you lose become suggested pages to write or refresh, new pages go to Bing and IndexNow, your key pages are checked for what AI assistants need to quote them, and the pages AI cites without naming you become pitches.',
      },
    ],
    related: ['ai-growth', 'content', 'reports'],
    image: 'meetingGesture',
    visual: 'ai-visibility',
    diagram: 'ai-engines',
    story: {
      eyebrow: 'One panel, up to nine engines',
      title: 'The same questions, asked everywhere, on a schedule.',
      body: 'Every engine gets the same buyer questions. Answers are read for who is named, who is cited and what is said about you, and every rate carries a 95% range, so a real change stands out from day-to-day noise.',
    },
  },
  {
    slug: 'ai-growth',
    name: 'AI growth',
    shortName: 'AI growth',
    tagline: 'The weekly GEO and AEO work that gets you named and cited in AI answers.',
    summary:
      'Measuring AI visibility tells you where you stand; AI growth acts on it every week. New and updated pages go to Bing and IndexNow, your key pages are checked for what AI assistants need in order to quote them, the questions you lose become suggested pages to write or refresh, and the exact pages AI cites without naming you become pitches.',
    icon: Rocket,
    benefits: [
      'New and updated pages sent to Bing Webmaster Tools every week (the index Microsoft Copilot answers from) and through IndexNow once your key file is up',
      'An AI-readiness score for your key pages: reachable, indexable, the text there before any script runs, the answer in the first lines, a visible update date, question headings and figures with linked sources',
      'Schema and llms.txt are reported but never scored, because there is no good evidence they change AI answers',
      'Every question you lose becomes one suggestion: a new answer page, a refresh of the page that already ranks for it, or the keyword-ladder page for the same search (never two pages for one search)',
      'Answer pages written by the content engine with the answer first, a section for each search the AI runs before it answers, sources AI already trusts and a visible "Updated" date',
      'Earned media: the exact pages AI cited when it did not name you, the competitors they name, the action that fits each one and a pitch drafted for you to review',
      'A page that starts naming you is marked won, and you hear about it',
      'A monthly check of whether Wikidata knows your business, by name and by official website',
      'No tricks: no special versions of pages for AI crawlers, no lists that rank you first, no hidden instructions to assistants',
    ],
    steps: [
      { title: 'See what you lose', body: 'The weekly AI visibility run names the questions where competitors are named and you are not.' },
      { title: 'Get indexed where AI looks', body: 'New and updated pages go to Bing and IndexNow, and your key pages are scored for AI readiness.' },
      { title: 'Win the answer', body: 'Lost questions become suggested answer pages or refreshes, each with its credits. They are written when you approve one (or on Full autopilot, after they appear in "Coming up"), on the same rules as every page: one search, one page, and no new writing while drafts pile up.' },
      { title: 'Earn the mention', body: 'The pages AI cites without you become checked pitches that wait for your approval.' },
    ],
    facts: [
      { value: 'Weekly', label: 'after the AI visibility run, on your weekday' },
      { value: 12, label: 'key pages scored for AI readiness each week, at most' },
      { value: 2, label: 'AI answer pages suggested a month by default, from 0 to 8' },
    ],
    faqs: [
      {
        q: 'Does sending pages to Bing get us into ChatGPT?',
        a: 'We do not claim that. Bing\'s index is the one Microsoft Copilot answers from; ChatGPT, Gemini, Perplexity and Claude read other indexes. Getting a new page into Bing the same week is a cheap, safe step. The rest of AI growth works on your pages and on the third-party pages those other assistants already quote.',
      },
      {
        q: 'What is IndexNow, and what do we have to do?',
        a: 'A shared way to tell search engines that a page changed. Alaventra gives each website its own key; you put one small text file at the root of your site (the guide shows how for your platform), and press "Check the file". Until it is there, pages still go to Bing through Bing Webmaster Tools.',
      },
      {
        q: 'What makes a page ready for AI answers?',
        a: 'What the evidence supports: the page can be fetched and indexed, its text is in the HTML before any script runs (the AI fetchers run none), the answer comes in the first lines, it shows a visible date it was updated, its headings are the questions people ask and its figures link to their source. Each key page gets a score out of 100 with the reasons, checked again about once a month.',
      },
      {
        q: 'Does AI growth use extra credits?',
        a: 'The checks, the Bing and IndexNow submissions and the Wikidata check use no credits. Answer pages are suggestions, each with its price in credits and a "Write it" button, and use credits only when one is written: when you approve it, or on Full autopilot, where it shows in "Coming up" first and can be skipped. The drafted pitches use a few credits a week.',
      },
      {
        q: 'Will you send the pitches for us?',
        a: 'Each pitch goes through link building: it is checked, waits for your approval by default and is sent from your own mailbox. Nothing is sent without a person\'s yes unless an owner allows checked pitches to go automatically, within daily limits.',
      },
    ],
    related: ['ai-visibility', 'content', 'link-building'],
    image: 'loftPresenter',
    visual: 'ai-growth',
    story: {
      eyebrow: 'Why it matters',
      title: 'Being measured is not the same as being named.',
      body: 'AI assistants quote pages they can fetch, read and trust, and they lean on what other websites say about you. AI growth works on both every week: your own pages made easy to quote, and the pages AI already cites brought round to naming you.',
    },
  },
  {
    slug: 'crawler-analytics',
    name: 'Crawler analytics',
    shortName: 'Crawlers',
    tagline: 'What Googlebot and the AI crawlers really fetched on your site, and which of them were impostors.',
    summary:
      'Search Console tells you what Google decided. Your server logs tell you what its crawler, and every AI crawler, actually asked for. Upload a log or let Cloudflare or your log drain send it, and Alaventra shows every crawler\'s requests, checks each one against the addresses its company publishes, and points at the pages nobody fetched and the requests wasted on redirects and errors.',
    icon: Radar,
    benefits: [
      'Googlebot, Bingbot and Applebot, and the AI crawlers: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Agent, Amazonbot, Common Crawl, Bytespider and Meta',
      'Every crawler checked against its company\'s published address list or by DNS. A request that only borrows a crawler\'s name is counted apart, never as the real thing',
      'Pages Google or the AI crawlers did not fetch, most-visited first, and the requests spent on redirects, errors and parameter URLs',
      'The pages ChatGPT, Claude and Perplexity fetched because someone asked them a question',
      'Upload Apache, Nginx, IIS, CloudFront or JSON logs, or have Cloudflare Logpush, Vercel, Fastly or Akamai send them automatically',
      'Only crawler requests are kept: visits by people are counted and dropped, and no address is stored',
    ],
    steps: [
      { title: 'Send your logs', body: 'Upload a file from your server or hosting panel, or give your CDN the push key once and it sends every request within minutes.' },
      { title: 'Every crawler is checked', body: 'Each request that calls itself a crawler is checked against the addresses its company publishes. Impostors go in their own column.' },
      { title: 'Compared with your pages', body: 'The requests are matched with your site\'s page list, so pages no crawler fetched stand out, most-visited first.' },
      { title: 'Act on it', body: 'Each finding links to the audit or the AI visibility view that fixes it, and every figure exports to CSV or the API.' },
    ],
    facts: [
      { value: 15, suffix: '+', label: 'search and AI crawlers recognised' },
      { value: 'Four', label: 'log formats: Apache / Nginx, IIS, CloudFront and JSON' },
      { value: 'Zero', label: 'visitor addresses stored' },
    ],
    faqs: [
      {
        q: 'Why not just trust the user agent?',
        a: 'Because anyone can write "Googlebot" or "GPTBot" in a request. Alaventra checks the address each request came from against the list Google, Microsoft, Apple, OpenAI, Anthropic, Perplexity, Amazon and Common Crawl publish, or confirms it by DNS. A crawler whose company publishes no way to check it is shown as claimed, not verified.',
      },
      {
        q: 'Which logs can we send?',
        a: 'Apache and Nginx access logs, IIS and CloudFront logs, and JSON lines, plain or gzip, up to 1 GB a file. Or let Cloudflare Logpush (an Enterprise feature), Vercel, Fastly or Akamai send them automatically with a key you create in the app.',
      },
      {
        q: 'What happens to our visitors\' data?',
        a: 'Requests by people are counted and dropped as the file is read; the file itself is deleted as soon as it has been read. For crawlers we keep the time, the page, the status, the size and the answer time, but never an address and never the values in a URL\'s parameters. You choose how long the details are kept, and can delete them all at once.',
      },
      {
        q: 'Is Google-Extended in the report?',
        a: 'No crawler is called Google-Extended: it is a robots.txt switch for AI use of your pages, while Google fetches them with its usual crawlers. The page says so instead of showing an empty row.',
      },
    ],
    related: ['technical-audits', 'ai-visibility', 'site-tracking'],
    image: 'serverRoom',
    visual: 'crawlers',
    story: {
      eyebrow: 'Why it matters',
      title: 'An AI assistant can only name a page its crawler has read.',
      body: 'Rankings and AI answers both start with a fetch. Your logs are the only record of which fetches happened, and of how many requests that looked like Googlebot were someone else.',
    },
  },
  {
    slug: 'backlinks',
    name: 'Backlinks from every source',
    shortName: 'Backlinks',
    tagline: 'One link ledger from nine sources, with every link checked by Alaventra itself.',
    summary:
      'Link indexes miss links and sometimes report live ones as lost. Alaventra merges nine sources into one ledger and checks every link itself: a link counts as lost only after two misses, and you see why. Prospects are scored, contacts found and follow-ups scheduled.',
    icon: Link2,
    benefits: [
      'Nine sources: a commercial index, Bing Webmaster Tools, Search Console links, GA4 referrals, the Common Crawl web graph, Wikipedia, Hacker News, news and web search',
      'Every link checked by Alaventra: rel, placement, noindex and canonical',
      'Lost only after two misses, with the reason',
      'SEO, referral and brand value for every link',
      'Link-farm pages and search-results pages are written off, so your best links are the ones that really help',
      'Upload Google\'s own export of your links, or a backlink file from another tool, and it joins the ledger, with a guide for the export',
      'The link gap, unlinked mentions of your name and broken links pointing at you, scored as prospects with their contacts',
      'A competitor\'s own sister domains and sites off your topics stay out of the prospect list, with the reason shown',
      'Prospects go straight to link building, which drafts the pitch and sends it from your own mailbox once you approve it',
      'A free-sources mode that uses no credits',
    ],
    steps: [
      { title: 'Merge', body: 'Nine sources flow into one ledger, one row per referring site.' },
      { title: 'Check', body: 'Alaventra visits each linking page and reads the link the way a search engine would.' },
      { title: 'Value', body: 'Every link gets an SEO, referral and brand value.' },
      { title: 'Grow', body: 'Scored prospects with their contacts, handed to link building for a checked pitch from your own mailbox.' },
    ],
    facts: [
      { value: 9, label: 'link sources in one ledger' },
      { value: 2, label: 'misses before a link counts as lost' },
      { value: 0, label: 'credits to run the free-sources mode' },
    ],
    faqs: [
      {
        q: 'Why check links yourself?',
        a: 'Indexes refresh on their own schedule and can report a live, followed link as lost. Alaventra visits the page and confirms before it raises an alert.',
      },
      { q: 'Can I import links from other tools?', a: 'Yes. Upload the Search Console links export or a backlink CSV from another tool, and Alaventra merges it into the ledger.' },
      {
        q: 'Which links are called your best?',
        a: 'Only links that really pass value. A page that sells links, a scraped directory and a search-results page that happens to list you are written off whatever their authority score says. They never head the list, they stay in the ledger with the reason, and they are never suggested for outreach or disavowal.',
      },
      {
        q: 'What does the free-sources mode include?',
        a: 'Everything except the commercial index: Bing Webmaster Tools, Search Console and GA4 data, the Common Crawl graph, Wikipedia, Hacker News, news and web search.',
      },
      {
        q: 'Does Alaventra send the outreach?',
        a: 'Link building does: it drafts each pitch, checks it, and once you approve it sends it from your own mailbox, with the follow-ups in the same thread. The sending rules (office hours, a gentle start, your postal address and an opt-out in every e-mail, consent where the law asks for it) are on the link-building page.',
      },
    ],
    related: ['link-building', 'ai-visibility', 'reports'],
    image: 'teamTable',
    visual: 'backlinks',
    diagram: 'link-sources',
    story: {
      eyebrow: 'Nine sources, one ledger',
      title: 'Every source sees part of the web. Together they see more.',
      body: 'Alaventra merges nine sources into one row per referring site, then visits each linking page itself to confirm the link, where it sits on the page and whether search engines can follow it.',
    },
  },
  {
    slug: 'link-building',
    name: 'Link building',
    shortName: 'Link building',
    tagline: 'Pitches worth sending, from your own mailbox, to sites that could really link to you.',
    summary:
      'Every week Alaventra finds the openings (journalist requests, resource pages, broken links, lists that leave you out, podcasts that take guests, directories worth being on), checks each one on its own page, finds a contact on that site\'s own domain and drafts a short sequence that points at the right page of yours. You approve it, it goes out from your own mailbox, and the replies come back read, with an answer suggested.',
    icon: Handshake,
    benefits: [
      'New openings every week: journalist requests (public ones and the HARO and Source of Sources digests in your inbox), resource pages, broken links on pages about your topics, your competitors\' broken links, podcasts that take guests and lists that leave you out',
      'Your own old addresses that now return an error, found in the web archive, with the redirect to add so the links still pointing at them count again',
      'Every prospect checked on its own page first: gone, selling links, off your topics, in another language, a competitor or a government portal; each one is set aside with the reason',
      'Up to three contacts per site, on that site\'s own domain (never a no-reply, privacy or jobs address), each with the page it was found on',
      'The right page of yours to point to and the link text to ask for: your brand, the page\'s title or its address; never a keyword',
      'A short sequence per prospect: a first e-mail that quotes their page, then two follow-ups four and eight working days later in the same thread',
      'Every draft checked before you see it: nothing claimed that your profile does not carry, something quoted from their page, one link, short, one clear ask. A draft that fails waits for your edit',
      'Sent from your own mailbox on weekdays inside its office hours, starting slowly and spaced minutes apart, with your name, company, postal address and a one-line opt-out in every e-mail',
      'A consent check for the countries that need one, an address with no mail server set aside before anything is sent, and an opt-out list honoured for good',
      'Replies read for you: interested, a question, out of office until a date, a "no", a request for payment, with a suggested answer, and their page checked for your link straight away',
      'Two subject lines tested side by side, with no winner named until enough have gone out to mean anything',
      'What kind of page earns links in your market (a data study, a free tool, a template or a guide), with the competitor pages that prove it',
      'A checklist of the directories and marketplaces worth being on, what we found on each and a ready description to paste. You submit, we check',
      'What each won link did: the page compared with your other pages over the same weeks ("likely helped", never "caused"), and the whole week as one PDF',
    ],
    steps: [
      { title: 'Find', body: 'Every week, new openings from journalists, resource and list pages, broken links, podcasts and directories, each fetched and checked on its own page.' },
      { title: 'Prepare', body: 'A contact on their own site, the page of yours that fits, the link text to ask for and a drafted sequence that passed its checks.' },
      { title: 'Approve', body: 'You read, edit and approve each sequence. An owner can let checked ones go automatically, within daily limits.' },
      { title: 'Send and follow up', body: 'From your own mailbox, in one thread, stopping the moment they reply. A won link is confirmed by Alaventra\'s own link check.' },
    ],
    facts: [
      { value: 3, label: 'e-mails at most per prospect: a pitch and two follow-ups' },
      { value: 'Your mailbox', label: 'every pitch is sent from your own address' },
      { value: 28, label: 'directories and marketplaces on the listings checklist' },
    ],
    faqs: [
      {
        q: 'Does Alaventra place links for us?',
        a: 'No, and no tool should: Google counts automated link creation as spam. Alaventra does everything around the human yes. It finds the openings, checks them, finds the contact, drafts the pitch and tracks the result; a person approves what is sent, and the other website decides whether to link.',
      },
      {
        q: 'Who gets pitched?',
        a: 'Only sites that could really link to you. A competitor selling what you sell, a government portal, a page that sells links, a bare homepage, a mailbox provider and a contact database are refused with the reason, and a list of accredited providers is only pitched when your profile says you hold that accreditation.',
      },
      {
        q: 'Is it legal to e-mail these people?',
        a: 'Every e-mail carries your name, company, postal address and a working opt-out, and an opt-out is honoured for good. Recipients where prior consent is expected (Germany, Austria and Saudi Arabia, and named people in the UAE) are held until you tick that you have their consent or already work together, and addresses in the EU and the UK get a line saying where we found them. That is how the product behaves, not legal advice; the consent list can be made stricter.',
      },
      {
        q: 'Do I have to hand over my mailbox password?',
        a: 'No. Microsoft 365 and Gmail can be connected on their own sign-in screen, where you grant exactly two things: sending, and (for Microsoft 365) reading the replies to your own pitches. Nothing but a renewable permission is stored, it is encrypted, and it is withdrawn when you disconnect the mailbox. Google treats inbox access as a restricted scope, so a Gmail mailbox sends and you read its replies in Gmail, the app says so before you connect it. An app password still works for any mail host.',
      },
      {
        q: 'What happens when someone replies?',
        a: 'The sequence stops at once, and so does every other one to that website. The reply is read and sorted (interested, a question, out of office, a "no", a request for payment, a link swap), with a one-line summary and a suggested answer you can edit and send in the same thread. Out of office moves the next step after their return date; a bounce or a "no" puts the address on your opt-out list.',
      },
      {
        q: 'How fast does it send?',
        a: 'Monday to Friday, inside the hours you set for the mailbox: five first e-mails a day in the first week, ten in the second, then your limit (at most thirty), never more than fifty e-mails a day in all, four to nine minutes apart, as plain text with no tracking. A mailbox pauses itself after repeated bounces.',
      },
      {
        q: 'Will you ever pay for a link?',
        a: 'No. A reply asking for payment is flagged and not pursued (a paid link has to be marked sponsored and passes no ranking value), and an offer to swap links is flagged too.',
      },
      {
        q: 'Do you decide which subject line is better?',
        a: 'Only once there is enough to read. Every batch gets two subject lines in different styles and they go out in equal numbers; you see the e-mails sent and the replies for each. Under thirty sends per line the page says "not enough sends yet" instead of naming a winner, because at that size a few points of difference is noise.',
      },
    ],
    related: ['backlinks', 'ai-growth', 'content'],
    image: 'celebration',
    visual: 'outreach',
    story: {
      eyebrow: 'Why it matters',
      title: 'Links are earned one yes at a time.',
      body: 'The links that help are the ones a real person chose to add. Alaventra spends the effort where a yes is likely (a site on your topic, a page of yours they will want to link to, a contact who reads the mail), and keeps your mailbox and your name in good standing while it does.',
    },
  },
  {
    slug: 'reports',
    name: 'Reports and alerts',
    shortName: 'Reports',
    tagline: 'A full SEO report on demand, a weekly report and alerts that matter.',
    summary:
      'Get a full SEO report as PDF or Word whenever you need one, a weekly report with what changed, Search Console alerts as soon as Google sends them and a monthly check-in for what the API cannot see. Every finding comes with a prioritised recommendation.',
    icon: FileText,
    benefits: [
      'A full SEO report as PDF or Word',
      'A weekly report: rankings, traffic, AI visibility and links in one read',
      'A Search Console alert watcher for Google\'s notification e-mails',
      'A monthly check-in for manual actions and security issues',
      'One to-do list across audits, search, rankings, AI answers and links, ranked by what each step is worth, not by which part of the system found it',
      'Every step shows the figure behind it, how confident Alaventra is and how much work it is; a step nothing has measured yet says so instead of being given a score',
      'Prioritised recommendations you can start with one click',
      'Every number says where it came from, over what period and from how big a sample',
      'A share link for one report: it expires on the day you choose, you can turn it off at any time, and the person you send it to needs no account',
      'A shared report carries your own name and logo at the top and ours in one line at the bottom, so a client sees your report, not our tool',
      'A report the run marked unfinished says so to the reader before the first figure, whether it is e-mailed or opened through a link',
      'Every run kept with its report and files',
      'Your data through a read-only API: websites, audits and findings, runs and reports, each report marked finished or held back with the reason',
      'Connect an AI assistant that speaks MCP and ask it about your own SEO data, with the same read-only key',
    ],
    steps: [
      { title: 'Collect', body: 'Search, traffic, AI answers, links and audits feed one picture of each website.' },
      { title: 'Explain', body: 'What changed, why it matters, how sure Alaventra is, and where each number came from.' },
      { title: 'Recommend', body: 'One list of next steps across every area, ranked by impact, confidence and effort, each one ready to run.' },
      { title: 'Share', body: 'Send one report as a link that expires, under your own name and logo, or export it as PDF or Word. Past runs keep their report and files.' },
    ],
    facts: [
      { value: 2, label: 'report formats: PDF and Word' },
      { value: 'Weekly', label: 'report, on your website\'s weekday' },
      { value: 14, label: 'days a share link lasts by default (1 to 90, revocable)' },
      { value: 1, label: 'check-in a month for what Google\'s API cannot see' },
    ],
    faqs: [
      {
        q: 'Can I share reports with clients?',
        a: 'Yes, two ways. Export the report as PDF or Word and send the file, or create a share link: it opens that one report in the browser with no account needed, it stops working on the day you choose (14 days by default, up to 90) and you can turn it off at any time.',
      },
      {
        q: 'What can somebody with a share link see?',
        a: 'That one report and its documents, read-only: its headline figures, the website it is about, when it was produced and where each number came from, under your own name and logo. Nothing else: no other report, no dashboard, no list, none of your settings or team, and nothing on the page can be changed. You see when the link was last opened, and turning it off takes one click.',
      },
      {
        q: 'Can a shared report carry our branding?',
        a: 'Yes. A shared report shows your business name and logo at the head of the page and in the browser tab, and our name sits in one line in the footer. Both come from the business profile you already fill in for your website, so there is nothing extra to keep up to date; a company that has not added a logo gets its initials instead, and a logo that fails to load never breaks the page.',
      },
      { q: 'What does the Search Console alert watcher do?', a: 'It reads Google\'s Search Console notification e-mails for your websites and turns them into alerts in Alaventra.' },
      { q: 'What is the monthly check-in?', a: 'A short checklist for what Google does not expose through its API, such as manual actions and security issues.' },
      {
        q: 'Are recommendations ranked?',
        a: 'Yes, and it is one list, not one list per area. Every step carries what it is worth (the impact, how confident Alaventra is in the figure behind it, and how much work it is), and the list is ordered by all three. Setup steps that have to happen before anything can be measured come first and say why. A step with no measured figure behind it is put at the bottom with the reason, rather than given a number nobody can defend. Each step can be started as a run with its price in credits shown first.',
      },
      {
        q: 'Can I see where a number came from?',
        a: 'Yes. Every figure in a report and on a dashboard carries its source, the period it covers and the size of the sample behind it, with a "Where these numbers come from" table at the end of each report. A number that was calculated rather than counted says "modelled, not measured", and if a figure ever reaches a report without its source it says "source not recorded" instead of borrowing one.',
      },
    ],
    related: ['site-tracking', 'technical-audits', 'enterprise'],
    image: 'meetingPresenter',
    visual: 'dashboard',
    screen: 'report',
    story: {
      title: 'Reports people actually read.',
      body: 'The weekly report puts rankings, traffic, AI visibility and links on one page, with what changed and what to do next. Full reports export as PDF or Word for everyone who was not in the room.',
    },
  },
  {
    slug: 'guided-setup',
    name: 'Guided setup',
    shortName: 'Guided setup',
    tagline: 'Every step we ask of you, with your own values and the page to open.',
    summary:
      'SEO work stalls at the same place every time: the part that happens in someone else\'s account. Wherever Alaventra needs something from you (a Google permission, a DNS record, a file on your site, a mailbox), the ask carries a guide through that one job, with your own values ready to copy and a way to hand it to whoever can do it. And because the autopilot runs every week, the choices it asks of you have guides too: which keyword to start with, how much it may do on its own, and what to do with the weekly plan.',
    icon: LifeBuoy,
    benefits: [
      'A guide beside every ask: Search Console and Analytics access, proving the domain is yours, the IndexNow file, your links export, letting the AI crawlers in, mailboxes and their SPF, DKIM and DMARC records, publishing a page, applying a fix pack, your business profile and style guide',
      'Guides for the weekly autopilot: what happens when, from setup to a keyword won; choosing your first keyword; the three autopilot levels; your week and its monthly date; the Coming up plan; and what to do when a page is not ready to publish',
      'A "What happens next" line on your Pipeline with your own next dates: the plan two days before your week, the weekly run, the monthly checks, each opening its guide',
      'Your own values, never a placeholder: the record for your domain, your key file, the exact address to add, each in a box you copy from',
      'Written for the provider you actually use: Cloudflare, GoDaddy, Namecheap or cPanel for DNS; WordPress, Shopify, Wix, Squarespace or Webflow for the website',
      'Tick the steps off as you go. Close it, come back tomorrow, and it opens where you stopped',
      'Send the whole guide to the colleague who has to do it, values filled in, with no account needed at their end',
      'Each one ends with how to tell it worked, what to try when it did not, and the button in Alaventra that checks',
    ],
    steps: [
      { title: 'Alaventra asks for one thing', body: 'A permission, a record or a file, with the reason it is needed and what it makes possible next.' },
      { title: 'Open the guide beside the ask', body: 'That one job as numbered steps, with your values, the page to open and the tab for your provider.' },
      { title: 'Do it, or pass it on', body: 'Tick the steps off yourself, or e-mail the guide to whoever manages your DNS, your website or your mailbox.' },
      { title: 'Alaventra checks the result', body: 'The button at the end runs the check (verified, connected, file found), so nobody is left guessing whether it worked.' },
    ],
    facts: [
      { value: 69, label: 'guides, one for each thing we ask of you' },
      { value: 'Your values', label: 'in every copy box, not an example' },
      { value: 'One e-mail', label: 'hands a guide to the person who can do it' },
    ],
    faqs: [
      {
        q: 'Do we need a developer?',
        a: 'For most of it, no: the Google permissions, the business details and the mailbox are all done in a browser by whoever has the account. A DNS record or a file at the root of the site usually needs the person who manages those. The guide is written for them too and goes to them in one click.',
      },
      {
        q: 'Our website is run by an agency. Does that work?',
        a: 'Yes. Every guide can be sent as an e-mail with your values already in it, so the agency gets the exact steps without an account here. You still see in Alaventra whether the job landed, because the same guide ends with the check.',
      },
      {
        q: 'What if the provider\'s screen looks different?',
        a: 'Providers move things. The guides name what to look for rather than only where it used to be, keep separate instructions for the common providers and CMSs, and end with an "if it does not work" list for the things that usually go wrong.',
      },
      {
        q: 'Is this only for the first week?',
        a: 'No. The same guides sit on the asks that come up later: the IndexNow file, a new mailbox, the fix pack from an audit, publishing a page that was written for you, the monthly Search Console check-in, and every week\'s Coming up plan. There is also a searchable list of all of them in the app.',
      },
    ],
    related: ['site-tracking', 'enterprise', 'technical-audits'],
    image: 'teamAtDesks',
    visual: 'guided-setup',
    story: {
      eyebrow: 'Why it matters',
      title: 'What stalls the work is never the SEO.',
      body: 'It is the Google permission nobody has, the DNS record that needs a colleague, the file that has to sit at the root of the site. Alaventra treats that as part of the product: every ask carries its steps, your own values and a way to hand it to the person who can do it.',
    },
  },
  {
    slug: 'report-delivery',
    name: 'Report delivery',
    shortName: 'Delivery',
    tagline: 'Your reports arrive where you already are, and the ones that are not ready do not.',
    summary:
      'A report nobody opens is worth nothing. Every finished report can be sent to you as it arrives, or collected into a daily, weekly or monthly summary: by e-mail with its figures and its files, or to a webhook your team already watches. And the report an analysis itself marked as not ready is never sent; it waits in Alaventra with the reason on it.',
    icon: Send,
    benefits: [
      'As each report arrives, or one summary a day, a week or a month, on the day and at the hour you choose',
      'By e-mail with the report\'s own figures in the message, its PDF and documents attached, and a link that opens it',
      'To a webhook as JSON your systems can read, which Slack, Teams and Discord also render as a message',
      'Every message can carry an expiring, revocable link so a report can be forwarded to a client or a colleague with no account',
      'A report that failed its own quality check, a plan the engine refused or a figure it could not verify is held back, and the reason is stated rather than hidden',
      'A log of everything sent, everything held and everything that failed, so you can tell the difference between quiet and broken',
    ],
    steps: [
      { title: 'Choose when and where', body: 'A frequency, the people who should receive it, a webhook if your team lives in one, and which reports you actually want.' },
      { title: 'A report finishes', body: 'The work runs on each website\'s own week: the weekly tracking report, the monthly audit, a page that was written for you.' },
      { title: 'It is checked before it is sent', body: 'Anything the analysis marked as not ready stays here. Everything else goes out with its figures, its files and its link.' },
      { title: 'You read it where you already were', body: 'In your inbox or your team channel. Open the full report in Alaventra, or forward the link to somebody without an account.' },
    ],
    facts: [
      { value: 'Four', label: 'schedules: each report, daily, weekly or monthly' },
      { value: 'Two', label: 'channels: e-mail and webhook, at the same time' },
      { value: 'Never', label: 'a report the analysis marked as not ready' },
    ],
    faqs: [
      {
        q: 'What does "not ready" actually mean?',
        a: 'It is the analysis\'s own verdict, not a guess by the delivery. A written page that used up its quality rounds and still failed, a keyword plan the engine refused to make, a verdict it could not check because the search results could not be read, a run that was rejected. Each of those is still in Alaventra, with what went wrong on it; it is simply not pushed to anyone as finished work.',
      },
      {
        q: 'Can somebody outside the company read the report?',
        a: 'Only if you let them. Each delivery can carry a link that opens one report and nothing else: no dashboard, no other report, no settings, read-only, expiring, and revocable at any time. Leave it switched off and the message only links back into Alaventra, where an account is needed.',
      },
      {
        q: 'What arrives at the webhook?',
        a: 'A JSON POST with the report, its figures, its files and its links, plus a plain summary line so Slack, Teams and Discord show something readable with no mapping. Set a signing secret and every body is signed, so your receiver can tell the message came from us.',
      },
      {
        q: 'Will this send me something every day?',
        a: 'Only what you ask for. You can pick the reports you care about (the weekly tracking report but not every rank check, say), and collect the rest into one summary. The default is off: nothing is sent until you switch a channel on.',
      },
    ],
    related: ['reports', 'site-tracking', 'enterprise'],
    image: 'teamAtDesks',
    visual: 'report-delivery',
    story: {
      eyebrow: 'Why it matters',
      title: 'The best report is the one that reached you.',
      body: 'Work that lands in a dashboard waits to be discovered. Work that lands in your inbox or your team channel gets read, argued with and acted on, which is the only way an SEO programme ever turns into traffic.',
    },
  },
  {
    slug: 'integrations',
    name: 'Integrations and API',
    shortName: 'Integrations',
    tagline: 'Alerts in Slack or Teams, findings as tickets, your data in your warehouse, and an API your assistant can work with.',
    summary:
      'Alaventra fits into the tools your team already runs on. Alerts and finished work go to the Slack or Teams channel you choose, an audit finding becomes one ticket in Jira, Linear or Asana, and your rankings, traffic, audits, AI visibility and backlinks land in BigQuery, S3 or Looker Studio. Scripts and AI assistants can read everything and, with your permission, start analyses using your company\'s credits.',
    icon: Plug,
    benefits: [
      'Alerts, failed runs, finished reports, new audit findings and ranking moves sent to Slack or Microsoft Teams; each channel gets only the events you pick',
      'Every event also as signed JSON for your own systems, Zapier, Make or n8n, retried when your side is down, with a delivery log',
      'Any audit finding or recommendation sent to Jira, Linear or Asana as one ticket with the evidence, the example pages and the fix, and its state shown back next to the finding',
      'Rankings, weekly Search Console and GA4 figures, audit findings, AI visibility, backlinks and analyses exported every day or week to BigQuery, Amazon S3, Google Cloud Storage or Cloudflare R2',
      'A Looker Studio connector for the same tables, read with a read-only key',
      'An API and an MCP server: assistants like Claude and ChatGPT read your data and, with a key you allow to, start analyses, with the same credit, duplicate and price checks as the app',
    ],
    steps: [
      { title: 'Connect a channel or a tracker', body: 'Paste a Slack or Teams address, or a Jira, Linear or Asana token. Alaventra checks it with the tool before anything is saved.' },
      { title: 'Pick what goes where', body: 'Alerts to one channel, wins to another; tickets on the findings you choose; the tables you want, daily or weekly.' },
      { title: 'Work happens in your tools', body: 'Your team reads the alert where it already works, fixes the ticket in its own tracker and charts the data in its own BI.' },
      { title: 'Every send is logged', body: 'Delivered, retried or held back: each event, ticket and export has a record you can read.' },
    ],
    facts: [
      { value: 7, label: 'event types to route to Slack, Teams or your systems' },
      { value: 3, label: 'issue trackers: Jira, Linear and Asana' },
      { value: 6, label: 'tables, one documented schema, for your warehouse' },
    ],
    faqs: [
      {
        q: 'Can an AI assistant spend our credits?',
        a: 'Only with a key you created for that, and only within your company\'s credits and limits. A key can read by default; starting analyses is a separate permission. Every start goes through the same checks as the app: the price in credits, your balance and limits, and the warning when the work duplicates something already planned or running, which the assistant must show you rather than accept on its own.',
      },
      {
        q: 'Will the same finding be ticketed twice?',
        a: 'No. One finding is one ticket: pushing it again, by anyone, opens the ticket already made. Its state (to do, in progress, done) is read back from your tracker and shown beside the finding.',
      },
      {
        q: 'Where are our tokens kept?',
        a: 'Encrypted, and never shown again after you paste them, not even to an owner. Alaventra only ever connects to the tool\'s own public address, and every message it sends is logged without the secret.',
      },
      {
        q: 'What does the export contain?',
        a: 'Six tables with a documented schema: rank history, weekly Search Console and GA4 figures, audit findings, AI visibility, backlinks, and the analyses you ran. Each export is a full copy, so a re-run replaces instead of duplicating.',
      },
    ],
    related: ['report-delivery', 'enterprise', 'technical-audits'],
    image: 'serverRoom',
    visual: 'integrations',
    story: {
      eyebrow: 'Why it matters',
      title: 'SEO work that lives where the rest of the work lives.',
      body: 'Findings only get fixed when they reach the backlog, and numbers only get trusted when they sit next to the rest of the business\'s numbers. Alaventra sends both there, and lets your assistant ask and act without a login.',
    },
  },
  {
    slug: 'enterprise',
    name: 'Enterprise platform',
    shortName: 'Enterprise',
    tagline: 'Workspaces, roles, single sign-on, an audit log and credit limits for every company you run.',
    summary:
      'Run every company and website from one account. Invite your team with roles (or let your identity provider sign them in and provision them), require two-step verification, see who did what in the audit log, prove you own each website before its data is shown and set credit limits per company. Each company\'s data is kept apart from every other.',
    icon: Building2,
    benefits: [
      'Multi-company workspaces with four roles: owner, admin, member and viewer',
      'Invitations and Google sign-in',
      'Single sign-on with SAML 2.0 or OIDC (Okta, Microsoft Entra ID, Google Workspace) on your verified e-mail domains, and, when you are ready, required',
      'SCIM provisioning: people created, updated and switched off from your identity provider, groups mapped to roles',
      'Two-step verification with an authenticator app, passkeys or a security key, which a company can require for everyone',
      'An audit log of sign-ins, team, settings, keys and sharing that nobody can edit, with CSV export',
      'Signed-in devices you can sign out, and idle sign-out after the time your company sets',
      'Website ownership verified through Search Console, a DNS TXT record or a meta tag',
      'The price in credits before every analysis, credits per company and the limits you set',
      'Data isolation per company',
      'API keys per company: shown once, with an expiry, revocable at any time, read-only unless you allow a key to start analyses, and never able to reach another company\'s data',
      'No repeated work: results are reused where nothing changed',
    ],
    steps: [
      { title: 'Create a workspace', body: 'One company per brand or client, each with its own websites and data.' },
      { title: 'Verify your websites', body: 'Prove ownership through Search Console, DNS or a meta tag.' },
      { title: 'Invite the team', body: 'Give each person the role they need, from viewer to owner.' },
      { title: 'Set the limits', body: 'See the price in credits before every analysis and set each company\'s credit limits.' },
    ],
    facts: [
      { value: 4, label: 'roles: owner, admin, member and viewer' },
      { value: 3, label: 'ways to verify website ownership' },
      { value: 1, label: 'verified owner per domain' },
    ],
    faqs: [
      { q: 'Can one person manage several companies?', a: 'Yes. Agencies and groups switch between companies; each has its own websites, team, credits and data.' },
      { q: 'How is website ownership verified?', a: 'Through Search Console ownership, a DNS TXT record or a meta tag. Each domain has one verified owner.' },
      {
        q: 'How is spending kept under control?',
        a: 'Every analysis shows its price in credits before it starts and is never charged more. Owners set monthly limits for analyses and for the automatic work, and can keep credits aside for each website\'s automatic work. Results that cannot have changed are reused instead of charged again.',
      },
      { q: 'Is our data visible to other companies?', a: 'No. Each company\'s websites, runs and reports are isolated, and access depends on your role in that company.' },
      {
        q: 'Can we sign in with our identity provider?',
        a: 'Yes. Prove your e-mail domain with a DNS record, connect Okta, Microsoft Entra ID, Google Workspace or any SAML 2.0 / OIDC provider, test a sign-in, and switch it on. An owner can then require it: passwords stop working for your domain, and owners keep theirs, protected by two-step verification, in case your provider is down. With SCIM, your provider also creates and switches off accounts.',
      },
      { q: 'Can we see who changed what?', a: 'Owners and admins see an audit log of sign-ins, two-step changes, team and role changes, websites, settings, API keys and sharing (who, when and from which address) and can export it as CSV. Nothing in it can be edited or deleted.' },
    ],
    related: ['reports', 'autopilot', 'site-tracking'],
    image: 'brightOffice',
    visual: 'workspace',
    story: {
      title: 'Control for every company and website you run.',
      body: 'Each company has its own websites, team, credits and data. Website data appears only after ownership is proven, and every analysis shows its price in credits before any work begins.',
    },
  },
  {
    slug: 'agency-portal',
    name: 'Agency client portal',
    shortName: 'Client portal',
    tagline: 'A workspace per client, client logins and a portal under your own name and domain.',
    summary:
      'Agencies keep every client in a workspace of its own, see every client website in one table, and give each client a portal of their websites: dashboards, reports, recommendations and the pages waiting for their approval. With white-label on, the portal, the reports, the documents and the e-mails your clients get carry your name, your logo, your colour and your own address.',
    icon: Briefcase,
    benefits: [
      'A workspace per client (its own websites, credits, reports and logins) and your team switching between them',
      'One table of every client website: health, rankings movement, clicks, AI visibility, alerts, approvals waiting and credits used, with a CSV export',
      'Client logins as viewer or approver: their websites, reports and recommendations, and nothing of your other clients, your credits or your settings',
      'Client approval before a page goes live or an outreach e-mail is sent, when you want it',
      'Your name, logo and colour in place of ours (with every text kept readable to WCAG AA in light and dark mode), and "Powered by" off unless you switch it on',
      'The portal on your own address, such as seo.youragency.com, proven with a DNS record and checked again every few hours',
      'Invitations and scheduled reports sent under your name, and from your own mailbox once its SPF and DKIM check out',
    ],
    steps: [
      { title: 'Turn on agency mode', body: 'The owner switches the company to an agency. Owners and admins reach every client; members see the clients you assign.' },
      { title: 'Create a workspace per client', body: 'Its own websites, credits and reports. Verify the client\'s website and start tracking as usual.' },
      { title: 'Brand it and give it your address', body: 'Your name, logo and colour, then two DNS records for your portal address and, if you like, your own sender.' },
      { title: 'Invite the client', body: 'As a viewer, or as an approver who signs off pages and outreach before they go out.' },
    ],
    facts: [
      { value: 2, label: 'client roles: viewer and approver' },
      { value: 'AA', label: 'contrast kept for your colour, light and dark' },
      { value: 1, label: 'table of every client website, with a CSV export' },
    ],
    faqs: [
      {
        q: 'Can one client see another client\'s data?',
        a: 'No. Each client is a separate workspace and a client login reaches only its own. Its people see their websites\' dashboards, reports, recommendations and approvals, not your other clients, not your credits, not your settings.',
      },
      {
        q: 'Will my clients see the Alaventra name?',
        a: 'Not with white-label on: the portal, report pages, shared reports, the documents they download and the e-mails they get carry your name. A small "Powered by Alaventra" line appears only if you switch it on. PDFs the analyses produce are replaced by a printable page of the report under your brand.',
      },
      {
        q: 'How does the portal get onto our own domain?',
        a: 'You add the address, publish a TXT record that proves it is yours and a CNAME that points it at the portal, and press Check. The record is checked again every few hours, and an address whose proof disappears stops being served.',
      },
      {
        q: 'Do clients sign in with their own company accounts?',
        a: 'Yes. They can use a password with two-step verification, or Google or their company\'s single sign-on, and any two-step requirement you set for their workspace applies.',
      },
    ],
    related: ['enterprise', 'reports', 'report-delivery'],
    image: 'loftTeam',
    visual: 'agency-portal',
    story: {
      eyebrow: 'For agencies',
      title: 'Your clients see your work, under your name.',
      body: 'A logo on a shared page is not a portal. Clients get their own login, their own websites and a say before anything goes live, and everything they see, from the sign-in page to the weekly e-mail, is yours.',
    },
  },
];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
/** The capability count in words ("ten" / "Ten"), so copy follows the registry when a capability is added. */
export const capabilityCount = NUMBER_WORDS[features.length] ?? String(features.length);
export const CapabilityCount = capabilityCount.charAt(0).toUpperCase() + capabilityCount.slice(1);

export const featureBySlug = (slug: string | undefined): Feature | undefined => features.find((f) => f.slug === slug);

/** related features in registry order, skipping unknown slugs */
export const relatedFeatures = (f: Feature): Feature[] => f.related.map((s) => featureBySlug(s)).filter((x): x is Feature => !!x);
