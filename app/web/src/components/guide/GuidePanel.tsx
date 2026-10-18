import { useCallback, useMemo, useRef, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Briefcase, Building2, Check, ChevronRight, Clock, Copy, ExternalLink as ExternalIcon, Globe, LifeBuoy, Lock, Mail, MapPin, Search, Send, ShieldCheck, Sparkles, UserRound, X, type LucideIcon } from 'lucide-react';
import { fillGuide, GUIDE_AREAS, guideAvailable, guideById, guideText, GUIDES, searchGuides, type FilledCopy, type FilledStep, type Guide, type GuideArea, type GuideVars } from '@seo/shared/guides';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { IconTile } from '@/components/ui/icon-tile';
import { CopyButton, Meter } from '@/components/ui/misc';
import { CollapsePanel, Collapsible } from '@/components/insight/disclosure';
import { Segmented } from '@/components/ui/tabs';
import { useProviders } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { RichText } from './rich';
import { firstOpenStep, readDone, writeDone } from './progress';

// The guide panel: one job the person has to do somewhere else, broken into steps they can tick off, with their own values ready to
// copy, the page to open, what to do when it does not work — and a way to hand the whole thing to the colleague who has to do it.
// Opened from anywhere through useGuides() (see GuideProvider); the content is data in @seo/shared (guides.ts).

export interface GuideFinish {
  label: string;
  onClick: () => void;
}
export type GuideState = { mode: 'index'; query?: string } | { mode: 'guide'; id: string; vars?: GuideVars; finish?: GuideFinish; fromIndex?: boolean } | null;

const AREA_ICON: Record<GuideArea, LucideIcon> = { google: Search, ownership: ShieldCheck, website: Globe, mailbox: Mail, business: Building2, company: UserRound, security: Lock, agency: Briefcase };
const areaLabel = (a: GuideArea) => GUIDE_AREAS.find((x) => x.id === a)?.label ?? 'Guide';

/** D-9: what this installation offers (Google sign-in may be off); until the server says, a Google-only guide is not offered */
function useGuideAvailability() {
  const google = useProviders().data?.google === true;
  return useMemo(() => ({ googleSignIn: google }), [google]);
}

