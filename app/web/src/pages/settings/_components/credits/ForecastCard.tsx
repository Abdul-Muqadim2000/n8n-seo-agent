import { Gauge, Receipt } from 'lucide-react';
import { formatCredits, outcomeCostText, type BillingOverview } from '@seo/shared';
import { CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { SettingsCard } from '../SettingsCard';
import { daysText } from './status';

// CR17-I (client report 2026-11-17, M2): the forecast built from what the work really used (shared/src/credit-forecast.ts), the two
// runways, and what each kind of work has cost this company. Every figure is in credits and comes from the company's own history.

const credits = (n: number) => formatCredits(n);

/** "Your websites' automatic work alone: about 52 days. With your own analyses at last month's pace: about 21 days." */
export function runwayLine(b: Pick<BillingOverview, 'runways' | 'enforced'>): string | null {
  const r = b.runways;
  if (!b.enforced || !r) return null;
  const alone = r.autopilotAlone != null ? `Your websites' automatic work alone: ${daysText(r.autopilotAlone)}.` : 'Your websites\' automatic work uses nothing at the moment.';
  const own = r.withOwn != null && r.withOwn !== r.autopilotAlone ? ` With your own analyses at last month's pace: ${daysText(r.withOwn)}.` : '';
  return alone + own;
}

export function ForecastCard({ b }: { b: BillingOverview }) {
  const f = b.forecast;
  if (!f) return null;
  const rows = f.sites.flatMap((s) => s.rows.filter((r) => r.credits > 0).map((r) => ({ ...r, domain: s.domain })));
  const many = f.sites.length > 1;
  return (
    <SettingsCard icon={<Gauge />} title="Next 30 days" description={f.basis}>
      <CardBody className="space-y-4">
        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <div className="rounded-xl border border-line p-3.5">
            <p className="text-xs text-ink-3">Automatic work</p>
            <p className="mt-1 font-mono text-lg font-medium tabular text-ink">about {credits(f.autopilotMonthly)}</p>
          </div>
          <div className="rounded-xl border border-line p-3.5">
            <p className="text-xs text-ink-3">Your own analyses, at last month's pace</p>
            <p className="mt-1 font-mono text-lg font-medium tabular text-ink">about {credits(f.onDemandMonthly)}</p>
          </div>
        </div>
        {rows.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {rows
              .sort((a, c) => c.credits - a.credits)
              .map((r) => (
                <li key={`${r.domain}:${r.id}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {r.label}
                      {many ? <span className="font-normal text-ink-3"> · {r.domain}</span> : null}
                    </p>
                    <p className="text-xs text-ink-3">{r.detail}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular text-ink">{credits(r.credits)}</span>
                </li>
              ))}
          </ul>
        ) : (
          <EmptyState icon={<Gauge className="size-5" />} title="Nothing scheduled" description="Your websites' automatic work is paused or switched off, so it uses no credits." className="py-6" />
        )}
      </CardBody>
    </SettingsCard>
  );
}

export function OutcomeCostCard({ b }: { b: BillingOverview }) {
  const list = (b.costPerOutcome ?? []).filter((c) => c.count > 0);
  if (!list.length) return null;
  return (
    <SettingsCard icon={<Receipt />} title="What work has cost you" description="From your own work in the last 60 days: what each kind of work really used, typically and usually.">
      <CardBody>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {list.map((c) => (
            <li key={c.kind} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="text-sm font-medium text-ink">{c.label}</span>
              <span className="text-xs text-ink-2">{outcomeCostText(c)}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </SettingsCard>
  );
}
