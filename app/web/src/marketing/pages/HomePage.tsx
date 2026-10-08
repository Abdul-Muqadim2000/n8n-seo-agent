import { Link } from 'react-router';
import { ArrowRight, BadgeCheck, Check, Lock, MoveRight, ShieldCheck, Users, Wallet } from 'lucide-react';
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
  IntegrationMarquee,
  LadderMockup,
  LinkSourcesDiagram,
  LOOP_STEPS,
  Photo,
  Reveal,
  Section,
  SectionHeading,
} from '../components';
import { featureBySlug, features, type FaqItem, type Fact } from '../content/features';
import { pricingTiers } from '../content/pricing';
import { solutions } from '../content/solutions';
import { useSeo } from '../useSeo';

const HERO_FACTS = ['Search Console and GA4', '6 AI engines', '9 link sources', 'Cost shown before every run'];

const PROBLEMS: { today: string; outcome: string }[] = [
  {
    today: 'Keyword lists pile up with no clear call on which ones are worth the effort.',
    outcome: 'Every keyword gets a verdict, its reach for your site and the plan it takes to rank.',
  },
  {
    today: 'Posts are written one at a time and rarely build towards the terms that matter.',
    outcome: 'Keyword ladders climb to your head terms, and a weekly cadence keeps the right pages coming.',
  },
  {
    today: 'Lost links, indexing problems and AI answers change without anyone noticing.',
    outcome: 'Monitors check links, audits and AI answers on a schedule and alert only on real changes.',
  },
];

const PLATFORM_FACTS: Fact[] = [
  { value: 50, label: 'buyer questions in one AI panel' },
  { value: 6, label: 'AI engines and answer surfaces' },
  { value: 9, label: 'link sources in one ledger' },
  { value: 1000, label: 'pages per crawl, JavaScript included' },
];

const START_STEPS = [
  { title: 'Connect your website', body: 'Add the site, prove you own it and connect Search Console and GA4.' },
  { title: 'Describe the business', body: 'Market, competitors, authors and proof, so every page sounds like you.' },
  { title: 'Choose the plan', body: 'Pick keywords or let Ascentra recommend them, then set Auto or Manual and the weekly pace.' },
  { title: 'Review and approve', body: 'Ascentra runs the loop. You approve what needs a person and read the Monday report.' },
];

const ENTERPRISE = [
  { icon: Users, title: 'Roles and invitations', body: 'Owner, admin, member and viewer, per company. Invite with a link; sign in with Google or e-mail.' },
  { icon: BadgeCheck, title: 'Verified ownership', body: 'Data appears only after you prove a website is yours: Search Console, a DNS TXT record or a meta tag.' },
  { icon: Wallet, title: 'Budget caps', body: 'Every run shows its cost before it starts; budgets are checked first and owners set spend caps.' },
  { icon: Lock, title: 'Data isolation', body: 'Each company’s websites, runs and reports are kept apart, and access follows your role.' },
];

