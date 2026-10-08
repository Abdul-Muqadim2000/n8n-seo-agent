// Builds the JSON body for POST /webhook/seo-keyword-check (the n8n API front door) from a validated app run.
//
// KEY ORDER MATTERS. Normalize Input reads several fields with a fuzzy `pick(body, word)` that returns the FIRST key containing the
// word: `business` would match `business_facts` / `business_name`, `email` would match `public_email`, `keyword` would match
// `keywords`. So the body always carries `mode, keyword, country, domain, email, callback_url, business, customers` first (empty
// strings included), and the longer keys come after. The harness scenario S23 runs these bodies through the real Quick Validate and
// Normalize Input code and checks the result (n8n/seo-agent/harness, fixtures from `npm run export:payloads`).

import { GOALS, PAGE_TYPES } from './constants';
import type { MonitorSettings, RunInput } from './schemas';

export interface SiteContext {
  domain: string;
  country: string;
  business: string;
  customers: string;
  goal: string;
  tone: string;
  cta: string;
  businessFacts: string;
  competitors: string[];
  brandNames: string[];
  ga4PropertyId: string;
}

export interface Delivery {
  callbackUrl: string;
  /** The user's e-mail when they want a copy by e-mail, else ''. */
  email: string;
}

type Body = Record<string, unknown>;

const goalLabel = (g: string) => GOALS.find((x) => x.value === g)?.label ?? g;
const pageTypeValue = (p: string) => PAGE_TYPES.find((x) => x.value === p)?.value ?? p;

export function monitorsBody(m: Partial<MonitorSettings>): Body {
  const out: Body = {};
  if (m.aiVisibility !== undefined) out.ai_visibility = m.aiVisibility;
  if (m.aiEngines !== undefined) out.ai_engines = m.aiEngines.join(', ');
  if (m.aiPromptsMax !== undefined) out.ai_prompts_max = m.aiPromptsMax;
  if (m.aiPulse !== undefined) out.ai_pulse = m.aiPulse;
  if (m.backlinks !== undefined) out.backlinks = m.backlinks;
  if (m.auditMonthly !== undefined) out.audit_monthly = m.auditMonthly;
  if (m.auditPages !== undefined) out.audit_pages = m.auditPages;
  if (m.auditJs !== undefined) out.audit_js = m.auditJs;
  if (m.brandNames !== undefined) out.brand_names = m.brandNames.join(', ');
  return out;
}

/** The fixed head every body starts with (see the note above). */
function head(mode: string, keyword: string, country: string, domain: string, d: Delivery, business = '', customers = ''): Body {
  return { mode, keyword, country, domain, email: d.email, callback_url: d.callbackUrl, business, customers };
}

