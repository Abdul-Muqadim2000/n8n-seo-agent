import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockDelta } from './parts';

const ENGINES = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'AI Mode', 'AI Overviews'];
const QUESTIONS = [
  'Best invoicing software for small teams',
  'How do I automate invoice approvals?',
  'Invoicing tools that integrate with an ERP',
  'Is cloud invoicing secure for finance teams?',
  'Alternatives to manual accounts payable',
  'E-invoicing rules to prepare for in 2027',
];
// c = named and cited, m = named, - = not named (sample)
const GRID = ['cmc-mc', 'mc-cm-', '-mcm-c', 'c--mc-', 'mcc-m-', '-c-mcm'];

function Cell({ v, i }: { v: string; i: number }) {
  return (
    <span className="flex h-8 items-center justify-center">
      <span
        className={cn(
          'mk-pop-dot block size-3 rounded-full',
          v === 'c' && 'bg-accent',
          v === 'm' && 'border-2 border-accent',
          v === '-' && 'size-1.5 bg-line-strong',
        )}
        style={{ ['--mk-i' as string]: i }}
      />
    </span>
  );
}

/** AI visibility panel: buyer questions × six AI engines with mention / citation dots, plus rates with 95% ranges (sample data). */
export function AiVisibilityMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="AI visibility with sample data: six buyer questions asked to ChatGPT, Gemini, Perplexity, Claude, Google AI Mode and AI Overviews, showing where the brand is named and cited, with mention rate 34%, citation rate 19% and share of voice 22%."
      className={cn('rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent-text">
            <Sparkles className="size-3.5" />
          </span>
          <span>
            <span className="block text-[13px] font-semibold">AI visibility</span>
            <span className="block text-[11px] text-ink-3">20 questions · 6 engines · this week</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2">
          <span className="mk-pulse size-1.5 rounded-full bg-accent" />
          AI Pulse on
        </span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {[
          { l: 'Mention rate', v: '34%', r: '27–41%', d: '6' },
          { l: 'Citation rate', v: '19%', r: '13–26%', d: '3' },
          { l: 'Share of voice', v: '22%', r: '#2 of 5', d: '4' },
        ].map((k, i) => (
          <div key={k.l} className="mk-pop rounded-lg border border-line bg-page p-2.5 sm:p-3" style={{ ['--mk-i' as string]: i }}>
            <span className="block truncate text-[10.5px] text-ink-3 sm:text-[11px]">{k.l}</span>
            <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-lg font-semibold tracking-[-0.01em] sm:text-xl">{k.v}</span>
              <MockDelta value={k.d} suffix=" pts" />
            </span>
            <span className="block font-mono text-[10px] text-ink-3 tabular">{k.r}</span>
          </div>
        ))}
      </div>
      <div className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(6,52px)] items-end gap-x-1 border-b border-line pb-2">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">Buyer question</span>
            {ENGINES.map((e) => (
              <span key={e} className="text-center text-[10px] font-medium leading-tight text-ink-3">
                {e}
              </span>
            ))}
          </div>
          {QUESTIONS.map((q, r) => (
            <div key={q} className="grid grid-cols-[minmax(0,1fr)_repeat(6,52px)] items-center gap-x-1 border-b border-line last:border-b-0">
              <span className="truncate pr-2 text-[12px] text-ink-2">{q}</span>
              {GRID[r].split('').map((v, c) => (
                <Cell key={c} v={v} i={r * 6 + c} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent" /> Named and cited
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-accent" /> Named
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-line-strong" /> Not named
        </span>
        <span className="ml-auto font-mono">Sample data</span>
      </div>
    </Drawn>
  );
}
