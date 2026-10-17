import type { ReactNode } from 'react';
import { ArrowRight, CircleHelp, Footprints, GitFork, Layers, ListOrdered, Shuffle, TrendingDown, TrendingUp } from 'lucide-react';
import { formatPosition, type ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtDateTime } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Delta, ExternalLink, Meter } from '@/components/ui/misc';
import { CountUp, HeroStat, IconTile, Stagger } from '@/components/insight';
import { DataTable, type Column } from '@/components/ui/table';
import { Block, Empty, LedgerCard, arr, num, obj, objs, shortUrl, str, type P } from './kit';
import { modeTitle, prefillFromApiBody } from './meta';
import { PositionPill, ReportHero, ScoreMark } from './visuals';

/** Improvement in places (positive = moved up); null when either check is missing. */
export function movement(pos: number | null, prev: number | null): { kind: 'up' | 'down' | 'same' | 'new' | 'lost' | 'none'; value: number | null } {
  if (pos == null || pos < 0) return { kind: 'none', value: null };
  const p0 = prev != null && prev > 0 ? prev : null;
  if (pos > 0 && p0 == null) return { kind: prev === 0 ? 'new' : 'none', value: null };
  if (pos === 0 && p0 != null) return { kind: 'lost', value: null };
  if (pos === 0) return { kind: 'none', value: null };
  const d = (p0 as number) - pos;
  return { kind: d > 0 ? 'up' : d < 0 ? 'down' : 'same', value: d };
}

export function MovementCell({ pos, prev }: { pos: number | null; prev: number | null }) {
  const m = movement(pos, prev);
  if (m.kind === 'new') return <Badge tone="good">new in top 50</Badge>;
  if (m.kind === 'lost') return <Badge tone="critical">dropped out</Badge>;
  if (m.value == null) return <span className="text-xs text-ink-3">–</span>;
  return <Delta value={m.value} suffix="" digits={0} />;
}

