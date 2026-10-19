import { Bell, Globe, Lock, Stamp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

const CLIENTS = [
  { c: 'Northwind Foods', d: 'northwindfoods.com', h: 86, alerts: 0, approve: 1 },
  { c: 'Harbor Dental', d: 'harbordental.co', h: 71, alerts: 2, approve: 0 },
  { c: 'Copperline Tools', d: 'copperline.io', h: 64, alerts: 1, approve: 2 },
];

/** An agency's client portal (sample data): its own address and name, every client website in one table, approvals waiting. */
export function AgencyPortalMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="An agency's client portal with sample data: the portal on the agency's own address under its own name, three client websites with health score, alerts and pages waiting for the client's approval."
      className={cn('@container rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <span className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-page px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-[10px] text-accent-ink">YA</span>
          <span className="truncate">Your Agency Insights</span>
        </span>
        <span className="flex min-w-0 items-center gap-1 font-mono text-[11px] text-ink-3">
          <Lock className="size-3 shrink-0" />
          <span className="truncate">seo.youragency.com</span>
        </span>
      </span>
      <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
        {CLIENTS.map((x, i) => (
          <li key={x.c} className="mk-pop flex flex-wrap items-center justify-between gap-2 px-3 py-2.5" style={{ ['--mk-i' as string]: i }}>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold">{x.c}</span>
              <span className="flex items-center gap-1 text-[10.5px] text-ink-3">
                <Globe className="size-3" />
                {x.d}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <MockBadge tone={x.h >= 80 ? 'good' : x.h >= 70 ? 'warning' : 'critical'}>{`Health ${x.h}`}</MockBadge>
              {x.alerts > 0 && (
                <MockBadge tone="warning" icon={Bell}>
                  {`${x.alerts} alert${x.alerts === 1 ? '' : 's'}`}
                </MockBadge>
              )}
              {x.approve > 0 && (
                <MockBadge tone="accent" icon={Stamp}>
                  {`${x.approve} to approve`}
                </MockBadge>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mk-pop mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3" style={{ ['--mk-i' as string]: 4 }}>
        <span className="min-w-0 text-[11.5px]">
          <span className="block font-semibold">Page: corporate tax guide</span>
          <span className="block text-ink-3">Waiting for the client's approver</span>
        </span>
        <span className="inline-flex h-7 items-center rounded-md bg-accent px-2.5 text-[11.5px] font-medium text-accent-ink">Approve</span>
      </div>
      <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>
    </Drawn>
  );
}
