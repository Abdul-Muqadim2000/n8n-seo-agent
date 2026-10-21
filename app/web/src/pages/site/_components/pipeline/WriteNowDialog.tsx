import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PenSquare } from 'lucide-react';
import { contentReadiness, readinessPage, urlOnHost, type QueueItem, type Site } from '@seo/shared';
import { PRICES } from '@/lib/prices';
import { formatCredits } from '@/lib/credits';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Dialog } from '@/components/ui/overlay';
import { errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useSiteData, useStartRun } from '@/lib/queries';
import { asPageType } from './common';

/** A page to write now: a blog-queue topic or a planned page of a keyword ladder. */
export interface WriteNowItem {
  keyword: string;
  why: string;
  pageType: string;
  existingPageUrl?: string;
  /** a ladder page: keeps the ladder row, its internal links and the rank tracking in step */
  ladder: QueueItem['ladder'];
  /** keyword-first (R-K5): a suggestion's AI target, so an approved AI answer page is written as one */
  aiTarget?: QueueItem['aiTarget'];
  /** where the suggestion came from (shown in the dialog) */
  source?: QueueItem['source'];
  /** the price of the page in credits, when the server priced it */
  credits?: number;
}

const SOURCE_WHAT: Record<QueueItem['source'], string> = {
  ladder: 'A page of your keyword',
  decay: 'A refresh of your page that is losing visitors',
  striking: 'A page for a search where you are close to page one',
  trend: 'A page for a rising search',
  ai_answer: 'A page written to be the answer AI assistants cite',
  ai_refresh: 'A refresh of your page so AI assistants cite it',
};

/**
 * The run a "Write it" / "Write now" starts (pure): one page of the website, with the ladder page, the suggestion's AI target and where
 * the suggestion came from (`source`, kept on the website's content log, R-K5). The server checks every field again.
 */
