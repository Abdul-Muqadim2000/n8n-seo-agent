// AI visibility wave 2 (W2-A, 2026-10-23, WAVE2_CONTRACTS.md §4): the owner's own alert rules on top of the engine's tested alerts.
// A rule fires only on a run compared with the one before it, only when its own test calls the change real, and only when the change
// reaches the owner's size. The form validates with the shared schema and previews how often the rule would have fired on the runs
// already stored; the latest run's evaluation (alerts_rules_json) shows which rules fired and why.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, Pencil, Plus, Trash2 } from 'lucide-react';
import { AI_RULE_METRICS, AI_RULE_METRIC_LABEL, AI_RULE_UNIT, AI_RULES_MAX, aiAlertRuleSchema, aiRulePreview, aiRuleSentence, type AiAlertRule, type AiData, type AiRuleResult, type AiRuleRun } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { errorMessage } from '@/lib/api';
import { useSiteAdmin } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Panel, useSitePage } from './kit';
import { engineLabel } from './ai';
import { filterOptions } from './ai-filter';

type Draft = { id: string; metric: AiAlertRule['metric']; engine: string; cluster: string; persona: string; market: string; competitor: string; direction: AiAlertRule['direction']; threshold: string; enabled: boolean };
const blank = (): Draft => ({ id: `r${Date.now().toString(36)}`, metric: 'named_rate', engine: '', cluster: '', persona: '', market: '', competitor: '', direction: 'drop', threshold: '5', enabled: true });
const toDraft = (r: AiAlertRule): Draft => ({ id: r.id, metric: r.metric, engine: r.scope.engine ?? '', cluster: r.scope.cluster ?? '', persona: r.scope.persona ?? '', market: r.scope.market ?? '', competitor: r.scope.competitor ?? '', direction: r.direction, threshold: String(r.threshold_points), enabled: r.enabled });
const fromDraft = (d: Draft) => {
  const scope = Object.fromEntries(Object.entries({ engine: d.engine, cluster: d.cluster, persona: d.persona, market: d.market, competitor: d.competitor }).filter(([, v]) => v));
  return { id: d.id, metric: d.metric, scope, direction: d.direction, threshold_points: Number(d.threshold), enabled: d.enabled };
};

/** What the preview reads off the stored runs. */
export function ruleRunsOf(d: AiData): AiRuleRun[] {
  return d.runs.map((r) => ({ runId: r.runId, checkedAt: r.checkedAt, compare: r.compare, samples: r.samples, engines: (r.engineRates ?? []).map((e) => ({ key: e.key, mentionRate: e.mentionRate, citationRate: e.citationRate, samples: e.samples })), sov: r.sov?.brands ?? [] }));
}

