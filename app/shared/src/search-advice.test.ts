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
