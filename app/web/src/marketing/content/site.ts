// Site-wide marketing settings: name, descriptor, contact, navigation, footer, integrations.
import { features } from './features';
import { solutions } from './solutions';

export const site = {
  name: 'Ascentra',
  descriptor: 'Enterprise-grade autonomous SEO.',
  salesEmail: 'sales@ascentra.example', // PLACEHOLDER — confirm the real sales address
  copyright: '© 2026 Ascentra',
} as const;

export interface NavLink {
  label: string;
  to: string;
}

/** header links next to the Platform and Solutions menus */
export const primaryNav: NavLink[] = [
  { label: 'How it works', to: '/how-it-works' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Security', to: '/security' },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: 'Platform',
    links: [{ label: 'Overview', to: '/platform' }, ...features.map((f) => ({ label: f.shortName, to: `/platform/${f.slug}` }))],
  },
  {
    title: 'Solutions',
    links: [{ label: 'Overview', to: '/solutions' }, ...solutions.map((s) => ({ label: s.shortName, to: `/solutions/${s.slug}` }))],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Security', to: '/security' },
      { label: 'Changelog', to: '/changelog' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
];

/** engines and tools Ascentra works with — shown as text only (no third-party logos) */
export const integrations: string[] = [
  'Google Search Console',
  'Google Analytics 4',
  'Google Trends',
  'Bing Webmaster Tools',
  'ChatGPT',
  'Gemini',
  'Perplexity',
  'Claude',
  'Google AI Mode',
  'WordPress',
  'Common Crawl',
];

/** the six AI engines and answer surfaces Ascentra asks */
export const aiEngines: string[] = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'Google AI Mode', 'AI Overviews'];

/** the nine link sources merged into one ledger */
export const linkSources: string[] = [
  'Commercial link index',
  'Bing Webmaster Tools',
  'Search Console links',
  'GA4 referrals',
  'Common Crawl web graph',
  'Wikipedia',
  'Hacker News',
  'News (GDELT)',
  'Web search',
];
