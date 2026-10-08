import type { ReactNode } from 'react';
import {
  Activity,
  AlertOctagon,
  Award,
  BadgeCheck,
  BellRing,
  Bot,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  FileText,
  Gauge,
  Link2,
  PenLine,
  Rocket,
  Scale,
  ScanText,
  Search,
  Telescope,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { COUNTRY_NAMES, MODE_IDS, MODES, PAGE_TYPE_VALUES, STAGE_LABELS, type CountryName, type ModeCategory, type ModeId, type PageType } from '@seo/shared';
import { cn } from '@/lib/utils';

const MODE_ICON: Record<ModeId, (cls: string) => ReactNode> = {
  verdict: (c) => <Scale className={c} aria-hidden />,
  keyword: (c) => <PenLine className={c} aria-hidden />,
  discover: (c) => <Telescope className={c} aria-hidden />,
  describe: (c) => <ScanText className={c} aria-hidden />,
  audit: (c) => <Gauge className={c} aria-hidden />,
  ladder: (c) => <ChartNoAxesColumnIncreasing className={c} aria-hidden />,
  track: (c) => <Activity className={c} aria-hidden />,
  published: (c) => <Rocket className={c} aria-hidden />,
  checkin: (c) => <ClipboardCheck className={c} aria-hidden />,
  case_study: (c) => <Award className={c} aria-hidden />,
  profile: (c) => <UserCheck className={c} aria-hidden />,
  ai_visibility: (c) => <Bot className={c} aria-hidden />,
  backlinks: (c) => <Link2 className={c} aria-hidden />,
};

export const isModeId = (v: unknown): v is ModeId => typeof v === 'string' && (MODE_IDS as readonly string[]).includes(v);

export function ModeIcon({ mode, className = 'size-4' }: { mode: ModeId | string; className?: string }) {
  return <>{isModeId(mode) ? MODE_ICON[mode](className) : <FileText className={className} aria-hidden />}</>;
}

/** The icon in a soft square, for list rows and cards. */
export function ModeGlyph({ mode, className, size = 'md' }: { mode: ModeId | string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'size-7 rounded-md' : size === 'lg' ? 'size-11 rounded-xl' : 'size-9 rounded-lg';
  const icon = size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-5' : 'size-4';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center bg-accent-soft text-accent-text', box, className)}>
      <ModeIcon mode={mode} className={icon} />
    </span>
  );
}

export const CATEGORY_ICON: Record<ModeCategory, ReactNode> = {
  keywords: <Search className="size-4" aria-hidden />,
  content: <PenLine className="size-4" aria-hidden />,
  technical: <Gauge className="size-4" aria-hidden />,
  growth: <TrendingUp className="size-4" aria-hidden />,
  tracking: <Activity className="size-4" aria-hidden />,
  brand: <BadgeCheck className="size-4" aria-hidden />,
};

/** The mode a callback stage belongs to (for icons on report rows). */
const STAGE_MODE: Record<string, ModeId> = {
  site_description: 'describe',
  keyword_strategy: 'discover',
  content: 'keyword',
  site_audit: 'audit',
  full_report: 'audit',
  ladder_plan: 'ladder',
  rank_tracker: 'ladder',
  site_tracker_setup: 'track',
  site_tracker: 'track',
  content_cadence: 'keyword',
  published: 'published',
  console_checkin: 'checkin',
  profile: 'profile',
  case_study_started: 'case_study',
  ai_visibility_started: 'ai_visibility',
  ai_visibility: 'ai_visibility',
  ai_pulse: 'ai_visibility',
  backlinks_started: 'backlinks',
  backlinks: 'backlinks',
};

export function StageGlyph({ stage, size = 'md' }: { stage: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-7 rounded-md' : 'size-9 rounded-lg';
  const icon = size === 'sm' ? 'size-3.5' : 'size-4';
  if (stage === 'rejected')
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center bg-critical-soft text-critical-text', box)}>
        <AlertOctagon className={icon} aria-hidden />
      </span>
    );
  if (stage === 'console_alert')
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center bg-warning-soft text-warning-text', box)}>
        <BellRing className={icon} aria-hidden />
      </span>
    );
  if (stage === 'content_cadence')
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center bg-accent-soft text-accent-text', box)}>
        <CalendarClock className={icon} aria-hidden />
      </span>
    );
  return <ModeGlyph mode={STAGE_MODE[stage] ?? 'describe'} size={size} />;
}

export const stageLabel = (stage: string) => STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const modeTitle = (mode: string) => (isModeId(mode) ? MODES[mode].title : mode);

/** Page types the engine writes in reports ("Location Page", "Comparison Page", "Guide-style Service Page (…)") mapped to the form's options. */
export function normalizePageType(v: unknown): PageType {
  const s = String(v ?? '').toLowerCase();
  const exact = PAGE_TYPE_VALUES.find((p) => p.toLowerCase() === s);
  if (exact) return exact;
  if (/pillar|hub/.test(s)) return 'Pillar Page';
  if (/local|location|city/.test(s)) return 'Local Page';
  if (/^blog|article|news|comparison|listicle|faq/.test(s)) return 'Blog Post';
  if (/^guide|how.?to|tutorial/.test(s)) return 'Guide';
  if (/landing/.test(s)) return 'Landing Page';
  if (/product/.test(s)) return 'Product Page';
  return 'Service Page';
}

export const isCountry = (v: unknown): v is CountryName => typeof v === 'string' && (COUNTRY_NAMES as readonly string[]).includes(v);

/** Form values for the "Write a page" tool from a keyword the engine suggested. */
export function keywordPrefill(k: { keyword: string; pageType?: unknown; country?: unknown; existingPageUrl?: unknown }): Record<string, unknown> {
  const out: Record<string, unknown> = { keyword: k.keyword };
  if (k.pageType) out.pageType = normalizePageType(k.pageType);
  if (isCountry(k.country)) out.country = k.country;
  if (typeof k.existingPageUrl === 'string' && /^https?:\/\//.test(k.existingPageUrl)) out.existingPageUrl = k.existingPageUrl;
  return out;
}

/** An engine `api_body` (snake_case, as n8n takes it) → the app's form values for that mode. */
export function prefillFromApiBody(body: Record<string, unknown>): { mode: ModeId; prefill: Record<string, unknown> } | null {
  const mode = String(body.mode ?? '');
  if (mode === 'keyword') {
    const prefill = keywordPrefill({ keyword: String(body.keyword ?? ''), pageType: body.page_type, country: body.country, existingPageUrl: body.existing_page_url });
    const receive = Array.isArray(body.receive) ? body.receive.map((x) => String(x).toLowerCase()) : null;
    if (receive?.length) {
      prefill.receiveReport = receive.some((r) => r.includes('report'));
      prefill.receiveContent = receive.some((r) => r.includes('content'));
    }
    return prefill.keyword ? { mode: 'keyword', prefill } : null;
  }
  if (mode === 'ladder' && body.keyword) return { mode: 'ladder', prefill: { keyword: String(body.keyword), ...(isCountry(body.country) ? { country: body.country } : {}) } };
  if (mode === 'audit') return { mode: 'audit', prefill: { reportType: /full/i.test(String(body.report_type ?? '')) ? 'full' : 'site_audit' } };
  if (mode === 'published' && body.keyword) return { mode: 'published', prefill: { keyword: String(body.keyword), publishedUrl: String(body.published_url ?? '') } };
  if (isModeId(mode)) return { mode, prefill: {} };
  return null;
}
