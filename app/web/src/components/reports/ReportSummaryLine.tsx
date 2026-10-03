import type { ReactNode } from 'react';
import { compactNumber, type Report } from '@seo/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { VerdictBadge } from './kit';

type S = Report['summary'];
const v = (s: S, k: string) => s[k];
const nm = (s: S, k: string): number | null => (typeof s[k] === 'number' && Number.isFinite(s[k] as number) ? (s[k] as number) : null);
const tx = (s: S, k: string): string => (typeof s[k] === 'string' ? (s[k] as string) : '');
const signed = (x: number, digits = 0) => `${x > 0 ? '+' : ''}${x.toFixed(digits)}`;
const pctText = (x: number | null) => (x == null ? null : `${x.toFixed(1).replace(/\.0$/, '')}%`);

/** One line of headline values for a report in lists (verdict, health score, clicks, mention rate, ...). */
export function ReportSummaryLine({ report, className }: { report: Report; className?: string }) {
  const s = report.summary ?? {};
  let badge: ReactNode = null;
  const parts: (string | null | false)[] = [];

  switch (report.stage) {
    case 'content': {
      if (tx(s, 'verdict')) badge = <VerdictBadge verdict={tx(s, 'verdict')} />;
      parts.push(
        nm(s, 'score') != null && `score ${nm(s, 'score')}`,
        nm(s, 'volume') != null && `${compactNumber(nm(s, 'volume'))} searches/mo`,
        nm(s, 'difficulty') != null && `KD ${nm(s, 'difficulty')}`,
        nm(s, 'ladderRung') != null && `ladder rung ${nm(s, 'ladderRung')}`,
        v(s, 'hasPage') === true ? 'page written' : 'verdict and keyword report',
        tx(s, 'qa') && tx(s, 'qa').replace(/^Quality check:\s*/i, 'QA: '),
      );
      break;
    }
    case 'keyword_strategy':
      parts.push(
        tx(s, 'startWith') && `start with “${tx(s, 'startWith')}”`,
        nm(s, 'priority') != null && `${nm(s, 'priority')} priority keywords`,
        nm(s, 'quickWins') != null && `${nm(s, 'quickWins')} quick wins`,
        nm(s, 'researched') != null && `${compactNumber(nm(s, 'researched'))} researched`,
      );
      break;
    case 'site_audit':
    case 'full_report': {
      const score = nm(s, 'healthScore');
      if (score != null) badge = <StatusBadge tone={score >= 80 ? 'good' : score >= 60 ? 'warning' : 'critical'}>{`Health ${score}${tx(s, 'grade') ? ` · ${tx(s, 'grade')}` : ''}`}</StatusBadge>;
      parts.push(
        nm(s, 'critical') != null && `${nm(s, 'critical')} critical`,
        nm(s, 'high') != null && `${nm(s, 'high')} high`,
        nm(s, 'medium') != null && `${nm(s, 'medium')} medium`,
        nm(s, 'scoreDelta') != null && `${signed(nm(s, 'scoreDelta')!)} pts since last audit`,
      );
      break;
    }
    case 'ladder_plan':
      if (tx(s, 'refused')) badge = <StatusBadge tone={tx(s, 'refused') === 'duplicate' ? 'warning' : 'critical'}>{tx(s, 'refused') === 'duplicate' ? 'Not planned: ladder exists' : 'Not planned: not realistic'}</StatusBadge>;
      else if (tx(s, 'feasibility')) badge = /^(GO|AVOID)/i.test(tx(s, 'feasibility')) ? <VerdictBadge verdict={tx(s, 'feasibility')} /> : <StatusBadge tone="neutral">{tx(s, 'feasibility')}</StatusBadge>;
      parts.push(
        tx(s, 'head') && `“${tx(s, 'head')}”`,
        !tx(s, 'refused') && tx(s, 'plan'),
        !tx(s, 'refused') && nm(s, 'pages') != null && `${nm(s, 'pages')} pages`,
        nm(s, 'writeNow') ? `${nm(s, 'writeNow')} written now` : null,
      );
      break;
    case 'rank_tracker':
      parts.push(
        tx(s, 'head') && `“${tx(s, 'head')}”`,
        nm(s, 'positions') != null && `${nm(s, 'positions')} pages checked`,
        nm(s, 'gains') ? `${nm(s, 'gains')} up` : null,
        nm(s, 'drops') ? `${nm(s, 'drops')} down` : null,
      );
      break;
    case 'site_tracker':
      parts.push(
        nm(s, 'clicks') != null && `${compactNumber(nm(s, 'clicks'))} clicks${nm(s, 'clicksPct') != null ? ` (${signed(nm(s, 'clicksPct')!)}%)` : ''}`,
        nm(s, 'impressions') != null && `${compactNumber(nm(s, 'impressions'))} impressions`,
        nm(s, 'sessions') != null && `${compactNumber(nm(s, 'sessions'))} organic sessions`,
        nm(s, 'actions') ? `${nm(s, 'actions')} actions` : null,
        nm(s, 'foundLive') ? `${nm(s, 'foundLive')} page${nm(s, 'foundLive') === 1 ? '' : 's'} found live` : null,
      );
      break;
    case 'site_tracker_setup':
      parts.push(nm(s, 'keywords') != null && `${nm(s, 'keywords')} keywords tracked`, 'first report in a few minutes');
      break;
    case 'ai_visibility':
      parts.push(
        nm(s, 'mentionRate') != null && `named in ${pctText(nm(s, 'mentionRate'))} of answers`,
        nm(s, 'citationRate') != null && `cited ${pctText(nm(s, 'citationRate'))}`,
        nm(s, 'shareOfVoice') != null && `share of voice ${pctText(nm(s, 'shareOfVoice'))}`,
        nm(s, 'questions') != null && `${nm(s, 'questions')} questions`,
      );
      break;
    case 'backlinks':
      parts.push(
        nm(s, 'referringDomains') != null && `${compactNumber(nm(s, 'referringDomains'))} referring domains`,
        nm(s, 'lost') != null && `${nm(s, 'lost')} lost${nm(s, 'importantLost') ? ` (${nm(s, 'importantLost')} important)` : ''}`,
        nm(s, 'spammy') ? `${nm(s, 'spammy')} spammy` : null,
        nm(s, 'prospects') ? `${nm(s, 'prospects')} prospects` : null,
      );
      break;
    case 'published':
      if (typeof v(s, 'live') === 'boolean') badge = <StatusBadge tone={v(s, 'live') ? 'good' : 'critical'}>{v(s, 'live') ? 'Live' : 'Not reachable'}</StatusBadge>;
      parts.push(nm(s, 'passed') != null && `${nm(s, 'passed')} checks passed`, nm(s, 'failed') ? `${nm(s, 'failed')} to fix` : null);
      break;
    case 'profile':
      parts.push(nm(s, 'eeatScore') != null && `E-E-A-T ${nm(s, 'eeatScore')}%`, nm(s, 'localScore') != null && `local details ${nm(s, 'localScore')}%`);
      break;
    case 'console_checkin':
      if (v(s, 'manualAction') === true || v(s, 'securityIssue') === true) badge = <StatusBadge tone="critical">Issue reported</StatusBadge>;
      parts.push(tx(s, 'month'), v(s, 'manualAction') === false && 'no manual action', v(s, 'securityIssue') === false && 'no security issue');
      break;
    case 'content_cadence':
      parts.push(tx(s, 'week') && `week of ${tx(s, 'week')}`, nm(s, 'pages') != null && `${nm(s, 'pages')} page${nm(s, 'pages') === 1 ? '' : 's'} being written`, nm(s, 'upcoming') ? `${nm(s, 'upcoming')} queued` : null);
      break;
    case 'site_description':
      parts.push(tx(s, 'name'), tx(s, 'summary'));
      break;
    case 'case_study_started':
    case 'ai_visibility_started':
    case 'backlinks_started':
      parts.push(nm(s, 'eta') != null && `ready in about ${nm(s, 'eta')} min`, tx(s, 'summary'));
      break;
    case 'rejected':
      badge = <StatusBadge tone="critical">Rejected</StatusBadge>;
      parts.push(tx(s, 'error'));
      break;
    case 'console_alert':
      if (tx(s, 'severity')) badge = <StatusBadge tone={/crit|high/i.test(tx(s, 'severity')) ? 'critical' : 'warning'}>{tx(s, 'severity')}</StatusBadge>;
      parts.push(tx(s, 'subject') || tx(s, 'kind'));
      break;
    default:
      parts.push(
        ...Object.entries(s)
          .filter(([, x]) => typeof x === 'string' || typeof x === 'number')
          .slice(0, 3)
          .map(([k, x]) => `${k}: ${x}`),
      );
  }
  const text = parts.filter((x): x is string => typeof x === 'string' && !!x).join(' · ');
  if (!badge && !text) return null;
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2', className)}>
      {badge}
      {text && <span className="min-w-0 line-clamp-2">{text}</span>}
    </span>
  );
}
