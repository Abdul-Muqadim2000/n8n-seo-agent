import { CircleCheck, Megaphone, MousePointerClick, ShieldCheck, TrendingUp } from 'lucide-react';
import { linkSources } from '../../content/site';
import { cn } from '@/lib/utils';
import { useSectionTone } from '../Section';
import { DownFlow, Fan } from './Fan';

const VALUES = [
  { label: 'SEO value', icon: TrendingUp },
  { label: 'Referral value', icon: MousePointerClick },
  { label: 'Brand value', icon: Megaphone },
];

/** Nine link sources flowing into one verified ledger (Ascentra's own link check), which scores SEO, referral and brand value. */
export function LinkSourcesDiagram({ className }: { className?: string }) {
  const ink = useSectionTone() === 'ink';
  const chip = cn(
    'flex h-full min-h-0 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium',
    ink ? 'border-line-on-ink bg-ink-surface text-on-ink' : 'border-line bg-surface text-ink shadow-card',
  );
  const ledger = (
    <div className={cn('relative rounded-xl border p-5', ink ? 'border-accent-on-ink/50 bg-on-ink/[0.04]' : 'border-accent/40 bg-surface shadow-raised')}>
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
          <ShieldCheck className="size-4" aria-hidden />
        </span>
        <span className={cn('font-display text-base font-semibold', ink ? 'text-on-ink' : 'text-ink')}>One verified ledger</span>
      </div>
      <ul className={cn('mt-4 space-y-2 text-[13px] leading-snug', ink ? 'text-on-ink-2' : 'text-ink-2')}>
        {['One row per referring site', 'Every link checked by Ascentra', 'Lost only after two misses, with the reason'].map((t) => (
          <li key={t} className="flex gap-2">
            <CircleCheck className={cn('mt-px size-3.5 shrink-0', ink ? 'text-accent-on-ink' : 'text-accent-text')} aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
  const valueChip = (v: (typeof VALUES)[number]) => {
    const Icon = v.icon;
    return (
      <div key={v.label} className={cn(chip, 'h-11 w-full')}>
        <Icon className={cn('size-4', ink ? 'text-accent-on-ink' : 'text-accent-text')} aria-hidden />
        {v.label}
      </div>
    );
  };
  return (
    <figure className={className} aria-label={`Nine link sources — ${linkSources.join(', ')} — merge into one ledger that Ascentra checks itself, scoring SEO, referral and brand value.`}>
      {/* wide: sources → fan-in → ledger → fan-out → values */}
      <div className="hidden h-[440px] grid-cols-[minmax(0,220px)_minmax(48px,1fr)_minmax(0,260px)_minmax(40px,0.6fr)_minmax(0,170px)] items-stretch lg:grid" aria-hidden>
        <ul className="grid h-full grid-cols-1" style={{ gridTemplateRows: `repeat(${linkSources.length}, minmax(0, 1fr))` }}>
          {linkSources.map((s) => (
            <li key={s} className="flex min-h-0 py-1">
              <span className={cn(chip, 'w-full')}>
                <span className={cn('size-1.5 shrink-0 rounded-full', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
                <span className="truncate">{s}</span>
              </span>
            </li>
          ))}
        </ul>
        <Fan count={linkSources.length} direction="in" ink={ink} />
        <div className="flex items-center">{ledger}</div>
        <Fan count={VALUES.length} direction="out" ink={ink} />
        <div className="grid h-full grid-cols-1" style={{ gridTemplateRows: `repeat(${VALUES.length}, minmax(0, 1fr))` }}>
          {VALUES.map((v) => (
            <div key={v.label} className="flex items-center">
              {valueChip(v)}
            </div>
          ))}
        </div>
      </div>
      {/* phones and tablets: stacked */}
      <div className="lg:hidden" aria-hidden>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {linkSources.map((s) => (
            <li key={s} className={cn(chip, 'h-auto min-h-11 py-2 leading-snug')}>
              <span className={cn('size-1.5 shrink-0 rounded-full', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <DownFlow ink={ink} className="my-2" />
        {ledger}
        <DownFlow ink={ink} className="my-2" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{VALUES.map(valueChip)}</div>
      </div>
    </figure>
  );
}
