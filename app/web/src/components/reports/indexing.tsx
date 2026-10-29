// Index coverage (2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md §5): the daily index check's report. Weekly on Mondays,
// and the same day when a page drops out of Google search or a Google update starts or ends. Free (Google data only).
import { ArrowRight, CalendarClock, FileSearch, ListChecks, TrendingDown } from 'lucide-react';
import { INDEX_ACTION_INFO, INDEX_ACTIONS_NEED_YOU, INDEX_CAUSE_INFO, INDEX_CAUSES, indexDayText, indexInSearchLine, indexingNoteText, indexingReportFailed, indexPath, type IndexAction, type IndexCause, type ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { CountUp, HeroStat, InsightItem, Stagger } from '@/components/insight';
import { Block, Disclosure, Empty, Facts, num, obj, objs, str, type P } from './kit';
import { ReportHero, StatusMark } from './visuals';

const isCause = (c: string): c is IndexCause => (INDEX_CAUSES as readonly string[]).includes(c);
const fmt = (v: number | null) => (v == null ? '-' : v.toLocaleString('en-US'));
/** A18: a cause in words; a code this build does not know is never printed raw */
const causeLabel = (c: string) => (isCause(c) ? INDEX_CAUSE_INFO[c].label : 'A reason we do not recognise yet');
/** final browser check: a day as the rest of the app writes it ("29 Oct"), never an ISO string; a status in words, never a raw code */
const day = (v: unknown) => (str(v) ? indexDayText(str(v)) : '');
const EVENT_STATUS: Record<string, string> = { rolling_out: 'rolling out', complete: 'finished', changed: 'policy page changed' };

export function IndexCoverageReport({ report }: { report: ReportDetail }) {
  const { org } = useOrgCtx();
  const p = report.payload;
  const m = obj(p.summary);
  const known = num(m.known) ?? 0;
  const indexed = num(m.indexed) ?? 0;
  const byAction = obj(m.by_action);
  const byCause = obj(m.by_cause);
  const needYou = (['site_fix', 'quality', 'duplicate', 'links'] as const).reduce((s, a) => s + (num(byAction[a]) ?? 0), 0) + (num(byCause.unclassified) ?? 0);
  // A9: the same headline as the Indexing page, from the pages Google gave a reading of (not every page we know)
  const checked = indexed + (num(m.not_indexed) ?? 0) + (num(m.excluded) ?? 0);
  const leftOut = Math.min(num(byAction.leave_out) ?? 0, Math.max(0, checked - indexed));
  const notChecked = num(m.unknown) ?? num(m.backlog_left) ?? 0;
  const dropped = objs(m.dropped);
  const events = objs(m.events);
  const rolling = events.find((e) => str(e.status) === 'rolling_out');
  const impact = obj(m.impact);
  // A18: only the reasons that ask something of the client (never pages left out on purpose, waiting, or not checked)
  const causes = Object.entries(byCause)
    .map(([c, v]) => ({ cause: c, count: num(v) ?? 0 }))
    .filter((x) => x.count > 0 && (!isCause(x.cause) || INDEX_ACTIONS_NEED_YOU.has(INDEX_CAUSE_INFO[x.cause].action)))
    .sort((a, b) => b.count - a.count);
  const siteLink = report.siteId ? `/o/${org.id}/sites/${report.siteId}/indexing` : null;
  // N-app-6 / N12: a run that could not check the website. Its note says why; any figures are the last check's, never today's
  const failed = indexingReportFailed(m);
  const note = failed ? indexingNoteText(str(m.note) || str(m.why) || str(p.note)) : '';
  const last = failed ? ' (last check)' : '';
  const domain = str(p.domain) || 'your website';
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        title={failed ? `We could not check ${domain} this time` : known ? indexInSearchLine({ indexed, shouldBe: checked - leftOut, known, notChecked }, domain) : 'Your index check has started'}
        description={
          failed
            ? `${note}${known ? ' The figures below are from the last check that read your website.' : ''}`
            : needYou
              ? `${fmt(needYou)} page${needYou === 1 ? '' : 's'} need you. The Indexing page groups them by reason, with what to do for each.`
              : 'Nothing needs you this time. We check again every day which pages Google left out.'
        }
        aside={
          failed ? (
            <StatusMark tone="warning" icon={<FileSearch />} title="Could not check" caption="Nothing was read from Google this time" />
          ) : dropped.length ? (
            <StatusMark tone="warning" icon={<TrendingDown />} title={`${dropped.length} dropped out`} caption="Pages that were in Google search and are not any more" />
          ) : (
            <StatusMark tone="good" icon={<FileSearch />} title="No page dropped out" caption="Since the last report" />
          )
        }
        stats={
          failed && !known ? undefined : (
            <>
              <HeroStat label={`In Google search${last}`} value={<CountUp value={indexed} format={(v) => fmt(v)} />} />
              <HeroStat label={`Need you${last}`} value={<CountUp value={needYou} format={(v) => fmt(v)} />} />
              <HeroStat label={`Not checked yet${last}`} value={<CountUp value={num(m.backlog_left) ?? 0} format={(v) => fmt(v)} />} info="Pages we have not looked up in Search Console yet. We check a set number each day, new pages first." />
              <HeroStat label={`New pages in search${last}`} value={`${fmt(num(m.new_indexed))} of ${fmt(num(m.new_pages))}`} info="Pages from the last 30 days." />
            </>
          )
        }
        actions={siteLink ? <ButtonLink size="sm" variant="secondary" to={siteLink} icon={<ArrowRight className="size-4" />}>Open the Indexing page</ButtonLink> : undefined}
      />

      {failed && (
        <Callout tone="warning" title="This check could not read your website">
          {/* R5: the note is in the header above, and so is where the figures come from: said once */}
          {known ? 'Every count in this report may be out of date until a check reads your website again.' : 'There are no figures to show yet.'}
        </Callout>
      )}

      {m.freeze === true && (
        <Callout tone="info" title={rolling ? `${str(rolling.title)} is rolling out` : 'A Google update is rolling out'}>
          {str(m.freeze_reason) || 'While it rolls out we do not suggest rewriting pages. Rankings move around during an update; we compare before and after once it is over.'}
        </Callout>
      )}

      {dropped.length > 0 && (
        <Block title="Dropped out of Google search" icon={<TrendingDown />} iconTone="warning" description="These pages were in search before and are not now." flush>
          <ul className="divide-y divide-line">
            {dropped.slice(0, 20).map((d: P) => (
              <InsightItem
                key={str(d.url)}
                tone="warning"
                title={indexPath(str(d.url))}
                description={str(d.cause) ? causeLabel(str(d.cause)) : 'Reason not known yet'}
                meta={str(d.at) ? <span className="text-xs text-ink-3">{day(d.at)}</span> : undefined}
              />
            ))}
          </ul>
        </Block>
      )}

      <Block title={`What needs doing${last}`} icon={<ListChecks />} description="Counted by what to do, then by the reason Google gives.">
        <Facts
          items={(['site_fix', 'quality', 'duplicate', 'links', 'wait', 'leave_out'] as IndexAction[]).map((a) => ({ label: INDEX_ACTION_INFO[a].label, value: fmt(num(byAction[a]) ?? 0) }))}
          cols="sm:grid-cols-3"
        />
        {causes.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
            {causes.slice(0, 12).map((c) => (
              <li key={c.cause} className="flex justify-between gap-3">
                <span>{causeLabel(c.cause)}</span>
                <span className="tabular text-ink">{fmt(c.count)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No page needs anything.</Empty>
        )}
      </Block>

      {(events.length > 0 || str(impact.event_title)) && (
        <Block title="Google updates" icon={<CalendarClock />}>
          {str(impact.event_title) && (
            <p className="mb-3 text-sm text-ink-2">
              After {str(impact.event_title)}: {fmt(num(impact.dropped))} of your pages lost ground, {fmt(num(impact.stable))} held, {fmt(num(impact.gained))} gained.
            </p>
          )}
          <ul className="space-y-1.5 text-sm text-ink-2">
            {events.slice(0, 6).map((e) => (
              <li key={`${str(e.title)}-${str(e.started_at)}`}>
                <span className="text-ink">{str(e.title)}</span> · {EVENT_STATUS[str(e.status)] ?? 'announced'}
                {str(e.started_at) ? ` · from ${day(e.started_at)}` : ''}
                {str(e.ended_at) ? ` to ${day(e.ended_at)}` : ''}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {str(p.report_markdown) && (
        <Disclosure title="The report as text">
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">{str(p.report_markdown).replace(/[#*`]/g, '').slice(0, 20000)}</div>
        </Disclosure>
      )}
    </Stagger>
  );
}
