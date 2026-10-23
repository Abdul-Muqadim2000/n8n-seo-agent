import { describe, expect, it } from 'vitest';
import { estimateMonitoringCost, MODE_IDS, MONITOR_COSTS } from './constants';
import { cleanDomain, domainOk, n8nSiteId, parseDomainList, urlOnDomain } from './domain';
import { buildN8nPayload, type SiteContext } from './payload';
import { auditInput, createSiteSchema, keywordInput, parseRunInput, RUN_SCHEMAS } from './schemas';

const SITE_ID = '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const site: SiteContext = {
  domain: 'northwind-erp.com',
  country: 'United Arab Emirates',
  business: 'ERP for distributors',
  customers: 'distributors',
  goal: 'leads',
  tone: 'Professional and direct',
  cta: 'Book a call',
  businessFacts: '12 years in the UAE',
  competitors: ['azentio.com'],
  brandNames: ['Northwind'],
  ga4PropertyId: '123',
};
const delivery = { callbackUrl: 'https://app.example.com/api/hooks/n8n/tok', email: 'owner@northwind-erp.com' };

const minimal: Record<string, Record<string, unknown>> = {
  verdict: { keyword: 'erp dubai', country: 'United Arab Emirates' },
  keyword: { keyword: 'erp dubai', country: 'United Arab Emirates' },
  discover: { country: 'United Arab Emirates', business: 'ERP' },
  describe: {},
  audit: { country: 'United Arab Emirates' },
  ladder: { keyword: 'erp dubai', country: 'United Arab Emirates' },
  track: { country: 'United Arab Emirates' },
  published: { keyword: 'erp dubai', publishedUrl: 'https://northwind-erp.com/erp-dubai/' },
  checkin: {},
  case_study: { country: 'United Arab Emirates', service: 'ERP', clientName: 'a distributor', challenge: 'slow close', solution: 'odoo rollout', results: '9 days to 3' },
  profile: { author: { name: 'Sara Khan' }, publicEmail: 'hello@northwind-erp.com' },
  ai_visibility: { country: 'United Arab Emirates' },
  backlinks: { country: 'United Arab Emirates' },
};

