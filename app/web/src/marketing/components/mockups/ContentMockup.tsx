import { CircleCheck, FileCode2, FileJson, FileText, Image, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockLine } from './parts';

const CHECKS: { t: string; ok: boolean }[] = [
  { t: 'Title and meta description', ok: true },
  { t: 'Author box and Person schema', ok: true },
  { t: 'Expert reviewer', ok: true },
  { t: '3 images with alt text', ok: true },
  { t: 'Links up the ladder', ok: true },
  { t: '1 figure to confirm', ok: false },
];

/** A written page next to its SEO QA checklist and the blog package files (sample data). */
export function ContentMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="A written article with sample data next to its quality checklist: title and meta description, author box, expert reviewer, three images with alt text, internal links, and one figure to confirm; delivered as HTML, Markdown and meta.json."
      className={cn('grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5', className)}
    >
      <div className="mk-pop rounded-lg border border-line bg-page p-4" style={{ ['--mk-i' as string]: 0 }}>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent-text">Guide · ladder rung 2</span>
        <span className="mt-1.5 block font-display text-[15px] font-semibold leading-snug sm:text-base">How to automate invoice approvals without losing control</span>
        <span className="mt-3 flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent-soft font-mono text-[9px] font-medium text-accent-text">AM</span>
          <span className="text-[11px] leading-tight text-ink-2">
            By your author · <span className="text-ink-3">reviewed by your expert</span>
          </span>
        </span>
        <span className="mt-4 flex aspect-[16/7] items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong bg-surface text-[10.5px] text-ink-3">
          <Image className="size-3.5" />
          Hero image · alt text planned
        </span>
        <span className="mt-4 block space-y-2">
          <MockLine w="96%" />
          <MockLine w="88%" />
          <MockLine w="92%" />
          <MockLine w="60%" />
        </span>
        <span className="mt-4 block rounded-md border-l-2 border-accent bg-accent-soft px-3 py-2 text-[11px] leading-snug text-ink-2">
          From experience: approvals stall when one person owns every invoice over a threshold.
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-line p-3">
          <span className="block text-[11.5px] font-semibold">SEO QA</span>
          <ul className="mt-2 space-y-1.5">
            {CHECKS.map((c, i) => (
              <li key={c.t} className="mk-pop flex items-start gap-1.5 text-[11.5px] leading-snug" style={{ ['--mk-i' as string]: i + 1 }}>
                {c.ok ? <CircleCheck className="mt-px size-3.5 shrink-0 text-good-text" /> : <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-text" />}
                <span className={c.ok ? 'text-ink-2' : 'font-medium text-warning-text'}>{c.t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-line p-3">
          <span className="block text-[11.5px] font-semibold">Blog package</span>
          <ul className="mt-2 space-y-1.5 font-mono text-[11px] text-ink-2">
            {[
              { f: 'article.html', i: FileCode2 },
              { f: 'article.md', i: FileText },
              { f: 'meta.json', i: FileJson },
            ].map(({ f, i: Icon }) => (
              <li key={f} className="flex items-center gap-1.5">
                <Icon className="size-3.5 text-ink-3" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-right font-mono text-[11px] text-ink-3">Sample data</p>
      </div>
    </Drawn>
  );
}
