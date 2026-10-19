import { Check, Clock, Copy, MapPin, Send, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn } from './parts';

// The guide panel as the product shows it: one job, your own values, the provider you use (sample data).

const DONE = ['Find where your DNS is managed', 'Open the DNS records for example.com'];
const LATER = ['Save it, then press "Check now"', 'Leave the record in place'];
const VALUES: { label: string; value: string }[] = [
  { label: 'Type', value: 'TXT' },
  { label: 'Host / name', value: 'example.com' },
  { label: 'Value', value: 'seo-agent-verification=7f3a...' },
];
const PROVIDERS = ['Cloudflare', 'GoDaddy', 'Namecheap'];

export function GuideMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="A setup guide with sample data: adding the DNS record that proves the domain is yours, two of five steps ticked off, the record to add in copy boxes, tabs for Cloudflare, GoDaddy and Namecheap, and buttons to send the guide to a colleague or check it now."
      className={cn('@container overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-overlay', className)}
    >
      {/* header */}
      <div className="border-b border-line px-4 pb-3.5 pt-4 @min-[26rem]:px-5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-3">Guide</span>
        <div className="mt-1.5 flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
            <ShieldCheck className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[14px] font-semibold leading-snug">Add the DNS record that proves the domain is yours</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-3">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                About 10 minutes
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                Your domain registrar
              </span>
            </span>
          </span>
        </div>
        <span className="mt-3 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <span className="mk-grow-x block h-full w-2/5 rounded-full bg-accent" style={{ ['--mk-i' as string]: 0 }} />
          </span>
          <span className="font-mono text-[10px] text-ink-3 tabular">2/5</span>
        </span>
      </div>

      {/* steps */}
      <ol className="px-4 py-3.5 @min-[26rem]:px-5">
        {DONE.map((t, i) => (
          <li key={t} className="mk-pop flex items-center gap-2.5 py-1.5" style={{ ['--mk-i' as string]: i }}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-good-soft text-good-text">
              <Check className="size-3.5" strokeWidth={2.5} />
            </span>
            <span className="min-w-0 truncate text-[12px] text-ink-3">{t}</span>
          </li>
        ))}

        <li className="mk-pop py-1.5" style={{ ['--mk-i' as string]: 2 }}>
          <span className="flex items-center gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-accent-ink tabular">3</span>
            <span className="text-[12.5px] font-semibold">Add this record</span>
          </span>
          <span className="mt-2 block space-y-1.5 pl-[34px]">
            {VALUES.map((v, i) => (
              <span key={v.label} className="mk-pop flex items-center gap-2 rounded-lg border border-line-strong bg-page px-2.5 py-1.5" style={{ ['--mk-i' as string]: 3 + i }}>
                <span className="w-[88px] shrink-0 font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-3">{v.label}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{v.value}</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-2">
                  <Copy className="size-2.5" />
                  Copy
                </span>
              </span>
            ))}
            <span className="mk-pop flex flex-wrap items-center gap-1 pt-1" style={{ ['--mk-i' as string]: 6 }}>
              {PROVIDERS.map((p, i) => (
                <span
                  key={p}
                  className={cn('rounded-md px-2 py-1 text-[10.5px] font-medium', i === 0 ? 'bg-surface-2 text-ink ring-1 ring-line' : 'text-ink-3')}
                >
                  {p}
                </span>
              ))}
            </span>
          </span>
        </li>

        {LATER.map((t, i) => (
          <li key={t} className="mk-pop flex items-center gap-2.5 py-1.5" style={{ ['--mk-i' as string]: 7 + i }}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[11px] text-ink-3 tabular">{4 + i}</span>
            <span className="min-w-0 truncate text-[12px] text-ink-2">{t}</span>
          </li>
        ))}
      </ol>

      {/* footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-page px-4 py-2.5 @min-[26rem]:px-5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
          <Send className="size-3" />
          Send to a colleague
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-ink">
          <Check className="size-3" />
          Check now
        </span>
      </div>
      <p className="px-4 pb-3 pt-2 text-right font-mono text-[11px] text-ink-3 @min-[26rem]:px-5">Sample data</p>
    </Drawn>
  );
}