export function AlertRulesPanel({ d, engineNames }: { d: AiData; engineNames: Record<string, string> }) {
  const { org, site, can } = useSitePage();
  const admin = useSiteAdmin(org.id, site.id);
  const isAdmin = can('admin');
  const stored = d.alertRules ?? [];
  const fired = new Map<string, AiRuleResult>((d.latest?.extras?.rules ?? []).map((r) => [r.ruleId, r]));
  const runs = useMemo(() => ruleRunsOf(d), [d]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const name = (k: string) => engineNames[k] ?? engineLabel(k);

  const save = (rules: AiAlertRule[], msg: string) =>
    admin.mutate(
      { action: 'monitors', monitors: { aiAlertRules: rules } },
      { onSuccess: (r) => (r.ok ? toast.success(msg) : toast.error(r.error ?? 'The rules were not saved')), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <Panel
      title="Alert rules"
      icon={<BellRing />}
      description={stored.length ? `${stored.length} of ${AI_RULES_MAX} rules, checked on every weekly run` : 'Your own thresholds, on top of the alerts the weekly run already tests'}
      info="A rule fires only when the run was compared with the run before (the same questions on the same engines), its own test calls the change real, and the change reaches your size. A change inside the noise never fires a rule, however you set it."
      actions={
        <>
          <GuideButton id="ai-alert-rules" variant="chip" label="How rules work" />
          {isAdmin && !editing && stored.length < AI_RULES_MAX && (
            <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setEditing(blank())}>
              Add a rule
            </Button>
          )}
        </>
      }
    >
      {stored.length > 0 ? (
        <ul className="divide-y divide-line">
          {stored.map((r) => {
            const f = fired.get(r.id);
            const p = aiRulePreview(r, runs);
            return (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">
                    {aiRuleSentence(r, name)}
                    {!r.enabled && <Badge className="ml-2">Off</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {f ? (f.fired ? <StatusBadge tone="warning">Fired on the latest run</StatusBadge> : 'Did not fire on the latest run') : 'Not checked by a run yet'}
                    {f?.reason ? ` · ${f.reason}` : ''}
                    {f?.test ? ` · ${f.test}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-3">{previewText(p)}</p>
                </div>
                {isAdmin && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Edit: ${aiRuleSentence(r, name)}`} onClick={() => setEditing(toDraft(r))}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete: ${aiRuleSentence(r, name)}`} loading={admin.isPending} onClick={() => save(stored.filter((x) => x.id !== r.id), 'Rule deleted')}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !editing && <p className="text-[13px] text-ink-2">No rule yet. {isAdmin ? 'Add one to be told when a figure you care about moves by more than you accept.' : 'Admins can add rules.'}</p>
      )}
      {editing && <RuleForm d={d} draft={editing} runs={runs} engineName={name} busy={admin.isPending} onCancel={() => setEditing(null)} onSave={(rule) => { save([...stored.filter((x) => x.id !== rule.id), rule], 'Rule saved: checked from the next weekly run'); setEditing(null); }} />}
    </Panel>
  );
}

function previewText(p: ReturnType<typeof aiRulePreview>): string {
  if (p.unavailable) return p.unavailable;
  if (!p.evaluated) return `No stored run can be judged with this rule yet${p.notComparable ? ` (${p.notComparable} not compared with the run before)` : ''}.`;
  return `On the stored runs it would have fired ${p.fired.length} of ${p.evaluated} times${p.fired.length ? ` (${p.fired.slice(-3).map((f) => `${fmtDate(f.at)}: ${f.note}`).join(', ')})` : ''}${p.notComparable ? `; ${p.notComparable} runs were not compared and are skipped` : ''}${p.untested ? `; ${p.untested} had no test for this figure` : ''}.`;
}

function RuleForm({ d, draft, runs, engineName, busy, onCancel, onSave }: { d: AiData; draft: Draft; runs: AiRuleRun[]; engineName: (k: string) => string; busy: boolean; onCancel: () => void; onSave: (r: AiAlertRule) => void }) {
  const [v, setV] = useState(draft);
  const set = (p: Partial<Draft>) => setV((x) => ({ ...x, ...p }));
  const opts = filterOptions(d);
  const parsed = aiAlertRuleSchema.safeParse(fromDraft(v));
  const err = (path: string) => (parsed.success ? undefined : parsed.error.issues.find((i) => i.path.join('.') === path)?.message);
  const competitors = [...new Set([...(d.latest?.competitors.map((c) => c.domain) ?? []), ...((d.runs[d.runs.length - 1]?.sov?.brands ?? []).map((b) => b.name))])].filter(Boolean);
  const preview = parsed.success ? aiRulePreview(parsed.data, runs) : null;
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-accent bg-accent-soft/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Watch">
          {(p) => (
            <Select {...p} value={v.metric} onChange={(e) => set({ metric: e.target.value as Draft['metric'], competitor: e.target.value === 'competitor_share' ? v.competitor : '' })}>
              {AI_RULE_METRICS.map((m) => (
                <option key={m} value={m}>
                  {AI_RULE_METRIC_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {v.metric === 'competitor_share' && (
          <Field label="Competitor" error={err('scope.competitor')}>
            {(p) => (
              <>
                <Input {...p} list="ai-rule-competitors" value={v.competitor} maxLength={120} onChange={(e) => set({ competitor: e.target.value })} placeholder="e.g. acme.com" />
                <datalist id="ai-rule-competitors">
                  {competitors.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        )}
        <Field label="Direction">
          {(p) => (
            <Select {...p} value={v.direction} onChange={(e) => set({ direction: e.target.value as Draft['direction'] })}>
              <option value="drop">{v.metric === 'avg_position' ? 'Gets worse' : 'Drops'}</option>
              <option value="rise">{v.metric === 'avg_position' ? 'Improves' : 'Rises'}</option>
              <option value="any">Either way</option>
            </Select>
          )}
        </Field>
        <Field label={`By at least (${AI_RULE_UNIT[v.metric]})`} error={err('threshold_points')}>
          {(p) => <Input {...p} type="number" inputMode="decimal" min={0.5} max={100} step={0.5} value={v.threshold} onChange={(e) => set({ threshold: e.target.value })} />}
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['engine', 'cluster', 'persona', 'market'] as const).map((dim) => (
          <Field key={dim} label={{ engine: 'Engine', cluster: 'Topic', persona: 'Buyer role', market: 'Market' }[dim]} optional error={err(`scope.${dim}`)}>
            {(p) => (
              <Select {...p} value={v[dim]} onChange={(e) => set({ [dim]: e.target.value })} disabled={!opts[dim].length}>
                <option value="">{dim === 'engine' ? 'All engines' : 'All'}</option>
                {opts[dim].map((o) => (
                  <option key={o} value={o}>
                    {dim === 'engine' ? engineName(o) : o}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ))}
      </div>
      <Checkbox label="On" checked={v.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
      {parsed.success ? (
        <Callout tone="info" title={aiRuleSentence(parsed.data, engineName)}>
          {previewText(preview!)}
        </Callout>
      ) : (
        <p className="text-[13px] text-critical-text" role="alert">
          {parsed.error.issues[0]?.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!parsed.success} loading={busy} onClick={() => parsed.success && onSave(parsed.data)}>
          Save the rule
        </Button>
      </div>
    </div>
  );
}
