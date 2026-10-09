import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Pixel size of an element, kept current with a ResizeObserver (drawings use real pixels, so strokes and dashes never stretch). */
export function useSize<T extends Element>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Curved connectors between `count` evenly spaced rows on one side and the middle of the other side ('in': many → one, 'out': one → many),
 *  with dashes flowing towards the right. Place it in a grid cell as tall as the rows it connects. */
export function Fan({ count, direction, ink, className }: { count: number; direction: 'in' | 'out'; ink?: boolean; className?: string }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const paths: string[] = [];
  if (w > 0 && h > 0) {
    const mid = h / 2;
    for (let i = 0; i < count; i++) {
      const y = ((i + 0.5) * h) / count;
      const [y0, y1] = direction === 'in' ? [y, mid] : [mid, y];
      paths.push(`M0 ${y0.toFixed(1)} C ${(w * 0.55).toFixed(1)} ${y0.toFixed(1)}, ${(w * 0.45).toFixed(1)} ${y1.toFixed(1)}, ${w.toFixed(1)} ${y1.toFixed(1)}`);
    }
  }
  return (
    <div ref={ref} className={cn('relative h-full w-full', className)} aria-hidden>
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 overflow-visible" fill="none">
          {paths.map((d, i) => (
            <path key={`b${i}`} d={d} strokeWidth={1} className={ink ? 'stroke-line-on-ink' : 'stroke-line-strong'} />
          ))}
          {paths.map((d, i) => (
            <path
              key={`f${i}`}
              d={d}
              pathLength={100}
              strokeWidth={1.5}
              strokeLinecap="round"
              className={cn('mk-flow', ink ? 'stroke-accent-on-ink' : 'stroke-accent')}
              style={{ animationDelay: `${-i * 0.23}s` }}
            />
          ))}
          {direction === 'in' ? (
            <circle cx={w} cy={h / 2} r={3.5} className={ink ? 'fill-accent-on-ink' : 'fill-accent'} />
          ) : (
            <circle cx={0} cy={h / 2} r={3.5} className={ink ? 'fill-accent-on-ink' : 'fill-accent'} />
          )}
        </svg>
      )}
    </div>
  );
}

/** Short vertical connector with flowing dashes, for the stacked (phone) layout of a diagram. */
export function DownFlow({ ink, className }: { ink?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 12 48" className={cn('mx-auto h-12 w-3', className)} fill="none" aria-hidden>
      <path d="M6 0 V48" strokeWidth={1} className={ink ? 'stroke-line-on-ink' : 'stroke-line-strong'} />
      <path d="M6 0 V48" pathLength={100} strokeWidth={1.5} strokeLinecap="round" className={cn('mk-flow', ink ? 'stroke-accent-on-ink' : 'stroke-accent')} />
    </svg>
  );
}
