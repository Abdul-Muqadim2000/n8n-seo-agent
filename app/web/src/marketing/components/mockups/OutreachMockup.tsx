import { Check, CornerDownRight, Mail, MessageSquareReply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

// One drafted sequence on the Link building page with sample data: the prospect, its contact on its own domain, our page and the link
// text, the three e-mails with their timing, the checks it passed and the reply that came back.

const STEPS: { when: string; title: string }[] = [
  { when: 'Tue', title: 'First e-mail — quotes their resource page' },
  { when: '+4 working days', title: 'Follow-up 1 — one new useful detail' },
  { when: '+8 more', title: 'Follow-up 2 — who is the right person?' },
];

const CHECKS = ['Only facts on file', 'Quotes their page', 'One link', 'Postal address + opt-out'];

export function OutreachMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="An outreach sequence with sample data, approved and sent from the customer's own mailbox: a resource page on an industry association's site, the editor's address on that site, the guide to link to and the guide's title as link text, three e-mails with their timing, four checks passed, and a reply read as interested, with the sequence stopped and an answer suggested to send in the same thread."
      className={cn('@container rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[11px] text-ink-3">Link building · approved, sent from your mailbox</span>
          <span className="mt-0.5 block truncate font-display text-[15px] font-semibold">Resource page · trade-association.example</span>
        </span>
        <MockBadge tone="accent" icon={null}>
          Fit 0.82
        </MockBadge>
      </div>

      <dl className="mt-4 grid gap-2 text-[11.5px] @min-[24rem]:grid-cols-2">
        <div className="mk-pop rounded-lg border border-line bg-page px-3 py-2" style={{ ['--mk-i' as string]: 0 }}>
          <dt className="text-[10.5px] text-ink-3">Contact, on their own site</dt>
          <dd className="mt-0.5 truncate font-mono">editor@trade-association.example</dd>
        </div>
        <div className="mk-pop rounded-lg border border-line bg-page px-3 py-2" style={{ ['--mk-i' as string]: 1 }}>
          <dt className="text-[10.5px] text-ink-3">Our page · link text</dt>
          <dd className="mt-0.5 truncate">/guides/vat-checklist · the guide’s title</dd>
        </div>
      </dl>

      <ol className="mt-4 space-y-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="mk-pop flex items-center gap-2.5 text-[11.5px]" style={{ ['--mk-i' as string]: i + 2 }}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-text">
              {i === 0 ? <Mail className="size-3.5" /> : <CornerDownRight className="size-3.5" />}
            </span>
            <span className="min-w-0 flex-1 truncate">{s.title}</span>
            <span className="shrink-0 font-mono text-[10.5px] text-ink-3">{s.when}</span>
          </li>
        ))}
      </ol>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {CHECKS.map((c, i) => (
          <li key={c} className="mk-pop" style={{ ['--mk-i' as string]: i + 5 }}>
            <MockBadge tone="good" icon={Check}>
              {c}
            </MockBadge>
          </li>
        ))}
      </ul>

      <div className="mk-pop mt-4 rounded-lg border border-line bg-page p-3" style={{ ['--mk-i' as string]: 9 }}>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
          <MessageSquareReply className="size-3.5 text-accent-text" />
          Reply read: interested
        </span>
        <span className="mt-1 block text-[11.5px] text-ink-2">“Happy to add it — can you send a one-line description?” · answer suggested, sequence stopped</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] text-ink-3">Sample data</span>
        <span className="flex gap-2">
          <span className="inline-flex h-7 items-center rounded-md border border-line px-3 text-[11.5px] font-medium">Edit answer</span>
          <span className="inline-flex h-7 items-center rounded-md bg-accent px-3 text-[11.5px] font-medium text-accent-ink">Send in this thread</span>
        </span>
      </div>
    </Drawn>
  );
}
