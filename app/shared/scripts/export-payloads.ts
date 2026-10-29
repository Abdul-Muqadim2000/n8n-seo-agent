// Writes the web app's request bodies (one per mode, plus edge cases) with the values Normalize Input must derive from them to
// n8n/seo-agent/harness/fixtures_platform.json. Harness scenario S23 runs them through the real Quick Validate, Normalize Input and
// Rate Limit code, so a change on either side that breaks the contract fails offline.
//   npm run export:payloads   (from app/)
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiOnDemandRunCost, aiRunPanelOf } from '../src/ai-panel';
import { n8nSiteId } from '../src/domain';
import { aiPanelQuoteBody, buildN8nPayload, compactBody, siteAdminMonitorsBody, type SiteContext } from '../src/payload';
import { monitorSettingsSchema, RUN_SCHEMAS } from '../src/schemas';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../n8n/seo-agent/harness/fixtures_platform.json');

const SITE_ID = '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const site: SiteContext = {
  domain: 'northwind-erp.com',
  country: 'United Arab Emirates',
  business: 'We implement Odoo and Dynamics 365 ERP for distributors in the UAE',
  customers: 'distributors, wholesalers, finance teams',
  goal: 'leads',
  tone: 'Professional and direct',
  cta: 'Book a free scoping call',
  businessFacts: '12 years in the UAE; 40 ERP rollouts; Odoo Gold Partner',
  competitors: ['azentio.com', 'cleartax.com'],
  brandNames: ['Northwind', 'Northwind ERP'],
  ga4PropertyId: '543096312',
};
const delivery = { callbackUrl: 'http://host.docker.internal:4000/api/hooks/n8n/tok_test_platform', email: 'owner@northwind-erp.com' };
const noMail = { ...delivery, email: '' };
// W2-FIX: what the server adds to an on-demand AI visibility check of a 200-question panel with the persona test (3 roles), a fan-out check of 50
// and the market trend (services/runs.ts: aiPanelForQuote -> aiOnDemandRunCost -> aiPanelQuoteBody)
const AI_PANEL_200 = aiRunPanelOf({ aiPromptsMax: 200, aiEngines: null, aiPersonaContext: true, aiPersonas: 'CFO, IT manager, Procurement', aiFanoutCheck: 50, aiDemandMarket: true });
const AI_QUOTE = aiPanelQuoteBody(aiOnDemandRunCost(AI_PANEL_200), AI_PANEL_200.panel) as { dfs_usd: number; ai_usd: number; panel: number };

type Case = { name: string; mode: keyof typeof RUN_SCHEMAS; input: Record<string, unknown>; site: SiteContext | null; mail?: boolean; expect: Record<string, unknown>; /** fields the server adds to the body (runs.ts) */ extra?: Record<string, unknown> };

