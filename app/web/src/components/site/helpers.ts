import { cleanDomain, COUNTRIES, domainOk, type CountryName } from '@seo/shared';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiRequestError } from '@/lib/api';

// Small helpers shared by the website settings and onboarding forms.

export const URL_RE = /^https?:\/\/\S+$/i;

/** Copies `ApiRequestError.fields` ("author.name" -> message) into the form. Returns true when at least one field error was set. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>): boolean {
  if (!(e instanceof ApiRequestError)) return false;
  const entries = Object.entries(e.fields ?? {}).filter(([k]) => k && k !== '_');
  for (const [k, m] of entries) setError(k as Path<T>, { type: 'server', message: m });
  return entries.length > 0;
}

/** The first message inside a react-hook-form error (works for arrays and nested objects). */
export function errorText(e: unknown, depth = 0): string | undefined {
  if (!e || typeof e !== 'object' || depth > 4) return undefined;
  const o = e as Record<string, unknown>;
  if (typeof o.message === 'string' && o.message) return o.message;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'ref' || k === 'types' || k === 'type') continue;
    const m = errorText(v, depth + 1);
    if (m) return m;
  }
  return undefined;
}

/** TagInput validator for competitor domains (TagInput passes the value through `cleanDomain` first). */
export function competitorValidator(ownDomain?: string) {
  const own = ownDomain ? cleanDomain(ownDomain) : '';
  return (d: string): string | null => {
    if (!domainOk(d)) return `"${d}" is not a public website address (like competitor.com)`;
    if (own && (d === own || d.endsWith('.' + own))) return 'List other companies here, not your own website';
    return null;
  };
}

export function urlValidator(s: string): string | null {
  return URL_RE.test(s) ? null : 'Enter a full link starting with https://';
}

const TZ_COUNTRY: Record<string, string> = {
  'Asia/Karachi': 'PK',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Singapore': 'SG',
  'Africa/Johannesburg': 'ZA',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX',
  'Pacific/Auckland': 'NZ',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
};

/** A sensible default for the country select: the browser's time zone, then its language region. Empty when unsure. */
export function guessCountry(): CountryName | undefined {
  let iso = '';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    iso = TZ_COUNTRY[tz] ?? (tz.startsWith('Australia/') ? 'AU' : '');
  } catch {
    iso = '';
  }
  if (!iso && typeof navigator !== 'undefined') {
    for (const lang of navigator.languages ?? [navigator.language]) {
      const region = lang.split('-')[1]?.toUpperCase();
      if (region && COUNTRIES.some((c) => c.iso === region)) {
        iso = region;
        break;
      }
    }
  }
  return COUNTRIES.find((c) => c.iso === iso)?.name;
}

/** The value as one of the country names the engine accepts, or undefined. */
export function asCountry(v: string | null | undefined): CountryName | undefined {
  return COUNTRIES.find((c) => c.name === v || c.iso === v)?.name;
}
