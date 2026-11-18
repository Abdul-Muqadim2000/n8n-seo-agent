// FX-LINKS (review R2 M2 / M5, 2026-11-18): "they linked" said by a person is CLAIMED until our check finds the link; it is shown as such on
// every screen (one status model), never counted as won and never silently reverted; our check then makes it won. Synthetic rows.
import { describe, expect, it } from 'vitest';
import { linkStates, linkStatusCounts, prospectLinkState, type LinkStatusProspect, type LinkStatusSequence } from './link-status';
import { manualConsentGate, OPEN_SEQUENCE_STATUSES, SEQUENCE_LABEL } from './outreach';

const P = (p: Partial<LinkStatusProspect>): LinkStatusProspect => ({ prospect_domain: 'partner.example', type: 'resource', status: 'new', contacted_at: '', won_at: '', verified_at: '', ...p });
const Q = (q: Partial<LinkStatusSequence>): LinkStatusSequence => ({ prospectDomain: 'partner.example', type: 'resource', status: 'active', startedAt: '2026-11-03T09:00:00.000Z', approvedAt: '2026-11-03T09:00:00.000Z', replyAt: null, replyClass: null, wonAt: null, ...q });

describe('claimed links (FX-LINKS M2 / M5)', () => {
  it('a Won set by a person (contacted, not checked yet) is claimed, never won and never "found"', () => {
    expect(prospectLinkState(P({ status: 'won', contacted_at: '2026-11-12T00:00:00.000Z', won_at: '2026-11-12T00:00:00.000Z' }))).toBe('claimed');
    const rows = linkStates({ prospects: [P({ status: 'won', contacted_at: '2026-11-12T00:00:00.000Z', won_at: '2026-11-12T00:00:00.000Z' })] });
    expect(rows[0]!.state).toBe('claimed');
    const c = linkStatusCounts(rows);
    expect(c.claimed).toBe(1);
    expect(c.won).toBe(0);
  });
  it('a "Mark won" conversation is claimed until our check confirms the link, then won', () => {
    const seq = Q({ status: 'claimed', replyClass: 'says_linked' });
    expect(linkStates({ prospects: [P({ status: 'replied', contacted_at: '2026-11-03T09:00:00.000Z' })], sequences: [seq] })[0]!.state).toBe('claimed');
    const won = linkStates({ prospects: [P({ status: 'won', contacted_at: '2026-11-03T09:00:00.000Z', won_at: '2026-11-17T00:00:00.000Z', verified_at: '2026-11-17T00:00:00.000Z' })], sequences: [seq] });
    expect(won[0]!.state).toBe('won');
    expect(linkStatusCounts(won, { month: '2026-11' }).wonThisMonth).toBe(1);
  });
  it('a won nobody wrote to is still never a result (domain collision), with or without a check', () => {
    expect(prospectLinkState(P({ status: 'won', won_at: '2026-11-06T00:00:00.000Z' }))).toBe('found');
    expect(prospectLinkState(P({ status: 'won', won_at: '2026-11-06T00:00:00.000Z', verified_at: '2026-11-06T00:00:00.000Z' }))).toBe('already_links');
  });
  it('a claimed conversation is open (no second pitch) and has its own label', () => {
    expect(OPEN_SEQUENCE_STATUSES).toContain('claimed');
    expect(SEQUENCE_LABEL.claimed).toMatch(/claimed/i);
  });
});

describe('the consent rule for "I sent it myself" (FX-LINKS M4)', () => {
  it('a named person in the UAE needs consent; an editorial inbox or a contact form there does not', () => {
    expect(manualConsentGate('AE', 'sara.k@example.ae').needed).toBe(true);
    expect(manualConsentGate('AE', 'editor@example.ae').needed).toBe(false);
    expect(manualConsentGate('AE', '').needed).toBe(false);
  });
  it('Germany, Austria and Saudi Arabia need consent whatever the address, a contact form included', () => {
    for (const c of ['DE', 'AT', 'SA']) expect(manualConsentGate(c, '').needed).toBe(true);
    expect(manualConsentGate('PK', '').needed).toBe(false);
  });
});
