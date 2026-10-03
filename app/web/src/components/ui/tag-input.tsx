import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A list of short strings (competitor domains, keywords, brand names, topics) typed as chips.
 * Enter, comma or Tab adds; Backspace on an empty input removes the last chip; pasting "a, b, c" adds several.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  max,
  normalize = (s) => s.trim(),
  validate,
  id,
  invalid,
  describedBy,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  normalize?: (s: string) => string;
  /** returns an error message for an invalid entry */
  validate?: (s: string) => string | null;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const full = max != null && value.length >= max;

  const add = (raw: string) => {
    const parts = raw.split(/[,\n;]+/).map(normalize).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (max != null && next.length >= max) break;
      const err = validate?.(p) ?? null;
      if (err) {
        setError(err);
        return;
      }
      if (!next.includes(p)) next.push(p);
    }
    setError(null);
    onChange(next);
    setDraft('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && draft)) && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-surface px-2 py-1.5 transition-colors focus-within:border-accent focus-within:shadow-[var(--ring)]',
          invalid || error ? 'border-critical' : 'border-line-strong hover:border-ink-3',
        )}
      >
        {value.map((v) => (
          <span key={v} className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-surface-2 pl-2 pr-1 text-[13px] text-ink">
            <span className="truncate">{v}</span>
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label={`Remove ${v}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        {!full && (
          <input
            id={id}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={onKey}
            onBlur={() => draft.trim() && add(draft)}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text');
              if (/[,\n;]/.test(t)) {
                e.preventDefault();
                add(t);
              }
            }}
            placeholder={value.length ? '' : placeholder}
            aria-invalid={invalid || !!error || undefined}
            aria-describedby={describedBy}
            className="h-6 min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
        )}
      </div>
      {error && <p className="mt-1.5 text-[13px] text-critical-text">{error}</p>}
      {max != null && <p className="mt-1 text-xs text-ink-3">{value.length} of {max}</p>}
    </div>
  );
}
