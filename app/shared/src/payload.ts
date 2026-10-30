// Builds the JSON body for POST /webhook/seo-keyword-check (the n8n API front door) from a validated app run.
//
// KEY ORDER MATTERS. Normalize Input reads several fields with a fuzzy `pick(body, word)` that returns the FIRST key containing the
// word: `business` would match `business_facts` / `business_name`, `email` would match `public_email`, `keyword` would match
// `keywords`. So the body always carries `mode, keyword, country, domain, email, callback_url, business, customers` first (empty
// strings included), and the longer keys come after. The harness scenario S23 runs these bodies through the real Quick Validate and
// Normalize Input code and checks the result (n8n/seo-agent/harness, fixtures from `npm run export:payloads`).

import { GOALS, PAGE_TYPES } from './constants';
import type { MonitorSettings, RunInput } from './schemas';
import { factsForEngine, type FactAnswers } from './page-review';

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
  /** keyword-first: the website's IANA time zone ('' = the engine's) and what it sells */
  timezone?: string;
  services?: string[];
  /** H3 (2026-10-28): the business facts answered on written pages (sites.fact_answers), sent with every page run */
  factAnswers?: FactAnswers;
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
  // G6 (2026-10-18): buyer roles, extra markets and the pulse's sampling, '' clears a list in Site Admin only as ' ', which the server adds
  if (m.aiPersonas !== undefined) out.ai_personas = m.aiPersonas.join(', ');
  if (m.aiMarkets !== undefined) out.ai_markets = m.aiMarkets.join(', ');
  if (m.aiPulseMode !== undefined) out.ai_pulse_mode = m.aiPulseMode === 'auto' ? 'auto' : m.aiPulseMode;
  if (m.aiPulsePerWeek !== undefined) out.ai_pulse_per_week = m.aiPulsePerWeek;   // 0 = chosen for the precision targets (the engine stores it empty)
  if (m.aiGrowth !== undefined) out.ai_growth = m.aiGrowth;
  if (m.aiPagesPerMonth !== undefined) out.ai_pages_month = m.aiPagesPerMonth;
  if (m.backlinks !== undefined) out.backlinks = m.backlinks;
  if (m.linkBuilder !== undefined) out.link_builder = m.linkBuilder;
  if (m.auditMonthly !== undefined) out.audit_monthly = m.auditMonthly;
  if (m.auditPages !== undefined) out.audit_pages = m.auditPages;
  if (m.auditJs !== undefined) out.audit_js = m.auditJs;
  if (m.brandNames !== undefined) out.brand_names = m.brandNames.join(', ');
  // AI visibility wave 2 (WAVE2_CONTRACTS.md §4), only when set: an absent key keeps the engine's default
  if (m.aiClaudeWeekly !== undefined) out.ai_claude_weekly = m.aiClaudeWeekly;
  if (m.aiPulseEngines !== undefined) out.ai_pulse_engines = m.aiPulseEngines.join(', ');
  if (m.aiPersonaContext !== undefined) out.ai_persona_context = m.aiPersonaContext;
  if (m.aiFanoutCheck !== undefined) out.ai_fanout_check = m.aiFanoutCheck;
  if (m.aiSovSet !== undefined) out.ai_sov_set = m.aiSovSet.join(', ');
  if (m.aiAlertRules !== undefined) out.ai_alert_rules_json = JSON.stringify(m.aiAlertRules);
  if (m.aiDemandMarket !== undefined) out.ai_demand_market = m.aiDemandMarket;
  // AI-FOCUS (2026-10-27): the pulse scope and whether the questions follow the focus ('' = on)
  if (m.aiPulseScope !== undefined) out.ai_pulse_scope = m.aiPulseScope;
  if (m.aiFocusMode !== undefined) out.ai_focus_mode = m.aiFocusMode === 'off' ? 'off' : '';
  // Index coverage (2026-10-29, DESIGN.md §2.6): last, only when set (an absent key keeps the engine's default: on, 300 a day)
  if (m.indexWatch !== undefined) out.index_watch = m.indexWatch;
  if (m.indexDailyCap !== undefined) out.index_daily_cap = m.indexDailyCap;
  // wave 2 (DESIGN_WAVE2 §2.5): after the index check's own two, only when set (absent = the engine's default: off)
  if (m.indexSitemapSubmit !== undefined) out.index_sitemap_submit = m.indexSitemapSubmit;
  return out;
}

