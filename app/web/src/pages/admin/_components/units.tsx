// The admin panel's Credits / USD switch (app/docs/CREDITS.md): every credit figure in the panel shows either the credits or the
// dollars behind them — what was paid for credits bought, the list value of credits given or used, what the used work cost us at the
// providers, and what the credits still outstanding are worth and will cost to serve. The choice is the admin's own and is kept in this
// browser (localStorage, in try/catch: a private window simply starts in credits).
import { useSyncExternalStore } from 'react';
import type { CreditBook } from '@seo/shared';
import { Segmented } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { credits, marginPct, money } from '../lib';
import { AdminCard, Num } from './kit';

export type AdminUnits = 'credits' | 'usd';
const KEY = 'alaventra.admin.units';

function read(): AdminUnits {
  try {
    return localStorage.getItem(KEY) === 'usd' ? 'usd' : 'credits';
  } catch {
    return 'credits';
  }
}
let current: AdminUnits = typeof window === 'undefined' ? 'credits' : read();
const listeners = new Set<() => void>();

export function setAdminUnits(u: AdminUnits) {
  current = u;
  try {
    localStorage.setItem(KEY, u);
  } catch {
    /* not kept: this tab still switches */
  }
  listeners.forEach((f) => f());
}

export function useAdminUnits(): [AdminUnits, (u: AdminUnits) => void] {
  const u = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    () => current,
    () => current,
  );
  return [u, setAdminUnits];
}

export function UnitsToggle({ className }: { className?: string }) {
  const [units, setUnits] = useAdminUnits();
  return (
    <Segmented
      className={className}
      size="sm"
      label="Show credit figures in"
      value={units}
      onChange={setUnits}
      options={[
        { value: 'credits', label: 'Credits' },
        { value: 'usd', label: 'USD' },
      ]}
    />
  );
}

/** a credit amount as the switch says: credits, or their dollars at `usdPerCredit` (or an exact dollar figure when one is known) */
export function creditOrUsd(units: AdminUnits, n: number | null | undefined, usd: number | null | undefined): string {
  if (units === 'usd') return money(usd ?? null, { digits: 2 });
  return n == null ? '–' : `${credits(n)} cr`;
}

interface Line {
  label: string;
  hint: string;
  credits: number;
  /** the dollars of this line, and what they mean */
  usd: { label: string; value: number; tone?: 'good' | 'critical' }[];
  tone?: 'muted';
}

/** The book's lines in the order an accountant reads them: in, out, left. */
export function bookLines(b: CreditBook): Line[] {
  const usedMargin = b.usedListUsd - b.usedCostUsd;
  return [
    { label: 'Bought', hint: 'Grants that recorded a payment (packs)', credits: b.bought, usd: [{ label: 'paid', value: b.boughtUsd, tone: 'good' }] },
    { label: 'Plan credits', hint: 'Granted on the 1st by a plan (invoiced outside the panel)', credits: b.plan, usd: [{ label: 'list value', value: b.planListUsd }] },
    { label: 'Given free', hint: 'Welcome credits, promotions, goodwill', credits: b.free, usd: [{ label: 'list value', value: b.freeListUsd }] },
    {
      label: 'Used',
      hint: `Autopilot ${credits(b.usedAutopilot)} · on-demand ${credits(b.usedOnDemand)} credits`,
      credits: b.used,
      usd: [
        { label: 'at list price', value: b.usedListUsd },
        { label: 'cost us', value: b.usedCostUsd },
        { label: 'margin', value: usedMargin, tone: usedMargin < 0 ? 'critical' : 'good' },
      ],
    },
    { label: 'Refunded', hint: 'Given back by an admin', credits: b.refunded, usd: [{ label: 'list value', value: b.refunded * b.creditValueUsd }], tone: 'muted' },
    { label: 'Expired', hint: 'Lots that ran out of time unused', credits: b.expired, usd: [{ label: 'list value', value: b.expiredListUsd }], tone: 'muted' },
    { label: 'Corrections', hint: 'Admin adjustments (net)', credits: b.adjusted, usd: [{ label: 'list value', value: b.adjusted * b.creditValueUsd }], tone: 'muted' },
    { label: 'Absorbed over quotes', hint: 'Beyond what runs were quoted: not charged, the cost was ours', credits: b.absorbed, usd: [{ label: 'list value', value: b.absorbedListUsd }], tone: 'muted' },
    {
      label: 'Remaining now',
      hint: 'The balance today, whatever the period',
      credits: b.remaining,
      usd: [
        { label: 'owed at list price', value: b.remainingListUsd },
        { label: 'will cost us', value: b.remainingCostUsd },
      ],
    },
  ];
}

/** The credit book of a company or of the platform, in credits or in dollars as the switch says. */
export function CreditBookCard({ book, title = 'Credit book', description }: { book: CreditBook; title?: string; description?: string }) {
  const [units] = useAdminUnits();
  const lines = bookLines(book);
  const margin = book.usedListUsd > 0 ? ((book.usedListUsd - book.usedCostUsd) / book.usedListUsd) * 100 : null;
  return (
    <AdminCard
      title={title}
      description={
        description ??
        (units === 'usd'
          ? `In dollars: payments, list value at $${book.creditValueUsd} a credit, and what the work cost us (${book.markup}× markup).`
          : 'Every credit that came in, went out and is left.')
      }
      actions={<UnitsToggle />}
    >
      <table className="w-full text-sm" aria-label={`${title} in ${units === 'usd' ? 'US dollars' : 'credits'}`}>
        <tbody>
          {lines.map((l) => (
            <tr key={l.label} className="border-b border-line last:border-b-0">
              <td className="py-2 pr-3 align-top">
                <span className={cn('block font-medium', l.tone === 'muted' ? 'text-ink-2' : 'text-ink')}>{l.label}</span>
                <span className="block text-xs text-ink-3">{l.hint}</span>
              </td>
              <td className="py-2 text-right align-top">
                {units === 'credits' ? (
                  <Num className={cn('text-ink', l.credits < 0 && 'text-critical-text')}>{credits(l.credits)}</Num>
                ) : (
                  <span className="flex flex-col items-end gap-0.5">
                    {l.usd.map((u) => (
                      <span key={u.label} className="whitespace-nowrap text-[13px]">
                        <Num className={cn(u.tone === 'critical' ? 'text-critical-text' : u.tone === 'good' ? 'text-good-text' : 'text-ink')}>{money(u.value, { digits: 2 })}</Num>{' '}
                        <span className="text-xs text-ink-3">{u.label}</span>
                      </span>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {units === 'usd' && (
        <p className="mt-3 text-xs text-ink-3">
          Margin on the credits used: <Num className="text-ink-2">{marginPct(margin)}</Num> (list value of the usage less what it cost us; capped and failed work count at
          their full cost).
        </p>
      )}
    </AdminCard>
  );
}
