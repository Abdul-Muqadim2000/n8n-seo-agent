import { sql } from 'drizzle-orm';
import {
  bigint,
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
    /** G1: the authenticator-app secret, sealed (lib/secretBox `sealIdentity`); `mfaTotpPending` holds a secret during enrolment */
    mfaTotpSecret: text('mfa_totp_secret'),
    mfaTotpPending: text('mfa_totp_pending'),
    mfaTotpEnabledAt: ts('mfa_totp_enabled_at'),
    /** the last accepted RFC 6238 time step: a code is accepted once, never again (replay) */
    mfaTotpLastStep: integer('mfa_totp_last_step'),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email), uniqueIndex('users_google_sub_idx').on(t.googleSub)],
);

/** G1: one-time recovery codes (SHA-256 of 80-bit codes; each usable once). */
export const mfaRecoveryCodes = pgTable(
  'mfa_recovery_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: ts('used_at'),
    createdAt: created(),
  },
  (t) => [index('mfa_recovery_user_idx').on(t.userId), uniqueIndex('mfa_recovery_hash_idx').on(t.userId, t.codeHash)],
);

/** G1: passkeys / security keys as a second factor (WebAuthn). */
export const webauthnCredentials = pgTable(
  'webauthn_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** base64url credential id from the authenticator */
    credentialId: text('credential_id').notNull(),
    publicKey: bytea('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: jsonb('transports').$type<string[]>().notNull().default([]),
    deviceType: text('device_type').notNull().default('singleDevice'),
    backedUp: boolean('backed_up').notNull().default(false),
    name: text('name').notNull(),
    createdAt: created(),
    lastUsedAt: ts('last_used_at'),
  },
  (t) => [uniqueIndex('webauthn_credential_idx').on(t.credentialId), index('webauthn_user_idx').on(t.userId)],
);

/**
 * G1: short-lived server-side state of a multi-step sign-in — the password-checked sign-in still waiting for its second factor, a
 * passkey challenge, an OIDC state / nonce / PKCE verifier, a SAML request id, a consumed SAML assertion id. `id` is the SHA-256 of
 * a random token the browser holds (cookie or RelayState), or of a protocol id; rows expire within minutes.
 */
export const authFlows = pgTable(
  'auth_flows',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: ts('expires_at').notNull(),
    createdAt: created(),
  },
  (t) => [index('auth_flows_expires_idx').on(t.expiresAt)],
);

