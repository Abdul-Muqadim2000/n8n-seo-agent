import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleMinus, XCircle } from 'lucide-react';
import { compactNumber, formatUsd } from '@seo/shared';
import { cn, downloadText, fmtDateTime } from '@/lib/utils';
import { Badge, StatusBadge, verdictTone, type Tone } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { CopyButton, KeyValue, Meter, scoreTone } from '@/components/ui/misc';

// Helpers shared by every report renderer. Callback payloads are untyped JSON from n8n, so every read goes through a guard
// (a malformed field renders as "–" or an empty list instead of crashing the page).

export type P = Record<string, unknown>;

export const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
export const arr = <T = unknown,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const objs = (v: unknown): P[] => arr(v).filter((x): x is P => !!x && typeof x === 'object' && !Array.isArray(x));
export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '');
export const strs = (v: unknown): string[] => arr(v).map(str).filter(Boolean);
export const has = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : v != null && v !== '' && !(typeof v === 'object' && !Object.keys(v as object).length));

/** "1,600" / "12K" for counts; "–" when missing. */
export const n = (v: unknown) => compactNumber(num(v));
export const usd = (v: unknown, digits = 2) => formatUsd(num(v), digits);
/** 0.0069 (ratio) → "0.69%" */
export const pctRatio = (v: unknown, digits = 1) => {
  const x = num(v);
  return x == null ? '–' : `${(x * 100).toFixed(digits).replace(/\.0+$/, '')}%`;
};
/** 53 (already percent) → "53%" */
export const pct = (v: unknown, digits = 1) => {
  const x = num(v);
  return x == null ? '–' : `${x.toFixed(digits).replace(/\.0+$/, '')}%`;
};
export const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '') || u;
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const VERDICT_LABEL: Record<string, string> = { GO: 'Go', GO_WITH_CHANGES: 'Go with changes', AVOID: 'Avoid' };
export const verdictLabel = (v: string) => VERDICT_LABEL[v.toUpperCase()] ?? v.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function VerdictBadge({ verdict, className }: { verdict: string; className?: string }) {
  if (!verdict) return null;
  return (
    <StatusBadge tone={verdictTone(verdict)} className={className}>
      {verdictLabel(verdict)}
    </StatusBadge>
  );
}

/** Severity labels as used by the audit (Critical / High / Medium / Low / Info). */
export function sevTone(sev: string): Tone {
  const s = sev.toLowerCase();
  if (s.startsWith('crit')) return 'critical';
  if (s.startsWith('high')) return 'serious';
  if (s.startsWith('med')) return 'warning';
  return 'neutral';
}

/** A titled card section of a report. */
export function Block({ title, description, actions, children, icon, className, bodyClassName }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; icon?: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} actions={actions} icon={icon} />
      <CardBody className={bodyClassName}>{children}</CardBody>
    </Card>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h4 className={cn('mb-2 text-xs font-medium uppercase tracking-wide text-ink-3', className)}>{children}</h4>;
}

/** Plain bullet list for reasons, notes, recommendations. */
export function Bullets({ items, tone = 'neutral', className }: { items: ReactNode[]; tone?: 'neutral' | 'good' | 'warning' | 'critical'; className?: string }) {
  if (!items.length) return null;
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : tone === 'critical' ? XCircle : null;
  const color = tone === 'good' ? 'text-good-text' : tone === 'warning' ? 'text-warning-text' : tone === 'critical' ? 'text-critical-text' : 'text-ink-3';
  return (
    <ul className={cn('space-y-2', className)}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
          {Icon ? <Icon className={cn('mt-0.5 size-4 shrink-0', color)} aria-hidden /> : <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />}
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** A pass / fail / not checked row (publish checks, readiness checklists). */
export function CheckRow({ ok, label, detail }: { ok: boolean | null; label: ReactNode; detail?: ReactNode }) {
  const Icon = ok === true ? CheckCircle2 : ok === false ? XCircle : CircleMinus;
  const color = ok === true ? 'text-good-text' : ok === false ? 'text-critical-text' : 'text-ink-3';
  const word = ok === true ? 'Pass' : ok === false ? 'Fail' : 'Not checked';
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={cn('mt-0.5 size-4 shrink-0', color)} aria-label={word} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{label}</p>
        {detail && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{detail}</p>}
      </div>
      <span className={cn('shrink-0 text-xs font-medium', color)}>{word}</span>
    </li>
  );
}

export function Chips({ items, max = 30, className }: { items: string[]; max?: number; className?: string }) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, max);
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((t, i) => (
        <span key={`${t}-${i}`} className="inline-flex max-w-full items-center rounded-md bg-surface-2 px-2 py-0.5 text-[13px] text-ink-2">
          <span className="truncate">{t}</span>
        </span>
      ))}
      {items.length > max && (
        <button type="button" onClick={() => setAll(!all)} className="text-[13px] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
          {all ? 'Show fewer' : `+${items.length - max} more`}
        </button>
      )}
    </div>
  );
}

/** Score 0-100 with a meter coloured by the score band. */
export function ScoreMeter({ score, label = 'Score', size = 'md' }: { score: number | null; label?: string; size?: 'md' | 'lg' }) {
  if (score == null) return null;
  const tone = scoreTone(score);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-3">{label}</span>
        <span className={cn('font-display font-semibold tracking-[-0.01em] text-ink', size === 'lg' ? 'text-3xl' : 'text-xl')}>
          {Math.round(score)}
          <span className="text-sm font-normal text-ink-3">/100</span>
        </span>
      </div>
      <Meter value={score} tone={tone} label={label} className="mt-2" />
    </div>
  );
}

