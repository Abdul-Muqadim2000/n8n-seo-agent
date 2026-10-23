// AI visibility building blocks: the question x engine grid and the answers explorer. (A19, 2026-10-23: the old QuestionManager, replaced
// by PanelManager in ai-panel.tsx, is gone with its outdated copy.)
import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleX, Link2, Minus } from 'lucide-react';
import { AI_ENGINES, compactNumber, questionWin, titleCase, type AiData } from '@seo/shared';
import { cn, fmtAgo, fmtDate } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { Chips, FilterChips, Kind } from './kit';
import { urlPath } from './format';

const ENGINE_LABEL: Record<string, string> = Object.fromEntries(AI_ENGINES.map((e) => [e.value, e.label]));
/** Short engine names for narrow grid headers. */
const ENGINE_SHORT: Record<string, string> = { ai_overview: 'AI Overview', ai_mode: 'AI Mode', copilot: 'Copilot', chatgpt_api: 'GPT API', gemini_api: 'Gemini API' };
export const engineLabel = (key: string, fallback?: string) => ENGINE_LABEL[key] ?? fallback ?? titleCase(key);
const ENGINE_ORDER = AI_ENGINES.map((e) => e.value as string);
export const sortEngines = (keys: Iterable<string>) => [...new Set(keys)].sort((a, b) => (ENGINE_ORDER.indexOf(a) + 1 || 99) - (ENGINE_ORDER.indexOf(b) + 1 || 99));

type CellState = 'cited' | 'named' | 'absent' | 'none' | 'error' | 'monthly' | 'unknown';
const cellState = (v: string | undefined): CellState => {
  const s = String(v ?? '').toLowerCase();
  if (s === 'cited') return 'cited';
  if (s === 'named' || s === 'mentioned') return 'named';
  if (s === 'absent') return 'absent';
  if (s === 'none' || s === 'no_answer') return 'none';
  if (s === 'error') return 'error';
  if (s === 'monthly') return 'monthly';
  return 'unknown';
};

// the question x engine grid is a heat-map on the blue scale: cited (named + linked) is the strongest step, named the tint, answered
// without you neutral; failed checks keep the warning colour because that is a status. Every cell keeps its icon and word.
const CELL: Record<CellState, { label: string; icon: ReactNode; cls: string; help: string }> = {
  cited: { label: 'Cited', icon: <Link2 className="size-3.5" aria-hidden />, cls: 'bg-accent text-accent-ink font-semibold', help: 'Named and linked to one of your pages' },
  named: { label: 'Named', icon: <CheckCircle2 className="size-3.5" aria-hidden />, cls: 'bg-accent-soft text-accent-text font-medium ring-1 ring-accent/20 ring-inset', help: 'Your brand is named in the answer' },
  absent: { label: 'Not named', icon: <CircleX className="size-3.5" aria-hidden />, cls: 'bg-surface-2 text-ink-2', help: 'Answered without you' },
  none: { label: 'No answer', icon: <Minus className="size-3.5" aria-hidden />, cls: 'text-ink-3 ring-1 ring-line ring-inset', help: 'The engine gave no answer (e.g. no AI Overview shown)' },
  error: { label: 'Error', icon: <AlertTriangle className="size-3.5" aria-hidden />, cls: 'bg-warning-soft text-warning-text', help: 'The check failed; it is retried next run' },
  monthly: { label: 'Monthly', icon: <CalendarClock className="size-3.5" aria-hidden />, cls: 'text-ink-3 ring-1 ring-line ring-inset', help: 'Asked on the monthly full run; the last result is carried' },
  unknown: { label: '-', icon: null, cls: 'text-ink-3', help: 'Not asked' },
};

export function GridCell({ value, fill }: { value: string | undefined; /** stretch to the cell width (the grid) */ fill?: boolean }) {
  const c = CELL[cellState(value)];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs', fill && 'h-8 w-full min-w-[6rem] px-2', c.cls)} title={c.help}>
      {c.icon}
      {c.label}
    </span>
  );
}

/**
 * "This week" share of answers that name you, as a heat chip on the same blue scale, with its 95% range (B8-6). Under the engine's
 * floor (a few answers) it says "too few" instead of printing 0% or 100% as if it were a result.
 */
