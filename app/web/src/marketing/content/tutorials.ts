// The video course: every series and tutorial of /tutorials and /tutorials/<slug>, in course order (1.1, 1.2, ... 11.11).
// The catalogue block below is copied from the video project's tutorials.json by app/scripts/sync_tutorials.py, which also writes
// tutorial-films.ts (one entry per finished film: length, chapter times, cover, captions) and the covers and captions in
// public/tutorials/. A tutorial without a finished film shows its written steps and a note that the video is on its way, never an
// empty player. For a finished film the written steps are the film's own step chapters, so the page and the film never disagree.
import { tutorialFilms } from './tutorial-films';

export type TutorialLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type TutorialAudience = 'owner' | 'marketer' | 'agency';

/** one tutorial as the catalogue lists it */
export interface TutorialEntry {
  /** "1.1": series number, then the place in the series */
  id: string;
  slug: string;
  title: string;
  /** one line: what the viewer gets out of it */
  summary: string;
  level: TutorialLevel;
  audience: TutorialAudience[];
  /** planned length in whole minutes (a finished film has its real length in `film`) */
  minutes: number;
  /** where in the app the tutorial happens (may hold <placeholders>); not linked */
  start: string;
  /** the steps, in order: the written how-to (for a finished film, its step chapters, word for word) */
  chapters: string[];
  /** words a plain-word rewording replaced (tutorial_wording.json), still found by the search: "CMS", "DNS" */
  aka?: string[];
}

export interface TutorialSeries {
  id: string;
  title: string;
  summary: string;
  tutorials: TutorialEntry[];
}

export interface TutorialChapter {
  /** seconds from the start of the film */
  start: number;
  title: string;
  /** what the chapter is: the introduction, a step (counted as one of the film's steps), a tip, or the result at the end */
  kind?: 'intro' | 'step' | 'tip' | 'result';
}

/** a finished film (generated into tutorial-films.ts) */
export interface TutorialFilm {
  durationSeconds: number;
  /** ISO date the film was finished (schema.org uploadDate; not shown on the page) */
  published: string;
  /** public path of the WebP cover, 960 px (the poster); `<cover>-1920.webp` beside it for sharp screens, `<cover>-card.webp` and
   *  `<cover>-card-dark.webp` (the title block at twice the size, on the light and the dark page colour) for the cards */
  cover: string;
  /** true when a VP9 WebM is served beside the MP4 (offered first, for browsers without H.264) */
  webm?: boolean;
  /** the film's YouTube video id (11 characters): when set, the page plays it from YouTube, loaded only when someone presses play */
  youtubeId?: string;
  /** public path of the WebVTT captions (the subtitles are also burned into the picture) */
  captions: string;
  chapters: TutorialChapter[];
  /** the narration, one paragraph per chapter (same order as `chapters`), from the captions */
  transcript?: string[];
}

/** a tutorial with its place in the course */
export interface Tutorial extends TutorialEntry {
  series: TutorialSeries;
  /** 0-based place in the whole course */
  index: number;
  /** 1-based place in its series */
  position: number;
  film?: TutorialFilm;
}

