import { describe, expect, it } from 'vitest';
import { brandInitials, brandLogoUrl, sharedBrand } from './brand';
import { shareCaveat } from './share';
import { deliveryDecision } from './report-delivery';

// B-R2, white-label-lite. Two rules a client-facing page depends on: a logo URL we are willing to render, and a brand that is never
// empty. Plus the caveat a shared report carries when the run that made it said it was not finished work.

describe('brandLogoUrl, https, a real host, and nothing that only matters inside markup', () => {
  it('takes an ordinary https logo, with a path, a query, a port or none of them', () => {
    for (const url of [
      'https://techand.ai/logo.png',
      'https://cdn.example.co.uk/brand/logo.svg?v=3',
      'https://example.com',
      'https://example.com:8443/logo.png',
      'HTTPS://Example.com/Logo.PNG',
    ])
      expect(brandLogoUrl(url)).toBe(url);
    expect(brandLogoUrl('  https://techand.ai/logo.png  ')).toBe('https://techand.ai/logo.png');
  });

  it('refuses anything that is not an https image URL on a public host', () => {
    for (const bad of [
      'http://techand.ai/logo.png', // mixed content on a live install
      '//techand.ai/logo.png',
      '/logo.png',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'javascript:alert(1)',
      'https://localhost/logo.png', // no dot: not a public host
      'https://127.0.0.1/logo.png', // an IP is not a brand's logo host, and is a request we will not make from a client's browser
      'https://user:pw@evil.example.com/logo.png', // credentials in an image URL are a phishing shape
      'https://evil.example.com@attacker.test/logo.png',
      'https://exa mple.com/logo.png',
      'https://example.com/logo.png" onerror="alert(1)',
      "https://example.com/'logo.png",
      'https://example.com/<script>',
      '',
      '   ',
    ])
      expect(brandLogoUrl(bad)).toBeNull();
  });

  it('never throws on whatever the profile row happened to hold, and refuses a URL too long to be one', () => {
    for (const v of [null, undefined, 42, {}, [], true]) expect(brandLogoUrl(v)).toBeNull();
    expect(brandLogoUrl('https://example.com/' + 'a'.repeat(600))).toBeNull();
  });
});

describe('the mark a client sees', () => {
  it('prefers the business name the company gave the engine, and falls back to the name it signed up with', () => {
    expect(sharedBrand({ orgName: 'Techand FZ-LLC', businessName: 'Techand', logoUrl: 'https://techand.ai/logo.png' })).toEqual({
      name: 'Techand',
      logoUrl: 'https://techand.ai/logo.png',
      initials: 'TE',
    });
    expect(sharedBrand({ orgName: 'Techand FZ-LLC', businessName: '   ' }).name).toBe('Techand FZ-LLC');
    expect(sharedBrand({ orgName: 'Northwind Trading', logoUrl: 'http://insecure.example.com/l.png' })).toEqual({
      name: 'Northwind Trading',
      logoUrl: null,
      initials: 'NT',
    });
  });

  it('is still a brand when the company has filled in nothing at all', () => {
    expect(sharedBrand({})).toEqual({ name: '', logoUrl: null, initials: '' });
    expect(sharedBrand({ orgName: null, businessName: undefined, logoUrl: undefined }).name).toBe('');
  });

  it('keeps a long name to a header line and collapses the whitespace in it', () => {
    const long = sharedBrand({ orgName: 'A'.repeat(400) });
    expect(long.name).toHaveLength(120);
    expect(sharedBrand({ orgName: ' Acme   Holdings \n Ltd ' }).name).toBe('Acme Holdings Ltd');
  });

  it('makes a monogram from any name, including one written in another script', () => {
    expect(brandInitials('Techand')).toBe('TE');
    expect(brandInitials('Northwind Trading Company')).toBe('NT');
    expect(brandInitials('  acme   holdings ')).toBe('AH');
    expect(brandInitials('3M')).toBe('3M');
    expect(brandInitials('شركة الإمارات')).toBe('شا');
    expect([brandInitials(''), brandInitials('—'), brandInitials(null)]).toEqual(['', '', '']);
  });
});

describe('shareCaveat, a shared report says what the run said about itself', () => {
  it('says nothing about a finished report', () => {
    expect(shareCaveat(deliveryDecision({ stage: 'site_audit', status: 'completed', payload: { health_score: 83 } }))).toBeNull();
  });

  it('warns that a page which failed its quality rounds is a draft, in the run\'s own words', () => {
    const c = shareCaveat(deliveryDecision({ stage: 'content', status: 'completed', payload: { qa_not_ready: true, qa_reasons: ['3 placeholders left'] } }));
    expect(c?.code).toBe('not_ready');
    expect(c?.title).toBe('A draft, not finished work');
    expect(c?.detail).toContain('3 placeholders left');
  });

  it('carries the other refusals a run can record', () => {
    expect(shareCaveat(deliveryDecision({ stage: 'ladder_plan', status: 'completed', payload: { planned: false, refusal: { reason: 'too few keywords' } } }))?.code).toBe('refused');
    expect(shareCaveat(deliveryDecision({ stage: 'keyword_verdict', status: 'completed', payload: { verdict: 'NOT_CHECKED' } }))?.code).toBe('unavailable');
    expect(shareCaveat(deliveryDecision({ stage: 'rejected', status: 'rejected', payload: { error: 'over budget' } }))?.code).toBe('rejected');
    expect(shareCaveat(deliveryDecision({ stage: 'ai_visibility_started', status: 'completed', payload: {} }))?.code).toBe('interim');
  });

  it('says nothing about the company\'s own delivery settings, they are not about this report', () => {
    for (const code of ['delivery_off', 'no_channel', 'stage_not_chosen', 'already_delivered', 'something_new'])
      expect(shareCaveat({ deliver: false, reason: 'x', code })).toBeNull();
  });
});
