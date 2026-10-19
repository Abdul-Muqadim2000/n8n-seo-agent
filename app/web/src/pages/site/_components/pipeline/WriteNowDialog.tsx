import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PenSquare } from 'lucide-react';
import { urlOnHost, type QueueItem } from '@seo/shared';
import { PRICES } from '@/lib/prices';
import { formatCredits } from '@/lib/credits';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlay';
import { errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useStartRun } from '@/lib/queries';
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
 * Starts one content run for this website. The run marks the topic (or the ladder page) as written, so the weekly run moves on to
 * the next one instead of writing it twice.
 */
export function WriteNowDialog({ item, onClose, note }: { item: WriteNowItem; onClose: () => void; note?: string }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const start = useStartRun(org.id);
  const navigate = useNavigate();
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
  const write = () =>
    start.mutate(
      {
        mode: 'keyword',
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
        emailCopy: false,
      },
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
          <Button loading={start.isPending} icon={<PenSquare className="size-4" />} onClick={write}>
            Write it (about {item.credits ? formatCredits(item.credits) : PRICES.page()})
          </Button>
        </>
      }
    >
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
      {note && <p className="mt-3 text-[13px] leading-snug text-ink-3">{note}</p>}
    </Dialog>
  );
}