export function GuidePanel({ state, setState, close }: { state: GuideState; setState: (s: GuideState) => void; close: () => void }) {
  const guide = state?.mode === 'guide' ? guideById(state.id) : undefined;
  return (
    <D.Root open={!!state} onOpenChange={(o) => !o && close()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink-surface/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in dark:bg-black/60" />
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[36rem] flex-col border-line bg-page shadow-overlay outline-none focus-visible:shadow-overlay! data-[state=open]:animate-slide-in-right sm:border-l"
        >
          {state?.mode === 'guide' && guide ? (
            <GuideView key={guide.id} guide={guide} vars={state.vars} finish={state.finish} onBack={state.fromIndex ? () => setState({ mode: 'index' }) : undefined} onOpen={(id) => setState({ mode: 'guide', id, vars: state.vars, fromIndex: state.fromIndex })} />
          ) : (
            <GuideIndex onOpen={(id) => setState({ mode: 'guide', id, fromIndex: true })} />
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Header shared by both views: the close button sits in the same place whatever is open. */
function PanelHead({ children, back }: { children: React.ReactNode; back?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line bg-surface px-5 pb-4 pt-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {back && (
          <button type="button" onClick={back} aria-label="Back to all guides" className="mt-0.5 shrink-0 rounded-md p-1.5 text-ink-3 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <D.Close className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-1.5 text-ink-3 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink active:bg-surface-3" aria-label="Close">
        <X className="size-4" />
      </D.Close>
    </div>
  );
}

// ---------------------------------------------------------------- one guide
function GuideView({ guide, vars, finish, onBack, onOpen }: { guide: Guide; vars?: GuideVars; finish?: GuideFinish; onBack?: () => void; onOpen: (id: string) => void }) {
  const filled = useMemo(() => fillGuide(guide, vars ?? {}), [guide, vars]);
  const available = useGuideAvailability();
  const related = (filled.related ?? []).filter((id) => guideAvailable(guideById(id), available));   // D-9: only what this app offers
  const total = filled.steps.length;
  const [done, setDone] = useState<number[]>(() => readDone(guide.id));
  const [current, setCurrent] = useState<number>(() => firstOpenStep(readDone(guide.id), total));
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const Icon = AREA_ICON[guide.area];
  const complete = done.length >= total;

  const goTo = useCallback((i: number, focus?: boolean) => {
    setCurrent(i);
    if (focus) requestAnimationFrame(() => rows.current[i]?.focus({ preventScroll: true }));
    requestAnimationFrame(() => rows.current[i]?.scrollIntoView({ block: 'nearest' }));
  }, []);

  const tick = (i: number, value: boolean) => {
    const next = value ? [...new Set([...done, i])] : done.filter((n) => n !== i);
    setDone(next);
    writeDone(guide.id, next);
    if (value && i + 1 < total) goTo(i + 1, true);
  };

  const text = () => guideText(guide, vars ?? {});
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(text());
      toast.success('The whole guide is on your clipboard');
    } catch {
      toast.error('The browser blocked the clipboard. Select the steps and copy them by hand.');
    }
  };
  const mailto = `mailto:?subject=${encodeURIComponent(filled.title)}&body=${encodeURIComponent(`${text()}\n\n— sent from Ascentra`)}`;

  return (
    <>
      <PanelHead back={onBack}>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          <span className="font-mono">Guide</span>
          <ChevronRight className="size-3" aria-hidden />
          <span className="truncate normal-case tracking-normal">{areaLabel(guide.area)}</span>
        </div>
        <div className="mt-1.5 flex items-start gap-3">
          <IconTile size="md" className="mt-0.5">
            <Icon />
          </IconTile>
          <div className="min-w-0">
            <D.Title className="font-display text-[19px] leading-snug font-semibold tracking-[-0.01em] text-ink">{filled.title}</D.Title>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
              <RichText text={filled.why} />
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            About {filled.minutes} minutes
          </span>
          {filled.where && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {filled.where}
            </span>
          )}
          {filled.who && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5" aria-hidden />
              {filled.who}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          {/* neutral track in both themes: a blue-tinted empty bar reads as "already done" in dark mode */}
          <Meter value={(done.length / total) * 100} tone={complete ? 'good' : 'accent'} label={`${done.length} of ${total} steps done`} className="flex-1 bg-surface-3" />
          <span className="shrink-0 font-mono text-[11px] text-ink-3 tabular">
            {done.length}/{total}
          </span>
        </div>
      </PanelHead>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <ol className="space-y-1">
          {filled.steps.map((step, i) => (
            <StepRow
              key={i}
              ref={(el) => {
                rows.current[i] = el;
              }}
              step={step}
              index={i}
              last={i === total - 1}
              open={current === i}
              done={done.includes(i)}
              onToggle={() => goTo(current === i ? -1 : i)}
              onDone={() => tick(i, true)}
              onUndo={() => tick(i, false)}
            />
          ))}
        </ol>

        {filled.done && (
          <Callout tone={complete ? 'good' : 'info'} title={complete ? 'That should be it' : 'You will know it worked when'} className="mt-5">
            <RichText text={filled.done} />
          </Callout>
        )}

        {!!filled.trouble?.length && (
          <div className="mt-5 rounded-xl border border-line bg-surface p-4">
            <Collapsible variant="row" label="If it does not work" icon={<LifeBuoy className="size-4 text-ink-3" aria-hidden />} contentClassName="pt-1">
              <dl className="space-y-3 pt-2">
                {filled.trouble.map((t, i) => (
                  <div key={i}>
                    <dt className="text-[13px] font-medium text-ink">
                      <RichText text={t.q} />
                    </dt>
                    <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
                      <RichText text={t.a} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Collapsible>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[13px] font-medium text-ink-3">Next, or instead</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {related.map((id) => {
                const r = guideById(id);
                if (!r) return null;
                const RIcon = AREA_ICON[r.area];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpen(id)}
                    className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink shadow-card transition-[color,background-color,border-color,translate] duration-150 ease-brand hover:-translate-y-px hover:border-accent hover:text-accent-text"
                  >
                    <RIcon className="size-3.5 shrink-0 text-ink-3 transition-colors group-hover:text-accent-text" aria-hidden />
                    <span className="truncate">{r.title}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" icon={<Copy className="size-3.5" />} onClick={copyAll}>
            Copy all steps
          </Button>
          <a href={mailto} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink">
            <Send className="size-3.5" aria-hidden />
            Send to a colleague
          </a>
        </div>
        {finish ? (
          <D.Close asChild>
            <Button size="sm" onClick={finish.onClick} icon={<Check className="size-3.5" />}>
              {finish.label}
            </Button>
          </D.Close>
        ) : (
          <D.Close asChild>
            <Button variant="secondary" size="sm">
              Close
            </Button>
          </D.Close>
        )}
      </div>
    </>
  );
}

const StepRow = function StepRowImpl({
  ref,
  step,
  index,
  last,
  open,
  done,
  onToggle,
  onDone,
  onUndo,
}: {
  ref: (el: HTMLButtonElement | null) => void;
  step: FilledStep;
  index: number;
  last: boolean;
  open: boolean;
  done: boolean;
  onToggle: () => void;
  onDone: () => void;
  onUndo: () => void;
}) {
  const [choice, setChoice] = useState(0);
  const id = `guide-step-${index}`;
  const picked = step.choices?.[choice];
  return (
    <li className="relative pl-11">
      {!last && <span className={cn('absolute left-[19px] top-9 bottom-0 w-px', done ? 'bg-good-text/30' : 'bg-line')} aria-hidden />}
      <span
        className={cn(
          'absolute left-0 top-1.5 flex size-[38px] items-center justify-center rounded-full border text-[13px] font-semibold tabular transition-[background-color,border-color,color] duration-200 ease-brand',
          done ? 'border-good-text/30 bg-good-soft text-good-text' : open ? 'border-accent bg-accent text-accent-ink shadow-card' : 'border-line-strong bg-surface text-ink-3',
        )}
        aria-hidden
      >
        {done ? <Check className="size-4" /> : index + 1}
      </span>
      <button
        ref={ref}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="w-full rounded-lg py-2.5 pr-2 text-left transition-colors duration-150 ease-brand hover:text-accent-text"
      >
        <span className={cn('text-[15px] font-medium leading-snug', done && !open ? 'text-ink-3' : 'text-ink')}>
          <RichText text={step.title} />
        </span>
      </button>
      <CollapsePanel open={open} id={id}>
        <div className="space-y-3 pb-5 pr-1 pt-0.5">
          <p className="text-sm leading-relaxed text-ink-2">
            <RichText text={step.body} />
          </p>

          {!!step.copy?.length && <div className="space-y-2">{step.copy.map((c, i) => <CopyRow key={i} copy={c} />)}</div>}

          {step.link && (
            <a href={step.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink shadow-card transition-[color,background-color,border-color] duration-150 ease-brand hover:border-accent hover:text-accent-text">
              {step.link.label}
              <ExternalIcon className="size-3.5" aria-hidden />
            </a>
          )}

          {!!step.choices?.length && (
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">Where you do it</p>
              <Segmented
                size="sm"
                label="Choose your provider"
                className="max-w-full flex-wrap"
                value={String(choice)}
                onChange={(v) => setChoice(Number(v))}
                options={step.choices.map((c, i) => ({ value: String(i), label: c.label }))}
              />
              {picked && (
                <div className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
                  <RichText text={picked.body} />
                  {picked.link && (
                    <a href={picked.link.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-text hover:underline">
                      {picked.link.label}
                      <ExternalIcon className="size-3.5" aria-hidden />
                    </a>
                  )}
                  {picked.note && <p className="mt-1.5 text-ink-3">{<RichText text={picked.note} />}</p>}
                </div>
              )}
            </div>
          )}

          {step.note && (
            <Callout tone="info">
              <RichText text={step.note} />
            </Callout>
          )}
          {step.warn && (
            <Callout tone="warning">
              <RichText text={step.warn} />
            </Callout>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {done ? (
              <Button variant="secondary" size="sm" onClick={onUndo} icon={<Check className="size-3.5 text-good-text" />}>
                Done — undo
              </Button>
            ) : (
              <Button size="sm" onClick={onDone} icon={<Check className="size-3.5" />}>
                {last ? 'Mark as done' : 'Done — next step'}
              </Button>
            )}
          </div>
        </div>
      </CollapsePanel>
    </li>
  );
};

function CopyRow({ copy }: { copy: FilledCopy }) {
  return (
    <div className="rounded-lg border border-line-strong bg-surface p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">{copy.label}</span>
        {copy.example && <Badge tone="warning">example</Badge>}
      </div>
      <div className="mt-1.5 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[13px] leading-relaxed text-ink">{copy.value}</code>
        <CopyButton text={copy.value} className="shrink-0" />
      </div>
      {copy.hint && (
        <p className="mt-1.5 text-xs leading-snug text-ink-3">
          <RichText text={copy.hint} />
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- all guides
function GuideIndex({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const available = useGuideAvailability();
  const found = useMemo(() => searchGuides(q).filter((g) => guideAvailable(g, available)), [q, available]);
  const groups = GUIDE_AREAS.map((a) => ({ ...a, items: found.filter((g) => g.area === a.id) })).filter((g) => g.items.length);
  return (
    <>
      <PanelHead>
        <div className="flex items-start gap-3">
          <IconTile size="md" className="mt-0.5">
            <LifeBuoy />
          </IconTile>
          <div className="min-w-0">
            <D.Title className="font-display text-[19px] leading-snug font-semibold tracking-[-0.01em] text-ink">Guides</D.Title>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
              Every job Ascentra asks you to do somewhere else, step by step, with your own values ready to copy. {GUIDES.length} guides.
            </p>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: dns, analytics, app password…" aria-label="Search the guides" className="pl-9" />
        </div>
      </PanelHead>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!groups.length && (
          <p className="py-10 text-center text-sm text-ink-3">
            Nothing matches “{q}”. Try a word from the task — <button type="button" className="font-medium text-accent-text hover:underline" onClick={() => setQ('')}>clear the search</button>.
          </p>
        )}
        <div className="space-y-6">
          {groups.map((group) => {
            const Icon = AREA_ICON[group.id];
            return (
              <section key={group.id}>
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 text-ink-3" aria-hidden />
                  <h3 className="text-[13px] font-semibold text-ink">{group.label}</h3>
                </div>
                <p className="mt-0.5 text-xs text-ink-3">{group.description}</p>
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {group.items.map((g) => (
                    <li key={g.id}>
                      <button type="button" onClick={() => onOpen(g.id)} className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 ease-brand hover:bg-surface-2">
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-ink-3 transition-colors group-hover:text-accent-text" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-snug text-ink">{g.title}</span>
                          <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-ink-3">{g.why}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-ink-3 tabular">{g.minutes}m</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default GuidePanel;
