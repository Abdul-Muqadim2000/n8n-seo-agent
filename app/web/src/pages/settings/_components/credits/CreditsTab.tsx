import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarDays, ChartNoAxesColumn, CircleHelp, Coins, Globe, Layers, ShoppingCart } from 'lucide-react';
import { CREDIT_SOURCE_LABEL, formatCredits, type BillingOverview, type BillingSiteRow, type CreditLot } from '@seo/shared';
import { BarsChart, ChartCard, SERIES_COLORS, type Series } from '@/components/charts';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { CountUp, HeroStat, IconTile, ProgressBar, Stagger, SummaryHero } from '@/components/insight';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useBilling } from '@/lib/queries';
import { fmtDate, fmtDay } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';
import { ActivityCard } from './ActivityCard';
import { BuyCreditsCard } from './BuyCredits';
import { LimitsCard } from './LimitsCard';
import { daysText, featureTotals, lotTerms, pausedByLimit, statusLabel, statusTone } from './status';

// Company settings → Credits (app/docs/CREDITS.md §2): the balance and how long it lasts, this month's autopilot and on-demand use,
// each website's forecast, usage by feature and by day, the credit lots and their expiry, buying credits, the company's limits and
// the activity. Every figure is in credits; the only dollars are the prices of the packs.

const BUY_ID = 'credits-buy';
const credits = (n: number) => formatCredits(n);
const axis = (n: number) => formatCredits(n, { unit: false });

function monthLabel(month: string): string {
  const d = parseISO(`${month}-01`);
  return isValid(d) ? format(d, 'MMMM yyyy') : month;
}

