import { useId } from 'react';
import {
  AI_ENGINES,
  AI_PROMPTS_MAX,
  AI_PULSE_ENGINES,
  CRAWL_PAGE_OPTIONS,
  estimateAiVisibilityCost,
  estimateMonitoringCost,
  formatUsd,
  MONITOR_COSTS,
  monitorSettingsSchema,
  type AiEngine,
  type MonitorSettings,
} from '@seo/shared';
import { Checkbox, Field, Select } from '@/components/ui/field';
import { Segmented, SwitchRow } from '@/components/ui/tabs';
import { TagInput } from '@/components/ui/tag-input';
import { cn } from '@/lib/utils';

// The growth monitors of a website (seo_monitors): AI visibility, backlink monitor and the monthly technical audit, with a live
// monthly cost estimate (MONITOR_COSTS, measured on live runs).

export const DEFAULT_MONITORS: MonitorSettings = monitorSettingsSchema.parse({});

/** Fills in any missing field (settings from the server may be partial). */
export function completeMonitors(m: Partial<MonitorSettings> | null | undefined): MonitorSettings {
  const engines = (m?.aiEngines ?? DEFAULT_MONITORS.aiEngines).filter((e): e is AiEngine => AI_ENGINES.some((x) => x.value === e));
  return {
    aiVisibility: m?.aiVisibility ?? DEFAULT_MONITORS.aiVisibility,
    aiEngines: engines,
    aiPromptsMax: Math.min(AI_PROMPTS_MAX, Math.max(3, m?.aiPromptsMax ?? DEFAULT_MONITORS.aiPromptsMax)),
    aiPulse: m?.aiPulse ?? DEFAULT_MONITORS.aiPulse,
    backlinks: m?.backlinks ?? DEFAULT_MONITORS.backlinks,
    auditMonthly: m?.auditMonthly ?? DEFAULT_MONITORS.auditMonthly,
    auditPages: m?.auditPages ?? DEFAULT_MONITORS.auditPages,
    auditJs: m?.auditJs ?? DEFAULT_MONITORS.auditJs,
    brandNames: m?.brandNames ?? [],
  };
}

const JS_MAX_PAGES = 500;
const PROMPT_OPTIONS = [3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50];

