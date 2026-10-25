import { Link } from 'react-router';
import { ArrowRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "Learn the platform": a quiet pill link to the video course (the home hero's "New" chip, pointing at /tutorials). No count here,
 *  so the pages that show it do not load the course catalogue. */
export function LearnLink({ className }: { className?: string }) {
  return (
    <Link
      to="/tutorials"
      className={cn(
        'mk-tap group inline-flex max-w-full items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5 text-[13px] text-ink-2 shadow-card transition-[border-color,color] duration-200 ease-brand hover:border-accent hover:text-ink',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accent-text">
        <Play className="size-2.5 fill-current" strokeWidth={0} aria-hidden />
        Video
      </span>
      <span className="truncate">Learn the platform in short videos</span>
      <ArrowRight className="size-3.5 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
    </Link>
  );
}
