import type { CreditPack } from '@seo/shared';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  customType,
  date,
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
    /** admin panel (0014): a platform administrator suspended the account, no sign-in by any method, every session refused */
    suspendedAt: ts('suspended_at'),
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
 * G1: short-lived server-side state of a multi-step sign-in, the password-checked sign-in still waiting for its second factor, a
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

/** G1: e-mail domains a company claims for single sign-on, proven by a DNS TXT record; one company per verified domain. */
export const ssoDomains = pgTable(
  'sso_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    verificationToken: text('verification_token').notNull(),
    verifiedAt: ts('verified_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [uniqueIndex('sso_domains_org_domain_idx').on(t.orgId, t.domain), uniqueIndex('sso_domains_verified_idx').on(t.domain).where(sql`${t.verifiedAt} is not null`)],
);

/** G1: a company's identity provider (one per company): OIDC or SAML 2.0. */
export const ssoConnections = pgTable(
  'sso_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    protocol: text('protocol').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    enforced: boolean('enforced').notNull().default(false),
    jitEnabled: boolean('jit_enabled').notNull().default(true),
    defaultRole: text('default_role').notNull().default('member'),
    oidcIssuer: text('oidc_issuer'),
    oidcClientId: text('oidc_client_id'),
    /** sealed (lib/secretBox `sealIdentity`) */
    oidcClientSecret: text('oidc_client_secret'),
    samlEntityId: text('saml_entity_id'),
    samlSsoUrl: text('saml_sso_url'),
    /** the IdP's signing certificates, PEM (public) */
    samlCerts: jsonb('saml_certs').$type<string[]>().notNull().default([]),
    lastTestAt: ts('last_test_at'),
    lastTestOk: boolean('last_test_ok'),
    lastTestMessage: text('last_test_message'),
    lastLoginAt: ts('last_login_at'),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('sso_connections_org_idx').on(t.orgId)],
);

/** G1: the IdP's stable subject for a person, so a renamed address still finds them. */
export const ssoIdentities = pgTable(
  'sso_identities',
  {
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => ssoConnections.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: created(),
    lastLoginAt: ts('last_login_at'),
  },
  (t) => [primaryKey({ columns: [t.connectionId, t.subject] }), index('sso_identities_user_idx').on(t.userId)],
);

/** G1: SCIM bearer tokens (hashed; shown once), one company each. */
export const scimTokens = pgTable(
  'scim_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    lastUsedAt: ts('last_used_at'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [uniqueIndex('scim_tokens_hash_idx').on(t.tokenHash), index('scim_tokens_org_idx').on(t.orgId)],
);

/** G1: groups pushed by the identity provider; `role` maps a group to a role in the company (null = no effect on roles). */
export const scimGroups = pgTable(
  'scim_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    externalId: text('external_id'),
    role: text('role'),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('scim_groups_org_name_idx').on(t.orgId, t.displayName)],
);

export const scimGroupMembers = pgTable(
  'scim_group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => scimGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index('scim_group_members_user_idx').on(t.userId)],
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
    /** G1: what the device list shows and revokes by, never the session key itself */
    publicId: uuid('public_id').defaultRandom().notNull(),
    /** G1: the strictest idle timeout of the person's companies, refreshed when a policy or a membership changes (null = none) */
    idleTimeoutMinutes: integer('idle_timeout_minutes'),
  },
  (t) => [index('sessions_user_idx').on(t.userId), uniqueIndex('sessions_public_idx').on(t.publicId)],
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
    /** G5 (app/docs/WHITE_LABEL.md): standard | agency | client, a client workspace is an ordinary company with its agency as parent */
    kind: text('kind').notNull().default('standard'),
    /** a client workspace's agency; an agency with client workspaces cannot be deleted (restrict) */
    parentOrgId: uuid('parent_org_id').references((): AnyPgColumn => organizations.id, { onDelete: 'restrict' }),
    /** agency: the whole brand (shared/src/agency.ts `Branding`); client workspace: its override (`ClientBranding`) */
    branding: jsonb('branding').$type<Record<string, unknown>>().notNull().default({}),
    /** agency: sender name, reply-to, custom From mailbox and its last SPF / DKIM check (`PortalMailSettings`) */
    portalMail: jsonb('portal_mail').$type<Record<string, unknown>>().notNull().default({}),
    /** client workspace: a live publish / an outreach send waits for the client's approval */
    clientApproval: boolean('client_approval').notNull().default(false),
    /** admin panel (0014): runs are refused when the company's credits cannot cover them (off = credits are counted, never block) */
    creditsEnforced: boolean('credits_enforced').notNull().default(false),
    /** credits (0015): the company's own limits (shared/src/billing.ts `CreditLimits`, read with `creditLimitsOf`) */
    creditLimits: jsonb('credit_limits').$type<Record<string, unknown>>().notNull().default({}),
    /** credits granted on the 1st of every month (0 = no plan), set by a platform admin */
    planMonthlyCredits: doublePrecision('plan_monthly_credits').notNull().default(0),
    /** the last month (YYYY-MM) the plan credits were granted for, so a restart never grants a month twice */
    planGrantedMonth: text('plan_granted_month'),
    /** the last low-balance notice sent (ok | low | critical | empty | paused) and when, so a level is announced once */
    creditAlertLevel: text('credit_alert_level').notNull().default('ok'),
    creditAlertAt: ts('credit_alert_at'),
  },
  (t) => [uniqueIndex('organizations_slug_idx').on(t.slug), uniqueIndex('organizations_hook_idx').on(t.hookToken), index('organizations_parent_idx').on(t.parentOrgId)],
);

