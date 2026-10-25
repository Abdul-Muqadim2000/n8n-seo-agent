import { Clock, ListChecks, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clock, coverSet, type Tutorial } from '../../content/tutorials';

/**
 * A tutorial's 16:9 picture. A finished film: on a card, the film's title block at twice the size, drawn on the light or the dark
 * page colour (two pictures, the theme shows one: the theme is a class, so `<picture media>` would not follow the switch), with its
 * length in the corner; as a hero, the film's own cover at 960 or 1920 px. No film yet: a drawn title card (hero only; the library
 * lists those tutorials as compact cards with no picture). Decorative next to the card's own title (alt=""), so a screen reader hears
 * each title once.
 */
export function TutorialCover({ tutorial: t, size = 'card', priority = false, className }: { tutorial: Tutorial; size?: 'card' | 'hero'; priority?: boolean; className?: string }) {
  if (t.film) {
    const c = coverSet(t.film);
    const img = 'size-full object-cover transition-transform duration-500 ease-brand group-hover:scale-[1.025] motion-reduce:transition-none';
    return (
      <div className={cn('relative aspect-video overflow-hidden bg-page', className)}>
        {size === 'card' ? (
          // the title picture sits on the page colour it was drawn on, inset a little so the title has air and the length chip room
          <span className="absolute inset-[5%]">
            <img src={c.card} alt="" width={960} height={540} loading={priority ? 'eager' : 'lazy'} decoding="async" className={cn(img, 'dark:hidden')} />
            <img src={c.cardDark} alt="" width={960} height={540} loading={priority ? 'eager' : 'lazy'} decoding="async" className={cn(img, 'hidden dark:block')} />
          </span>
        ) : (
          <img
            src={c.src}
            srcSet={c.srcSet}
            sizes="(min-width: 1024px) 1000px, 100vw"
            alt=""
            width={960}
            height={540}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className={cn(img, 'dark:brightness-[.78] dark:contrast-[1.05]')}
          />
        )}
        {size === 'hero' && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-overlay transition-transform duration-200 ease-brand group-hover:scale-105">
              <Play className="size-6 translate-x-[1px] fill-current" strokeWidth={0} />
            </span>
          </span>
        )}
        <span
          aria-hidden
          className={cn(
            'absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-md bg-ink-surface/90 py-1 pl-1.5 pr-2 text-on-ink transition-colors duration-200 ease-brand group-hover:bg-accent',
            // a card's picture is a small thumbnail from tablets up: the chip would cover the title there, so the card prints the length
            size === 'card' && 'sm:hidden',
          )}
        >
          <Play className="size-3 fill-current" strokeWidth={0} />
          <span className="font-mono text-[11px] font-medium tabular">{clock(t.film.durationSeconds)}</span>
        </span>
      </div>
    );
  }
  // the films' cover layout: what and where on the left, the number large on the right, the mark in the corner
  return (
    <div aria-hidden className={cn('@container relative aspect-video overflow-hidden bg-surface-2', className)}>
      <div className="mk-tut-grid absolute inset-0" />
      <span className="mk-watermark absolute right-[5%] top-[8%] aspect-[911/797] w-[11%] bg-ink/[0.12]" />
      <span className="absolute bottom-[-6%] right-[4%] font-display text-[length:30cqw] font-semibold leading-none tracking-[-0.05em] text-ink/[0.07] tabular">{t.id}</span>
      <div className="absolute inset-y-0 left-0 flex w-[64%] flex-col justify-center gap-[2.4cqw] pl-[7%]">
        <span className="font-display text-[length:clamp(12px,2.6cqw,22px)] font-semibold text-accent-text">
          Tutorial {t.id} · {t.series.title}
        </span>
        <span className="font-display text-[length:clamp(22px,5.4cqw,46px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink text-balance">{t.title}</span>
        <span className="flex flex-wrap items-center gap-x-[2.4cqw] gap-y-1 text-[length:clamp(11px,1.9cqw,16px)] font-medium text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="size-[1.15em]" />
            {t.chapters.length} steps
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-[1.15em]" />
            About {t.minutes} {t.minutes === 1 ? 'minute' : 'minutes'}
          </span>
        </span>
      </div>
      <span className="absolute bottom-[6%] left-[7%] inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[length:clamp(11px,1.7cqw,14px)] font-medium text-ink-2 shadow-card">
        <span className="size-1.5 rounded-full bg-accent" />
        Video coming soon
      </span>
    </div>
  );
}

