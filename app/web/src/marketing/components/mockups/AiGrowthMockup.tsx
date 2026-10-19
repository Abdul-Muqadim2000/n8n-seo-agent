import { CheckCircle2, FileText, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge } from './parts';

// The AI growth section of the AI visibility page with sample data: what was done this week, the readiness of three key pages,
// the questions queued to win and one page AI cites without naming the business.

const DONE: { value: string; label: string }[] = [
  { value: '6', label: 'pages sent to Bing' },
  { value: '4', label: 'questions to win' },
  { value: '2', label: 'pages AI cites without you' },
];

const PAGES: { path: string; score: number; tone: 'good' | 'warning' | 'critical'; note: string }[] = [
  { path: '/guides/vat-registration', score: 86, tone: 'good', note: 'Answer first, dated, sourced' },
  { path: '/services', score: 58, tone: 'warning', note: 'No visible update date' },
  { path: '/pricing', score: 34, tone: 'critical', note: 'Text appears only after JavaScript' },
];

export function AiGrowthMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="The AI growth section with sample data: this week 6 pages sent to Bing, 4 questions to win and 2 pages AI cites without naming you; AI readiness of three key pages scored 86, 58 and 34 with the reason for each; the next answer page queued; and a list page AI cites that names three competitors, with a pitch drafted."
      className={cn('@container rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <span className="block text-[11px] text-ink-3">AI growth · this week</span>
      <span className="mt-0.5 block font-display text-[15px] font-semibold">Done for you on Monday</span>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {DONE.map((d, i) => (
          <div key={d.label} className="mk-pop rounded-lg border border-line bg-page px-2.5 py-2" style={{ ['--mk-i' as string]: i }}>
            <span className="block font-mono text-lg font-medium tabular">{d.value}</span>
            <span className="mt-0.5 block text-[10.5px] leading-tight text-ink-3">{d.label}</span>
          </div>
        ))}
      </div>

      <span className="mt-5 block text-[11.5px] font-semibold">Key pages, ready for AI answers?</span>
      <ul className="mt-2 space-y-2">
        {PAGES.map((p, i) => (
          <li key={p.path} className="mk-pop" style={{ ['--mk-i' as string]: i + 3 }}>
            <span className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="min-w-0 truncate font-mono text-ink-2">{p.path}</span>
              <MockBadge tone={p.tone}>{p.score} / 100</MockBadge>
            </span>
            <span className="mt-1 block h-1.5 rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${p.score}%` }} />
            </span>
            <span className="mt-1 block text-[10.5px] text-ink-3">{p.note}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 @min-[24rem]:grid-cols-2">
        <div className="mk-pop rounded-lg border border-line bg-page p-3" style={{ ['--mk-i' as string]: 7 }}>
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
            <FileText className="size-3.5 text-accent-text" />
            Next answer page
          </span>
          <span className="mt-1 block text-[11.5px] text-ink-2">"How long does VAT registration take?" Lost on 3 of 5 engines</span>
        </div>
        <div className="mk-pop rounded-lg border border-line bg-page p-3" style={{ ['--mk-i' as string]: 8 }}>
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
            <Quote className="size-3.5 text-accent-text" />
            Cited without you
          </span>
          <span className="mt-1 block text-[11.5px] text-ink-2">A "best firms" list names 3 competitors · pitch drafted</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-ink-3">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="size-3 text-good-text" />
          IndexNow key file found
        </span>
        <span className="font-mono">Sample data</span>
      </div>
    </Drawn>
  );
}
