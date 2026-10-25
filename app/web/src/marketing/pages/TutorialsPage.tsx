import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Check, ChevronDown, Clock, ListOrdered, Play, Search, SlidersHorizontal, X } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Container, CtaBand, Eyebrow, Faq, Reveal, Section, SectionHeading } from '../components';
import { ArrowLink, jumpTo } from '../components/platform/kit';
import { TutorialCard } from '../components/tutorials/TutorialCard';
import { TutorialCover } from '../components/tutorials/TutorialCover';
import { TutorialPlayer } from '../components/tutorials/TutorialPlayer';
import type { FaqItem } from '../content/features';
import {
  audienceLabel,
  clock,
  filmCount,
  levels,
  matchesQuery,
  minutesLabel,
  quickTips,
  seriesCount,
  seriesMinutes,
  seriesTutorials,
  tutorialCount,
  tutorialMinutes,
  tutorials,
  tutorialSeries,
  type Tutorial,
  type TutorialAudience,
  type TutorialLevel,
  type TutorialSeries,
} from '../content/tutorials';
import { useSeo } from '../useSeo';

const FEATURED = tutorials[0];
const START = tutorialSeries[0];
const AUDIENCES: TutorialAudience[] = ['owner', 'marketer', 'agency'];

const FAQS: FaqItem[] = [
  {
    q: 'Do I need an account to watch?',
    a: 'No. Every tutorial on this page is free to watch and read without signing in. To follow along on your own website, start free and the setup takes a few minutes.',
  },
  {
    q: 'Can I read instead of watching?',
    a: 'Yes. Every tutorial has its steps written out, so you can follow it at your own pace, without sound, or before its video is ready. Tutorials with a video also have the full transcript to read.',
  },
  {
    q: 'Do the videos have subtitles?',
    a: 'Yes. The subtitles are part of every video, so they show on any device without switching anything on. Every video page also has the full transcript to read.',
  },
  {
    q: 'What if my question is not covered?',
    a: 'Inside Alaventra, every place that asks you for something has a "Show me how" guide beside it, with your own values filled in. And you can always write to us: a person answers.',
  },
];

type Filters = { q: string; series: string; level: TutorialLevel | ''; audience: TutorialAudience | ''; ready: boolean };

/** the filters live in the address (?q=&series=&level=&for=&video=ready), so a filtered list can be shared and survives a reload */
function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const [params, setParams] = useSearchParams();
  const level = params.get('level') ?? '';
  const audience = params.get('for') ?? '';
  const series = params.get('series') ?? '';
  const filters: Filters = {
    q: params.get('q') ?? '',
    series: tutorialSeries.some((s) => s.id === series) ? series : '',
    level: (levels as string[]).includes(level) ? (level as TutorialLevel) : '',
    audience: (AUDIENCES as string[]).includes(audience) ? (audience as TutorialAudience) : '',
    ready: params.get('video') === 'ready',
  };
  const set = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const p = new URLSearchParams();
    if (next.q) p.set('q', next.q);
    if (next.series) p.set('series', next.series);
    if (next.level) p.set('level', next.level);
    if (next.audience) p.set('for', next.audience);
    if (next.ready) p.set('video', 'ready');
    setParams(p, { replace: true, preventScrollReset: true });
  };
  return [filters, set];
}

const matches = (t: Tutorial, f: Filters) =>
  (!f.series || t.series.id === f.series) && (!f.level || t.level === f.level) && (!f.audience || t.audience.includes(f.audience)) && (!f.ready || !!t.film) && matchesQuery(t, f.q);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** any filter or a search is on: the library then shows every match in full (no "Show all" on phones) */
const filtering = (f: Filters) => !!(f.q.trim() || f.series || f.level || f.audience || f.ready);

/* ------------------------------------------------------------------------------------------------------------------------------ */