/**
 * G1: the customer-visible audit log. Append-only in the database itself: a trigger (migration g1_audit) refuses UPDATE, TRUNCATE
 * and any DELETE except the retention purge (`ascentra.audit_purge`) and the company's own deletion. Written only through
 * services/audit.ts. `actor_user_id` has no foreign key on purpose: removing a person must not rewrite the history of what they did.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    at: ts('at').defaultNow().notNull(),
    action: text('action').notNull(),
    outcome: text('outcome').notNull().default('success'),
    /** user / scim / system / platform_admin */
    actorType: text('actor_type').notNull(),
    actorUserId: uuid('actor_user_id'),
    /** the actor as they were at the time (e-mail, token name) */
    actorLabel: text('actor_label').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    targetLabel: text('target_label'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('audit_events_org_idx').on(t.orgId, t.id), index('audit_events_org_at_idx').on(t.orgId, t.at), index('audit_events_org_action_idx').on(t.orgId, t.action)],
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
    /** G1: how this session was signed in (password / google / sso) and, for SSO, through which company's identity provider */
    authMethod: text('auth_method').notNull().default('password'),
    ssoOrgId: uuid('sso_org_id'),
    /** G1: when a second factor was verified in this session (null = none) */
    mfaAt: ts('mfa_at'),
    /** G1: the last proof of presence (sign-in or step-up); security changes need one within MFA.stepUpMinutes */
    reauthAt: ts('reauth_at'),
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
    /** B-R1: where this company's finished reports are pushed (shared/src/report-delivery.ts `DeliverySettings`); the webhook's
     *  signing secret is sealed into `deliveryWebhookSecret`, never into here, so the settings can go back to the browser as they are */
    deliverySettings: jsonb('delivery_settings').$type<Record<string, unknown>>().notNull().default({}),
    deliveryWebhookSecret: text('delivery_webhook_secret').notNull().default(''),
    /** when the last scheduled summary went out, so a restart cannot send the same week twice */
    deliveryLastRunAt: ts('delivery_last_run_at'),
    disabled: boolean('disabled').notNull().default(false),
    /** G1: two-step requirement, idle timeout, audit retention (shared/src/identity.ts `SecurityPolicy`, read with `policyOf`) */
    securityPolicy: jsonb('security_policy').$type<Record<string, unknown>>().notNull().default({}),
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
    /** v4.13 Link Builder: approve each sequence or send automatically (owner), which mailbox, how many a day */
    linkSettings: jsonb('link_settings').$type<{ mode?: 'approve' | 'auto'; mailboxId?: string | null; autoDailyMax?: number }>().notNull().default({}),
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
    /** what the app reserved before the run, from the one table in shared/src/cost.ts */
    estimatedCostUsd: doublePrecision('estimated_cost_usd').notNull().default(0),
    actualCostUsd: doublePrecision('actual_cost_usd'),
    /** B-R3: the engine's own calibrated figure for this run (`run_cost_estimate_usd` on a callback) and the sentence behind it.
     *  The app shows the engine's number whenever it has one - it is calibrated on measured runs and ours is only a mirror. */
    engineCostEstimateUsd: doublePrecision('engine_cost_estimate_usd'),
    engineCostBasis: text('engine_cost_basis'),
    /** true when part of `actualCostUsd` is the engine's own estimate (streaming model calls report no token usage) */
    actualCostEstimated: boolean('actual_cost_estimated').notNull().default(false),
    /** R102 / R115: true when the settled figure has no model-call part (the callback did not report its model calls): search data only */
    actualCostPartial: boolean('actual_cost_partial').notNull().default(false),
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
 * G15 (system review 2026-10-11): an expiring, revocable, read-only link to ONE report, for somebody with no account.
 * `id` of the link is a uuid; the secret in the URL is never stored — only its SHA-256 (`tokenHash`), so a database copy hands out no
 * working links. The link reaches that one report and its files, nothing else. We keep who created it, when it expires, when it was
 * revoked and when it was last opened (with a counter), so an owner can see whether anybody used it.
 */
export const reportShares = pgTable(
  'report_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    reportId: uuid('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    lastOpenedAt: ts('last_opened_at'),
    opens: integer('opens').notNull().default(0),
  },
  (t) => [uniqueIndex('report_shares_hash_idx').on(t.tokenHash), index('report_shares_report_idx').on(t.reportId), index('report_shares_org_idx').on(t.orgId)],
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

// ---- v4.13 Link Builder (n8n/seo-agent/LINK_BUILDER_SPEC.md): the company's mailboxes, the sequences it sends, every message, opt-outs ----
/** A mailbox the company sends link-building e-mails from (its own address). Either SMTP + IMAP with an app password, or (L4) OAuth with
 *  Microsoft 365 / Gmail, where no password exists and the provider's API sends. Every secret here is encrypted (lib/secretBox.ts). */
