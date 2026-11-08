// KI (2026-11-08, DESIGN.md §6): the pieces both new pages share: the trial banner, the run notes (partial run, out of credits, paused, a run
// that did not start), the "run it" button with its credits, a number with its "what this means" tip and how it was found, the score with
// its factors, the next-step links, the "show all" of a long list, and the page shown where the website's KI is not visible.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ChevronDown, Coins, EyeOff, FlaskConical, Info, PauseCircle, Play } from 'lucide-react';
import { MODES, type KiRunMode } from '@seo/shared';
import { formatCredits, quoteLabel } from '@/lib/credits';
import { runCost } from '@/lib/prices';
import { paths } from '@/lib/paths';
import {
  KI_FACTOR_WORDS,
  kiActionLink,
  kiFactorLevel,
  kiMarketName,
  kiOutOfCredits,
  kiPartialNote,
  kiRecentRun,
  kiScoreText,
  kiStopNote,
  kiUpdatedWords,
  type KiKw,
  type KiOverview,
} from '@/lib/ki';
import { cn, fmtDate } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { InfoTip } from '@/components/insight';
import { useSitePage } from '../kit';

/** Tap targets of 40 px on phones and touch tablets (review UX M5: up to md, the kit's small buttons are 32 px). */
export const TAP = 'max-lg:h-10 max-lg:px-3.5';   // review UX M5 (pass 2): up to lg, portrait tablets too
/** A 40 px hit area around the 20 px "?" of a tip (review UX M5), drawn by an invisible ::after, so nothing moves. */
export const KI_TIP = "after:absolute after:-inset-2.5 after:rounded-full after:content-['']";

/** The credits of a run of this page, or "free" for our team's Trial run (quoted 0 to the company). */
export function kiCreditsText(o: KiOverview | undefined, kind: KiRunMode): string {
  if (o?.mode === 'trial') return 'free trial run';
  const c = kind === 'competitors' ? o?.credits.competitors : o?.credits.research;
  return c != null && c > 0 ? formatCredits(c) : quoteLabel(runCost(kind));
}

/**
 * Start (or refresh) the run of this page: the tool form, where the credits are shown again before anything starts. FX-A: hidden while the
 * stored results are loading or could not be read (review UX M2: never a paid run offered for data that exists), "again" read from the last
 * run (not from the rows on screen, L10), and the quiet secondary style with "Updated today" while the last run is under 7 days old (M3).
 */
export function KiRunButton({ kind, o, ready = true }: { kind: KiRunMode; o: KiOverview | undefined; ready?: boolean }) {
  const { can, tool } = useSitePage();
  if (!can('member') || o?.killed || !ready) return null;
  const run = o?.lastRuns[kind];
  const again = !!run && (run.status === 'ok' || run.status === 'partial');
  const recent = kiRecentRun(run);
  const label = kind === 'competitors' ? (again ? 'Check my competitors again' : 'Find my competitors') : again ? 'Research my keywords again' : 'Research my keywords';
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {recent && <span className="text-xs text-ink-3">{kiUpdatedWords(run)}</span>}
      <ButtonLink to={tool(kind)} variant={recent ? 'secondary' : 'primary'} icon={<Play className="size-4" />} className={TAP}>
        {label}
        {/* review UX L1: full opacity (4.5:1 on blue), the weight says it is secondary */}
        <span className="font-normal">({kiCreditsText(o, kind)})</span>
      </ButtonLink>
    </span>
  );
}

/** Trial: only our team sees the page; the client sees nothing new. */
export function KiTrialBanner({ o }: { o: KiOverview | undefined }) {
  if (o?.mode !== 'trial') return null;
  return (
    <Callout tone="info" title="Trial: only platform admins see this">
      The client sees nothing new on this website until the setting is switched to On in Website settings. Trial runs are free for the client.
    </Callout>
  );
}

/** Calm notes about the latest run: out of credits, a part that could not be read, a run that did not start or finish (with what to do). */
export function KiRunNotes({ o, kind }: { o: KiOverview | undefined; kind: KiRunMode }) {
  const { org, site, tool, page } = useSitePage();
  const run = o?.lastRuns[kind];
  const notes: ReactNode[] = [];
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
  const stop = kiStopNote(run, { siteCountry: site.country });
  if (stop)
    notes.push(
      <Callout
        key="s"
        tone="info"
        title={stop.title}
        action={
          stop.action ? (
            <span className="flex flex-wrap gap-2">
              {stop.action.to === 'run' && (
                <ButtonLink to={tool(kind, site.country ? { country: site.country } : undefined)} variant="secondary" size="sm" className={TAP}>
                  {stop.action.label}
                </ButtonLink>
              )}
              {/market|country/i.test(run?.reason ?? '') && (
                <ButtonLink to={page('settings')} variant="ghost" size="sm" className={TAP}>
                  Website settings
                </ButtonLink>
              )}
            </span>
          ) : undefined
        }
      >
        {stop.text}
      </Callout>,
    );
  const partial = kiPartialNote(run);
  if (partial)
    notes.push(
      <Callout key="p" tone="info" title="Part of the last reading is missing">
        {partial}
      </Callout>,
    );
  return notes.length ? <div className="space-y-3">{notes}</div> : null;
}

/** A number with what it means and how it was found ("measured", "estimate from ...", "our estimate"), always one tap away. */
export function KiFigure({ value, tip, basis, className }: { value: ReactNode; tip: string; basis?: string; className?: string }) {
  return (
    <span className={className ?? 'inline-flex items-center gap-0.5 whitespace-nowrap'}>
      <span className="tabular">{value}</span>
      <InfoTip label="What this means" className={KI_TIP}>
        {tip}
        {basis && <span className="mt-1 block text-xs opacity-80">How we know: {basis}</span>}
      </InfoTip>
    </span>
  );
}

