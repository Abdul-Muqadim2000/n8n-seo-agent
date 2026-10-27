import type { ReactNode } from 'react';
import {
  ArrowRight,
  Calculator,
  CalendarCheck,
  CalendarClock,
  ChartLine,
  ChartNoAxesColumnIncreasing,
  Coins,
  Inbox,
  Pause,
  Plug,
  RefreshCcw,
  Search,
  Send,
  SlidersHorizontal,
  ThumbsDown,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Container, CtaBand, Eyebrow, IconTile, KeywordVerdictMockup, LadderMockup, Reveal, Section, SectionHeading } from '../components';
import { AutoManualLanes } from '../components/platform/AutoManual';
import { ArrowLink, CheckList, jumpTo, useOn } from '../components/platform/kit';
import { ConnectMockup, CostMockup, PublishCheckMockup, ReportMockup } from '../components/platform/screens';
import { WeekSchedule } from '../components/platform/WeekSchedule';
import { LearnLink } from '../components/tutorials/LearnLink';
import { useSeo } from '../useSeo';

interface Stage {
  id: string;
  icon: LucideIcon;
  title: string;
  short: string;
  body: string;
  points: string[];
  visual: ReactNode;
  link: { to: string; label: string };
}

const STAGES: Stage[] = [
  {
    id: 'connect',
    icon: Plug,
    title: 'Connect your site',
    short: 'Verify ownership, connect Search Console and GA4',
    body: 'Add the website and prove it is yours, through Search Console, a DNS TXT record or a meta tag. Then add Alaventra\'s service account to Search Console and choose your GA4 property.',
    points: [
      'Website data appears only after ownership is verified',
      'Search Console and GA4 read through a service account you add as a user',
      'A business profile with your authors, expert reviewer, address and proof',
    ],
    visual: <ConnectMockup />,
    link: { to: '/platform/enterprise', label: 'Explore the enterprise platform' },
  },
  {
    id: 'research',
    icon: Search,
    title: 'Research and choose keywords',
    short: 'A verdict, difficulty for your site and a plan type',
    body: 'We ask one question: what would a customer type into Google to find a business like yours? Type your own ideas, or pick from suggestions built from the searches your website already appears for, your pages, your competitors and search data. Each one gets a verdict with its reasons, its difficulty for your site and the plan it takes: Direct, Short or Full. Pages are written only for the keywords you choose.',
    points: [
      'Your chances in plain words: "Good chance", "Takes a few months" or "Hard for your website now", with the searches a month and the credits a page',
      'The research behind your first suggestions is free, once per website, at setup',
      'Difficulty measured against your own domain, not a generic score',
      'Traffic estimates calibrated against your own impressions and clicks where you rank, and marked measured or modelled',
      'Topic fit, so you chase only keywords your business can own',
      'Searches Google answers with the same pages grouped, so one page serves them all',
    ],
    visual: <KeywordVerdictMockup />,
    link: { to: '/platform/keyword-research', label: 'Explore keyword research' },
  },
  {
    id: 'climb',
    icon: ChartNoAxesColumnIncreasing,
    title: 'Climb with ladders and the content engine',
    short: 'Supporting pages first, written in your authors\' names',
    body: 'Pick a keyword to climb and Alaventra plans the ladder: easier supporting pages first, each linking up to the head term. On your website\'s weekday the content engine writes the next pages, drafted, critiqued, edited and checked.',
    points: [
      'Two days before, "Coming up" shows every page that will be written, why and its credits',
      'Two ladders written at once by default, in your priority order',
      'Hub, case study, local and video page types',
      'Writing pauses when too many drafts wait to be published',
    ],
    visual: <LadderMockup />,
    link: { to: '/platform/keyword-ladders', label: 'Explore keyword ladders' },
  },
  {
    id: 'publish',
    icon: Send,
    title: 'Publish and verify',
    short: 'Drafts in your CMS; you choose what goes live; Alaventra checks the live page',
    body: 'Send the page to WordPress, Webflow, Contentful or your own endpoint as a draft, or take the blog package: HTML, Markdown and meta.json. An owner or admin publishes it live. Alaventra notices the new page and checks it live: metadata, schema, images and links.',
    points: [
      'Nothing goes live without an owner or admin choosing it',
      'A page that failed its checks is never sent to your CMS',
      'Planned pages are found in your sitemap by slug and title',
      'The live check confirms what search engines will see',
      'New and updated pages go to Bing and IndexNow that week',
    ],
    visual: <PublishCheckMockup />,
    link: { to: '/platform/content', label: 'Explore the content engine' },
  },
  {
    id: 'track',
    icon: ChartLine,
    title: 'Track, grow and learn',
    short: 'Rankings, traffic, AI answers and links, every week',
    body: 'Rankings, Search Console, GA4, AI answers and backlinks are checked every week on your website\'s own weekday. The questions you lose in AI answers become suggested pages, link openings become pitches you approve, the weekly report shows what changed, and what worked shapes next week\'s plan.',
    points: [
      'Striking-distance keywords suggested, each with its credits',
      'Alerts only on real changes: AI answers are tested, links checked twice',
      'Link pitches drafted every week, sent from your own mailbox once you approve them',
      'Prioritised recommendations, each ready to run',
    ],
    visual: <ReportMockup />,
    link: { to: '/platform/site-tracking', label: 'Explore site tracking' },
  },
];