export const mailboxes = pgTable(
  'mailboxes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default(''),
    fromName: text('from_name').notNull(),
    fromEmail: text('from_email').notNull(),
    /** smtp (app password) | gmail_oauth (sends only) | ms_graph (sends and reads) */
    provider: text('provider').notNull().default('smtp'),
    smtpHost: text('smtp_host').notNull(),
    smtpPort: integer('smtp_port').notNull().default(465),
    smtpSecure: boolean('smtp_secure').notNull().default(true),
    imapHost: text('imap_host').notNull(),
    imapPort: integer('imap_port').notNull().default(993),
    imapSecure: boolean('imap_secure').notNull().default(true),
    username: text('username').notNull(),
    /** AES-256-GCM (lib/secretBox.ts, key MAILBOX_KEY); never sent to the browser. Empty for an OAuth mailbox: there is no password. */
    secret: text('secret').notNull(),
    // ---- L4: an OAuth mailbox. The refresh token is the long-lived secret and is encrypted exactly like a password; the access token
    // is refreshed before it expires, and both are revoked when the customer disconnects the mailbox.
    oauthRefresh: text('oauth_refresh').notNull().default(''),
    oauthAccess: text('oauth_access').notNull().default(''),
    oauthExpiresAt: ts('oauth_expires_at'),
    /** the scopes the customer actually granted, as the provider reported them */
    oauthScope: text('oauth_scope').notNull().default(''),
    /** the provider's own account id (sub / oid): a re-connect of the same account updates the row instead of adding one */
    oauthSubject: text('oauth_subject').notNull().default(''),
    /** where the inbox reading got to (Microsoft Graph: the newest receivedDateTime read; IMAP uses lastUid instead) */
    oauthCursor: text('oauth_cursor').notNull().default(''),
    /** false for Gmail OAuth: reading an inbox needs Google's restricted scope, so replies are read in Gmail itself */
    readsReplies: boolean('reads_replies').notNull().default(true),
    /** active | paused | error */
    status: text('status').notNull().default('active'),
    statusReason: text('status_reason').notNull().default(''),
    signatureName: text('signature_name').notNull().default(''),
    signatureTitle: text('signature_title').notNull().default(''),
    company: text('company').notNull().default(''),
    postalAddress: text('postal_address').notNull().default(''),
    timezone: text('timezone').notNull().default('UTC'),
    windowStart: integer('window_start').notNull().default(8),
    windowEnd: integer('window_end').notNull().default(17),
    dailyFirstMax: integer('daily_first_max').notNull().default(20),
    dailyMax: integer('daily_max').notNull().default(50),
    sentFolder: text('sent_folder').notNull().default(''),
    lastUid: integer('last_uid').notNull().default(0),
    uidValidity: text('uid_validity').notNull().default(''),
    dns: jsonb('dns').$type<Record<string, unknown> | null>(),
    lastPollAt: ts('last_poll_at'),
    lastSendAt: ts('last_send_at'),
    lastError: text('last_error').notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    /** when it started sending (the warm-up counts from here) */
    startedAt: ts('started_at').defaultNow().notNull(),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('mailboxes_org_email_idx').on(t.orgId, t.fromEmail)],
);

/** One prospect's e-mail sequence (first e-mail + follow-ups in one thread), approved by a person or by the automatic mode. */
export const outreachSequences = pgTable(
  'outreach_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
    mailboxId: uuid('mailbox_id').references(() => mailboxes.id, { onDelete: 'set null' }),
    prospectDomain: text('prospect_domain').notNull(),
    prospectType: text('prospect_type').notNull(),
    toEmail: text('to_email').notNull(),
    contactUrl: text('contact_url').notNull().default(''),
    pageUrl: text('page_url').notNull().default(''),
    targetUrl: text('target_url').notNull().default(''),
    country: text('country').notNull().default(''),
    /** scheduled | active | paused | replied | bounced | stopped | won | finished | failed */
    status: text('status').notNull().default('scheduled'),
    /** the next step to send (0 = the first e-mail); steps.length = all sent */
    step: integer('step').notNull().default(0),
    steps: jsonb('steps').$type<{ step: number; waitDays: number; subject: string; body: string; subjectAlt?: string; variant?: string }[]>().notNull(),
    /** L7: which of the batch's two subject styles this conversation went out with (A | B; empty when the pitch had only one) */
    subjectVariant: text('subject_variant').notNull().default(''),
    nextAt: ts('next_at'),
    consent: boolean('consent').notNull().default(false),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: ts('approved_at'),
    startedAt: ts('started_at'),
    lastSentAt: ts('last_sent_at'),
    replyAt: ts('reply_at'),
    replyClass: text('reply_class'),
    replySummary: text('reply_summary').notNull().default(''),
    suggestedReply: text('suggested_reply').notNull().default(''),
    replyFrom: text('reply_from').notNull().default(''),
    oooUntil: ts('ooo_until'),
    wonAt: ts('won_at'),
    error: text('error').notNull().default(''),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [index('outreach_seq_site_idx').on(t.siteId, t.prospectDomain), index('outreach_seq_due_idx').on(t.status, t.nextAt), index('outreach_seq_org_to_idx').on(t.orgId, t.toEmail)],
);

