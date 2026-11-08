// Competitors (KI 2026-11-08, n8n/seo-agent/docs/keyword-intel-2026-11-08/DESIGN.md §6): who this website really competes with in its
// market, found in Google's own results for its services, each with the reason; the client picks up to five to follow, keeps others on a
// watchlist and marks the ones that are not competitors; the gaps against the chosen set with the action and its credits; the lists and
// directories to join; AI share of voice. Shown only where the website's KI is visible (On, or Trial for platform admins).
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Ban, Download, Eye, ListChecks, MoreHorizontal, Star, Swords, Target, Trophy, Undo2 } from 'lucide-react';
import { KI_CLASSES, KI_GAP_TYPES, KI_KEYWORD_GAP_TYPES, KI_SIZE_LABELS, type KiCompStatus, type KiGapType, type KiSizeTag } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { CountUp, HeroNextStep, HeroStat, IconTile, InfoTip, InsightItem, Stagger, SummaryHero } from '@/components/insight';
import { Menu, MenuItem } from '@/components/ui/overlay';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Callout, EmptyState, ErrorState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { formatCredits } from '@/lib/credits';
import {
  KI_GAP_ACTION_LABELS,
  KI_GAP_LABELS,
  kiChooseCheck,
  kiCompetitorsHeadline,
  kiCsvUrl,
  kiPatchErrorText,
  kiSplit,
  kiStopNote,
  pctText,
  type KiComp,
  type KiCompetitors,
  type KiGap,
  type KiKw,
  type KiOverview,
} from '@/lib/ki';
import { useKi, useKiCompetitors, useKiCompetitorStatus, useKiGaps, useKiGapStatus, useKiKeywords, useSiteData } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { CompetitorsPanel } from './_components/ai-panels2';
import { FilterChips, Panel, useSitePage } from './_components/kit';
import { DashSkeleton, HeroEyebrow, RankedBars } from './_components/visuals';
import { KI_TIP, KiActionButton, KiFigure, KiNotAvailable, KiRunButton, KiRunNotes, KiTrialBanner, KiUpdated, TAP, useShowAll } from './_components/ki/common';

const CompetitorDrawer = lazy(() => import('./_components/ki/CompetitorDrawer'));
// the searches behind the drawer's keyword profile and overlap (A1_ROUTES: page_size at most 200)
const SUMMARY_PARAMS = { sort: '-score', page: '1', page_size: '200' };
// every gap of the website in one read (A1_ROUTES: page_size at most 200), so the hero and the panel count the same list
const GAP_PARAMS = { page: '1', page_size: '200' };

export default function CompetitorsPage() {
  const { org, site, can, tool } = useSitePage();
  const navigate = useNavigate();
  // the guide's closing button starts the run (members) or closes the guide on the page it explains
  const finish = can('member') ? { label: 'Find my competitors', onClick: () => navigate(tool('competitors')) } : undefined;
  // every read starts at once (no waterfall); the lists of a website whose KI is not visible answer 403 and are not shown
  const ki = useKi(org.id, site.id);
  const comps = useKiCompetitors(org.id, site.id);
  const gaps = useKiGaps(org.id, site.id, GAP_PARAMS);
  // review UX M14: the searches behind the drawer are read only once a drawer is opened (not on every page view)
  const [drawerWanted, setDrawerWanted] = useState(false);
  const kws = useKiKeywords(org.id, site.id, SUMMARY_PARAMS, drawerWanted);
  const ai = useSiteData(org.id, site.id, 'ai');

  const header = (
    <PageHeader
      icon={<Swords />}
      title="Competitors"
      description={`Who ${site.domain} really competes with in Google, and what to do about each one.`}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <GuideButton id="ki-choose-competitors" vars={{ domain: site.domain }} finish={finish} label="How to choose" className="max-sm:h-10 max-sm:px-3.5" />
          {ki.data?.visible && <KiRunButton kind="competitors" o={ki.data} ready={!!comps.data && !comps.isError} />}
        </span>
      }
    />
  );
  if (ki.isError || (ki.data && !ki.data.visible)) return <KiNotAvailable title="Competitors" paused={!!ki.data?.killed} />;
  if (!ki.data || (comps.isPending && !comps.data))
    return (
      <div>
        {header}
        <DashSkeleton cards={4} charts={1} />
      </div>
    );
  return (
    <div>
      {header}
      {comps.isError && !comps.data ? (
        <ErrorState error={comps.error} onRetry={() => void comps.refetch()} />
      ) : (
        <Competitors
          o={ki.data}
          data={comps.data ?? { rows: [], updatedAt: null }}
          gaps={gaps.data ?? []}
          keywords={kws.data?.rows ?? []}
          keywordsLoading={drawerWanted && kws.isPending}
          onDrawer={() => setDrawerWanted(true)}
          ai={ai.data?.latest ? { sov: ai.data.latest.extras?.sov ?? null, competitors: ai.data.latest.competitors, ownShare: [...ai.data.runs].sort((x, y) => String(x.checkedAt).localeCompare(String(y.checkedAt))).at(-1)?.shareOfVoice ?? null } : null}
        />
      )}
    </div>
  );
}

