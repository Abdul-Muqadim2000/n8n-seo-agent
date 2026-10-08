import { Fragment } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Container, CtaBand, Eyebrow, Faq, FeatureCard, IconTile, MarketingNotFound, Photo, Reveal, Section, SectionHeading } from '../components';
import { CapabilityScreen } from '../components/platform/CapabilityScreen';
import { ArrowLink, Breadcrumbs, CheckList, lowerFirst } from '../components/platform/kit';
import { featureBySlug, type Feature } from '../content/features';
import { solutionBySlug, solutions, type Solution } from '../content/solutions';
import { useSeo } from '../useSeo';

const usedFeatures = (s: Solution) => s.helps.map((h) => featureBySlug(h.feature)).filter((f): f is Feature => !!f);

function Hero({ solution: s }: { solution: Solution }) {
  const used = usedFeatures(s);
  return (
    <section className="relative isolate overflow-hidden bg-page">
      <Container className="pb-20 pt-8 sm:pb-28 sm:pt-10">
        <Breadcrumbs
          items={[
            { label: 'Solutions', to: '/solutions' },
            { label: s.shortName, to: `/solutions/${s.slug}` },
          ]}
        />
        <div className="mt-10 grid grid-cols-1 items-center gap-12 sm:mt-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16 xl:gap-20">
          <div>
            <div className="flex animate-fade-up items-center gap-3">
              <IconTile icon={s.icon} />
              <Eyebrow>For {lowerFirst(s.shortName)}</Eyebrow>
            </div>
            <h1
              className="mt-6 animate-fade-up font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] text-balance text-ink sm:text-[2.75rem] lg:text-[3rem]"
              style={{ animationDelay: '70ms' }}
            >
              {s.tagline}
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-pretty text-lg leading-relaxed text-ink-2" style={{ animationDelay: '140ms' }}>
              {s.summary}
            </p>
            <div className="mt-9 flex animate-fade-up flex-wrap gap-3" style={{ animationDelay: '210ms' }}>
              <ButtonLink to="/signup" size="lg" className="group">
                Start free
                <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/contact" size="lg" variant="secondary">
                Talk to sales
              </ButtonLink>
            </div>
          </div>
          {/* the photo with the capabilities this team leans on, as a card overlapping its lower edge */}
          <div className="relative animate-fade-up pb-10 sm:pb-0" style={{ animationDelay: '200ms' }}>
            <Photo image={s.image} ratio="4 / 3" priority sizes="(min-width: 1024px) 45vw, 100vw" className="shadow-raised" />
            <div className="absolute inset-x-4 bottom-0 rounded-xl border border-line bg-surface p-4 shadow-overlay sm:inset-x-auto sm:-bottom-8 sm:-left-8 sm:w-[300px]">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">Capabilities used most</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
                {used.map((f) => (
                  <li key={f.slug} className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-ink">
                    <IconTile icon={f.icon} size="sm" className="size-6 [&_svg]:size-3.5" />
                    <span className="truncate">{f.shortName}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Pains({ solution: s }: { solution: Solution }) {
  return (
    <Section tone="surface" bordered>
      <SectionHeading eyebrow="What gets in the way" title="Where the week goes today." />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {s.pains.map((p, i) => (
          <Reveal key={p.title} index={i} className="group relative rounded-xl border border-line bg-page p-6 transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-card sm:p-7">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Today · {String(i + 1).padStart(2, '0')}</span>
            <h3 className="mt-4 font-display text-lg font-semibold tracking-[-0.01em] text-ink">{p.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{p.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Helps({ solution: s }: { solution: Solution }) {
  return (
    <Section tone="page">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow="How Ascentra helps" title="The capabilities that carry the load." lead="Every team gets the whole platform. These are the parts that make the biggest difference for yours." />
        <Reveal>
          <ArrowLink to="/platform">All ten capabilities</ArrowLink>
        </Reveal>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {s.helps.map((h, i) => {
          const f = featureBySlug(h.feature);
          if (!f) return null;
          return (
            <Reveal key={h.title} index={i % 2}>
              <FeatureCard to={`/platform/${f.slug}`} icon={f.icon} title={h.title} description={h.body} cta={`Explore ${lowerFirst(f.name)}`} />
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

function Showcase({ solution: s }: { solution: Solution }) {
  const f = featureBySlug(s.showcase?.feature ?? s.helps[0]?.feature);
  return (
    <Section tone="ink" spacing="lg">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <SectionHeading eyebrow="See it in Ascentra" title={s.showcase?.title ?? s.tagline} lead={s.showcase?.body ?? s.summary} />
          <Reveal className="mt-10">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-on-ink">What your team can do</p>
          </Reveal>
          <CheckList className="mt-5" items={s.outcomes} />
        </div>
        {f && (
          <Reveal index={1} className="min-w-0">
            <CapabilityScreen feature={f} />
          </Reveal>
        )}
      </div>
    </Section>
  );
}

function Questions({ solution: s }: { solution: Solution }) {
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
          <Faq items={s.faqs} schema />
        </Reveal>
      </div>
    </Section>
  );
}

function Others({ solution: s }: { solution: Solution }) {
  const others = solutions.filter((o) => o.slug !== s.slug);
  return (
    <Section tone="surface" bordered spacing="sm">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow="Other teams" title="Ascentra for other teams." />
        <Reveal>
          <ArrowLink to="/solutions">All solutions</ArrowLink>
        </Reveal>
      </div>
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {others.map((o, i) => (
          <Reveal as="li" key={o.slug} index={i}>
            <Link
              to={`/solutions/${o.slug}`}
              className="group flex h-full items-center gap-4 rounded-xl border border-line bg-page p-3 pr-5 transition-[border-color,box-shadow,transform] duration-200 ease-brand hover:-translate-y-0.5 hover:border-accent hover:shadow-raised"
            >
              <Photo image={o.image} ratio="1 / 1" className="w-16 shrink-0 rounded-lg sm:w-20" imgClassName="group-hover:scale-[1.06]" sizes="80px" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink group-hover:text-accent-text">{o.shortName}</span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-ink-3">{o.tagline}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-hover:translate-x-1 group-hover:text-accent-text" aria-hidden />
            </Link>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export default function SolutionPage() {
  const { slug } = useParams();
  const solution = solutionBySlug(slug);
  useSeo({ title: solution?.name ?? 'Page not found', description: solution?.summary ?? 'The page you opened does not exist.', path: `/solutions/${slug ?? ''}` });
  if (!solution) return <MarketingNotFound />;
  return (
    // keyed by slug: moving to another solution starts the page (and its reveals) fresh
    <Fragment key={solution.slug}>
      <Hero solution={solution} />
      <Pains solution={solution} />
      <Helps solution={solution} />
      <Showcase solution={solution} />
      <Questions solution={solution} />
      <Others solution={solution} />
      <CtaBand />
    </Fragment>
  );
}
