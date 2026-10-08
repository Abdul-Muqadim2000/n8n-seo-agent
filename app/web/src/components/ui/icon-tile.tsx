import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Colour of an icon tile: `blue` (brand tint, the default), `solid` (filled brand blue), `ink`, the four status tones, `neutral`. */
export type IconTileTone = 'blue' | 'solid' | 'ink' | 'good' | 'warning' | 'serious' | 'critical' | 'neutral' | 'on-dark';

const TONE: Record<IconTileTone, string> = {
  blue: 'bg-accent-soft text-accent-text',
  solid: 'bg-accent text-accent-ink shadow-card',
  ink: 'bg-ink-surface text-on-ink ring-1 ring-line-on-ink',
  good: 'bg-good-soft text-good-text',
  warning: 'bg-warning-soft text-warning-text',
  serious: 'bg-serious-soft text-serious-text',
  critical: 'bg-critical-soft text-critical-text',
  neutral: 'bg-surface-2 text-ink-2',
  // inside an ink or blue panel (SummaryHero)
  'on-dark': 'bg-on-ink/10 text-on-ink ring-1 ring-line-on-ink',
};

const SIZE = {
  xs: 'size-6 rounded-md [&_svg]:size-3.5',
  sm: 'size-7 rounded-md [&_svg]:size-4',
  md: 'size-9 rounded-lg [&_svg]:size-[18px]',
  lg: 'size-11 rounded-xl [&_svg]:size-5',
} as const;

/** IconTile: a lucide icon on a rounded tinted square — the visual anchor of headers, cards and list rows (decorative, aria-hidden). */
export function IconTile({ children, tone = 'blue', size = 'md', className }: { children: ReactNode; tone?: IconTileTone; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center [&_svg]:shrink-0', TONE[tone], SIZE[size], className)} aria-hidden>
      {children}
    </span>
  );
}