export function buildN8nPayload(input: RunInput, site: SiteContext | null, d: Delivery): Body {
  const dom = site?.domain ?? '';
  const s = site;
  switch (input.mode) {
    case 'verdict':
      return head('verdict', input.keyword, input.country, dom, d, input.business || s?.business || '', s?.customers ?? '');

    case 'keyword': {
      const receive = [input.receiveReport ? 'Keyword Report' : null, input.receiveContent ? 'Page Content' : null].filter(Boolean);
      return {
        ...head('keyword', input.keyword, input.country, dom, d, s?.business ?? '', s?.customers ?? ''),
        page_type: pageTypeValue(input.pageType),
        existing_page_url: input.existingPageUrl,
        local_area: input.localArea,
        video_url: input.videoUrl || undefined,
        video_transcript: input.videoUrl ? input.videoTranscript : undefined,
        business_facts: input.businessFacts || s?.businessFacts || '',
        cta: input.cta || s?.cta || '',
        tone: input.tone,
        goal: goalLabel(input.goal),
        features: input.checkPageExists && dom ? ['Check if page exists'] : [],
        receive,
        // a ladder page: the run marks the ladder row, links to the ladder's top page and siblings (ladder_links are added by the server)
        ...(input.ladder && dom
          ? { ladder_id: input.ladder.id, ladder_rung: input.ladder.rung, ladder_head: input.ladder.head, ladder_page_no: input.ladder.pageNo, force_content: true }
          : {}),
      };
    }

    case 'discover': {
      const receive = [input.receiveReport ? 'Keyword Report' : null, input.receiveContent ? 'Page Content' : null].filter(Boolean);
      const features = [input.siteAudit ? 'Site Audit' : null, input.fullReport ? 'Full SEO Report' : null].filter(Boolean);
      return {
        ...head('discover', '', input.country, dom, d, input.business || s?.business || '', input.customers || s?.customers || ''),
        goal: goalLabel(input.goal),
        business_facts: input.businessFacts || s?.businessFacts || '',
        features,
        receive,
      };
    }

    case 'describe':
      return head('describe', '', s?.country ?? '', dom, d);

    case 'audit':
      return {
        ...head('audit', '', input.country, dom, d),
        report_type: input.reportType === 'full' ? 'Full SEO Report' : 'Site Audit',
        crawl_pages: input.crawlPages,
        crawl_js: input.crawlJs,
        competitors: input.competitors.length ? input.competitors : (s?.competitors ?? []),
      };

    case 'ladder':
      return {
        ...head('ladder', input.keyword, input.country, dom, d, input.business || s?.business || '', input.customers || s?.customers || ''),
        business_facts: input.businessFacts || s?.businessFacts || '',
        goal: goalLabel(input.goal),
        tone: input.tone,
        cta: input.cta || s?.cta || '',
        pages_now: input.pagesNow,
      };

    case 'track':
      return {
        ...head('track', '', input.country, dom, d),
        keywords: input.keywords,
        ga4_property_id: input.ga4PropertyId || s?.ga4PropertyId || '',
        blogs_per_week: input.blogsPerWeek,
        competitors: input.competitors.length ? input.competitors : (s?.competitors ?? []),
        monitors: monitorsBody({ ...input.monitors, brandNames: input.monitors.brandNames.length ? input.monitors.brandNames : (s?.brandNames ?? []) }),
      };

    case 'published':
      return { ...head('published', input.keyword, s?.country ?? '', dom, d), published_url: input.publishedUrl };

    case 'checkin':
      return {
        ...head('checkin', '', s?.country ?? '', dom, d),
        manual_action: input.manualAction,
        security_issue: input.securityIssue,
        notes: input.notes,
        pages_csv: input.pagesCsv,
      };

    case 'case_study':
      return {
        ...head('case_study', input.keyword, input.country, dom, d, s?.business ?? '', s?.customers ?? ''),
        case_study: {
          client_name: input.clientName,
          client_public: input.clientPublic,
          industry: input.industry,
          location: input.location,
          service: input.service,
          challenge: input.challenge,
          solution: input.solution,
          timeline: input.timeline,
          results: input.results,
          quote: input.quote,
          quote_by: input.quoteBy,
        },
      };

    case 'profile':
      // `country` here is the business address country (Normalize Input turns it into the profile's country code).
      return {
        ...head('profile', '', input.address.country, dom, d),
        author: {
          name: input.author.name,
          job_title: input.author.jobTitle,
          credentials: input.author.credentials,
          bio: input.author.bio,
          url: input.author.url,
          same_as: input.author.sameAs,
          image_url: input.author.imageUrl,
          knows_about: input.author.knowsAbout,
        },
        reviewer: { name: input.reviewer.name, job_title: input.reviewer.jobTitle, url: input.reviewer.url },
        business_name: input.businessName,
        business_type: input.businessType,
        address: {
          street: input.address.street,
          city: input.address.city,
          region: input.address.region,
          postal_code: input.address.postalCode,
          country: input.address.country,
        },
        phone: input.phone,
        public_email: input.publicEmail,
        opening_hours: input.openingHours,
        service_areas: input.serviceAreas,
        map_url: input.mapUrl,
        logo_url: input.logoUrl,
      };

    case 'ai_visibility':
      return {
        ...head('ai_visibility', '', input.country, dom, d),
        topics: input.topics,
        competitors: input.competitors.length ? input.competitors : (s?.competitors ?? []),
      };

    case 'backlinks':
      return {
        ...head('backlinks', '', input.country, dom, d),
        competitors: input.competitors.length ? input.competitors : (s?.competitors ?? []),
        ...(input.freeOnly ? { free_only: true } : {}),
      };
  }
}

/** Removes undefined values (JSON.stringify drops them anyway; this keeps logs and stored copies clean). */
export function compactBody(b: Body): Body {
  return Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined));
}
