import { z } from 'zod';
import {
  AI_DEFAULT_ENGINES,
  AI_ENGINE_VALUES,
  AI_PAGES_DEFAULT,
  AI_PAGES_MAX,
  AI_PROMPTS_DEFAULT,
  AI_PROMPTS_MAX,
  COMPANY_SIZES,
  COUNTRY_NAMES,
  GOAL_VALUES,
  PAGE_TYPE_VALUES,
  PROSPECT_STATUSES,
  TONES,
} from './constants';
import { cleanDomain, domainOk } from './domain';
import { isValidTimezone } from './cycle-clock';
import { TOPIC_SOURCES } from './cycles';
import { aiAlertRulesSchema } from './ai-trends';

// ---------- building blocks ----------
const opt = (max: number) => z.string().trim().max(max, `At most ${max} characters`).default('');
const req = (max: number, msg = 'Required') => z.string().trim().min(1, msg).max(max, `At most ${max} characters`);
const URL_RE = /^https?:\/\/\S+$/i;
export const urlField = z.string().trim().regex(URL_RE, 'Enter a full link (https://...)').max(400);
const optUrl = z.union([z.literal(''), urlField]).default('');
export const domainField = z
  .string()
  .trim()
  .min(1, 'Enter your website address')
  .transform(cleanDomain)
  .refine(domainOk, 'Enter a public website address like example.com');
const domainList = (max: number) => z.array(domainField).max(max, `Up to ${max} domains`).default([]);
const keywordField = z
  .string()
  .trim()
  .min(2, 'Enter a keyword')
  .max(120, 'Keep the keyword under 120 characters')
  .transform((k) => k.toLowerCase().replace(/\s+/g, ' '));
const country = z.enum(COUNTRY_NAMES, { message: 'Choose a country' });
const goal = z.enum(GOAL_VALUES).default('leads');
const tone = z.enum(TONES).default(TONES[0]);
const siteId = z.string().uuid('Choose a website');
const optionalSiteId = siteId.nullable().default(null);
const emailCopy = z.boolean().default(true);
const stringList = (max: number, itemMax = 120) => z.array(z.string().trim().min(1).max(itemMax)).max(max).default([]);

/**
 * A PATCH body built from a create schema: every field optional and NO default applied when it is left out. Zod 4 applies an inner
 * `.default()` even to an absent key after `.partial()` (and for `.default(x).optional()`), so a partial PATCH reset every field it
 * did not send to its default (D1, paid pre-launch run 2026-10-21: the onboarding Tracking step wiped the business facts the client had
 * just typed). Each field keeps its own validation (trim, max lengths, refinements); only the outer default / optional wrappers go.
 */
export function patchOf<T extends z.ZodRawShape>(o: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(o.shape).map(([k, s]) => {
      let t = s as z.ZodType;
      while (t instanceof z.ZodDefault || t instanceof z.ZodOptional) t = (t as z.ZodDefault<z.ZodType>).unwrap() as z.ZodType;
      return [k, t.optional()];
    }),
  );
  return z.object(shape) as unknown as z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }>;
}

// ---------- auth ----------
export const emailField = z.string().trim().toLowerCase().email('Enter a valid e-mail address').max(200);
export const passwordField = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200, 'At most 200 characters')
  .refine((p) => /[a-zA-Z]/.test(p) && /[^a-zA-Z]/.test(p), 'Mix letters with numbers or symbols');

export const signupSchema = z.object({
  name: req(100, 'Enter your name'),
  email: emailField,
  password: passwordField,
  inviteToken: z.string().max(200).optional(),
});
export const loginSchema = z.object({ email: emailField, password: z.string().min(1, 'Enter your password').max(200) });
export const forgotSchema = z.object({ email: emailField });
export const resetSchema = z.object({ token: z.string().min(10).max(200), password: passwordField });
export const changePasswordSchema = z.object({ currentPassword: z.string().max(200).default(''), newPassword: passwordField });
export const updateMeSchema = z.object({ name: req(100, 'Enter your name') });

// ---------- organizations & team ----------
export const createOrgSchema = z.object({
  name: req(100, 'Enter the company name').min(2, 'At least 2 characters'),
  industry: opt(100),
  size: z.union([z.literal(''), z.enum(COMPANY_SIZES)]).default(''),
  website: opt(200),
});
export const updateOrgSchema = patchOf(createOrgSchema);
// G5: client roles are accepted here and checked against the company's kind by the server (inviteRoleProblem)
export const inviteSchema = z.object({ email: emailField, role: z.enum(['admin', 'member', 'viewer', 'client_approver', 'client_viewer']).default('member') });
export const updateMemberSchema = z.object({ role: z.enum(['admin', 'member', 'viewer', 'client_approver', 'client_viewer']) });
export const orgBudgetSchema = z.object({ monthlyBudgetUsd: z.number().min(0).max(100000), disabled: z.boolean().optional() });

