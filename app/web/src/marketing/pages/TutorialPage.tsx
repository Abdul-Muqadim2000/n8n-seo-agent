import { Fragment, useCallback, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Captions, ChartNoAxesColumnIncreasing, Check, ChevronDown, Clock, Lightbulb, MapPin, Play, ScrollText, Users } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Container, CtaBand, Eyebrow, MarketingNotFound } from '../components';
import { Breadcrumbs, JsonLd } from '../components/platform/kit';
import { LevelTag } from '../components/tutorials/TutorialCard';
import { activeChapter, ChapterList, TutorialPlayer, type PlayerControls } from '../components/tutorials/TutorialPlayer';
import {
  audienceSentence,
  clock,
  courseNeighbours,
  coverSet,
  filmTips,
  isoDuration,
  levelNote,
  minutesLabel,
  seriesMinutes,
  seriesTutorials,
  stepCount,
  tutorialBySlug,
  tutorialCount,
  tutorialMinutes,
  tutorialVideoBase,
  tutorialVideoBaseSet,
  whereInApp,
  type Tutorial,
} from '../content/tutorials';
import { useSeo } from '../useSeo';

/** schema.org VideoObject for a finished film, with a Clip per chapter (search engines show them as key moments) */
function videoSchema(t: Tutorial) {
  const film = t.film!;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const page = `${origin}/tutorials/${t.slug}`;
  const base = tutorialVideoBase.startsWith('/') ? origin + tutorialVideoBase : tutorialVideoBase;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `Tutorial ${t.id}: ${t.title}`,
    description: t.summary,
    thumbnailUrl: [`${origin}${film.cover}`, `${origin}${coverSet(film).src2x}`],
    uploadDate: film.published,
    duration: isoDuration(film.durationSeconds),
    inLanguage: 'en',
    ...(tutorialVideoBaseSet ? { contentUrl: `${base}/${t.slug}.mp4` } : {}),
    url: page,
    hasPart: film.chapters.map((c, i) => ({
      '@type': 'Clip',
      name: c.title,
      startOffset: c.start,
      endOffset: film.chapters[i + 1]?.start ?? film.durationSeconds,
      url: `${page}?t=${c.start}`,
    })),
  };
}

function MetaItem({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-2">
      <Icon className="size-4 text-ink-3" aria-hidden />
      {children}
    </li>
  );
}

/** Where the film will be: a slim note, then the written steps straight away (they do the job today), never an empty player. */
function ComingSoon() {
  return (
    <p role="note" className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink-2 shadow-card">
      <Clock className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
      <span>
        <span className="font-medium text-ink">The video is on its way.</span> Follow the written steps below; they work today.
      </span>
    </p>
  );
}

