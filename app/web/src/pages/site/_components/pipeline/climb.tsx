// Keyword-ladder page: "the climb" (rungs side by side, the main page last) and the panel of one page with its actions.
import { Fragment, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ExternalLink as ExternalIcon, FileText, Flag, Inbox, PenSquare, Play } from 'lucide-react';
import { compactNumber, type LadderDetail, type LadderPage } from '@seo/shared';
import { ButtonLink, Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ExternalLink, KeyValue } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { cn, fmtDate } from '@/lib/utils';
import { Chips } from '../kit';
import { daysSince, sortByDate, urlPath } from '../format';
import { PositionHistoryCard } from '../history';
import { asPageType, PageStateBadge, PositionChange, positionWords, rungLabel } from './common';
import type { WriteNowItem } from './WriteNowDialog';

const RUNG_HINT: Record<number, string> = {
  1: 'easiest',
  2: 'medium',
  3: 'harder',
  4: 'the goal',
};

/** One line under the keyword: where the page stands. */
function pageLine(p: LadderPage): string {
  switch (p.state) {
    case 'published':
      if (p.position == null) return 'First Google check next Monday';
      return p.position > 0 ? `Google position ${positionWords(p.position).replace('#', '')}` : positionWords(p.position);
    case 'waiting': {
      const d = daysSince(p.writtenAt);
      return d == null ? 'Ready to publish' : `Written ${d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`}`;
    }
    case 'writing':
      return 'Arrives in about 10 minutes';
    case 'gated':
      return 'Written once half the supporting pages are live';
    default:
      return p.pageType ? asPageType(p.pageType) : 'Planned';
  }
}

export function Climb({ ladder, onWrite }: { ladder: LadderDetail; onWrite: (i: WriteNowItem) => void }) {
  const [open, setOpen] = useState<LadderPage | null>(null);
  const columns = useMemo(() => {
    const m = new Map<number, LadderPage[]>();
    for (const p of ladder.pages ?? []) {
      const r = p.rung >= 4 ? 4 : Math.max(1, p.rung);
      m.set(r, [...(m.get(r) ?? []), p]);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([rung, pages]) => ({ rung, pages: [...pages].sort((a, b) => a.pageNo - b.pageNo) }));
  }, [ladder.pages]);

  return (
    <Card>
      <CardHeader
        title="The climb"
        description={
          columns.length === 1 && columns[0].rung === 4
            ? 'Only the main page for now: the search data has no supporting keywords for this topic yet. Select it for its details and what to do next.'
            : 'Easy pages first, the main page last. Every page links to the main page and makes it stronger. Select a page for its details and what to do next.'
        }
      />
      {!columns.length ? (
        <p className="px-5 py-6 text-sm text-ink-3">The plan has no pages yet. They appear here once the ladder plan arrives.</p>
      ) : (
        <div className="flex flex-col gap-2 px-5 pb-5 pt-4 lg:flex-row lg:items-stretch lg:gap-0">
          {columns.map((col, i) => {
            const main = col.rung === 4;
            const live = col.pages.filter((p) => p.state === 'published').length;
            return (
              <Fragment key={col.rung}>
                {i > 0 && (
                  <div className="flex shrink-0 items-center justify-center text-ink-3 lg:w-8" aria-hidden>
                    <ArrowDown className="size-4 lg:hidden" />
                    <ArrowRight className="hidden size-4 lg:block" />
                  </div>
                )}
                <section aria-label={rungLabel(col.rung)} className={cn('min-w-0 flex-1 rounded-xl border p-3', main ? 'border-accent/40 bg-accent-soft/60' : 'border-line bg-surface-2/50')}>
                  <header className="mb-2.5 flex items-baseline justify-between gap-2 px-0.5">
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      {main && <Flag className="size-3.5 text-accent-text" aria-hidden />}
                      {rungLabel(col.rung)}
                      <span className="text-xs font-normal text-ink-3">· {RUNG_HINT[col.rung] ?? ''}</span>
                    </h4>
                    <span className="whitespace-nowrap text-xs tabular text-ink-3">
                      {live} of {col.pages.length} live
                    </span>
                  </header>
                  <ul className="space-y-2">
                    {col.pages.map((p) => (
                      <li key={`${p.pageNo}-${p.keyword}`}>
                        <button
                          type="button"
                          onClick={() => setOpen(p)}
                          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-2"
                        >
                          <PageStateBadge state={p.state} />
                          <span className="mt-1.5 block break-words text-sm font-medium leading-snug text-ink">{p.keyword}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                            {pageLine(p)}
                            {p.state === 'published' && <PositionChange change={p.previousPosition != null && p.position != null && p.position > 0 && p.previousPosition > 0 ? p.previousPosition - p.position : null} />}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </Fragment>
            );
          })}
        </div>
      )}
      {open && <PagePanel page={open} ladder={ladder} onClose={() => setOpen(null)} onWrite={onWrite} />}
    </Card>
  );
}

function PagePanel({ page: p, ladder, onClose, onWrite }: { page: LadderPage; ladder: LadderDetail; onClose: () => void; onWrite: (i: WriteNowItem) => void }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const canWrite = can('member') && (p.state === 'planned' || p.state === 'gated');
  const history = sortByDate(p.history ?? [], (h) => h.checkedAt);
  const write = () => {
    onClose();
    onWrite({
      keyword: p.keyword,
      why: `Keyword ladder “${ladder.head}”, ${p.rung >= 4 ? 'the main page' : `rung ${p.rung}`}`,
      pageType: p.pageType,
      existingPageUrl: '',
      ladder: { id: ladder.id, rung: p.rung, head: ladder.head, pageNo: p.pageNo },
    });
  };
  return (
    <Dialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title={p.keyword}
      description={`${rungLabel(p.rung)} of the keyword ladder “${ladder.head}”`}
      footer={
        <>
          {p.runId && (
            <ButtonLink to={paths.run(org.id, p.runId)} variant="ghost" size="sm" icon={<Play className="size-4" />}>
              Open the run
            </ButtonLink>
          )}
          {p.reportId && (
            <ButtonLink to={paths.report(org.id, p.reportId)} variant="secondary" size="sm" icon={<FileText className="size-4" />}>
              Open the page and files
            </ButtonLink>
          )}
          {p.state === 'waiting' && can('member') && (
            <ButtonLink to={paths.tool(org.id, 'published', { siteId: site.id, prefill: { keyword: p.keyword } })} size="sm" icon={<Inbox className="size-4" />}>
              I published it
            </ButtonLink>
          )}
          {canWrite && (
            <Button size="sm" variant={p.state === 'gated' ? 'secondary' : 'primary'} icon={<PenSquare className="size-4" />} onClick={write}>
              Write now
            </Button>
          )}
          {p.state === 'published' && p.publishedUrl && (
            <a href={p.publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[13px] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
              View the live page
              <ExternalIcon className="size-3.5" aria-hidden />
            </a>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <PageStateBadge state={p.state} />
          <span className="text-[13px] text-ink-3">{pageLine(p)}</span>
        </div>
        {p.state === 'gated' && (
          <p className="text-[13px] leading-snug text-ink-2">
            The main page waits until half of the supporting pages are live (or the main keyword already ranks in the top 30): supporting pages first make it much
            more likely to rank. You can still write it now.
          </p>
        )}
        <KeyValue
          items={[
            { label: 'Page type', value: p.pageType ? asPageType(p.pageType) : '–' },
            ...(p.volume != null ? [{ label: 'Searches a month', value: compactNumber(p.volume) }] : []),
            ...(p.kd != null ? [{ label: 'Difficulty (0–100)', value: String(p.kd) }] : []),
            ...(p.supporting?.length ? [{ label: 'Also covers', value: <Chips items={p.supporting} max={8} /> }] : []),
            ...(p.publishedUrl
              ? [{ label: 'Live at', value: <ExternalLink href={p.publishedUrl}>{urlPath(p.publishedUrl)}</ExternalLink> }]
              : p.targetUrl
                ? [{ label: 'Planned address', value: <span className="break-all">{urlPath(p.targetUrl)}</span> }]
                : []),
            ...(p.writtenAt ? [{ label: 'Written', value: fmtDate(p.writtenAt) }] : []),
            ...(p.publishedAt ? [{ label: 'Published', value: fmtDate(p.publishedAt) }] : []),
            ...(p.position != null ? [{ label: 'Google position', value: positionWords(p.position) }] : []),
            ...(p.bestPosition != null && p.bestPosition > 0 ? [{ label: 'Best so far', value: positionWords(p.bestPosition) }] : []),
          ]}
        />
        {history.some((h) => h.position > 0) ? (
          <PositionHistoryCard title="Position over time" lines={[{ key: 'p', label: p.keyword, history }]} height={170} />
        ) : (
          history.length > 0 && (
            <p className="text-[13px] text-ink-3">
              Checked on Google {history.length === 1 ? 'once' : `${history.length} times`}, not in the top 50 yet. New pages usually need a few weeks after they go live.
            </p>
          )
        )}
      </div>
    </Dialog>
  );
}