function RateCell({ q }: { q: { winRate: number | null; samples: number; win?: { ci?: unknown; enough?: unknown; why?: unknown } | null } }) {
  const w = questionWin(q);
  if (!w.enough || w.rate == null) {
    return (
      <span className="inline-flex min-w-[3.25rem] flex-col items-end rounded-md px-2 py-1 tabular ring-1 ring-line ring-inset" title={w.why}>
        <span className="text-[12px] font-medium text-ink-2">Too few</span>
        <span className="text-[11px] text-ink-3">{w.samples} {w.samples === 1 ? 'answer' : 'answers'}</span>
      </span>
    );
  }
  const r = Math.round(w.rate);
  const range = w.ci ? `${Math.round(w.ci[0])}-${Math.round(w.ci[1])}%` : null;
  return (
    <span
      className={cn('inline-flex min-w-[3.25rem] flex-col items-end rounded-md px-2 py-1 tabular', r >= 50 ? 'bg-accent text-accent-ink' : r > 0 ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-ink-2')}
      title={`${w.samples} answers${range ? ` · 95% range ${range}: where the true rate most likely lies` : ''}`}
    >
      <span className="text-[13px] font-semibold">{r}%</span>
      {range && <span className={cn('text-[11px]', r >= 50 ? 'text-accent-ink/80' : 'text-ink-3')}>{range}</span>}
      <span className={cn('text-[11px]', r >= 50 ? 'text-accent-ink/80' : 'text-ink-3')}>{w.samples} answers</span>
    </span>
  );
}

export function GridLegend() {
  const keys: CellState[] = ['cited', 'named', 'absent', 'none', 'error', 'monthly'];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legend">
      {keys.map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5 text-xs text-ink-3">
          <GridCell value={k} />
          <span>{CELL[k].help}</span>
        </li>
      ))}
    </ul>
  );
}

type Question = NonNullable<AiData['report']>['questions'][number];

/** Each tracked buyer question against each AI engine. */
export function QuestionGrid({ questions, engineNames }: { questions: readonly Question[]; engineNames: Record<string, string> }) {
  const [filter, setFilter] = useState<'all' | 'lost' | 'won'>('all');
  const engines = useMemo(() => sortEngines(questions.flatMap((q) => Object.keys(q.engines))), [questions]);
  const won = questions.filter((q) => q.won).length;
  const all = questions.filter((q) => (filter === 'won' ? q.won : filter === 'lost' ? !q.won : true));
  // G6: a 500-question panel is a 500-row grid; it opens on the first 50 and grows on request
  const [shown, setShown] = useState(50);
  const rows = all.slice(0, shown);
  return (
    <div className="space-y-3">
      <FilterChips
        label="Questions"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All questions', count: questions.length },
          { value: 'lost', label: 'Not named anywhere', count: questions.length - won },
          { value: 'won', label: 'Named at least once', count: won },
        ]}
      />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-[14rem] border-b border-line bg-surface-2 px-3 py-2 text-left text-xs font-medium text-ink-3">
                Buyer question
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-line px-2 py-2 text-right text-xs font-medium text-ink-3" title="Share of this week's answers to the question that name you (the weekly run and the daily pulse)">
                This week
              </th>
              {engines.map((e) => (
                <th key={e} scope="col" className="whitespace-nowrap border-b border-line px-2 py-2 text-left text-xs font-medium text-ink-3" title={engineNames[e] ?? engineLabel(e)}>
                  {ENGINE_SHORT[e] ?? engineNames[e] ?? engineLabel(e)}
                </th>
              ))}
              <th scope="col" className="min-w-[9rem] border-b border-line px-3 py-2 text-left text-xs font-medium text-ink-3">
                Named instead
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.promptId} className="group/qr border-b border-line bg-surface transition-colors duration-150 ease-brand last:border-b-0 hover:bg-surface-2/40">
                <th scope="row" className="sticky left-0 z-10 max-w-[19rem] bg-surface px-3 py-2.5 text-left align-top font-normal">
                  <p className="text-[13px] font-medium leading-snug text-ink">{q.prompt}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                    {q.kind && <Kind>{titleCase(q.kind)}</Kind>}
                    {q.stage && q.stage !== q.kind && <Kind>{titleCase(q.stage)}</Kind>}
                    {q.volume ? <span>{compactNumber(q.volume)} AI searches / mo</span> : q.topic ? <span className="truncate">{q.topic}</span> : null}
                  </p>
                </th>
                <td className="px-2 py-2.5 text-right align-top">
                  {q.winRate != null && q.samples ? (
                    <RateCell q={q} />
                  ) : (
                    <span className="text-xs text-ink-3">-</span>
                  )}
                </td>
                {engines.map((e) => (
                  <td key={e} className="px-1 py-2.5 align-top">
                    <GridCell value={q.engines[e]} fill />
                  </td>
                ))}
                <td className="px-3 py-2.5 align-top">
                  <Chips items={q.competitors} max={3} empty={<span className="text-xs">-</span>} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={engines.length + 3} className="px-3 py-8 text-center text-sm text-ink-3">
                  No question matches this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {all.length > rows.length && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
          <span>Showing {rows.length} of {all.length} questions</span>
          <span className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setShown((n) => n + 100)}>Show 100 more</Button>
            <Button size="sm" variant="ghost" onClick={() => setShown(all.length)}>Show all</Button>
          </span>
        </div>
      )}
      <GridLegend />
    </div>
  );
}

type Answer = AiData['answers'][number];
type AnswerFilter = 'all' | 'named' | 'cited' | 'absent' | 'error';

