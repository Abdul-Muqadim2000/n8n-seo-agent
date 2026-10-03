import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => ts('created_at').defaultNow().notNull();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    emailVerifiedAt: ts('email_verified_at'),
    googleSub: text('google_sub'),
    avatarUrl: text('avatar_url'),
    createdAt: created(),
    lastLoginAt: ts('last_login_at'),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email), uniqueIndex('users_google_sub_idx').on(t.googleSub)],
);

/** Login sessions: `id` is the SHA-256 of the cookie token, so a database leak does not leak sessions. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: created(),
    lastSeenAt: ts('last_seen_at').defaultNow().notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** One-time tokens for e-mail verification and password reset (hashed). */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: created(),
  },
  (t) => [uniqueIndex('auth_tokens_hash_idx').on(t.tokenHash)],
);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    industry: text('industry').notNull().default(''),
    size: text('size').notNull().default(''),
    website: text('website').notNull().default(''),
    /** capability token in the n8n callback URL (/api/hooks/n8n/<token>) */
    hookToken: text('hook_token').notNull(),
    monthlyBudgetUsd: doublePrecision('monthly_budget_usd').notNull(),
    disabled: boolean('disabled').notNull().default(false),
    onboardingStep: text('onboarding_step').notNull().default('company'),
    onboardedAt: ts('onboarded_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [uniqueIndex('organizations_slug_idx').on(t.slug), uniqueIndex('organizations_hook_idx').on(t.hookToken)],
);

export const memberships = pgTable(
  'memberships',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index('memberships_user_idx').on(t.userId)],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    expiresAt: ts('expires_at').notNull(),
    acceptedAt: ts('accepted_at'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [uniqueIndex('invitations_hash_idx').on(t.tokenHash), index('invitations_org_idx').on(t.orgId)],
);

export const sites = pgTable(
  'sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    country: text('country').notNull(),
    business: text('business').notNull().default(''),
    customers: text('customers').notNull().default(''),
    goal: text('goal').notNull().default('leads'),
    tone: text('tone').notNull().default('Professional and direct'),
    cta: text('cta').notNull().default(''),
    businessFacts: text('business_facts').notNull().default(''),
    competitors: jsonb('competitors').$type<string[]>().notNull().default([]),
    brandNames: jsonb('brand_names').$type<string[]>().notNull().default([]),
    keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
    ga4PropertyId: text('ga4_property_id').notNull().default(''),
    gscProperty: text('gsc_property').notNull().default(''),
    blogsPerWeek: integer('blogs_per_week').notNull().default(0),
    verificationToken: text('verification_token').notNull(),
    verifiedAt: ts('verified_at'),
    verificationMethod: text('verification_method'),
    trackingStatus: text('tracking_status').notNull().default('not_started'),
    trackingStartedAt: ts('tracking_started_at'),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('sites_org_domain_idx').on(t.orgId, t.domain),
    // a domain's data (n8n Data Tables are keyed by domain) belongs to the one company that verified it
    uniqueIndex('sites_verified_domain_idx').on(t.domain).where(sql`${t.verifiedAt} is not null`),
  ],
);

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    mode: text('mode').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull(),
    requestId: text('request_id'),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    error: text('error'),
    estimatedCostUsd: doublePrecision('estimated_cost_usd').notNull().default(0),
    actualCostUsd: doublePrecision('actual_cost_usd'),
    etaMinutes: integer('eta_minutes').notNull().default(0),
    lastStage: text('last_stage'),
    reportCount: integer('report_count').notNull().default(0),
    createdAt: created(),
    acceptedAt: ts('accepted_at'),
    completedAt: ts('completed_at'),
  },
  (t) => [index('runs_org_created_idx').on(t.orgId, t.createdAt), index('runs_org_request_idx').on(t.orgId, t.requestId), index('runs_site_idx').on(t.siteId)],
);

/** Every callback n8n posts (one run can have several: plan, then pages; scheduled reports have no run). */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    stage: text('stage').notNull(),
    status: text('status').notNull(),
    title: text('title').notNull(),
    requestId: text('request_id'),
    scheduled: boolean('scheduled').notNull().default(false),
    summary: jsonb('summary').$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    receivedAt: ts('received_at').defaultNow().notNull(),
  },
  (t) => [index('reports_org_received_idx').on(t.orgId, t.receivedAt), index('reports_run_idx').on(t.runId), index('reports_site_stage_idx').on(t.siteId, t.stage)],
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    reportId: uuid('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    kind: text('kind').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    data: bytea('data').notNull(),
    createdAt: created(),
  },
  (t) => [index('files_report_idx').on(t.reportId)],
);

/**
 * Keyword checks of the "New keyword ladder" flow (n8n's Keyword Check, POST /webhook/seo-keyword-assess; PIPELINE_FEATURE_SPEC.md
 * §5.2). A row is reserved as 'pending' (with the estimated cost) under the company's budget lock before n8n is called, then 'done'
 * with the engine's answer and its reported cost, or 'failed' (cost 0: counted in the daily limit only). The same website, keyword
 * and country checked within 7 days is answered from the stored row, free. Counted in the company's monthly spend.
 */
export const keywordChecks = pgTable(
  'keyword_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // kept when the website is deleted: its cost still counts in the month
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    keyword: text('keyword').notNull(),
    country: text('country').notNull(),
    status: text('status').notNull().default('done'),
    /** the engine's answer (snake_case, as n8n sent it) */
    result: jsonb('result').$type<Record<string, unknown>>().notNull().default({}),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    createdAt: created(),
  },
  (t) => [index('keyword_checks_org_created_idx').on(t.orgId, t.createdAt), index('keyword_checks_site_keyword_idx').on(t.siteId, t.keyword, t.country)],
);

export type UserRow = typeof users.$inferSelect;
export type OrgRow = typeof organizations.$inferSelect;
export type SiteRow = typeof sites.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type KeywordCheckRow = typeof keywordChecks.$inferSelect;
