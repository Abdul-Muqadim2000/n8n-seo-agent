// The three kinds of search Alaventra works on: SEO (Google's results), AEO (the answers Google shows above them) and GEO (AI
// assistants). Rendered by the home page, /platform and the capability chips on /platform and /platform/<slug>. Capability facts only,
// and each line must stay true of the shipped product (see features.ts and pricing.ts for the plan each part is on).

export type SearchKindId = 'seo' | 'aeo' | 'geo';

export interface SearchKind {
  id: SearchKindId;
  /** the short name buyers search for */
  short: 'SEO' | 'AEO' | 'GEO';
  name: string;
  /** where the business shows up, in one line */
  where: string;
  /** what Alaventra does for it: 4-5 lines, real capabilities only */
  what: string[];
  /** capability slugs that carry it (links) */
  features: string[];
  /** which plan it starts on */
  plan: string;
}

export const searchKinds: SearchKind[] = [
  {
    id: 'seo',
    short: 'SEO',
    name: 'Search engine optimization',
    where: 'Ranking in Google\'s results for the searches your buyers type.',
    what: [
      'The searches worth winning, each with a clear verdict and the difficulty for your site',
      'Keyword ladders that climb from easier searches to the big one',
      'Pages written every week for the keywords you choose, checked for facts and quality',
      'A monthly technical audit with the fixes ready to hand over',
      'Weekly rank checks, Search Console, GA4 and every link to you in one place',
    ],
    features: ['keyword-research', 'keyword-ladders', 'content', 'technical-audits', 'backlinks'],
    plan: 'Every plan',
  },
  {
    id: 'aeo',
    short: 'AEO',
    name: 'Answer engine optimization',
    where: 'Being the answer Google shows above the results: AI Overviews, AI Mode, featured snippets and "People also ask".',
    what: [
      'Every rank check records the AI Overview, the featured snippet, "People also ask" and who sits above you',
      'Google AI Mode and AI Overviews checked for your name and your links',
      'Answer pages written with the answer first, question headings and a visible "Updated" date',
      'Your key pages scored for what an answer needs before it can quote them',
    ],
    features: ['keyword-ladders', 'ai-visibility', 'ai-growth', 'content'],
    plan: 'Every plan reads the Google answers. AI Mode and answer pages are on Growth',
  },
  {
    id: 'geo',
    short: 'GEO',
    name: 'Generative engine optimization',
    where: 'Being named and cited when buyers ask ChatGPT, Gemini, Perplexity, Claude or Copilot.',
    what: [
      'Up to 500 buyer questions asked every week, and a daily AI Pulse that alerts only on real changes',
      'How often you are named and cited, and your share against competitors, each with its range',
      'Wrong claims about your business found, with a correction drafted for you',
      'The pages AI cites without naming you, turned into pitches you approve',
      'AI crawler access checked, and the visits and revenue AI answers send you',
    ],
    features: ['ai-visibility', 'ai-growth', 'crawler-analytics', 'link-building'],
    plan: 'Growth and Enterprise',
  },
];

export const searchKindById = (id: SearchKindId): SearchKind => searchKinds.find((k) => k.id === id)!;

/** which kinds of search each capability works on (chips on /platform and /platform/<slug>); capabilities that run the platform
 *  itself (reports, delivery, integrations, setup, enterprise, agency portal) serve all three and carry no chips */
export const featureSearchKinds: Record<string, SearchKindId[]> = {
  autopilot: ['seo', 'aeo', 'geo'],
  'keyword-research': ['seo'],
  'keyword-ladders': ['seo', 'aeo'],
  content: ['seo', 'aeo', 'geo'],
  'technical-audits': ['seo'],
  'site-tracking': ['seo'],
  'ai-visibility': ['aeo', 'geo'],
  'ai-growth': ['aeo', 'geo'],
  'crawler-analytics': ['seo', 'geo'],
  backlinks: ['seo'],
  'link-building': ['seo', 'geo'],
};
