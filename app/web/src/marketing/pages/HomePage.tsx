import { Link } from 'react-router';
import { ArrowRight, BadgeCheck, Bot, Check, Fingerprint, Globe, Link2, Lock, MessageSquare, Minus, ScrollText, Search, ShieldCheck, Sparkles, Users, Wallet, type LucideIcon } from 'lucide-react';
import { AlaventraMark } from '@/components/brand/AlaventraMark';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AiVisibilityMockup,
  BrowserFrame,
  Container,
  CtaBand,
  DashboardMockup,
  FactGrid,
  Faq,
  FeatureCard,
  GrowthLoopDiagram,
  IconTile,
  LadderMockup,
  LinkSourcesDiagram,
  LOOP_STEPS,
  Photo,
  Reveal,
  Section,
  SectionHeading,
} from '../components';
import { CapabilityCount, featureBySlug, features, type FaqItem, type Fact } from '../content/features';
import { pricingTiers } from '../content/pricing';
import { integrations } from '../content/site';
import { solutions } from '../content/solutions';
import { useSeo } from '../useSeo';

// next to the main CTA: what removes the risk of trying it (facts from pricing.ts and the product)
const HERO_FACTS = ['Free to set up', 'First site check on day one', 'Cost shown before every run', 'Nothing goes live without your OK'];

// "Why Alaventra": the same SEO jobs done by hand and with Alaventra, in plain words (real capabilities only)
const COMPARE: { job: string; byHand: string; withUs: string }[] = [
  {
    job: 'Knowing what to write',
    byHand: 'Guessing which words people type into Google.',
    withUs: 'The searches your buyers really make, and a clear yes or no on which ones you can win.',
  },
  {
    job: 'Writing the pages',
    byHand: 'A blog post now and then, when someone finds the time.',
    withUs: 'Pages written every week, checked for facts and quality, ready for you to publish.',
  },
  {
    job: 'Keeping the site healthy',
    byHand: 'Problems stay hidden until the traffic drops.',
    withUs: 'The whole site checked every month, with the fixes spelled out and ready to hand over.',
  },
  {
    job: 'Showing up in AI answers',
    byHand: 'No idea whether ChatGPT recommends you or a competitor.',
    withUs: 'The questions your buyers ask AI, checked every day — and pages written to win them.',
  },
  {
    job: 'Knowing it works',
    byHand: 'Reports nobody reads, numbers nobody trusts.',
    withUs: 'One Monday report: what moved, why, and what to do next.',
  },
];

// "Every place people look for you": what Alaventra does on each surface (AI engines and links are on the Growth plan)
const SURFACES: { icon: LucideIcon; name: string; what: string }[] = [
  { icon: Search, name: 'Google search', what: 'Pages written for what your buyers search, with positions checked every week' },
  { icon: Sparkles, name: 'Google AI Overviews and AI Mode', what: 'Checked for your name and your links' },
  { icon: MessageSquare, name: 'ChatGPT', what: 'Asked your buyers’ questions every day' },
  { icon: Bot, name: 'Gemini, Perplexity and Claude', what: 'Asked the same questions, next to your competitors' },
  { icon: Globe, name: 'Bing and Copilot', what: 'New and updated pages sent to Bing every week, and through IndexNow once your key file is up' },
  { icon: Link2, name: 'Other websites', what: 'Every link to you checked, and the sites that should link to you found' },
];

const PLATFORM_FACTS: Fact[] = [
  { value: 50, label: 'buyer questions in one AI panel' },
  { value: 6, label: 'AI engines and answer surfaces' },
  { value: 9, label: 'link sources in one ledger' },
  { value: 1000, label: 'pages per crawl, JavaScript included' },
];

// what happens when, from sign-up on — work Alaventra does, never a promised Google position
const TIMELINE = [
  {
    when: 'Day 1',
    title: 'Set up and first check',
    body: 'Connect your website in minutes. Get a full check of the site, the searches worth winning and your first page written.',
  },
  {
    when: 'Week 1',
    title: 'SEO on a schedule',
    body: 'New pages every week, your Google positions checked and your AI answers watched — all without anyone chasing it.',
  },
  {
    when: 'Month 1',
    title: 'Proof it is working',
    body: 'Every Monday a report shows what moved, what got clicks and what to do next, in plain words.',
  },
  {
    when: 'Month 3 and on',
    title: 'Growth that builds on itself',
    body: 'Each page supports the next, so you climb from easier searches to the big ones your competitors own today.',
  },
];