/**
 * G5: a host an agency serves its client portal on (`seo.agency.com`). Proven by a TXT record carrying `token` (a new random token
 * per claim, bound to this company, WHITE_LABEL.md §2 takeover) plus a CNAME to the app; re-checked, lapsed after repeated failures,
 * deleted on release. One verified (or lapsed) owner per host.
 */
export const portalDomains = pgTable(
  'portal_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    host: text('host').notNull(),
    token: text('token').notNull(),
    /** pending | verified | lapsed */
    status: text('status').notNull().default('pending'),
    verifiedAt: ts('verified_at'),
    lastCheckAt: ts('last_check_at'),
    lastCheckOk: boolean('last_check_ok'),
    lastCheckDetail: text('last_check_detail'),
    failures: integer('failures').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('portal_domains_org_host_idx').on(t.orgId, t.host),
    uniqueIndex('portal_domains_live_host_idx').on(t.host).where(sql`${t.status} in ('verified', 'lapsed')`),
  ],
);

/** G5: an item the agency asked a client to approve (a written page, an outreach draft) and the client's decision. */
export const portalApprovals = pgTable(
  'portal_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    /** page | outreach */
    kind: text('kind').notNull(),
    /** a report id (page) or `prospect-domain|type` (outreach) */
    itemId: text('item_id').notNull(),
    title: text('title').notNull(),
    /** pending | approved | changes_requested | withdrawn */
    status: text('status').notNull().default('pending'),
    note: text('note').notNull().default(''),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    requestedAt: ts('requested_at').defaultNow().notNull(),
    decisionNote: text('decision_note'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: ts('decided_at'),
  },
  (t) => [index('portal_approvals_org_idx').on(t.orgId, t.requestedAt), index('portal_approvals_item_idx').on(t.orgId, t.kind, t.itemId)],
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
    /** G1: switched off by the company's identity provider (SCIM `active: false`): no access until reactivated */
    deactivatedAt: ts('deactivated_at'),
    /** G1: how the person came in, owner / invite / jit (first SSO sign-in) / scim */
    provisionedBy: text('provisioned_by').notNull().default('invite'),
    scimExternalId: text('scim_external_id'),
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
    /** credits (0015): when the credit guard paused this website's schedules (out of credits / autopilot limit); it resumes them itself.
     *  Null = not paused for credits (a pause by a person is never undone by the guard). */
    creditsPausedAt: ts('credits_paused_at'),
    /** 'balance' | 'autopilot_limit' */
    creditsPausedReason: text('credits_paused_reason'),
    /** keyword-first (0018, SCHEDULING_KEYWORDS_PLAN.md §14.6): the website's IANA time zone ('' = the engine's, America/New_York); its
     *  cycles run at 06:00 there. Captured from the owner's browser in onboarding, sent with "Track my site". */
    timezone: text('timezone').notNull().default(''),
    /** "What do you sell?": the main services or products, sent with "Track my site" (the engine stores them as declared_services) */
    services: jsonb('services').$type<string[]>().notNull().default([]),
    /** the cycle's weekday (0 Sunday - 6) as the app last set or read it: a mirror of seo_cycles.cycle_weekday for the screens; null = the
     *  weekday tracking started on */
    cycleWeekday: integer('cycle_weekday'),
    /** how much the autopilot does on its own (1 only my keywords, 2 + keep my pages healthy, 3 full autopilot); written to the engine's
     *  `_site` row (seo_ladder_settings.autopilot_level), which decides */
    autopilotLevel: integer('autopilot_level').notNull().default(2),
    /** when the auto-pause (REJECT_LIMIT rejected pages) last dropped the level to 1, and from which level (the notice shows it until the
     *  level is raised again) */
    autopilotDroppedAt: ts('autopilot_dropped_at'),
    autopilotDroppedFrom: integer('autopilot_dropped_from'),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('sites_org_domain_idx').on(t.orgId, t.domain),
    // a domain's data (n8n Data Tables are keyed by domain) belongs to the one company that verified it
    uniqueIndex('sites_verified_domain_idx').on(t.domain).where(sql`${t.verifiedAt} is not null`),
    // one engine site id, one verified website: `foo.co.uk` and `foo-co.uk` both become `site_foo-co-uk` in the engine (shared n8nSiteId),
    // so a second verified website with the same id would read and write the first one's rows (services/engineSite.ts)
    uniqueIndex('sites_verified_engine_id_idx')
      .on(sql`('site_' || regexp_replace(${t.domain}, '[^a-z0-9]+', '-', 'g'))`)
      .where(sql`${t.verifiedAt} is not null`),
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
    /** credits (0015): the price the customer was quoted before it started, what it is held at while it runs, and the most it is
     *  ever charged (null for runs from before credits were quoted) */
    quotedCredits: doublePrecision('quoted_credits'),
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
    /** G4 (app/docs/INTEGRATIONS.md): the API key that started it (null: a person in the app, or "Choose keywords for me") */
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    /** G4: the caller's `Idempotency-Key` and a SHA-256 of the request it came with; a repeat within 24 h answers this run */
    idempotencyKey: text('idempotency_key'),
    idempotencyHash: text('idempotency_hash'),
    createdAt: created(),
    acceptedAt: ts('accepted_at'),
    completedAt: ts('completed_at'),
  },
  (t) => [
    index('runs_org_created_idx').on(t.orgId, t.createdAt),
    index('runs_org_request_idx').on(t.orgId, t.requestId),
    index('runs_site_idx').on(t.siteId),
    index('runs_org_idem_idx').on(t.orgId, t.idempotencyKey).where(sql`${t.idempotencyKey} is not null`),
    // admin panel (0014): the cost sync looks runs up by the engine's request id, and the people page by the person
    index('runs_request_idx').on(t.requestId),
    index('runs_user_idx').on(t.userId),
  ],
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
 * `id` of the link is a uuid; the secret in the URL is never stored, only its SHA-256 (`tokenHash`), so a database copy hands out no
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
    /** started by the system (the queued-ladder re-check), not by a person: autopilot spend, never the person's on-demand spend */
    automatic: boolean('automatic').notNull().default(false),
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

