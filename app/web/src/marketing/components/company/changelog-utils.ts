// Helpers shared by /changelog and the About page's "How we build" list.
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

/** "October 2026" */
export const monthLabel = (iso: string) => {
  const { y, m } = parts(iso);
  return `${MONTHS[m]} ${y}`;
};

/** stable anchor id: date + title slug, e.g. "2026-10-08-backlinks-from-every-source" */
export function entryAnchor(e: ChangelogEntry): string {
  const slug = e.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${e.date}-${slug}`;
}

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
