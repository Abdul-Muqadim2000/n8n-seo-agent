import type { ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import * as M from '@radix-ui/react-dropdown-menu';
import * as T from '@radix-ui/react-tooltip';
import * as P from '@radix-ui/react-popover';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------- dialog ----------
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  wide,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
  wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink-surface/50 backdrop-blur-[2px] dark:bg-black/60 data-[state=open]:animate-fade-in" />
        <D.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface shadow-overlay outline-none focus-visible:shadow-overlay! data-[state=open]:animate-scale-in',
            wide ? 'max-w-3xl' : 'max-w-lg',
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div className="min-w-0">
              <D.Title className="font-display text-[17px] leading-snug font-semibold tracking-[-0.01em] text-ink">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-[13px] leading-relaxed text-ink-2">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
            </div>
            <D.Close className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-1.5 text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink active:bg-surface-3" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          </div>
          {children && <div className="px-6 py-4">{children}</div>}
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-line bg-page/60 px-6 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
export const DialogClose = D.Close;

// ---------- dropdown menu ----------
export function Menu({ trigger, children, align = 'end', className }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 min-w-[200px] origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-line bg-surface p-1 shadow-overlay dark:bg-surface-2 outline-none focus-visible:shadow-overlay! data-[state=open]:animate-scale-in',
            className,
          )}
        >
          {children}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

export function MenuItem({ children, onSelect, icon, danger, disabled }: { children: ReactNode; onSelect?: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        // the highlight is the focus indicator inside a menu (keyboard and pointer), so the global ring is not drawn
        'group flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-100 focus-visible:shadow-none! data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        danger ? 'text-critical-text data-[highlighted]:bg-critical-soft' : 'text-ink data-[highlighted]:bg-accent-soft data-[highlighted]:text-ink',
      )}
    >
      {icon && <span className={cn('shrink-0 transition-colors duration-100', danger ? 'text-critical-text' : 'text-ink-3 group-data-[highlighted]:text-accent-text')}>{icon}</span>}
      {children}
    </M.Item>
  );
}

export const MenuSeparator = () => <M.Separator className="-mx-1 my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-2.5 pb-1 pt-2 text-xs font-medium text-ink-3">{children}</M.Label>;

// ---------- tooltip ----------
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Root delayDuration={200}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs origin-[var(--radix-tooltip-content-transform-origin)] animate-scale-in rounded-md bg-ink px-2.5 py-1.5 text-xs leading-snug font-medium text-page shadow-overlay"
        >
          {content}
          <T.Arrow className="fill-ink" width={10} height={5} />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
export const TooltipProvider = T.Provider;

// ---------- popover ----------
export function Popover({ trigger, children, align = 'start', className }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <P.Root>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 origin-[var(--radix-popover-content-transform-origin)] rounded-xl border border-line bg-surface p-3 shadow-overlay dark:bg-surface-2 outline-none focus-visible:shadow-overlay! data-[state=open]:animate-scale-in',
            className,
          )}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
