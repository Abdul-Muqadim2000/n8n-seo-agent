import { BellRing, Bot, Database, Hash, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn } from './parts';

// Integrations as they look from the team's side (sample data): an alert in a team channel, the audit finding that became a ticket
// with its state read back, last night's export to the warehouse, and an assistant previewing a run before it starts.

export function IntegrationsMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="Sample integrations: an alert about a key page posted in a team channel, an audit finding turned into ticket SEO-42 shown as in progress, last night's export of six tables to a warehouse, and an AI assistant previewing a technical audit with its price in credits before starting it."
      className={cn('@container overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-overlay', className)}
    >
      <div className="border-b border-line px-4 pt-4 pb-3.5 @min-[26rem]:px-5">
        <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">Connected</span>
        <div className="mt-1.5 flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
            <Hash className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10.5px] text-ink-3">#seo-alerts · just now</span>
            <span className="mt-0.5 block font-display text-[13.5px] leading-snug font-semibold">Alert · example.com</span>
            <span className="mt-1 block text-[11.5px] leading-snug text-ink-2">High: /pricing stopped being indexable this morning (noindex added).</span>
            <span className="mt-1.5 inline-flex rounded-md border border-line px-2 py-0.5 text-[10.5px] font-medium text-accent-text">Open in Alaventra</span>
          </span>
        </div>
      </div>

      <ul className="divide-y divide-line">
        <li className="mk-pop flex items-center gap-2.5 px-4 py-3 @min-[26rem]:px-5" style={{ ['--mk-i' as string]: 0 }}>
          <ListTodo className="size-3.5 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate text-[11.5px]">Pages with no H1 · 12 pages</span>
          <span className="font-mono text-[11px] font-semibold text-accent-text">SEO-42</span>
          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-text">In progress</span>
        </li>
        <li className="mk-pop flex items-center gap-2.5 px-4 py-3 @min-[26rem]:px-5" style={{ ['--mk-i' as string]: 1 }}>
          <Database className="size-3.5 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate text-[11.5px]">Warehouse export · 6 tables · 18,240 rows</span>
          <span className="rounded-md bg-good-soft px-1.5 py-0.5 text-[10px] font-medium text-good-text">Done 03:00</span>
        </li>
        <li className="mk-pop flex items-center gap-2.5 px-4 py-3 @min-[26rem]:px-5" style={{ ['--mk-i' as string]: 2 }}>
          <Bot className="size-3.5 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate text-[11.5px]">Assistant: preview a technical audit</span>
          <span className="font-mono text-[11px] text-ink-2">6 credits · 6 min</span>
        </li>
        <li className="mk-pop flex items-center gap-2.5 px-4 py-3 @min-[26rem]:px-5" style={{ ['--mk-i' as string]: 3 }}>
          <BellRing className="size-3.5 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate text-[11.5px]">#seo-wins · peppol uae moved 12 to 4</span>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-2">Delivered</span>
        </li>
      </ul>
    </Drawn>
  );
}
