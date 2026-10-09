import { Activity, ChartLine, ChartNoAxesColumnIncreasing, Info, Link2, PenLine, ScanSearch, Sparkles, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { useSectionTone } from '../Section';
import { useOn } from './kit';

interface Run {
  time: string;
  when: string;
  title: string;
  body: string;
  icon: LucideIcon;
  to: string;
}

// The real default schedule (the automatic runs behind every website).
const PULSE: Run = {
  time: '06:30',
  when: 'Tuesday to Sunday',
  title: 'AI Pulse',
  body: 'The question panel on ChatGPT, Gemini and Google AI Mode. Alerts only when a change is statistically real.',
  icon: Activity,
  to: '/platform/ai-visibility',
};
const MONDAY: Run[] = [
  { time: '07:00', when: 'Monday', title: 'AI visibility', body: 'The full question panel across the AI engines, with share of voice against your competitors.', icon: Sparkles, to: '/platform/ai-visibility' },
  { time: '07:30', when: 'Monday', title: 'Backlinks', body: 'The weekly link watch: new links, spam and links lost after two misses, with the reason.', icon: Link2, to: '/platform/backlinks' },
  { time: '08:00', when: 'Monday', title: 'Rank tracking', body: 'Every ladder page and head term, checked for its position.', icon: ChartNoAxesColumnIncreasing, to: '/platform/keyword-ladders' },
  { time: '09:00', when: 'Monday', title: 'Site tracking', body: 'Search Console, GA4, Google Trends and live checks, newly published pages, then the Monday report.', icon: ChartLine, to: '/platform/site-tracking' },
  { time: '10:00', when: 'Monday', title: 'Content cadence', body: 'This week’s posts, picked and written: ladder rung first, then striking distance, then rising trends.', icon: PenLine, to: '/platform/autopilot' },
];
const AUDIT: Run = {
  time: '06:00',
  when: '1st of the month',
  title: 'Technical audit',
  body: 'Skipped when the sitemap has not changed, with a full audit at least every 60 days.',
  icon: ScanSearch,
  to: '/platform/technical-audits',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const START = 6 * 60; // 06:00
const END = 10 * 60 + 30; // 10:30
const SPAN = END - START;
const SWEEP_S = 9; // seconds for the cursor to cross 06:00 → 10:30 (matches platform.css)
const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00'];
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const pct = (t: string) => ((mins(t) - START) / SPAN) * 100;

/** "A week with Ascentra": the automatic runs on a Mon–Sun grid of 06:00–10:30, a time cursor sweeping down and lighting each run
 *  as it passes; the monthly audit underneath; every run described in a list (the only view on phones, with a compact week strip). */
export function WeekSchedule({ className }: { className?: string }) {
  const ink = useSectionTone() === 'ink';
  const [ref, on] = useOn<HTMLDivElement>(0.2);
  const line = ink ? 'border-line-on-ink' : 'border-line';
  const muted = ink ? 'text-on-ink-2' : 'text-ink-3';
  const runBlock = (r: Run, i: number, pulse: boolean) => (
    <div
      key={`${r.title}-${i}`}
      className="absolute inset-x-1 py-[3px]"
      style={{ top: `${pct(r.time)}%`, height: `${(30 / SPAN) * 100}%` }}
    >
      <div
        className={cn(
          'pf-pop pf-hit flex h-full min-w-0 items-center gap-2 rounded-md border px-2.5',
          pulse
            ? ink
              ? 'border-accent-on-ink/40 bg-accent/25 text-on-ink'
              : 'border-accent/25 bg-accent-soft text-ink'
            : ink
              ? 'border-line-on-ink bg-on-ink/[0.07] text-on-ink'
              : 'border-line bg-surface text-ink shadow-card',
        )}
        style={{ ['--pf-i' as string]: i, ['--pf-d' as string]: `${((mins(r.time) - START) / SPAN) * SWEEP_S}s` }}
      >
        <r.icon className={cn('size-3.5 shrink-0', ink ? 'text-accent-on-ink' : 'text-accent-text')} />
        <span className="min-w-0">
          <span className={cn('block font-mono text-[10px] leading-none tabular', muted)}>{r.time}</span>
          <span className="mt-1 block truncate text-[12px] font-medium leading-none">{r.title}</span>
        </span>
      </div>
    </div>
  );

  const all: Run[] = [PULSE, ...MONDAY, AUDIT];
  return (
    <div ref={ref} className={cn(on && 'is-on', className)} style={{ ['--pf-ring' as string]: ink ? 'var(--accent-on-ink)' : 'var(--accent)' }}>
      {/* wide screens: the week grid (decorative; the list below carries the same information) */}
      <div aria-hidden className={cn('hidden rounded-2xl border p-5 lg:block xl:p-6', line, ink ? 'bg-on-ink/[0.03]' : 'bg-surface shadow-card')}>
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
          <span />
          {DAYS.map((d, i) => (
            <span key={d} className="flex items-center justify-between gap-2 px-2 pb-3">
              <span className={cn('text-[13px] font-semibold', i === 0 ? (ink ? 'text-on-ink' : 'text-ink') : muted)}>{d}</span>
              <span className={cn('font-mono text-[10px]', muted)}>{i === 0 ? '5 runs' : '1 run'}</span>
            </span>
          ))}
        </div>
        <div className="relative grid h-[396px] grid-cols-[52px_repeat(7,minmax(0,1fr))]">
          {/* hour lines and labels */}
          {HOURS.map((h) => (
            <div key={h} className="pointer-events-none absolute inset-x-0 flex items-start" style={{ top: `${pct(h)}%` }}>
              <span className={cn('-mt-[7px] w-[52px] shrink-0 font-mono text-[10.5px] tabular', muted)}>{h}</span>
              <span className={cn('flex-1 border-t border-dashed', line)} />
            </div>
          ))}
          <span />
          {DAYS.map((d, i) => (
            <div key={d} className={cn('relative border-l', line, i === 0 && (ink ? 'bg-on-ink/[0.04]' : 'bg-accent-soft/40'))}>
              {i === 0 ? MONDAY.map((r, j) => runBlock(r, j + 1, false)) : runBlock(PULSE, i, true)}
            </div>
          ))}
          {/* the time-of-day cursor sweeping over the seven day columns */}
          <div className="pointer-events-none absolute inset-y-0 left-[52px] right-0 overflow-hidden">
            <div className="pf-sweep absolute inset-0">
              <span className={cn('absolute inset-x-0 top-0 h-px', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
              <span className={cn('absolute -left-1 -top-1 size-2 rounded-full', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
            </div>
          </div>
        </div>
        <div className={cn('mt-4 flex items-center gap-3 rounded-lg border border-dashed px-4 py-3', line)}>
          <ScanSearch className={cn('size-4 shrink-0', ink ? 'text-accent-on-ink' : 'text-accent-text')} />
          <span className={cn('font-mono text-[11px] tabular', muted)}>1st of the month · 06:00</span>
          <span className={cn('text-[13px] font-medium', ink ? 'text-on-ink' : 'text-ink')}>Technical audit</span>
          <span className={cn('hidden text-[13px] xl:inline', muted)}>— skipped when nothing on the site has changed</span>
        </div>
      </div>

      {/* phones and tablets: a compact week strip */}
      <ol aria-hidden className="grid grid-cols-7 gap-1.5 lg:hidden">
        {DAYS.map((d, i) => (
          <li
            key={d}
            className={cn(
              'pf-pop flex flex-col items-center gap-2 rounded-lg border py-2.5',
              line,
              i === 0 ? (ink ? 'bg-on-ink/[0.08]' : 'bg-accent-soft') : ink ? 'bg-on-ink/[0.03]' : 'bg-surface',
            )}
            style={{ ['--pf-i' as string]: i }}
          >
            <span className={cn('text-[12px] font-semibold', i === 0 ? (ink ? 'text-on-ink' : 'text-ink') : muted)}>{d}</span>
            <span className="flex flex-col gap-1">
              {Array.from({ length: i === 0 ? 5 : 1 }).map((_, j) => (
                <span key={j} className={cn('size-1.5 rounded-full', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
              ))}
            </span>
          </li>
        ))}
      </ol>

      {/* every run, described */}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:mt-8 lg:grid-cols-4">
        {all.map((r, i) => (
          <li key={r.title} className="pf-pop" style={{ ['--pf-i' as string]: i + 2 }}>
            <Link
              to={r.to}
              className={cn(
                'group flex h-full flex-col rounded-xl border p-4 transition-[border-color,background-color] duration-200 ease-brand sm:p-5',
                ink ? 'border-line-on-ink hover:border-accent-on-ink hover:bg-on-ink/[0.04]' : 'border-line bg-surface hover:border-accent',
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className={cn('inline-flex size-8 items-center justify-center rounded-lg', ink ? 'bg-on-ink/10 text-accent-on-ink' : 'bg-accent-soft text-accent-text')}>
                  <r.icon className="size-4" aria-hidden />
                </span>
                <span className={cn('text-right font-mono text-[11px] leading-tight tabular', muted)}>
                  {r.when}
                  <br />
                  {r.time}
                </span>
              </span>
              <span className={cn('mt-4 font-display text-[15px] font-semibold', ink ? 'text-on-ink group-hover:text-accent-on-ink' : 'text-ink group-hover:text-accent-text')}>{r.title}</span>
              <span className={cn('mt-1.5 text-[13.5px] leading-relaxed', ink ? 'text-on-ink-2' : 'text-ink-2')}>{r.body}</span>
            </Link>
          </li>
        ))}
        <li className="pf-pop" style={{ ['--pf-i' as string]: all.length + 2 }}>
          <div className={cn('flex h-full flex-col rounded-xl border border-dashed p-4 sm:p-5', line)}>
            <Info className={cn('size-4', ink ? 'text-accent-on-ink' : 'text-accent-text')} aria-hidden />
            <p className={cn('mt-4 text-[13.5px] leading-relaxed', ink ? 'text-on-ink-2' : 'text-ink-2')}>
              The default schedule. Each website’s pipeline page shows every run with its next and last time, and the daily AI Pulse can be switched off per website.
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
