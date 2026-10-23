// F3 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/APP_AUDIT.md A1): a change on the AI visibility screens is drawn only for a
// comparable pair of runs (the engine's compare_json, or the app's like-for-like rule on older rows), coloured only when a test called
// it real; otherwise it is greyed ("within noise" / "not tested") or replaced by the reason it was not compared. One component, so the
// hero, the metric cards and the Overview tile cannot disagree. Kept small and data-driven for the later UX build-out.
import { aiChangeOf, type AiCompare, type AiCompareMetricKey } from '@seo/shared';
import { Delta } from '@/components/ui/misc';

export const VERDICT_WORDS: Record<'real' | 'noise' | 'untested', string> = {
  real: 'a real change at 95%',
  noise: 'within noise',
  untested: 'not tested',
};

/** The change of one figure against the previous comparable run, or nothing when the runs are not comparable. */
export function AiDelta({ compare, metric, suffix = ' pts', digits = 1, upIsGood = true }: { compare: AiCompare | null | undefined; metric: AiCompareMetricKey; suffix?: string; digits?: number; upIsGood?: boolean }) {
  const c = aiChangeOf(compare, metric);
  if (c.verdict === 'none' || c.delta == null) return null;
  return <Delta value={c.delta} suffix={suffix} digits={digits} upIsGood={upIsGood} neutral={c.verdict !== 'real'} label={c.verdict === 'real' ? undefined : VERDICT_WORDS[c.verdict]} />;
}

/** One sentence on what the change is measured against, or why there is none. */
export function compareNote(compare: AiCompare | null | undefined, fmt: (iso: string) => string): string | null {
  if (!compare) return null;
  if (!compare.comparable) return compare.reason;
  const at = compare.previousAt ? fmt(compare.previousAt) : 'the previous run';
  return `Changes are in percentage points against the run of ${at}. A coloured arrow is a change a test called real at 95%; a grey one is within the noise or not tested.`;
}

/** The hero headline: how often AI names you, and the change only when it is comparable and real. */
export function aiHeadline(rate: number | null, compare: AiCompare | null | undefined, fallback?: string): string {
  if (rate == null) return fallback || 'Your latest AI visibility report';
  const c = aiChangeOf(compare, 'named_rate');
  const d = c.delta;
  const change = d == null || c.verdict === 'none' ? '' : c.verdict !== 'real' ? (Math.abs(d) < 0.05 ? ', no change' : ', no real change') : d > 0 ? `, up ${d.toFixed(1)} pts` : `, down ${Math.abs(d).toFixed(1)} pts`;
  if (rate <= 0) return `You're not named in AI answers yet${change}`;
  return `You're named in ${rate.toFixed(1).replace(/\.0$/, '')}% of AI answers${change}`;
}
