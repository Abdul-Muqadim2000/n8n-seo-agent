import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const toDate = (v: string | Date | null | undefined): Date | null => {
  if (!v) return null;
  const d = typeof v === 'string' ? parseISO(v) : v;
  return isValid(d) ? d : null;
};

/** "3 Oct 2026" */
export function fmtDate(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? format(d, 'd MMM yyyy') : '–';
}

/** "3 Oct" — for chart axes */
export function fmtDay(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? format(d, 'd MMM') : '';
}

/** "3 Oct 2026, 14:05" */
export function fmtDateTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? format(d, 'd MMM yyyy, HH:mm') : '–';
}

/** "5 minutes ago" */
export function fmtAgo(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : '–';
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Encodes form values for a tool link: /o/:org/tools/:mode?prefill=... */
export function encodePrefill(values: Record<string, unknown>): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(values))));
}
export function decodePrefill(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s)))) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function downloadText(fileName: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
