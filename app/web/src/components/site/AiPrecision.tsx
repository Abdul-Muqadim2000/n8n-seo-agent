// B8-7 (benchmark area 8): what a question panel and a cadence can measure, before the owner pays for it. The figures are the 95%
// half-widths of the engine's own Wilson range at each panel size, with and without the daily pulse, from the latest run's measured
// sample when there is one (app/shared/src/ai-visibility.ts aiPrecisionTable).
import { aiPrecisionTable, type AiEngine } from '@seo/shared';
import { cn } from '@/lib/utils';

export interface AiMeasuredSample {
  samples: number;
  pulseSamples: number;
  questions: number;
  checkedAt?: string;
}

const pts = (v: number | null) => (v == null ? '–' : `±${Math.round(v)} pts`);

export function AiPrecisionTable({ panel, engines, pulse, measured, className }: { panel: number; engines: readonly AiEngine[]; pulse: boolean; measured?: AiMeasuredSample | null; className?: string }) {
  const t = aiPrecisionTable({ panel, engines, pulse, measured });
  const panels = [...new Set(t.rows.map((r) => r.panel))];
  const cell = (p: number, cadence: 'weekly' | 'weekly_pulse') => t.rows.find((r) => r.panel === p && r.cadence === cadence);
  const cadences: ('weekly' | 'weekly_pulse')[] = t.pulseAvailable ? ['weekly', 'weekly_pulse'] : ['weekly'];
  return (
    <div className={cn('rounded-lg border border-line p-3', className)}>
      <p className="text-[13px] font-medium text-ink">How precise the figures can be</p>
      <p className="mt-0.5 text-xs text-ink-3">
        AI answers change from one ask to the next, so every rate is a range. This is how far “named in” can be off at 95%, for the whole panel and for one question,
        at its widest (a rate near 50%; rates near 0% or 100% are tighter).
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">95% precision by panel size and cadence</caption>
          <thead>
            <tr className="text-ink-3">
              <th scope="col" className="border-b border-line px-2 py-1.5 text-left font-medium">Questions</th>
              {cadences.map((c) => (
                <th key={c} scope="col" className="border-b border-line px-2 py-1.5 text-right font-medium">
                  {c === 'weekly' ? 'Weekly check only' : 'With the daily pulse'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {panels.map((p) => (
              <tr key={p} className="border-b border-line last:border-0">
                <th scope="row" className="px-2 py-1.5 text-left font-normal text-ink-2">
                  {p}
                </th>
                {cadences.map((c) => {
                  const r = cell(p, c);
                  return (
                    <td key={c} className={cn('px-2 py-1.5 text-right tabular', r?.current ? 'font-semibold text-accent-text' : 'text-ink-2')}>
                      {r ? (
                        <>
                          <span title={`${r.answers} answers a week`}>{pts(r.headline)} overall</span>
                          <span className="block text-ink-3">{r.perQuestionEnough ? `${pts(r.perQuestion)} a question` : 'too few a question'}</span>
                          {r.current && <span className="block text-[11px] font-medium">your setting</span>}
                        </>
                      ) : (
                        '–'
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-ink-3">
        {t.basis === 'measured' ? 'Measured: ' : 'Modelled: '}
        {t.why.replace(/^(measured|modelled)( on| before any run)?:?\s*/, '')}.
      </p>
    </div>
  );
}
