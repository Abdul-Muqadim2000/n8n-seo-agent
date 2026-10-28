// Onboarding "Your first keyword" (SCHEDULING_KEYWORDS_PLAN.md §5.2, §5.5): what a customer would type into Google, checked one by one;
// keyword suggestions from the research that started at the business step; the owner picks one keyword (two at most), says how pages
// are written for it, and how much the autopilot may do on its own. Nothing is started here: the launch step starts it all.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Bot, Hand, Lightbulb, PenSquare, Search, Sparkles, X, Zap } from 'lucide-react';
import { AUTOPILOT_LEVELS, autopilotMonthlyUsd, checkEvidenceLines, DEFAULT_AUTOPILOT_LEVEL, type AutopilotLevel, type KeywordCheck, type RecommendedKeyword } from '@seo/shared';
import { chanceWords, KeywordChoiceCard, type KeywordChoice } from '@/components/site/KeywordChoiceCard';
import { asCountry } from '@/components/site/helpers';
import { trackDefaults } from '@/components/site/TrackingForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Spinner } from '@/components/ui/feedback';
import { ChoiceCard, Field, Input } from '@/components/ui/field';
import { IconTile } from '@/components/insight';
import { ApiRequestError, errorMessage, isConfirmCancelled } from '@/lib/api';
import { creditsLabel } from '@/lib/credits';
import { siteWeekdayName, todayWeekdayName } from '@/lib/cycle-day';
import { useEngineCal } from '@/lib/engine-cal';
import { PRICES } from '@/lib/prices';
import { useAssessKeyword, useRecommendedKeywords, useSiteData, useStartResearch } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { StepFrame } from './WizardShell';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { GuideButton } from '@/components/guide';
import { autopilotGuideVars } from '@/lib/guide-vars';
import { MAX_PICKS, readKeywordDraft, readTrackingDraft, useWizardSite, writeKeywordDraft, type KeywordDraft, type KeywordPick } from './wizard';

/** Up to this many typed ideas are checked. */
const MAX_IDEAS = 3;
/** Up to this many suggestions are shown. */
const MAX_SUGGESTIONS = 6;

interface Idea {
  keyword: string;
  state: 'checking' | 'done' | 'error';
  check?: KeywordCheck;
  error?: string;
}

const LEVEL_ICON: Record<AutopilotLevel, ReactNode> = { 1: <Hand className="size-4" />, 2: <PenSquare className="size-4" />, 3: <Bot className="size-4" /> };

/** A checked keyword that should not be started as it is: off topic, a search for one particular company, or not realistic now. */
function poorFit(c: KeywordCheck): string | null {
  const r = c.result;
  if (r.fit === 0) return 'This looks outside what you sell, so we would not write for it.';
  if (r.navigational) return 'People who search this are looking for one particular company or website.';
  if (r.difficultyForYou === 'not_realistic' || r.planType === 'none') return 'This is not realistic for your website right now.';
  return null;
}

const choiceOfCheck = (c: KeywordCheck): KeywordChoice => ({
  keyword: c.result.keyword || c.keyword,
  volume: c.result.volume,
  difficultyForYou: c.result.difficultyForYou,
  planType: c.result.planType,
  months: c.result.months,
  why: c.result.position != null ? `Your website already shows up at position ${c.result.position} for it.` : '',
});
const choiceOfRec = (k: RecommendedKeyword): KeywordChoice => ({ keyword: k.keyword, volume: k.volume, difficultyForYou: k.difficultyForYou, planType: k.planType, months: k.months, why: k.why, note: k.note });
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The ideas after a check the person cancelled in "Check this first": the card being checked goes back to what it was (a re-check or an
 * alternative put back in place of `prev`), a new idea is taken off the list; every other card is untouched. Exported for tests.
 */
export function undoIdeaCheck<T extends { keyword: string }>(list: readonly T[], keyword: string, prev?: T): T[] {
  return prev ? list.map((i) => (same(i.keyword, keyword) ? prev : i)) : list.filter((i) => !same(i.keyword, keyword));
}

