import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Focus: the border turns the focus colour and a soft 3px halo appears (replaces the global ring, hence `!`). Errors keep a red
// border and a red halo; disabled controls sit on surface-2 with muted text.
const control = cn(
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3',
  'transition-[border-color,box-shadow,background-color] duration-150 ease-brand hover:border-ink-3/60',
  'focus:outline-none focus:border-[color:var(--ring-color)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring-color)_22%,transparent)]!',
  'aria-[invalid=true]:border-critical aria-[invalid=true]:hover:border-critical aria-[invalid=true]:focus:border-critical aria-[invalid=true]:focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--critical)_22%,transparent)]!',
  'disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-ink-3 disabled:shadow-none',
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'py-2 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="group relative">
      <select ref={ref} className={cn(control, 'h-9 cursor-pointer appearance-none pr-9 disabled:cursor-not-allowed', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3 transition-colors group-hover:text-ink-2 group-has-[:disabled]:text-ink-3" aria-hidden />
    </div>
  );
});

export function Label({ htmlFor, children, optional, className }: { htmlFor?: string; children: ReactNode; optional?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-ink', className)}>
      {children}
      {optional && <span className="text-xs font-normal text-ink-3">optional</span>}
    </label>
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-critical-text animate-fade-in">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Label + control + hint + error. The control gets `id` and aria wiring through the render prop. */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (p: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} optional={optional}>
          {label}
        </Label>
      )}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[13px] leading-snug text-ink-3">
          {hint}
        </p>
      )}
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
}

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }>(function Checkbox(
  { label, description, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <label htmlFor={cid} className={cn('group flex cursor-pointer items-start gap-3 rounded-lg has-[:disabled]:cursor-not-allowed', className)}>
      <span className="relative mt-0.5 flex size-4 shrink-0">
        <input
          ref={ref}
          id={cid}
          type="checkbox"
          className={cn(
            'peer size-4 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-surface transition-[background-color,border-color,box-shadow] duration-150 ease-brand',
            'group-hover:border-ink-3/70 checked:border-accent checked:bg-accent group-hover:checked:border-accent-hover group-hover:checked:bg-accent-hover',
            'disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:checked:bg-accent/50 disabled:checked:border-transparent',
          )}
          {...rest}
        />
        <Check className="pointer-events-none absolute inset-0 m-auto size-3 scale-75 text-accent-ink opacity-0 transition-[opacity,scale] duration-150 ease-brand peer-checked:scale-100 peer-checked:opacity-100" strokeWidth={3} aria-hidden />
      </span>
      <span className="min-w-0 group-has-[:disabled]:opacity-60">
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{description}</span>}
      </span>
    </label>
  );
});

/** A selectable card (radio/checkbox look) for choices with a description, e.g. report type or verification method. */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  badge,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,translate] duration-200 ease-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-accent-text/80 bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent-text)]'
          : 'border-line-strong bg-surface shadow-card enabled:hover:-translate-y-px enabled:hover:border-ink-3/50 enabled:hover:shadow-raised enabled:active:translate-y-0 enabled:active:shadow-card',
      )}
    >
      {icon && <span className={cn('mt-0.5 shrink-0 transition-colors', selected ? 'text-accent-text' : 'text-ink-3 group-enabled:group-hover:text-ink-2')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
          <span>{title}</span>
          {badge}
        </span>
        {description && <span className="mt-1 block text-[13px] leading-snug text-ink-2">{description}</span>}
      </span>
      <span
        className={cn(
          'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color] duration-200 ease-brand',
          selected ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface group-enabled:group-hover:border-ink-3/70',
        )}
        aria-hidden
      >
        <Check className={cn('size-3 transition-[opacity,scale] duration-200 ease-brand', selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0')} strokeWidth={3} />
      </span>
    </button>
  );
}
