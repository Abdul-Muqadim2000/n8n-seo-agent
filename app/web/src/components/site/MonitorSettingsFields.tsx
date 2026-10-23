import { useEngineCal } from '@/lib/engine-cal';
import { useCycleDay } from '@/lib/cycle-day';
import { PRICES } from '@/lib/prices';
import { creditsLabel, formatCredits, toCredits } from '@/lib/credits';
import { useId, type ReactNode } from 'react';
import { Bot, Gauge, Link2, Send, Wallet } from 'lucide-react';
import {
  AI_ENGINES,
  AI_PROMPTS_MAX,
  AI_PULSE_ENGINES,
  CRAWL_PAGE_OPTIONS,
  AI_PAGES_MAX,
  autopilotRows,
  estimateAiPanelCost,
  estimateAiVisibilityCost,
  monitorSettingsSchema,
  type AiEngine,
  type AutopilotPlan,
  type MonitorSettings,
} from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { AiPrecisionTable, type AiMeasuredSample } from '@/components/site/AiPrecision';
import { Checkbox, Field, Select } from '@/components/ui/field';
import { Segmented, SwitchRow } from '@/components/ui/tabs';
import { TagInput } from '@/components/ui/tag-input';
import { cn } from '@/lib/utils';
import { IconTile } from '@/components/ui/icon-tile';

// The growth monitors of a website (seo_monitors): AI visibility, backlink monitor and the monthly technical audit, with a live
// monthly estimate in credits (credits (app/docs/CREDITS.md): the schedules' rows of shared autopilotRows, priced with the company's rate).

export const DEFAULT_MONITORS: MonitorSettings = monitorSettingsSchema.parse({});

/** Fills in any missing field (settings from the server may be partial). */
export function completeMonitors(m: Partial<MonitorSettings> | null | undefined): MonitorSettings {
  const engines = (m?.aiEngines ?? DEFAULT_MONITORS.aiEngines).filter((e): e is AiEngine => AI_ENGINES.some((x) => x.value === e));
  return {
    aiVisibility: m?.aiVisibility ?? DEFAULT_MONITORS.aiVisibility,
    aiEngines: engines,
    aiPromptsMax: Math.min(AI_PROMPTS_MAX, Math.max(3, m?.aiPromptsMax ?? DEFAULT_MONITORS.aiPromptsMax)),
    aiPulse: m?.aiPulse ?? DEFAULT_MONITORS.aiPulse,
    aiPersonas: m?.aiPersonas ?? [],
    aiMarkets: m?.aiMarkets ?? [],
    aiPulseMode: m?.aiPulseMode ?? DEFAULT_MONITORS.aiPulseMode,
    aiPulsePerWeek: m?.aiPulsePerWeek ?? DEFAULT_MONITORS.aiPulsePerWeek,
    aiGrowth: m?.aiGrowth ?? DEFAULT_MONITORS.aiGrowth,
    aiPagesPerMonth: Math.min(AI_PAGES_MAX, Math.max(0, m?.aiPagesPerMonth ?? DEFAULT_MONITORS.aiPagesPerMonth)),
    backlinks: m?.backlinks ?? DEFAULT_MONITORS.backlinks,
    linkBuilder: m?.linkBuilder ?? DEFAULT_MONITORS.linkBuilder,
    auditMonthly: m?.auditMonthly ?? DEFAULT_MONITORS.auditMonthly,
    auditPages: m?.auditPages ?? DEFAULT_MONITORS.auditPages,
    auditJs: m?.auditJs ?? DEFAULT_MONITORS.auditJs,
    brandNames: m?.brandNames ?? [],
  };
}

const JS_MAX_PAGES = 500;
const PROMPT_OPTIONS = [3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500];

