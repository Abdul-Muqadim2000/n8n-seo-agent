import type { ProfileReadiness } from './data';

// E-E-A-T profile readiness: one list of checks used by the server (dashboards, recommendations) and the profile form (live checklist).

export interface ProfileLike {
  author?: { name?: string; jobTitle?: string; bio?: string; credentials?: string; url?: string; sameAs?: readonly string[] };
  businessName?: string;
  address?: { street?: string; city?: string };
  phone?: string;
  openingHours?: string;
  logoUrl?: string;
}

const has = (s: string | undefined) => !!s && !!s.trim();

export const PROFILE_CHECKS: { label: string; why: string; done: (p: ProfileLike) => boolean }[] = [
  { label: 'Author name', why: 'byline on every page', done: (p) => has(p.author?.name) },
  { label: 'Author job title', why: 'shown under the name', done: (p) => has(p.author?.jobTitle) },
  { label: 'Author bio', why: 'author box', done: (p) => has(p.author?.bio) },
  { label: 'Author credentials and experience', why: 'shows real expertise', done: (p) => has(p.author?.credentials) },
  { label: 'Author page on your site', why: 'links the byline to a real person', done: (p) => has(p.author?.url) },
  { label: 'Author profile links (LinkedIn, …)', why: 'Person schema Google can match', done: (p) => !!p.author?.sameAs?.length },
  { label: 'Company name', why: 'Organization schema', done: (p) => has(p.businessName) },
  { label: 'Business address', why: 'contact block and local pages', done: (p) => has(p.address?.street) && has(p.address?.city) },
  { label: 'Phone', why: 'contact block', done: (p) => has(p.phone) },
  { label: 'Opening hours', why: 'LocalBusiness schema', done: (p) => has(p.openingHours) },
  { label: 'Logo', why: 'Organization schema', done: (p) => has(p.logoUrl) },
];

export function profileReadiness(p: ProfileLike | null | undefined): ProfileReadiness {
  const results = PROFILE_CHECKS.map((c) => ({ c, ok: !!p && c.done(p) }));
  return { score: Math.round((results.filter((r) => r.ok).length / results.length) * 100), missing: results.filter((r) => !r.ok).map((r) => r.c.label) };
}
