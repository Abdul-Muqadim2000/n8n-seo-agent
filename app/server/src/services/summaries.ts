import { STAGE_LABELS } from '@seo/shared';

// Headline values per callback stage for lists and run cards (field names from the live callbacks of 2026-10-01/02).

type P = Record<string, unknown>;
type Summary = Record<string, string | number | boolean | null>;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 200) : null);
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const len = (v: unknown): number | null => (Array.isArray(v) ? v.length : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The stage of a callback; very early callbacks (verdict before v4.2) had none. */
export function stageOf(p: P): string {
  if (p.status === 'rejected') return 'rejected';
  if (typeof p.stage === 'string' && p.stage) return p.stage;
  if ('verdict' in p) return 'content';
  return 'unknown';
}

export function summarize(stage: string, p: P): Summary {
  const s: Summary = {};
  const put = (k: string, v: string | number | boolean | null | undefined) => {
    if (v !== null && v !== undefined && v !== '') s[k] = v;
  };
  switch (stage) {
    case 'content': {
      put('keyword', str(p.keyword));
      put('verdict', str(p.verdict));
      put('score', num(p.score));
      put('page', str(p.recommended_page));
      put('ladderRung', num(p.ladder_rung));
      put('qa', str(p.qa_summary));
      put('volume', num(obj(p.keyword_data).search_volume));
      put('difficulty', num(obj(p.keyword_data).keyword_difficulty));
      put('hasPage', typeof p.html === 'string' && p.html.length > 50);
      break;
    }
    case 'keyword_strategy': {
      const sw = obj(p.start_with);
      put('startWith', str(sw.keyword));
      put('priority', len(p.priority));
      put('quickWins', len(p.quick_wins));
      put('researched', num(obj(p.summary).keywords_researched));
      break;
    }
    case 'site_audit':
    case 'full_report': {
      put('healthScore', num(p.health_score));
      put('grade', str(p.grade));
      const ic = obj(p.issue_counts);
      put('critical', num(ic.Critical));
      put('high', num(ic.High));
      put('medium', num(ic.Medium));
      put('scoreDelta', num(obj(p.audit_diff).score_delta));
      break;
    }
    case 'ladder_plan': {
      put('head', str(p.keyword) ?? str(obj(p.head).keyword));
      put('feasibility', str(obj(p.feasibility).verdict) ?? str(obj(p.feasibility).status));
      put('pages', num(obj(p.stats).pages_total));
      put('writeNow', len(p.write_now));
      // v4.8: the plan for this website, or why nothing was planned
      put('plan', str(p.label));
      put('refused', p.planned === false ? (str(obj(p.refusal).reason) ?? 'refused') : null);
      break;
    }
    case 'rank_tracker': {
      put('head', str(p.head_keyword));
      put('positions', len(p.positions));
      put('gains', len(p.gains));
      put('drops', len(p.drops));
      put('next', str(obj(p.next_step).text));
      break;
    }
    case 'site_tracker': {
      const g = obj(p.gsc);
      const t = obj(obj(g.totals).cur);
      put('clicks', num(t.clicks));
      put('impressions', num(t.impressions));
      put('clicksPct', num(obj(g.deltas).clicks_pct));
      put('sessions', num(obj(obj(obj(p.ga4).organic).cur).sessions));
      put('actions', len(p.actions));
      put('subject', str(p.subject));
      put('foundLive', len(p.detected_published) || null);
      break;
    }
    case 'site_tracker_setup':
      put('keywords', len(p.keywords));
      put('next', str(p.next));
      break;
    case 'ai_visibility': {
      const m = obj(p.metrics);
      put('mentionRate', num(m.mention_rate));
      put('citationRate', num(m.citation_rate));
      put('shareOfVoice', num(m.share_of_voice));
      put('questions', len(p.questions));
      put('subject', str(p.subject));
      put('visibilityScore', num(m.visibility_score));
      put('aiSessions', num(obj(p.traffic).connected === true ? obj(p.traffic).sessions : null));
      put('wrongClaims', num(m.accuracy_issues) || null);
      break;
    }
    case 'ai_pulse':
      put('mentionRate', num(p.mention_rate));
      put('samples', num(p.samples));
      put('alerts', len(p.alerts));
      put('subject', str(p.subject));
      break;
    case 'backlinks': {
      const m = obj(p.summary);
      put('referringDomains', num(obj(p.coverage).union) ?? num(m.referring_domains));   // v4.10: all sources merged
      put('backlinks', num(m.backlinks));
      put('lost', arr(p.lost).filter((l) => !obj(l).pending).length);   // confirmed losses; "reported lost — checking" is not yet lost
      put('importantLost', len(p.important_lost));
      put('spammy', len(p.spammy));
      put('prospects', len(p.prospects));
      break;
    }
    case 'published':
      put('url', str(p.published_url));
      put('live', typeof p.live === 'boolean' ? p.live : null);
      put('passed', num(p.passed));
      put('failed', len(p.failed) ?? num(p.failed));
      put('summary', str(p.summary));
      break;
    case 'profile':
      put('eeatScore', num(p.eeat_score));
      put('localScore', num(p.local_score));
      put('summary', str(p.summary));
      break;
    case 'console_checkin':
      put('month', str(p.month));
      put('manualAction', typeof p.manual_action === 'boolean' ? p.manual_action : null);
      put('securityIssue', typeof p.security_issue === 'boolean' ? p.security_issue : null);
      break;
    case 'content_cadence':
      put('week', str(p.week));
      put('pages', len(p.pages));
      put('upcoming', len(p.upcoming));
      break;
    case 'site_description':
      put('name', str(obj(p.site_description).business_name) ?? str(obj(p.description).business_name));
      put('summary', str(obj(p.site_description).one_line_summary) ?? str(obj(p.description).one_line_summary));
      put('readFailed', p.site_read_failed === true ? true : null);
      break;
    case 'case_study_started':
    case 'ai_visibility_started':
    case 'backlinks_started':
      put('summary', str(p.summary) ?? str(p.title));
      put('eta', num(p.estimated_minutes));
      break;
    case 'rejected':
      put('error', str(p.error));
      break;
    case 'console_alert':
      put('kind', str(p.kind));
      put('severity', str(p.severity));
      put('subject', str(p.subject));
      break;
  }
  return s;
}

export function titleFor(stage: string, p: P): string {
  const base = STAGE_LABELS[stage] ?? stage;
  const kw = str(p.keyword) ?? str(p.head_keyword);
  const dom = str(p.domain);
  if (stage === 'content' && kw) return `${p.html ? 'Page' : 'Keyword report'}: ${kw}`;
  if ((stage === 'ladder_plan' || stage === 'rank_tracker') && kw) return `${base}: ${kw}`;
  if (stage === 'published' && kw) return `Publish check: ${kw}`;
  return dom ? `${base} · ${dom}` : base;
}

/** DataForSEO spend reported by the run ledger (Claude spend is not reported for streaming calls, see CLAUDE.md). */
export function ledgerCost(p: P): number | null {
  const l = obj(p.run_ledger);
  const d = num(l.dataforseo_usd);
  const direct = num(p.cost_usd);
  if (d == null && direct == null) return null;
  return (d ?? 0) + (direct ?? 0);
}