export function RankTrackerReport({ report }: { report: ReportDetail }) {
  const { org, can } = useOrgCtx();
  const p = report.payload;
  const positions = objs(p.positions);
  const rungs = objs(p.rungs);
  const gains = objs(p.gains);
  const drops = objs(p.drops);
  // B6-8 (W3-C): a five-place move is the page's OWN only when it beats the results page's churn; the engine lists those apart from the
  // moves that went with the page around them and the ones it could not compare. Older reports have only gains / drops.
  const split = p.move_summary != null && typeof p.move_summary === 'object';
  const lines = (v: unknown) => arr(v).map((x) => str(x)).filter(Boolean);
  const ownGains = lines(p.own_gains);
  const ownDrops = lines(p.own_drops);
  const withPage = lines(p.moved_with_page);
  const notCompared = lines(p.not_compared_moves);
  const next = obj(p.next_step);
  const apiBody = obj(p.api_body);
  const run = Object.keys(apiBody).length ? prefillFromApiBody(apiBody) : null;
  const ranking = positions.filter((x) => (num(x.position) ?? 0) > 0).length;
  const labels = (r: P) => arr(r.feature_labels).map((x) => str(x)).filter(Boolean);

  const cols: Column<P>[] = [
    { key: 'rung', header: 'Rung', sortValue: (r) => num(r.rung), cell: (r) => <Badge>{num(r.rung) ?? '–'}</Badge>, width: '64px' },
    { key: 'keyword', header: 'Keyword', sortValue: (r) => str(r.keyword), cell: (r) => <span className="font-medium text-ink">{str(r.keyword)}</span> },
    {
      key: 'position',
      header: 'Position',
      align: 'right',
      sortValue: (r) => {
        const v = num(r.position);
        return v == null || v <= 0 ? 999 : v;
      },
      cell: (r) => <PositionPill value={num(r.position)} text={formatPosition(num(r.position))} />,
    },
    { key: 'previous', header: 'Previous', align: 'right', sortValue: (r) => num(r.previous), cell: (r) => <span className="text-ink-3">{formatPosition(num(r.previous))}</span>, hideOnMobile: true },
    { key: 'move', header: 'Change', align: 'right', cell: (r) => <MovementCell pos={num(r.position)} prev={num(r.previous)} /> },
    { key: 'mobile', header: 'On a phone', align: 'right', sortValue: (r) => num(r.mobile_position), cell: (r) => (r.mobile_position == null ? <span className="text-xs text-ink-3">–</span> : <PositionPill value={num(r.mobile_position)} text={formatPosition(num(r.mobile_position))} />), hideOnMobile: true },
    { key: 'sov', header: 'Share of voice', align: 'right', sortValue: (r) => num(r.share_of_voice), cell: (r) => (r.share_of_voice == null ? <span className="text-xs text-ink-3">–</span> : <span className="tabular text-[13px] text-ink-2">{num(r.share_of_voice)}%</span>) },
    { key: 'features', header: 'The results page', cell: (r) => (labels(r).length ? <span className="text-[13px] text-ink-2">{labels(r).join(' · ')}</span> : <span className="text-xs text-ink-3">plain results</span>), hideOnMobile: true },
    { key: 'above', header: 'Above you', cell: (r) => { const a = objs(r.above); return a.length ? <span className="text-[13px] text-ink-2">{a.slice(0, 2).map((x) => `${str(x.domain)} (#${num(x.position)})`).join(', ')}{a.length > 2 ? ` +${a.length - 2}` : ''}</span> : <span className="text-xs text-ink-3">–</span>; }, hideOnMobile: true },
    {
      key: 'notes',
      header: 'Notes',
      cell: (r) => {
        const c = obj(r.cannibal);
        const o = obj(r.outranked);
        const t = [c.found === true ? str(c.text) : '', o.available === true && arr(o.domains).length ? str(o.text) : ''].filter(Boolean);
        return t.length ? <span className="block max-w-[28rem] text-[13px] leading-snug text-ink-2">{t.join(' ')}</span> : <span className="text-xs text-ink-3">–</span>;
      },
      hideOnMobile: true,
    },
    { key: 'url', header: 'Ranking URL', cell: (r) => (str(r.url) ? <ExternalLink href={str(r.url)} className="text-[13px]">{shortUrl(str(r.url))}</ExternalLink> : <span className="text-xs text-ink-3">–</span>), hideOnMobile: true },
  ];

  const top10 = positions.filter((x) => (num(x.position) ?? 0) > 0 && (num(x.position) ?? 99) <= 10).length;
  const serp = obj(p.serp_summary);
  const sf = obj(serp.features);

  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={str(p.head_keyword) ? <span className="normal-case">“{str(p.head_keyword)}”</span> : undefined}
        title={p.done === true ? 'Ladder complete: tracking has stopped' : `${ranking} of ${positions.length} ${positions.length === 1 ? 'page' : 'pages'} in Google’s top 50`}
        description={str(p.checked_at) ? `Checked ${fmtDateTime(str(p.checked_at))}. “>50” means not in the top 50 yet; a failed check is retried next week.` : '“>50” means not in the top 50 yet; a failed check is retried next week.'}
        aside={positions.length ? <ScoreMark score={top10} max={positions.length} label="Pages in the top 10" ringTone="accent" display={`${top10}/${positions.length}`} suffix="" caption={`${ranking} in the top 50`} /> : undefined}
        stats={
          <>
            <HeroStat label="Pages checked" value={<CountUp value={positions.length} />} />
            <HeroStat label="In the top 10" value={<CountUp value={top10} />} />
            <HeroStat label="Gains" value={<CountUp value={split ? ownGains.length : gains.length} />} hint={split ? 'your pages’ own rises, beyond the page’s churn' : 'moved up since last week'} />
            <HeroStat label="Drops" value={<CountUp value={split ? ownDrops.length : drops.length} />} hint={split ? 'your pages’ own falls, beyond the page’s churn' : 'moved down since last week'} />
          </>
        }
      />
      {(str(next.text) || run) && (
        <Card className="border-accent/40">
          <div className="flex gap-3.5 p-5">
            <IconTile tone="solid" size="md">
              <Footprints />
            </IconTile>
            <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-accent-text">Next step</p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink">{str(next.text)}</p>
            {objs(next.pages).length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {objs(next.pages).map((pg, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={str(pg.status) === 'writing' ? 'accent' : str(pg.status) === 'published' ? 'good' : 'neutral'}>{str(pg.status) || 'planned'}</Badge>
                    <span className="text-ink">{str(pg.keyword)}</span>
                    {str(pg.page_type) && <span className="text-xs text-ink-3">{str(pg.page_type)}</span>}
                  </li>
                ))}
              </ul>
            )}
            {run && can('member') && (
              <ButtonLink to={paths.tool(org.id, run.mode, { siteId: report.siteId, prefill: run.prefill })} className="mt-4 h-auto min-h-9 max-w-full whitespace-normal py-2 text-left" icon={<ArrowRight className="size-4" />}>
                {run.mode === 'keyword' && run.prefill.keyword ? `Write “${String(run.prefill.keyword)}”` : modeTitle(run.mode)}
              </ButtonLink>
            )}
            {p.done === true && (
              <p className="mt-3">
                <StatusBadge tone="good">Ladder complete: tracking has stopped</StatusBadge>
              </p>
            )}
            </div>
          </div>
        </Card>
      )}

      {rungs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rungs.map((r) => {
            const pages = num(r.pages) ?? 0;
            const top10 = num(r.top10) ?? 0;
            return (
              <div key={num(r.rung)} className="rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-raised">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                    <IconTile size="sm" tone={r.reached === true ? 'good' : 'blue'}>
                      <GitFork />
                    </IconTile>
                    Rung {num(r.rung)}
                  </span>
                  {r.reached === true ? <StatusBadge tone="good">Reached</StatusBadge> : <Badge>in progress</Badge>}
                </div>
                <p className="mt-2 font-display text-2xl font-semibold text-ink">
                  {top10}
                  <span className="text-sm font-normal text-ink-3"> / {pages} in top 10</span>
                </p>
                <Meter value={pages ? (top10 / pages) * 100 : 0} tone={r.reached === true ? 'good' : 'accent'} label={`Rung ${num(r.rung)} pages in the top 10`} className="mt-2" />
                <p className="mt-1.5 text-xs text-ink-3">{num(r.top3) ?? 0} in the top 3</p>
              </div>
            );
          })}
        </div>
      )}

      <Block
        title="Positions"
        icon={<ListOrdered />}
        description={
          <>
            {ranking} of {positions.length} pages in Google’s top 50
            {str(p.checked_at) && <> · checked {fmtDateTime(str(p.checked_at))}</>}
          </>
        }
      >
        {positions.length ? (
          <DataTable rows={positions} columns={cols} rowKey={(r, i) => `${str(r.keyword)}-${i}`} initialSort={{ key: 'rung', dir: 'asc' }} pageSize={25} />
        ) : (
          <Empty>No positions in this check.</Empty>
        )}
        <p className="mt-2 text-xs text-ink-3">“&gt;50” means not in the top 50 yet; a failed check is retried next week.</p>
      </Block>

      {Object.keys(serp).length > 0 && (
        <Block
          title="The results pages"
          icon={<Layers />}
          description={<>Read in the same check, at no extra cost{num(serp.checked) ? <> · {num(serp.checked)} {num(serp.checked) === 1 ? 'keyword' : 'keywords'}</> : null}{num(serp.mobile_checked) ? <> · {num(serp.mobile_checked)} also checked on a phone</> : null}</>}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SerpStat label="AI Overview shown" value={num(sf.ai_overview) ?? 0} of={num(serp.checked)} hint={num(sf.ai_overview_cites_us) ? `cites you for ${num(sf.ai_overview_cites_us)}` : num(sf.ai_overview_sources_unknown) ? 'whether it cites you was not loaded' : 'it did not cite you in these checks'} />
            <SerpStat label="Featured snippet" value={num(sf.featured_snippet) ?? 0} of={num(serp.checked)} hint={num(sf.snippet_ours) ? `${num(sf.snippet_ours)} held by you` : 'held by other sites'} />
            <SerpStat label="People Also Ask" value={num(sf.people_also_ask) ?? 0} of={num(serp.checked)} hint="questions worth answering on the page" />
            <SerpStat label="Your share of voice" value={null} display={serp.share_of_voice == null ? '–' : `${num(serp.share_of_voice)}%`} hint={str(serp.share_of_voice_note) || 'estimated from the clicks page 1 offers'} />
          </div>
          {objs(serp.competitors_above).length > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-medium text-ink-2">Who is above you</p>
              <ul className="mt-2 divide-y divide-line">
                {objs(serp.competitors_above).slice(0, 8).map((c) => (
                  <li key={str(c.domain)} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-ink">
                      {str(c.domain)}
                      {c.tracked === true && <Badge tone="accent">competitor</Badge>}
                    </span>
                    <span className="tabular text-[13px] text-ink-2">best #{num(c.best_position)} · ahead for {num(c.keywords)} {num(c.keywords) === 1 ? 'keyword' : 'keywords'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {str(serp.head_line) && <p className="mt-3 text-xs text-ink-3">{str(serp.head_line)}</p>}
          {str(serp.method) && <p className="mt-1 text-xs text-ink-3">Share of voice: {str(serp.method)}</p>}
        </Block>
      )}

      {split ? (
        (ownGains.length > 0 || ownDrops.length > 0 || withPage.length > 0 || notCompared.length > 0) && (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <LineList title="Your own gains" items={ownGains} icon={<TrendingUp />} tone="good" />
              <LineList title="Drops to look at" items={ownDrops} icon={<TrendingDown />} tone="critical" />
            </div>
            {(withPage.length > 0 || notCompared.length > 0) && (
              <div className="grid gap-5 lg:grid-cols-2">
                {withPage.length > 0 && <LineList title="Moved with the results page" note="Not necessarily about your page: the pages around it moved as much." items={withPage} icon={<Shuffle />} tone="neutral" />}
                {notCompared.length > 0 && <LineList title="Not compared" note="No earlier reading of the results page to compare with, so no verdict." items={notCompared} icon={<CircleHelp />} tone="neutral" />}
              </div>
            )}
          </>
        )
      ) : (
        (gains.length > 0 || drops.length > 0) && (
          <div className="grid gap-5 lg:grid-cols-2">
            <MoverList title="Gains" items={gains} icon={<TrendingUp />} tone="good" />
            <MoverList title="Drops" items={drops} icon={<TrendingDown />} tone="critical" />
          </div>
        )
      )}
      <LedgerCard
        ledger={p.run_ledger}
        extraCost={num(p.cost_usd)}
        shared="What the whole weekly rank check used: every ladder and the watch list are checked in one run, and each ladder's report shows that same figure. It is not this ladder's own cost, and it is counted once."
      />
    </Stagger>
  );
}

/** one counted feature of the results pages; `display` is used when the figure is not a count out of the keywords checked */
function SerpStat({ label, value, of, hint, display }: { label: string; value: number | null; of?: number | null; hint?: string; display?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">
        {display ?? value ?? 0}
        {display == null && of ? <span className="text-sm font-normal text-ink-3"> / {of}</span> : null}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/** B6-8: the engine's own lines ("keyword (12 → 18; your page's own move: …)"), each already saying what the move is */
function LineList({ title, items, icon, tone, note }: { title: string; items: string[]; icon: ReactNode; tone: 'good' | 'critical' | 'neutral'; note?: string }) {
  return (
    <Block title={title} icon={icon} iconTone={tone} description={note}>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((t, i) => (
            <li key={i} className="py-2 text-sm leading-snug text-ink">
              {t}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>None this week.</Empty>
      )}
    </Block>
  );
}

function MoverList({ title, items, icon, tone }: { title: string; items: P[]; icon: ReactNode; tone: 'good' | 'critical' }) {
  return (
    <Block title={title} icon={icon} iconTone={tone}>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((g, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink">{str(g.keyword)}</span>
              <span className="flex items-center gap-2 tabular text-ink-2">
                {formatPosition(num(g.previous))} → <PositionPill value={num(g.position)} text={formatPosition(num(g.position))} />
                <MovementCell pos={num(g.position)} prev={num(g.previous)} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>None this week.</Empty>
      )}
    </Block>
  );
}
