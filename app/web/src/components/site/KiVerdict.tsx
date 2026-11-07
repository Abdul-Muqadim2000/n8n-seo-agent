import { KI_VERDICT_TONE, KI_VERDICTS, type KiVerdict as Verdict } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// KI (2026-11-08, DESIGN.md §6): the ONE verdict of the Competitors and Keyword research pages: Go / Takes a few months / Hard for your
// site now / Not for you, with the one tone map of shared/ki.ts. The word is always shown (colour is never the only signal), and a gated
// row says why. Only these two pages use it until the owner decides K5 (the rest of the app keeps its own words for now).

/** Why a gated row is not for this business, in plain words (the engine's reason codes never reach the screen). */
const GATE_WORDS: Record<string, string> = {
  career: 'People searching this are looking for a job.',
  jobs: 'People searching this are looking for a job.',
  job: 'People searching this are looking for a job.',
  brand: 'This is a search for another company by name.',
  other_brand: 'This is a search for another company by name.',
  navigational: 'People searching this want one particular website.',
  government: 'People searching this want a government service.',
  market: 'This search is about a place outside your market.',
  market_mismatch: 'This search is about a place outside your market.',
  off_service: 'This is not something you sell.',
  fit: 'This is not something you sell.',
};
export function kiGateWords(reason: string | null | undefined): string {
  const r = String(reason ?? '').trim();
  if (!r) return 'This search does not fit what you sell.';
  const key = r.toLowerCase().replace(/[\s-]+/g, '_');
  // the engine may already send a plain sentence; a code is translated, anything else gets the general line
  if (GATE_WORDS[key]) return GATE_WORDS[key];
  return /\s/.test(r) && r.length > 12 ? r.replace(/[.\s]*$/, '.') : 'This search does not fit what you sell.';
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
