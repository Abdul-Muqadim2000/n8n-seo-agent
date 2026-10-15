import { describe, expect, it } from 'vitest';
import { DRAFT_GATES_AT, OUTREACH_RATE_MIN, addWorkingDays, consentGate, draftSuperseded, draftWasSent, footerLines, inSendWindow, isAutoReply, isBounce, outreachRate, parseReturnDate, prospectDraft, replySubject, sendGap, warmupCap, type StoredDraftRow } from './outreach';

describe('link-building sending rules (v4.13)', () => {
  it('warms a new mailbox up: 5, then 10, then the set cap (at most 30)', () => {
    const start = new Date('2026-10-01T08:00:00Z');
    expect(warmupCap(start, new Date('2026-10-03T08:00:00Z'), 20)).toBe(5);
    expect(warmupCap(start, new Date('2026-10-09T08:00:00Z'), 20)).toBe(10);
    expect(warmupCap(start, new Date('2026-10-20T08:00:00Z'), 20)).toBe(20);
    expect(warmupCap(start, new Date('2026-12-20T08:00:00Z'), 99)).toBe(30);
  });
  it('sends Monday to Friday inside the hours of the mailbox\'s time zone', () => {
    expect(inSendWindow(new Date('2026-10-12T06:00:00Z'), 'Asia/Dubai', 8, 17)).toBe(true);    // Monday 10:00 in Dubai
    expect(inSendWindow(new Date('2026-10-12T14:00:00Z'), 'Asia/Dubai', 8, 17)).toBe(false);   // 18:00
    expect(inSendWindow(new Date('2026-10-10T06:00:00Z'), 'Asia/Dubai', 8, 17)).toBe(false);   // Saturday
    expect(inSendWindow(new Date('2026-10-12T06:00:00Z'), 'Not/AZone', 0, 24)).toBe(true);      // an unknown zone falls back to UTC
  });
  it('counts working days for follow-ups (a Friday + 4 = Thursday)', () => {
    expect(addWorkingDays(new Date('2026-10-16T09:00:00Z'), 4).toISOString().slice(0, 10)).toBe('2026-10-22');
    expect(addWorkingDays(new Date('2026-10-16T09:00:00Z'), 0).toISOString().slice(0, 10)).toBe('2026-10-16');
  });
  it('waits 4-9 minutes between two e-mails, the same for the same seed', () => {
    const g = sendGap('mb-1|2026-10-12T06:00:00Z');
    expect(g).toBeGreaterThanOrEqual(4 * 60_000); expect(g).toBeLessThanOrEqual(9 * 60_000); expect(sendGap('mb-1|2026-10-12T06:00:00Z')).toBe(g);
  });
  it('asks for consent where the law does: Germany / Austria / Saudi Arabia, named people in the UAE (role inboxes are fine)', () => {
    expect(consentGate('DE', 'redaktion@x.de').needed).toBe(true);
    expect(consentGate('SA', 'info@x.sa').needed).toBe(true);
    expect(consentGate('AE', 'layla.haddad@erpdaily.ae').needed).toBe(true);
    expect(consentGate('AE', 'editor@erpdaily.ae').needed).toBe(false);
    expect(consentGate('GB', 'jane@x.co.uk').needed).toBe(false);
  });
  it('every e-mail says who is writing and how to stop it; the first also the postal address and, in the EU / UK, where the address came from', () => {
    const m = { name: 'Sara Khan', title: 'Head of Finance Systems', company: 'Techand Systems', postalAddress: 'Office 1204, Bay Square, Dubai' };
    const first = footerLines(m, { firstEmail: true, country: 'GB', foundOn: 'https://x.co.uk/contact' }).join('\n');
    expect(first).toContain('Sara Khan, Head of Finance Systems · Techand Systems'); expect(first).toContain('Bay Square'); expect(first).toContain('I found your address on https://x.co.uk/contact'); expect(first).toMatch(/reply "no"/);
    // B11-3: CAN-SPAM's requirements are per message, so the postal address rides every e-mail of the sequence, not only the first
    const later = footerLines(m, { firstEmail: false, country: 'GB' }).join('\n');
    expect(later).toContain('Bay Square'); expect(later).toMatch(/reply "no"/i);
    expect(later).not.toContain('I found your address');
    expect(footerLines(m, { firstEmail: true, country: 'AE', foundOn: 'https://x.ae' }).join('\n')).not.toContain('I found your address');
  });
  it('threads follow-ups as "Re:" once', () => { expect(replySubject('A dead link on your page')).toBe('Re: A dead link on your page'); expect(replySubject('Re: x')).toBe('Re: x'); });
  it('tells automatic replies and bounces from people', () => {
    expect(isAutoReply({ 'auto-submitted': 'auto-replied' }, 'Hello')).toBe(true);
    expect(isAutoReply({ 'auto-submitted': 'no' }, 'Re: your note')).toBe(false);
    expect(isAutoReply({ 'x-autoreply': 'yes' }, 'x')).toBe(true);
    expect(isAutoReply({}, 'Out of Office: back on Monday')).toBe(true);
    expect(isAutoReply({}, 'Re: A dead link on your page')).toBe(false);
    expect(isBounce({}, 'MAILER-DAEMON@mail.x.com', 'multipart/report; report-type=delivery-status; boundary=x')).toBe(true);
    expect(isBounce({ subject: 'Undeliverable: hello' }, 'postmaster@x.com', 'multipart/mixed')).toBe(true);
    expect(isBounce({}, 'editor@x.com', 'text/plain')).toBe(false);
  });
});

