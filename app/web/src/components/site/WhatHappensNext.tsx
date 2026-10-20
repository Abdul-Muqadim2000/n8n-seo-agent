// "What happens next": the website's next real dates in one compact line (today's first checks, the Coming up plan, the weekly run,
// the monthly checks), each step opening the guide that explains it. The steps come from lib/next-steps.ts; this is only the drawing.
import { useId, type ReactNode } from 'react';
import { ChevronRight, Route } from 'lucide-react';
import type { GuideVars } from '@seo/shared/guides';
import { useGuides } from '@/components/guide';
import { nextStepsText, type NextStep } from '@/lib/next-steps';
import { cn } from '@/lib/utils';

export function WhatHappensNext({ steps, vars, action, className, title = 'What happens next' }: { steps: NextStep[]; vars?: GuideVars; action?: ReactNode; className?: string; title?: string }) {
  const { open } = useGuides();
  const id = useId();
  if (!steps.length) return null;
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-xl border border-line bg-surface px-4 py-3 shadow-card', className)} data-testid="what-happens-next">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 font-display text-[14px] font-semibold tracking-[-0.01em] text-ink">
          <Route className="size-4 text-accent-text" aria-hidden />
          {title}
        </h2>
        {action}
      </div>
      <p className="sr-only">{nextStepsText(steps)}</p>
      <ol className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-0.5 sm:gap-y-1">
        {steps.map((s, i) => (
          <li key={s.key} className="flex min-w-0 items-center">
            {i > 0 && <ChevronRight className="mx-0.5 hidden size-3.5 shrink-0 text-ink-3 sm:block" aria-hidden />}
            <button
              type="button"
              onClick={() => open({ id: s.guide, vars })}
              aria-label={`${s.when}: ${s.text}. How this works`}
              className="group flex min-h-9 min-w-0 max-w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug transition-colors duration-150 ease-brand hover:bg-accent-soft active:bg-accent-soft/70"
            >
              <span className="shrink-0 whitespace-nowrap font-mono text-xs font-medium text-accent-text">{s.when}</span>
              <span className="min-w-0 break-words text-ink-2 underline-offset-2 group-hover:text-ink group-hover:underline">{s.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
