import { Link } from 'react-router';
import { cn } from '@/lib/utils';

export const BRAND_NAME = 'Ascentra';

/** Document title in the brand pattern: pageTitle('Overview', 'techand.ai') → "Overview · techand.ai — Ascentra". */
export function pageTitle(...parts: (string | null | undefined | false)[]): string {
  const head = parts.filter(Boolean).join(' · ');
  return head ? `${head} — ${BRAND_NAME}` : BRAND_NAME;
}

/** The app icon (white mark on Ascentra Blue), for small square spots. Decorative: the name is always next to it. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/ascentra-app-icon.svg"
      alt=""
      aria-hidden
      width={28}
      height={28}
      decoding="async"
      draggable={false}
      className={cn('size-7 shrink-0 select-none', className)}
    />
  );
}

/** The header lockup from the brand kit: the light-background file on light, the dark one on dark (theme pick or OS setting). */
export function Brand({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex shrink-0 items-center rounded-md', className)}>
      <img
        src="/brand/ascentra-logo-header-light.svg"
        alt={BRAND_NAME}
        width={131}
        height={28}
        decoding="async"
        draggable={false}
        className="h-7 w-auto select-none dark:hidden"
      />
      <img
        src="/brand/ascentra-logo-header-dark.svg"
        alt={BRAND_NAME}
        width={131}
        height={28}
        decoding="async"
        draggable={false}
        className="hidden h-7 w-auto select-none dark:block"
      />
    </Link>
  );
}
