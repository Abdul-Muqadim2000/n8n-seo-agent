import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Check, Link as LinkIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container, CtaBand, Reveal } from '../components';
import { ArrowLink, PageHero } from '../components/company/PageHero';
import { entryAnchor, entryTags, fmtLongDate, monthLabel, type ChangelogTag } from '../components/company/changelog-utils';
import { changelog, type ChangelogEntry } from '../content/changelog';
import { features } from '../content/features';
import { useSeo } from '../useSeo';

const NEWEST = changelog[0]?.date;

/** every category used by at least one entry: labels first, then capabilities in registry order; with counts */
function allTags(): (ChangelogTag & { count: number })[] {
  const counts = new Map<string, ChangelogTag & { count: number }>();
  for (const e of changelog)
    for (const t of entryTags(e)) {
      const c = counts.get(t.key);
      if (c) c.count++;
      else counts.set(t.key, { ...t, count: 1 });
    }
  const order = (k: string) => (k.startsWith('label:') ? -1 : features.findIndex((f) => f.slug === k));
  return [...counts.values()].sort((a, b) => order(a.key) - order(b.key));
}

/** Copies the entry's URL; falls back to putting the anchor in the address bar where the clipboard is not available. */
function CopyLink({ anchor, title }: { anchor: string; title: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'linked'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    const url = `${window.location.origin}/changelog#${anchor}`;
    let next: typeof state = 'linked';
    try {
      await navigator.clipboard.writeText(url);
      next = 'copied';
    } catch {
      window.history.replaceState(window.history.state, '', `#${anchor}`);
    }
    setState(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  };
  const done = state !== 'idle';
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy link to “${title}”`}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md text-ink-3 transition-[opacity,color,background-color] duration-150 ease-brand hover:bg-surface-2 hover:text-ink',
          'opacity-0 focus-visible:opacity-100 group-hover/entry:opacity-100 [@media(hover:none)]:opacity-100',
          done && 'text-good-text opacity-100',
        )}
      >
        {done ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : <LinkIcon className="size-4" aria-hidden />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'copied' ? 'Link copied' : state === 'linked' ? 'Link shown in the address bar' : ''}
      </span>
      {done && (
        <span aria-hidden className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11.5px] font-medium text-page shadow-raised animate-fade-in">
          {state === 'copied' ? 'Link copied' : 'Link in the address bar'}
        </span>
      )}
    </span>
  );
}

function Chip({ active, onClick, children, count, size = 'md' }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-[background-color,border-color,color] duration-150 ease-brand',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3.5 text-[13px]',
        active ? 'border-ink bg-ink text-page' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
      {count !== undefined && <span className={cn('font-mono text-[11px] tabular', active ? 'text-page/70' : 'text-ink-3')}>{count}</span>}
    </button>
  );
}

function Entry({ e, filter, setFilter }: { e: ChangelogEntry; filter: string | null; setFilter: (k: string | null) => void }) {
  const anchor = entryAnchor(e);
  const isNew = e.date === NEWEST;
  const tags = entryTags(e);
  const firstFeature = tags.find((t) => t.to);
  return (
    <article id={anchor} aria-labelledby={`${anchor}-t`} className="group/entry relative scroll-mt-40 pl-8 sm:pl-10 lg:scroll-mt-28">
      {/* the dot on the timeline */}
      <span aria-hidden className={cn('absolute -left-[6px] top-[6px] size-[11px] rounded-full ring-4 ring-page', isNew ? 'bg-accent' : 'border-2 border-line-strong bg-page')}>
        {isNew && <span className="mk-pulse absolute inset-0 rounded-full" />}
      </span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <time dateTime={e.date} className="font-mono text-[12px] text-ink-3 tabular">
          {fmtLongDate(e.date)}
        </time>
        {isNew && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-accent-text">New</span>}
      </div>
      <div className="mt-2 flex items-start gap-1.5">
        <h3 id={`${anchor}-t`} className="font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-2xl">
          <a href={`#${anchor}`} className="transition-colors duration-150 ease-brand hover:text-accent-text">
            {e.title}
          </a>
        </h3>
        <span className="mt-0.5 sm:mt-1">
          <CopyLink anchor={anchor} title={e.title} />
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2 sm:text-base">{e.summary}</p>
      <ul className="mt-5 max-w-2xl space-y-2.5">
        {e.highlights.map((h) => (
          <li key={h} className="flex gap-3 text-[14.5px] leading-relaxed text-ink-2">
            <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            {h}
          </li>
        ))}
      </ul>
      {(tags.length > 0 || firstFeature) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Categories">
              {tags.map((t) => (
                <li key={t.key}>
                  <Chip size="sm" active={filter === t.key} onClick={() => setFilter(filter === t.key ? null : t.key)}>
                    {t.label}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
          {firstFeature?.to && (
            <ArrowLink to={firstFeature.to} className="text-[13.5px]">
              Explore {firstFeature.label}
            </ArrowLink>
          )}
        </div>
      )}
    </article>
  );
}

export default function ChangelogPage() {
  useSeo({ title: 'Changelog', description: 'What is new in Ascentra: every release in plain language, newest first.', path: '/changelog' });
  const [params, setParams] = useSearchParams();
  const tags = useMemo(allTags, []);
  const raw = params.get('topic');
  const filter = raw && tags.some((t) => t.key === raw) ? raw : null;
  const setFilter = (k: string | null) => {
    const next = new URLSearchParams(params);
    if (k) next.set('topic', k);
    else next.delete('topic');
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const shown = filter ? changelog.filter((e) => entryTags(e).some((t) => t.key === filter)) : changelog;
  const months = useMemo(() => {
    const out: { label: string; entries: ChangelogEntry[] }[] = [];
    for (const e of shown) {
      const label = monthLabel(e.date);
      const last = out[out.length - 1];
      if (last && last.label === label) last.entries.push(e);
      else out.push({ label, entries: [e] });
    }
    return out;
  }, [shown]);
  const activeTag = tags.find((t) => t.key === filter);
  const first = changelog[changelog.length - 1];

  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title="What’s new in Ascentra."
        lead="Every release in plain language: what changed, and what it means for your team."
        watermark
        containerClassName="pb-12 sm:pb-16"
      >
        <p className="mt-8 font-mono text-[12px] text-ink-3 tabular">
          {changelog.length} releases since {first ? monthLabel(first.date) : ''}
        </p>
      </PageHero>

      {/* phones and tablets: a sticky row of chips under the site header (wide screens use the side list) */}
      <div className="sticky top-16 z-30 border-y border-line bg-page/90 backdrop-blur-md supports-[backdrop-filter]:bg-page/80 lg:hidden">
        <Container>
          <div role="group" aria-label="Filter releases by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
            <Chip active={!filter} onClick={() => setFilter(null)} count={changelog.length}>
              All
            </Chip>
            {tags.map((t) => (
              <Chip key={t.key} active={filter === t.key} onClick={() => setFilter(filter === t.key ? null : t.key)} count={t.count}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Container>
      </div>

      <section className="border-t border-line bg-page pb-24 pt-12 sm:pb-32 sm:pt-16 max-lg:border-t-0" aria-label="Releases">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-16">
            <nav aria-label="Filter releases by category" className="hidden lg:block">
              <div className="sticky top-28">
                <p className="mb-3 pl-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Categories</p>
                <ul className="space-y-0.5">
                  {[{ key: null as string | null, label: 'All releases', count: changelog.length }, ...tags.map((t) => ({ key: t.key as string | null, label: t.label, count: t.count }))].map((t, i) => {
                    const on = filter === t.key;
                    return (
                      <li key={t.key ?? 'all'} className={cn(i === 1 && 'mt-3 border-t border-line pt-3')}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setFilter(on && t.key ? null : t.key)}
                          className={cn(
                            'relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors duration-150 ease-brand',
                            on ? 'bg-surface font-medium text-ink shadow-card' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                          )}
                        >
                          <span aria-hidden className={cn('absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors duration-200 ease-brand', on ? 'bg-accent' : 'bg-transparent')} />
                          {t.label}
                          <span className="font-mono text-[11.5px] text-ink-3 tabular">{t.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </nav>

            <div className="min-w-0">
              {activeTag && (
                <p className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-ink-2 animate-fade-in" aria-live="polite">
                  Showing {shown.length} of {changelog.length} releases in <span className="font-medium text-ink">{activeTag.label}</span>
                  <button
                    type="button"
                    onClick={() => setFilter(null)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium text-accent-text transition-colors duration-150 ease-brand hover:bg-accent-soft"
                  >
                    <X className="size-3.5" aria-hidden />
                    Clear filter
                  </button>
                </p>
              )}
              <div className="space-y-16 sm:space-y-20">
                {months.map((m) => (
                  <section key={m.label} aria-labelledby={`m-${m.label.replace(' ', '-')}`}>
                    <div className="mb-10 flex items-baseline gap-3">
                      <h2 id={`m-${m.label.replace(' ', '-')}`} className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">
                        {m.label}
                      </h2>
                      <span className="font-mono text-[12px] text-ink-3 tabular">
                        {m.entries.length} {m.entries.length === 1 ? 'release' : 'releases'}
                      </span>
                      <span aria-hidden className="h-px flex-1 self-center bg-line" />
                    </div>
                    <div className="relative ml-[6px] border-l border-line">
                      {m.entries.map((e, i) => (
                        <Reveal key={`${filter ?? 'all'}-${entryAnchor(e)}`} index={Math.min(i, 2)} className="pb-12 last:pb-0">
                          <Entry e={e} filter={filter} setFilter={setFilter} />
                        </Reveal>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>
      <CtaBand title="See the latest release at work." lead="Every capability in the changelog is live in the app. Connect a website and run the loop on your own data." />
    </>
  );
}
