import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Activity, ArrowLeft, ArrowRight, Building2, CalendarClock, CheckCircle2, ClipboardList, Coins, Hand, ListOrdered, PenSquare, Play, Rocket, Route, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp, Wand2 } from 'lucide-react';
import {
  chooseForMe,
  COUNTRIES,
  estimateRunCost,
  formatUsd,
  GOALS,
  ladderOverlapsOf,
  MONITOR_COSTS,
  normKeyword,
  PLAN_CHOICE_LABEL,
  PLAN_ORDER_TEXT,
  TONES,
  type KeywordCheck,
  type LadderKeywords,
  type LadderMode,
  type PipelineData,
  type RecommendedKeywords,
  type SiteAutomation,
} from '@seo/shared';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/feedback';
import { ChoiceCard, Field, Input, Select } from '@/components/ui/field';
import { KeyValue, PageHeader } from '@/components/ui/misc';
import { Segmented, Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DifficultyBadge, PlanBadge } from '@/components/site/keyword';
import { isCountry } from '@/components/reports/meta';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useAssessKeyword, useRecommendedKeywords, useSiteData, useStartRun } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { IconTile } from '@/components/insight';
import { PipelineNotices, SubmitError, usePipelineNotices, validGoal, validTone } from '@/pages/tools/_components/kit';
import { MODE_HELP, MODE_OPTIONS } from './_components/pipeline/controls';
import { WarnLine } from './_components/pipeline/home';
import { fromCheck, fromRecommended, KeywordCard, Stepper, type ChosenKeyword } from './_components/pipeline/new-ladder';

// "New keyword ladder" (PIPELINE_FEATURE_SPEC.md §5.1): 1 choose the main keyword (recommended by the website's keyword research, or
// one the person has in mind, checked for about $0.05), 2 review the plan (plan type, the checks, Auto / Manual, priority, pages to
// write now, the business details used), 3 start the ladder run. The plan arrives on the Pipeline page in about 5-8 minutes.

const DEFAULT_AUTOMATION: SiteAutomation = { defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 };

export interface LadderChoices {
  /** null = the website's default mode */
  mode: LadderMode | null;
  first: boolean;
  pagesNow: 1 | 2 | 3;
}

const ladderKeywords = (d: PipelineData | undefined): LadderKeywords[] => (d?.ladders ?? []).map((l) => ({ id: l.id, head: l.head, keywords: l.keywords ?? l.planned.map((p) => p.keyword) }));

export default function NewLadderPage() {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const [params] = useSearchParams();
  const pipeline = useSiteData(org.id, site.id, 'pipeline', undefined, { staleTime: 30_000 });
  const recommended = useRecommendedKeywords(org.id, site.id);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [chosen, setChosen] = useState<ChosenKeyword | null>(null);
  const [choices, setChoices] = useState<LadderChoices>({ mode: null, first: false, pagesNow: 1 });
  const data = pipeline.isPlaceholderData ? undefined : pipeline.data;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const choose = (k: ChosenKeyword) => {
    setChosen(k);
    setStep(2);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link to={paths.site(org.id, site.id, 'pipeline')} className="group inline-flex items-center gap-1 transition-colors duration-150 ease-brand hover:text-accent-text">
            <ArrowLeft className="size-3.5 transition-transform duration-200 ease-brand group-hover:-translate-x-0.5" aria-hidden />
            Pipeline
          </Link>
        }
        icon={<TrendingUp />}
        title="New keyword ladder"
        description={`Pick the keyword you want ${site.domain} to rank for. We plan the pages from easy to hard for your website, write them and track them on Google.`}
        actions={
          can('member') && (
            <ButtonLink to={paths.tool(org.id, 'ladder', { siteId: site.id })} variant="ghost" size="sm" icon={<SlidersHorizontal className="size-4" />} title="Every field of the ladder tool, for SEO experts">
              Advanced form
            </ButtonLink>
          )
        }
      />
      <Stepper step={step} />
      {!can('member') && (
        <Callout tone="info" title="View-only access">
          You can look at the suggestions, but checking keywords and starting a ladder take the member role. Ask an admin of {org.name}.
        </Callout>
      )}

      {step === 1 && (
        <ChooseStep
          data={data}
          recommended={recommended}
          initialKeyword={params.get('keyword') ?? ''}
          initialCountry={params.get('country') ?? ''}
          initialTab={params.get('tab') === 'check' ? 'check' : params.get('tab') === 'recommended' ? 'recommended' : null}
          onChoose={choose}
        />
      )}
      {step === 2 && chosen && <ReviewStep chosen={chosen} data={data} choices={choices} setChoices={setChoices} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && chosen && <StartStep chosen={chosen} data={data} choices={choices} onBack={() => setStep(2)} />}
    </div>
  );
}

