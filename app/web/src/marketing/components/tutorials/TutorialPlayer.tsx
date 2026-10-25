import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ListOrdered, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clock, coverSet, videoUrl, webmUrl, type Tutorial, type TutorialChapter } from '../../content/tutorials';

export interface PlayerControls {
  /** jump to a moment of the film and play from there (a click on a chapter is the user's gesture, so play() is allowed) */
  seek: (seconds: number) => void;
}

/**
 * The film of a finished tutorial, 16:9 with its cover as the poster. Before the first play a large play button covers the picture
 * (one obvious action, its name says what plays and for how long); after that the browser's own controls take over, so keyboard and
 * screen-reader use is the platform's. Sources: the VP9 WebM first when there is one (browsers without H.264), then the MP4; only the
 * last one failing counts as "did not load". Captions: a WebVTT track people can turn on, off by default because the subtitles are
 * already part of the picture (the tutorial page also has the transcript to read). When there is nowhere to play the film from, or it fails to load, the cover stays with a plain note;
 * the steps under the player still do the job.
 */
export function TutorialPlayer({
  tutorial: t,
  controls,
  onTime,
  startAt = 0,
  preload = 'metadata',
  priority = false,
  className,
}: {
  tutorial: Tutorial;
  controls?: Ref<PlayerControls>;
  /** the playback position, about four times a second while it plays */
  onTime?: (seconds: number) => void;
  /** seconds to start from (a shared link to a chapter, ?t=24) */
  startAt?: number;
  preload?: 'none' | 'metadata';
  priority?: boolean;
  className?: string;
}) {
  const film = t.film!;
  const src = videoUrl(t);
  const webm = webmUrl(t);
  const cover = coverSet(film);
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const play = useCallback((from?: number) => {
    const v = video.current;
    if (!v) return;
    if (from !== undefined) {
      try {
        v.currentTime = from;
      } catch {
        // metadata not loaded yet: the browser seeks once it is
      }
    }
    setStarted(true);
    void v.play().catch(() => {
      // a refused autoplay or a load error: the controls are visible now, and onError handles a broken file
    });
    v.focus({ preventScroll: true });
  }, []);

  useImperativeHandle(controls, () => ({ seek: (s: number) => play(s) }), [play]);

  // a link to a chapter (?t=) starts there once the length is known
  useEffect(() => {
    const v = video.current;
    if (!v || !startAt) return;
    const go = () => {
      if (v.currentTime < 0.5) v.currentTime = Math.min(startAt, Math.max(0, film.durationSeconds - 1));
      onTime?.(v.currentTime);
    };
    if (v.readyState >= 1) go();
    else v.addEventListener('loadedmetadata', go, { once: true });
    return () => v.removeEventListener('loadedmetadata', go);
  }, [startAt, film.durationSeconds, onTime, attempt]);

  const label = `Tutorial ${t.id}: ${t.title}`;
  const frame = cn('relative aspect-video w-full overflow-hidden rounded-xl bg-ink-surface', className);

  if (!src || failed)
    return (
      <div className={frame}>
        <img src={cover.src} srcSet={cover.srcSet} sizes="(min-width: 1024px) 1000px, 100vw" alt="" className="size-full object-cover opacity-60 dark:opacity-50" loading={priority ? 'eager' : 'lazy'} decoding="async" />
        <div className="absolute inset-0 flex items-end p-4 sm:items-center sm:justify-center sm:p-8">
          <div role="status" className="max-w-md rounded-xl border border-line bg-surface p-4 text-left shadow-overlay sm:p-5 sm:text-center">
            <p className="font-display text-[15px] font-semibold text-ink">{failed ? 'This video did not load' : 'The video is not available here yet'}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
              Every step is written out below, so you can follow it without the video.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 sm:justify-center">
              <a href="#steps" className="mk-tap inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-text hover:text-accent-hover">
                <ListOrdered className="size-4" aria-hidden />
                Read the steps
              </a>
              {failed && (
                <button
                  type="button"
                  onClick={() => {
                    setFailed(false);
                    setStarted(false);
                    setAttempt((n) => n + 1);
                  }}
                  className="mk-tap inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-text hover:text-accent-hover"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className={frame}>
      <video
        key={attempt}
        ref={video}
        className="size-full bg-ink-surface outline-none"
        controls={started}
        playsInline
        preload={preload}
        poster={cover.src2x}
        aria-label={label}
        onError={() => setFailed(true)}
        onPlay={() => setStarted(true)}
        onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
        onSeeked={(e) => onTime?.(e.currentTarget.currentTime)}
      >
        {webm && <source src={webm} type='video/webm; codecs="vp9, opus"' />}
        <source src={src} type="video/mp4" onError={() => setFailed(true)} />
        <track kind="captions" src={film.captions} srcLang="en" label="English" />
      </video>
      {!started && (
        <button
          type="button"
          onClick={() => play(startAt || undefined)}
          className="group/play absolute inset-0 flex size-full cursor-pointer items-center justify-center rounded-xl text-left focus-visible:shadow-[inset_0_0_0_3px_var(--ring-color)]"
          aria-label={`Play ${label}, ${clock(film.durationSeconds)}${startAt ? `, from ${clock(startAt)}` : ''}`}
        >
          <img
            src={cover.src}
            srcSet={cover.srcSet}
            sizes="(min-width: 1024px) 1000px, 100vw"
            alt=""
            width={960}
            height={540}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-brand group-hover/play:scale-[1.015] motion-reduce:transition-none dark:brightness-[.78] dark:contrast-[1.05]"
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
          />
          <span aria-hidden className="relative inline-flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-overlay ring-[6px] ring-accent/15 transition-transform duration-200 ease-brand group-hover/play:scale-105 group-active/play:scale-95 motion-reduce:transition-none sm:size-16 sm:ring-8 lg:size-20">
            <Play className="size-5 translate-x-[2px] fill-current sm:size-7 lg:size-8" strokeWidth={0} />
          </span>
          <span aria-hidden className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-ink-surface/90 px-2 py-1 text-[11px] font-medium text-on-ink sm:bottom-4 sm:left-4 sm:gap-2 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[12px]">
            <Play className="size-3 fill-current" strokeWidth={0} />
            {startAt ? `Play from ${clock(startAt)}` : 'Play'}
            <span className="font-mono text-on-ink-2 tabular">{clock(film.durationSeconds)}</span>
          </span>
        </button>
      )}
    </div>
  );
}

/** the chapter playing at `time`: the last one that has started */
export function activeChapter(chapters: TutorialChapter[], time: number): number {
  let i = -1;
  chapters.forEach((c, k) => {
    if (time + 0.25 >= c.start) i = k;
  });
  return i;
}

/** The film's chapters as a list of buttons: a click plays from that moment; the one playing is marked. */
export function ChapterList({
  chapters,
  duration,
  active,
  onSeek,
  className,
}: {
  chapters: TutorialChapter[];
  duration: number;
  active: number;
  onSeek: (seconds: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn('divide-y divide-line', className)}>
      {chapters.map((c, i) => {
        const end = chapters[i + 1]?.start ?? duration;
        const on = i === active;
        return (
          <li key={`${c.start}-${c.title}`}>
            <button
              type="button"
              onClick={() => onSeek(c.start)}
              aria-current={on ? 'true' : undefined}
              aria-label={`${c.title}, at ${clock(c.start)}`}
              className={cn(
                'group relative flex min-h-12 w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 ease-brand sm:px-5',
                on ? 'bg-accent-soft' : 'hover:bg-surface-2',
              )}
            >
              <span aria-hidden className={cn('absolute inset-y-2 left-0 w-[3px] rounded-r-full transition-opacity duration-150', on ? 'bg-accent opacity-100' : 'opacity-0')} />
              <span
                className={cn(
                  'inline-flex h-7 min-w-[3.25rem] items-center justify-center rounded-md border font-mono text-[12px] font-medium tabular transition-colors duration-150',
                  on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-2 group-hover:border-accent group-hover:text-accent-text',
                )}
              >
                {clock(c.start)}
              </span>
              <span className={cn('min-w-0 flex-1 text-[14.5px] font-medium', on ? 'text-accent-text' : 'text-ink')}>{c.title}</span>
              <span className="shrink-0 font-mono text-[11.5px] text-ink-3 tabular" aria-hidden>
                {clock(end - c.start)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