// ---- G2 (2026-10-17): publishing written pages to the customer's CMS (app/docs/CMS_PUBLISHING.md) ----
/** One CMS a website publishes to (WordPress, Webflow, Contentful or a signed webhook). The secret is sealed (lib/secretBox.ts). */
export const cmsConnections = pgTable(
  'cms_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    /** wordpress | webflow | contentful | webhook */
    kind: text('kind').notNull(),
    label: text('label').notNull().default(''),
    baseUrl: text('base_url').notNull().default(''),
    username: text('username').notNull().default(''),
    /** AES-256-GCM under MAILBOX_KEY; never sent to the browser, never logged */
    secret: text('secret').notNull().default(''),
    /** non-secret settings (shared/src/cms.ts CmsConnectionSettings) */
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    /** untested | ok | error */
    status: text('status').notNull().default('untested'),
    statusReason: text('status_reason').notNull().default(''),
    lastTestedAt: ts('last_tested_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [index('cms_connections_site_idx').on(t.siteId), index('cms_connections_org_idx').on(t.orgId)],
);

/** One page in one CMS: re-publishing the same slug through the same connection updates this item, never a second one. */
export const cmsItems = pgTable(
  'cms_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => cmsConnections.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    keyword: text('keyword').notNull().default(''),
    remoteId: text('remote_id').notNull().default(''),
    remoteUrl: text('remote_url').notNull().default(''),
    /** draft | published | unknown */
    remoteStatus: text('remote_status').notNull().default('unknown'),
    lastReportId: uuid('last_report_id').references(() => reports.id, { onDelete: 'set null' }),
    /** images already uploaded for this item (file name -> remote media id / url), so a re-publish does not upload them twice */
    media: jsonb('media').$type<Record<string, { id: string; url: string }>>().notNull().default({}),
    /** a publish in progress holds the item until then (a second click meanwhile is refused) */
    lockUntil: ts('lock_until'),
    /** when the engine was told the page is live (the "I published a page" run) */
    engineToldAt: ts('engine_told_at'),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('cms_items_connection_slug_idx').on(t.connectionId, t.slug), index('cms_items_site_idx').on(t.siteId)],
);

/** Every attempt to send a page to a CMS, and every refusal with its reasons: who, when, where, draft or live, what came back. */
export const cmsPublishes = pgTable(
  'cms_publishes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    connectionId: uuid('connection_id').references(() => cmsConnections.id, { onDelete: 'set null' }),
    itemId: uuid('item_id').references(() => cmsItems.id, { onDelete: 'set null' }),
    reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** the connection's kind and label at the time (kept when the connection is removed) */
    kind: text('kind').notNull().default(''),
    connectionLabel: text('connection_label').notNull().default(''),
    keyword: text('keyword').notNull().default(''),
    /** draft | live | refresh */
    mode: text('mode').notNull(),
    /** sent | failed | blocked */
    status: text('status').notNull(),
    remoteId: text('remote_id').notNull().default(''),
    remoteUrl: text('remote_url').notNull().default(''),
    /** the CMS host or kind, never a secret */
    target: text('target').notNull().default(''),
    error: text('error').notNull().default(''),
    notes: jsonb('notes').$type<string[]>().notNull().default([]),
    blockers: jsonb('blockers').$type<Record<string, unknown>[]>().notNull().default([]),
    engineRunId: uuid('engine_run_id').references(() => runs.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [index('cms_publishes_org_created_idx').on(t.orgId, t.createdAt), index('cms_publishes_report_idx').on(t.reportId), index('cms_publishes_site_idx').on(t.siteId, t.createdAt)],
);

// ---------------------------------------------------------------------------------------------------------------------------
// G4 (2026-10-17): integrations, app/docs/INTEGRATIONS.md. Every secret column holds a value sealed with MAILBOX_KEY (secretBox).
// ---------------------------------------------------------------------------------------------------------------------------

/** One connector of a company: an issue tracker (jira / linear / asana, one each) or an export destination (s3 / bigquery). */
export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    /** the non-secret settings (site URL, project, bucket, dataset, tables, schedule...) */
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    /** sealed JSON of the credentials; never returned */
    secret: text('secret').notNull(),
    /** e.g. "token ...a1b2": shown instead of the secret */
    secretHint: text('secret_hint').notNull().default(''),
    status: text('status').notNull().default('untested'),
    lastError: text('last_error').notNull().default(''),
    lastCheckedAt: ts('last_checked_at'),
    lastRunAt: ts('last_run_at'),
    nextRunAt: ts('next_run_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('integrations_org_idx').on(t.orgId),
    // one Jira, one Linear, one Asana per company; several storage destinations are allowed
    uniqueIndex('integrations_tracker_once_idx').on(t.orgId, t.kind).where(sql`${t.kind} in ('jira', 'linear', 'asana')`),
    index('integrations_next_run_idx').on(t.nextRunAt),
  ],
);

