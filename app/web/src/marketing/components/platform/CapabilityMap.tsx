import { features, type Feature } from '../../content/features';
import { cn } from '@/lib/utils';
import { IconTile } from '../FeatureCard';
import { jumpTo } from './kit';

const GROUPS: { label: string; slugs: string[] }[] = [
  { label: 'Plan', slugs: ['keyword-research', 'keyword-ladders'] },
  { label: 'Create', slugs: ['content', 'autopilot'] },
  { label: 'Measure', slugs: ['technical-audits', 'site-tracking', 'ai-visibility', 'backlinks'] },
  { label: 'Run', slugs: ['reports', 'enterprise'] },
];

/** The ten capabilities as one system, in four layers (plan, create, measure, run); each tile jumps to its section on /platform. */
export function CapabilityMap({ className }: { className?: string }) {
  const bySlug = new Map(features.map((f) => [f.slug, f] as const));
  let n = 0;
  return (
    <nav aria-label="Capabilities by layer" className={cn('rounded-2xl border border-line bg-surface p-3 shadow-overlay sm:p-4', className)}>
      <ol className="divide-y divide-line">
        {GROUPS.map((g) => (
          <li key={g.label} className="grid grid-cols-1 gap-2 py-3 first:pt-1 last:pb-1 sm:grid-cols-[84px_minmax(0,1fr)] sm:items-center sm:gap-3">
            <span className="px-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{g.label}</span>
            <ul className="grid grid-cols-2 gap-2">
              {g.slugs
                .map((s) => bySlug.get(s))
                .filter((f): f is Feature => !!f)
                .map((f) => {
                  const i = n++;
                  return (
                    <li key={f.slug} className="animate-fade-up" style={{ animationDelay: `${260 + i * 45}ms` }}>
                      <a
                        href={`#${f.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          jumpTo(f.slug);
                        }}
                        className="group flex h-full items-center gap-2.5 rounded-lg border border-line bg-page px-2.5 py-2 text-[13px] font-medium text-ink transition-[border-color,background-color,box-shadow] duration-200 ease-brand hover:border-accent hover:bg-surface hover:shadow-card"
                      >
                        <IconTile icon={f.icon} size="sm" className="size-7 group-hover:bg-accent group-hover:text-accent-ink [&_svg]:size-3.5" />
                        <span className="min-w-0 leading-tight">{f.shortName}</span>
                      </a>
                    </li>
                  );
                })}
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-2 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-2">
        <span className="mk-pulse size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
        One weekly loop, with the cost shown before every run
      </p>
    </nav>
  );
}