const ENTERPRISE = [
  { icon: Users, title: 'Roles and invitations', body: 'Owner, admin, member and viewer, per company. Invite with a link; sign in with Google or e-mail.' },
  { icon: BadgeCheck, title: 'Verified ownership', body: 'Data appears only after you prove a website is yours: Search Console, a DNS TXT record or a meta tag.' },
  { icon: Wallet, title: 'Budget caps', body: 'Every run shows its cost before it starts; budgets are checked first and owners set spend caps.' },
  { icon: Lock, title: 'Data isolation', body: 'Each company’s websites, runs and reports are kept apart, and access follows your role.' },
  { icon: Fingerprint, title: 'Single sign-on and SCIM', body: 'Okta, Microsoft Entra ID, Google Workspace or any SAML 2.0 / OIDC provider — required if you like — and accounts provisioned from it.' },
  { icon: ScrollText, title: 'Two-step and an audit log', body: 'Authenticator apps, passkeys or security keys, required company-wide if you choose, and a log of who did what that nobody can edit.' },
];

const FAQS: FaqItem[] = [
  {
    q: 'What does SEO actually do for my business?',
    a: 'SEO gets your website shown when people search Google — or ask ChatGPT — for what you sell. Those visitors are already looking for something like yours, and you do not pay for every click the way you do with ads. Alaventra does the work that gets you there: finding the right searches, writing the pages, fixing the site and tracking the results.',
  },
  {
    q: 'How fast will I see results?',
    a: 'You can connect a website, check it and have your first page written on day one, and the weekly schedule starts that same week. Moving up on Google takes longer — usually weeks to a few months, depending on how hard the search is. Nobody can honestly promise a position on Google, and we don’t. What we do promise is that the work starts on day one and every Monday you see what moved.',
  },
  {
    q: 'Do we need an SEO specialist to use Alaventra?',
    a: 'No. Every verdict, audit finding and recommendation explains itself in plain language, and the pipeline tells you what to do next. Specialists get the detail they need to go further.',
  },
  {
    q: 'What is the difference between Auto and Manual?',
    a: 'On Auto, Alaventra does the step on schedule. On Manual, the step waits in “Needs you” until someone on your team approves it. You choose per ladder and per website.',
  },
  {
    q: 'Does Alaventra publish to our website?',
    a: 'Only when you say so. Written pages go to your WordPress, Webflow or Contentful as drafts; an owner or admin publishes one live with a confirmation. Alaventra then checks the live page and tracks it.',
  },
  { q: 'Which AI engines do you check?', a: 'ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews — plus Microsoft Copilot and the ChatGPT and Gemini APIs if you want them — with a panel of up to 500 buyer questions by topic, buyer role and market.' },
  {
    q: 'How do you keep costs under control?',
    a: 'Every run shows its estimated cost before it starts, budgets are checked before any work begins and owners set spend caps. Results that cannot have changed are reused instead of paid for again.',
  },
  { q: 'Is our data kept separate?', a: 'Yes. Every company’s websites, runs and reports are isolated, and website data appears only after ownership is verified.' },
];

/** Section-level text link with an arrow that nudges on hover. */
function ArrowLink({ to, children, onInk, className }: { to: string; children: React.ReactNode; onInk?: boolean; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'mk-tap group inline-flex items-center gap-1.5 text-[15px] font-medium transition-colors duration-150 ease-brand',
        onInk ? 'text-accent-on-ink hover:text-on-ink' : 'text-accent-text hover:text-accent-hover',
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}

function CheckList({ items, onInk }: { items: string[]; onInk?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((t, i) => (
        <Reveal as="li" key={t} index={i} className={cn('flex gap-3 text-[15px] leading-relaxed', onInk ? 'text-on-ink-2' : 'text-ink-2')}>
          <span className={cn('mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full', onInk ? 'bg-on-ink/10 text-accent-on-ink' : 'bg-accent-soft text-accent-text')}>
            <Check className="size-3" strokeWidth={2.5} aria-hidden />
          </span>
          <span>{t}</span>
        </Reveal>
      ))}
    </ul>
  );
}

