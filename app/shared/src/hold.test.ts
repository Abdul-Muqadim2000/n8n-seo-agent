// W0-D (page-quality 2026-10-29): a page held for the client's OK before writing, read from the stored callback, and its three buttons.
import { describe, expect, it } from 'vitest';
import { HOLD_RULE, HOLD_THRESHOLD, holdButtons, holdOf, holdTitle } from './hold';
import { buildN8nPayload } from './payload';
import { RUN_SCHEMAS } from './schemas';

// the callback of a held run, as the engine's Build Webhook Response sends it (harness W0D9; anonymised page run 3299)
const HELD = {
  stage: 'content', status: 'completed', keyword: 'ms 365 erp', verdict: 'GO_WITH_CHANGES', score: 42, markdown: null, html: null,
  hold: {
    score: 42, threshold: 50, kinds: ['score', 'duplicate'], mode: 'enforce', held: true,
    reasons: ['Our verdict scored "ms 365 erp" 42 out of 100, under the 50 we write without asking: Search volume is 10 a month.', 'Your website already has a page aimed at this search: https://www.novaand.example/dynamics-365-business-central-uae.'],
    alternatives: [
      { kind: 'improve', label: 'Improve the existing page', url: 'https://www.novaand.example/dynamics-365-business-central-uae', keyword: 'ms 365 erp', why: 'your website already has this page for the search' },
      { kind: 'retarget', label: 'Use the recommended target', keyword: 'Microsoft Dynamics 365 ERP implementation partner UAE', page_type: 'Service Page', why: 'the verdict recommends this search instead' },
      { kind: 'bogus', keyword: 'x' },
    ],
    duplicates: [{ url: 'https://www.novaand.example/dynamics-365-business-central-uae', title: 'Business Central ERP Solutions in UAE', keyword_words_shared_pct: 100 }],
    rule: 'A page waits for your OK when our verdict scores its keyword under 50 out of 100, or when your website already has a page for the same search.',
    next: 'Nothing was written and only the check was charged.',
  },
  hold_shadow: null,
  verdict_acknowledged: false,
};

describe('a held page, read from its report', () => {
  it('reads the hold: held, the score, both reasons, the alternatives it knows (an unknown kind is dropped)', () => {
    const h = holdOf(HELD)!;
    expect(h.held).toBe(true);
    expect(h.score).toBe(42);
    expect(h.threshold).toBe(HOLD_THRESHOLD);
    expect(h.kinds).toEqual(['score', 'duplicate']);
    expect(h.reasons).toHaveLength(2);
    expect(h.alternatives.map((a) => a.kind)).toEqual(['improve', 'retarget']);
    expect(h.duplicates[0].title).toBe('Business Central ERP Solutions in UAE');
  });
  it('a trial (shadow) hold on a page the autopilot wrote is not held', () => {
    const h = holdOf({ hold: null, hold_shadow: { ...HELD.hold, mode: 'shadow', held: false } })!;
    expect(h.held).toBe(false);
    expect(h.kinds).toEqual(['score', 'duplicate']);
  });
  it('an ordinary page, a verdict, an older report: no hold', () => {
    expect(holdOf({ stage: 'content', html: '<h1>x</h1>' })).toBeNull();
    expect(holdOf({ hold: {}, hold_shadow: {} })).toBeNull();
    expect(holdOf(null)).toBeNull();
  });
  it('the title says what the client decides, in plain words', () => {
    expect(holdTitle('ms 365 erp', holdOf(HELD)!)).toBe('Needs your OK: "ms 365 erp" scored 42');
    expect(holdTitle('crm data migration', { score: 70, kinds: ['duplicate'] })).toBe('Needs your OK: your website already has a page for "crm data migration"');
  });
});