export function CreditsTab() {
  const { org } = useOrgCtx();
  const billing = useBilling(org.id);

  if (billing.isPending)
    return (
      <div className="space-y-5" aria-busy>
        <Skeleton className="h-56" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  if (billing.isError)
    return (
      <Card>
        <ErrorState error={billing.error} onRetry={() => billing.refetch()} title="Could not load your credits" />
      </Card>
    );

  const b = billing.data;
  return (
    <Stagger className="space-y-5">
      <CreditsHero b={b} />
      <Notices b={b} />
      <div className="grid gap-5 lg:grid-cols-2">
        <MonthCard b={b} />
        <SitesCard sites={b.sites} />
      </div>
      <UsageCharts b={b} loading={billing.isFetching} />
      <div className="grid gap-5 lg:grid-cols-2">
        <LotsCard lots={b.lots} />
        <HowCreditsWork b={b} />
      </div>
      <BuyCreditsCard b={b} id={BUY_ID} />
      <LimitsCard b={b} />
      <ActivityCard />
    </Stagger>
  );
}

// ---------------- hero ----------------

function CreditsHero({ b }: { b: BillingOverview }) {
  const { can } = useOrgCtx();
  const used = b.month.autopilotUsed + b.month.onDemandUsed;
  const description = !b.enforced
    ? 'Credits are counted for your company but do not stop anything: analyses and your websites’ automatic work run whatever the balance.'
    : b.runwayDays != null
      ? `Lasts ${daysText(b.runwayDays)} at your current use${b.runsOutOn ? ` · runs out on ${fmtDate(b.runsOutOn)}` : ''}.`
      : 'Nothing is using credits at the moment, so the balance stays as it is.';
  return (
    <SummaryHero
      eyebrow={
        <>
          <StatusBadge tone={statusTone(b)}>{statusLabel(b)}</StatusBadge>
          <span>Your balance · {monthLabel(b.month.month)}</span>
        </>
      }
      title={<CountUp value={b.balance} format={credits} />}
      description={description}
      aside={
        can('admin') ? (
          <Button icon={<ShoppingCart className="size-4" />} onClick={() => document.getElementById(BUY_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Buy credits
          </Button>
        ) : undefined
      }
      stats={
        <>
          <HeroStat label="Available now" value={<CountUp value={b.available} format={credits} />} hint="The balance less what running analyses hold." />
          <HeroStat label="Held by running analyses" value={<CountUp value={b.held} format={credits} />} hint="Each held at its price until it finishes." />
          <HeroStat
            label="Kept for autopilot"
            value={<CountUp value={b.reservedForAutopilot} format={credits} />}
            hint={b.limits.reserveForAutopilot ? 'What your websites’ schedules still need this month.' : 'Off: on-demand analyses may use every credit.'}
          />
          <HeroStat label="Used this month" value={<CountUp value={used} format={credits} />} hint={`${credits(b.month.autopilotUsed)} autopilot · ${credits(b.month.onDemandUsed)} on-demand`} />
        </>
      }
    />
  );
}

function Notices({ b }: { b: BillingOverview }) {
  const { can } = useOrgCtx();
  const notes: ReactNode[] = [];
  if (b.status === 'paused')
    notes.push(
      pausedByLimit(b) ? (
        <Callout key="paused" tone="warning" title="Your websites’ automatic work is paused">
          It reached this month’s autopilot limit of {credits(b.limits.autopilotMonthly ?? 0)}. It resumes by itself on the 1st, or as soon as {can('owner') ? 'you raise' : 'an owner raises'} the
          limit below.
        </Callout>
      ) : (
        <Callout key="paused" tone="critical" title="Your websites’ automatic work is paused: out of credits">
          Weekly reports, monitors and blog posts resume by themselves when credits are added.
        </Callout>
      ),
    );
  else if (b.enforced && b.status === 'empty')
    notes.push(
      <Callout key="empty" tone="critical" title="You are out of credits">
        New analyses cannot start, and your websites’ automatic work pauses until credits are added.
      </Callout>,
    );
  if (b.expiringSoon)
    notes.push(
      <Callout key="expiring" tone="warning" title={`${credits(b.expiringSoon.credits)} expire on ${fmtDate(b.expiringSoon.on)}`}>
        Credits are used soonest-expiring first, so whatever your company uses before then comes out of these.
      </Callout>,
    );
  if (!notes.length) return null;
  return <div className="space-y-3">{notes}</div>;
}

// ---------------- this month and the websites ----------------

function MonthCard({ b }: { b: BillingOverview }) {
  const m = b.month;
  const apLimit = b.limits.autopilotMonthly;
  const odLimit = b.limits.onDemandMonthly;
  const apMax = Math.max(m.autopilotForecast, apLimit ?? 0, m.autopilotUsed);
  const over = apLimit != null && m.autopilotUsed >= apLimit;
  return (
    <SettingsCard icon={<CalendarDays />} title="This month" description={`${monthLabel(m.month)} so far: what your websites’ schedules and your own analyses used.`}>
      <CardBody className="space-y-5">
        <ProgressBar
          label="Autopilot"
          value={m.autopilotUsed}
          max={apMax}
          tone={over ? 'warning' : 'accent'}
          valueLabel={
            <>
              <span className="font-mono">{credits(m.autopilotUsed)}</span> of about <span className="font-mono">{credits(m.autopilotForecast)}</span> forecast
              {apLimit != null && <> · limit <span className="font-mono">{credits(apLimit)}</span></>}
            </>
          }
        />
        {odLimit != null ? (
          <ProgressBar
            label="On-demand"
            value={m.onDemandUsed}
            max={Math.max(odLimit, m.onDemandUsed, 1)}
            tone={m.onDemandUsed >= odLimit ? 'warning' : 'accent'}
            valueLabel={
              <>
                <span className="font-mono">{credits(m.onDemandUsed)}</span> of your <span className="font-mono">{credits(odLimit)}</span> limit
              </>
            }
          />
        ) : (
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium text-ink-2">On-demand</span>
            <span className="text-ink-3">
              <span className="font-mono text-ink">{credits(m.onDemandUsed)}</span> used · no limit
            </span>
          </div>
        )}
        <p className="border-t border-line pt-4 text-[13px] leading-snug text-ink-3">
          {m.planMonthly != null ? (
            <>
              Your plan adds <span className="font-mono font-medium text-ink">{credits(m.planMonthly)}</span> a month
              {m.planRenewsOn ? <> · next credits on {fmtDate(m.planRenewsOn)}</> : null}.
            </>
          ) : (
            'Your company has no monthly plan credits: the balance comes from packs and credits added for you.'
          )}
        </p>
      </CardBody>
    </SettingsCard>
  );
}

function siteState(s: BillingSiteRow): ReactNode {
  // the badge never wraps: the second half of the sentence sits under the domain (see SitesCard)
  if (s.pausedForCredits) return <StatusBadge tone="critical">Paused: out of credits</StatusBadge>;
  if (s.paused) return <StatusBadge tone="neutral">Paused</StatusBadge>;
  return <StatusBadge tone="good">Running</StatusBadge>;
}

function SitesCard({ sites }: { sites: BillingSiteRow[] }) {
  const { org } = useOrgCtx();
  return (
    <SettingsCard icon={<Globe />} title="Autopilot by website" description="What each website’s schedules are forecast to use a month, from its settings, and what they used this month.">
      <CardBody>
        {sites.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {sites.map((s) => (
              <li key={s.siteId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={paths.site(org.id, s.siteId, 'settings/tracking')}
                    className="block truncate text-sm font-medium text-ink underline-offset-2 hover:text-accent-text hover:underline"
                    title="Website settings: tracking and monitors"
                  >
                    {s.domain}
                  </Link>
                  <p className="text-xs text-ink-3">
                    About <span className="font-mono">{credits(s.forecastMonthly)}</span> a month · <span className="font-mono">{credits(s.usedThisMonth)}</span> used this month
                  </p>
                  {s.pausedForCredits && <p className="text-xs text-critical-text">Paused: out of credits — resumes when credits are added.</p>}
                </div>
                {siteState(s)}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Globe className="size-5" />} title="No websites yet" description="Each website’s weekly reports and monitors use credits as they run; their forecast appears here." className="py-8" />
        )}
      </CardBody>
    </SettingsCard>
  );
}

// ---------------- usage ----------------

const ORIGIN_SERIES: Series[] = [
  { key: 'autopilot', label: 'Autopilot', color: SERIES_COLORS[0], format: credits },
  { key: 'onDemand', label: 'On-demand', color: SERIES_COLORS[1], format: credits },
];

function ChartTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <IconTile size="sm">{icon}</IconTile>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function UsageCharts({ b, loading }: { b: BillingOverview; loading: boolean }) {
  const { org, can } = useOrgCtx();
  const features = featureTotals(b.byFeature);
  const used = b.daily.some((d) => d.autopilot > 0 || d.onDemand > 0);
  if (!features.length && !used)
    return (
      <Card>
        <EmptyState
          icon={<ChartNoAxesColumn className="size-5" />}
          title="No credits used this month yet"
          description="Usage by feature and by day appears here as soon as your websites’ schedules run or someone starts an analysis."
          action={
            can('member') ? (
              <Link to={paths.tools(org.id)} className="text-sm font-medium text-accent-text underline-offset-2 hover:underline">
                Run an analysis
              </Link>
            ) : undefined
          }
        />
      </Card>
    );
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartCard
        title={<ChartTitle icon={<ChartNoAxesColumn />}>Usage by feature</ChartTitle>}
        description="Credits used this month"
        series={ORIGIN_SERIES}
        legendShape="rect"
        loading={loading}
        table={{
          columns: [
            { key: 'label', label: 'Feature' },
            { key: 'autopilot', label: 'Autopilot', align: 'right', format: (v) => credits(Number(v)) },
            { key: 'onDemand', label: 'On-demand', align: 'right', format: (v) => credits(Number(v)) },
            { key: 'runs', label: 'Runs', align: 'right' },
          ],
          rows: features,
        }}
      >
        <FeatureBars rows={features} />
      </ChartCard>
      <ChartCard
        title={<ChartTitle icon={<CalendarDays />}>Usage by day</ChartTitle>}
        description="Credits used each day this month"
        series={ORIGIN_SERIES}
        legendShape="rect"
        loading={loading}
        table={{
          columns: [
            { key: 'date', label: 'Day', format: (v) => fmtDate(String(v)) },
            { key: 'autopilot', label: 'Autopilot', align: 'right', format: (v) => credits(Number(v)) },
            { key: 'onDemand', label: 'On-demand', align: 'right', format: (v) => credits(Number(v)) },
          ],
          rows: b.daily.filter((d) => d.autopilot > 0 || d.onDemand > 0),
        }}
      >
        <BarsChart data={b.daily} categoryKey="date" series={ORIGIN_SERIES} stacked valueFormat={axis} categoryFormat={(v) => fmtDay(String(v))} />
      </ChartCard>
    </div>
  );
}

/** Usage by feature as ranked bars, each split into its autopilot and on-demand parts against the biggest feature. */
function FeatureBars({ rows }: { rows: ReturnType<typeof featureTotals> }) {
  const max = Math.max(0, ...rows.map((r) => r.total));
  return (
    <ul className="space-y-3.5 pt-1" aria-label="Credits used by feature">
      {rows.map((r) => {
        const ap = max > 0 ? (r.autopilot / max) * 100 : 0;
        const od = max > 0 ? (r.onDemand / max) * 100 : 0;
        return (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-medium text-ink">{r.label}</span>
              <span className="shrink-0 tabular text-ink-2">
                <span className="font-mono font-medium text-ink">{credits(r.total)}</span>
                <span className="text-ink-3">
                  {' '}
                  · {r.runs} {r.runs === 1 ? 'run' : 'runs'}
                </span>
              </span>
            </div>
            <div className="mt-1.5 flex h-2 w-full gap-px overflow-hidden rounded-full bg-surface-2" aria-hidden>
              {ap > 0 && <div className="h-full transition-[width] duration-700 ease-brand" style={{ width: `${Math.max(1, ap)}%`, background: SERIES_COLORS[0] }} />}
              {od > 0 && <div className="h-full transition-[width] duration-700 ease-brand" style={{ width: `${Math.max(1, od)}%`, background: SERIES_COLORS[1] }} />}
            </div>
            <span className="sr-only">
              {credits(r.autopilot)} autopilot, {credits(r.onDemand)} on-demand
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------- lots and how credits work ----------------

function lotEnd(l: CreditLot, now: number): string {
  if (!l.expiresAt) return 'Never expires';
  const t = new Date(l.expiresAt).getTime();
  return t <= now ? `Expired ${fmtDate(l.expiresAt)}` : `Expires ${fmtDate(l.expiresAt)}`;
}

function LotsCard({ lots }: { lots: CreditLot[] }) {
  const now = Date.now();
  return (
    <SettingsCard icon={<Layers />} title="Your credits" description="Where your credits came from and when they expire. The soonest-expiring are used first.">
      <CardBody>
        {lots.length ? (
          <ul className="space-y-3">
            {lots.map((l) => {
              const gone = l.remaining <= 0 || (!!l.expiresAt && new Date(l.expiresAt).getTime() <= now);
              return (
                <li key={l.id} className="rounded-xl border border-line p-3.5">
                  <ProgressBar
                    label={
                      <span className="flex min-w-0 items-center gap-2">
                        <IconTile size="xs" tone={gone ? 'neutral' : 'blue'}>
                          <Coins />
                        </IconTile>
                        <span className="truncate">{CREDIT_SOURCE_LABEL[l.source] ?? 'Credits'}</span>
                      </span>
                    }
                    value={Math.max(0, l.remaining)}
                    max={Math.max(1, l.credits)}
                                        valueLabel={
                      <>
                        <span className="font-mono">{formatCredits(Math.max(0, l.remaining), { unit: false })}</span> of <span className="font-mono">{credits(l.credits)}</span> left
                      </>
                    }
                  />
                  <p className="mt-2 text-xs text-ink-3">
                    {lotEnd(l, now)} · added {fmtDate(l.createdAt)}
                    {l.note ? ` · ${l.note}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Coins className="size-5" />} title="No credits yet" description="Credits you buy, plan credits and credits added for you appear here with their expiry." className="py-8" />
        )}
      </CardBody>
    </SettingsCard>
  );
}

function HowCreditsWork({ b }: { b: BillingOverview }) {
  // the platform's own terms (the overview carries them); the lots are only a fallback for an older server answer
  const fromLots = lotTerms(b.lots);
  const terms = {
    packMonths: typeof b.packExpiryMonths === 'number' ? b.packExpiryMonths : fromLots.packMonths,
    planRolloverMonths: typeof b.planRolloverMonths === 'number' ? b.planRolloverMonths : fromLots.planRolloverMonths,
  };
  const items: ReactNode[] = [
    'Every analysis shows its price in credits before it starts, and holds that price while it runs.',
    'When it finishes it is charged what it really used, and never more than the price it showed. An analysis that fails is free.',
    'Your websites’ automatic work (weekly reports, monitors, blog posts) uses credits as it runs. If credits run out it pauses, and it resumes by itself when credits are added.',
    b.limits.reserveForAutopilot
      ? 'Analyses you start leave alone the credits your websites’ schedules still need this month.'
      : 'Analyses you start may use every credit, including what the schedules will need later this month.',
    'Credits are used soonest-expiring first.',
  ];
  const terms2: string[] = [];
  if (terms.packMonths != null) terms2.push(`packs last ${terms.packMonths === 12 ? '12 months' : `${terms.packMonths} months`}`);
  if (terms.planRolloverMonths != null)
    terms2.push(terms.planRolloverMonths > 0 ? `unused plan credits roll over ${terms.planRolloverMonths === 1 ? 'one month' : `${terms.planRolloverMonths} months`}` : 'plan credits last until the end of their month');
  items.push(terms2.length ? `${terms2.join('; ').replace(/^./, (c) => c.toUpperCase())}. Each lot shows its own expiry date.` : 'Each lot of credits shows its own expiry date; credits returned to you never expire.');
  return (
    <SettingsCard icon={<CircleHelp />} title="How credits work">
      <CardBody>
        <ul className="space-y-2.5 text-[13px] leading-relaxed text-ink-2">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </SettingsCard>
  );
}