describe('buildN8nPayload', () => {
  it.each(MODE_IDS)('%s: the fuzzy-matched keys come first, in order', (mode) => {
    const parsed = RUN_SCHEMAS[mode].parse({ mode, siteId: SITE_ID, ...minimal[mode] });
    const body = buildN8nPayload(parsed as never, site, delivery);
    expect(Object.keys(body).slice(0, 8)).toEqual(['mode', 'keyword', 'country', 'domain', 'email', 'callback_url', 'business', 'customers']);
    expect(body.domain).toBe('northwind-erp.com');
    expect(body.callback_url).toBe(delivery.callbackUrl);
  });

  it('profile: the public e-mail never comes before the delivery e-mail', () => {
    const p = RUN_SCHEMAS.profile.parse({ mode: 'profile', siteId: SITE_ID, ...minimal.profile });
    const keys = Object.keys(buildN8nPayload(p, site, { ...delivery, email: '' }));
    expect(keys.indexOf('email')).toBeLessThan(keys.indexOf('public_email'));
  });

  // G31: the style guide travels with the profile, and a style guide on its own is a valid profile submission
  it('profile: the style guide is sent with the profile and defaults to empty', () => {
    const empty = RUN_SCHEMAS.profile.parse({ mode: 'profile', siteId: SITE_ID, ...minimal.profile });
    expect(empty.style).toEqual({ brandForm: '', brandWrong: [], spelling: '', avoid: [], tone: '', notes: '' });
    const p = RUN_SCHEMAS.profile.parse({
      mode: 'profile',
      siteId: SITE_ID,
      style: { brandForm: 'Tech&', brandWrong: ['Tech & Co'], spelling: 'British English', avoid: ['turnkey'], tone: 'plain and direct' },
    });
    const b = buildN8nPayload(p, site, delivery);
    expect(b.style).toEqual({ brand_form: 'Tech&', brand_wrong: ['Tech & Co'], spelling: 'British English', avoid: ['turnkey'], tone: 'plain and direct', notes: '' });
  });

  it('profile: an unknown spelling variant is refused, and an empty profile is still refused', () => {
    expect(RUN_SCHEMAS.profile.safeParse({ mode: 'profile', siteId: SITE_ID, style: { spelling: 'Canadian English' } }).success).toBe(false);
    expect(RUN_SCHEMAS.profile.safeParse({ mode: 'profile', siteId: SITE_ID }).success).toBe(false);
  });

  it('keyword: deliverables, goal label and site facts', () => {
    const p = keywordInput.parse({ mode: 'keyword', siteId: SITE_ID, keyword: 'ERP  Dubai', country: 'United Arab Emirates', goal: 'traffic', receiveReport: false, checkPageExists: true });
    const b = buildN8nPayload(p, site, delivery);
    expect(b.keyword).toBe('erp dubai');
    expect(b.receive).toEqual(['Page Content']);
    expect(b.goal).toBe('Rank and educate (traffic)');
    expect(b.business_facts).toBe(site.businessFacts);
    expect(b.features).toEqual(['Check if page exists']);
  });

  it('keyword: "What you sell" typed without a website, else the site description', () => {
    const typed = keywordInput.parse({ mode: 'keyword', siteId: null, keyword: 'odoo partner dubai', country: 'United Arab Emirates', business: ' ERP consultancy for distributors ', businessFacts: '40 rollouts' });
    const b = buildN8nPayload(typed, null, delivery);
    expect(b.business).toBe('ERP consultancy for distributors');
    expect(b.domain).toBe('');
    expect(Object.keys(b).indexOf('business')).toBeLessThan(Object.keys(b).indexOf('business_facts'));
    const fromSite = keywordInput.parse({ mode: 'keyword', siteId: SITE_ID, keyword: 'odoo partner dubai', country: 'United Arab Emirates' });
    expect(fromSite.business).toBe('');
    expect(buildN8nPayload(fromSite, site, delivery).business).toBe(site.business);
    expect(buildN8nPayload(fromSite, null, delivery).business).toBe('');
    expect(keywordInput.safeParse({ ...fromSite, business: 'x'.repeat(501) }).success).toBe(false);
  });

  // D2 (paid pre-launch run 2026-10-21): the setup research ran before Track my site stored the services on the engine's site row, and
  // its body carried none, so the research could not tell which keywords were what the client sells
  it('discover: what the website sells travels as `services` (at most 30), after the fuzzy-matched keys; none listed, no key', () => {
    const d = RUN_SCHEMAS.discover.parse({ mode: 'discover', siteId: SITE_ID, country: 'United Arab Emirates' });
    const body = buildN8nPayload(d, { ...site, services: ['CRM implementation'] }, delivery);
    expect(body.services).toEqual(['CRM implementation']);
    const keys = Object.keys(body);
    expect(keys.indexOf('services')).toBeGreaterThan(keys.indexOf('business_facts'));
    const many = Array.from({ length: 35 }, (_, i) => `Service ${i + 1}`);
    expect(buildN8nPayload(d, { ...site, services: many }, delivery).services).toEqual(many.slice(0, 30));
    expect('services' in buildN8nPayload(d, site, delivery)).toBe(false);
    expect('services' in buildN8nPayload(d, { ...site, services: [] }, delivery)).toBe(false);
    expect('services' in buildN8nPayload(RUN_SCHEMAS.discover.parse({ mode: 'discover', siteId: null, country: 'United Arab Emirates', business: 'ERP' }), null, delivery)).toBe(false);
  });

  // RV-13 (2026-10-21): the full report's keyword suggestions had another company's brand and off-topic terms: it knew nothing the site sells
  it('audit / full report: what the website sells travels as `services` (at most 30); none listed, no key', () => {
    const a = auditInput.parse({ mode: 'audit', siteId: SITE_ID, country: 'United Arab Emirates', reportType: 'full' });
    const body = buildN8nPayload(a, { ...site, services: ['ERP implementation', 'Odoo support'] }, delivery);
    expect(body.services).toEqual(['ERP implementation', 'Odoo support']);
    const keys = Object.keys(body);
    expect(keys.indexOf('services')).toBeGreaterThan(keys.indexOf('customers'));
    const many = Array.from({ length: 31 }, (_, i) => `Service ${i + 1}`);
    expect(buildN8nPayload(a, { ...site, services: many }, delivery).services).toHaveLength(30);
    expect('services' in buildN8nPayload(a, site, delivery)).toBe(false);
  });

  it('audit: site competitors when none are given; full report label', () => {
    const p = auditInput.parse({ mode: 'audit', siteId: SITE_ID, country: 'United Arab Emirates', reportType: 'full' });
    const b = buildN8nPayload(p, site, delivery);
    expect(b.report_type).toBe('Full SEO Report');
    expect(b.competitors).toEqual(['azentio.com']);
  });
});

describe('schemas', () => {
  it('rejects a local page without an area', () => {
    const r = keywordInput.safeParse({ mode: 'keyword', siteId: SITE_ID, keyword: 'odoo partner', country: 'United Arab Emirates', pageType: 'Local Page' });
    expect(r.success).toBe(false);
  });
  it('accepts a local page whose keyword names the area', () => {
    const r = keywordInput.safeParse({ mode: 'keyword', siteId: SITE_ID, keyword: 'odoo partner in dubai marina', country: 'United Arab Emirates', pageType: 'Local Page' });
    expect(r.success).toBe(true);
  });
  it('limits JavaScript crawls to 500 pages', () => {
    expect(auditInput.safeParse({ mode: 'audit', siteId: SITE_ID, country: 'United Arab Emirates', crawlPages: 1000, crawlJs: true }).success).toBe(false);
  });
  it('cleans the domain and refuses internal hosts', () => {
    expect(createSiteSchema.parse({ domain: 'https://www.Northwind-ERP.com/about', country: 'Germany' }).domain).toBe('northwind-erp.com');
    expect(createSiteSchema.safeParse({ domain: 'intranet.corp', country: 'Germany' }).success).toBe(false);
  });
  it('parseRunInput reports an unknown mode', () => {
    const r = parseRunInput({ mode: 'nope' });
    expect(r.success).toBe(false);
  });
});