// <catalogue>
// generated from the course catalogue by app/scripts/sync_tutorials.py (edit the catalogue, then run it again)
export const tutorialSeries: TutorialSeries[] = [
  {
    id: '1',
    title: 'Getting started',
    summary: 'Create your account, set up your company and finish the guided setup.',
    tutorials: [
      {
        id: '1.1',
        slug: 'create-your-account',
        title: 'Create your account',
        summary: 'Get your own sign-in for Alaventra, with Google or your work e-mail.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 1,
        start: '/signup',
        chapters: [
          'Open the sign-up page',
          'Sign up with Google, or with your name, work e-mail and a password',
          'Confirm your e-mail from the link we send',
        ],
      },
      {
        id: '1.2',
        slug: 'set-up-your-company',
        title: 'Set up your company',
        summary: 'Create the workspace where your websites, reports and team live.',
        level: 'Beginner',
        audience: ['owner'],
        minutes: 1,
        start: '/onboarding',
        chapters: [
          'See the setup steps',
          'Name your company, its industry and size',
          'Add your main website address',
          'Continue, or save and come back later',
        ],
      },
      {
        id: '1.3',
        slug: 'add-your-website',
        title: 'Add your website',
        summary: 'Tell Alaventra which website to grow and where its customers search.',
        level: 'Beginner',
        audience: ['owner'],
        minutes: 1,
        start: '/onboarding/<company>/website',
        chapters: [
          'Type your website address',
          'Choose the main country your customers search from',
          'Say what you do',
          'Add the website and continue',
        ],
      },
      {
        id: '1.4',
        slug: 'describe-your-business',
        title: 'Describe your business in your own words',
        summary: 'Give every page, report and AI question the real facts about what you sell and to whom.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/onboarding/<company>/business',
        chapters: [
          'Say what you do in one or two sentences',
          'List what you sell and who buys it',
          'Pick the main goal of your website',
          'Add real business facts, competitors and brand names',
          'Save and continue',
        ],
      },
      {
        id: '1.5',
        slug: 'choose-your-first-keyword',
        title: 'Choose your first keyword',
        summary: 'Pick the search you most want to be found for, so the pages written for you are the ones you want.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/onboarding/<company>/keyword',
        chapters: [
          'Type a search a customer would use and check it',
          'Or ask for suggestions',
          'Choose how pages are written: each week, or after your OK',
          'Pick how much we do on our own',
          'Continue, or choose later',
        ],
      },
      {
        id: '1.6',
        slug: 'choose-what-to-track-and-start',
        title: 'Choose what to track and start',
        summary: 'Review everything in one place and start your weekly checks with a clear view of the credits they use.',
        level: 'Beginner',
        audience: ['owner'],
        minutes: 2,
        start: '/onboarding/<company>/tracking',
        chapters: [
          'Choose what is checked each week',
          'Review every choice and edit any row',
          'Check the estimated credits',
          'Start, and see what happens today',
        ],
      },
      {
        id: '1.7',
        slug: 'find-your-way-around',
        title: 'Find your way around Alaventra',
        summary: 'Know where each website page, your runs, reports and settings live, and how to switch website or company.',
        level: 'Beginner',
        audience: ['owner', 'marketer', 'agency'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/overview',
        chapters: [
          'The website pages in the sidebar',
          'Company pages: analyses, runs, reports and settings',
          'Switch website or company',
          'Your credits, the guides and your account',
        ],
      },
      {
        id: '1.8',
        slug: 'join-a-company-from-an-invitation',
        title: 'Join your team from an invitation',
        summary: 'Accept an invitation from a colleague and land straight in your company.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 1,
        start: '/invite/<link>',
        chapters: [
          'Open the invitation link',
          'Create an account or sign in',
          'Accept and open the dashboard',
        ],
      },
      {
        id: '1.9',
        slug: 'sign-in-and-reset-your-password',
        title: 'Sign in, and get back in if you forget your password',
        summary: "Sign in with your e-mail, Google or your company's sign-in, confirm it is you, and choose a new password if you forget it.",
        level: 'Beginner',
        audience: ['owner', 'marketer', 'agency'],
        minutes: 2,
        start: '/login',
        chapters: [
          'Sign in with your work e-mail and password',
          "Or continue with Google or your company's single sign-on",
          'Confirm it is you with your app, a passkey or a recovery code',
          'Forgot your password? Get a link and choose a new one',
        ],
      },
    ],
  },
  {
    id: '2',
    title: 'Your website and Google',
    summary: 'Prove the website is yours and connect Search Console and Google Analytics.',
    tutorials: [
      {
        id: '2.1',
        slug: 'verify-with-google',
        title: 'Verify your website with Google',
        summary: 'Prove the website belongs to your company in one step, using the Google account that owns it in Search Console.',
        level: 'Beginner',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/verification',
        chapters: [
          'Open Verify ownership',
          'Choose Verify with Google',
          'Open the step-by-step guide',
          'Click Verify with Google and pick the account',
        ],
      },
      {
        id: '2.2',
        slug: 'verify-with-dns-or-meta-tag',
        title: 'Prove the website is yours from your domain settings or your homepage code',
        summary: 'Prove ownership when you manage the domain or the homepage but not the Google account.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/verification',
        chapters: [
          'Choose a DNS record or a meta tag',
          'Copy the value Alaventra gives you',
          'Open the step-by-step guide',
          'Add it at your domain provider',
          'Press Check now',
          'Or add a meta tag to your homepage',
        ],
        aka: ['DNS', 'Verify', 'meta', 'record', 'tag', 'with'],
      },
      {
        id: '2.3',
        slug: 'connect-search-console-and-analytics',
        title: 'Connect Search Console and Google Analytics',
        summary: 'Let Alaventra read your Google search and traffic data so every report and recommendation uses real figures.',
        level: 'Beginner',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/verification',
        chapters: [
          'Copy the address Alaventra asks you to add',
          'Add it as a Full user in Search Console',
          'Add it as a Viewer in Google Analytics',
          'Or enter your property ID',
          'Check again and choose your property',
        ],
      },
      {
        id: '2.4',
        slug: 'add-another-website',
        title: 'Add another website',
        summary: 'Grow a second site from the same company, each with its own dashboard.',
        level: 'Beginner',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/new',
        chapters: [
          'Open the website switcher and choose Add a website',
          'Type the address and main country',
          'Say what it does and sells',
          'Describe its customers and main goal',
          'Add the optional details',
          'Click Add website',
        ],
      },
      {
        id: '2.5',
        slug: 'use-the-setup-guides',
        title: 'Use the step-by-step setup guides',
        summary: 'Get exact steps, with your own values filled in, for anything Alaventra asks you to do outside the app.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/verification',
        chapters: [
          'Open a guide next to any request',
          'Read your own values, filled in',
          'Follow the steps, ticking each one',
          'Copy the steps or send them to a colleague',
          'Search every guide from the sidebar',
          'Open a guide from the list',
        ],
      },
    ],
  },
  {
    id: '3',
    title: 'Your business profile',
    summary: 'The facts, people and style every page is written from.',
    tutorials: [
      {
        id: '3.1',
        slug: 'keep-business-details-up-to-date',
        title: 'Keep your business details up to date',
        summary: 'Change what you sell, your facts, competitors or brand names, and every new page and report uses them.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/business',
        chapters: [
          'Open Business details and check the basics',
          'Add what you sell',
          'Describe your customers, goal, tone and call to action',
          'Add your business facts',
          'Update competitors and brand names',
          'Save changes',
        ],
      },
      {
        id: '3.2',
        slug: 'add-author-and-reviewer',
        title: 'Add the author, reviewer and business address behind your pages',
        summary: "Show readers and search engines who stands behind your content, with the author's name on every page, a short author box and an expert reviewer.",
        level: 'Intermediate',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/profile',
        chapters: [
          'Open Author & profile',
          'Get the step-by-step guide',
          'Add the author and their experience',
          "Add the author's page, links and topics",
          'Add an expert reviewer if you have one',
          'Add your business contact details',
          'Add your address and service areas',
          'Save the profile',
        ],
      },
      {
        id: '3.3',
        slug: 'set-your-style-guide',
        title: 'Set your style guide',
        summary: 'Make every page sound like you, with your brand spelling, tone and words to avoid.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 1,
        start: '/o/<company>/sites/<website>/settings/profile',
        chapters: [
          'Open How you write',
          'Get the step-by-step guide',
          'Set your brand spelling',
          'Choose your spelling and tone',
          'List words to avoid and other rules',
          'Save',
        ],
      },
      {
        id: '3.4',
        slug: 'write-a-case-study',
        title: 'Turn a client result into a case study',
        summary: 'Build a library of real proof that your pages can cite, and get a case-study page written from it.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/tools/case_study',
        chapters: [
          'Open Write a case study',
          'Describe the client',
          'Add the industry, location and country',
          'Describe the project',
          'Add the results with numbers and a quote',
          'Choose the keyword for its page',
          'Write the case study',
        ],
      },
    ],
  },
  {
    id: '4',
    title: 'Your first analyses',
    summary: 'Run an analysis, follow it and use its report.',
    tutorials: [
      {
        id: '4.1',
        slug: 'run-an-analysis',
        title: 'Run an analysis: pick a tool, see the credits and start',
        summary: 'Know which tool answers which question, what it costs in credits and how long it takes before you start.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 1,
        start: '/o/<company>/tools',
        chapters: [
          'Choose the website',
          'Pick a tool by what you want to achieve',
          'Check what you get, the credits and the time',
          'Start the run',
        ],
      },
      {
        id: '4.2',
        slug: 'find-keywords-for-your-business',
        title: 'Find keywords worth winning',
        summary: 'Get a researched list of keywords that fit your business, grouped by topic, with quick wins called out.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/tools/discover',
        chapters: [
          'Describe what you sell and who buys it',
          'Choose any follow-up reports',
          'Find keywords',
          'Read the keyword strategy',
        ],
      },
      {
        id: '4.3',
        slug: 'get-a-keyword-verdict',
        title: 'Get a verdict on a keyword',
        summary: 'Find out if a keyword is worth a page before you spend time on it: Go, Go with changes or Avoid, with the reasons.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 1,
        start: '/o/<company>/tools/verdict',
        chapters: [
          'Type the keyword',
          'Add what you sell',
          'Get the verdict',
          'Read the reasons and risks',
        ],
      },
      {
        id: '4.4',
        slug: 'write-a-page-for-a-keyword',
        title: 'Write a page for a keyword',
        summary: 'Get a researched, quality-checked page for one keyword, with its images and its keyword report, ready to publish.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/tools/keyword',
        chapters: [
          'Type the keyword and choose the page type',
          'Choose what you get',
          'Check the voice and facts',
          'Write the page',
        ],
      },
      {
        id: '4.5',
        slug: 'follow-a-run',
        title: 'Follow a run and open its reports',
        summary: 'See where an analysis is, what it will cost and every report it delivers, in one place.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 1,
        start: '/o/<company>/runs',
        chapters: [
          'Open Runs and filter the list',
          'Open a run to see its progress',
          'Read the timeline and the credits',
          'Open a report as a page',
          'Try again if it failed, or run it again',
        ],
      },
      {
        id: '4.6',
        slug: 'read-download-and-share-a-report',
        title: 'Read, download and share a report',
        summary: 'Use a finished report: download its files, save it as PDF and share a read-only link that expires.',
        level: 'Beginner',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/reports',
        chapters: [
          'Find a report by website or type',
          'Read the summary and download the files',
          'Save it as a PDF',
          'Share a link that stops working on the day you choose',
          'Send it to your delivery list now',
        ],
      },
      {
        id: '4.7',
        slug: 'see-how-your-website-describes-you',
        title: 'See how your website describes your business',
        summary: 'Get a short, plain summary of what your homepage says you do, for whom and why you stand out, with searches customers would use to find you.',
        level: 'Beginner',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/tools/describe',
        chapters: [
          'Open Describe my website and pick the website',
          'See what you will get',
          'Start it',
          'Read the summary, the offers and who they are for',
          'Check one of the suggested searches',
        ],
      },
    ],
  },
  {
    id: '5',
    title: 'Pipeline and keyword ladders',
    summary: 'Your weekly plan, and climbing to the keywords that matter most.',
    tutorials: [
      {
        id: '5.1',
        slug: 'read-your-pipeline',
        title: 'Read your Pipeline: this week and what needs you',
        summary: 'See what runs this week, what waits for you and how your pages are doing, on one screen.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/pipeline',
        chapters: [
          'See whether the autopilot is on',
          'Handle what needs you first',
          'Check this week and the next automatic run',
          'Read how a keyword ladder works',
        ],
      },
      {
        id: '5.2',
        slug: 'start-a-keyword-ladder',
        title: 'Start a keyword ladder for a hard keyword',
        summary: 'Plan a climb from easy supporting pages up to the keyword you really want, and see the plan before it starts.',
        level: 'Intermediate',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/pipeline/new',
        chapters: [
          'Choose a recommended keyword or check your own',
          'Read the difficulty for your site',
          'Review the plan and the checks',
          'Choose how it runs and its priority',
          'Start the ladder',
        ],
      },
      {
        id: '5.3',
        slug: 'follow-a-ladder',
        title: 'Follow a keyword ladder as it climbs',
        summary: 'See which pages are live, where each one ranks and what comes next for one keyword.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/pipeline/ladders/<ladder>',
        chapters: [
          'Open a ladder from the Pipeline',
          'See the climb and the pages live',
          'Follow positions over time',
          'Read what happens next',
          'See whether publishing these pages helped',
          'Open the reports of this ladder',
        ],
      },
      {
        id: '5.4',
        slug: 'approve-whats-coming-up',
        title: 'Approve or skip what is coming up',
        summary: 'Decide on each page before the weekly run writes it, so nothing is written without your say.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 1,
        start: '/o/<company>/sites/<website>/pipeline',
        chapters: [
          'Open Coming up',
          'Approve a page, or skip it this week or for good',
          'Write a page now if you want it sooner',
        ],
      },
      {
        id: '5.5',
        slug: 'set-auto-or-manual-and-priority',
        title: 'Set each ladder to Auto or Manual and order them',
        summary: 'Control which keyword gets the weekly pages first and which ones wait for your approval.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/pipeline',
        chapters: [
          'Switch a ladder between Auto and Manual',
          'Move ladders up or down',
          'Pause a ladder, or delete one you no longer want',
          'Open Pipeline settings and save your limits',
        ],
      },
      {
        id: '5.6',
        slug: 'choose-autopilot-level-and-weekday',
        title: 'Choose your autopilot level and your weekday',
        summary: 'Decide how much Alaventra does on its own and which day your weekly work runs.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/autopilot',
        chapters: [
          'Open Website settings, Autopilot',
          'Choose one of the three levels',
          'Move your weekly run to another weekday',
        ],
      },
      {
        id: '5.7',
        slug: 'answer-a-keyword-suggestion',
        title: 'Answer a keyword Alaventra suggests',
        summary: 'Start, swap or turn down the keyword Alaventra suggests next, so your weekly pages always go to a search you agreed to.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/pipeline',
        chapters: [
          'Find the keyword suggestion on your Pipeline',
          'Start the ladder, see others or say not now',
          'On full autopilot: approve, pick a different one or skip',
          'Type your own keyword instead',
        ],
      },
      {
        id: '5.8',
        slug: 'write-suggested-pages-and-see-what-runs',
        title: 'Write the pages Alaventra suggests and see what runs on its own',
        summary: 'Catch pages that are losing visitors, searches close to page one and rising topics, write the ones you want, and see every automatic check for the next four weeks.',
        level: 'Intermediate',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/pipeline',
        chapters: [
          'Open Always on and turn weekly pages on or change them',
          'Read the suggestions: losing visitors, close to page one, rising searches, AI answers',
          'Write the ones you want',
          'See the checks that run on their own',
          'Check the next four weeks and the recent automatic runs',
        ],
      },
      {
        id: '5.9',
        slug: 'tick-off-the-steps-on-your-website',
        title: 'Tick off the steps on your website',
        summary: 'Find the changes only you can make on your own website, copy what to add, open the guide, check it at once, and skip the ones you do not need. We also check every day on our own.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 1,
        start: '/o/<company>/sites/<website>/pipeline',
        chapters: [
          'Find the steps in Needs you',
          'Copy what to add, or open Show me how',
          'Check it now',
          'See what done looks like',
          'Skip a step and bring it back',
        ],
      },
    ],
  },
  {
    id: '6',
    title: 'Content and publishing',
    summary: 'From a written page to a live, tracked page.',
    tutorials: [
      {
        id: '6.1',
        slug: 'see-your-content-pipeline',
        title: 'See every page from written to live',
        summary: 'Know which pages are live, which wait to be published and which need your edits.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/content',
        chapters: [
          'Open Content',
          'Read the board: live, waiting and needs edits',
          'Switch to the table and open a page report',
        ],
      },
      {
        id: '6.2',
        slug: 'tell-us-you-published',
        title: 'Tell Alaventra you published a page',
        summary: 'Have the live page checked and tracked from the day it goes up, so its rankings start counting.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/content',
        chapters: [
          'Publish the page on your site',
          'Report the published page',
          'Paste the live address',
          'Read the publish check',
        ],
      },
      {
        id: '6.3',
        slug: 'finish-a-page-that-needs-edits',
        title: 'Finish a page that needs your edits',
        summary: 'Fill the few blanks a page could not verify on its own and get it ready to publish.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/content',
        chapters: [
          'Open the page that needs edits',
          'See what to edit and why',
          'Fill the blanks, then publish it',
        ],
      },
      {
        id: '6.4',
        slug: 'check-a-page-before-you-publish',
        title: 'Check any page before you publish it',
        summary: 'Paste any draft and find out whether it is ready to publish, with every reason named and what to fix.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 1,
        start: '/o/<company>/sites/<website>/content',
        chapters: [
          'Open the page check on Content',
          'Type the search the page is for',
          'Paste the page and read the verdict',
        ],
      },
      {
        id: '6.5',
        slug: 'connect-your-cms',
        title: 'Connect your website builder (WordPress, Webflow, Contentful)',
        summary: 'Send written pages straight to WordPress, Webflow, Contentful or your own website system as drafts, with no copying and pasting.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/publishing',
        chapters: [
          'Open Publishing and choose Connect a CMS',
          'Pick your CMS and paste its access details',
          'Connect and test',
          'Map the fields if asked',
        ],
        aka: ['CMS'],
      },
      {
        id: '6.6',
        slug: 'send-a-page-to-your-cms',
        title: 'Send a page to your website builder as a draft',
        summary: 'Put a finished page into WordPress, Webflow or Contentful as a draft in one click, and publish it live when an owner or admin is ready.',
        level: 'Intermediate',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/reports/<report>',
        chapters: [
          'Open the written page report',
          'Send it to your CMS as a draft',
          'Publish it live when you are ready',
          'Check that it is live',
        ],
        aka: ['CMS'],
      },
      {
        id: '6.7',
        slug: 'read-a-written-page',
        title: 'Read a written page before you publish it',
        summary: 'Look over a finished page as readers will see it, with its images, links to add, sources and publishing checklist, then download it or say it is not what you wanted.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/reports/<report>',
        chapters: [
          'Open the page report and read the preview',
          'Switch to the HTML, Markdown and page details',
          'Go through the publishing checklist',
          'Check the images, internal links and sources',
          'Download the files',
          'Mark it as not what you wanted, and say why',
        ],
      },
    ],
  },
  {
    id: '7',
    title: 'Tracking and technical health',
    summary: 'Your weekly numbers, rankings, recommendations, weekly report and site health.',
    tutorials: [
      {
        id: '7.1',
        slug: 'read-your-overview',
        title: 'Read your website overview',
        summary: 'See clicks, rankings, health, AI answers and links for your website in one glance, with what to do first.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/overview',
        chapters: [
          'Read the headline numbers',
          'See health, AI answers and links',
          'Check the top recommendations',
          'Look at search performance',
          'Follow trends, content and alerts',
        ],
      },
      {
        id: '7.2',
        slug: 'read-search-and-traffic',
        title: 'Read your search and traffic',
        summary: 'Understand which searches and pages bring visitors from search engines, how people reach your site and what changed this week.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/search',
        chapters: [
          'Read clicks, impressions and position',
          'See the week in brief',
          'See whether your changes helped',
          'See visitors by channel and the pages they land on',
          'Find winning, losing and close-to-page-one searches',
          'Check demand in Google Trends',
        ],
      },
      {
        id: '7.3',
        slug: 'track-your-rankings',
        title: 'Track where your keywords rank',
        summary: 'Follow your positions on Google every week, on a computer and on a phone, and spot the biggest moves.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/rankings',
        chapters: [
          'See how many keywords are in the top 10',
          'Compare positions over time',
          'Read the biggest moves',
          "Open a keyword's details",
          'Add keywords to weekly tracking',
        ],
      },
      {
        id: '7.4',
        slug: 'act-on-recommendations',
        title: 'Act on your recommendations',
        summary: 'Work through the next steps in order of what they are worth, with a button that starts each one.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 1,
        start: '/o/<company>/sites/<website>/recommendations',
        chapters: [
          'Filter by priority or area, or group by what they are worth',
          'Read why an item matters',
          'Start it with its button',
          'Send it to your developers as a ticket',
        ],
      },
      {
        id: '7.5',
        slug: 'run-a-technical-audit',
        title: 'Run a technical audit',
        summary: 'Check your whole site and get every issue that costs you visitors, ranked, with the files to fix them, or a full report to share as PDF or Word.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/tools/audit',
        chapters: [
          'Open Site audit',
          'Choose a technical audit, or the full SEO report',
          'Pick how many pages to check',
          'Turn on Render JavaScript if your site needs it',
          'Add competitors',
          'Start the audit',
        ],
        aka: ['SEO'],
      },
      {
        id: '7.6',
        slug: 'fix-what-the-audit-found',
        title: 'Read the audit and download the fix pack',
        summary: 'See what to fix first, hand your developers the ready-made files and hear the same day when a key page breaks.',
        level: 'Intermediate',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/technical',
        chapters: [
          'Read the health score and what changed',
          'Download the fix pack for your developers',
          'Watch your key pages every day',
          'Filter the findings',
          'Mark a fix done to have it re-checked',
          'Open past audit reports',
        ],
      },
      {
        id: '7.7',
        slug: 'record-the-monthly-check-in',
        title: 'Record the monthly Search Console check-in',
        summary: 'Keep a monthly record of what only Search Console shows, so problems are caught early.',
        level: 'Beginner',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/alerts',
        chapters: [
          'Open Alerts & check-ins',
          'Record the check-in from Search Console',
          'Upload the Pages report file',
          'Review past months and open alerts',
        ],
      },
      {
        id: '7.8',
        slug: 'see-what-crawlers-fetch',
        title: 'See what Google and AI crawlers fetch on your site',
        summary: "Find the pages Google's and AI assistants' crawlers never read, and spot fake crawlers, from your website's logs.",
        level: 'Advanced',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/crawlers',
        chapters: [
          'Upload a server log',
          'Or have your hosting send its logs on its own',
          'Read who fetched what',
          'Find pages crawlers missed',
          'See wasted requests and new pages',
          'Spot impostors',
        ],
      },
      {
        id: '7.9',
        slug: 'choose-what-is-checked-every-week',
        title: 'Choose what is checked every week',
        summary: 'Decide which keywords, competitors and checks your weekly tracking covers, see the credits each one uses a month, and pause it when you need a break.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/tracking',
        chapters: [
          'Open Tracking & monitors and start or pause weekly tracking',
          'Set the country, the keywords to watch and Google Analytics',
          'Choose how many pages a week are written for your keyword',
          'Switch the growth monitors on or off: backlinks, link building, the monthly audit',
          'Add competitors and brand names',
          'Group your pages for the weekly report',
          'Check the credits a month and save',
        ],
      },
      {
        id: '7.10',
        slug: 'read-your-weekly-report',
        title: 'Read your weekly report',
        summary: 'Read one report each week with your visitors, searches, keywords, pages waiting to be published and what changed, so you know what to do next.',
        level: 'Beginner',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/reports',
        chapters: [
          "Find this week's site report",
          'See where visitors came from',
          'Read the searches, pages and tracked keywords',
          'Check your ladder pages and the pages waiting to be published',
          'Read the weekly rankings report: your gains, drops and moves of the whole results page',
          'Send or share it',
        ],
      },
    ],
  },
  {
    id: '8',
    title: 'AI visibility and AI growth',
    summary: 'Find out if AI assistants name you, and work to be named.',
    tutorials: [
      {
        id: '8.1',
        slug: 'run-your-first-ai-visibility-check',
        title: 'Check if AI assistants name your business',
        summary: "See how often ChatGPT, Gemini, Perplexity and Google's AI name and cite you when buyers ask, with the price quoted for your whole question list before you start.",
        level: 'Beginner',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/tools/ai_visibility',
        chapters: [
          'Open AI visibility',
          'Choose the assistants and buyer topics',
          'See the price for your whole question list',
          'Start the check',
        ],
      },
      {
        id: '8.2',
        slug: 'read-your-ai-visibility',
        title: 'Read your AI visibility results',
        summary: 'Understand where you are named, who is named instead, how sure each rate is and which sources the answers trust.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/ai',
        chapters: [
          'Read the score and share of voice',
          'See the range beside every rate',
          'Check the week-on-week change',
          'Find the questions you lose and who wins them',
          'Act on what to do next',
        ],
      },
      {
        id: '8.3',
        slug: 'manage-your-question-panel',
        title: 'Choose the questions buyers ask AI',
        summary: 'Track the questions that matter for your market, by topic, buyer role and country, and change many at once.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/ai',
        chapters: [
          'Review the tracked questions',
          'Add your own buyer questions',
          'Edit, pin or switch questions off',
          'Change many questions at once',
          'Import a list from a file',
          'See which questions are not asked',
        ],
      },
      {
        id: '8.4',
        slug: 'set-up-ai-monitoring',
        title: 'Set up weekly AI monitoring',
        summary: 'Keep measuring AI answers every week, with a daily pulse on the fastest-moving assistants.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/tracking',
        chapters: [
          'Open Tracking & monitors',
          'Set the number of questions, roles and markets',
          'Turn on the daily pulse and AI growth',
          'Save',
        ],
      },
      {
        id: '8.5',
        slug: 'act-on-ai-growth',
        title: 'Get named more often with AI growth',
        summary: 'Work the weekly list that gets AI assistants to find and cite you: one file for your site, the questions to win with a page, and the sites to pitch.',
        level: 'Advanced',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/ai',
        chapters: [
          "Read this week's AI growth",
          'Add the one file that speeds up indexing',
          'See the pages AI cites without naming you',
          'Win questions with an answer page',
          'Make your key pages easy to quote',
        ],
      },
      {
        id: '8.6',
        slug: 'see-what-ai-said-about-you',
        title: 'See exactly what AI said about you',
        summary: 'Open any answer in full: who was named first, which pages were cited, and what the assistant read but did not cite.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/ai',
        chapters: [
          'Open Answers and pick a question',
          'Read the answer',
          'See the brands in the order named',
          'Find an answer that cites you, and read it whole',
          'See the pages cited, and the pages read but not cited',
          'See what it searched, its sources and its cards',
          'Compare every assistant',
        ],
      },
      {
        id: '8.7',
        slug: 'follow-your-ai-visibility-over-time',
        title: 'Follow your AI visibility over time',
        summary: 'Filter by assistant, topic, buyer role, market, stage and dates, watch the trend per assistant and per competitor, and download the figures.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/ai',
        chapters: [
          'Use the filter bar',
          'Read the trend for each assistant',
          'Read the trend for each competitor',
          'See your pages, sources and sentiment',
          'Download a CSV',
        ],
      },
      {
        id: '8.8',
        slug: 'set-your-own-ai-alerts',
        title: 'Set your own AI alerts',
        summary: 'Be told when your visibility, your share of voice or a competitor moves by as much as you choose, and see how a rule would have fired before you save it.',
        level: 'Advanced',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/ai',
        chapters: [
          'Open Alert rules',
          'Add a rule: what to watch and by how much',
          'Preview it on past runs',
          'Narrow it to an assistant, topic, buyer role or market',
          'Turn it on',
        ],
      },
      {
        id: '8.9',
        slug: 'add-your-bing-and-search-console-ai-reports',
        title: 'Add your Bing and Search Console AI reports',
        summary: "Bring in the reports that show how Copilot cites you and how Google's AI search sends people, by uploading a file from each.",
        level: 'Intermediate',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/ai',
        chapters: [
          'Open Your AI reports',
          'Export the report from Bing Webmaster Tools',
          'Export the report from Search Console',
          'Upload the file',
          'Read what it adds',
        ],
      },
      {
        id: '8.10',
        slug: 'choose-extra-ai-checks',
        title: 'Choose extra AI checks',
        summary: "Add optional checks, each with its price, and run the one-time repeat test that shows how much an assistant's answer moves.",
        level: 'Advanced',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/settings/tracking',
        chapters: [
          'Open the extra AI options',
          'Pick the optional checks and read each price',
          'Ask Claude every week and choose the daily pulse assistants',
          'Check the searches behind the answers',
          'Get the repeat test price, then confirm it',
        ],
      },
      {
        id: '8.11',
        slug: 'see-what-ai-gets-wrong-and-whether-it-can-read-your-site',
        title: 'See what AI gets wrong and whether it can read your site',
        summary: 'Find out what AI assistants get wrong about your business and how to put it right, whether they can read your pages, and what the visitors they send are worth to you.',
        level: 'Intermediate',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/ai',
        chapters: [
          'See how well AI knows you and what its visits are worth',
          'Read the words AI uses for you and what it gets wrong',
          'Put the right facts in your business profile',
          'Check whether AI assistants can read your site',
          'Compare your share across the whole market',
          'Add the questions worth tracking',
        ],
      },
    ],
  },
  {
    id: '9',
    title: 'Backlinks and link building',
    summary: 'Know who links to you, and earn new links from your own mailbox.',
    tutorials: [
      {
        id: '9.1',
        slug: 'check-your-backlinks',
        title: 'Check your backlinks',
        summary: 'Get one list of the sites that link to you, with each important link checked on its page.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 1,
        start: '/o/<company>/tools/backlinks',
        chapters: [
          'Open the backlink check',
          'Choose the full check or free sources only',
          'Add competitors for the gap',
          'Start the check',
        ],
      },
      {
        id: '9.2',
        slug: 'read-your-backlinks',
        title: 'Read your backlinks: new, lost, best and spammy',
        summary: 'See which links you won or lost and why, which are worth the most and where to get more.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/backlinks',
        chapters: [
          'Read referring sites, new and lost links',
          'Filter to the best or lost links',
          'See where opportunities are',
          'Contact a prospect and mark it contacted',
        ],
      },
      {
        id: '9.3',
        slug: 'upload-the-links-google-knows',
        title: 'Add the links Google knows about',
        summary: 'Upload your Search Console links export so your link list includes links only Google has seen.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 1,
        start: '/o/<company>/sites/<website>/backlinks',
        chapters: [
          'Open Add Search Console links',
          'Export the links from Search Console',
          'Choose the file and upload it',
        ],
      },
      {
        id: '9.4',
        slug: 'connect-a-mailbox',
        title: 'Connect the mailbox your pitches go out from',
        summary: 'Send link-building pitches from your own address, within safe daily limits.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/mailboxes',
        chapters: [
          'Open Mailboxes and connect your mailbox',
          'Add your signature and postal address',
          'Set the sending window and daily limits',
          'Keep your opt-out list',
        ],
      },
      {
        id: '9.5',
        slug: 'review-and-approve-pitches',
        title: 'Review and approve link-building pitches',
        summary: 'Read each drafted pitch, edit it and approve it, so nothing goes out without you.',
        level: 'Intermediate',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/links',
        chapters: [
          'Open Link building',
          'Read a pitch and edit its subject and text',
          'Confirm consent where the law asks for it',
          'Approve and schedule it, or mark it not a fit',
          'Choose how approvals work',
        ],
      },
      {
        id: '9.6',
        slug: 'answer-replies-and-follow-pitches',
        title: 'Answer replies and follow your pitches',
        summary: 'Reply while the conversation is fresh and record the links you win.',
        level: 'Intermediate',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/links',
        chapters: [
          'See the pitches in progress',
          'Read a reply and edit the suggested answer',
          'Send it in the same thread',
          'Mark the link won',
          'See which kinds of openings and subject lines work best',
        ],
      },
      {
        id: '9.7',
        slug: 'add-listings-and-redirects',
        title: 'Add listings and redirects you can do yourself',
        summary: 'Pick up easy links from directories and platforms, and keep the value of old addresses that now fail.',
        level: 'Beginner',
        audience: ['marketer'],
        minutes: 2,
        start: '/o/<company>/sites/<website>/links',
        chapters: [
          'Open the listings checklist',
          'Submit to the ones worth being on',
          'Copy the redirects for your developer',
          'See what your links did',
        ],
      },
      {
        id: '9.8',
        slug: 'read-your-weekly-link-building-report',
        title: 'Read your weekly link-building report',
        summary: "See the week's link openings in one read: pitches drafted, podcasts that take guests, the kinds of pages that earn links in your market and what your won links did.",
        level: 'Intermediate',
        audience: ['marketer', 'owner'],
        minutes: 2,
        start: '/o/<company>/reports',
        chapters: [
          "Open this week's link-building report",
          'See the pitches drafted, and any that were not',
          'Find podcasts that take guests',
          'See the kinds of pages that earn links in your market',
          'Check listings, redirects and what your links did',
          'Download the report',
        ],
      },
    ],
  },
  {
    id: '10',
    title: 'Team, credits and report delivery',
    summary: 'Who can do what, what you spend and where reports go.',
    tutorials: [
      {
        id: '10.1',
        slug: 'invite-your-team',
        title: 'Invite your team and choose their roles',
        summary: 'Give colleagues the right access, from view-only to admin.',
        level: 'Beginner',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/team',
        chapters: [
          'Open Team and see who has access',
          'Type the e-mail address and choose a role',
          'Create the invitation and share the link',
          'Change a role or remove someone later',
        ],
      },
      {
        id: '10.2',
        slug: 'understand-your-credits',
        title: 'Understand your credits',
        summary: "See your balance, what each website's automatic work and your own analyses use, and when credits expire.",
        level: 'Beginner',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/credits',
        chapters: [
          'Read what is available and what is held',
          'See autopilot and on-demand use this month',
          'Check what each website is forecast to use',
          'See when your credits expire',
          'Review the activity list and download it',
        ],
      },
      {
        id: '10.3',
        slug: 'buy-credits-and-set-limits',
        title: 'Buy credits, find invoices and set limits',
        summary: 'Top up when you need to and cap what autopilot and on-demand analyses may use each month.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/credits',
        chapters: [
          'Open Buy credits and send a request',
          'Find the invoice once it is confirmed',
          'Set monthly limits and save',
        ],
      },
      {
        id: '10.4',
        slug: 'deliver-reports-on-a-schedule',
        title: 'Deliver reports by e-mail or to your own systems on a schedule',
        summary: 'Have finished reports arrive where your team already works, on the schedule you choose.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/delivery',
        chapters: [
          'Choose how often reports go out',
          'Pick e-mail or a webhook, or both',
          'Send a test and save',
          'Check what went out and what was held back',
        ],
        aka: ['webhook'],
      },
      {
        id: '10.5',
        slug: 'keep-your-company-and-websites-in-order',
        title: 'Keep your company and websites in order',
        summary: "Change your company's details, see every website and its status at a glance, and pause, remove or leave what you no longer need.",
        level: 'Beginner',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/company',
        chapters: [
          'Update your company details',
          'Finish a setup you left open',
          "See each website's status and open its settings",
          'Pause tracking or delete a website',
          'Leave a company, or delete it as its owner',
        ],
      },
    ],
  },
  {
    id: '11',
    title: 'Integrations, security and agencies',
    summary: 'Connect your tools, protect accounts and run client work.',
    tutorials: [
      {
        id: '11.1',
        slug: 'send-alerts-to-slack-or-teams',
        title: 'Send alerts to Slack or Microsoft Teams',
        summary: 'Get alerts, failed analyses and finished reports in the channel your team watches.',
        level: 'Intermediate',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/integrations',
        chapters: [
          'Open Integrations and add an endpoint',
          'Choose Slack or Teams and paste the channel address',
          'Pick the events and websites',
          'Send a test',
        ],
      },
      {
        id: '11.2',
        slug: 'turn-findings-into-tickets',
        title: 'Turn findings into Jira, Linear or Asana tickets',
        summary: 'Hand audit findings and recommendations to your developers in the tracker they already use.',
        level: 'Intermediate',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/o/<company>/settings/integrations',
        chapters: [
          'Connect your issue tracker',
          'Open a finding or recommendation',
          'Create a ticket and follow its status',
        ],
      },
      {
        id: '11.3',
        slug: 'export-your-data',
        title: 'Export your data to your warehouse and Looker Studio',
        summary: 'Use your rankings, traffic, audits and AI figures in your own dashboards.',
        level: 'Advanced',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/integrations',
        chapters: [
          'Add a storage or BigQuery destination',
          'Choose the tables and format',
          'Set a daily or weekly schedule',
          'Connect Looker Studio',
        ],
      },
      {
        id: '11.4',
        slug: 'connect-an-ai-assistant',
        title: 'Create an access key and connect an AI assistant',
        summary: 'Ask an AI assistant about your rankings, traffic and audits, or read the same figures from your own scripts.',
        level: 'Advanced',
        audience: ['owner'],
        minutes: 2,
        start: '/o/<company>/settings/api',
        chapters: [
          'Create a key and choose what it may do',
          'Copy it once and store it safely',
          'Add it to your AI assistant',
          'Revoke it when no longer needed',
        ],
        aka: ['API'],
      },
      {
        id: '11.5',
        slug: 'protect-your-account',
        title: 'Protect your account with two-step verification and passkeys',
        summary: 'Add a second step to your sign-in and sign in with your fingerprint or a security key.',
        level: 'Intermediate',
        audience: ['owner', 'marketer'],
        minutes: 2,
        start: '/account',
        chapters: [
          'Open Your account',
          'Turn on two-step with an authenticator app',
          'Save your recovery codes',
          'Add a passkey',
          "Check where you're signed in",
        ],
      },
      {
        id: '11.6',
        slug: 'require-two-step-and-set-up-sso',
        title: 'Require two-step for everyone and set up single sign-on',
        summary: 'Make sure everyone in your company signs in safely, through your identity provider if you have one.',
        level: 'Advanced',
        audience: ['owner'],
        minutes: 3,
        start: '/o/<company>/settings/security',
        chapters: [
          'Require two-step verification',
          'Set when idle people are signed out and how long records are kept',
          'Prove your e-mail domain',
          'Connect your identity provider',
          'Create and switch off accounts from your identity provider',
          'Check who did what in the audit log and export it',
        ],
      },
      {
        id: '11.7',
        slug: 'run-clients-as-an-agency',
        title: 'Run your clients from one agency workspace',
        summary: 'Give each client its own workspace and decide which of your people work on it.',
        level: 'Advanced',
        audience: ['agency'],
        minutes: 2,
        start: '/o/<agency>/clients',
        chapters: [
          'Turn on agency mode',
          'Create a client workspace',
          'Give your people access to it',
          'See every client website in one table and export it',
          'Switch between clients',
        ],
      },
      {
        id: '11.8',
        slug: 'brand-your-client-portal',
        title: 'Brand the client portal as your own',
        summary: 'Show clients your name, logo and colour, on your own address.',
        level: 'Advanced',
        audience: ['agency'],
        minutes: 2,
        start: '/o/<agency>/settings/branding',
        chapters: [
          'Add your product name, logo and colour',
          'Check the preview',
          'Put the portal on your own address',
          'Set who client e-mails come from and where replies go',
          'Give one client its own brand',
        ],
      },
      {
        id: '11.9',
        slug: 'ask-a-client-to-approve',
        title: 'Ask a client to approve a page or pitch',
        summary: "Get a client's yes before a page or outreach goes out, inside their portal.",
        level: 'Advanced',
        audience: ['agency'],
        minutes: 2,
        start: '/o/<client>/approvals',
        chapters: [
          'Require approval for a client',
          "Open the client's Approvals",
          'Ask for approval of a page or pitch',
          'See the client approve or ask for changes',
        ],
      },
      {
        id: '11.10',
        slug: 'update-your-name-password-and-google-sign-in',
        title: 'Update your name, password and Google sign-in',
        summary: 'Keep your own sign-in up to date: your name, your confirmed e-mail, your password and the Google account you sign in with.',
        level: 'Beginner',
        audience: ['owner', 'marketer', 'agency'],
        minutes: 2,
        start: '/account',
        chapters: [
          'Change your name',
          'Confirm your e-mail or send the link again',
          'Link your Google account',
          'Change your password',
          'See your companies and sign out',
        ],
      },
      {
        id: '11.11',
        slug: 'invite-your-client-into-their-portal',
        title: 'Invite your client into their portal',
        summary: 'Give your client their own sign-in to follow their websites and reports, as a viewer or as an approver, without seeing your other clients.',
        level: 'Advanced',
        audience: ['agency'],
        minutes: 2,
        start: '/o/<client>/settings/team',
        chapters: [
          "Open the client's workspace and its Team",
          'Invite people as Client viewer or Client approver',
          'Send the link from your agency',
          'See the portal as your client sees it',
        ],
      },
    ],
  },
];

export const quickTips: string[] = ['Sign in with Google, your company sign-in or a passkey', 'Reset a forgotten password', 'Switch between light and dark mode', 'Pause weekly tracking instead of deleting a website', 'Describe your website in two minutes', 'Group pages into content groups for the weekly report', 'Add other keywords to watch without writing for them', 'Mark a page as not what you wanted', 'Change how many pages a week are written', 'Answer a keyword proposal', 'Send a report again now', 'Turn off a share link', 'Run a failed analysis again', 'Read the article preview and the page files of a written page', 'Add a domain or address to the opt-out list', 'Find who did what in the audit log', 'Sign out of other devices', 'Leave a company'];
// </catalogue>

/**
 * Where the films are served from: VITE_TUTORIALS_VIDEO_BASE (build time), an https origin with an optional path, or a path on this
 * site; the player plays `<base>/<slug>.mp4`. Unset in development: the git-ignored public/tutorials/video/ folder that
 * sync_tutorials.py --videos fills. Unset in a production build: no player is shown (the cover and the written steps are), because
 * the films are not part of the build.
 */
const RAW_BASE = String(import.meta.env.VITE_TUTORIALS_VIDEO_BASE ?? '')
  .trim()
  .replace(/\/+$/, '');
const VALID_BASE = /^(https:\/\/[^\s/?#;]+(\/[^\s?#;]*)?|\/[^\s?#;]*)$/.test(RAW_BASE) ? RAW_BASE : '';
export const tutorialVideoBase = VALID_BASE || (import.meta.env.DEV ? '/tutorials/video' : '');
/** true when the base is configured (not the development fallback): the page then names the film's address in its structured data */
export const tutorialVideoBaseSet = VALID_BASE !== '';

export const tutorials: Tutorial[] = tutorialSeries.flatMap((series) =>
  series.tutorials.map((t, i) => ({ ...t, series, position: i + 1, index: 0, film: tutorialFilms[t.slug] })),
);
tutorials.forEach((t, i) => (t.index = i));

export const tutorialCount = tutorials.length;
export const seriesCount = tutorialSeries.length;
export const filmCount = tutorials.filter((t) => t.film).length;

export const tutorialBySlug = (slug: string | undefined): Tutorial | undefined => tutorials.find((t) => t.slug === slug);
export const seriesTutorials = (s: TutorialSeries): Tutorial[] => tutorials.filter((t) => t.series === s);

/** the film's address, or '' when it has no finished film or no place to play it from */
export const videoUrl = (t: Tutorial): string => (t.film && tutorialVideoBase ? `${tutorialVideoBase}/${t.slug}.mp4` : '');
/** the WebM copy's address, or '' when there is none */
export const webmUrl = (t: Tutorial): string => (t.film?.webm && tutorialVideoBase ? `${tutorialVideoBase}/${t.slug}.webm` : '');

/** the cover in its sizes: `src` (960 px), `srcSet` with the 1920 px copy, and the card pictures (light and dark) */
export function coverSet(film: TutorialFilm) {
  const base = film.cover.replace(/\.webp$/, '');
  return { src: film.cover, src2x: `${base}-1920.webp`, srcSet: `${film.cover} 960w, ${base}-1920.webp 1920w`, card: `${base}-card.webp`, cardDark: `${base}-card-dark.webp` };
}

const NOT_A_STEP = /^(introduction|what comes next|what you get)$/i;
/** the film's step chapters: what its cover counts as "4 steps" (not the introduction, tips or the result at the end) */
export const filmSteps = (film: TutorialFilm): TutorialChapter[] =>
  film.chapters.filter((c) => (c.kind ? c.kind === 'step' : !NOT_A_STEP.test(c.title)));
/** the film's tips (shown beside the written steps) */
/** the number of steps, counted the way the film counts them (the written steps, which follow the film) */
export const stepCount = (t: Tutorial): number => (t.film ? filmSteps(t.film).length || t.chapters.length : t.chapters.length);
export const filmTips = (film: TutorialFilm): TutorialChapter[] => film.chapters.filter((c) => c.kind === 'tip');

/** length in minutes: the film's real length when it is finished, else the planned one */
export const tutorialMinutes = (t: Tutorial): number => (t.film ? Math.max(1, Math.round(t.film.durationSeconds / 60)) : t.minutes);
export const seriesMinutes = (s: TutorialSeries): number => seriesTutorials(s).reduce((n, t) => n + tutorialMinutes(t), 0);
export const courseMinutes = (): number => tutorials.reduce((n, t) => n + tutorialMinutes(t), 0);
/** minutes of finished video in the whole course */
export const filmMinutes = (): number => Math.round(tutorials.reduce((n, t) => n + (t.film?.durationSeconds ?? 0), 0) / 60);

/** "1 min", "1 hr 40 min" */
export function minutesLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** 59 -> "0:59", 3725 -> "1:02:05" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** ISO 8601 duration for schema.org: 59 -> "PT59S", 125 -> "PT2M5S" */
export function isoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `PT${m ? `${m}M` : ''}${s % 60 || !m ? `${s % 60}S` : ''}`;
}

export const audienceLabel: Record<TutorialAudience, string> = { owner: 'Business owners', marketer: 'Marketers', agency: 'Agencies' };
export const audienceShort: Record<TutorialAudience, string> = { owner: 'Owners', marketer: 'Marketers', agency: 'Agencies' };
export const levels: TutorialLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
export const levelNote: Record<TutorialLevel, string> = {
  Beginner: 'No experience needed',
  Intermediate: 'Easier once you know the basics',
  Advanced: 'For larger teams and agencies',
};

/** "Business owners and marketers" */
export function audienceSentence(a: TutorialAudience[]): string {
  const words = a.map((x, i) => (i === 0 ? audienceLabel[x] : audienceLabel[x].toLowerCase()));
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// the app's own page names (components/layout/OrgLayout.tsx), so the words match what the viewer sees on screen
const SITE_PAGES: Record<string, string> = {
  overview: 'Overview',
  pipeline: 'Pipeline',
  recommendations: 'Recommendations',
  search: 'Search & traffic',
  rankings: 'Rankings',
  content: 'Content',
  technical: 'Technical health',
  ai: 'AI visibility',
  crawlers: 'Crawlers',
  backlinks: 'Backlinks',
  links: 'Link building',
  alerts: 'Alerts & check-ins',
  settings: 'Website settings',
};
const COMPANY_PAGES: Record<string, string> = {
  tools: 'Run an analysis',
  runs: 'Runs',
  reports: 'Reports',
  settings: 'Company settings',
  sites: 'Add a website',
  clients: 'Clients',
  approvals: 'Approvals',
};

/** where in Alaventra the tutorial happens, in the app's words ("AI visibility", "The guided setup"), or '' when unknown */
export function whereInApp(start: string): string {
  const p = start.split('/').filter(Boolean);
  if (p[0] === 'signup') return 'The sign-up page';
  if (p[0] === 'login') return 'The sign-in page';
  if (p[0] === 'onboarding') return 'The guided setup';
  if (p[0] === 'invite') return 'Your invitation link';
  if (p[0] === 'account') return 'Your account';
  if (p[0] !== 'o') return '';
  if (p[2] === 'sites' && p[3] !== 'new') return SITE_PAGES[p[4] ?? ''] ?? '';
  return COMPANY_PAGES[p[2] ?? ''] ?? '';
}

/** the tutorial before and after this one in the whole course (none before the first / after the last) */
export function courseNeighbours(t: Tutorial): { prev?: Tutorial; next?: Tutorial } {
  return { prev: tutorials[t.index - 1], next: tutorials[t.index + 1] };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();

const haystacks = new Map<string, string>(
  tutorials.map((t) => [t.slug, norm([t.id, t.title, t.summary, t.series.title, t.level, ...t.chapters, ...(t.aka ?? []), ...t.audience.map((a) => audienceLabel[a]), ...(t.film?.chapters.map((c) => c.title) ?? [])].join(' '))]),
);

/** every word of the query appears in the tutorial (its number, title, summary, steps, series, level or audience) */
export function matchesQuery(t: Tutorial, query: string): boolean {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = haystacks.get(t.slug) ?? '';
  return words.every((w) => hay.includes(w.replace(/\.$/, '')));
}