// ---------- sites ----------
export const monitorSettingsSchema = z.object({
  aiVisibility: z.boolean().default(true),
  aiEngines: z.array(z.enum(AI_ENGINE_VALUES)).min(1, 'Choose at least one AI engine').default([...AI_DEFAULT_ENGINES]),
  aiPromptsMax: z.number().int().min(3).max(AI_PROMPTS_MAX).default(AI_PROMPTS_DEFAULT),
  /** v4.9: the daily AI Pulse (ChatGPT, Gemini and Google AI Mode on the whole panel, Tuesday to Sunday) */
  aiPulse: z.boolean().default(true),
  /** G6 (2026-10-18): the buyer roles the panel is written for (e.g. CFO, IT manager), empty: the writer picks */
  aiPersonas: stringList(6, 40),
  /** G6: extra markets the panel is asked in, as country-language (e.g. SA-en, AE-ar); the website's own market is always included */
  aiMarkets: z.array(z.string().trim().regex(/^[A-Za-z]{2}([-_ ][A-Za-z]{2,3})?$/, 'Use a country code and a language, e.g. SA-en')).max(5).default([]),
  /** G6: how the daily pulse covers a big panel: auto (all of it up to 50 questions, a rotating sample above), sample, or every question */
  aiPulseMode: z.enum(['auto', 'sample', 'full']).default('auto'),
  /** G6: mornings a week each question is asked in a rotating sample (0 = chosen for the precision targets) */
  aiPulsePerWeek: z.number().int().min(0).max(6).default(0),
  /** v4.12: the weekly AI growth loop (Bing / IndexNow submission, AI-readiness checks, earned-media list + drafts, questions to win) */
  aiGrowth: z.boolean().default(true),
  /** v4.12: AI answer / refresh pages a month written by the Monday content run (0 = none; the loop still plans them) */
  aiPagesPerMonth: z.number().int().min(0).max(AI_PAGES_MAX).default(AI_PAGES_DEFAULT),
  backlinks: z.boolean().default(true),
  /** v4.13: the weekly Link Builder (new opportunities, qualification, contacts, drafted sequences the app sends after approval) */
  linkBuilder: z.boolean().default(true),
  auditMonthly: z.boolean().default(true),
  auditPages: z.number().int().min(50).max(1000).default(200),
  auditJs: z.boolean().default(false),
  brandNames: stringList(10, 80),
  // AI visibility wave 2 (WAVE2_CONTRACTS.md §4): optional with NO default, so a body that does not set them sends nothing and every
  // website keeps today's cost and behaviour until its owner changes one (the engine's defaults: off, '' = today's pulse engines, 0, '')
  /** ask Claude every week, not once a month */
  aiClaudeWeekly: z.boolean().optional(),
  /** the engines the daily pulse asks (empty = today's pulse engines) */
  aiPulseEngines: z.array(z.enum(AI_ENGINE_VALUES)).max(9).optional(),
  /** send each buyer role to the API engines as context, not only in the wording ("API answers") */
  aiPersonaContext: z.boolean().optional(),
  /** fan-out searches checked in Google each week (0 = off; the app offers 25 / 50 / 100) */
  aiFanoutCheck: z.number().int().refine((v) => [0, 25, 50, 100].includes(v), 'Choose off, 25, 50 or 100').optional(),
  /** the fixed set of brands share of voice is counted against (entity ids or domains; empty = the competitors you set) */
  aiSovSet: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  /** the owner's alert rules (a rule fires only on a comparable run, when its own test passes and the change reaches the threshold) */
  aiAlertRules: aiAlertRulesSchema.optional(),
  /** W2-E3: the monthly market trend from the AI-answer database (3 tasks on the month's full run, about $0.33 a month; ChatGPT data is US-English only) */
  aiDemandMarket: z.boolean().optional(),
  /** AI-FOCUS (2026-10-27): what the daily pulse asks: 'focus' (the questions about the keywords you work on, and the pinned ones) or 'all' (the
   * whole panel). Optional with no default: a body that does not set it changes nothing (a new website starts at 'focus' in the engine) */
  aiPulseScope: z.enum(['focus', 'all']).optional(),
  /** AI-FOCUS: 'auto' = the questions follow your keyword ladders, pages and services; 'off' = they never change by themselves */
  aiFocusMode: z.enum(['auto', 'off']).optional(),
  /** Index coverage (2026-10-29): the free daily index check (which pages Google left out and why). Optional with no default, like the
   *  wave-2 options: a body that does not set it sends nothing, and the engine reads an empty value as on */
  indexWatch: z.boolean().optional(),
  /** Index coverage: Google page inspections a day for this website (20 to 1,200; the engine's default is 300) */
  indexDailyCap: z.number().int().min(20, 'At least 20 a day').max(1200, 'At most 1,200 a day').optional(),
  /** Index coverage wave 2 (DESIGN_WAVE2 §2.5): let Alaventra submit the website's sitemap in Search Console (needs Full access there).
   *  Optional with no default and sent last: a body that does not set it sends nothing, and the engine reads an empty value as OFF */
  indexSitemapSubmit: z.boolean().optional(),
});
export type MonitorSettings = z.output<typeof monitorSettingsSchema>;

