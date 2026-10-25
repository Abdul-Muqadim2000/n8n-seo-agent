import { Link } from 'react-router';
import { ArrowRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clock, type Tutorial } from '../../content/tutorials';
import { TutorialCover } from './TutorialCover';

/** Level as a quiet tag: the label always, and a 1-3 bar meter beside it (never colour alone). */
export function LevelTag({ level, className }: { level: Tutorial['level']; className?: string }) {
  const n = level === 'Beginner' ? 1 : level === 'Intermediate' ? 2 : 3;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3', className)}>
      <span aria-hidden className="flex items-end gap-[2px]">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn('w-[3px] rounded-full', i <= n ? 'bg-accent-text' : 'bg-line-strong')} style={{ height: 4 + i * 2.5 }} />
        ))}
      </span>
      {level}
    </span>
  );
}

const shell =
  'group flex h-full overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-brand hover:-translate-y-0.5 hover:border-accent hover:shadow-raised focus-visible:border-accent motion-reduce:hover:translate-y-0';

function Action({ children }: { children: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 font-medium text-accent-text">
      {children}
      <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
    </span>
  );
}

/**
 * One tutorial in the library; the whole card is the link. With a finished film: the film's title picture (its length is on it), then
 * the title, the one-line benefit, the level and "Watch"; on phones the picture sits on top, from tablets up beside the text, so the
 * library reads as a list. Without one: a compact card with no picture (a square tile with the number), so the list stays short and
 * what is ready to watch stands out. Both shapes are about as tall from tablets up, so a row of two never leaves one card half empty.
 */
export function TutorialCard({ tutorial: t, className, headingLevel = 'h3' }: { tutorial: Tutorial; className?: string; headingLevel?: 'h3' | 'h4' }) {
  const H = headingLevel;
  const title = (
    <H className="font-display text-[16.5px] font-semibold leading-snug tracking-[-0.01em] text-ink text-balance group-hover:text-accent-text">
      <span className="sr-only">Tutorial {t.id}: </span>
      {t.title}
    </H>
  );
  if (t.film)
    return (
      <Link to={`/tutorials/${t.slug}`} className={cn(shell, 'flex-col sm:flex-row sm:items-start sm:gap-5 sm:p-4', className)}>
        <TutorialCover tutorial={t} className="border-b border-line sm:w-60 sm:shrink-0 sm:rounded-lg sm:border xl:w-[40%]" />
        <div className="flex flex-1 flex-col self-stretch p-5 sm:p-0 sm:pt-0.5">
          {title}
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink-2">{t.summary}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[13px]">
            <LevelTag level={t.level} />
            <span className="inline-flex items-center gap-3">
              {/* on phones the length is on the picture */}
              <span className="hidden items-center gap-1 font-mono text-[12px] text-ink-3 tabular sm:inline-flex">
                <Play className="size-2.5 fill-current text-accent-text" strokeWidth={0} aria-hidden />
                <span className="sr-only">Length </span>
                {clock(t.film.durationSeconds)}
              </span>
              <Action>Watch</Action>
            </span>
          </div>
        </div>
      </Link>
    );
  return (
    <Link to={`/tutorials/${t.slug}`} className={cn(shell, 'gap-4 p-4 sm:gap-5', className)}>
      <span
        aria-hidden
        className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 font-mono text-[15px] font-medium text-ink-2 tabular transition-colors duration-200 ease-brand group-hover:border-accent group-hover:text-accent-text"
      >
        {t.id}
      </span>
      <div className="flex min-w-0 flex-1 flex-col sm:pt-0.5">
        {title}
        <span className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{t.summary}</span>
        <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3 text-[13px]">
          <span className="text-ink-3">
            <span className="font-mono tabular">About {t.minutes} min</span> · Written steps
          </span>
          <Action>Read the steps</Action>
        </span>
      </div>
    </Link>
  );
}
