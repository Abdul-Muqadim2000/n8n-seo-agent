import type { ReactNode } from 'react';
import { Brand, pageTitle } from './Brand';
import { ThemeMenu } from './ThemeMenu';
import { useDocumentTitle } from './useDocumentTitle';

/** Full-page message (not found, errors, a new version): the header lockup, a faint mark, the message and the way out. */
export function StatusScreen({ code, icon, title, children, actions }: { code?: string; icon?: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  useDocumentTitle(pageTitle(title));
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-page">
      {/* the mark as a faint watermark (whole logo, never single rays): ink on light, white on dark */}
      <img src="/brand/ascentra-mark-ink.svg" alt="" aria-hidden draggable={false} className="pointer-events-none absolute -bottom-32 -right-40 w-[560px] max-w-none select-none opacity-[0.035] dark:hidden" />
      <img src="/brand/ascentra-mark-white.svg" alt="" aria-hidden draggable={false} className="pointer-events-none absolute -bottom-32 -right-40 hidden w-[560px] max-w-none select-none opacity-[0.05] dark:block" />
      <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <Brand to="/" />
        <ThemeMenu />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-6 pb-24 pt-8">
        <div className="flex max-w-md animate-fade-up flex-col items-center text-center">
          {icon && (
            <span className="mb-5 flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-accent-text shadow-card" aria-hidden>
              {icon}
            </span>
          )}
          {code && <p className="font-mono text-sm font-medium tracking-wide text-accent-text">{code}</p>}
          <h1 className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">{title}</h1>
          {children && <div className="mt-3 text-[15px] leading-relaxed text-ink-2">{children}</div>}
          {actions && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
        </div>
      </main>
    </div>
  );
}
