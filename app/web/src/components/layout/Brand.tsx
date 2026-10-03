import { Link } from 'react-router';
import { cn } from '@/lib/utils';

export const BRAND_NAME = 'SEO Agent';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M8 21l5-6 4 4 7-9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink', className)}>
      <BrandMark />
      <span>{BRAND_NAME}</span>
    </Link>
  );
}
