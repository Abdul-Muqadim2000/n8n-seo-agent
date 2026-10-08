import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../Section';

/** Hero for the company pages (pricing, security, about, contact, changelog): eyebrow, H1, lead, actions and an optional visual,
 *  fading up in sequence on load (instant under reduced motion). `watermark` adds the brand mark, faded, behind the text. */
export function PageHero({
  eyebrow,
  title,
  lead,
  actions,
  aside,
  align = 'left',
  watermark = false,
  className,
  containerClassName,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** a visual next to the text (stacks under it below lg) */
  aside?: ReactNode;
  align?: 'left' | 'center';
  watermark?: boolean;
  className?: string;
  /** e.g. a smaller bottom padding when the next band continues the hero */
  containerClassName?: string;
  /** extra content under the actions */
  children?: ReactNode;
}) {
  const center = align === 'center' && !aside;
  const text = (
    <div className={cn('min-w-0', center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl')}>
      <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <div className="animate-fade-up" style={{ animationDelay: '70ms' }}>
        <h1 className="mt-5 font-display text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.02em] text-balance text-ink sm:text-5xl lg:text-[3.75rem]">{title}</h1>
      </div>
      {lead && (
        <div className="animate-fade-up" style={{ animationDelay: '140ms' }}>
          <p className={cn('mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-2 sm:text-xl', center && 'mx-auto')}>{lead}</p>
        </div>
      )}
      {actions && (
        <div className={cn('mt-9 flex flex-wrap gap-3 animate-fade-up', center && 'justify-center')} style={{ animationDelay: '210ms' }}>
          {actions}
        </div>
      )}
      {children && (
        <div className="animate-fade-up" style={{ animationDelay: '280ms' }}>
          {children}
        </div>
      )}
    </div>
  );
  return (
    <section className={cn('relative isolate overflow-hidden bg-page', className)}>
      {watermark && (
        <span
          aria-hidden
          className="mk-watermark pointer-events-none absolute -right-40 -top-6 -z-10 aspect-[911/797] w-[360px] bg-ink/[0.04] sm:-right-20 sm:w-[480px] lg:-right-10 lg:-top-10 lg:w-[620px]"
        />
      )}
      <Container className={cn('pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pt-20', containerClassName)}>
        {aside ? (
          <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            {text}
            <div className="min-w-0 animate-fade-up" style={{ animationDelay: '320ms' }}>
              {aside}
            </div>
          </div>
        ) : (
          text
        )}
      </Container>
    </section>
  );
}

/** Text link with an arrow that nudges on hover (blue on light bands, light blue on ink). Internal paths use the router; mailto / http use <a>. */
export function ArrowLink({ to, children, onInk, className }: { to: string; children: ReactNode; onInk?: boolean; className?: string }) {
  const cls = cn(
    'group inline-flex items-center gap-1.5 text-[15px] font-medium transition-colors duration-150 ease-brand',
    onInk ? 'text-accent-on-ink hover:text-on-ink' : 'text-accent-text hover:text-accent-hover',
    className,
  );
  const inner = (
    <>
      {children}
      <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
    </>
  );
  if (/^(mailto:|https?:)/.test(to)) {
    return (
      <a href={to} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  );
}