/** A small product card floating over the hero's dashboard edge (wide screens only; sample data, decorative). */
function FloatCard({ className, delay, children }: { className?: string; delay: number; children: React.ReactNode }) {
  return (
    <div aria-hidden className={cn('absolute z-10 hidden w-64 rounded-xl border border-line bg-surface p-4 shadow-overlay animate-fade-up xl:block', className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-page">
      {/* hairline grid behind the headline, fading out from the top centre (a mask, not a colour gradient) */}
      <div aria-hidden className="mk-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px]" />
      {/* the brand mark, large and faint behind the headline (ink on light, light on dark), a slow wave running from its sun to its wing tip */}
      <AlaventraMark
        wave="ambient"
        className="pointer-events-none absolute -right-40 top-64 -z-10 w-[420px] text-ink opacity-[0.15] sm:-right-24 sm:top-10 sm:w-[560px] lg:-right-10 lg:top-6 lg:w-[720px]"
      />
      <Container className="pt-12 sm:pt-16 lg:pt-20">
        <div className="mx-auto max-w-5xl text-center">
          <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
            <Link
              to="/platform/ai-visibility"
              className="mk-tap group inline-flex max-w-full items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5 text-[13px] text-ink-2 shadow-card transition-[border-color,color] duration-200 ease-brand hover:border-accent hover:text-ink"
            >
              <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accent-text">New</span>
              <span className="truncate">AI Pulse: daily AI-answer checks that alert only on real changes</span>
              <ArrowRight className="size-3.5 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
            </Link>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '70ms' }}>
            <h1 className="mx-auto mt-8 max-w-5xl font-display text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-balance text-ink sm:text-[3.25rem] lg:text-[3.75rem]">
              You built the product. <span className="text-accent-text sm:block">Now get the traffic.</span>
            </h1>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '140ms' }}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-2 sm:text-xl">
              Alaventra is SEO that runs itself. It finds what your buyers search on Google and ask ChatGPT, writes the pages that answer them, fixes what holds your site back — and shows you every week that more people are finding you.
            </p>
          </div>
          <div className="mt-9 flex flex-wrap justify-center gap-3 animate-fade-up" style={{ animationDelay: '210ms' }}>
            <ButtonLink to="/signup" size="lg" className="group">
              Start free
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
            <ButtonLink to="/contact?topic=sales" size="lg" variant="secondary">
              Book a demo
            </ButtonLink>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '280ms' }}>
            <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-ink-3">
              {HERO_FACTS.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-3.5 text-accent-text" strokeWidth={2.5} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>

      {/* the product on stage: its lower half rests on an ink floor that carries on into the trust strip */}
      <div className="relative z-10 mt-14 sm:mt-16">
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[55%] -z-10 bg-ink-surface" />
        <Container>
          <div className="relative mx-auto max-w-6xl animate-fade-up" style={{ animationDelay: '420ms' }}>
            <FloatCard className="-bottom-12 -left-4 min-[1400px]:-left-14" delay={900}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                  <span className="mk-pulse size-1.5 rounded-full bg-accent" />
                  AI Pulse · today
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">ChatGPT</span>
              </div>
              <p className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">
                7 <span className="text-[14px] font-medium text-ink-3">of 20 answers</span>
              </p>
              <p className="mt-0.5 text-[12px] text-ink-2">name you, up 2 since last week</p>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: 20 }, (_, i) => (
                  <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < 7 ? 'bg-accent' : 'bg-surface-3')} />
                ))}
              </div>
            </FloatCard>
            <FloatCard className="-bottom-20 -right-4 min-[1400px]:-right-14" delay={1050}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-ink">Ladder rung</span>
                <span className="inline-flex h-5 items-center gap-1 rounded-full bg-good-soft px-2 text-[10.5px] font-medium text-good-text">
                  <Check className="size-3" strokeWidth={2.5} />
                  Page one
                </span>
              </div>
              <p className="mt-2 truncate text-[13px] text-ink-2">invoice approval workflow</p>
              <p className="mt-2 flex items-baseline gap-2 font-mono tabular">
                <span className="text-[13px] text-ink-3 line-through decoration-ink-3/50">#14</span>
                <ArrowRight className="size-3.5 self-center text-ink-3" />
                <span className="text-[22px] font-medium tracking-[-0.02em] text-ink">#6</span>
              </p>
            </FloatCard>
            <div className="rounded-[20px] border border-line bg-surface p-1.5 shadow-overlay sm:p-2">
              <BrowserFrame url="app.alaventra.com/overview" label="Product preview" className="[&>div]:shadow-none">
                <DashboardMockup />
              </BrowserFrame>
            </div>
            <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-on-ink-2">Product preview · sample data</p>
          </div>
        </Container>
      </div>

      <TrustStrip />
    </section>
  );
}