export function MonitorSettingsFields({
  value,
  onChange,
  disabled,
  showBrandNames = true,
  enginesError,
}: {
  value: MonitorSettings;
  onChange: (v: MonitorSettings) => void;
  disabled?: boolean;
  showBrandNames?: boolean;
  enginesError?: string;
}) {
  const set = (patch: Partial<MonitorSettings>) => onChange({ ...value, ...patch });
  const enginesId = useId();

  return (
    <fieldset disabled={disabled} className="divide-y divide-line rounded-xl border border-line px-4">
      <SwitchRow
        title="AI visibility"
        description="Your buyer questions asked on AI assistants and Google's AI answers: whether you are named or cited, who is named instead, how AI describes you, which sources it trusts, whether AI crawlers can read your site and what AI visits are worth (GA4). Full run every Monday."
        checked={value.aiVisibility}
        onCheckedChange={(v) => set({ aiVisibility: v })}
        disabled={disabled}
        extra={
          value.aiVisibility && (
            <div className="mt-3 space-y-4">
              <fieldset aria-describedby={enginesError ? `${enginesId}-err` : undefined}>
                <legend className="mb-2 text-[13px] font-medium text-ink">Engines to ask</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AI_ENGINES.map((e) => (
                    <Checkbox
                      key={e.value}
                      label={e.label}
                      checked={value.aiEngines.includes(e.value)}
                      disabled={disabled}
                      onChange={(ev) =>
                        set({
                          aiEngines: ev.target.checked
                            ? AI_ENGINES.map((x) => x.value).filter((x) => x === e.value || value.aiEngines.includes(x))
                            : value.aiEngines.filter((x) => x !== e.value),
                        })
                      }
                    />
                  ))}
                </div>
                {enginesError ? (
                  <p id={`${enginesId}-err`} role="alert" className="mt-1.5 text-[13px] text-critical-text">
                    {enginesError}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-ink-3">Claude is asked once a month to keep the weekly run cheap.</p>
                )}
              </fieldset>
              <Field label="Questions tracked" hint="More questions give a fuller picture of your market; new ones come from real AI searches and your Search Console queries." className="max-w-xs">
                {(p) => (
                  <Select {...p} value={value.aiPromptsMax} disabled={disabled} onChange={(e) => set({ aiPromptsMax: Number(e.target.value) })}>
                    {[...new Set([...PROMPT_OPTIONS, value.aiPromptsMax])].sort((x, y) => x - y).filter((n) => n <= AI_PROMPTS_MAX).map((n) => (
                      <option key={n} value={n}>
                        {n} questions
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Checkbox
                label="Daily AI pulse"
                description={`Asks every question on ${AI_PULSE_ENGINES.filter((e) => value.aiEngines.includes(e)).map((e) => AI_ENGINES.find((x) => x.value === e)!.label).join(', ') || 'the fast engines'} each day except Monday (about ${formatUsd(estimateAiVisibilityCost({ prompts: value.aiPromptsMax, engines: value.aiEngines, pulse: true }).pulse)} a month). AI answers change between asks: daily answers give steadier numbers and a same-day alert when something really changes.`}
                checked={value.aiPulse}
                disabled={disabled || !AI_PULSE_ENGINES.some((e) => value.aiEngines.includes(e))}
                onChange={(e) => set({ aiPulse: e.target.checked })}
              />
            </div>
          )
        }
      />

      <SwitchRow
        title="Backlink monitor"
        description="A weekly watch for lost and spammy links. Once a month, a full report: link gap against competitors, broken links to reclaim, unlinked mentions and outreach drafts."
        checked={value.backlinks}
        onCheckedChange={(v) => set({ backlinks: v })}
        disabled={disabled}
      />

      <SwitchRow
        title="Monthly technical audit"
        description="On the 1st of each month: a crawl, health score, what changed since the last audit and a fix pack. Skipped when your sitemap has not changed (at most 60 days)."
        checked={value.auditMonthly}
        onCheckedChange={(v) => set({ auditMonthly: v })}
        disabled={disabled}
        extra={
          value.auditMonthly && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink">Pages to crawl</p>
                <Segmented
                  value={String(value.auditPages)}
                  onChange={(v) => {
                    const pages = Number(v);
                    set({ auditPages: pages, auditJs: pages > JS_MAX_PAGES ? false : value.auditJs });
                  }}
                  options={CRAWL_PAGE_OPTIONS.map((n) => ({ value: String(n), label: n }))}
                />
                <p className="mt-1.5 text-[13px] text-ink-3">
                  {value.auditJs ? `JavaScript rendering crawls at most ${JS_MAX_PAGES} pages.` : 'Choose roughly the number of pages your site has.'}
                </p>
              </div>
              <Checkbox
                label="Render JavaScript"
                description="For sites built with React, Vue or similar where content appears only after scripts run. Slower; at most 500 pages."
                checked={value.auditJs}
                disabled={disabled}
                onChange={(e) => set({ auditJs: e.target.checked, auditPages: e.target.checked ? Math.min(value.auditPages, JS_MAX_PAGES) : value.auditPages })}
              />
            </div>
          )
        }
      />

      {showBrandNames && (
        <div className="py-3">
          <Field
            label="Brand names"
            optional
            hint="How AI answers and mentions recognise you. A short name shared with other companies can produce false matches, so list your full brand names."
          >
            {(p) => (
              <TagInput
                id={p.id}
                describedBy={p['aria-describedby']}
                value={value.brandNames}
                onChange={(brandNames) => set({ brandNames })}
                max={10}
                normalize={(s) => s.trim().slice(0, 80)}
                placeholder="Your brand name, then Enter"
              />
            )}
          </Field>
        </div>
      )}
    </fieldset>
  );
}

/** Monthly cost estimate with its breakdown (MONITOR_COSTS) for the chosen monitors and blog posts per week. */
export function MonitoringCost({ monitors, blogsPerWeek, className }: { monitors: MonitorSettings; blogsPerWeek: number; className?: string }) {
  const c = MONITOR_COSTS;
  const total = estimateMonitoringCost({ aiVisibility: monitors.aiVisibility, backlinks: monitors.backlinks, auditMonthly: monitors.auditMonthly, blogsPerWeek, aiPrompts: monitors.aiPromptsMax, aiEngines: monitors.aiEngines, aiPulse: monitors.aiPulse });
  const ai = estimateAiVisibilityCost({ prompts: monitors.aiPromptsMax, engines: monitors.aiEngines, pulse: monitors.aiPulse });
  const rows: { label: string; detail: string; on: boolean; usd: number }[] = [
    { label: 'Weekly site report', detail: 'Search Console, GA4, Google Trends, live rank checks', on: true, usd: c.siteTrackerMonthly },
    { label: 'AI visibility', detail: `${monitors.aiPromptsMax} questions weekly, Claude and the market-wide index monthly`, on: monitors.aiVisibility, usd: ai.weekly + ai.fullRun },
    { label: 'Daily AI pulse', detail: `${monitors.aiPromptsMax} questions a day on the fast engines`, on: monitors.aiVisibility && monitors.aiPulse && ai.pulse > 0, usd: ai.pulse },
    { label: 'Backlink monitor', detail: 'weekly watch, monthly full report', on: monitors.backlinks, usd: c.backlinksMonthly },
    { label: 'Monthly technical audit', detail: `up to ${monitors.auditPages} pages`, on: monitors.auditMonthly, usd: c.auditMonthly },
    {
      label: 'Blog posts',
      detail: blogsPerWeek ? `${blogsPerWeek} a week × ${c.weeksPerMonth} weeks × ${formatUsd(c.blogPostEach)}` : 'none',
      on: blogsPerWeek > 0,
      usd: blogsPerWeek * c.weeksPerMonth * c.blogPostEach,
    },
  ];
  return (
    <div className={cn('rounded-xl border border-line bg-surface', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <h4 className="text-sm font-semibold text-ink">Estimated monthly cost</h4>
        <p className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink" aria-live="polite">
          {formatUsd(total)}
          <span className="ml-1 text-sm font-normal text-ink-3">/ month</span>
        </p>
      </div>
      <div className="overflow-x-auto px-4 pb-3 pt-2">
        <table className="w-full text-sm">
          <caption className="sr-only">Monthly cost by monitor</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-b-0">
                <td className="py-2 pr-3">
                  <span className={cn('block', r.on ? 'text-ink' : 'text-ink-3')}>{r.label}</span>
                  <span className="block text-xs text-ink-3">{r.detail}</span>
                </td>
                <td className={cn('whitespace-nowrap py-2 text-right tabular', r.on ? 'text-ink' : 'text-ink-3')}>{r.on ? formatUsd(r.usd) : 'Off'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-3">
        Estimates from live runs. The real cost is usually lower because data that has not changed is reused. Analyses you start yourself are billed separately.
      </p>
    </div>
  );
}
