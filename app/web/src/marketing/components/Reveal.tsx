import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True once the element has scrolled into view (stays true). Under reduced motion or without IntersectionObserver it is true at once. */
export function useInView<T extends Element>(ref: RefObject<T | null>, { rootMargin = '0px 0px -10% 0px', threshold = 0.15 } = {}): boolean {
  const [seen, setSeen] = useState(() => reducedMotion() || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, rootMargin, threshold]);
  return seen;
}

/** Fades and lifts its children in when they scroll into view; `index` staggers siblings (70ms each). Reduced motion: shown at once. */
export function Reveal({
  as: Tag = 'div',
  index = 0,
  className,
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  index?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref);
  return (
    <Tag ref={ref} className={cn('mk-reveal', seen && 'is-visible', className)} style={{ ...style, ['--mk-i' as string]: index }} {...rest}>
      {children}
    </Tag>
  );
}
