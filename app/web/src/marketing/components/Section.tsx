import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

export type SectionTone = 'page' | 'surface' | 'ink';

const ToneCtx = createContext<SectionTone>('page');
/** the tone of the nearest Section: components switch to on-ink colours inside an ink band */
export const useSectionTone = () => useContext(ToneCtx);

const toneClass: Record<SectionTone, string> = {
  page: 'bg-page text-ink',
  surface: 'bg-surface text-ink',
  ink: 'bg-ink-surface text-on-ink',
};

/** Max-width page container with the side gutters every marketing block uses. */
export function Container({ className, children, size = 'lg' }: { className?: string; children?: ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  return <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', size === 'md' ? 'max-w-4xl' : size === 'xl' ? 'max-w-[1360px]' : 'max-w-7xl', className)}>{children}</div>;
}

/** A full-width band (paper, white or ink) with the standard vertical rhythm and a container; sets the tone for its children. */
export function Section({
  tone = 'page',
  id,
  className,
  containerClassName,
  size = 'lg',
  spacing = 'md',
  bordered,
  children,
  'aria-labelledby': labelledBy,
}: {
  tone?: SectionTone;
  id?: string;
  className?: string;
  containerClassName?: string;
  size?: 'md' | 'lg' | 'xl';
  /** vertical padding: sm 56/72, md 80/112, lg 96/144 */
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  /** hairline on top (light tones only) */
  bordered?: boolean;
  children?: ReactNode;
  'aria-labelledby'?: string;
}) {
  const pad = { none: '', sm: 'py-14 sm:py-[72px]', md: 'py-20 sm:py-28', lg: 'py-24 sm:py-36' }[spacing];
  return (
    <ToneCtx.Provider value={tone}>
      <section id={id} aria-labelledby={labelledBy} className={cn('relative', toneClass[tone], bordered && tone !== 'ink' && 'border-t border-line', pad, className)}>
        <Container size={size} className={containerClassName}>
          {children}
        </Container>
      </section>
    </ToneCtx.Provider>
  );
}

/** Small uppercase label above a heading (mono, tracked). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  const ink = useSectionTone() === 'ink';
  return (
    <p className={cn('inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.14em]', ink ? 'text-accent-on-ink' : 'text-accent-text', className)}>
      <span className={cn('size-1.5 rounded-full', ink ? 'bg-accent-on-ink' : 'bg-accent')} aria-hidden />
      {children}
    </p>
  );
}

/** Eyebrow + H2 + lead, left or centred; colours follow the Section tone. Pass `as="h1"` for a page's main heading. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  as: Tag = 'h2',
  id,
  className,
  size = 'md',
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
  className?: string;
  /** md: section title (32–44px); lg: page title (40–60px) */
  size?: 'md' | 'lg';
  /** extra content under the lead (buttons, links) */
  children?: ReactNode;
}) {
  const ink = useSectionTone() === 'ink';
  return (
    <Reveal className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <Tag
        id={id}
        className={cn(
          'font-display font-semibold text-balance',
          size === 'lg' ? 'text-[2.5rem] leading-[1.08] tracking-[-0.02em] sm:text-5xl lg:text-[3.75rem]' : 'text-[2rem] leading-[1.12] tracking-[-0.01em] sm:text-4xl lg:text-[2.75rem]',
          ink ? 'text-on-ink' : 'text-ink',
        )}
      >
        {title}
      </Tag>
      {lead && (
        <p className={cn('mt-5 text-pretty text-base leading-relaxed sm:text-lg', align === 'center' && 'mx-auto', 'max-w-2xl', ink ? 'text-on-ink-2' : 'text-ink-2')}>{lead}</p>
      )}
      {children && <div className={cn('mt-8 flex flex-wrap gap-3', align === 'center' && 'justify-center')}>{children}</div>}
    </Reveal>
  );
}
