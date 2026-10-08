import { integrations } from '../content/site';
import { cn } from '@/lib/utils';
import { useSectionTone } from './Section';

/** Engines and tools Ascentra works with, as text chips scrolling sideways (CSS only, pauses on hover, static and wrapped under reduced motion). */
export function IntegrationMarquee({ items = integrations, label = 'Works with', className }: { items?: string[]; label?: string; className?: string }) {
  const ink = useSectionTone() === 'ink';
  const chip = cn(
    'inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors duration-200 ease-brand',
    ink ? 'border-line-on-ink text-on-ink-2 hover:text-on-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
  );
  return (
    <div className={cn('mk-marquee relative', className)}>
      <p className="sr-only">
        {label}: {items.join(', ')}
      </p>
      <div className="mk-marquee-track" aria-hidden>
        {[0, 1].map((copy) => (
          <ul key={copy} className="mk-marquee-group">
            {items.map((name) => (
              <li key={name} className={chip}>
                {name}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