// ---------------- step 1: choose ----------------

function ChooseStep({
  data,
  recommended,
  initialKeyword,
  initialCountry,
  initialTab,
  onChoose,
}: {
  data: PipelineData | undefined;
  recommended: ReturnType<typeof useRecommendedKeywords>;
  initialKeyword: string;
  initialCountry: string;
  initialTab: 'recommended' | 'check' | null;
  onChoose: (k: ChosenKeyword) => void;
}) {
  const r = recommended.data;
  const preset = initialKeyword ? r?.keywords.find((k) => normKeyword(k.keyword) === normKeyword(initialKeyword)) : undefined;
  const [picked, setPicked] = useState<'recommended' | 'check' | null>(initialTab);
  // a keyword in the link: its card when it is one of the recommendations, else the check with the keyword filled in
  const tab = picked ?? (initialKeyword && !recommended.isPending && !preset ? 'check' : 'recommended');
  return (
    <Tabs value={tab} onValueChange={(v) => setPicked(v as 'recommended' | 'check')}>
      <TabList>
        <Tab value="recommended">
          <Sparkles className="size-4" aria-hidden />
          Recommended for you
        </Tab>
        <Tab value="check">
          <Search className="size-4" aria-hidden />
          I have a keyword in mind
        </Tab>
      </TabList>
      <TabPanel value="recommended">
        <Recommended recommended={recommended} preset={preset?.keyword ?? null} onChoose={onChoose} onCheckOwn={() => setPicked('check')} />
      </TabPanel>
      <TabPanel value="check">
        <CheckPanel initialKeyword={preset ? '' : initialKeyword} initialCountry={initialCountry} ladders={ladderKeywords(data)} onChoose={onChoose} />
      </TabPanel>
    </Tabs>
  );
}

function FindKeywordsLink({ label = 'Find keywords for me', variant = 'secondary' }: { label?: string; variant?: 'primary' | 'secondary' }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  if (!can('member')) return null;
  return (
    <ButtonLink to={paths.tool(org.id, 'discover', { siteId: site.id, prefill: { receiveReport: false } })} variant={variant} size="sm" icon={<Search className="size-4" />} title="Keyword research for your website: about $0.40 and 10 minutes">
      {label}
    </ButtonLink>
  );
}