export function MonitorSettingsFields({
  value,
  onChange,
  disabled,
  showBrandNames = true,
  enginesError,
  aiMeasured,
}: {
  value: MonitorSettings;
  onChange: (v: MonitorSettings) => void;
  disabled?: boolean;
  showBrandNames?: boolean;
  enginesError?: string;
  /** B8-7: the latest AI visibility run's own sample, so the precision table is measured rather than modelled */
  aiMeasured?: AiMeasuredSample | null;
}) {
  useEngineCal();   // R99 / R100: re-render with the engine's own prices once they arrive
  const day = useCycleDay();
  const everyDay = day.name ? `Every ${day.name}` : 'Each week';
  const set = (patch: Partial<MonitorSettings>) => onChange({ ...value, ...patch });
  const enginesId = useId();

  return (
    <fieldset disabled={disabled} className="min-w-0 divide-y divide-line rounded-xl border border-line px-4">
      <MonitorRow icon={<Bot />} on={value.aiVisibility}>
      <SwitchRow
        title="AI visibility"
        description={`Your buyer questions asked on AI assistants and Google's AI answers: whether you are named or cited, who is named instead, how AI describes you, which sources it trusts, whether AI crawlers can read your site and what AI visits are worth (GA4). Full run ${day.every}.`}
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
              <Field label="Questions tracked" hint="Up to 500. More questions give a fuller picture of your market; new ones are written per buyer role and market from real AI searches, Google's &quot;People also ask&quot;, your Search Console queries and your competitors' topics." className="max-w-xs">
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
              <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                <Field label="Buyer roles" optional hint="Who asks: the panel is written for each role (e.g. CFO, IT manager). Empty: the engine picks." labelAction={<GuideButton id="ai-buyer-roles" variant="link" label="Which roles?" />}>
                  {(p) => <TagInput id={p.id} describedBy={p['aria-describedby']} value={value.aiPersonas} onChange={(aiPersonas) => set({ aiPersonas })} max={6} normalize={(s) => s.replace(/\s+/g, ' ').trim().slice(0, 40)} placeholder="A buyer role, then Enter" />}
                </Field>
                <Field label="Other markets" optional hint="Countries (and languages) to ask in besides your own, e.g. SA-en or AE-ar." labelAction={<GuideButton id="ai-markets" variant="link" label="How do I write these?" />}>
                  {(p) => (
                    <TagInput id={p.id} describedBy={p['aria-describedby']} value={value.aiMarkets} onChange={(aiMarkets) => set({ aiMarkets: aiMarkets.filter((m) => /^[A-Za-z]{2}([-_ ][A-Za-z]{2,3})?$/.test(m)) })} max={5}
                      normalize={(s) => { const m = s.trim().replace(/[_\s]+/g, '-').match(/^([A-Za-z]{2})(?:-([A-Za-z]{2,3}))?$/); return m ? m[1].toUpperCase() + '-' + (m[2] || 'en').toLowerCase() : s.trim(); }} placeholder="e.g. SA-en, then Enter" />
                  )}
                </Field>
              </div>
              <Checkbox
                label="Daily AI pulse"
                description={`Asks your questions on ${AI_PULSE_ENGINES.filter((e) => value.aiEngines.includes(e)).map((e) => AI_ENGINES.find((x) => x.value === e)!.label).join(', ') || 'the fast engines'} each day except ${day.name ?? 'the day of your weekly run'} (about ${creditsLabel(estimateAiVisibilityCost({ prompts: value.aiPromptsMax, engines: value.aiEngines, pulse: true, pulseMode: value.aiPulseMode, pulsePerWeek: value.aiPulsePerWeek }).pulse)} a month). Up to 50 questions it asks every one every morning; a bigger panel is asked as a rotating sample that covers every topic and buyer role each morning. AI answers change between asks: daily answers give steadier numbers and a same-day alert when something really changes.`}
                checked={value.aiPulse}
                disabled={disabled || !AI_PULSE_ENGINES.some((e) => value.aiEngines.includes(e))}
                onChange={(e) => set({ aiPulse: e.target.checked })}
              />
              {value.aiPulse && value.aiPromptsMax > 50 && (
                <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                  <Field label="Pulse sampling">
                    {(p) => (
                      <Select {...p} value={value.aiPulseMode} onChange={(e) => set({ aiPulseMode: e.target.value as MonitorSettings['aiPulseMode'] })}>
                        <option value="auto">Automatic (rotating sample above 50 questions)</option>
                        <option value="sample">Rotating sample</option>
                        <option value="full">Every question every morning (as far as one morning allows)</option>
                      </Select>
                    )}
                  </Field>
                  {value.aiPulseMode !== 'full' && (
                    <Field label="Mornings a week per question">
                      {(p) => (
                        <Select {...p} value={value.aiPulsePerWeek} onChange={(e) => set({ aiPulsePerWeek: Number(e.target.value) })}>
                          <option value={0}>Automatic (for ±3 points overall, ±8 per topic)</option>
                          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} morning{n === 1 ? '' : 's'} a week</option>)}
                        </Select>
                      )}
                    </Field>
                  )}
                </div>
              )}
              <AiPanelCost value={value} />
              <AiPrecisionTable panel={value.aiPromptsMax} engines={value.aiEngines} pulse={value.aiPulse} pulseMode={value.aiPulseMode} pulsePerWeek={value.aiPulsePerWeek} measured={aiMeasured} />
              <div className="space-y-3 rounded-lg border border-line p-3">
                <Checkbox
                  label="AI growth (weekly)"
                  description={`${everyDay}: sends new and updated pages to Bing and IndexNow, checks your key pages can be read and quoted by AI, lists the pages AI cites without naming you (with outreach drafts) and queues the questions to win.`}
                  checked={value.aiGrowth}
                  disabled={disabled}
                  onChange={(e) => set({ aiGrowth: e.target.checked })}
                />
                {value.aiGrowth && (
                  <Field label="AI answer pages a month" hint={`Suggested by the weekly content run for the questions AI answers without you: a new answer page or a refresh of your page. Written when you approve one, or on its own on full autopilot, at about ${PRICES.page()} each, on top of the pages for your keyword.`} className="max-w-xs">
                    {(p) => (
                      <Select {...p} value={value.aiPagesPerMonth} disabled={disabled} onChange={(e) => set({ aiPagesPerMonth: Number(e.target.value) })}>
                        {[...new Set([0, 1, 2, 3, 4, 6, 8, value.aiPagesPerMonth])].sort((x, y) => x - y).filter((n) => n <= AI_PAGES_MAX).map((n) => (
                          <option key={n} value={n}>
                            {n === 0 ? 'None (only plan them)' : `${n} page${n === 1 ? '' : 's'} a month`}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                )}
              </div>
            </div>
          )
        }
      />
      </MonitorRow>

      <MonitorRow icon={<Link2 />} on={value.backlinks}>
      <SwitchRow
        title="Backlink monitor"
        description="A weekly watch for lost and spammy links. Once a month, a full report: link gap against competitors, broken links to reclaim, unlinked mentions and outreach drafts."
        checked={value.backlinks}
        onCheckedChange={(v) => set({ backlinks: v })}
        disabled={disabled}
      />
      </MonitorRow>

      <MonitorRow icon={<Send />} on={value.linkBuilder}>
      <SwitchRow
        title="Link builder"
        description={`${everyDay}: new link opportunities (journalist requests, dead links to replace, resource pages, lists that leave you out), the right person and the right page of yours, and short e-mail sequences for you to approve. Nothing is sent without your approval, and only from your own mailbox.`}
        checked={value.linkBuilder}
        onCheckedChange={(v) => set({ linkBuilder: v })}
        disabled={disabled}
      />
      </MonitorRow>

      <MonitorRow icon={<Gauge />} on={value.auditMonthly}>
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
      </MonitorRow>

      {showBrandNames && (
        <div className="py-3">
          <Field
            label="Brand names"
            optional
            hint="How AI answers and mentions recognise you. A short name shared with other companies can produce false matches, so list your full brand names."
            labelAction={<GuideButton id="brand-names" variant="link" label="How should I write these?" />}
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

/**
 * G6 (2026-10-18): what this panel uses and buys, BEFORE it is saved, the one formula the engine reserves with (estimateAiPanelCost).
 * credits (app/docs/CREDITS.md): every figure in credits; no per-task provider price or price basis is shown.
 */
function AiPanelCost({ value }: { value: MonitorSettings }) {
  const c = estimateAiPanelCost({ panel: value.aiPromptsMax, engines: value.aiEngines, pulse: value.aiPulse, pulseMode: value.aiPulseMode, pulsePerWeek: value.aiPulsePerWeek });
  const est = c.prices.filter((p) => /estimate/.test(p.basis));
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-3 text-[13px] leading-snug text-ink-2" aria-live="polite">
      <p className="font-medium text-ink">This panel: about {creditsLabel(c.month.total)} a month</p>
      <ul className="mt-1 space-y-0.5">
        <li>Weekly run: {c.requests.weekly.toLocaleString('en-GB')} answers, {creditsLabel(c.run.weekly.usd)}{c.executions > 1 ? ` (asked in ${c.executions} parts)` : ''}; the month&apos;s full run (Claude, the brand question, the market-wide index) {creditsLabel(c.run.full.usd)}</li>
        <li>{c.perWeek ? `Daily pulse: ${c.pulseQuestionsDay} questions a morning${c.perWeek < 6 ? `, each asked ${c.perWeek}× a week` : ''}, ${creditsLabel(c.pulseDay.usd)} a morning` : 'Daily pulse: off'}</li>
        <li>Precision at 95%: ±{c.halfWidth.headline} points on the headline, ±{c.halfWidth.cluster} on a 12-question topic</li>
      </ul>
      {c.pulseCapped && <p className="mt-1 text-xs text-ink-3">{c.pulseWhy}.</p>}
      {est.length > 0 && <p className="mt-1 text-xs text-ink-3">{est.map((p) => AI_ENGINES.find((e) => e.value === p.engine)?.label ?? p.engine).join(' and ')}: an estimate until the first run measures it.</p>}
    </div>
  );
}

/** A monitor's switch row with its icon tile (brand tint while on, neutral while off). */
function MonitorRow({ icon, on, children }: { icon: ReactNode; on: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <IconTile size="sm" tone={on ? 'blue' : 'neutral'} className="mt-3 transition-colors duration-200 ease-brand">
        {icon}
      </IconTile>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * The schedules' monthly estimate with its breakdown, in credits (credits (app/docs/CREDITS.md)): the rows of shared `autopilotRows`,
 * the same rows the Credits page's forecast and the server's reserve for the schedules use, each turned into credits.
 */
export function MonitoringCost({ monitors, blogsPerWeek, plan, className }: { monitors: MonitorSettings; blogsPerWeek: number; plan?: AutopilotPlan; className?: string }) {
  useEngineCal();   // re-render with the company's credit rate once it arrives
  // B4: with the website's plan (level, keyword pages, rank checks) this is the Credits page's figure for the website
  const rows = autopilotRows(monitors, blogsPerWeek, plan);
  const totalUsd = rows.reduce((t, r) => t + r.usd, 0);
  const total = toCredits(totalUsd);
  return (
    <div className={cn('rounded-xl border border-line bg-surface', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h4 className="flex items-center gap-2.5 text-sm font-semibold text-ink">
          <IconTile size="sm">
            <Wallet />
          </IconTile>
          Estimated credits a month
        </h4>
        <p className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink" aria-live="polite">
          {formatCredits(total, { unit: false })}
          <span className="ml-1 text-sm font-normal text-ink-3">credits / month</span>
        </p>
      </div>
      <div className="overflow-x-auto px-4 pb-3 pt-2">
        <table className="w-full text-sm">
          <caption className="sr-only">Credits a month by schedule</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <td className="py-2 pr-3">
                  <span className={cn('block', r.on ? 'text-ink' : 'text-ink-3')}>{r.label}</span>
                  <span className="block text-xs text-ink-3">{r.detail}</span>
                  {r.on && totalUsd > 0 && (
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <span className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-brand" style={{ width: `${Math.max(2, Math.min(100, (r.usd / totalUsd) * 100))}%` }} />
                    </span>
                  )}
                </td>
                <td className={cn('whitespace-nowrap py-2 text-right tabular', r.on ? 'text-ink' : 'text-ink-3')}>{r.on ? creditsLabel(r.usd) : 'Off'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-3">
        Estimates in credits, from live runs; usually less is used because data that has not changed is reused. Settings, then Credits, shows what was really used. Analyses you start yourself use credits separately.
      </p>
    </div>
  );
}
