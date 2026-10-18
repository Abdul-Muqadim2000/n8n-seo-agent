import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

const ROWS: { name: string; kind: string; hits: number; tone: 'good' | 'neutral'; proof: string }[] = [
  { name: 'Googlebot', kind: 'Search', hits: 18420, tone: 'good', proof: 'Proved' },
  { name: 'GPTBot', kind: 'AI training', hits: 3115, tone: 'good', proof: 'Proved' },
  { name: 'OAI-SearchBot', kind: 'AI search', hits: 1260, tone: 'good', proof: 'Proved' },
  { name: 'ChatGPT-User', kind: 'For a person', hits: 412, tone: 'good', proof: 'Proved' },
  { name: 'Bytespider', kind: 'AI training', hits: 980, tone: 'neutral', proof: 'Claimed' },
];
const max = Math.max(...ROWS.map((r) => r.hits));

/** The Crawlers page with sample data: requests per crawler with how each was proved, impostors apart, crawl budget. */
export function CrawlersMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="The Crawlers page with sample data: Googlebot 18,420 requests and GPTBot 3,115, both proved by the vendor's addresses; 640 requests pretended to be Googlebot; 14% of Googlebot's requests went to redirects and errors."
      className={cn('@container rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <span className="block text-[11px] text-ink-3">Server logs · last 30 days</span>
      <span className="mt-0.5 block font-display text-[15px] font-semibold">Who really crawled your site</span>
      <ul className="mt-4 space-y-2.5">
        {ROWS.map((r, i) => (
          <li key={r.name} className="mk-pop" style={{ ['--mk-i' as string]: i }}>
            <span className="flex items-center justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate font-medium">
                {r.name} <span className="font-normal text-ink-3">· {r.kind}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[11px] tabular text-ink-2">{r.hits.toLocaleString('en-US')}</span>
                <MockBadge tone={r.tone}>{r.proof}</MockBadge>
              </span>
            </span>
            <span className="mt-1 block h-1.5 rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (r.hits / max) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 @min-[24rem]:grid-cols-2">
        <div className="mk-pop rounded-lg border border-line bg-page p-3" style={{ ['--mk-i' as string]: 6 }}>
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
            <ShieldAlert className="size-3.5 text-warning-text" />
            Impostors
          </span>
          <span className="mt-1 block text-[11.5px] text-ink-2">640 requests used Googlebot’s name from other addresses</span>
        </div>
        <div className="mk-pop rounded-lg border border-line bg-page p-3" style={{ ['--mk-i' as string]: 7 }}>
          <span className="block text-[11.5px] font-semibold">Crawl budget</span>
          <span className="mt-1 block text-[11.5px] text-ink-2">14% of Googlebot’s requests hit redirects and errors</span>
        </div>
      </div>
      <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>
    </Drawn>
  );
}