function Recommended({ recommended, preset, onChoose, onCheckOwn }: { recommended: ReturnType<typeof useRecommendedKeywords>; preset: string | null; onChoose: (k: ChosenKeyword) => void; onCheckOwn: () => void }) {
  const { can } = useOrgCtx();
  const { site } = useSiteCtx();
  const [nothingToPick, setNothingToPick] = useState(false);
  const r: RecommendedKeywords | undefined = recommended.data;
  const country = r?.country ?? (isCountry(site.country) ? site.country : '');
  const list = useMemo(() => {
    const all = r?.keywords ?? [];
    const first = all.find((k) => k.keyword === preset);
    return first ? [first, ...all.filter((k) => k !== first)] : all;
  }, [r, preset]);

  if (recommended.isPending)
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  if (recommended.isError) return <ErrorState error={recommended.error} onRetry={() => void recommended.refetch()} />;
  if (!r?.reportId || !list.length)
    return (
      <Card>
        <EmptyState
          icon={<Search className="size-5" />}
          title={r?.reportId ? 'Your keyword research found nothing to suggest' : `No keyword suggestions for ${site.domain} yet`}
          description="Keyword research finds the searches your buyers use and rates each one for your website: easy, reachable or hard. It takes about 10 minutes and costs about $0.40. Or check a keyword you already have in mind."
          action={
            <>
              <FindKeywordsLink variant="primary" />
              <Button variant="secondary" size="sm" onClick={onCheckOwn}>
                I have a keyword in mind
              </Button>
            </>
          }
        />
      </Card>
    );

  const pickForMe = () => {
    const k = chooseForMe(list);
    if (!k) return setNothingToPick(true);
    onChoose(fromRecommended(k, country, 'chosen'));
    toast.success(`We chose “${k.keyword}”`, { description: 'The easiest suggestion for your website that no ladder covers yet. Review it before you start.' });
  };

  return (
    <div className="space-y-4">
      {r.stale && (
        <Callout tone="warning" title="These suggestions are getting old" action={<FindKeywordsLink label="Find fresh keywords" />}>
          They come from your keyword research of {fmtDate(r.receivedAt)}. Searches and your website have changed since; fresh research costs about $0.40.
        </Callout>
      )}
      <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile tone="solid" size="md">
            <Wand2 />
          </IconTile>
          <p className="min-w-0 max-w-2xl text-[13px] leading-snug text-ink-2">
            From your keyword research of <span className="font-medium text-ink">{fmtDate(r.receivedAt)}</span>, the best for your website first.
            {r.reach != null && (
              <>
                {' '}
                Your website already wins searches up to difficulty <span className="font-medium text-ink">{r.reach}</span>: anything near it is easy or reachable.
              </>
            )}
          </p>
        </div>
        <Button icon={<Wand2 className="size-4" />} onClick={pickForMe} disabled={!can('member')} className="self-start sm:self-center">
          Choose for me
        </Button>
      </div>
      {nothingToPick && (
        <Callout tone="info" title="Nothing to choose automatically">
          None of these is easy or reachable for your website and free of overlaps with your ladders. Pick one yourself, check a keyword you have in mind, or find fresh keywords.
        </Callout>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((k) => (
          <li key={k.keyword} className="min-w-0">
            <KeywordCard
              k={{ ...k, stretch: false, position: null }}
              ourPick={k.source === 'start_with'}
              selected={k.keyword === preset}
              onChoose={can('member') ? () => onChoose(fromRecommended(k, country, 'recommended')) : undefined}
            />
          </li>
        ))}
      </ul>
      {!r.stale && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          Want other ideas? <FindKeywordsLink label="Find new keywords" />
        </p>
      )}
    </div>
  );
}

function useElapsed(running: boolean): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return setS(0);
    const t0 = Date.now();
    const id = setInterval(() => setS(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);
  return s;
}