/** Small "label / value" tiles in a grid (keyword data, summary counts). */
export function Facts({ items, className, cols = 'sm:grid-cols-3 lg:grid-cols-4' }: { items: { label: ReactNode; value: ReactNode; hint?: ReactNode }[]; className?: string; cols?: string }) {
  const shown = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== '');
  if (!shown.length) return null;
  return (
    <dl className={cn('grid grid-cols-2 gap-3', cols, className)}>
      {shown.map((it, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
          <dt className="text-xs text-ink-3">{it.label}</dt>
          <dd className="mt-0.5 font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">{it.value}</dd>
          {it.hint && <dd className="mt-0.5 text-xs text-ink-3">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Collapsible block (raw JSON, long text, outreach drafts). */
export function Disclosure({ title, children, defaultOpen, className, meta }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; meta?: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={cn('rounded-lg border border-line', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn('flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors duration-150 ease-brand hover:bg-surface-2', open ? 'rounded-t-[9px]' : 'rounded-[9px]')}
      >
        {open ? <ChevronDown className="size-4 shrink-0 text-ink-3" /> : <ChevronRight className="size-4 shrink-0 text-ink-3" />}
        <span className="min-w-0 flex-1">{title}</span>
        {meta && <span className="shrink-0 text-xs font-normal text-ink-3">{meta}</span>}
      </button>
      {open && <div className="border-t border-line px-3 py-3">{children}</div>}
    </div>
  );
}

/** Monospace text with copy (and optional download). */
export function CodeBlock({ text, fileName, maxHeight = 'max-h-[420px]', mime }: { text: string; fileName?: string; maxHeight?: string; mime?: string }) {
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 flex gap-1.5">
        <CopyButton text={text} />
        {fileName && (
          <button
            type="button"
            onClick={() => downloadText(fileName, text, mime)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink-2 shadow-card transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink"
          >
            Download
          </button>
        )}
      </div>
      <pre className={cn('overflow-auto rounded-lg border border-line bg-surface-2 p-3 pr-36 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-ink', maxHeight)}>{text}</pre>
    </div>
  );
}

export function JsonViewer({ value, title = 'Raw data', defaultOpen }: { value: unknown; title?: ReactNode; defaultOpen?: boolean }) {
  const text = JSON.stringify(value, null, 2) ?? 'null';
  return (
    <Disclosure title={title} defaultOpen={defaultOpen} meta={`${Math.max(1, Math.round(text.length / 1024))} KB`}>
      <CodeBlock text={text} maxHeight="max-h-[560px]" />
    </Disclosure>
  );
}

/** The run ledger every completed callback carries: DataForSEO spend, AI calls, duration. */
export function LedgerCard({ ledger, extraCost }: { ledger: unknown; extraCost?: number | null }) {
  const l = obj(ledger);
  if (!has(l) && extraCost == null) return null;
  const byNode = Object.entries(obj(l.by_node))
    .map(([k, v]) => ({ k, v: num(v) ?? 0 }))
    .sort((a, b) => b.v - a.v);
  const aiNodes = strs(l.ai_nodes);
  return (
    <Block title="Run ledger" description="What this run used. Claude usage is billed by the token and is not itemised here.">
      <Facts
        cols="sm:grid-cols-4"
        items={[
          { label: 'Data cost (DataForSEO)', value: num(l.dataforseo_usd) != null ? usd(l.dataforseo_usd, 3) : extraCost != null ? usd(extraCost, 3) : null, hint: num(l.dataforseo_calls) != null ? plural(num(l.dataforseo_calls)!, 'API call') : undefined },
          { label: 'AI steps', value: num(l.ai_calls) != null ? String(l.ai_calls) : null },
          { label: 'Duration', value: num(l.duration_min) != null ? `${num(l.duration_min)} min` : null },
          { label: 'Finished', value: str(l.finished_at) ? fmtDateTime(str(l.finished_at)) : null },
        ]}
      />
      {(byNode.length > 0 || aiNodes.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {byNode.length > 0 && (
            <div>
              <SectionTitle>Data calls by step</SectionTitle>
              <KeyValue items={byNode.map((x) => ({ label: x.k, value: <span className="tabular">{usd(x.v, 4)}</span> }))} />
            </div>
          )}
          {aiNodes.length > 0 && (
            <div>
              <SectionTitle>AI steps</SectionTitle>
              <Chips items={aiNodes} />
            </div>
          )}
        </div>
      )}
    </Block>
  );
}

/** "high" / "medium" alert lists from the monitors ({ level, text }). */
export function AlertList({ alerts }: { alerts: P[] }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const level = str(a.level).toLowerCase();
        return (
          <Callout key={i} tone={level === 'high' || level === 'critical' ? 'critical' : level === 'medium' ? 'warning' : 'info'}>
            <span className="flex flex-wrap items-center gap-2">
              {level && <Badge tone={level === 'high' || level === 'critical' ? 'critical' : level === 'medium' ? 'warning' : 'neutral'}>{level}</Badge>}
              <span className="text-ink">{str(a.text) || str(a.message)}</span>
            </span>
          </Callout>
        );
      })}
    </div>
  );
}

/** Keeps one broken renderer from taking down the page: falls back to the given node. */
export class RenderBoundary extends Component<{ fallback: (error: Error) => ReactNode; children: ReactNode; resetKey?: string }, { error: Error | null; key?: string }> {
  override state: { error: Error | null; key?: string } = { error: null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { error: Error | null; key?: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Report renderer failed', error, info.componentStack);
  }
  override render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-3">{children}</p>;
}
