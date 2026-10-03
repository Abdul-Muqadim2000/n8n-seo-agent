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
  /** the n8n project of the SEO Agent's Data Tables (the app creates seo_ladder_settings there when it is missing) */
  N8N_PROJECT_ID: str('wo1WpMiHjdduGvfl'),
  /** this server as seen from n8n (callbacks), e.g. http://host.docker.internal:4000; https in production */
  CALLBACK_BASE_URL: str('http://host.docker.internal:4000').transform((v) => v.replace(/\/+$/, '')),

  GOOGLE_OAUTH_CLIENT_ID: str(),
  GOOGLE_OAUTH_CLIENT_SECRET: str(),

  SEO_BRAND: str('Dev SEO'),
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
  port: e.PORT,
  host: e.HOST,
  appUrl: e.APP_URL,
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
    projectId: e.N8N_PROJECT_ID,
  },
  callbackBaseUrl: e.CALLBACK_BASE_URL,
  google: {
    clientId: e.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: e.GOOGLE_OAUTH_CLIENT_SECRET,
    enabled: !!(e.GOOGLE_OAUTH_CLIENT_ID && e.GOOGLE_OAUTH_CLIENT_SECRET),
    redirectUri: `${e.APP_URL}/api/auth/google/callback`,
  },
  brand: e.SEO_BRAND,
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
};
export type Config = typeof config;
