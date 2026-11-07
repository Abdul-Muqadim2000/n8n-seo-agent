import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge, MockCard } from './parts';

/** The Competitors page: the competitors found in Google with their reason, and the lists to join (sample data). */
export function CompetitorsMockup({ className }: { className?: string }) {
  const rows = [
    { d: 'northpeak-erp.com', k: 'Direct competitor', why: 'Top 10 for 9 of 14 of your service searches', s: 72, chosen: true },
    { d: 'bluefin-consulting.ae', k: 'Direct competitor', why: 'Top 10 for 7 of 14, mostly in Dubai', s: 61, chosen: true },
    { d: 'atlas-dynamics.io', k: 'Close competitor', why: 'Top 10 for 5 of 14, cited in AI answers', s: 48, chosen: false },
  ];
  return (
    <Drawn label="The Competitors page with sample data: three competitors found in Google with the reason for each, and two directories to join." className={cn('rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}>
      <p className="font-display text-[15px] font-semibold leading-snug">Your 3 main competitors are northpeak-erp.com, bluefin-consulting.ae and atlas-dynamics.io.</p>
      <ul className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <li key={r.d} className="mk-pop flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-page p-2.5" style={{ ['--mk-i' as string]: i }}>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                {r.chosen && <Star className="size-3 text-accent-text" strokeWidth={2.25} />}
                {r.d}
              </span>
              <span className="block text-[11px] text-ink-3">{r.why}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MockBadge tone={r.chosen ? 'accent' : 'neutral'} icon={null}>
                {r.k}
              </MockBadge>
              <span className="font-mono text-[11px] tabular text-ink-2">{r.s}/100</span>
            </span>
          </li>
        ))}
      </ul>
      <MockCard className="mk-pop mt-4" title="Lists and directories to join">
        <div className="flex flex-wrap gap-1.5 px-4 pb-3.5 pt-2">
          <MockBadge tone="good">Get listed: clutch.co</MockBadge>
          <MockBadge tone="good">Get listed: a "top ERP partners" list</MockBadge>
        </div>
      </MockCard>
      <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>
    </Drawn>
  );
}
