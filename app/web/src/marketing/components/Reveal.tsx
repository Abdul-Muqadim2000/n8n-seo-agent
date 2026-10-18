import { useEffect, useState, type CSSProperties, type ElementType, type ReactNode, type RefObject } from 'react';

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

/** A plain wrapper kept for layout (`as`, classes): content is visible from the first paint — the marketing site has no entrance
 *  animation. `index` is accepted for older call sites and ignored. */
export function Reveal({
  as: Tag = 'div',
  index: _index = 0,
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
  role?: string;
}) {
  return (
    <Tag className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}
