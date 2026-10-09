import { z } from 'zod';
import {
  AI_ENGINE_VALUES,
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
export const updateOrgSchema = createOrgSchema.partial();
export const inviteSchema = z.object({ email: emailField, role: z.enum(['admin', 'member', 'viewer']).default('member') });
export const updateMemberSchema = z.object({ role: z.enum(['admin', 'member', 'viewer']) });
export const orgBudgetSchema = z.object({ monthlyBudgetUsd: z.number().min(0).max(100000), disabled: z.boolean().optional() });

// ---------- sites ----------
export const monitorSettingsSchema = z.object({
  aiVisibility: z.boolean().default(true),
  aiEngines: z.array(z.enum(AI_ENGINE_VALUES)).min(1, 'Choose at least one AI engine').default([...AI_ENGINE_VALUES]),
  aiPromptsMax: z.number().int().min(3).max(AI_PROMPTS_MAX).default(AI_PROMPTS_DEFAULT),
  /** v4.9: the daily AI Pulse (ChatGPT, Gemini and Google AI Mode on the whole panel, Tuesday to Sunday) */
  aiPulse: z.boolean().default(true),
  backlinks: z.boolean().default(true),
  auditMonthly: z.boolean().default(true),
  auditPages: z.number().int().min(50).max(1000).default(200),
  auditJs: z.boolean().default(false),
  brandNames: stringList(10, 80),
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
});
export const createSiteSchema = siteBusinessSchema.extend({ domain: domainField });
export const updateSiteSchema = siteBusinessSchema.partial().extend({
  ga4PropertyId: z.string().trim().regex(/^\d{0,16}$/, 'Digits only').optional(),
  keywords: stringList(20, 100).optional(),
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
    receiveContent: z.boolean().default(false),
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
  emailCopy,
});

export const publishedInput = z.object({
  mode: z.literal('published'),
  siteId,
  keyword: keywordField,
  publishedUrl: urlField,
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
});
export type ProfileFields = z.output<typeof profileFields>;

export const profileInput = profileFields
  .extend({ mode: z.literal('profile'), siteId, emailCopy: z.boolean().default(false) })
  .refine((v) => !!(v.author.name || v.businessName || v.address.street || v.phone || v.reviewer.name), {
    path: ['author', 'name'],
    message: 'Fill in at least the author name or the business details',
  });

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
  /** v4.10: free sources and our own link check only — no DataForSEO, no AI drafts, $0 */
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
export const adminActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('cadence'), pagesPerWeek: z.number().int().min(0).max(3) }),
  z.object({ action: z.literal('unpublish'), keyword: keywordField }),
  z.object({
    action: z.literal('monitors'),
    monitors: monitorSettingsSchema.partial(),
    competitors: domainList(3).optional(),
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
    action: z.literal('ai_prompts'),
    add: z.array(z.string().trim().min(10, 'Questions need at least 10 characters').max(300)).max(15).default([]),
    remove: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
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

/** PATCH …/automation: any of the fields. */
export const siteAutomationSchema = siteAutomationFormSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to change', path: ['defaultMode'] });
export type SiteAutomationInput = z.output<typeof siteAutomationSchema>;

// ---------- keyword check (PIPELINE_FEATURE_SPEC.md §5.2) ----------
/** POST …/sites/:siteId/keywords/assess: one keyword (the SEO engine takes 2-100 characters); the country defaults to the website's. */
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
  /** the CSV text (Search Console: Links → Export external links → Latest links / More sample links, or Top linking sites → Download CSV) */
  csv: z.string().min(10, 'The file is empty').max(15_000_000, 'The file is larger than 15 MB: export the "Latest links" table only'),
  fileName: z.string().trim().max(200).optional(),
});
export type LinkImportInput = z.output<typeof linkImportSchema>;