/**
 * The body of Site Admin `monitors` (n8n Admin_Action.js -> Monitor_Row_Admin.js), as the website settings save it. Site Admin keeps a
 * field it is given as '' (empty = "not given"), so a list the owner emptied is sent as a single space, which it stores as cleared: the brand
 * names, buyer roles, extra markets and (W2-FIX 2026-10-23) the pulse's engines, which otherwise stayed on the last choice for ever. The
 * share-of-voice set and the alert rules clear with '' and '[]' (Admin Action reads them on their own). Harness S23 / W2FIX-3 run these
 * bodies through the engine's own code (fixtures_platform_admin.json, `npm run export:payloads`).
 */
export function siteAdminMonitorsBody(monitors: Partial<MonitorSettings>, competitors?: readonly string[]): Body {
  const m = monitorsBody(monitors);
  if (monitors.brandNames && !monitors.brandNames.length) m.brand_names = ' ';
  if (monitors.aiPersonas && !monitors.aiPersonas.length) m.ai_personas = ' ';   // G6
  if (monitors.aiMarkets && !monitors.aiMarkets.length) m.ai_markets = ' ';
  if (monitors.aiPulseEngines && !monitors.aiPulseEngines.length) m.ai_pulse_engines = ' ';   // W2-FIX: back to the default pulse engines
  return { ...m, ...(competitors ? { competitors: competitors.join(', ') || ' ' } : {}) };
}

/**
 * W2-FIX (2026-10-23): the server's quote of an on-demand AI visibility check (the website's whole panel, aiOnDemandRunCost), sent with the
 * run so the engine's front door reserves it rather than its flat table row (n8n build_v4.py section 149, CC.pick). US dollars.
 */
export function aiPanelQuoteBody(q: { dfs: number; ai: number }, panel: number): Body {
  const r4 = (x: number) => Math.round((Number(x) || 0) * 10000) / 10000;
  return { dfs_usd: r4(q.dfs), ai_usd: r4(q.ai), panel: Math.round(panel) };
}

/**
 * H3 (2026-10-28): the business facts the client answered on earlier pages, for every run that writes a page. Exact keys, always AFTER
 * `business` and `business_facts` (the fuzzy `pick` returns the first key containing a word): the stored facts as key -> text, and every
 * key decided, so the engine never asks a stored question again. Nothing when the website has none.
 */
