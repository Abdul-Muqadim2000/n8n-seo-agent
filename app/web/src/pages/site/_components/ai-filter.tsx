// AI visibility wave 2 (W2-A, 2026-10-23): one filter bar that scopes the whole AI visibility page (engine, topic, buyer role, market,
// stage, dates), kept in the page's URL so a filtered view can be shared or bookmarked, the CSV downloads (built on the server for the
// same filter), and the figures of the filtered slice with their 95% range and its own trend.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { Download, Filter, X } from 'lucide-react';
import { AI_EXPORT_KINDS, AI_EXPORT_LABEL, AI_FILTER_DIMS, AI_FILTER_EMPTY, AI_FILTER_LABEL, AI_MIN_RATE_SAMPLES, aiFilterFrom, aiFilterQuery, titleCase, type AiData, type AiFilter, type AiFilterDim, type AiScope } from '@seo/shared';
import { aiExportUrl } from '@/lib/queries';
import { cn, fmtDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/overlay';
import { Card } from '@/components/ui/card';
import { engineLabel, sortEngines } from './ai';
import { useSitePage } from './kit';
import { pct } from './format';
import { RangeTrendChart } from './ai-trends';

/** The page's filter, read from and written to the URL (?engine=&cluster=&persona=&market=&stage=&from=&to=). */
export function useAiFilter(): [AiFilter, (patch: Partial<AiFilter>) => void, () => void] {
  const [params, setParams] = useSearchParams();
  const filter = useMemo(() => aiFilterFrom(params), [params]);
  const set = useCallback(
    (patch: Partial<AiFilter>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const clear = useCallback(() => set({ ...AI_FILTER_EMPTY }), [set]);
  return [filter, set, clear];
}

/** The choices for each dimension, from the panel as stored and the engines of the latest run. */
export function filterOptions(d: AiData): Record<AiFilterDim, string[]> {
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    engine: sortEngines([...(d.latest?.engines.map((e) => e.key) ?? []), ...(d.answerResults ?? []).map((r) => r.engine)]),
    cluster: uniq(d.prompts.map((p) => p.cluster || p.topic)),
    persona: uniq(d.prompts.map((p) => p.persona)),
    market: uniq(d.prompts.map((p) => p.market)),
    stage: uniq(d.prompts.map((p) => p.stage)),
  };
}

const optionLabel = (dim: AiFilterDim, v: string, names: Record<string, string>) => (dim === 'engine' ? names[v] ?? engineLabel(v) : dim === 'stage' ? titleCase(v) : v);

/** Downloads a CSV the server builds for this filter (same-origin GET with the session cookie; the server names the file). */
function download(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function AiFilterBar({ d, filter, onChange, onClear, engineNames }: { d: AiData; filter: AiFilter; onChange: (p: Partial<AiFilter>) => void; onClear: () => void; engineNames: Record<string, string> }) {
  const { org, site, role } = useSitePage();
  const opts = filterOptions(d);
  const active = Object.values(filter).filter(Boolean).length;
  const dateErr = filter.from && filter.to && filter.from > filter.to ? 'The start is after the end' : undefined;
  const canDownload = !String(role).startsWith('client');
  return (
    <Card className="p-3 sm:p-4" aria-label="Filter the AI visibility page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <Filter className="size-4 text-accent-text" aria-hidden />
          Filter this page
          {active > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">{active} on</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {active > 0 && (
            <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={onClear}>
              Clear filters
            </Button>
          )}
          {canDownload && (
            <Menu
              trigger={
                <Button size="sm" variant="secondary" icon={<Download className="size-4" />}>
                  Download CSV
                </Button>
              }
            >
              <MenuLabel>{active ? 'For the filter set above' : 'Everything stored'}</MenuLabel>
              {AI_EXPORT_KINDS.map((k) => (
                <MenuItem key={k} onSelect={() => download(aiExportUrl(org.id, site.id, k, aiFilterQuery(filter)))}>
                  {AI_EXPORT_LABEL[k]}
                </MenuItem>
              ))}
            </Menu>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7">
        {AI_FILTER_DIMS.map((dim) => (
          <Field key={dim} label={AI_FILTER_LABEL[dim]} className="min-w-0">
            {(p) => (
              <Select {...p} value={filter[dim]} disabled={!opts[dim].length && !filter[dim]} onChange={(e) => onChange({ [dim]: e.target.value })}>
                <option value="">{dim === 'engine' ? 'All engines' : 'All'}</option>
                {[...new Set([...opts[dim], ...(filter[dim] ? [filter[dim]] : [])])].map((v) => (
                  <option key={v} value={v}>
                    {optionLabel(dim, v, engineNames)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ))}
        <Field label="From" className="min-w-0" error={dateErr}>
          {(p) => <Input {...p} type="date" value={filter.from} max={filter.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />}
        </Field>
        <Field label="To" className="min-w-0">
          {(p) => <Input {...p} type="date" value={filter.to} min={filter.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />}
        </Field>
      </div>
      {active > 0 && (
        <p className="mt-2 text-xs text-ink-3">
          Charts and run tables show the dates chosen. The answers, questions and the figures below are the {filter.to ? `newest run on or before ${fmtDate(filter.to)}` : 'latest run'}
          {filter.engine || filter.cluster || filter.persona || filter.market || filter.stage ? ', only the answers in the filter' : ''}.
        </p>
      )}
    </Card>
  );
}

/** The filtered slice: its rates with their 95% range (never a bare rate under 12 answers) and, for one dimension, its trend. */
export function ScopePanel({ scope, engineNames }: { scope: AiScope; engineNames: Record<string, string> }) {
  const dims = AI_FILTER_DIMS.filter((k) => scope.filter[k]);
  if (!dims.length) return null;
  const s = scope.summary;
  const label = dims.map((k) => `${AI_FILTER_LABEL[k]}: ${optionLabel(k, scope.filter[k], engineNames)}`).join(' · ');
  const rate = (r: number | null, ci: [number, number] | null) => (s && s.enough && r != null ? `${pct(r)}${ci ? ` (95% range ${pct(ci[0], 0)} to ${pct(ci[1], 0)})` : ''}` : 'too few answers');
  return (
    <Card className="p-4" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Filtered view</p>
      <p className="mt-0.5 font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">{label}</p>
      {s ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-ink-3">Named in</dt>
            <dd className="font-medium text-ink">{rate(s.namedRate, s.namedCi)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Your pages cited</dt>
            <dd className="font-medium text-ink">{rate(s.citedRate, s.citedCi)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Answers counted</dt>
            <dd className="font-medium tabular text-ink">
              {s.answered} of {s.answers} · {s.questions} {s.questions === 1 ? 'question' : 'questions'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Named most instead</dt>
            <dd className="truncate font-medium text-ink" title={s.topRivals.map((r) => r.name).join(', ')}>
              {s.topRivals.slice(0, 3).map((r) => r.name).join(', ') || '-'}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-[13px] text-ink-3">No answers were read for this view.</p>
      )}
      {s && !s.enough && <p className="mt-2 text-xs text-ink-3">Under {AI_MIN_RATE_SAMPLES} answers a rate says more about which answers were drawn than about you, so none is shown.</p>}
      {scope.segment && scope.trend.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-[13px] font-medium text-ink">{label} over time</p>
          <RangeTrendChart
            runs={scope.trend.map((t) => ({ runId: t.runId, checkedAt: t.checkedAt, compare: t.comparable ? null : { comparable: false, reason: t.reason } }))}
            values={(i) => ({ value: scope.trend[i].rate, band: scope.trend[i].ci })}
            label="Named in"
            height={200}
          />
        </div>
      )}
      {scope.note && <p className={cn('mt-2 text-xs text-ink-3')}>{scope.note}</p>}
    </Card>
  );
}
