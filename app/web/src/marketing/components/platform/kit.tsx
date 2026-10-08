// Building blocks shared by the platform, feature, how-it-works and solutions pages.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal, useInView } from '../Reveal';
import { useSectionTone } from '../Section';
import './platform.css';

/** "Keyword ladders" → "keyword ladders" for use mid-sentence; acronyms stay ("AI visibility", "B2B and SaaS"). */
export const lowerFirst = (s: string) => (/^[A-Z][A-Z0-9]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** A JSON-LD data block (allowed by the CSP: `type="application/ld+json"` is data, not a script). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

/** Text link with an arrow that nudges on hover (follows the Section tone). */
export function ArrowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const ink = useSectionTone() === 'ink';
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex items-center gap-1.5 text-[15px] font-medium transition-colors duration-150 ease-brand',
        ink ? 'text-accent-on-ink hover:text-on-ink' : 'text-accent-text hover:text-accent-hover',
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}

/** Check-marked list that reveals item by item. */
export function CheckList({ items, className }: { items: string[]; className?: string }) {
  const ink = useSectionTone() === 'ink';
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((t, i) => (
        <Reveal as="li" key={t} index={i} className={cn('flex gap-3 text-[15px] leading-relaxed', ink ? 'text-on-ink-2' : 'text-ink-2')}>
          <span className={cn('mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full', ink ? 'bg-on-ink/10 text-accent-on-ink' : 'bg-accent-soft text-accent-text')}>
            <Check className="size-3" strokeWidth={2.5} aria-hidden />
          </span>
          <span>{t}</span>
        </Reveal>
      ))}
    </ul>
  );
}

/** Breadcrumb trail ("Platform › AI visibility") with BreadcrumbList structured data. The last item is the current page. */
export function Breadcrumbs({ items, className }: { items: { label: string; to: string }[]; className?: string }) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return (
    <nav aria-label="Breadcrumb" className={cn('animate-fade-up', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
        <li>
          <Link to="/" className="rounded-sm transition-colors duration-150 ease-brand hover:text-ink">
            Home
          </Link>
        </li>
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.to} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5 text-ink-3/70" aria-hidden />
              {last ? (
                <span aria-current="page" className="font-medium text-ink-2">
                  {it.label}
                </span>
              ) : (
                <Link to={it.to} className="rounded-sm transition-colors duration-150 ease-brand hover:text-ink">
                  {it.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [{ label: 'Home', to: '/' }, ...items].map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.label, item: `${origin}${it.to}` })),
        }}
      />
    </nav>
  );
}

/** Adds `is-on` once the element is in view: starts the CSS draw-ins in platform.css (static under reduced motion). */
export function useOn<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const on = useInView(ref, { threshold });
  return [ref, on] as const;
}

/** Numbered steps joined by a line that draws in: a row on wide screens, a vertical rail on phones. */
export function StepRail({ steps, className }: { steps: { title: string; body: string }[]; className?: string }) {
  const [ref, on] = useOn<HTMLOListElement>(0.25);
  const ink = useSectionTone() === 'ink';
  const cols = steps.length >= 4 ? 'lg:grid-cols-4' : steps.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  const half = `${50 / steps.length}%`; // centre of the first / last column
  return (
    <ol ref={ref} className={cn('relative grid grid-cols-1 gap-8 lg:gap-6', cols, on && 'is-on', className)}>
      {/* the connecting line: horizontal through the node centres (wide), vertical through them (phones) */}
      <span aria-hidden className={cn('absolute top-5 hidden h-px lg:block', ink ? 'bg-line-on-ink' : 'bg-line-strong')} style={{ left: half, right: half }} />
      <span aria-hidden className={cn('pf-line-x absolute top-5 hidden h-px lg:block', ink ? 'bg-accent-on-ink' : 'bg-accent')} style={{ left: half, right: half }} />
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-5 lg:flex-col lg:items-center lg:gap-0 lg:text-center" style={{ ['--pf-i' as string]: i }}>
          {/* phones: a segment from this node to the next one (item height + the 2rem gap) */}
          {i < steps.length - 1 && (
            <>
              <span aria-hidden className={cn('absolute left-5 top-5 h-[calc(100%+2rem)] w-px lg:hidden', ink ? 'bg-line-on-ink' : 'bg-line-strong')} />
              <span aria-hidden className={cn('pf-seg-y absolute left-5 top-5 h-[calc(100%+2rem)] w-px lg:hidden', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
            </>
          )}
          <span
            className={cn(
              'pf-node relative z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-full border font-mono text-[13px] font-medium tabular',
              ink ? 'border-accent-on-ink bg-ink-surface text-accent-on-ink' : 'border-accent bg-surface text-accent-text shadow-card',
            )}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="pf-follow block min-w-0 pt-1.5 lg:max-w-[30ch] lg:pt-6">
            <span className={cn('block font-display text-lg font-semibold tracking-[-0.01em]', ink ? 'text-on-ink' : 'text-ink')}>{s.title}</span>
            <span className={cn('mt-2 block text-[15px] leading-relaxed', ink ? 'text-on-ink-2' : 'text-ink-2')}>{s.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Previous / next links between pages of one registry (wraps round). */
export function PrevNext({ prev, next, className }: { prev: { to: string; label: string }; next: { to: string; label: string }; className?: string }) {
  const card =
    'group flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-line bg-surface p-5 transition-[border-color,box-shadow,transform] duration-200 ease-brand hover:-translate-y-0.5 hover:border-accent hover:shadow-raised sm:p-6';
  return (
    <nav aria-label="More capabilities" className={cn('flex flex-col gap-3 sm:flex-row sm:gap-4', className)}>
      <Link to={prev.to} rel="prev" className={card}>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
          <ArrowLeft className="size-3.5 transition-transform duration-200 ease-brand group-hover:-translate-x-1" aria-hidden />
          Previous
        </span>
        <span className="truncate font-display text-base font-semibold text-ink group-hover:text-accent-text">{prev.label}</span>
      </Link>
      <Link to={next.to} rel="next" className={cn(card, 'sm:items-end sm:text-right')}>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
          Next
          <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
        </span>
        <span className="truncate font-display text-base font-semibold text-ink group-hover:text-accent-text">{next.label}</span>
      </Link>
    </nav>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Smooth-scrolls to an in-page section (instant under reduced motion), keeps the hash in the URL and moves focus there. */
export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(window.history.state, '', `#${id}`);
  el.focus({ preventScroll: true });
}

/** The id of the section currently under the reading line (35% down the viewport), or null above the first / below the last. */
export function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');
  useEffect(() => {
    const list = key.split('|');
    let raf = 0;
    const read = () => {
      raf = 0;
      const line = window.innerHeight * 0.35;
      let cur: string | null = null;
      for (const id of list) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= line) cur = r.bottom > line ? id : null;
      }
      setActive(cur);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key]);
  return active;
}
