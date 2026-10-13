import { describe, expect, it } from 'vitest';
import { digestOpen, digestProspect, isDigestEmail, parseDigest } from './digest';

// L5 (FIX_PLAN): journalist digests read from the customer's own mailbox. The sample below is the shape HARO and Source of Sources send
// (two requests, labelled lines, an anonymised reply address per request), saved here so the parser is tested without a mailbox.
const NOW = new Date('2026-10-13T08:00:00Z');
const SAMPLE = [
  'SOURCE OF SOURCES — Daily digest for Monday 13 October 2026',
  '',
  'Did someone forward this to you? Sign up for free.',
  '',
  '1) Summary: UAE e-invoicing specialist for a Peppol feature',
  'Name: Dana Reyes',
  'Category: Business and Finance',
  'Email: query-8f21@email.sosresponse.com',
  'Media Outlet: Gulf Business (https://gulfbusiness.com/)',
  'Deadline: 7:00 PM GST - 20 October',
  'Query: Looking for a UAE-based e-invoicing specialist to explain what the Peppol five-corner model means',
  'for mid-sized companies and their ERP systems. Please include your name, title and company.',
  'Requirements: UAE-based practitioners only, no vendors pitching software.',
  '',
  '2) Summary: Dog nutritionists on grain-free diets',
  'Name: Sam Ortiz',
  'Category: Lifestyle',
  'Email: query-9a01@email.sosresponse.com',
  'Media Outlet: Pet Food Weekly',
  'Deadline: 12:00 PM ET - 9 October',
  'Query: Seeking dog nutritionists to comment on grain-free diets for a feature on puppy feeding.',
  '',
  '3) Summary: a block with no address at all',
  'Media Outlet: Nowhere Times',
  'Query: Anything.',
  '',
  'To stop receiving these e-mails, unsubscribe here: https://www.sosresponse.com/unsubscribe',
].join('\n');

describe('journalist digests (L5)', () => {
  it('recognises a digest by its sender, and by its subject when the sender is unusual', () => {
    expect(isDigestEmail('noreply@email.sosresponse.com', 'Source of Sources — 13 Oct')).toBe(true);
    expect(isDigestEmail('haro@helpareporter.com', 'HARO: Morning edition')).toBe(true);
    expect(isDigestEmail('digest@mail.example.com', '[HARO] Daily queries — morning')).toBe(true);
    expect(isDigestEmail('editor@gulfbusiness.com', 'Re: your e-invoicing guide')).toBe(false);
  });

  it('reads every request with its outlet, deadline and reply address, and skips a block with no address', () => {
    const rs = parseDigest(SAMPLE, NOW);
    expect(rs.length).toBe(2);
    expect(rs[0]).toMatchObject({ id: '8f21', outlet: 'Gulf Business', email: 'query-8f21@email.sosresponse.com', deadline: '2026-10-20', domain: 'gulfbusiness.com' });
    expect(rs[0]!.query).toContain('Peppol five-corner model');
    expect(rs[0]!.query).toContain('their ERP systems');   // the query runs over several lines, up to the next label
    expect(rs[0]!.requirements).toContain('no vendors pitching software');
    expect(rs[0]!.summary).toBe('UAE e-invoicing specialist for a Peppol feature');
    expect(rs[1]).toMatchObject({ outlet: 'Pet Food Weekly', deadline: '2026-10-09', domain: '' });
  });

  it('a request whose deadline has passed is not offered, and the digest service is never taken for the outlet', () => {
    const rs = parseDigest(SAMPLE, NOW);
    expect(digestOpen(rs[0]!, NOW)).toBe(true);
    expect(digestOpen(rs[1]!, NOW)).toBe(false);
    expect(rs.every((r) => !/sosresponse|helpareporter/.test(r.domain))).toBe(true);
  });

  it('nothing is invented from an e-mail that is not a digest', () => {
    expect(parseDigest('Hello, thanks for your note — happy to add the link next week. Best, Layla', NOW)).toEqual([]);
    expect(parseDigest('', NOW)).toEqual([]);
  });

  it('the prospect row the engine reads: the request as its evidence, the deadline in the note, the reply address as the contact', () => {
    const [r] = parseDigest(SAMPLE, NOW);
    const row = digestProspect(r!, { siteId: 'site_techand-ai', domain: 'techand.ai', service: 'Source of Sources', now: NOW });
    expect(row).toMatchObject({ site_id: 'site_techand-ai', domain: 'techand.ai', prospect_domain: 'gulfbusiness.com', type: 'digest', status: 'new', origin: 'digest', contact_email: 'query-8f21@email.sosresponse.com' });
    expect(String(row.detail)).toContain('Peppol five-corner model');
    expect(String(row.note)).toContain('deadline 2026-10-20');
    expect(row.outreach_body).toBe('');   // nothing is drafted here: the engine writes the answer and the draft gate checks it
  });

  it('an anonymised request (no outlet website) is keyed by the service and the query id, so two requests never collide', () => {
    const anon = parseDigest(SAMPLE, NOW)[1]!;
    const row = digestProspect(anon, { siteId: 's', domain: 'techand.ai', service: 'HARO', now: NOW });
    expect(row.prospect_domain).toBe('HARO/9a01');
    expect(row.source_url).toBe('');
  });
});
