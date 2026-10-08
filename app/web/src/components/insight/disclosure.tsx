// Ways to keep explanations one step away: an info tip ("?" with a tooltip) and an animated collapsible "details" block.
import { useId, useState, type ReactNode } from 'react';
import * as T from '@radix-ui/react-tooltip';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSurface } from './surface';

/**
 * InfoTip: a small "?" button that shows an explanation — on hover, on keyboard focus and on tap (touch has no hover). Use it for
 * how a number is measured or what a term means; never for the number itself.
 */
export function InfoTip({ children, label = 'What this means', side = 'top', className }: { children: ReactNode; /** accessible name of the button */ label?: string; side?: 'top' | 'bottom' | 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false);
  const dark = useSurface() !== 'light';
  return (
    <T.Root open={open} onOpenChange={setOpen} delayDuration={150}>
      <T.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          // a tap opens it (Radix would close a tooltip on click; preventDefault keeps it open). A tap focuses the button first,
          // which may already have opened it, so this never toggles; a tap elsewhere or Escape closes it.
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className={cn(
            'relative inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle transition-colors duration-150 ease-brand',
            dark ? 'text-on-ink-2 hover:bg-on-ink/10 hover:text-on-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
            open && (dark ? 'text-on-ink' : 'text-accent-text'),
            className,
          )}
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </button>
      </T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-xs origin-[var(--radix-tooltip-content-transform-origin)] animate-scale-in rounded-md bg-ink px-2.5 py-1.5 text-xs leading-snug font-medium text-page shadow-overlay"
        >
          {children}
          <T.Arrow className="fill-ink" width={10} height={5} />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/** The animated region of a disclosure: slides open with a grid-rows transition (instant under reduced motion); closed = inert. */
export function CollapsePanel({ open, id, children, className }: { open: boolean; id?: string; children: ReactNode; className?: string }) {
  return (
    <div id={id} inert={!open} className={cn('grid transition-[grid-template-rows,opacity] duration-[220ms] ease-brand', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
      <div className={cn('min-h-0 overflow-hidden', className)}>{children}</div>
    </div>
  );
}

/** The toggle of a disclosure ("Details ⌄"): `link` = small blue text, `row` = full-width header row. */
export function DisclosureButton({ open, onToggle, controls, label, openLabel, variant = 'link', icon, className }: { open: boolean; onToggle: () => void; controls: string; label: ReactNode; openLabel?: ReactNode; variant?: 'link' | 'row'; icon?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        'group/coll inline-flex shrink-0 items-center gap-1.5 text-left font-medium transition-colors duration-150 ease-brand',
        variant === 'link' ? 'rounded-md text-xs text-accent-text hover:text-accent-hover dark:hover:text-ink' : 'w-full justify-between rounded-lg py-1.5 text-sm text-ink hover:text-accent-text',
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        {icon}
        {open && openLabel ? openLabel : label}
      </span>
      <ChevronDown className={cn('size-3.5 shrink-0 transition-transform duration-200 ease-brand', open && 'rotate-180', variant === 'row' && 'size-4 text-ink-3')} aria-hidden />
    </button>
  );
}

/**
 * Collapsible: a "details" toggle whose content slides open (220ms; instant under reduced motion). Closed content stays in the
 * DOM but is inert. `variant="link"` is a small text toggle, `"row"` a full-width header row. For a toggle placed elsewhere in a
 * row, use DisclosureButton + CollapsePanel with your own `open` state.
 */
export function Collapsible({
  label,
  openLabel,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  variant = 'link',
  icon,
  className,
  contentClassName,
}: {
  label: ReactNode;
  /** label while open (defaults to `label`) */
  openLabel?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'link' | 'row';
  icon?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const id = useId();
  const toggle = () => {
    setOwn(!open);
    onOpenChange?.(!open);
  };
  return (
    <div className={className}>
      <DisclosureButton open={open} onToggle={toggle} controls={id} label={label} openLabel={openLabel} variant={variant} icon={icon} />
      <CollapsePanel open={open} id={id} className={contentClassName}>
        {children}
      </CollapsePanel>
    </div>
  );
}