/** One ticket per finding / recommendation per company (the dedupe rule); inserted as `creating` before the remote call. */
export const issueLinks = pgTable(
  'issue_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    /** finding:<website>:<finding key> | rec:<website>:<recommendation id> */
    sourceKey: text('source_key').notNull(),
    sourceTitle: text('source_title').notNull().default(''),
    remoteId: text('remote_id').notNull().default(''),
    remoteKey: text('remote_key').notNull().default(''),
    remoteUrl: text('remote_url').notNull().default(''),
    remoteStatus: text('remote_status').notNull().default(''),
    remoteState: text('remote_state').notNull().default('unknown'),
    /** creating | created | failed */
    status: text('status').notNull().default('creating'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    syncedAt: ts('synced_at'),
  },
  (t) => [uniqueIndex('issue_links_source_idx').on(t.orgId, t.sourceKey), index('issue_links_org_created_idx').on(t.orgId, t.createdAt)],
);

/** An outbound event endpoint: signed JSON, a Slack channel or a Teams channel, subscribed to event types and websites. */
export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** json | slack | teams */
    format: text('format').notNull(),
    /** the address, sealed (a Slack / Teams address is itself a credential) */
    urlSealed: text('url_sealed').notNull(),
    urlHost: text('url_host').notNull(),
    urlHint: text('url_hint').notNull().default(''),
    /** json endpoints: the HMAC signing secret we generated, sealed ('' for slack / teams) */
    secretSealed: text('secret_sealed').notNull().default(''),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    /** empty = every website of the company */
    siteIds: jsonb('site_ids').$type<string[]>().notNull().default([]),
    enabled: boolean('enabled').notNull().default(true),
    disabledReason: text('disabled_reason').notNull().default(''),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    lastSuccessAt: ts('last_success_at'),
    lastFailureAt: ts('last_failure_at'),
  },
  (t) => [index('webhook_endpoints_org_idx').on(t.orgId)],
);

/** One event to one endpoint, with its attempts: the delivery log and the retry queue in one table (purged after 30 days). */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    /** pending | sent | failed | gave_up */
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: ts('next_attempt_at'),
    lastStatusCode: integer('last_status_code'),
    lastError: text('last_error').notNull().default(''),
    createdAt: created(),
    deliveredAt: ts('delivered_at'),
  },
  (t) => [
    index('webhook_deliveries_org_created_idx').on(t.orgId, t.createdAt),
    index('webhook_deliveries_due_idx').on(t.status, t.nextAttemptAt),
    uniqueIndex('webhook_deliveries_once_idx').on(t.endpointId, t.eventId),
  ],
);

/** One export of one destination: per table rows, bytes, the object / load job, and what went wrong. */
export const exportRuns = pgTable(
  'export_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    trigger: text('trigger').notNull(),
    /** running | ok | partial | failed */
    status: text('status').notNull().default('running'),
    tables: jsonb('tables').$type<Record<string, unknown>[]>().notNull().default([]),
    error: text('error').notNull().default(''),
    startedAt: ts('started_at').defaultNow().notNull(),
    finishedAt: ts('finished_at'),
  },
  (t) => [index('export_runs_integration_idx').on(t.integrationId, t.startedAt)],
);

export type IntegrationRow = typeof integrations.$inferSelect;
export type IssueLinkRow = typeof issueLinks.$inferSelect;
export type WebhookEndpointRow = typeof webhookEndpoints.$inferSelect;
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;
export type ExportRunRow = typeof exportRuns.$inferSelect;
export type CmsConnectionRow = typeof cmsConnections.$inferSelect;
export type CmsItemRow = typeof cmsItems.$inferSelect;
export type CmsPublishRow = typeof cmsPublishes.$inferSelect;
/**
 * Gap #6 (2026-10-17, app/docs/LOG_ANALYTICS.md): server-log and AI-crawler analytics. One settings row per website: how long raw
 * crawler lines are kept, and the push key Cloudflare Logpush / a log drain sends (only its SHA-256 is stored; shown once).
 */
