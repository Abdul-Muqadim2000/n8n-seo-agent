import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { pricingTiers } from '../content/pricing';
import { Reveal } from './Reveal';
import { Container } from './Section';

/** Button classes for a secondary action on an ink band (outline on ink); pass to ButtonLink's className with variant="ghost". */
export const onInkOutline = 'border border-line-on-ink text-on-ink hover:bg-on-ink/10 hover:text-on-ink';

// what removes the risk of saying yes, under the buttons (same promises as the home hero)
const CTA_FACTS = ['Free to set up', 'First site check on day one', 'Cost shown before every run', 'Nothing goes live without your OK'];

/**
 * Closing ink band, the bookend of the home hero: hairline grid, centred headline, primary + secondary CTA, the promises that remove
 * the risk, the entry price, and the brand mark rising from the bottom edge as a faint watermark.
 */
export function CtaBand({
  title = 'Your product is ready. Let’s get it found.',
  lead = 'Connect your website in minutes and get your first site check today. You see the cost of every run before it starts, and nothing goes live without your OK.',
  primary = { label: 'Start free', to: '/signup' },
  secondary = { label: 'Book a demo', to: '/contact?topic=sales' },
  facts = CTA_FACTS,
  className,
  children,
}: {
  title?: ReactNode;
  lead?: ReactNode;
  primary?: { label: string; to: string };
  secondary?: { label: string; to: string } | null;
  /** short promises under the buttons; null hides them */
  facts?: string[] | null;
  className?: string;
  children?: ReactNode;
}) {
  // signed-in visitors (reading the site from the app) get "Open app" instead of a sign-up they do not need
  const signedIn = !!useMe().data;
  const main = signedIn && primary.to.startsWith('/signup') ? { label: 'Open app', to: '/' } : primary;
  const second = signedIn && secondary?.to.startsWith('/signup') ? null : secondary;
  const entry = pricingTiers.find((t) => t.monthly !== undefined);
  return (
    <section className={cn('bg-page pb-20 pt-4 sm:pb-28', className)}>
      <Container size="lg">
        <Reveal className="relative isolate overflow-hidden rounded-3xl bg-ink-surface px-6 pb-32 pt-16 text-center text-on-ink sm:px-12 sm:pb-40 sm:pt-24 lg:pb-44">
          <div aria-hidden className="mk-grid-ink pointer-events-none absolute inset-0 -z-10" />
          {/* the supplied white mark, its hub on the bottom edge so the rays rise behind the text (a mask, faded to 6%) */}
          <span
            aria-hidden
            className="mk-watermark pointer-events-none absolute bottom-0 left-1/2 -z-10 aspect-[911/797] w-[460px] -translate-x-[68.4%] translate-y-[24.3%] bg-on-ink/[0.06] sm:w-[640px] lg:w-[760px]"
          />
          <div className="relative mx-auto max-w-4xl">
            <h2 className="mx-auto max-w-3xl font-display text-[2.25rem] font-semibold leading-[1.06] tracking-[-0.025em] text-balance text-on-ink sm:text-5xl lg:text-[3.5rem]">{title}</h2>
            {lead && <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-on-ink-2 sm:text-lg">{lead}</p>}
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <ButtonLink to={main.to} size="lg" className="group">
                {main.label}
                <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              {second && (
                <ButtonLink to={second.to} size="lg" variant="ghost" className={onInkOutline}>
                  {second.label}
                </ButtonLink>
              )}
            </div>
            {facts && facts.length > 0 && (
              <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-on-ink-2">
                {facts.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-3.5 text-accent-on-ink" strokeWidth={2.5} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {entry && !signedIn && (
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-on-ink-2">
                Plans from {entry.price} {entry.period}
              </p>
            )}
            {children}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
