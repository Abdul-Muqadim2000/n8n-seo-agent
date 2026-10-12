import { afterEach, describe, expect, it } from 'vitest';
import { badHost, draftGate, quotesThem } from '@seo/shared';
import { clearMxCache, mxCheck, setMxLookup } from '../src/services/mail';

// L2 / L1 (system review of 2026-10-11): the gate every outreach e-mail passes before it is sent (mirrored in the engine's
// v5/code/_draft_qa.js, node "LB Draft QA"), and the MX check that stops a pitch to a domain with no mail server.

const ctx = { domain: 'techand.ai', canonicalHost: 'techand.ai', targetUrl: 'https://techand.ai/insights/peppol-accredited-service-providers-uae', brand: 'Tech&', brandKnown: true, competitors: ['rival-erp.example'] };
const them = {
  type: 'resource',
  to: 'editor@erpinsights.ae',
  prospectDomain: 'erpinsights.ae',
  pageUrl: 'https://www.erpinsights.ae/peppol-guide',
  pageTitle: 'A practical Peppol guide for UAE finance teams',
  evidence: 'Dead link on their page: "list of accredited Peppol providers"',
};
const good = [
  {
    subject: 'A dead link in your Peppol guide',
    body: 'Hello, your practical Peppol guide for UAE finance teams points to a list of accredited Peppol providers that now answers 404. We keep a current list here: https://techand.ai/insights/peppol-accredited-service-providers-uae. Would you like me to send a one-line description for it? Sara Khan, Head of Finance Systems, Tech&',
  },
  { subject: '', body: 'One more detail: the list names each provider next to the standard it supports. Happy to send it as plain text.' },
];
const ask = (o: Partial<typeof them> = {}, steps = good) => draftGate({ ...them, ...o, steps }, ctx);

describe('the draft gate (L2)', () => {
  it('a clean pitch passes', () => {
    const v = ask();
    expect(v.held).toEqual([]);
    expect(v.ok).toBe(true);
  });
  it('holds a draft with a placeholder nobody filled in', () => {
    const v = ask({}, [{ ...good[0]!, body: good[0]!.body.replace('We keep', 'We have [number] clients and keep') }, good[1]!]);
    expect(v.ok).toBe(false);
    expect(v.held.join(' ')).toMatch(/needs you: \[number\]/);
  });
  it('holds a claim the facts do not carry, and lets a claim the facts carry through', () => {
    const steps = [{ ...good[0]!, body: good[0]!.body.replace('We keep', 'We are an accredited provider and keep') }, good[1]!];
    expect(draftGate({ ...them, steps }, { ...ctx, facts: 'Business: Tech&, ERP and e-invoicing consultancy' }).held.join(' ')).toMatch(/needs your confirmation: "accredited"/);
    expect(draftGate({ ...them, steps }, { ...ctx, facts: 'Business: Tech&. Accreditation: accredited ASP since 2025' }).ok).toBe(true);
  });
  it('a claim word about their own page is not a claim about the business', () => {
    const steps = [{ ...good[0]!, body: good[0]!.body.replace('We keep', 'The list shows the date each provider was approved. We keep') }, good[1]!];
    expect(draftGate({ ...them, steps }, { ...ctx, facts: 'Business: Tech&, ERP and e-invoicing consultancy' }).ok).toBe(true);
  });
  it('holds an address that is not on the prospect\'s own domain', () => {
    expect(ask({ to: 'editor@someone-else.example' }).held.join(' ')).toMatch(/is not on erpinsights\.ae/);
  });
  it('holds a draft that quotes nothing from their page', () => {
    const v = ask({}, [{ subject: 'Quick question about your site', body: 'Hello, we publish a list of providers in the UAE: https://techand.ai/insights/peppol-accredited-service-providers-uae. Would you like a one-line description? Sara Khan, Tech&' }]);
    expect(v.held).toContain('the first e-mail quotes nothing that is on their page');
  });
  it('holds a competitor, a government site and a bare homepage', () => {
    expect(ask({ prospectDomain: 'rival-erp.example', to: 'editor@rival-erp.example' }).held.join(' ')).toMatch(/competing site of yours/);
    expect(ask({ prospectDomain: 'tax.gov.zz', to: 'info@tax.gov.zz' }).held.join(' ')).toMatch(/government site/);
    expect(ask({ pageUrl: 'https://www.erpinsights.ae/' }).held.join(' ')).toMatch(/only their homepage/);
    expect(ask({ prospectDomain: 'outlook.com', to: 'placeholder@outlook.com' }).held.join(' ')).toMatch(/mailbox provider/);
  });
  it('holds a wrong link, a second link and a link to someone else', () => {
    expect(ask({}, [{ ...good[0]!, body: good[0]!.body.replace(/https:\/\/techand\.ai\/insights\/[a-z-]+/, 'https://techand.ai/services/e-invoicing') }]).held.join(' ')).toMatch(/links to the page we chose/);
    expect(ask({}, [{ ...good[0]!, body: `${good[0]!.body} Also https://techand.ai/services/e-invoicing` }]).held.join(' ')).toMatch(/carries 2 links/);
    expect(ask({}, [{ ...good[0]!, body: good[0]!.body.replace(/https:\/\/techand\.ai\S+/, 'https://example.com/x.') }]).held.join(' ')).toMatch(/links to example\.com, not to your site/);
  });
  it('holds SEO jargon, AI talk, hype and a draft with no ask', () => {
    expect(ask({}, [{ ...good[0]!, body: `${good[0]!.body} A dofollow backlink would help our SEO.` }]).held.join(' ')).toMatch(/backlink/);
    expect(ask({}, [{ ...good[0]!, body: `${good[0]!.body} Your page is cited in AI answers.` }]).held.join(' ')).toMatch(/how we found them/);
    expect(ask({}, [{ ...good[0]!, body: good[0]!.body.replace('Would you like me to send a one-line description for it?', 'We are a world-class provider.') }]).held.join(' ')).toMatch(/hype|no clear ask/);
  });
  it('holds the domain label used as the business name, and the first e-mail over 120 words', () => {
    expect(ask({}, [{ ...good[0]!, body: good[0]!.body.replace('Tech&', 'techand') }]).held.join(' ')).toMatch(/writes the business name as "techand"/);
    const long = [{ ...good[0]!, body: `${good[0]!.body} ${'one more useful detail about the list '.repeat(20)}` }];
    expect(ask({}, long).held.join(' ')).toMatch(/words \(at most 120\)/);
  });
  it('a journalist answer may be longer, and a quote of their request counts', () => {
    const press = draftGate(
      { type: 'press', to: 'desk@gulffinance.ae', prospectDomain: 'gulffinance.ae', pageUrl: 'https://bsky.app/profile/gulffinance.bsky.social/post/3mfinreq1', pageTitle: 'Journalist request by Gulf Finance Desk', evidence: 'Looking for e-invoicing experts in the UAE to explain what the 2027 Peppol deadline means for SMEs and their ERP systems.',
        steps: [{ subject: 'Re: the 2027 Peppol deadline for UAE SMEs', body: `What the 2027 Peppol deadline means for SMEs and their ERP systems, in short: ${'invoices must leave the ERP in the Peppol format and reach the tax authority through an accredited access point. '.repeat(6)} Our notes are at https://techand.ai/insights/peppol-accredited-service-providers-uae. Sara Khan, Head of Finance Systems, Tech&` }] },
      ctx,
    );
    expect(press.held).toEqual([]);
  });
  it('known bad hosts and the quote helper', () => {
    expect(badHost('zoominfo.com')).toMatch(/contact \/ company database/);
    expect(badHost('amazonaws.com')).toMatch(/infrastructure/);
    expect(badHost('erpinsights.ae')).toBe('');
    expect(quotesThem('your practical Peppol guide helps', ['A practical Peppol guide for UAE finance teams'])).toBe('practical peppol guide');
  });
});

