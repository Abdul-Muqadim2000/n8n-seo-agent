import { KI_VERDICT_TONE, KI_VERDICTS, kiGateWords as sharedGateWords, type KiVerdict as Verdict } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// KI (2026-11-08, DESIGN.md §6): the ONE verdict of the Competitors and Keyword research pages: Go / Takes a few months / Hard for your
// website now / Not for you / Not judged yet, with the one tone map of shared/ki.ts. The word is always shown (colour is never the only
// signal), and a gated row says why. Only these two pages use it until the owner decides K5 (the rest of the app keeps its own words for now).

/**
 * Why a gated row is not for this business, in plain words. FX-A (review CONSISTENCY M3): ONE map, shared `KI_GATE_WORDS` keyed by the
 * engine's reason codes (FX-L: `gate_reason` is a code, `gate_detail` the engine's sentence). A plain sentence the server already turned into
 * words is kept; anything else is matched to a code or gets the general line, so engine detail never reaches the screen.
 */
export function kiGateWords(reason: string | null | undefined, code?: string | null): string {
  const r = String(reason ?? '').trim();
  const w = sharedGateWords(r, code);
  return w;
}

export function KiVerdict({ verdict, reason, size = 'md', className }: { verdict: Verdict; reason?: string | null; size?: 'sm' | 'md'; className?: string }) {
  const why = verdict === 'gated' ? kiGateWords(reason) : reason?.trim() || null;
  return (
    <span className={cn('inline-flex min-w-0 flex-col items-start gap-0.5', className)} data-verdict={verdict}>
      <StatusBadge tone={KI_VERDICT_TONE[verdict]} className={size === 'sm' ? 'h-5 px-1.5' : undefined}>
        {KI_VERDICTS[verdict]}
      </StatusBadge>
      {why && <span className={cn('text-xs leading-snug text-ink-3', size === 'sm' && 'line-clamp-2')}>{why}</span>}
    </span>
  );
}