/** Every e-mail sent and every reply received in a sequence (Message-IDs for threading and reply matching). */
export const outreachMessages = pgTable(
  'outreach_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequenceId: uuid('sequence_id').notNull().references(() => outreachSequences.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    mailboxId: uuid('mailbox_id').references(() => mailboxes.id, { onDelete: 'set null' }),
    /** out | in */
    direction: text('direction').notNull(),
    step: integer('step').notNull().default(0),
    /** step | manual (an answer written in the app) | reply | auto (out of office) | bounce */
    kind: text('kind').notNull().default('step'),
    subject: text('subject').notNull().default(''),
    body: text('body').notNull().default(''),
    messageId: text('message_id').notNull().default(''),
    inReplyTo: text('in_reply_to').notNull().default(''),
    fromEmail: text('from_email').notNull().default(''),
    toEmail: text('to_email').notNull().default(''),
    error: text('error'),
    at: ts('at').defaultNow().notNull(),
  },
  (t) => [index('outreach_msg_seq_idx').on(t.sequenceId, t.at), index('outreach_msg_org_mid_idx').on(t.orgId, t.messageId), index('outreach_msg_mailbox_at_idx').on(t.mailboxId, t.direction, t.at)],
);

/** Addresses and domains the company must not write to again (opt-outs, hard bounces, added by hand). Stored as a hash plus a masked hint. */
export const suppressions = pgTable(
  'suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    /** email | domain */
    kind: text('kind').notNull(),
    valueHash: text('value_hash').notNull(),
    hint: text('hint').notNull().default(''),
    reason: text('reason').notNull().default(''),
    createdAt: created(),
  },
  (t) => [uniqueIndex('suppressions_org_kind_hash_idx').on(t.orgId, t.kind, t.valueHash)],
);

/**
 * B-R1: one row per attempt to push a report out of the app - and one per report deliberately **held**, with the reason, because a
 * report that was not sent is as much a fact as one that was. `target` is the address or the webhook's host, never a secret.
 */
export const reportDeliveries = pgTable(
  'report_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** null for a summary that covered several reports (the ones it carried are in `meta.reportIds`) */
    reportId: uuid('report_id').references(() => reports.id, { onDelete: 'cascade' }),
    /** email | webhook */
    channel: text('channel').notNull(),
    target: text('target').notNull().default(''),
    /** sent | failed | held | pending */
    status: text('status').notNull(),
    /** each | daily | weekly | monthly - which schedule produced it */
    kind: text('kind').notNull().default('each'),
    /** why it was held, or why the attempt failed */
    reason: text('reason').notNull().default(''),
    title: text('title').notNull().default(''),
    attempts: integer('attempts').notNull().default(0),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: created(),
    sentAt: ts('sent_at'),
    nextAttemptAt: ts('next_attempt_at'),
  },
  (t) => [
    index('report_deliveries_org_created_idx').on(t.orgId, t.createdAt),
    index('report_deliveries_report_idx').on(t.reportId),
    // one row per report per channel: a retry updates it instead of filling the log
    uniqueIndex('report_deliveries_once_idx').on(t.reportId, t.channel).where(sql`${t.reportId} is not null`),
  ],
);

/**
 * B5-11 / area 12 G-5 (v4.18): a company API key for the read API (`/api/v1`, design note in app/API.md "Read API v1").
 * The key itself is shown once and never stored: only its SHA-256 (`tokenHash`) and a display prefix (`asc_` + 8 characters).
 * A key belongs to exactly one company and reads only that company's data; it can never start a run or change anything.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    tokenHash: text('token_hash').notNull(),
    /** read | publish_check */
    scopes: jsonb('scopes').$type<string[]>().notNull().default(['read']),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    expiresAt: ts('expires_at'),
    lastUsedAt: ts('last_used_at'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [uniqueIndex('api_keys_hash_idx').on(t.tokenHash), index('api_keys_org_idx').on(t.orgId)],
);

export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type MailboxRow = typeof mailboxes.$inferSelect;
export type OutreachSequenceRow = typeof outreachSequences.$inferSelect;
export type OutreachMessageRow = typeof outreachMessages.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type WebauthnCredentialRow = typeof webauthnCredentials.$inferSelect;
export type AuthFlowRow = typeof authFlows.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type OrgRow = typeof organizations.$inferSelect;
export type SiteRow = typeof sites.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type ReportShareRow = typeof reportShares.$inferSelect;
export type KeywordCheckRow = typeof keywordChecks.$inferSelect;
export type ReportDeliveryRow = typeof reportDeliveries.$inferSelect;
