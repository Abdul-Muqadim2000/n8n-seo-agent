import type { ReactNode } from 'react';
import { BadgeCheck, Building2, Database, KeyRound, ShieldCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from '../Reveal';

interface Layer {
  icon: LucideIcon;
  name: string;
  facts: string[];
}

/** outermost first: what every request passes before it reaches a company's data */
const LAYERS: Layer[] = [
  { icon: ShieldCheck, name: 'Every request', facts: ['CSRF check', 'Rate limits', 'Strict CSP'] },
  { icon: KeyRound, name: 'Sign-in', facts: ['argon2id', 'Google with PKCE', 'Hashed sessions'] },
  { icon: Building2, name: 'Company workspace', facts: ['Four roles', 'Isolated per company'] },
  { icon: BadgeCheck, name: 'Verified website', facts: ['Search Console', 'DNS TXT', 'Meta tag'] },
];

function Ring({ depth, children }: { depth: number; children: ReactNode }) {
  const l = LAYERS[depth];
  const Icon = l.icon;
  return (
    <Reveal
      index={depth * 2}
      className={cn(
        'rounded-2xl border border-line p-2.5 transition-[border-color,box-shadow] duration-200 ease-brand sm:p-3.5',
        depth % 2 === 0 ? 'bg-surface' : 'bg-page',
        // highlight only the ring whose own label is hovered (not every ring around it)
        '[&:has(>[data-ring-head]:hover)]:border-accent [&:has(>[data-ring-head]:hover)]:shadow-raised',
      )}
    >
      <div data-ring-head className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1.5 pb-2.5 pt-1 sm:px-2">
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-[10.5px] font-medium text-ink-3 tabular">{String(depth + 1).padStart(2, '0')}</span>
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-accent-soft text-accent-text" aria-hidden>
            <Icon className="size-3.5" strokeWidth={2} />
          </span>
          <span className="text-[13px] font-semibold text-ink">{l.name}</span>
        </span>
        <span className="text-[11.5px] text-ink-3">{l.facts.join(' · ')}</span>
      </div>
      {children}
    </Reveal>
  );
}

/** Security in layers: nested rings from "every request" down to the company's data at the core. Each ring fades in after the one
 *  around it; hovering a ring's label outlines that ring. */
export function LayeredShield({ className }: { className?: string }) {
  const core = (
    <Reveal index={LAYERS.length * 2} className="rounded-xl border border-accent bg-surface px-4 py-5 shadow-raised sm:px-5">
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent text-accent-ink" aria-hidden>
            <Database className="size-4" strokeWidth={2} />
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-ink">Your data</span>
            <span className="block text-[11.5px] text-ink-3">Search Console, GA4, runs, reports, files</span>
          </span>
        </span>
        <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-medium text-good-text sm:inline-flex">
          <span className="size-1.5 rounded-full bg-good" aria-hidden />
          Protected
        </span>
      </span>
    </Reveal>
  );
  const nest = (depth: number): ReactNode => (depth === LAYERS.length ? core : <Ring depth={depth}>{nest(depth + 1)}</Ring>);
  return (
    <figure className={cn('w-full', className)}>
      <div className="rounded-[22px] border border-line bg-page p-2 shadow-overlay sm:p-3">{nest(0)}</div>
      <figcaption className="mt-4 text-center text-[13px] text-ink-3">Every request passes each layer before it reaches your data.</figcaption>
    </figure>
  );
}