export const logSources = pgTable('log_sources', {
  siteId: uuid('site_id')
    .primaryKey()
    .references(() => sites.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  retentionDays: integer('retention_days').notNull().default(30),
  pushKeyHash: text('push_key_hash'),
  pushKeyPrefix: text('push_key_prefix'),
  pushKeyCreatedAt: ts('push_key_created_at'),
  pushKeyCreatedBy: uuid('push_key_created_by').references(() => users.id, { onDelete: 'set null' }),
  lastPushAt: ts('last_push_at'),
  updatedAt: ts('updated_at').defaultNow().notNull(),
});

/**
 * One row per uploaded file or pushed batch: the job the background worker runs (queued -> processing -> done | failed). The bytes
 * wait in a spool file on the server that received them (`host`, `spool_path`) and are deleted as soon as the job ends.
 */
export const logIngests = pgTable(
  'log_ingests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    /** upload | push */
    source: text('source').notNull(),
    fileName: text('file_name').notNull().default(''),
    /** queued | processing | done | failed */
    status: text('status').notNull().default('queued'),
    host: text('host').notNull().default(''),
    spoolPath: text('spool_path').notNull().default(''),
    bytes: bigint('bytes', { mode: 'number' }).notNull().default(0),
    sha256: text('sha256').notNull(),
    /** combined | w3c | json | unknown */
    format: text('format').notNull().default('unknown'),
    stats: jsonb('stats').$type<Record<string, unknown>>(),
    error: text('error').notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
    startedAt: ts('started_at'),
    finishedAt: ts('finished_at'),
  },
  (t) => [
    index('log_ingests_site_created_idx').on(t.siteId, t.createdAt),
    index('log_ingests_status_idx').on(t.status, t.createdAt),
    // the same file twice is refused (a retried push answers "already have it"); a failed one may be sent again
    uniqueIndex('log_ingests_site_sha_idx').on(t.siteId, t.sha256).where(sql`${t.status} <> 'failed'`),
  ],
);

/**
 * One row per crawler request (never a person's): kept `log_sources.retention_days`. No client address is stored, only, for a
 * request that was not proved, its network (/24 for IPv4, /48 for IPv6), so a spoofer can be blocked. `line_hash` makes the same
 * line sent twice (an overlapping upload, a retried push) count once.
 */
export const crawlerHits = pgTable(
  'crawler_hits',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    ingestId: uuid('ingest_id').references(() => logIngests.id, { onDelete: 'set null' }),
    at: ts('at').notNull(),
    bot: text('bot').notNull(),
    /** verified | spoofed | claimed | unchecked */
    verification: text('verification').notNull(),
    method: text('method').notNull().default('GET'),
    path: text('path').notNull(),
    queryKeys: text('query_keys').notNull().default(''),
    /** page | asset | robots | sitemap */
    kind: text('kind').notNull().default('page'),
    status: integer('status').notNull(),
    bytes: bigint('bytes', { mode: 'number' }),
    ms: integer('ms'),
    net: text('net'),
    lineHash: bytea('line_hash').notNull(),
  },
  (t) => [index('crawler_hits_site_at_idx').on(t.siteId, t.at), uniqueIndex('crawler_hits_site_line_idx').on(t.siteId, t.lineHash)],
);

/** Daily totals per crawler and verification (kept 400 days; additive, so every ingest adds to them). */
export const crawlerDaily = pgTable(
  'crawler_daily',
  {
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    bot: text('bot').notNull(),
    verification: text('verification').notNull(),
    hits: integer('hits').notNull().default(0),
    s2xx: integer('s2xx').notNull().default(0),
    s3xx: integer('s3xx').notNull().default(0),
    s4xx: integer('s4xx').notNull().default(0),
    s5xx: integer('s5xx').notNull().default(0),
    refused: integer('refused').notNull().default(0),
    paramHits: integer('param_hits').notNull().default(0),
    assetHits: integer('asset_hits').notNull().default(0),
    bytes: bigint('bytes', { mode: 'number' }).notNull().default(0),
    msSum: bigint('ms_sum', { mode: 'number' }).notNull().default(0),
    msN: integer('ms_n').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.day, t.bot, t.verification] })],
);

/** Daily requests per crawler and path, spoofed requests left out (kept 400 days): coverage, first seen, waste by URL. */
export const crawlerPageDaily = pgTable(
  'crawler_page_daily',
  {
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    bot: text('bot').notNull(),
    path: text('path').notNull(),
    hits: integer('hits').notNull().default(0),
    verifiedHits: integer('verified_hits').notNull().default(0),
    s3xx: integer('s3xx').notNull().default(0),
    s4xx: integer('s4xx').notNull().default(0),
    s5xx: integer('s5xx').notNull().default(0),
    paramHits: integer('param_hits').notNull().default(0),
    lastStatus: integer('last_status'),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.day, t.bot, t.path] }), index('crawler_page_daily_site_bot_path_idx').on(t.siteId, t.bot, t.path)],
);

/** The vendors' published crawler IP lists as last fetched (one row per list); the server falls back to its dated copy. */
export const botIpRanges = pgTable('bot_ip_ranges', {
  sourceId: text('source_id').primaryKey(),
  url: text('url').notNull(),
  creationTime: text('creation_time'),
  prefixes: jsonb('prefixes').$type<string[]>().notNull().default([]),
  fetchedAt: ts('fetched_at'),
  checkedAt: ts('checked_at').defaultNow().notNull(),
  error: text('error').notNull().default(''),
});

// ---------- platform admin panel (0014, shared/src/admin.ts) ----------