function SearchBox({ value, onChange, count }: { value: string; onChange: (v: string) => void; count: number }) {
  const id = useId();
  return (
    <form
      role="search"
      aria-label="Tutorials"
      className="mx-auto mt-9 w-full max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        jumpTo('results');
      }}
    >
      <label htmlFor={id} className="sr-only">
        Search the tutorials
      </label>
      <div className="group relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3 transition-colors duration-150 group-focus-within:text-accent-text" aria-hidden />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search the tutorials"
          autoComplete="off"
          enterKeyHint="search"
          className="h-14 w-full rounded-xl border border-line-strong bg-surface pl-12 pr-28 text-[16px] text-ink shadow-card outline-none transition-[border-color,box-shadow] duration-150 ease-brand placeholder:text-ink-3 hover:border-ink-3/50 focus-visible:border-accent [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex size-10 items-center justify-center rounded-lg text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              aria-label="Clear the search"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
          <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-accent px-3.5 text-[14px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover">
            Search
          </button>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-[13px] text-ink-3">
        {value.trim() &&
          (count ? (
            <>
              {plural(count, 'tutorial')} match.{' '}
              <a
                href="#results"
                onClick={(e) => {
                  e.preventDefault();
                  jumpTo('results');
                }}
                className="mk-tap font-medium text-accent-text hover:text-accent-hover"
              >
                See {count === 1 ? 'it' : 'them'}
              </a>
            </>
          ) : (
            'No tutorial matches. Try a shorter word, or browse the series below.'
          ))}
      </p>
    </form>
  );
}