const LEVELS = [
  {
    n: 1,
    title: 'Only my keywords',
    body: 'We write pages for the keywords you chose. Everything else is a suggestion with its credits, and waits for your OK.',
  },
  {
    n: 2,
    title: 'My keywords and keep my pages healthy',
    body: 'Also refreshes the pages you already have, on your topics, when they lose visitors or sit close to page one. New topics wait for your OK.',
    tag: 'Default',
  },
  {
    n: 3,
    title: 'Full autopilot',
    body: 'Also new topics and new keywords. Each new keyword is announced two days before it starts, and you can change it or skip it.',
  },
];

const LEVEL_POINTS = [
  {
    icon: CalendarCheck,
    title: '"Coming up", two days ahead',
    body: 'Before every weekly cycle: each page that will be written, why and its credits. Skip anything automatic, approve or skip anything waiting for your OK. In the app and by e-mail.',
  },
  {
    icon: ThumbsDown,
    title: '"Not what I wanted"',
    body: 'On every written page. If two of the last five pages the autopilot chose on its own are turned down, it drops back to Only my keywords and tells you why.',
  },
];

const MODE_POINTS = [
  { icon: SlidersHorizontal, title: 'Per website and per ladder', body: 'Set a default mode for the website, then switch any keyword ladder to Auto or Manual.' },
  { icon: Inbox, title: 'One queue for decisions', body: '"Needs you" collects everything waiting on a person: briefs, pages and choices.' },
  { icon: Send, title: 'Publishing stays with you', body: 'Auto prepares the work; your team publishes. Alaventra then checks the live page.' },
  { icon: Pause, title: 'Pause at any time', body: 'Pause a ladder, change the weekly pace or switch the daily AI Pulse off for a website.' },
];