export function KeywordStep() {
  const { org, site, go } = useWizardSite();
  useEngineCal(org.id);
  const verified = !!site.verifiedAt;
  const draft0 = useMemo(() => readKeywordDraft(site.id), [site.id]);
  const [picks, setPicks] = useState<KeywordPick[]>(draft0?.picks ?? []);
  const [level, setLevel] = useState<AutopilotLevel>(draft0?.level ?? DEFAULT_AUTOPILOT_LEVEL);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [text, setText] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const assess = useAssessKeyword(org.id, site.id);
  const rec = useRecommendedKeywords(org.id, site.id, { enabled: verified, poll: true });
  const research = useStartResearch(org.id, site.id);
  const [researchNote, setResearchNote] = useState<string | null>(null);
  const settings = useSiteData(org.id, site.id, 'settings', undefined, { enabled: verified });

  // the weekday pages are written on: the website's own once tracking runs, else today (its cycle starts the day setup is finished)
  const weekday = siteWeekdayName(site) ?? todayWeekdayName();

  // keep the choices until launch (this browser)
  useEffect(() => {
    writeKeywordDraft(site.id, { picks, later: false, level });
  }, [site.id, picks, level]);

  // the monthly forecast of each level, from the tracking choices as they stand (the same rows as the settings and the Credits page)
  const plan = useMemo(() => {
    const d = readTrackingDraft(site.id);
    if (d) return { ...d, country: asCountry(site.country) ?? d.country };
    return trackDefaults(site, { monitors: settings.data?.monitors ?? undefined, blogsPerWeek: settings.data?.cadence?.pagesPerWeek });
  }, [site, settings.data]);
  const perWeek = Math.max(1, plan.blogsPerWeek || 1);
  const forecast = (l: AutopilotLevel) => autopilotMonthlyUsd(plan.monitors, perWeek, { level: l, writing: picks.some((p) => p.mode === 'auto') });

  const isPicked = (k: string) => picks.some((p) => same(p.keyword, k));
  const full = picks.length >= MAX_PICKS;
  const toggle = (c: KeywordChoice, chosenBy: KeywordPick['chosenBy']) => {
    if (isPicked(c.keyword)) return setPicks((ps) => ps.filter((p) => !same(p.keyword, c.keyword)));
    if (full) return;
    setPicks((ps) => [...ps, { ...c, chosenBy, mode: 'auto' }]);
  };
  const setMode = (k: string, mode: KeywordPick['mode']) => setPicks((ps) => ps.map((p) => (same(p.keyword, k) ? { ...p, mode } : p)));

  const check = async (keyword: string, replace?: string) => {
    const prev = replace ? ideas.find((i) => same(i.keyword, replace)) : undefined;
    setIdeas((list) => {
      const rest = replace ? list.map((i) => (same(i.keyword, replace) ? { keyword, state: 'checking' as const } : i)) : [...list, { keyword, state: 'checking' as const }];
      return rest;
    });
    try {
      const c = await assess.mutateAsync({ keyword });
      setIdeas((list) => list.map((i) => (same(i.keyword, keyword) ? { keyword, state: 'done', check: c } : i)));
    } catch (e) {
      // Cancel in "Check this first" (409 confirm_needed): nothing was checked or charged; the cards are as they were, a new idea goes back
      // in the box, and no error is shown
      if (isConfirmCancelled(e)) {
        setIdeas((list) => undoIdeaCheck(list, keyword, prev));
        if (!replace) setText(keyword);
        return;
      }
      setIdeas((list) => list.map((i) => (same(i.keyword, keyword) ? { keyword, state: 'error', error: errorMessage(e) } : i)));
    }
  };

  const submitIdea = (e: FormEvent) => {
    e.preventDefault();
    const k = text.trim().replace(/\s+/g, ' ');
    if (k.length < 2) return setTextError('Type at least 2 characters');
    if (k.length > 100) return setTextError('Use at most 100 characters');
    if (ideas.some((i) => same(i.keyword, k))) return setTextError('You already checked this one');
    if (ideas.length >= MAX_IDEAS) return setTextError(`You can check up to ${MAX_IDEAS} ideas here. Remove one to check another.`);
    setTextError(null);
    setText('');
    void check(k);
  };

  const findForMe = () =>
    research.mutate(undefined, {
      onSuccess: (r) => setResearchNote(r.started || r.status === 'running' ? null : r.status === 'ready' ? null : 'The research could not start right now. Type your own keyword, or choose later.'),
      onError: (e) =>
        setResearchNote(
          e instanceof ApiRequestError && e.code === 'research_not_free'
            ? 'The free keyword research of this website was already used. Type your own keyword here, or choose later and start a new research from the Pipeline.'
            : errorMessage(e),
        ),
    });

  const r = rec.data;
  const status = r?.status ?? (r?.reportId ? 'ready' : 'none');
  const suggestions = (r?.keywords ?? []).filter((k) => k.difficultyForYou !== 'not_realistic' && k.planType !== 'none' && !k.overlaps.length).slice(0, MAX_SUGGESTIONS);

  const guideVars = autopilotGuideVars(site, { level });
  const persist = (d: KeywordDraft) => writeKeywordDraft(site.id, d);
  const canContinue = picks.length > 0 || level === 3;
  const next = () => {
    persist({ picks, later: picks.length === 0, level });
    go('tracking');
  };
  const later = () => {
    persist({ picks: [], later: true, level });
    go('tracking');
  };

  return (
    <StepFrame
      step="keyword"
      title="Your first keyword"
      description="Choose the search you most want to be found for. We only write pages for keywords you choose, so this is the most important choice of the setup."
      why={
        <>
          <strong className="font-medium text-ink">Not sure?</strong> Pick the suggestion with the best chance. You can add more keywords later from the Pipeline, and
          nothing is written until you finish the setup.
        </>
      }
      back={() => go('profile')}
      skip={{ label: "I'll choose later", onClick: later }}
      primary={{ label: picks.length ? 'Continue with this choice' : 'Continue', onClick: next, disabled: !canContinue }}
      note={!canContinue ? 'Choose a keyword, or choose later.' : undefined}
    >
      <div className="space-y-9">
        {!verified && (
          <Callout tone="warning" title={`Verify ${site.domain} to check keywords`}>
            Keyword checks and suggestions read your website's data, so they open once ownership is confirmed. You can choose later from the Pipeline.
          </Callout>
        )}

        {/* 1. their own words */}
        <section aria-labelledby="kw-own" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 id="kw-own" className="min-w-0 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
              What would a customer type into Google to find a business like yours?
            </h2>
            <GuideButton id={AUTOPILOT_SCREEN_GUIDES.onboardingKeyword} vars={guideVars} label="How to choose" />
          </div>
          <form onSubmit={submitIdea} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Field
              className="min-w-0 flex-1"
              label={<span className="sr-only">A search a customer would type</span>}
              hint={`Up to ${MAX_IDEAS} ideas. Each check takes 5 to 20 seconds and uses about ${PRICES.check()} (free if checked in the last few hours).`}
              error={textError ?? undefined}
            >
              {(p) => <Input {...p} value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="For example: accounting software for small business" disabled={!verified} />}
            </Field>
            <Button type="submit" variant="secondary" icon={<Search className="size-4" />} disabled={!verified || !text.trim()} className="sm:mt-0">
              Check it
            </Button>
          </form>
          {ideas.length > 0 && (
            <ul className="grid gap-3 md:grid-cols-2" aria-label="Your ideas" aria-live="polite">
              {ideas.map((i) => (
                <li key={i.keyword} className="min-w-0">
                  {i.state === 'checking' ? (
                    <div className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface-2/60 p-4">
                      <p className="font-display text-[15px] font-semibold text-ink">{i.keyword}</p>
                      <Spinner className="text-[13px]" label="Checking your chances. This takes 5 to 20 seconds." />
                    </div>
                  ) : i.state === 'error' ? (
                    <div className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-4">
                      <p className="font-display text-[15px] font-semibold text-ink">{i.keyword}</p>
                      <p className="flex items-start gap-1.5 text-[13px] text-critical-text">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {i.error}
                      </p>
                      <div className="mt-auto flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => void check(i.keyword, i.keyword)}>
                          Try again
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setIdeas((l) => l.filter((x) => x !== i))}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <IdeaCard
                      idea={i}
                      picked={isPicked(choiceOfCheck(i.check!).keyword)}
                      full={full}
                      onToggle={() => toggle(choiceOfCheck(i.check!), 'client_typed')}
                      onAlternative={(alt) => void check(alt, i.keyword)}
                      onRemove={() => {
                        setIdeas((l) => l.filter((x) => x !== i));
                        setPicks((ps) => ps.filter((p) => !same(p.keyword, choiceOfCheck(i.check!).keyword)));
                      }}
                      checking={ideas.some((x) => x.state === 'checking')}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 2. our suggestions */}
        <section aria-labelledby="kw-suggest" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="kw-suggest" className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
              <Sparkles className="size-4 text-accent-text" aria-hidden />
              Suggest keywords for me
            </h2>
            {verified && status === 'none' && !rec.isPending && (
              <Button size="sm" variant="secondary" loading={research.isPending} onClick={findForMe} icon={<Lightbulb className="size-4" />}>
                Find keywords for me
              </Button>
            )}
          </div>
          {!verified ? (
            <p className="text-sm text-ink-3">Suggestions appear here once the website is verified.</p>
          ) : rec.isPending ? (
            <Spinner className="text-[13px]" label="Looking for your suggestions" />
          ) : status === 'running' ? (
            <div className="flex items-start gap-3 rounded-xl border border-accent/20 bg-accent-soft/60 px-4 py-3.5" role="status">
              <Spinner className="mt-0.5" />
              <p className="text-[13px] leading-relaxed text-ink-2">
                <span className="font-medium text-ink">We are finding keywords for {site.domain}.</span> This takes about 2 minutes and the suggestions appear here on their
                own. Meanwhile you can type your own idea above.
              </p>
            </div>
          ) : status === 'none' ? (
            <p className="text-[13px] leading-relaxed text-ink-3">
              {researchNote ?? 'No suggestions yet. Find keywords for me looks at what your business sells and what people search, and takes about 2 minutes.'}
            </p>
          ) : !suggestions.length ? (
            <p className="text-[13px] leading-relaxed text-ink-3">The research found no keyword we would recommend for your website right now. Type your own idea above, or choose later.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" aria-label="Suggested keywords">
              {suggestions.map((k, idx) => (
                <li key={k.keyword} className="min-w-0">
                  <KeywordChoiceCard
                    k={choiceOfRec(k)}
                    ourPick={idx === 0}
                    selected={isPicked(k.keyword)}
                    disabled={full}
                    disabledReason={`You can choose up to ${MAX_PICKS} keywords to start with`}
                    onToggle={() => toggle(choiceOfRec(k), 'client_picked')}
                  />
                </li>
              ))}
            </ul>
          )}
          {researchNote && status !== 'none' && <p className="text-[13px] text-ink-3">{researchNote}</p>}
        </section>

        {/* 3. how pages are written for each chosen keyword */}
        {picks.length > 0 && (
          <section aria-labelledby="kw-how" className="space-y-3">
            <h2 id="kw-how" className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
              How should we write for {picks.length === 1 ? 'this keyword' : 'these keywords'}?
            </h2>
            <ul className="space-y-4">
              {picks.map((p) => (
                <li key={p.keyword} className="rounded-xl border border-line bg-surface-2/40 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 break-words font-display text-[15px] font-semibold text-ink">{p.keyword}</p>
                    <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setPicks((ps) => ps.filter((x) => x !== p))} aria-label={`Remove ${p.keyword}`}>
                      Remove
                    </Button>
                  </div>
                  <div role="radiogroup" aria-label={`How pages are written for ${p.keyword}`} className="grid gap-2 sm:grid-cols-2">
                    <ChoiceCard
                      selected={p.mode === 'auto'}
                      onSelect={() => setMode(p.keyword, 'auto')}
                      icon={<Zap className="size-4" />}
                      title="Write a page each week"
                      badge={<Badge tone="accent">Recommended</Badge>}
                      description={`Choosing the keyword is your OK. A new page is written every ${weekday}, easy pages first.`}
                    />
                    <ChoiceCard
                      selected={p.mode === 'manual'}
                      onSelect={() => setMode(p.keyword, 'manual')}
                      icon={<Hand className="size-4" />}
                      title="Ask me before each page"
                      description={`Every ${weekday} the next page waits for your OK. Nothing is written for it until you say so.`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 4. how much we do on our own */}
        <section aria-labelledby="kw-level" className="space-y-3">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 id="kw-level" className="min-w-0 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                How much should we do on our own?
              </h2>
              <GuideButton id={AUTOPILOT_SCREEN_GUIDES.onboardingLevel} vars={guideVars} label="What each level does" />
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
              Whatever you choose, two days before each week we show you what is coming up, and you can skip anything. You can change this any time in Website settings.
            </p>
          </div>
          <div role="radiogroup" aria-labelledby="kw-level" className="grid gap-2">
            {AUTOPILOT_LEVELS.map((l) => (
              <ChoiceCard
                key={l.level}
                selected={level === l.level}
                onSelect={() => setLevel(l.level)}
                icon={LEVEL_ICON[l.level]}
                title={`${l.level}. ${l.label}`}
                badge={l.level === DEFAULT_AUTOPILOT_LEVEL ? <Badge tone="accent">Recommended</Badge> : undefined}
                description={
                  <>
                    {l.summary}
                    <span className="mt-1 block text-ink-3">About {creditsLabel(forecast(l.level))} a month with your tracking choices.</span>
                  </>
                }
              />
            ))}
          </div>
          {level === 3 && !picks.length && (
            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
              <IconTile size="sm">
                <Bot />
              </IconTile>
              <p className="pt-0.5">
                <span className="font-medium text-ink">Choosing a keyword is optional at this level.</span> We'll choose one from the research and tell you first: it starts two
                days after we announce it, unless you change or skip it.
              </p>
            </div>
          )}
        </section>
      </div>
    </StepFrame>
  );
}

/** One checked idea: its chances, or why it does not fit and the check's own alternatives. */
function IdeaCard({
  idea,
  picked,
  full,
  onToggle,
  onAlternative,
  onRemove,
  checking,
}: {
  idea: Idea;
  picked: boolean;
  full: boolean;
  onToggle: () => void;
  onAlternative: (keyword: string) => void;
  onRemove: () => void;
  checking: boolean;
}) {
  const c = idea.check!;
  const bad = poorFit(c);
  const choice = choiceOfCheck(c);
  if (bad)
    return (
      <div className="flex h-full flex-col gap-2 rounded-xl border border-warning/40 bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words font-display text-[15px] font-semibold text-ink">{choice.keyword}</p>
          <Button size="icon" variant="ghost" className="size-7" onClick={onRemove} aria-label={`Remove ${choice.keyword}`}>
            <X className="size-4" />
          </Button>
        </div>
        <p className="flex items-start gap-1.5 text-[13px] leading-snug text-warning-text">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {bad}
        </p>
        {c.result.alternatives.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[13px] text-ink-2">Try one of these instead:</p>
            <ul className="flex flex-wrap gap-1.5">
              {c.result.alternatives.slice(0, 5).map((a) => (
                <li key={a}>
                  <button
                    type="button"
                    disabled={checking}
                    onClick={() => onAlternative(a)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-150 ease-brand hover:border-accent-text/60 hover:text-accent-text disabled:opacity-60"
                  >
                    <Search className="size-3" aria-hidden />
                    {a}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] text-ink-3">Try a more specific search, for example with your service and your city.</p>
        )}
      </div>
    );
  return (
    <KeywordChoiceCard
      k={choice}
      selected={picked}
      disabled={full}
      disabledReason={`You can choose up to ${MAX_PICKS} keywords to start with`}
      onToggle={onToggle}
    >
      {!chanceWords(choice.difficultyForYou) && <p className="text-xs text-ink-3">We could not rate your chances yet; the plan rates them when it starts.</p>}
      {/* KW-APP (2026-10-21): which page of yours the check matched, and a results page reused from earlier today */}
      {checkEvidenceLines(c.result).map((line) => (
        <p key={line} className="text-xs text-ink-3">
          {line}
        </p>
      ))}
    </KeywordChoiceCard>
  );
}
