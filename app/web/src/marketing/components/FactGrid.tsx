import { useEffect, useRef, useState } from 'react';
import type { Fact } from '../content/features';
import { cn } from '@/lib/utils';
import { useInView } from './Reveal';
import { useSectionTone } from './Section';

const fmt = (n: number) => n.toLocaleString('en-US');

/** Counts from 0 to `to` once `run` turns true (ease-out, ~1.2s); the final value at once under reduced motion. */
function useCountUp(to: number, run: boolean, duration = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || to === 0) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run, duration]);
  return v;
}

/** One capability fact: a big mono figure (numbers count up when seen) and a short label. */
export function Stat({ fact, className }: { fact: Fact; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const ink = useSectionTone() === 'ink';
  const isNum = typeof fact.value === 'number';
  const n = useCountUp(isNum ? (fact.value as number) : 0, seen && isNum);
  const shown = isNum ? fmt(n) : fact.value;
  const final = isNum ? fmt(fact.value as number) : fact.value;
  return (
    <div ref={ref} className={cn('flex flex-col', className)}>
      <dt className={cn('mt-2 text-sm leading-snug', ink ? 'text-on-ink-2' : 'text-ink-2')}>{fact.label}</dt>
      <dd className={cn('order-first font-mono text-4xl font-medium tracking-[-0.03em] tabular sm:text-[2.75rem]', ink ? 'text-on-ink' : 'text-ink')}>
        <span aria-hidden>
          {fact.prefix}
          {shown}
          {fact.suffix}
        </span>
        <span className="sr-only">
          {fact.prefix}
          {final}
          {fact.suffix}
        </span>
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
