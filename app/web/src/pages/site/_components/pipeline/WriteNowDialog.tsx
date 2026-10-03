import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PenSquare } from 'lucide-react';
import { formatUsd, MODES, urlOnHost, type QueueItem } from '@seo/shared';
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
}

/**
 * Starts one content run for this website. The run marks the topic (or the ladder page) as written, so the Monday cadence moves
 * on to the next one instead of writing it twice.
 */
export function WriteNowDialog({ item, onClose, note }: { item: WriteNowItem; onClose: () => void; note?: string }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const start = useStartRun(org.id);
  const navigate = useNavigate();
  const existing = item.existingPageUrl && urlOnHost(item.existingPageUrl, site.domain) ? item.existingPageUrl : '';
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
      title={`Write “${item.keyword}” now`}
      description="Researched, written, edited and checked, delivered as a page you publish (HTML, Markdown, Word, PDF). It is then marked as written, so the Monday run moves on to the next page."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={start.isPending} icon={<PenSquare className="size-4" />} onClick={write}>
            Write it (about {formatUsd(MODES.keyword.costUsd)})
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
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-3">Page type</dt>
          <dd className="text-ink">{asPageType(item.pageType)}</dd>
        </div>
        {item.ladder && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-3">Keyword ladder</dt>
            <dd className="min-w-0 text-ink">
              {item.ladder.head} · {item.ladder.rung >= 4 ? 'main page' : `rung ${item.ladder.rung}`} (linked to the ladder’s other pages)
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
