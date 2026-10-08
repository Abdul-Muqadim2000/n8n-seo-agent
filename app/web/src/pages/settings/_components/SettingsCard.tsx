import type { ReactNode } from 'react';
import { Check, Crown, Eye, ShieldCheck, UserRound } from 'lucide-react';
import { ROLE_LABELS, type Role } from '@seo/shared';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { IconTile, InfoTip, type IconTileTone } from '@/components/insight';

/**
 * A settings section as a card: icon tile, title (+ info tip), one line of description, actions on the right. The body is the
 * caller's (CardBody / CardFooter, or a form wrapping both). `danger` draws the red danger-zone variant.
 */
export function SettingsCard({
  icon,
  iconTone = 'blue',
  title,
  description,
  info,
  actions,
  danger,
  className,
  children,
}: {
  icon: ReactNode;
  iconTone?: IconTileTone;
  title: ReactNode;
  description?: ReactNode;
  info?: ReactNode;
  actions?: ReactNode;
  danger?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card className={cn(danger && 'border-critical/40', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile tone={danger ? 'critical' : iconTone} size="md">
            {icon}
          </IconTile>
          <div className="min-w-0 pt-0.5">
            <h2 className="flex items-center gap-1 font-display text-[15px] leading-snug font-semibold tracking-[-0.01em] text-ink">
              {title}
              {info && <InfoTip label={typeof title === 'string' ? `About ${title.toLowerCase()}` : 'What this means'}>{info}</InfoTip>}
            </h2>
            {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  );
}

export const ROLE_ICON: Record<Role, ReactNode> = {
  owner: <Crown />,
  admin: <ShieldCheck />,
  member: <UserRound />,
  viewer: <Eye />,
};

/** A role as a chip with its icon (the owner in brand blue). */
export function RoleChip({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-xs leading-none font-medium [&_svg]:size-3 [&_svg]:shrink-0',
        role === 'owner' ? 'border-transparent bg-accent-soft text-accent-text' : 'border-line bg-surface-2 text-ink-2',
        className,
      )}
    >
      {ROLE_ICON[role]}
      {ROLE_LABELS[role]}
    </span>
  );
}

/** Small "done" / "next" step marker used by the add-site stepper. */
export function StepDot({ state, n }: { state: 'done' | 'current' | 'next'; n: number }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-semibold transition-colors duration-200 ease-brand',
        state === 'current' && 'bg-accent text-accent-ink shadow-card ring-4 ring-accent-soft',
        state === 'done' && 'bg-good-soft text-good-text',
        state === 'next' && 'border border-line-strong bg-surface text-ink-3',
      )}
      aria-hidden
    >
      {state === 'done' ? <Check className="size-4" strokeWidth={2.5} /> : n}
    </span>
  );
}
