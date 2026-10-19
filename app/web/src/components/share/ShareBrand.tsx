import { useState } from 'react';
import type { SharedBrand } from '@seo/shared';
import { cn } from '@/lib/utils';

/**
 * B-R2: the customer's own mark at the head of a shared report.
 *
 * Three things it must survive, because a client sees this page and nobody from the company is standing next to them:
 *  - **no logo at all**, most companies have not filled one in, so the monogram is the normal case, not the error case;
 *  - **a logo that fails to load**, a URL that 404s, a host that blocks hotlinking, an image blocked by an extension: `onError`
 *    falls back to the monogram and the page is never left with a broken-image glyph;
 *  - **a logo drawn for white paper** shown on our dark theme, it sits on a white tile in both themes, so a dark wordmark cannot
 *    disappear into a dark page. We never recolour or invert somebody else's logo.
 *
 * `referrerPolicy="no-referrer"`: the page's own URL carries the share token, and that token is never worth handing to the host
 * serving the logo, whatever a browser's default referrer policy happens to be.
 */
export function ShareBrand({ brand, className }: { brand: SharedBrand; className?: string }) {
  const [broken, setBroken] = useState(false);
  const logo = brand.logoUrl && !broken ? brand.logoUrl : null;
  if (!brand.name && !logo) return null;
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {logo ? (
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-black/10">
          <img
            src={logo}
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setBroken(true)}
            className="size-full select-none object-contain"
          />
        </span>
      ) : (
        brand.initials && (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-display text-[13px] font-semibold text-accent-text"
          >
            {brand.initials}
          </span>
        )
      )}
      <span className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">{brand.name}</span>
    </span>
  );
}
