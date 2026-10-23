// AI visibility wave 2 (W2-A, 2026-10-23): the answer drill-down. Answers page in from the server (the page no longer loads every answer),
// filtered by the page's filter bar. Each answer shows what the engine said (the whole answer when the run stored it, else the excerpt),
// the brands in the order they were named with their role, our place, every citation in order with ours marked, the pages the engine
// read but did not cite, the searches it ran, product / ad / local cards and the model. A question opens with every engine side by side
// and its history across the stored runs.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, CircleX, ExternalLink as ExternalIcon, History, Link2, Minus, Search, ShoppingBag, Store, Megaphone } from 'lucide-react';
import { AI_MIN_RATE_SAMPLES, aiAnswersPageOf, aiFilterQuery, aiHostOf, aiIsOwnUrl, titleCase, type AiData, type AiFilter } from '@seo/shared';
import { ApiRequestError } from '@/lib/api';
import { useAiAnswers, useAiQuestion } from '@/lib/queries';
import { cn, fmtAgo, fmtDate } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { Chips, FilterChips, Kind, useSitePage } from './kit';
import { pct, urlPath } from './format';
import { engineLabel, sortEngines } from './ai';
import { RangeTrendChart } from './ai-trends';

type Answer = AiData['answers'][number];

/**
 * R-A21: for an answer row without the engine's entities, a brand is "You" only when it IS the site's name: the domain, or its first label
 * as a whole name ("Techand", "techand.ai"), never any brand that merely contains it (on ai.com every brand with "ai" in it was "You").
 */
export const isSelfName = (name: string, domain: string): boolean => {
  const n = name.toLowerCase().trim().replace(/^www\./, ''), d = domain.toLowerCase().replace(/^www\./, '');
  const label = d.split('.')[0] ?? '';
  return n === d || n.replace(/[\s-]+/g, '') === label || (n.split(/\s+/)[0] === label && n.split(/\s+/).length <= 2);
};
type ResultFilter = 'all' | 'named' | 'cited' | 'absent' | 'error';

/** The answers of a run, a page at a time, with the filter's rates. */
/**
 * R-A9 (review 2026-10-23): the answers an API from before the paged endpoint still embeds in /data/ai. When /data/ai/answers answers
 * 404 (the web deployed before the API), the section pages these itself with the same shared code, so either deploy order works.
 */
export interface EmbeddedAnswers { answers: AiData['answers']; runId: string | null; checkedAt: string | null }

