import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

// sample ladder, top (head term) first
const RUNGS: { kw: string; kd: number; status: 'head' | 'planned' | 'writing' | 'published'; pos?: string }[] = [
  { kw: 'invoice automation software', kd: 62, status: 'head', pos: '#24' },
  { kw: 'best invoice automation tools', kd: 41, status: 'planned' },
  { kw: 'invoice software for small teams', kd: 33, status: 'writing' },
  { kw: 'automate accounts payable', kd: 27, status: 'published', pos: '#11' },
  { kw: 'invoice approval workflow', kd: 18, status: 'published', pos: '#6' },
  { kw: 'what is invoice automation', kd: 12, status: 'published', pos: '#3' },
];

const statusBadge = (s: (typeof RUNGS)[number]['status']) =>
  s === 'published' ? (
    <MockBadge tone="good">Published</MockBadge>
  ) : s === 'writing' ? (
    <MockBadge tone="accent">Writing</MockBadge>
  ) : s === 'planned' ? (
    <MockBadge tone="neutral">Planned</MockBadge>
  ) : (
    <MockBadge tone="accent" icon={Flag}>
      Head term
    </MockBadge>
  );

/** A keyword ladder climbing to its head term: rungs as steps with difficulty, status and position, the climb drawn in (sample data). */
export function LadderMockup({ className }: { className?: string }) {
  const n = RUNGS.length;
  const done = RUNGS.filter((r) => r.status === 'published').length;
  return (
    <Drawn
      label="A keyword ladder with sample data: five supporting pages, three published and ranking, climbing to the head term invoice automation software."
      className={cn('rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="block text-[11px] text-ink-3">Keyword ladder · Full plan · Auto</span>
          <span className="mt-0.5 block font-display text-[15px] font-semibold sm:text-base">invoice automation software</span>
        </div>
        <span className="text-right">
          <span className="block font-mono text-lg font-medium tabular">
            {done}/{n - 1}
          </span>
          <span className="block text-[10.5px] text-ink-3">rungs published</span>
        </span>
      </div>
      <div className="relative mt-5">
        {/* the climb: a rail with progress filled from the bottom */}
        <span className="absolute bottom-4 left-[11px] top-4 w-0.5 rounded-full bg-line" aria-hidden />
        <span className="mk-grow-y absolute bottom-4 left-[11px] h-[50%] w-0.5 rounded-full bg-accent" aria-hidden />
        <ol className="relative space-y-2">
          {RUNGS.map((r, i) => {
            const step = n - 1 - i; // 0 = bottom rung
            const head = r.status === 'head';
            return (
              <li key={r.kw} className="mk-pop flex items-center gap-3" style={{ ['--mk-i' as string]: step * 2 }}>
                <span
                  className={cn(
                    'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-surface font-mono text-[10px] font-medium',
                    r.status === 'published' ? 'border-accent bg-accent text-accent-ink' : head ? 'border-accent text-accent-text' : 'border-line-strong text-ink-3',
                  )}
                >
                  {head ? <Flag className="size-3" /> : step + 1}
                </span>
                <span className="min-w-0 flex-1" style={{ marginLeft: `calc(${step} * min(4%, 18px))` }}>
                  <span
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                      head ? 'border-accent bg-accent-soft' : 'border-line bg-page',
                    )}
                  >
                    <span className="min-w-0">
                      <span className={cn('block truncate text-[12.5px]', head ? 'font-semibold text-ink' : 'font-medium text-ink')}>{r.kw}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-ink-3 tabular">difficulty {r.kd}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="hidden sm:inline-flex">{statusBadge(r.status)}</span>
                      {r.pos && <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] font-medium tabular text-ink">{r.pos}</span>}
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
        <span>Positions checked weekly · no overlap with other ladders</span>
        <span className="font-mono">Sample data</span>
      </p>
    </Drawn>
  );
}
