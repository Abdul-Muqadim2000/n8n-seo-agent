import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

// sample ledger rows; `.example` domains are reserved for examples
const ROWS: { site: string; sources: string[]; status: { tone: 'good' | 'warning' | 'accent' | 'neutral'; label: string }; note: string; value: string }[] = [
  { site: 'industry-review.example', sources: ['Index', 'Bing', 'CC'], status: { tone: 'good', label: 'Live' }, note: 'followed · in content', value: 'High' },
  { site: 'partner-blog.example', sources: ['GSC', 'GA4'], status: { tone: 'good', label: 'Live' }, note: 'followed · 41 visits', value: 'Medium' },
  { site: 'trade-journal.example', sources: ['News', 'Web'], status: { tone: 'accent', label: 'New' }, note: 'found this week', value: 'Medium' },
  { site: 'dev-forum.example', sources: ['HN', 'CC'], status: { tone: 'neutral', label: 'Live' }, note: 'nofollow · referral', value: 'Referral' },
  { site: 'tools-directory.example', sources: ['Index'], status: { tone: 'warning', label: 'Lost' }, note: 'removed from page · 2 misses', value: 'Low' },
];

/** The backlink ledger: one row per referring site with the sources that reported it, Ascentra's own check result and its value (sample data). */
export function BacklinkLedgerMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="A backlink ledger with sample data: five referring sites, the sources that reported each link, whether Ascentra found it live, new or lost after two misses, and its value."
      className={cn('rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent-text">
            <Link2 className="size-3.5" />
          </span>
          <span>
            <span className="block text-[13px] font-semibold">Link ledger</span>
            <span className="block text-[11px] text-ink-3">9 sources · checked by Ascentra</span>
          </span>
        </span>
        <span className="flex gap-4 font-mono text-[11px] tabular text-ink-3">
          <span>
            <span className="font-medium text-ink">412</span> live
          </span>
          <span>
            <span className="font-medium text-ink">9</span> new
          </span>
          <span>
            <span className="font-medium text-ink">3</span> lost
          </span>
        </span>
      </div>
      <div className="mt-5 hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_64px] gap-3 border-b border-line pb-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 sm:grid">
        <span>Referring site</span>
        <span>Reported by</span>
        <span>Our check</span>
        <span className="text-right">Value</span>
      </div>
      <ul className="mt-3 divide-y divide-line sm:mt-0">
        {ROWS.map((r, i) => (
          <li
            key={r.site}
            className="mk-pop grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_64px] sm:items-center"
            style={{ ['--mk-i' as string]: i * 2 }}
          >
            <span className="truncate text-[12.5px] font-medium">{r.site}</span>
            <span className="order-last col-span-2 flex flex-wrap gap-1 sm:order-none sm:col-span-1">
              {r.sources.map((s) => (
                <span key={s} className="rounded border border-line bg-page px-1.5 py-px font-mono text-[10px] text-ink-2">
                  {s}
                </span>
              ))}
            </span>
            <span className="flex min-w-0 items-center gap-2 justify-self-end sm:justify-self-start">
              <MockBadge tone={r.status.tone}>{r.status.label}</MockBadge>
              <span className="hidden truncate text-[11px] text-ink-3 sm:inline">{r.note}</span>
            </span>
            <span className="hidden text-right font-mono text-[11px] text-ink-2 sm:block">{r.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
        <span>A link counts as lost only after two misses</span>
        <span className="font-mono">Sample data</span>
      </p>
    </Drawn>
  );
}
