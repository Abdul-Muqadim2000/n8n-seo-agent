import { useEffect, useState } from 'react';
import { BRAND_NAME } from './Brand';

/** Sets `document.title` while the calling component is mounted (back to the brand name when it unmounts). */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    document.title = title;
    return () => {
      document.title = BRAND_NAME;
    };
  }, [title]);
}

/** True once the window has scrolled past `offset` px: sticky bars show their bottom hairline only then. */
export function useScrolled(offset = 4): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);
  return scrolled;
}
