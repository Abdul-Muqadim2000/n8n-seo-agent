import type { ReactNode } from 'react';
import type { FieldErrors, FieldValues, Resolver, ResolverResult, UseFormRegisterReturn } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Field, Input, Textarea } from '@/components/ui/field';

export interface ToolFormProps {
  /** a verified website, or null (research without a website) */
  initialSiteId: string | null;
  /** `?prefill=` values (recommendations, "Write this page", "Try again") */
  prefill: Record<string, unknown>;
}

/** Merges prefill values into the defaults: only known fields, only values of the same kind (a bad link cannot break the form). */
export function withPrefill<T extends Record<string, unknown>>(defaults: T, prefill: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(prefill)) {
    if (!(k in defaults) || k === 'mode' || k === 'siteId' || v === undefined) continue;
    // a keyword-ladder page (from the rank tracker's next step): kept only when it has the ladder's id and rung
    if (k === 'ladder') {
      const l = v as { id?: unknown; rung?: unknown; head?: unknown; pageNo?: unknown };
      if (l && typeof l === 'object' && typeof l.id === 'string' && typeof l.rung === 'number')
        out[k] = { id: l.id, rung: l.rung, head: typeof l.head === 'string' ? l.head : '', pageNo: typeof l.pageNo === 'number' ? l.pageNo : 0 };
      continue;
    }
    const d = defaults[k];
    const same = Array.isArray(d) ? Array.isArray(v) && v.every((x) => typeof x === 'string') : d == null ? typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' : typeof d === typeof v;
    if (same) out[k] = v;
  }
  return out as T;
}

/** Adds checks the shared schema cannot express (they need the chosen website) on top of the zod resolver. */
export function withChecks<TIn extends FieldValues, TOut>(base: Resolver<TIn, unknown, TOut>, check: (v: TIn) => Record<string, string>): Resolver<TIn, unknown, TOut> {
  return async (values, ctx, options) => {
    const res = await base(values, ctx, options);
    const extra = Object.entries(check(values));
    if (!extra.length) return res;
    const errors: Record<string, unknown> = { ...(res.errors as Record<string, unknown>) };
    for (const [k, message] of extra) if (!errors[k]) errors[k] = { type: 'custom', message };
    return { values: {}, errors: errors as FieldErrors<TIn> } as ResolverResult<TIn, TOut>;
  };
}

export function Counter({ value, max }: { value: string | undefined; max: number }) {
  const len = (value ?? '').length;
  return <span className={cn('tabular', len > max ? 'text-critical-text' : len > max * 0.9 ? 'text-warning-text' : 'text-ink-3')}>{`${len.toLocaleString()} / ${max.toLocaleString()}`}</span>;
}

export function TextField({ label, reg, error, hint, optional, placeholder, type = 'text', autoComplete, inputMode }: { label: ReactNode; reg: UseFormRegisterReturn; error?: string; hint?: ReactNode; optional?: boolean; placeholder?: string; type?: string; autoComplete?: string; inputMode?: 'text' | 'url' | 'email' | 'numeric' }) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional}>
      {(p) => <Input {...p} {...reg} type={type} placeholder={placeholder} autoComplete={autoComplete ?? 'off'} inputMode={inputMode} />}
    </Field>
  );
}

export function TextAreaField({ label, reg, error, hint, optional, placeholder, rows = 4, value, max }: { label: ReactNode; reg: UseFormRegisterReturn; error?: string; hint?: ReactNode; optional?: boolean; placeholder?: string; rows?: number; value?: string; max?: number }) {
  return (
    <Field
      label={label}
      error={error}
      optional={optional}
      hint={
        hint || max ? (
          <span className="flex items-start justify-between gap-3">
            <span>{hint}</span>
            {max && <Counter value={value} max={max} />}
          </span>
        ) : undefined
      }
    >
      {(p) => <Textarea {...p} {...reg} rows={rows} placeholder={placeholder} />}
    </Field>
  );
}
