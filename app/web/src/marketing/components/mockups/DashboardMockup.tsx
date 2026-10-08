import { Bell, CalendarDays, ChartLine, FileText, Inbox, LayoutDashboard, Link2, ScanSearch, Sparkles, Workflow, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSize } from '../diagrams/Fan';
import { Drawn, MockBadge, MockCard, MockDelta } from './parts';

const NAV: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Pipeline', icon: Workflow },
  { label: 'Search', icon: ChartLine },
  { label: 'Content', icon: FileText },
  { label: 'Technical', icon: ScanSearch },
  { label: 'AI visibility', icon: Sparkles },
  { label: 'Backlinks', icon: Link2 },
  { label: 'Alerts', icon: Bell },
];

const KPIS = [
  { label: 'Clicks', value: '48.2K', delta: '18.4' },
  { label: 'Impressions', value: '1.91M', delta: '11.2' },
  { label: 'Avg. position', value: '8.4', delta: '1.6', suffix: '' },
  { label: 'AI mention rate', value: '34%', delta: '6', suffix: ' pts' },
];

// sample weekly clicks (thousands), this period and the one before
const THIS = [21, 22.5, 22, 24.8, 26.1, 25.4, 29.2, 31.8, 31, 35.4, 39.2, 43.6];
const PREV = [19, 19.6, 20.4, 20.1, 21.3, 21, 22.2, 22.9, 22.5, 23.8, 24.2, 25.1];
const WEEKS = ['Jul 14', 'Jul 28', 'Aug 11', 'Aug 25', 'Sep 8', 'Sep 22'];

function LineChart() {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const pad = { l: 30, r: 8, t: 10, b: 22 };
  const max = 50;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (THIS.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const line = (d: number[]) => d.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line(THIS)} L${x(THIS.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  return (
    <div ref={ref} className="h-[150px] w-full sm:h-[190px]">
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
          {[0, 10, 20, 30, 40, 50].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} strokeWidth={1} className="stroke-grid" />
              <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" className="fill-ink-3 font-mono text-[9px]">
                {t}K
              </text>
            </g>
          ))}
          {WEEKS.map((wk, i) => (
            <text key={wk} x={x(i * 2 + 0.5)} y={h - 6} textAnchor="middle" className="fill-ink-3 font-mono text-[9px]">
              {wk}
            </text>
          ))}
          <path d={area} className="mk-fill fill-accent/10" />
          <path d={line(PREV)} strokeWidth={1.5} strokeDasharray="3 4" className="stroke-ink-3/70" />
          <path d={line(THIS)} pathLength={1} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" className="mk-draw stroke-accent" />
          <circle cx={x(THIS.length - 1)} cy={y(THIS[THIS.length - 1])} r={4} strokeWidth={2} className="mk-fill fill-surface stroke-accent" />
        </svg>
      )}
    </div>
  );
}

/** The Ascentra overview dashboard drawn in code: sidebar, KPI tiles, a clicks chart that draws in, "Needs you" and this week's work (sample data). */
export function DashboardMockup({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Drawn label="The Ascentra overview dashboard with sample data: clicks, impressions, average position, AI mention rate, a clicks chart and the work that needs you." className={cn('flex bg-page', className)}>
      {!compact && (
        <aside className="hidden w-[188px] shrink-0 flex-col border-r border-line bg-surface p-3 md:flex">
          <div className="px-2 pb-4 pt-1">
            <img src="/brand/ascentra-logo-header-light.svg" alt="" width={103} height={22} className="h-[22px] w-auto dark:hidden" />
            <img src="/brand/ascentra-logo-header-dark.svg" alt="" width={103} height={22} className="hidden h-[22px] w-auto dark:block" />
          </div>
          <div className="mb-3 rounded-md border border-line px-2.5 py-2">
            <span className="block text-[10px] text-ink-3">Website</span>
            <span className="block truncate text-[12px] font-medium text-ink">yourbrand.com</span>
          </div>
          <nav className="space-y-0.5">
            {NAV.map(({ label, icon: Icon, active }) => (
              <span key={label} className={cn('flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px]', active ? 'bg-accent-soft font-medium text-accent-text' : 'text-ink-2')}>
                <Icon className="size-3.5" />
                {label}
              </span>
            ))}
          </nav>
        </aside>
      )}
      <div className="min-w-0 flex-1 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="block font-display text-[15px] font-semibold text-ink sm:text-base">Overview</span>
            <span className="block text-[11px] text-ink-3">Last 28 days · compared with the 28 days before</span>
          </div>
          <span className="hidden items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink-2 sm:inline-flex">
            <CalendarDays className="size-3" />
            28 days
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {KPIS.map((k, i) => (
            <div key={k.label} className="mk-pop rounded-lg border border-line bg-surface p-3" style={{ ['--mk-i' as string]: i }}>
              <span className="block text-[11px] text-ink-3">{k.label}</span>
              <span className="mt-1 flex items-baseline justify-between gap-2">
                <span className="font-display text-lg font-semibold tracking-[-0.01em] text-ink sm:text-xl">{k.value}</span>
                <MockDelta value={k.delta} suffix={k.suffix ?? '%'} />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <MockCard
            title="Clicks per week"
            action={
              <span className="flex items-center gap-3 text-[10px] text-ink-3">
                <span className="flex items-center gap-1">
                  <span className="h-0.5 w-3 rounded bg-accent" />
                  This period
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-0 w-3 border-t border-dashed border-ink-3" />
                  Before
                </span>
              </span>
            }
          >
            <div className="px-2 pb-2 pt-1">
              <LineChart />
            </div>
          </MockCard>
          <MockCard
            className="hidden sm:block"
            title={
              <span className="flex items-center gap-1.5">
                <Inbox className="size-3.5 text-accent-text" />
                Needs you
              </span>
            }
            action={<span className="rounded-full bg-accent px-1.5 font-mono text-[10px] font-medium text-accent-ink">3</span>}
          >
            <ul className="space-y-2 p-3 pt-2.5">
              {[
                { t: 'Approve the brief: invoice approval workflow', b: <MockBadge tone="accent">Ladder rung 4</MockBadge> },
                { t: '2 pages ready to publish', b: <MockBadge tone="neutral">Content</MockBadge> },
                { t: '1 link lost after two checks', b: <MockBadge tone="warning">Backlinks</MockBadge> },
              ].map((r, i) => (
                <li key={r.t} className="mk-pop rounded-md border border-line p-2.5" style={{ ['--mk-i' as string]: i + 4 }}>
                  <span className="block text-[11.5px] font-medium leading-snug text-ink">{r.t}</span>
                  <span className="mt-1.5 block">{r.b}</span>
                </li>
              ))}
            </ul>
          </MockCard>
        </div>
      </div>
    </Drawn>
  );
}