describe('the three ways forward', () => {
  const h = holdOf(HELD)!;
  const b = holdButtons(h, { keyword: 'ms 365 erp', pageType: 'Service Page', country: 'United Arab Emirates' });
  it('improve the existing page first, then the recommended target, then "Write it anyway"', () => {
    expect(b.map((x) => x.id)).toEqual(['improve', 'retarget', 'write_anyway']);
    expect(b.map((x) => x.label)).toEqual(['Improve the existing page', 'Use the recommended target', 'Write it anyway']);
  });
  it('each opens the Write a page form ready to start', () => {
    expect(b[0].prefill).toEqual({ keyword: 'ms 365 erp', existingPageUrl: 'https://www.novaand.example/dynamics-365-business-central-uae', country: 'United Arab Emirates', pageType: 'Service Page' });
    expect(b[1].prefill).toEqual({ keyword: 'Microsoft Dynamics 365 ERP implementation partner UAE', country: 'United Arab Emirates', pageType: 'Service Page' });
    expect(b[2].prefill).toEqual({ keyword: 'ms 365 erp', country: 'United Arab Emirates', pageType: 'Service Page', holdAck: { score: 42 } });
  });
  it('"Write it anyway" sends hold_ack to the engine, and an ordinary run sends none', () => {
    const SITE = '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
    const site = { domain: 'novaand.example', country: 'United Arab Emirates', business: 'Dynamics 365 partner', customers: 'CFOs', goal: 'leads', tone: 'Plain', cta: 'Talk to us', businessFacts: '', competitors: [], brandNames: [], ga4PropertyId: '' };
    const d = { callbackUrl: 'https://app.test/api/hooks/n8n/x', email: '' };
    const anyway = RUN_SCHEMAS.keyword.parse({ mode: 'keyword', siteId: SITE, ...b[2].prefill });
    const body = buildN8nPayload(anyway, site, d);
    expect(body.hold_ack).toEqual({ score: 42 });
    const keys = Object.keys(body);
    expect(keys.indexOf('hold_ack')).toBeGreaterThan(keys.indexOf('customers'));   // after the fuzzy-matched head
    const plain = buildN8nPayload(RUN_SCHEMAS.keyword.parse({ mode: 'keyword', siteId: SITE, keyword: 'ms 365 erp', country: 'United Arab Emirates' }), site, d);
    expect('hold_ack' in plain).toBe(false);
  });
  it('a score outside 0-100 is refused by the form schema', () => {
    expect(RUN_SCHEMAS.keyword.safeParse({ mode: 'keyword', keyword: 'x y', country: 'United Arab Emirates', holdAck: { score: 101 } }).success).toBe(false);
    expect(RUN_SCHEMAS.keyword.safeParse({ mode: 'keyword', keyword: 'x y', country: 'United Arab Emirates', holdAck: { score: null } }).success).toBe(true);
  });
});

describe('copy rules', () => {
  it('the rule and the button words have no em dashes, curly quotes or "..."', () => {
    const h = holdOf(HELD)!;
    const words = [HOLD_RULE, ...holdButtons(h, { keyword: 'k' }).flatMap((x) => [x.label, x.why]), holdTitle('k', h)].join(' ');
    expect(words).not.toMatch(/[–—‘’“”…]|\.\.\./);
    expect(HOLD_RULE).toMatch(/under 50/);
  });
});

describe('W05-B (2026-10-30): the page the website has and the page Google shows', () => {
  const K1 = {
    ...HELD,
    hold: {
      ...HELD.hold,
      score: 52,
      kinds: ['duplicate'],
      alternatives: [
        { kind: 'improve', label: 'Improve the existing page', url: 'https://www.novaand.example/ms-365-erp-uae', keyword: 'ms 365 erp', why: 'your website already has this page for the search' },
        { kind: 'improve', label: 'Improve the page Google shows', url: 'https://www.novaand.example/insights/is-microsoft-dynamics-365-an-erp-system', keyword: 'ms 365 erp', why: 'Google already shows this page for the search (40 impressions in Search Console)' },
      ],
    },
  };
  it('two improve choices keep their own labels and addresses; "Write it anyway" says a separate page is written', () => {
    const b = holdButtons(holdOf(K1)!, { keyword: 'ms 365 erp' });
    expect(b.map((x) => x.label)).toEqual(['Improve the existing page', 'Improve the page Google shows', 'Write it anyway']);
    expect(b.map((x) => x.prefill.existingPageUrl)).toEqual(['https://www.novaand.example/ms-365-erp-uae', 'https://www.novaand.example/insights/is-microsoft-dynamics-365-an-erp-system', undefined]);
    expect(b[2].why).toMatch(/separate new page/);
  });
  it('the rule names both lines in plain words', () => {
    expect(HOLD_RULE).toMatch(/under 40 out of 100, or under 50 when few people search for it/);
  });
});
