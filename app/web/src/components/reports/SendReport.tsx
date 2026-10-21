import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { deliveryDecision, type ReportDetail } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useDeliverReport } from '@/lib/queries';

/**
 * B-R1: "Send it now": this one report, to the channels the company already set up, without waiting for the schedule.
 *
 * It offers no override. The server runs the same readiness decision as an automatic delivery, so a page that failed its quality
 * check or a report built on evidence the engine could not read comes back with the reason instead of going out. That is the point:
 * a report the run does not stand behind should not arrive in somebody's inbox because a person clicked harder.
 *
 * Pre-launch run 2026-10-21 (B1): the button was still offered on a page the quality check had refused, so a click only ever produced a
 * refusal. The same rule now decides whether the button is shown at all: a report the delivery would hold offers nothing to send.
 */
export function SendReport({ report }: { report: Pick<ReportDetail, 'id' | 'stage' | 'status' | 'payload'> }) {
  const { org, can } = useOrgCtx();
  const deliver = useDeliverReport(org.id);
  if (!can('admin')) return null;
  if (!deliveryDecision({ stage: report.stage, status: report.status, payload: report.payload ?? {} }).deliver) return null;
  const reportId = report.id;

  const send = async () => {
    try {
      const res = await deliver.mutateAsync(reportId);
      if (res.delivered) toast.success('Sent');
      else toast.error(res.reason || 'Nothing was sent. Check Settings, then Report delivery.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Button variant="secondary" size="sm" icon={<Send className="size-4" />} loading={deliver.isPending} onClick={() => void send()}>
      Send it now
    </Button>
  );
}
