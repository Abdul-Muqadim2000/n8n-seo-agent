import { Fragment } from 'react';
import { useParams } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Container, CtaBand, Eyebrow, FactGrid, Faq, FeatureCard, FeatureVisual, IconTile, MarketingNotFound, Photo, Reveal, Section, SectionHeading } from '../components';
import { CapabilityScreen, isWideScreen } from '../components/platform/CapabilityScreen';
import { ArrowLink, Breadcrumbs, PrevNext, StepRail } from '../components/platform/kit';
import { capabilityCount, featureBySlug, features, relatedFeatures, type Fact, type Feature } from '../content/features';
import { useSeo } from '../useSeo';

const factText = (f: Fact) => `${f.prefix ?? ''}${typeof f.value === 'number' ? f.value.toLocaleString('en-US') : f.value}${f.suffix ?? ''} ${f.label}`;

function Hero({ feature: f }: { feature: Feature }) {
  const wide = isWideScreen(f);
  return (
    <section className="relative isolate overflow-hidden bg-page">
      <span
        aria-hidden
        className="mk-watermark pointer-events-none absolute -right-48 top-[34rem] -z-10 aspect-[911/797] w-[420px] bg-ink/[0.035] sm:-right-40 sm:top-4 sm:w-[560px] lg:-right-48 lg:-top-10 lg:w-[700px]"
      />
      <Container className="pb-16 pt-8 sm:pb-24 sm:pt-10">
        <Breadcrumbs
          items={[
            { label: 'Platform', to: '/platform' },
            { label: f.shortName, to: `/platform/${f.slug}` },
          ]}
        />
        <div className={cn('mt-10 grid grid-cols-1 items-center gap-12 sm:mt-14', wide ? 'lg:gap-16' : 'lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14 xl:gap-20')}>
          <div className={cn(wide && 'max-w-3xl')}>
            <div className="flex animate-fade-up items-center gap-3">
              <IconTile icon={f.icon} />
              <Eyebrow>
                Capability {String(features.indexOf(f) + 1).padStart(2, '0')} / {features.length}
              </Eyebrow>
            </div>
            <h1
              className="mt-6 animate-fade-up font-display text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.02em] text-balance text-ink sm:text-5xl lg:text-[3.5rem]"
              style={{ animationDelay: '70ms' }}
            >
              {f.name}
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-pretty text-lg leading-relaxed text-ink-2" style={{ animationDelay: '140ms' }}>
              {f.summary}
            </p>
            <div className="mt-9 flex animate-fade-up flex-wrap gap-3" style={{ animationDelay: '210ms' }}>
              <ButtonLink to="/signup" size="lg" className="group">
                Start free
                <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/contact?topic=sales" size="lg" variant="secondary">
                Talk to sales
              </ButtonLink>
            </div>
            <ul className={cn('mt-8 animate-fade-up text-[13px] text-ink-3', wide ? 'flex flex-wrap gap-x-6 gap-y-2' : 'grid gap-2')} style={{ animationDelay: '280ms' }}>
              {f.facts.map((x) => (
                <li key={x.label} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-accent-text" strokeWidth={2.5} aria-hidden />
                  {factText(x)}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 animate-fade-up" style={{ animationDelay: '240ms' }}>
            <CapabilityScreen feature={f} framed />
          </div>
        </div>
      </Container>
    </section>
  );
}

function Benefits({ feature: f }: { feature: Feature }) {
  return (
    <Section tone="surface" bordered>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal className="max-w-3xl">
          <Eyebrow className="mb-4">What’s included</Eyebrow>
          <h2 className="font-display text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.01em] text-balance text-ink sm:text-[2.25rem]">{f.tagline}</h2>
        </Reveal>
        <Reveal>
          <ArrowLink to="/pricing">See pricing</ArrowLink>
        </Reveal>
      </div>
      <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {f.benefits.map((b, i) => (
          <Reveal as="li" key={b} index={i % 3} className="group relative flex flex-col gap-4 bg-surface p-6 transition-colors duration-200 ease-brand hover:bg-page sm:p-7">
            <span className="absolute inset-x-6 top-0 h-0.5 origin-left scale-x-0 rounded-full bg-accent transition-transform duration-300 ease-brand group-hover:scale-x-100 sm:inset-x-7" aria-hidden />
            <span className="font-mono text-[12px] font-medium text-accent-text tabular">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-[15px] leading-relaxed text-ink">{b}</span>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

function Steps({ feature: f }: { feature: Feature }) {
  return (
    <Section tone="page">
      <SectionHeading align="center" eyebrow="How it works" title={`${f.name}, step by step.`} />
      <StepRail steps={f.steps} className="mt-14 sm:mt-16" />
    </Section>
  );
}

function Story({ feature: f }: { feature: Feature }) {
  const story = f.story ?? { title: f.tagline, body: f.summary };
  const eyebrow = story.eyebrow ?? 'Why it matters';
  return (
    <Section tone="ink" spacing="lg">
      {f.diagram ? (
        <>
          <SectionHeading align="center" eyebrow={eyebrow} title={story.title} lead={story.body} />
          <Reveal className={cn('mt-14 sm:mt-16', f.diagram === 'growth-loop' && 'mx-auto max-w-[520px]')}>
            <FeatureVisual kind={f.diagram} />
          </Reveal>
        </>
      ) : (
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading eyebrow={eyebrow} title={story.title} lead={story.body} />
          <Reveal index={1}>
            <Photo image={f.image} ratio="4 / 3" className="border-line-on-ink" sizes="(min-width: 1024px) 45vw, 100vw" />
          </Reveal>
        </div>
      )}
      <FactGrid facts={f.facts} className="mt-16 sm:mt-20" />
    </Section>
  );
}

function Questions({ feature: f }: { feature: Feature }) {
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
          <Faq items={f.faqs} schema />
        </Reveal>
      </div>
    </Section>
  );
}

function Related({ feature: f }: { feature: Feature }) {
  const i = features.indexOf(f);
  const prev = features[(i - 1 + features.length) % features.length];
  const next = features[(i + 1) % features.length];
  return (
    <Section tone="surface" bordered>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow="Related capabilities" title="Works well together." />
        <Reveal>
          <ArrowLink to="/platform">All {capabilityCount} capabilities</ArrowLink>
        </Reveal>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {relatedFeatures(f).map((r, k) => (
          <Reveal key={r.slug} index={k}>
            <FeatureCard to={`/platform/${r.slug}`} icon={r.icon} title={r.name} description={r.tagline} />
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-12 border-t border-line pt-10">
        <PrevNext prev={{ to: `/platform/${prev.slug}`, label: prev.name }} next={{ to: `/platform/${next.slug}`, label: next.name }} />
      </Reveal>
    </Section>
  );
}

export default function FeaturePage() {
  const { slug } = useParams();
  const feature = featureBySlug(slug);
  useSeo({ title: feature?.name ?? 'Page not found', description: feature?.summary ?? 'The page you opened does not exist.', path: `/platform/${slug ?? ''}` });
  if (!feature) return <MarketingNotFound />;
  return (
    // keyed by slug: moving to the next capability starts the page (and its reveals) fresh
    <Fragment key={feature.slug}>
      <Hero feature={feature} />
      <Benefits feature={feature} />
      <Steps feature={feature} />
      <Story feature={feature} />
      <Questions feature={feature} />
      <Related feature={feature} />
      <CtaBand />
    </Fragment>
  );
}