export const siteBusinessSchema = z.object({
  country,
  business: opt(500),
  customers: opt(300),
  goal,
  tone,
  cta: opt(200),
  businessFacts: opt(2000),
  competitors: domainList(3),
  brandNames: stringList(10, 80),
  /** keyword-first (§5.2): "What do you sell?", the main services or products; sent to the engine with "Track my site" */
  services: z.array(z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters')).max(30, 'At most 30').optional(),
  /** keyword-first (§4.2): the website's IANA time zone (the owner's browser zone in onboarding); its cycles run at 06:00 there */
  timezone: z
    .string()
    .trim()
    .max(64)
    .refine((v) => v === '' || isValidTimezone(v), 'Unknown time zone')
    .optional(),
});
export const createSiteSchema = siteBusinessSchema.extend({ domain: domainField });
// D1: patchOf, not .partial(): a field left out of the body is left out of the update (the GA4 picker sends its ID alone)
export const updateSiteSchema = patchOf(siteBusinessSchema).extend({
  ga4PropertyId: z.string().trim().regex(/^\d{0,16}$/, 'Digits only').optional(),
  keywords: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
});
export const verifySiteSchema = z.object({ method: z.enum(['search_console', 'dns', 'meta']) });

// ---------- runs (one schema per n8n mode) ----------
export const verdictInput = z.object({
  mode: z.literal('verdict'),
  siteId: optionalSiteId,
  keyword: keywordField,
  country,
  business: opt(500),
  emailCopy,
});

export const keywordInput = z
  .object({
    mode: z.literal('keyword'),
    siteId: optionalSiteId,
    keyword: keywordField,
    country,
    /** "What you sell": the form asks for it without a website (with one, the site's description is used) */
    business: opt(500),
    pageType: z.enum(PAGE_TYPE_VALUES).default('Service Page'),
    existingPageUrl: optUrl,
    localArea: opt(80),
    videoUrl: optUrl,
    videoTranscript: opt(60000),
    businessFacts: opt(2000),
    cta: opt(200),
    tone,
    goal,
    checkPageExists: z.boolean().default(false),
    receiveReport: z.boolean().default(true),
    receiveContent: z.boolean().default(true),
    /** a page of a keyword ladder (pipeline "write now"): keeps the ladder row, its internal links and the rank tracking in step */
    ladder: z
      .object({ id: z.string().trim().min(3).max(64), rung: z.number().int().min(0).max(10), head: z.string().trim().max(120).default(''), pageNo: z.number().int().min(0).max(100).default(0) })
      .optional(),
    /** v4.12: an AI answer target (AI visibility "Write the page"): the question AI answers without you, the searches it runs first, the pages it
     *  cites and the businesses it names, the page is written to be the one it cites */
    aiTarget: z
      .object({
        question: z.string().trim().min(8).max(300),
        kind: z.enum(['answer', 'refresh']).default('answer'),
        targetId: z.string().trim().max(120).default(''),
        fanout: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
        sources: z.array(z.object({ url: z.string().trim().url().max(300), title: z.string().trim().max(140).default('') })).max(6).default([]),
        competitors: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
      })
      .optional(),
    /** keyword-first (R-K5): where an approved suggestion came from ("Write it" on a "Coming up" item or a suggestion), kept on the
     *  website's content log so the page is shown and counted as that kind of page. The app keeps it; the engine is not sent it (Normalize
     *  Input reads no `source` field, and the content log row the app writes at the start carries it, which the engine keeps). */
    source: z.enum(TOPIC_SOURCES).optional(),
    emailCopy,
  })
  .superRefine((v, ctx) => {
    if (v.pageType === 'Local Page' && !v.localArea && !/\b(in|near|around)\s+[a-z]/i.test(v.keyword))
      ctx.addIssue({ code: 'custom', path: ['localArea'], message: 'Enter the city or area for a local page' });
    if (!v.receiveReport && !v.receiveContent)
      ctx.addIssue({ code: 'custom', path: ['receiveContent'], message: 'Choose at least one deliverable' });
    if ((v.existingPageUrl || v.checkPageExists) && !v.siteId)
      ctx.addIssue({ code: 'custom', path: ['existingPageUrl'], message: 'Choose your website to improve or check an existing page' });
  });

export const discoverInput = z
  .object({
    mode: z.literal('discover'),
    siteId: optionalSiteId,
    business: opt(500),
    customers: opt(300),
    country,
    goal,
    businessFacts: opt(2000),
    siteAudit: z.boolean().default(false),
    fullReport: z.boolean().default(false),
    receiveReport: z.boolean().default(true),
    /** keyword-first (R-K6): research never writes a page on its own pick from the app. Accepted for older callers and always stored false. */
    receiveContent: z.boolean().default(false).transform((): false => false),
    emailCopy,
  })
  .superRefine((v, ctx) => {
    if (!v.business && !v.siteId) ctx.addIssue({ code: 'custom', path: ['business'], message: 'Describe your business or choose your website' });
    if ((v.siteAudit || v.fullReport) && !v.siteId)
      ctx.addIssue({ code: 'custom', path: ['siteAudit'], message: 'An audit needs your website' });
  });

export const describeInput = z.object({ mode: z.literal('describe'), siteId, emailCopy: z.boolean().default(false) });

export const auditInput = z
  .object({
    mode: z.literal('audit'),
    siteId,
    country,
    reportType: z.enum(['site_audit', 'full']).default('site_audit'),
    crawlPages: z.number().int().min(50).max(1000).default(200),
    crawlJs: z.boolean().default(false),
    competitors: domainList(3),
    emailCopy,
  })
  .refine((v) => !(v.crawlJs && v.crawlPages > 500), {
    path: ['crawlPages'],
    message: 'JavaScript rendering allows at most 500 pages',
  });

/** App-only choices for a new keyword ladder (the 3-step flow): applied to the ladder's settings row when its plan arrives (the
 * ladder_plan callback), never sent to n8n. `first`: priority 1 (the other ladders move down). Admins only (members' are dropped). */
export const ladderPrefsSchema = z.object({
  mode: z.enum(['auto', 'manual'], { message: 'Choose Auto or Manual' }).optional(),
  first: z.boolean().optional(),
});
export type LadderPrefs = z.output<typeof ladderPrefsSchema>;

export const ladderInput = z.object({
  mode: z.literal('ladder'),
  siteId,
  keyword: keywordField,
  country,
  business: opt(500),
  customers: opt(300),
  businessFacts: opt(2000),
  goal,
  tone,
  cta: opt(200),
  pagesNow: z.number().int().min(1).max(3).default(1),
  ladderPrefs: ladderPrefsSchema.optional(),
  /** keyword-first (SCHEDULING_KEYWORDS_PLAN.md §5.1 R-K1): who chose the keyword. A person typing it: client_typed (the default); one of
   * our recommendations: client_picked; a level-3 announcement the client did not stop: system_announced (set by the server only) */
  chosenBy: z.enum(['client_typed', 'client_picked', 'system_announced'], { message: 'Unknown choice' }).optional(),
  /** the mode the ladder starts in: a Manual ladder writes nothing at start (its pages wait for an OK); none = the website's default */
  ladderMode: z.enum(['auto', 'manual'], { message: 'Choose Auto or Manual' }).optional(),
  /** P1 (2026-10-20): set by the SERVER only (any value a caller sends is replaced): the engine will hold this ladder's first page because
   * the website's author profile or business facts are missing, so the run is quoted for the plan alone. KW-APP D8 (2026-10-21): 'manual'
   * when the ladder starts Manual (asked for, or the website's default): the engine writes nothing at start, so nothing is quoted for pages */
  pagesHeld: z.enum(['profile', 'manual']).optional(),
  emailCopy,
});

export const trackInput = z.object({
  mode: z.literal('track'),
  siteId,
  country,
  keywords: stringList(20, 100),
  ga4PropertyId: z.string().trim().regex(/^\d{0,16}$/, 'Digits only').default(''),
  blogsPerWeek: z.number().int().min(0).max(3).default(0),
  competitors: domainList(3),
  monitors: monitorSettingsSchema.default(monitorSettingsSchema.parse({})),
  /** keyword-first (§5.2 / §14.5): the website's IANA time zone (the owner's browser zone; its cycles run at 06:00 there). '' = keep the
   * website's stored zone (or the engine's) */
  timezone: z
    .string()
    .trim()
    .max(64)
    .refine((v) => v === '' || isValidTimezone(v), 'Unknown time zone')
    .optional(),
  /** "What do you sell?": the main services or products (replace the stored list when given; leave out to keep it) */
  services: z.array(z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters')).max(30, 'At most 30').optional(),
  emailCopy,
});

export const publishedInput = z.object({
  mode: z.literal('published'),
  siteId,
  keyword: keywordField,
  publishedUrl: urlField,
  /** 2026-10-23: the engine request id of the page run that wrote the draft (its report or content row), so the check marks THAT draft
   *  published even when the keyword is typed differently; empty = matched by keyword, as before */
  contentRequestId: z
    .string()
    .trim()
    .max(120)
    .regex(/^[A-Za-z0-9:_.-]*$/, 'Not a valid draft id')
    .default(''),
  /** 2026-10-27: the owner read the check's warning (the live page did not match the draft) and says it is the right page: the engine then
   *  records it published, not verified, with the reason kept. Never accepted for an address that is another keyword's published page. */
  confirmMismatch: z.boolean().default(false),
  emailCopy: z.boolean().default(false),
});

export const checkinInput = z.object({
  mode: z.literal('checkin'),
  siteId,
  manualAction: z.boolean().default(false),
  securityIssue: z.boolean().default(false),
  notes: opt(1000),
  pagesCsv: z.string().max(400000, 'The export is too large (400 KB max)').default(''),
  emailCopy: z.boolean().default(false),
});

export const caseStudyInput = z.object({
  mode: z.literal('case_study'),
  siteId,
  country,
  service: req(160, 'Enter the service you delivered'),
  clientName: req(160, 'Enter the client name or a description'),
  clientPublic: z.boolean().default(true),
  industry: opt(100),
  location: opt(100),
  challenge: req(2000, 'Describe the challenge'),
  solution: req(3000, 'Describe what you did'),
  timeline: opt(200),
  results: req(2000, 'Describe the results, with numbers'),
  quote: opt(600),
  quoteBy: opt(160),
  keyword: z.string().trim().max(120).default(''),
  emailCopy,
});

export const profileFields = z.object({
  author: z
    .object({
      name: opt(120),
      jobTitle: opt(160),
      credentials: opt(600),
      bio: opt(1200),
      url: optUrl,
      sameAs: z.array(urlField).max(8).default([]),
      imageUrl: optUrl,
      knowsAbout: stringList(12, 80),
    })
    .default({ name: '', jobTitle: '', credentials: '', bio: '', url: '', sameAs: [], imageUrl: '', knowsAbout: [] }),
  reviewer: z.object({ name: opt(120), jobTitle: opt(160), url: optUrl }).default({ name: '', jobTitle: '', url: '' }),
  businessName: opt(160),
  businessType: opt(80),
  address: z
    .object({
      street: opt(200),
      city: opt(100),
      region: opt(100),
      postalCode: opt(30),
      country: z.union([z.literal(''), country]).default(''),
    })
    .default({ street: '', city: '', region: '', postalCode: '', country: '' }),
  phone: opt(40),
  publicEmail: z.union([z.literal(''), emailField]).default(''),
  openingHours: opt(200),
  serviceAreas: stringList(20, 80),
  mapUrl: optUrl,
  logoUrl: optUrl,
  // G31: the house style every page follows, stored on the same profile row, applied in the writing prompts and checked before delivery
  style: z
    .object({
      brandForm: opt(160),
      // H2 (2026-10-27): the registered legal name, used only in legal statements (never in titles or headings)
      legalName: opt(160),
      brandWrong: stringList(12, 80),
      spelling: z.enum(['', 'British English', 'American English']).default(''),
      avoid: stringList(40, 60),
      tone: opt(300),
      notes: opt(600),
    })
    .default({ brandForm: '', legalName: '', brandWrong: [], spelling: '', avoid: [], tone: '', notes: '' }),
});
export type ProfileFields = z.output<typeof profileFields>;

export const profileInput = profileFields
  .extend({ mode: z.literal('profile'), siteId, emailCopy: z.boolean().default(false) })
  .refine(
    (v) =>
      !!(
        v.author.name ||
        v.businessName ||
        v.address.street ||
        v.phone ||
        v.reviewer.name ||
        v.style.brandForm ||
        v.style.spelling ||
        v.style.avoid.length ||
        v.style.tone
      ),
    {
      path: ['author', 'name'],
      message: 'Fill in at least the author name, the business details or your style guide',
    },
  );

export const aiVisibilityInput = z.object({
  mode: z.literal('ai_visibility'),
  siteId,
  country,
  topics: stringList(6, 80),
  competitors: domainList(3),
  emailCopy,
});

export const backlinksInput = z.object({
  mode: z.literal('backlinks'),
  siteId,
  country,
  competitors: domainList(3),
  /** v4.10: free sources and our own link check only, no DataForSEO, no AI drafts, $0 */
  freeOnly: z.boolean().default(false),
  emailCopy,
});

export const RUN_SCHEMAS = {
  verdict: verdictInput,
  keyword: keywordInput,
  discover: discoverInput,
  describe: describeInput,
  audit: auditInput,
  ladder: ladderInput,
  track: trackInput,
  published: publishedInput,
  checkin: checkinInput,
  case_study: caseStudyInput,
  profile: profileInput,
  ai_visibility: aiVisibilityInput,
  backlinks: backlinksInput,
} as const;

export const runInputSchema = z.union([
  verdictInput,
  keywordInput,
  discoverInput,
  describeInput,
  auditInput,
  ladderInput,
  trackInput,
  publishedInput,
  checkinInput,
  caseStudyInput,
  profileInput,
  aiVisibilityInput,
  backlinksInput,
]);
export type RunInput = z.output<typeof runInputSchema>;
export type RunInputOf<M extends keyof typeof RUN_SCHEMAS> = z.output<(typeof RUN_SCHEMAS)[M]>;
export type RunFormValues<M extends keyof typeof RUN_SCHEMAS> = z.input<(typeof RUN_SCHEMAS)[M]>;

/** Validates a run request by its mode (a plain union would report the errors of every branch). */
export function parseRunInput(body: unknown): { success: true; data: RunInput } | { success: false; error: z.ZodError } {
  const mode = (body && typeof body === 'object' ? (body as { mode?: unknown }).mode : undefined) as string | undefined;
  const schema = mode && mode in RUN_SCHEMAS ? RUN_SCHEMAS[mode as keyof typeof RUN_SCHEMAS] : null;
  if (!schema) {
    return { success: false, error: new z.ZodError([{ code: 'custom', path: ['mode'], message: 'Unknown mode', input: mode }]) };
  }
  const r = schema.safeParse(body);
  return r.success ? { success: true, data: r.data as RunInput } : { success: false, error: r.error };
}

// ---------- site admin (Site Admin workflow) ----------
/** B7-5: the engine refuses nested repetition (it can hang a run) and an invalid expression (v5/code/Admin_Action.js), so does the form */
export const CONTENT_GROUPS_MAX = 12;
export const contentGroupSchema = z.object({
  name: z.string().trim().min(1, 'Name the group').max(60),
  pattern: z
    .string()
    .trim()
    .min(1, 'Enter a pattern, e.g. ^/blog/')
    .max(200)
    .refine((v) => !/(\+|\*|\})\)?[+*{]/.test(v), 'Nested repetition (like (a+)+) is refused: it can hang the weekly run')
    .refine((v) => {
      try {
        new RegExp(v, 'i');
        return true;
      } catch {
        return false;
      }
    }, 'Not a valid pattern'),
});
export type ContentGroup = z.output<typeof contentGroupSchema>;

// G6 (2026-10-18): one question of the AI panel as the owner types or imports it
const aiQuestionText = z.string().trim().min(10, 'Questions need at least 10 characters').max(300);
export const aiQuestionSchema = z.object({
  prompt: aiQuestionText,
  persona: z.string().trim().max(40).default(''),
  cluster: z.string().trim().max(60).default(''),
  // W2-E1: 'shopping' for sites that sell products
  stage: z.enum(['', 'awareness', 'consideration', 'decision', 'shopping']).default(''),
  market: z.string().trim().regex(/^([A-Za-z]{2}([-_ ][A-Za-z]{2,3})?)?$/, 'Use a country code and a language, e.g. SA-en').default(''),
  pinned: z.boolean().default(false),
  /** W2 §6: the search phrase the question stands for (the CSV's optional keyword column); the engine keeps it as the owner's */
  keyword: z.string().trim().max(120).optional(),
});
export type AiQuestionInput = z.output<typeof aiQuestionSchema>;
export const aiQuestionEditSchema = z.object({
  promptId: z.string().trim().min(1).max(80),
  prompt: aiQuestionText.optional(),
  persona: z.string().trim().max(40).optional(),
  cluster: z.string().trim().max(60).optional(),
  stage: z.enum(['awareness', 'consideration', 'decision', 'shopping']).optional(),
  market: z.string().trim().regex(/^[A-Za-z]{2}([-_ ][A-Za-z]{2,3})?$/, 'Use a country code and a language, e.g. SA-en').optional(),
  pinned: z.boolean().optional(),
  keyword: z.string().trim().min(2).max(120).optional(),
});

export const adminActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('cadence'), pagesPerWeek: z.number().int().min(0).max(3) }),
  z.object({ action: z.literal('unpublish'), keyword: keywordField }),
  z.object({
    action: z.literal('monitors'),
    // D1: patchOf: a setting left out stays as it is (with .partial() zod 4 sent every default, and no competitors cleared the engine's)
    monitors: patchOf(monitorSettingsSchema),
    competitors: z.array(domainField).max(3, 'Up to 3 domains').optional(),
  }),
  z.object({
    action: z.literal('prospect'),
    prospectDomain: domainField,
    type: z.string().trim().max(40).default(''),
    status: z.enum(PROSPECT_STATUSES).optional(),
    note: z.string().trim().max(500).optional(),
    /** v4.10: who to write to (found by the engine on the prospect's site, or typed by the person) */
    contactEmail: z.string().trim().toLowerCase().email('Enter an e-mail address').max(200).optional().or(z.literal('')),
  }),
  z.object({
    action: z.literal('content_groups'),
    /** B7-5: the website's page groups (blog, services, product), each a regular expression over the page path; [] clears them */
    contentGroups: z.array(contentGroupSchema).max(CONTENT_GROUPS_MAX, `At most ${CONTENT_GROUPS_MAX} groups`),
  }),
  z.object({
    action: z.literal('ai_prompts'),
    // G6 (2026-10-18): the panel manager, add up to 500 (text, or a question with its buyer role / cluster / stage / market / pin: the CSV
    // import), edit in place (new wording becomes a new question; the engine switches the old one off), off / on, pin / unpin
    add: z.array(z.union([aiQuestionText, aiQuestionSchema])).max(AI_PROMPTS_MAX, `At most ${AI_PROMPTS_MAX} questions at once`).default([]),
    remove: z.array(z.string().trim().min(1).max(300)).max(AI_PROMPTS_MAX).default([]),
    enable: z.array(z.string().trim().min(1).max(300)).max(AI_PROMPTS_MAX).default([]),
    pin: z.array(z.string().trim().min(1).max(300)).max(AI_PROMPTS_MAX).default([]),
    unpin: z.array(z.string().trim().min(1).max(300)).max(AI_PROMPTS_MAX).default([]),
    edit: z.array(aiQuestionEditSchema).max(AI_PROMPTS_MAX).default([]),
    /** AI-FOCUS (2026-10-27): start asking questions the engine proposed, and retire questions (kept with their history, never asked) */
    accept: z.array(z.string().trim().min(1).max(300)).max(AI_PROMPTS_MAX).default([]),
    retire: z.array(z.string().trim().min(1).max(300)).max(AI_PROMPTS_MAX).default([]),
  }),
]);
export type AdminAction = z.output<typeof adminActionSchema>;

