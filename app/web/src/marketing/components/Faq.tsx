import { ChevronDown } from 'lucide-react';
import type { FaqItem } from '../content/features';
import { cn } from '@/lib/utils';
import { useSectionTone } from './Section';

/** Accessible FAQ accordion built on <details>/<summary> (keyboard and screen-reader friendly, works without JS); chevron turns on open.
 *  `schema` also emits FAQPage JSON-LD (a data block, allowed by the CSP). */
export function Faq({ items, className, schema = false }: { items: FaqItem[]; className?: string; schema?: boolean }) {
  const ink = useSectionTone() === 'ink';
  return (
    <>
      <div className={cn('divide-y border-y', ink ? 'divide-line-on-ink border-line-on-ink' : 'divide-line border-line', className)}>
        {items.map((it) => (
          <details key={it.q} className="mk-faq group">
            <summary
              className={cn(
                'flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left text-base font-medium transition-colors duration-200 ease-brand sm:text-[17px] [&::-webkit-details-marker]:hidden',
                ink ? 'text-on-ink hover:text-accent-on-ink' : 'text-ink hover:text-accent-text',
              )}
            >
              <span>{it.q}</span>
              <span
                className={cn(
                  'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-200 ease-brand group-open:rotate-180',
                  ink ? 'border-line-on-ink' : 'border-line group-hover:border-accent',
                )}
                aria-hidden
              >
                <ChevronDown className="size-3.5" />
              </span>
            </summary>
            <div className="mk-faq-body">
              <p className={cn('max-w-3xl pb-6 pr-10 text-[15px] leading-relaxed', ink ? 'text-on-ink-2' : 'text-ink-2')}>{it.a}</p>
            </div>
          </details>
        ))}
      </div>
      {schema && (
        <script
          type="application/ld+json"
          // a JSON data block, not a script: allowed by `script-src 'self'`
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: items.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })),
            }).replace(/</g, '\\u003c'),
          }}
        />
      )}
    </>
  );
}
