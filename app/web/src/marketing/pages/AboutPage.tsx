import { Link } from 'react-router';
import { ArrowRight, BadgeCheck, CircleGauge, Hand, Languages, Link2, Radar, Sparkles, Wallet, type LucideIcon } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { CtaBand, FactGrid, IconTile, LOOP_STEPS, Photo, Reveal, Section, SectionHeading } from '../components';
import { ArrowLink, PageHero } from '../components/company/PageHero';
import { changelog } from '../content/changelog';
import { features, type Fact } from '../content/features';
import { aiEngines, integrations, linkSources } from '../content/site';
import { useSeo } from '../useSeo';
import { entryAnchor, fmtLongDate } from '../components/company/changelog-utils';

const REAL: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Link2,
    title: 'Our own link checks',
    body: 'Link indexes report live links as lost. Ascentra visits each linking page itself, and a link counts as lost only after two misses, with the reason.',
  },
  {
    icon: Radar,
    title: 'Alerts only on real changes',
    body: 'AI answers vary from one day to the next. The daily AI Pulse tests each change for statistical significance before it tells anyone.',
  },
  {
    icon: CircleGauge,
    title: 'Ranges, not single numbers',
    body: 'AI mention and citation rates come with 95% ranges, so a small sample never looks like a trend.',
  },
  {
    icon: BadgeCheck,
    title: 'The live page, checked',
    body: 'When a planned page goes live, Ascentra checks the published page itself: its content, its schema and its images.',
  },
];

const PRINCIPLES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Languages,
    title: 'Plain language',
    body: 'Every verdict, audit finding and recommendation explains itself in words your whole team understands. Specialists still get the detail.',
  },
  {
    icon: Hand,
    title: 'You stay in control',
    body: 'Auto or Manual for every step and every keyword ladder. On Manual, work waits in “Needs you” until a person approves it, and nothing is published without your team.',
  },
  {
    icon: Wallet,
    title: 'No wasted spend',
    body: 'The cost of every run is shown before it starts, budgets are checked first, and nothing is paid for twice when the answer cannot have changed.',
  },
  {
    icon: Sparkles,
    title: 'Built for the AI-search era',
    body: `Buyers ask AI assistants for a shortlist before they search. Ascentra tracks ${aiEngines.length} AI engines and answer surfaces next to Google, and checks that AI crawlers can read your site.`,
  },
];

const INSIDE: Fact[] = [
  { value: features.length, label: 'capabilities in one weekly loop' },
  { value: aiEngines.length, label: 'AI engines and answer surfaces' },
  { value: linkSources.length, label: 'link sources in one ledger' },
  { value: 50, label: 'buyer questions per AI panel' },
  { value: 1000, label: 'pages per crawl, JavaScript included' },
  { value: 4, label: 'roles: owner, admin, member and viewer' },
];

