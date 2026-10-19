import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { AlertOctagon, AlertTriangle, Coins, X } from 'lucide-react';
import { formatCredits, isClientRole } from '@seo/shared';
import { ButtonLink } from '@/components/ui/button';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useBilling } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { bannerKey, creditBanner, statusLabel, statusTone } from './status';

// The company's credits wherever its people work (app/docs/CREDITS.md §2): a balance pill in the sidebar and a banner across the
// company's pages when the balance is low, empty or the schedules are paused. Client people of an agency never fetch or see either.

const PILL_TONE = {
  neutral: 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
  accent: 'border-transparent bg-accent-soft text-accent-text',
  good: 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
  warning: 'border-transparent bg-warning-soft text-warning-text',
  serious: 'border-transparent bg-serious-soft text-serious-text',
  critical: 'border-transparent bg-critical-soft text-critical-text',
} as const;

/** "1,240 credits" in the sidebar, toned by the status, linking to Company settings → Credits. */
export function CreditPill({ className }: { className?: string }) {
  const { org, role } = useOrgCtx();
  const client = isClientRole(role);
  const billing = useBilling(org.id, { enabled: !client });
  if (client || !billing.data) return null;
  const b = billing.data;
  const tone = statusTone(b);
  const alert = tone !== 'good' && tone !== 'neutral';
  const label = statusLabel(b);
  return (
    <Link
      to={paths.settings(org.id, 'credits')}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-[13px] font-medium shadow-card transition-colors duration-150 ease-brand',
        PILL_TONE[tone],
        className,
      )}
      aria-label={`Credits: ${formatCredits(b.balance)}, ${label.toLowerCase()}. Open credits`}
      title={label}
    >
      {alert ? (
        tone === 'critical' ? <AlertOctagon className="size-3.5 shrink-0" aria-hidden /> : <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <Coins className="size-3.5 shrink-0 text-ink-3" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate font-mono tabular">{formatCredits(b.balance)}</span>
      {alert && <span className="shrink-0 text-xs">{label}</span>}
    </Link>
  );
}

const readDismissed = (key: string) => {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const writeDismissed = (key: string) => {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    /* storage blocked: the banner is hidden for this page view only */
  }
};

/** The banner across the company's pages (not on the Credits tab itself, which says the same thing in its hero). */
export function CreditBanner() {
  const { org, role, can } = useOrgCtx();
  const loc = useLocation();
  const client = isClientRole(role);
  const billing = useBilling(org.id, { enabled: !client });
  const [hidden, setHidden] = useState<string | null>(null);
  if (client || !billing.data) return null;
  const b = billing.data;
  const banner = creditBanner(b);
  if (!banner) return null;
  if (loc.pathname.startsWith(paths.settings(org.id, 'credits'))) return null;
  const key = bannerKey(org.id, b.status);
  if (hidden === key || readDismissed(key)) return null;
  const critical = banner.tone === 'critical';
  return (
    <div
      role={critical ? 'alert' : 'status'}
      className={cn(
        'mb-6 flex animate-fade-in gap-3 rounded-xl border px-4 py-3',
        critical ? 'border-critical-text/20 bg-critical-soft' : 'border-warning-text/20 bg-warning-soft',
      )}
    >
      <span className="mt-0.5 shrink-0">
        {critical ? <AlertOctagon className="size-4 text-critical-text" aria-hidden /> : <AlertTriangle className="size-4 text-warning-text" aria-hidden />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <p className="font-medium text-ink">{banner.title}</p>
          <p className="mt-0.5 text-ink-2">
            {banner.body} <span className="whitespace-nowrap">Balance: {formatCredits(b.balance)}.</span>
          </p>
        </div>
        {can('member') && (
          <ButtonLink to={paths.settings(org.id, 'credits')} size="sm" variant={critical ? 'primary' : 'secondary'} className="shrink-0 self-start sm:self-center">
            {can('admin') ? 'Buy credits' : 'See credits'}
          </ButtonLink>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          writeDismissed(key);
          setHidden(key);
        }}
        className="-mt-0.5 -mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors duration-150 ease-brand hover:bg-surface/60 hover:text-ink"
        aria-label="Dismiss this notice for now"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