// ---------- keyword ladders and the pipeline's automation (PIPELINE_FEATURE_SPEC.md §6-7; rows of seo_ladder_settings) ----------
/** ladder ids are made by n8n ("lad_mupia2l2c0tp") */
export const LADDER_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const ladderMode = z.enum(['auto', 'manual'], { message: 'Choose Auto or Manual' });

/** One ladder: Auto / Manual, Pause / Resume. Won, Stuck and Queued are set by the system, never here (a 'stuck' row would stop the
 * writing in n8n). */
export const ladderSettingsSchema = z
  .object({
    mode: ladderMode.optional(),
    status: z.enum(['active', 'paused'], { message: 'Choose Pause or Resume' }).optional(),
  })
  .refine((v) => v.mode !== undefined || v.status !== undefined, { message: 'Nothing to change', path: ['mode'] });
export type LadderSettingsInput = z.output<typeof ladderSettingsSchema>;

/** The website's ladders in their new priority order (every ladder once). */
export const ladderOrderSchema = z.object({
  ladderIds: z
    .array(z.string().trim().regex(LADDER_ID_RE, 'Unknown keyword ladder'))
    .min(1, 'List the keyword ladders in their new order')
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'List each keyword ladder once'),
});

export const MAX_ACTIVE_LADDERS = { min: 1, max: 5 } as const;
export const MAX_WAITING_PAGES = { min: 1, max: 10 } as const;

