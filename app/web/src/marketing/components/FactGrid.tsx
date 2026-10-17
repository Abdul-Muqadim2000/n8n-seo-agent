import type { Fact } from '../content/features';
import { cn } from '@/lib/utils';
import { useSectionTone } from './Section';

const fmt = (n: number) => n.toLocaleString('en-US');

/** One capability fact: a big mono figure and a short label (shown as is: no count-up). */
export function Stat({ fact, className }: { fact: Fact; className?: string }) {
  const ink = useSectionTone() === 'ink';
  const shown = typeof fact.value === 'number' ? fmt(fact.value) : fact.value;
  return (
    <div className={cn('flex flex-col', className)}>
      <dt className={cn('mt-2 text-sm leading-snug', ink ? 'text-on-ink-2' : 'text-ink-2')}>{fact.label}</dt>
      <dd className={cn('order-first font-mono text-4xl font-medium tracking-[-0.03em] tabular sm:text-[2.75rem]', ink ? 'text-on-ink' : 'text-ink')}>
        {fact.prefix}
        {shown}
        {fact.suffix}
      </dd>
    </div>
  );
}

/** Row of capability facts separated by hairlines (2 columns on phones, up to 4 on wide screens). */
export function FactGrid({ facts, className }: { facts: Fact[]; className?: string }) {
  const ink = useSectionTone() === 'ink';
  const cols = facts.length >= 4 ? 'lg:grid-cols-4' : facts.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  return (
    <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-10 border-t pt-10', cols, ink ? 'border-line-on-ink' : 'border-line', className)}>
      {facts.map((f) => (
        <Stat key={f.label} fact={f} className={cn('border-l pl-5', ink ? 'border-line-on-ink' : 'border-line')} />
      ))}
    </dl>
  );
}
