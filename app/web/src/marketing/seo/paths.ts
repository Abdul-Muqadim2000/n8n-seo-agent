// Every public page the build prerenders and the sitemap lists, with its last-modified date. The routes (routes.tsx) decide which
// paths exist; this list must name each of them (test/routeCoverage.test.ts checks both ways).
//
// lastmod is a real content date, never the build time (Google uses it only when it is "consistently and verifiably accurate"):
//   /platform/<slug>        the newest release (changelog.ts) that changed that capability
//   /, /platform, /about, /changelog   the newest release (they list the capabilities or the releases)
//   /tutorials/<slug>       the day its film was finished; /tutorials the newest film
//   /privacy, /terms        the document's own "updated" date
//   /security, /subprocessors, /data-retention   the day their facts were checked (content/trust.ts)
//   everything else         no lastmod (allowed by the sitemap protocol)
import { changelog } from '../content/changelog';
import { features } from '../content/features';
import { solutions } from '../content/solutions';
import { tutorials } from '../content/tutorials';
import { TRUST_FACTS_AS_OF } from '../content/trust';
import { legalDocs } from '../components/company/legal';

/** the public pages without a slug, "/" first */
export const STATIC_PATHS = [
  '/',
  '/platform',
  '/how-it-works',
  '/tutorials',
  '/solutions',
  '/pricing',
  '/security',
  '/about',
  '/contact',
  '/changelog',
  '/privacy',
  '/terms',
  '/subprocessors',
  '/data-retention',
] as const;

export interface SitePage {
  path: string;
  /** ISO date (YYYY-MM-DD) of the last real change to the page's content, when one is known */
  lastmod?: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const newest = (dates: (string | undefined)[]): string | undefined =>
  dates
    .filter((d): d is string => !!d && ISO_DAY.test(d))
    .sort()
    .at(-1);

/** the newest release date that touched a capability, or undefined when no release names it */
export const featureLastmod = (slug: string): string | undefined => newest(changelog.filter((e) => e.features.includes(slug)).map((e) => e.date));

export function sitePages(): SitePage[] {
  const release = newest(changelog.map((e) => e.date));
  const film = newest(tutorials.map((t) => t.film?.published));
  const fixed: Record<(typeof STATIC_PATHS)[number], string | undefined> = {
    '/': release,
    '/platform': newest(features.map((f) => featureLastmod(f.slug))),
    '/how-it-works': undefined,
    '/tutorials': film,
    '/solutions': undefined,
    '/pricing': undefined,
    '/security': TRUST_FACTS_AS_OF,
    '/about': release,
    '/contact': undefined,
    '/changelog': release,
    '/privacy': legalDocs['/privacy'].updated,
    '/terms': legalDocs['/terms'].updated,
    '/subprocessors': TRUST_FACTS_AS_OF,
    '/data-retention': TRUST_FACTS_AS_OF,
  };
  const pages: SitePage[] = [
    ...STATIC_PATHS.map((path) => ({ path, lastmod: fixed[path] })),
    ...features.map((f) => ({ path: `/platform/${f.slug}`, lastmod: featureLastmod(f.slug) })),
    ...solutions.map((s) => ({ path: `/solutions/${s.slug}`, lastmod: undefined })),
    ...tutorials.map((t) => ({ path: `/tutorials/${t.slug}`, lastmod: t.film?.published && ISO_DAY.test(t.film.published) ? t.film.published : undefined })),
  ];
  const seen = new Set<string>();
  return pages.filter((p) => (seen.has(p.path) ? false : (seen.add(p.path), true))).map((p) => (p.lastmod ? p : { path: p.path }));
}