/** The website's automation defaults (the '_site' row), every field (the settings form). autoStartLadders = "Choose keywords for
 * me" (the '_site' row's auto_start; off by default). */
export const siteAutomationFormSchema = z.object({
  /** keyword-first (§5.5): how much the autopilot does on its own (1 only my keywords, 2 + keep my pages healthy, 3 full autopilot) */
  autopilotLevel: z.union([z.literal(1), z.literal(2), z.literal(3)], { message: 'Choose level 1, 2 or 3' }).optional(),
  defaultMode: ladderMode,
  opportunities: ladderMode,
  autoStartLadders: z.boolean({ message: 'Choose on or off' }),
  maxActiveLadders: z
    .number({ message: 'Choose a number' })
    .int()
    .min(MAX_ACTIVE_LADDERS.min, `At least ${MAX_ACTIVE_LADDERS.min}`)
    .max(MAX_ACTIVE_LADDERS.max, `At most ${MAX_ACTIVE_LADDERS.max}`),
  maxWaiting: z
    .number({ message: 'Choose a number' })
    .int()
    .min(MAX_WAITING_PAGES.min, `At least ${MAX_WAITING_PAGES.min}`)
    .max(MAX_WAITING_PAGES.max, `At most ${MAX_WAITING_PAGES.max}`),
});
export type SiteAutomationForm = z.output<typeof siteAutomationFormSchema>;