function Hero({ filters, setFilters, count }: { filters: Filters; setFilters: (p: Partial<Filters>) => void; count: number }) {
  // what is true today: the videos that play, the tutorials that have their steps written out, the series (phones: the first two)
  const facts = allFilmed
    ? [`${tutorialCount} short videos`, 'Every step written out', plural(seriesCount, 'series', 'series')]
    : [`${plural(filmCount, 'video')} ready`, `${tutorialCount} tutorials with written steps`, plural(seriesCount, 'series', 'series')];
  return (
    <section className="relative isolate overflow-hidden bg-page">
      <div aria-hidden className="mk-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px]" />
      <span
        aria-hidden
        className="mk-watermark pointer-events-none absolute -right-40 top-[26rem] -z-10 aspect-[911/797] w-[380px] bg-ink/[0.035] sm:-right-28 sm:top-8 sm:w-[520px] lg:-right-16 lg:top-4 lg:w-[640px]"
      />
      <Container className="pt-12 sm:pt-16 lg:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <Eyebrow>Tutorials</Eyebrow>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-balance text-ink sm:text-[3.25rem] lg:text-[3.75rem]">
            Learn Alaventra, <span className="text-accent-text sm:block">one short video at a time.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-2 sm:text-xl">
            <span className="font-medium text-ink">Rank in search. Get recommended by AI.</span> Short videos show you how, one job at a time, each with its steps written out.
          </p>
          <SearchBox value={filters.q} onChange={(q) => setFilters({ q })} count={count} />
          <ul className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-ink-3">
            {facts.map((t, i) => (
              <li key={t} className={cn('flex items-center gap-2', i > 1 && 'hidden sm:flex')}>
                <Check className="size-3.5 text-accent-text" strokeWidth={2.5} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <ButtonLink to={`/tutorials/${FEATURED.slug}`} size="lg" className="group mt-6 w-full sm:hidden">
            <Play className="size-4 fill-current" strokeWidth={0} aria-hidden />
            Start with tutorial {FEATURED.id}
          </ButtonLink>
        </div>
      </Container>
      <Featured />
    </section>
  );
}

/** Tutorial 1.1 on stage: its lower half rests on the ink band that carries on into "Start here" (the home hero's layout). */
function Featured() {
  const t = FEATURED;
  return (
    <div className="relative z-10 mt-10 sm:mt-16">
      <div aria-hidden className="absolute inset-x-0 bottom-0 top-[45%] -z-10 bg-ink-surface" />
      <Container>
        <figure className="mx-auto max-w-5xl" aria-labelledby="featured-title">
          <div className="rounded-[20px] border border-line bg-surface p-1.5 shadow-overlay sm:p-2">
            {t.film ? (
              <TutorialPlayer tutorial={t} preload="none" priority />
            ) : (
              <Link to={`/tutorials/${t.slug}`} className="group block overflow-hidden rounded-xl">
                <TutorialCover tutorial={t} size="hero" priority />
              </Link>
            )}
          </div>
          <figcaption className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-on-ink">
                Tutorial {t.id} · {t.series.title} · {t.film ? clock(t.film.durationSeconds) : minutesLabel(t.minutes)}
              </p>
              <p id="featured-title" className="mt-2 font-display text-xl font-semibold tracking-[-0.01em] text-on-ink sm:text-2xl">
                {t.title}
              </p>
              <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-on-ink-2">{t.summary}</p>
            </div>
            <Link
              to={`/tutorials/${t.slug}`}
              className="mk-tap group inline-flex shrink-0 items-center gap-1.5 text-[15px] font-medium text-accent-on-ink transition-colors duration-150 ease-brand hover:text-on-ink"
            >
              Chapters and written steps
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
            </Link>
          </figcaption>
        </figure>
      </Container>
    </div>
  );
}

/** Series 1 as a numbered path on ink: the order to watch it in, each step a link. */
function StartHere() {
  const list = seriesTutorials(START);
  return (
    <Section tone="ink" spacing="none" className="pb-20 pt-16 sm:pb-28 sm:pt-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-t border-line-on-ink pt-14 sm:pt-16">
        <SectionHeading
          eyebrow="Start here"
          title={`${START.title}, in ${list.length} short steps.`}
          lead={`${START.summary} About ${minutesLabel(seriesMinutes(START))} from the first click to your first weekly check.`}
        />
        <Reveal>
          <ButtonLink to={`/tutorials/${list[0].slug}`} size="lg" className="group">
            <Play className="size-4 fill-current" strokeWidth={0} aria-hidden />
            Start with {list[0].id}
          </ButtonLink>
        </Reveal>
      </div>
      <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line-on-ink bg-line-on-ink sm:grid-cols-2 md:grid-cols-3">
        {list.map((t, i) => (
          <li key={t.slug} className="flex bg-ink-surface">
            <Link to={`/tutorials/${t.slug}`} className="group flex w-full flex-col p-5 transition-colors duration-200 ease-brand hover:bg-on-ink/[0.05] focus-visible:bg-on-ink/[0.05] sm:p-6">
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex h-8 min-w-11 items-center justify-center rounded-full border px-2 font-mono text-[12.5px] font-medium tabular transition-colors duration-200',
                      i === 0 ? 'border-accent bg-accent text-accent-ink' : 'border-line-on-ink text-accent-on-ink group-hover:border-accent-on-ink',
                    )}
                  >
                    {t.id}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-on-ink-2">Step {i + 1}</span>
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[12px] text-on-ink-2 tabular">
                  <Clock className="size-3.5" aria-hidden />
                  {minutesLabel(tutorialMinutes(t))}
                </span>
              </span>
              <span className="mt-4 font-display text-[16.5px] font-semibold leading-snug tracking-[-0.01em] text-on-ink group-hover:text-accent-on-ink">{t.title}</span>
              <span className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-on-ink-2">{t.summary}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[12.5px] font-medium text-on-ink-2">
                {t.film ? (
                  <>
                    <Play className="size-3 fill-current text-accent-on-ink" strokeWidth={0} aria-hidden />
                    <span className="text-on-ink">Video ready</span>
                  </>
                ) : (
                  <>
                    <ListOrdered className="size-3.5" aria-hidden />
                    Written steps, video soon
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
        {/* two columns (sm) and an odd count would leave an empty cell: a link to the whole series fills it */}
        {list.length % 2 === 1 && list.length % 3 === 0 && (
          <li className="hidden bg-ink-surface sm:flex md:hidden">
            <Link
              to={`/tutorials?series=${START.id}`}
              className="group flex w-full items-center justify-center gap-1.5 p-5 text-[14px] font-medium text-accent-on-ink transition-colors duration-200 ease-brand hover:bg-on-ink/[0.05] hover:text-on-ink sm:p-6"
            >
              See the whole series
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
            </Link>
          </li>
        )}
      </ol>
    </Section>
  );
}

/* ------------------------------------------------------------------------------------------------------------------------------ */

/** A pill-shaped radio (keyboard: Tab into the group, arrows move): checked = blue tint, never colour alone (the tick). */
function Pill({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="relative inline-flex cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors duration-150 ease-brand peer-focus-visible:shadow-[var(--ring)]',
          checked ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={2.75} aria-hidden />}
        {children}
      </span>
    </label>
  );
}

function PillGroup({ legend, name, value, options, onChange }: { legend: string; name: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Pill key={o.value || 'all'} name={name} checked={value === o.value} onChange={() => onChange(o.value)}>
            {o.label}
          </Pill>
        ))}
      </div>
    </fieldset>
  );
}

const levelOptions = [{ value: '', label: 'All levels' }, ...levels.map((l) => ({ value: l, label: l }))];
const audienceOptions = [{ value: '', label: 'Everyone' }, ...AUDIENCES.map((a) => ({ value: a, label: audienceLabel[a] }))];
/** the toolbar menus show only their value, so it says what it filters */
const audienceMenu = [{ value: '', label: 'For everyone' }, ...AUDIENCES.map((a) => ({ value: a, label: `For ${audienceLabel[a].toLowerCase()}` }))];

/** every tutorial has its video: no "Videos ready" toggle, no count of what is still to come */
const allFilmed = filmCount >= tutorialCount;

/** "Videos ready": a toggle (aria-pressed) that keeps only the tutorials whose video plays today. Off by default. */
function ReadyToggle({ on, onChange, className }: { on: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors duration-150 ease-brand',
        on ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
        className,
      )}
    >
      {on ? <Check className="size-3.5" strokeWidth={2.75} aria-hidden /> : <Play className="size-3 fill-current text-accent-text" strokeWidth={0} aria-hidden />}
      Videos ready
      <span className={cn('font-mono text-[12px] tabular', on ? 'text-accent-text' : 'text-ink-3')}>{filmCount}</span>
    </button>
  );
}

