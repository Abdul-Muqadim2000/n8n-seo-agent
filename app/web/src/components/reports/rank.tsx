import type { ReactNode } from 'react';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { formatPosition, type ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtDateTime } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Delta, ExternalLink, Meter } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { Block, Empty, num, obj, objs, shortUrl, str, type P } from './kit';
import { modeTitle, prefillFromApiBody } from './meta';

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
      cell: (r) => <span className={(num(r.position) ?? 0) > 0 && (num(r.position) ?? 99) <= 10 ? 'font-semibold text-good-text' : 'text-ink'}>{formatPosition(num(r.position))}</span>,
    },
    { key: 'previous', header: 'Previous', align: 'right', sortValue: (r) => num(r.previous), cell: (r) => <span className="text-ink-3">{formatPosition(num(r.previous))}</span>, hideOnMobile: true },
    { key: 'move', header: 'Change', align: 'right', cell: (r) => <MovementCell pos={num(r.position)} prev={num(r.previous)} /> },
    { key: 'url', header: 'Ranking URL', cell: (r) => (str(r.url) ? <ExternalLink href={str(r.url)} className="text-[13px]">{shortUrl(str(r.url))}</ExternalLink> : <span className="text-xs text-ink-3">–</span>), hideOnMobile: true },
  ];

  return (
    <div className="space-y-5">
      {(str(next.text) || run) && (
        <Card className="border-accent/40">
          <CardBody>
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
              <ButtonLink to={paths.tool(org.id, run.mode, { siteId: report.siteId, prefill: run.prefill })} className="mt-4" icon={<ArrowRight className="size-4" />}>
                {run.mode === 'keyword' && run.prefill.keyword ? `Write “${String(run.prefill.keyword)}”` : modeTitle(run.mode)}
              </ButtonLink>
            )}
            {p.done === true && (
              <p className="mt-3">
                <StatusBadge tone="good">Ladder complete: tracking has stopped</StatusBadge>
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {rungs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rungs.map((r) => {
            const pages = num(r.pages) ?? 0;
            const top10 = num(r.top10) ?? 0;
            return (
              <div key={num(r.rung)} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink-3">Rung {num(r.rung)}</span>
                  {r.reached === true ? <StatusBadge tone="good">Reached</StatusBadge> : <Badge>in progress</Badge>}
                </div>
                <p className="mt-2 text-2xl font-semibold text-ink">
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
          <MoverList title="Gains" items={gains} icon={<TrendingUp className="size-4 text-good-text" />} />
          <MoverList title="Drops" items={drops} icon={<TrendingDown className="size-4 text-critical-text" />} />
        </div>
      )}
    </div>
  );
}

function MoverList({ title, items, icon }: { title: string; items: P[]; icon: ReactNode }) {
  return (
    <Block title={title} icon={icon}>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((g, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink">{str(g.keyword)}</span>
              <span className="flex items-center gap-2 tabular text-ink-2">
                {formatPosition(num(g.previous))} → {formatPosition(num(g.position))}
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