const COST_POINTS = [
  { icon: Calculator, title: 'The price before every analysis', body: 'Every form shows the analysis\'s price in credits and its time before you start it, and it is never charged more.' },
  { icon: Wallet, title: 'Limits checked first', body: 'Credits and limits are checked before any work begins, and owners set each company\'s monthly limits.' },
  { icon: RefreshCcw, title: 'Nothing charged twice', body: 'Results that cannot have changed are reused. Audits are skipped when the sitemap has not changed.' },
  { icon: Coins, title: 'Free where it can be', body: 'A free-sources mode for backlinks uses no credits, and the daily AI Pulse is optional per website.' },
];

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-page">
      <span
        aria-hidden
        className="mk-watermark pointer-events-none absolute -right-48 top-[34rem] -z-10 aspect-[911/797] w-[420px] bg-ink/[0.035] sm:-right-32 sm:top-6 sm:w-[560px] lg:-right-40 lg:-top-6 lg:w-[720px]"
      />
      <Container className="pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-16">
          <div>
            <div className="animate-fade-up">
              <Eyebrow>How it works</Eyebrow>
            </div>
            <h1
              className="mt-5 animate-fade-up font-display text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.02em] text-balance text-ink sm:text-6xl lg:text-[4.25rem]"
              style={{ animationDelay: '70ms' }}
            >
              From a connected site to a weekly loop.
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-pretty text-lg leading-relaxed text-ink-2 sm:text-xl" style={{ animationDelay: '140ms' }}>
              Connect a website and choose the keywords you want to be found for. Alaventra researches, plans, writes, checks and tracks every week from the day you sign up, writes only for your keywords and asks your team only for the decisions that need a person.
            </p>
            <div className="mt-9 flex animate-fade-up flex-wrap gap-3" style={{ animationDelay: '210ms' }}>
              <ButtonLink to="/signup" size="lg" className="group">
                Start free
                <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/platform" size="lg" variant="secondary">
                Explore the platform
              </ButtonLink>
            </div>
            <div className="mt-8 animate-fade-up" style={{ animationDelay: '280ms' }}>
              <LearnLink />
            </div>
          </div>
          <nav aria-label="Stages on this page" className="animate-fade-up rounded-2xl border border-line bg-surface p-2 shadow-overlay" style={{ animationDelay: '200ms' }}>
            <ol>
              {STAGES.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      jumpTo(s.id);
                    }}
                    className="group flex items-center gap-3.5 rounded-xl p-3 transition-colors duration-150 ease-brand hover:bg-surface-2"
                  >
                    <IconTile icon={s.icon} className="group-hover:bg-accent group-hover:text-accent-ink" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] text-accent-text tabular">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-[14.5px] font-medium text-ink">{s.title}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">{s.short}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 -translate-x-1 text-accent-text opacity-0 transition-[opacity,transform] duration-150 ease-brand group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  </a>
                </li>
              ))}
            </ol>
            <a
              href="#week"
              onClick={(e) => {
                e.preventDefault();
                jumpTo('week');
              }}
              className="group mt-1 flex items-center gap-3 rounded-xl bg-ink-surface px-4 py-3.5 text-[13.5px] text-on-ink transition-opacity duration-150 ease-brand hover:opacity-95"
            >
              <CalendarClock className="size-4 shrink-0 text-accent-on-ink" aria-hidden />
              <span className="min-w-0 flex-1">Then it repeats: daily, on your weekday and every month</span>
              <ArrowRight className="size-4 shrink-0 text-accent-on-ink transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
            </a>
          </nav>
        </div>
      </Container>
    </section>
  );
}

