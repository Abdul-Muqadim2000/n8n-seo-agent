import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

// Settings come from the environment. In Docker Compose the app reads ../n8n/.env (the SEO_* secrets the n8n stack already uses:
// SEO_API_KEY, N8N_API_KEY, SMTP, the Google service account) plus app/.env (APP_*, DATABASE_URL, GOOGLE_OAUTH_*).
const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? def : /^(1|true|yes|on)$/i.test(v)));
const str = (def = '') => z.string().optional().transform((v) => (v == null ? def : v.trim()));

const Env = z.object({
  NODE_ENV: str('development'),
  /** pino level (tests: silent) */
  LOG_LEVEL: str('info'),
  PORT: str('4000').transform(Number),
  HOST: str('0.0.0.0'),
  /** where people open the app (used for links in e-mails and the Google redirect) */
  APP_URL: str('http://localhost:5173').transform((v) => v.replace(/\/+$/, '')),
  DATABASE_URL: str('postgres://seo:seo@localhost:5432/seo'),
  /** serve the built React app from this directory (production image) */
  WEB_DIST: str(''),
  COOKIE_SECURE: z.string().optional(),
  /** behind a reverse proxy: the number of proxy hops to trust (1 for one nginx / load balancer); never 'true' */
  TRUST_PROXY: str('0').transform((v) => (/^\d+$/.test(v) ? Number(v) : /^(true|yes|on)$/i.test(v) ? 1 : 0)),

  /** n8n as seen from this server, e.g. http://host.docker.internal:5678 */
  N8N_BASE_URL: str('http://host.docker.internal:5678').transform((v) => v.replace(/\/+$/, '')),
  N8N_API_KEY: str(),
  SEO_API_KEY: str(),
  N8N_RUN_PATH: str('/webhook/seo-keyword-check'),
  N8N_ADMIN_PATH: str('/webhook/seo-site-admin'),
  /** the Keyword Check workflow (SEOagentAssess): one keyword, answered synchronously */
  N8N_ASSESS_PATH: str('/webhook/seo-keyword-assess'),
  /** v4.13 Link Builder: start a run on demand, and read one reply (synchronous) */
  N8N_LINK_BUILDER_PATH: str('/webhook/seo-link-builder'),
  N8N_REPLY_PATH: str('/webhook/seo-reply-read'),
  /** B3-7: the Publish Check (SEOagentPubCheck): the deterministic half of the content gate over a supplied page, synchronous, free */
  N8N_PUBLISH_CHECK_PATH: str('/webhook/seo-publish-check'),
  /** v4.13: 32 bytes (64 hex or base64) that encrypt mailbox passwords; without it no mailbox can be connected */
  MAILBOX_KEY: str(''),
  /** G1: 32 bytes (64 hex or base64) that seal authenticator-app secrets and OIDC client secrets; empty = MAILBOX_KEY is used */
  IDENTITY_KEY: str(''),
  /** G1: the name authenticator apps show beside the account (default: SEO_BRAND) */
  MFA_ISSUER: str(''),
  /** G1: let an OIDC issuer resolve to a private address (a test IdP in the same Docker network); never in production */
  SSO_ALLOW_PRIVATE_HOSTS: bool(false),
  /** v4.13: the sender and inbox jobs (off in tests or on a second server) */
  LINK_BUILDER_JOBS: bool(true),
  /** L1: check the recipient's domain for a mail server before the first e-mail; false only for a local mail test with made-up domains */
  OUTREACH_MX_CHECK: bool(true),
  /** G2: a CMS on localhost / a private address (a local WordPress in development). Ignored in production. */
  CMS_ALLOW_PRIVATE_HOSTS: bool(false),
  /** the n8n project of the SEO Agent's Data Tables (the app creates seo_ladder_settings there when it is missing) */
  N8N_PROJECT_ID: str('wo1WpMiHjdduGvfl'),
  /** this server as seen from n8n (callbacks), e.g. http://host.docker.internal:4000; https in production */
  CALLBACK_BASE_URL: str('http://host.docker.internal:4000').transform((v) => v.replace(/\/+$/, '')),

  GOOGLE_OAUTH_CLIENT_ID: str(),
  GOOGLE_OAUTH_CLIENT_SECRET: str(),
  /** L4: the owner's own Google app for Gmail OAuth mailboxes (scope gmail.send; may be the same app as sign-in, but is given here
   *  on purpose so adding a mailbox scope is never implicit). With these unset the Gmail OAuth option is not offered. */
  GMAIL_OAUTH_CLIENT_ID: str(),
  GMAIL_OAUTH_CLIENT_SECRET: str(),
  /** L4: the owner's own Azure app for Microsoft 365 mailboxes (delegated Mail.Send + Mail.Read + offline_access) */
  MS_OAUTH_CLIENT_ID: str(),
  MS_OAUTH_CLIENT_SECRET: str(),
  MS_OAUTH_TENANT: str('common'),

  SEO_BRAND: str('Alaventra'),
  SEO_MAIL_FROM: str(''),
  SEO_SMTP_HOST: str(''),
  SEO_SMTP_PORT: str('465').transform(Number),
  SEO_SMTP_USER: str(''),
  SEO_SMTP_PASSWORD: str(''),
  SEO_GOOGLE_SA_EMAIL: str(''),
  SEO_GOOGLE_SA_PRIVATE_KEY: str(''),

  /** comma-separated e-mails that see the platform admin area (all companies, budgets) */
  PLATFORM_ADMIN_EMAILS: str(''),
  DEFAULT_MONTHLY_BUDGET_USD: str('25').transform(Number),
  /** let anyone sign up (false = invitation only) */
  ALLOW_SIGNUP: bool(true),
  /** the SEO engine e-mails reports and alerts too (off: every result is delivered to the app only) */
  ENGINE_EMAILS: bool(false),
  /** the app sends account e-mails (verification, password reset, invitations) through SMTP */
  ACCOUNT_EMAILS: bool(false),
  /** analyses start only after the e-mail is confirmed; defaults to on when account e-mails are on */
  REQUIRE_EMAIL_VERIFICATION: z.string().optional(),
  /** n8n's timezone (its GENERIC_TIMEZONE; n8n's default is America/New_York): the clock of the weekly schedules */
  GENERIC_TIMEZONE: str('America/New_York'),
  /** companies one person may create (platform admins: no limit) */
  MAX_COMPANIES_PER_USER: str('3').transform(Number),
  /** the highest monthly budget an owner may set; above it only a platform admin */
  OWNER_BUDGET_MAX_USD: str('100').transform(Number),
  /** estimated spend of all companies together per day (UTC); runs beyond it wait for tomorrow */
  PLATFORM_DAILY_SPEND_USD: str('40').transform(Number),
  /** "Choose keywords for me": the server starts the next recommended ladder for websites that switched it on (every 6 hours);
   * off = the setting is stored but nothing starts on its own */
  AUTO_START_LADDERS: bool(false),
  /** gap #6 (app/docs/LOG_ANALYTICS.md): the crawler-log worker, retention and IP-list refresh (off on a second server or in tests) */
  CRAWLER_JOBS: bool(true),
  /** where uploaded / pushed logs wait until the worker has read them (deleted right after); local disk of this server */
  LOG_SPOOL_DIR: str(''),
  /** fetch the vendors' crawler IP lists once a day (off: the dated copy shipped with the code is used) */
  BOT_RANGES_REFRESH: bool(true),
  /** G5 (app/docs/WHITE_LABEL.md §5): the host agencies point their portal host's CNAME at; empty = the CNAME is not checked */
  PORTAL_CNAME_TARGET: str(''),
  /** G5: more hosts this app answers on besides APP_URL's (comma-separated), e.g. the callback host */
  APP_EXTRA_HOSTS: str(''),
  /** G5: refuse requests for any other host (421); default on when APP_URL is https */
  PORTAL_STRICT_HOSTS: z.string().optional(),
  /** G5: how often verified portal hosts are re-checked (hours) */
  PORTAL_DOMAIN_CHECK_HOURS: str('6').transform(Number),
  /** G5: the portal-host re-check timer (off on a second server or in tests) */
  PORTAL_JOBS: bool(true),
  /** deploy/gcp: where browsers and machines reach THIS server directly when the web front end runs elsewhere (Vercel), e.g.
   *  https://api.alaventra.com, the addresses shown for machine endpoints (log push, SCIM) use it; empty = APP_URL */
  PUBLIC_API_URL: str(''),
  /** deploy/gcp: the parent domain the session cookie is shared on (app.<domain> and api.<domain>), e.g. alaventra.com; applied only
   *  on hosts inside it (an agency portal host keeps host-only cookies); empty = host-only everywhere */
  COOKIE_DOMAIN: str(''),
  /** deploy/gcp: browser origins allowed to call this API across origins WITH cookies (the front end on another host, for direct
   *  uploads), comma-separated full origins, e.g. https://app.alaventra.com; empty = no cross-origin access at all */
  CORS_ORIGINS: str(''),
  /** admin panel: an Anthropic Admin API key (sk-ant-admin...) to read what Claude really billed (cost report); empty = not shown */
  ANTHROPIC_ADMIN_API_KEY: str(''),
  /** admin panel: the DataForSEO API login / password (the engine's own, in n8n/.env) to read the account balance; empty = the
   *  balance movement recorded in the engine's run ledger is used instead */
  SEO_DATAFORSEO_LOGIN: str(''),
  SEO_DATAFORSEO_PASSWORD: str(''),
  /** admin panel: the engine-ledger cost sync (every 10 minutes; off on a second server or in tests) */
  ADMIN_COST_SYNC: bool(true),
  /** credits (app/docs/CREDITS.md): plan credits, expiry, pausing schedules out of credits, low-balance notices; false stops it */
  CREDIT_GUARD: bool(true),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.issues);
  process.exit(1);
}
const e = parsed.data;