/**
 * The score with its likely range; the factors behind it on hover or tap, one plain line each ("Fits what you sell: high"), never codes.
 * FX-A (review UX H1): the factors are read from the server's nested shape (lib/ki.ts kiKwOf), so all of them show.
 */
export function KiScore({ r }: { r: Pick<KiKw, 'score' | 'scoreLow' | 'scoreHigh' | 'factors' | 'lowConfidence' | 'verdict'> }) {
  // review UX N3 (pass 2): a search we could not judge shows no score (a number with a range would read as a judgement)
  if (r.score == null || r.verdict === 'unknown') return <span className="text-ink-3" title="Not judged yet">-</span>;
  const f = r.factors;
  const rows = (Object.keys(KI_FACTOR_WORDS) as (keyof typeof KI_FACTOR_WORDS)[]).filter((k) => f[k] != null);
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      <span className="font-medium tabular text-ink">{kiScoreText(r.score, r.scoreLow, r.scoreHigh)}</span>
      <InfoTip label="What makes up this score" className={KI_TIP}>
        <span className="block font-medium">How this score of {Math.round(r.score)} is made</span>
        {/* review UX N4 (pass 2): the direction of every factor */}
        <span className="mt-0.5 block opacity-80">Each one raises the score when it is high.</span>
        {rows.length > 0 && (
          <span className="mt-1 block space-y-0.5">
            {rows.map((k) => (
              <span key={k} className="flex justify-between gap-4">
                <span>{KI_FACTOR_WORDS[k]}</span>
                <span>{kiFactorLevel(f[k] ?? 0)}</span>
              </span>
            ))}
          </span>
        )}
        {r.lowConfidence && <span className="mt-1 block">The range is wide: we are less sure about this one.</span>}
        <span className="mt-1 block text-xs opacity-80">How we know: our estimate</span>
      </InfoTip>
    </span>
  );
}

/** Off sites never reach the page (no link anywhere); a typed address says it plainly. Paused (kill switch): said as a pause. */
export function KiNotAvailable({ title, paused }: { title: string; paused?: boolean }) {
  const { page } = useSitePage();
  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <EmptyState
        titleAs="h1"
        icon={paused ? <PauseCircle className="size-5" /> : <EyeOff className="size-5" />}
        title={paused ? `${title} is paused for maintenance` : `${title} is not available for this website yet`}
        description={paused ? 'It is back shortly, with your results as they were. Nothing is charged while it is paused.' : 'It is rolling out to selected websites. Ask us if you would like it for yours.'}
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

/**
 * FX-A (review UX H4): a plan step, a gap or the hero's next step, done now: it opens the existing tool or page with the search filled in
 * (lib/ki.ts kiActionLink). Members and above only; nothing when no tool fits (never a dead "Coming soon").
 */
export function KiActionButton({ kind, keyword, target, variant = 'secondary', className }: { kind: string; keyword?: string | null; target?: string | null; variant?: 'primary' | 'secondary'; className?: string }) {
  const { org, site, can, tool, page } = useSitePage();
  if (!can('member')) return null;
  const a = kiActionLink(kind, { keyword, target, domain: site.domain });
  if (!a) return null;
  const to = a.kind === 'tool' ? tool(a.mode, a.prefill) : a.kind === 'ladder' ? paths.newLadder(org.id, site.id, { keyword: a.keyword }) : `${page(a.page)}${a.hash ? `#${a.hash}` : ''}`;
  return (
    <ButtonLink to={to} variant={variant} size="sm" icon={<ArrowRight className="size-4" />} className={cn(TAP, className)}>
      {a.label}
    </ButtonLink>
  );
}

/**
 * The "Show all N" of a long list (review UX H5): phones show `phone` items, wider screens `wide`; one button opens the rest. Use the
 * returned `cls(i)` on each item and render `button` under the list.
 */
export function useShowAll(count: number, phone = 5, wide = phone) {
  const [all, setAll] = useState(false);
  const id = useId();
  const cls = (i: number) => (all ? '' : i >= wide ? 'hidden' : i >= phone ? 'max-sm:hidden' : '');
  const needWide = count > wide;
  const needPhone = count > phone;
  const button =
    needWide || needPhone ? (
      <button
        type="button"
        aria-expanded={all}
        aria-controls={id}
        onClick={() => setAll((v) => !v)}
        className={cn(
          'mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 text-[13px] font-medium text-accent-text hover:underline sm:min-h-8',
          !all && !needWide && 'sm:hidden',
        )}
      >
        {all ? 'Show fewer' : `Show all ${count.toLocaleString('en-US')}`}
        <ChevronDown className={cn('size-4 transition-transform duration-200 ease-brand', all && 'rotate-180')} aria-hidden />
      </button>
    ) : null;
  return { all, cls, button, listId: id };
}

/** A phone-width screen (below md), followed as the window changes; false where there is no window (tests, server render). */
export function useIsPhone(): boolean {
  const q = '(max-width: 767px)';
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(q);
    const on = () => setPhone(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return phone;
}

/** review UX M6 (pass 2): a short in-page index under the hero, so the keyboard reaches a section (and the filters) in a few steps. */
export function KiIndex({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
      <span className="mr-1 text-xs text-ink-3">On this page:</span>
      {items.map((it) => (
        <a key={it.id} href={`#${it.id}`} className="inline-flex min-h-10 items-center rounded-md px-2 font-medium text-accent-text hover:bg-surface-2 hover:underline lg:min-h-8">
          {it.label}
        </a>
      ))}
    </nav>
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