/**
 * A company's credits, one signed entry per movement: `grant` (an admin added credits; `paidUsd` = the revenue recorded with it),
 * `adjust` (an admin corrected the balance, + or -), `usage` (a settled cost, debited once, `refKey` names the cost event it came
 * from, unique, so a sync that runs twice cannot debit twice), `refund` (usage given back). Balance = the sum.
 */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** the order the entries were written in (running balance) */
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    /** null once the company was deleted: its grants stay as revenue history (shown under "deleted companies") */
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    /** the company's name when the entry was written, for display after it is gone */
    orgName: text('org_name').notNull().default(''),
    kind: text('kind').notNull(),
    credits: doublePrecision('credits').notNull(),
    paidUsd: doublePrecision('paid_usd').notNull().default(0),
    note: text('note').notNull().default(''),
    ref: jsonb('ref').$type<Record<string, unknown> | null>(),
    /** usage: `cost:<cost event key>` (or `reprice:<key>` for the give-back when the engine's figure replaced the app's) */
    refKey: text('ref_key'),
    actorUserId: uuid('actor_user_id'),
    actorEmail: text('actor_email'),
    createdAt: created(),
  },
  (t) => [
    index('credit_ledger_org_idx').on(t.orgId, t.seq),
    index('credit_ledger_org_created_idx').on(t.orgId, t.createdAt),
    uniqueIndex('credit_ledger_ref_key_idx').on(t.refKey).where(sql`${t.refKey} is not null`),
  ],
);

/**
 * One settled cost unit, whoever caused it (services/admin/costSync.ts): an engine ledger row (`seo_run_ledger`, source 'engine'), an
 * app run the ledger does not cover (source 'app', from the run's settled cost), or a keyword check (source 'keyword_check').
 * `eventKey` is the one identity: `engine:<execution id>`, `run:<runs.id>`, `kc:<keyword_checks.id>`. `orgId` null = unattributed
 * (no company could be tied to it; a deleted company's costs fall back to it too).
 */
export const costEvents = pgTable(
  'cost_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventKey: text('event_key').notNull(),
    source: text('source').notNull(),
    engineRunId: text('engine_run_id'),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    domain: text('domain').notNull().default(''),
    mode: text('mode').notNull().default(''),
    /** app | schedule */
    origin: text('origin').notNull().default('schedule'),
    /** the engine row's key (`app:<org>`, `schedule:<mode>`, `parent:<id>`, `ladder:<id>` ...): kept for the record */
    engineKey: text('engine_key').notNull().default(''),
    claudeUsd: doublePrecision('claude_usd').notNull().default(0),
    claudeEstimatedUsd: doublePrecision('claude_estimated_usd').notNull().default(0),
    dataforseoUsd: doublePrecision('dataforseo_usd').notNull().default(0),
    /** measured | partly estimated | estimated | not reported */
    certainty: text('certainty').notNull().default('measured'),
    /** the DataForSEO balance read when the engine row was reserved and when it settled (0 = not read): what the account really moved */
    balanceBefore: doublePrecision('balance_before').notNull().default(0),
    balanceAfter: doublePrecision('balance_after').notNull().default(0),
    startedAt: ts('started_at'),
    occurredAt: ts('occurred_at').notNull(),
    syncedAt: ts('synced_at').defaultNow().notNull(),
    /** the engine row's `settled_at` as read: a row settled again (a new settled_at with a new figure) is re-priced, never ignored */
    engineSettledAt: text('engine_settled_at').notNull().default(''),
    /** the company's name when its company was deleted (services/companyDelete.ts): such a cost is never attributed to anybody again */
    detachedFrom: text('detached_from'),
  },
  (t) => [
    uniqueIndex('cost_events_key_idx').on(t.eventKey),
    index('cost_events_user_idx').on(t.userId),
    index('cost_events_site_idx').on(t.siteId),
    uniqueIndex('cost_events_engine_run_idx').on(t.engineRunId).where(sql`${t.engineRunId} is not null`),
    index('cost_events_org_at_idx').on(t.orgId, t.occurredAt),
    index('cost_events_at_idx').on(t.occurredAt),
    index('cost_events_run_idx').on(t.runId),
  ],
);

/** The panel's settings: one row (id 1). The engine-ledger sync keeps its own state on it too (never sent to the browser). */
export const platformSettings = pgTable('platform_settings', {
  id: integer('id').primaryKey().default(1),
  creditValueUsd: doublePrecision('credit_value_usd').notNull(),
  markup: doublePrecision('markup').notNull(),
  signupCredits: doublePrecision('signup_credits').notNull().default(0),
  enforceForNewCompanies: boolean('enforce_for_new_companies').notNull().default(false),
  /** when credits started being counted (the deploy of 0014): costs settled before it are shown as cost but debit no credits, so
   *  existing companies do not start with a negative balance for runs from before credits existed */
  creditsSince: ts('credits_since').defaultNow().notNull(),
  updatedAt: ts('updated_at'),
  updatedBy: text('updated_by'),
  ledgerSyncedAt: ts('ledger_synced_at'),
  ledgerSyncOk: boolean('ledger_sync_ok').notNull().default(false),
  ledgerSyncNote: text('ledger_sync_note').notNull().default(''),
  ledgerRows: integer('ledger_rows').notNull().default(0),
  /** the newest `settled_at` already read: the next sync reads from a day before it */
  ledgerWatermark: text('ledger_watermark'),
  /** the last full re-read of the ledger (the others read from the watermark minus a day) */
  ledgerFullAt: ts('ledger_full_at'),
  /** credits (0015): the packs customers can ask for (shared/src/billing.ts `CreditPack[]`), how long they last, plan rollover */
  creditPacks: jsonb('credit_packs').$type<CreditPack[]>(),
  packExpiryMonths: integer('pack_expiry_months').notNull().default(12),
  planRollover: boolean('plan_rollover').notNull().default(true),
  signupExpiryDays: integer('signup_expiry_days').notNull().default(90),
  /** credits (0016): when the companies that existed before credits were brought onto them (welcome credits, enforcement), once */
  creditsAlignedAt: ts('credits_aligned_at'),
});

