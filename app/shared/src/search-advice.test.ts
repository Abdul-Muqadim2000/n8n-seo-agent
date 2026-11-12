import { describe, expect, it } from 'vitest';
import { addressSearchLabel, searchAdviceFit, searchAdviceGate } from './search-advice';

// F-10 (prod review 2026-11-12): Recommendations advised another company's address search and the client's own brand search.
const site = {
  domain: 'zentrova.ae',
  brandNames: ['Zentrova Systems', 'Kestrel Labs'],
  competitors: ['rivalsoft.example'],
  services: ['ERP implementation', 'Microsoft Dynamics 365 Business Central'],
  chosen: ['erp software uae'],
};

describe('addressSearchLabel', () => {
  it('reads a search for a website by its address', () => {
    expect(addressSearchLabel('zylokey com')).toBe('zylokey');
    expect(addressSearchLabel('zylo com pk')).toBe('zylo');
    expect(addressSearchLabel('zylo co uk')).toBe('zylo');
    expect(addressSearchLabel('zylo.com')).toBe('zylo');
    expect(addressSearchLabel('www zylo')).toBe('zylo');
    expect(addressSearchLabel('https://www.zylo.ae/pricing')).toBe('zylo');
  });
  it('leaves subjects alone', () => {
    for (const q of ['erp software uae', 'asp net core', 'node.js developers dubai', 'what is .com domain', 'generative ai', 'erp implementation company'])
      expect(addressSearchLabel(q)).toBe('');
  });
});

describe('searchAdviceFit', () => {
  it('refuses another website by its address as navigational', () => {
    expect(searchAdviceFit('zylokey com', site)).toMatchObject({ ok: false, reason: 'navigational' });
  });
  it('refuses the website itself, by its domain label or by its address', () => {
    expect(searchAdviceFit('zentrova', site)).toMatchObject({ ok: false, reason: 'own brand' });
    expect(searchAdviceFit('zentrovakey com', site)).toMatchObject({ ok: false, reason: 'own brand' });
  });
  it("refuses the client's other brand names (their distinctive part)", () => {
    expect(searchAdviceFit('kestrel labs', site)).toMatchObject({ ok: false, reason: 'own brand' });
    expect(searchAdviceFit('kestrel erp reviews', site)).toMatchObject({ ok: false, reason: 'own brand' });
  });
  it('a descriptive brand name never refuses the subject it describes', () => {
    const descriptive = { ...site, domain: 'northpeak.ae', brandNames: ['ERP Experts'] };
    expect(searchAdviceFit('erp experts dubai', descriptive).ok).toBe(true);
  });
  it('refuses a declared competitor and a login task (the shared gate)', () => {
    expect(searchAdviceFit('rivalsoft pricing', site)).toMatchObject({ ok: false, reason: 'other brand' });
    expect(searchAdviceFit('acmecorp login', site)).toMatchObject({ ok: false, reason: 'portal' });
  });
  it('keeps the searches the website sells', () => {
    for (const q of ['erp implementation dubai', 'business central partner uae', 'best erp software uae']) expect(searchAdviceFit(q, site).ok).toBe(true);
  });
});

describe('searchAdviceGate', () => {
  it('judges each search once and keeps what it refused, with the reason', () => {
    const g = searchAdviceGate(site);
    expect(['zylokey com', 'erp implementation dubai', 'ZYLOKEY com'].filter(g.ok)).toEqual(['erp implementation dubai']);
    expect(g.refused.get('zylokey com')?.reason).toBe('navigational');
  });
});

// review S1 / S2 / S4 (2026-11-12): the brand and address rules must not hide ordinary searches
describe('review: no false refusals', () => {
  const plain = { domain: 'northpeak.ae', brandNames: [] as string[], services: [] as string[], chosen: [] as string[] };
  it('S2: ordinary searches that end in an address-like word pass', () => {
    for (const q of ['vat info', 'company info', 'contact info', 'business central info', 'non profit org', 'housing co op', 'erp com', 'socket.io developers', 'gen.ai tools', 'invoice.ai', 'zoho.in pricing', 'generative ai', 'asp net core', 'accounting software uk'])
      expect([q, searchAdviceFit(q, plain).ok]).toEqual([q, true]);
  });
  it('S2: "gen.ai course" is not an address (the gate may still call it a course search)', () => {
    expect(addressSearchLabel('gen.ai course')).toBe('');
  });
  it('S2: a short address search is still refused', () => {
    expect(searchAdviceFit('devassistant.ai', plain)).toMatchObject({ ok: false, reason: 'navigational' });
    expect(searchAdviceFit('zylokey com', plain)).toMatchObject({ ok: false, reason: 'navigational' });
    expect(searchAdviceFit('northpeakkey com', plain)).toMatchObject({ ok: false, reason: 'own brand' });
  });
  it('S1: a brand built from everyday words never refuses other searches with those words', () => {
    const cases: [string, string[]][] = [
      ['Blue Ocean Consulting', ['blue prism consultants dubai', 'bluetooth erp scanner']],
      ['Prime Systems', ['erp primer', 'amazon prime business']],
      ['Alpha Data', ['data alphabet']],
      ['Apex', ['oracle apex developers dubai', 'apex erp pricing']],
      ['Dynamics Square', ['dynamics 365 partner uae', 'microsoft dynamics ax dubai']],
    ];
    for (const [brand, qs] of cases) for (const q of qs) expect([brand, q, searchAdviceFit(q, { ...plain, brandNames: [brand] }).ok]).toEqual([brand, q, true]);
  });
  it('S1: the brand itself is still refused', () => {
    expect(searchAdviceFit('blue ocean consulting', { ...plain, brandNames: ['Blue Ocean Consulting'] })).toMatchObject({ ok: false, reason: 'own brand' });
    expect(searchAdviceFit('blue ocean dubai', { ...plain, brandNames: ['Blue Ocean Consulting'] })).toMatchObject({ ok: false, reason: 'own brand' });
    expect(searchAdviceFit('apex', { ...plain, brandNames: ['Apex'] })).toMatchObject({ ok: false, reason: 'own brand' });
    expect(searchAdviceFit('dynamics square reviews', { ...plain, brandNames: ['Dynamics Square'] })).toMatchObject({ ok: false, reason: 'own brand' });
  });
  it('S4: core searches of a partner pass even with short stored services (no topic bar)', () => {
    const partner = { ...plain, services: ['Microsoft Dynamics 365 consulting and im', 'GCC: Busines'], chosen: ['erp software uae'] };
    for (const q of ['business central uae', 'business central dubai', 'business central saas dubai', 'ax to supply chain upgrade', 'microsoft erp', '365 erp'])
      expect([q, searchAdviceFit(q, partner).ok]).toEqual([q, true]);
  });
});
