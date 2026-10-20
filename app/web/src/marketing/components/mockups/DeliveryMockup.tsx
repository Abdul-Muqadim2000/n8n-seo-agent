import { AlertTriangle, CheckCircle2, Link2, Mail, Paperclip, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn } from './parts';

// A delivered report as it arrives (sample data): the figures in the message, the files attached, the link anyone can open, and,
// underneath, the one report that was deliberately not sent and the reason why.

const FIGURES: { label: string; value: string }[] = [
  { label: 'Clicks', value: '34' },
  { label: 'Impressions', value: '5,282' },
  { label: 'Clicks change', value: '+79%' },
  { label: 'Actions to take', value: '3' },
];

export function DeliveryMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="A weekly report arriving by e-mail with sample data: the subject line, the report's clicks, impressions, change and actions as a small table, a PDF attached, a link anyone can open, and below it one report held back because the page did not pass its quality check."
      className={cn('@container overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-overlay', className)}
    >
      <div className="border-b border-line px-4 pt-4 pb-3.5 @min-[26rem]:px-5">
        <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">Delivered</span>
        <div className="mt-1.5 flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
            <Mail className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[14px] leading-snug font-semibold">Weekly tracking report: example.com</span>
            <span className="mt-1 block text-[10.5px] text-ink-3">To you and two colleagues · every Wednesday after the checks</span>
          </span>
        </div>
      </div>

      <div className="px-4 py-3.5 @min-[26rem]:px-5">
        <div className="rounded-lg border border-line p-3">
          <table className="w-full">
            <tbody>
              {FIGURES.map((f, i) => (
                <tr key={f.label} className="mk-pop" style={{ ['--mk-i' as string]: i }}>
                  <td className="py-1 pr-3 text-[11.5px] text-ink-3">{f.label}</td>
                  <td className="py-1 text-right font-mono text-[11.5px] font-semibold tabular">{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-2.5 text-[10.5px]">
            <span className="inline-flex items-center gap-1 text-accent-text">
              <Link2 className="size-3" />
              Open it
            </span>
            <span className="inline-flex items-center gap-1 text-accent-text">
              <Link2 className="size-3" />
              Share it (expires in 30 days)
            </span>
            <span className="inline-flex items-center gap-1 text-ink-3">
              <Paperclip className="size-3" />
              report.pdf
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning-text/20 bg-warning-soft p-3">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning-text" />
          <span className="min-w-0 text-[11px] leading-snug text-ink-2">
            <span className="font-medium">Not sent. Page: erp software uae.</span> The page did not pass the quality check, so it is waiting in Alaventra rather than going out as finished work.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line px-4 py-2.5 text-[10.5px] text-ink-3 @min-[26rem]:px-5">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="size-3 text-good-text" />
          Sent by e-mail
        </span>
        <span className="inline-flex items-center gap-1">
          <Webhook className="size-3" />
          and to your Slack webhook
        </span>
      </div>
    </Drawn>
  );
}
