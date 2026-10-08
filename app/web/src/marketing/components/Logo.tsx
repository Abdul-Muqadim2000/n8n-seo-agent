import { cn } from '@/lib/utils';

/** The horizontal Ascentra logo from the supplied SVGs: ink on light, white on dark (follows the theme), or always white on ink bands. */
export function Logo({ onInk = false, className }: { onInk?: boolean; className?: string }) {
  if (onInk) return <img src="/brand/ascentra-logo-horizontal-white.svg" alt="Ascentra" width={153} height={40} className={cn('h-10 w-auto', className)} />;
  return (
    <>
      <img src="/brand/ascentra-logo-horizontal-ink.svg" alt="Ascentra" width={153} height={40} className={cn('h-10 w-auto dark:hidden', className)} />
      <img src="/brand/ascentra-logo-horizontal-white.svg" alt="Ascentra" width={153} height={40} className={cn('hidden h-10 w-auto dark:block', className)} />
    </>
  );
}
