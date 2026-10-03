// Writes the web app's request bodies (one per mode, plus edge cases) with the values Normalize Input must derive from them to
// n8n/seo-agent/harness/fixtures_platform.json. Harness scenario S23 runs them through the real Quick Validate, Normalize Input and
// Rate Limit code, so a change on either side that breaks the contract fails offline.
//   npm run export:payloads   (from app/)
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildN8nPayload, compactBody, type SiteContext } from '../src/payload';
import { RUN_SCHEMAS } from '../src/schemas';

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

type Case = { name: string; mode: keyof typeof RUN_SCHEMAS; input: Record<string, unknown>; site: SiteContext | null; mail?: boolean; expect: Record<string, unknown> };

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
    name: 'keyword improve existing page',
    mode: 'keyword',
    input: { siteId: SITE_ID, keyword: 'erp implementation dubai', country: 'United Arab Emirates', existingPageUrl: 'https://www.northwind-erp.com/erp-implementation/' },
    site,
    expect: { existing_page_url: 'https://www.northwind-erp.com/erp-implementation/', run_page_check: true },
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
    input: { siteId: SITE_ID, country: 'United Arab Emirates', siteAudit: true, receiveReport: true, receiveContent: true },
    site,
    expect: { mode: 'discover', business: site.business, audience: site.customers, business_facts: site.businessFacts, include_audit: true, include_full_report: false, include_content: true, include_seo_report: true, keyword: '' },
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
    site,
    expect: { mode: 'audit', include_full_report: true, include_audit: true, crawl_max_pages: 500, crawl_js: true, competitors: ['rival.ae'] },
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
    name: 'track with monitors',
    mode: 'track',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', keywords: ['peppol uae', 'e invoicing software uae'], blogsPerWeek: 2, monitors: { aiEngines: ['chatgpt', 'perplexity'], aiPromptsMax: 10, auditPages: 500, backlinks: false } },
    site,
    expect: { mode: 'track', keyword: '', track_keywords: ['peppol uae', 'e invoicing software uae'], blogs_per_week: 2, ga4_property_id: '543096312', competitors: ['azentio.com', 'cleartax.com'], 'monitor_input.ai_engines': 'chatgpt, perplexity', 'monitor_input.ai_prompts_max': 10, 'monitor_input.audit_pages': 500, 'monitor_input.backlinks': false, 'monitor_input.ai_visibility': true, 'monitor_input.brand_names': 'Northwind, Northwind ERP' },
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
    },
    site,
    mail: false,
    expect: { mode: 'profile', email: '', 'profile_input.author_name': 'Sara Khan', 'profile_input.public_email': 'hello@northwind-erp.com', 'profile_input.city': 'Dubai', 'profile_input.country_code': 'AE', 'profile_input.reviewer_name': 'Omar Ali', 'profile_input.author_same_as': 'https://www.linkedin.com/in/sara-khan/', 'profile_input.service_areas': 'Dubai, Abu Dhabi' },
  },
  {
    name: 'ai visibility with topics',
    mode: 'ai_visibility',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', topics: ['e-invoicing implementation', 'Odoo ERP'] },
    site,
    expect: { mode: 'ai_visibility', competitors: ['azentio.com', 'cleartax.com'], topics: ['e-invoicing implementation', 'odoo erp'] },
  },
  {
    name: 'backlinks',
    mode: 'backlinks',
    input: { siteId: SITE_ID, country: 'United Arab Emirates', competitors: ['rival.ae'] },
    site,
    expect: { mode: 'backlinks', competitors: ['rival.ae'] },
  },
];

const fixtures = cases.map((c) => {
  const parsed = RUN_SCHEMAS[c.mode].safeParse({ mode: c.mode, ...c.input });
  if (!parsed.success) throw new Error(`${c.name}: ${JSON.stringify(parsed.error.issues)}`);
  const body = compactBody(buildN8nPayload(parsed.data as never, c.site, c.mail === false ? noMail : delivery));
  return { name: c.name, headers: { 'x-forwarded-for': 'app:7a1c2d3e-org' }, body, expect: c.expect };
});

writeFileSync(out, JSON.stringify(fixtures, null, 2) + '\n');
console.log(`wrote ${fixtures.length} platform request bodies to ${out}`);