/** PATCH .../automation: any of the fields. */
export const siteAutomationSchema = siteAutomationFormSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to change', path: ['defaultMode'] });
export type SiteAutomationInput = z.output<typeof siteAutomationSchema>;

// ---------- keyword-first autopilot and the website's cycle (SCHEDULING_KEYWORDS_PLAN.md §14.6) ----------
/** PATCH .../cycle: the weekday of the website's weekly cycle (0 Sunday - 6 Saturday, in the website's time zone) */
export const cycleWeekdaySchema = z.object({ weekday: z.number({ message: 'Choose a weekday' }).int('Choose a weekday').min(0, 'Choose a weekday').max(6, 'Choose a weekday') });
/** POST .../coming-up/decisions */
export const comingUpDecisionSchema = z.object({
  itemKey: z.string().trim().min(1, 'Choose an item').max(200),
  decision: z.enum(['skip', 'approve'], { message: 'Choose Skip or Approve' }),
  scope: z.enum(['cycle', 'always'], { message: 'Choose this week or always' }).default('cycle'),
});
/** POST .../keyword-proposals/:id/swap */
export const proposalSwapSchema = z.object({ keyword: keywordField });
/** POST /api/orgs/:orgId/reports/:reportId/feedback ("Not what I wanted") */
export const contentFeedbackSchema = z.object({ verdict: z.literal('reject', { message: 'Unknown verdict' }), reason: opt(1000) });

