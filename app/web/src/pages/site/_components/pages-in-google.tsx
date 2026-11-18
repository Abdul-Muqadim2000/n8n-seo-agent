// CR17-C (client report 2026-11-17 C3 / F6): "Pages in Google" beside Technical health on the Overview and on Technical health. One figure
// and one population everywhere: the Indexing page's own data (useIndexing) through the shared rule (pagesInGoogle in @seo/shared).
import { FileSearch } from 'lucide-react';
import { PAGES_IN_GOOGLE_LABEL, pagesInGoogle, type PagesInGoogle } from '@seo/shared';
import { useIndexing } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { MetricCard } from '@/components/insight';

/** Pages in Google for one website (null while it loads, or when the daily index check has no reading). */
export function usePagesInGoogle(orgId: string, siteId: string, domain: string): { p: PagesInGoogle | null; loading: boolean } {
  const q = useIndexing(orgId, siteId);
  return { p: q.data && 'totals' in q.data ? pagesInGoogle(q.data, domain) : null, loading: q.isLoading };
}

/** The card: "18 of 45", the existing pages' share in its band's colour, the new pages waiting, the population in the info tip. */
export function PagesInGoogleCard({ p, loading, onClick }: { p: PagesInGoogle | null; loading: boolean; onClick?: () => void }) {
  const tone = p?.tone === 'good' ? 'good' : p?.tone === 'warning' ? 'warning' : p?.tone === 'critical' ? 'critical' : 'blue';
  return (
    <MetricCard
      label={PAGES_IN_GOOGLE_LABEL}
      icon={<FileSearch />}
      tone={tone}
      info={p ? p.population : 'From the daily index check: which of your pages Google shows in search.'}
      value={p && p.shouldBe > 0 ? <span className="tabular">{`${p.inGoogle.toLocaleString('en-US')} of ${p.shouldBe.toLocaleString('en-US')}`}</span> : '-'}
      meta={
        p ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {p.existing.shouldBe > 0 && <StatusBadge tone={tone === 'blue' ? 'neutral' : tone}>{`${p.existing.pct}% of existing pages`}</StatusBadge>}
            {p.newPages.waiting > 0 && <span>{`${p.newPages.waiting} new waiting for Google`}</span>}
            {p.checkedAt && <span>{fmtDate(p.checkedAt)}</span>}
          </span>
        ) : loading ? (
          'Reading the daily index check'
        ) : (
          'Arrives with the daily index check'
        )
      }
      onClick={onClick}
    />
  );
}
