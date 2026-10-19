import { describe, expect, it } from 'vitest';
import type { ProfileRow } from '@seo/shared';
import { profileFacts, replyReadBody } from '../src/services/replyFacts';
import type { MailboxRow, OutreachSequenceRow, SiteRow } from '../src/db/schema';

// D14 (fix plan 2026-10-11): the Reply Reader call carries the owner's business facts and the business profile with every reply
const site = { domain: 'techand.ai', business: 'Techand Systems: ERP and e-invoicing consultancy in Dubai', businessFacts: 'Accredited e-invoicing service provider (ASP) with the UAE Ministry of Finance. Microsoft Dynamics 365 partner.' } as SiteRow;
const mb = { fromName: 'Sara Khan', signatureName: 'Sara Khan', signatureTitle: 'Head of Finance Systems', company: 'Techand Systems' } as MailboxRow;
const seq = { prospectDomain: 'consultsynergy.ae', pageUrl: 'https://consultsynergy.ae/resources', steps: [{ step: 0, waitDays: 0, subject: 'A UAE e-invoicing guide for your readers', body: 'Hello ...' }] } as OutreachSequenceRow;
const profile = { site_id: 's', domain: 'techand.ai', business_name: 'Techand Systems', business_type: 'ERP and e-invoicing consultancy', author_name: 'Sara Khan', author_job_title: 'Head of Finance Systems', author_credentials: 'FCCA', author_bio: 'a long bio that is not a fact line', reviewer_name: 'Omar Haddad', reviewer_job_title: 'Peppol specialist', street_address: 'Office 1204, Bay Square', city: 'Dubai', region: '', postal_code: '', country_code: 'AE', phone: '+971 4 000 0000', public_email: 'hello@techand.ai', service_areas: 'UAE, KSA', logo_url: 'https://techand.ai/logo.png' } as unknown as ProfileRow;
const now = new Date('2026-10-11T10:00:00Z');

describe('the Reply Reader call (D14)', () => {
  it('sends the business facts in both fields and the profile facts, next to the reply and our e-mail', () => {
    const b = replyReadBody({ site, profile, mailbox: mb, sequence: seq, ourSubject: 'A UAE e-invoicing guide for your readers', ourBody: 'Hello ...', from: 'editor@consultsynergy.ae', subject: 'Re: A UAE e-invoicing guide for your readers', text: 'Are you accredited with the Ministry of Finance?', now });
    expect(b.facts).toBe(site.businessFacts); expect(b.business_facts).toBe(site.businessFacts);
    expect(b.profile).toEqual({ business_name: 'Techand Systems', business_type: 'ERP and e-invoicing consultancy', author_name: 'Sara Khan', author_job_title: 'Head of Finance Systems', author_credentials: 'FCCA', reviewer_name: 'Omar Haddad', reviewer_job_title: 'Peppol specialist', street_address: 'Office 1204, Bay Square', city: 'Dubai', country_code: 'AE', phone: '+971 4 000 0000', public_email: 'hello@techand.ai', service_areas: 'UAE, KSA' });
    expect(b.signer).toBe('Sara Khan, Head of Finance Systems, Techand Systems'); expect(b.domain).toBe('techand.ai'); expect(b.prospect_domain).toBe('consultsynergy.ae'); expect(b.page_url).toBe(seq.pageUrl);
    expect(b.our_subject).toBe('A UAE e-invoicing guide for your readers'); expect(b.reply_text).toBe('Are you accredited with the Ministry of Finance?'); expect(b.received_at).toBe('2026-10-11T10:00:00.000Z');
  });
  it('with no profile and no facts on file the fields are still present (the Reply Reader shows "none on file")', () => {
    const b = replyReadBody({ site: { ...site, business: '', businessFacts: '' }, profile: null, mailbox: { ...mb, signatureName: '', signatureTitle: '', company: '' } as MailboxRow, sequence: seq, ourSubject: '', ourBody: '', from: 'a@b.ae', subject: 's', text: 't', now });
    expect(b.facts).toBe(''); expect(b.business_facts).toBe(''); expect(b.profile).toEqual({}); expect(b.business).toBe('techand.ai'); expect(b.signer).toBe('Sara Khan');
  });
  it('profile facts: only the fact fields, trimmed, empty ones left out, the bio and the logo never sent', () => {
    expect(profileFacts({ ...profile, city: '  Dubai  ', phone: '' } as ProfileRow)).toMatchObject({ city: 'Dubai' });
    expect(profileFacts({ ...profile, phone: '' } as ProfileRow)).not.toHaveProperty('phone');
    expect(profileFacts(profile)).not.toHaveProperty('author_bio'); expect(profileFacts(profile)).not.toHaveProperty('logo_url');
    expect(profileFacts(null)).toEqual({});
  });
});