/** One stage of the journey: a node on the rail (fills in when reached), the text and the stage's product screen. */
function StageRow({ stage: s, index, last }: { stage: Stage; index: number; last: boolean }) {
  const [ref, on] = useOn<HTMLLIElement>(0.25);
  return (
    <li
      ref={ref}
      id={s.id}
      tabIndex={-1}
      className={cn('relative grid scroll-mt-28 grid-cols-[40px_minmax(0,1fr)] gap-x-5 outline-none focus-visible:shadow-none sm:gap-x-8 lg:grid-cols-[48px_minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-x-12', on && 'is-on')}
      style={{ ['--pf-i' as string]: 0 }}
    >
      {/* the rail: this stage's node and the segment down to the next one (row height + the list gap) */}
      <div className="relative row-span-2 lg:row-span-1">
        {!last && (
          <>
            <span aria-hidden className="absolute left-1/2 top-5 h-[calc(100%+5rem)] w-px -translate-x-1/2 bg-line-strong sm:h-[calc(100%+7rem)]" />
            <span aria-hidden className="pf-seg-y absolute left-1/2 top-5 h-[calc(100%+5rem)] w-px -translate-x-1/2 bg-accent sm:h-[calc(100%+7rem)]" />
          </>
        )}
        <span
          className={cn(
            'pf-node relative z-10 mx-auto flex size-10 items-center justify-center rounded-full border font-mono text-[13px] font-medium tabular transition-colors duration-500 ease-brand lg:size-12',
            on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface text-ink-3',
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="min-w-0 pt-1 lg:pt-2">
        <Reveal className="flex items-center gap-2.5">
          <s.icon className="size-4 text-accent-text" aria-hidden />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text">Stage {index + 1}</span>
        </Reveal>
        <Reveal index={1}>
          <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.01em] text-ink sm:text-[1.75rem]">{s.title}</h3>
          <p className="mt-4 text-pretty text-base leading-relaxed text-ink-2 sm:text-[17px]">{s.body}</p>
        </Reveal>
        <CheckList className="mt-6" items={s.points} />
        <Reveal className="mt-7">
          <ArrowLink to={s.link.to}>{s.link.label}</ArrowLink>
        </Reveal>
      </div>
      <Reveal index={2} className="col-start-2 mt-10 min-w-0 lg:col-start-3 lg:mt-0">
        {s.visual}
      </Reveal>
    </li>
  );
}

function Journey() {
  return (
    <Section tone="surface" bordered>
      <SectionHeading
        eyebrow="Step by step"
        title="Five stages. Then a weekly rhythm."
        lead="Your week starts the day you sign up: the first checks run as soon as setup is finished. Every 7 days after that, on the same weekday, the same loop runs on its own, and each pass starts from what the last one learned."
      />
      <ol className="mt-16 space-y-20 sm:mt-20 sm:space-y-28">
        {STAGES.map((s, i) => (
          <StageRow key={s.id} stage={s} index={i} last={i === STAGES.length - 1} />
        ))}
      </ol>
    </Section>
  );
}

function Week() {
  return (
    <div id="week" tabIndex={-1} className="scroll-mt-16 outline-none focus-visible:shadow-none lg:scroll-mt-[72px]">
      <Section tone="ink" spacing="lg">
        <SectionHeading
          eyebrow="A week with Alaventra"
          title="Your week starts the day you sign up."
          lead="A daily check of your key pages and of AI answers, one day a week of checks, writing and outreach on your website's own weekday, the plan two days before it, and a monthly audit. Work that would only repeat an unchanged result is skipped, and a run that was missed still happens, marked as late."
        />
        <WeekSchedule className="mt-14 sm:mt-16" />
      </Section>
    </div>
  );
}

function Levels() {
  return (
    <Section tone="surface" bordered spacing="lg">
      <SectionHeading
        eyebrow="Keyword-first"
        title="We write only for keywords you choose."
        lead='During setup we ask "How much should we do on our own?" Pick a level now and change it any time in the website settings. Until you choose a keyword, the checks run and nothing is written.'
      />
      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {LEVELS.map((l, i) => (
          <Reveal as="li" key={l.n} index={i} className={cn('flex flex-col rounded-xl border bg-page p-5 sm:p-6', l.tag ? 'border-accent' : 'border-line')}>
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent-soft font-mono text-[13px] font-medium text-accent-text tabular">{l.n}</span>
              {l.tag && <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11.5px] font-medium text-accent-ink">{l.tag}</span>}
            </span>
            <span className="mt-4 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{l.title}</span>
            <span className="mt-2 text-[14px] leading-relaxed text-ink-2">{l.body}</span>
          </Reveal>
        ))}
      </ol>
      <div className="mt-12">
        <PointList items={LEVEL_POINTS} />
      </div>
    </Section>
  );
}

function PointList({ items }: { items: { icon: LucideIcon; title: string; body: string }[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
      {items.map((p, i) => (
        <Reveal as="li" key={p.title} index={i} className="group flex gap-4">
          <IconTile icon={p.icon} className="group-hover:bg-accent group-hover:text-accent-ink" />
          <span>
            <span className="block font-display text-[15px] font-semibold text-ink">{p.title}</span>
            <span className="mt-1.5 block text-[14px] leading-relaxed text-ink-2">{p.body}</span>
          </span>
        </Reveal>
      ))}
    </ul>
  );
}

function Modes() {
  return (
    <Section tone="page" spacing="lg">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-20">
        <div>
          <SectionHeading
            eyebrow="Auto or Manual"
            title="You approve, or it runs."
            lead='Choose for each website and each keyword ladder. Auto does the step on schedule. Manual stops it in "Needs you" until someone on your team approves.'
          />
          <div className="mt-12">
            <PointList items={MODE_POINTS} />
          </div>
        </div>
        <Reveal index={1}>
          <AutoManualLanes />
        </Reveal>
      </div>
    </Section>
  );
}

function Cost() {
  return (
    <Section tone="surface" bordered spacing="lg">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:gap-20">
        <Reveal className="order-last lg:order-first">
          <CostMockup />
        </Reveal>
        <div>
          <SectionHeading
            eyebrow="Credits"
            title="You see the price before anything runs."
            lead="Every analysis is priced in credits first, checked against your company's credits and limits, never charged more than that price and never charged twice when its result cannot have changed."
          />
          <div className="mt-12">
            <PointList items={COST_POINTS} />
          </div>
        </div>
      </div>
    </Section>
  );
}

export default function HowItWorksPage() {
  useSeo({
    title: 'How it works',
    description:
      'How Alaventra runs your SEO, AEO and GEO: connect your site, choose the keywords you want, climb with ladders and the content engine, publish and verify, then track and learn every week from the day you sign up, with three autopilot levels and the plan shown two days ahead.',
    path: '/how-it-works',
  });
  return (
    <>
      <Hero />
      <Journey />
      <Week />
      <Levels />
      <Modes />
      <Cost />
      <CtaBand title="Start the loop on your own site." />
    </>
  );
}