/** The written how-to: the tutorial's steps as a numbered rail (searchable, readable without the video). */
function Steps({ tutorial: t }: { tutorial: Tutorial }) {
  return (
    <section id="steps" aria-labelledby="steps-title" className="scroll-mt-24">
      <Eyebrow>Written steps</Eyebrow>
      <h2 id="steps-title" className="mt-3 font-display text-[1.625rem] font-semibold tracking-[-0.01em] text-ink sm:text-[1.875rem]">
        Step by step
      </h2>
      <ol className="mt-7">
        {t.chapters.map((step, i) => {
          const last = i === t.chapters.length - 1;
          return (
            <li key={step} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-4 pb-6 last:pb-0 sm:gap-x-5">
              {!last && <span aria-hidden className="absolute left-5 top-10 h-[calc(100%-2.5rem)] w-px -translate-x-1/2 bg-line-strong" />}
              <span className="relative z-10 inline-flex size-10 items-center justify-center rounded-full border border-accent bg-surface font-mono text-[13px] font-medium text-accent-text shadow-card tabular">
                {i + 1}
              </span>
              <div className="min-w-0 rounded-xl border border-line bg-surface px-4 py-3 shadow-card sm:px-5 sm:py-3.5">
                <p className="text-[15.5px] leading-relaxed text-ink">{step}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {t.film && filmTips(t.film).length > 0 && (
        <ul className="mt-6 space-y-2 pl-14 sm:pl-[60px]">
          {filmTips(t.film).map((tip) => (
            <li key={tip.start} className="flex items-start gap-2.5 rounded-xl border border-dashed border-line-strong px-4 py-3 text-[14px] leading-relaxed text-ink-2">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
              <span>
                <span className="font-medium text-ink">Tip from the video:</span> {tip.title}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 flex items-center gap-2 pl-14 text-[13.5px] text-ink-2 sm:pl-[60px]">
        <Check className="size-4 text-accent-text" strokeWidth={2.5} aria-hidden />
        Done. {courseNeighbours(t).next ? 'The next tutorial picks up from here.' : 'That is the end of the course.'}
      </p>
    </section>
  );
}

function HelpsWith({ tutorial: t }: { tutorial: Tutorial }) {
  const where = whereInApp(t.start);
  const items = [
    { icon: Users, term: 'Good for', body: audienceSentence(t.audience) },
    { icon: ChartNoAxesColumnIncreasing, term: 'Level', body: `${t.level}. ${levelNote[t.level]}.` },
    { icon: Clock, term: 'Time', body: `${minutesLabel(tutorialMinutes(t))} to watch, ${plural(t.chapters.length, 'step')} to follow` },
    ...(where ? [{ icon: MapPin, term: 'Where in Alaventra', body: where }] : []),
  ];
  return (
    <section aria-labelledby="helps-title">
      <Eyebrow>What it helps with</Eyebrow>
      <h2 id="helps-title" className="mt-3 max-w-2xl font-display text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-ink text-balance sm:text-[1.625rem]">
        Before you start
      </h2>
      <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        {items.map(({ icon: Icon, term, body }) => (
          <div key={term} className="flex gap-3.5 bg-surface p-5">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{term}</dt>
              <dd className="mt-1 text-[14.5px] leading-relaxed text-ink">{body}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** Previous / next in the whole course (across series); the ends lead back to the course. */
function CourseNav({ tutorial: t }: { tutorial: Tutorial }) {
  const { prev, next } = courseNeighbours(t);
  const card =
    'group flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-200 ease-brand hover:-translate-y-0.5 hover:border-accent hover:shadow-raised motion-reduce:hover:translate-y-0 sm:p-6';
  const label = 'inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3';
  return (
    <nav aria-label="Course" className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      {prev ? (
        <Link to={`/tutorials/${prev.slug}`} rel="prev" className={card}>
          <span className={label}>
            <ArrowLeft className="size-3.5 transition-transform duration-200 ease-brand group-hover:-translate-x-1" aria-hidden />
            Previous · {prev.id}
          </span>
          <span className="line-clamp-2 font-display text-base font-semibold text-ink group-hover:text-accent-text">{prev.title}</span>
        </Link>
      ) : (
        <Link to="/tutorials" className={card}>
          <span className={label}>
            <ArrowLeft className="size-3.5 transition-transform duration-200 ease-brand group-hover:-translate-x-1" aria-hidden />
            The course
          </span>
          <span className="font-display text-base font-semibold text-ink group-hover:text-accent-text">All {tutorialCount} tutorials</span>
        </Link>
      )}
      {next ? (
        <Link to={`/tutorials/${next.slug}`} rel="next" className={cn(card, 'sm:items-end sm:text-right')}>
          <span className={label}>
            Next · {next.id}
            <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
          </span>
          <span className="line-clamp-2 font-display text-base font-semibold text-ink group-hover:text-accent-text">{next.title}</span>
        </Link>
      ) : (
        <Link to="/tutorials" className={cn(card, 'sm:items-end sm:text-right')}>
          <span className={label}>
            The course
            <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
          </span>
          <span className="font-display text-base font-semibold text-ink group-hover:text-accent-text">All {tutorialCount} tutorials</span>
        </Link>
      )}
    </nav>
  );
}

/** Beside the tutorial: the rest of its series, with where you are, then a way to do it on your own website. */
function SeriesPanel({ tutorial: t }: { tutorial: Tutorial }) {
  const list = seriesTutorials(t.series);
  const signedIn = !!useMe().data;
  return (
    <div className="space-y-4 lg:sticky lg:top-[96px]">
      <nav aria-label={`Series ${t.series.id}: ${t.series.title}`} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 pb-4 pt-5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text">Series {t.series.id}</p>
          <p className="mt-1 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{t.series.title}</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Tutorial {t.position} of {list.length} · {minutesLabel(seriesMinutes(t.series))} in all
          </p>
          <div aria-hidden className="mt-3.5 flex gap-1">
            {list.map((x) => (
              <span key={x.slug} className={cn('h-1.5 flex-1 rounded-full', x.position < t.position ? 'bg-accent/45' : x === t ? 'bg-accent' : 'bg-surface-3')} />
            ))}
          </div>
        </div>
        <ol className="p-1.5 lg:max-h-[min(52vh,560px)] lg:overflow-y-auto lg:overscroll-contain">
          {list.map((x) => {
            const here = x.slug === t.slug;
            return (
              <li key={x.slug}>
                <Link
                  to={`/tutorials/${x.slug}`}
                  aria-current={here ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-11 items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 ease-brand',
                    here ? 'bg-accent-soft' : 'hover:bg-surface-2',
                  )}
                >
                  <span className={cn('mt-px w-8 shrink-0 font-mono text-[12px] font-medium tabular', here ? 'text-accent-text' : 'text-ink-3')}>{x.id}</span>
                  <span className={cn('min-w-0 flex-1 text-[13.5px] leading-snug', here ? 'font-medium text-accent-text' : 'text-ink group-hover:text-accent-text')}>{x.title}</span>
                  <span className="mt-px inline-flex shrink-0 items-center gap-1 font-mono text-[11.5px] text-ink-3 tabular">
                    {x.film && (
                      <>
                        <Play className="size-2.5 fill-current text-accent-text" strokeWidth={0} aria-hidden />
                        <span className="sr-only">Video, </span>
                      </>
                    )}
                    {minutesLabel(tutorialMinutes(x))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-line px-5 py-3.5">
          <Link to={`/tutorials?series=${t.series.id}`} className="mk-tap group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-text hover:text-accent-hover">
            All tutorials
            <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </nav>
      <div className="relative isolate overflow-hidden rounded-2xl bg-ink-surface p-5 text-on-ink">
        <span aria-hidden className="mk-watermark pointer-events-none absolute -bottom-10 -right-8 -z-10 aspect-[911/797] w-40 bg-on-ink/[0.07]" />
        <p className="font-display text-[17px] font-semibold leading-snug">{signedIn ? 'Try it in your workspace.' : 'Do it on your own website.'}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-on-ink-2">
          {signedIn ? 'Open Alaventra and follow the steps as you watch.' : 'Free to set up. The price of every run in credits is shown before it starts.'}
        </p>
        <ButtonLink to={signedIn ? '/' : '/signup'} className="group mt-4 h-10 w-full">
          {signedIn ? 'Open app' : 'Start free'}
          <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
        </ButtonLink>
      </div>
    </div>
  );
}

/** The narration to read (for people who cannot hear it or would rather read), one paragraph per chapter, closed by default. */
function Transcript({ tutorial: t }: { tutorial: Tutorial }) {
  const film = t.film!;
  const paras = film.transcript ?? [];
  if (!paras.some(Boolean)) return null;
  return (
    <details className="group mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2.5 font-display text-[15px] font-semibold text-ink">
          <ScrollText className="size-4 text-accent-text" aria-hidden />
          Read the transcript
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="space-y-5 border-t border-line px-4 py-5 sm:px-5">
        {film.chapters.map((c, i) =>
          paras[i] ? (
            <div key={c.start}>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
                <span className="tabular">{clock(c.start)}</span> · {c.title}
              </p>
              <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-ink">{paras[i]}</p>
            </div>
          ) : null,
        )}
      </div>
    </details>
  );
}

function TutorialView({ tutorial: t }: { tutorial: Tutorial }) {
  const [params] = useSearchParams();
  const startAt = Math.max(0, Math.min(Number(params.get('t')) || 0, (t.film?.durationSeconds ?? 1) - 1));
  const controls = useRef<PlayerControls>(null);
  const [time, setTime] = useState<number | null>(startAt || null);
  const onTime = useCallback((s: number) => setTime(s), []);
  const film = t.film;
  const chapter = film && time !== null ? activeChapter(film.chapters, time) : -1;
  return (
    <>
      <section className="relative isolate overflow-hidden bg-page">
        <Container className="pb-20 pt-8 sm:pb-28 sm:pt-10">
          <Breadcrumbs
            items={[
              { label: 'Tutorials', to: '/tutorials' },
              { label: t.series.title, to: `/tutorials?series=${t.series.id}` },
              { label: t.title, to: `/tutorials/${t.slug}` },
            ]}
          />
          <div className="mt-8 grid grid-cols-1 gap-12 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-14">
            <div className="min-w-0">
              <header className="max-w-3xl">
                <Eyebrow>
                  Tutorial {t.id} · {t.series.title}
                </Eyebrow>
                <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.02em] text-balance text-ink sm:text-5xl lg:text-[3.25rem]">{t.title}</h1>
                <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-ink-2">{t.summary}</p>
                <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2.5">
                  <MetaItem icon={Clock}>
                    <span className="font-mono tabular">{film ? clock(film.durationSeconds) : minutesLabel(t.minutes)}</span>
                  </MetaItem>
                  <li>
                    <LevelTag level={t.level} className="text-[13.5px] text-ink-2" />
                  </li>
                  <MetaItem icon={Users}>{audienceSentence(t.audience)}</MetaItem>
                  {film && <MetaItem icon={Captions}>Subtitles in the video</MetaItem>}
                </ul>
              </header>

              <div className={film ? 'mt-9' : 'mt-8'}>
                {film ? (
                  <div className="rounded-[20px] border border-line bg-surface p-1.5 shadow-raised sm:p-2">
                    <TutorialPlayer key={t.slug} tutorial={t} controls={controls} onTime={onTime} startAt={startAt} priority />
                  </div>
                ) : (
                  <ComingSoon />
                )}
              </div>

              {film && film.chapters.length > 0 && (
                <section aria-labelledby="chapters-title" className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                    <h2 id="chapters-title" className="font-display text-[15px] font-semibold text-ink">
                      In this video
                    </h2>
                    <span className="font-mono text-[11.5px] text-ink-3 tabular">
                      {plural(stepCount(t), 'step')} · {clock(film.durationSeconds)}
                    </span>
                  </div>
                  <ChapterList chapters={film.chapters} duration={film.durationSeconds} active={chapter} onSeek={(s) => controls.current?.seek(s)} />
                </section>
              )}
              {film && <Transcript tutorial={t} />}

              <div className={cn('space-y-16 sm:space-y-20', film ? 'mt-16 sm:mt-20' : 'mt-10 sm:mt-12')}>
                <Steps tutorial={t} />
                <HelpsWith tutorial={t} />
                <CourseNav tutorial={t} />
              </div>
            </div>
            <aside className="min-w-0">
              <SeriesPanel tutorial={t} />
            </aside>
          </div>
        </Container>
        {film && <JsonLd data={videoSchema(t)} />}
      </section>
      <CtaBand title="Put it to work on your own website." />
    </>
  );
}

export default function TutorialPage() {
  const { slug } = useParams();
  const t = tutorialBySlug(slug);
  useSeo({
    title: t ? `Tutorial ${t.id}: ${t.title}` : 'Page not found',
    description: t
      ? `${t.summary} ${t.film ? 'Watch it in' : 'Read it in'} ${minutesLabel(tutorialMinutes(t))}, with ${plural(t.chapters.length, 'step')} written out. Series ${t.series.id} of the Alaventra course: ${t.series.title}.`
      : 'The page you opened does not exist.',
    path: `/tutorials/${slug ?? ''}`,
  });
  if (!t) return <MarketingNotFound />;
  return (
    // keyed by slug: the next tutorial starts fresh (player, chapter, scroll)
    <Fragment key={t.slug}>
      <TutorialView tutorial={t} />
    </Fragment>
  );
}