// ---------- keyword check (PIPELINE_FEATURE_SPEC.md §5.2) ----------
/** POST .../sites/:siteId/keywords/assess: one keyword (the SEO engine takes 2-100 characters); the country defaults to the website's. */
export const keywordAssessSchema = z.object({
  keyword: z
    .string({ message: 'Enter a keyword' })
    .trim()
    .min(2, 'Enter a keyword')
    .max(100, 'Keep the keyword under 100 characters')
    .transform((k) => k.toLowerCase().replace(/\s+/g, ' ')),
  country: country.optional(),
});
export type KeywordAssessInput = z.output<typeof keywordAssessSchema>;

/** Flattens a ZodError into { "path.to.field": "message" } for forms and API errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ---------- link uploads (v4.10: Search Console Links exports, other tools' backlink CSVs; link-import.ts) ----------
export const linkImportSchema = z.object({
  /** the CSV text (Search Console: Links -> Export external links -> Latest links / More sample links, or Top linking sites -> Download CSV) */
  csv: z.string().min(10, 'The file is empty').max(15_000_000, 'The file is larger than 15 MB: export the "Latest links" table only'),
  fileName: z.string().trim().max(200).optional(),
});
export type LinkImportInput = z.output<typeof linkImportSchema>;

// ---------- W2-A (2026-10-23): AI report uploads (ai-import.ts) and deleting AI panel questions ----------
export const aiImportSchema = z.object({
  /** the CSV text: Bing Webmaster Tools AI Performance export, or Search Console Performance export (Queries / Pages / Dates) */
  csv: z.string().min(10, 'The file is empty').max(15_000_000, 'The file is larger than 15 MB: export a shorter period'),
  fileName: z.string().trim().max(200).optional(),
  /** '' = recognise it (a Citations column means Bing) */
  source: z.enum(['', 'bing_ai', 'gsc_ai']).default(''),
  /** the last day of the period exported, for a file without a date column (Search Console's Queries / Pages files) */
  periodEnd: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use a date like 2026-10-22').default(''),
  /** R-A5: how numeric dates are written, for a file whose dates alone cannot tell ('' = recognise it from the whole column) */
  dateOrder: z.enum(['', 'dmy', 'mdy']).default(''),
});
export const aiPromptDeleteSchema = z.object({ ids: z.array(z.string().trim().min(1).max(120)).min(1, 'Choose at least one question').max(500) });

