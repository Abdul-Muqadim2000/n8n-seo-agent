import type { ReactNode } from 'react';
import { ArrowRight, Footprints, GitFork, ListOrdered, TrendingDown, TrendingUp } from 'lucide-react';
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
import { Block, Empty, num, obj, objs, shortUrl, str, type P } from './kit';
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
  const next = obj(p.next_step);
  const apiBody = obj(p.api_body);
  const run = Object.keys(apiBody).length ? prefillFromApiBody(apiBody) : null;
  const ranking = positions.filter((x) => (num(x.position) ?? 0) > 0).length;

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
    { key: 'url', header: 'Ranking URL', cell: (r) => (str(r.url) ? <ExternalLink href={str(r.url)} className="text-[13px]">{shortUrl(str(r.url))}</ExternalLink> : <span className="text-xs text-ink-3">–</span>), hideOnMobile: true },
  ];

  const top10 = positions.filter((x) => (num(x.position) ?? 0) > 0 && (num(x.position) ?? 99) <= 10).length;

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
            <HeroStat label="Gains" value={<CountUp value={gains.length} />} hint="moved up since last week" />
            <HeroStat label="Drops" value={<CountUp value={drops.length} />} hint="moved down since last week" />
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

      {(gains.length > 0 || drops.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          <MoverList title="Gains" items={gains} icon={<TrendingUp />} tone="good" />
          <MoverList title="Drops" items={drops} icon={<TrendingDown />} tone="critical" />
        </div>
      )}
    </Stagger>
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