/**
 * Credits (0015, app/docs/CREDITS.md): a lot of credits a company received, a plan month, a pack, a grant, welcome credits, a refund, * with what is left of it and when it expires. The ledger (`credit_ledger`) stays the one record of every movement and the balance is
 * its sum; the lots say which credits a debit used (soonest-expiring first) and which expire when. Invariant, per company:
 * balance = Σ remaining − debt, where debt is what was used beyond every lot (paid down first by the next lot).
 */
export const creditLots = pgTable(
  'credit_lots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** plan | pack | grant | signup | refund | adjust | migrated */
    source: text('source').notNull(),
    credits: doublePrecision('credits').notNull(),
    remaining: doublePrecision('remaining').notNull(),
    expiresAt: ts('expires_at'),
    note: text('note').notNull().default(''),
    /** the ledger entry that created it */
    ledgerId: uuid('ledger_id'),
    createdAt: created(),
  },
  (t) => [index('credit_lots_org_idx').on(t.orgId, t.expiresAt)],
);

/** A customer's "Buy credits": a pack asked for, fulfilled by a platform admin with a grant that records the payment. */
export const creditPurchaseRequests = pgTable(
  'credit_purchase_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    orgName: text('org_name').notNull().default(''),
    packId: text('pack_id').notNull(),
    credits: doublePrecision('credits').notNull(),
    priceUsd: doublePrecision('price_usd').notNull(),
    note: text('note').notNull().default(''),
    /** pending | fulfilled | cancelled */
    status: text('status').notNull().default('pending'),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    requestedByEmail: text('requested_by_email'),
    resolvedAt: ts('resolved_at'),
    resolvedBy: text('resolved_by'),
    ledgerId: uuid('ledger_id'),
    createdAt: created(),
  },
  (t) => [index('credit_purchase_requests_org_idx').on(t.orgId, t.createdAt), index('credit_purchase_requests_status_idx').on(t.status)],
);

/**
 * The invoice of a paid credit purchase (app/docs/CREDITS.md "Invoices"): one per paid grant (`ledgerId` unique), numbered per year
 * without gaps (`year` + `seq`, allocated under a lock), with everything printed on it copied in, so the PDF reads the same after the
 * company is renamed or deleted, or the issuer's details change.
 */
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** ALV-2026-0001 */
    number: text('number').notNull(),
    year: integer('year').notNull(),
    seq: integer('seq').notNull(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    orgName: text('org_name').notNull(),
    ledgerId: uuid('ledger_id').notNull(),
    requestId: uuid('request_id'),
    credits: doublePrecision('credits').notNull(),
    amountUsd: doublePrecision('amount_usd').notNull(),
    currency: text('currency').notNull().default('USD'),
    description: text('description').notNull(),
    /** who it is addressed to: the company's owners and admins when it was issued */
    billedTo: jsonb('billed_to').$type<string[]>().notNull().default([]),
    /** the seller as printed: name, address lines, tax id, e-mail (config INVOICE_*) */
    issuer: jsonb('issuer').$type<{ name: string; lines: string[]; taxId: string; email: string }>().notNull(),
    note: text('note').notNull().default(''),
    issuedAt: ts('issued_at').defaultNow().notNull(),
    issuedBy: text('issued_by').notNull().default(''),
    emailedAt: ts('emailed_at'),
    emailedTo: jsonb('emailed_to').$type<string[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex('invoices_number_idx').on(t.number),
    uniqueIndex('invoices_year_seq_idx').on(t.year, t.seq),
    uniqueIndex('invoices_ledger_idx').on(t.ledgerId),
    index('invoices_org_idx').on(t.orgId, t.issuedAt),
  ],
);

/** What platform administrators did in the panel (credits, users, companies, settings). Internal; no foreign keys (history stays). */
export const adminAudit = pgTable(
  'admin_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    at: ts('at').defaultNow().notNull(),
    actorUserId: uuid('actor_user_id'),
    actorEmail: text('actor_email').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    targetLabel: text('target_label').notNull().default(''),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('admin_audit_at_idx').on(t.at)],
);

// ---- keyword-first autopilot (0018, n8n/seo-agent/docs/SCHEDULING_KEYWORDS_PLAN.md §5.6 / §5.7 / §14.6) ----

/**
 * The next keyword the system proposes for a website (services/autoStart.ts). Levels 1-2: a suggestion (`startAt` null) that waits for the
 * client; level 3: an announcement that starts at `startAt` (PROPOSAL_WAIT_HOURS after it was made) unless the client changes or skips it.
 * `keywordNorm` is unique per website: a keyword is proposed once, ever (a skipped one never comes back). At most one open proposal
 * (pending / starting) per website. Both are database rules, so a timer that runs twice, or on two servers, cannot propose twice.
 */