/** Read what the assistants actually said. */
export function AnswersExplorer({ answers, engineNames }: { answers: readonly Answer[]; engineNames: Record<string, string> }) {
  const [engine, setEngine] = useState('all');
  const [prompt, setPrompt] = useState('all');
  const [filter, setFilter] = useState<AnswerFilter>('all');
  const [limit, setLimit] = useState(8);
  const engines = sortEngines(answers.map((a) => a.engine));
  const prompts = [...new Map(answers.map((a) => [a.promptId, a.prompt])).entries()];
  const scoped = answers.filter((a) => (engine === 'all' || a.engine === engine) && (prompt === 'all' || a.promptId === prompt));
  const match = (a: Answer, f: AnswerFilter) => (f === 'named' ? a.mentioned : f === 'cited' ? a.cited : f === 'absent' ? a.answered && !a.mentioned : f === 'error' ? !!a.error || !a.answered : true);
  const shown = scoped.filter((a) => match(a, filter));

  if (!answers.length) return <EmptyState className="py-8" title="No stored answers yet" description="Answers are stored from the next AI visibility run." />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-48">
          <Select aria-label="Engine" value={engine} onChange={(e) => { setEngine(e.target.value); setLimit(8); }}>
            <option value="all">All engines</option>
            {engines.map((e) => (
              <option key={e} value={e}>
                {engineNames[e] ?? engineLabel(e)}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-80">
          <Select aria-label="Question" value={prompt} onChange={(e) => { setPrompt(e.target.value); setLimit(8); }}>
            <option value="all">All questions</option>
            {prompts.map(([id, p]) => (
              <option key={id} value={id}>
                {p.length > 70 ? `${p.slice(0, 69)}...` : p}
              </option>
            ))}
          </Select>
        </div>
        <FilterChips
          label="Answer filter"
          value={filter}
          onChange={(v) => { setFilter(v); setLimit(8); }}
          options={[
            { value: 'all', label: 'All', count: scoped.length },
            { value: 'named', label: 'Named', count: scoped.filter((a) => match(a, 'named')).length },
            { value: 'cited', label: 'Cited', count: scoped.filter((a) => match(a, 'cited')).length },
            { value: 'absent', label: 'Not named', count: scoped.filter((a) => match(a, 'absent')).length },
            { value: 'error', label: 'No answer / error', count: scoped.filter((a) => match(a, 'error')).length },
          ]}
        />
      </div>
      {shown.length ? (
        <ul className="space-y-2">
          {shown.slice(0, limit).map((a, i) => (
            <AnswerCard key={`${a.promptId}-${a.engine}-${i}`} a={a} engineName={engineNames[a.engine] ?? engineLabel(a.engine)} />
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-ink-3">No answer matches these filters.</p>
      )}
      {shown.length > limit && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + 12)}>
            Show more ({shown.length - limit} left)
          </Button>
        </div>
      )}
    </div>
  );
}

function AnswerCard({ a, engineName }: { a: Answer; engineName: string }) {
  const [open, setOpen] = useState(false);
  const long = a.excerpt.length > 360;
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">{engineName}</span>
        {a.cited ? (
          <StatusBadge tone="good">Cited</StatusBadge>
        ) : a.mentioned ? (
          <StatusBadge tone="good">Named{(a.position ?? (a.rank > 0 ? a.rank : null)) != null ? ` · #${a.position ?? a.rank}` : ''}</StatusBadge>
        ) : a.answered ? (
          <Badge icon={<CircleX className="size-3" aria-hidden />}>Not named</Badge>
        ) : (
          <Badge icon={<Minus className="size-3" aria-hidden />}>No answer</Badge>
        )}
        {a.sentiment && <Badge tone={a.sentiment === 'positive' ? 'good' : a.sentiment === 'negative' ? 'critical' : 'neutral'}>{titleCase(a.sentiment)}</Badge>}
        {a.runKind === 'pulse' && <Kind>daily pulse</Kind>}
        <span className="ml-auto text-xs text-ink-3" title={fmtDate(a.checkedAt)}>
          {fmtAgo(a.checkedAt)}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-medium text-ink-2">{a.prompt}</p>
      {a.excerpt && (
        <div className="mt-2">
          <p className={cn('whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]', !open && long && 'line-clamp-4')}>{a.excerpt}</p>
          {long && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-xs font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
              {open ? 'Show less' : 'Show the whole excerpt'}
            </button>
          )}
        </div>
      )}
      {a.error && <p className="mt-2 text-xs text-warning-text [overflow-wrap:anywhere]">Check failed: {a.error}</p>}
      {a.issues.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-critical-text">
          {a.issues.map((i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Wrong about you: {i}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-ink-3 sm:grid-cols-2">
        {a.competitors.length > 0 && (
          <div>
            Named: <Chips items={a.competitors} max={5} />
          </div>
        )}
        {a.sources.length > 0 && (
          <div>
            Sources: <Chips items={a.sources} max={4} />
          </div>
        )}
        {a.fanout.length > 0 && (
          <div className="sm:col-span-2">
            Searched for: <span className="text-ink-2">{a.fanout.slice(0, 3).join(' · ')}</span>
          </div>
        )}
        {a.ourUrls.length > 0 && (
          <div className="sm:col-span-2">
            Your pages:{' '}
            {a.ourUrls.map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="mr-2 text-accent-text hover:underline transition-colors duration-150 ease-brand">
                {urlPath(u)}
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
