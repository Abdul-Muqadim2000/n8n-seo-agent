import { Building2, ChevronDown, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

const MEMBERS = [
  { i: 'DK', n: 'Dana K.', r: 'Owner' },
  { i: 'RS', n: 'Rafael S.', r: 'Admin' },
  { i: 'MT', n: 'Mei T.', r: 'Member' },
  { i: 'JB', n: 'Jordan B.', r: 'Viewer' },
];
const SITES = [
  { d: 'yourbrand.com', how: 'Search Console' },
  { d: 'yourbrand.de', how: 'DNS TXT' },
  { d: 'help.yourbrand.com', how: 'Meta tag' },
];

/** A company workspace: members with roles, verified websites and the company's credits with the next analysis's price (sample data). */
export function WorkspaceMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="A company workspace with sample data: four members with the roles owner, admin, member and viewer, three verified websites and the company's credits available with the price of the next analysis."
      className={cn('rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <span className="flex items-center justify-between gap-3 rounded-lg border border-line bg-page px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-accent text-accent-ink">
            <Building2 className="size-3.5" />
          </span>
          Your company
        </span>
        <ChevronDown className="size-3.5 text-ink-3" />
      </span>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-3">
          <span className="block text-[11.5px] font-semibold">Team</span>
          <ul className="mt-2 space-y-2">
            {MEMBERS.map((m, i) => (
              <li key={m.n} className="mk-pop flex items-center justify-between gap-2" style={{ ['--mk-i' as string]: i }}>
                <span className="flex items-center gap-2 text-[12px]">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-2 font-mono text-[9px] font-medium text-ink-2">{m.i}</span>
                  {m.n}
                </span>
                <span className="rounded-full border border-line px-2 py-px text-[10.5px] text-ink-2">{m.r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-line p-3">
          <span className="block text-[11.5px] font-semibold">Websites</span>
          <ul className="mt-2 space-y-2">
            {SITES.map((s, i) => (
              <li key={s.d} className="mk-pop flex items-center justify-between gap-2" style={{ ['--mk-i' as string]: i + 4 }}>
                <span className="min-w-0">
                  <span className="block truncate text-[12px]">{s.d}</span>
                  <span className="block text-[10px] text-ink-3">via {s.how}</span>
                </span>
                <MockBadge tone="good" icon={ShieldCheck}>
                  Verified
                </MockBadge>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mk-pop mt-3 rounded-lg border border-line p-3" style={{ ['--mk-i' as string]: 8 }}>
        <span className="flex items-baseline justify-between text-[11.5px]">
          <span className="font-semibold">Credits available</span>
          <span className="font-mono text-ink-2 tabular">1,240 of 5,980</span>
        </span>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-2">
          <span className="mk-grow-x block h-full w-[48%] rounded-full bg-accent" />
        </span>
        <span className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-ink-3">
          <span>Next analysis: keyword check</span>
          <span className="font-mono tabular">12 credits</span>
        </span>
      </div>
      <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>
    </Drawn>
  );
}
