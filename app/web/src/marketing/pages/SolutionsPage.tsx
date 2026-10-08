import { Link } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import { CtaBand, IconTile, Photo, Reveal, Section, SectionHeading } from '../components';
import { ArrowLink, lowerFirst } from '../components/platform/kit';
import { featureBySlug, type Feature } from '../content/features';
import { solutions } from '../content/solutions';
import { useSeo } from '../useSeo';

function SolutionCards() {
  return (
    <ul className="mt-14 grid gap-5 sm:mt-16 md:grid-cols-2">
      {solutions.map((s, i) => (
        <Reveal as="li" key={s.slug} index={i % 2}>
          <Link
            to={`/solutions/${s.slug}`}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-brand hover:-translate-y-0.5 hover:border-accent hover:shadow-raised focus-visible:border-accent"
          >
            <Photo
              image={s.image}
              ratio="16 / 9"
              className="rounded-none border-0"
              imgClassName="group-hover:scale-[1.04]"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
            <div className="flex flex-1 flex-col border-t border-line p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <IconTile icon={s.icon} size="sm" className="group-hover:bg-accent group-hover:text-accent-ink" />
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">For {lowerFirst(s.shortName)}</span>
              </div>
              <h2 className="mt-5 font-display text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-balance text-ink sm:text-2xl">{s.tagline}</h2>
              <ul className="mt-5 space-y-2.5">
                {s.outcomes.slice(0, 2).map((o) => (
                  <li key={o} className="flex gap-2.5 text-[14px] leading-snug text-ink-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
                    {o}
                  </li>
                ))}
              </ul>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-7 text-[15px] font-medium text-accent-text">
                See how Ascentra helps
                <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
              </span>
            </div>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}

function CapabilityMatrix() {
  return (
    <Section tone="surface" bordered>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="One platform"
          title="Four starting points, the same weekly loop."
          lead="Every team gets all ten capabilities. These are the ones each team tends to lean on first."
        />
        <Reveal>
          <ArrowLink to="/platform">Explore the platform</ArrowLink>
        </Reveal>
      </div>
      <ul className="mt-12 divide-y divide-line border-y border-line">
        {solutions.map((s, i) => {
          const used = s.helps.map((h) => featureBySlug(h.feature)).filter((f): f is Feature => !!f);
          return (
            <Reveal as="li" key={s.slug} index={i} className="grid grid-cols-1 gap-4 py-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:items-center md:gap-8">
              <Link to={`/solutions/${s.slug}`} className="group flex items-center gap-3">
                <IconTile icon={s.icon} size="sm" className="group-hover:bg-accent group-hover:text-accent-ink" />
                <span className="text-[15px] font-medium text-ink transition-colors duration-150 ease-brand group-hover:text-accent-text">{s.shortName}</span>
              </Link>
              <ul className="flex flex-wrap gap-2">
                {used.map((f) => (
                  <li key={f.slug}>
                    <Link
                      to={`/platform/${f.slug}`}
                      className="group inline-flex h-9 items-center gap-2 rounded-full border border-line bg-page pl-1.5 pr-3.5 text-[13px] font-medium text-ink-2 transition-[border-color,color,background-color] duration-150 ease-brand hover:border-accent hover:bg-surface hover:text-ink"
                    >
                      <IconTile icon={f.icon} size="sm" className="size-6 group-hover:bg-accent group-hover:text-accent-ink [&_svg]:size-3.5" />
                      {f.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}

export default function SolutionsPage() {
  useSeo({
    title: 'Solutions',
    description: 'Ascentra for agencies, in-house marketing teams, B2B and SaaS companies, and local and multi-location businesses — one weekly SEO loop, shaped to how each team works.',
    path: '/solutions',
  });
  return (
    <>
      <Section tone="page" spacing="md" className="relative isolate overflow-hidden pt-12 sm:pt-16 lg:pt-20">
        <span
          aria-hidden
          className="mk-watermark pointer-events-none absolute -right-48 -top-10 -z-10 aspect-[911/797] w-[420px] bg-ink/[0.035] sm:-right-32 sm:w-[560px] lg:-right-24 lg:w-[680px]"
        />
        <SectionHeading
          as="h1"
          size="lg"
          eyebrow="Solutions"
          title="Built for the teams that own organic growth."
          lead="Agencies running many clients, marketing teams without a full SEO function, B2B companies and businesses with many locations. One platform, shaped to how each team works."
        />
        <SolutionCards />
      </Section>
      <CapabilityMatrix />
      <CtaBand title="Not sure where you fit?" lead="Tell us how your team works and a person will show you where Ascentra fits. Or start free and connect your first website." />
    </>
  );
}