const FAQS: FaqItem[] = [
  {
    q: 'Do we need an SEO specialist to use Ascentra?',
    a: 'No. Every verdict, audit finding and recommendation explains itself in plain language, and the pipeline tells you what to do next. Specialists get the detail they need to go further.',
  },
  {
    q: 'What is the difference between Auto and Manual?',
    a: 'On Auto, Ascentra does the step on schedule. On Manual, the step waits in “Needs you” until someone on your team approves it. You choose per ladder and per website.',
  },
  {
    q: 'Does Ascentra publish to our website?',
    a: 'No. It prepares a publish-ready package or a WordPress draft. Your team publishes, and Ascentra then checks the live page and tracks it.',
  },
  { q: 'Which AI engines do you check?', a: 'ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews, with a panel of up to 50 buyer questions.' },
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
        'group inline-flex items-center gap-1.5 text-[15px] font-medium transition-colors duration-150 ease-brand',
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

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-page">
      {/* the brand mark as a faint watermark: the supplied mark, faded (ink on light, white on dark) */}
      <span
        aria-hidden
        className="mk-watermark pointer-events-none absolute -right-56 top-[24rem] -z-10 aspect-[911/797] w-[440px] bg-ink/[0.045] sm:-right-24 sm:-top-10 sm:w-[560px] lg:-right-16 lg:top-0 lg:w-[760px]"
      />
      <Container className="pb-20 pt-12 sm:pb-28 sm:pt-16 lg:pt-20">
        <div className="max-w-4xl">
          <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
            <Link
              to="/platform/ai-visibility"
              className="group inline-flex max-w-full items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5 text-[13px] text-ink-2 shadow-card transition-[border-color,color] duration-200 ease-brand hover:border-accent hover:text-ink"
            >
              <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accent-text">New</span>
              <span className="truncate">AI Pulse: daily AI-answer checks that alert only on real changes</span>
              <ArrowRight className="size-3.5 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
            </Link>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '70ms' }}>
            <h1 className="mt-7 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.02em] text-balance text-ink sm:text-6xl lg:text-[4.5rem]">
              Compounding growth in search and AI answers, on autopilot.
            </h1>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '140ms' }}>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-2 sm:text-xl">
              Ascentra researches your keywords, writes the pages, audits the site and tracks rankings, AI answers and backlinks — every week, with your team approving what matters.
            </p>
          </div>
          <div className="mt-9 flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: '210ms' }}>
            <ButtonLink to="/signup" size="lg" className="group">
              Start free
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
            <ButtonLink to="/how-it-works" size="lg" variant="secondary">
              See how it works
            </ButtonLink>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '280ms' }}>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-3">
              {HERO_FACTS.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-3.5 text-accent-text" strokeWidth={2.5} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-14 animate-fade-up sm:mt-16" style={{ animationDelay: '420ms' }}>
          <BrowserFrame url="app.ascentra.com/overview" caption="Sample data" label="Product preview">
            <DashboardMockup />
          </BrowserFrame>
        </div>
      </Container>
    </section>
  );
}