export const config = {
  env: e.NODE_ENV,
  isProd: e.NODE_ENV === 'production',
  logLevel: e.LOG_LEVEL || 'info',
  port: e.PORT,
  host: e.HOST,
  appUrl: e.APP_URL,
  /** this server's own public address (machine endpoints); APP_URL when the web and the API share a host */
  publicApiUrl: (e.PUBLIC_API_URL || e.APP_URL).replace(/\/+$/, ''),
  cookieDomain: e.COOKIE_DOMAIN.toLowerCase().replace(/^\.+|\.+$/g, ''),
  corsOrigins: e.CORS_ORIGINS.split(/[\s,]+/)
    .map((x) => x.trim().replace(/\/+$/, '').toLowerCase())
    .filter((x) => /^https?:\/\/[^/]+$/.test(x)),
  databaseUrl: e.DATABASE_URL,
  webDist: e.WEB_DIST,
  cookieSecure: e.COOKIE_SECURE != null && e.COOKIE_SECURE !== '' ? /^(1|true|yes)$/i.test(e.COOKIE_SECURE) : e.APP_URL.startsWith('https://'),
  trustProxy: e.TRUST_PROXY,
  n8n: {
    baseUrl: e.N8N_BASE_URL,
    apiKey: e.N8N_API_KEY,
    webhookKey: e.SEO_API_KEY,
    runPath: e.N8N_RUN_PATH,
    adminPath: e.N8N_ADMIN_PATH,
    assessPath: e.N8N_ASSESS_PATH,
    linkBuilderPath: e.N8N_LINK_BUILDER_PATH,
    replyPath: e.N8N_REPLY_PATH,
    publishCheckPath: e.N8N_PUBLISH_CHECK_PATH,
    projectId: e.N8N_PROJECT_ID,
  },
  callbackBaseUrl: e.CALLBACK_BASE_URL,
  google: {
    clientId: e.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: e.GOOGLE_OAUTH_CLIENT_SECRET,
    enabled: !!(e.GOOGLE_OAUTH_CLIENT_ID && e.GOOGLE_OAUTH_CLIENT_SECRET),
    redirectUri: `${e.APP_URL}/api/auth/google/callback`,
  },
  // D-12 (re-rating 2026-10-17): the app's own name in what it says to customers (MCP server title, account e-mails). It was
  // SEO_BRAND, the engine's report brand, read from n8n/.env and "Dev SEO" by default, so every MCP client of this install was told
  // it was talking to "Dev SEO". The product is Alaventra (web/src/components/layout/Brand.tsx BRAND_NAME).
  brand: 'Alaventra',
  mail: {
    from: e.SEO_MAIL_FROM || (e.SEO_SMTP_USER ? `${e.SEO_BRAND} <${e.SEO_SMTP_USER}>` : ''),
    host: e.SEO_SMTP_HOST,
    port: e.SEO_SMTP_PORT,
    user: e.SEO_SMTP_USER,
    password: e.SEO_SMTP_PASSWORD,
    enabled: !!(e.SEO_SMTP_HOST && e.SEO_SMTP_USER && e.SEO_SMTP_PASSWORD),
  },
  serviceAccount: {
    email: e.SEO_GOOGLE_SA_EMAIL,
    // .env keeps the PEM on one line with literal \n
    privateKey: e.SEO_GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, '\n'),
    enabled: !!(e.SEO_GOOGLE_SA_EMAIL && e.SEO_GOOGLE_SA_PRIVATE_KEY.includes('PRIVATE KEY')),
  },
  engineEmails: e.ENGINE_EMAILS,
  accountEmails: e.ACCOUNT_EMAILS && !!(e.SEO_SMTP_HOST && e.SEO_SMTP_USER && e.SEO_SMTP_PASSWORD),
  requireEmailVerification:
    e.REQUIRE_EMAIL_VERIFICATION != null && e.REQUIRE_EMAIL_VERIFICATION !== ''
      ? /^(1|true|yes|on)$/i.test(e.REQUIRE_EMAIL_VERIFICATION)
      : e.ACCOUNT_EMAILS && !!(e.SEO_SMTP_HOST && e.SEO_SMTP_USER && e.SEO_SMTP_PASSWORD),
  n8nTimezone: e.GENERIC_TIMEZONE || 'America/New_York',
  maxCompaniesPerUser: e.MAX_COMPANIES_PER_USER,
  ownerBudgetMaxUsd: e.OWNER_BUDGET_MAX_USD,
  platformDailySpendUsd: e.PLATFORM_DAILY_SPEND_USD,
  autoStartLadders: e.AUTO_START_LADDERS,
  platformAdmins: e.PLATFORM_ADMIN_EMAILS.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean),
  defaultBudgetUsd: e.DEFAULT_MONTHLY_BUDGET_USD,
  allowSignup: e.ALLOW_SIGNUP,
  mailboxKey: e.MAILBOX_KEY,
  identityKey: e.IDENTITY_KEY || e.MAILBOX_KEY,
  mfaIssuer: e.MFA_ISSUER || e.SEO_BRAND,
  ssoAllowPrivateHosts: e.SSO_ALLOW_PRIVATE_HOSTS,
  // L4: OAuth mailboxes. The redirect URI must be registered in the owner's Google / Azure app exactly as it is built here.
  mailOauth: {
    gmail: { clientId: e.GMAIL_OAUTH_CLIENT_ID, clientSecret: e.GMAIL_OAUTH_CLIENT_SECRET, enabled: !!(e.GMAIL_OAUTH_CLIENT_ID && e.GMAIL_OAUTH_CLIENT_SECRET) },
    microsoft: { clientId: e.MS_OAUTH_CLIENT_ID, clientSecret: e.MS_OAUTH_CLIENT_SECRET, tenant: e.MS_OAUTH_TENANT || 'common', enabled: !!(e.MS_OAUTH_CLIENT_ID && e.MS_OAUTH_CLIENT_SECRET) },
    redirectUri: `${e.APP_URL}/api/mailbox-oauth/callback`,
  },
  linkBuilderJobs: e.LINK_BUILDER_JOBS,
  crawlers: {
    jobs: e.CRAWLER_JOBS,
    spoolDir: e.LOG_SPOOL_DIR || join(tmpdir(), 'alaventra-logs'),
    refreshRanges: e.BOT_RANGES_REFRESH,
  },
  outreachMxCheck: e.OUTREACH_MX_CHECK,
  // G2: never in production, whatever the variable says
  cmsAllowPrivateHosts: e.CMS_ALLOW_PRIVATE_HOSTS && e.NODE_ENV !== 'production',
  /** the engine's report brand (SEO_BRAND): printed into the documents it produces, replaced in what a white-label client gets */
  engineBrand: e.SEO_BRAND,
  admin: {
    anthropicAdminKey: e.ANTHROPIC_ADMIN_API_KEY,
    dataforseo: { login: e.SEO_DATAFORSEO_LOGIN, password: e.SEO_DATAFORSEO_PASSWORD, enabled: !!(e.SEO_DATAFORSEO_LOGIN && e.SEO_DATAFORSEO_PASSWORD) },
    costSync: e.ADMIN_COST_SYNC,
    creditGuard: e.CREDIT_GUARD,
  },
  portal: {
    cnameTarget: e.PORTAL_CNAME_TARGET.toLowerCase().replace(/\.$/, ''),
    extraHosts: e.APP_EXTRA_HOSTS.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean),
    strictHosts:
      e.PORTAL_STRICT_HOSTS != null && e.PORTAL_STRICT_HOSTS !== '' ? /^(1|true|yes|on)$/i.test(e.PORTAL_STRICT_HOSTS) : e.APP_URL.startsWith('https://'),
    checkHours: Math.max(1, e.PORTAL_DOMAIN_CHECK_HOURS || 6),
    jobs: e.PORTAL_JOBS,
  },
};
export type Config = typeof config;
