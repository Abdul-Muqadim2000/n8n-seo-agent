// Pipeline home, lower part: the next four weeks of automatic runs and what the pipeline delivered on its own lately.
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Activity, Clock, ScanSearch } from 'lucide-react';
import { AUTOMATIONS, type AutomationId, type PipelineData } from '@seo/shared';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtAgo } from '@/lib/utils';
import { AUTO_ICON, fmtDayHead, fmtTime } from './common';

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
    <Card>
      <CardHeader icon={<Clock className="size-4" />} title="Next four weeks" description="Every automatic run that is switched on, in your time zone." />
      <CardBody>
        {!days.length ? (
          <p className="text-sm text-ink-3">Nothing is scheduled: start tracking or switch the automations on.</p>
        ) : (
          <ol className="space-y-4">
            {days.map((events) => (
              <li key={events[0].at}>
                <p className="text-[13px] font-semibold text-ink">{fmtDayHead(events[0].at)}</p>
                <ul className="mt-1.5 space-y-1">
                  {events.map((e) => (
                    <li key={e.at + e.automation} className="flex items-center gap-2 text-[13px] text-ink-2">
                      <span className="w-[4.5rem] shrink-0 whitespace-nowrap tabular text-ink-3">{fmtTime(e.at)}</span>
                      <span className="text-ink-3">{AUTO_ICON[e.automation]}</span>
                      <span className="min-w-0">{AUTOMATIONS.find((a) => a.id === e.automation)?.title}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

type Entry = { at: string; key: string; node: ReactNode };

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
          <Link to={paths.report(org.id, r.id)} className="min-w-0 text-sm font-medium text-ink hover:text-accent-text transition-colors duration-150 ease-brand">
            {r.title}
          </Link>
          <span className="text-xs text-ink-3">{fmtAgo(r.receivedAt)}</span>
        </>
      ),
    })),
    ...(data.detected ?? []).slice(0, 10).map((d) => ({
      at: d.at,
      key: `found:${d.url}`,
      node: (
        <>
          <p className="flex min-w-0 items-start gap-1.5 text-sm text-ink">
            <ScanSearch className="mt-0.5 size-4 shrink-0 text-good-text" aria-hidden />
            <span className="min-w-0 break-words">
              We found your page live at{' '}
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
                {d.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')}
              </a>
              <span className="text-ink-3">
                {' '}
                (“{d.keyword}”{d.ladderId ? (
                  <>
                    ,{' '}
                    <Link to={paths.ladder(org.id, site.id, d.ladderId)} className="hover:text-accent-text transition-colors duration-150 ease-brand">
                      {d.head ? `ladder “${d.head}”` : 'its ladder'}
                    </Link>
                  </>
                ) : null}
                ): it counts as published, no need to report it.
              </span>
            </span>
          </p>
          <span className="text-xs text-ink-3">{fmtAgo(d.at)}</span>
        </>
      ),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);
  return (
    <Card>
      <CardHeader icon={<Activity className="size-4" />} title="Recent automatic runs" description="Reports the pipeline delivered on its own (weekly and monthly runs), and pages it found live." />
      <CardBody>
        {!entries.length ? (
          <p className="text-sm text-ink-3">Nothing yet: the first automatic reports arrive on the next Monday after tracking starts.</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2.5">
                {e.node}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
