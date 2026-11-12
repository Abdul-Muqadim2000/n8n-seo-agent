import { Search } from 'lucide-react';
import { compactNumber, lowDemandNote, type KeywordCheck } from '@seo/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/site/keyword';
import { useOrgCtx } from '@/lib/context';
import { formatCredits } from '@/lib/credits';
import { PRICES } from '@/lib/prices';
import { useAssessKeyword } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { ApiRequestError, errorMessage, isConfirmCancelled } from '@/lib/api';
import { Callout } from '@/components/ui/feedback';
import { CreditRefusal, isCreditRefusal } from '@/components/site/CreditRefusal';
import { WarnLine } from '@/pages/site/_components/pipeline/home';

/**
 * Owner ask 2026-11-12: wherever a client types a keyword they should see how many people search it before they spend on it. On the
 * "Write a page" form: the same keyword check as a new ladder (searches a month, difficulty for the website, its position now), with the
 * low-demand warning. A check of the last few hours is shown again for free. Verified websites and members only (the check's own rules).
 */
export function KeywordStatsCheck({ siteId, keyword, country }: { siteId: string; keyword: string; country?: string }) {
  const { org, can } = useOrgCtx();
  const assess = useAssessKeyword(org.id, siteId);
  const [result, setResult] = useState<KeywordCheck | null>(null);
  const k = keyword.trim().replace(/\s+/g, ' ');
  const shown = result && result.keyword.toLowerCase() === k.toLowerCase() && (!country || result.country === country) ? result : null;
  if (!can('member')) return null;
  const r = shown?.result;
  const low = r ? lowDemandNote(r.volume) : null;
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-3">
      {!r ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Search className="size-3.5" />}
            disabled={k.length < 2 || k.length > 100 || assess.isPending}
            onClick={() => assess.mutate({ keyword: k, ...(country ? { country } : {}) }, { onSuccess: setResult })}
          >
            {assess.isPending ? 'Checking...' : 'See searches and difficulty'}
          </Button>
          <span className="text-xs text-ink-3">How many people search it and how hard it is for your website. About {PRICES.check()}, usually 5-20 seconds.</span>
        </div>
      ) : (
        <div aria-live="polite">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs text-ink-3">Searches a month</dt>
              <dd className="mt-0.5 font-display text-base font-semibold text-ink">{r.volume == null ? 'Unknown' : compactNumber(r.volume)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-ink-3">Difficulty for your site</dt>
              <dd className="mt-1">{r.difficultyForYou ? <DifficultyBadge difficulty={r.difficultyForYou} /> : <span className="text-ink-2">Not rated</span>}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-ink-3">{r.position != null ? 'Your position now' : 'Difficulty (any site)'}</dt>
              <dd className="mt-0.5 font-display text-base font-semibold text-ink">{r.position != null ? `#${r.position}` : r.kd == null ? 'Unknown' : `${r.kd} / 100`}</dd>
            </div>
          </dl>
          {low && <WarnLine className="mt-2.5">{low}</WarnLine>}
          {r.navigational && <WarnLine className="mt-2">People who search it are looking for one particular company or website.</WarnLine>}
          {r.fit === 0 && <WarnLine className="mt-2">This looks outside your business: pages far from what you sell rank poorly.</WarnLine>}
          {r.alternatives.length > 0 && <p className="mt-2 text-xs text-ink-3">Keywords to consider instead: {r.alternatives.slice(0, 5).join(', ')}.</p>}
          <p className="mt-2 text-xs text-ink-3">{shown!.cached ? `Checked on ${fmtDate(shown!.createdAt)}: shown again for free.` : `Checked just now (${formatCredits(shown!.credits)}).`}</p>
        </div>
      )}
      {!r && assess.error != null && !isConfirmCancelled(assess.error) && (
        <div className="mt-2">
          {assess.error instanceof ApiRequestError && isCreditRefusal(assess.error) ? (
            <CreditRefusal orgId={org.id} error={assess.error} />
          ) : (
            <Callout tone="warning" title="Could not check this keyword">
              {errorMessage(assess.error)}
            </Callout>
          )}
        </div>
      )}
    </div>
  );
}
