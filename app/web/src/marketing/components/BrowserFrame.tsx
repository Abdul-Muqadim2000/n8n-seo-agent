import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A neutral browser window (three dots, address pill) around a product mockup; `caption` sits under it ("Sample data"). */
export function BrowserFrame({ url = 'app.ascentra.com', children, className, caption, label }: { url?: string; children: ReactNode; className?: string; caption?: ReactNode; label?: string }) {
  return (
    <figure className={cn('w-full', className)} aria-label={label}>
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-overlay">
        <div className="flex h-10 items-center gap-3 border-b border-line bg-surface-2 px-4" aria-hidden>
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </span>
          <span className="mx-auto flex h-6 min-w-0 max-w-xs flex-1 items-center justify-center gap-1.5 truncate rounded-md border border-line bg-surface px-3 font-mono text-[11px] text-ink-3">
            <Lock className="size-3 shrink-0" />
            <span className="truncate">{url}</span>
          </span>
          <span className="w-[42px]" />
        </div>
        <div className="relative">{children}</div>
      </div>
      {caption && <figcaption className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">{caption}</figcaption>}
    </figure>
  );
}
