import { useRef, type KeyboardEvent } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeChoice } from '@/lib/theme';
import { cn } from '@/lib/utils';

// The app's theme mechanism (lib/theme: `theme` in localStorage, `data-theme` on <html>, applied before paint by
// public/theme-init.js), so a choice made on the website carries into the app and survives reloads.
const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

const current = (t: ThemeChoice) => OPTIONS.find((o) => o.value === t) ?? OPTIONS[0];

/** Header icon button: opens a small menu with System / Light / Dark as radio items (checked state announced). */
export function ThemeMenuButton({ className, onOpen }: { className?: string; /** called when the menu opens (the header closes its own menus) */ onOpen?: () => void }) {
  const { theme, setTheme } = useTheme();
  const cur = current(theme);
  return (
    // not modal: no scroll lock (it would shift the sticky header) and the page stays usable behind the menu
    <M.Root modal={false} onOpenChange={(o) => o && onOpen?.()}>
      <M.Trigger asChild>
        <button
          type="button"
          aria-label={`Theme: ${cur.label}`}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-md text-ink-2 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink active:bg-surface-3 data-[state=open]:bg-surface-2 data-[state=open]:text-ink',
            className,
          )}
        >
          <cur.Icon key={cur.value} className="size-[18px] animate-fade-in" aria-hidden />
        </button>
      </M.Trigger>
      <M.Portal>
        <M.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[176px] origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-line bg-surface p-1 shadow-overlay outline-none focus-visible:shadow-overlay! data-[state=open]:animate-scale-in dark:bg-surface-2"
        >
          <M.Label className="px-2.5 pb-1.5 pt-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Theme</M.Label>
          <M.RadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
            {OPTIONS.map((o) => (
              <M.RadioItem
                key={o.value}
                value={o.value}
                className="group flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink outline-none transition-colors duration-100 focus-visible:shadow-none! data-[highlighted]:bg-accent-soft"
              >
                <o.Icon className="size-4 shrink-0 text-ink-3 transition-colors duration-100 group-data-[highlighted]:text-accent-text group-data-[state=checked]:text-accent-text" aria-hidden />
                {o.label}
                <M.ItemIndicator className="ml-auto inline-flex">
                  <Check className="size-4 text-accent-text" strokeWidth={2.5} aria-hidden />
                </M.ItemIndicator>
              </M.RadioItem>
            ))}
          </M.RadioGroup>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

/** Inline three-way switch (radio group with roving focus and arrow keys) for the phone menu and the footer.
 *  `labels`: 'always' shows the words, 'wide' hides them below 360px (kept for screen readers), 'never' is icons only. */
export function ThemeSegmented({ labels = 'always', className }: { labels?: 'always' | 'wide' | 'never'; className?: string }) {
  const { theme, setTheme } = useTheme();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = OPTIONS.findIndex((o) => o.value === theme);
  const onKey = (e: KeyboardEvent) => {
    const n =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (index + 1) % OPTIONS.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (index + OPTIONS.length - 1) % OPTIONS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? OPTIONS.length - 1
              : -1;
    if (n < 0) return;
    e.preventDefault();
    setTheme(OPTIONS[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Theme" onKeyDown={onKey} className={cn('inline-flex gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      {OPTIONS.map((o, i) => {
        const on = o.value === theme;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={labels === 'never' ? o.label : undefined}
            title={labels === 'never' ? o.label : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => setTheme(o.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition-[color,background-color,box-shadow] duration-150 ease-brand',
              labels === 'never' ? 'size-10 sm:size-8' : 'h-10 px-3 text-[13px] sm:h-9',
              on ? 'bg-surface text-ink shadow-card ring-1 ring-line dark:bg-surface-3' : 'text-ink-3 hover:bg-surface/60 hover:text-ink dark:hover:bg-surface-3/50',
            )}
          >
            <o.Icon className="size-4 shrink-0" aria-hidden />
            {labels !== 'never' && <span className={cn(labels === 'wide' && 'max-[359px]:sr-only')}>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
