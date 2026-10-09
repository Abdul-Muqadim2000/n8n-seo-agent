import { ChartLine, Lightbulb, ListChecks, PenLine, Search, Send, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSectionTone } from '../Section';

export const LOOP_STEPS: { label: string; icon: LucideIcon; body: string }[] = [
  { label: 'Research', icon: Search, body: 'Keywords, competitors, trends and the questions buyers ask AI assistants.' },
  { label: 'Plan', icon: ListChecks, body: 'Ladders and weekly posts in priority order, with a verdict for every keyword.' },
  { label: 'Write', icon: PenLine, body: 'Pages written, critiqued and edited, with SEO QA and expertise built in.' },
  { label: 'Publish', icon: Send, body: 'A ready package or a WordPress draft; Ascentra checks the live page.' },
  { label: 'Track', icon: ChartLine, body: 'Rankings, traffic, AI answers and links, every week.' },
  { label: 'Learn', icon: Lightbulb, body: 'What worked feeds the next plan, and what needs you lands in one queue.' },
];

const R = 38; // ring radius in % of the box

/** The weekly growth loop: Research → Plan → Write → Publish → Track → Learn on a ring, with a pulse travelling round and each step lighting up as it passes. */
export function GrowthLoopDiagram({ className, centerTitle = 'Every week', centerBody = 'Each loop starts from what the last one learned.' }: { className?: string; centerTitle?: string; centerBody?: string }) {
  const ink = useSectionTone() === 'ink';
  return (
    <div className={cn('relative mx-auto aspect-square w-full max-w-[540px]', className)} role="img" aria-label={`A loop of six steps that repeats every week: ${LOOP_STEPS.map((s) => s.label).join(', ')}.`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" fill="none" aria-hidden>
        <circle cx={50} cy={50} r={R} strokeWidth={0.35} className={ink ? 'stroke-line-on-ink' : 'stroke-line-strong'} />
        <circle cx={50} cy={50} r={R - 9} strokeWidth={0.25} strokeDasharray="0.6 1.4" className={ink ? 'stroke-line-on-ink' : 'stroke-line'} />
        {/* the pulse: starts at the top (Research) and runs clockwise */}
        <path
          d={`M50 ${50 - R} A${R} ${R} 0 1 1 50 ${50 + R} A${R} ${R} 0 1 1 50 ${50 - R}`}
          pathLength={100}
          strokeWidth={1.1}
          strokeLinecap="round"
          className={cn('mk-comet', ink ? 'stroke-accent-on-ink' : 'stroke-accent')}
        />
      </svg>
      <div className="absolute inset-[24%] flex flex-col items-center justify-center text-center" aria-hidden>
        <span className={cn('font-mono text-[10px] uppercase tracking-[0.16em] sm:text-[11px]', ink ? 'text-accent-on-ink' : 'text-accent-text')}>Ascentra</span>
        <span className={cn('mt-1 font-display text-lg font-semibold tracking-[-0.01em] sm:text-2xl', ink ? 'text-on-ink' : 'text-ink')}>{centerTitle}</span>
        <span className={cn('mt-1.5 hidden max-w-[22ch] text-[13px] leading-snug sm:block', ink ? 'text-on-ink-2' : 'text-ink-2')}>{centerBody}</span>
      </div>
      {LOOP_STEPS.map((s, i) => {
        const a = ((-90 + i * 60) * Math.PI) / 180;
        const x = 50 + R * Math.cos(a);
        const y = 50 + R * Math.sin(a);
        const Icon = s.icon;
        return (
          <div key={s.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden>
            <span
              className={cn(
                'mk-node-ring inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-xs font-medium sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm',
                ink ? 'border-line-on-ink bg-ink-surface text-on-ink' : 'border-line bg-surface text-ink shadow-card',
              )}
              style={{ ['--mk-i' as string]: i }}
            >
              <Icon className={cn('size-3.5 sm:size-4', ink ? 'text-accent-on-ink' : 'text-accent-text')} />
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