export const keywordProposals = pgTable(
  'keyword_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    keyword: text('keyword').notNull(),
    keywordNorm: text('keyword_norm').notNull(),
    /** the recommendation it came from (searches, difficulty, plan, months, why, the research report id) */
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    /** pending | starting | started | approved | swapped | skipped | expired | failed */
    status: text('status').notNull().default('pending'),
    level: integer('level').notNull().default(2),
    /** room | won | done */
    occasion: text('occasion').notNull().default('room'),
    startAt: ts('start_at'),
    /** when the open proposal was claimed for a start (status starting): a claim older than 15 minutes with no run is released */
    claimedAt: ts('claimed_at'),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
    swappedFor: text('swapped_for'),
    note: text('note').notNull().default(''),
    emailedAt: ts('emailed_at'),
    createdAt: created(),
    decidedAt: ts('decided_at'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    // a keyword is proposed once per website; a proposal whose start failed does not count, so the keyword can be proposed again
    uniqueIndex('keyword_proposals_site_keyword_idx').on(t.siteId, t.keywordNorm).where(sql`${t.status} <> 'failed'`),
    uniqueIndex('keyword_proposals_site_open_idx').on(t.siteId).where(sql`${t.status} in ('pending', 'starting')`),
    index('keyword_proposals_due_idx').on(t.status, t.startAt),
  ],
);

/** The latest "Coming up" plan of each cycle of a website (the engine's `cycle_preview` callback, 48 h before the cycle). */
export const cyclePreviews = pgTable(
  'cycle_previews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    cycleKey: text('cycle_key').notNull(),
    scheduledFor: ts('scheduled_for'),
    /** the callback body as the engine sent it (CyclePreview, cycles.ts) */
    body: jsonb('body').$type<Record<string, unknown>>().notNull(),
    reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
    receivedAt: ts('received_at').defaultNow().notNull(),
    /** when the weekly "Coming up" e-mail went out for it (once per cycle) */
    emailedAt: ts('emailed_at'),
  },
  (t) => [uniqueIndex('cycle_previews_site_cycle_idx').on(t.siteId, t.cycleKey), index('cycle_previews_site_received_idx').on(t.siteId, t.receivedAt)],
);

/** "Not what I wanted" on a written page. REJECT_LIMIT of the last REJECT_WINDOW automatic non-ladder pages drop the level to 1. */
export const contentFeedback = pgTable(
  'content_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
    reportId: uuid('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    keyword: text('keyword').notNull().default(''),
    /** the page's source (ladder, decay, striking, trend, ai_answer, ai_refresh, app) */
    source: text('source').notNull().default(''),
    /** the page was written by the autopilot on its own (not a ladder page, not a page the client asked for) */
    automatic: boolean('automatic').notNull().default(false),
    verdict: text('verdict').notNull().default('reject'),
    reason: text('reason').notNull().default(''),
    by: uuid('by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [uniqueIndex('content_feedback_report_idx').on(t.reportId), index('content_feedback_site_idx').on(t.siteId, t.createdAt)],
);

/**
 * D3: the one free keyword research of a website at setup. Keyed by the DOMAIN, not the website row: deleting a website and adding it
 * again, or adding it in another company, never earns a second free research.
 */
export const freeResearchGrants = pgTable('free_research_grants', {
  domain: text('domain').primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
  createdAt: created(),
});

/**
 * §5.6: a queued ladder planned more than QUEUED_RECHECK_DAYS ago gets one fresh keyword check when it becomes active. One row per
 * website and ladder (so it is checked once, whatever the timers do); `paused` when the verdict fell and the ladder was paused.
 */
export const ladderRechecks = pgTable(
  'ladder_rechecks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    ladderId: text('ladder_id').notNull(),
    keyword: text('keyword').notNull(),
    /** pending | done | failed */
    status: text('status').notNull().default('pending'),
    /** the check's verdict: difficulty, fit */
    result: jsonb('result').$type<Record<string, unknown>>().notNull().default({}),
    paused: boolean('paused').notNull().default(false),
    reason: text('reason').notNull().default(''),
    createdAt: created(),
    checkedAt: ts('checked_at'),
  },
  (t) => [uniqueIndex('ladder_rechecks_site_ladder_idx').on(t.siteId, t.ladderId)],
);

export type KeywordProposalRow = typeof keywordProposals.$inferSelect;
export type CyclePreviewRow = typeof cyclePreviews.$inferSelect;
export type ContentFeedbackRow = typeof contentFeedback.$inferSelect;
export type LadderRecheckRow = typeof ladderRechecks.$inferSelect;

export type CreditEntryRow = typeof creditLedger.$inferSelect;
export type CostEventRow = typeof costEvents.$inferSelect;
export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
export type CreditLotRow = typeof creditLots.$inferSelect;
export type CreditPurchaseRequestRow = typeof creditPurchaseRequests.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type LogSourceRow = typeof logSources.$inferSelect;
export type LogIngestRow = typeof logIngests.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type MailboxRow = typeof mailboxes.$inferSelect;
export type OutreachSequenceRow = typeof outreachSequences.$inferSelect;
export type OutreachMessageRow = typeof outreachMessages.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type WebauthnCredentialRow = typeof webauthnCredentials.$inferSelect;
export type AuthFlowRow = typeof authFlows.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type SsoConnectionRow = typeof ssoConnections.$inferSelect;
export type SsoDomainRow = typeof ssoDomains.$inferSelect;
export type ScimGroupRow = typeof scimGroups.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type PortalDomainRow = typeof portalDomains.$inferSelect;
export type PortalApprovalRow = typeof portalApprovals.$inferSelect;
export type OrgRow = typeof organizations.$inferSelect;
export type SiteRow = typeof sites.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type ReportShareRow = typeof reportShares.$inferSelect;
export type KeywordCheckRow = typeof keywordChecks.$inferSelect;
export type ReportDeliveryRow = typeof reportDeliveries.$inferSelect;
