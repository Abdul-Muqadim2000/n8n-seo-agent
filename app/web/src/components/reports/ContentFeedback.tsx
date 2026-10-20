// "Not what I wanted" on a written page (SCHEDULING_KEYWORDS_PLAN.md §5.5): the person tells us a page missed, with an optional reason.
// Two of the last five pages the autopilot chose on its own marked this way drop the website's level to 1 (the server decides and says so).
import { useState } from 'react';
import { toast } from 'sonner';
import { ThumbsDown } from 'lucide-react';
import { REJECT_LIMIT, REJECT_WINDOW, type ReportDetail } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useContentFeedback } from '@/lib/queries';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { GuideButton } from '@/components/guide';

/** A written page: the button shows only on these (the server refuses any other report). */
export const isWrittenPage = (r: Pick<ReportDetail, 'stage' | 'payload'>): boolean => r.stage === 'content' && typeof r.payload?.keyword === 'string' && !!String(r.payload.keyword).trim();

export function NotWhatIWanted({ report }: { report: Pick<ReportDetail, 'id' | 'siteId' | 'stage' | 'payload'> }) {
  const { org, can } = useOrgCtx();
  const send = useContentFeedback(org.id, report.id, report.siteId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  if (!can('member') || !isWrittenPage(report)) return null;
  const keyword = String(report.payload.keyword);
  const submit = () =>
    send.mutate(
      { reason: reason.trim() },
      {
        onSuccess: (r) => {
          setOpen(false);
          setDone(true);
          if (r.levelDropped)
            toast.warning('We now write only for your keywords', {
              description: `You marked ${REJECT_LIMIT} of the last ${REJECT_WINDOW} pages we chose on our own as not what you wanted, so the autopilot went to level 1. Raise it again in Website settings, Autopilot.`,
              duration: 12_000,
            });
          else toast.success('Thank you, noted', { description: 'We use it to choose better pages for you.' });
        },
      },
    );
  return (
    <>
      <Button variant="secondary" size="sm" icon={<ThumbsDown className="size-4" />} disabled={done} onClick={() => setOpen(true)} data-print-hide>
        {done ? 'Marked as not what you wanted' : 'Not what I wanted'}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`"${keyword}" is not what you wanted?`}
        description="Tell us, and we take it into account. If pages we chose on our own keep missing, we stop choosing on our own and write only for your keywords."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={send.isPending} icon={<ThumbsDown className="size-4" />} onClick={submit}>
              Mark it
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="What was wrong?" optional hint="For example: the topic is not ours, the facts are off, the tone is wrong.">
            {(p) => <Textarea {...p} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <GuideButton id={AUTOPILOT_SCREEN_GUIDES.notWhatIWanted} variant="link" label="When does this lower the autopilot level?" />
          {send.isError && <Callout tone="critical">{errorMessage(send.error)}</Callout>}
        </div>
      </Dialog>
    </>
  );
}
