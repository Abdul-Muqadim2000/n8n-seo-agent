import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

/** A keyword check: verdict, reach for your site, topic fit and plan type for one keyword (sample data). */
export function KeywordVerdictMockup({ className }: { className?: string }) {
  const facts = [
    { l: 'Searches / month', v: '1,300' },
    { l: 'Intent', v: 'Commercial' },
    { l: 'Topic fit', v: 'High' },
    { l: 'Plan type', v: 'Short' },
  ];
  return (
    <Drawn
      label="A keyword check with sample data for invoice approval workflow: verdict go, reach for your site 72 out of 100, high topic fit and a short plan of three supporting pages."
      className={cn('rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <div className="flex gap-2">
        <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-page px-3 text-[13px]">
          <Search className="size-3.5 shrink-0 text-ink-3" />
          <span className="truncate">invoice approval workflow</span>
        </span>
        <span className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[12.5px] font-medium text-accent-ink">Check</span>
      </div>
      <div className="mk-pop mt-5 flex flex-wrap items-center justify-between gap-3" style={{ ['--mk-i' as string]: 0 }}>
        <div>
          <span className="block text-[11px] text-ink-3">Verdict</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="font-display text-2xl font-semibold tracking-[-0.01em]">Go</span>
            <MockBadge tone="good">Within reach</MockBadge>
          </span>
        </div>
        <div className="min-w-[180px] flex-1 sm:max-w-[240px]">
          <span className="flex items-baseline justify-between text-[11px] text-ink-3">
            Reach for your site
            <span className="font-mono text-[13px] font-medium text-ink tabular">72/100</span>
          </span>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-2">
            <span className="mk-grow-x block h-full w-[72%] rounded-full bg-accent" />
          </span>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {facts.map((f, i) => (
          <div key={f.l} className="mk-pop rounded-lg border border-line bg-page p-2.5" style={{ ['--mk-i' as string]: i + 2 }}>
            <dt className="text-[10.5px] text-ink-3">{f.l}</dt>
            <dd className="mt-0.5 text-[13px] font-semibold">{f.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mk-pop mt-4 rounded-lg border border-line p-3" style={{ ['--mk-i' as string]: 7 }}>
        <span className="block text-[11px] font-semibold">Why</span>
        <ul className="mt-1.5 space-y-1 text-[12px] leading-snug text-ink-2">
          <li>Top results are mid-sized sites like yours, not only category leaders.</li>
          <li>Three supporting pages first: approval rules, approval matrix, approval software.</li>
        </ul>
      </div>
      <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>
    </Drawn>
  );
}
