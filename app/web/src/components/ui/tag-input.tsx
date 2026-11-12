import { useState, type KeyboardEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { pasteHasSeveral, splitListEntries, type ListSplit } from '@seo/shared';
import { cn } from '@/lib/utils';

/**
 * A list of short strings (competitor domains, keywords, brand names, topics) typed as chips.
 * Enter, comma or Tab adds; Backspace on an empty input removes the last chip; pasting "a, b, c" adds several.
 *
 * F-07 (2026-11-12): `split="phrases"` is for names that may hold a comma (services, products): Enter, Tab or a new line adds, the comma
 * key types a comma, and commas split only a plain list of short items (shared `splitListEntries`). `maxLength` shows a live character
 * counter under the field; an entry over it is refused by `validate` with a message, never cut.
 */
/**
 * Typed or pasted text added to a list: the new list, what stays in the field and the message. Review N1 (2026-11-12): one bad entry of a
 * paste never loses the others: the good ones are added, the bad ones stay in the field with the first message, for the person to fix.
 * null when the text holds no entry.
 */
export function addEntries(
  value: readonly string[],
  raw: string,
  o: { split?: ListSplit; normalize?: (s: string) => string; validate?: (s: string) => string | null; max?: number },
): { next: string[]; draft: string; error: string | null } | null {
  const parts = splitListEntries(raw, o.split ?? 'items').map(o.normalize ?? ((s) => s.trim())).filter(Boolean);
  if (!parts.length) return null;
  const next = [...value];
  const bad: string[] = [];
  let error: string | null = null;
  for (const p of parts) {
    if (o.max != null && next.length >= o.max) break;
    const err = o.validate?.(p) ?? null;
    if (err) {
      bad.push(p);
      error ??= err;
      continue;
    }
    if (!next.includes(p)) next.push(p);
  }
  return { next, draft: bad.join('; '), error };
}

export function TagInput({
  value,
  onChange,
  placeholder,
  max,
  normalize = (s) => s.trim(),
  validate,
  split = 'items',
  maxLength,
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
  /** how typed and pasted text is split into entries (default: at every comma, semicolon and new line) */
  split?: ListSplit;
  /** the longest entry: shows a character counter while typing */
  maxLength?: number;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const full = max != null && value.length >= max;
  const draftLen = draft.replace(/\s+/g, ' ').trim().length;

  const add = (raw: string) => {
    const r = addEntries(value, raw, { split, normalize, validate, max });
    if (!r) return;
    setError(r.error);
    if (r.next.length !== value.length) onChange(r.next);
    setDraft(r.draft);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || (e.key === ',' && split === 'items') || (e.key === 'Tab' && draft)) && draft.trim()) {
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
          'flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-surface px-2 py-1.5 transition-[border-color,box-shadow] duration-150 ease-brand',
          invalid || error
            ? 'border-critical focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--critical)_22%,transparent)]'
            : 'border-line-strong hover:border-ink-3/60 focus-within:border-[color:var(--ring-color)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring-color)_22%,transparent)]',
        )}
      >
        {value.map((v) => (
          <span key={v} className="inline-flex h-6 max-w-full animate-scale-in items-center gap-1 rounded-md border border-line bg-surface-2 pl-2 pr-0.5 text-[13px] text-ink">
            <span className="truncate" title={v}>
              {v}
            </span>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="rounded p-0.5 text-ink-3 transition-colors duration-150 hover:bg-critical-soft hover:text-critical-text focus-visible:shadow-[inset_0_0_0_1.5px_var(--ring-color)]!"
              aria-label={`Remove ${v}`}
            >
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
              if (pasteHasSeveral(t, split)) {
                e.preventDefault();
                add(t);
              }
            }}
            placeholder={value.length ? '' : placeholder}
            aria-invalid={invalid || !!error || undefined}
            aria-describedby={describedBy}
            className="h-6 min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:shadow-none!"
          />
        )}
      </div>
      {error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-critical-text animate-fade-in">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">{error}</span>
        </p>
      )}
      {(max != null || maxLength != null) && (
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular text-ink-3">
          {max != null && (
            <span>
              {value.length} of {max}
            </span>
          )}
          {maxLength != null && draftLen > 0 && <span className={cn(draftLen > maxLength && 'text-critical-text')}>{draftLen}/{maxLength} characters</span>}
          {/* review N2: a screen reader hears the count only once the entry is too long, not on every key */}
          {maxLength != null && (
            <span className="sr-only" aria-live="polite">
              {draftLen > maxLength ? `Too long: ${draftLen} of ${maxLength} characters` : ''}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
