import { useEffect, useRef } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Container, CtaBand, Eyebrow, GrowthLoopDiagram, IconTile, IntegrationMarquee, LOOP_STEPS, Reveal, Section, SectionHeading } from '../components';
import { CapabilityMap } from '../components/platform/CapabilityMap';
import { CapabilityScreen, isWideScreen } from '../components/platform/CapabilityScreen';
import { ArrowLink, jumpTo, lowerFirst, useScrollSpy } from '../components/platform/kit';
import { CapabilityCount, featureBySlug, features, type Feature } from '../content/features';
import { useSeo } from '../useSeo';

const HERO_FACTS = [`${features.length} capabilities`, 'Auto or Manual for every step', 'Cost shown before every run'];

/** which capabilities carry each step of the weekly loop */
const LOOP_MAP: Record<string, string[]> = {
  Research: ['keyword-research', 'ai-visibility'],
  Plan: ['keyword-ladders', 'autopilot'],
  Write: ['content'],
  Publish: ['content', 'site-tracking'],
  Track: ['site-tracking', 'ai-visibility', 'backlinks', 'technical-audits'],
  Learn: ['reports', 'autopilot'],
};

const SOURCE_GROUPS: { title: string; items: { name: string; use: string }[] }[] = [
  {
    title: 'Search data',
    items: [
      { name: 'Google Search Console', use: 'clicks, positions, index coverage, sitemaps and links' },
      { name: 'Google Analytics 4', use: 'conversions, and visits and revenue from AI answers' },
      { name: 'Google Trends', use: 'rising topics in your market' },
      { name: 'Bing Webmaster Tools', use: 'links Bing has found to your site' },
    ],
  },
  {
    title: 'AI engines',
    items: [
      { name: 'ChatGPT, Gemini, Perplexity and Claude', use: 'the answers your buyers read' },
      { name: 'Google AI Mode and AI Overviews', use: 'AI answers inside Google Search' },
    ],
  },
  {
    title: 'Open web',
    items: [
      { name: 'Common Crawl web graph', use: 'links across the open web' },
      { name: 'Wikipedia, Hacker News and news', use: 'mentions and links worth knowing about' },
    ],
  },
  {
    title: 'Publishing',
    items: [
      { name: 'WordPress', use: 'drafts for your team to review' },
      { name: 'HTML, Markdown and meta.json', use: 'a package for any other CMS' },
    ],
  },
];

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-page">
      <span
        aria-hidden
        className="mk-watermark pointer-events-none absolute -right-48 top-[30rem] -z-10 aspect-[911/797] w-[420px] bg-ink/[0.035] sm:-right-32 sm:top-6 sm:w-[560px] lg:-right-40 lg:-top-6 lg:w-[720px]"
      />
      <Container className="pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-16">
          <div>
            <div className="animate-fade-up">
              <Eyebrow>Platform</Eyebrow>
            </div>
            <h1
              className="mt-5 animate-fade-up font-display text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.02em] text-balance text-ink sm:text-6xl lg:text-[4.25rem]"
              style={{ animationDelay: '70ms' }}
            >
              {CapabilityCount} capabilities. One system.
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-pretty text-lg leading-relaxed text-ink-2 sm:text-xl" style={{ animationDelay: '140ms' }}>
              Research, keyword ladders, content, audits, tracking, AI search visibility and backlinks — each strong on its own, and together one weekly loop your team can trust.
            </p>
            <div className="mt-9 flex animate-fade-up flex-wrap gap-3" style={{ animationDelay: '210ms' }}>
              <ButtonLink to="/signup" size="lg" className="group">
                Start free
                <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/how-it-works" size="lg" variant="secondary">
                See how it works
              </ButtonLink>
            </div>
            <ul className="mt-8 flex animate-fade-up flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-3" style={{ animationDelay: '280ms' }}>
              {HERO_FACTS.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-3.5 text-accent-text" strokeWidth={2.5} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
            <CapabilityMap />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** Sticky jump links under the header; the section being read is highlighted, and on phones the bar scrolls it into view. */
function CapabilityNav({ active }: { active: string | null }) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!active) {
      // back above the first capability: show the start of the bar again
      const first = document.getElementById(features[0].slug);
      if (first && first.getBoundingClientRect().top > 0) list.scrollTo({ left: 0 });
      return;
    }
    const el = list.querySelector<HTMLElement>(`[data-slug="${active}"]`);
    if (!el) return;
    const left = el.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft + 8 || left + el.offsetWidth > list.scrollLeft + list.clientWidth - 8) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      list.scrollTo({ left: Math.max(0, left - 16), behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [active]);
  return (
    <nav aria-label="Capabilities on this page" className="sticky top-16 z-30 border-y border-line bg-page/90 backdrop-blur-md supports-[backdrop-filter]:bg-page/80 lg:top-[72px]">
      <Container>
        <ul ref={listRef} className="pf-subnav -mx-4 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:justify-between lg:px-0">
          {features.map((f, i) => {
            const on = active === f.slug;
            return (
              <li key={f.slug} className="shrink-0">
                <a
                  href={`#${f.slug}`}
                  data-slug={f.slug}
                  aria-current={on ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    jumpTo(f.slug);
                  }}
                  className={cn(
                    'group relative flex h-12 items-center gap-2 whitespace-nowrap px-2.5 text-[13.5px] font-medium transition-colors duration-150 ease-brand',
                    on ? 'text-ink' : 'text-ink-3 hover:text-ink',
                  )}
                >
                  <span className={cn('font-mono text-[10.5px] tabular transition-colors duration-150', on ? 'text-accent-text' : 'text-ink-3/70 group-hover:text-accent-text')}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {f.shortName}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-2.5 -bottom-px h-0.5 origin-left rounded-full bg-accent transition-transform duration-200 ease-brand',
                      on ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100 group-hover:bg-line-strong',
                    )}
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}

function MiniFacts({ feature }: { feature: Feature }) {
  return (
    <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
      {feature.facts.map((f, i) => (
        <Reveal key={f.label} index={i} className="min-w-0">
          <dt className="sr-only">{f.label}</dt>
          <dd className="font-mono text-xl font-medium tracking-[-0.02em] text-ink tabular sm:text-2xl">
            {f.prefix}
            {typeof f.value === 'number' ? f.value.toLocaleString('en-US') : f.value}
            {f.suffix}
          </dd>
          <dd aria-hidden className="mt-1 text-[12.5px] leading-snug text-ink-3">
            {f.label}
          </dd>
        </Reveal>
      ))}
    </dl>
  );
}

function CapabilitySection({ feature: f, index }: { feature: Feature; index: number }) {
  const flip = index % 2 === 1;
  const wide = isWideScreen(f);
  const titleId = `${f.slug}-title`;
  const head = (
    <>
      <Reveal className="flex items-center gap-3">
        <IconTile icon={f.icon} />
        <Eyebrow>{f.name}</Eyebrow>
      </Reveal>
      <Reveal index={1}>
        <h2 id={titleId} className="mt-6 max-w-xl font-display text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.01em] text-balance text-ink sm:text-[2.125rem]">
          {f.tagline}
        </h2>
      </Reveal>
    </>
  );
  const body = (
    <>
      <Reveal index={1}>
        <p className={cn('max-w-xl text-pretty text-base leading-relaxed text-ink-2 sm:text-[17px]', !wide && 'mt-5')}>{f.summary}</p>
      </Reveal>
      <MiniFacts feature={f} />
      <Reveal className="mt-8">
        <ArrowLink to={`/platform/${f.slug}`}>Explore {lowerFirst(f.shortName)}</ArrowLink>
      </Reveal>
    </>
  );
  if (wide)
    return (
      <div id={f.slug} tabIndex={-1} className="scroll-mt-[112px] outline-none focus-visible:shadow-none lg:scroll-mt-[120px]">
        <Section tone={flip ? 'surface' : 'page'} bordered={index > 0} aria-labelledby={titleId}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16 xl:gap-20">
            <div>{head}</div>
            <div className="lg:pt-[4.25rem]">{body}</div>
          </div>
          <Reveal index={1} className="mt-14 min-w-0">
            <CapabilityScreen feature={f} />
          </Reveal>
        </Section>
      </div>
    );
  return (
    // the wrapper is the jump target: focusable, and offset below the sticky header + capability bar
    <div id={f.slug} tabIndex={-1} className="scroll-mt-[112px] outline-none focus-visible:shadow-none lg:scroll-mt-[120px]">
      <Section tone={flip ? 'surface' : 'page'} bordered={index > 0} aria-labelledby={titleId}>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
          <div className={cn(flip && 'lg:order-last')}>
            {head}
            {body}
          </div>
          <Reveal index={1} className="min-w-0">
            <CapabilityScreen feature={f} />
          </Reveal>
        </div>
      </Section>
    </div>
  );
}

function LoopSection() {
  return (
    <Section tone="ink" spacing="lg">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-20">
        <div>
          <SectionHeading
            eyebrow="The growth loop"
            title="How the ten fit together."
            lead="Every website runs the same six steps every week. Each capability carries one or more of them, and each loop starts from what the last one learned."
          />
          <ol className="mt-10 divide-y divide-line-on-ink border-y border-line-on-ink">
            {LOOP_STEPS.map((s, i) => (
              <Reveal as="li" key={s.label} index={i} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-4 py-4 sm:grid-cols-[28px_120px_minmax(0,1fr)] sm:items-center">
                <span className="font-mono text-[12px] text-accent-on-ink tabular">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-[15px] font-semibold text-on-ink">{s.label}</span>
                <span className="col-start-2 mt-2 flex flex-wrap gap-1.5 sm:col-start-3 sm:mt-0">
                  {(LOOP_MAP[s.label] ?? []).map((slug) => {
                    const f = featureBySlug(slug);
                    return f ? (
                      <a
                        key={slug}
                        href={`#${slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          jumpTo(slug);
                        }}
                        className="inline-flex h-7 items-center rounded-full border border-line-on-ink px-3 text-[12.5px] text-on-ink-2 transition-colors duration-150 ease-brand hover:border-accent-on-ink hover:text-on-ink"
                      >
                        {f.shortName}
                      </a>
                    ) : null;
                  })}
                </span>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-8">
            <ArrowLink to="/how-it-works">See a week with Ascentra</ArrowLink>
          </Reveal>
        </div>
        <Reveal index={1}>
          <GrowthLoopDiagram />
        </Reveal>
      </div>
    </Section>
  );
}

function Integrations() {
  return (
    <Section tone="page">
      <SectionHeading
        align="center"
        eyebrow="Integrations"
        title="Built on the sources you already trust."
        lead="Ascentra reads your Google data through a service account you add, asks the AI engines your buyers use and hands finished pages to your CMS."
      />
      {/* phones get the grouped list only (the chip row would repeat it) */}
      <Reveal className="mt-12 hidden sm:block">
        <IntegrationMarquee />
      </Reveal>
      <div className="mt-14 grid gap-x-6 gap-y-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-4">
        {SOURCE_GROUPS.map((g, i) => (
          <Reveal key={g.title} index={i} className="border-l border-line pl-5">
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text">{g.title}</h3>
            <ul className="mt-4 space-y-3.5">
              {g.items.map((it) => (
                <li key={it.name}>
                  <span className="block text-[14px] font-medium text-ink">{it.name}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{it.use}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default function PlatformPage() {
  useSeo({
    title: 'Platform',
    description:
      `${CapabilityCount} capabilities that run your SEO as one weekly loop: ${features.map((f) => (/^[A-Z]{2}/.test(f.shortName) ? f.shortName : f.shortName.charAt(0).toLowerCase() + f.shortName.slice(1))).join(', ')}.`,
    path: '/platform',
  });
  const active = useScrollSpy(features.map((f) => f.slug));
  return (
    <>
      <Hero />
      {/* the capability bar stays under the header only while the capability sections are on screen */}
      <div>
        <CapabilityNav active={active} />
        {features.map((f, i) => (
          <CapabilitySection key={f.slug} feature={f} index={i} />
        ))}
      </div>
      <LoopSection />
      <Integrations />
      <CtaBand title="One platform for the whole loop." />
    </>
  );
}