function ProblemOutcome() {
  return (
    <Section tone="surface" bordered>
      <SectionHeading
        eyebrow="Why Ascentra"
        title="SEO is a weekly loop. Most teams still run it by hand."
        lead="Research in one tool, writing in another, rankings in a spreadsheet and AI answers nowhere at all. Ascentra runs the whole loop in one place."
      />
      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        {PROBLEMS.map((p, i) => (
          <Reveal key={p.outcome} index={i} className="flex flex-col rounded-xl border border-line bg-page">
            <div className="p-6 sm:p-7">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Today</p>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{p.today}</p>
            </div>
            <div className="relative border-t border-line">
              <span className="absolute left-6 top-0 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-accent-text sm:left-7" aria-hidden>
                <MoveRight className="size-3.5" />
              </span>
            </div>
            <div className="flex-1 rounded-b-xl bg-surface p-6 pt-8 sm:p-7 sm:pt-9">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text">With Ascentra</p>
              <p className="mt-3 text-[15px] font-medium leading-relaxed text-ink">{p.outcome}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <FactGrid facts={PLATFORM_FACTS} className="mt-16 sm:mt-20" />
    </Section>
  );
}

function CapabilityGrid() {
  // bento: the first card and the seventh span two columns on wide screens (3 + 3 + 3 + 3 cells)
  const wide = new Set([0, 6]);
  return (
    <Section tone="page" id="platform">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow="Platform" title="Ten capabilities. One system." lead="Each one stands on its own. Together they run your SEO as one weekly loop, from the first keyword to the Monday report." />
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
          <SectionHeading eyebrow="The growth loop" title="Research to results, every week." lead="Ascentra runs the same six steps for every website, every week. Each loop starts from what the last one learned." />
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
            title="Know what ChatGPT, Gemini and Google’s AI say about you."
            lead="Buyers ask AI assistants for a shortlist before they ever search. Ascentra asks the same questions, every day, and shows where you are named, cited or missing."
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
            title="Climb to the keywords that matter, one rung at a time."
            lead="Hard keywords rarely fall to a single new page. Ascentra plans easier supporting pages that earn relevance first, writes them in order and links each one up to your head term."
          />
          <div className="mt-9">
            <CheckList
              items={[
                'Difficulty for your site, with a Direct, Short or Full plan',
                'Weekly rank checks for every rung and the head term',
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
        title="Nine sources. One ledger. Every link checked."
        lead="Link indexes miss links and report live ones as lost. Ascentra merges nine sources and visits each linking page itself — a link counts as lost only after two misses, with the reason."
      />
      <Reveal className="mt-14 sm:mt-16">
        <LinkSourcesDiagram />
      </Reveal>
      <div className="mt-14 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
        {[
          { t: 'Checked, not assumed', b: 'Rel, placement, noindex and canonical read from the live page.' },
          { t: 'Valued three ways', b: 'SEO, referral and brand value for every referring site.' },
          { t: 'Prospects that convert', b: 'Scored prospects, contacts, outreach drafts and follow-ups after 7 and 14 days.' },
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

function HowItWorks() {
  return (
    <Section tone="page">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow="How it works" title="From sign-up to a weekly loop in four steps." />
        <Reveal>
          <ArrowLink to="/how-it-works">See how it works in detail</ArrowLink>
        </Reveal>
      </div>
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {START_STEPS.map((s, i) => (
          <Reveal
            as="li"
            key={s.title}
            index={i}
            className="group relative rounded-xl border border-line bg-surface p-6 transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-raised"
          >
            <span className="absolute inset-x-6 top-0 h-0.5 origin-left scale-x-0 rounded-full bg-accent transition-transform duration-300 ease-brand group-hover:scale-x-100" aria-hidden />
            <span className="font-mono text-sm font-medium text-accent-text tabular">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="mt-6 font-display text-lg font-semibold tracking-[-0.01em] text-ink">{s.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
          </Reveal>
        ))}
      </ol>
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
            lead="Workspaces per company, roles for every person, verified ownership before any data is shown and a budget check before any paid work."
          >
            <ButtonLink to="/security" variant="secondary" icon={<ShieldCheck className="size-4" aria-hidden />}>
              Security at Ascentra
            </ButtonLink>
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
          <SectionHeading eyebrow="Who it’s for" title="For the teams that own organic growth." lead="Agencies running many clients, marketing teams without a full SEO function, B2B companies and businesses with many locations." />
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
      <SectionHeading align="center" eyebrow="Pricing" title="Plans that grow with your portfolio." lead="Start free. Every run shows its cost before it starts, and budgets keep spend where you set it." />
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
            <ButtonLink to={t.cta.to} variant={t.highlighted ? 'primary' : 'secondary'} className="mt-6 w-full">
              {t.cta.label}
            </ButtonLink>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-10 text-center">
        <ArrowLink to="/pricing">Compare plans</ArrowLink>
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
    title: 'Enterprise-grade autonomous SEO',
    description:
      'Ascentra researches keywords, writes the pages, audits your site and tracks rankings, AI answers and backlinks — every week, with your team approving what matters.',
    path: '/',
  });
  return (
    <>
      <Hero />
      <div className="border-y border-line bg-page py-10">
        <Container>
          <p className="mb-6 text-center font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Works with the engines and tools you already rely on</p>
        </Container>
        <IntegrationMarquee />
      </div>
      <ProblemOutcome />
      <CapabilityGrid />
      <LoopBand />
      <AiSpotlight />
      <LadderSpotlight />
      <BacklinksSpotlight />
      <HowItWorks />
      <EnterpriseBand />
      <WhoItsFor />
      <PricingTeaser />
      <FaqSection />
      <CtaBand />
    </>
  );
}
