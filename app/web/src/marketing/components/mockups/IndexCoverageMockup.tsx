import { CircleCheck, Link2, PenLine, TrendingDown, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

type Tone = 'good' | 'warning' | 'accent' | 'neutral';
const GROUPS: { cause: string; pages: number; action: string; tone: Tone; icon: LucideIcon }[] = [
  { cause: 'Set to noindex, but listed in your sitemap', pages: 3, action: 'Step on your website', tone: 'warning', icon: Wrench },
  { cause: 'Found by Google, not crawled yet', pages: 5, action: 'Add internal links', tone: 'accent', icon: Link2 },
  { cause: 'Crawled, not chosen for the index', pages: 2, action: 'Improve, with your OK', tone: 'neutral', icon: PenLine },
  { cause: 'Tag and archive pages', pages: 9, action: 'Fine to leave out', tone: 'good', icon: CircleCheck },
];

/** The Indexing page with sample data: indexed pages of the pages that should be in Google, the left-out pages grouped by cause with
 *  the action for each group, a page that dropped out and what the last Google update did to the site's pages. */
export function IndexCoverageMockup({ className }: { className?: string }) {
  const indexed = 41;
  const known = 52;
  return (
    <Drawn
      label="The Indexing page with sample data: 41 of 52 pages that should be in Google are indexed; the pages left out grouped by cause (3 set to noindex, a step on your website; 5 not crawled yet, add internal links; 2 crawled but not chosen, improve with your OK; 9 tag pages, fine to leave out); one page dropped out; after a Google update 2 pages lost, 37 held and 4 gained."
      className={cn('@container rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <span className="block text-[11px] text-ink-3">Indexing · checked this morning</span>
      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-display text-[15px] font-semibold">
        <span>
          <span className="tabular">{indexed}</span> of <span className="tabular">{known}</span> pages in Google
        </span>
        <span className="font-sans text-[11.5px] font-normal text-ink-3">that should be there</span>
      </span>
      <span className="mt-2.5 block h-1.5 rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${(indexed / known) * 100}%` }} />
      </span>
      <span className="mt-4 flex gap-1.5 text-[11.5px]">
        <span className="rounded-md bg-surface-2 px-2 py-1 font-medium">Existing pages</span>
        <span className="rounded-md px-2 py-1 text-ink-3">New pages</span>
      </span>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {GROUPS.map((g, i) => (
          <li key={g.cause} className="mk-pop flex flex-col gap-1.5 py-2.5 @min-[24rem]:flex-row @min-[24rem]:items-center @min-[24rem]:justify-between @min-[24rem]:gap-3" style={{ ['--mk-i' as string]: i }}>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium @min-[24rem]:truncate">{g.cause}</span>
              <span className="font-mono text-[10.5px] text-ink-3 tabular">
                {g.pages} {g.pages === 1 ? 'page' : 'pages'}
              </span>
            </span>
            <MockBadge tone={g.tone} icon={g.icon} className="self-start @min-[24rem]:self-auto">
              {g.action}
            </MockBadge>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 @min-[24rem]:grid-cols-2">
        <div className="mk-pop rounded-lg border border-line bg-page p-3" style={{ ['--mk-i' as string]: 5 }}>
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
            <TrendingDown className="size-3.5 text-critical-text" />
            Dropped out
          </span>
          <span className="mt-1 block text-[11.5px] text-ink-2">1 page left Google's index since yesterday</span>
        </div>
        <div className="mk-pop rounded-lg border border-line bg-page p-3" style={{ ['--mk-i' as string]: 6 }}>
          <span className="block text-[11.5px] font-semibold">Google update finished</span>
          <span className="mt-1 block text-[11.5px] text-ink-2">
            <span className="tabular">2</span> pages lost, <span className="tabular">37</span> held, <span className="tabular">4</span> gained
          </span>
        </div>
      </div>
      <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>
    </Drawn>
  );
}