describe('the MX check before sending (L1)', () => {
  afterEach(() => { setMxLookup({ mx: async () => [], a: async () => [] }); clearMxCache(); });
  it('an address whose domain has a mail server passes', async () => {
    setMxLookup({ mx: async () => [{ exchange: 'aspmx.l.google.com', priority: 10 }], a: async () => [] });
    expect(await mxCheck('editor@erpinsights.ae')).toMatchObject({ ok: true, via: 'mx' });
  });
  it('a domain with no MX but an A record still takes mail', async () => {
    setMxLookup({ mx: async () => [], a: async () => ['203.0.113.9'] });
    expect(await mxCheck('editor@small-site.ae')).toMatchObject({ ok: true, via: 'a' });
  });
  it('a domain with neither is refused with the reason', async () => {
    setMxLookup({ mx: async () => [], a: async () => [] });
    const r = await mxCheck('editor@no-such-domain.example');
    expect(r.ok).toBe(false); expect(r.via).toBe('none'); expect(r.reason).toMatch(/has no mail server/);
  });
  it('a domain that does not exist is refused', async () => {
    setMxLookup({ mx: async () => { throw Object.assign(new Error('queryMx ENOTFOUND'), { code: 'ENOTFOUND' }); }, a: async () => [] });
    const r = await mxCheck('editor@gone.example');
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/ENOTFOUND/);
  });
  it('a lookup that fails for another reason never blocks a send', async () => {
    setMxLookup({ mx: async () => { throw Object.assign(new Error('queryMx ETIMEOUT'), { code: 'ETIMEOUT' }); }, a: async () => [] });
    const r = await mxCheck('editor@slow-dns.ae');
    expect(r.ok).toBe(true); expect(r.via).toBe('error');
  });
  it('a malformed address is refused without a lookup', async () => {
    let calls = 0;
    setMxLookup({ mx: async () => { calls++; return []; }, a: async () => [] });
    expect(await mxCheck('not-an-address')).toMatchObject({ ok: false, via: 'invalid' });
    expect(calls).toBe(0);
  });
  it('the answer is cached per domain', async () => {
    let calls = 0;
    setMxLookup({ mx: async () => { calls++; return [{ exchange: 'mx.erpdaily.ae', priority: 5 }]; }, a: async () => [] });
    await mxCheck('a@erpdaily.ae'); await mxCheck('b@erpdaily.ae');
    expect(calls).toBe(1);
  });
});