export function factsBody(s: Pick<SiteContext, 'factAnswers'> | null | undefined): Body {
  if (!s?.factAnswers || !Object.keys(s.factAnswers).length) return {};
  const f = factsForEngine(s.factAnswers);
  return { business_facts_kv: f.business_facts_kv, stored_fact_keys: f.stored_fact_keys };
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
        ...head('keyword', input.keyword, input.country, dom, d, input.business || s?.business || '', s?.customers ?? ''),
        page_type: pageTypeValue(input.pageType),
        existing_page_url: input.existingPageUrl,
        local_area: input.localArea,
        video_url: input.videoUrl || undefined,
        video_transcript: input.videoUrl ? input.videoTranscript : undefined,
        business_facts: input.businessFacts || s?.businessFacts || '',
        ...factsBody(s),
        cta: input.cta || s?.cta || '',
        tone: input.tone,
        goal: goalLabel(input.goal),
        features: input.checkPageExists && dom ? ['Check if page exists'] : [],
        receive,
        // a ladder page: the run marks the ladder row, links to the ladder's top page and siblings, and is clamped to the length the
        // ladder's verdict set (`ladder_links` and `ladder_words` are added by the server from the stored rows: runs.ts ladderPageContext)
        ...(input.ladder && dom
          ? { ladder_id: input.ladder.id, ladder_rung: input.ladder.rung, ladder_head: input.ladder.head, ladder_page_no: input.ladder.pageNo, force_content: true }
          : {}),
        // v4.12: an AI answer target, the brief and the copywriter write the page AI should cite for the question
        ...(input.aiTarget
          ? { ai_target: { question: input.aiTarget.question, kind: input.aiTarget.kind, target_id: input.aiTarget.targetId, fanout: input.aiTarget.fanout, sources: input.aiTarget.sources.map((x) => ({ u: x.url, t: x.title })), competitors: input.aiTarget.competitors } }
          : {}),
        // W0-D (2026-10-29): the client chose "Write it anyway" on a held page (exact key, after the fuzzy-matched head; Normalize Input passes it
        // through as hold_ack: { score }, harness S23)
        ...(input.holdAck ? { hold_ack: { score: input.holdAck.score ?? null } } : {}),
      };
    }

    case 'discover': {
      // keyword-first (R-K6): research from the app never asks for a page on its own pick (the engine refuses it for app callers too)
      const receive = [input.receiveReport ? 'Keyword Report' : null].filter(Boolean);
      const features = [input.siteAudit ? 'Site Audit' : null, input.fullReport ? 'Full SEO Report' : null].filter(Boolean);
      return {
        ...head('discover', '', input.country, dom, d, input.business || s?.business || '', input.customers || s?.customers || ''),
        goal: goalLabel(input.goal),
        business_facts: input.businessFacts || s?.businessFacts || '',
        features,
        receive,
        // D2 (2026-10-21): what the website sells, so the research judges each keyword's service fit (the setup research runs before Track
        // my site stores them on the engine's site row). Exact key, after the fuzzy-matched head; absent = the engine keeps its stored list.
        ...(s?.services?.length ? { services: s.services.slice(0, 30) } : {}),
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
        // B5-12 (W3-A): the fix list can weigh problems by GA4 key events when the website's property is known
        ga4_property_id: s?.ga4PropertyId || '',
        // D2 / RV-13 (2026-10-21): what the website sells, so the full report's keyword suggestions keep to it (exact key, after the head)
        ...(s?.services?.length ? { services: s.services.slice(0, 30) } : {}),
      };

    case 'ladder':
      return {
        ...head('ladder', input.keyword, input.country, dom, d, input.business || s?.business || '', input.customers || s?.customers || ''),
        business_facts: input.businessFacts || s?.businessFacts || '',
        ...factsBody(s),
        goal: goalLabel(input.goal),
        tone: input.tone,
        cta: input.cta || s?.cta || '',
        pages_now: input.pagesNow,
        // keyword-first (R-K1): who chose the keyword (none = the person typed it) and the mode it starts in (a Manual ladder writes
        // nothing at start). Exact keys, read by Normalize Input as they are; after the fuzzy-matched head.
        chosen_by: input.chosenBy ?? 'client_typed',
        ...(input.ladderMode ? { ladder_mode: input.ladderMode } : {}),
      };

    case 'track':
      return {
        ...head('track', '', input.country, dom, d),
        keywords: input.keywords,
        ga4_property_id: input.ga4PropertyId || s?.ga4PropertyId || '',
        blogs_per_week: input.blogsPerWeek,
        competitors: input.competitors.length ? input.competitors : (s?.competitors ?? []),
        monitors: monitorsBody({ ...input.monitors, brandNames: input.monitors.brandNames.length ? input.monitors.brandNames : (s?.brandNames ?? []) }),
        // keyword-first (§14.5): the website's zone and what it sells (key present = replace the stored list); the server adds
        // `tracking_started_at` (the website's first tracking, kept on every re-save). Exact keys, after the fuzzy-matched head.
        ...(input.timezone || s?.timezone ? { timezone: input.timezone || s?.timezone || '' } : {}),
        ...(input.services !== undefined ? { services: input.services } : s?.services?.length ? { services: s.services } : {}),
        // P1 (2026-10-20): the website's business facts, stored by Track my site on the engine's site row, which the Content Cadence's pages and
        // the readiness rule read (the app is their source; Website settings sends Site Admin `facts` when they change). Exact key, after the head.
        ...(s ? { business_facts: (s.businessFacts || '').slice(0, 2000) } : {}),
      };

    case 'published':
      // exact key after the fuzzy-matched head (no pick() word matches "content request id"); the engine finds the draft by it first
      // 2026-10-27: `confirm_mismatch` only after the owner read the check's warning (exact key, after the head; the server adds the draft's own
      // title and main heading, `draft_title` / `draft_h1`, from its report)
      return {
        ...head('published', input.keyword, s?.country ?? '', dom, d),
        published_url: input.publishedUrl,
        ...(input.contentRequestId ? { content_request_id: input.contentRequestId } : {}),
        ...(input.confirmMismatch ? { confirm_mismatch: true } : {}),
      };

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
        ...factsBody(s),
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
        // G31: the house style, stored on the same profile row (style_*), applied in the writing prompts and checked before delivery
        style: {
          brand_form: input.style.brandForm,
          legal_name: input.style.legalName,   // H2 (2026-10-27): stored apart from the brand (seo_profiles.style_legal_name)
          brand_wrong: input.style.brandWrong,
          spelling: input.style.spelling,
          avoid: input.style.avoid,
          tone: input.style.tone,
          notes: input.style.notes,
        },
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