function HeroCollage() {
  return (
    <div className="relative grid grid-cols-5 gap-3 sm:gap-4">
      <Photo image="brightOffice" ratio="auto" className="col-span-3 h-full min-h-[280px]" sizes="(min-width: 1024px) 28vw, 60vw" priority />
      <div className="col-span-2 flex flex-col gap-3 pt-10 sm:gap-4 sm:pt-14">
        <Photo image="notesLaptop" ratio="3 / 4" sizes="(min-width: 1024px) 18vw, 40vw" priority />
        <Photo image="meetingGesture" ratio="1 / 1" sizes="(min-width: 1024px) 18vw, 40vw" />
      </div>
      {/* the weekly loop as a small card over the photos */}
      <div className="absolute -bottom-6 left-3 right-16 rounded-xl border border-line bg-surface/95 p-4 shadow-overlay backdrop-blur-sm sm:left-6 sm:right-auto sm:max-w-[320px]">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">Every week</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-medium text-ink">
          {LOOP_STEPS.map((s, i) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              {s.label}
              {i < LOOP_STEPS.length - 1 && <ArrowRight className="size-3 text-accent-text" aria-hidden />}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

function Mission() {
  return (
    <Section tone="surface" bordered spacing="lg" aria-labelledby="mission-title">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading
            id="mission-title"
            eyebrow="Our mission"
            title="SEO that runs itself, measured by what is real."
            lead="Most SEO tools report what an index or a model claims. We would rather check. Ascentra measures the things that decide whether a number can be trusted, and says so when it cannot."
          />
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {REAL.map((r, i) => (
            <Reveal as="li" key={r.title} index={i} className="h-full">
              <div className="group h-full rounded-xl border border-line bg-page p-6 transition-[border-color,box-shadow,background-color] duration-200 ease-brand hover:border-line-strong hover:bg-surface hover:shadow-raised">
                <IconTile icon={r.icon} className="group-hover:bg-accent group-hover:text-accent-ink" />
                <h3 className="mt-5 font-display text-base font-semibold text-ink">{r.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{r.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Principles() {
  return (
    <Section tone="page" aria-labelledby="principles-title">
      <SectionHeading id="principles-title" eyebrow="Principles" title="How we decide what Ascentra does." lead="Four rules behind every capability." />
      <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPLES.map((p, i) => (
          <Reveal as="li" key={p.title} index={i} className="group relative bg-surface p-6 transition-colors duration-200 ease-brand hover:bg-page sm:p-7">
            <span className="absolute inset-x-6 top-0 h-0.5 origin-left scale-x-0 rounded-full bg-accent transition-transform duration-300 ease-brand group-hover:scale-x-100 sm:inset-x-7" aria-hidden />
            <div className="flex items-center justify-between">
              <IconTile icon={p.icon} className="group-hover:bg-accent group-hover:text-accent-ink" />
              <span className="font-mono text-[13px] font-medium text-ink-3 tabular">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="mt-6 font-display text-lg font-semibold tracking-[-0.01em] text-ink">{p.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{p.body}</p>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

function Inside() {
  return (
    <Section tone="ink" spacing="lg" aria-labelledby="inside-title">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading id="inside-title" eyebrow="What’s inside" title="One system, from the first keyword to the Monday report." />
        <Reveal>
          <ArrowLink to="/platform" onInk>
            Explore the platform
          </ArrowLink>
        </Reveal>
      </div>
      <FactGrid facts={INSIDE} className="mt-14 lg:grid-cols-3" />
      <div className="mt-16 grid gap-12 border-t border-line-on-ink pt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-on-ink-2">Capabilities</p>
          <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
            {features.map((f, i) => (
              <Reveal as="li" key={f.slug} index={i % 2}>
                <Link
                  to={`/platform/${f.slug}`}
                  className="group flex items-center justify-between gap-3 border-b border-line-on-ink py-3 text-[15px] text-on-ink transition-colors duration-150 ease-brand hover:text-accent-on-ink"
                >
                  <span className="flex items-center gap-3">
                    <f.icon className="size-4 text-accent-on-ink" strokeWidth={1.75} aria-hidden />
                    {f.name}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-on-ink-2 transition-transform duration-200 ease-brand group-hover:translate-x-1 group-hover:text-accent-on-ink" aria-hidden />
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-on-ink-2">Works with</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {integrations.map((t, i) => (
              <Reveal
                as="li"
                key={t}
                index={i % 4}
                className="rounded-full border border-line-on-ink px-3.5 py-1.5 text-[13px] text-on-ink-2 transition-colors duration-150 ease-brand hover:border-accent-on-ink hover:text-on-ink"
              >
                {t}
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Shipping() {
  const recent = changelog.slice(0, 3);
  return (
    <Section tone="surface" bordered aria-labelledby="shipping-title">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="order-last grid grid-cols-2 gap-3 sm:gap-4 lg:order-first">
          <Reveal>
            <Photo image="overheadDesk" ratio="4 / 5" sizes="(min-width: 1024px) 24vw, 50vw" />
          </Reveal>
          <Reveal index={1} className="pt-12">
            <Photo image="loftTeam" ratio="4 / 5" sizes="(min-width: 1024px) 24vw, 50vw" />
          </Reveal>
        </div>
        <div>
          <SectionHeading id="shipping-title" eyebrow="How we build" title="Shipped in small steps, written down in plain words." lead="Every release lands in the changelog in product language: what changed, and why it matters to your team." />
          <ol className="mt-10 space-y-3">
            {recent.map((e, i) => (
              <Reveal as="li" key={e.title} index={i}>
                <Link
                  to={`/changelog#${entryAnchor(e)}`}
                  className="group flex items-start gap-4 rounded-xl border border-line bg-page p-4 transition-[border-color,background-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:bg-surface hover:shadow-card sm:p-5"
                >
                  <time dateTime={e.date} className="w-[5.5rem] shrink-0 pt-0.5 font-mono text-[12px] text-ink-3 tabular">
                    {fmtLongDate(e.date, true)}
                  </time>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink group-hover:text-accent-text">{e.title}</span>
                    <span className="mt-1 block text-[13.5px] leading-snug text-ink-2">{e.summary}</span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-hover:translate-x-1 group-hover:text-accent-text" aria-hidden />
                </Link>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-8">
            <ArrowLink to="/changelog">Read the full changelog</ArrowLink>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

export default function AboutPage() {
  useSeo({
    title: 'About',
    description:
      'Ascentra is enterprise-grade autonomous SEO: one weekly loop for research, content, audits, AI search visibility and backlinks, with your team in control and only real changes reported.',
    path: '/about',
  });
  return (
    <>
      <PageHero
        eyebrow="About Ascentra"
        title="Enterprise-grade autonomous SEO."
        lead="We build the system that runs SEO as a weekly loop — research, content, audits, AI answers and backlinks — so teams spend their time on the decisions that need a person."
        actions={
          <>
            <ButtonLink to="/platform" size="lg">
              Explore the platform
            </ButtonLink>
            <ButtonLink to="/how-it-works" size="lg" variant="secondary">
              See how it works
            </ButtonLink>
          </>
        }
        aside={<HeroCollage />}
        containerClassName="pb-24 sm:pb-28"
      />
      <Mission />
      <Principles />
      <Inside />
      <Shipping />
      <CtaBand className="pt-20 sm:pt-28" />
    </>
  );
}
