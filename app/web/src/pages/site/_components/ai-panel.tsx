// G6 (2026-10-18, n8n/seo-agent/AI_VISIBILITY_SPEC.md §10): the AI question panel at enterprise scale on the AI visibility page,
//  * SegmentsSection: how often AI names the business per topic cluster, buyer role, market, engine and funnel stage, each rate with its
//    95% range (a whisker over the bar), "too few answers" instead of a rate under 12 answers, share of voice, and the moves the
//    Benjamini-Hochberg screen called real; plus how precise this panel is (measured and achievable half-widths).
//  * PanelManager: up to 500 questions, filters by cluster / buyer role / market / status / an engine's result, add (one per line, with
//    a role / cluster / market for all of them), import a CSV, edit, re-word, switch off / on, pin / unpin, and track the real AI
//    questions the engine suggests. Every change goes through Site Admin `ai_prompts` (the engine's AI_Prompt_Rows_Admin.js).
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowUpRight, FileUp, Layers, Pencil, Pin, PinOff, Plus, Power, Sparkles, Tag, Trash2, Users } from 'lucide-react';
import { AI_PANEL_LIMITS, AI_SEGMENT_MIN, aiAskedSet, aiPanelOverflow, compactNumber, estimateAiPanelCost, parseAiPanelCsvWithKeyword, titleCase, type AiData, type AiPanelCsvResult, type AiPanelInfo, type AiSegment, type AiSegments } from '@seo/shared';
import { creditsLabel } from '@/lib/credits';
import { GuideButton } from '@/components/guide';
import { errorMessage } from '@/lib/api';
import { useAiPromptDelete, useSiteAdmin } from '@/lib/queries';
import { cn, fmtAgo, fmtDate } from '@/lib/utils';
import { Dialog } from '@/components/ui/overlay';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { DataTable, type Column } from '@/components/ui/table';
import { FilterChips, Kind, Panel, SrOnly, useSitePage } from './kit';
import { engineLabel, sortEngines } from './ai';

type Prompt = AiData['prompts'][number];
/** W2-A: each question's best result per engine in the latest run (the page no longer loads every answer) */
type Result = NonNullable<AiData['answerResults']>[number];

const DIMS = [
  { value: 'cluster', label: 'Topic' },
  { value: 'persona', label: 'Buyer role' },
  { value: 'market', label: 'Market' },
  { value: 'engine', label: 'Engine' },
  { value: 'stage', label: 'Stage' },
] as const;
type Dim = (typeof DIMS)[number]['value'];

const segLabel = (dim: string, key: string) => (dim === 'engine' ? engineLabel(key) : dim === 'market' ? key : titleCase(key));

