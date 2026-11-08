// KI (2026-11-08): the Competitors and Keyword research run reports. The full picture lives on the two pages (the rows are stored, the
// pages read them), so the report says how the run went in plain words, its counts, what could not be read, and opens the page.
import { ArrowRight } from 'lucide-react';
import type { ReportDetail } from '@seo/shared';
import { isClientRole, kiRefusalText } from '@seo/shared';
import { HeroStat, Stagger } from '@/components/insight';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { kiSectionWords } from '@/lib/ki';
import { ReportHero } from './visuals';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// review UX L12: the headline figures first (searches found before the plan's length)
const LABELS: Record<string, string> = { keywords: 'Searches found', competitors: 'Competitors found', chosen: 'You follow', clusters: 'Topics', striking: 'Just off page one', listings: 'Lists to join', questions: 'Buyer questions', gaps: 'Gaps', plan: 'Steps in the plan' };

export function KiReport({ report }: { report: ReportDetail }) {
  const { org, role } = useOrgCtx();
  // review CONSISTENCY L6: the client portal's roles have no KI pages, so no link to one
  const portal = isClientRole(role);
  const p = report.payload;
  const research = report.stage === 'ki_research';
  const status = String(p.status ?? report.summary.status ?? 'ok');
  const summary = (p.summary && typeof p.summary === 'object' ? p.summary : report.summary) as Record<string, unknown>;
  const stats = Object.keys(LABELS).filter((k) => num(summary[k]) != null).slice(0, 4);
  const missing = (Array.isArray(p.sections) ? (p.sections as { key?: string; state?: string }[]) : []).filter((s) => s.state === 'missing' || s.state === 'partial').map((s) => kiSectionWords(String(s.key ?? '')));
  const page = research ? 'keywords' : 'competitors';
  const title = status === 'refused' || status === 'failed' ? kiRefusalText(p.reason) : research ? 'Your keyword research is ready' : 'Your competitors are ready';
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        title={title}
        description={status === 'partial' ? 'Most of the reading is done. One part could not be read this time; the rest is on the page.' : undefined}
        stats={stats.length ? <>{stats.map((k) => <HeroStat key={k} label={LABELS[k]} value={(num(summary[k]) ?? 0).toLocaleString('en-US')} />)}</> : undefined}
        actions={
          report.siteId && !portal && status !== 'refused' && status !== 'failed' ? (
            <ButtonLink to={paths.site(org.id, report.siteId, page)} variant="primary" icon={<ArrowRight className="size-4" />}>
              {research ? 'Open Keyword research' : 'Open Competitors'}
            </ButtonLink>
          ) : report.siteId && !portal ? (
            // review UX L12: a run that did not start or finish says what to do next (the page explains the reason, with the fix)
            <ButtonLink to={paths.site(org.id, report.siteId, page)} variant="primary" icon={<ArrowRight className="size-4" />}>
              See what to do
            </ButtonLink>
          ) : undefined
        }
      />
      {missing.length > 0 && (
        <Callout tone="info" title="Part of the reading is missing">
          We could not read {[...new Set(missing)].join(', ')} this time. You were only charged for what was read, and the next run tries again.
        </Callout>
      )}
    </Stagger>
  );
}
