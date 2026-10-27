import { Link } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { featureBySlug } from '../content/features';
import { searchKindById, searchKinds, type SearchKindId } from '../content/search-kinds';
import { Reveal } from './Reveal';
import { Section, SectionHeading, type SectionTone } from './Section';

/** Small "SEO · AEO · GEO" chips: which kinds of search a capability works on (the full names are in the title). */
export function SearchKindChips({ ids, className }: { ids?: SearchKindId[]; className?: string }) {
  if (!ids?.length) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Works on">
      {ids.map((id) => {
        const k = searchKindById(id);
        return (
          <li
            key={id}
            title={k.name}
            className="inline-flex h-6 items-center rounded-full border border-line bg-surface px-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-accent-text"
          >
            {k.short}
          </li>
        );
      })}
    </ul>
  );
}

/** "SEO, AEO and GEO": the three kinds of search, what each one means in plain words and what Alaventra does for it. */
export function SearchKinds({
  tone = 'surface',
  bordered = true,
  id = 'seo-aeo-geo',
  eyebrow = 'SEO, AEO and GEO',
  title = 'Three places buyers find you. One platform for all of them.',
  lead = 'People find a business in Google\'s results, in the answer Google writes above them, and by asking an AI assistant. Most teams buy a separate tool for each. Alaventra works on all three from the same research, the same pages and the same weekly report.',
}: {
  tone?: SectionTone;
  bordered?: boolean;
  id?: string;
  eyebrow?: string;
  title?: string;
  lead?: string;
}) {
  return (
    <Section tone={tone} bordered={bordered} id={id}>
      <SectionHeading align="center" eyebrow={eyebrow} title={title} lead={lead} />
      <ol className="mt-14 grid gap-4 lg:grid-cols-3">
        {searchKinds.map((k, i) => (
          <Reveal as="li" key={k.id} index={i} className="flex flex-col rounded-2xl border border-line bg-page p-6 shadow-card sm:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-[2.25rem] font-semibold leading-none tracking-[-0.03em] text-ink">{k.short}</p>
              <span className="font-mono text-[11px] text-ink-3 tabular">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text">{k.name}</h3>
            <p className="mt-4 text-[15px] font-medium leading-relaxed text-ink">{k.where}</p>
            <ul className="mt-5 flex-1 space-y-3 border-t border-line pt-5">
              {k.what.map((w) => (
                <li key={w} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
                  <Check className="mt-1 size-3.5 shrink-0 text-accent-text" strokeWidth={2.75} aria-hidden />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[12.5px] leading-snug text-ink-3">{k.plan}</p>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4">
              {k.features.map((slug) => {
                const f = featureBySlug(slug);
                return f ? (
                  <li key={slug}>
                    <Link
                      to={`/platform/${slug}`}
                      className="mk-tap group inline-flex items-center gap-1 text-[13px] font-medium text-accent-text transition-colors duration-150 ease-brand hover:text-accent-hover"
                    >
                      {f.shortName}
                      <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
