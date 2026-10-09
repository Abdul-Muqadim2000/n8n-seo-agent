import { MessageSquareText } from 'lucide-react';
import { aiEngines } from '../../content/site';
import { cn } from '@/lib/utils';
import { useSectionTone } from '../Section';
import { DownFlow, Fan } from './Fan';

const QUESTIONS = ['Best invoicing software for small teams?', 'How do I automate invoice approvals?', 'Which tools integrate with our ERP?'];
const METRICS = [
  { label: 'Mention rate', value: '34%', range: '27–41%' },
  { label: 'Citation rate', value: '19%', range: '13–26%' },
  { label: 'Share of voice', value: '22%', range: '#2 of 5' },
];

/** A panel of buyer questions fanned out to six AI engines, whose answers fan back into mention rate, citation rate and share of voice (sample figures). */
export function AiEnginesDiagram({ className }: { className?: string }) {
  const ink = useSectionTone() === 'ink';
  const card = cn('rounded-xl border p-5', ink ? 'border-line-on-ink bg-on-ink/[0.04]' : 'border-line bg-surface shadow-card');
  const title = cn('font-display text-base font-semibold', ink ? 'text-on-ink' : 'text-ink');
  const sub = ink ? 'text-on-ink-2' : 'text-ink-2';
  const panel = (
    <div className={card}>
      <div className="flex items-center gap-2">
        <MessageSquareText className={cn('size-4', ink ? 'text-accent-on-ink' : 'text-accent-text')} aria-hidden />
        <span className={title}>Question panel</span>
      </div>
      <p className={cn('mt-1 text-[13px]', sub)}>Up to 50 buyer questions</p>
      <ul className="mt-4 space-y-2">
        {QUESTIONS.map((q) => (
          <li key={q} className={cn('rounded-md border px-3 py-2 text-[12.5px] leading-snug', ink ? 'border-line-on-ink text-on-ink' : 'border-line bg-surface-2 text-ink')}>
            {q}
          </li>
        ))}
      </ul>
    </div>
  );
  const engineChip = (e: string) => (
    <span className={cn('flex h-full w-full items-center gap-2 rounded-lg border px-3 text-[13px] font-medium', ink ? 'border-line-on-ink bg-ink-surface text-on-ink' : 'border-line bg-surface text-ink shadow-card')}>
      <span className={cn('size-1.5 shrink-0 rounded-full', ink ? 'bg-accent-on-ink' : 'bg-accent')} />
      {e}
    </span>
  );
  const results = (
    <div className={card}>
      <span className={title}>What you see</span>
      <dl className="mt-4 space-y-3.5">
        {METRICS.map((m) => (
          <div key={m.label} className="flex items-baseline justify-between gap-3">
            <dt className={cn('text-[13px]', sub)}>{m.label}</dt>
            <dd className="text-right">
              <span className={cn('font-mono text-lg font-medium tabular', ink ? 'text-on-ink' : 'text-ink')}>{m.value}</span>
              <span className={cn('ml-2 font-mono text-[11px] tabular', sub)}>{m.range}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return (
    <figure className={className} aria-label={`A panel of buyer questions is asked to ${aiEngines.join(', ')}; the answers give mention rate, citation rate and share of voice.`}>
      <div className="hidden h-[360px] grid-cols-[minmax(0,260px)_minmax(40px,0.8fr)_minmax(0,180px)_minmax(40px,0.8fr)_minmax(0,250px)] lg:grid" aria-hidden>
        <div className="flex items-center">{panel}</div>
        <Fan count={aiEngines.length} direction="out" ink={ink} />
        <ul className="grid h-full grid-cols-1" style={{ gridTemplateRows: `repeat(${aiEngines.length}, minmax(0, 1fr))` }}>
          {aiEngines.map((e) => (
            <li key={e} className="flex min-h-0 py-1">
              {engineChip(e)}
            </li>
          ))}
        </ul>
        <Fan count={aiEngines.length} direction="in" ink={ink} />
        <div className="flex items-center">{results}</div>
      </div>
      <div className="lg:hidden" aria-hidden>
        {panel}
        <DownFlow ink={ink} className="my-2" />
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {aiEngines.map((e) => (
            <li key={e} className="h-11">
              {engineChip(e)}
            </li>
          ))}
        </ul>
        <DownFlow ink={ink} className="my-2" />
        {results}
      </div>
      <figcaption className={cn('mt-4 text-center font-mono text-[11px] uppercase tracking-[0.12em]', ink ? 'text-on-ink-2' : 'text-ink-3')}>Sample figures</figcaption>
    </figure>
  );
}