describe('out-of-office return dates without the Reply Reader', () => {
  const now = new Date('2026-10-12T09:00:00Z');
  it('reads the common forms', () => {
    expect(parseReturnDate('I am out of the office until 20 October.', now)?.toISOString().slice(0, 10)).toBe('2026-10-20');
    expect(parseReturnDate('Back on October 21st, 2026', now)?.toISOString().slice(0, 10)).toBe('2026-10-21');
    expect(parseReturnDate('Returning 2026-11-02', now)?.toISOString().slice(0, 10)).toBe('2026-11-02');
    expect(parseReturnDate('I will be back 3/11', now)?.toISOString().slice(0, 10)).toBe('2026-11-03');
    expect(parseReturnDate('Away until 5 January', now)?.toISOString().slice(0, 10)).toBe('2027-01-05');
    expect(parseReturnDate('Thanks for your e-mail.', now)).toBeNull();
  });
});

// P34-1 (live 2026-10-12): the AI growth page offered a pitch to a government portal, written on 2026-10-02 — before the gates — because
// the app marked any prospect row with a stored body `drafted` and printed it.
describe('stored outreach drafts: only the ones written under the current rules are offered (P34-1)', () => {
  const row = (o: Partial<StoredDraftRow>): StoredDraftRow => ({ outreach_subject: 'A resource suggestion for your readers', outreach_body: 'I work at techand.ai. Your site appears in AI assistant answers…', ...o });
  it('withdraws a draft written before the gates, and one with no date at all', () => {
    expect(draftSuperseded(row({ drafted_at: '2026-10-02T06:00:00Z' }))).toBe(true);
    expect(draftSuperseded(row({ drafted_at: '' }))).toBe(true);
    expect(draftSuperseded(row({}))).toBe(true);
    expect(prospectDraft(row({ drafted_at: '2026-10-02T06:00:00Z' }))).toBeNull();
    expect(prospectDraft(row({ drafted_at: '' }))).toBeNull();
  });
  it('keeps a draft written on or after the gates, with its subject and body', () => {
    const r = row({ drafted_at: `${DRAFT_GATES_AT}T11:00:00Z`, outreach_subject: 'A note on your e-invoicing page', outreach_body: 'Hello, I read your list this morning…' });
    expect(draftSuperseded(r)).toBe(false);
    expect(prospectDraft(r)).toEqual({ subject: 'A note on your e-invoicing page', body: 'Hello, I read your list this morning…', draftedAt: `${DRAFT_GATES_AT}T11:00:00Z` });
    expect(prospectDraft(row({ drafted_at: '2026-11-04T08:00:00Z' }))?.body).toContain('techand.ai');
  });
  it('never withdraws a draft that was sent: it is the record the follow-ups build on', () => {
    expect(draftWasSent(row({ status: 'contacted', contacted_at: '2026-10-03T06:00:00Z' }))).toBe(true);
    expect(draftSuperseded(row({ status: 'contacted', contacted_at: '2026-10-03T06:00:00Z', drafted_at: '' }))).toBe(false);
    expect(prospectDraft(row({ status: 'won', drafted_at: '2026-10-02T06:00:00Z' }))?.body).toBeTruthy();
  });
  it('a row with no draft is simply nothing to offer', () => {
    expect(draftSuperseded({ outreach_body: '', drafted_at: '' })).toBe(false);
    expect(prospectDraft({ outreach_body: '' })).toBeNull();
    expect(prospectDraft(null)).toBeNull();
    expect(prospectDraft(undefined)).toBeNull();
  });
});

// ---- B11-1 (2026-10-15, benchmark area 11): an outreach rate is measured or it is withheld ----------------------------------
// Before this, the Link building page printed a reply rate off three conversations and a red "50.0% bounced" badge off one bounce
// in two e-mails, on the same screen as a subject-line test that refuses to name a winner under 30 sends per style.
describe('B11-1 outreach rates refuse a sample they cannot be read from', () => {
  it('prints no rate under the floor, and says how many more are needed', () => {
    const r = outreachRate('reply', 1, 3, 'conversations');
    expect(r.value).toBeNull();
    expect(r.basis).toBe('unavailable');
    expect(r.note).toContain('1 of 3 conversations');
    expect(r.note).toContain(String(OUTREACH_RATE_MIN.reply));
  });
  it('says nothing at all when nothing has gone out', () => {
    const r = outreachRate('win', 0, 0, 'sites contacted');
    expect(r.value).toBeNull();
    expect(r.note).toMatch(/Nothing to count yet/);
  });
  it('reads the rate once the sample is there, and names what it counted', () => {
    const r = outreachRate('reply', 4, 40, 'conversations');
    expect(r.value).toBe(10);
    expect(r.basis).toBe('measured');
    expect(r.note).toBe('4 of 40 conversations.');
  });
  it('the bounce floor is the one the 2% limit needs: one bounce in 50 IS 2%, so nothing is read below it', () => {
    expect(OUTREACH_RATE_MIN.bounce).toBe(50);
    expect(outreachRate('bounce', 1, 49, 'e-mails sent').value).toBeNull();
    expect(outreachRate('bounce', 1, 50, 'e-mails sent').value).toBe(2);
  });
  it('never reports more hits than the sample', () => {
    expect(outreachRate('reply', 99, 20, 'conversations').value).toBe(100);
  });
});