function CheckPanel({ initialKeyword, initialCountry, ladders, onChoose }: { initialKeyword: string; initialCountry: string; ladders: LadderKeywords[]; onChoose: (k: ChosenKeyword) => void }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const assess = useAssessKeyword(org.id, site.id);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [country, setCountry] = useState<string>(isCountry(initialCountry) ? initialCountry : isCountry(site.country) ? site.country : '');
  const [result, setResult] = useState<KeywordCheck | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const elapsed = useElapsed(assess.isPending);

  const check = (raw = keyword) => {
    const k = raw.trim().replace(/\s+/g, ' ');
    if (k.length < 2) return setFieldError('Enter a keyword of at least 2 characters');
    if (k.length > 100) return setFieldError('Keep the keyword under 100 characters');
    setKeyword(k);
    setFieldError(undefined);
    setResult(null);
    assess.mutate(
      { keyword: k, ...(country ? { country } : {}) },
      {
        onSuccess: setResult,
        onError: (e) => {
          if (e instanceof ApiRequestError && e.fields.keyword) setFieldError(e.fields.keyword);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <IconTile size="sm">
            <Search />
          </IconTile>
          <p className="text-[13px] leading-snug text-ink-2">Check how hard a keyword is for your website before you plan a ladder for it.</p>
        </div>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)_auto] sm:items-start"
        >
          <Field label="Your keyword" error={fieldError} hint="The search you want to rank for, as people type it.">
            {(p) => <Input {...p} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. e invoicing software uae" maxLength={100} autoComplete="off" />}
          </Field>
          <Field label="Country">
            {(p) => (
              <Select {...p} value={country} onChange={(e) => setCountry(e.target.value)}>
                {!country && <option value="">Choose a country</option>}
                {COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button type="submit" className="sm:mt-[1.6rem]" loading={assess.isPending} disabled={!can('member')} icon={<Search className="size-4" />}>
            Check it
          </Button>
        </form>
        <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-snug text-ink-3">
          <Coins className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            A check costs <span className="font-medium text-ink-2">about $0.05</span> (counted in your monthly budget) and takes up to 20 seconds. A keyword you checked in the last 7 days is shown again for
            free.
          </span>
        </p>
      </Card>

      {assess.isPending && (
        <Card className="flex flex-wrap items-center gap-3 p-5" aria-live="polite">
          <Spinner label={`Checking “${keyword}” on Google… ${elapsed} s`} />
          <span className="text-[13px] text-ink-3">Usually 5-20 seconds: search volume, difficulty, your current position and the topic.</span>
        </Card>
      )}
      {assess.isError && !fieldError && <CheckError error={assess.error} />}
      {result && !assess.isPending && <CheckResult check={result} ladders={ladders} onChoose={onChoose} onCheck={check} />}
    </div>
  );
}

function CheckError({ error }: { error: unknown }) {
  const { org, can } = useOrgCtx();
  if (error instanceof ApiRequestError && error.status === 402)
    return (
      <Callout
        tone="critical"
        title="This check would go over the monthly budget"
        action={
          can('owner') && (
            <ButtonLink to={paths.settings(org.id, 'usage')} variant="secondary" size="sm">
              Raise the budget
            </ButtonLink>
          )
        }
      >
        {error.message}
        {!can('owner') && ' Ask a company owner to raise the budget.'}
      </Callout>
    );
  if (error instanceof ApiRequestError && (error.status === 429 || error.status === 409))
    return (
      <Callout tone="warning" title={error.status === 409 ? 'Already being checked' : 'No more checks today'}>
        {error.message}
      </Callout>
    );
  return (
    <Callout tone="critical" title="Could not check this keyword">
      {errorMessage(error)}
    </Callout>
  );
}

function CheckResult({ check, ladders, onChoose, onCheck }: { check: KeywordCheck; ladders: LadderKeywords[]; onChoose: (k: ChosenKeyword) => void; onCheck: (k: string) => void }) {
  const { can } = useOrgCtx();
  const c = fromCheck(check, ladders);
  const r = check.result;
  const notRealistic = r.planType === 'none' || r.difficultyForYou === 'not_realistic';
  const offTopic = !notRealistic && r.fit === 0;
  return (
    <div className="max-w-3xl space-y-4" aria-live="polite">
      {notRealistic && (
        <Callout tone="critical" title={`“${c.keyword}” is not realistic for your website`}>
          {r.navigational
            ? 'People who search it are looking for one particular company or website: a page of yours would not be what they want.'
            : 'The check advises against a ladder for it.'}{' '}
          {r.alternatives.length ? 'Check one of the keywords below instead.' : 'Try a broader or more specific search about what you sell.'}
        </Callout>
      )}
      {offTopic && (
        <Callout tone="warning" title="This looks outside your business">
          Google rewards sites that stay on their topic: pages far from what you sell rank poorly and can pull the rest of your website down.
          {r.alternatives.length ? ' These keywords are closer to your business:' : ''}
        </Callout>
      )}
      {!notRealistic && r.difficultyForYou === 'very_hard' && (
        <Callout tone="info" title="Very hard for your website today">
          It is a long climb (a full ladder of easier pages first). An easier keyword usually brings visits sooner; you can still go for it.
        </Callout>
      )}
      <KeywordCard
        k={c}
        onChoose={can('member') && !notRealistic ? () => onChoose(c) : undefined}
        chooseLabel="Use this keyword"
        primary
        footer={
          <p className="mt-3 text-xs text-ink-3">
            {check.cached ? `Checked on ${fmtDate(check.createdAt)}: shown again for free.` : `Checked just now (${formatUsd(check.costUsd)}).`}
            {r.reach != null && ` Your website already wins searches up to difficulty ${r.reach}.`}
            {r.fit === 2 ? ' On your topic.' : r.fit === 1 ? ' Related to your business.' : r.fit == null ? ' The topic check was not available this time.' : ''}
          </p>
        }
      />
      {r.alternatives.length > 0 && (
        <section aria-labelledby="alternatives-heading">
          <h3 id="alternatives-heading" className="text-sm font-semibold text-ink">
            Keywords to check instead
          </h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {r.alternatives.map((a) => {
              const over = ladderOverlapsOf(a, ladders);
              return (
                <li key={a} className="min-w-0">
                  <Card className="flex h-full flex-col p-4">
                    <p className="break-words text-sm font-medium text-ink">{a}</p>
                    {over.length > 0 && <WarnLine className="mt-2">Your ladder “{over[0].head}” covers it already.</WarnLine>}
                    <div className="mt-auto pt-3">
                      <Button size="sm" variant="secondary" icon={<Search className="size-3.5" />} onClick={() => onCheck(a)} disabled={!can('member')}>
                        Check this one
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-3">Each check costs about $0.05.</p>
        </section>
      )}
    </div>
  );
}

// ---------------- step 2: review ----------------

/** about how many pages a plan type tracks (one live Google check each every Monday, about $0.015) */
const PAGES_OF: Record<string, number> = { direct: 4, short: 6, full: 12 };
const RANK_CHECK_USD = 0.015;

function Section({ title, description, icon, children }: { title: ReactNode; description?: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className={icon ? 'flex items-start gap-3' : undefined}>
        {icon && (
          <IconTile size="sm" className="mt-px">
            {icon}
          </IconTile>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

function ReviewStep({
  chosen,
  data,
  choices,
  setChoices,
  onBack,
  onNext,
}: {
  chosen: ChosenKeyword;
  data: PipelineData | undefined;
  choices: LadderChoices;
  setChoices: (c: LadderChoices) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const admin = can('admin');
  const cost = estimateRunCost('ladder', { pagesNow: choices.pagesNow });
  const notices = usePipelineNotices('ladder', site, { keyword: chosen.keyword }, cost);
  const automation = data?.automation ?? DEFAULT_AUTOMATION;
  const mode = choices.mode ?? automation.defaultMode;
  const cards = data?.ladderCards ?? [];
  const active = cards.filter((c) => c.mode === 'auto' && !['paused', 'won', 'queued'].includes(c.status) && c.counts.planned > 0).length;
  const spent = data?.summary.spendThisMonthUsd ?? null;
  const budget = data?.summary.budgetUsd ?? org.monthlyBudgetUsd;
  const over = spent != null && spent + cost > budget;
  const plan = chosen.planType && chosen.planType !== 'none' ? chosen.planType : null;
  const monthly = Math.round((PAGES_OF[plan ?? 'short'] ?? 6) * RANK_CHECK_USD * MONITOR_COSTS.weeksPerMonth * 100) / 100;
  const blocked = notices.unconfirmed.length ? 'Tick the box in the warning above to continue.' : over ? 'This would go over the monthly budget.' : null;
  const goal = GOALS.find((g) => g.value === site.goal)?.label ?? site.goal;
  const nav = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
        Back
      </Button>
      <Button onClick={onNext} disabled={!!blocked || !can('member')} icon={<ArrowRight className="size-4" />}>
        Continue
      </Button>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <Section icon={<Route />} title="The plan" description={chosen.how === 'chosen' ? 'Chosen for you: the easiest suggestion for your website that no ladder covers yet.' : undefined}>
          <div>
            <p className="text-xs font-medium text-ink-3">Main keyword</p>
            <p className="mt-0.5 break-words font-display text-2xl font-semibold tracking-[-0.01em] text-ink">{chosen.keyword}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <DifficultyBadge difficulty={chosen.difficultyForYou} />
              <PlanBadge plan={chosen.planType} months={chosen.months} stretch={chosen.stretch} />
              <Badge>{chosen.country}</Badge>
            </div>
          </div>
          {plan ? (
            <div className="rounded-lg border border-accent/20 bg-accent-soft/40 p-4 text-sm leading-relaxed text-ink-2">
              <p>
                <span className="font-medium text-ink">{PLAN_CHOICE_LABEL[plan]}:</span> {PLAN_ORDER_TEXT[plan]}
              </p>
              {chosen.months && (
                <p className="mt-1">
                  Expected: about <span className="font-medium text-ink">{chosen.months.replace('-', '–')} months</span> until the main keyword ranks. Most pages need a few months on Google; the easy ones move first.
                </p>
              )}
              {chosen.stretch && <p className="mt-1">Very hard for your website today: the climb is long; an easier keyword first usually brings visits sooner.</p>}
            </div>
          ) : (
            <p className="rounded-lg bg-surface-2/60 p-4 text-sm leading-relaxed text-ink-2">
              The plan is chosen when the ladder is planned, from what your website already ranks for: <span className="font-medium text-ink">Direct</span> when the keyword is already easy for it
              (main page first), a <span className="font-medium text-ink">Short ladder</span> when it is within reach, a <span className="font-medium text-ink">Full ladder</span> when it is hard.
            </p>
          )}
          {chosen.why && <p className="text-[13px] leading-snug text-ink-2">Why it fits: {chosen.why}</p>}
        </Section>

        <Section icon={<ShieldCheck />} title="Checks" description="What we looked at before this ladder starts.">
          <PipelineNotices notices={notices.notices} acked={notices.acked} onToggle={notices.toggle} siteId={site.id} />
          {chosen.fit === 0 ? (
            <Callout tone="warning" title="This looks outside your business">
              Google rewards sites that stay on their topic. You can still start it; a keyword closer to what you sell usually does better.
            </Callout>
          ) : (
            <CheckLine ok title="Topic">
              {chosen.fit === 2
                ? 'On your topic: the check rates it as core to your business.'
                : chosen.fit === 1
                  ? 'Related to your business.'
                  : chosen.how === 'checked'
                    ? 'The topic check was not available: make sure it matches what you sell.'
                    : 'From your keyword research, which keeps to searches relevant to your business.'}
            </CheckLine>
          )}
          {over ? (
            <Callout
              tone="critical"
              title="This would go over your monthly budget"
              action={
                can('owner') && (
                  <ButtonLink to={paths.settings(org.id, 'usage')} variant="secondary" size="sm">
                    Raise the budget
                  </ButtonLink>
                )
              }
            >
              About {formatUsd(cost)} now, and {formatUsd(spent)} of {formatUsd(budget)} is used this month. Write fewer pages now, or {can('owner') ? 'raise the budget' : 'ask an owner to raise the budget'}.
            </Callout>
          ) : (
            <CheckLine ok title="Budget">
              About {formatUsd(cost)} now{spent != null ? `; ${formatUsd(spent)} of your ${formatUsd(budget)} is used this month` : ''}. After that about {formatUsd(monthly)} a month for its weekly rank checks; its
              pages use your weekly posts.
            </CheckLine>
          )}
        </Section>

        <Section icon={<Settings2 />} title="How it runs">
          {admin ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Writing its pages</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{MODE_HELP[mode]} The default for new ladders is {automation.defaultMode === 'manual' ? 'Manual' : 'Auto'}.</p>
                </div>
                <Segmented label="Writing mode of the new ladder" value={mode} onChange={(m) => setChoices({ ...choices, mode: m })} options={MODE_OPTIONS('md')} className="shrink-0 self-start" />
              </div>
              {cards.length > 0 && (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">Priority</p>
                  <div role="radiogroup" aria-label="Priority" className="grid gap-2 sm:grid-cols-2">
                    <ChoiceCard
                      selected={!choices.first}
                      onSelect={() => setChoices({ ...choices, first: false })}
                      title="After my current ladders"
                      description={`Number ${cards.length + 1}: the ladders ahead of it get the weekly posts first.${active >= automation.maxActiveLadders ? ' It waits as Queued until one of them is done or paused.' : ''}`}
                    />
                    <ChoiceCard selected={choices.first} onSelect={() => setChoices({ ...choices, first: true })} title="Write it first" description="Number 1: your other ladders move down one place." />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] leading-snug text-ink-2">
              It follows the website’s defaults: {automation.defaultMode === 'manual' ? 'Manual (each page waits for an OK)' : 'Auto (its pages are written on Mondays)'}, after the current ladders. An
              admin can change both on the Pipeline page.
            </p>
          )}
        </Section>

        <Section icon={<PenSquare />} title="Pages to write now" description="The plan costs about $0.60; each page written now adds about $1.20 and 10 minutes and arrives as its own report. The rest follow on Mondays.">
          <div role="radiogroup" aria-label="Pages to write now" className="grid gap-2 sm:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <ChoiceCard
                key={n}
                selected={choices.pagesNow === n}
                onSelect={() => setChoices({ ...choices, pagesNow: n })}
                title={`${n} page${n === 1 ? '' : 's'}`}
                badge={<Badge>{formatUsd(estimateRunCost('ladder', { pagesNow: n }))} in total</Badge>}
                description={n === 1 ? (plan === 'direct' ? 'The main page first' : 'Start small: publish it, then continue') : n === 2 ? 'Two pages in parallel' : 'A fast start'}
              />
            ))}
          </div>
        </Section>

        <Section
          icon={<Building2 />}
          title="Your business details"
          description="The plan and the pages use these website settings."
        >
          {!site.business.trim() && <WarnLine>Add what you sell: without it the pages describe your business only from your homepage.</WarnLine>}
          <KeyValue
            items={[
              { label: 'What you sell', value: site.business || <span className="text-ink-3">Not set</span> },
              { label: 'Who buys it', value: site.customers || <span className="text-ink-3">Not set</span> },
              { label: 'Goal', value: goal },
              { label: 'Tone', value: site.tone },
              { label: 'Call to action', value: site.cta || <span className="text-ink-3">Not set</span> },
              { label: 'Business facts', value: site.businessFacts ? `${site.businessFacts.slice(0, 180)}${site.businessFacts.length > 180 ? '…' : ''}` : <span className="text-ink-3">Not set</span> },
            ]}
          />
          {admin && (
            <Link to={paths.site(org.id, site.id, 'settings/business')} className="inline-block text-[13px] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
              Edit them in Website settings
            </Link>
          )}
        </Section>
        <div className="lg:hidden">{nav}</div>
      </div>
      <aside className="hidden lg:block">
        <Card className="sticky top-6 space-y-4 border-accent/30 p-5 shadow-raised">
          <h2 className="flex items-center gap-2.5 font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
            <IconTile size="sm" tone="solid">
              <ClipboardList />
            </IconTile>
            Summary
          </h2>
          <KeyValue
            className="text-[13px]"
            items={[
              { label: 'Keyword', value: chosen.keyword },
              { label: 'Plan', value: plan ? `${PLAN_CHOICE_LABEL[plan]}${chosen.months ? `, ${chosen.months.replace('-', '–')} months` : ''}` : 'Chosen when planned' },
              { label: 'Writing', value: mode === 'manual' ? 'Manual' : 'Auto' },
              { label: 'Now', value: <span className="font-display text-base font-semibold text-accent-text">{formatUsd(cost)}</span> },
            ]}
          />
          {blocked && <p className="text-xs text-ink-3">{blocked}</p>}
          {nav}
        </Card>
      </aside>
    </div>
  );
}

function CheckLine({ ok, title, children }: { ok: boolean; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] leading-snug">
      <IconTile size="xs" tone={ok ? 'good' : 'warning'}>
        <CheckCircle2 />
      </IconTile>
      <p className="min-w-0 pt-0.5 text-ink-2">
        <span className="font-medium text-ink">{title}: </span>
        {children}
      </p>
    </div>
  );
}

// ---------------- step 3: start ----------------

function StartStep({ chosen, data, choices, onBack }: { chosen: ChosenKeyword; data: PipelineData | undefined; choices: LadderChoices; onBack: () => void }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const start = useStartRun(org.id);
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const automation = data?.automation ?? DEFAULT_AUTOMATION;
  const mode = choices.mode ?? automation.defaultMode;
  const cost = estimateRunCost('ladder', { pagesNow: choices.pagesNow });
  const admin = can('admin');
  // only what differs from what the engine does anyway (the website's default mode, after the current ladders); admins only
  const prefs = admin ? { ...(choices.mode && choices.mode !== automation.defaultMode ? { mode: choices.mode } : {}), ...(choices.first ? { first: true } : {}) } : {};
  const plan = chosen.planType && chosen.planType !== 'none' ? chosen.planType : null;

  const go = () => {
    setError(null);
    start.mutate(
      {
        mode: 'ladder',
        siteId: site.id,
        keyword: chosen.keyword,
        country: chosen.country,
        // empty = the website's own settings (the server fills them in)
        business: '',
        customers: '',
        businessFacts: '',
        cta: '',
        goal: validGoal(site.goal) ?? 'leads',
        tone: validTone(site.tone) ?? TONES[0],
        pagesNow: choices.pagesNow,
        emailCopy: false,
        ...(Object.keys(prefs).length ? { ladderPrefs: prefs } : {}),
      },
      {
        onSuccess: (run) => {
          if (run.status === 'failed') {
            toast.error('The SEO engine did not accept this ladder', { description: run.error ?? undefined });
            navigate(paths.run(org.id, run.id));
            return;
          }
          toast.success(`Planning your ladder “${chosen.keyword}”`, { description: 'It shows on the Pipeline in about 5-8 minutes; the first pages follow as reports.' });
          navigate(paths.site(org.id, site.id, 'pipeline'));
        },
        onError: setError,
      },
    );
  };

  return (
    <div className="max-w-2xl space-y-5">
      <SubmitError error={error} siteId={site.id} />
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-3 font-display text-lg font-semibold tracking-[-0.01em] text-ink">
          <IconTile tone="solid" size="md">
            <Rocket />
          </IconTile>
          Ready to start
        </h2>
        <KeyValue
          className="mt-5"
          items={[
            { label: 'Main keyword', value: <span className="font-medium">{chosen.keyword}</span> },
            { label: 'Country', value: chosen.country },
            { label: 'Plan', value: plan ? `${PLAN_CHOICE_LABEL[plan]}${chosen.months ? `, about ${chosen.months.replace('-', '–')} months` : ''}` : 'Chosen when it is planned' },
            { label: 'Pages written now', value: String(choices.pagesNow) },
            { label: 'Writing', value: mode === 'manual' ? 'Manual: each next page waits for your OK' : 'Auto: its next pages are written on Mondays' },
            ...(admin && (data?.ladderCards.length ?? 0) > 0 ? [{ label: 'Priority', value: choices.first ? 'Number 1 (written first)' : 'After your current ladders' }] : []),
          ]}
        />
        <div className="mt-5 rounded-lg border border-line bg-surface-2/40 p-4">
          <p className="text-sm font-medium text-ink">What happens next</p>
          <ol className="relative mt-3 space-y-3 text-[13px] leading-snug text-ink-2 before:absolute before:top-3 before:bottom-3 before:left-[0.875rem] before:w-px before:bg-line">
            {[
              { icon: <ListOrdered />, text: 'The plan is made now, in about 5-8 minutes. Until then the ladder shows on your Pipeline as Planning.' },
              {
                icon: <PenSquare />,
                text:
                  choices.pagesNow === 1
                    ? 'The first page is written right away (about 10 minutes) and arrives as a report, ready to publish on your website.'
                    : `The first ${choices.pagesNow} pages are written right away (about 10 minutes each) and arrive as reports, ready to publish on your website.`,
              },
              { icon: mode === 'manual' ? <Hand /> : <CalendarClock />, text: mode === 'manual' ? 'Each next page waits for your OK under Needs you.' : 'Its next pages are written on Mondays, in priority order with your other ladders.' },
              { icon: <Activity />, text: 'Every Monday the rank check follows its pages on Google.' },
            ].map((x, i) => (
              <li key={i} className="relative flex items-start gap-3">
                <IconTile size="sm" className="relative z-[1] ring-4 ring-surface">
                  {x.icon}
                </IconTile>
                <span className="min-w-0 pt-1">
                  <span className="sr-only">{i + 1}. </span>
                  {x.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-xs text-ink-3">Cost now</p>
            <p className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink">about {formatUsd(cost)}</p>
            <p className="text-xs text-ink-3">Counted in your company’s monthly budget</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={onBack} disabled={start.isPending}>
              Back
            </Button>
            <Button size="lg" icon={<Play className="size-4" />} loading={start.isPending} disabled={!can('member')} onClick={go}>
              Start the ladder
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
