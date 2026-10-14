import type { ReactNode } from 'react';
import { BookOpen, CircleHelp, LifeBuoy } from 'lucide-react';
import { Tooltip } from '@/components/ui/overlay';
import { cn } from '@/lib/utils';
import { useGuides, type OpenGuide } from './GuideProvider';

// "Show me how" — the one trigger used everywhere the app asks a person for something it cannot get itself. Three shapes for three
// places: a chip next to a heading or a callout, a text link inside a field hint, and an icon button where there is no room at all.

export interface GuideButtonProps extends OpenGuide {
  label?: string;
  variant?: 'chip' | 'link' | 'icon';
  className?: string;
  icon?: ReactNode;
}

export function GuideButton({ id, vars, finish, label = 'Show me how', variant = 'chip', className, icon }: GuideButtonProps) {
  const { open } = useGuides();
  const click = () => open({ id, vars, finish });

  if (variant === 'icon')
    return (
      <Tooltip content={label}>
        <button
          type="button"
          onClick={click}
          aria-label={label}
          className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle text-ink-3 transition-colors duration-150 ease-brand hover:bg-accent-soft hover:text-accent-text', className)}
        >
          {icon ?? <CircleHelp className="size-4" aria-hidden />}
        </button>
      </Tooltip>
    );

  if (variant === 'link')
    return (
      <button
        type="button"
        onClick={click}
        className={cn('inline-flex items-center gap-1 text-[13px] font-medium text-accent-text underline-offset-2 transition-colors duration-150 ease-brand hover:underline', className)}
      >
        {icon ?? <BookOpen className="size-3.5 shrink-0" aria-hidden />}
        {label}
      </button>
    );

  return (
    <button
      type="button"
      onClick={click}
      className={cn(
        'group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-accent-text/25 bg-accent-soft px-2.5 text-xs font-medium text-accent-text transition-[background-color,border-color,translate] duration-150 ease-brand hover:-translate-y-px hover:border-accent-text/50 active:translate-y-0',
        className,
      )}
    >
      {icon ?? <BookOpen className="size-3.5 shrink-0" aria-hidden />}
      {label}
    </button>
  );
}

/** Opens the searchable list of every guide (sidebar, onboarding header). */
export function GuideIndexButton({ className, label = 'Guides' }: { className?: string; label?: string }) {
  const { openIndex } = useGuides();
  return (
    <Tooltip content="Guides: how to do everything we ask you for">
      <button
        type="button"
        onClick={openIndex}
        aria-label={label}
        className={cn('inline-flex size-9 items-center justify-center rounded-lg text-ink-3 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink', className)}
      >
        <LifeBuoy className="size-4" aria-hidden />
      </button>
    </Tooltip>
  );
}