/** Under the hero, on ink: the engines and tools Alaventra works with, typeset as a quiet wordmark row (names only, no third-party logos). */
function TrustStrip() {
  return (
    <div className="relative overflow-hidden bg-ink-surface pb-16 pt-12 sm:pb-20 sm:pt-14 xl:pt-24">
      {/* the supplied white mark, faint, as the strip's signature */}
      <span aria-hidden className="mk-watermark pointer-events-none absolute -bottom-24 -right-24 aspect-[911/797] w-[360px] bg-on-ink/[0.05] sm:w-[460px]" />
      <Container className="relative">
        <div className="border-t border-line-on-ink pt-10 sm:pt-12">
          <p className="text-center font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-on-ink-2">Built on the data and AI engines your team already relies on</p>
          <ul className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-12">
            {integrations.map((name) => (
              <li key={name} className="font-display text-[15px] font-semibold tracking-[-0.01em] text-on-ink/60 transition-colors duration-200 ease-brand hover:text-on-ink sm:text-[17px]">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </div>
  );
}

function WhyAlaventra() {
  return (
    <Section tone="surface">
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28">
          <SectionHeading
            eyebrow="Why Alaventra"
            title="A great product is half the job. People have to find it."
            lead="Most buyers start with a Google search or a question to ChatGPT. If you are not in those answers, you do not exist for them. Alaventra puts your business there — and keeps it there, week after week."
          >
            <ButtonLink to="/signup" size="lg" className="group">
              Get found — start free
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
          </SectionHeading>
        </div>
        <Reveal index={1} className="overflow-hidden rounded-2xl border border-line bg-page shadow-raised">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4 sm:px-6">
            <p className="font-display text-[15px] font-semibold text-ink">Every place people look for you</p>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accent-text">Covered</span>
          </div>
          <ul className="divide-y divide-line">
            {SURFACES.map(({ icon: Icon, name, what }, i) => (
              <Reveal as="li" key={name} index={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent-text">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-ink">{name}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{what}</span>
                </span>
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink" aria-hidden>
                  <Check className="size-3.5" strokeWidth={2.75} />
                </span>
              </Reveal>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* the same five jobs, by hand and with Alaventra */}
      <Reveal className="mt-20 sm:mt-24">
        <h3 className="max-w-2xl font-display text-2xl font-semibold tracking-[-0.01em] text-balance text-ink sm:text-[1.75rem]">SEO is five jobs, every week. Here is who does them.</h3>
      </Reveal>
      <div className="mt-8 overflow-hidden rounded-2xl border border-line" role="table" aria-label="SEO by hand compared with Alaventra">
        <div role="row" className="hidden grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.15fr)] border-b border-line bg-page md:grid">
          <span role="columnheader" className="px-6 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">The job</span>
          <span role="columnheader" className="px-6 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Doing it by hand</span>
          <span role="columnheader" className="bg-accent-soft px-6 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text">With Alaventra</span>
        </div>
        {COMPARE.map((c, i) => (
          <Reveal
            key={c.job}
            index={i}
            role="row"
            className="grid grid-cols-1 border-b border-line last:border-b-0 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.15fr)]"
          >
            <span role="rowheader" className="px-5 pb-1 pt-5 font-display text-[15px] font-semibold text-ink sm:px-6 md:py-5">
              {c.job}
            </span>
            <span role="cell" className="flex gap-3 px-5 py-2 text-[14px] leading-relaxed text-ink-3 sm:px-6 md:py-5">
              <Minus className="mt-1 size-3.5 shrink-0" aria-hidden />
              <span>
                <span className="sr-only">By hand: </span>
                {c.byHand}
              </span>
            </span>
            <span role="cell" className="flex gap-3 bg-accent-soft/60 px-5 pb-5 pt-2 text-[14px] font-medium leading-relaxed text-ink sm:px-6 md:py-5">
              <Check className="mt-1 size-3.5 shrink-0 text-accent-text" strokeWidth={2.75} aria-hidden />
              <span>
                <span className="sr-only">With Alaventra: </span>
                {c.withUs}
              </span>
            </span>
          </Reveal>
        ))}
      </div>
      <FactGrid facts={PLATFORM_FACTS} className="mt-16 sm:mt-20" />
    </Section>
  );
}

function Timeline() {
  return (
    <Section tone="page">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="From sign-up to found"
          title="Started on day one. Better every week."
          lead="No months of onboarding and no agency kick-off calls. Here is what happens after you sign up."
        />
        <Reveal>
          <ArrowLink to="/how-it-works">See how it works in detail</ArrowLink>
        </Reveal>
      </div>
      <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {/* the line the four milestones sit on (wide screens) */}
        <span aria-hidden className="absolute inset-x-0 top-[7px] hidden h-px bg-line lg:block" />
        {TIMELINE.map((t, i) => (
          <Reveal as="li" key={t.when} index={i} className="relative">
            <span aria-hidden className={cn('relative block size-[15px] rounded-full border-[3px] border-page', i === 0 ? 'mk-pulse bg-accent' : 'bg-accent/70')} />
            <p className="mt-5 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-accent-text">{t.when}</p>
            <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.01em] text-ink">{t.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t.body}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal className="mt-14 flex flex-col items-start gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          <p className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">The sooner you start, the sooner it compounds.</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
            Setting up is free and takes minutes. Google decides when a page moves up — usually weeks to a few months — so every week you wait is a week your competitors keep.
          </p>
        </div>
        <ButtonLink to="/signup" size="lg" className="group w-full shrink-0 sm:w-auto">
          Start free
          <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
        </ButtonLink>
      </Reveal>
    </Section>
  );
}

/** indices of the cards that span two of three columns so that every row is full: each starts a row, the first is card 0 */
function bentoWide(n: number): Set<number> {
  const wide = new Set<number>();
  let left = (3 - (n % 3)) % 3 || 3;
  const gap = Math.floor(n / left);
  let col = 0;
  let last = -n;
  for (let i = 0; i < n; i++) {
    let w = 1;
    if (left > 0 && col === 0 && (i - last >= gap || n - i <= 3 * left)) {
      w = 2;
      left--;
      last = i;
      wide.add(i);
    }
    col = (col + w) % 3;
  }
  return wide;
}

function CapabilityGrid() {
  // bento: some cards span two columns on wide screens — as many as it takes (one to three) for every row of three to be full,
  // each starting a row and spread out, so the grid stays even whatever the number of capabilities
  const wide = bentoWide(features.length);
  return (
    <Section tone="page" id="platform" bordered>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow={`Platform · ${CapabilityCount} capabilities`} title="Everything SEO takes. One place." lead="Each part works on its own. Together they run your SEO every week — from finding what people search for to the Monday report." />
        <Reveal>
          <ArrowLink to="/platform">Explore the platform</ArrowLink>
        </Reveal>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.slug} index={i % 3} className={cn(wide.has(i) && 'lg:col-span-2')}>
            <FeatureCard to={`/platform/${f.slug}`} icon={f.icon} title={f.name} description={f.tagline} bullets={wide.has(i) ? f.benefits.slice(0, 3) : undefined} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function LoopBand() {
  return (
    <Section tone="surface" bordered>
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:gap-20">
        <div>
          <SectionHeading eyebrow="The growth loop" title="Research to results, every week." lead="Alaventra runs the same six steps for every website, every week. Each loop starts from what the last one learned." />
          <ol className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {LOOP_STEPS.map((s, i) => (
              <Reveal as="li" key={s.label} index={i} className="flex gap-4">
                <span className="font-mono text-[13px] font-medium text-accent-text tabular">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="block font-display text-[15px] font-semibold text-ink">{s.label}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{s.body}</span>
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
        <Reveal index={2}>
          <GrowthLoopDiagram />
        </Reveal>
      </div>
    </Section>
  );
}

function AiSpotlight() {
  const f = featureBySlug('ai-visibility')!;
  return (
    <Section tone="ink" spacing="lg">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="AI search visibility"
            title="Find out if ChatGPT recommends you — and fix it when it doesn’t."
            lead="More and more buyers ask an AI assistant for a shortlist before they ever search. Alaventra asks the same questions every day and shows where you are named, linked or missing."
          />
          <div className="mt-9">
            <CheckList onInk items={[f.benefits[1], f.benefits[2], f.benefits[3], f.benefits[4]]} />
          </div>
          <Reveal className="mt-10">
            <ArrowLink to="/platform/ai-visibility" onInk>
              Explore AI visibility
            </ArrowLink>
          </Reveal>
        </div>
        <Reveal index={1}>
          <AiVisibilityMockup />
        </Reveal>
      </div>
      <FactGrid facts={f.facts} className="mt-20" />
    </Section>
  );
}

function LadderSpotlight() {
  return (
    <Section tone="page" spacing="lg">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        <Reveal className="order-last lg:order-first">
          <LadderMockup />
        </Reveal>
        <div>
          <SectionHeading
            eyebrow="Keyword ladders"
            title="Win the big searches by starting with the easier ones."
            lead="A brand-new page rarely beats the leaders for a big search on its own. Alaventra plans smaller pages you can win first, writes them in order and links each one up to the big one."
          />
          <div className="mt-9">
            <CheckList
              items={[
                'Difficulty for your site, with a Direct, Short or Full plan',
                'Weekly rank checks for every rung and the head term, on desktop and on a phone',
                'Every check records the results page too: AI Overview, snippet, who ranks above you and your share of voice',
                'No keyword overlap between ladders, and a guard against drafts piling up',
              ]}
            />
          </div>
          <Reveal className="mt-10">
            <ArrowLink to="/platform/keyword-ladders">Explore keyword ladders</ArrowLink>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

function BacklinksSpotlight() {
  return (
    <Section tone="surface" bordered spacing="lg">
      <SectionHeading
        align="center"
        eyebrow="Backlinks from every source"
        title="See every site that links to you — and the ones that should."
        lead="Links from other websites are one of the strongest signals Google uses. Alaventra gathers them from nine sources, visits each linking page itself and finds the sites that should link to you next."
      />
      <Reveal className="mt-14 sm:mt-16">
        <LinkSourcesDiagram />
      </Reveal>
      <div className="mt-14 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
        {[
          { t: 'Checked, not assumed', b: 'Rel, placement, noindex and canonical read from the live page.' },
          { t: 'Valued three ways', b: 'SEO, referral and brand value for every referring site.' },
          { t: 'Pitches you approve', b: 'Scored prospects with a contact on their own site and a checked pitch with two follow-ups — sent from your own mailbox once you approve it.' },
        ].map((x, i) => (
          <Reveal key={x.t} index={i}>
            <p className="font-display text-[15px] font-semibold text-ink">{x.t}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{x.b}</p>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-10 text-center">
        <ArrowLink to="/platform/backlinks">Explore backlinks</ArrowLink>
      </Reveal>
    </Section>
  );
}

function EnterpriseBand() {
  return (
    <Section tone="surface" bordered>
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
        <div>
          <SectionHeading
            eyebrow="Enterprise-ready"
            title="Built for companies with more than one website."
            lead="Workspaces per company, roles for every person, single sign-on, verified ownership before any data is shown and a budget check before any paid work."
          >
            <ButtonLink to="/security" variant="secondary" icon={<ShieldCheck className="size-4" aria-hidden />} className="max-sm:h-10">
              Security at Alaventra
            </ButtonLink>
            <ArrowLink to="/contact?topic=sales" className="h-9">
              Talk to sales
            </ArrowLink>
          </SectionHeading>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {ENTERPRISE.map((e, i) => (
            <Reveal as="li" key={e.title} index={i} className="group bg-surface p-6 transition-colors duration-200 ease-brand hover:bg-page sm:p-7">
              <IconTile icon={e.icon} className="group-hover:bg-accent group-hover:text-accent-ink" />
              <h3 className="mt-5 font-display text-base font-semibold text-ink">{e.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{e.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function WhoItsFor() {
  return (
    <Section tone="page" spacing="lg">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading eyebrow="Who it’s for" title="For the teams that own organic growth." lead="Agencies running many clients, marketing teams without a full SEO function, B2B companies, businesses with many locations and enterprise teams with their own sign-in and data stack." />
          <ul className="mt-10 divide-y divide-line border-y border-line">
            {solutions.map((s, i) => (
              <Reveal as="li" key={s.slug} index={i}>
                <Link to={`/solutions/${s.slug}`} className="group flex items-center gap-4 py-4 transition-colors duration-150 ease-brand">
                  <IconTile icon={s.icon} size="sm" className="group-hover:bg-accent group-hover:text-accent-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink group-hover:text-accent-text">{s.shortName}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{s.tagline}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-hover:translate-x-1 group-hover:text-accent-text" aria-hidden />
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Reveal className="row-span-2">
            <Photo image="teamPlanning" ratio="auto" className="h-full" sizes="(min-width: 1024px) 25vw, 50vw" />
          </Reveal>
          <Reveal index={1}>
            <Photo image="colleaguesReview" ratio="4 / 3" sizes="(min-width: 1024px) 25vw, 50vw" />
          </Reveal>
          <Reveal index={2}>
            <Photo image="teamAtDesks" ratio="4 / 3" sizes="(min-width: 1024px) 25vw, 50vw" />
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

function PricingTeaser() {
  return (
    <Section tone="surface" bordered>
      <SectionHeading
        align="center"
        eyebrow="Pricing"
        title="Start small. Grow when it works."
        lead={`Free to set up, with plans from ${pricingTiers[0].price} a month. Every run shows its cost before it starts, and budgets keep spend where you set it.`}
      />
      <div className="mx-auto mt-14 grid max-w-5xl gap-4 lg:grid-cols-3">
        {pricingTiers.map((t, i) => (
          <Reveal
            key={t.id}
            index={i}
            className={cn(
              'flex flex-col rounded-xl border bg-surface p-6 transition-[border-color,box-shadow,transform] duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-raised sm:p-7',
              t.highlighted ? 'border-accent shadow-raised' : 'border-line shadow-card hover:border-line-strong',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-ink">{t.name}</h3>
              {t.highlighted && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent-text">Recommended</span>}
            </div>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-[2rem] font-semibold tracking-[-0.02em] text-ink">{t.price}</span>
              {t.period && <span className="text-[13px] text-ink-3">{t.period}</span>}
            </p>
            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ink-2">{t.description}</p>
            <ButtonLink to={t.cta.to} variant={t.highlighted ? 'primary' : 'secondary'} className="mt-6 w-full max-sm:h-10">
              {t.cta.label}
            </ButtonLink>
          </Reveal>
        ))}
      </div>
      <Reveal className="mx-auto mt-10 max-w-5xl rounded-xl border border-line bg-page px-6 py-5 text-center">
        <p className="text-[15px] font-medium text-ink">Nobody on the team to do this?</p>
        <p className="mx-auto mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-2">
          We can connect the accounts for you, publish the finished pages on your site — any CMS, or a pull request for a React codebase — and fix what the audit finds.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <ArrowLink to="/pricing#done-for-you">See the done-for-you packages</ArrowLink>
          <ArrowLink to="/pricing">Compare plans</ArrowLink>
        </div>
      </Reveal>
    </Section>
  );
}

function FaqSection() {
  return (
    <Section tone="page">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div>
          <SectionHeading eyebrow="FAQ" title="Questions, answered." lead="Something else on your mind? Write to us and a person will answer." />
          <Reveal className="mt-8">
            <ArrowLink to="/contact">Talk to us</ArrowLink>
          </Reveal>
        </div>
        <Reveal index={1}>
          <Faq items={FAQS} schema />
        </Reveal>
      </div>
    </Section>
  );
}

export default function HomePage() {
  useSeo({
    title: 'Get found on Google and ChatGPT — SEO that runs itself',
    description: 'You built the product; Alaventra brings the traffic. It finds what your buyers search for, writes the pages, fixes your site and tracks Google and AI answers every week.',
    path: '/',
  });
  return (
    <>
      <Hero />
      <WhyAlaventra />
      <Timeline />
      <CapabilityGrid />
      <LoopBand />
      <AiSpotlight />
      <LadderSpotlight />
      <BacklinksSpotlight />
      <EnterpriseBand />
      <WhoItsFor />
      <PricingTeaser />
      <FaqSection />
      <CtaBand />
    </>
  );
}