/** A native menu in the toolbar (keyboard and screen readers get the platform's own control); a choice other than "all" is tinted. */
function Menu({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 appearance-none rounded-full border pl-3.5 pr-9 text-[13.5px] font-medium outline-none transition-colors duration-150 ease-brand focus-visible:shadow-[var(--ring)]',
          value ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
        )}
      >
        {options.map((o) => (
          <option key={o.value || 'all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className={cn('pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2', value ? 'text-accent-text' : 'text-ink-3')} aria-hidden />
    </div>
  );
}

/** Wide screens: the course index as a sticky column, the series only (a filter, with counts); level and audience sit in the toolbar. */
function Sidebar({ filters, setFilters, counts }: { filters: Filters; setFilters: (p: Partial<Filters>) => void; counts: Map<string, number> }) {
  const others = { ...filters, series: '' };
  const total = tutorials.filter((t) => matches(t, others)).length;
  const row = (active: boolean) =>
    cn(
      'flex min-h-9 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-[13.5px] transition-colors duration-150 ease-brand peer-focus-visible:shadow-[var(--ring)]',
      active ? 'bg-accent-soft font-medium text-accent-text' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
    );
  return (
    <aside aria-label="Filter the tutorials by series" className="hidden lg:block">
      <div className="sticky top-[96px]">
        <fieldset>
          <legend className="mb-2 px-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Series</legend>
          <ul className="space-y-0.5">
            <li>
              <label className="relative block cursor-pointer">
                <input type="radio" name="series-d" checked={!filters.series} onChange={() => setFilters({ series: '' })} className="peer sr-only" />
                <span className={row(!filters.series)}>
                  <span className="w-6 font-mono text-[11.5px] text-ink-3 tabular" aria-hidden>
                    All
                  </span>
                  <span className="min-w-0 flex-1">All series</span>
                  <span className="font-mono text-[11.5px] tabular">{total}</span>
                </span>
              </label>
            </li>
            {tutorialSeries.map((s) => {
              const on = filters.series === s.id;
              const n = counts.get(s.id) ?? 0;
              return (
                <li key={s.id}>
                  <label className="relative block cursor-pointer">
                    <input type="radio" name="series-d" checked={on} onChange={() => setFilters({ series: s.id })} className="peer sr-only" />
                    <span className={cn(row(on), !n && !on && 'opacity-55')}>
                      <span className={cn('w-6 font-mono text-[11.5px] tabular', on ? 'text-accent-text' : 'text-ink-3')} aria-hidden>
                        {s.id.padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">{s.title}</span>
                      <span className="font-mono text-[11.5px] tabular">{n}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      </div>
    </aside>
  );
}

/** Phones and tablets: the same filters above the list, the series as a native select (11 rows would push the cards away). */
function CompactFilters({ filters, setFilters }: { filters: Filters; setFilters: (p: Partial<Filters>) => void }) {
  const id = useId();
  const on = [filters.series, filters.level, filters.audience].filter(Boolean).length;
  return (
    <details className="group rounded-2xl border border-line bg-surface shadow-card lg:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2.5">
          <SlidersHorizontal className="size-4 text-accent-text" aria-hidden />
          Filter the tutorials
          {on > 0 && <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent font-mono text-[11px] text-accent-ink">{on}</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="space-y-5 border-t border-line p-4 sm:p-5">
        <div>
          <label htmlFor={id} className="mb-2.5 block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
            Series
          </label>
          <div className="relative">
            <select
              id={id}
              value={filters.series}
              onChange={(e) => setFilters({ series: e.target.value })}
              className="h-11 w-full appearance-none rounded-lg border border-line-strong bg-surface pl-3 pr-10 text-[15px] text-ink outline-none focus-visible:border-accent"
            >
              <option value="">All series</option>
              {tutorialSeries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}. {s.title}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          </div>
        </div>
        <PillGroup legend="Level" name="level-m" value={filters.level} options={levelOptions} onChange={(v) => setFilters({ level: v as TutorialLevel | '' })} />
        <PillGroup legend="Who it is for" name="for-m" value={filters.audience} options={audienceOptions} onChange={(v) => setFilters({ audience: v as TutorialAudience | '' })} />
      </div>
    </details>
  );
}

/** Below this many cards a series shows in full on phones and tablets; above it, the first ones and "Show all". */
const PREVIEW = 3;

function SeriesBlock({ series: s, shown, full }: { series: TutorialSeries; shown: Tutorial[]; full: boolean }) {
  const all = seriesTutorials(s);
  const ready = all.filter((t) => t.film).length;
  const titleId = `series-${s.id}-title`;
  const listId = `series-${s.id}-list`;
  const [open, setOpen] = useState(false);
  const fold = !full && shown.length > PREVIEW + 1; // never "Show all" for a single hidden card
  return (
    <section id={`series-${s.id}`} aria-labelledby={titleId} className="scroll-mt-24">
      <div className="flex min-w-0 gap-4 border-b border-line pb-6 sm:gap-5">
        <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface font-mono text-[15px] font-medium text-accent-text shadow-card tabular">
          {s.id.padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <h3 id={titleId} className="font-display text-[1.375rem] font-semibold leading-tight tracking-[-0.01em] text-ink text-balance sm:text-2xl">
            <span className="sr-only">Series {s.id}: </span>
            {s.title}
          </h3>
          <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-ink-2">{s.summary}</p>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-ink-3 tabular">
            <span className="whitespace-nowrap">
              {shown.length === all.length ? plural(all.length, 'tutorial') : `${shown.length} of ${all.length} tutorials`} · {minutesLabel(seriesMinutes(s))}
            </span>
            {ready > 0 && (
              <>
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
                <span className="inline-flex w-full items-center gap-1 text-accent-text sm:w-auto">
                  <Play className="size-2.5 fill-current" strokeWidth={0} aria-hidden />
                  {plural(ready, 'video')} ready
                </span>
              </>
            )}
            <span aria-hidden className="hidden sm:inline">
              ·
            </span>
            <Link
              to={`/tutorials/${all[0].slug}`}
              className="mk-tap group inline-flex w-full items-center gap-1 pt-1 font-sans text-[13px] font-medium text-accent-text hover:text-accent-hover sm:w-auto sm:pt-0"
            >
              Start this series
              <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </p>
        </div>
      </div>
      <ul id={listId} className="mt-6 grid gap-4 xl:grid-cols-2">
        {shown.map((t, i) => (
          <li key={t.slug} className={cn(fold && !open && i >= PREVIEW && 'max-lg:hidden')}>
            <TutorialCard tutorial={t} headingLevel="h4" />
          </li>
        ))}
      </ul>
      {fold && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-medium text-ink shadow-card transition-colors duration-150 ease-brand hover:border-accent hover:text-accent-text lg:hidden"
        >
          {open ? `Show fewer in ${s.title}` : `Show all ${shown.length} in ${s.title}`}
          <ChevronDown className={cn('size-4 text-ink-3 transition-transform duration-200 ease-brand motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
        </button>
      )}
    </section>
  );
}

function Library({ filters, setFilters }: { filters: Filters; setFilters: (p: Partial<Filters>) => void }) {
  const q = useDeferredValue(filters.q);
  const f = { ...filters, q };
  const shown = useMemo(() => tutorials.filter((t) => matches(t, f)), [f.q, f.series, f.level, f.audience, f.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tutorials) if (matches(t, { ...f, series: '' })) m.set(t.series.id, (m.get(t.series.id) ?? 0) + 1);
    return m;
  }, [f.q, f.level, f.audience, f.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // a chip per filter that is on, where its own control is out of sight: the search always, series / level / audience below lg (on
  // wide screens the column and the toolbar show them); "Videos ready" never (its toggle is always beside the count)
  const active: { label: string; clear: Partial<Filters>; chip: 'all' | 'narrow' | 'none' }[] = [
    ...(filters.q.trim() ? [{ label: `"${filters.q.trim()}"`, clear: { q: '' }, chip: 'all' as const }] : []),
    ...(filters.series ? [{ label: `Series ${filters.series}`, clear: { series: '' }, chip: 'narrow' as const }] : []),
    ...(filters.level ? [{ label: filters.level, clear: { level: '' as const }, chip: 'narrow' as const }] : []),
    ...(filters.audience ? [{ label: audienceLabel[filters.audience], clear: { audience: '' as const }, chip: 'narrow' as const }] : []),
    ...(filters.ready ? [{ label: 'Videos ready', clear: { ready: false }, chip: 'none' as const }] : []),
  ];
  const clearAll = () => setFilters({ q: '', series: '', level: '', audience: '', ready: false });
  const query = filters.q.trim();
  return (
    <div id="library" tabIndex={-1} className="scroll-mt-16 outline-none focus-visible:shadow-none lg:scroll-mt-[72px]">
      <Section tone="page" spacing="md">
        <SectionHeading
          eyebrow="The whole course"
          title={`Every tutorial, in ${seriesCount} series.`}
          lead={
            query
              ? `Results for "${query}".`
              : allFilmed
                ? 'Watch a series from the start, or pick the one job you need today. Every tutorial is a short video with its steps written out under it.'
                : 'Watch a series from the start, or pick the one job you need today. Every tutorial has its steps written out; the ones with a picture have their video ready.'
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          <Sidebar filters={filters} setFilters={setFilters} counts={counts} />
          <div id="results" tabIndex={-1} className="min-w-0 scroll-mt-28 outline-none focus-visible:shadow-none">
            <CompactFilters filters={filters} setFilters={setFilters} />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-line lg:mt-0 lg:border-b lg:pb-5">
              <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <p role="status" className="text-[14px] text-ink-2">
                  {active.length ? (
                    <>
                      <span className="font-medium text-ink">{plural(shown.length, 'tutorial')}</span> match
                    </>
                  ) : (
                    <>
                      All <span className="font-medium text-ink">{plural(shown.length, 'tutorial')}</span>, in course order
                    </>
                  )}
                </p>
                {active
                  .filter((a) => a.chip !== 'none')
                  .map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => setFilters(a.clear)}
                      className={cn(a.chip === 'narrow' && 'lg:hidden', 'mk-tap inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface pl-3 pr-2 text-[13px] text-ink transition-colors duration-150 hover:border-accent hover:text-accent-text')}
                      aria-label={`Remove the filter ${a.label}`}
                    >
                      {a.label}
                      <X className="size-3.5 text-ink-3" aria-hidden />
                    </button>
                  ))}
                {active.length > 1 && (
                  <button type="button" onClick={clearAll} className="mk-tap text-[13px] font-medium text-accent-text hover:text-accent-hover">
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!allFilmed && <ReadyToggle on={filters.ready} onChange={(ready) => setFilters({ ready })} />}
                <div className="hidden items-center gap-2 lg:flex">
                  <Menu label="Level" value={filters.level} options={levelOptions} onChange={(v) => setFilters({ level: v as TutorialLevel | '' })} />
                  <Menu label="Who it is for" value={filters.audience} options={audienceMenu} onChange={(v) => setFilters({ audience: v as TutorialAudience | '' })} />
                </div>
              </div>
            </div>
            {shown.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
                <Search className="mx-auto size-6 text-ink-3" aria-hidden />
                <p className="mt-4 font-display text-lg font-semibold text-ink">No tutorial matches these filters</p>
                <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-2">Try a shorter word, or another level or series. Every tutorial is listed again when you clear the filters.</p>
                <button type="button" onClick={clearAll} className="mt-6 inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-4 text-[14px] font-medium text-ink shadow-card hover:bg-surface-2">
                  Clear the filters
                </button>
              </div>
            ) : (
              <div className="mt-8 space-y-16 sm:space-y-20">
                {tutorialSeries.map((s) => {
                  const list = shown.filter((t) => t.series === s);
                  return list.length ? <SeriesBlock key={s.id} series={s} shown={list} full={filtering(f)} /> : null;
                })}
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------------------------ */

function QuickTips() {
  return (
    <Section tone="surface" bordered>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <SectionHeading eyebrow="Quick tips" title="Short answers to everyday questions." lead="Small things you do now and then, each in a short video of its own. They are being made now and appear here as they are ready." />
        <div className="self-start overflow-hidden rounded-xl border border-line bg-surface">
          <p className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-2">
              <Clock className="size-3" aria-hidden />
              Planned
            </span>
            {plural(quickTips.length, 'quick tip')}, not filmed yet
          </p>
          <ul aria-label="Planned quick tips" className="grid gap-px bg-line sm:grid-cols-2">
            {quickTips.map((tip) => (
              <li key={tip} className="bg-surface px-4 py-3 text-[14px] leading-snug text-ink-2">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Questions() {
  return (
    <Section tone="page">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div>
          <SectionHeading eyebrow="FAQ" title="About the tutorials." lead="Something else on your mind? Write to us and a person will answer." />
          <Reveal className="mt-8">
            <ArrowLink to="/contact?topic=support">Ask us a question</ArrowLink>
          </Reveal>
        </div>
        <Faq items={FAQS} />
      </div>
    </Section>
  );
}

export default function TutorialsPage() {
  useSeo({
    title: 'Tutorials: learn Alaventra in short videos',
    description: `Short tutorials that show how to set up Alaventra and use it, one job at a time, from creating your account to your weekly report: ${tutorialCount} in ${seriesCount} series, each with its steps written out${allFilmed ? '' : `, ${filmCount} with their video ready`}.`,
    path: '/tutorials',
  });
  const [filters, setFilters] = useFilters();
  const searchCount = useMemo(() => tutorials.filter((t) => matchesQuery(t, filters.q)).length, [filters.q]);
  return (
    <>
      <Hero filters={filters} setFilters={setFilters} count={searchCount} />
      <StartHere />
      <Library filters={filters} setFilters={setFilters} />
      <QuickTips />
      <Questions />
      <CtaBand title="Ready to try it on your own website?" lead="Setting up takes a few minutes, and the first tutorials walk you through it. You see the price of every run in credits before it starts, and nothing goes live without your OK." />
    </>
  );
}

