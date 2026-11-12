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

// F-29 (prod review 2026-10-31 / 2026-11-12): an author job title of "User" was accepted and printed on every byline ("Name, User"), in
// the Person schema and in outreach signatures, while the profile check said 100%. A placeholder is not a job title: it counts as missing,
// the form refuses it with a message, and it is never sent to the engine or shown (an empty title means the line is left out).

/** words people (or a browser's autofill) leave in a job title field that are not a job title */
const PLACEHOLDER_JOB_TITLES = new Set([
  'user', 'users', 'owner', 'admin', 'administrator', 'member', 'viewer', 'guest', 'test', 'testing', 'tester', 'demo', 'sample', 'example',
  'na', 'n/a', 'n a', 'none', 'null', 'undefined', 'nil', 'nothing', 'tbd', 'tba', 'todo', 'x', 'xx', 'xxx', 'abc', 'asdf', 'qwerty',
  'title', 'job title', 'your title', 'your job title', 'job', 'position', 'role', 'designation', 'employee', 'staff',
]);

const normTitle = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** true for a job title that is not one ("User", "Admin", "N/A", "-", "Job title"); an empty title is missing, not a placeholder */
export function isPlaceholderJobTitle(v: unknown): boolean {
  if (!String(v ?? '').trim()) return false;
  const n = normTitle(v);
  return !n.replace(/[/ ]/g, '') || PLACEHOLDER_JOB_TITLES.has(n);
}

/** the job title to show or send: '' for a placeholder, else the title trimmed */
export const realJobTitle = (v: unknown): string => (isPlaceholderJobTitle(v) ? '' : String(v ?? '').replace(/\s+/g, ' ').trim());

export const PLACEHOLDER_JOB_TITLE_MESSAGE = 'Write the title readers should see under the name, for example Founder or Head of Finance, or leave it empty';


export const PROFILE_CHECKS: { label: string; why: string; done: (p: ProfileLike) => boolean }[] = [
  { label: 'Author name', why: 'byline on every page', done: (p) => has(p.author?.name) },
  { label: 'Author job title', why: 'shown under the name', done: (p) => has(realJobTitle(p.author?.jobTitle)) },
  { label: 'Author bio', why: 'author box', done: (p) => has(p.author?.bio) },
  { label: 'Author credentials and experience', why: 'shows real expertise', done: (p) => has(p.author?.credentials) },
  { label: 'Author page on your site', why: 'links the byline to a real person', done: (p) => has(p.author?.url) },
  { label: 'Author profile links (LinkedIn, ...)', why: 'Person schema Google can match', done: (p) => !!p.author?.sameAs?.length },
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
