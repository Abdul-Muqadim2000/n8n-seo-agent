// KI (2026-11-08, DESIGN.md §6): the pieces both new pages share: the trial banner, the run notes (partial run, out of credits, paused),
// the "run it" button with its credits, a number with its "what this means" tip and how it was found, the score with its factors, and
// the page shown where the website's KI is not visible.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Coins, EyeOff, FlaskConical, Info, PauseCircle, Play } from 'lucide-react';
import { KI_VERDICTS, MODES, type KiRunMode } from '@seo/shared';
import { formatCredits, quoteLabel } from '@/lib/credits';
import { runCost } from '@/lib/prices';
import { paths } from '@/lib/paths';
import { KI_FACTOR_WORDS, kiMarketName, kiOutOfCredits, kiPartialNote, kiScoreText, type KiKw, type KiOverview } from '@/lib/ki';
import { fmtDate } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { InfoTip } from '@/components/insight';
import { useSitePage } from '../kit';

/** Tap targets of 40 px on phones (the kit's small buttons are 32 px). */
export const TAP = 'max-sm:h-10 max-sm:px-3.5';

export function kiCreditsText(o: KiOverview | undefined, kind: KiRunMode): string {
  const c = kind === 'competitors' ? o?.credits.competitors : o?.credits.research;
  return c != null && c > 0 ? formatCredits(c) : quoteLabel(runCost(kind));
}

/** Start (or refresh) the run of this page: the tool form, where the credits are shown again before anything starts. */
export function KiRunButton({ kind, o, refresh, variant = 'primary' }: { kind: KiRunMode; o: KiOverview | undefined; refresh?: boolean; variant?: 'primary' | 'secondary' }) {
  const { can, tool } = useSitePage();
  if (!can('member') || o?.killed) return null;
  const label = kind === 'competitors' ? (refresh ? 'Check my competitors again' : 'Find my competitors') : refresh ? 'Research my keywords again' : 'Research my keywords';
  return (
    <ButtonLink to={tool(kind)} variant={variant} icon={<Play className="size-4" />} className={TAP}>
      {label}
      <span className="font-normal opacity-80">({kiCreditsText(o, kind)})</span>
    </ButtonLink>
  );
}

/** Trial: only our team sees the page; the client sees nothing new. */
export function KiTrialBanner({ o }: { o: KiOverview | undefined }) {
  if (o?.mode !== 'trial') return null;
  return (
    <Callout tone="info" title="Trial: only platform admins see this">
      The client sees nothing new on this website until the setting is switched to On in Website settings.
    </Callout>
  );
}

/** Calm notes about the latest run: paused, out of credits, a part that could not be read. */
export function KiRunNotes({ o, kind }: { o: KiOverview | undefined; kind: KiRunMode }) {
  const { org } = useSitePage();
  const run = o?.lastRuns[kind];
  const notes: ReactNode[] = [];
  if (o?.killed)
    notes.push(
      <Callout key="k" tone="warning" title="Paused for maintenance">
        <span className="inline-flex items-start gap-1.5">
          <PauseCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          New runs are paused for a short while. What you see below is kept. Nothing is charged while it is paused.
        </span>
      </Callout>,
    );
  if (kiOutOfCredits(run))
    notes.push(
      <Callout
        key="c"
        tone="warning"
        title="Your company has no credits left for analyses"
        action={
          <ButtonLink to={paths.settings(org.id, 'credits')} variant="secondary" size="sm" icon={<Coins className="size-4" />} className={TAP}>
            Open Credits
          </ButtonLink>
        }
      >
        The last run stopped before it started spending. Add credits, then run it again. Nothing was charged.
      </Callout>,
    );
  const partial = kiPartialNote(run);
  if (partial)
    notes.push(
      <Callout key="p" tone="info" title="Part of the last reading is missing">
        {partial}
      </Callout>,
    );
  if (run && run.status === 'failed' && !kiOutOfCredits(run))
    notes.push(
      <Callout key="f" tone="info" title="The last run could not finish">
        Nothing was charged for it. What you see below is from the run before it, if there was one.
      </Callout>,
    );
  return notes.length ? <div className="space-y-3">{notes}</div> : null;
}

