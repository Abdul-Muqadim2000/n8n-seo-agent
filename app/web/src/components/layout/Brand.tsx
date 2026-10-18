import { useState } from 'react';
import { Link } from 'react-router';
import { onPortalHost, productName, usePortalBrand } from '@/lib/portal';
import { cn } from '@/lib/utils';

export const BRAND_NAME = 'Alaventra';

/**
 * Document title in the brand pattern: pageTitle('Overview', 'techand.ai') → "Overview · techand.ai — Alaventra". G5: inside an agency's
 * white-label portal the product name is the agency's (`productName()`), never ours.
 */
export function pageTitle(...parts: (string | null | undefined | false)[]): string {
  const head = parts.filter(Boolean).join(' · ');
  const name = productName();
  return head ? `${head} — ${name}` : name;
}

/** The app icon (white mark on Alaventra Blue), for small square spots. Decorative: the name is always next to it. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/alaventra-app-icon.svg"
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

/**
 * G5: an agency's mark in the portal — its logo (the dark-background version on dark, else the light one on a white tile), or its
 * initials and name when it has none or the logo fails to load. Always looks finished.
 */
export function AgencyLockup({ name, logoUrl, logoDarkUrl, initials, className }: { name: string; logoUrl: string | null; logoDarkUrl: string | null; initials: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed)
    return (
      <span className={cn('inline-flex min-w-0 items-center', className)}>
        <img src={logoUrl} alt={name} onError={() => setFailed(true)} className={cn('h-7 max-w-[180px] object-contain select-none', logoDarkUrl ? 'dark:hidden' : 'dark:rounded dark:bg-white dark:p-0.5')} draggable={false} />
        {logoDarkUrl && <img src={logoDarkUrl} alt={name} onError={() => setFailed(true)} className="hidden h-7 max-w-[180px] object-contain select-none dark:block" draggable={false} />}
      </span>
    );
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-accent-ink" aria-hidden>
        {initials || '•'}
      </span>
      <span className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">{name}</span>
    </span>
  );
}

/** The header lockup from the brand kit: the light-background file on light, the dark one on dark (theme pick or OS setting). */
export function Brand({ to = '/', className }: { to?: string; className?: string }) {
  const portal = usePortalBrand();
  // a portal host before its brand has loaded: nothing rather than our mark
  if (!portal && onPortalHost()) return <span className={cn('inline-block h-7 w-24', className)} aria-hidden />;
  if (portal)
    return (
      <Link to={to} className={cn('inline-flex min-w-0 shrink-0 items-center rounded-md', className)} aria-label={portal.name}>
        <AgencyLockup name={portal.name} logoUrl={portal.logoUrl} logoDarkUrl={portal.logoDarkUrl} initials={portal.initials} />
      </Link>
    );
  return (
    <Link to={to} className={cn('inline-flex shrink-0 items-center rounded-md', className)}>
      <img
        src="/brand/alaventra-logo-header-light.svg"
        alt={BRAND_NAME}
        width={140}
        height={28}
        decoding="async"
        draggable={false}
        className="h-7 w-auto select-none dark:hidden"
      />
      <img
        src="/brand/alaventra-logo-header-dark.svg"
        alt={BRAND_NAME}
        width={140}
        height={28}
        decoding="async"
        draggable={false}
        className="hidden h-7 w-auto select-none dark:block"
      />
    </Link>
  );
}
