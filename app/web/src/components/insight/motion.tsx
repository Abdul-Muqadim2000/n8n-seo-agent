// Motion helpers for dashboards: staggered fade-up of sections and count-up of key figures. CSS only (keyframes in index.css),
// requestAnimationFrame for the count-up; under prefers-reduced-motion everything lands in its final state at once.
import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** True when the visitor asked for reduced motion (read once per mount; the CSS rule in index.css covers everything else). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Stagger: its direct children fade up one after another (60ms apart, capped after 12). No wrapper per child, so it works as a
 * grid / flex / space-y container: pass the layout classes in `className`.
 */
export function Stagger({ as: Tag = 'div', className, children, step = 60 }: { as?: ElementType; className?: string; children: ReactNode; /** ms between children */ step?: number }) {
  return (
    <Tag className={cn('alv-stagger', className)} style={step !== 60 ? ({ '--stagger-step': `${step}ms` } as CSSProperties) : undefined}>
      {children}
    </Tag>
  );
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * CountUp: a number that counts from 0 (or from its previous value) to `value` in ~700ms. Screen readers get the final text only;
 * reduced motion shows the final value at once.
 *
 * CR17-I (client report 2026-11-17, F7): credits and money are never animated (`animate={false}`): a client read "1,002 credits used" on
 * a tile caught half a second into its count-up while the breakdown beside it said 1,028. Any figure people compare must read its value at
 * once. And an animated figure always lands: a tab whose animation frames stop (a background tab, a page reader) shows the final value after
 * its duration even when no frame ever fires.
 */
export function CountUp({
  value,
  format = (n: number) => Math.round(n).toLocaleString('en-US'),
  duration = 700,
  className,
  animate = true,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
  /** false: the final value at once (credits, money, anything compared with another figure) */
  animate?: boolean;
}) {
  const still = !animate || duration <= 0;
  const [shown, setShown] = useState(() => (still || prefersReducedMotion() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (still || prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = a + (value - a) * easeOut(t);
      setShown(t === 1 ? value : v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // no frame ever fires in a hidden tab: land on the final value anyway
    const land = setTimeout(() => {
      cancelAnimationFrame(raf);
      from.current = value;
      setShown(value);
    }, duration + 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(land);
    };
  }, [value, duration, still]);
  const final = format(value);
  return (
    <span className={cn('relative', className)}>
      <span aria-hidden>{shown === value ? final : format(shown)}</span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
