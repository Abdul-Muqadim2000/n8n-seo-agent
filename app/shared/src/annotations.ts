// G12 (2026-10-13, system review FIX_PLAN.md; criteria 3.5 and 2.12): the events every chart is marked with, computed from data the
// app already holds — pages that went live (`seo_content_log.published_at`), technical audits with the findings they cleared
// (`seo_audits`), and the dated registry of Google updates and data breaks.
//
// The registry itself lives in ONE place: `n8n/seo-agent/v5/data/seo_events.json`. `build_v4.py` inlines it into the engine
// (`v5/code/_annotations.js`, `_site_stats.js`) and writes `seo-events.generated.ts` next to this file, so the Monday e-mail and the
// dashboard mark the same dates. To add a Google update, edit that JSON and run the build — never this file.
import { SEO_EVENTS, type SeoEvent } from './seo-events.generated';

export type AnnotationKind = 'publish' | 'fix' | 'google_update' | 'data_break' | 'link';

export interface ChartAnnotation {
  kind: AnnotationKind;
  /** first day of the event (YYYY-MM-DD) */
  date: string;
  /** last day, equal to `date` for a one-day event */
  dateEnd: string;
  /** short label for the marker */
  label: string;
  /** one sentence for the tooltip */
  detail: string;
  /** the page the event is about, when there is one */
  url: string;
  tone: 'good' | 'warning' | 'neutral';
}

export interface AnnotationInput {
  /** the window the chart covers (YYYY-MM-DD; an open end means "no limit") */
  from?: string | null;
  to?: string | null;
  published?: { publishedAt?: string | null; keyword?: string | null; url?: string | null; source?: string | null }[];
  audits?: { auditedAt?: string | null; healthScore?: number | null; findings?: number | null }[];
  links?: { refDomain?: string | null; t0?: string | null; url?: string | null }[];
}

export const GOOGLE_UPDATES: readonly SeoEvent[] = SEO_EVENTS.googleUpdates;
export const DATA_BREAKS: readonly SeoEvent[] = SEO_EVENTS.dataBreaks;
export const SEO_EVENTS_UPDATED = SEO_EVENTS.updated;

const day = (v: unknown): string => (v == null ? '' : String(v)).slice(0, 10);

/** a one-day event is in the window when its day is inside it; a dated range is in when it overlaps */
export function inWindow(from: string | null | undefined, to: string | null | undefined, start: unknown, end?: unknown): boolean {
  const a = day(from);
  const b = day(to);
  const s = day(start);
  const e = day(end) || s;
  if (!s) return false;
  if (a && e < a) return false;
  if (b && s > b) return false;
  return true;
}

/** every event inside the window, oldest first. What is missing simply produces no marks; a quiet window produces none. */
export function buildAnnotations(input: AnnotationInput): ChartAnnotation[] {
  const from = day(input.from);
  const to = day(input.to);
  const out: ChartAnnotation[] = [];

  for (const p of input.published ?? []) {
    const d = day(p.publishedAt);
    if (!d || !inWindow(from, to, d)) continue;
    const kw = (p.keyword ?? '').trim();
    out.push({
      kind: 'publish',
      date: d,
      dateEnd: d,
      label: kw ? `Published: "${kw}"` : 'Page published',
      detail: p.source === 'ladder' ? 'a keyword-ladder page' : p.source === 'cadence' ? 'a page of the weekly cadence' : p.source ? `source: ${p.source}` : '',
      url: p.url ?? '',
      tone: 'good',
    });
  }

  const audits = (input.audits ?? []).filter((a) => day(a.auditedAt)).slice().sort((a, b) => day(a.auditedAt).localeCompare(day(b.auditedAt)));
  audits.forEach((a, i) => {
    const d = day(a.auditedAt);
    if (!inWindow(from, to, d)) return;
    const prev = audits[i - 1];
    const now = Number(a.findings);
    const was = prev ? Number(prev.findings) : NaN;
    const hs = Number(a.healthScore);
    const ps = prev ? Number(prev.healthScore) : NaN;
    const fixed = Number.isFinite(now) && Number.isFinite(was) ? was - now : null;
    const detail = [
      Number.isFinite(hs) ? (Number.isFinite(ps) ? `health ${ps} → ${hs}` : `health ${hs}/100`) : '',
      fixed == null
        ? ''
        : fixed > 0
          ? `${fixed} fewer finding${fixed === 1 ? '' : 's'} than the audit before`
          : fixed < 0
            ? `${Math.abs(fixed)} more finding${fixed === -1 ? '' : 's'} than the audit before`
            : 'the same findings as the audit before',
    ]
      .filter(Boolean)
      .join(' · ');
    out.push({
      kind: 'fix',
      date: d,
      dateEnd: d,
      label: fixed != null && fixed > 0 ? `Audit fixes: ${fixed} finding${fixed === 1 ? '' : 's'} gone` : 'Technical audit',
      detail,
      url: '',
      tone: 'good',
    });
  });

  for (const l of input.links ?? []) {
    const d = day(l.t0);
    if (!d || !inWindow(from, to, d)) continue;
    out.push({ kind: 'link', date: d, dateEnd: d, label: `Link won: ${l.refDomain ?? ''}`.trim(), detail: '', url: l.url ?? '', tone: 'good' });
  }

  for (const u of GOOGLE_UPDATES) {
    if (!inWindow(from, to, u.start, u.end)) continue;
    out.push({
      kind: 'google_update',
      date: day(u.start),
      dateEnd: day(u.end),
      label: `Google: ${u.name}`,
      detail: `Google changed its ranking systems between ${day(u.start)} and ${day(u.end)}. A move in this window may be part of the cause, which cannot be proven from these numbers.`,
      url: '',
      tone: 'warning',
    });
  }

  for (const b of DATA_BREAKS) {
    if (!inWindow(from, to, b.start, b.end)) continue;
    out.push({ kind: 'data_break', date: day(b.start), dateEnd: day(b.end), label: `Data break: ${b.name}`, detail: b.detail ?? '', url: '', tone: 'warning' });
  }

  out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
  return out;
}

/** the data breaks a before / after comparison straddles: the two sides are then not comparable, and the page says so */
export const dataBreaksIn = (from: string | null | undefined, to: string | null | undefined): readonly SeoEvent[] =>
  DATA_BREAKS.filter((b) => inWindow(from, to, b.start, b.end));

export type { SeoEvent };
