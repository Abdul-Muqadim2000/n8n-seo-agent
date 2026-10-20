import { Activity, CalendarCheck, ChartLine, ChartNoAxesColumnIncreasing, Eye, Handshake, Info, Link2, PenLine, Rocket, ScanSearch, Sparkles, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { useSectionTone } from '../Section';
import { useOn } from './kit';

interface Run {
  /** the day of the website's week (first line of the card) */
  when: string;
  /** where in that day it runs (second line of the card) */
  at: string;
  /** the short label on the week grid, when `at` is too long for it */
  chip?: string;
  title: string;
  body: string;
  icon: LucideIcon;
  to: string;
}

// The real schedule behind every website: a 7-day cycle of its own. Day 1 is the day setup was finished (the first checks start
// then); every 7 days after that, on the same weekday at 06:00 in the website's time zone, the jobs run one after the other in
// this order (app/shared/src/cycles.ts CYCLE_JOBS). "Coming up" is made two days before each cycle.
const WATCH: Run = {
  when: 'Every day',
  at: 'Each morning',
  chip: 'Every day',
  title: 'Key-page check',
  body: 'Your most important pages and robots.txt, compared with yesterday. A page that disappears, turns noindex or starts redirecting is an alert the same day.',
  icon: Eye,
  to: '/platform/technical-audits',
};
const PULSE: Run = {
  when: 'Days 2 to 7',
  at: 'Not on your weekday',
  chip: 'Days 2 to 7',
  title: 'AI Pulse',
  body: 'The question panel on ChatGPT, Gemini and Google AI Mode. Alerts only when a change is statistically real.',
  icon: Activity,
  to: '/platform/ai-visibility',
};
const DAY1 = 'Your weekday';
const CYCLE: Run[] = [
  { when: DAY1, at: 'Step 1 · from 06:00', title: 'AI visibility', body: 'The full question panel across the AI engines, with share of voice against your competitors.', icon: Sparkles, to: '/platform/ai-visibility' },
  { when: DAY1, at: 'Step 2', title: 'Backlinks', body: 'The weekly link watch: new links, spam and links lost after two misses, with the reason.', icon: Link2, to: '/platform/backlinks' },
  { when: DAY1, at: 'Step 3', title: 'Rank tracking', body: 'Every ladder page, head term and keyword you track, checked for its position and the whole results page.', icon: ChartNoAxesColumnIncreasing, to: '/platform/keyword-ladders' },
  { when: DAY1, at: 'Step 4', title: 'Weekly report', body: 'Search Console, GA4, Google Trends and live checks, newly published pages, then the weekly report.', icon: ChartLine, to: '/platform/site-tracking' },
  { when: DAY1, at: 'Step 5', title: 'AI growth', body: 'New pages sent to Bing and IndexNow, key pages scored for AI readiness, the questions to win suggested.', icon: Rocket, to: '/platform/ai-growth' },
  { when: DAY1, at: 'Step 6', title: 'Pages for your keywords', body: 'The next pages of the keywords you chose, written and checked. Anything else is written only at the level you picked and after it appeared in "Coming up".', icon: PenLine, to: '/platform/autopilot' },
  { when: DAY1, at: 'Step 7', title: 'Link building', body: 'New openings checked, contacts found and pitches drafted for your approval.', icon: Handshake, to: '/platform/link-building' },
];
const PREVIEW: Run = {
  when: 'Day 6',
  at: '2 days before your weekday',
  chip: '2 days ahead',
  title: 'Coming up',
  body: 'The plan for the next cycle: every page that will be written, why and its credits, with Skip or Approve. In the app and by e-mail.',
  icon: CalendarCheck,
  to: '/platform/autopilot',
};
const AUDIT: Run = {
  when: 'Once a month',
  at: 'Last step of the monthly cycle',
  title: 'Technical audit',
  body: 'Skipped when the sitemap has not changed, with a full audit at least every 60 days.',
  icon: ScanSearch,
  to: '/platform/technical-audits',
};

const DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
/** the day "Coming up" is made: two days before the next Day 1 */
const PREVIEW_DAY = 5;
/** slots in a day column: the key-page check, then the cycle's steps */
const SLOTS = 1 + CYCLE.length;
const SWEEP_S = 9; // seconds for the cursor to cross a day from top to bottom (matches platform.css)
/** what runs on a day of the website's week */
const dayRuns = (day: number): Run[] => (day === 0 ? [WATCH, ...CYCLE] : day === PREVIEW_DAY ? [WATCH, PULSE, PREVIEW] : [WATCH, PULSE]);
const pct = (slot: number) => (slot / SLOTS) * 100;

/** "Your week": the automatic runs on a Day 1 to Day 7 grid, where Day 1 is the day you finished setup and then the weekday it fell
 *  on. A cursor sweeps down each day and lights every run as it passes; the monthly audit underneath; every run described in a list
 *  (the only view on phones, with a compact week strip). */
export function WeekSchedule({ className }: { className?: string }) {
  const ink = useSectionTone() === 'ink';
  const [ref, on] = useOn<HTMLDivElement>(0.2);
  const line = ink ? 'border-line-on-ink' : 'border-line';
  const muted = ink ? 'text-on-ink-2' : 'text-ink-3';
  const runBlock = (r: Run, slot: number, soft: boolean) => (
    <div key={`${r.title}-${slot}`} className="absolute inset-x-1 py-[3px]" style={{ top: `${pct(slot)}%`, height: `${100 / SLOTS}%` }}>
      <div
        className={cn(
          'pf-pop pf-hit flex h-full min-w-0 items-center gap-2 rounded-md border px-2.5',
          soft
            ? ink
              ? 'border-accent-on-ink/40 bg-accent/25 text-on-ink'
              : 'border-accent/25 bg-accent-soft text-ink'
            : ink
              ? 'border-line-on-ink bg-on-ink/[0.07] text-on-ink'
              : 'border-line bg-surface text-ink shadow-card',
        )}
        style={{ ['--pf-i' as string]: slot, ['--pf-d' as string]: `${(slot / SLOTS) * SWEEP_S}s` }}
      >
        <r.icon className={cn('size-3.5 shrink-0', ink ? 'text-accent-on-ink' : 'text-accent-text')} />
        <span className="min-w-0">
          <span className={cn('block truncate font-mono text-[10px] leading-none tabular', muted)}>{r.chip ?? r.at}</span>
          <span className="mt-1 block truncate text-[12px] font-medium leading-none">{r.title}</span>
        </span>
      </div>
    </div>
  );

  const all: Run[] = [...CYCLE, AUDIT, PREVIEW, WATCH, PULSE];
  return (
    <div ref={ref} className={cn(on && 'is-on', className)} style={{ ['--pf-ring' as string]: ink ? 'var(--accent-on-ink)' : 'var(--accent)' }}>
      {/* wide screens: the week grid (decorative; the list below carries the same information) */}
      <div aria-hidden className={cn('hidden rounded-2xl border p-5 lg:block xl:p-6', line, ink ? 'bg-on-ink/[0.03]' : 'bg-surface shadow-card')}>
        <div className="grid grid-cols-7">
          {DAYS.map((d, i) => (
            <span key={d} className="flex flex-col gap-0.5 px-2 pb-3">
              <span className="flex items-center justify-between gap-2">
                <span className={cn('text-[13px] font-semibold', i === 0 ? (ink ? 'text-on-ink' : 'text-ink') : muted)}>{d}</span>
                <span className={cn('font-mono text-[10px]', muted)}>{dayRuns(i).length} runs</span>
              </span>
              <span className={cn('font-mono text-[10px]', i === 0 ? (ink ? 'text-accent-on-ink' : 'text-accent-text') : muted)}>
                {i === 0 ? DAY1 : i === PREVIEW_DAY ? 'Coming up' : ' '}
              </span>
            </span>
          ))}
        </div>
        <div className="relative grid h-[528px] grid-cols-7">
          {DAYS.map((d, i) => (
            <div key={d} className={cn('relative border-l', line, i === 0 && (ink ? 'bg-on-ink/[0.04]' : 'bg-accent-soft/40'))}>
              {dayRuns(i).map((r, j) => runBlock(r, j, r === PULSE || r === PREVIEW))}
            </div>
          ))}
          {/* the cursor sweeping down the seven day columns */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="pf-sweep absolute inset-0">
              <span className={cn('absolute inset-x-0 top-0 h-px', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
              <span className={cn('absolute -left-1 -top-1 size-2 rounded-full', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
            </div>
          </div>
        </div>
        <div className={cn('mt-4 flex items-center gap-3 rounded-lg border border-dashed px-4 py-3', line)}>
          <ScanSearch className={cn('size-4 shrink-0', ink ? 'text-accent-on-ink' : 'text-accent-text')} />
          <span className={cn('font-mono text-[11px] tabular', muted)}>Monthly cycle · step 8</span>
          <span className={cn('text-[13px] font-medium', ink ? 'text-on-ink' : 'text-ink')}>Technical audit</span>
          <span className={cn('hidden text-[13px] xl:inline', muted)}>with the full AI visibility run and the full backlink report, once a month</span>
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
            <span className={cn('whitespace-nowrap text-[11px] font-semibold', i === 0 ? (ink ? 'text-on-ink' : 'text-ink') : muted)}>{d}</span>
            <span className="flex flex-col gap-1">
              {dayRuns(i).map((_, j) => (
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
                <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg', ink ? 'bg-on-ink/10 text-accent-on-ink' : 'bg-accent-soft text-accent-text')}>
                  <r.icon className="size-4" aria-hidden />
                </span>
                <span className={cn('text-right font-mono text-[11px] leading-tight tabular', muted)}>
                  {r.when}
                  <br />
                  {r.at}
                </span>
              </span>
              <span className={cn('mt-4 font-display text-[15px] font-semibold', ink ? 'text-on-ink group-hover:text-accent-on-ink' : 'text-ink group-hover:text-accent-text')}>{r.title}</span>
              <span className={cn('mt-1.5 text-[13.5px] leading-relaxed', ink ? 'text-on-ink-2' : 'text-ink-2')}>{r.body}</span>
            </Link>
          </li>
        ))}
        <li className="pf-pop sm:col-span-2 lg:col-span-4" style={{ ['--pf-i' as string]: all.length + 2 }}>
          <div className={cn('flex h-full flex-col rounded-xl border border-dashed p-4 sm:p-5', line)}>
            <Info className={cn('size-4', ink ? 'text-accent-on-ink' : 'text-accent-text')} aria-hidden />
            <p className={cn('mt-4 text-[13.5px] leading-relaxed', ink ? 'text-on-ink-2' : 'text-ink-2')}>
              Your week starts the day you sign up. Day 1 is the day you finish setting up a website: its first checks start then. After that the steps run every 7 days on that same weekday, from 06:00 in your website's time zone, each one starting when the one before it is done. You can move the weekday in the website's settings. Monthly work runs in the first weekly cycle on or after the day of the month the website started. Each website's pipeline page shows every run with its next and last time, the daily AI Pulse can be switched off per website, and a run that was missed (the server was down, say) starts once it is back, with a report that says it ran late.
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
