// sitemap.xml, robots.txt and llms.txt of the public website, written into the build by scripts/prerender.mjs from the same
// registries the pages render (one source: a page, its sitemap entry and its llms.txt line can never disagree).
import { absoluteUrl } from '@/lib/siteOrigin';
import { features } from '../content/features';
import { site } from '../content/site';
import { solutions } from '../content/solutions';
import { tutorials } from '../content/tutorials';
import type { SitePage } from './paths';

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(pages: SitePage[]): string {
  const rows = pages.map((p) => `  <url><loc>${xmlEscape(absoluteUrl(p.path))}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

/** the signed-in app, share links and invitations are not for search engines; app.<domain> answers its own robots.txt (Disallow: /)
 *  from middleware.ts */
// '/app': the app shell's own address (vercel.json rewrites the app's paths to it under cleanUrls); nothing public starts with it
export const ROBOTS_DISALLOW = ['/app', '/o/', '/admin', '/account', '/onboarding', '/share/', '/invite/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/portal-handoff', '/api/'];

export function robotsTxt(): string {
  return ['User-agent: *', 'Allow: /', ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`), '', `Sitemap: ${absoluteUrl('/sitemap.xml')}`, ''].join('\n');
}

/** one llms.txt link line; the description on one line, never empty */
const line = (title: string, path: string, about: string) => `- [${title}](${absoluteUrl(path)}): ${about.replace(/\s+/g, ' ').trim()}`;

/** /llms.txt in the llmstxt.org format: an H1, a one-line summary, a few plain sentences, then H2 sections of links */
export function llmsTxt(): string {
  const out: string[] = [
    `# ${site.name}`,
    '',
    '> One platform for SEO, AEO and GEO: keyword research, written pages, technical audits, index coverage, AI search visibility and backlinks, so a website ranks on Google and gets named in AI answers.',
    '',
    `${site.name} is software for companies and agencies. It finds what buyers search for and ask AI assistants, writes the pages, checks the website, and tracks Google and AI answers every week. Work is paid in credits, and every analysis shows its price before it starts. The signed-in app is private: these pages describe the product, its pricing and how it handles data.`,
    '',
    '## Platform',
    '',
    line('Platform overview', '/platform', `Every ${site.name} capability on one page.`),
    ...features.map((f) => line(f.name, `/platform/${f.slug}`, f.tagline)),
    '',
    '## Solutions',
    '',
    line('Solutions overview', '/solutions', `How different teams use ${site.name}.`),
    ...solutions.map((s) => line(s.name, `/solutions/${s.slug}`, s.tagline)),
    '',
    '## Company',
    '',
    line('How it works', '/how-it-works', 'The weekly loop: what runs when, and what needs a person.'),
    line('Pricing', '/pricing', 'Plans and credits: what each analysis costs in credits and how limits work.'),
    line('Security', '/security', 'How accounts, companies and data are protected, where data is hosted, and what is not in place yet.'),
    line('Subprocessors', '/subprocessors', 'The companies that process customer data, what each receives and where.'),
    line('Data retention', '/data-retention', 'How long each kind of data is kept and what is deleted when.'),
    line('Changelog', '/changelog', 'Every release in plain language, newest first.'),
    line('About', '/about', `Who builds ${site.name} and how.`),
    line('Contact', '/contact', 'Sales, support, partnerships and security reviews.'),
    '',
    '## Optional',
    '',
    line('Tutorials', '/tutorials', 'Short films and written steps for every task in the app.'),
    ...tutorials.map((t) => line(`Tutorial ${t.id}: ${t.title}`, `/tutorials/${t.slug}`, t.summary)),
    line('Privacy policy (draft)', '/privacy', 'Draft under review by counsel.'),
    line('Terms of service (draft)', '/terms', 'Draft under review by counsel.'),
    '',
  ];
  return out.join('\n');
}