describe('domain helpers', () => {
  it('matches the n8n site id and host rules', () => {
    expect(n8nSiteId('www.techand.ai')).toBe('site_techand-ai');
    expect(cleanDomain('HTTP://www.example.co.uk:8080/x')).toBe('example.co.uk');
    expect(domainOk('192.168.1.1')).toBe(false);
    expect(urlOnDomain('https://www.techand.ai/blog/', 'techand.ai')).toBe(true);
    expect(urlOnDomain('https://evil.com/techand.ai', 'techand.ai')).toBe(false);
    expect(parseDomainList('a.com, https://www.b.com/x, a.com, localhost', 3)).toEqual(['a.com', 'b.com']);
  });
});

describe('estimateMonitoringCost', () => {
  it('adds blog posts per week to the monitors', () => {
    const base = estimateMonitoringCost({ aiVisibility: false, backlinks: false, auditMonthly: false, blogsPerWeek: 0 });
    const withPosts = estimateMonitoringCost({ aiVisibility: false, backlinks: false, auditMonthly: false, blogsPerWeek: 1 });
    expect(withPosts - base).toBeCloseTo(4.33 * MONITOR_COSTS.blogPostEach, 1);   // B-R3: the one cost table, not a repeated price
  });
});

describe('ladder preferences (app only)', () => {
  it('are accepted by the ladder schema and never reach the n8n body', () => {
    const p = RUN_SCHEMAS.ladder.parse({ mode: 'ladder', siteId: SITE_ID, keyword: 'e invoicing in uae', country: 'United Arab Emirates', pagesNow: 2, ladderPrefs: { mode: 'manual', first: true } });
    expect(p.ladderPrefs).toEqual({ mode: 'manual', first: true });
    const body = buildN8nPayload(p, site, delivery);
    const json = JSON.stringify(body);
    expect(Object.keys(body)).not.toContain('ladderPrefs');
    expect(Object.keys(body)).not.toContain('ladder_prefs');
    expect(json).not.toMatch(/prefs|"first"|manual/i);
    expect(body.pages_now).toBe(2);
  });
  it('reject unknown modes; an empty object is fine', () => {
    expect(RUN_SCHEMAS.ladder.safeParse({ mode: 'ladder', siteId: SITE_ID, keyword: 'erp dubai', country: 'Germany', ladderPrefs: { mode: 'sometimes' } }).success).toBe(false);
    expect(RUN_SCHEMAS.ladder.parse({ mode: 'ladder', siteId: SITE_ID, keyword: 'erp dubai', country: 'Germany', ladderPrefs: {} }).ladderPrefs).toEqual({});
  });
});

// 2026-10-23 (techand.ai on production): "I published this page" from a draft's own report carries the engine request id that wrote it
describe('published: the draft it reports', () => {
  const base = { mode: 'published', siteId: SITE_ID, keyword: 'erp dubai', publishedUrl: 'https://northwind-erp.com/erp-dubai/' };
  it('sends content_request_id after the fuzzy-matched head, only when given', () => {
    const withId = buildN8nPayload(RUN_SCHEMAS.published.parse({ ...base, contentRequestId: '4127' }), site, delivery) as Record<string, unknown>;
    expect(withId.content_request_id).toBe('4127');
    const keys = Object.keys(withId);
    expect(keys.indexOf('content_request_id')).toBeGreaterThan(keys.indexOf('published_url'));
    expect(buildN8nPayload(RUN_SCHEMAS.published.parse(base), site, delivery)).not.toHaveProperty('content_request_id');
  });
  it('accepts engine ids (digits, cadence / ladder keys) and refuses anything else', () => {
    expect(RUN_SCHEMAS.published.safeParse({ ...base, contentRequestId: 'cadence:site_northwind-erp-com:2026-10-19' }).success).toBe(true);
    expect(RUN_SCHEMAS.published.safeParse({ ...base, contentRequestId: 'a b' }).success).toBe(false);
    expect(RUN_SCHEMAS.published.safeParse({ ...base, contentRequestId: '<x>' }).success).toBe(false);
    expect(RUN_SCHEMAS.published.parse(base).contentRequestId).toBe('');
  });
});
