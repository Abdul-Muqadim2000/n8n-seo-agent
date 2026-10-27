import { COUNTRIES } from './constants';
import { FIT_PLACES, fitArabic, fitDropPlaces, fitMarket, fitPlaces, type FitMarketResult, type FitPlace } from './fit-gate';

// MKT (2026-10-27, n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §2.4): which market a website, a keyword or a text points to.
// The place words and the countries they stand for are the ENGINE's gazetteer (v5/code/_fit_gate.js FIT_PLACES, generated into
// fit-gate.generated.js), so the warning the app shows and the refusal the engine makes read one table. Everything here is pure.

export type Country = (typeof COUNTRIES)[number];

/** A country of the product (a name or an ISO-2 code), or undefined. */
export function countryOf(v: string | null | undefined): Country | undefined {
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  return COUNTRIES.find((c) => c.name.toLowerCase() === s.toLowerCase() || c.iso === s.toUpperCase());
}
/** The ISO-2 code of a country name (or code), '' when unknown. */
export const isoOfCountry = (v: string | null | undefined): string => countryOf(v)?.iso ?? '';
/** The country of an engine location code (2586 -> Pakistan). */
export const countryOfCode = (code: number | string | null | undefined): Country | undefined => COUNTRIES.find((c) => c.code === Number(code));
/** Whether rankings can be measured in this market (its country is in the product's list). */
export const isSupportedIso = (iso: string): boolean => COUNTRIES.some((c) => c.iso === iso.toUpperCase());