/** One horizontal bar per segment on a fixed 0-100% scale (so rates and ranges compare across rows), its 95% range as a whisker. */
function RangeBars({ rows, dim }: { rows: AiSegment[]; dim: string }) {
  return (
    <ul className="space-y-1" aria-label="Named in, with the 95% range">
      {rows.map((s) => {
        const tip = s.enough && s.rate != null && s.ci
          ? `${segLabel(dim, s.key)}: named in ${s.rate}% of ${s.n} answers (95% range ${s.ci[0]}-${s.ci[1]}%)${s.sov != null ? `, ${s.sov}% share of voice` : ''}${s.leader ? `; named most instead: ${s.leader}` : ''}`
          : `${segLabel(dim, s.key)}: ${s.n} answers, which is too few for a rate (${AI_SEGMENT_MIN} needed)`;
        return (
          <li key={s.key} tabIndex={0} title={tip} aria-label={tip}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors duration-150 ease-brand hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-accent sm:grid-cols-[minmax(0,12rem)_1fr_15.5rem]">
            <span className="order-1 truncate text-ink-2">{segLabel(dim, s.key)}<span className="ml-1.5 text-xs text-ink-3">{s.questions} q</span></span>
            {s.enough && s.rate != null && s.ci ? (
              <span className="relative order-3 col-span-2 h-3 sm:order-2 sm:col-span-1" aria-hidden>
                <span className="absolute inset-y-[3px] left-0 right-0 rounded-full bg-surface-2" />
                <span className="absolute inset-y-[3px] left-0 rounded-full" style={{ width: `${Math.max(1, s.rate)}%`, background: 'var(--seq-4)' }} />
                <span className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-ink-2" style={{ left: `${s.ci[0]}%`, width: `${Math.max(0.5, s.ci[1] - s.ci[0])}%` }} />
                <span className="absolute top-0 h-3 w-[2px] bg-ink-2" style={{ left: `${s.ci[0]}%` }} />
                <span className="absolute top-0 h-3 w-[2px] bg-ink-2" style={{ left: `calc(${s.ci[1]}% - 2px)` }} />
              </span>
            ) : (
              <span className="order-3 col-span-2 h-3 rounded-full border border-dashed border-line-strong sm:order-2 sm:col-span-1" aria-hidden />
            )}
            <span className="order-2 whitespace-nowrap text-right tabular text-[13px] text-ink sm:order-3">
              {s.enough && s.rate != null ? (
                <>
                  {s.rate}%<span className="ml-1 text-xs text-ink-3">{s.ci ? `${s.ci[0]}-${s.ci[1]}` : ''} · {compactNumber(s.n)}</span>
                  {s.significant && s.delta != null && (
                    <Badge tone={s.delta > 0 ? 'good' : 'serious'} className="ml-1.5" icon={s.delta > 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}>
                      {s.delta > 0 ? '+' : ''}{s.delta} pts
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-xs text-ink-3">too few answers ({s.n})</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function SegmentsSection({ segments, panel }: { segments: AiSegments | null; panel: AiPanelInfo | null }) {
  const [dim, setDim] = useState<Dim>('cluster');
  const [asTable, setAsTable] = useState(false);
  const all = segments?.rows ?? [];
  if (!all.length) return null;
  const counts = Object.fromEntries(DIMS.map((d) => [d.value, all.filter((s) => s.dim === d.value).length]));
  const rows = all.filter((s) => s.dim === dim).sort((a, b) => (b.enough ? 1 : 0) - (a.enough ? 1 : 0) || (b.rate ?? -1) - (a.rate ?? -1));
  const hw = panel?.halfWidth;
  const columns: Column<AiSegment>[] = [
    { key: 'key', header: DIMS.find((d) => d.value === dim)!.label, sortValue: (s) => s.key, cell: (s) => <span className="font-medium text-ink">{segLabel(dim, s.key)}</span> },
    { key: 'q', header: 'Questions', align: 'right', sortValue: (s) => s.questions, cell: (s) => <span className="tabular">{s.questions}</span> },
    { key: 'n', header: 'Answers', align: 'right', sortValue: (s) => s.n, cell: (s) => <span className="tabular">{compactNumber(s.n)}</span> },
    { key: 'rate', header: 'Named in', align: 'right', sortValue: (s) => (s.enough ? s.rate : -1), cell: (s) => (s.enough && s.rate != null ? <span className="tabular">{s.rate}%</span> : <span className="text-xs text-ink-3">too few answers</span>) },
    { key: 'ci', header: '95% range', align: 'right', hideOnMobile: true, cell: (s) => <span className="tabular text-ink-2">{s.enough && s.ci ? `${s.ci[0]}-${s.ci[1]}%` : '-'}</span> },
    { key: 'sov', header: 'Share of voice', align: 'right', hideOnMobile: true, sortValue: (s) => s.sov ?? -1, cell: (s) => <span className="tabular">{s.sov != null ? `${s.sov}%` : '-'}</span> },
    { key: 'leader', header: 'Named most instead', hideOnMobile: true, cell: (s) => <span className="text-ink-2">{s.leader || '-'}</span> },
    { key: 'chg', header: 'Change', align: 'right', sortValue: (s) => s.delta ?? 0, cell: (s) => (s.delta == null ? <span className="text-ink-3">-</span> : <span className={cn('tabular', s.significant ? 'font-semibold text-ink' : 'text-ink-3')}>{s.delta > 0 ? '+' : ''}{s.delta} pts{s.significant ? '' : ' · noise'}</span>) },
  ];
  return (
    <Panel
      title="By topic, buyer role and market"
      icon={<Layers />}
      description="How often AI answers name you in each part of your panel, with the 95% range. A change is called real only when it clears a false-discovery-rate screen across every segment."
      info={`Each row counts this week's answers on the weekly engines plus the daily pulse's answers to the same questions. Under ${AI_SEGMENT_MIN} answers a row shows "too few answers" instead of a rate. Changes are tested only when last week asked the same questions on the same engines, and corrected together (Benjamini-Hochberg, 10% false discovery rate).`}
      actions={<Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)}>{asTable ? 'Show chart' : 'Show table'}</Button>}
    >
      <div className="space-y-3 px-5 pb-5 pt-3">
        <FilterChips label="Group by" value={dim} onChange={setDim} options={DIMS.filter((d) => counts[d.value]).map((d) => ({ value: d.value, label: d.label, count: counts[d.value] }))} />
        {asTable ? (
          <DataTable rows={rows} columns={columns} rowKey={(s) => s.key} dense pageSize={20} />
        ) : (
          <RangeBars rows={rows.slice(0, 30)} dim={dim} />
        )}
        {!asTable && rows.length > 30 && <p className="text-xs text-ink-3">The 30 largest of {rows.length}; the table shows them all.</p>}
        {segments?.family && <p className="text-xs leading-relaxed text-ink-3">{segments.family.note}</p>}
        {hw && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-snug text-ink-2">
            <span className="font-medium text-ink">How precise this is: </span>
            {hw.measured.headline != null ? `the headline "named in" is measured to ±${hw.measured.headline} points` : 'no headline rate this week'}
            {hw.measured.medianCluster != null ? `, a typical topic to ±${hw.measured.medianCluster}` : ''}. With {panel?.setting ?? panel?.size} questions
            {hw.achievable.perWeek ? ` and each asked ${hw.achievable.perWeek === 6 ? 'every pulse morning' : `on ${hw.achievable.perWeek} pulse morning${hw.achievable.perWeek === 1 ? '' : 's'} a week`}` : ''} the panel can reach ±{hw.achievable.headline} on the headline and ±{hw.achievable.cluster} on a 12-question topic (95%, at the widest).
            {panel?.overlapWithPrevious?.share != null && ` ${Math.round(panel.overlapWithPrevious.share * 100)}% of the questions were asked last week too${panel.overlapWithPrevious.same === false ? ': too few for a week-on-week change, so none is shown' : ''}.`}
            {panel && panel.executions > 1 && ` The weekly run is asked over ${panel.executions} parts.`}
          </p>
        )}
      </div>
    </Panel>
  );
}

// ---------------- the panel manager ----------------

const isTracked = (p: Prompt) => !['off', 'refused', 'retired', 'proposed'].includes(p.status || 'active');   // AI-FOCUS: a retired or proposed question is not asked
/** the owner's own questions (theirs or pinned): asked before the automatic ones, so only these can be crowded out by the panel size */
const isOwn = (p: Prompt) => p.source === 'custom' || p.pinned;
type StatusFilter = 'tracked' | 'over' | 'pinned' | 'proposed' | 'refused' | 'retired' | 'off' | 'all';   // AI-FOCUS: + proposed, retired
// W2-E1: 'shopping' is a stage for sites that sell products
/** R-A19: one bulk change takes at most this many questions (the server's schemas refuse more) */
const BULK_MAX = 500;
const STAGES = ['awareness', 'consideration', 'decision', 'shopping'] as const;

/** AI-FOCUS: what a question's topic is, in the customer's words */
const focusSourceLabel = (state?: string) => (state === 'core' ? 'your service' : state === 'watch' ? 'a keyword you watch' : state === 'maintain' ? 'a keyword you won' : state === 'paused' ? 'a paused keyword' : state === 'out' ? 'an earlier topic' : 'your keyword');

function originLabel(p: Prompt): string {
  if (p.source === 'custom' || p.origin === 'custom') return 'You';
  return ({ market: 'Real AI question', search: 'Your Google searches', paa: 'People also ask', competitor: 'Competitor topics', template: 'Engine' } as Record<string, string>)[p.origin] ?? 'Engine';
}

/**
 * A3 (2026-10-23, APP_AUDIT.md): `setting` is the panel size set NOW (the monitors row; null = no row, the engine asks 50), never the size
 * stored with the last run. A question past the size is stored and NOT asked (AI_Plan.js cuts the panel there): it is labelled so, and
 * adding or importing past the size says so before it is sent, with what the bigger panel would use.
 */
export function PanelManager({ prompts, results, suggestions, setting, engines: panelEngines = [], onQuestion }: { prompts: readonly Prompt[]; results: readonly Result[]; suggestions: { question: string; volume: number }[]; setting: number | null; engines?: readonly string[]; /** W2-A: open a question's answers and history */ onQuestion?: (promptId: string) => void }) {
  const { org, site, can, page } = useSitePage();
  const admin = useSiteAdmin(org.id, site.id);
  const del = useAiPromptDelete(org.id, site.id);
  // W2-A: bulk select (pause / resume / pin / unpin / topic / delete)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [tag, setTag] = useState('');
  const isAdmin = can('admin');
  const [status, setStatus] = useState<StatusFilter>('tracked');
  const [cluster, setCluster] = useState('');
  const [persona, setPersona] = useState('');
  const [market, setMarket] = useState('');
  const [engine, setEngine] = useState('');
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const size = setting ?? AI_PANEL_LIMITS.default_new;
  const cut = useMemo(() => aiAskedSet(prompts, size), [prompts, size]);
  const isAsked = (p: Prompt) => cut.asked.has(p.promptId);
  const tracked = prompts.filter(isTracked);
  const askedCount = tracked.filter(isAsked).length;
  const over = tracked.filter((p) => !isAsked(p));
  const ownCount = tracked.filter(isOwn).length;
  const refused = prompts.filter((p) => p.status === 'refused');
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const clusters = uniq(prompts.map((p) => p.cluster || p.topic));
  const personas = uniq(prompts.map((p) => p.persona));
  const markets = uniq(prompts.map((p) => p.market));
  const engines = sortEngines(results.map((a) => a.engine));
  // each question's latest result on the chosen engine (named / cited / not named / no answer)
  const resultOf = useMemo(() => {
    const m = new Map<string, string>();
    const rank = { cited: 3, named: 2, absent: 1, none: 0 } as Record<string, number>;
    for (const a of results) if (!engine || a.engine === engine) {
      const prev = m.get(a.promptId);
      if (!prev || rank[a.result] > rank[prev]) m.set(a.promptId, a.result);
    }
    return m;
  }, [results, engine]);

  const rows = prompts.filter((p) =>
    (status === 'all' || (status === 'tracked' ? isTracked(p) && isAsked(p) : status === 'over' ? isTracked(p) && !isAsked(p) : status === 'pinned' ? p.pinned && isTracked(p) : p.status === status))
    && (!cluster || (p.cluster || p.topic) === cluster) && (!persona || p.persona === persona) && (!market || p.market === market));

  const send = (body: Record<string, unknown>, ok: string, id?: string) => {
    if (id) setPendingId(id);
    admin.mutate(
      { action: 'ai_prompts', add: [], remove: [], enable: [], pin: [], unpin: [], edit: [], accept: [], retire: [], ...body },
      {
        onSuccess: (r) => (r.ok ? toast.success(ok) : toast.error(r.error ?? 'The change was not saved')),
        onError: (e) => toast.error(errorMessage(e)),
        onSettled: () => setPendingId(null),
      },
    );
  };

  const ids = [...selected].filter((id) => prompts.some((p) => p.promptId === id));
  const toggle = (id: string) => setSelected((s0) => { const s1 = new Set(s0); if (s1.has(id)) s1.delete(id); else if (s1.size < BULK_MAX) s1.add(id); return s1; });
  const allShown = rows.length > 0 && rows.every((p) => selected.has(p.promptId));
  const bulk = (body: Record<string, unknown>, ok: string) => { send(body, ok); setSelected(new Set()); };
  const removeSelected = () =>
    del.mutate(ids, {
      onSuccess: (r) => { toast.success(`${r.deleted} question${r.deleted === 1 ? '' : 's'} deleted`); setSelected(new Set()); setConfirmDelete(false); },
      onError: (e) => toast.error(errorMessage(e)),
    });

  const resultBadge = (v?: string) =>
    v === 'cited' ? <StatusBadge tone="good">Cited</StatusBadge> : v === 'named' ? <StatusBadge tone="good">Named</StatusBadge> : v === 'absent' ? <StatusBadge tone="serious">Not named</StatusBadge> : v === 'none' ? <span className="text-xs text-ink-3">No answer</span> : <span className="text-xs text-ink-3">-</span>;

  const columns: Column<Prompt>[] = [
    ...(isAdmin
      ? [{
          key: 'sel',
          header: <input type="checkbox" className="size-4 accent-[var(--accent)]" aria-label="Select every question shown" checked={allShown} onChange={() => { const s1 = new Set(selected); for (const p of rows) { if (allShown) s1.delete(p.promptId); else if (s1.size < BULK_MAX) s1.add(p.promptId); } if (!allShown && rows.some((p) => !s1.has(p.promptId))) toast.info(`${BULK_MAX} questions are selected: one change takes at most ${BULK_MAX}. Apply it, then select the rest.`); setSelected(s1); }} />,
          cell: (p: Prompt) => <input type="checkbox" className="size-4 accent-[var(--accent)]" aria-label={`Select: ${p.prompt}`} checked={selected.has(p.promptId)} onChange={() => toggle(p.promptId)} />,
        }]
      : []),
    {
      key: 'prompt',
      header: 'Question',
      sortValue: (p) => p.prompt,
      cell: (p) => (
        <div className={cn('min-w-[16rem]', !isTracked(p) && 'opacity-70')}>
          <p className="text-[13px] font-medium leading-snug text-ink">
            {p.pinned && <Pin className="mr-1 inline size-3.5 text-accent-text" aria-label="Pinned" />}
            {onQuestion ? (
              <button type="button" className="text-left hover:text-accent-text hover:underline transition-colors duration-150 ease-brand" onClick={() => onQuestion(p.promptId)}>
                {p.prompt}
              </button>
            ) : (
              p.prompt
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">{[p.focusTopic ? `About ${focusSourceLabel(p.focusState)}: ${p.focusTopic}` : p.cluster || p.topic, p.stage && titleCase(p.stage)].filter(Boolean).join(' · ')}</p>
          {p.status === 'retired' && <p className="mt-1 text-xs text-ink-3">Retired{p.retiredAt ? ` ${fmtDate(p.retiredAt)}` : ''}{p.retireReason ? `: ${p.retireReason}` : ''}. Its history is kept.</p>}
          {p.fitNote && <p className={cn('mt-1 text-xs', p.status === 'refused' ? 'text-serious-text' : 'text-ink-3')}>{p.fitNote}</p>}
        </div>
      ),
    },
    { key: 'persona', header: 'Buyer role', hideOnMobile: true, sortValue: (p) => p.persona, cell: (p) => <span className="text-[13px] text-ink-2">{p.persona || '-'}</span> },
    { key: 'market', header: 'Market', hideOnMobile: true, sortValue: (p) => p.market, cell: (p) => (p.market ? <Kind>{p.market}</Kind> : '-') },
    { key: 'volume', header: 'AI searches / mo', align: 'right', hideOnMobile: true, sortValue: (p) => p.volume ?? -1, cell: (p) => <span className="tabular text-[13px]">{p.volume != null ? compactNumber(p.volume) : '-'}</span> },
    { key: 'origin', header: 'From', hideOnMobile: true, sortValue: (p) => originLabel(p), cell: (p) => <span className="text-[13px] text-ink-2">{originLabel(p)}</span> },
    { key: 'result', header: engine ? `On ${engineLabel(engine)}` : 'Latest run', sortValue: (p) => resultOf.get(p.promptId) ?? '', cell: (p) => resultBadge(resultOf.get(p.promptId)) },
    { key: 'status', header: 'Status', sortValue: (p) => (isTracked(p) ? (isAsked(p) ? 0 : 1) : p.status === 'refused' ? 2 : 3), cell: (p) => (
      <span className="inline-flex flex-col items-start gap-0.5">
        {isTracked(p) ? (isAsked(p) ? <StatusBadge tone="good">Tracked</StatusBadge> : <StatusBadge tone="warning">Not asked: over your panel size</StatusBadge>) : p.status === 'refused' ? <StatusBadge tone="warning">Refused</StatusBadge> : p.status === 'proposed' ? <StatusBadge tone="accent">Proposed</StatusBadge> : p.status === 'retired' ? <StatusBadge tone="neutral">Retired</StatusBadge> : <Badge icon={<Power className="size-3" aria-hidden />}>Off</Badge>}
        {/* W2 §3: the engine's own record when stored (else the cut above is the app's mirror of the engine's) */}
        {p.lastAskedAt ? <span className="text-[11px] text-ink-3" title={fmtDate(p.lastAskedAt)}>asked {fmtAgo(p.lastAskedAt)}{p.askedN28d != null ? ` · ${p.askedN28d}x in 28 days` : ''}</span> : null}
      </span>
    ) },
    ...(isAdmin
      ? [{
          key: 'act',
          header: <SrOnly>Actions</SrOnly>,
          align: 'right' as const,
          cell: (p: Prompt) => (
            <span className="inline-flex flex-wrap justify-end gap-1">
              {isTracked(p) && (
                <Button size="sm" variant="ghost" aria-label={(p.pinned ? 'Unpin: ' : 'Pin: ') + p.prompt} loading={pendingId === p.promptId + ':pin'}
                  onClick={() => send(p.pinned ? { unpin: [p.promptId] } : { pin: [p.promptId] }, p.pinned ? 'Unpinned' : 'Pinned: asked first, kept when the panel is made smaller', p.promptId + ':pin')}>
                  {p.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
                </Button>
              )}
              <Button size="sm" variant="ghost" aria-label={'Edit: ' + p.prompt} onClick={() => setEditing(p)}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              {p.status === 'proposed' && (
                <Button size="sm" variant="ghost" loading={pendingId === p.promptId + ':accept'} onClick={() => send({ accept: [p.promptId] }, 'Question added: it is asked from the next check', p.promptId + ':accept')}>Accept</Button>
              )}
              {isTracked(p) ? (
                <Button size="sm" variant="ghost" loading={pendingId === p.promptId + ':off'} onClick={() => send({ remove: [p.promptId] }, 'Question switched off', p.promptId + ':off')}>Switch off</Button>
              ) : (
                <Button size="sm" variant="ghost" loading={pendingId === p.promptId + ':on'} onClick={() => send({ enable: [p.promptId] }, p.status === 'refused' ? 'Switched on as your own question' : 'Question switched back on', p.promptId + ':on')}>Switch on</Button>
              )}
            </span>
          ),
        }]
      : []),
  ];

  const tracked0 = new Set(prompts.map((p) => p.prompt.trim().toLowerCase()));
  const sugg = suggestions.filter((s) => !tracked0.has(s.question.trim().toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Questions"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'tracked', label: 'Tracked', count: askedCount },
            ...(over.length ? [{ value: 'over' as const, label: 'Not asked', count: over.length }] : []),
            { value: 'pinned', label: 'Pinned', count: tracked.filter((p) => p.pinned).length },
            ...(prompts.some((p) => p.status === 'proposed') ? [{ value: 'proposed' as const, label: 'Proposed', count: prompts.filter((p) => p.status === 'proposed').length }] : []),
            { value: 'refused', label: 'Refused', count: refused.length },
            ...(prompts.some((p) => p.status === 'retired') ? [{ value: 'retired' as const, label: 'Retired', count: prompts.filter((p) => p.status === 'retired').length }] : []),
            { value: 'off', label: 'Off', count: prompts.filter((p) => p.status === 'off').length },
            { value: 'all', label: 'All', count: prompts.length },
          ]}
        />
        <p className="text-xs text-ink-3">
          {askedCount} of {size} questions asked each week
          {over.length > 0 && ` · ${over.length} not asked (over your panel size)`}
          {isAdmin && askedCount < size && !over.length && ' (the next weekly run writes the rest)'}
          {isAdmin && <> · <ButtonLink to={page('settings/tracking')} variant="link" size="sm">Change the panel size</ButtonLink></>}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PickFilter label="Topic" value={cluster} onChange={setCluster} options={clusters} />
        <PickFilter label="Buyer role" value={persona} onChange={setPersona} options={personas} />
        <PickFilter label="Market" value={market} onChange={setMarket} options={markets} />
        <PickFilter label="Result on" value={engine} onChange={setEngine} options={engines} format={engineLabel} allLabel="Any engine" />
      </div>
      {editing && <EditQuestion p={editing} onClose={() => setEditing(null)} onSave={(body, msg) => { send(body, msg); setEditing(null); }} />}
      {isAdmin && ids.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-accent bg-surface p-2.5 shadow-raised" role="region" aria-label="Selected questions">
          <span className="px-1 text-[13px] font-medium text-ink">{ids.length} selected</span>
          <Button size="sm" variant="secondary" icon={<Power className="size-4" />} loading={admin.isPending} onClick={() => bulk({ remove: ids }, `${ids.length} switched off`)}>Switch off</Button>
          <Button size="sm" variant="secondary" loading={admin.isPending} onClick={() => bulk({ enable: ids }, `${ids.length} switched on`)}>Switch on</Button>
          <Button size="sm" variant="secondary" icon={<Pin className="size-4" />} loading={admin.isPending} onClick={() => bulk({ pin: ids }, `${ids.length} pinned`)}>Pin</Button>
          <Button size="sm" variant="secondary" icon={<PinOff className="size-4" />} loading={admin.isPending} onClick={() => bulk({ unpin: ids }, `${ids.length} unpinned`)}>Unpin</Button>
          <Button size="sm" variant="secondary" icon={<Tag className="size-4" />} onClick={() => setTagging(true)}>Set topic</Button>
          <Button size="sm" variant="secondary" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      <Dialog open={tagging} onOpenChange={setTagging} title={`Set the topic of ${ids.length} question${ids.length === 1 ? '' : 's'}`} description="The topic groups questions in the segments, the filter and the reports."
        footer={<><Button variant="ghost" onClick={() => setTagging(false)}>Cancel</Button><Button disabled={!tag.trim()} onClick={() => { bulk({ edit: ids.map((promptId) => ({ promptId, cluster: tag.trim().toLowerCase() })) }, `Topic set on ${ids.length}`); setTagging(false); setTag(''); }}>Set the topic</Button></>}>
        <Field label="Topic">{(p) => <Input {...p} value={tag} maxLength={60} onChange={(e) => setTag(e.target.value)} placeholder="e.g. payroll" />}</Field>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete ${ids.length} question${ids.length === 1 ? '' : 's'}?`}
        description="Deleted questions are removed from the panel and no longer asked. The answers already stored stay in the history, and the weekly run will not suggest these questions again. Adding one back as your own question brings it back. To stop asking a question but keep it listed, switch it off instead."
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" loading={del.isPending} onClick={removeSelected}>Delete</Button></>} />
      <DataTable rows={rows} columns={columns} rowKey={(p) => p.promptId} dense pageSize={25} searchable searchPlaceholder="Search the questions" searchText={(p) => [p.prompt, p.cluster, p.persona, p.market].join(' ')}
        empty={status === 'refused' ? 'No question was refused: every question the engine wrote passed the keyword rule.' : 'No questions match these filters.'} />
      {status === 'refused' && refused.length > 0 && (
        <Callout tone="info" title="Why questions are refused">
          The engine never asks a question that names your own website, another company, a government service or a login task, because answers to those say nothing about your visibility. Each refused question shows the rule it broke; switch one on if you want it anyway, and it becomes your own question.
        </Callout>
      )}
      {isAdmin && <AddQuestions busy={admin.isPending && !pendingId} onAdd={(add, msg) => send({ add }, msg)} own={ownCount} size={size} engines={panelEngines} />}
      {isAdmin && sugg.length > 0 && (
        <div className="rounded-xl border border-line p-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink"><Sparkles className="size-4 text-accent-text" aria-hidden /> Suggested: real questions people ask AI about your topics</p>
          <ul className="mt-2 divide-y divide-line">
            {sugg.map((s) => (
              <li key={s.question} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span className="min-w-0 flex-1 text-ink-2">{s.question}<span className="ml-1.5 text-xs text-ink-3">{compactNumber(s.volume)} AI searches / mo</span></span>
                <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => send({ add: [s.question] }, addedMessage(1, ownCount, size))}>Track</Button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => send({ add: sugg.map((s) => s.question) }, addedMessage(sugg.length, ownCount, size))}>Track all {sugg.length}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PickFilter({ label, value, onChange, options, format = (v: string) => v, allLabel = 'All' }: { label: string; value: string; onChange: (v: string) => void; options: string[]; format?: (v: string) => string; allLabel?: string }) {
  return (
    <Field label={label}>
      {(p) => (
        <Select {...p} value={value} onChange={(e) => onChange(e.target.value)} disabled={!options.length}>
          <option value="">{allLabel}</option>
          {options.map((o) => (
            <option key={o} value={o}>{format(o)}</option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function EditQuestion({ p, onClose, onSave }: { p: Prompt; onClose: () => void; onSave: (body: Record<string, unknown>, msg: string) => void }) {
  const [prompt, setPrompt] = useState(p.prompt);
  const [persona, setPersona] = useState(p.persona);
  const [cluster, setCluster] = useState(p.cluster || p.topic);
  const [stage, setStage] = useState(STAGES.includes(p.stage as (typeof STAGES)[number]) ? p.stage : '');
  const [market, setMarket] = useState(p.market);
  const reworded = prompt.trim() !== p.prompt.trim();
  const err = prompt.trim().length < 10 ? 'Questions need at least 10 characters' : prompt.length > 300 ? 'Keep the question under 300 characters' : market && !/^[A-Za-z]{2}([-_ ][A-Za-z]{2,3})?$/.test(market.trim()) ? 'Market: a country code and a language, e.g. SA-en' : '';
  return (
    <div className="space-y-3 rounded-xl border border-accent bg-accent-soft/40 p-4">
      <p className="text-[13px] font-medium text-ink">Edit a question</p>
      <Field label="Wording" hint={reworded ? 'New wording is a new question: the old one is switched off and kept in the history, so no trend compares two different questions.' : undefined} error={err && /Question|question/.test(err) ? err : undefined}>
        {(f) => <Textarea {...f} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Buyer role">{(f) => <Input {...f} value={persona} maxLength={40} onChange={(e) => setPersona(e.target.value)} placeholder="e.g. CFO" />}</Field>
        <Field label="Topic">{(f) => <Input {...f} value={cluster} maxLength={60} onChange={(e) => setCluster(e.target.value)} />}</Field>
        <Field label="Stage">
          {(f) => (
            <Select {...f} value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Keep</option>
              {STAGES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Market" error={err && /Market/.test(err) ? err : undefined}>{(f) => <Input {...f} value={market} maxLength={8} onChange={(e) => setMarket(e.target.value)} placeholder="e.g. AE-en" />}</Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!!err} onClick={() => onSave({ edit: [{ promptId: p.promptId, ...(reworded ? { prompt: prompt.trim() } : {}), persona: persona.trim(), cluster: cluster.trim().toLowerCase(), ...(stage ? { stage } : {}), ...(market.trim() ? { market: market.trim() } : {}) }] }, reworded ? 'Saved as a new question; the old wording is switched off' : 'Question updated')}>
          Save
        </Button>
      </div>
    </div>
  );
}

/** A3: the toast after an add: asked from the next weekly run only as far as the panel size reaches. */
export function addedMessage(n: number, own: number, size: number): string {
  const { notAsked } = aiPanelOverflow(own, n, size);
  const what = n === 1 ? 'Question added' : `${n} questions added`;
  if (!notAsked) return `${what}. ${n === 1 ? 'It is' : 'They are'} asked from the next weekly run`;
  return `${what}. ${notAsked} of your questions are over your panel size of ${size} and are not asked until you raise it`;
}

/** A3: before an add or an import that passes the panel size: how many would not be asked, and what the panel that asks them all uses. */
function OverflowWarning({ own, adding, size, engines }: { own: number; adding: number; size: number; engines: readonly string[] }) {
  const o = aiPanelOverflow(own, adding, size);
  if (!o.notAsked) return null;
  const now = estimateAiPanelCost({ panel: size, engines: engines.length ? engines : undefined }).month.total;
  const then = estimateAiPanelCost({ panel: o.sizeNeeded, engines: engines.length ? engines : undefined }).month.total;
  return (
    <Callout tone="warning" title={`${o.notAsked} question${o.notAsked === 1 ? '' : 's'} would not be asked`}>
      Your panel asks {size} questions a week, and your own questions come first. With these {adding} you would have {own + adding}, so {o.notAsked} stay stored but are not asked.
      A panel of {o.sizeNeeded} asks them all: about {creditsLabel(then)} a month instead of {creditsLabel(now)}. Change it under the panel size in the tracking settings.
    </Callout>
  );
}

function AddQuestions({ busy, onAdd, own = 0, size = AI_PANEL_LIMITS.default_new, engines = [] }: { busy: boolean; onAdd: (add: Record<string, unknown>[], msg: string) => void; own?: number; size?: number; engines?: readonly string[] }) {
  const [draft, setDraft] = useState('');
  const [persona, setPersona] = useState('');
  const [cluster, setCluster] = useState('');
  const [market, setMarket] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState<(AiPanelCsvResult & { name: string; keywords?: number }) | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const add = () => {
    const items = draft.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!items.length) return setError('Enter at least one question');
    const short = items.find((s) => s.length < 10);
    if (short) return setError(`"${short}" is too short: questions need at least 10 characters`);
    if (items.find((s) => s.length > 300)) return setError('Keep each question under 300 characters');
    if (items.length > 500) return setError('Add at most 500 questions at a time');
    if (market.trim() && !/^[A-Za-z]{2}([-_ ][A-Za-z]{2,3})?$/.test(market.trim())) return setError('Market: a country code and a language, e.g. SA-en');
    setError(null);
    onAdd(items.map((prompt) => ({ prompt, persona: persona.trim(), cluster: cluster.trim().toLowerCase(), stage: '', market: market.trim(), pinned })), addedMessage(items.length, own, size));
    setDraft('');
  };
  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1_000_000) { setCsv({ name: f.name, rows: [], errors: [{ line: 0, message: 'The file is larger than 1 MB' }], skipped: 0 }); return; }
    setCsv({ name: f.name, ...parseAiPanelCsvWithKeyword(await f.text()) });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-dashed border-line-strong p-4">
        <Field label="Add buyer questions" hint="One per line, the way a buyer would ask an assistant. The role, topic and market below apply to all of them." error={error ?? undefined}>
          {(p) => <Textarea {...p} rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Which ... should I hire for ...?" />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Buyer role" optional>{(p) => <Input {...p} value={persona} maxLength={40} onChange={(e) => setPersona(e.target.value)} placeholder="e.g. CFO" />}</Field>
          <Field label="Topic" optional>{(p) => <Input {...p} value={cluster} maxLength={60} onChange={(e) => setCluster(e.target.value)} placeholder="e.g. payroll" />}</Field>
          <Field label="Market" optional>{(p) => <Input {...p} value={market} maxLength={8} onChange={(e) => setMarket(e.target.value)} placeholder="e.g. SA-en" />}</Field>
        </div>
        <OverflowWarning own={own} adding={draft.split('\n').map((s) => s.trim()).filter(Boolean).length} size={size} engines={engines} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Checkbox label="Pin them (asked first, kept when the panel is smaller)" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <Button onClick={add} loading={busy} icon={<Plus className="size-4" />}>Add questions</Button>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-dashed border-line-strong p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium text-ink">Import a question list (CSV)</p>
          <GuideButton id="ai-panel-import" variant="link" label="How should the file look?" />
        </div>
        <p className="text-[13px] leading-snug text-ink-3">Columns: question, buyer role, cluster, stage, market, pinned, keyword. Only the question is required. Up to 500 questions a file.</p>
        <input ref={file} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ''; }} aria-label="Choose a CSV file" />
        <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={() => file.current?.click()}>Choose a file</Button>
        {csv && (
          <div className="space-y-2 text-[13px]">
            <p className="text-ink-2"><span className="font-medium text-ink">{csv.name}</span>: {csv.rows.length} question{csv.rows.length === 1 ? '' : 's'} ready{csv.skipped ? `, ${csv.skipped} blank or repeated line${csv.skipped === 1 ? '' : 's'} skipped` : ''}{csv.errors.length ? `, ${csv.errors.length} line${csv.errors.length === 1 ? '' : 's'} with a problem` : ''}{csv.keywords ? `, ${csv.keywords} with a keyword` : ''}.</p>
            {csv.errors.length > 0 && (
              <ul className="max-h-32 space-y-0.5 overflow-auto rounded-lg bg-surface-2 p-2 text-xs text-ink-2">
                {csv.errors.slice(0, 20).map((e) => <li key={e.line + e.message}>Line {e.line}: {e.message}</li>)}
              </ul>
            )}
            {csv.rows.length > 0 && <OverflowWarning own={own} adding={csv.rows.length} size={size} engines={engines} />}
            {csv.rows.length > 0 && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCsv(null)}>Cancel</Button>
                <Button loading={busy} onClick={() => { onAdd(csv.rows, addedMessage(csv.rows.length, own, size).replace(' added.', ' imported.')); setCsv(null); }}>Import {csv.rows.length}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A one-line summary of who the panel speaks for (the hero's subline on a big panel). */
export function panelSummary(panel: AiPanelInfo | null): ReactNode {
  if (!panel) return null;
  const n = (o: Record<string, number>) => Object.keys(o).length;
  return (
    <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" aria-hidden />{panel.size} questions · {n(panel.composition.cluster)} topics · {n(panel.composition.persona)} buyer roles · {n(panel.composition.market)} market{n(panel.composition.market) === 1 ? '' : 's'}</span>
  );
}
