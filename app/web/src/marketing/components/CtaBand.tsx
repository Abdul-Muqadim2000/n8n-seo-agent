import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';
import { Container } from './Section';

/** Button classes for a secondary action on an ink band (outline on ink); pass to ButtonLink's className with variant="ghost". */
export const onInkOutline = 'border border-line-on-ink text-on-ink hover:bg-on-ink/10 hover:text-on-ink';

/** Closing ink band: big headline, one line, primary + secondary CTA, with the brand mark as a faint watermark. */
export function CtaBand({
  title = 'Put your SEO on a weekly loop.',
  lead = 'Connect a website in minutes. Ascentra shows the cost of every run before it starts, and nothing is published without your team.',
  primary = { label: 'Start free', to: '/signup' },
  secondary = { label: 'Talk to sales', to: '/contact' },
  className,
  children,
}: {
  title?: ReactNode;
  lead?: ReactNode;
  primary?: { label: string; to: string };
  secondary?: { label: string; to: string } | null;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn('bg-page pb-20 pt-4 sm:pb-28', className)}>
      <Container size="lg">
        <Reveal className="relative overflow-hidden rounded-2xl bg-ink-surface px-6 py-14 text-on-ink sm:px-12 sm:py-20 lg:px-16">
          {/* the brand mark as a faint watermark: the supplied white mark, faded to 7% (as a mask, so no extra compositing layer) */}
          <span
            aria-hidden
            className="mk-watermark pointer-events-none absolute -bottom-8 -right-8 aspect-[911/797] w-[280px] bg-on-ink/[0.07] sm:right-6 sm:w-[340px] lg:-bottom-10 lg:right-14 lg:w-[420px]"
          />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.01em] text-balance text-on-ink sm:text-[2.75rem]">{title}</h2>
            {lead && <p className="mt-5 max-w-xl text-base leading-relaxed text-on-ink-2 sm:text-lg">{lead}</p>}
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink to={primary.to} size="lg" className="group">
                {primary.label}
                <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              {secondary && (
                <ButtonLink to={secondary.to} size="lg" variant="ghost" className={onInkOutline}>
                  {secondary.label}
                </ButtonLink>
              )}
            </div>
            {children}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