const cases: Case[] = [
  {
    name: 'verdict with site',
    mode: 'verdict',
    input: { siteId: SITE_ID, keyword: 'E Invoicing  in UAE', country: 'United Arab Emirates' },
    site,
    expect: { mode: 'keyword', verdict_only: true, keyword: 'e invoicing in uae', domain: 'northwind-erp.com', business: site.business, need_site_description: false, include_content: false, country: 'United Arab Emirates' },
  },
  {
    name: 'verdict without site',
    mode: 'verdict',
    input: { siteId: null, keyword: 'odoo partner dubai', country: 'United Arab Emirates', business: 'ERP consultancy' },
    site: null,
    mail: false,
    expect: { mode: 'keyword', verdict_only: true, domain: '', business: 'ERP consultancy', email: '', need_site_description: false },
  },
  {
    name: 'keyword pillar page, report + content, site facts',
    mode: 'keyword',
    input: { siteId: SITE_ID, keyword: 'erp for distributors', country: 'United Arab Emirates', pageType: 'Pillar Page', goal: 'traffic', tone: 'Technical and precise', checkPageExists: true },
    site,
    expect: { mode: 'keyword', page_type: 'Pillar Page', goal: 'traffic', tone: 'Technical and precise', business: site.business, audience: site.customers, business_facts: site.businessFacts, cta: site.cta, include_content: true, include_seo_report: true, run_page_check: true, email: 'owner@northwind-erp.com' },
  },
  {
    name: 'keyword local page with video, content only',
    mode: 'keyword',
    input: { siteId: SITE_ID, keyword: 'odoo partner', country: 'United Arab Emirates', pageType: 'Local Page', localArea: 'Dubai Marina', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoTranscript: '0:00 Intro\n0:45 Setup', receiveReport: false, receiveContent: true, goal: 'sales', cta: 'Call us today' },
    site,
    expect: { page_type: 'Local Page', local_area: 'Dubai Marina', goal: 'sales', cta: 'Call us today', include_content: true, include_seo_report: false, 'video.provider': 'youtube', 'video.id': 'dQw4w9WgXcQ' },
  },
  {
    name: 'keyword without a website, what you sell typed',
    mode: 'keyword',
    input: { siteId: null, keyword: 'odoo partner dubai', country: 'United Arab Emirates', business: 'ERP consultancy for food distributors', businessFacts: '40 Odoo rollouts since 2014' },
    site: null,
    mail: false,
    expect: { mode: 'keyword', domain: '', business: 'ERP consultancy for food distributors', business_facts: '40 Odoo rollouts since 2014', email: '', include_content: true, include_seo_report: true },
  },
  {
    name: 'keyword improve existing page',
    mode: 'keyword',
    input: { siteId: SITE_ID, keyword: 'erp implementation dubai', country: 'United Arab Emirates', existingPageUrl: 'https://www.northwind-erp.com/erp-implementation/' },
    site,
    expect: { existing_page_url: 'https://www.northwind-erp.com/erp-implementation/', run_page_check: true },
  },
  {
    // H3 (2026-10-28): the business facts answered on earlier pages travel with every page run (business_facts_kv, stored_fact_keys, after
    // `business` and `business_facts` so the fuzzy pick still finds those two), and the server marks an existing page the engine wrote itself
    name: 'keyword refresh with stored business facts (H3)',
    mode: 'keyword',
    input: { siteId: SITE_ID, keyword: 'erp implementation dubai', country: 'United Arab Emirates', existingPageUrl: 'https://www.northwind-erp.com/insights/erp-implementation/' },
    site: {
      ...site,
      factAnswers: {
        'credential.microsoft_partner': { decision: 'yes', text: 'Northwind is a Microsoft Solutions Partner.', question: 'Is this true?', category: 'credential', at: '2026-10-28T08:00:00.000Z', by: null, reportId: null },
        'service.fixed_price_scoping': { decision: 'general', text: '', question: 'Do you offer fixed-price scoping?', category: 'service', at: '2026-10-28T08:00:00.000Z', by: null, reportId: null },
      },
    },
    extra: { existing_page_ours: true },
    expect: { mode: 'keyword', business: site.business, audience: site.customers, cta: site.cta, existing_page_url: 'https://www.northwind-erp.com/insights/erp-implementation/', include_content: true },
  },
  {
    name: 'keyword: ladder page from the pipeline (write now)',
    mode: 'keyword',
    input: { siteId: SITE_ID, keyword: 'uae e invoicing requirements', country: 'United Arab Emirates', pageType: 'Guide', ladder: { id: 'lad_test123', rung: 1, head: 'e invoicing in uae', pageNo: 2 } },
    site,
    mail: false,
    expect: { mode: 'keyword', email: '', ladder_id: 'lad_test123', ladder_rung: 1, ladder_head: 'e invoicing in uae', force_content: true, include_content: true, page_type: 'Guide' },
  },
  {
    name: 'discover with site + audit follow-up',
    mode: 'discover',
    // keyword-first (R-K6): research from the app never asks for a page on its own pick, whatever the form sent
    input: { siteId: SITE_ID, country: 'United Arab Emirates', siteAudit: true, receiveReport: true, receiveContent: true },
    site,
    expect: { mode: 'discover', business: site.business, audience: site.customers, business_facts: site.businessFacts, include_audit: true, include_full_report: false, include_content: false, include_seo_report: true, keyword: '', services_given: false },
  },
  {
    // D2 (2026-10-21): the setup research carries what the website sells (it runs before Track my site stores them on the engine's row)
    name: 'discover at setup with what the website sells',
    mode: 'discover',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', businessFacts: '' },
    site: { ...site, services: ['Odoo implementation', 'E-invoicing onboarding'] },
    expect: { mode: 'discover', business: site.business, business_facts: site.businessFacts, services: ['Odoo implementation', 'E-invoicing onboarding'], services_given: true, include_content: false },
  },
  {
    name: 'discover from a description only',
    mode: 'discover',
    input: { siteId: null, business: 'Bakery supplies wholesaler', customers: 'cafes and bakeries', country: 'United Kingdom', goal: 'brand' },
    site: null,
    expect: { mode: 'discover', domain: '', business: 'Bakery supplies wholesaler', audience: 'cafes and bakeries', goal: 'brand', need_site_description: false },
  },
  {
    name: 'describe',
    mode: 'describe',
    input: { siteId: SITE_ID },
    site,
    mail: false,
    expect: { mode: 'site_description', domain: 'northwind-erp.com', need_site_description: true },
  },
  {
    name: 'audit full report, 500 pages, JS',
    mode: 'audit',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', reportType: 'full', crawlPages: 500, crawlJs: true, competitors: ['www.rival.ae'] },
    // RV-13 (2026-10-21): the full report's keyword suggestions keep to what the website sells
    site: { ...site, services: ['Odoo implementation', 'E-invoicing onboarding'] },
    expect: { mode: 'audit', include_full_report: true, include_audit: true, crawl_max_pages: 500, crawl_js: true, competitors: ['rival.ae'], services: ['Odoo implementation', 'E-invoicing onboarding'], services_given: true },
  },
  {
    name: 'audit technical with site competitors',
    mode: 'audit',
    input: { siteId: SITE_ID, country: 'United Arab Emirates' },
    site,
    expect: { include_full_report: false, include_audit: true, crawl_max_pages: 200, crawl_js: false, competitors: ['azentio.com', 'cleartax.com'] },
  },
  {
    name: 'ladder 2 pages',
    mode: 'ladder',
    input: { siteId: SITE_ID, keyword: 'e invoicing in uae', country: 'United Arab Emirates', pagesNow: 2 },
    site,
    expect: { mode: 'ladder', keyword: 'e invoicing in uae', pages_now: 2, business: site.business, business_facts: site.businessFacts, need_site_description: false },
  },
  {
    name: 'ladder picked from the recommendations, Manual (keyword-first)',
    mode: 'ladder',
    input: { siteId: SITE_ID, keyword: 'peppol access point uae', country: 'United Arab Emirates', pagesNow: 1, chosenBy: 'client_picked', ladderMode: 'manual' },
    site,
    expect: { mode: 'ladder', keyword: 'peppol access point uae', pages_now: 1, chosen_by: 'client_picked', ladder_mode: 'manual', business: site.business },
  },
  {
    name: 'ladder typed by the client, the website default mode (keyword-first)',
    mode: 'ladder',
    input: { siteId: SITE_ID, keyword: 'e invoicing software uae', country: 'United Arab Emirates' },
    site,
    expect: { mode: 'ladder', chosen_by: 'client_typed', ladder_mode: '' },
  },
  {
    name: 'track with the time zone, what you sell and the first tracking moment (keyword-first)',
    mode: 'track',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', blogsPerWeek: 1, timezone: 'Asia/Dubai', services: ['E-invoicing onboarding', 'Odoo implementation'] },
    site,
    // the server adds it: the website's first tracking (sites.trackingStartedAt), kept on every re-save
    extra: { tracking_started_at: '2026-10-19T08:30:00.000Z' },
    expect: { mode: 'track', blogs_per_week: 1, timezone: 'Asia/Dubai', services: ['E-invoicing onboarding', 'Odoo implementation'], services_given: true, tracking_started_at: '2026-10-19T08:30:00.000Z' },
  },
  {
    name: 'track with monitors',
    mode: 'track',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', keywords: ['peppol uae', 'e invoicing software uae'], blogsPerWeek: 2, monitors: { aiEngines: ['chatgpt', 'perplexity'], aiPromptsMax: 30, aiPulse: false, auditPages: 500, backlinks: false } },
    site,
    expect: { mode: 'track', keyword: '', track_keywords: ['peppol uae', 'e invoicing software uae'], blogs_per_week: 2, ga4_property_id: '543096312', competitors: ['azentio.com', 'cleartax.com'], 'monitor_input.ai_engines': 'chatgpt, perplexity', 'monitor_input.ai_prompts_max': 30, 'monitor_input.ai_pulse': false, 'monitor_input.audit_pages': 500, 'monitor_input.backlinks': false, 'monitor_input.ai_visibility': true, 'monitor_input.brand_names': 'Northwind, Northwind ERP' },
  },
  {
    // W2-FIX (2026-10-23): the owner's W2-E3 AI options reach Monitor Row (Track) through Normalize Input's monitor_input (they were dropped)
    name: 'track with the AI wave-2 options',
    mode: 'track',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', keywords: ['peppol uae'], blogsPerWeek: 1, monitors: { aiPromptsMax: 50, aiClaudeWeekly: true, aiPulseEngines: ['chatgpt', 'perplexity'], aiPersonaContext: false, aiFanoutCheck: 25, aiDemandMarket: true } },
    site,
    expect: { mode: 'track', 'monitor_input.ai_claude_weekly': true, 'monitor_input.ai_pulse_engines': 'chatgpt, perplexity', 'monitor_input.ai_persona_context': false, 'monitor_input.ai_fanout_check': 25, 'monitor_input.ai_demand_market': true, 'monitor_input.ai_prompts_max': 50 },
  },
  {
    name: 'published',
    mode: 'published',
    input: { siteId: SITE_ID, keyword: 'uae e invoicing penalties', publishedUrl: 'https://www.northwind-erp.com/blog/uae-e-invoicing-penalties/' },
    site,
    mail: false,
    expect: { mode: 'published', keyword: 'uae e invoicing penalties', published_url: 'https://www.northwind-erp.com/blog/uae-e-invoicing-penalties/' },
  },
  {
    // 2026-10-23: reported from the draft's own report (a draft that needed edits): the engine request id that wrote it rides along
    name: 'published from a draft',
    mode: 'published',
    input: { siteId: SITE_ID, keyword: 'uae e invoicing penalties', publishedUrl: 'https://www.northwind-erp.com/blog/uae-e-invoicing-penalties/', contentRequestId: '4127' },
    site,
    mail: false,
    expect: { mode: 'published', keyword: 'uae e invoicing penalties', published_url: 'https://www.northwind-erp.com/blog/uae-e-invoicing-penalties/', content_request_id: '4127' },
  },
  {
    // 2026-10-27: re-sent after the check's warning ("It is the right page, mark it published"): confirm_mismatch reaches Publish Check
    name: 'published, confirmed after the warning',
    mode: 'published',
    input: { siteId: SITE_ID, keyword: 'uae e invoicing penalties', publishedUrl: 'https://www.northwind-erp.com/blog/uae-e-invoicing-penalties/', contentRequestId: '4127', confirmMismatch: true },
    site,
    mail: false,
    expect: { mode: 'published', keyword: 'uae e invoicing penalties', content_request_id: '4127', confirm_mismatch: true },
  },
  {
    name: 'checkin',
    mode: 'checkin',
    input: { siteId: SITE_ID, manualAction: false, securityIssue: true, notes: 'Hacked content warning on /promo/' },
    site,
    mail: false,
    expect: { mode: 'checkin', checkin_manual_action: false, checkin_security_issue: true, checkin_notes: 'Hacked content warning on /promo/' },
  },
  {
    name: 'case study anonymous',
    mode: 'case_study',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', service: 'Odoo ERP implementation', clientName: 'a Dubai food distributor', clientPublic: false, challenge: 'Month-end close took 9 days across three systems.', solution: 'Odoo rollout in 14 weeks with data migration and training.', results: 'Close from 9 days to 3; 99.6% of e-invoices accepted.' },
    site,
    expect: { mode: 'case_study', keyword: 'odoo erp implementation case study', 'case_study.client_public': false, 'case_study.service': 'Odoo ERP implementation', page_type: 'Case Study' },
  },
  {
    name: 'profile (public e-mail must not become the delivery e-mail)',
    mode: 'profile',
    input: {
      siteId: SITE_ID,
      author: { name: 'Sara Khan', jobTitle: 'Head of Tax Technology', credentials: 'ACCA; 12 years in UAE VAT', bio: 'Sara leads e-invoicing rollouts.', url: 'https://northwind-erp.com/team/sara/', sameAs: ['https://www.linkedin.com/in/sara-khan/'], knowsAbout: ['e-invoicing', 'UAE VAT'] },
      reviewer: { name: 'Omar Ali', jobTitle: 'Tax Partner', url: 'https://northwind-erp.com/team/omar/' },
      businessName: 'Northwind ERP',
      businessType: 'IT consultancy',
      address: { street: 'Office 1203, Aspect Tower', city: 'Dubai', region: 'Dubai', postalCode: '00000', country: 'United Arab Emirates' },
      phone: '+971 4 000 0000',
      publicEmail: 'hello@northwind-erp.com',
      openingHours: 'Mo-Fr 09:00-18:00',
      serviceAreas: ['Dubai', 'Abu Dhabi'],
      // G31: the house style is stored on the same profile row
      style: { brandForm: 'Northwind ERP', legalName: 'Northwind Trading FZ-LLC', brandWrong: ['NorthWind'], spelling: 'British English', avoid: ['cutting-edge', 'synergy'], tone: 'plain and direct, no hype', notes: 'Write dates as 14 March 2026.' },
    },
    site,
    mail: false,
    expect: { mode: 'profile', email: '', 'profile_input.author_name': 'Sara Khan', 'profile_input.public_email': 'hello@northwind-erp.com', 'profile_input.city': 'Dubai', 'profile_input.country_code': 'AE', 'profile_input.reviewer_name': 'Omar Ali', 'profile_input.author_same_as': 'https://www.linkedin.com/in/sara-khan/', 'profile_input.service_areas': 'Dubai, Abu Dhabi', 'profile_input.style_brand_form': 'Northwind ERP', 'profile_input.style_legal_name': 'Northwind Trading FZ-LLC', 'profile_input.style_brand_wrong': 'NorthWind', 'profile_input.style_spelling': 'British English', 'profile_input.style_avoid': 'cutting-edge, synergy', 'profile_input.style_tone': 'plain and direct, no hype' },
  },
  {
    name: 'ai visibility with topics',
    mode: 'ai_visibility',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', topics: ['e-invoicing implementation', 'Odoo ERP'] },
    site,
    expect: { mode: 'ai_visibility', competitors: ['azentio.com', 'cleartax.com'], topics: ['e-invoicing implementation', 'odoo erp'], panel_quote_dfs_usd: 0, panel_quote_ai_usd: 0 },
  },
  {
    // W2-FIX (2026-10-23): the server adds its quote of the website's whole panel (runs.ts createRunWithMeta), so the front door reserves it
    name: 'ai visibility with the server\'s quote of a 200-question panel and its options',
    mode: 'ai_visibility',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', topics: [] },
    site,
    extra: { panel_quote: AI_QUOTE },
    expect: { mode: 'ai_visibility', panel_quote_dfs_usd: AI_QUOTE.dfs_usd, panel_quote_ai_usd: AI_QUOTE.ai_usd, panel_quote_panel: 200 },
  },
  {
    name: 'backlinks',
    mode: 'backlinks',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', competitors: ['rival.ae'] },
    site,
    expect: { mode: 'backlinks', competitors: ['rival.ae'], free_only: false },
  },
  {
    name: 'backlinks, free sources only (v4.10)',
    mode: 'backlinks',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', competitors: [], freeOnly: true },
    site,
    expect: { mode: 'backlinks', competitors: ['azentio.com', 'cleartax.com'], free_only: true },
  },
];

