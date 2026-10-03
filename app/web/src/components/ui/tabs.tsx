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

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return <R.List className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>{children}</R.List>;
}

export function Tab({ value, children, count }: { value: string; children: ReactNode; count?: number }) {
  return (
    <R.Trigger
      value={value}
      className="relative -mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-ink-3 transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink"
    >
      {children}
      {count != null && <span className="rounded-md bg-surface-2 px-1.5 text-xs tabular text-ink-2">{count}</span>}
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
    <nav className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cn('relative -mb-px flex h-10 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors', isActive ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink')
          }
        >
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
    <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', disabled && 'opacity-60', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => value !== o.value && onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 font-medium transition-colors disabled:cursor-not-allowed',
            size === 'sm' ? 'h-6 text-xs' : 'h-7 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
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
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-surface-3 transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent"
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
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
