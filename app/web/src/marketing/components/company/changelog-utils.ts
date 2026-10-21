// Helpers shared by /changelog and the About page's "How we build" list. The changelog shows versions only, never dates
// (fmtLongDate stays for the legal pages).
import type { ChangelogEntry } from '../../content/changelog';
import { featureBySlug } from '../../content/features';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
};

/** "8 October 2026", or "8 Oct 2026" when short (read from the ISO date itself, so no time-zone shift) */
export function fmtLongDate(iso: string, short = false): string {
  const { y, m, d } = parts(iso);
  return `${d} ${(short ? SHORT : MONTHS)[m]} ${y}`;
}

/** stable anchor id from the version, e.g. "v4-2" (the title slug for an entry without one); never a date, since no date is shown */
export function entryAnchor(e: ChangelogEntry): string {
  if (e.version) return `v${e.version.replace(/[^0-9a-z]+/gi, '-')}`;
  return e.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** "Alaventra 4.2", or the title for an entry without a version */
export const releaseName = (e: ChangelogEntry) => (e.version ? `Alaventra ${e.version}` : e.title);

/** the major line a release belongs to ("4" for 4.2), or "" without a version */
export const majorOf = (e: ChangelogEntry) => (e.version ? e.version.split('.')[0] : '');

export interface ChangelogTag {
  /** filter key: a feature slug, or "label:<name>" */
  key: string;
  label: string;
  /** /platform/<slug> for capabilities */
  to?: string;
}

/** the categories of an entry: its capabilities (linked) and its extra labels */
export function entryTags(e: ChangelogEntry): ChangelogTag[] {
  const feats = e.features
    .map((slug) => featureBySlug(slug))
    .filter((f): f is NonNullable<typeof f> => !!f)
    .map((f) => ({ key: f.slug, label: f.shortName, to: `/platform/${f.slug}` }));
  const labels = (e.labels ?? []).map((l) => ({ key: `label:${l.toLowerCase()}`, label: l }));
  return [...labels, ...feats];
}