/** How a place word reads in a sentence: "the GCC", "the UAE", "Lahore". */
const PLACE_LABEL: Record<string, string> = {
  gcc: 'the GCC', 'gcc countries': 'the GCC', gulf: 'the Gulf', 'gulf countries': 'the Gulf', 'gulf region': 'the Gulf', 'arabian gulf': 'the Gulf', 'persian gulf': 'the Gulf', khaleej: 'the Gulf',
  uae: 'the UAE', 'united arab emirates': 'the UAE', emirates: 'the UAE', emirati: 'the UAE', ksa: 'Saudi Arabia', saudi: 'Saudi Arabia', uk: 'the UK', 'united kingdom': 'the UK',
  usa: 'the USA', 'united states': 'the USA', 'united states of america': 'the USA', nyc: 'New York', mena: 'the Middle East', 'middle east': 'the Middle East',
  'arab world': 'the Arab world', 'arab countries': 'the Arab world', eu: 'the EU', 'european union': 'the EU', europe: 'Europe', european: 'Europe', latam: 'Latin America',
  netherlands: 'the Netherlands', philippines: 'the Philippines', 'the hague': 'The Hague',
};
export function placeLabel(word: string): string {
  const w = String(word || '').toLowerCase().trim();
  return PLACE_LABEL[w] ?? w.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
/** "the GCC", "the UAE and the GCC", "Dubai, Sharjah and the UAE" (each label once). */
export function placesLabel(words: readonly string[]): string {
  const l = [...new Set(words.map(placeLabel))];
  return l.length < 2 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
}

/** Every place a text names (the engine's gazetteer): [{ word, iso: ['AE'], region }], in the order found. */
export const placesIn = (text: string | null | undefined): FitPlace[] => fitPlaces(text ?? '');
/** Does a text point to the market `iso`? (no place, or at least one place that includes it) */
export const marketOfText = (text: string | null | undefined, iso: string): FitMarketResult => fitMarket(text ?? '', iso);
/** The audit's rule: the text names places and none of them includes the market. */
export const marketMismatch = (text: string | null | undefined, iso: string): boolean => !!iso && !fitMarket(text ?? '', iso).ok;
export { FIT_PLACES as PLACES, fitDropPlaces as withoutPlaces };
export type { FitPlace as Place };

/**
 * The countries a text points to, with a weight: a place named counts 1 (2 in the weighted fields: who the customers are, what is sold), a
 * region counts for each of its countries. Highest first. Used for "Make <country> my main country".
 */
export function marketsNamed(parts: { text: string | null | undefined; weight?: number }[]): { iso: string; score: number; direct: number }[] {
  const score = new Map<string, { score: number; direct: number; first: number }>();
  let n = 0;
  for (const p of parts)
    for (const pl of placesIn(p.text)) {
      n++;
      for (const iso of pl.iso) {
        const s = score.get(iso) ?? { score: 0, direct: 0, first: n };
        s.score += p.weight ?? 1;
        if (!pl.region) s.direct += 1;
        score.set(iso, s);
      }
    }
  return [...score.entries()].map(([iso, s]) => ({ iso, ...s })).sort((a, b) => b.score - a.score || b.direct - a.direct || a.first - b.first).map(({ iso, score: sc, direct }) => ({ iso, score: sc, direct }));
}

/** Country endings of web addresses (a generic ending such as .com, .io or .ai says nothing). */
const TLD_ISO: Record<string, string> = {
  ae: 'AE', sa: 'SA', pk: 'PK', in: 'IN', uk: 'GB', ca: 'CA', au: 'AU', nz: 'NZ', ie: 'IE', sg: 'SG', za: 'ZA', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', nl: 'NL', br: 'BR', mx: 'MX',
  qa: 'QA', om: 'OM', bh: 'BH', kw: 'KW', eg: 'EG',
};
/** The country a domain's ending names ("foo.co.uk" -> GB, "foo.ae" -> AE), '' for a generic ending. */
export function domainCountryIso(domain: string | null | undefined): string {
  const t = String(domain ?? '').toLowerCase().trim().replace(/\.+$/, '').split('.').pop() ?? '';
  return TLD_ISO[t] ?? '';
}
export const domainEnding = (domain: string | null | undefined): string => (String(domain ?? '').toLowerCase().trim().match(/\.([a-z]{2,})$/)?.[1] ?? '');

/** The country of a browser / website time zone (the common ones; '' when unsure). */
export const TZ_COUNTRY: Readonly<Record<string, string>> = {
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
export const tzCountryIso = (tz: string | null | undefined): string => {
  const t = String(tz ?? '');
  return TZ_COUNTRY[t] ?? (t.startsWith('Australia/') ? 'AU' : '');
};

/** The writing system of a text, when it is not the Latin alphabet ('' = Latin or none). */
export type Script = '' | 'arabic' | 'cyrillic' | 'cjk' | 'devanagari' | 'hebrew' | 'thai';
const SCRIPTS: { script: Exclude<Script, ''>; re: RegExp; langs: string[]; name: string }[] = [
  { script: 'arabic', re: /[؀-ۿݐ-ݿࢠ-ࣿ]/, langs: ['ar', 'ur', 'fa'], name: 'Arabic script' },
  { script: 'cyrillic', re: /[Ѐ-ӿ]/, langs: ['ru', 'uk', 'bg', 'sr'], name: 'Cyrillic' },
  { script: 'cjk', re: /[぀-ヿ㐀-䶿一-鿿가-힯]/, langs: ['zh', 'ja', 'ko'], name: 'Chinese, Japanese or Korean characters' },
  { script: 'devanagari', re: /[ऀ-ॿ]/, langs: ['hi', 'mr', 'ne'], name: 'Devanagari' },
  { script: 'hebrew', re: /[֐-׿]/, langs: ['he'], name: 'Hebrew' },
  { script: 'thai', re: /[฀-๿]/, langs: ['th'], name: 'Thai' },
];
export function scriptOf(text: string | null | undefined): { script: Script; name: string; langs: string[] } {
  const s = String(text ?? '');
  const hit = SCRIPTS.find((x) => x.re.test(s));
  return hit ? { script: hit.script, name: hit.name, langs: hit.langs } : { script: '', name: 'the Latin alphabet', langs: [] };
}
const LANG_NAME: Record<string, string> = { en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', nl: 'Dutch', pt: 'Portuguese' };
export const languageName = (lang: string): string => LANG_NAME[lang] ?? lang;

/** An Arabic keyword read through the engine's glossary: the English words the checks use, when every word was read. */
export function englishReading(keyword: string): string {
  const r = fitArabic(keyword);
  return r.read && !r.unread.length && r.text.trim() ? r.text.trim() : '';
}