type AiSlice = { sov: Parameters<typeof CompetitorsPanel>[0]['sov'] | null; competitors: { domain: string; share: number; mentions: number; auto?: boolean }[]; ownShare: number | null } | null;

/** The page from its data (tests render this one). */
export function Competitors({ o, data, gaps, keywords, keywordsLoading, onDrawer, ai }: { o: KiOverview; data: KiCompetitors; gaps: KiGap[]; keywords: KiKw[]; keywordsLoading?: boolean; onDrawer?: () => void; ai: AiSlice }) {
  const { org, site, can, page } = useSitePage();
  const status = useKiCompetitorStatus(org.id, site.id);
  const [open, setOpen] = useState<KiComp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = data.rows;
  const s = kiSplit(rows);
  const max = o.maxCompetitors;
  const member = can('member');
  const run = o.lastRuns.competitors;
  const ownShare = run?.counts.client_share ?? run?.counts.serp_share ?? null;
  // FX-L (LOGIC M6 skipped in the engine): only the keyword gaps are produced today; the other kinds are not shown until they exist
  const openGaps = gaps.filter((g) => (g.status === 'open' || g.status === 'started') && (KI_KEYWORD_GAP_TYPES as readonly string[]).includes(g.type));
  // review UX N1 (pass 2): the hero counts exactly the gaps the panel below lists (the kinds shown, open or started)
  const gapsOpen = openGaps.length;

  const change = (c: KiComp, next: KiCompStatus) => {
    const refused = kiChooseCheck(rows, c.domain, next, max);
    if (refused) return setError(refused);
    setError(null);
    status.mutate(
      { domain: c.domain, status: next },
      {
        onSuccess: () => toast.success(next === 'chosen' ? `${c.domain} is now one of your competitors` : next === 'watch' ? `${c.domain} is on your watchlist` : next === 'dismissed' ? `${c.domain} is marked as not a competitor` : 'Saved'),
        onError: (e) => setError(kiPatchErrorText(e, max)),
      },
    );
  };

  const listingsShow = useShowAll(Math.min(s.listings.length, 12), 3, 12);
  const openDrawer = (c: KiComp) => {
    onDrawer?.();
    setOpen(c);
  };
  // FX-A (review UX H3): a run that did not start or finish is said, with what to do; never the first-run empty state under it
  if (!rows.length && kiStopNote(run, { siteCountry: site.country }))
    return (
      <Stagger className="space-y-6">
        <KiTrialBanner o={o} />
        <KiRunNotes o={o} kind="competitors" />
      </Stagger>
    );
  if (!rows.length)
    return (
      <Stagger className="space-y-6">
        <KiTrialBanner o={o} />
        <KiRunNotes o={o} kind="competitors" />
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <EmptyState
            icon={<Swords className="size-5" />}
            title="Find out who you really compete with"
            description={`We read Google's results for each of your services in your market, sort every website by what it is (a company like you, a directory, a list, a platform) and show you the evidence. It takes about 6 minutes.`}
            action={<KiRunButton kind="competitors" o={o} />}
          />
        </div>
      </Stagger>
    );

  const top = s.chosen[0] ?? s.others[0];
  return (
    <Stagger className="space-y-6">
      <KiTrialBanner o={o} />
      <KiRunNotes o={o} kind="competitors" />
      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag="Competitors"><KiUpdated at={run?.finishedAt ?? data.updatedAt} market={o.market || run?.market} /></HeroEyebrow>}
        title={kiCompetitorsHeadline(rows, ownShare)}
        description={s.chosen.length ? `Found in Google's results for your services. You can follow up to ${max}; the others stay on your watchlist.` : `Found in Google's results for your services. Choose up to ${max} to follow: each run then compares you with them.`}
        stats={
          <>
            <HeroStat label="Real competitors found" value={<CountUp value={s.chosen.length + s.others.length} />} info="Companies that sell what you sell and keep showing up in Google's results for your services. Directories, lists and platforms are counted apart." />
            <HeroStat label="You follow" value={`${s.chosen.length} of ${max}`} info="The competitors you chose. Gaps compare you with these each time you run it." />
            <HeroStat label="Lists and directories to join" value={<CountUp value={s.listings.length} />} info="Directories and 'best of' lists that rank for your services and show other companies. Being on them helps you in Google and in AI answers." />
            <HeroStat label="Gaps to act on" value={<CountUp value={gapsOpen} />} info="Searches where your chosen competitors are found and you are not." />
          </>
        }
        aside={
          top && !s.chosen.length && member ? (
            <HeroNextStep title={`Choose your competitors, starting with ${top.domain}`} actions={<Button variant="secondary" size="sm" className={TAP} onClick={() => change(top, 'chosen')}>Choose {top.domain}</Button>} />
          ) : openGaps[0] ? (
            <HeroNextStep title={`${KI_GAP_ACTION_LABELS[openGaps[0].action] ?? 'Close the gap'}${openGaps[0].keyword ? ` for "${openGaps[0].keyword}"` : openGaps[0].target ? `: ${openGaps[0].target}` : ''}`} actions={<KiActionButton kind={openGaps[0].action} keyword={openGaps[0].keyword} target={openGaps[0].target} />} />
          ) : undefined
        }
      />

      {error && (
        <Callout tone="warning" title="That change was not made">
          {error}
        </Callout>
      )}

      <Panel
        icon={<Star />}
        title="Your competitors"
        description={`${s.chosen.length} chosen, ${s.others.filter((r) => r.status !== 'watch').length} suggested, ${s.others.filter((r) => r.status === 'watch').length} on your watchlist`}
        info="Each one was found in the first 10 Google results for your services in your market. The score says how often and how high they show up compared with you."
        actions={<CsvLink href={kiCsvUrl(org.id, site.id, 'competitors')} label="Download CSV" />}
        flush
      >
        {/* review CONSISTENCY M7: the two competitor lists, one story */}
        <p className="border-b border-line px-5 py-2.5 text-xs text-ink-3">
          The competitors you entered in{' '}
          {can('admin') ? (
            <Link to={page('settings')} className="font-medium text-accent-text hover:underline max-md:-my-3 max-md:inline-block max-md:py-3">
              Website settings
            </Link>
          ) : (
            'Website settings'
          )}{' '}
          start on this list as chosen. Choosing here does not change that list, which your AI visibility and backlink checks use.
        </p>
        <CompetitorList title="You follow" rows={s.chosen} empty={`Choose up to ${max} below.`} onChange={change} onOpen={openDrawer} member={member} max={max} chosenCount={s.chosen.length} />
        <CompetitorList title="Suggested" phone={2} rows={s.others.filter((r) => r.status !== 'watch')} onChange={change} onOpen={openDrawer} member={member} max={max} chosenCount={s.chosen.length} />
        <CompetitorList title="Watchlist" phone={0} rows={s.others.filter((r) => r.status === 'watch')} empty="Nobody on your watchlist yet." onChange={change} onOpen={openDrawer} member={member} max={max} chosenCount={s.chosen.length} />
      </Panel>

      <GapsPanel gaps={openGaps} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel icon={<ListChecks />} title="Lists and directories to join" description="They rank for your services and show other companies" info="Directories and 'best of' lists that appear in Google's results for your services. Getting on them puts you where buyers already look, and AI answers often quote them.">
          {s.listings.length ? (
            <>
              <ul className="divide-y divide-line" id={listingsShow.listId}>
                {s.listings.slice(0, 12).map((l, i) => (
                  <li key={l.domain} className={cn('flex flex-wrap items-center justify-between gap-2 py-2.5', listingsShow.cls(i))}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink" title={l.domain}>{l.domain}</span>
                      <span className="block text-xs text-ink-3">{KI_CLASSES[l.cls]}{l.seedsSeen != null && l.seedsTotal ? ` · in the results for ${l.seedsSeen} of ${l.seedsTotal} of your searches` : ''}</span>
                    </span>
                    {/* review UX M10: a real step (Link building's listings), not a badge that looks like a button */}
                    <KiActionButton kind="list" />
                  </li>
                ))}
              </ul>
              {listingsShow.button}
            </>
          ) : (
            <p className="text-sm text-ink-3">No list or directory showed up for your services in this reading.</p>
          )}
          <GuideButton id="ki-choose-competitors" vars={{ domain: site.domain }} variant="link" label="Why directories are not competitors" className="mt-3 max-sm:min-h-10" />
        </Panel>

        <AiShare ai={ai} domain={site.domain} />
      </div>

      {s.formats.length > 0 && (
        <Panel icon={<Target />} title="Websites that win these searches but are not companies like you" description="Platforms, software makers and news sites" info="They rank for your services, but they do not sell what you sell. We do not count them as competitors; they show which kinds of pages Google likes for these searches.">
          <div className="flex flex-wrap gap-2">
            {s.formats.map((f) => (
              <Badge key={f.domain}>
                {f.domain} · {KI_CLASSES[f.cls]}
              </Badge>
            ))}
          </div>
        </Panel>
      )}

      {s.dismissed.length > 0 && (
        <Panel icon={<Ban />} title="Not competitors" description="You said these are not competitors. They stay off your list, even after the next run." flush>
          <ul className="divide-y divide-line">
            {s.dismissed.map((d) => (
              <li key={d.domain} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span className="font-medium text-ink">{d.domain}</span>
                {member && (
                  <Button variant="ghost" size="sm" className={TAP} icon={<Undo2 className="size-4" />} onClick={() => change(d, 'watch')}>
                    Put back on the watchlist
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {open && (
        <Suspense fallback={null}>
          <CompetitorDrawer comp={open} keywords={keywords} loading={keywordsLoading} ownDomain={site.domain} open={!!open} onOpenChange={(v) => !v && setOpen(null)} />
        </Suspense>
      )}
    </Stagger>
  );
}

function CsvLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} download className={buttonClass('secondary', 'sm', TAP)} rel="noopener">
      <Download className="size-4" aria-hidden />
      {label}
    </a>
  );
}

function CompetitorList({ title, rows, empty, onChange, onOpen, member, max, chosenCount, phone = 3 }: { title: string; rows: KiComp[]; empty?: string; onChange: (c: KiComp, s: KiCompStatus) => void; onOpen: (c: KiComp) => void; member: boolean; max: number; chosenCount: number; phone?: number }) {
  const show = useShowAll(rows.length, phone, 10);
  if (!rows.length && !empty) return null;
  return (
    <section className="border-t border-line first:border-t-0">
      <h4 className="px-5 pt-3 text-xs font-medium text-ink-3">{title}</h4>
      {rows.length ? (
        <>
        <ul className="divide-y divide-line" id={show.listId}>
          {rows.map((c, i) => (
            <InsightItem
              key={c.domain}
              className={show.cls(i)}
              icon={<Swords />}
              actionPosition="side"
              title={c.domain}
              meta={
                <>
                  <Badge tone={c.cls === 'direct' ? 'accent' : 'neutral'}>{KI_CLASSES[c.cls]}</Badge>
                  <Badge>{KI_SIZE_LABELS[(c.sizeTag as KiSizeTag) in KI_SIZE_LABELS ? (c.sizeTag as KiSizeTag) : 'unknown']}</Badge>
                  {c.declared && <Badge>You added it</Badge>}
                  {c.needsReview && <Badge tone="warning">Please check: do they sell what you sell?</Badge>}
                </>
              }
              description={
                <span className="flex flex-col gap-1">
                  {/* review UX (pass 2): a compact phone row: the reason in two lines, the figures from sm up */}
                  <span className="max-sm:line-clamp-2">{c.reasons[0] ?? (c.seedsSeen != null && c.seedsTotal ? `In the first 10 Google results for ${c.seedsSeen} of ${c.seedsTotal} of your service searches.` : 'Found in Google\'s results for your services.')}</span>
                  {(c.score != null || c.serpShare != null) && (
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3 max-sm:hidden">
                      {c.score != null && (
                        <span className="tabular">
                          How much they compete with you: {c.scoreLow != null && c.scoreHigh != null && Math.round(c.scoreLow) !== Math.round(c.scoreHigh) ? `${Math.round(c.score)} of 100 (likely ${Math.round(c.scoreLow)} to ${Math.round(c.scoreHigh)})` : `${Math.round(c.score)} of 100`}
                        </span>
                      )}
                      {c.serpShare != null && <span className="tabular">Share of clicks on your searches: {pctText(c.serpShare)}</span>}
                      {/* review UX M6: one tip per row (was two), fewer tab stops before the actions */}
                      <InfoTip label="What these numbers mean" className={KI_TIP}>
                        How much they compete with you: higher means they show up more often and higher than you for your services, in your area and in AI answers. Share of clicks: of the clicks the first page of your service searches gets, about this share goes to them.
                        <span className="mt-1 block text-xs opacity-80">How we know: our estimate, from Google&apos;s results read on the date above</span>
                      </InfoTip>
                    </span>
                  )}
                </span>
              }
              action={
                <span className="flex flex-wrap items-center gap-1.5">
                  <Button variant="secondary" size="sm" className={TAP} onClick={() => onOpen(c)}>
                    Details
                  </Button>
                  {member && c.status !== 'chosen' && (
                    <Button size="sm" className={TAP} icon={<Star className="size-4" />} onClick={() => onChange(c, 'chosen')} disabled={chosenCount >= max} title={chosenCount >= max ? `You follow ${max} already` : undefined}>
                      Choose
                    </Button>
                  )}
                  {/* review UX M6 / pass 2: Watch and Not a competitor in one menu (one tab stop, a shorter phone row) */}
                  {member && (
                    <Menu
                      trigger={
                        <Button variant="ghost" size="sm" className={TAP} icon={<MoreHorizontal className="size-4" />} aria-label={`More actions for ${c.domain}`}>
                          More
                        </Button>
                      }
                    >
                      {c.status !== 'watch' && (
                        <MenuItem icon={<Eye className="size-4" />} onSelect={() => onChange(c, 'watch')}>
                          {c.status === 'chosen' ? 'Move to watchlist' : 'Watch'}
                        </MenuItem>
                      )}
                      <MenuItem icon={<Ban className="size-4" />} onSelect={() => onChange(c, 'dismissed')}>
                        Not a competitor
                      </MenuItem>
                    </Menu>
                  )}
                </span>
              }
            />
          ))}
        </ul>
        {show.button && <div className="px-5 pb-2">{show.button}</div>}
        </>
      ) : (
        <p className="px-5 pb-4 pt-1 text-sm text-ink-3">{empty}</p>
      )}
    </section>
  );
}

function GapsPanel({ gaps }: { gaps: KiGap[] }) {
  const { org, site, can } = useSitePage();
  const setGap = useKiGapStatus(org.id, site.id);
  const types = KI_GAP_TYPES.filter((t) => gaps.some((g) => g.type === t));
  const [type, setType] = useState<'' | KiGapType>('');
  const shown = gaps.filter((g) => !type || g.type === type);
  // review UX H5: 5 on a phone, 10 wider, the rest one tap away
  const show = useShowAll(shown.length, 3, 10);
  return (
    <Panel
      icon={<Target />}
      title="Gaps against your competitors"
      description={gaps.length ? `${gaps.length} places where the competitors you follow are found and you are not` : 'Choose your competitors to see where they are ahead'}
      info="A gap is a search your chosen competitors rank for and you do not (gaps in kinds of pages, lists, AI answers and links come later). Each one shows the step that would close it; the step opens the tool that does it, with its credits shown before anything starts."
      actions={<CsvLink href={kiCsvUrl(org.id, site.id, 'gaps', type ? { type } : {})} label="Download CSV" />}
    >
      {types.length > 1 && (
        <FilterChips
          label="Kind of gap"
          className="mb-3 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1 [&>button]:shrink-0 [&>button]:max-md:h-10"
          value={type}
          onChange={setType}
          options={[{ value: '' as const, label: 'All', count: gaps.length }, ...types.map((t) => ({ value: t, label: KI_GAP_LABELS[t].label, count: gaps.filter((g) => g.type === t).length }))]}
        />
      )}
      {shown.length ? (
        <>
          <ul className="divide-y divide-line" id={show.listId}>
            {shown.map((g, i) => (
              <InsightItem
                key={g.id}
                className={show.cls(i)}
                icon={<GapIcon type={g.type} />}
                actionPosition="side"
                title={g.keyword || g.target || KI_GAP_LABELS[g.type]?.label || 'Gap'}
                meta={
                  <>
                    <Badge tone="accent">{KI_GAP_LABELS[g.type]?.label ?? 'Gap'}</Badge>
                    {g.competitors.slice(0, 3).map((d) => (
                      <Badge key={d}>{d}</Badge>
                    ))}
                  </>
                }
                description={
                  <span className="flex flex-col gap-0.5">
                    <span>{KI_GAP_LABELS[g.type]?.what}</span>
                    <span className="text-xs text-ink-3">
                      What to do: {KI_GAP_ACTION_LABELS[g.action] ?? 'See the plan'}
                      {g.credits != null && g.credits > 0 ? `, about ${formatCredits(g.credits)}` : g.credits === 0 ? ', free' : ''}
                      {g.clientPosition != null && g.clientPosition > 0 ? ` · you are #${Math.round(g.clientPosition)}` : ''}
                      {g.sampleNote ? ` · ${g.sampleNote}` : ''}
                    </span>
                  </span>
                }
                action={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <KiActionButton kind={g.action} keyword={g.keyword} target={g.target} />
                    {can('member') && (
                      <Button variant="ghost" size="sm" className={TAP} onClick={() => setGap.mutate({ gapId: g.id, status: 'dismissed' }, { onError: () => toast.error('Not saved. Please try again.') })}>
                        Not for us
                      </Button>
                    )}
                  </span>
                }
              />
            ))}
          </ul>
          {show.button}
        </>
      ) : (
        <p className="text-sm text-ink-3">{gaps.length ? 'No gap of this kind.' : 'Choose up to 5 competitors above. The next run shows where they are ahead of you.'}</p>
      )}
    </Panel>
  );
}

function GapIcon({ type }: { type: KiGapType }): ReactNode {
  return type === 'listing' ? <ListChecks /> : type === 'ai_answer' ? <Trophy /> : <Target />;
}

function AiShare({ ai, domain }: { ai: AiSlice; domain: string }) {
  if (ai?.sov) return <CompetitorsPanel sov={ai.sov} domain={domain} ownShare={ai.ownShare} />;
  const items = [...(ai?.competitors ?? []).filter((c) => c.domain !== domain).map((c) => ({ label: c.domain, value: c.share, sub: String(c.mentions) })), ...(ai?.ownShare != null ? [{ label: domain, value: ai.ownShare, sub: '' }] : [])].sort((a, b) => b.value - a.value).slice(0, 8);
  return (
    <Panel icon={<Trophy />} title="Who AI answers name" description="Share of the brands named in AI answers to your buyers' questions" info="From your latest AI visibility check: of all the brands ChatGPT, Gemini and other AI answers named for your questions, the share each one got.">
      {items.length ? (
        <RankedBars items={items} you={domain} />
      ) : (
        <div className="flex items-start gap-3">
          <IconTile size="sm" tone="neutral">
            <Trophy />
          </IconTile>
          <p className={cn('text-sm text-ink-3')}>No AI visibility check yet. It runs with your weekly tracking, or from the AI visibility page.</p>
        </div>
      )}
    </Panel>
  );
}