/** A number with what it means and how it was found ("measured", "estimate from ...", "our estimate"), always one tap away. */
export function KiFigure({ value, tip, basis, className }: { value: ReactNode; tip: string; basis?: string; className?: string }) {
  return (
    <span className={className ?? 'inline-flex items-center gap-0.5 whitespace-nowrap'}>
      <span className="tabular">{value}</span>
      <InfoTip label="What this means">
        {tip}
        {basis && <span className="mt-1 block text-xs opacity-80">How we know: {basis}</span>}
      </InfoTip>
    </span>
  );
}

/** The score with its likely range; the factors behind it on hover or tap (never shown as raw codes). */
export function KiScore({ r }: { r: Pick<KiKw, 'score' | 'scoreLow' | 'scoreHigh' | 'factors' | 'lowConfidence' | 'verdict'> }) {
  if (r.score == null) return <span className="text-ink-3">-</span>;
  const f = r.factors;
  const rows = (Object.keys(KI_FACTOR_WORDS) as (keyof typeof KI_FACTOR_WORDS)[]).filter((k) => f[k] != null);
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      <span className="font-medium tabular text-ink">{kiScoreText(r.score, r.scoreLow, r.scoreHigh)}</span>
      <InfoTip label="What makes up this score">
        <span className="block font-medium">Score out of 100 for {KI_VERDICTS[r.verdict].toLowerCase()}</span>
        <span className="mt-1 block">How it is made up (each from 0 to 100):</span>
        <span className="mt-1 block space-y-0.5">
          {rows.map((k) => (
            <span key={k} className="flex justify-between gap-4">
              <span>{KI_FACTOR_WORDS[k]}</span>
              <span className="tabular">{Math.round((f[k] ?? 0) * 100)}</span>
            </span>
          ))}
        </span>
        {r.lowConfidence && <span className="mt-1 block">The range is wide: we are less sure about this one.</span>}
        <span className="mt-1 block text-xs opacity-80">How we know: our estimate</span>
      </InfoTip>
    </span>
  );
}

/** Off sites never reach the page (no link anywhere); a typed address says it plainly. */
export function KiNotAvailable({ title }: { title: string }) {
  const { page } = useSitePage();
  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <EmptyState
        titleAs="h1"
        icon={<EyeOff className="size-5" />}
        title={`${title} is not available for this website yet`}
        description="It is rolling out to selected websites. Ask us if you would like it for yours."
        action={<ButtonLink to={page('overview')}>Back to the overview</ButtonLink>}
      />
    </div>
  );
}

/** "Updated 2 Nov 2026 · market United Arab Emirates" */
export function KiUpdated({ at, market }: { at: string | null | undefined; market?: string }) {
  const d = at ? fmtDate(at) : '';
  if ((!d || d === '-') && !market) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {d && d !== '-' && <span>Updated {d}</span>}
      {market && <span>Market: {kiMarketName(market)}</span>}
    </span>
  );
}

export function KiTrialIcon() {
  return <FlaskConical className="size-4" aria-hidden />;
}

/** Start buttons of the plan and the gaps: disabled with "Coming soon" until the start step ships (the server says when). */
export function KiStartButton({ ready, onStart, pending, credits, label = 'Start' }: { ready: boolean; onStart: () => void; pending?: boolean; credits?: number | null; label?: string }) {
  const { can } = useSitePage();
  if (!can('member')) return null;
  if (!ready)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-3" title="Starting from here is coming soon. For now, start it from the Pipeline or the tools.">
        <button type="button" disabled aria-disabled className="inline-flex h-10 cursor-not-allowed items-center rounded-lg border border-line px-3 text-[13px] font-medium text-ink-3 opacity-70 sm:h-8">
          {label}
        </button>
        Coming soon
      </span>
    );
  return (
    <button type="button" onClick={onStart} disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-ink shadow-card transition-colors duration-150 ease-brand hover:bg-accent-hover disabled:opacity-60 sm:h-8">
      {label}
      {credits != null && credits > 0 && <span className="font-normal opacity-80">({formatCredits(credits)})</span>}
    </button>
  );
}

/** The guide link that sits next to a section heading. */
export const KI_INFO = <Info className="size-4" aria-hidden />;

/** The link to the other KI page. */
export function KiOtherPage({ to, children }: { to: 'competitors' | 'keywords'; children: ReactNode }) {
  const { page } = useSitePage();
  return (
    <Link to={page(to)} className="font-medium text-accent-text underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

export const kiModeTitle = (kind: KiRunMode) => MODES[kind].title;
