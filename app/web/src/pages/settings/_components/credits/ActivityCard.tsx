import { useState } from 'react';
import { Download, History } from 'lucide-react';
import { formatCredits, type CreditActivityRow } from '@seo/shared';
import { Button, buttonClass } from '@/components/ui/button';
import { CardBody } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Segmented } from '@/components/ui/tabs';
import { useOrgCtx } from '@/lib/context';
import { useCreditActivity } from '@/lib/queries';
import { cn, fmtDateTime } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';

// Every credit in and out, newest first (app/docs/CREDITS.md §3: GET .../billing/activity, the CSV for owners and admins).

type Origin = 'all' | 'autopilot' | 'on_demand' | 'account';
const ORIGINS: { value: Origin; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'autopilot', label: 'Autopilot' },
  { value: 'on_demand', label: 'On-demand' },
  { value: 'account', label: 'Account' },
];
const EMPTY: Record<Origin, string> = {
  all: 'Credits added and used appear here.',
  autopilot: 'What your websites\' schedules use appears here.',
  on_demand: 'Analyses started in the app or through the API appear here.',
  account: 'Credits added, packs, plan credits, corrections and expiries appear here.',
};

const kindWord = (r: CreditActivityRow) => (r.origin === 'autopilot' ? 'Autopilot' : r.origin === 'on_demand' ? 'On-demand' : 'Account');

export function ActivityCard() {
  const { org, can } = useOrgCtx();
  const [origin, setOrigin] = useState<Origin>('all');
  const activity = useCreditActivity(org.id, origin);
  const rows = activity.data?.pages.flatMap((p) => p.rows) ?? [];

  return (
    <SettingsCard
      icon={<History />}
      title="Activity"
      description="Every credit added and used, newest first."
      actions={
        can('admin') ? (
          <a href={`/api/orgs/${org.id}/billing/activity.csv${origin !== 'all' ? `?origin=${origin}` : ''}`} className={buttonClass('secondary', 'sm')} download>
            <Download className="size-4" aria-hidden />
            Download CSV
          </a>
        ) : undefined
      }
    >
      <CardBody className="space-y-4">
        <Segmented label="Show" value={origin} onChange={setOrigin} options={ORIGINS} className="max-w-full overflow-x-auto" />
        {activity.isPending ? (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : activity.isError ? (
          <ErrorState error={activity.error} onRetry={() => activity.refetch()} title="Could not load the activity" />
        ) : !rows.length ? (
          <EmptyState icon={<History className="size-5" />} title="Nothing here yet" description={EMPTY[origin]} className="py-8" />
        ) : (
          <>
            <div className={cn('overflow-x-auto rounded-xl border border-line transition-opacity duration-200', activity.isFetching && !activity.isFetchingNextPage && 'opacity-60')}>
              <table className="w-full text-sm">
                <thead className="bg-surface-2/60">
                  <tr className="text-left text-xs font-medium text-ink-3">
                    <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      What
                    </th>
                    <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">
                      Website
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Credits
                    </th>
                    <th scope="col" className="hidden px-3 py-2 text-right font-medium whitespace-nowrap sm:table-cell">
                      Balance after
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors duration-100 hover:bg-surface-2/50">
                      <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap text-ink-3 tabular">{fmtDateTime(r.at)}</td>
                      <td className="min-w-[12rem] px-3 py-2.5 align-top">
                        <span className="block text-ink">{r.title}</span>
                        <span className="block text-xs text-ink-3">
                          {kindWord(r)}
                          {r.domain && <span className="md:hidden"> · {r.domain}</span>}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2.5 align-top text-ink-2 md:table-cell">{r.domain ?? '-'}</td>
                      <td className={cn('px-3 py-2.5 text-right align-top font-mono font-medium whitespace-nowrap tabular', r.credits > 0 ? 'text-ink' : 'text-ink-2')}>
                        {formatCredits(r.credits, { signed: true, unit: false })}
                      </td>
                      <td className="hidden px-3 py-2.5 text-right align-top font-mono whitespace-nowrap text-ink-3 tabular sm:table-cell">{formatCredits(r.balanceAfter, { unit: false })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {activity.hasNextPage && (
              <div className="flex justify-center">
                <Button variant="secondary" size="sm" loading={activity.isFetchingNextPage} onClick={() => activity.fetchNextPage()}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CardBody>
    </SettingsCard>
  );
}
