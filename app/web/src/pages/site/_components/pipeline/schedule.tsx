// Pipeline home, lower part: the next four weeks of automatic runs and what the pipeline delivered on its own lately.
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Activity, Clock, ScanSearch } from 'lucide-react';
import { AUTOMATIONS, type AutomationId, type PipelineData } from '@seo/shared';
import { Collapsible, IconTile } from '@/components/insight';
import { StageGlyph } from '@/components/reports/meta';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtAgo } from '@/lib/utils';
import { Panel } from '../kit';
import { plural } from '../format';
import { AUTO_ICON, fmtDayHead, fmtTime } from './common';
import { DayTile } from './home';

export function Calendar({ data }: { data: PipelineData }) {
  const days = useMemo(() => {
    const m = new Map<string, { at: string; automation: AutomationId }[]>();
    for (const e of data.calendar ?? []) {
      const key = new Date(e.at).toDateString();
      m.set(key, [...(m.get(key) ?? []), e]);
    }
    return [...m.values()];
  }, [data.calendar]);
  return (
    <Panel icon={<Clock />} title="Next four weeks" description="Every automatic run that is switched on, in your time zone.">
      {!days.length ? (
        <p className="text-sm text-ink-3">Nothing is scheduled: start tracking or switch the automations on.</p>
      ) : (
        <ol className="grid gap-2.5 sm:grid-cols-2">
          {days.map((events) => (
            <li key={events[0].at} className="min-w-0 rounded-xl border border-line bg-surface p-3 transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-card">
              <div className="flex items-center gap-2.5">
                <DayTile iso={events[0].at} className="size-10" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{fmtDayHead(events[0].at)}</p>
                  <p className="text-xs text-ink-3">{plural(events.length, 'run')}</p>
                </div>
              </div>
              <ul className="mt-2.5 space-y-1">
                {events.map((e) => (
                  <li key={e.at + e.automation} className="flex items-center gap-2 text-[13px] text-ink-2">
                    <span className="w-[4.25rem] shrink-0 whitespace-nowrap text-xs tabular text-ink-3">{fmtTime(e.at)}</span>
                    <IconTile size="xs">{AUTO_ICON[e.automation]}</IconTile>
                    <span className="min-w-0 truncate">{AUTOMATIONS.find((a) => a.id === e.automation)?.title}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

type Entry = { at: string; key: string; node: ReactNode };

/** The first entries stay visible; the rest open below them. */
const SHOWN = 6;

export function RecentActivity({ data }: { data: PipelineData }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const activity = data.activity ?? [];
  // pages the weekly site check found live by itself (Phase 4), among the reports, newest first
  const entries: Entry[] = [
    ...activity.map((r) => ({
      at: r.receivedAt,
      key: r.id,
      node: (
        <>
          <span className="flex min-w-0 items-center gap-3">
            <StageGlyph stage={r.stage} size="sm" report={r} />
            <Link to={paths.report(org.id, r.id)} className="min-w-0 text-sm font-medium text-ink transition-colors duration-150 ease-brand after:absolute after:inset-0 after:rounded-lg hover:text-accent-text">
              {r.title}
            </Link>
          </span>
          <span className="pl-10 text-xs text-ink-3 sm:pl-0">{fmtAgo(r.receivedAt)}</span>
        </>
      ),
    })),
    ...(data.detected ?? []).slice(0, 10).map((d) => ({
      at: d.at,
      key: `found:${d.url}`,
      node: (
        <>
          <p className="flex min-w-0 items-start gap-3 text-sm text-ink">
            <IconTile size="sm" tone="good">
              <ScanSearch />
            </IconTile>
            <span className="min-w-0 break-words pt-0.5">
              We found your page live at{' '}
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="relative z-[1] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
                {d.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')}
              </a>
              <span className="text-ink-3">
                {' '}
                (“{d.keyword}”{d.ladderId ? (
                  <>
                    ,{' '}
                    <Link to={paths.ladder(org.id, site.id, d.ladderId)} className="relative z-[1] hover:text-accent-text transition-colors duration-150 ease-brand">
                      {d.head ? `ladder “${d.head}”` : 'its ladder'}
                    </Link>
                  </>
                ) : null}
                ): it counts as published, no need to report it.
              </span>
            </span>
          </p>
          <span className="pl-10 text-xs text-ink-3 sm:pl-0">{fmtAgo(d.at)}</span>
        </>
      ),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);
  const row = (e: Entry) => (
    <li key={e.key} className="group relative -mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 transition-colors duration-150 ease-brand hover:bg-surface-2/60">
      {e.node}
    </li>
  );
  return (
    <Panel icon={<Activity />} title="Recent automatic runs" description="Reports the pipeline delivered on its own (weekly and monthly runs), and pages it found live.">
      {!entries.length ? (
        <p className="text-sm text-ink-3">Nothing yet: the first automatic reports arrive on the next Monday after tracking starts.</p>
      ) : (
        <>
          <ul className="divide-y divide-line">{entries.slice(0, SHOWN).map(row)}</ul>
          {entries.length > SHOWN && (
            <Collapsible className="mt-1 border-t border-line pt-2" label={`Show ${entries.length - SHOWN} more`} openLabel="Show fewer">
              <ul className="divide-y divide-line">{entries.slice(SHOWN).map(row)}</ul>
            </Collapsible>
          )}
        </>
      )}
    </Panel>
  );
}
