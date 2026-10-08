import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

// Motion: colours / shadow ease in 150ms; a press nudges the button down 1px (reduced motion makes it instant).
const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium select-none transition-[color,background-color,border-color,box-shadow,opacity,translate,filter] duration-150 ease-brand active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0';
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink shadow-card hover:bg-accent-hover hover:shadow-raised active:bg-accent-hover active:shadow-card',
  secondary: 'border border-line-strong bg-surface text-ink shadow-card hover:border-ink-3/40 hover:bg-surface-2 active:bg-surface-3 active:shadow-none',
  outline: 'border border-accent-text/70 bg-transparent text-accent-text hover:border-accent-text hover:bg-accent-soft active:bg-accent-soft',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-3',
  danger: 'bg-critical text-white shadow-card hover:shadow-raised hover:brightness-[.92] active:brightness-[.85] active:shadow-card',
  link: 'h-auto px-0 text-accent-text underline-offset-4 decoration-accent-text/40 hover:underline hover:decoration-accent-text active:translate-y-0',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
  icon: 'size-9 p-0',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], variant === 'link' ? '' : sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  // Loading keeps the width: the spinner takes the icon's place, or (no icon) sits over the label, which turns transparent but
  // stays in the accessibility tree.
  const overlay = loading && !icon;
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, cn(overlay && 'relative', loading && 'disabled:opacity-80', className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && icon ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {overlay ? (
        <>
          <span className="contents text-transparent">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <Loader2 className="size-4 animate-spin" />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', className, icon, children, ...rest }: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