export function writeNowRequest(item: WriteNowItem, site: Pick<Site, 'id' | 'domain' | 'country' | 'tone' | 'goal'>) {
  const existing = item.existingPageUrl && urlOnHost(item.existingPageUrl, site.domain) ? item.existingPageUrl : '';
  const t = item.aiTarget;
  // the run's AI target takes the schema's shape (the server checks the lengths again)
  const aiTarget =
    t && t.question && t.question.trim().length >= 8
      ? {
          question: t.question.trim().slice(0, 300),
          kind: t.kind === 'refresh' ? ('refresh' as const) : ('answer' as const),
          targetId: (t.targetId ?? '').slice(0, 120),
          fanout: (t.fanout ?? []).filter(Boolean).slice(0, 8),
          sources: (t.sources ?? []).filter((x) => /^https?:\/\//.test(x.url)).slice(0, 6).map((x) => ({ url: x.url.slice(0, 300), title: (x.title ?? '').slice(0, 140) })),
          competitors: (t.competitors ?? []).filter(Boolean).slice(0, 8),
        }
      : null;
  return {
    mode: 'keyword' as const,
    siteId: site.id,
    keyword: item.keyword,
    country: site.country,
    pageType: asPageType(item.pageType),
    existingPageUrl: existing,
    tone: site.tone,
    goal: site.goal,
    receiveReport: true,
    receiveContent: true,
    ...(item.ladder ? { ladder: item.ladder } : {}),
    ...(aiTarget ? { aiTarget } : {}),
    ...(item.source ? { source: item.source } : {}),
    emailCopy: false,
  };
}

/**
 * D6 (pre-launch run 2026-10-21): "Write it now" on a page of a keyword does not add a page to the week, it moves one. The engine counts a
 * ladder page written since the last weekly run against the next run's pages a week (Cadence_Plan.js R-K7, unchanged), so that run writes
 * one page fewer: in the run, the keyword's next page waited a week and nothing said so.
 */
export function weeklyTradeOff(pagesPerWeek: number | null | undefined): string {
  const n = Number(pagesPerWeek) || 0;
  if (n <= 0) return 'Your weekly pages are off, so this is one page on top: nothing else moves.';
  return n === 1
    ? 'This uses your next weekly run\'s page (1 page a week): that run writes no other page, so the next page of your keyword moves a week later.'
    : `This uses one of your next weekly run's ${n} pages a week: that run writes ${n - 1} instead of ${n}.`;
}

/**
 * Starts one content run for this website. The run marks the topic (or the ladder page) as written, so the weekly run moves on to
 * the next one instead of writing it twice.
 */
export function WriteNowDialog({ item, onClose, note }: { item: WriteNowItem; onClose: () => void; note?: string }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const start = useStartRun(org.id);
  // P1 (2026-10-20, rehearsal §4 item 1): without the author profile and the business facts the page arrives as a draft with blanks to fill
  // (the byline, the author box and claims the facts would support). The client may still choose to write it: warned, never blocked.
  const settings = useSiteData(org.id, site.id, 'settings', undefined, { enabled: !!site.verifiedAt });
  const readiness = settings.data ? contentReadiness({ profile: settings.data.profile, businessFacts: site.businessFacts }) : null;
  const notReady = !!readiness && !readiness.ready;
  const navigate = useNavigate();
  const body = writeNowRequest(item, site);
  const aiTarget = body.aiTarget ?? null;
  const existing = body.existingPageUrl;
  const write = () =>
    start.mutate(
      body,
      {
        onSuccess: (run) => {
          if (run.status === 'failed') {
            toast.error(run.error ?? 'The SEO engine did not accept the run');
            return;
          }
          toast.success('Writing started: the page arrives in about 10 minutes');
          navigate(paths.run(org.id, run.id));
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Write "${item.keyword}" now`}
      description="Researched, written, edited and checked, delivered as a page you publish (HTML, Markdown, Word, PDF). It is then marked as written, so the weekly run moves on to the next page."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {notReady && can('admin') && (
            <ButtonLink to={paths.site(org.id, site.id, readinessPage(readiness!))} variant="secondary" onClick={onClose}>
              Add them first
            </ButtonLink>
          )}
          <Button loading={start.isPending} icon={<PenSquare className="size-4" />} onClick={write}>
            {notReady ? 'Write anyway' : 'Write it'} (about {item.credits ? formatCredits(item.credits) : PRICES.page()})
          </Button>
        </>
      }
    >
      {notReady && (
        <Callout tone="warning" title="The page will be a draft with blanks to fill" className="mb-4">
          Your website has no {readiness!.missingText} on file yet, so the byline, the author box and some claims come back as bracketed fields to complete
          before you can publish. Add them first, or write it anyway.
        </Callout>
      )}
      <dl className="space-y-2 text-sm">
        {item.why && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">Why</dt>
            <dd className="min-w-0 text-ink">{item.why}</dd>
          </div>
        )}
        {item.source && item.source !== 'ladder' && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">What</dt>
            <dd className="min-w-0 text-ink">{SOURCE_WHAT[item.source]}</dd>
          </div>
        )}
        {aiTarget && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">AI question</dt>
            <dd className="min-w-0 text-ink">{aiTarget.question}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-3">Page type</dt>
          <dd className="text-ink">{asPageType(item.pageType)}</dd>
        </div>
        {item.ladder && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">Keyword ladder</dt>
            <dd className="min-w-0 text-ink">
              {item.ladder.head} · {item.ladder.rung >= 4 ? 'main page' : `rung ${item.ladder.rung}`} (linked to the ladder's other pages)
            </dd>
          </div>
        )}
        {existing && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">Improves</dt>
            <dd className="min-w-0 break-all text-ink">{existing}</dd>
          </div>
        )}
      </dl>
      {/* D6 (pre-launch run 2026-10-21): the trade-off, said before the click (the engine's budget rule is unchanged) */}
      {item.ladder && <p className="mt-3 text-[13px] leading-snug text-ink-3">{weeklyTradeOff(site.blogsPerWeek)}</p>}
      {note && <p className="mt-3 text-[13px] leading-snug text-ink-3">{note}</p>}
    </Dialog>
  );
}