export function AnswersBrowser({ filter, engineNames, embedded }: { filter: AiFilter; engineNames: Record<string, string>; embedded?: EmbeddedAnswers }) {
  const { org, site } = useSitePage();
  const [result, setResult] = useState<ResultFilter>('all');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [run, setRun] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  // a new filter (bar, result, search, run) starts on the first page
  const fk = JSON.stringify([filter, result, q, run]);
  useEffect(() => setPage(1), [fk]);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const res = useAiAnswers(org.id, site.id, { ...aiFilterQuery(filter), result: result === 'all' ? undefined : result, q: q || undefined, page, pageSize: 12, run: run || undefined });
  const older = res.isError && res.error instanceof ApiRequestError && res.error.status === 404 && !!embedded?.answers.length;
  const local = useMemo(
    () =>
      older && embedded
        ? aiAnswersPageOf(embedded.answers, { filter, result, text: q, page, pageSize: 12 }, { runId: embedded.runId, checkedAt: embedded.checkedAt, runs: embedded.runId && embedded.checkedAt ? [{ runId: embedded.runId, checkedAt: embedded.checkedAt }] : [] })
        : null,
    [older, embedded, filter, result, q, page],
  );
  const d = local ?? res.data;
  if (res.isError && !d) return <ErrorState error={res.error} onRetry={() => void res.refetch()} />;
  if (!d) return <AnswersSkeleton />;
  if (!d.runId) return <EmptyState className="py-8" title="No stored answers yet" description="Answers are stored from the next AI visibility run." />;
  const s = d.summary;
  const pages = Math.max(1, Math.ceil(d.total / d.pageSize));
  return (
    <div className="space-y-3" aria-busy={res.isFetching || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-56">
          <Select aria-label="Run" value={run} onChange={(e) => setRun(e.target.value)}>
            <option value="">{filter.to ? 'Newest run in the dates chosen' : 'Latest run'}</option>
            {d.runs.map((r) => (
              <option key={r.runId + r.checkedAt} value={r.runId}>
                Run of {fmtDate(r.checkedAt)}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input aria-label="Search the answers" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search questions and answers" className="pl-8" />
        </div>
        <FilterChips
          label="Answer filter"
          value={result}
          onChange={setResult}
          options={[
            { value: 'all', label: 'All' },
            { value: 'named', label: 'Named' },
            { value: 'cited', label: 'Cited' },
            { value: 'absent', label: 'Not named' },
            { value: 'error', label: 'No answer / error' },
          ]}
        />
      </div>
      <p className="text-[13px] text-ink-2">
        Run of {fmtDate(d.checkedAt!)} · {s.answered} answers in this view, {s.questions} {s.questions === 1 ? 'question' : 'questions'}:{' '}
        {s.enough && s.namedRate != null ? (
          <>
            named in <span className="font-medium text-ink">{pct(s.namedRate)}</span>
            {s.namedCi ? ` (95% range ${pct(s.namedCi[0], 0)} to ${pct(s.namedCi[1], 0)})` : ''}, cited in <span className="font-medium text-ink">{pct(s.citedRate)}</span>
          </>
        ) : (
          'too few answers for a rate'
        )}
        .
      </p>
      {d.items.length ? (
        <ul className="space-y-2">
          {d.items.map((a, i) => (
            <AnswerDetailCard key={`${a.promptId}-${a.engine}-${a.checkedAt}-${i}`} a={a} engineName={engineNames[a.engine] ?? engineLabel(a.engine)} onQuestion={() => setQuestion(a.promptId)} domain={site.domain} />
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-ink-3">No answer matches these filters.</p>
      )}
      {pages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-xs text-ink-3" aria-label="Answer pages">
          <span>
            Page {d.page} of {pages} · {d.total} answers
          </span>
          <span className="flex gap-1">
            <Button size="sm" variant="secondary" icon={<ChevronLeft className="size-4" />} disabled={d.page <= 1} onClick={() => setPage(d.page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={d.page >= pages} onClick={() => setPage(d.page + 1)}>
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </span>
        </nav>
      )}
      <QuestionDialog promptId={question} onClose={() => setQuestion(null)} engineNames={engineNames} />
    </div>
  );
}

function AnswersSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { self: 'You', competitor: 'Competitor', platform: 'Platform', source: 'Source', other: 'Other' };

function Block({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-3">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

/** One answer with everything the run stored about it. */
export function AnswerDetailCard({ a, engineName, onQuestion, domain, compact }: { a: Answer; engineName: string; onQuestion?: () => void; domain: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const x = a.detail;
  const text = x?.answerText ?? a.excerpt;
  const full = x?.answerText != null;
  const long = text.length > 480;
  const position = a.position ?? (a.rank > 0 ? a.rank : null);
  // brands in the order named: the entities when the row has them, else the brand list
  const brands = a.entities?.length ? [...a.entities].sort((p, q) => (p.position ?? 99) - (q.position ?? 99)) : a.brands.map((name, i) => ({ id: name, name, role: isSelfName(name, domain) ? 'self' : 'other', position: i + 1, cited: false }));
  const citations = x?.citations ?? [...a.ourUrls.map((u) => ({ url: u, host: aiHostOf(u), entityId: '', role: 'self', position: null as number | null, own: true })), ...a.citedUrls.map((c) => ({ url: c.url, host: aiHostOf(c.url), entityId: '', role: '', position: null as number | null, own: aiIsOwnUrl(c.url, domain) }))];
  const fanout = x?.fanoutQueries ?? a.fanout;
  const shownNone = [x?.retrieved?.length === 0 && !x?.answerExpired ? 'pages read but not cited' : '', x?.products?.length === 0 ? 'product cards' : '', x?.ads?.length === 0 ? 'ads' : '', x?.local?.length === 0 ? 'local business cards' : ''].filter(Boolean);
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">{engineName}</span>
        {x?.model ? <Kind>{x.model}</Kind> : null}
        {a.cited ? (
          <StatusBadge tone="good">Cited{position != null ? ` · named #${position}` : ''}</StatusBadge>
        ) : a.mentioned ? (
          <StatusBadge tone="good">Named{position != null ? ` · #${position}` : ''}</StatusBadge>
        ) : a.answered ? (
          <Badge icon={<CircleX className="size-3" aria-hidden />}>Not named</Badge>
        ) : (
          <Badge icon={<Minus className="size-3" aria-hidden />}>No answer</Badge>
        )}
        {a.sentiment && <Badge>{titleCase(a.sentiment)}</Badge>}
        {a.runKind === 'pulse' && <Kind>daily pulse</Kind>}
        <span className="ml-auto text-xs text-ink-3" title={fmtDate(a.checkedAt)}>
          {fmtAgo(a.checkedAt)}
        </span>
      </div>
      {!compact && (
        <p className="mt-1.5 text-[13px] font-medium text-ink-2">
          {onQuestion ? (
            <button type="button" onClick={onQuestion} className="text-left hover:text-accent-text hover:underline transition-colors duration-150 ease-brand">
              {a.prompt}
            </button>
          ) : (
            a.prompt
          )}
          {a.persona || a.market ? <span className="ml-1.5 text-xs font-normal text-ink-3">{[a.persona, a.market].filter(Boolean).join(' · ')}</span> : null}
        </p>
      )}
      {text && (
        <div className="mt-2">
          <p className={cn('whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]', !open && long && 'line-clamp-6')}>{text}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            {long && (
              <button type="button" onClick={() => setOpen((o) => !o)} className="font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand" aria-expanded={open}>
                {open ? 'Show less' : full ? 'Show the whole answer' : 'Show the whole excerpt'}
              </button>
            )}
            <span className="text-ink-3">{full ? (x?.answerCut ? 'The whole answer, cut at 12,000 characters' : 'The whole answer') : x?.answerExpired ? 'An excerpt: the whole answer is kept 35 days (7 for the daily pulse)' : 'An excerpt around the mention (this run did not store the whole answer)'}</span>
          </div>
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
      <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        {brands.length > 0 && (
          <Block title="Brands, in the order named">
            <ol className="flex flex-wrap gap-1.5">
              {brands.slice(0, 12).map((b, i) => (
                <li key={b.id + i} className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5', b.role === 'self' ? 'border-accent bg-accent-soft text-accent-text' : 'border-line text-ink-2')}>
                  <span className="tabular text-ink-3">{b.position ?? i + 1}.</span>
                  <span className="font-medium">{b.name}</span>
                  <span className="text-[11px] text-ink-3">{ROLE_LABEL[b.role] ?? b.role}</span>
                </li>
              ))}
            </ol>
          </Block>
        )}
        {citations.length > 0 && (
          <Block title={x?.citations ? 'Citations, in order' : 'Pages cited'} icon={<Link2 className="size-3.5" aria-hidden />}>
            <ol className="space-y-0.5">
              {citations.slice(0, 10).map((c, i) => (
                <li key={c.url + i} className="flex min-w-0 items-baseline gap-1.5">
                  <span className="tabular text-ink-3">{c.position ?? i + 1}.</span>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" title={c.url} className={cn('min-w-0 truncate hover:underline transition-colors duration-150 ease-brand', c.own ? 'font-semibold text-accent-text' : 'text-ink-2')}>
                    {c.own ? `Yours: ${urlPath(c.url)}` : `${c.host}${urlPath(c.url) === '/' ? '' : urlPath(c.url)}`}
                  </a>
                </li>
              ))}
            </ol>
          </Block>
        )}
        {x?.retrieved && x.retrieved.length > 0 && (
          <Block title="Read but not cited">
            <ul className="space-y-0.5">
              {x.retrieved.slice(0, 8).map((r) => (
                <li key={r.url} className="truncate" title={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className={cn('hover:underline', r.own ? 'font-semibold text-accent-text' : 'text-ink-2')}>
                    {r.own ? `Yours: ${urlPath(r.url)}` : r.host}
                  </a>
                </li>
              ))}
            </ul>
          </Block>
        )}
        {fanout.length > 0 && (
          <Block title="What it searched before answering" icon={<Search className="size-3.5" aria-hidden />}>
            <Chips items={fanout} max={6} />
          </Block>
        )}
        {a.sources.length > 0 && !x?.citations && (
          <Block title="Sources">
            <Chips items={a.sources} max={5} />
          </Block>
        )}
        {x?.products && x.products.length > 0 && (
          <Block title="Product cards" icon={<ShoppingBag className="size-3.5" aria-hidden />}>
            <ul className="space-y-0.5">
              {x.products.slice(0, 6).map((p, i) => (
                <li key={p.url + i} className={cn('truncate', p.own ? 'font-semibold text-accent-text' : 'text-ink-2')}>
                  {p.position ?? i + 1}. {p.title}
                  {p.merchant ? ` · ${p.merchant}` : ''}
                  {p.price != null ? ` · ${p.price} ${p.currency}` : ''}
                </li>
              ))}
            </ul>
          </Block>
        )}
        {x?.ads && x.ads.length > 0 && (
          <Block title="Ads shown" icon={<Megaphone className="size-3.5" aria-hidden />}>
            <Chips items={x.ads.map((ad) => `${ad.advertiser || ad.host}${ad.rendered ? '' : ' (not shown)'}`)} max={4} />
          </Block>
        )}
        {x?.local && x.local.length > 0 && (
          <Block title="Local business cards" icon={<Store className="size-3.5" aria-hidden />}>
            <Chips items={x.local.map((l) => (l.own ? `You: ${l.name}` : l.name))} max={5} />
          </Block>
        )}
      </div>
      {/* W2-E1: '[]' = the engine reports this and showed none; an absent column = the engine does not report it (nothing said) */}
      {shownNone.length > 0 && <p className="mt-2 text-xs text-ink-3">Shown none in this answer: {shownNone.join(', ')}.</p>}
      {onQuestion && !compact && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="ghost" icon={<History className="size-4" />} onClick={onQuestion}>
            Every engine and its history
          </Button>
        </div>
      )}
    </li>
  );
}

/** One question: every engine side by side in the latest run that asked it, and its named rate across the stored runs. */
export function QuestionDialog({ promptId, onClose, engineNames }: { promptId: string | null; onClose: () => void; engineNames: Record<string, string> }) {
  const { org, site } = useSitePage();
  const q = useAiQuestion(org.id, site.id, promptId);
  const h = q.data;
  const [runIx, setRunIx] = useState(0);
  useEffect(() => setRunIx(0), [promptId]);
  const run = h?.runs[runIx];
  return (
    <Dialog open={!!promptId} onOpenChange={(o) => !o && onClose()} wide title={h?.prompt ?? 'Question'} description={h ? [h.facets.cluster, h.facets.persona, h.facets.market, h.facets.stage && titleCase(h.facets.stage), h.facets.keyword && `keyword: ${h.facets.keyword}`].filter(Boolean).join(' · ') : undefined}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !h ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-4">
          {h.series.length > 1 && (
            <RangeTrendChart runs={h.series.map((x) => ({ runId: x.runId, checkedAt: x.checkedAt, compare: null }))} values={(i) => ({ value: h.series[i].n >= AI_MIN_RATE_SAMPLES ? h.series[i].namedRate : null, band: h.series[i].ci })} label="Named in" height={180} />
          )}
          <p className="text-xs text-ink-3">
            {h.note}
            {h.series.some((x) => x.n < AI_MIN_RATE_SAMPLES) ? ` A run with fewer than ${AI_MIN_RATE_SAMPLES} answers to this question shows its range only, not a rate.` : ''}
          </p>
          {h.runs.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-ink">
                  Run of {fmtDate(run!.checkedAt)}: {run!.answers.length} {run!.answers.length === 1 ? 'answer' : 'answers'}
                </p>
                {h.runs.length > 1 && (
                  <div className="w-56">
                    <Select aria-label="Run" value={String(runIx)} onChange={(e) => setRunIx(Number(e.target.value))}>
                      {h.runs.map((r, i) => (
                        <option key={r.runId} value={i}>
                          Run of {fmtDate(r.checkedAt)}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
              <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {sortEngines(run!.answers.map((a) => a.engine)).flatMap((e) => run!.answers.filter((a) => a.engine === e)).map((a, i) => (
                  <AnswerDetailCard key={a.engine + a.checkedAt + i} a={a} engineName={engineNames[a.engine] ?? engineLabel(a.engine)} domain={site.domain} compact />
                ))}
              </ul>
            </>
          ) : (
            <EmptyState className="py-6" title="No stored answers for this question" description="It has not been asked since answers were kept, or its answers are older than about 120 days." />
          )}
          <p className="flex items-center gap-1 text-xs text-ink-3">
            <ExternalIcon className="size-3" aria-hidden /> Links open the page each assistant cited.
          </p>
        </div>
      )}
    </Dialog>
  );
}
