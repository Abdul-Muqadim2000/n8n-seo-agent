import type { ReactNode } from 'react';
import * as R from '@radix-ui/react-tabs';
import * as S from '@radix-ui/react-switch';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

export function Tabs({ value, onValueChange, defaultValue, children, className }: { value?: string; onValueChange?: (v: string) => void; defaultValue?: string; children: ReactNode; className?: string }) {
  return (
    <R.Root value={value} onValueChange={onValueChange} defaultValue={defaultValue} className={className}>
      {children}
    </R.Root>
  );
}

// Tab rows: the baseline is an inset shadow (so the active bar paints over it inside the scroll box), the active bar grows in
// from the centre, inactive tabs show a grey bar on hover. Focus uses an inset ring: an outer ring would be clipped by the scroll box.
const tabRow = 'flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--line)] [scrollbar-width:none]';
const tabItem =
  'group relative flex h-10 shrink-0 items-center gap-2 rounded-t-md px-3 text-sm font-medium transition-colors duration-150 ease-brand focus-visible:shadow-[inset_0_0_0_2px_var(--ring-color)]! ' +
  'after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-[scale,background-color,opacity] after:duration-200 after:ease-brand';
const tabActive = 'text-ink after:scale-x-100 after:bg-accent after:opacity-100';
const tabInactive = 'text-ink-3 hover:text-ink after:scale-x-50 after:bg-line-strong after:opacity-0 hover:after:scale-x-100 hover:after:opacity-100';

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return <R.List className={cn(tabRow, className)}>{children}</R.List>;
}

export function Tab({ value, children, count }: { value: string; children: ReactNode; count?: number }) {
  return (
    <R.Trigger
      value={value}
      className={cn(
        tabItem,
        'data-[state=active]:text-ink data-[state=active]:after:scale-x-100 data-[state=active]:after:bg-accent data-[state=active]:after:opacity-100',
        'data-[state=inactive]:text-ink-3 data-[state=inactive]:hover:text-ink data-[state=inactive]:after:scale-x-50 data-[state=inactive]:after:bg-line-strong data-[state=inactive]:after:opacity-0 data-[state=inactive]:hover:after:scale-x-100 data-[state=inactive]:hover:after:opacity-100',
      )}
    >
      {children}
      {count != null && (
        <span className="rounded-md bg-surface-2 px-1.5 text-xs tabular text-ink-2 transition-colors group-data-[state=active]:bg-accent-soft group-data-[state=active]:text-accent-text">{count}</span>
      )}
    </R.Trigger>
  );
}

export const TabPanel = ({ value, children, className }: { value: string; children: ReactNode; className?: string }) => (
  <R.Content value={value} className={cn('pt-5 outline-none', className)}>
    {children}
  </R.Content>
);

/** Route-based tabs (each tab is a URL). */
export function LinkTabs({ items, className }: { items: { to: string; label: ReactNode; end?: boolean }[]; className?: string }) {
  return (
    <nav className={cn(tabRow, className)}>
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cn(tabItem, isActive ? tabActive : tabInactive)}>
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Small segmented control for 2-5 options (chart metric, date range, view). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  label,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
  /** accessible name of the group */
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={cn('inline-flex gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5', disabled && 'opacity-60', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => value !== o.value && onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 font-medium transition-[color,background-color,box-shadow] duration-150 ease-brand disabled:cursor-not-allowed',
            size === 'sm' ? 'h-6 text-xs' : 'h-7 text-[13px]',
            value === o.value
              ? 'bg-surface text-ink shadow-card ring-1 ring-line dark:bg-surface-3'
              : 'text-ink-3 enabled:hover:bg-surface/60 enabled:hover:text-ink dark:enabled:hover:bg-surface-3/50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onCheckedChange, disabled, id, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; id?: string; label?: string }) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors duration-200 ease-brand enabled:hover:bg-ink-3/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent enabled:data-[state=checked]:hover:bg-accent-hover"
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-card ring-1 ring-black/5 transition-[translate,width] duration-200 ease-brand group-active:w-[18px] data-[state=checked]:translate-x-[18px] group-active:data-[state=checked]:translate-x-4" />
    </S.Root>
  );
}

/** A row with a title/description and a switch — for settings lists. */
export function SwitchRow({ title, description, checked, onCheckedChange, disabled, extra }: { title: ReactNode; description?: ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; extra?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
        {extra}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} label={typeof title === 'string' ? title : undefined} />
    </div>
  );
}