// ---------- W2-FIX (2026-10-23): the AI repeat pilot (n8n SEOagentAIPilAPI -> SEOagentAIPilot1) ----------
/** `confirm` false (the default) asks the engine for the price only; true starts the pilot, and only after the price was shown (the server
 *  checks that a fresh quote exists and that the company's credits cover it). Only the literal true confirms. */
export const aiPilotStartSchema = z.object({ confirm: z.boolean().default(false) });
export type AiPilotStartInput = z.output<typeof aiPilotStartSchema>;
/** What the engine's quote callback (stage ai_pilot_quote) says, as the app shows it. */
export interface AiPilotQuote {
  requestId: string | null;
  receivedAt: string;
  /** the pilot would run if confirmed (false: the panel is too small, no engine fits, or the price is over the limit) */
  canConfirm: boolean;
  reason: string;
  questions: number;
  repeats: number;
  engines: string[];
  requests: number;
  priceUsd: number;
  maxUsd: number;
  note: string;
}
/** The pilot's result (stage ai_pilot): per engine, how many asks a week each question needs for +/-5 points. */
export interface AiPilotResult {
  requestId: string | null;
  receivedAt: string;
  reportId: string;
  note: string;
  byEngine: { engine: string; rate: number | null; repeats: number | null; answers: number; why: string }[];
}
export interface AiPilotState {
  quote: AiPilotQuote | null;
  result: AiPilotResult | null;
  /** a quote is confirmable for this long after it arrived (the panel or the engines may change after it) */
  quoteValidHours: number;
}

// ---- v4.13 Link Builder ----
const hostName = z.string().trim().min(3).max(200).regex(/^[a-z0-9.-]+$/i, 'A host name like smtp.gmail.com');
const port = z.number().int().min(1).max(65535);
export const mailboxSchema = z.object({
  label: z.string().trim().max(60).default(''),
  fromName: z.string().trim().min(1, 'Your name as recipients will see it').max(80),
  fromEmail: z.string().trim().toLowerCase().email('A valid e-mail address').max(200),
  smtpHost: hostName, smtpPort: port.default(465), smtpSecure: z.boolean().default(true),
  imapHost: hostName, imapPort: port.default(993), imapSecure: z.boolean().default(true),
  username: z.string().trim().min(1).max(200),
  password: z.string().min(4, 'The app password').max(400),
  signatureName: z.string().trim().max(80).default(''), signatureTitle: z.string().trim().max(80).default(''), company: z.string().trim().max(120).default(''),
  postalAddress: z.string().trim().min(8, 'Every e-mail must carry your business postal address').max(240),
  timezone: z.string().trim().max(60).default('UTC'),
  windowStart: z.number().int().min(0).max(23).default(8), windowEnd: z.number().int().min(1).max(24).default(17),
  dailyFirstMax: z.number().int().min(1).max(30).default(20), dailyMax: z.number().int().min(1).max(50).default(50),
});
export type MailboxInput = z.output<typeof mailboxSchema>;
// D1: patchOf: the settings form sends only what changed; a field left out keeps its stored value (no port / window / limit default)
export const mailboxPatchSchema = patchOf(mailboxSchema).extend({ password: z.string().min(4).max(400).optional() });
/** L4: start the OAuth flow for one provider (the settings a password mailbox asks for are filled in afterwards) */
export const mailboxOauthStartSchema = z.object({ provider: z.enum(['gmail_oauth', 'ms_graph']), label: z.string().trim().max(60).default('') });
export const linkSettingsSchema = z.object({ mode: z.enum(['approve', 'auto']).optional(), mailboxId: z.string().uuid().nullable().optional(), autoDailyMax: z.number().int().min(1).max(30).optional() });
const stepSchema = z.object({ step: z.number().int().min(0).max(2), waitDays: z.number().int().min(0).max(30), subject: z.string().max(140).default(''), body: z.string().min(1).max(6000),
  subjectAlt: z.string().max(140).optional(), variant: z.enum(['A', 'B']).optional() });   // L7: the other subject style, and which one this pitch carries
export const approveSchema = z.object({ prospectDomain: z.string().trim().min(3).max(200), type: z.string().trim().min(2).max(30), toEmail: z.string().trim().toLowerCase().email().max(200),
  steps: z.array(stepSchema).min(1).max(3), consent: z.boolean().default(false), mailboxId: z.string().uuid().nullable().optional() });
export const sequencePatchSchema = z.object({ steps: z.array(stepSchema).min(1).max(3).optional(), toEmail: z.string().trim().toLowerCase().email().max(200).optional() });
export const sequenceReplySchema = z.object({ body: z.string().trim().min(2).max(6000) });
export const sequenceOutcomeSchema = z.object({ status: z.enum(['won', 'rejected']) });
export const draftDismissSchema = z.object({ prospectDomain: z.string().trim().min(3).max(200), type: z.string().trim().min(2).max(30) });
export const listingStatusSchema = z.object({ status: z.enum(['submitted', 'listed', 'ignored', 'missing']), note: z.string().trim().max(300).optional() });
export const suppressionSchema = z.object({ value: z.string().trim().toLowerCase().min(3).max(200), kind: z.enum(['email', 'domain']).default('email') });
export const linkBuilderRunSchema = z.object({ freeOnly: z.boolean().default(false) });
