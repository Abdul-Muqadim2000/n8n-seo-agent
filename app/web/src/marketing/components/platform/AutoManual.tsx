import { FastForward, UserCheck, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOn } from './kit';

type Row = { label: string; note: string; kind?: 'skip' | 'wait' };
const AUTO: Row[] = [
  { label: 'Planned', note: 'Picked by the Monday cadence' },
  { label: 'No stop', note: 'Runs on schedule', kind: 'skip' },
  { label: 'Written', note: 'Draft, critique and edit' },
  { label: 'Checked', note: 'SEO QA on every page' },
  { label: 'Ready to publish', note: 'Package or WordPress draft' },
];
const MANUAL: Row[] = [
  { label: 'Planned', note: 'Picked by the Monday cadence' },
  { label: 'Needs you', note: 'Waits until someone approves', kind: 'wait' },
  { label: 'Written', note: 'Draft, critique and edit' },
  { label: 'Checked', note: 'SEO QA on every page' },
  { label: 'Ready to publish', note: 'Package or WordPress draft' },
];

function Lane({ title, body, icon: Icon, rows, mode }: { title: string; body: string; icon: LucideIcon; rows: Row[]; mode: 'auto' | 'manual' }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg', mode === 'auto' ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-accent-text')}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="font-display text-base font-semibold text-ink">{title}</span>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-ink-2 sm:min-h-[3.5rem]">{body}</p>
      {/* the lane: five equal rows on a rail; the travelling dot sits on the rail (positions in platform.css: 10/30/50/70/90%) */}
      <div className="relative mt-4">
        <span aria-hidden className="absolute bottom-[10%] left-[7px] top-[10%] w-px bg-line-strong" />
        <span aria-hidden className={cn('pf-dot absolute left-[7px] z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-card', `pf-dot-${mode}`)} />
        <ol className="relative">
          {rows.map((r) => (
            <li key={r.label} className="flex h-[62px] items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  'relative z-[1] size-[15px] shrink-0 rounded-full border-2 bg-surface',
                  r.kind === 'skip' ? 'border-dashed border-line-strong' : r.kind === 'wait' ? 'border-accent' : 'border-line-strong',
                )}
              />
              <span
                className={cn(
                  'min-w-0 flex-1 rounded-lg border px-3 py-2',
                  r.kind === 'wait' ? 'pf-wait border-accent bg-accent-soft' : r.kind === 'skip' ? 'border-dashed border-line-strong' : 'border-line bg-page',
                )}
              >
                <span className={cn('flex items-center gap-1.5 truncate text-[13px] font-medium', r.kind === 'skip' ? 'text-ink-3' : r.kind === 'wait' ? 'text-accent-text' : 'text-ink')}>
                  {r.kind === 'wait' && <UserCheck className="size-3.5 shrink-0" aria-hidden />}
                  {r.kind === 'skip' && <FastForward className="size-3.5 shrink-0" aria-hidden />}
                  {r.label}
                </span>
                <span className="block truncate text-[11.5px] text-ink-3">{r.note}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Auto vs Manual side by side: the same five steps, with a dot that flows straight through on Auto and waits for approval on Manual. */
export function AutoManualLanes({ className }: { className?: string }) {
  const [ref, on] = useOn<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={cn('rounded-2xl border border-line bg-surface p-5 shadow-raised sm:p-7', on && 'is-on', className)}>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6">
        <Lane mode="auto" icon={Zap} title="Auto" body="The step runs on schedule. Every page still shows in the pipeline." rows={AUTO} />
        <Lane mode="manual" icon={UserCheck} title="Manual" body="The step waits in “Needs you” until someone approves it." rows={MANUAL} />
      </div>
    </div>
  );
}