const fixtures = cases.map((c) => {
  const parsed = RUN_SCHEMAS[c.mode].safeParse({ mode: c.mode, ...c.input });
  if (!parsed.success) throw new Error(`${c.name}: ${JSON.stringify(parsed.error.issues)}`);
  const body = { ...compactBody(buildN8nPayload(parsed.data as never, c.site, c.mail === false ? noMail : delivery)), ...(c.extra ?? {}) };
  return { name: c.name, headers: { 'x-forwarded-for': 'app:7a1c2d3e-org' }, body, expect: c.expect };
});

writeFileSync(out, JSON.stringify(fixtures, null, 2) + '\n');
console.log(`wrote ${fixtures.length} platform request bodies to ${out}`);

// ---- W2-FIX (2026-10-23): the website settings' saves to Site Admin `monitors`, exactly as server/src/routes/sites.ts builds them, with the
// columns Monitor Row (Admin) must store for them (harness W2FIX-3 runs them through Admin Validate, Admin Action and Monitor Row (Admin)) ----
const outAdmin = resolve(here, '../../../n8n/seo-agent/harness/fixtures_platform_admin.json');
const RULE = { id: 'r1', metric: 'named_rate', scope: { engine: 'chatgpt' }, direction: 'drop', threshold_points: 5 };
const ALL_ON = { ai_claude_weekly: true, ai_pulse_engines: 'chatgpt, perplexity', ai_persona_context: true, ai_fanout_check: 50, ai_sov_set: 'rival.com, other.ae', ai_demand_market: true, ai_alert_rules_json: JSON.stringify([{ ...RULE, enabled: true }]) };
type AdminCase = { name: string; monitors: Record<string, unknown>; competitors?: string[]; stored: Record<string, unknown>; expect: Record<string, unknown> };
const adminCases: AdminCase[] = [
  {
    name: 'every wave-2 setting saved from the website settings',
    monitors: { aiClaudeWeekly: true, aiPulseEngines: ['chatgpt', 'perplexity', 'ai_overview'], aiPersonaContext: true, aiFanoutCheck: 50, aiSovSet: ['rival.com', 'Other.ae'], aiDemandMarket: true, aiAlertRules: [RULE] },
    stored: {},
    expect: { ai_claude_weekly: true, ai_pulse_engines: 'chatgpt, perplexity, ai_overview', ai_persona_context: true, ai_fanout_check: 50, ai_sov_set: 'rival.com, other.ae', ai_demand_market: true, ai_alert_rules_json: [{ ...RULE, enabled: true }] },
  },
  {
    name: 'every wave-2 setting switched off or emptied',
    monitors: { aiClaudeWeekly: false, aiPulseEngines: [], aiPersonaContext: false, aiFanoutCheck: 0, aiSovSet: [], aiDemandMarket: false, aiAlertRules: [] },
    stored: ALL_ON,
    expect: { ai_claude_weekly: false, ai_pulse_engines: '', ai_persona_context: false, ai_fanout_check: 0, ai_sov_set: '', ai_demand_market: false, ai_alert_rules_json: [] },
  },
  {
    name: 'a save that touches none of them keeps what is stored',
    monitors: { aiPromptsMax: 30 },
    competitors: ['rival.com'],
    stored: ALL_ON,
    expect: { ...ALL_ON, ai_alert_rules_json: [{ ...RULE, enabled: true }], ai_prompts_max: 30, competitors: 'rival.com' },
  },
  {
    // Index coverage (2026-10-29, DESIGN.md §2.6): the daily index check switched off and its daily checks changed, saved from the website
    // settings; Monitor Row (Admin) stores both columns (an empty column means on, 300 a day)
    name: 'index coverage: switched off, 500 checks a day',
    monitors: { indexWatch: false, indexDailyCap: 500 },
    stored: {},
    expect: { index_watch: false, index_daily_cap: 500 },
  },
];
const adminFixtures = adminCases.map((c) => {
  const parsed = monitorSettingsSchema.partial().safeParse(c.monitors);
  if (!parsed.success) throw new Error(`${c.name}: ${JSON.stringify(parsed.error.issues)}`);
  const domain = site.domain;
  const body = { domain, site_id: n8nSiteId(domain), request_id: 'app-monitors-fixture', action: 'monitors', monitors: siteAdminMonitorsBody(parsed.data, c.competitors) };
  return { name: c.name, body, stored: { site_id: n8nSiteId(domain), domain, ...c.stored }, expect: c.expect };
});
writeFileSync(outAdmin, JSON.stringify(adminFixtures, null, 2) + '\n');
console.log(`wrote ${adminFixtures.length} Site Admin monitors bodies to ${outAdmin}`);
